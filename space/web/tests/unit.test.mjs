// SPDX-License-Identifier: LGPL-2.1-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, raycast, materialAt, overlapsPlayer } from "../src/world.js";
import { advance, basis, eye, SPAWN } from "../src/flight.js";
import { snapshot, restore, validateSave } from "../src/save.js";
const spec = JSON.parse(
  readFileSync(
    new URL(
      "../../../games/luanti_space/mods/space_core/world_spec.json",
      import.meta.url,
    ),
  ),
);
const settings = {
  id: 3,
  rotation: 1,
  sensitivity: 0.16,
  quality: "balanced",
  gentle: false,
};
const player = () => ({
  feet: [...SPAWN],
  yaw: 0,
  pitch: -0.8,
  velocity: [0, 0, 0],
});
const idle = {
  move_forward: 0,
  move_right: 0,
  ascend: false,
  descend: false,
  boost: false,
};
const view = (p) => ({
  feet: p.feet,
  eye: eye(p.feet),
  direction: basis(p.yaw, p.pitch).forward,
});
test("shared deterministic native island data and protected launch pad", () => {
  assert.equal(materialAt(spec, [0, 30, 0]), 5);
  assert.equal(materialAt(spec, [42, 52, 18]), 1);
  assert.equal(materialAt(spec, [0, 29, 0]), 2);
  assert.equal(materialAt(spec, [0, 100, 0]), 0);
});
test("DDA resolves exact face, boundaries, range and invalid rays", () => {
  const world = new World(spec);
  world.set([100, 10, 100], { id: 3, rotation: 1 });
  assert.deepEqual(
    raycast(world, [100, 10, 95], [0, 0, 1]).above,
    [100, 10, 99],
  );
  assert.deepEqual(
    raycast(world, [100, 10, 95], [0, 0, 1]).under,
    [100, 10, 100],
  );
  assert.equal(raycast(world, [100, 10, 85], [0, 0, 1]), null);
  assert.equal(raycast(world, [NaN, 0, 0], [0, 0, 1]), null);
  assert.equal(raycast(world, [0, 0, 0], [0, 0, 0]), null);
});
test("one flight controller accelerates, boosts and brakes without gravity", () => {
  const w = new World(spec),
    p = player();
  p.feet = [100, 100, 100];
  for (let i = 0; i < 120; i++)
    advance(p, { ...idle, move_forward: 1 }, 1 / 120, w);
  assert.ok(Math.abs(p.velocity[2] - 7) < 0.001);
  for (let i = 0; i < 120; i++)
    advance(p, { ...idle, move_forward: 1, boost: true }, 1 / 120, w);
  assert.ok(Math.abs(p.velocity[2] - 18) < 0.001);
  for (let i = 0; i < 120; i++) advance(p, idle, 1 / 120, w);
  assert.deepEqual(p.velocity, [0, 0, 0]);
  assert.equal(p.feet[1], 100);
});
test("swept body collision stops boosted movement at a wall", () => {
  const w = new World(spec),
    p = player();
  p.feet = [100, 10, 95];
  for (let y = 9; y < 14; y++) w.set([100, y, 100], { id: 1, rotation: 0 });
  for (let i = 0; i < 240; i++)
    advance(p, { ...idle, move_forward: 1, boost: true }, 1 / 120, w);
  assert.ok(p.feet[2] < 99.21);
  assert.equal(p.velocity[2], 0);
});
test("commands validate target, rate, material, body, range and anchor", () => {
  const w = new World(spec),
    p = player();
  assert.ok(w.command("place", view(p), settings, 1).ok);
  assert.equal(w.edits.size, 1);
  assert.equal(
    w.command("place", view(p), settings, 1.01).reason,
    "Build cooldown",
  );
  assert.equal(w.command("bogus", view(p), settings, 2).ok, false);
  assert.equal(
    w.command("place", view(p), { id: 99, rotation: 0 }, 3).ok,
    false,
  );
  assert.equal(
    w.validate([0, 30, 0], view(p), false),
    "Launch anchor is protected",
  );
  assert.equal(w.validate([1000, 0, 0], view(p), true), "Out of reach");
  assert.equal(
    w.validate([0, 34, -6], view(p), true),
    "Too close to your body",
  );
  assert.ok(overlapsPlayer([0, 34, -6], p.feet));
});
test("undo/redo preserves rotation and invalidates redo on new edits", () => {
  const w = new World(spec),
    p = player();
  const result = w.command("place", view(p), settings, 1);
  assert.ok(result.ok);
  assert.equal(w.get(result.p).rotation, 1);
  assert.ok(w.command("undo", view(p), settings, 2).ok);
  assert.equal(w.get(result.p).id, 0);
  assert.ok(w.command("redo", view(p), settings, 3).ok);
  assert.equal(w.get(result.p).rotation, 1);
  assert.ok(w.command("undo", view(p), settings, 4).ok);
  assert.ok(w.command("place", view(p), { id: 4, rotation: 2 }, 5).ok);
  assert.equal(w.redo.length, 0);
});
test("save/reload retains delta edits, orientation and settings", () => {
  const w = new World(spec),
    p = player();
  w.command("place", view(p), settings, 1);
  const data = snapshot(w, p, settings),
    next = new World(spec),
    r = restore(next, JSON.parse(JSON.stringify(data)));
  assert.deepEqual([...next.edits], [...w.edits]);
  assert.deepEqual(r.settings, settings);
  assert.deepEqual(r.player.feet, p.feet);
  assert.equal(next.undo.length, 0);
});
test("future/malformed/duplicate/protected saves are rejected before mutation", () => {
  const w = new World(spec),
    p = player(),
    base = snapshot(w, p, settings);
  for (const update of [
    { version: 2 },
    { edits: [[0, 30, 0, 0, 0]] },
    {
      edits: [
        [100, 10, 100, 3, 0],
        [100, 10, 100, 3, 0],
      ],
    },
    { player: { feet: [NaN, 1, 1], yaw: 0, pitch: 0 } },
    { settings: { ...settings, id: NaN } },
    { edits: [[1, 2, 3, 99, 0]] },
  ])
    assert.throws(() => validateSave({ ...base, ...update }, spec));
  assert.equal(w.edits.size, 0);
});
