# Keşfet Code

Made by Keşfet Lab — a bilingual 3D block-coding game for children.

## Play locally

Install Node.js 18 or newer, then run:

```sh
npm start
```

Open http://127.0.0.1:4173 in your browser.

The checked-in static site includes its 3D library and robot, so no installation is needed to play locally. A browser with WebGL 2 support is required. No account, database, or API keys are needed for local play.

## The story campaign

Teach KAŞİF to follow an algorithm, complete its training at KEŞFET LAB, and reach the KEŞFET-1 launch center. Level 1, **KAŞİF**, contains 30 missions across six worlds. Debug mode keeps every mission selectable while the campaign is tested:

| World | Missions | What the child learns |
| --- | --- | --- |
| The Robot Awakens | 1–5 | Choose direct Up/Right/Down/Left blocks and collect the first crystals |
| Learning Directions | 6–10 | Combine direct directions; older age paths add Forward and Turn blocks |
| Discovery Valley | 11–15 | Avoid rocks, compare routes, make a detour for crystals |
| Energy Center | 16–20 | Budget movement energy and plan battery stops |
| Robot Base | 21–25 | Collect keys, unlock doors, combine multiple objectives |
| The KEŞFET-1 Mission | 26–30 | Recover spacecraft modules and launch-code fragments, then launch |

The menu has three age-based chapter cards: **Level 1 — EXPLORER** (Turkish: KAŞİF, ages 5–7), **Level 2 — INVENTOR** (Turkish: MUCİT, ages 7–9), and **Level 3 — CODE MASTER** (Turkish: KOD USTASI, ages 9–12). All three are temporarily unlocked for debugging so a child can choose the right age path. KAŞİF keeps the simple compass controls; the older paths add Forward, Turn right, and Turn left blocks while the later curriculum is being built.

The finale requires an ordered route: collect the crystal, find the key, unlock the door, recharge, and reach KEŞFET-1. Arriving at the rocket enables a separate **Launch** action. Complete the countdown and liftoff to finish the campaign and reveal KAŞİF's mysterious transmission.

## Play and learn

- Click or drag blocks into the program; reorder or remove them before running. The lesson coach explains each step beside the workspace.
- In KAŞİF, **Up**, **Right**, **Down**, and **Left** drive one square directly, so young children never need to rotate the robot. The older age paths also expose **Forward**, **Turn right**, and **Turn left**.
- A crystal needs an explicit **Collect crystal** block after KAŞİF drives onto it. It is never picked up automatically.
- Run executes the sequence from the beginning. Stop interrupts it; reset returns the robot, pickups, doors, and energy to their starting state while retaining the program for editing.
- Hints and animated demonstrations explain each puzzle. Demonstrations do not complete missions or unlock campaign progress.
- Drag the scene to look around, use the overhead view or zoom, and reset the camera when needed.
- English / Turkish, light / dark themes, and sound preferences are available throughout play.

Crystals and batteries have different jobs: crystals reward exploration, while a battery refills KAŞİF's energy. Energy begins in mission 16. Every successful move costs one unit; turning, editing, and waiting cost nothing. Batteries are collected automatically and can recharge only once per run. Reaching a battery or the destination on the last unit is valid. Some later routes cannot be completed without collecting a battery first.

Each completed mission awards up to three stars: one for reaching the destination, two for also collecting every crystal, and three for doing both within the displayed command target. On missions without crystals, the crystal condition is already satisfied. Commands after an early finish do not improve the score. Replay can improve a mission's best result.

The supplied textured robot remains the main character. Driving, turning, collectible reactions, recharging, door unlocking, collisions, celebrations, and launch effects make the program's actions visible. Sound cues accompany key events. The system's reduced-motion preference suppresses decorative movement while retaining clear game state.

Progress and preferences are stored only in the current browser; they do not sync between devices or website origins. The 30-mission campaign uses a versioned save separate from the earlier five-puzzle prototype, whose completion does not unlock unrelated story missions.

## Check

```sh
npm test
npm run check
```

The tests cover the campaign's puzzle solutions, progression and save normalization, command availability, stars, movement energy and batteries, keys and doors, required mission items, ordered launch behavior, invalid commands, robot animation, rigging, and sounds. See [campaign verification](docs/campaign-verification.md) for the story mapping and recorded checks.

## Files

- `dist/`: the complete static website, ready for static hosting
- `dist/engine.js`: deterministic puzzle engine, scoring, and campaign progress
- `dist/levels.js`: six worlds and all 30 mission definitions
- `dist/app.js`: game interface, translations, and preferences
- `dist/factory3d.js`: persistent Three.js renderer, model loading, camera, factory geometry, and animation
- `dist/factory.css`: responsive light and dark themes
- `dist/assets/kesfet-lab.png`: original user-supplied emblem
- `dist/assets/joybot.glb`: original user-supplied model with embedded textures (unchanged)
- `dist/vendor/`: locally hosted Three.js 0.186.0 and MIT license

The supplied robot has no skeleton or animation clips. Its runtime rig animates the original model without rewriting the GLB. An animated face adds expressions and blinking, with happy collectible and completion reactions. The original GLB remains unchanged.

One renderer and one model are reused between screens and block edits; model failures offer retry, and lost graphics contexts stop the current program safely. Reduced-motion preferences retain the relaxed arm pose while suppressing decorative movement.

To refresh the vendored 3D library after a dependency change, run `npm ci` followed by `npm run build`. Keep `package-lock.json` and the generated vendor files together.

The only optional external request is to Google Fonts; system fonts are used if unavailable.

## Energy and later chapters

The [energy design note](docs/chapter-2-energy.md) records the implemented World 4 recharge rules and battery-route planning. Level 2 and Level 3 age paths are selectable previews; their Forward/Turn controls are available for older explorers, while loops, repeats, conditions, sensors, and functions remain future curriculum.

