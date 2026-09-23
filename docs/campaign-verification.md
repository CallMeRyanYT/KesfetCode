# KAŞİF campaign: story mapping and verification

Verification date: 2026-09-21.

The supplied story is implemented as Level 1 — EXPLORER / KAŞİF: six worlds, five missions per world, and 30 missions in total. The old five-puzzle battery demo has been replaced. The menu also exposes all three age paths: EXPLORER / KAŞİF (5–7), INVENTOR / MUCİT (7–9), and CODE MASTER / KOD USTASI (9–12). Older paths are debug previews with optional Forward, Turn right, and Turn left blocks.

## Mission mapping

The command target includes direct direction moves, optional older-path turn blocks, and the final Launch action. It is the inclusive limit for the third star after collecting all crystals.

| Mission | Story milestone | Implemented lesson or objective | Command target |
| --- | --- | --- | ---: |
| 1 | Wake Up, KAŞİF! | One direct Right move to the charging pad | 1 |
| 2 | The First Journey | Two direct Right commands in sequence | 2 |
| 3 | The Long Corridor | Four direct Right moves | 4 |
| 4 | The Energy Crystal | Drive onto the crystal, then use Collect crystal | 5 |
| 5 | Escape from the Laboratory | Straight route with two crystals | 8 |
| 6 | Right Route | Right then Down direct commands on an L-shaped path | 4 |
| 7 | Left Route | Up then Right direct commands on the opposite corner | 4 |
| 8 | Around the Corner | Direct Up, Right, Down, and Left commands | 8 |
| 9 | Crystal Path | Direct commands through a route with two crystals | 8 |
| 10 | Training Course | First longer training maze | 17 |
| 11 | There's a Rock in My Way! | Route around a blocked direct path | 8 |
| 12 | Two Paths | Distinguish a route from a dead end | 6 |
| 13 | Don't Forget the Crystal | Direct exit or optional crystal detour | 9 |
| 14 | Rock Maze | Plan a series of obstacle-avoiding directions | 22 |
| 15 | The Lost Energy Crystals | Explore for three crystals | 17 |
| 16 | I'm Running Out of Energy! | Move-only energy cost, starting capacity 10 | 8 |
| 17 | Charging Station | Required battery, including last-unit arrival | 9 |
| 18 | Which Path Is Shorter? | Four-move route succeeds; eight-move route exceeds capacity 5 | 4 |
| 19 | Crystal or Energy? | Direct one-star exit; recharge needed for the crystal route | 11 |
| 20 | Energy Center | Crystals, obstacles, and several battery stops | 33 |
| 21 | The Locked Door | Gold key opens the matching door | 4 |
| 22 | Find the Key | Retrieve a key before returning to the door | 8 |
| 23 | The Wrong Path | Visit the key's side corridor | 14 |
| 24 | Two Keys | Gold and blue keys open distinct matching doors | 14 |
| 25 | Escape from the Robot Base | Crystals, energy, a key, and a door | 26 |
| 26 | The Rocket Component | Required component delivery | 10 |
| 27 | Energy Module | Module delivery with two required recharge stops | 16 |
| 28 | Navigation Module | Larger map with alternate routes and required module | 24 |
| 29 | Find the Launch Code | All three K–Ş–F fragments required before the exit | 24 |
| 30 | KEŞFET-1: Launch Mission | Crystal → key → door → battery → rocket → explicit Launch | 40 |

Missions 1–15 do not limit movement energy. Missions 21–24 also remove that limit while introducing keys and matching doors; mission 25 combines energy with those new objectives. No repeat or loop block is exposed in this chapter.

## Route and energy audit

All 30 authored solutions were executed through the game engine and reached successful completion with three stars.

A separate breadth-first route search was also run without calling the engine's `step()` function. It tracked position, facing, command count, movement energy, one-use batteries, crystal and item collection, matching keys, and the finale's objective order. For every mission, the shortest valid route collecting all crystals exactly matched the advertised command target in the table above.

With battery recharge disabled but battery tiles left traversable, missions 17, 20, 25, 27, 28, 29, and 30 have no valid route to completion on their starting charge. Mission 19 can reach its exit directly but cannot complete the crystal detour without recharge. This verifies that the battery-route idea changes the required plan rather than serving only as decoration.

The authored solutions for missions 17, 19, and 27 finish with exactly zero energy. These successful routes confirm that arrival pickups and destination completion are resolved before exhaustion. The final mission is the largest board, at 13 columns by 11 rows; its optimal solution uses 38 moves and 47 commands including Launch.

Additional acceptance checks passed: direct exits in missions 13 and 19 award one star without their crystals; mission 18's longer route exhausts energy; removing either matching key from mission 24 blocks its door; removing a required module or code fragment from missions 26–29 blocks delivery; and mission 30 rejects an early Launch. Its successful event sequence is crystal, key, door, battery, rocket readiness, then launch.

## Completion and scope

Reaching a normal destination earns one star. Collecting all crystals also earns the second, and staying within the command target earns the third. A mission with no crystals already satisfies the crystal requirement. Crystals do not recharge KAŞİF. Modules and code fragments are required mission items, rather than optional crystal-star collectibles.

The rocket destination is a preparation state, not a completed mission. The final Launch action is enabled only after the ordered objectives and rocket arrival, and campaign completion is recorded after launch. Hints and demonstrations use the same engine rules as normal play; demonstrations do not grant progress.

The main menu has exactly three age-labelled chapter cards: EXPLORER / KAŞİF (5–7), INVENTOR / MUCİT (7–9), and CODE MASTER / KOD USTASI (9–12). Debug mode keeps every chapter and mission selectable. The older previews expose Forward and Turn blocks while clearly distinguishing the future loops/repeats/optimization and conditions/sensors/functions curriculum.

Campaign progress is versioned, with separate best-star and best-crystal totals for all 30 missions. Old five-puzzle completion cannot unlock these missions. Progress remains local to the browser and origin.

## Repeating the project checks

Run the current automated checks from the project root:

```sh
npm test
npm run check
```

For visible verification, run `npm start` and open `http://127.0.0.1:4173`. Check the three age-labelled chapter cards, the lesson coach, an early direct-direction lesson, explicit crystal collection, a battery-dependent mission, matching keys and doors, and the ordered rocket launch. Repeat representative interactions in Turkish and with reduced motion enabled. Camera controls and mobile layouts should remain usable on the largest board as well as the first one.
