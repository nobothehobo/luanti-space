# Foundation validation — 2026-10-07

Tested base engine: `9a1b92d0d4d2c47fced18e6077722c6301eb04f5`, Luanti
5.18.0-dev, Linux x86_64, GCC 13.3, bundled Lua 5.1.5. Dependencies were locally
extracted in the test workspace; no engine source fixes were necessary.

## Passed locally

- Lua 5.1 syntax compilation for game modules and both native test fixtures.
- Eight behavior tests (`lua5.1 space/tests/unit.lua`): analog/keyboard action
  semantics, bounded malformed inputs/cells, common edit service, same-cell
  undo/redo with rotation, concurrent ABA conflict refusal, permission/protection/
  reach/loaded-node/collision checks, rate limiting/history bounds, and safe restoration.
- Compiled native headless server and client-enabled engine. Dedicated server
  loaded all game modules without Lua errors.
- Two **actual native clients** connected to one private server. Test-only
  client scripts send commands over the ordinary chat protocol and independently
  read each client's received map: place copper block, quarter-turn rotation,
  remove, undo, confirm both maps, verify owner-only preview entity observers.
- Graceful server shutdown and restart with the same SQLite world; both clients
  rejoined and observed saved material/rotation. Server verified player position,
  persistent material/rotation choice, and intentionally empty session history.
- Actual desktop key events in Xvfb, with SDL's X11 driver and OpenGL 3 via Mesa
  llvmpipe: W cruise 7.00 nodes/s, Space ascend 7.00, Left Ctrl descend -7.00,
  Left Shift + W boost 18.00. All settled back to hover after release. Stationary
  pre-input pose stayed at the configured height. Boost braking includes the
  native acceleration interval plus pose-report delay, checked after 0.8s.
- A 1280x720 OpenGL screenshot was generated. This proves the renderer starts;
  it is not a claim of measured hardware performance or finished art direction.
- All eight original PNGs decode correctly. Installable game ZIP includes
  `luanti_space/game.conf`, all textures/source, separate control profile and
  installation notes; ZIP integrity check passed.
- Original PNGs losslessly optimized with upstream optipng flags; pixel content
  is preserved. The generator now applies the same compression automatically.
- Python compile checks, launcher help, packaging, and `git diff --check`.

The final native replication/save run passed both new-world and reload phases.
Initial fixture failures were fixed without changing gameplay: use one emerge
thread to avoid duplicate in-progress chunk cancellation, and increase the
chat budget **only in the isolated test server** for the scripted assertions.
The desktop fixture forces X11 so SDL does not silently choose offscreen mode.

## Reproduce

Build a Linux run-in-place client as in upstream `doc/compiling/linux.md`, then:

```sh
lua5.1 space/tests/unit.lua
python3 space/tests/runtime.py --engine bin/luanti
python3 space/tests/desktop.py --engine bin/luanti
python3 space/tools/package_game.py
```

Desktop test needs Xvfb, xdotool, keyboard data/compiler and Mesa. Both native
fixtures create isolated new worlds under ignored `build/` paths. Test-only CSM
is installed in a copied run-in-place bundle, never the user's clientmods or game.
The new GitHub workflow repeats these checks and preserves logs/screenshots plus
the installable game package. Its remote outcome is not assumed from local results.

## Outstanding acceptance tests

- Windows packaging, launch and interactive camera/building checks; macOS hardware.
- Pixel alignment, texture orientation and valid/invalid preview behavior during
  rapid camera movement and continuous flight. Server ghost remains temporary.
- Human building UX, mobile screen layout, real touch input and multiple simultaneous
  touch regions; iPad keyboard/trackpad/controller and input switching.
- Physical iPhone/iPad port, signing/install, persistence/lifecycle and PC cross-play.
- Injected 80/150ms RTT, loss/jitter, prediction/correction and remote movement
  interpolation measurements. Tests currently use local-loopback connections.
- Public-server threat validation, full authoritative movement and recovery after
  abrupt process loss; large-world/structure, memory and mobile thermal profiling.

Therefore the result is a tested flight/game/network foundation with prototype
construction, not a completed shipping game or certified first-playable milestone.
