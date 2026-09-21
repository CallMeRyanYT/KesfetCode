# Keṣfet Code

Made by Keşfet Lab — a bilingual 3D block-coding game for children.

## Play locally

Install Node.js 18 or newer, then run:

```sh
npm start
```

Open http://127.0.0.1:4173 in your browser.

The checked-in static site includes its 3D library and robot, so no installation is needed to play locally. A browser with WebGL 2 support is required. No account, database, or API keys are needed for local play.

## Included

- Five progressively unlocked 3D factory puzzles starring the supplied textured Joybot model
- Animated robot movement and turns, raised factory tiles, spinning machines, floating batteries, and a lifting gate
- A 3D mission-control lobby, drag-to-look camera, overhead view, zoom, and camera reset
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
- `dist/app.js`: game interface, translations, and preferences
- `dist/factory3d.js`: persistent Three.js renderer, model loading, camera, factory geometry, and animation
- `dist/factory.css`: responsive light and dark themes
- `dist/assets/kesfet-lab.png`: original user-supplied emblem
- `dist/assets/joybot.glb`: original user-supplied model with embedded textures (unchanged)
- `dist/vendor/`: locally hosted Three.js 0.186.0 and MIT license

The supplied robot has no skeleton or animation clips. A runtime shoulder rig uses weights derived from the model's connected arm parts to lower and animate its arms while preserving the head, body, and wheels. Movement bounces, switch jumps and stomps, collision recoil, and overhead battery celebrations animate in sync with sound. An animated face display adds a small idle smile, blinking, and a sad collision expression; happy moments reveal the original textured face. The original GLB remains unchanged.

One renderer and one model are reused between screens and block edits; model failures offer retry, and lost graphics contexts stop the current program safely. Reduced-motion preferences retain the relaxed arm pose while suppressing decorative movement.

To refresh the vendored 3D library after a dependency change, run `npm ci` followed by `npm run build`. Keep `package-lock.json` and the generated vendor files together.

The only optional external request is to Google Fonts; system fonts are used if unavailable.

