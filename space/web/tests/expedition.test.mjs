// SPDX-License-Identifier: LGPL-2.1-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { Ship, connected } from "../src/ship.js";
import { World, key, materialAt } from "../src/world.js";
import { DESTINATIONS, planetMaterial } from "../src/exploration.js";
import { snapshot, restore, validateSave } from "../src/save.js";
import { keyCode } from "../src/input.js";
const empty = () => new World({ generator: 1, islands: [] });
const player = () => ({
  feet: [8, 37, -3],
  velocity: [0, 0, 0],
  yaw: 0,
  pitch: 0,
});
const settings = {
  id: 8,
  rotation: 0,
  sensitivity: 0.16,
  quality: "balanced",
  gentle: false,
  controls: "keyboard",
};
const idle = {
  move_forward: 0,
  move_right: 0,
  ascend: false,
  descend: false,
  boost: false,
};
test("original destinations have solid cores, editable surfaces and lengthy separation", () => {
  assert.ok(Math.hypot(...DESTINATIONS[0].center) > 400);
  for (const d of DESTINATIONS) {
    assert.equal(planetMaterial(d.center), 2);
    assert.ok(
      [6, 7].includes(
        planetMaterial(d.center.map((v, i) => v + (i === 1 ? d.radius : 0))),
      ),
    );
    assert.equal(materialAt({ islands: [], exploration: 1 }, d.center), 2);
    assert.equal(materialAt({ islands: [] }, d.center), 0);
  }
});
test("starter blueprint is connected, cabin clear and carries battery/solar blocks", () => {
  const s = new Ship();
  assert.ok(connected(s.cells));
  assert.equal(s.capacity(), 100);
  assert.equal(s.get([0, 1, -1]).id, 0);
  assert.equal(s.get([0, 0, 0]).id, 5);
  assert.equal([...s.cells.values()].filter((n) => n.id === 8).length, 2);
  assert.ok(
    s
      .validate([0, 1, -1], { feet: [9, 9, 9], eye: [0, 3, -1] }, true)
      .includes("cabin"),
  );
});
test("hull commands use a translated grid and undo/redo without terrain edits", () => {
  const s = new Ship();
  const view = {
    feet: s.global([0, 2, -7]),
    eye: s.global([0, 3.625, -7]),
    direction: [0, -0.6, 1],
  };
  const before = s.cells.size;
  assert.ok(s.command("place", view, settings, 1).ok);
  assert.equal(s.cells.size, before + 1);
  assert.ok(s.command("undo", view, settings, 2).ok);
  assert.equal(s.cells.size, before);
  assert.ok(s.command("redo", view, settings, 3).ok);
  assert.equal(s.cells.size, before + 1);
});
test("ship travels as one pose without modifying terrain or its hull cells", () => {
  const terrain = empty(),
    s = new Ship(),
    p = player();
  s.board(p);
  const before = [...s.cells];
  for (let i = 0; i < 240; i++)
    s.tick({ ...idle, move_forward: 1 }, 1 / 120, 0, terrain, p);
  assert.ok(s.position[2] > 15);
  assert.deepEqual([...s.cells], before);
  assert.equal(terrain.edits.size, 0);
  assert.equal(terrain.revision, 0);
  assert.deepEqual(p.feet, s.global([0, 1, -1]));
});
test("translated hull stops at terrain rather than tunneling", () => {
  const terrain = empty(),
    s = new Ship(),
    p = player();
  s.board(p);
  for (let x = 0; x < 20; x++)
    for (let y = 30; y < 45; y++)
      terrain.set([x, y, 12], { id: 2, rotation: 0 }, false);
  for (let i = 0; i < 480; i++)
    s.tick({ ...idle, move_forward: 1, boost: true }, 1 / 120, 0, terrain, p);
  assert.ok(s.position[2] < 9);
  assert.equal(s.velocity[2], 0);
  assert.equal(s.collides(terrain, s.position), false);
});
test("main off disables thrust and transfers solar into main; shading blocks charging", () => {
  const terrain = empty(),
    s = new Ship(),
    p = player();
  s.board(p);
  s.mainOn = false;
  s.energy = 0;
  const before = [...s.position];
  for (let i = 0; i < 1200; i++)
    s.tick({ ...idle, move_forward: 1, boost: true }, 1 / 120, 0, terrain, p);
  assert.deepEqual(s.position, before);
  assert.ok(s.energy > 50);
  assert.equal(s.solar, 0);
  s.mainOn = true;
  const energy = s.energy;
  for (let i = 0; i < 120; i++)
    s.tick({ ...idle, move_forward: 1, boost: true }, 1 / 120, 0, terrain, p);
  assert.ok(s.energy < energy - 10);
  const shade = new Ship();
  shade.mainOn = false;
  shade.energy = 0;
  for (const x of [-2, 2]) shade.set([x, 1, 0], { id: 1, rotation: 0 }, false);
  for (let i = 0; i < 600; i++) shade.tick(idle, 1 / 120, 0, terrain, p);
  assert.equal(shade.energy, 0);
  assert.equal(shade.solar, 0);
});
test("ship saves preserve custom hull, banks, pose and pilot; invalid payloads reject", () => {
  const w = empty(),
    s = new Ship(),
    p = player();
  s.set([1, 0, -3], { id: 9, rotation: 1 });
  s.energy = 150;
  s.solar = 40;
  s.mainOn = false;
  s.board(p);
  const saved = snapshot(w, p, settings, s),
    restored = restore(empty(), saved);
  assert.deepEqual(restored.ship.data(), s.data());
  assert.deepEqual(restored.player.feet, s.global([0, 1, -1]));
  for (const mutate of [
    (r) => (r.ship.energy = 9999),
    (r) => r.ship.cells.push([11, 11, 11, 1, 0]),
    (r) => r.ship.cells.push(r.ship.cells[0]),
    (r) =>
      (r.ship.cells = r.ship.cells.filter(
        (e) => key(e.slice(0, 3)) !== "0,0,0",
      )),
    (r) => (r.ship.mainOn = "off"),
  ]) {
    const bad = structuredClone(saved);
    mutate(bad);
    assert.throws(() => validateSave(bad, w.spec));
  }
  const legacy = snapshot(w, p, settings);
  assert.equal(legacy.version, 1);
  assert.ok(restore(empty(), legacy).ship instanceof Ship);
});
test("key-only iPad keyboard events map to the same abstract bindings", () => {
  assert.equal(keyCode({ key: "w", code: "" }), "KeyW");
  assert.equal(keyCode({ key: " ", code: "" }), "Space");
  assert.equal(keyCode({ key: "Control", code: "" }), "ControlLeft");
  assert.equal(keyCode({ key: "x", code: "KeyX" }), "KeyX");
});
