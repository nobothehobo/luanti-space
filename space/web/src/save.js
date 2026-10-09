// SPDX-License-Identifier: LGPL-2.1-or-later
import {
  cellValid,
  finite,
  MAX_EDITS,
  materialAt,
  MATERIAL_IDS,
} from "./world.js";
import { DESTINATIONS } from "./exploration.js";
import { blocked } from "./flight.js";
import { Ship } from "./ship.js";
export const SAVE_KEY = "luanti-space-browser-v1";
export function snapshot(world, player, settings, ship = null) {
  return {
    format: "luanti-space-browser",
    version: ship ? 2 : 1,
    ...(ship ? { ship: ship.data(), exploration: 1 } : {}),
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
    ![1, 2].includes(raw.version) ||
    raw.generator !== spec.generator
  )
    throw new Error(
      "Unsupported save version. Your current world has not been changed.",
    );
  if (raw.version === 2) {
    if (raw.exploration !== 1) throw Error("Unsupported exploration save");
    Ship.validate(raw.ship);
  }
  if (!Array.isArray(raw.edits) || raw.edits.length > MAX_EDITS)
    throw new Error("Invalid edit list");
  const seen = new Set();
  for (const e of raw.edits) {
    if (
      !Array.isArray(e) ||
      e.length !== 5 ||
      !cellValid(e.slice(0, 3)) ||
      !Number.isInteger(e[3]) ||
      ![0, ...MATERIAL_IDS].includes(e[3]) ||
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
    !MATERIAL_IDS.includes(s.id) ||
    !Number.isInteger(s.rotation) ||
    s.rotation < 0 ||
    s.rotation > 3
  )
    throw new Error("Invalid settings");
  if (s.camera !== undefined && !["chase", "cockpit"].includes(s.camera))
    throw Error("Invalid camera mode");
  if (
    s.destination !== undefined &&
    (!Number.isInteger(s.destination) ||
      s.destination < 0 ||
      s.destination >= DESTINATIONS.length)
  )
    throw Error("Invalid destination");
  if (
    s.controls !== undefined &&
    !["auto", "touch", "keyboard"].includes(s.controls)
  )
    throw Error("Invalid control mode");
  return raw;
}
export function restore(world, raw) {
  const s = validateSave(raw, world.spec);
  const ship = s.version === 2 ? Ship.restore(s.ship) : new Ship();
  for (const e of s.edits)
    world.set(e.slice(0, 3), { id: e[3], rotation: e[4] });
  if (ship.collides(world, ship.position)) {
    if (s.version === 2) throw Error("Saved ship intersects terrain");
    while (ship.collides(world, ship.position) && ship.position[1] < 900)
      ship.position[1] += 20;
    if (ship.collides(world, ship.position))
      throw Error("No clear space for starter hull");
  }
  // Never load a player inside a newly imported structure.
  let feet = [...s.player.feet];
  if (blocked(world, feet)) feet = [0, 34, -6];
  if (ship.piloting) feet = ship.global([0, 1, -1]);
  return {
    player: { ...s.player, feet, velocity: [0, 0, 0] },
    settings: { ...s.settings },
    ship,
  };
}
