# Required iPhone / iPad path

Checked 2026-10-07 using live upstream repository metadata and official sources.

## Current status

Official [downloads](https://www.luanti.org/en/downloads/) offer Windows, Android,
Linux, macOS and BSD; there is no official iOS release listed.
[iOS support #15831](https://github.com/luanti-org/luanti/issues/15831) is open.
Its remaining checklist includes simulator/build CI, app lifecycle, real-device
testing/fixes, signing/distribution and first official release.

[Port PR #15451](https://github.com/luanti-org/luanti/pull/15451) is open, unmerged,
updated 2026-09-27. Head checked: `feeb80f3757054d1da0c2dfc980b052abe10f60c`.
It adds ANGLE/OpenGL ES translation to Metal and reports simulator gameplay,
including joining servers and installing games. It references Xcode 26.2 and
prebuilt [iOS dependencies](https://github.com/luanti-org/luanti_ios_deps/releases/tag/latest).
The fork audited here does not contain those unmerged changes. Simulator success
is evidence of feasibility, not proof of an iPhone shipping build.

## Port work and gates

1. On a Mac with Xcode, inspect the current upstream PR and dependency build
   scripts; pin reviewed revisions in a separate experimental engine-port branch.
   Start from simulator plus a real arm64 device build, not an assumed macOS build.
2. Verify ANGLE/Metal renderer, SDL/UIKit window/events, audio and dependency
   architectures. Use interpreter/no-JIT Lua as needed on iOS. Confirm all
   dependencies and game packaging load in the sandbox.
3. Handle background/suspend/resume, interruption, local-server lifetime and
   saving before suspension. Document that an iPhone LAN host cannot promise to
   keep serving while iOS suspends its application. Test a PC dedicated host first.
4. Set durable Application Support/document world paths, bundle the game, and
   test SQLite save/reopen after foregrounding, termination and upgrade. Add
   signing/provisioning, device archive, reproducible CI, and an actual install
   route (initially developer devices/TestFlight if available). No App Store
   availability is promised by this repository.
5. Test network permissions/local-network prompts, UDP server connection and
   iPhone + Windows edits in one world with compatible protocol versions.
   LAN initially uses manual IP; automatic discovery remains a separate task.
6. Test portrait/landscape policy (initially landscape), notch/safe areas,
   joystick/swipe + ascend/descend + place/remove simultaneously, rotation menu,
   precision mode, and 44pt or larger practical touch targets. Test keyboard,
   trackpad relative look and controllers on iPad; do not claim desktop pointer
   capture from a simulator alone. Verify hot-switching between input methods.
7. Measure representative iPhone performance, memory, sustained thermals and
   battery consumption before defining hardware/preset targets.

The game layer uses standard native engine actions and server callbacks; there
is no browser/WebSocket reimplementation, separate mobile world, or device-specific
map format. The intended result is the same game on an iOS engine port speaking
the same Luanti protocol as Windows/macOS/Linux. This remains unverified until
actual native builds connect and pass the cross-device matrix.

## Required external resources

macOS/Xcode, simulator and iPhone/iPad hardware; an Apple signing account and
chosen distribution route; a reviewed dependency/engine port. These are unavailable
in the current Linux workspace. Game development can proceed here; iOS validation
cannot be substituted with Android tests or responsive UI mockups.

SDL's own [iOS build guide](https://wiki.libsdl.org/SDL3/README-ios) is a useful
platform reference, but does not itself supply a completed Luanti iOS port.
