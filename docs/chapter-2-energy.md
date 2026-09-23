# Power the journey: energy now and in later chapters

Status: movement energy and battery-route planning are implemented in the 30-mission KAŞİF campaign, beginning in World 4. More advanced versions remain an idea for Level 2 — MUCİT.

## Story and scope

The supplied story outline names the robot KAŞİF and follows its training toward the KEŞFET-1 launch mission across six worlds. It introduces an energy meter in World 4, the Energy Center. The additional idea asks for routes where the crystal is too far away on the starting charge, so the player must find a battery along the way; its more demanding versions can continue in a later chapter.

The campaign therefore teaches movement and route planning first. Missions 1–15 have no movement-energy limit. Mission 16 introduces the meter; mission 17 requires a charging stop. Later Energy Center, Robot Base, and launch missions combine recharge planning with crystals, keys, doors, and spacecraft objectives.

The original five-puzzle prototype has been replaced by the full Level 1 campaign. Its legacy save is kept separate because its missions and command rules do not match the story campaign. Level 2 — INVENTOR (MUCİT, ages 7–9) and Level 3 — CODE MASTER (KOD USTASI, ages 9–12) remain visible and unlocked for debugging. Their preview path adds Forward, Turn right, and Turn left blocks for older explorers while loops, sensors, and functions are developed.

## The player's task

KAŞİF must reach a crystal, but its starting charge cannot cover the entire route. The player must include a reachable battery in the program, recharge, and continue to the crystal.

| Object | Purpose in energy missions |
| --- | --- |
| Crystal | Exploration collectible for the crystal star; collecting it does not refill energy |
| Battery | One-use pickup that restores energy; collecting it does not finish the mission |
| Destination | Completes a mission when its required objectives are fulfilled |

Crystals are separate from the destination. This preserves the lesson from mission 13: reaching the goal and collecting every crystal are different achievements. Required spacecraft items must be collected before delivery, and the final launch mission specifically requires its crystal and the remaining objectives in the prescribed order.

## Simple rules

- Start with the mission's clearly displayed charge and full capacity; the value is defined per mission.
- Each successful move to a neighboring tile costs 1 unit.
- Waiting, editing code, camera movement, and turning in place cost nothing. Direct compass movement still costs one energy per tile.
- Entering a battery tile automatically refills charge to the mission's displayed maximum. No extra collection command is needed.
- Each battery can be collected only once per run. Revisiting its tile gives no additional charge.
- A collision keeps the existing stop-and-retry behavior and does not consume movement energy.
- Restart restores the starting charge, pickups, doors, and robot position while preserving the child's code for editing.
- Energy never drains with real time, so children can think without pressure.

## Example: the crystal is too far away

In this illustrative route, the crystal is 9 moves from the start, with a battery reachable after move 4. KAŞİF starts with 6 units and has a capacity of 6. Individual campaign maps use their own distances and capacities.

| Point in the journey | Energy |
| --- | --- |
| Start | 6 / 6 |
| Arrive at battery after 4 moves | 2 / 6 |
| Collect battery automatically | 6 / 6 |
| Reach crystal after 5 more moves | 1 / 6 |

Without the battery, the 9-move journey exceeds the 6-unit starting charge. The battery makes the full route possible. Later puzzles can place the battery on a branch so the child has to plan a detour.

## Arrival order and friendly failure

For a valid move, check that at least 1 energy remains, move one tile, subtract 1, collect any pickup, and then evaluate the mission goal. Only after resolving that arrival should the game check for an empty battery.

This allows KAŞİF to reach a battery on its last unit and recharge immediately, or complete a mission by reaching its destination with exactly 0 remaining. Arriving at the final rocket with 0 also permits the separate Launch action. A robot already at 0 cannot make another move. At a crystal with 0 energy and no recharge or completed destination, the run stops for revision.

When charge runs out, the program stops and the code stays intact for revision. The player can reset or run again and consult the hint, with no lives lost or unlocked progress removed.

Feedback should clearly explain that a battery stop is needed, rather than treating the failure as an incorrect crystal collection.

Example English feedback: “Out of energy! Add a battery stop to your route and try again.”

Example Turkish feedback: “Enerji bitti! Rotana bir pil durağı ekle ve yeniden dene.”

## Learning sequence

1. Show the energy meter on a short route that is comfortably within the starting charge.
2. Put a battery directly on a longer route and demonstrate automatic recharge.
3. Require a small battery detour before the crystal.
4. Offer two routes with different energy requirements; make both distances readable.
5. Combine a battery stop, a key or door, and a crystal without adding another basic command.

Use a numbered meter and visible charge segments, with a gentle low-charge cue. A battery pickup plays a quick recharge celebration and continues the code; a crystal earns a happy pickup reaction, and reaching the destination with the required objectives triggers the full victory celebration.

Energy and code efficiency are distinct. KAŞİF missions use direct Up, Right, Down, and Left blocks; older age paths additionally offer Forward, Turn right, and Turn left. Turns count toward the command target but do not consume movement energy. A mission's third star requires all crystals and a program within its displayed command target.

## Later-chapter extensions

Level 2 — INVENTOR (MUCİT) introduces loops, repeats, optimization, and the optional Forward/Turn controls for ages 7–9. Longer battery detours can give those blocks a useful purpose without changing the basic recharge rules. A future repeat block must pay for every move it executes: three moves cost three energy units even when represented by one repeat block. Loops shorten code; they do not shorten the traveled route.

Level 3 — CODE MASTER (KOD USTASI) builds on that foundation with conditions, sensors, and functions for ages 9–12. These are curriculum previews; no repeat, sensor, condition, or function commands are exposed in the KAŞİF path.

## Validation requirements

- Every mission has a verified solution from its starting charge, with the first required battery reachable before power runs out.
- A puzzle advertised as requiring a battery cannot complete its advertised objective on the starting charge alone. Mission 19 deliberately permits a direct exit while requiring recharge for its crystal detour.
- Exact-zero arrivals, one-use batteries, and capacity limits behave consistently. Per-move repeat costs must also be tested when the later loop chapter is implemented.
- Reset and running again restore energy and pickups while retaining the child's program for revision. Stop interrupts execution. Selecting another mission starts a fresh program for that mission.
- Hints and demos use the same energy rules as the player.
- English and Turkish explain the separate roles of batteries and crystals.
- Legacy five-puzzle saves do not accidentally unlock the new campaign; campaign saves preserve earned stars and crystal totals across reloads.

The implementation and current verification record are mapped in [campaign verification](campaign-verification.md).
