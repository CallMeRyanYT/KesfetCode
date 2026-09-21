# Keṣfet Code

Made by Keşfet Lab — a small, bilingual block-coding game for children.

## Play locally

Install Node.js 18 or newer, then run:

```sh
npm start
```

Open http://127.0.0.1:4173 in your browser.

No dependency installation, account, database, or API keys are needed.

## Included

- Five progressively unlocked factory puzzles starring the supplied Keşfet Lab robot
- Battery collection, directional commands, explicit door switches, and repeat-three-times blocks
- Click-to-add and drag-and-drop blocks, reordering, removal, run, stop, and reset
- English / Turkish, light / dark themes, and browser-local progress
- Original sounds for blocks, movement, switches, errors, battery pickups, and victories, with a persistent mute toggle
- Hints and animated demonstrations, with replay to earn additional stars
- Responsive layouts and keyboard-accessible buttons; arrow keys also add blocks when focus is outside controls

Progress and preferences are stored only in the current browser; they do not sync between devices or website origins.

## Check

```sh
npm test
npm run check
```

The tests cover all puzzle solutions, independent shortest-path checks, progression, persistence normalization, door and repeat mechanics, collisions, and invalid commands.

## Files

- `dist/`: the complete static website, ready for static hosting
- `dist/engine.js`: deterministic puzzle engine and five level definitions
- `dist/app.js`: game interface, animation, translations, and preferences
- `dist/style.css`: responsive light and dark themes
- `dist/assets/kesfet-lab.png`: original user-supplied emblem
- `dist/assets/robot-factory.png`: generated factory artwork, revised to feature a battery

The only optional external request is to Google Fonts; system fonts are used if unavailable.

