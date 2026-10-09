# Expedition direction and prototype boundaries

The intended game is original planetary exploration with creative shipbuilding
and cooperative expeditions, not a floating-island garden. The browser track is
an interim phone-playable implementation; Luanti remains the native engine.

## Implemented in this browser milestone

- Two original voxel planetoids, a starting outpost, navigation distance/course.
- One editable starter hull: local cells plus a continuous shared translation.
- Boarding, piloting, parking, conservative terrain collision and clear exits.
- Separate main/solar banks, power switch, shadow-aware chargers, battery blocks.
- Version-2 browser saves; version-1 saves retained and upgraded on successful load.
- Explicit input mode and unlocked iPad trackpad drag, F/X building fallback.

`ship.js` owns hull validation, pose, energy and local-grid commands. `world.js`
owns static terrain. `renderer.js` uploads the hull only when its geometry changes
and supplies its position as a uniform; movement does not broadcast/rebuild a
voxel structure. A future server needs independent authorization, fixed-step
simulation, pose/energy deltas, hull revisions and validated construction commands.
The current browser is solo and is not a trusted online authority.

## Required next gates, not supplied features

1. Test the published build on actual iPhone and iPad Magic Keyboard hardware.
2. Regional/procedural streaming before increasing planets/worlds substantially.
3. Original modular construction with editable presets, selections and blueprints.
4. Ship heading/rotation, mass and thruster force model, docking and passengers.
5. Authoritative multiplayer transport and browser/native feasibility decision.
6. Cooperative discoveries/resources, shared outposts and longer expeditions.

Deep systems should reward creativity without forcing every player to manage
complex machinery. Avoid copying another game's code, assets, branding or maps.
Shipbuilding/exploration are the genre inspiration, not a claimed physics clone.

Temporary limits: one ship, 512 hull blocks, ±12 local cells, ±950 ship sector,
two planetoids of radius 32/28, no gravity or orbit simulation. All generated
terrain is loaded at startup; this is deliberately not an infinite-world design.

## Validation

Local Node suite: 16 tests passed, including hull connectivity, translated builds,
undo/redo, terrain collision, solar shadows, powered/unpowered movement, battery
capacity/save validation, legacy saves and key-only keyboard events. Browser CI
adds public-UI piloting/power and pointer-lock-unavailable drag tests to the
existing desktop, phone, landscape and WebKit flows. Inspect cloud results before
claiming browser success. Physical iPad/iPhone performance is still unverified.

### Cloud evidence (2026-10-09 UTC)

Build `c6feee478298` passed both the push and PR browser suites:
[published push run](https://github.com/nobothehobo/luanti-space/actions/runs/37874185264)
and [PR run](https://github.com/nobothehobo/luanti-space/actions/runs/37874189313).
All 16 unit tests and desktop, portrait-phone, landscape-phone and WebKit-phone
flows passed. The desktop test charts a course through the menu, boards via V,
flies to Morrow using a short boost and cruise, exits, exports a backup and then
reloads with the real HTTP origin unavailable. It asserts identical hull cells,
ship pose, pilot state and battery banks after offline reload. There is no test
teleport or writable debug shortcut. Screenshot evidence includes the arrival
and the phone-size UI; the arrival screenshot was visually inspected.

The Pages publish job succeeded and its public build-info reports the tested
revision. Actual iPhone/iPad Magic Keyboard behavior, thermals and memory pressure
still require hardware tests. Cloud WebKit is not a certification of iOS Safari.
