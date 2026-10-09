// SPDX-License-Identifier: LGPL-2.1-or-later
// Browser expedition catalog. Native world generation is deliberately unchanged.
export const DESTINATIONS = [
  {
    name: "Morrow",
    center: [350, 65, 260],
    radius: 32,
    color: [0.48, 0.64, 0.42],
    description: "Moss-green highlands and a copper survey shelter",
  },
  {
    name: "Ember",
    center: [-420, 130, 300],
    radius: 28,
    color: [0.74, 0.43, 0.3],
    description: "Warm mineral ridges and a signal ruin",
  },
];
export function planetMaterial(p) {
  for (const planet of DESTINATIONS) {
    const d = p.map((v, i) => v - planet.center[i]);
    const radius =
      planet.radius + Math.sin(d[0] * 0.32) * Math.cos(d[2] * 0.27) * 1.4;
    const length = Math.hypot(...d);
    if (length <= radius)
      return length > radius - 2 ? (planet.name === "Morrow" ? 6 : 7) : 2;
    // An original survey shelter on the north pole, reachable without gravity.
    const y = d[1] - planet.radius - 2;
    if (Math.abs(d[0]) <= 3 && Math.abs(d[2]) <= 3 && y === 0) return 3;
    if (y >= 1 && y <= 4 && Math.abs(d[0]) === 3 && Math.abs(d[2]) <= 3)
      return 3;
    if (y === 5 && Math.abs(d[0]) <= 3 && Math.abs(d[2]) <= 3) return 1;
    if (d[0] === 0 && d[2] === 0 && y === 6) return 4;
  }
  return 0;
}
export function nearestDestination(p) {
  return DESTINATIONS.map((d) => ({
    ...d,
    distance: Math.max(
      0,
      Math.hypot(...p.map((v, i) => v - d.center[i])) - d.radius,
    ),
  })).sort((a, b) => a.distance - b.distance)[0];
}

// Browser-only orbital shipyard. Keep the original islands for existing builds.
export const EXPEDITION_SPAWN = [210, 114, 100];
export const DOCK_SHIP_POSITION = [218, 117, 104];
export const DOCK_VIEW = { yaw: 0.7, pitch: -0.55 };
export function dockMaterial([x, y, z]) {
  x -= 210;
  z -= 100;
  if (Math.abs(x) > 12 || Math.abs(z) > 12) return 0;
  if (y === 111)
    return Math.abs(x) === 12 || Math.abs(z) === 12 ? 3 : x % 6 === 0 ? 4 : 1;
  // Slender underside beams rather than another floating terrain island.
  if (y >= 108 && y <= 110 && (Math.abs(x) === 10 || Math.abs(z) === 10))
    return 2;
  return 0;
}
