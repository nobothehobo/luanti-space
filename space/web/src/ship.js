// SPDX-License-Identifier: LGPL-2.1-or-later
// Solo authority prototype: local cells + one pose, never moving terrain edits.
import {
  World,
  key,
  finite,
  cellValid,
  MATERIAL_IDS,
  distance,
  raycast,
} from "./world.js";
import { basis, blocked } from "./flight.js";
import { rotateVector, inverseVector, turnToward } from "./ship-motion.js";
export const SHIP_LIMIT = 512;
export const SHIP_HOME = [8, 36, -2];
const NEIGHBORS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export function connected(cells) {
  const seen = new Set(),
    queue = ["0,0,0"];
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i];
    if (seen.has(k) || !cells.has(k)) continue;
    seen.add(k);
    const p = k.split(",").map(Number);
    for (const n of NEIGHBORS) queue.push(key(p.map((v, j) => v + n[j])));
  }
  return seen.size === cells.size;
}
export class Ship extends World {
  constructor() {
    super({ generator: 1, islands: [] });
    this.position = [...SHIP_HOME];
    this.velocity = [0, 0, 0];
    this.yaw = 0;
    this.pitch = 0;
    this.launchRemaining = 0;
    this.energy = 100;
    this.solar = 0;
    this.mainOn = true;
    this.piloting = false;
    this.set([0, 0, 0], { id: 5, rotation: 0 }, false);
    // Original survey skiff: narrow bow, cockpit ribs, solar wings and twin aft pods.
    for (let x = -1; x <= 1; x++)
      for (let z = -4; z <= 3; z++)
        this.set([x, -1, z], { id: 1, rotation: 0 }, false);
    for (const x of [-1, 1]) {
      for (let z = 0; z <= 2; z++)
        this.set([x, 0, z], { id: 1, rotation: 0 }, false);
      this.set([x, 0, -4], { id: 3, rotation: 0 }, false);
      this.set([x, 0, -5], { id: 4, rotation: 0 }, false);
      this.set([x * 2, -1, -1], { id: 3, rotation: 0 }, false);
      this.set([x * 3, -1, -1], { id: 8, rotation: 0 }, false);
    }
    this.set([0, -1, 4], { id: 1, rotation: 0 }, false);
    this.set([0, 0, 4], { id: 4, rotation: 0 }, false);
    this.set([0, 0, -3], { id: 9, rotation: 0 }, false);
    this.set([0, 0, -4], { id: 1, rotation: 0 }, false);
    this.set([0, 1, -4], { id: 3, rotation: 0 }, false);
    this.energy = 100;
  }
  capacity() {
    return [...this.cells.values()].filter((n) => n.id === 9).length * 100;
  }
  set(p, node, persist = true) {
    super.set(p, node, persist);
    if (finite(this.energy))
      this.energy = Math.min(this.energy, this.capacity());
  }
  local(p) {
    return inverseVector(
      p.map((v, i) => v - this.position[i]),
      this.yaw,
      this.pitch,
    );
  }
  global(p) {
    return rotateVector(p, this.yaw, this.pitch).map(
      (v, i) => v + this.position[i],
    );
  }
  pose(player) {
    return {
      feet: this.local(player.feet),
      eye: this.local(player.eye),
      direction:
        player.direction &&
        inverseVector(player.direction, this.yaw, this.pitch),
    };
  }
  validate(p, player, placement) {
    if (this.piloting) return "Park before editing your ship";
    if (placement && player.worldFeet && this.bodyBlocked(player.worldFeet, p))
      return "Too close to your body";
    if (p.some((v) => Math.abs(v) > 12)) return "Starter hull size limit";
    if (placement && this.cells.size >= SHIP_LIMIT)
      return "Hull block limit reached";
    if (placement && p[0] === 0 && p[2] === -1 && p[1] >= 1 && p[1] <= 3)
      return "Leave the pilot cabin clear";
    if (
      placement &&
      !NEIGHBORS.some((n) => this.get(p.map((v, i) => v + n[i])).id)
    )
      return "Attach blocks to your hull";
    if (!placement) {
      const candidate = new Map(this.cells);
      candidate.delete(key(p));
      if (!connected(candidate)) return "That would split the hull";
    }
    return super.validate(p, player, placement);
  }
  command(action, player, selection, time) {
    if (this.piloting)
      return { ok: false, reason: "Park before editing your ship" };
    if (action === "undo" || action === "redo") {
      const entry = (action === "undo" ? this.undo : this.redo).at(-1);
      if (entry) {
        const desired = action === "undo" ? entry.before : entry.after;
        const reason = this.validate(
          entry.p,
          this.pose(player),
          Boolean(desired.id),
        );
        // Occupied cells are valid replacements during history replay.
        if (
          reason &&
          reason !== "Cell is occupied" &&
          reason !== "Nothing to remove"
        )
          return { ok: false, reason };
      }
    }
    return super.command(action, this.pose(player), selection, time);
  }
  bodyBlocked(feet, cell = null) {
    const b = basis(this.yaw, this.pitch);
    const extent = [0, 1, 2].map(
      (i) =>
        0.5 *
        (Math.abs(b.right[i]) + Math.abs(b.up[i]) + Math.abs(b.forward[i])),
    );
    const cells = cell
      ? [cell]
      : [...this.cells.keys()].map((k) => k.split(",").map(Number));
    return cells.some((p) => {
      const c = this.global(p);
      return (
        c[0] + extent[0] > feet[0] - 0.3 &&
        c[0] - extent[0] < feet[0] + 0.3 &&
        c[1] + extent[1] > feet[1] &&
        c[1] - extent[1] < feet[1] + 1.75 &&
        c[2] + extent[2] > feet[2] - 0.3 &&
        c[2] - extent[2] < feet[2] + 0.3
      );
    });
  }
  collides(terrain, position, yaw = this.yaw, pitch = this.pitch) {
    const b = basis(yaw, pitch);
    const ext = [0, 1, 2].map(
      (i) =>
        0.5 *
        (Math.abs(b.right[i]) + Math.abs(b.up[i]) + Math.abs(b.forward[i])),
    );
    for (const k of this.cells.keys()) {
      const p = rotateVector(k.split(",").map(Number), yaw, pitch).map(
        (v, i) => v + position[i],
      );
      // Conservative rotated cube bounds prevent terrain penetration during turns.
      const lo = p.map((v, i) => Math.floor(v - ext[i] + 0.5 + 1e-6));
      const hi = p.map((v, i) => Math.floor(v + ext[i] + 0.5 - 1e-6));
      for (let x = lo[0]; x <= hi[0]; x++)
        for (let y = lo[1]; y <= hi[1]; y++)
          for (let z = lo[2]; z <= hi[2]; z++)
            if (terrain.get([x, y, z]).id) return true;
    }
    return false;
  }
  board(player) {
    if (distance(player.feet, this.position) > 12) return false;
    this.piloting = true;
    // A short powered vertical departure only at the orbital berth.
    if (distance(this.position, [218, 117, 104]) < 2) this.launchRemaining = 4;
    player.feet = this.global([0, 1, -1]);
    player.velocity = [0, 0, 0];
    return true;
  }
  disembark(player, terrain) {
    // Search clear exits, not a teleport into a hill or the hull.
    for (const offset of [
      [4, 1, 0],
      [-4, 1, 0],
      [0, 5, -5],
      [0, 15, 0],
    ]) {
      const p = this.global(offset);
      const clear = !blocked(terrain, p) && !this.bodyBlocked(p);
      if (clear) {
        this.piloting = false;
        this.velocity = [0, 0, 0];
        player.feet = p;
        player.velocity = [0, 0, 0];
        return true;
      }
    }
    return false;
  }
  tick(actions, dt, yaw, terrain, player) {
    // Sunlight is a fixed +Y direction in this first sector. Hull/terrain shadow
    // occludes chargers; cruise is cheap and boost is deliberately more costly.
    this.sunClock = (this.sunClock || 0) + dt;
    if (this.sunClock >= 0.5) {
      this.sunClock = 0;
      this.solarRate = 0;
      for (const [k, n] of this.cells)
        if (n.id === 8) {
          const p = k.split(",").map(Number);
          const sunLocal = inverseVector([0, 1, 0], this.yaw, this.pitch);
          let exposed =
            sunLocal[1] > 0.1 &&
            !raycast(
              this,
              p.map((v, i) => v + (i === 1 ? 0.501 : 0)),
              sunLocal,
              40,
            );
          const g = this.global(p).map(Math.round);
          for (let y = g[1] + 1; y <= 1000; y++)
            if (terrain.get([g[0], y, g[2]]).id) {
              exposed = false;
              break;
            }
          if (exposed) this.solarRate += 3 * sunLocal[1];
        }
    }
    this.solar = Math.min(100, this.solar + (this.solarRate || 0) * dt);
    this.energy = Math.min(this.energy, this.capacity());
    if (!this.mainOn) {
      const transfer = Math.min(
        this.solar,
        Math.max(0, this.capacity() - this.energy),
        12 * dt,
      );
      this.solar -= transfer;
      this.energy += transfer;
    }
    const powered = this.mainOn && this.energy > 0.1;
    const boost = actions.boost && powered && this.energy > 1;
    const moving =
      Math.abs(actions.move_forward) +
        Math.abs(actions.move_right) +
        Number(actions.ascend) +
        Number(actions.descend) >
      0;
    this.energy = Math.max(
      0,
      this.energy -
        (this.piloting && powered && moving ? (boost ? 18 : 0.6) : 0) * dt,
    );
    if (!this.piloting) return;
    const nextYaw = turnToward(this.yaw, yaw, 1.4 * dt),
      nextPitch = turnToward(this.pitch, player.pitch, 0.9 * dt);
    if (powered && !this.collides(terrain, this.position, nextYaw, nextPitch)) {
      this.yaw = (nextYaw + Math.PI * 2) % (Math.PI * 2);
      this.pitch = nextPitch;
    }
    const b = basis(this.yaw, this.pitch),
      speed = powered ? (boost ? 42 : 14) : 0;
    let desired = b.forward.map(
      (v, i) =>
        v * actions.move_forward +
        b.right[i] * actions.move_right +
        (i === 1 ? Number(actions.ascend) - Number(actions.descend) : 0),
    );
    const launching = powered && moving && this.launchRemaining > 0;
    if (launching) desired = [0, 1, 0];
    const length = Math.max(1, Math.hypot(...desired));
    desired = desired.map((v) => (v / length) * (launching ? 4 : speed));
    const diff = desired.map((v, i) => v - this.velocity[i]),
      factor = Math.min(
        1,
        ((moving && powered ? 7 : 12) * dt) / (Math.hypot(...diff) || 1),
      );
    this.velocity = this.velocity.map((v, i) => v + diff[i] * factor);
    for (let axis = 0; axis < 3; axis++) {
      const candidate = [...this.position];
      candidate[axis] += this.velocity[axis] * dt;
      if (Math.abs(candidate[axis]) > 950 || this.collides(terrain, candidate))
        this.velocity[axis] = 0;
      else {
        if (launching && axis === 1)
          this.launchRemaining = Math.max(
            0,
            this.launchRemaining - (candidate[1] - this.position[1]),
          );
        this.position = candidate;
      }
    }
    player.feet = this.global([0, 1, -1]);
    player.velocity = [...this.velocity];
  }
  data() {
    return {
      version: 2,
      yaw: this.yaw,
      pitch: this.pitch,
      launchRemaining: this.launchRemaining,
      position: [...this.position],
      energy: this.energy,
      solar: this.solar,
      mainOn: this.mainOn,
      piloting: this.piloting,
      cells: [...this.cells].map(([k, n]) => [
        ...k.split(",").map(Number),
        n.id,
        n.rotation,
      ]),
    };
  }
  static validate(raw) {
    if (
      !raw ||
      ![1, 2].includes(raw.version) ||
      !Array.isArray(raw.position) ||
      raw.position.length !== 3 ||
      !raw.position.every((v) => finite(v) && Math.abs(v) <= 950) ||
      !finite(raw.energy) ||
      raw.energy < 0 ||
      raw.energy > SHIP_LIMIT * 100 ||
      !Array.isArray(raw.cells) ||
      raw.cells.length > SHIP_LIMIT
    )
      throw Error("Invalid ship save");
    if (
      raw.version === 2 &&
      (!finite(raw.yaw) ||
        raw.yaw < 0 ||
        raw.yaw >= Math.PI * 2 ||
        !finite(raw.pitch) ||
        Math.abs(raw.pitch) > 1.5 ||
        !finite(raw.launchRemaining) ||
        raw.launchRemaining < 0 ||
        raw.launchRemaining > 4)
    )
      throw Error("Invalid ship orientation");
    if (typeof raw.piloting !== "boolean") throw Error("Invalid pilot state");
    if (
      typeof raw.mainOn !== "boolean" ||
      !finite(raw.solar) ||
      raw.solar < 0 ||
      raw.solar > 100
    )
      throw Error("Invalid battery state");
    const cells = new Map();
    for (const e of raw.cells) {
      if (
        !Array.isArray(e) ||
        e.length !== 5 ||
        !cellValid(e.slice(0, 3)) ||
        e.slice(0, 3).some((v) => Math.abs(v) > 12) ||
        ![...MATERIAL_IDS, 5].includes(e[3]) ||
        !Number.isInteger(e[4]) ||
        e[4] < 0 ||
        e[4] > 3 ||
        cells.has(key(e.slice(0, 3))) ||
        (e[3] === 5 && key(e.slice(0, 3)) !== "0,0,0")
      )
        throw Error("Invalid hull cell");
      cells.set(key(e.slice(0, 3)), { id: e[3], rotation: e[4] });
    }
    if (cells.get("0,0,0")?.id !== 5 || !connected(cells))
      throw Error("Hull must remain attached to its core");
    if (raw.energy > [...cells.values()].filter((n) => n.id === 9).length * 100)
      throw Error("Battery charge exceeds capacity");
    // Keep the pilot's two-cell cabin free.
    if (cells.has("0,1,-1") || cells.has("0,2,-1") || cells.has("0,3,-1"))
      throw Error("Pilot cabin is blocked");
    return raw;
  }
  static restore(raw) {
    Ship.validate(raw);
    const ship = new Ship();
    for (const k of [...ship.cells.keys()])
      ship.set(k.split(",").map(Number), { id: 0, rotation: 0 }, false);
    for (const e of raw.cells)
      ship.set(e.slice(0, 3), { id: e[3], rotation: e[4] }, false);
    ship.position = [...raw.position];
    ship.yaw = raw.version === 2 ? raw.yaw : 0;
    ship.pitch = raw.version === 2 ? raw.pitch : 0;
    ship.launchRemaining = raw.version === 2 ? raw.launchRemaining : 0;
    ship.energy = raw.energy;
    ship.solar = raw.solar;
    ship.mainOn = raw.mainOn;
    ship.piloting = raw.piloting;
    return ship;
  }
}
