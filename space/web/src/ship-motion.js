// SPDX-License-Identifier: LGPL-2.1-or-later
import { basis } from "./flight.js";
export const turnToward = (a, b, step) =>
  a +
  Math.max(-step, Math.min(step, Math.atan2(Math.sin(b - a), Math.cos(b - a))));
export function rotateVector(p, yaw, pitch) {
  const b = basis(yaw, pitch);
  return p.map(
    (_, i) => b.right[i] * p[0] + b.up[i] * p[1] + b.forward[i] * p[2],
  );
}
export function inverseVector(p, yaw, pitch) {
  const b = basis(yaw, pitch);
  return [b.right, b.up, b.forward].map((axis) =>
    axis.reduce((sum, v, i) => sum + v * p[i], 0),
  );
}
export function modelMatrix(yaw = 0, pitch = 0) {
  const b = basis(yaw, pitch);
  return new Float32Array([...b.right, ...b.up, ...b.forward]);
}
// Used by the sky as well: each pixel is a ray in world coordinates.
export function viewRay(yaw, pitch, x, y, aspect) {
  const b = basis(yaw, pitch),
    f = 1 / Math.tan(Math.PI / 6);
  const d = b.forward.map(
    (v, i) => v + (b.right[i] * x * aspect) / f + (b.up[i] * y) / f,
  );
  const n = Math.hypot(...d);
  return d.map((v) => v / n);
}
