// SPDX-License-Identifier: LGPL-2.1-or-later
// Solo authority prototype: local cells + one pose, never moving terrain edits.
import {
  World,
  key,
  finite,
  cellValid,
  MATERIAL_IDS,
  distance,
} from "./world.js";
import { basis } from "./flight.js";
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
    this.energy = 100;
    this.solar = 0;
    this.mainOn = true;
    this.piloting = false;
    this.set([0, 0, 0], { id: 5, rotation: 0 }, false);
    for (let x = -2; x <= 2; x++)
      for (let z = -3; z <= 3; z++)
        this.set([x, -1, z], { id: 1, rotation: 0 }, false);
    for (const x of [-2, 2])
      for (let z = -2; z <= 2; z++)
        this.set([x, 0, z], { id: z === 0 ? 8 : 3, rotation: 0 }, false);
    for (const x of [-1, 0, 1])
      this.set([x, 0, 3], { id: 4, rotation: 0 }, false);
    this.set([0, 0, -3], { id: 9, rotation: 0 }, false);
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
    return p.map((v, i) => v - this.position[i]);
  }
  global(p) {
    return p.map((v, i) => v + this.position[i]);
  }
  pose(player) {
    return {
      feet: this.local(player.feet),
      eye: this.local(player.eye),
      direction: player.direction,
    };
  }
  validate(p, player, placement) {
    if (this.piloting) return "Park before editing your ship";
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
  collides(terrain, position) {
    for (const k of this.cells.keys()) {
      const p = k.split(",").map((v, i) => Number(v) + position[i]);
      // Continuous translated cubes overlap up to two integer cells per axis.
      for (let x = Math.floor(p[0]); x <= Math.ceil(p[0]); x++)
        for (let y = Math.floor(p[1]); y <= Math.ceil(p[1]); y++)
          for (let z = Math.floor(p[2]); z <= Math.ceil(p[2]); z++)
            if (terrain.get([x, y, z]).id) return true;
    }
    return false;
  }
  board(player) {
    if (distance(player.feet, this.position) > 12) return false;
    this.piloting = true;
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
      let clear = true;
      for (let y = 0; y < 3; y++)
        if (terrain.get(p.map((v, i) => Math.round(v) + (i === 1 ? y : 0))).id)
          clear = false;
      if (
        [...this.cells.keys()].some(
          (k) => distance(k.split(",").map(Number), offset) < 2.5,
        )
      )
        clear = false;
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
          let exposed = true;
          for (let y = p[1] + 1; y <= 12; y++)
            if (this.get([p[0], y, p[2]]).id) exposed = false;
          const g = this.global(p).map(Math.round);
          for (let y = g[1] + 1; y <= 1000; y++)
            if (terrain.get([g[0], y, g[2]]).id) {
              exposed = false;
              break;
            }
          if (exposed) this.solarRate += 3;
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
    const b = basis(yaw, player.pitch),
      speed = powered ? (boost ? 42 : 14) : 0;
    let desired = b.forward.map(
      (v, i) =>
        v * actions.move_forward +
        b.right[i] * actions.move_right +
        (i === 1 ? Number(actions.ascend) - Number(actions.descend) : 0),
    );
    const length = Math.max(1, Math.hypot(...desired));
    desired = desired.map((v) => (v / length) * speed);
    const diff = desired.map((v, i) => v - this.velocity[i]),
      factor = Math.min(1, (22 * dt) / (Math.hypot(...diff) || 1));
    this.velocity = this.velocity.map((v, i) => v + diff[i] * factor);
    for (let axis = 0; axis < 3; axis++) {
      const candidate = [...this.position];
      candidate[axis] += this.velocity[axis] * dt;
      if (Math.abs(candidate[axis]) > 950 || this.collides(terrain, candidate))
        this.velocity[axis] = 0;
      else this.position = candidate;
    }
    player.feet = this.global([0, 1, -1]);
    player.velocity = [...this.velocity];
  }
  data() {
    return {
      version: 1,
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
      raw.version !== 1 ||
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
    ship.energy = raw.energy;
    ship.solar = raw.solar;
    ship.mainOn = raw.mainOn;
    ship.piloting = raw.piloting;
    return ship;
  }
}
