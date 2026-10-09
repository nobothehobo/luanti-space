// SPDX-License-Identifier: LGPL-2.1-or-later
import { LIMIT } from "./world.js";
export const SPAWN = [0, 34, -6];
export function basis(yaw, pitch) {
  return {
    forward: [
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ],
    right: [Math.cos(yaw), 0, -Math.sin(yaw)],
    up: [
      -Math.sin(yaw) * Math.sin(pitch),
      Math.cos(pitch),
      -Math.cos(yaw) * Math.sin(pitch),
    ],
  };
}
export const eye = (feet) => [feet[0], feet[1] + 1.625, feet[2]];
export function blocked(world, p) {
  if (world.bodyBlocked?.(p)) return true;
  for (
    let x = Math.floor(p[0] - 0.3 + 0.5);
    x <= Math.floor(p[0] + 0.3 + 0.5 - 0.00001);
    x++
  )
    for (
      let y = Math.floor(p[1] + 0.5);
      y <= Math.floor(p[1] + 1.75 + 0.5 - 0.00001);
      y++
    )
      for (
        let z = Math.floor(p[2] - 0.3 + 0.5);
        z <= Math.floor(p[2] + 0.3 + 0.5 - 0.00001);
        z++
      )
        if (world.get([x, y, z]).id) return true;
  return false;
}
export function advance(player, actions, dt, world, gentle = false) {
  const speed = actions.boost ? 18 : 7,
    yaw = player.yaw;
  let desired = [
    Math.sin(yaw) * actions.move_forward + Math.cos(yaw) * actions.move_right,
    Number(actions.ascend) - Number(actions.descend),
    Math.cos(yaw) * actions.move_forward - Math.sin(yaw) * actions.move_right,
  ];
  const length = Math.hypot(...desired);
  desired = desired.map((v) => (v / Math.max(1, length)) * speed);
  const difference = desired.map((v, i) => v - player.velocity[i]);
  const magnitude = Math.hypot(...difference),
    factor = Math.min(1, ((gentle ? 18 : 35) * dt) / (magnitude || 1));
  player.velocity = player.velocity.map((v, i) => v + difference[i] * factor);
  // Fixed timestep plus axis-swept body collision avoids tunneling at boost speed.
  for (let axis = 0; axis < 3; axis++) {
    const candidate = [...player.feet];
    candidate[axis] += player.velocity[axis] * dt;
    if (Math.abs(candidate[axis]) > LIMIT - 2 || blocked(world, candidate))
      player.velocity[axis] = 0;
    else player.feet = candidate;
  }
}
