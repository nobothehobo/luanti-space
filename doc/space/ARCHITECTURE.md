# Luanti Space architecture audit

Audited 2026-10-07. Fork base: `9a1b92d0d4d2c47fced18e6077722c6301eb04f5`,
Luanti 5.18.0-dev. Production packaging should pin a tested stable release later.

## Decisions

Put game code and original assets in `games/luanti_space`, developer tooling and
explicit client/server profiles in `space/`, and project decisions in `doc/space/`.
Preserve engine source, builtin code, renderer, protocol, existing CI and licensing.
**This milestone changes no C++ or engine APIs.** This is an early foundation,
not completion of the requested first playable or mobile release certification.

| Concern | Existing source/API | Project decision |
| --- | --- | --- |
| Games/mods | `src/content/subgames.cpp`, `doc/lua_api.md`, `game.conf`, `mod.conf` | Self-contained game; server loads ordered Lua modules, registers material definitions and sends media to clients. No dependency on Minetest Game. |
| Desktop controls | `src/client/inputhandler.*`, `src/client/game.cpp`, `src/player.*` | Configurable engine bindings converge into `PlayerControl`. Game consumes `movement_x/y`, jump, sneak, aux1, dig, place and zoom. |
| Flight | `src/client/localplayer.cpp::applyControl`, `accelerate`, `move` | Native frame-rate local simulation, bounded acceleration/braking, hover, collision and optional pitch movement. Server sets speed/acceleration overrides. Do not send Lua velocity impulses every server tick. |
| Touch | `src/gui/touchcontrols.*`, `touchscreenlayout.*`, `touchscreeneditor.*` | Existing analog joystick, swipe look, jump/descend/aux1 and center-crosshair place/remove buttons. Dedicated device layout and safe-area testing remain Milestone 3. |
| Controller | SDL input/gamepad bindings; `builtin/settingtypes.txt` | Preserve gamepad bindings in the explicit profile. Analog input maps to the same actions. Hardware validation remains future work. |
| Network | `src/network/networkprotocol.h`, `serverpackethandler.cpp`, `src/client/client.cpp` | Use one standard Luanti protocol across supported native clients. No PC/mobile variants, custom mod channel, or bulk structure transport. |
| Persistence | `src/content/subgames.cpp::loadGameConfAndInitWorld`, engine SQLite backends | Terrain, nodes, player positions, inventory and metadata use native databases. Mod/player schema starts at 1. Unknown future schemas fail closed. |
| Preview | `ObjectRef:set_observers`, `set_properties`, `core.raycast` | Private transient cube entity, 10 Hz server target, update on changed target/material/rotation/validity. This is an explicitly temporary latency-sensitive implementation. |

## Shared actions

| Game action | Engine control | Supplied desktop profile | Touch foundation |
| --- | --- | --- | --- |
| `move_forward` | `movement_y` | W/S | Joystick vertical axis |
| `move_right` | `movement_x` | A/D | Joystick horizontal axis |
| `ascend` | `jump` | Space | Jump/ascend button |
| `descend` | `sneak` | Left Ctrl | Sneak/descend button |
| `boost` | `aux1` | Left Shift | Aux1 button |
| `place` | `place`, tool `on_place` | Right mouse | Place button |
| `remove` | `dig`, tool `on_use` | Left mouse | Remove button |
| `rotate` | `zoom` rising edge or explicit menu action | R | Architect palette button |

`actions.lua` is the pure device-independent adapter. Native flight runs in
`LocalPlayer` using the same `PlayerControl`, not a duplicate Lua controller.
The server action snapshot is for gameplay/presentation; it is not the local
prediction loop. Rotation temporarily uses the stock Zoom control, with zoom
disabled through player properties. Native flight requires Fly/Fast client toggles;
the supplied opt-in profile enables them. Server mods cannot force client keys
or flight toggles. Existing users' explicit settings take precedence over game
defaults; remote clients need the client profile too.

## Authority and latency: what Luanti actually provides

Solo starts a local Server and a local Client; the same Lua callbacks run on a
dedicated server. The map, inventories, rules, validated edits and persistence
are server owned. The server computes construction targets from its copy of the
player pose; clients do not send arbitrary cells, node names or structures to
our command service. Building checks permission, reach, loaded nodes, protection,
material whitelist, overlap and rate limits. Preview never edits the map.

**Player movement is not fully server simulated upstream.** The client simulates
position/collision and reports position, speed and control. The server uses
`PlayerSAO::checkMovementCheat()` and corrections (`TOCLIENT_MOVE_PLAYER`), and
remote objects interpolate. Source comments explicitly note the missing server
physics simulation. Downward movement checks are incomplete, and singleplayer
bypasses built-in movement anticheat. Do not market this as secure authoritative
movement, deterministic reconciliation, or cheat-resistant competitive play.

For early private creative sessions retain native prediction and anticheat.
Before public/PvP release, prototype a narrowly scoped engine API for an approved
movement profile plus sequenced input, server simulation, acknowledgement and
client replay. Compare against collision/lag scenarios and keep one protocol
for all OS builds. Do not attempt naive distance-per-Lua-tick checks, per-tick
teleports, or player attachments that disable the engine anticheat.

Server step defaults to 0.05 s; client position sending uses the server's
recommended interval, not an independent game packet loop. Measure actual
updates and RTT before tuning. Native 16x16x16 mapblocks are streamed/meshed as
needed; normal single-node edits use ADDNODE/REMOVENODE updates. Reuse these for
construction; do not resend entire blueprints after each edit. Large edit tools
will need bounded batches, per-player budgets and conflict-aware transactions.

## Client presentation limitations

The temporary ghost follows the **server** pose and can lag under network delay.
Actual edits re-raycast the latest server pose and revalidate; they never trust
the ghost. It only supports the current full cube palette and horizontal 90-degree
rotation. Client-native selection highlighting remains enabled. No guarantee
of pixel-exact ghost alignment during rapid camera movement is made yet.

`doc/sscsm_api.md` says server-sent client scripting is experimental and currently
cannot load custom mods (only a hardcoded preview). Do not assume that it can
deliver a game script. Locally installed CSM is not a seamless distribution
solution for mobile. For Milestone 2, investigate a small reusable client-side
node placement-preview API in `src/client/game.cpp` / selection rendering,
driven by server-approved tool/material properties. Explain the API gap, add
tests, preserve validation server-side, and document any patch before changing
engine source. Do not make SSCSM a required dependency in this milestone.

## Scale and visual parity

Current world is a bounded, deterministic garden of five islands for testing
vertical flight. Empty singlenode chunks outside that garden stay empty.
Generation writes only newly generated mapchunks; saved construction is never
regenerated over. Original textures are 32px geometric tiles, one 64px tool icon,
no expensive entities per placed block, and no global terrain scan.

Ghost count is at most one per player; updates are 10 Hz with changed-state
filtering. HUD is 4 Hz. Histories are bounded to 64 edits per player; revision
tokens are periodically pruned to referenced cells. Preview targeting is one
short ray per player per preview tick; overlap scans connected players (initial
16-player target). Profile large populations before extending this limit.
History is session-only and intentionally not saved. Rejoins clear undo stacks;
node state and per-player choices persist. History refuses out-of-reach,
protected, occupied or concurrently changed cells; it never blindly restores a
whole old region. External mods must use a future edit-service hook to preserve
revision guarantees; arbitrary external set_node ABA edits are not detected.

Graphic quality remains client-side. The conservative profile disables bloom
and dynamic shadows; future PC/mobile presets may change rendering only, never
map generation, collision, inventory rules, or network state. Real iPhone frame
time, memory, draw-call, thermal and battery measurements are still required.

## Upstream merge strategy

Maintain game changes on a focused branch. Keep this document's engine-patch
ledger: **none**. Never rename upstream engine symbols for branding. Isolate
future input/profile, preview, iOS lifecycle or movement API work into separately
reviewed commits/branches, ideally reusable upstream proposals.

## Source references

Bundled `doc/lua_api.md`, `doc/client_lua_api.md`, `doc/sscsm_api.md`,
`doc/compiling/`, and paths above are the implementation references. Public
upstream iOS status and port source links are recorded in [IOS.md](IOS.md).
