import { AmbientMusic } from './ambient.js';
import { mountIllustrations } from './illustration-motion.js';
let disposeIllustrations = () => {};
let reducedRobotMotion = false;
import { icon } from './icons.js';
import { adventureMenu } from './adventure.js';
import { WORLDS } from './levels.js';
import { SoundEffects } from './sounds.js';
import { Factory3D } from './factory3d.js';
import { MOVE_MS, TURN_MS, PICKUP_MS, WIN_MS, LAUNCH_MS, PRESS_MS, IMPACT_MS } from './robot-motion.js';
import { LEVELS, CHAPTERS, MAX_BLOCKS, MAX_REPEATS, initialState, step, relativeSolution, expandProgram, availableActions, normalizeProgress, isUnlocked, completeLevel, scoreRun } from './engine.js';

const app = document.querySelector('#app');
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let storageAvailable = true;
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageAvailable = false; } };
let lang = read('kesfet-code-language', null);
if (!['en', 'tr'].includes(lang)) { try { lang = localStorage.getItem('kesfet-language') === 'tr' ? 'tr' : 'en'; } catch { lang = 'en'; } }
let theme = read('kesfet-code-theme', 'light');
if (!['light', 'dark'].includes(theme)) theme = 'light';
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
  if (status === 'unavailable' && running) { cancelRun(); feedback = 'stopped'; render(); }
  updateRunAvailability();
}));
let progress = normalizeProgress(read('kesfet-code-progress-v2', read('kesfet-code-progress', null)));
let view = 'menu', levelIndex = 0, selectedChapter = 0, activeChapter = 0, program = [], state = initialState(LEVELS[0]);
let repeatCount = 1, activeIteration = 0, insertGroup = null;
let running = false, runId = 0, activeBlock = -1, stepCursor = 0, hintOpen = false, assisted = false, feedback = 'ready';
let dragSource = null, dialogReturnFocus = null;
let menuPage = 'home', mapWorld = 0;
const text = (en, tr) => lang === 'en' ? en : tr;
const localized = pair => pair?.[lang === 'en' ? 0 : 1] ?? '';
const level = () => ({...LEVELS[levelIndex], robotRelative:true, allowTurns:activeChapter > 0, curriculum:activeChapter});
const labels = { up: ['Forward', 'İleri'], right: ['Robot’s right', 'Robotun sağı'], down: ['Backward', 'Geri'], left: ['Robot’s left', 'Robotun solu'], forward: ['Forward', 'İleri'], turnRight: ['Turn right', 'Sağa dön'], turnLeft: ['Turn left', 'Sola dön'], collect: ['Collect crystal', 'Kristali topla'], press: ['Press button', 'Düğmeye bas'], launch: ['Launch', 'Fırlat'] };
const disabled = () => running ? 'disabled' : '';
const actionLabel = action => localized(labels[action] || [action, action]);
const completed = () => progress.stars.filter(Boolean).length;
const chapterFinished = () => completed() >= 30;
const resumeLevel = () => Math.min(completed(), LEVELS.length - 1);
const announce = message => { const live = document.querySelector('#live-status'); if (live) live.textContent = message; };
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function soundIcon() { return `<span class="sound-note ${sound?'':'is-muted'}" aria-hidden="true">♫</span>`; }
function header() { return `<header class="site-header"><a class="brand" href="#" data-action="menu"><img src="/assets/kesfet-lab.png" alt="Keşfet Lab"><span><strong>Keşfet <span>Code</span></strong><small>Made by Keşfet Lab</small></span></a><nav aria-label="${text('Main navigation', 'Ana menü')}"><button class="nav-link ${view === 'menu' ? 'active' : ''}" data-action="menu">${icon('grid')}${text('Mission control', 'Görev merkezi')}</button><button class="nav-link" data-action="help">${icon('help')}${text('How to play', 'Nasıl oynanır')}</button></nav><div class="header-tools"><button class="icon-button" data-action="sound" aria-label="${text(sound ? 'Turn sound off' : 'Turn sound on', sound ? 'Sesi kapat' : 'Sesi aç')}" aria-pressed="${sound}">${soundIcon()}</button><button class="icon-button theme-toggle" data-action="theme" aria-label="${text(theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode', theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç')}">${icon(theme === 'light' ? 'moon' : 'sun')}</button><div class="language-switch" aria-label="${text('Language', 'Dil')}"><button data-lang="en" class="${lang === 'en' ? 'selected' : ''}" aria-pressed="${lang === 'en'}">EN</button><button data-lang="tr" class="${lang === 'tr' ? 'selected' : ''}" aria-pressed="${lang === 'tr'}">TR</button></div></div></header>`; }
function footer() { return `<footer><span>${icon('code')} ${text('Experiment. Discover. Create.', 'Dene. Keşfet. Üret.')}</span><span>Made by <b>Keşfet Lab</b></span></footer>`; }
function sceneHTML(menu = false) { return `<div class="scene-host ${menu ? 'lobby-scene' : 'game-scene'}" role="group" aria-label="${text(menu ? 'Your 3D robot in the factory' : '3D factory puzzle', menu ? 'Fabrikadaki 3D robotun' : '3D fabrika bulmacası')}"><div class="scene-loading" role="status"><span>${text('Getting your robot ready…', 'Robotun hazırlanıyor…')}</span><button class="secondary" data-action="retry-3d" hidden>${text('Try again', 'Yeniden dene')}</button></div></div>`; }
function cameraTools() { return `<div class="camera-tools" role="group" aria-label="${text('Camera controls', 'Kamera kontrolleri')}"><button class="icon-button" data-action="camera" aria-label="${text('Reset camera', 'Kamerayı sıfırla')}" title="${text('Reset camera', 'Kamerayı sıfırla')}">${icon('box')}</button><button class="icon-button" data-action="top-view" aria-label="${text('View from above', 'Üstten görünüm')}" title="${text('View from above', 'Üstten görünüm')}">${icon('grid')}</button><span></span><button class="icon-button zoom-control" data-action="zoom-in" aria-label="${text('Zoom in', 'Yakınlaştır')}">+</button><button class="icon-button zoom-control" data-action="zoom-out" aria-label="${text('Zoom out', 'Uzaklaştır')}">−</button></div>`; }

function renderMenu() {
  return adventureMenu({ page: menuPage, chapter: selectedChapter, world: mapWorld, lang, progress, sound, theme, unlockAll: DEBUG_UNLOCK_ALL, motion: !reducedRobotMotion });
}
function showStory() {
  showDialog(`<button class="dialog-close icon-button" data-dialog="close" aria-label="${text('Close', 'Kapat')}">${icon('close')}</button><span class="eyebrow">CODEKAŞİF</span><h2>${text('KAŞİF’s first mission', 'KAŞİF’in ilk görevi')}</h2><p>${text('Teach a new robot to find its way from KEŞFET LAB to the KEŞFET-1 launch center.', 'Yeni robotuna KEŞFET LAB’dan KEŞFET-1 fırlatma merkezine giden yolu öğret.')}</p><div class="story-pages">${WORLDS.map((world, n) => `<article><h3>${world.icon} ${n + 1}. ${localized(world.names)}</h3><p>${localized(world.story)}</p></article>`).join('')}<article><h3>📡 ${text('A message from space', 'Uzaydan bir mesaj')}</h3><p>${text('“KAŞİF… can you hear me? We need your help…” Your next adventure awaits.', '“KAŞİF… beni duyuyor musun? Yardımına ihtiyacımız var…” Yeni maceran seni bekliyor.')}</p></article></div><button class="primary dialog-primary" data-dialog="close">${text('Ready to explore!', 'Keşfe hazırım!')}</button>`);
}
function showResetProgress() {
  showDialog(`<h2>${text('Start a new adventure?', 'Yeni bir maceraya başla?')}</h2><p>${text('This clears your saved stars and mission results on this browser. You can still choose any chapter.', 'Bu tarayıcıdaki kayıtlı yıldızların ve görev sonuçların silinir. Yine her seviyeyi seçebilirsin.')}</p><button class="primary dialog-primary" data-dialog="reset-progress">${text('Reset my progress', 'İlerlememi sıfırla')}</button><button class="text-button" data-dialog="close">${text('Keep my adventure', 'Maceramı koru')}</button>`);
}
function toolbox() {
  const actions = availableActions(level(), state) || [];
  return `<section class="play-palette" aria-labelledby="palette-title"><div class="dock-heading"><h2 id="palette-title">${text('CODE BLOCKS', 'KOD BLOKLARI')}</h2><p>${text('Click or drag a block into your program above', 'Bir bloğa tıkla veya yukarıdaki programına sürükle')}</p></div><div class="block-palette">${actions.map(type => `<button class="code-block palette-block ${type}" draggable="${!running}" data-add="${type}" ${disabled()} aria-label="${text('Add', 'Ekle:')} ${actionLabel(type)}">${icon(type)}<span>${actionLabel(type)}</span></button>`).join('')}<button class="code-block palette-block repeat" data-action="repeat" ${disabled()} aria-label="${text('Repeat sequence', 'Diziyi tekrarla')}">${icon('repeat')}<span>${text('Repeat', 'Tekrarla')}</span></button></div></section>`;
}
function blockList(parent = null) { return parent === null ? program : program[parent]?.body; }
function blockCount() { return program.reduce((n,b)=>n+(b.type === 'repeat' ? b.body.length + 1 : 1),0); }
function renderBlocks(blocks, parent = null) {
  return blocks.map((block,index)=>{
    const key=parent === null ? String(index) : `${parent}.${index}`;
    if(block.type === 'repeat') return `<li class="program-item repeat-group" data-index="${index}" draggable="${!running}"><button class="block-delete" data-remove="${key}" aria-label="${text('Remove repeat group','Tekrar grubunu sil')} ${index+1}" ${disabled()}>×</button><div class="repeat-control"><strong>${icon('repeat')}${text('Repeat','Tekrarla')}</strong><div class="repeat-counter"><button data-repeat="${index}:-1" ${running || block.count<=2 ? 'disabled' : ''} aria-label="${text('Fewer repeats','Tekrarı azalt')}">−</button><output>${block.count}</output><button data-repeat="${index}:1" ${running || block.count>=MAX_REPEATS ? 'disabled' : ''} aria-label="${text('More repeats','Tekrarı artır')}">+</button></div></div><ol class="program-list repeat-body" data-list="${index}">${renderBlocks(block.body,index)}<li><button class="group-add ${insertGroup===index?'selected':''}" data-insert="${index}" ${disabled()}>＋ ${text('Inside repeat','Tekrarın içine')}</button></li></ol></li>`;
    return `<li class="program-item" data-index="${index}" ${parent===null?'':`data-parent="${parent}"`} data-key="${key}" draggable="${!running}"><span class="block-number">${index+1}</span><div class="code-block ${block.type}">${icon(block.type)}<span>${actionLabel(block.type)}</span></div><button class="block-delete" data-remove="${key}" aria-label="${text('Remove block','Bloğu sil')} ${key}" ${disabled()}>×</button></li>`;
  }).join('');
}
function renderProgram() {
  return `<button class="start-block" data-connector="start" data-action="${running?'stop':'run'}" aria-label="${text(running?'Stop program':'Start program',running?'Programı durdur':'Programı başlat')}">${icon(running?'pause':'play')}<span>${text(running?'Stop':'Start',running?'Durdur':'Başla')}</span></button><ol class="program-list" data-list="root" aria-label="${text('Your program','Programın')}">${renderBlocks(program)}</ol><button class="drop-target ${insertGroup===null?'selected':''}" data-insert="root" ${disabled()}>＋ ${text('After repeat / next step','Tekrardan sonra / sonraki adım')}</button><div class="program-drop-indicator" id="program-drop-indicator" hidden></div>`;
}
function energyDisplay() { if (state.energy === null || state.energy === undefined) return `<span class="energy-value">∞</span><span>${text('unlimited', 'sınırsız')}</span>`; const capacity = state.capacity || level().capacity || 6; return `<span class="energy-value">${state.energy}<small> / ${capacity}</small></span><span class="energy-segments">${Array.from({ length: capacity }, (_, i) => `<i class="${i < state.energy ? 'filled' : ''}"></i>`).join('')}</span>`; }
function objectiveHud() { const crystals = state.crystals?.length || 0; const required = level().crystals?.length ?? level().grid.flatMap(row => [...row]).filter(tile => tile === 'C').length; const fragments = state.items?.length || 0; return `<div class="mission-hud"><span class="hud-chip energy-chip">${icon('battery')}${energyDisplay()}</span>${required ? `<span class="hud-chip">💎 ${crystals} / ${required}</span>` : ''}${level().world >= 5 ? `<span class="hud-chip">🔑 ${(state.keys || []).length}</span>` : ''}${level().world >= 6 ? `<span class="hud-chip">🛰️ ${fragments}</span>` : ''}<span class="hud-chip">✦ ${text('Carrying','Taşınan')}: ${crystals + fragments + (state.keys?.length || 0) + (state.batteries?.length || 0)}</span></div>`; }
function workspace() {
  return `<section class="program-dock" aria-labelledby="program-title"><div class="dock-heading"><h2 id="program-title">${text('PROGRAM', 'PROGRAM')}</h2><span>${blockCount()} / ${MAX_BLOCKS} ${text('blocks', 'blok')}</span><button class="icon-button" data-action="clear" aria-label="${text('Clear all blocks', 'Tüm blokları sil')}" ${!program.length || running ? 'disabled' : ''}>${icon('trash')}</button></div><div class="program-row"><div class="program-scroll" id="program-area">${renderProgram()}</div></div></section>`;
}
function boardHTML() { return `<div class="scene-wrap">${sceneHTML()}<div class="scene-topline"><span class="scene-tag">${text(`WORLD ${level().world} · MISSION ${level().id}`, `DÜNYA ${level().world} · GÖREV ${level().id}`)}</span>${objectiveHud()}</div><div class="robot-speech" id="robot-speech" role="status"><span class="robot-speech-name">KAŞİF</span><span id="robot-speech-text">${esc(feedbackText())}</span></div><div class="scene-bottomline"><span>${text('Drag to look around', 'Etrafa bakmak için sürükle')}</span>${cameraTools()}</div></div>`; }
const feedbackText = () => ({ ready: text('Ready, explorer? Build a route for KAŞİF.', 'Hazır mısın kâşif? KAŞİF için bir rota oluştur.'), running: text('KAŞİF is following your algorithm…', 'KAŞİF algoritmanı uyguluyor…'), move: text('Driving to the next square…', 'Sonraki kareye sürüyor…'), press: text('Button pressed! KAŞİF is celebrating.', 'Düğmeye basıldı! KAŞİF kutluyor.'), button: text('Button pressed! KAŞİF is celebrating.', 'Düğmeye basıldı! KAŞİF kutluyor.'), turn: text('KAŞİF is turning to face the route.', 'KAŞİF rotaya doğru dönüyor.'), stopped: text('Paused — press the yellow Start block to start again.', 'Durduruldu — yeniden başlamak için sarı Başla bloğuna bas.'), wall: text('An obstacle! KAŞİF tips back, then gets up. Try another direction.', 'Bir engel var! KAŞİF devrilip kalkıyor. Başka bir yön dene.'), energy: text('Out of energy! KAŞİF is asleep. Reach the battery to recharge.', 'Enerji bitti! KAŞİF uykuya daldı. Şarj olmak için pile ulaş.'), collect: text('There is no crystal here. Drive onto a crystal, then collect it.', 'Burada kristal yok. Kristalin üzerine sür, sonra kristali topla.'), door: text('The door is locked. Find its key first.', 'Kapı kilitli. Önce anahtarını bul.'), items: text('This door needs another key or item.', 'Bu kapı başka bir anahtar veya eşya istiyor.'), sequence: text('Follow the mission order to continue.', 'Devam etmek için görev sırasını izle.'), crystal: text('Crystal collected! KAŞİF is glowing with joy.', 'Kristal toplandı! KAŞİF sevinçle parlıyor.'), battery: text('Recharge complete — keep driving!', 'Şarj tamamlandı — sürmeye devam!'), key: text('Key collected. A matching door can open now.', 'Anahtar toplandı. Eşleşen kapı artık açılabilir.'), component: text('Rocket component secured!', 'Roket parçası alındı!'), fragment: text('Launch-code fragment collected.', 'Fırlatma kodu parçası toplandı.'), goal: text('Destination reached. KAŞİF is checking the final objectives.', 'Hedefe ulaşıldı. KAŞİF son hedefleri kontrol ediyor.'), launchReady: text('KEŞFET-1 is ready. Add LAUNCH to finish.', 'KEŞFET-1 hazır. Bitirmek için FIRLAT ekle.'), launch: text('Liftoff! KAŞİF is launching KEŞFET-1.', 'Fırlatma! KAŞİF KEŞFET-1’i uzaya gönderiyor.'), incomplete: text('Almost there — follow the mission objectives.', 'Az kaldı — görev hedeflerini takip et.'), success: text('Mission complete — KAŞİF is proud of you!', 'Görev tamamlandı — KAŞİF seninle gurur duyuyor!'), demo: text('Watch the example, then try your own route.', 'Örneği izle, sonra kendi rotanı dene.'), limit: text('Your program is full — remove a command to add another.', 'Programın dolu — yeni komut için birini sil.'), invalid: text('Try changing that command and run again.', 'Bu komutu değiştirip yeniden çalıştır.') }[feedback] || feedback);
function missionObjective(mission) {
  if (mission.id === 1) return text('Move Forward once to reach the charging pad.', 'Şarj alanına ulaşmak için bir kez İleri git.');
  const tiles=mission.grid.join('');
  return [text('Guide KAŞİF to the exit.', 'KAŞİF’i çıkışa götür.'),
    tiles.includes('C') ? text('Stop beside each crystal and use Collect crystal.', 'Her kristalin yanında dur ve Kristali topla kullan.') : '',
    tiles.includes('B') ? text('Recharge at a battery along the way.', 'Yolda bir pille enerjini doldur.') : '',
    tiles.includes('K') ? text('Store the matching keys before opening doors.', 'Kapıları açmadan önce uygun anahtarları sakla.') : '',
    mission.world === 6 ? text('Store the rocket parts and code fragments. Launch at the final pad.', 'Roket parçalarını ve kod parçalarını sakla. Son alanda fırlat.') : ''
  ].filter(Boolean).join(' ');
}

function renderGame() {
  const mission = level();
  const chapterName = localized(CHAPTERS[activeChapter].names);
  return `<main class="play-page play-chapter-${activeChapter}"><header class="play-header"><button class="play-brand" data-action="menu" aria-label="${text('Back to mission map', 'Görev haritasına dön')}"><small>🚀</small><strong>Code<span>KAŞİF</span></strong><em>‹ ${text('Mission map', 'Görev haritası')}</em></button><div class="wood-sign"><span>${esc(chapterName)}</span><h1>${esc(localized(mission.names))}</h1><small>${text('Mission', 'Bölüm')} ${mission.id} / 30</small></div><div class="play-tools"><button data-action="robot-motion" aria-pressed="${!reducedRobotMotion}" aria-label="${text('Robot animations', 'Robot animasyonları')}">${icon('play')}<span>${text(reducedRobotMotion ? 'Motion off' : 'Motion on', reducedRobotMotion ? 'Hareket kapalı' : 'Hareket açık')}</span></button><button data-action="hint" aria-expanded="${hintOpen}">${icon('help')}<span>${text('Hint', 'İpucu')}</span></button><button data-action="reset">${icon('reset')}<span>${text('Try again', 'Yeniden dene')}</span></button><button data-action="sound" aria-label="${text(sound ? 'Turn sound off' : 'Turn sound on', sound ? 'Sesi kapat' : 'Sesi aç')}" aria-pressed="${sound}">${soundIcon()}</button><button data-action="theme" aria-label="${text('Change theme', 'Temayı değiştir')}">${icon(theme === 'dark' ? 'sun' : 'moon')}</button><button data-lang="${lang === 'en' ? 'tr' : 'en'}" aria-label="${text('Switch to Turkish', 'İngilizceye geç')}">${lang === 'en' ? 'TR' : 'EN'}</button></div></header><div class="play-layout"><section class="play-stage" aria-label="${text('Adventure board', 'Macera tahtası')}">${boardHTML()}</section><aside class="mission-panel"><span class="space-eyebrow">${text('YOUR MISSION', 'GÖREVİN')}</span><h2>${esc(localized(mission.names))}</h2><p>${esc(missionObjective(mission))}</p><div class="mission-star-row" aria-label="${progress.stars[levelIndex]} / 3 ${text('stars', 'yıldız')}">${[1,2,3].map(n=>icon('star', n <= progress.stars[levelIndex] ? 'earned' : '')).join('')}</div><div class="mission-coach"><span aria-hidden="true">🤖</span><p>${text('Directions belong to KAŞİF: Forward follows its face. Right and Left turn and drive one tile.', 'Yönler KAŞİF’e göredir: İleri baktığı yön. Sağ ve Sol dönüp bir kare ilerler.')}</p></div><p class="collect-instruction">${text('Beside a crystal? Use Collect crystal to lift it.', 'Kristalin yanında mısın? Kaldırmak için Kristali topla kullan.')}</p><button class="secondary" data-action="help">${icon('help')}${text('How to play', 'Nasıl oynanır')}</button><div class="play-hint" ${hintOpen ? '' : 'hidden'}><p>${esc(relativeSolution(mission).map(b=>actionLabel(b.type)).join(' → '))}</p><button class="secondary" data-action="demo" ${disabled()}>${icon('play')}${text('Show me', 'Bana göster')}</button></div></aside><div class="coding-deck">${workspace()}${toolbox()}</div></div></main>`;
}
function render() { music.setTheme(view==='game' ? ['forest','mars','ice'][activeChapter] : menuPage==='map' ? ['forest','mars','ice'][selectedChapter] : 'menu'); disposeIllustrations(); factory.setReducedMotion(reducedRobotMotion); document.documentElement.lang = lang; document.documentElement.dataset.theme = theme; document.documentElement.dataset.sceneryMotion = reducedRobotMotion ? 'off' : 'on'; document.documentElement.dataset.view = view; factory.renderer?.domElement.remove(); app.innerHTML = view === 'menu' ? renderMenu() : renderGame(); const sceneHost = document.querySelector('.scene-host'); if (sceneHost) factory.attach(sceneHost, { mode: view, level: level(), state, theme, lang }); if (view === 'game') updateBoard(); disposeIllustrations = mountIllustrations(app); updateRunAvailability(); }
function updateRunAvailability() { const ready = factory.status === 'ready'; document.querySelectorAll('[data-action="run"]').forEach(button => { button.disabled = !ready || !program.length; }); document.querySelectorAll('[data-action="demo"], [data-action="menu-demo"]').forEach(button => { button.disabled = !ready || running; }); }
function updateBoard(animate = false, direction) { const repeatStatus = document.querySelector('#repeat-status'); if (repeatStatus && running) repeatStatus.textContent = `${activeIteration} / ${repeatCount}`; const board = document.querySelector('.game-scene'); if (!board) return; factory.setState(state, animate, direction); board.setAttribute('aria-label', text(`3D factory. KAŞİF at row ${state.row + 1}, column ${state.col + 1}; energy ${state.energy ?? 'unlimited'}`, `3D fabrika. KAŞİF ${state.row + 1}. satır, ${state.col + 1}. sütunda; enerji ${state.energy ?? 'sınırsız'}`)); document.querySelectorAll('.program-item').forEach(el => el.classList.toggle('executing', el.dataset.key === String(activeBlock))); const message = document.querySelector('#robot-feedback'); if (message) { message.textContent = feedbackText(); message.classList.toggle('error', !!state.error || feedback === 'incomplete'); } const speech = document.querySelector('#robot-speech-text'); if (speech) speech.textContent = feedbackText(); const speechBox = document.querySelector('#robot-speech'); if (speechBox) speechBox.classList.toggle('is-speaking', !!running || !!state.event || !!state.error); const hud = document.querySelector('.scene-topline'); if (hud && view === 'game') hud.querySelector('.mission-hud')?.replaceWith(document.createRange().createContextualFragment(objectiveHud())); }
function cancelRun() { runId++; running = false; demoPending = false; activeBlock = -1; stepCursor = 0; audio.cancel(); factory.cancelAnimation?.(state); }
function openLevel(index, chapter = activeChapter) { if (!canOpenLevel(index)) return; cancelRun(); closeDialog(); view = 'game'; levelIndex = index; activeChapter = chapter; program = []; insertGroup = null; repeatCount = 1; state = initialState(level()); hintOpen = false; assisted = false; feedback = 'ready'; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function openMenu() { cancelRun(); closeDialog(); selectedChapter = activeChapter; mapWorld = Math.floor(levelIndex / 5); menuPage = 'map'; view = 'menu'; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function resetRobot() { cancelRun(); state = initialState(level()); feedback = 'ready'; render(); audio.play('reset'); }
function editProgram() { assisted = false; state = initialState(level()); feedback = 'ready'; activeBlock = -1; stepCursor = 0; factory.cancelAnimation?.(state); render(); audio.play('block'); }
function addBlock(type) { if (running || !(availableActions(level(), state) || []).includes(type)) return; if (blockCount() >= MAX_BLOCKS) { feedback = 'limit'; updateBoard(); return; } (blockList(insertGroup) || program).push({ type }); editProgram(); document.querySelector('.program-scroll')?.scrollTo({ left: 100000 }); }
function programDropIndex(event) {
  const items = [...document.querySelectorAll('#program-area .program-item')];
  const index = items.findIndex(item => { const rect = item.getBoundingClientRect(); return event.clientX < rect.left + rect.width / 2; });
  return index < 0 ? program.length : index;
}
function showProgramDropCue(event) {
  const area = document.querySelector('#program-area');
  if (!area) return;
  const to = programDropIndex(event), indicator = area.querySelector('#program-drop-indicator');
  const bounds = area.getBoundingClientRect(), items = [...area.querySelectorAll('.program-item')];
  const edge = to < items.length ? items[to].getBoundingClientRect().left : items.at(-1)?.getBoundingClientRect().right ?? area.querySelector('.start-block').getBoundingClientRect().right;
  area.dataset.dropIndex = String(to); area.classList.add('drag-over');
  if (indicator) { indicator.style.left = `${edge - bounds.left + area.scrollLeft - 4}px`; indicator.hidden = false; }
}
function clearProgramDropCue() { const area = document.querySelector('#program-area'); if (!area) return; area.classList.remove('drag-over'); delete area.dataset.dropIndex; const indicator = area.querySelector('#program-drop-indicator'); if (indicator) indicator.hidden = true; }
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
  if (running || !program.length || factory.status !== 'ready') return;
  let instructions;
  try { instructions = expandProgram(level(), program, repeatCount); } catch { feedback = 'invalid'; updateBoard(); return; }
  const id = ++runId;
  activeIteration = 1; running = true; state = initialState(level()); activeBlock = -1; stepCursor = 0;
  feedback = demo ? 'demo' : 'running'; render(); audio.play('run');
  await delay(300);
  for (const action of instructions) {
    if (id !== runId) return;
    activeBlock = action.key ?? action.index; activeIteration = action.iteration;
    updateBoard();
    const current = document.querySelector('.program-item.executing');
    current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    state = step(level(), state, action.type);
    feedback = state.event === 'ready' ? 'launchReady' : state.event || state.error || feedback;
    updateBoard(true, action.type);
    playActionSound(action.type);
    await delay(actionDuration(action.type));
    if (id !== runId) return;
    if (state.error || state.won) break;
  }
  running = false; activeBlock = -1;
  if (state.won && !demo) {
    feedback = 'success';
    const score = scoreRun(level(), state, blockCount());
    progress = completeLevel(progress, levelIndex, score, state.crystals?.length || 0);
    save('kesfet-code-progress-v2', progress);
    render(); showSuccess(score);
  } else if (state.won && demo) {
    feedback = 'demo'; render(); announce(text('Demo complete — now try your own route.', 'Demo tamamlandı — şimdi kendi rotanı dene.'));
  } else {
    if (!state.error && state.event !== 'ready') feedback = 'incomplete';
    render(); announce(feedbackText());
  }
}
function runDemo() {
  if (running) return;
  assisted = true;
  insertGroup = null; repeatCount = 1; program = relativeSolution(level());
  hintOpen = false;
  if (factory.status === 'ready') runProgram(true);
  else demoPending = true;
}
function closeDialog() { const dialog = document.querySelector('dialog'); if (dialog) { dialog.close(); dialog.remove(); } if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus(); dialogReturnFocus = null; }
function showDialog(content) { closeDialog(); dialogReturnFocus = document.activeElement; const dialog = document.createElement('dialog'); dialog.className = 'game-dialog'; dialog.innerHTML = content; const heading = dialog.querySelector('h2'); if (heading) { heading.id = 'dialog-title'; dialog.setAttribute('aria-labelledby', 'dialog-title'); } document.body.append(dialog); dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); const action = e.target.closest('[data-dialog]')?.dataset.dialog; if (action === 'reset-progress') { progress = normalizeProgress(null); save('kesfet-code-progress-v2', progress); closeDialog(); render(); } if (action === 'close') closeDialog(); if (action === 'next') openLevel(levelIndex + 1); if (action === 'menu') openMenu(); if (action === 'again') { closeDialog(); assisted = false; resetRobot(); } }); dialog.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); }); dialog.showModal(); }
function showSuccess(score) {
  const final = levelIndex === LEVELS.length - 1;
  showDialog(`<div class="success-art">${icon(final ? 'rocket' : 'star')}<span>✦</span><span>✧</span></div><div class="success-stars">${[1,2,3].map(n=>icon('star',n<=score?'earned':'')).join('')}</div><span class="eyebrow">${text('MISSION COMPLETE','GÖREV TAMAMLANDI')}</span><h2>${final ? text('KEŞFET-1 is ready for space!','KEŞFET-1 uzaya hazır!') : text('Brilliant work, explorer','Harika iş, kâşif')}</h2><div class="success-controls"><button class="success-replay" data-dialog="again" aria-label="${text('Try again','Yeniden dene')}" title="${text('Try again','Yeniden dene')}">${icon('reset')}</button><button class="success-next" data-dialog="${final?'menu':'next'}" aria-label="${final?text('Back to chapters','Seviyelere dön'):text('Next mission','Sonraki görev')}" title="${final?text('Back to chapters','Seviyelere dön'):text('Next mission','Sonraki görev')}">${icon('arrow')}</button></div>`);
}
function showHelp() { if (running) { cancelRun(); feedback = 'stopped'; render(); } showDialog(`<button class="dialog-close icon-button" data-dialog="close" aria-label="${text('Close', 'Kapat')}">${icon('close')}</button><span class="eyebrow">KEṢFET CODE</span><h2>${text('Little blocks, big adventures', 'Küçük bloklar, büyük maceralar')}</h2><div class="help-step"><span class="step-badge">1</span><div><h3>${text('Build a route', 'Bir rota yap')}</h3><p>${text('Choose Forward, Backward, Robot’s right or Robot’s left. Each direction is relative to where KAŞİF is facing, and the robot faces its new travel direction. Older paths also have turns without movement.', 'İleri, Geri, Robotun sağı veya Robotun solu seç. Yönler KAŞİF’in baktığı yöne göredir; robot yeni hareket yönüne döner. Büyük yaş yollarında yerinde dönüş de vardır.')}</p></div></div><div class="help-step"><span class="step-badge">2</span><div><h3>${text('Plan the objective order', 'Hedef sırasını planla')}</h3><p>${text('Stand on a crystal and add Collect crystal. Later missions add batteries, keys, doors, rocket parts, and launch fragments.', 'Kristalin üstüne gel ve Kristali topla bloğunu ekle. Sonraki görevler piller, anahtarlar, kapılar, roket parçaları ve fırlatma parçaları ekler.')}</p></div></div><div class="help-step"><span class="step-badge">3</span><div><h3>${text('Run and learn', 'Çalıştır ve öğren')}</h3><p>${text('Press the yellow Start block to watch KAŞİF drive. Add Repeat to repeat the blocks inside its green frame 2–10 times. New blocks go after the repeat. Choose Inside repeat to add to the group. A battery refills energy, a wall causes a safe bump, and the robot celebrates every crystal.', 'KAŞİF’in sürüşünü görmek için sarı Başla bloğuna bas. Yeşil çerçevedeki blokları 2–10 kez çalıştırmak için Tekrarla ekle. Yeni bloklar tekrardan sonra eklenir. Gruba eklemek için Tekrarın içine seç. Pil enerjiyi doldurur, duvar güvenli bir çarpma gösterir ve robot her kristali kutlar.')}</p></div></div><div class="help-note">${icon('star')}${text('Chapter 2 teaches loops, repetition, and optimization; Chapter 3 adds conditions, sensors, and functions.', 'Seviye 2 döngüleri, tekrarları ve optimizasyonu; Seviye 3 koşulları, sensörleri ve fonksiyonları öğretir.')}</div><button class="primary dialog-primary" data-dialog="close">${text('Let’s build', 'Haydi kodlayalım')}${icon('arrow')}</button>`); }

app.addEventListener('click', e => { const chapter = e.target.closest('[data-action="chapter-select"]'); if (chapter && !e.target.closest('button')) { selectedChapter = Number(chapter.dataset.chapter); render(); return; } const target = e.target.closest('button,a'); if (!target || target.disabled) return; if (target.hasAttribute('data-world')) { mapWorld = Number(target.dataset.world); render(); return; } if (target.dataset.action === 'choose-path') { selectedChapter = activeChapter = Number(target.dataset.path); mapWorld = 0; menuPage = 'map'; render(); document.querySelector('[data-level="0"]')?.scrollIntoView({block:'center'}); return; } if (target.hasAttribute('data-lang')) { lang = target.dataset.lang; save('kesfet-code-language', lang); render(); return; } if (target.hasAttribute('data-level')) { e.preventDefault(); openLevel(Number(target.dataset.level)); return; } if (target.dataset.action === 'chapter1') { selectedChapter = 0; activeChapter = 0; openLevel(resumeLevel(), 0); return; } if (target.dataset.action === 'chapter-start') { const chapter = Number(target.dataset.chapter); selectedChapter = chapter; activeChapter = chapter; openLevel(resumeLevel(), chapter); return; } if (target.hasAttribute('data-add')) { addBlock(target.dataset.add); return; } if(target.hasAttribute('data-insert') && !running) { insertGroup=target.dataset.insert==='root'?null:Number(target.dataset.insert); render(); return; }
if(target.hasAttribute('data-repeat') && !running) { const [i,delta]=target.dataset.repeat.split(':').map(Number); program[i].count=Math.max(2,Math.min(MAX_REPEATS,program[i].count+delta)); editProgram(); return; }
if(target.hasAttribute('data-remove') && !running) { const path=target.dataset.remove.split('.').map(Number); if(path.length===2) program[path[0]].body.splice(path[1],1); else {program.splice(path[0],1);insertGroup=null;} editProgram(); return; }
switch (target.dataset.action) { case 'repeat': if(!running && blockCount()<MAX_BLOCKS) { let start=program.findLastIndex(b=>b.type==='repeat')+1; const body=program.splice(start); program.push({type:'repeat',count:2,body}); insertGroup=body.length?null:program.length-1; editProgram(); } break; case 'robot-motion': reducedRobotMotion = !reducedRobotMotion; render(); break; case 'home': cancelRun(); view = 'menu'; menuPage = 'home'; render(); window.scrollTo({top:0,behavior:'instant'}); break; case 'chapters': cancelRun(); view = 'menu'; menuPage = 'chapters'; render(); window.scrollTo({top:0,behavior:'instant'}); break; case 'story': showStory(); break; case 'reset-progress': showResetProgress(); break; case 'menu': e.preventDefault(); openMenu(); break; case 'theme': theme = theme === 'light' ? 'dark' : 'light'; save('kesfet-code-theme', theme); render(); break; case 'help': showHelp(); break; case 'sound': sound = !sound; audio.setEnabled(sound); music.setEnabled(sound); save('kesfet-code-sound', sound); render(); audio.play('on'); break; case 'run': runProgram(); break; case 'stop': cancelRun(); feedback = 'stopped'; render(); break; case 'reset': resetRobot(); break; case 'clear': if (!running) { program = []; insertGroup = null; repeatCount = 1; assisted = false; editProgram(); } break; case 'hint': hintOpen = !hintOpen; render(); break; case 'demo': runDemo(); break; case 'menu-demo': activeChapter = 0; openLevel(0, 0); runDemo(); break; case 'camera': factory.camera.zoom = 1; factory.resetCamera(); factory.resize(); break; case 'top-view': factory.resetCamera(true); break; case 'zoom-in': factory.zoom(.15); break; case 'zoom-out': factory.zoom(-.15); break; case 'retry-3d': factory.retry(); break; } });
app.addEventListener('keydown', e => { if (view !== 'menu' || !['Enter', ' '].includes(e.key)) return; const chapter = e.target.closest('[data-action="chapter-select"]'); if (!chapter) return; e.preventDefault(); selectedChapter = Number(chapter.dataset.chapter); render(); });
app.addEventListener('dragstart', e => { if(running || e.target.closest('button:not([data-add])')) {e.preventDefault();return;} const item=e.target.closest('[data-add],[data-index]'); if(!item)return; dragSource=item.hasAttribute('data-add')?{type:item.dataset.add}:{index:Number(item.dataset.index),parent:item.hasAttribute('data-parent')?Number(item.dataset.parent):null}; e.dataTransfer.setData('text/plain','kesfet-code-block'); });
app.addEventListener('dragover',e=>{if(dragSource && !running && e.target.closest('#program-area')) {e.preventDefault();e.target.closest('[data-list]')?.classList.add('drop-active');}});
app.addEventListener('drop',e=>{
  if(!dragSource || running || !e.target.closest('#program-area'))return; e.preventDefault();
  const source=dragSource; dragSource=null;
  const list=e.target.closest('[data-list]'); const parent=list && list.dataset.list!=='root'?Number(list.dataset.list):null;
  const dest=blockList(parent); if(!dest)return;
  const target=e.target.closest('.program-item'); let to=dest.length;
  if(target && target.parentElement===list) {const r=target.getBoundingClientRect();to=Number(target.dataset.index)+(e.clientX>r.left+r.width/2?1:0);}
  if(source.type) {if(blockCount()<MAX_BLOCKS && availableActions(level(),state).includes(source.type))dest.splice(to,0,{type:source.type});}
  else {const origin=blockList(source.parent), block=origin?.[source.index];if(!block || (block.type==='repeat' && parent!==null))return;origin.splice(source.index,1);if(origin===dest && source.index<to)to--;dest.splice(to,0,block);}
  insertGroup=null; editProgram();
});
app.addEventListener('dragend', () => { dragSource = null; clearProgramDropCue(); document.querySelectorAll('.drop-active').forEach(el=>el.classList.remove('drop-active')); });
document.addEventListener('keydown', e => { if (view !== 'game' || running || document.querySelector('dialog[open]') || e.ctrlKey || e.altKey || e.metaKey || e.target.closest('select,input,textarea,button,a')) return; const direction = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' }[e.key]; if (direction) { e.preventDefault(); addBlock(direction); } if (e.code === 'Space') { e.preventDefault(); runProgram(); } });
window.addEventListener('storage', e => { if (e.key === 'kesfet-code-progress-v2') { progress = normalizeProgress(read(e.key, null)); if (view === 'menu') render(); } });
render();
