# Phone-first browser development

This is an interim **original HTML/WebGL browser expedition**, not Luanti compiled
to WebAssembly and not an iOS app. Native `games/luanti_space` and upstream engine
source remain separate. Browser and native editions share `world_spec.json`,
integer-centered voxel coordinates, material identifiers, and action meanings.

## Entire workflow from iPhone/iPad

1. Request changes in ChatGPT Work with this GitHub repository connected. Changes
   are committed to `codex/space-flight-foundation` (later the default branch).
2. GitHub Actions runs authority/save unit tests, desktop browser flows,
   portrait/landscape phone-size tests, and WebKit tests. Downloadable evidence
   includes screenshots and world backups. No local terminal or Mac is required.
3. Only a passing browser build is published automatically using GitHub's official
   Pages deployment action.
4. Open the Pages URL in **Safari** on your iPhone/iPad. For a more app-like
   experience, Share → Add to Home Screen. Play, report the build ID from the
   menu, and attach a screenshot or downloaded diagnostics when something fails.
5. Use **Back up world** to save a JSON backup in Files. Import it on another
   device if desired. Saves are local to that browser/origin, not GitHub or iCloud.

### One-time GitHub Pages switch (also possible in Safari)

Repository owner: open
<https://github.com/nobothehobo/luanti-space/settings/pages>.
Set **Source → GitHub Actions**. Our workflow is already supplied; do not create
another starter workflow. If the existing run's publish job failed because Pages
was disabled, open that run in Actions and select **Re-run failed jobs**.
Wait for GitHub's Pages deployment to finish. If GitHub reports an environment
branch restriction, allow `codex/space-flight-foundation` in the `github-pages`
environment's deployment branches (or merge the reviewed PR into `master`).

Expected address after deployment:
<https://nobothehobo.github.io/luanti-space/>.
Do not treat that address as live before a successful Pages deployment.
The connected GitHub app cannot administer the Pages setting on your behalf.
No Apple account, paid signing, new hosting account or local computer is needed.

## Implemented browser foundation

### Orbital Expedition

Fresh worlds open aboard the survey skiff at the orbital shipyard, facing Aster,
a 240-metre-wide voxel planet. Morrow and Ember remain smaller legacy moons.
Chart a course in Menu (sets the steering target, not a teleport), board within
12 m using **Pilot ship / V**, then apply forward thrust. Cruise is 14 m/s and
boost 42 m/s, with gradual acceleration and a powered four-metre departure lift
at the orbital berth. Ship yaw/pitch follow your look with limited turn rates;
chase view shows the hull. Surface exploration remains gravity-free.

**Terrain / Hull** chooses the construction grid. Park, exit and fly alongside
the hull to customize it with the same preview/place/remove/rotate/undo actions.
The protected core keeps a connected hull; its pilot cabin must remain empty.
**Paste starter ship** creates the original blueprint beside you in clear space
after confirming replacement of the previous hull. Export first to keep a design.
One ship is supported, with temporary 512-block / ±12-local-cell bounds.

Main battery blocks provide 100 energy capacity each. Blue solar chargers refill
a separate 100-unit reserve when neither hull nor terrain blocks their upward
sunlight. Switch **Main OFF** to disable thrust and transfer reserve energy into
main batteries. Level, unshaded stock chargers supply 6 units/second, transfer is capped at 12;
cruise costs 0.6/second and boost 18/second while applying input. This is an
original simple two-bank game mechanic, not a real electrical simulation. Pause
and backgrounding stop simulation, including charging. Saves retain both banks,
custom hull, pose and pilot state; version-1 garden saves upgrade without erasure.

iPad: WASD, Space, C/Ctrl, Shift, R, V. Without pointer lock, **drag the trackpad
to look**, short-click to remove, secondary-click to build; **F / X** also provide
reliable continuous build/remove without secondary-click configuration. Controls
setting offers Auto, Always touch, or Keyboard/trackpad. Auto follows actual
input events rather than assuming every touch-capable device has no keyboard.

This is a bounded browser sector: moons of radius 32/28 m and Aster of radius
120 m. The rigid hull translates and rotates in yaw/pitch, with upright assist.
It does not yet roll, break apart, simulate thruster forces/mass, dock or carry
other players. Collision uses conservative rotated bounds; terrain is not
repeatedly edited as the ship moves. Nearby Aster render chunks stream and evict;
legacy terrain remains resident. Larger sectors, modular assembly tools, portable blueprints,
discovery/resources and authoritative cooperative voyages remain future work.
Native Luanti ship/planet parity is not implemented by this browser milestone.

- Fixed-step 120Hz assisted hover/flight, acceleration/braking, cruise/boost,
  body collision, horizontal stabilization and sensitivity settings.
- Shared input actions: `move_forward`, `move_right`, `ascend`, `descend`,
  `boost`, `place`, `remove`, `rotate`. Keyboard/mouse and multi-pointer touch
  adapters drive the same movement and command services.
- Center-screen exact grid DDA targeting, immediate translucent valid/invalid
  preview, continuous place/remove, four materials, rotation and bounded history.
- Local-authority command validation: reach, protected anchor, finite grid bounds,
  material/rotation whitelist, body overlap and edit cooldown.
- Schema/version-checked delta saves in localStorage; pause/background saves,
  import validation before mutation, download backup, preserved unknown saves.
- Self-contained service-worker cache, offline launch after initial download,
  safe areas, portrait/landscape layouts, quality presets and diagnostics.
- Exposed-face meshes in 16³ chunks, rebuilding only touched/border chunks.
  No per-block draw calls, runtime CDNs, external artwork or tracker scripts.

## Honest limits and networking boundary

**Browser solo only for now.** A static GitHub Pages site cannot host an
authoritative multiplayer server. The browser cannot speak native Luanti's UDP
protocol directly. Browser ↔ native cross-play requires a separately hosted,
secure gateway/compatible client protocol, substantial client work, and explicit
end-to-end testing; it is not supplied by this milestone.

`World.command()` is the offline authority boundary. Input/UI never directly
edits cells. It is deliberately transport-shaped, but a future online server
must independently validate commands and own inventories, revisions and worlds;
never promote the browser's local Map/save to online authority. Browser prediction
and network reconciliation are still future work. Native worlds/save formats
are not yet importable here; shared terrain data is not save compatibility.

Native Luanti remains the required-engine project. This interim browser renderer
is a separate implementation, which costs maintenance. Avoid expanding two
complete games indefinitely: decide between a real Luanti web/gateway port and
the native iOS port after this phone-playable foundation is evaluated.

Controller input, multiplayer, infinite streaming, blueprint tools, mobile
hardware/thermal certification and full native-Luanti parity are not implemented.
The browser sector has a ±1000-cell bound and a 20,000 changed-cell save limit;
this is not the eventual large-world architecture. Browser storage can be
evicted/cleared by iOS, and private browsing may not retain it. Export backups.
Backgrounding pauses input/movement. Home-screen and Safari saves may be separate.
Look supports mouse pointer lock where available and drag-to-look otherwise.
The versioned app shell is cache-first so offline startup never waits for slow
network failures. While online, Safari checks for a new service worker; existing
builds stay usable until a complete new precache activates. Reload after that
update to enter the new build (the menu shows its revision).

## Reproduce tests without a phone

```sh
node --test space/web/tests/*.test.mjs
python3 space/tools/package_web.py
npm install --prefix build/web-tests --no-save playwright@1.62.1
build/web-tests/node_modules/.bin/playwright install --with-deps chromium webkit
SPACE_PLAYWRIGHT_PATH="$PWD/build/web-tests/node_modules/playwright" SPACE_TEST_WEBKIT=1 node space/web/tests/browser.cjs
python3 -m http.server 8000 --directory build/space-web
```

Browser emulation tests real event handlers and rendering engines, but **does not
prove real Safari/iPhone GPU, thermals, gestures or suspension behavior**. The
physical-device gate is playing the published HTTPS build on your iPhone/iPad.

All new browser code and procedural visuals are original; source is
LGPL-2.1-or-later under repository `LICENSE.txt`. No third-party runtime engine
or assets are bundled. Playwright is a development-only Apache-2.0 dependency.

### Orbital opening and existing saves

Fresh browser worlds now open aboard the starter hull at a compact orbital
shipyard, facing Aster. Visit shipyard provides a construction view at
`[210,114,100]`. The old islands
remain available so existing terrain edits survive. Continue preserves the saved
location. **Recall ship & launch toward destination** explicitly moves the existing
hull to the orbital berth, preserves its design and battery banks, boards it and
points the camera toward the selected destination. It refuses an occupied berth.
Visit shipyard moves only the player; it does not retrieve a distant ship.

`update.html` deliberately stays outside the offline shell. Existing Safari users
can open it and install a complete new service worker without clearing storage.
Aster now streams nearby voxel terrain within the bounded sector. Multiplayer,
large regional worlds and native ship parity remain future work.


### Flight, sky and Aster update

Ships now turn gradually in yaw/pitch toward the desired look direction and move
in their own heading. The orbital departure lifts four metres before cruise.
Default chase view shows the full hull; the flight camera button toggles cockpit.
Flight hides construction controls; exit to edit. The new survey skiff has a
narrow bow, cockpit ribs, solar wings and aft pods. Existing custom hulls retain
their cells; Paste starter ship is an explicit replacement. There is no mass,
independent thruster-force simulation or free roll yet.

Stars sample normalized world view rays, including field of view and aspect.
Their angular positions stay fixed in the world as the camera turns. Aster has a
120 m radius, larger surface relief and a survey station. Procedural solid terrain
and saved edits determine collision/building independently of rendering. Nearby
16³ render chunks load with a two-chunk frame budget and evict when leaving;
coarse interior planet silhouettes remain visible at range. This is an initial
bounded streaming implementation; physical iPhone memory/thermal tests and more
refined LOD transitions still matter. Old moons and terrain are retained.
