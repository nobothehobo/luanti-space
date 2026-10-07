// SPDX-License-Identifier: LGPL-2.1-or-later
import {
  cellValid,
  finite,
  MAX_EDITS,
  materialAt,
  overlapsPlayer,
} from "./world.js";
export const SAVE_KEY = "luanti-space-browser-v1";
export function snapshot(world, player, settings) {
  return {
    format: "luanti-space-browser",
    version: 1,
    generator: world.spec.generator,
    edits: [...world.edits].map(([p, n]) => [
      ...p.split(",").map(Number),
      n.id,
      n.rotation,
    ]),
    player: { feet: [...player.feet], yaw: player.yaw, pitch: player.pitch },
    settings: { ...settings },
  };
}
export function validateSave(raw, spec) {
  if (
    !raw ||
    raw.format !== "luanti-space-browser" ||
    raw.version !== 1 ||
    raw.generator !== spec.generator
  )
    throw new Error(
      "Unsupported save version. Your current world has not been changed.",
    );
  if (!Array.isArray(raw.edits) || raw.edits.length > MAX_EDITS)
    throw new Error("Invalid edit list");
  const seen = new Set();
  for (const e of raw.edits) {
    if (
      !Array.isArray(e) ||
      e.length !== 5 ||
      !cellValid(e.slice(0, 3)) ||
      !Number.isInteger(e[3]) ||
      e[3] < 0 ||
      e[3] > 4 ||
      !Number.isInteger(e[4]) ||
      e[4] < 0 ||
      e[4] > 3 ||
      materialAt(spec, e.slice(0, 3)) === 5
    )
      throw new Error("Invalid or protected voxel edit");
    const k = e.slice(0, 3).join(",");
    if (seen.has(k)) throw new Error("Duplicate voxel edit");
    seen.add(k);
  }
  const p = raw.player;
  if (
    !p ||
    !Array.isArray(p.feet) ||
    p.feet.length !== 3 ||
    !p.feet.every((v) => finite(v) && Math.abs(v) < 998) ||
    !finite(p.yaw) ||
    Math.abs(p.yaw) > Math.PI * 2 ||
    !finite(p.pitch) ||
    Math.abs(p.pitch) > 1.5
  )
    throw new Error("Invalid player position");
  const s = raw.settings;
  if (
    !s ||
    !finite(s.sensitivity) ||
    s.sensitivity < 0.05 ||
    s.sensitivity > 0.5 ||
    !["low", "balanced", "high"].includes(s.quality) ||
    typeof s.gentle !== "boolean" ||
    !Number.isInteger(s.id) ||
    s.id < 1 ||
    s.id > 4 ||
    !Number.isInteger(s.rotation) ||
    s.rotation < 0 ||
    s.rotation > 3
  )
    throw new Error("Invalid settings");
  return raw;
}
export function restore(world, raw) {
  const s = validateSave(raw, world.spec);
  for (const e of s.edits)
    world.set(e.slice(0, 3), { id: e[3], rotation: e[4] });
  // Never load a player inside a newly imported structure.
  let feet = [...s.player.feet];
  if (
    [...world.cells.keys()].some((k) =>
      overlapsPlayer(k.split(",").map(Number), feet),
    )
  )
    feet = [0, 34, -6];
  return {
    player: { ...s.player, feet, velocity: [0, 0, 0] },
    settings: { ...s.settings },
  };
}
