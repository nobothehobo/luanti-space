# Browser edition validation

Tested 2026-10-07 in the development workspace:

- Eight Node behavior tests passed: deterministic terrain, DDA targeting,
  assisted flight/braking, boosted collision, validated commands, undo/redo,
  delta save/reload, malformed/future/protected save rejection.
- Eight existing native Lua behavior tests passed.
- Native server plus two native clients passed both fresh-world and reload runs
  after moving the island seed to the shared JSON specification. Native placement,
  removal, rotation, private preview, persistence and network synchronization
  remain functional. Logs: ignored `build/space-test-z0omjwfp`.
- Real headless Chromium 138 rendering and event-handler integration passed at
  1280×720, portrait 390×844, and landscape phone-size viewports. Keyboard rise,
  touch movement/rise/look, placement/rotation, undo/redo, saved reload, download
  backup, rejected import and offline service-worker reload were exercised.
- Rendered phone and desktop screenshots were visually inspected; header/HUD
  backing was added to retain contrast against pale geometry.

Chromium integration uses an isolated fresh browser context per case. Touch
PointerEvents exercise the actual input adapter but are synthetic, not a hardware
gesture test. Default Playwright downloads failed in this workspace; a separately
packaged test-only Chromium was used. Neither dependency is shipped to players.

GitHub's browser workflow additionally runs WebKit. Its result must be inspected;
the existence of that test is not a passing result. Real iPhone/iPad Safari, GPU,
storage eviction, thermals and Home Screen behavior remain **unverified** until
the published HTTPS game is played on physical devices.

2026-10-08 follow-up: previous cloud run `37693226447` passed the three Chromium
cases and reached WebKit's offline reload, where Playwright's known
[offline-emulation bug #42775](https://github.com/microsoft/playwright/issues/42775)
produced an internal error. The test now disconnects the real local HTTP origin,
asserts that connections were refused, and still requires a cached reload and
preserved world edits. This is not an offline-test skip. Updated cloud results
must be inspected before declaring WebKit success.

The revised PR run `37845918777` passed all four browser cases, including WebKit.
The simultaneous push run exposed a separate intermittent offline-start timeout:
WebKit delayed network-first module failures after the server outage. The shell
is now versioned/cache-first, with fresh downloads only while installing a new
worker. The outage test also requires an uncached request to fail before checking
cached launch. This avoids both startup delays and mixed-version shell assets.
The follow-up must pass cloud checks before it is published.

GitHub Pages requires the owner's one-time publishing-source selection. There
is no claim that an expected URL is live before successful deployment. The
browser is local solo and does not join native Luanti servers.

2026-10-09 orbital-opening follow-up: runtime commit `37febdde688c` passed
17 Node behavior tests and all four browser cases in
[push run 37881914977](https://github.com/nobothehobo/luanti-space/actions/runs/37881914977).
Fresh worlds open aboard the starter ship facing Morrow, beyond the old islands.
The UI tests return to the dock to build, fly to Morrow, explicitly recall the
ship, and assert that hull cells and both energy banks survive recall. The
network-only updater page is exercised before the actual-origin outage and
cached reload. A failing first run exposed offline re-registration after the
updater; the game now reuses the installed registration and treats background
update failure as an unavailable connection rather than a game error.

Desktop and WebKit portrait opening screenshots were inspected: the planet is
centered ahead and the starter hull is visible in the foreground. The official
Pages deployment succeeded; public build-info reports `37febdde688c`. Existing
world locations and edits are retained; explicit recall relocates the ship and
boards it. The original islands remain as legacy build locations. Native engine
and native game generation are unchanged. Real iPad hardware remains unverified;
this is still bounded solo planetoid exploration, not large streamed planets.
