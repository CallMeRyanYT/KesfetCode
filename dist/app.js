import { chapterMissionCount } from './chapter-config.js';
import { chapterMission, isOpeningMission } from './opening-missions.js';
import { isFirstMission, guideStep, guideMarkup, mountFirstMissionGuide } from './first-mission-guide.js';
import { brandMarkup } from './brand.js';
import { missionCompanionMarkup, missionTip } from './mission-companion.js';
import { missionRoadMarkup, mountMissionRoad } from './mission-road.js';
import { scrollTopForBlock } from './program-layout.js';
import { PUZZLE_GEOMETRY, CONNECTED_STACK, createPuzzleWorkspace, puzzleBlockCount, puzzleStackBlocks, puzzleStacks, movePuzzleStack, removePuzzleBlock, mountPuzzleInteractions } from './puzzle-workspace.js';
import { AmbientMusic } from './ambient.js';
import { mountIllustrations } from './illustration-motion.js';
import { mountTabletSupport } from './tablet.js';
import { startAppUpdates, appUpdater, mountVersionLabel } from './app-update.js';
import { storyScene, pendingBeat, readSeen, markSeen, resetSeen, STORY_BOOK } from './story.js';
import { playScene } from './story-player.js';
import { REACTIONS, SCENES, LINES, voicePath } from './story-script.js';
import { CompanionVoice, tipVoicePath } from './companion-voice.js';
import { startBlinking } from './talking-robot.js';
import { Coach } from './coach.js';
import { mountMapTravel, resetPositions } from './map-travel.js';
let disposeIllustrations = () => {};
let disposeGuide = () => {}, guideDismissed = false;
let disposeRoad = () => {};
let reducedRobotMotion = false;
import { icon } from './icons.js';
import { adventureMenu } from './adventure.js';
import { WORLDS } from './levels.js';
import { SoundEffects } from './sounds.js';
import { mountVictoryCelebration } from './victory-celebration.js';
import { Factory3D } from './factory3d.js';
import { Classroom2D } from './classroom2d.js';
import { MOVE_MS, TURN_MS, PICKUP_MS, WIN_MS, LAUNCH_MS, PRESS_MS, IMPACT_MS } from './robot-motion.js';
import { LEVELS, CHAPTERS, MAX_BLOCKS, MAX_DIRECTION_COUNT, isDirectionBlock, directionBlockCount, directionCountsAvailable, programBlockCount, missionTargetProgram, missionBlockTarget, initialState, step, expandProgram, availableActions, normalizeProgress, isUnlocked, completeLevel, scoreRun } from './engine.js';

const app = document.querySelector('#app');
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let storageAvailable = true;
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageAvailable = false; } };
let lang = read('kesfet-code-language', null);
if (!['en', 'tr'].includes(lang)) { try { lang = localStorage.getItem('kesfet-language') === 'tr' ? 'tr' : 'en'; } catch { lang = 'en'; } }
// Always dark: the game is played in the dark space theme only.
let theme = 'dark';

let sound = read('kesfet-code-sound', true) !== false;
const audio = new SoundEffects({ enabled: sound });
const music = new AmbientMusic();
// Audio starts on the first user gesture when the saved sound setting is on.
app.addEventListener('click',e=>{if(sound && !music.enabled && !e.target.closest('[data-action="sound"]'))music.setEnabled(true);},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)music.stop();else if(music.enabled)music.start();});
// Temporary QA switch: keep this true while the campaign is being tested.
// Set it to false for the release build so chapter and mission locks follow progress.
const DEBUG_UNLOCK_ALL = true;
const canOpenLevel = index => DEBUG_UNLOCK_ALL || isUnlocked(progress, index);
let demoPending = false;
const factory = new Factory3D(status => queueMicrotask(() => {
  if (status === 'ready' && demoPending && view === 'game' && !running) {
    demoPending = false;
    runProgram(true);
  }
  if (status === 'unavailable' && running && !twoDimensional()) { cancelRun(); feedback = 'stopped'; render(); }
  updateRunAvailability();
}));
let progress = normalizeProgress(read('kesfet-code-progress-v2', read('kesfet-code-progress', null)));
let view = 'menu', levelIndex = 0, selectedChapter = 0, activeChapter = 0, program = [], state = initialState(LEVELS[0]);
let repeatCount = 1, activeIteration = 0;
let puzzleWorkspace = createPuzzleWorkspace(), disposePuzzle = () => {};
let running = false, runId = 0, activeBlock = -1, stepCursor = 0, hintOpen = false, assisted = false, feedback = 'ready';
let dialogReturnFocus = null;
let disposeVictory = () => {};
function clearVictory() { disposeVictory(); disposeVictory = () => {}; }
let menuPage = 'home', mapWorld = 0;
const text = (en, tr) => lang === 'en' ? en : tr;
const localized = pair => pair?.[lang === 'en' ? 0 : 1] ?? '';
// Story: milestone cutscenes wait for the success dialog to close; smaller
// story beats are spoken by KAŞİF when the next mission opens.
let pendingStory = null, pendingLine = null, storyPlaying = false;
const companion = new CompanionVoice({ enabled: () => sound });
// Shows what to tap next on the menus, the map and the success dialog.
const coach = new Coach();
let mapTraveling = false, disposeTravel = () => {};
// Route preview on every Explorer mission: one pointy arrow per step, numbered,
// one colour per run in the same direction (Right ×3 is one colour, then Down ×4
// another), and a red ✖ where KAŞİF would bump.
const BLOCK_COLOURS = ['#ff8a1f', '#16b4cc', '#8b5cf6', '#ec4f8c', '#2fb35f', '#3b82f6', '#e8a800'];
const STEP = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
function paintFootprints() {
  const board = app.querySelector('.classroom-board');
  board?.querySelectorAll('.footstep').forEach(mark => mark.remove());
  // Only where a new idea is introduced: the first mission.
  if (!board || !firstMission() || running || state.won || !program.length) return;
  let actions;
  try { actions = expandProgram(level(), program, 1); } catch { return; }
  const tileAt = (row, col) => board.querySelector(`.classroom-tile[data-cell="${row},${col}"]`);
  let sim = initialState(level()), n = 0, run = -1, lastType = null;
  for (const action of actions) {
    const before = sim;
    sim = step(level(), sim, action.type);
    if (action.type !== lastType) { run += 1; lastType = action.type; }
    const colour = BLOCK_COLOURS[run % BLOCK_COLOURS.length];
    if (sim.error) {
      const delta = STEP[action.type];
      const bump = delta && tileAt(before.row + delta[0], before.col + delta[1]);
      if (bump) { const mark = document.createElement('span'); mark.className = 'footstep is-bump'; mark.textContent = '✖'; mark.style.animationDelay = `${(n + 1) * 70}ms`; bump.append(mark); }
      break;
    }
    if (sim.row === before.row && sim.col === before.col) continue;
    // The crystal stays visible: no arrow is drawn on the goal tile.
    const tile = sim.won ? null : tileAt(sim.row, sim.col);
    if (tile) {
      const mark = document.createElement('span');
      mark.className = 'footstep'; mark.dataset.dir = action.type;
      mark.style.setProperty('--step-colour', colour); mark.style.animationDelay = `${++n * 70}ms`;
      mark.innerHTML = `<b>${n}</b>`;
      tile.append(mark);
    }
    if (sim.won) break;
  }
}
function updateCoach() {
  const dialog = document.querySelector('dialog[open]');
  if (storyPlaying || mapTraveling || document.querySelector('.story-stage')) { coach.hide(); return; }
  if (dialog) {
    // After the very first mission, send the child to the map to watch KAŞİF walk on.
    const home = dialog.querySelector('.success-home');
    if (home && activeChapter === 0 && levelIndex === 0) return coach.show(home, text('Tap to see your map!', 'Haritanı görmek için dokun!'), 'home-after-first', { placement: 'below' });
    const next = dialog.querySelector('.success-next');
    if (next) coach.show(next, next.dataset.dialog === 'menu' ? text('Back to the map', 'Haritaya dön') : text('Tap to continue', 'Devam etmek için dokun'), 'continue', { placement: 'below' });
    else coach.hide();
    return;
  }
  if (view !== 'menu') { coach.hide(); return; }
  const fresh = completedCount(0) === 0;
  if (menuPage === 'home' && fresh) return coach.show(app.querySelector('.start-adventure'), text('Tap PLAY!', 'OYUNA BAŞLA’ya dokun!'), 'home');
  if (menuPage === 'chapters' && fresh) return coach.show(app.querySelector('[data-action="choose-path"][data-path="0"]'), text('Start here!', 'Buradan başla!'), 'chapters');
  if (menuPage === 'map' && selectedChapter === 0 && completedCount(0) < chapterMissionCount(0)) {
    const next = resumeLevel(0);
    return coach.show(app.querySelector(`.mission-node[data-level="${next}"]`), text(`Tap mission ${next + 1}`, `${next + 1}. göreve dokun`), `map-${next}`);
  }
  coach.hide();
}
const completedCount = chapter => progress.stars.slice(0, chapterMissionCount(chapter)).filter(stars => stars > 0).length;
const pick = list => list[Math.floor(Math.random() * list.length)];
const spoken = id => { const line = LINES[id]; return line && { text: lang === 'tr' ? line.tr : line.en, src: voicePath(id, lang), mood: line.mood, act: line.act }; };
const react = kind => { if (view === 'game' && activeChapter === 0) companion.react(spoken(pick(REACTIONS[kind])), { urgent: kind === 'bump' }); };
function speakMissionOpening() {
  if (view !== 'game' || activeChapter !== 0) return;
  const entries = [];
  if (pendingLine) {
    const id = storyScene(pendingLine)?.steps.find(step => step.line)?.line;
    if (id) entries.push(spoken(id));
    markSeen(pendingLine); pendingLine = null;
  }
  const tip = missionTip(level(), activeChapter, lang);
  entries.push({ text: tip, src: tipVoicePath(tip, lang), mood: 'happy' });
  companion.say(entries);
}
async function playStory(id) {
  const scene = storyScene(id);
  if (!scene || storyPlaying) return;
  companion.stop();
  storyPlaying = true;
  coach.hide();
  try { await playScene(scene, { lang, voice: sound, reducedMotion: reducedRobotMotion }); markSeen(id); }
  finally { storyPlaying = false; updateCoach(); }
}
function afterStory(next) {
  const id = pendingStory;
  pendingStory = null;
  if (!id) { next(); return; }
  closeDialog();
  playStory(id).then(next);
}
const level = () => chapterMission(LEVELS[levelIndex], activeChapter);
const firstMission = () => isFirstMission(activeChapter, level().id);
const openingMission = () => isOpeningMission(activeChapter, level().id);
const classroom = new Classroom2D();
const twoDimensional = () => view === 'game' && activeChapter === 0;
const activeBoard = () => twoDimensional() ? classroom : factory;
// Mission 1's direction comes from its route (Code.org puzzle 2 goes right).
const firstDirection = () => level().solution.find(action => ['up', 'right', 'down', 'left'].includes(action.type))?.type || 'up';
const editorActions = () => firstMission() ? [firstDirection()] : openingMission() ? ['up', 'down', 'left', 'right'] : availableActions(level(), state);
const currentGuideStep = () => guideStep({ chapter: activeChapter, missionId: level().id, blockCount: programBlockCount(program), running, won: state.won, dismissed: guideDismissed, target: missionBlockTarget(level()) });
const labels = { up: ['Forward', 'İleri'], right: ['Robot’s right', 'Robotun sağı'], down: ['Backward', 'Geri'], left: ['Robot’s left', 'Robotun solu'], forward: ['Forward', 'İleri'], turnRight: ['Turn right', 'Sağa dön'], turnLeft: ['Turn left', 'Sola dön'], collect: ['Collect crystal', 'Kristali topla'], press: ['Press button', 'Düğmeye bas'], launch: ['Launch', 'Fırlat'] };
const disabled = () => running ? 'disabled' : '';
const compassLabels = { up: ['Up', 'Yukarı'], down: ['Down', 'Aşağı'], left: ['Left', 'Sol'], right: ['Right', 'Sağ'] };
const actionLabel = action => localized((activeChapter === 0 ? compassLabels[action] : null) || labels[action] || [action, action]);
const resumeLevel = (chapter = activeChapter) => {
  const count = chapterMissionCount(chapter);
  const next = progress.stars.slice(0, count).findIndex(stars => !stars);
  return next < 0 ? count - 1 : next;
};
const announce = message => { const live = document.querySelector('#live-status'); if (live) live.textContent = message; };
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function soundIcon() { return `<span class="sound-note ${sound?'':'is-muted'}" aria-hidden="true">♫</span>`; }
function header() { return `<header class="site-header"><a class="brand" href="#" data-action="menu"><img src="/assets/kesfet-lab.webp" alt="Keşfet Lab"><span><strong>Keşfet <span>Code</span></strong><small>Made by Keşfet Lab</small></span></a><nav aria-label="${text('Main navigation', 'Ana menü')}"><button class="nav-link ${view === 'menu' ? 'active' : ''}" data-action="menu">${icon('grid')}${text('Mission control', 'Görev merkezi')}</button><button class="nav-link" data-action="help">${icon('help')}${text('How to play', 'Nasıl oynanır')}</button></nav><div class="header-tools"><button class="icon-button" data-action="sound" aria-label="${text(sound ? 'Turn sound off' : 'Turn sound on', sound ? 'Sesi kapat' : 'Sesi aç')}" aria-pressed="${sound}">${soundIcon()}</button><div class="language-switch" aria-label="${text('Language', 'Dil')}"><button data-lang="en" class="${lang === 'en' ? 'selected' : ''}" aria-pressed="${lang === 'en'}">EN</button><button data-lang="tr" class="${lang === 'tr' ? 'selected' : ''}" aria-pressed="${lang === 'tr'}">TR</button></div></div></header>`; }
function footer() { return `<footer><span>${icon('code')} ${text('Experiment. Discover. Create.', 'Dene. Keşfet. Üret.')}</span><span>Made by <b>Keşfet Lab</b></span></footer>`; }
function sceneHTML(menu = false) { if (twoDimensional()) return `<div class="scene-host game-scene classroom-scene" role="group" aria-label="${text('2D adventure puzzle', '2D macera bulmacası')}"></div>`; return `<div class="scene-host ${menu ? 'lobby-scene' : 'game-scene'}" role="group" aria-label="${text(menu ? 'Your 3D robot in the factory' : '3D factory puzzle', menu ? 'Fabrikadaki 3D robotun' : '3D fabrika bulmacası')}"><div class="scene-loading" role="status"><span>${text('Getting your robot ready…', 'Robotun hazırlanıyor…')}</span><button class="secondary" data-action="retry-3d" hidden>${text('Try again', 'Yeniden dene')}</button></div></div>`; }
function cameraTools() { if (twoDimensional()) return ''; return `<div class="camera-tools" role="group" aria-label="${text('Camera controls', 'Kamera kontrolleri')}"><button class="icon-button" data-action="camera" aria-label="${text('Reset camera', 'Kamerayı sıfırla')}" title="${text('Reset camera', 'Kamerayı sıfırla')}">${icon('box')}</button><button class="icon-button" data-action="top-view" aria-label="${text('View from above', 'Üstten görünüm')}" title="${text('View from above', 'Üstten görünüm')}">${icon('grid')}</button><span></span><button class="icon-button zoom-control" data-action="zoom-in" aria-label="${text('Zoom in', 'Yakınlaştır')}">+</button><button class="icon-button zoom-control" data-action="zoom-out" aria-label="${text('Zoom out', 'Uzaklaştır')}">−</button></div>`; }

function renderMenu() {
  return adventureMenu({ page: menuPage, chapter: selectedChapter, world: mapWorld, lang, progress, sound, theme, unlockAll: DEBUG_UNLOCK_ALL, motion: !reducedRobotMotion });
}
// The whole story as one video. Until the video file exists, the screen shows
// a placeholder with a play button and the story told in a few sentences.
const STORY_VIDEO = '/assets/story/story.mp4';
function showStory() {
  companion.stop();
  const story = text(
    'KAŞİF is a little robot built at KEŞFET LAB, and he dreams of flying all the way to Mars! But the rocket has no power. On the way across forests, rivers and crystal caves, there are 15 energy crystals to find: one in every mission. Teach KAŞİF to code, collect all 15 crystals, fill up the rocket and blast off to Mars!',
    'KAŞİF, KEŞFET LAB’da yapılmış küçük bir robot ve Mars’a uçmayı hayal ediyor! Ama roketin hiç enerjisi yok. Ormanlardan, nehirlerden ve kristal mağaralardan geçen yolda bulunacak 15 enerji kristali var: her görevde bir tane. KAŞİF’e kodlamayı öğret, 15 kristalin hepsini topla, roketi doldur ve Mars’a uç!'
  );
  showDialog(`<button class="dialog-close icon-button" data-dialog="close" aria-label="${text('Close', 'Kapat')}">${icon('close')}</button><h2>${text('KAŞİF’s story', 'KAŞİF’in hikâyesi')}</h2><div class="story-video" data-story-video><video playsinline preload="none" src="${STORY_VIDEO}" hidden></video><div class="story-video-poster"><span class="story-video-goal"><b>15</b> ${text('crystals', 'kristal')} → ${text('Mars', 'Mars')}</span><button type="button" class="story-video-play" data-dialog="play-story-video" aria-label="${text('Play the story', 'Hikâyeyi oynat')}"><span aria-hidden="true">▶</span></button><p class="story-video-soon" hidden>${text('The story video is coming soon!', 'Hikâye videosu çok yakında!')}</p></div></div><p class="story-video-text">${story}</p>`);
  const dialog = document.querySelector('dialog[open]');
  dialog?.classList.add('story-dialog');
}
function playStoryVideo() {
  const box = document.querySelector('[data-story-video]');
  const video = box?.querySelector('video');
  if (!video) return;
  const soon = () => { box.querySelector('.story-video-soon').hidden = false; video.hidden = true; box.querySelector('.story-video-poster').hidden = false; };
  video.addEventListener('error', soon, { once: true });
  video.hidden = false; video.controls = true;
  box.querySelector('.story-video-poster').hidden = true;
  video.play().catch(soon);
}
function showResetProgress() {
  showDialog(`<h2>${text('Start a new adventure?', 'Yeni bir maceraya başla?')}</h2><p>${text('This clears your saved stars and mission results on this browser. You can still choose any chapter.', 'Bu tarayıcıdaki kayıtlı yıldızların ve görev sonuçların silinir. Yine her seviyeyi seçebilirsin.')}</p><button class="primary dialog-primary" data-dialog="reset-progress">${text('Reset my progress', 'İlerlememi sıfırla')}</button><button class="text-button" data-dialog="close">${text('Keep my adventure', 'Maceramı koru')}</button>`);
}
function toolbox() {
  return `<section class="puzzle-toolbox" data-puzzle-trash aria-labelledby="palette-title" aria-description="${text('Drop blocks here to delete them', 'Blokları silmek için buraya bırak')}."><h2 id="palette-title">${text('BLOCKS', 'BLOKLAR')}</h2><div class="block-palette">${editorActions().map(type => `<button class="code-block palette-block puzzle-palette-card ${type}" draggable="${!running}" data-add="${type}" ${disabled()} aria-label="${esc(text('Add', 'Ekle:') + ' ' + actionLabel(type))}">${icon(type)}<span>${actionLabel(type)}</span></button>`).join('')}</div><div class="puzzle-trash-overlay" aria-hidden="true"><svg class="trash-can" viewBox="0 0 64 76"><g class="trash-lid"><rect x="6" y="12" width="52" height="9" rx="4.5"/><rect x="23" y="5" width="18" height="9" rx="4"/></g><path class="trash-body" d="M11 25h42l-4.2 42.5a6 6 0 0 1-6 5.5H21.2a6 6 0 0 1-6-5.5Z"/><path class="trash-ribs" d="M25 34v30M32 34v30M39 34v30"/></svg><span>${text('Drop to delete', 'Silmek için bırak')}</span></div></section>`;
}
function programBudgetMarkup() {
  const placed = programBlockCount(program), target = missionBlockTarget(level());
  const guidance = text(
    `Target for 3 stars: ${target} coding block${target === 1 ? '' : 's'}. 1–4 extra blocks: 2 stars. 5 or more extra: 1 star.`,
    `3 yıldız hedefi: ${target} kod bloğu. 1–4 fazla blok: 2 yıldız. 5 veya daha fazla: 1 yıldız.`
  );
  const label = text(`${placed} connected blocks; target ${target} for 3 stars.`, `${placed} bağlı blok; 3 yıldız için hedef ${target}.`);
  return `<span class="program-budget${placed > target ? ' is-over-target' : ''}" role="status" aria-live="polite" aria-atomic="true" title="${esc(guidance)}" aria-label="${esc(label)}">${placed} / ${target} ${text(target === 1 ? 'block' : 'blocks', 'blok')}</span>`;
}
const targetRouteLabel = () => missionTargetProgram(level()).map(block => `${actionLabel(block.type)}${isDirectionBlock(block.type) && directionBlockCount(block) > 1 ? ` × ${directionBlockCount(block)}` : ''}`).join(' → ');
function syncPuzzle(next) { puzzleWorkspace = next; program = next.connected; }
function resetPuzzle(blocks = []) { syncPuzzle(createPuzzleWorkspace(blocks)); }
function puzzleKey(stackId, index) { return stackId === CONNECTED_STACK ? String(index) : `${stackId}/${index}`; }
function puzzleBlockAtKey(key) {
  const parts = key.split('/');
  return parts.length === 1 ? program[Number(parts[0])] : puzzleStackBlocks(puzzleWorkspace, parts[0])?.[Number(parts[1])];
}
function directionCountControls(block, key) {
  const count = directionBlockCount(block), label = actionLabel(block.type);
  return `<div class="direction-count" role="group" aria-label="${esc(text(`${label} repetitions`, `${label} tekrar sayısı`))}"><button data-direction-count="${key}:-1" aria-label="${esc(text(`Decrease ${label} count, block ${key}`, `${label} sayısını azalt, blok ${key}`))}" ${running || count <= 1 ? 'disabled' : ''}>−</button><output aria-label="${esc(text('Repetitions', 'Tekrar sayısı'))}">${count}</output><button data-direction-count="${key}:1" aria-label="${esc(text(`Increase ${label} count, block ${key}`, `${label} sayısını artır, blok ${key}`))}" ${running || count >= MAX_DIRECTION_COUNT ? 'disabled' : ''}>+</button></div>`;
}
function renderPuzzleCards(blocks, stackId = CONNECTED_STACK, firstIndex = 0) {
  return blocks.map((block, offset) => {
    const index = firstIndex + offset, key = puzzleKey(stackId, index);
    const counted = isDirectionBlock(block.type) && directionCountsAvailable(level());
    const count = counted ? directionBlockCount(block) : 1;
    return `<div class="puzzle-card program-item ${block.type}${counted ? ' has-direction-count' : ''}" data-puzzle-stack="${stackId}" data-puzzle-index="${index}" data-key="${key}" draggable="${!running}" role="listitem" aria-label="${esc(actionLabel(block.type))}"><span class="block-number">${index + 1}</span><span class="puzzle-command">${icon(block.type)}<span class="command-text">${esc(actionLabel(block.type))}${counted ? `<small>${count} ${text(count === 1 ? 'time' : 'times', 'kez')}</small>` : ''}</span></span>${counted ? directionCountControls(block, key) : ''}<button class="block-delete" data-remove="${key}" aria-label="${text('Remove block', 'Bloğu sil')} ${key}" ${disabled()}>×</button></div>`;
  }).join('');
}
function workspace() {
  const stacks = puzzleStacks(puzzleWorkspace), { x, y, height, width, startHeight } = PUZZLE_GEOMETRY;
  const planeHeight = Math.max(360, ...stacks.map(stack => stack.y + (stack.blocks.length + 1) * height));
  const planeWidth = Math.max(340, ...stacks.map(stack => stack.x + width + 30));
  return `<section class="puzzle-editor" aria-labelledby="program-title"><div class="puzzle-heading"><h2 id="program-title">${text('PROGRAM', 'PROGRAM')}</h2>${programBudgetMarkup()}</div>${guideMarkup(currentGuideStep(), lang, firstDirection())}<div class="puzzle-body">${toolbox()}<div class="puzzle-canvas program-scroll" id="program-area" data-mission="${activeChapter}:${level().id}" role="region" aria-label="${text('Puzzle programming workspace. Connect blocks below Start to run them.', 'Bulmaca kodlama alanı. Çalıştırmak için blokları Başla altına bağla.')}" tabindex="0"><div class="puzzle-plane" style="min-width:${planeWidth}px;min-height:max(100%,${planeHeight}px)"><button class="puzzle-start start-block" style="left:${x}px;top:${y}px" data-connector="start" data-action="${running ? 'stop' : 'run'}" aria-label="${text(running ? 'Stop program' : 'Start program', running ? 'Programı durdur' : 'Programı başlat')}">${icon(running ? 'pause' : 'play')}<span>${text(running ? 'Stop' : 'Start', running ? 'Durdur' : 'Başla')}</span><span class="puzzle-fixed" aria-hidden="true">⌖</span></button>${stacks.map(stack => `<div class="puzzle-stack ${stack.id === CONNECTED_STACK ? 'puzzle-connected' : 'puzzle-detached'}" data-stack-id="${stack.id}" style="left:${stack.x}px;top:${stack.y}px" role="list" aria-label="${text(stack.id === CONNECTED_STACK ? 'Connected program' : 'Detached blocks, not run', stack.id === CONNECTED_STACK ? 'Bağlı program' : 'Ayrı bloklar, çalıştırılmaz')}">${stack.id !== CONNECTED_STACK ? `<button class="puzzle-connect" data-connect="${stack.id}" aria-label="${text('Connect this stack below Start', 'Bu grubu Başla altına bağla')}" title="${text('Connect to program', 'Programa bağla')}" ${disabled()}>↗</button>` : ''}${renderPuzzleCards(stack.blocks, stack.id)}</div>`).join('')}${!program.length ? `<div class="first-block-slot puzzle-empty-slot" style="left:${x}px;top:${y + startHeight}px" aria-hidden="true">${text('Snap a block here', 'Bir bloğu buraya bağla')}</div>` : ''}<span class="puzzle-canvas-note">${text('Only blocks joined to Start will run.', 'Yalnızca Başla’ya bağlı bloklar çalışır.')}</span></div></div></div></section>`;
}
function objectiveHud() { const crystals = state.crystals?.length || 0; const required = level().crystals?.length ?? level().grid.flatMap(row => [...row]).filter(tile => tile === 'C').length; const fragments = state.items?.length || 0; return `<div class="mission-hud">${required ? `<span class="hud-chip">💎 ${crystals} / ${required}</span>` : ''}${level().world >= 5 ? `<span class="hud-chip">🔑 ${(state.keys || []).length}</span>` : ''}${level().world >= 6 ? `<span class="hud-chip">🛰️ ${fragments}</span>` : ''}</div>`; }
function boardHTML() { return `<div class="scene-wrap">${sceneHTML()}<div class="scene-topline">${objectiveHud()}</div><div class="scene-bottomline"><span>${text('Drag to look around', 'Etrafa bakmak için sürükle')}</span>${cameraTools()}</div></div>`; }
const feedbackText = () => ({ ready: text('Ready, explorer? Build a route for KAŞİF.', 'Hazır mısın kâşif? KAŞİF için bir rota oluştur.'), running: text('KAŞİF is following your algorithm…', 'KAŞİF algoritmanı uyguluyor…'), move: text('Driving to the next square…', 'Sonraki kareye sürüyor…'), press: text('Button pressed! KAŞİF is celebrating.', 'Düğmeye basıldı! KAŞİF kutluyor.'), button: text('Button pressed! KAŞİF is celebrating.', 'Düğmeye basıldı! KAŞİF kutluyor.'), turn: text('KAŞİF is turning to face the route.', 'KAŞİF rotaya doğru dönüyor.'), stopped: text('Paused — press the yellow Start block to start again.', 'Durduruldu — yeniden başlamak için sarı Başla bloğuna bas.'), wall: text('An obstacle! KAŞİF tips back, then gets up. Try another direction.', 'Bir engel var! KAŞİF devrilip kalkıyor. Başka bir yön dene.'), energy: text('Out of energy! KAŞİF is asleep. Reach the battery to recharge.', 'Enerji bitti! KAŞİF uykuya daldı. Şarj olmak için pile ulaş.'), collect: text('There is no crystal here. Drive onto a crystal, then collect it.', 'Burada kristal yok. Kristalin üzerine sür, sonra kristali topla.'), door: text('The door is locked. Find its key first.', 'Kapı kilitli. Önce anahtarını bul.'), items: text('This door needs another key or item.', 'Bu kapı başka bir anahtar veya eşya istiyor.'), sequence: text('Follow the mission order to continue.', 'Devam etmek için görev sırasını izle.'), crystal: text('Crystal collected! KAŞİF is glowing with joy.', 'Kristal toplandı! KAŞİF sevinçle parlıyor.'), battery: text('Recharge complete — keep driving!', 'Şarj tamamlandı — sürmeye devam!'), key: text('Key collected. A matching door can open now.', 'Anahtar toplandı. Eşleşen kapı artık açılabilir.'), component: text('Rocket component secured!', 'Roket parçası alındı!'), fragment: text('Launch-code fragment collected.', 'Fırlatma kodu parçası toplandı.'), goal: text('Destination reached. KAŞİF is checking the final objectives.', 'Hedefe ulaşıldı. KAŞİF son hedefleri kontrol ediyor.'), launchReady: text('KEŞFET-1 is ready. Add LAUNCH to finish.', 'KEŞFET-1 hazır. Bitirmek için FIRLAT ekle.'), launch: text('Liftoff! KAŞİF is launching KEŞFET-1.', 'Fırlatma! KAŞİF KEŞFET-1’i uzaya gönderiyor.'), incomplete: text('Almost there — follow the mission objectives.', 'Az kaldı — görev hedeflerini takip et.'), success: text('Mission complete — KAŞİF is proud of you!', 'Görev tamamlandı — KAŞİF seninle gurur duyuyor!'), demo: text('Watch the example, then try your own route.', 'Örneği izle, sonra kendi rotanı dene.'), limit: text('Your program is full — remove a command to add another.', 'Programın dolu — yeni komut için birini sil.'), invalid: text('Try changing that command and run again.', 'Bu komutu değiştirip yeniden çalıştır.') }[feedback] || feedback);
function missionObjective(mission) {
  if (openingMission()) return localized(mission.objective);
  if (mission.id === 1) return text('Move Forward once to reach the charging pad.', 'Şarj alanına ulaşmak için bir kez İleri git.');
  const tiles=mission.grid.join('');
  return [text('Guide KAŞİF to the exit.', 'KAŞİF’i çıkışa götür.'),
    tiles.includes('C') ? text('Stand on each crystal and use Collect crystal.', 'Her kristalin üzerinde dur ve Kristali topla kullan.') : '',
    tiles.includes('B') ? text('Recharge at a battery along the way.', 'Yolda bir pille enerjini doldur.') : '',
    tiles.includes('K') ? text('Store the matching keys before opening doors.', 'Kapıları açmadan önce uygun anahtarları sakla.') : '',
    mission.world === 6 ? (mission.id === 30 ? text('Follow the crystal, key, door, and battery sequence, then launch at the rocket.', 'Kristal, anahtar, kapı ve pil sırasını takip et, sonra roketten fırlat.') : text('Collect the required rocket parts and code fragments before reaching the exit.', 'Çıkışa ulaşmadan önce gerekli roket parçalarını ve kod parçalarını topla.')) : ''
  ].filter(Boolean).join(' ');
}

function renderGame() {
  const mission = level();
  return `<main class="play-page puzzle-mode play-chapter-${activeChapter} play-world-${mission.world}${twoDimensional() ? ' two-d-mission' : ''}${firstMission() ? ' first-mission' : ''}${openingMission() ? ' opening-mission' : ''}"><header class="play-header"><div class="play-brand">${brandMarkup()}</div>${missionRoadMarkup({ currentMission: mission.id, stars: progress.stars, lang, total: chapterMissionCount(activeChapter), chapter: activeChapter })}<div class="play-tools"><button class="level-home" data-action="menu" aria-label="${text('Home: mission board', 'Ana sayfa: görev haritası')}" title="${text('Back to mission board', 'Görev haritasına dön')}">${icon('home')}<span>${text('Home', 'Ana sayfa')}</span></button><button data-action="${firstMission() ? 'guide' : 'hint'}" aria-expanded="${firstMission() ? !!currentGuideStep() : hintOpen}">${icon('help')}<span>${text('Hint', 'İpucu')}</span></button><button data-action="sound" aria-label="${text(sound ? 'Turn sound off' : 'Turn sound on', sound ? 'Sesi kapat' : 'Sesi aç')}" aria-pressed="${sound}">${soundIcon()}</button><button data-lang="${lang === 'en' ? 'tr' : 'en'}" aria-label="${text('Switch to Turkish', 'İngilizceye geç')}">${lang === 'en' ? 'TR' : 'EN'}</button></div></header><div class="play-layout">${workspace()}<section class="play-stage" aria-label="${text('Adventure board', 'Macera tahtası')}">${boardHTML()}<p id="robot-feedback" class="mission-feedback puzzle-feedback" role="status" hidden></p></section>${missionCompanionMarkup(mission, activeChapter, lang)}</div>${hintOpen ? `<aside class="puzzle-hint"><button class="puzzle-hint-close" data-action="hint" aria-label="${text('Close hint', 'İpucunu kapat')}">×</button><h2>${text('A route to try', 'Deneyebileceğin bir rota')}</h2><p>${esc(targetRouteLabel())}</p><button class="secondary" data-action="demo" ${disabled()}>${icon('play')}${text('Show me', 'Bana göster')}</button></aside>` : ''}</main>`;
}
function render({ preserveCanvas = true } = {}) {
  const oldCanvas = app.querySelector('.puzzle-canvas');
  const canvasScroll = preserveCanvas && view === 'game' && oldCanvas?.dataset.mission === `${activeChapter}:${level().id}`
    ? { top: oldCanvas.scrollTop, left: oldCanvas.scrollLeft } : null;
  music.setTheme(view === 'game' ? ['forest','mars','ice'][activeChapter] : menuPage === 'map' ? ['forest','mars','ice'][selectedChapter] : 'menu');
  disposeGuide(); disposeIllustrations(); disposePuzzle(); disposeRoad();
  activeBoard().setReducedMotion(reducedRobotMotion);
  if (!twoDimensional()) classroom.detach();
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.sceneryMotion = reducedRobotMotion ? 'off' : 'on';
  document.documentElement.dataset.view = view;
  factory.renderer?.domElement.remove();
  app.innerHTML = view === 'menu' ? renderMenu() : renderGame();
  const sceneHost = document.querySelector('.scene-host');
  if (sceneHost) activeBoard().attach(sceneHost, { mode: view, level: level(), state, theme, lang });
  if (view === 'game') updateBoard();
  disposeIllustrations = mountIllustrations(app);
  disposeRoad = mountMissionRoad(app);
  updateRunAvailability();
  if (canvasScroll) app.querySelector('.puzzle-canvas')?.scrollTo(canvasScroll);
  disposeGuide = mountFirstMissionGuide(app, firstDirection());
  disposeTravel(); disposeTravel = () => {}; mapTraveling = false;
  if (view === 'menu' && menuPage === 'map' && selectedChapter === 0) {
    // KAŞİF walks to the next mission, greening finished ones; the tap hint waits for him.
    mapTraveling = true;
    disposeTravel = mountMapTravel(app, { chapter: 0, target: resumeLevel(0), reducedMotion: reducedRobotMotion, onDone: () => { mapTraveling = false; updateCoach(); } });
  }
  queueMicrotask(updateCoach);
  queueMicrotask(paintFootprints);
  disposePuzzle = mountPuzzleInteractions(app, {
    getWorkspace: () => puzzleWorkspace,
    enabled: () => !running,
    renderGhost: source => renderPuzzleCards(source.kind === 'palette' ? [{ type: source.type }] : puzzleStackBlocks(puzzleWorkspace, source.stackId).slice(source.index), source.stackId || CONNECTED_STACK, source.index || 0),
    onDrop: (source, destination) => {
      const next = movePuzzleStack(puzzleWorkspace, source, destination, { maxBlocks: MAX_BLOCKS, allowedTypes: editorActions() });
      if (next !== puzzleWorkspace) { syncPuzzle(next); editProgram(); }
    }
  });
}
function updateRunAvailability() {
  const ready = activeBoard().status === 'ready';
  document.querySelectorAll('[data-action="run"]').forEach(button => { button.disabled = !ready || !program.length; });
  document.querySelectorAll('[data-action="demo"], [data-action="menu-demo"]').forEach(button => { button.disabled = !ready || running; });
}
function updateBoard(animate = false, direction) {
  const repeatStatus = document.querySelector('#repeat-status');
  if (repeatStatus && running) repeatStatus.textContent = `${activeIteration} / ${repeatCount}`;
  const board = document.querySelector('.game-scene');
  if (!board) return;
  activeBoard().setState(state, animate, direction);
  const scene = text(twoDimensional() ? '2D adventure board' : '3D factory', twoDimensional() ? '2D macera tahtası' : '3D fabrika');
  board.setAttribute('aria-label', text(`${scene}. KAŞİF at row ${state.row + 1}, column ${state.col + 1}; energy ${state.energy ?? 'unlimited'}`, `${scene}. KAŞİF ${state.row + 1}. satır, ${state.col + 1}. sütunda; enerji ${state.energy ?? 'sınırsız'}`));
  document.querySelectorAll('.program-item').forEach(el => el.classList.toggle('executing', el.dataset.puzzleStack === CONNECTED_STACK && el.dataset.key === String(activeBlock)));
  const message = document.querySelector('#robot-feedback');
  if (message) { message.hidden = !state.error && !['incomplete','invalid','limit','launchReady'].includes(feedback); message.textContent = message.hidden ? '' : feedbackText(); }
  const hud = document.querySelector('.scene-topline');
  if (hud && view === 'game') hud.querySelector('.mission-hud')?.replaceWith(document.createRange().createContextualFragment(objectiveHud()));
}
function cancelRun() { clearVictory(); runId++; running = false; demoPending = false; activeBlock = -1; stepCursor = 0; audio.cancel(); activeBoard().cancelAnimation?.(state); }
function openLevel(index, chapter = activeChapter) { if (!Number.isInteger(index) || index < 0 || index >= chapterMissionCount(chapter) || !canOpenLevel(index)) return; cancelRun(); closeDialog(); view = 'game'; levelIndex = index; activeChapter = chapter; guideDismissed = false; resetPuzzle(); repeatCount = 1; state = initialState(level()); hintOpen = false; assisted = false; feedback = 'ready'; render({ preserveCanvas: false }); window.scrollTo({ top: 0, behavior: 'instant' }); setTimeout(speakMissionOpening, 500); }
function openAdventureMap(chapter = activeChapter, world = Math.floor(levelIndex / 5)) {
  companion.stop(); cancelRun(); closeDialog(); selectedChapter = activeChapter = chapter; mapWorld = world;
  menuPage = 'map'; view = 'menu'; render();
  const firstMission = document.querySelector('[data-level="0"]');
  // Wait for the new layout, then show the beginning of the road. On small
  // screens the information below the map must not scroll mission 1 out of view.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!firstMission?.isConnected) return;
    const firstTop = firstMission.getBoundingClientRect().top + window.scrollY;
    const bottom = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.max(0, Math.min(bottom, firstTop - window.innerHeight * .55)), behavior: 'instant' });
  }));
}
function openMenu() { openAdventureMap(); }
function openHome() { companion.stop(); cancelRun(); closeDialog(); view = 'menu'; menuPage = 'home'; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function resetRobot({ preserveProgram = false } = {}) {
  cancelRun();
  if (openingMission() && !preserveProgram) {
    resetPuzzle(); repeatCount = 1; hintOpen = false; guideDismissed = false;
  }
  state = initialState(level()); feedback = 'ready'; render({ preserveCanvas: preserveProgram || !openingMission() }); audio.play('reset');
}
function editProgram(resetScroll = false) {
  const scrollTop = document.querySelector('#program-area')?.scrollTop ?? 0;
  const scrollLeft = document.querySelector('#program-area')?.scrollLeft ?? 0;
  assisted = false; state = initialState(level()); feedback = 'ready'; activeBlock = -1; stepCursor = 0;
  activeBoard().cancelAnimation?.(state); render({ preserveCanvas: !resetScroll });
  document.querySelector('#program-area')?.scrollTo(resetScroll ? { top: 0, left: 0 } : { top: scrollTop, left: scrollLeft });
  audio.play('block');
}
function addBlock(type) {
  if (running || !editorActions().includes(type)) return;
  if (puzzleBlockCount(puzzleWorkspace) >= MAX_BLOCKS) { feedback = 'limit'; updateBoard(); return; }
  syncPuzzle(movePuzzleStack(puzzleWorkspace, { kind: 'palette', type }, { kind: 'connect', stackId: CONNECTED_STACK, index: program.length }, { maxBlocks: MAX_BLOCKS, allowedTypes: editorActions() }));
  editProgram();
  const area = document.querySelector('#program-area');
  const card = area?.querySelector('.puzzle-connected .puzzle-card:last-child');
  if (area && card) area.scrollTop = scrollTopForBlock(card.getBoundingClientRect(), area.getBoundingClientRect(), area.scrollTop);
}
const PICKUP_EVENTS = new Set(['crystal', 'battery', 'key', 'component', 'fragment']);
// The runner uses one readable branch below; this keeps each event's visual
// timeline accurate without making the command loop difficult to follow.
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function eventCue(event) { return ({ move: 'move', button: 'press', turn: 'move', crystal: 'crystal', battery: 'battery', key: 'key', door: 'unlock', component: 'component', fragment: 'fragment', launch: 'launch', goal: 'success' }[event]); }
function actionDuration(action) {
  if (state.error) return IMPACT_MS;
  if (state.event === 'launch') return LAUNCH_MS;
  const moving = ['up', 'right', 'down', 'left', 'forward'].includes(action);
  if (state.won) return (moving ? MOVE_MS : 0) + WIN_MS;
  if (state.event === 'button') return PRESS_MS;
  if (PICKUP_EVENTS.has(state.event)) return (moving ? MOVE_MS : 0) + PICKUP_MS;
  return moving ? MOVE_MS + 30 : TURN_MS;
}
function playActionSound(action) {
  const moving = ['up', 'right', 'down', 'left', 'forward'].includes(action);
  if (state.error) { audio.play(['wall','door','button','invalid','collect'].includes(state.error) ? 'bump' : 'error'); return; }
  if (moving) audio.play('move');
  const cue = eventCue(state.event);
  if (cue && cue !== 'move') audio.play(cue);
  else if (!moving && state.event === 'turn') audio.play('turn');
}
async function runProgram(demo = false) {
  if (running || !program.length || activeBoard().status !== 'ready') return;
  let instructions;
  try { instructions = expandProgram(level(), program, repeatCount); } catch { feedback = 'invalid'; updateBoard(); return; }
  if (firstMission()) guideDismissed = true;
  const id = ++runId;
  activeIteration = 1; running = true; state = initialState(level()); activeBlock = -1; stepCursor = 0;
  feedback = demo ? 'demo' : 'running'; render(); audio.play('run');
  await delay(300);
  for (const action of instructions) {
    if (id !== runId) return;
    activeBlock = action.key ?? action.index; activeIteration = action.iteration;
    updateBoard();
    const current = document.querySelector('.program-item.executing');
    const shelf = document.querySelector('.program-scroll');
    if (current && shelf) {
      const blockRect = current.getBoundingClientRect(), shelfRect = shelf.getBoundingClientRect();
      const top = scrollTopForBlock(blockRect, shelfRect, shelf.scrollTop);
      if (top !== shelf.scrollTop) shelf.scrollTo({ top, behavior: 'smooth' });
    }
    state = step(level(), state, action.type);
    feedback = state.event === 'ready' ? 'launchReady' : state.event || state.error || feedback;
    updateBoard(true, action.type);
    playActionSound(action.type);
    if (state.event === 'crystal' && !demo) react('crystal');
    await delay(actionDuration(action.type));
    if (id !== runId) return;
    if (state.error || state.won) break;
  }
  running = false; activeBlock = -1;
  if (state.won && !demo) {
    feedback = 'success';
    const score = scoreRun(level(), state, programBlockCount(program));
    const before = completedCount(activeChapter), previousStars = progress.stars[levelIndex] || 0;
    // While every mission is open for testing, a mission played out of order still counts.
    progress = completeLevel(progress, levelIndex, score, state.crystals?.length || 0, { force: DEBUG_UNLOCK_ALL });
    save('kesfet-code-progress-v2', progress);
    const beat = activeChapter === 0 ? pendingBeat({ before, after: completedCount(activeChapter), total: chapterMissionCount(activeChapter), seen: readSeen() }) : null;
    // No cutscenes: the story is one video on the home screen. A mission beat is told in the next mission.
    if (beat?.startsWith('mission-')) pendingLine = beat; else if (beat) markSeen(beat);
    companion.stop();
    render(); showSuccess(score, previousStars);
  } else if (state.won && demo) {
    feedback = 'demo'; render(); announce(text('Demo complete — now try your own route.', 'Demo tamamlandı — şimdi kendi rotanı dene.'));
  } else {
    if (!state.error && state.event !== 'ready') feedback = 'incomplete';
    render(); announce(feedbackText());
    if (!demo && id === runId && (state.error || feedback === 'incomplete')) react(state.error ? 'bump' : 'stuck');
  }
}
function showOpeningMissionHelp() {
  if (running) { cancelRun(); feedback = 'stopped'; render(); }
  const counted = directionCountsAvailable(level());
  const secondHeading = counted ? text('Choose how many steps', 'Adım sayısını seç') : text('Connect one block for each step', 'Her adım için bir blok bağla');
  const secondMessage = counted
    ? text('Arrows match your screen. Use + and − on each direction block to choose how many tiles KAŞİF should move. The robot stays facing you.', 'Oklar ekrana göredir. Her yön bloğundaki + ve − ile KAŞİF’in kaç kare ilerleyeceğini seç. Robot sana bakmaya devam eder.')
    : text('Arrows match your screen. Each block moves KAŞİF one tile. Snap more blocks below one another to build the route.', 'Oklar ekrana göredir. Her blok KAŞİF’i bir kare ilerletir. Rotayı oluşturmak için blokları alt alta birleştir.');
  showDialog(`<button class="dialog-close icon-button" data-dialog="close" aria-label="${text('Close', 'Kapat')}">${icon('close')}</button><span class="eyebrow">KEŞFET LAB</span><h2>${text('Follow the path', 'Yolu takip et')}</h2><div class="help-step"><span class="step-badge">1</span><div><h3>${text('Choose a direction', 'Bir yön seç')}</h3><p>${text('Drag an arrow block below Start and snap it into place, or click it to add it. Only the blocks connected to Start will run.', 'Bir ok bloğunu Başla altına sürükleyip birleştir veya eklemek için bloğa tıkla. Yalnızca Başla’ya bağlı bloklar çalışır.')}</p></div></div><div class="help-step"><span class="step-badge">2</span><div><h3>${secondHeading}</h3><p>${secondMessage} ${esc(missionObjective(level()))}</p></div></div><div class="help-step"><span class="step-badge">3</span><div><h3>${text('Press Start', 'Başla bloğuna bas')}</h3><p>${text('Press the yellow Start block to run your connected program and reach the goal.', 'Bağlı programını çalıştırıp hedefe ulaşmak için sarı Başla bloğuna bas.')}</p></div></div><button class="primary dialog-primary" data-dialog="close">${text('Let’s build', 'Haydi kodlayalım')}${icon('arrow')}</button>`);
}
function showFirstMissionGuide() {
  if (!firstMission() || running) return;
  guideDismissed = false; render();
}
function runDemo() {
  if (firstMission()) { showFirstMissionGuide(); return; }
  if (running) return;
  assisted = true;
  repeatCount = 1; resetPuzzle(missionTargetProgram(level()));
  hintOpen = false;
  if (activeBoard().status === 'ready') runProgram(true);
  else demoPending = true;
}
function closeDialog() { clearVictory(); const dialog = document.querySelector('dialog'); if (dialog) { dialog.close(); dialog.remove(); queueMicrotask(updateCoach); } if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus({ preventScroll: true }); dialogReturnFocus = null; }
function showDialog(content) { closeDialog(); dialogReturnFocus = document.activeElement; const dialog = document.createElement('dialog'); dialog.className = 'game-dialog'; dialog.innerHTML = content; const heading = dialog.querySelector('h2'); if (heading) { heading.id = 'dialog-title'; dialog.setAttribute('aria-labelledby', 'dialog-title'); } document.body.append(dialog); dialog.addEventListener('click', e => { if (e.target === dialog) afterStory(closeDialog); const action = e.target.closest('[data-dialog]')?.dataset.dialog; if (action === 'play-story-video') { playStoryVideo(); return; } if (action === 'reset-progress') { progress = normalizeProgress(null); resetSeen(); resetPositions(); save('kesfet-code-progress-v2', progress); closeDialog(); render(); } const scene = e.target.closest('[data-story-scene]')?.dataset.storyScene; if (scene) { closeDialog(); playStory(scene); return; } if (action === 'close') afterStory(closeDialog); if (action === 'next') afterStory(() => openLevel(levelIndex + 1)); if (action === 'menu') afterStory(openMenu); if (action === 'home') openHome(); if (action === 'again') afterStory(() => { closeDialog(); assisted = false; resetRobot({ preserveProgram: true }); }); }); dialog.addEventListener('cancel', e => { e.preventDefault(); afterStory(closeDialog); }); dialog.showModal(); updateCoach(); }
function showSuccess(score, previous = 0) {
  const final = levelIndex === chapterMissionCount(activeChapter) - 1;
  // Stars already earned on this mission stay marked as collected; only new ones are won again.
  const fresh = Math.max(0, score - previous);
  const starRow = [1, 2, 3].map(n => icon('star', n <= previous ? 'earned is-collected' : n <= score ? 'earned is-new' : '')).join('');
  const starNote = previous && !fresh ? text('You already collected these stars', 'Bu yıldızları zaten topladın')
    : previous ? text(`+${fresh} new star${fresh === 1 ? '' : 's'}!`, `+${fresh} yeni yıldız!`) : '';
  // Totals for the chapter: every finished mission's goal is one energy crystal.
  const missionCount = chapterMissionCount(activeChapter), totalStars = progress.stars.slice(0, missionCount).reduce((sum, n) => sum + n, 0);
  const gem = '<img class="glossy-icon" src="/assets/icons/crystal.svg" alt="">';
  const totals = `<div class="success-totals" aria-label="${text(`${totalStars} of ${missionCount * 3} stars, ${completedCount(activeChapter)} of ${missionCount} crystals`, `${missionCount * 3} yıldızdan ${totalStars}, ${missionCount} kristalden ${completedCount(activeChapter)}`)}"><span class="success-total-stars"><img class="glossy-icon" src="/assets/icons/star.svg" alt="">${totalStars}<small>/${missionCount * 3}</small></span><span class="success-total-crystals">${gem}${completedCount(activeChapter)}<small>/${missionCount}</small></span></div>`;
  showDialog(`${totals}<button class="success-home" data-dialog="menu" aria-label="${text('Back to mission map','Görev haritasına dön')}" title="${text('Back to mission map','Görev haritasına dön')}">${icon('home')}</button><div class="success-art">${final ? icon('rocket') : icon('star', 'glossy-star')}<span>✦</span><span>✧</span></div><div class="success-stars" aria-label="${text(`${Math.max(score, previous)} of 3 stars`, `3 yıldızdan ${Math.max(score, previous)}`)}">${starRow}</div>${starNote ? `<p class="success-star-note${fresh ? ' is-new' : ''}">${starNote}</p>` : ''}<span class="eyebrow">${text('MISSION COMPLETE','GÖREV TAMAMLANDI')}</span><h2>${final && activeChapter !== 0 ? text('KEŞFET-1 is ready for space!','KEŞFET-1 uzaya hazır!') : final ? text('Chapter complete, explorer!','Bölüm tamamlandı, kâşif!') : text('Brilliant work, explorer','Harika iş, kâşif')}</h2><div class="success-controls"><button class="success-replay" data-dialog="again" aria-label="${text('Try again','Yeniden dene')}" title="${text('Try again','Yeniden dene')}">${icon('reset')}</button><button class="success-next" data-dialog="${final?'menu':'next'}" aria-label="${final?text('Back to mission map','Görev haritasına dön'):text('Next mission','Sonraki görev')}" title="${final?text('Back to mission map','Görev haritasına dön'):text('Next mission','Sonraki görev')}">${icon('arrow')}</button></div>`);
  const stopConfetti = mountVictoryCelebration(document.querySelector('dialog[open]'), {
    reducedMotion: reducedRobotMotion
  });
  audio.play('complete');
  disposeVictory = () => { stopConfetti(); audio.cancel(); };
}
// Android app only: versions and the last update result, so a teacher can see why a tablet is behind.
function appendUpdatePanel() {
  const updater = appUpdater(), dialog = document.querySelector('dialog[open]');
  if (!updater || !dialog) return;
  const results = { 'up-to-date': text('Up to date', 'Güncel'), checking: text('Checking…', 'Kontrol ediliyor…'), downloading: text('Downloading…', 'İndiriliyor…'), installing: text('Installing…', 'Yükleniyor…'), 'ready-next-start': text('Installs next time the app opens', 'Uygulama bir sonraki açılışta güncellenecek'), 'needs-new-app': text('Install the new app version', 'Yeni uygulama sürümünü yükle'), offline: text('No internet', 'İnternet yok'), error: text('Update failed', 'Güncelleme başarısız') };
  const paint = status => {
    const when = status.at ? new Date(status.at).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '—';
    panel.innerHTML = `<h3>${text('App & updates', 'Uygulama ve güncellemeler')}</h3><p>${text('App', 'Uygulama')} ${esc(updater.native() || '?')} · ${text('Game', 'Oyun')} ${esc(updater.running)}</p><p>${esc(results[status.result] || '—')}${status.error ? ` — ${esc(status.error)}` : ''} <small>(${esc(when)})</small></p><button type="button" class="secondary update-now">${text('Check for updates', 'Güncellemeleri denetle')}</button>`;
    panel.querySelector('.update-now').addEventListener('click', async event => { event.currentTarget.disabled = true; paint({ ...updater.status(), result: 'checking' }); paint(await updater.check()); });
  };
  const panel = document.createElement('section');
  panel.className = 'app-version-panel';
  dialog.append(panel);
  paint(updater.status());
}
function showHelp() { if (view === 'game' && firstMission()) { showFirstMissionGuide(); return; } if (twoDimensional()) { showOpeningMissionHelp(); return; } if (running) { cancelRun(); feedback = 'stopped'; render(); } showDialog(`<button class="dialog-close icon-button" data-dialog="close" aria-label="${text('Close', 'Kapat')}">${icon('close')}</button><span class="eyebrow">KEṢFET CODE</span><h2>${text('Little blocks, big adventures', 'Küçük bloklar, büyük maceralar')}</h2><div class="help-step"><span class="step-badge">1</span><div><h3>${text('Build a route', 'Bir rota yap')}</h3><p>${text('Choose Forward, Backward, Robot’s right or Robot’s left. Each direction is relative to where KAŞİF is facing, and the robot faces its new travel direction. Older paths also have turns without movement.', 'İleri, Geri, Robotun sağı veya Robotun solu seç. Yönler KAŞİF’in baktığı yöne göredir; robot yeni hareket yönüne döner. Büyük yaş yollarında yerinde dönüş de vardır.')}</p></div></div><div class="help-step"><span class="step-badge">2</span><div><h3>${text('Plan the objective order', 'Hedef sırasını planla')}</h3><p>${text('Stand on a crystal and add Collect crystal. Later missions add batteries, keys, doors, rocket parts, and launch fragments.', 'Kristalin üstüne gel ve Kristali topla bloğunu ekle. Sonraki görevler piller, anahtarlar, kapılar, roket parçaları ve fırlatma parçaları ekler.')}</p></div></div><div class="help-step"><span class="step-badge">3</span><div><h3>${text('Run and learn', 'Çalıştır ve öğren')}</h3><p>${text('Press the yellow Start block to watch KAŞİF follow your arrows. A battery refills energy, a wall causes a safe bump, and the robot celebrates every crystal.', 'KAŞİF’in oklarını takip etmesini görmek için sarı Başla bloğuna bas. Pil enerjiyi doldurur, duvar güvenli bir çarpma gösterir ve robot her kristali kutlar.')}</p></div></div><div class="help-note">${icon('star')}${text('Chapter 2 teaches loops, repetition, and optimization; Chapter 3 adds conditions, sensors, and functions.', 'Seviye 2 döngüleri, tekrarları ve optimizasyonu; Seviye 3 koşulları, sensörleri ve fonksiyonları öğretir.')}</div><button class="primary dialog-primary" data-dialog="close">${text('Let’s build', 'Haydi kodlayalım')}${icon('arrow')}</button>`); appendUpdatePanel(); }

app.addEventListener('click', e => { const chapter = e.target.closest('[data-action="chapter-select"]'); if (chapter && !e.target.closest('button')) { selectedChapter = Number(chapter.dataset.chapter); render(); return; } const target = e.target.closest('button,a'); if (!target || target.disabled) return; if (target.hasAttribute('data-world')) { mapWorld = Number(target.dataset.world); render(); return; } if (target.dataset.action === 'choose-path') { const path = Number(target.dataset.path); openAdventureMap(path, 0); if (path === 0 && !readSeen().has('intro')) playStory('intro'); return; } if (target.hasAttribute('data-lang')) { lang = target.dataset.lang; save('kesfet-code-language', lang); companion.stop(); render(); return; } if (target.hasAttribute('data-level')) { e.preventDefault(); openLevel(Number(target.dataset.level)); return; } if (target.dataset.action === 'chapter1') { selectedChapter = 0; activeChapter = 0; openLevel(resumeLevel(), 0); return; } if (target.dataset.action === 'chapter-start') { const chapter = Number(target.dataset.chapter); selectedChapter = chapter; activeChapter = chapter; openLevel(resumeLevel(chapter), chapter); return; } if (target.hasAttribute('data-add')) { addBlock(target.dataset.add); return; } if (target.hasAttribute('data-connect') && !running) { const next = movePuzzleStack(puzzleWorkspace, { kind: 'stack', stackId: target.dataset.connect, index: 0 }, { kind: 'connect', stackId: CONNECTED_STACK, index: program.length }); if (next !== puzzleWorkspace) { syncPuzzle(next); editProgram(); } return; }
if(target.hasAttribute('data-direction-count') && !running && directionCountsAvailable(level())) {
  const [key, change] = target.dataset.directionCount.split(':'), delta = Number(change);
  const block = puzzleBlockAtKey(key);
  if (!block || !isDirectionBlock(block.type) || ![-1,1].includes(delta)) return;
  const next = Math.max(1, Math.min(MAX_DIRECTION_COUNT, directionBlockCount(block) + delta));
  if (next === directionBlockCount(block)) return;
  block.count = next; editProgram();
  const preferred = document.querySelector(`[data-direction-count="${key}:${delta}"]`);
  const focusTarget = preferred?.disabled ? document.querySelector(`[data-direction-count="${key}:${-delta}"]`) : preferred;
  focusTarget?.focus({ preventScroll: true });
  return;
}
if(target.hasAttribute('data-remove') && !running) {
  const key = target.dataset.remove.split('/');
  syncPuzzle(removePuzzleBlock(puzzleWorkspace, key.length === 1 ? CONNECTED_STACK : key[0], Number(key.at(-1))));
  editProgram(); return;
}
switch (target.dataset.action) { case 'guide': showFirstMissionGuide(); break; case 'dismiss-guide': guideDismissed = true; render(); break;  case 'robot-motion': reducedRobotMotion = !reducedRobotMotion; render(); break; case 'home': openHome(); break; case 'chapters': cancelRun(); view = 'menu'; menuPage = 'chapters'; render(); window.scrollTo({top:0,behavior:'instant'}); break; case 'story': showStory(); break; case 'reset-progress': showResetProgress(); break; case 'menu': e.preventDefault(); openMenu(); break; case 'help': showHelp(); break; case 'sound': sound = !sound; audio.setEnabled(sound); music.setEnabled(sound); save('kesfet-code-sound', sound); if (!sound) companion.stop(); render(); audio.play('on'); break; case 'run': runProgram(); break; case 'stop': cancelRun(); feedback = 'stopped'; render(); break; case 'reset': resetRobot(); break; case 'clear': if (!running) { resetPuzzle(); repeatCount = 1; assisted = false; editProgram(true); } break; case 'hint': hintOpen = !hintOpen; render(); break; case 'demo': runDemo(); break; case 'menu-demo': activeChapter = 0; openLevel(0, 0); runDemo(); break; case 'camera': factory.camera.zoom = 1; factory.resetCamera(); factory.resize(); break; case 'top-view': factory.resetCamera(true); break; case 'zoom-in': factory.zoom(.15); break; case 'zoom-out': factory.zoom(-.15); break; case 'retry-3d': factory.retry(); break; } });
app.addEventListener('keydown', e => { if (view !== 'menu' || !['Enter', ' '].includes(e.key)) return; const chapter = e.target.closest('[data-action="chapter-select"]'); if (!chapter) return; e.preventDefault(); selectedChapter = Number(chapter.dataset.chapter); render(); });
document.addEventListener('keydown', e => { if (view !== 'game' || running || document.querySelector('dialog[open]') || e.ctrlKey || e.altKey || e.metaKey || e.target.closest('select,input,textarea,button,a')) return; const direction = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' }[e.key]; if (direction) { e.preventDefault(); addBlock(direction); } if (e.code === 'Space') { e.preventDefault(); runProgram(); } });
window.addEventListener('storage', e => { if (e.key === 'kesfet-code-progress-v2') { progress = normalizeProgress(read(e.key, null)); if (view === 'menu') render(); } });
render();
mountTabletSupport({ lang: () => document.documentElement.lang === 'tr' ? 'tr' : 'en' });
startBlinking();
// Never reload over a child's running program; menus are safe to refresh.
startAppUpdates({ lang: () => lang, canInterrupt: () => view === 'menu' && !running });
mountVersionLabel();
