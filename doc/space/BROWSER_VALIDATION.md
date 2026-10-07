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

GitHub Pages requires the owner's one-time publishing-source selection. There
is no claim that an expected URL is live before successful deployment. The
browser is local solo and does not join native Luanti servers.
