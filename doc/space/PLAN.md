# Playable milestone plan

## Implemented foundation (this change)

Architecture/source audit; isolated original game; native predicted assisted
flight with precision/gentle acceleration; one shared action adapter; small
floating-island environment; native persistent worlds; prototype validated
place/remove/rotate, four-material palette, private translucent server ghost,
bounded conflict-aware session undo/redo; explicit opt-in control profiles.

This starts Milestone 1 and part of Milestone 2. It does not certify the first
playable success criterion until human desktop checks pass, or imply completion
of mobile controls, iOS port, public-server security, advanced construction,
or a shipping standalone executable.

## Execution order and acceptance gates

| Milestone | Focus | Exit evidence |
| --- | --- | --- |
| 0 | Audit APIs, protocol, input, mobile, iOS; separate game/engine | Source-backed decisions and explicit platform gaps (ARCHITECTURE.md, IOS.md). |
| 1 | Windows flight garden, analog actions, responsive braking/hover | Launch Windows build, fly/boost/strafe/ascend/descend without lag-driven velocity updates, reload saved pose. Test keyboard profile and settings overrides. |
| 2 | Building while flying; client presentation API if needed | Correct client-native ghost and face targeting, valid/invalid states, repeat place/remove, rotation, palette. Tests at 0/80/150ms RTT; server rejects malformed/out-of-reach/protected edits. |
| Early network proof | Two native clients before further construction tools | Two players see flight and identical placements/removal/rotation; reload shared world. Test modest latency and mobile-ready analog input contract. |
| iOS spike | Reviewed upstream port on Mac, real iPhone/iPad | Signed install; bundled game; local save; compatible PC server connection; baseline touch gameplay. Treat this as a required gate before large feature expansion. |
| 3 | Dedicated mobile layout and contextual tools | Real landscape phone sessions, simultaneous flight/build input, safe areas and precision target tests; iPad keyboard/trackpad/controller where possible. |
| 4 | Network robustness and movement authority | Measured prediction/corrections, interpolation, edit consistency, reconnects. Document or implement authoritative movement API before public/competitive play. |
| 5 | Offline/LAN/server product flows | Local create/reload, PC host/manual-IP join, dedicated persistent world. LAN discovery and iOS-host suspend behavior explicitly tested. |
| 6 | Advanced construction | Bounded line/wall/floor edits, transactional history, selections, copy/duplicate, versioned blueprints, permissions/rate budgets. |
| 7 | Identity/world/rendering | Original islands/orbital ruins/materials/UI/audio; gameplay-parity graphics presets with measured mobile budgets. |
| 8 | Multiplayer modes | Cooperative construction/exploration/races first; survival/PvP only after authority/security gate. |

## Smallest working file set

`games/luanti_space/game.conf`, `minetest.conf`, mod `mod.conf`/`init.lua`;
`actions.lua`, `config.lua`, `flight.lua`, `materials.lua`, `world.lua`;
`building.lua` and `interface.lua` for the preliminary construction experience;
eight original textures and asset licensing; `space/config/client.conf` for
consistent controls on local and remote clients. No engine source edits needed
for this foundation. Read the game guide for launch steps and remaining caveats.

## Interim phone-first browser track

The user requested programming, testing and playing entirely from iPhone/iPad.
`space/web` is an isolated browser edition with GitHub Actions tests and Pages
publishing; see `space/web/README.md`. This does not replace the required native
iOS port or demonstrate native/browser cross-play. Shared `world_spec.json`
prevents diverging initial terrain, but physics/rendering remain distinct.
Prioritize real-device evaluation of this surface before speculative expansion.

The user's direction is now **planetary exploration with customizable ships**,
not a garden as the finished game identity. The browser First Expedition supplies
two bounded planetoids, an editable/piloted starter hull, main/solar power banks,
course navigation and improved keyboard/trackpad adapters. Read `EXPEDITION.md`
for tested behavior and limits. Native Luanti parity is not implied.

Next browser gates: physical-device evaluation; streamed larger planets; modular
construction/personal blueprints; ship orientation/mass/thrusters; independently
validated authoritative multiplayer; cooperative discoveries, resources and
shared outposts. Complex ship systems should be optional depth, not mandatory
maintenance chores. The fixed-sector/one-hull limits are prototype safeguards,
not the intended ceiling for the eventual game.
