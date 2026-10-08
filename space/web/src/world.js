// SPDX-License-Identifier: LGPL-2.1-or-later
// This local authority is NOT the Luanti multiplayer server. A future transport
// must perform these validations remotely; never accept browser world authority.
import { DESTINATIONS, planetMaterial } from "./exploration.js";
export const PALETTE = [
  { name: "space_core:alloy", title: "Pearl alloy", color: [0.76, 0.84, 0.86] },
  { name: "space_core:slate", title: "Basalt", color: [0.24, 0.32, 0.39] },
  { name: "space_core:copper", title: "Copper rib", color: [0.79, 0.43, 0.28] },
  { name: "space_core:light", title: "Cyan signal", color: [0.26, 0.88, 0.85] },
  { name: "expedition:moss", title: "Morrow moss", color: [0.48, 0.64, 0.42] },
  { name: "expedition:ochre", title: "Ember ochre", color: [0.74, 0.43, 0.3] },
  {
    name: "expedition:solar",
    title: "Solar charger",
    color: [0.3, 0.38, 0.73],
  },
  {
    name: "expedition:battery",
    title: "Main battery",
    color: [0.79, 0.72, 0.35],
  },
];
// ID 5 is reserved for the protected launch/ship core, not a palette index.
export const MATERIAL_IDS = [1, 2, 3, 4, 6, 7, 8, 9];
export const material = (id) => PALETTE[MATERIAL_IDS.indexOf(id)] || PALETTE[0];
export const REACH = 10,
  LIMIT = 1000,
  MAX_EDITS = 20000;
export const key = (p) => p.join(",");
export const chunkKey = (p) => p.map((v) => Math.floor(v / 16)).join(",");
export const finite = (v) => typeof v === "number" && Number.isFinite(v);
export const cellValid = (p) =>
  Array.isArray(p) &&
  p.length === 3 &&
  p.every((v) => Number.isInteger(v) && Math.abs(v) <= LIMIT);
export const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const same = (a, b) => a.id === b.id && a.rotation === b.rotation;
export function materialAt(spec, p) {
  const [x, y, z] = p;
  for (let i = 0; i < spec.islands.length; i++) {
    const island = spec.islands[i],
      depth = island.y - y;
    if (depth < 0 || depth > island.depth) continue;
    const radius = island.radius * (1 - (0.75 * depth) / island.depth);
    if ((x - island.x) ** 2 + (z - island.z) ** 2 > radius ** 2) continue;
    if (i === 0 && depth === 0 && Math.abs(x) <= 3 && Math.abs(z) <= 3)
      return 5;
    if (depth === 0 && (x + z) % 11 === 0) return 4;
    return depth === 0 ? 1 : 2;
  }
  return spec.exploration ? planetMaterial(p) : 0;
}
export function overlapsPlayer(p, feet) {
  return (
    p[0] + 0.5 > feet[0] - 0.3 &&
    p[0] - 0.5 < feet[0] + 0.3 &&
    p[1] + 0.5 > feet[1] &&
    p[1] - 0.5 < feet[1] + 1.75 &&
    p[2] + 0.5 > feet[2] - 0.3 &&
    p[2] - 0.5 < feet[2] + 0.3
  );
}
export class World {
  constructor(spec) {
    this.spec = spec;
    this.cells = new Map();
    this.edits = new Map();
    this.chunks = new Map();
    this.dirty = new Set();
    this.undo = [];
    this.redo = [];
    this.lastEdit = -Infinity;
    this.revision = 0;
    for (const island of spec.islands) {
      for (let y = island.y - island.depth; y <= island.y; y++)
        for (
          let z = island.z - island.radius;
          z <= island.z + island.radius;
          z++
        )
          for (
            let x = island.x - island.radius;
            x <= island.x + island.radius;
            x++
          ) {
            const p = [x, y, z],
              id = materialAt(spec, p);
            if (id) this.set(p, { id, rotation: 0 }, false);
          }
    }
    if (spec.exploration)
      for (const planet of DESTINATIONS) {
        const [cx, cy, cz] = planet.center,
          r = planet.radius + 8;
        for (let x = cx - r; x <= cx + r; x++)
          for (let y = cy - r; y <= cy + r; y++)
            for (let z = cz - r; z <= cz + r; z++) {
              const p = [x, y, z],
                id = planetMaterial(p);
              if (id) this.set(p, { id, rotation: 0 }, false);
            }
      }
  }
  get(p) {
    return this.cells.get(key(p)) || { id: 0, rotation: 0 };
  }
  set(p, node, persist = true) {
    const k = key(p),
      ck = chunkKey(p);
    if (!this.chunks.has(ck)) this.chunks.set(ck, new Set());
    if (node.id) {
      this.cells.set(k, { ...node });
      this.chunks.get(ck).add(k);
    } else {
      this.cells.delete(k);
      this.chunks.get(ck).delete(k);
    }
    for (const offset of [
      [0, 0, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ])
      this.dirty.add(chunkKey(p.map((v, i) => v + offset[i])));
    if (persist) {
      const baseline = { id: materialAt(this.spec, p), rotation: 0 };
      if (same(baseline, node)) this.edits.delete(k);
      else this.edits.set(k, { ...node });
      this.revision++;
    }
  }
  validate(p, player, placement) {
    if (!cellValid(p) || distance(p, player.eye) > REACH + 0.9)
      return "Out of reach";
    if (this.get(p).id === 5) return "Launch anchor is protected";
    if (placement && this.get(p).id) return "Cell is occupied";
    if (placement && overlapsPlayer(p, player.feet))
      return "Too close to your body";
    if (!placement && !this.get(p).id) return "Nothing to remove";
    if (!this.edits.has(key(p)) && this.edits.size >= MAX_EDITS)
      return "Save edit limit reached";
    return "";
  }
  command(action, player, selection, time) {
    if (!["place", "remove", "undo", "redo"].includes(action))
      return { ok: false, reason: "Unknown command" };
    if (!finite(time) || time - this.lastEdit < 0.16)
      return { ok: false, reason: "Build cooldown" };
    this.lastEdit = time;
    if (action === "undo" || action === "redo") {
      const source = action === "undo" ? this.undo : this.redo,
        destination = action === "undo" ? this.redo : this.undo;
      const entry = source.at(-1);
      if (!entry) return { ok: false, reason: `Nothing to ${action}` };
      const expected = action === "undo" ? entry.after : entry.before;
      const desired = action === "undo" ? entry.before : entry.after;
      if (!same(this.get(entry.p), expected))
        return { ok: false, reason: "Cell changed" };
      if (
        distance(entry.p, player.eye) > REACH + 0.9 ||
        (desired.id && overlapsPlayer(entry.p, player.feet))
      )
        return { ok: false, reason: "Move closer to that edit" };
      this.set(entry.p, desired);
      source.pop();
      destination.push(entry);
      return { ok: true };
    }
    if (
      !Number.isInteger(selection.id) ||
      !MATERIAL_IDS.includes(selection.id) ||
      !Number.isInteger(selection.rotation) ||
      selection.rotation < 0 ||
      selection.rotation > 3
    )
      return { ok: false, reason: "Invalid material" };
    const target = raycast(this, player.eye, player.direction);
    if (!target) return { ok: false, reason: "Aim at a surface" };
    const p = action === "place" ? target.above : target.under;
    const reason = this.validate(p, player, action === "place");
    if (reason) return { ok: false, reason };
    const before = { ...this.get(p) },
      after =
        action === "place"
          ? { id: selection.id, rotation: selection.rotation }
          : { id: 0, rotation: 0 };
    this.set(p, after);
    this.undo.push({ p, before, after });
    this.undo = this.undo.slice(-64);
    this.redo = [];
    return { ok: true, p };
  }
}
// Exact grid DDA: nodes have integer centers, matching native Luanti coordinates.
export function raycast(world, origin, direction, reach = REACH) {
  if (
    ![origin, direction].every(
      (v) => Array.isArray(v) && v.length === 3 && v.every(finite),
    )
  )
    return null;
  const length = Math.hypot(...direction);
  if (length < 0.00001) return null;
  const d = direction.map((v) => v / length),
    p = origin.map((v) => Math.floor(v + 0.5));
  const step = d.map((v) => Math.sign(v)),
    delta = d.map((v) => (v ? Math.abs(1 / v) : Infinity));
  const next = d.map((v, i) =>
    v ? (p[i] + step[i] * 0.5 - origin[i]) / v : Infinity,
  );
  let traveled = 0,
    previous = [...p];
  for (let iteration = 0; iteration < 64 && traveled <= reach; iteration++) {
    if (world.get(p).id)
      return { under: [...p], above: previous, distance: traveled };
    const axis =
      next[0] <= next[1] && next[0] <= next[2] ? 0 : next[1] <= next[2] ? 1 : 2;
    previous = [...p];
    p[axis] += step[axis];
    traveled = next[axis];
    next[axis] += delta[axis];
  }
  return null;
}
