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
