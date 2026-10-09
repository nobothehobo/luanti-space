# Expedition direction and prototype boundaries

The intended game is original planetary exploration with creative shipbuilding
and cooperative expeditions, not a floating-island garden. The browser track is
an interim phone-playable implementation; Luanti remains the native engine.

## Implemented in this browser milestone

- Morrow/Ember moons plus Aster, a 240 m wide voxel planet with nearby chunk streaming.
- Orbital shipyard, navigation distance/course, original narrow survey-skiff blueprint.
- One editable hull: local cells plus continuous position, yaw and pitch.
- Rate-limited assisted steering, powered departure lift, chase/cockpit cameras.
- World-direction procedural stars that turn with the camera.
- Boarding, piloting, parking, conservative terrain collision and clear exits.
- Separate main/solar banks, power switch, shadow-aware chargers, battery blocks.
- Version-2 browser saves; version-1 saves retained and upgraded on successful load.
- Explicit input mode and unlocked iPad trackpad drag, F/X building fallback.

`ship.js` owns hull validation, pose, energy and local-grid commands. `world.js`
owns static terrain. `renderer.js` uploads the hull only when its geometry changes
and supplies position/orientation as uniforms; movement does not broadcast/rebuild a
voxel structure. A future server needs independent authorization, fixed-step
simulation, pose/energy deltas, hull revisions and validated construction commands.
The current browser is solo and is not a trusted online authority.

## Required next gates, not supplied features

1. Test the published build on actual iPhone and iPad Magic Keyboard hardware.
2. Expand bounded planet streaming into regional networking, LOD transitions and a larger sector.
3. Original modular construction with editable presets, selections and blueprints.
4. Ship roll, mass and thruster force model, docking and passengers.
5. Authoritative multiplayer transport and browser/native feasibility decision.
6. Cooperative discoveries/resources, shared outposts and longer expeditions.

Deep systems should reward creativity without forcing every player to manage
complex machinery. Avoid copying another game's code, assets, branding or maps.
Shipbuilding/exploration are the genre inspiration, not a claimed physics clone.

Temporary limits: one ship, 512 hull blocks, ±12 local cells, ±950 ship sector,
two legacy moons of radius 32/28 and Aster of radius 120; no gravity or orbit
simulation. Legacy terrain remains resident; Aster collision is procedural and
its nearby render chunks load with a two-chunk frame budget and evict on leaving.
Distant planet LODs are visual silhouettes, not replacement gameplay geometry.
This is bounded sector streaming, not an infinite-world design.

## Validation

Current local Node suite: 20 tests passed, including hull connectivity, rotated builds,
undo/redo, terrain collision, solar shadows, powered/unpowered movement, battery
capacity/save validation, legacy saves and key-only keyboard events. Browser CI
adds public-UI piloting/power and pointer-lock-unavailable drag tests to the
existing desktop, phone, landscape and WebKit flows, camera switching, rotating
sky screenshots and an actual voyage to streamed Aster. Inspect cloud results before
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


### Flight/sky/planet implementation details

`ship-motion.js` contains shared local/world transforms and rate-limited angular
steering. The ship follows the desired look direction, with upright stabilization
(no free roll), distinct acceleration/braking and a four-metre powered lift at
the orbital berth before cruise. Rotated cube bounds conservatively stop both
turning and translation at terrain. This can stop a hull slightly early; exact
OBB collision and a mass/thruster simulation remain future work. Ship save schema
2 adds yaw/pitch and unfinished departure height; schema 1 loads with zero angles
and retains custom cells and energy. Existing hulls are never silently replaced;
use Paste starter ship to adopt the new skiff after backing up a custom design.

`planet-stream.js` maintains a bounded render cache around the player. World.get
samples Aster's procedural terrain even outside that cache, with saved edits
taking precedence. Mining exposes adjacent interior voxels. Eviction never
removes the edit log. Distant LOD spheres sit inside their planet surfaces;
nearby fragments are discarded to expose voxel detail. Fine LOD transitions,
spherical gravity, orbital motion, vegetation and large procedural settlements
are not included. Streaming changes are browser-only; native generation and
native engine source remain untouched.
