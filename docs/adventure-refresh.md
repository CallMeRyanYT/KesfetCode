# Adventure artwork and validation

Generated using the built-in ImageGen tool. Assets are decorative backgrounds; all mission buttons, labels and program blocks are real interactive UI.

## Assets and prompt briefs
- `dist/assets/spaceport-menu.png`: Family adventure spaceport, Earth horizon, orange tracked robot lower left, rocket right, cyan and orange lighting, empty center, no text or UI.
- `dist/assets/journey-map.png`: Isometric green floating island, waterfall river, laboratory, winding paths and rocket launch site, no text or UI.
- `dist/assets/chapter-islands.png`: Three islands in a horizontal composition: green laboratory, Mars research base and icy observatory, navy space background, no text or UI.
- `dist/assets/mars-map.png`: Mars research landscape of terraced floating red sandstone islands, broad winding paths, orange dunes, friendly white research domes, solar panels, satellite dishes and rover; open center for thirty mission markers, no text or UI.
- `dist/assets/ice-map.png`: Terraced floating icy islands with broad paths connecting futuristic observatories, science domes and satellite dishes; snowy blue cliffs, ice bridges, distant purple planet and aurora; open center for thirty mission markers, no text or UI.

## Implementation notes
All thirty missions appear once on a single serpentine map. Six story-world labels describe consecutive groups of five. Chapter backgrounds are green, Mars and ice. Later age paths are explicitly marked as curriculum previews: they share the thirty Explorer missions and add relative movement commands, rather than claiming ninety independently authored missions.

The gameplay program runs from left to right beneath the board; its block bank appears immediately below. Blocks support click-to-add, drag insertion/reordering, accessible reorder buttons and removal. Movement, impact and celebration durations finish before advancing the runner or displaying completion.

Validation: npm run check, npm test (100 passing), npm run build, git diff --check. Browser checks covered mission selection, successful first mission, blocked movement, chapter backgrounds, mobile map width and light/dark switching. Local preview only; no deployment performed.

## Animation and terrain follow-up
The browser reported prefers-reduced-motion: reduce. That preference previously disabled the entire robot, including tile interpolation. Robot animation now defaults to full motion with an explicit in-game Motion on/off control; decorative CSS can still honor the OS preference. Confirmed live intermediate X positions (-1.1551, -0.7189, -0.2383) before arrival at 0, alongside increasing wheel travel and changing arm/body poses. Shoulder bones deform the supplied mesh. Zoom now allows .65x–3x, including wheel/pinch controls.

Added terrain assets using built-in ImageGen: journey-terrain.png, mars-terrain.png and ice-terrain.png. The initial prompt requested a portrait near-top-down green landscape with a single broad winding road from a bottom-left laboratory to a top-right rocket, six terraces, rivers and bridges, no text or UI. Variant prompts retained exact road, bridge, building and camera placement while retexturing the landscape into Mars and ice. The thirty marker locations are authored against this terrain instead of a rectangular grid. The continuous map scrolls vertically; no pagination.

Follow-up validation: 101 tests pass, including rendered intermediate movement, body articulation and zoom limits; syntax and build checks pass.

## Living scenery and robot perspective
- Home now places the real shoulder-rigged robot over `dist/assets/spaceport-live.png`, with a one-arm greeting. Built-in ImageGen edit prompt: "Remove ONLY the orange robot in the bottom left. Seamlessly reconstruct the empty metal spaceport floor, railings and left wall behind it. Preserve the exact composition, Earth, stars, rockets, lighting, colors, perspective and every other detail. No robot or character anywhere. This will be a background behind a real animated 3D robot. No new text or UI."
- Chapter/map scenery has animated river highlights, waterfall mist and flying/flapping birds. The menu animation button pauses scenery and robot motion. These are animated layers over the illustration, not a fully simulated 3D landscape.
- Player directions are robot-relative: Forward follows its current heading, Right/Left turn and drive one tile, Backward reverses direction and drives. Older paths retain turn-in-place commands. Demo routes are converted from the authored compass routes; all thirty converted routes were tested.
- The robot stops .72 world units short of an item center. The 1.25-second pickup travels to a hand, around the shoulder, then into a visible backpack with an opening lid. Stored-item counts are shown in the HUD.
- Validation: 103 tests pass, including relative routes and pickup clearance/storage. Browser checks confirmed the live wave, changing river/bird animation values, the scenery pause control, crystal clearance and a stored-item result of one.

## Correction: animate the source illustration
The 3D menu stand-in and dotted river overlay have been removed. `dist/illustration-motion.js` now draws the original menu illustration and rotates a clipped layer of its original raised arm around the shoulder. Only the old arm footprint uses the inpainted clean plate, so the original face/body/background are preserved.

ImageGen built-in edit produced `dist/assets/spaceport-arm-plate.png` from `spaceport-menu.png`. Prompt: remove only the raised arm on the right of the robot's head, reconstruct Earth/space behind it, keep the smiling face, head, torso, other arm, treads and composition unchanged, and retain the shoulder joint. This is used as a background patch, not as a replacement character.

Map water uses the source map texture itself, with animated displacement/crossfade inside polygon and color masks. Waterfall foam flows downward; river areas ripple. There are no dotted flow paths or moving mist ellipses. This is a 2D illustrated-water animation, not a fluid simulation. Canvas frames are capped at 25fps and disposed on navigation; static original artwork is the fallback if assets fail.

Validation: 104 tests pass; build and syntax checks pass. Browser preview confirmed the original robot image, changing arm angle, loaded/advancing water canvas and removal of all old river-current elements.

### Dry Mars artwork and corrected illustrated wave (2026-09-23)
- Replaced the actual Chapter 2 map background with `assets/mars-dry-terrain.png`. The previous image had rivers and waterfalls painted into it even after water effects were disabled. New art preserves the road, bridges, buildings and marker layout, with dry rock ravines throughout. Mars cards/maps still omit birds and water animation.
- Built-in imagegen edit prompt: remove all water, rivers, waterfalls, foam, pools, fountain, vegetation and birds; replace channels with dry red sand/rubble and cliffs; preserve framing, roads, bridges, buildings and rocket. Inspected the complete output before integrating. Existing landscape Mars gameplay art was inspected and is already dry.
- Replaced the inaccurate whole-arm polygon with a curved forearm/finger silhouette. Kept the original upper arm fixed, rotated original source pixels rigidly around the elbow, padded the clean-plate erasure to remove stationary edge slivers, and layered the original elbow cap over the joint. No 3D replacement or stretching.
- Validation: syntax checks including adventure/illustration modules, 105 tests, and build passed. Browser inspected positive and negative wave poses; verified the dry asset loads, all 30 mission buttons remain, and Mars has no bird/water overlay.

### Yellow Start and repeat sequence (2026-09-23)
Removed the separate Run/Step controls. The yellow Start puzzle block is a real keyboard-accessible button and changes to Stop during execution. Repeat wraps the entire current sequence in a green frame, with a 2–10 count, plus/minus controls, removal, and a live iteration indicator. Editing and repeat changes remain disabled during a run. New missions, demos and clearing reset the repeat count. Instructions are updated in English and Turkish.
Validation: 106 tests, syntax checks and build pass. In the browser, one Forward block repeated twice completed Mission 2; count changes, Stop and Turkish labels were also checked.

### Local repeat groups, chapter animation, unified audio
Repeat is now a bounded group containing its own body and count. Adding a normal block defaults to after the group; Inside repeat selects that group as the click insertion destination. Drag/drop supports moving commands into/out of groups and reordering. Multiple groups are supported without nested loops. Replaced the bottom reorder/delete strip with a top-right delete button. Engine validates group contents, counts and expanded instruction limits, preserving per-command highlight keys.
Chapter cards animate the source waterfall pixels (Explorer) and rigid dish sprites (Mars/ice), over an imagegen-created clean plate that removed only the two dish bowls. Mars remains dry. The visible chapter-heading banner was removed at user request, retaining a screen-reader heading.
Added four original synthesized ambient scores (menu, forest, Mars, ice). The single sound control enables/mutes both the score and effects. Removed the separate music/animation Play/Pause menu button. Muted uses the same note with a diagonal slash. Browser autoplay is respected: saved-on sound starts on the first interaction; music pauses in hidden tabs.
Validation: 109 tests, syntax checks and build pass. Browser confirmed Forward in Repeat x3 with Left outside, top-right deletion controls, three animated card canvases, and unified mute icon. Original separate-music-button notes are superseded by this section.

### First-mission terrain, compact panels, and ice scenery
Explorer mission 1 now renders two thick grass-and-earth tiles, flower details, a faceted cyan crystal and metallic pedestal, warmer light, and closer camera framing. The existing one-step charging-pad objective and robot model remain unchanged; this is a terrain graphics pass rather than a replacement character model.
Game panels use translucent backgrounds, smaller controls, a narrower objective card, and shorter program/palette docks. Text and controls retain full opacity. Ice maps now use sparse snowfall instead of applying the forest river distortion mask to frozen scenery.
Validation: 110 tests, syntax checks and build pass. Browser verified the compact panels, completed mission 1 with Forward, and confirmed 22 snow particles with no water canvas or birds on the ice map.
