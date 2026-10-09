# Luanti Space — flight garden foundation

Original creative flight-and-building sandbox. This is the first maintainable
game-layer milestone, not the finished game. Requires Luanti 5.17+; this engine
fork currently identifies as 5.18.0-dev. No engine changes are required to run
the game on a compatible stock Luanti installation.

## Quick start on Windows

1. Install/extract [official Luanti 5.17+](https://www.luanti.org/en/downloads/).
2. Copy **this `luanti_space` directory** into Luanti's `games` directory
   (portable: next to `bin`, resulting in `games/luanti_space/game.conf`).
   Installed builds use the Luanti user-data `games` directory; see the official
   paths documentation if the game is not listed.
3. Copy repository `space/config/client.conf` to a **new writable** file, e.g.
   `space-client.conf` beside your portable Luanti directory. Keep this profile
   separate from your existing settings.
4. Run `bin\luanti.exe --config space-client.conf`, select **Luanti Space**,
   create a new world and Play. Existing worlds for other games are not converted.

From a repository build use `python space/tools/launch.py --engine bin/luanti`
(`bin/luanti.exe` on Windows). This copies a profile into an ignored local build
directory only once, preserving subsequent preference changes. Add `--world`
to select a specific save directory or `--address` for a server connection.

Building this fork: use upstream `doc/compiling/windows_msvc.md`,
`doc/compiling/windows_msys2.md`, `doc/compiling/macos.md` or `linux.md`.
Linux example: `cmake -S . -B build/space -DRUN_IN_PLACE=ON`, then
`cmake --build build/space -j4`. This does not build an iOS app.

## Controls

| Action | Supplied desktop profile | Touch foundation |
| --- | --- | --- |
| Look | Mouse | Swipe |
| Move/strafe | W/S, A/D | Left analog joystick |
| Ascend / descend | Space / Left Ctrl | Jump / Sneak buttons |
| Boost | Left Shift | Aux1 button |
| Place / remove | Right / left mouse (hold to repeat) | Center-crosshair Place / Remove buttons |
| Rotate | R, or `/space rotate` | Architect menu button |
| Palette, history, flight assist | Inventory (I), then Open architect palette | Inventory, then Open architect palette |
| Return to launch anchor | `/space home` | Chat command |

If using your usual client settings, enable Fly (K), Fast (J), and turn off
Always fly fast / Aux1 descends / Pitch movement for the assisted baseline.
Your key bindings may differ from this table without the supplied profile.
Gamepad bindings are preserved but have not been hardware-tested. Native camera
sensitivity and smoothing remain adjustable in engine settings. Gentle assist
uses softer acceleration/braking; it is not a true inertial flight mode.

Aim at a solid face: the ghost occupies the adjacent grid cell. Cyan-green
means valid, red means invalid. Use the copper material to inspect horizontal
rotation. The launch pad's central anchor cannot be removed. Build from any of
the island surfaces while hovering. Empty-space placement planes are future work.

## Offline, LAN and dedicated servers

Solo Play uses Luanti's internal server and native SQLite world persistence.
Leave normally, reopen the same world, and verify structures and position.
Per-player material, rotation and assist settings persist; undo/redo histories
are session-only. Back up the entire world directory before game/engine upgrades.

Local hosting: choose the same game/world in the engine's Start Game screen,
enable Host Server, set host credentials/port and start. Another native client
can use Join Game with the host's LAN IP and port 30000. Allow UDP traffic through
the host firewall. Manual IP connection is available; automatic LAN discovery
is not implemented here. iPhone hosting is conditional on a functioning port
and foreground execution; use a PC host initially.

Dedicated server (repository run-in-place build):

```sh
bin/luantiserver --config space/config/server.conf --world /path/to/space-world --gameid luanti_space
```

A client-enabled build can use `bin/luanti --server` instead. Keep the world path
stable. Server profiles do not change clients' keys; joining clients need their
own Space profile. Explicitly configure ownership/password policy before making
a server public. This creative prototype grants building to new players by
default, respecting protection hooks; it has no claims/region permission UI yet.

## Current limits

- The server ghost is temporary: it follows the last server pose and can lag
  during camera movement/network delay. Client-native accurate preview is next.
- Rotation is horizontal quarter-turns for full cubes, not six-axis editor tools.
- No line/area/blueprint tools, advanced momentum/roll, or controller certification.
- Native flight is predicted locally with server movement checks; Luanti does
  not yet provide full server movement simulation/replay reconciliation.
- Touch buttons/joystick use upstream controls. Real phone layout/usability,
  iPad trackpad behavior and cross-device gameplay remain unverified.
- There is **no official upstream iPhone release or ready signed app here**.
  iPhone/iPad remain required targets; see `doc/space/IOS.md` for the concrete port gate.

## Verification and architecture

Run `lua5.1 space/tests/unit.lua` and
`python space/tests/runtime.py --engine bin/luanti` after building a client-enabled
engine. Optional Linux desktop check (Xvfb/xdotool):
`python space/tests/desktop.py --engine bin/luanti` exercises the actual keyboard
bindings and captures an OpenGL screenshot. Runtime tests use headless native
clients; these checks do not certify human camera feel, Windows, or touch usability.
See `doc/space/VALIDATION.md` for actual results.
Design and implementation sequence: `doc/space/ARCHITECTURE.md` and `PLAN.md`.

Source: LGPL-2.1-or-later; original textures: CC0-1.0. See `LICENSE.txt` and
`ATTRIBUTION.md`. All upstream attribution remains intact.
