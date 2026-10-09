// SPDX-License-Identifier: LGPL-2.1-or-later
import { DESTINATIONS, planetMaterial } from "./exploration.js";
const size = 16,
  radius = 3;
const neighbors = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
// Render cache only: procedural get()/collision and saved edits remain the truth.
// Bounded work per frame and eviction avoid allocating a whole solid planet.
export function streamPlanetChunks(world, eye, budget = 2) {
  if (!world.spec.exploration) return;
  world.streamChunks ||= new Map();
  const center = eye.map((v) => Math.floor(v / size)),
    wanted = new Map();
  for (const planet of DESTINATIONS.filter((p) => p.streamed)) {
    if (
      Math.hypot(...eye.map((v, i) => v - planet.center[i])) >
      planet.radius + 110
    )
      continue;
    for (let x = center[0] - radius; x <= center[0] + radius; x++)
      for (let y = center[1] - radius; y <= center[1] + radius; y++)
        for (let z = center[2] - radius; z <= center[2] + radius; z++) {
          const chunk = [x, y, z],
            lo = chunk.map((v) => v * size),
            hi = lo.map((v) => v + 15);
          const min = planet.center.map((v, i) =>
            Math.max(lo[i] - v, 0, v - hi[i]),
          );
          const max = planet.center.map((v, i) =>
            Math.max(Math.abs(lo[i] - v), Math.abs(hi[i] - v)),
          );
          const k = chunk.join(",");
          if (
            (Math.hypot(...min) <= planet.radius + 10 &&
              Math.hypot(...max) >= planet.radius - 10) ||
            [...(world.chunks.get(k) || [])].some((p) => world.edits.has(p))
          )
            wanted.set(k, Math.hypot(...chunk.map((v, i) => v - center[i])));
        }
  }
  for (const [k, cells] of world.streamChunks)
    if (!wanted.has(k)) {
      for (const p of cells)
        if (!world.edits.has(p)) {
          world.cells.delete(p);
          world.chunks.get(k)?.delete(p);
        }
      world.dirty.add(k);
      world.streamChunks.delete(k);
    }
  for (const [k] of [...wanted].sort((a, b) => a[1] - b[1])) {
    if (world.streamChunks.has(k)) continue;
    if (budget-- <= 0) break;
    const lo = k.split(",").map((v) => Number(v) * size),
      cells = [];
    // Insert directly, then mark the chunk and neighbors once, not per voxel.
    world.chunks.set(k, world.chunks.get(k) || new Set());
    for (let x = lo[0]; x < lo[0] + size; x++)
      for (let y = lo[1]; y < lo[1] + size; y++)
        for (let z = lo[2]; z < lo[2] + size; z++) {
          const p = [x, y, z],
            name = p.join(","),
            id = planetMaterial(p, true);
          if (world.edits.has(name)) continue;
          if (id) {
            world.cells.set(name, { id, rotation: 0 });
            world.chunks.get(k).add(name);
            cells.push(name);
          }
        }
    world.streamChunks.set(k, cells);
    world.dirty.add(k);
    const chunk = k.split(",").map(Number);
    for (const n of neighbors)
      world.dirty.add(chunk.map((v, i) => v + n[i]).join(","));
  }
}
