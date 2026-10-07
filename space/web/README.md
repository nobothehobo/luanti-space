# Phone-first browser development

This is an interim **original HTML/WebGL browser edition**, not Luanti compiled
to WebAssembly and not an iOS app. Native `games/luanti_space` and upstream engine
source remain separate. Browser and native editions share `world_spec.json`,
integer-centered voxel coordinates, material identifiers, and action meanings.

## Entire workflow from iPhone/iPad

1. Request changes in ChatGPT Work with this GitHub repository connected. Changes
   are committed to `codex/space-flight-foundation` (later the default branch).
2. GitHub Actions runs authority/save unit tests, desktop browser flows,
   portrait/landscape phone-size tests, and WebKit tests. Downloadable evidence
   includes screenshots and world backups. No local terminal or Mac is required.
3. Only a passing browser build is published automatically to `gh-pages`.
4. Open the Pages URL in **Safari** on your iPhone/iPad. For a more app-like
   experience, Share → Add to Home Screen. Play, report the build ID from the
   menu, and attach a screenshot or downloaded diagnostics when something fails.
5. Use **Back up world** to save a JSON backup in Files. Import it on another
   device if desired. Saves are local to that browser/origin, not GitHub or iCloud.

### One-time GitHub Pages switch (also possible in Safari)

Repository owner: open
<https://github.com/nobothehobo/luanti-space/settings/pages>.
Set **Source → Deploy from a branch**, **Branch → gh-pages**, **Folder → /(root)**,
then Save. Wait for GitHub's Pages deployment to finish.

Expected address after deployment:
<https://nobothehobo.github.io/luanti-space/>.
Do not treat that address as live before a successful Pages deployment.
The connected GitHub app cannot administer the Pages setting on your behalf.
No Apple account, paid signing, new hosting account or local computer is needed.

## Implemented browser foundation

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
The browser garden has a ±1000-cell bound and a 20,000 changed-cell save limit;
this is not the eventual large-world architecture. Browser storage can be
evicted/cleared by iOS, and private browsing may not retain it. Export backups.
Backgrounding pauses input/movement. Home-screen and Safari saves may be separate.
Look supports mouse pointer lock where available and drag-to-look otherwise.
Automatic updates are picked up on reload while online; existing offline builds
stay available until a new complete precache activates.

## Reproduce tests without a phone

```sh
node --test space/web/tests/unit.test.mjs
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
