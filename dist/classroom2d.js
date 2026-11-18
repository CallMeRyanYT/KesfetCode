import { MOVE_MS, PICKUP_MS, PICKUP_EVENTS, LAUNCH_MS, PRESS_MS } from './robot-motion.js';

/** Campaign boards show every terrain cell; older small fixtures keep their framing. */
export function classroomLayout(grid) {
  const cells = [];
  const fullGrid = grid.length === 8 && grid.every(line => line.length === 8);
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const tile = grid[row][col];
      if (fullGrid || tile !== '#') cells.push({ row, col, tile, blocked: tile === '#', key: `${row},${col}` });
    }
  }
  if (!cells.some(cell => !cell.blocked)) throw new Error('The classroom board needs a playable tile');
  const minRow = Math.min(...cells.map(cell => cell.row));
  const minCol = Math.min(...cells.map(cell => cell.col));
  const rows = Math.max(...cells.map(cell => cell.row)) - minRow + 1;
  const cols = Math.max(...cells.map(cell => cell.col)) - minCol + 1;
  return { cells, minRow, minCol, rows, cols, fullGrid };
}

export function classroomPosition(layout, state) {
  return {
    x: (state.col - layout.minCol + .5) / layout.cols * 100,
    y: (state.row - layout.minRow + .5) / layout.rows * 100
  };
}

export function classroomTileSize(layout, width, height) {
  return Math.max(1, Math.min(112, (width - 28) / layout.cols, (height - 46) / layout.rows));
}

const robotIcon = `<svg class="classroom-robot-art" viewBox="0 0 112 112" fill="none" aria-hidden="true">
  <path d="M38 19h36M56 8v10" stroke="#915519" stroke-width="5" stroke-linecap="round"/>
  <circle cx="56" cy="8" r="5" fill="#65E9FC" stroke="#257B85" stroke-width="2"/>
  <rect x="14" y="31" width="13" height="23" rx="6" fill="#E59B29" stroke="#754413" stroke-width="3"/>
  <rect x="85" y="31" width="13" height="23" rx="6" fill="#E59B29" stroke="#754413" stroke-width="3"/>
  <rect x="23" y="19" width="66" height="49" rx="13" fill="#FFC53E" stroke="#824C13" stroke-width="3"/>
  <path d="M35 24h42" stroke="#FFECA8" stroke-width="3" stroke-linecap="round"/>
  <rect x="30" y="27" width="52" height="33" rx="9" fill="#172536" stroke="#CC8A25" stroke-width="2"/>
  <path d="M36 31h11" stroke="#506679" stroke-width="2" stroke-linecap="round" opacity=".6"/>
  <g class="classroom-robot-eyes"><path d="M39 43c1-7 9-7 10 0m14 0c1-7 9-7 10 0" stroke="#FFE17A" stroke-width="3.5" stroke-linecap="round"/></g>
  <path d="M49 49q7 7 14 0" stroke="#FFE17A" stroke-width="3" stroke-linecap="round"/>
  <rect x="49" y="68" width="14" height="7" rx="3" fill="#815018"/>
  <path d="M32 72q24-8 48 0v22H32Z" fill="#F7AF2E" stroke="#824C13" stroke-width="3"/>
  <rect x="42" y="77" width="28" height="17" rx="6" fill="#26394D"/>
  <circle cx="56" cy="85" r="5" fill="#67E8F4"/>
  <g class="classroom-robot-arms" stroke="#824C13" stroke-width="3">
    <path d="m30 74-8 9 6 8M82 74l8 9-6 8" fill="#F7AF2E" stroke-linejoin="round"/>
  </g>
  <rect x="19" y="91" width="27" height="16" rx="8" fill="#213348" stroke="#112032" stroke-width="3"/>
  <rect x="66" y="91" width="27" height="16" rx="8" fill="#213348" stroke="#112032" stroke-width="3"/>
  <path d="M26 98h13m34 0h13" stroke="#91ACB5" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const crystalIcon = `<svg class="classroom-crystal-art" viewBox="0 0 100 100" fill="none" aria-hidden="true">
  <ellipse class="classroom-crystal-shadow" cx="50" cy="86" rx="19" ry="5" fill="#268B8C" opacity=".25"/>
  <g class="classroom-crystal-aura"><circle cx="50" cy="48" r="39" fill="#9BFCFF" opacity=".28"/><circle cx="50" cy="48" r="29" fill="#DCFFFF" opacity=".48"/><circle cx="50" cy="48" r="35" stroke="#B2FFFF" stroke-width="1.5" opacity=".65"/></g>
  <g class="classroom-crystal-gem">
    <path d="m50 9 22 27-8 38H36l-8-38Z" fill="#21CDF2" stroke="#087CA7" stroke-width="3" stroke-linejoin="round"/>
    <path d="m50 9-9 27 9 38 9-38Z" fill="#AFF6FF"/>
    <path d="m28 36 13 0 9-27m22 27H59L50 9M36 74l14-38 14 38" stroke="#E6FFFF" stroke-width="2"/>
    <path d="M50 15v48" stroke="#FFF" stroke-width="3" stroke-linecap="round" opacity=".65"/>
  </g>
  <path class="classroom-crystal-spark spark-a" d="M18 21v10m-5-5h10" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>
  <path class="classroom-crystal-spark spark-b" d="M79 64v12m-6-6h12" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const flowerIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="var(--classroom-petal,#fffef0)"><circle cx="12" cy="6" r="4"/><circle cx="18" cy="10" r="4"/><circle cx="15" cy="17" r="4"/><circle cx="7" cy="16" r="4"/><circle cx="6" cy="9" r="4"/></g><circle cx="12" cy="12" r="4" fill="#FFD44C"/><circle cx="11" cy="11" r="1.3" fill="#FFF3A6"/></svg>`;

const terrainProps = {
  tree: '<ellipse cx="50" cy="92" rx="27" ry="5" fill="#208A57" opacity=".17"/><path d="M44 66h12v25H44Z" fill="#C78B48" stroke="#A26B36" stroke-width="2"/><path d="M48 77v11" stroke="#F3BC73" stroke-width="2.5" stroke-linecap="round"/><g class="classroom-tree-crown"><path d="M50 38C40 50 31 62 20 73q-5 5 2 7 28 10 56 0 7-2 2-7C69 62 60 50 50 38Z" fill="#29AF5D" stroke="#208C49" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 21C42 31 33 42 24 52q-5 5 3 8 23 8 46 0 8-3 3-8C67 42 58 31 50 21Z" fill="#4BCB62" stroke="#208C49" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 7C44 18 38 26 32 34q-4 5 3 7 15 6 30 0 7-2 3-7C62 26 56 18 50 7Z" fill="#7CE16D" stroke="#289D51" stroke-width="2.5" stroke-linejoin="round"/><path d="M47 18 39 31m3 13-9 10m4 12-8 8" stroke="#BAF69A" stroke-width="4" stroke-linecap="round"/><path d="m57 32 5 4m-1 18 6 3m-3 16 7 3" stroke="#E1FFBA" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="61" cy="56" rx="3" ry="4" fill="#D5A45A"/><path d="m60 54 2 2m-2 0 2 2" stroke="#A27139" stroke-width="1.3" stroke-linecap="round"/></g><path d="m25 91 3-7 3 7m36 1 3-7 3 7" stroke="#70CA55" stroke-width="2.5" stroke-linecap="round"/>',
  rock: '<ellipse cx="51" cy="81" rx="31" ry="5" fill="#3E967E" opacity=".14"/><path d="m17 65 9-32 27-15 27 20 7 31-25 14-27-3Z" fill="#A7C8CD" stroke="#789FA8" stroke-width="3" stroke-linejoin="round"/><path d="m26 33 27-15-1 37Z" fill="#D8EBEA"/><path d="m52 55 28-17 7 31-25 14Z" fill="#94B7C1"/><path d="m26 33 26 22 28-17M52 55l10 28" stroke="#E9F7F2" stroke-width="2.5" stroke-linejoin="round"/><path d="m35 32 12-7" stroke="#F5FFFB" stroke-width="3" stroke-linecap="round"/>',
  bush: '<ellipse cx="50" cy="80" rx="29" ry="5" fill="#208A57" opacity=".16"/><g class="classroom-bush-leaves"><circle cx="34" cy="54" r="19" fill="#4AC35D"/><circle cx="61" cy="58" r="23" fill="#2BA952"/><circle cx="50" cy="38" r="24" fill="#79DD63"/><path d="M27 65q23 12 46 0" stroke="#248C48" stroke-width="3" stroke-linecap="round"/><path d="m32 48 5-5m23-17 4 5m4 23 3-3" stroke="#C0F69A" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="41" cy="30" rx="6" ry="4" transform="rotate(-35 41 30)" fill="#C4F798"/><circle cx="56" cy="55" r="3.5" fill="#FF8C97"/><circle cx="65" cy="60" r="3" fill="#FFB4BD"/><circle cx="58" cy="54" r="1" fill="#FFF0DF"/><circle cx="64" cy="59" r=".8" fill="#FFF0DF"/></g>',
  planter: '<path d="M23 52h54l-8 34H31Z" fill="#EDAD69" stroke="#C78A4E" stroke-width="3" stroke-linejoin="round"/><path d="m31 62 4 17h29" stroke="#FFD39A" stroke-width="3" stroke-linecap="round"/><path d="M48 56V18" stroke="#29964C" stroke-width="3" stroke-linecap="round"/><path d="M48 43Q20 36 24 14q25 1 24 29Z" fill="#87E16C" stroke="#389C50" stroke-width="2.5" stroke-linejoin="round"/><path d="M48 54q31-11 28-35-26 1-28 35Z" fill="#4CC969" stroke="#29964C" stroke-width="2.5" stroke-linejoin="round"/><path d="m31 23 12 13m24-8L54 45" stroke="#C6F79D" stroke-width="2.5" stroke-linecap="round"/><path d="M21 54h58" stroke="#FFE0A3" stroke-width="7" stroke-linecap="round"/>',
  post: '<path d="M46 39h8v50h-8Z" fill="#8A7153"/><path d="M16 15h55l15 14-15 14H16Z" fill="#C7D2A3" stroke="#7D9263" stroke-width="3"/><path d="M32 29h26m-7-7 7 7-7 7" stroke="#64834F" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  solar: '<path d="M31 75v13m38-13v13M20 14h60v58H20Z" stroke="#526F7B" stroke-width="5" stroke-linecap="round"/><path d="M20 14h60v58H20Z" fill="#577D92"/><path d="M40 14v58m20-58v58M20 33h60M20 52h60" stroke="#B0CED9" stroke-width="2"/><path d="M28 21h7m13 0h7m13 0h5" stroke="#D7EBEA" stroke-width="3"/>',
  cable: '<path d="M13 26h36q17 0 17 17v22q0 12 16 12" stroke="#557978" stroke-width="12" stroke-linecap="round"/><path d="M13 26h36q17 0 17 17v22q0 12 16 12" stroke="#91B0A6" stroke-width="5" stroke-linecap="round"/><rect x="7" y="17" width="15" height="18" rx="4" fill="#D7C682"/><rect x="78" y="68" width="15" height="18" rx="4" fill="#D7C682"/>',
  console: '<rect x="21" y="12" width="58" height="70" rx="10" fill="#9AB8BB" stroke="#60858A" stroke-width="4"/><rect x="29" y="21" width="42" height="30" rx="4" fill="#4C7280"/><path d="M36 34h11m-11 8h25" stroke="#A8E6D6" stroke-width="3" stroke-linecap="round"/><circle cx="37" cy="65" r="5" fill="#E1CB80"/><circle cx="62" cy="65" r="5" fill="#93CDA4"/><path d="M27 85h46" stroke="#527C83" stroke-width="4" stroke-linecap="round"/>',
  crate: '<rect x="18" y="18" width="64" height="64" rx="8" fill="#B6BAA4" stroke="#7F8871" stroke-width="4"/><path d="M18 34h64M18 66h64M34 18v64m32-64v64" stroke="#D9DAC1" stroke-width="5"/><path d="m39 40 23 23m0-23L39 63" stroke="#868F78" stroke-width="3"/>',
  dish: '<path d="M39 72 26 91m35-19 13 19M27 90h47" stroke="#6F828A" stroke-width="5" stroke-linecap="round"/><path d="M22 24q4 48 57 44L22 24Z" fill="#D6DBD0" stroke="#859A9E" stroke-width="3"/><path d="m51 46 20-27" stroke="#758F94" stroke-width="4" stroke-linecap="round"/><circle cx="73" cy="16" r="6" fill="#ABC9C3"/>'
};

const worldTerrain = {
  1: ['planter', 'bush', 'rock', 'tree'],
  2: ['bush', 'post', 'rock', 'planter'],
  3: ['tree', 'rock', 'tree', 'bush'],
  4: ['solar', 'bush', 'cable', 'console'],
  5: ['crate', 'bush', 'console', 'rock'],
  6: ['rock', 'dish', 'console', 'crate']
};

/** Every Explorer mission uses mission one's painted toy-board style. */
export const usesReferenceArt = level => level?.curriculum === 0;
// Painted props exist for tree, bush, rock and crate; other world props map onto them.
const REFERENCE_PROP = { planter: 'crate', post: 'tree', tree: 'tree', bush: 'bush', rock: 'rock', crate: 'crate' };

export function classroomTerrain(world, cell) {
  if (!cell.blocked) return null;
  const seed = (cell.row * 17 + cell.col * 11 + world * 7) % 19;
  if (seed < 4) return null; // Quiet empty terrain keeps routes and icons readable.
  const props = worldTerrain[world] || worldTerrain[1];
  return props[(cell.row * 5 + cell.col * 3) % props.length];
}

function terrainIcon(kind) {
  return `<svg viewBox="0 0 100 100" fill="none" aria-hidden="true">${terrainProps[kind]}</svg>`;
}

// A painted-style finish flag marks the exit on the toy board.
const finishFlag = `<svg class="reference-flag" viewBox="0 0 100 100" fill="none" aria-hidden="true"><ellipse cx="50" cy="88" rx="24" ry="6" fill="#2d6b12" opacity=".35"/><path d="M30 86q20-9 40 0v4q-20 7-40 0Z" fill="#9b6b3c" stroke="#6e4823" stroke-width="2"/><rect x="36" y="13" width="6" height="74" rx="3" fill="#c08a52" stroke="#6e4823" stroke-width="2"/><circle cx="39" cy="12" r="5" fill="#ffd34a" stroke="#a5700e" stroke-width="2"/><path class="reference-flag-cloth" d="M42 17q14-6 26 1t26-1v29q-13 6-26-1t-26 1Z" fill="#ff8a1f" stroke="#a84a0c" stroke-width="2.5" stroke-linejoin="round"/><path d="M55 22h10v10H55Zm10 10h10v10H65Zm-20 0h10v10H45Z" fill="#fff4dc" opacity=".9"/><path d="M45 21q8-3 15 0" stroke="#ffe0a8" stroke-width="2.5" stroke-linecap="round"/></svg>`;

function markerIcon(tile, level) {
  if (tile === 'C' || (tile === 'E' && level.id <= 4)) return crystalIcon;
  if (tile === 'E' && usesReferenceArt(level)) return finishFlag;
  const symbols = {
    E: '<rect x="17" y="18" width="66" height="66" rx="17" fill="#D8FAE6" stroke="#39A475" stroke-width="4"/><path d="M30 50h40m-13-13 13 13-13 13" stroke="#219367" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
    B: '<rect x="26" y="20" width="48" height="65" rx="12" fill="#B1ED70" stroke="#3B752E" stroke-width="5"/><path d="M42 20v-8h16v8m-4 15-14 24h14l-7 19" stroke="#3B752E" stroke-width="6" stroke-linejoin="round"/>',
    K: '<path d="M53 52 30 80m8-10 10 9m-3-17 10 9" stroke="#92651D" stroke-width="13" stroke-linecap="round"/><circle cx="65" cy="35" r="21" fill="#FFE16C" stroke="#92651D" stroke-width="6"/><circle cx="65" cy="35" r="8" fill="#C8E783"/>',
    L: '<path d="M53 52 30 80m8-10 10 9m-3-17 10 9" stroke="#2A7187" stroke-width="13" stroke-linecap="round"/><circle cx="65" cy="35" r="21" fill="#69E0F0" stroke="#2A7187" stroke-width="6"/><circle cx="65" cy="35" r="8" fill="#C8E783"/>',
    D: '<rect x="21" y="12" width="58" height="78" rx="9" fill="#EEB964" stroke="#88682C" stroke-width="5"/><path d="M42 48v-7a8 8 0 0 1 16 0v7" stroke="#755423" stroke-width="5"/><rect x="37" y="48" width="26" height="22" rx="4" fill="#FFF1B8"/>',
    F: '<rect x="21" y="12" width="58" height="78" rx="9" fill="#77DCEB" stroke="#3C7C87" stroke-width="5"/><path d="M42 48v-7a8 8 0 0 1 16 0v7" stroke="#236371" stroke-width="5"/><rect x="37" y="48" width="26" height="22" rx="4" fill="#D6FAFF"/>',
    X: '<circle cx="50" cy="50" r="34" fill="#EF7780" stroke="#923F48" stroke-width="6"/><circle cx="50" cy="50" r="19" fill="#FFCBD0"/>',
    R: '<path d="M50 10q23 18 23 49L50 80 27 59Q27 28 50 10Z" fill="#F7F4E9" stroke="#536D8A" stroke-width="4"/><path d="M50 10q12 9 18 22H32q6-13 18-22Z" fill="#F37470"/><circle cx="50" cy="45" r="10" fill="#75DDF0" stroke="#536D8A" stroke-width="3"/><path d="m34 68-7 16m39-16 7 16" stroke="#F37470" stroke-width="10" stroke-linecap="round"/>',
    P: '<rect x="19" y="22" width="62" height="56" rx="11" fill="#FFD18A" stroke="#996839" stroke-width="4"/><rect x="30" y="32" width="40" height="36" rx="7" fill="#F4E5B6" stroke="#B58C4F" stroke-width="3"/><path d="M40 15v7m20-7v7M40 78v7m20-7v7M12 41h7m-7 18h7m62-18h7m-7 18h7" stroke="#996839" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="50" r="9" fill="#77D8DB"/>',
    a: '<rect x="21" y="16" width="58" height="70" rx="12" fill="#E7D6FF" stroke="#906DB8" stroke-width="4"/><text x="50" y="66" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="42" fill="#725193">K</text>',
    b: '<rect x="21" y="16" width="58" height="70" rx="12" fill="#E7D6FF" stroke="#906DB8" stroke-width="4"/><text x="50" y="66" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="42" fill="#725193">Ş</text>',
    c: '<rect x="21" y="16" width="58" height="70" rx="12" fill="#E7D6FF" stroke="#906DB8" stroke-width="4"/><text x="50" y="66" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="42" fill="#725193">F</text>'
  };
  const shape = symbols[tile] || '<path d="m50 15 30 19v36L50 89 20 70V34Z" fill="#FFCA72" stroke="#A97130" stroke-width="4"/><path d="m20 34 30 20 30-20M50 54v35" stroke="#A97130" stroke-width="4"/>';
  return `<svg viewBox="0 0 100 100" fill="none" aria-hidden="true">${shape}</svg>`;
}

const snapshot = state => JSON.stringify([
  state.row, state.col, state.steps, state.heading, state.won, state.error,
  state.crystals, state.batteries, state.keys, state.doors, state.items,
  state.buttons, state.readyToLaunch, state.event, state.phase
]);

export function classroomMarkerConsumed(marker, state) {
  return Boolean((marker.tile === 'E' && state.won) ||
    (marker.tile === 'R' && state.won && state.event === 'launch') ||
    (marker.tile === 'C' && state.crystals?.includes(marker.key)) ||
    (marker.tile === 'B' && state.batteries?.includes(marker.key)) ||
    (['K', 'L'].includes(marker.tile) && state.keys?.includes(marker.tile)) ||
    (['D', 'F'].includes(marker.tile) && state.doors?.includes(marker.key)) ||
    (['P', 'a', 'b', 'c'].includes(marker.tile) && state.items?.includes(marker.key)));
}

/** A persistent flat board. A new UI host never restarts the robot's current move. */
export class Classroom2D {
  constructor() {
    this.status = 'ready';
    this.reducedMotion = false;
    this.motion = null;
    this.root = null;
    this.host = null;
    this.lastState = null;
    this.signature = null;
    this.resizeObserver = null;
    this.idleTimer = null;
    this.idleEndTimer = null;
    this.now = () => performance.now();
  }

  attach(host, { level, state, theme = 'light', lang = 'en' }) {
    const signature = JSON.stringify([level.id, level.world, level.curriculum, level.grid]);
    if (signature !== this.signature) {
      this.stopIdle();
      this.clearMotion();
      this.signature = signature;
      this.level = level;
      this.layout = classroomLayout(level.grid);
      this.buildBoard();
      this.lastState = null;
    }
    this.host = host;
    this.root.dataset.theme = theme;
    this.root.lang = lang;
    host.prepend(this.root);
    const loading = host.querySelector('.scene-loading');
    if (loading) loading.hidden = true;
    this.resizeObserver?.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver ||= new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(host);
    }
    this.resize();
    this.resumeTravel();
    this.setState(state);
    this.scheduleIdle();
  }

  buildBoard() {
    this.root?.remove();
    this.root = document.createElement('div');
    this.root.className = `classroom-board${this.layout.fullGrid ? ' classroom-full-grid' : ''}${usesReferenceArt(this.level) ? ' classroom-reference-board' : ''}`;
    this.root.dataset.world = String(this.level.world || 1);
    this.root.dataset.motion = this.reducedMotion ? 'off' : 'on';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = '<div class="classroom-plane"></div>';
    this.plane = this.root.querySelector('.classroom-plane');
    this.markers = [];
    for (const cell of this.layout.cells) {
      const element = document.createElement('div');
      element.className = `classroom-tile${cell.blocked ? ' classroom-terrain' : ' classroom-route'}${cell.tile === 'S' ? ' classroom-start' : ''}${cell.tile === 'E' ? ' classroom-goal' : ''}`;
      element.dataset.cell = cell.key;
      element.dataset.walkable = String(!cell.blocked);
      element.style.left = `${(cell.col - this.layout.minCol) / this.layout.cols * 100}%`;
      element.style.top = `${(cell.row - this.layout.minRow) / this.layout.rows * 100}%`;
      const reference = usesReferenceArt(this.level);
      const originalTerrain = classroomTerrain(this.level.world || 1, cell);
      const terrain = reference ? REFERENCE_PROP[originalTerrain] || originalTerrain : originalTerrain;
      element.style.setProperty('--classroom-breeze-delay', `${-(cell.row * .37 + cell.col * .61).toFixed(2)}s`);
      const art = reference && ['tree', 'bush', 'rock', 'crate'].includes(terrain) ? `<img class="reference-prop" src="/assets/level-one-${terrain}.webp" alt="">` : terrainIcon(terrain);
      element.innerHTML = `<span class="classroom-turf" aria-hidden="true"></span>${cell.blocked ? (terrain ? `<span class="classroom-terrain-prop prop-${terrain}">${art}</span>` : '') : `<span class="classroom-flower flower-one">${flowerIcon}</span><span class="classroom-flower flower-two">${flowerIcon}</span>`}`;
      this.plane.append(element);
      if (!['.', 'S', '#'].includes(cell.tile)) {
        const marker = document.createElement('span');
        marker.className = `classroom-marker marker-${cell.tile}${cell.tile === 'C' || (cell.tile === 'E' && this.level.id <= 4) ? ' classroom-crystal' : ''}`;
        marker.style.setProperty('--classroom-crystal-delay', `${-((cell.row + cell.col) % 5) * .31}s`);
        marker.innerHTML = markerIcon(cell.tile, this.level);
        element.append(marker);
        this.markers.push({ ...cell, element: marker });
      }
    }
    this.robot = document.createElement('div');
    this.robot.className = 'classroom-robot';
    const robotArt = usesReferenceArt(this.level) ? '<span class="reference-robot-art"><img class="reference-robot" src="/assets/level-one-robot.webp" alt=""><svg class="reference-face" viewBox="0 0 1312 1199" aria-hidden="true"><path d="M465 407h150v100H465zm247 0h150v100H712z" fill="#0a0908"/><g class="reference-eyes"><path d="M490 484 Q536 391 583 484 M735 484 Q782 391 828 484" fill="none" stroke="#ffdf46" stroke-width="22" stroke-linecap="round"/></g></svg></span>' : robotIcon;
    this.robot.innerHTML = `<span class="classroom-robot-body">${robotArt}</span><span class="classroom-win-spark spark-one">✦</span><span class="classroom-win-spark spark-two">✦</span>`;
    this.plane.append(this.robot);
  }

  resize() {
    if (!this.host || !this.layout) return;
    const { width, height } = this.host.getBoundingClientRect();
    const tile = classroomTileSize(this.layout, width || 500, height || 300);
    this.root.style.setProperty('--classroom-tile', `${tile}px`);
    this.plane.style.width = `${tile * this.layout.cols}px`;
    this.plane.style.height = `${tile * this.layout.rows}px`;
  }

  setReducedMotion(reduced) {
    this.reducedMotion = Boolean(reduced);
    if (this.root) this.root.dataset.motion = reduced ? 'off' : 'on';
    if (reduced) this.stopIdle();
    else this.scheduleIdle();
    if (reduced && this.motion && this.lastState) this.cancelAnimation(this.lastState);
  }

  stopIdle() {
    clearTimeout(this.idleTimer); clearTimeout(this.idleEndTimer);
    this.idleTimer = this.idleEndTimer = null;
    this.robot?.classList.remove('idle-look-left', 'idle-look-right', 'idle-bob');
  }

  scheduleIdle() {
    if (!this.host || !this.robot || this.reducedMotion || this.idleTimer || this.idleEndTimer || !usesReferenceArt(this.level) || this.lastState?.won) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (!this.host || this.reducedMotion || this.motion || this.lastState?.won || !usesReferenceArt(this.level)) { this.scheduleIdle(); return; }
      const choices = ['idle-look-left', 'idle-look-right', 'idle-bob'];
      const choice = choices[Math.floor(Math.random() * choices.length)];
      this.robot.classList.add(choice);
      this.idleEndTimer = setTimeout(() => {
        this.robot?.classList.remove(choice);
        this.idleEndTimer = null;
        this.scheduleIdle();
      }, 1600);
    }, 2400 + Math.random() * 4400);
  }

  setState(state, animate = false) {
    if (!this.robot || !state) return;
    const stateKey = snapshot(state);
    // attach() and the following updateBoard() report the same state after a UI edit.
    if (this.motion?.stateKey === stateKey) return;
    if (!this.motion && this.lastState && snapshot(this.lastState) === stateKey) return;
    const previous = this.lastState;
    const moved = previous && (previous.row !== state.row || previous.col !== state.col);
    if (animate || state.won) this.stopIdle();
    this.clearMotion();
    this.lastState = { ...state };
    const travel = Boolean(animate && moved && !this.reducedMotion);
    const pickup = Boolean(animate && !this.reducedMotion && PICKUP_EVENTS.includes(state.event));
    const launch = Boolean(animate && !this.reducedMotion && state.event === 'launch');
    const press = Boolean(animate && !this.reducedMotion && state.event === 'button');
    this.robot.style.setProperty('transition', travel ? `left ${MOVE_MS}ms linear, top ${MOVE_MS}ms linear` : 'none', 'important');
    this.robot.classList.toggle('is-moving', travel);
    this.robot.classList.remove('is-won');
    this.robot.classList.remove('is-picking');
    const position = classroomPosition(this.layout, state);
    this.robot.style.left = `${position.x}%`;
    this.robot.style.top = `${position.y}%`;
    this.root.dataset.row = String(state.row);
    this.root.dataset.col = String(state.col);
    this.root.dataset.motion = this.reducedMotion ? 'off' : 'on';
    if (travel || pickup || launch || press) {
      const motion = { stateKey, timer: null, arrivalTimer: null, travel, from: travel ? classroomPosition(this.layout, previous) : null, to: position, started: this.now() };
      this.motion = motion;
      const beginPickup = () => {
        if (this.motion !== motion) return;
        this.robot.classList.remove('is-moving');
        this.robot.classList.add('is-picking');
        for (const marker of this.markers) marker.element.classList.toggle('is-collecting', classroomMarkerConsumed(marker, state));
      };
      if (pickup) {
        if (travel) motion.arrivalTimer = setTimeout(beginPickup, MOVE_MS);
        else beginPickup();
      }
      if (launch) this.markers.filter(marker => marker.tile === 'R').forEach(marker => marker.element.classList.add('is-launching'));
      if (press) this.markers.filter(marker => marker.tile === 'X' && marker.key === `${state.row},${state.col}`).forEach(marker => marker.element.classList.add('is-pressed'));
      const duration = (travel ? MOVE_MS : 0) + (pickup ? PICKUP_MS : launch ? LAUNCH_MS : press ? PRESS_MS : 0);
      motion.timer = setTimeout(() => {
        if (this.motion !== motion) return;
        this.motion = null;
        this.robot.classList.remove('is-moving');
        this.paintState(state);
        this.scheduleIdle();
      }, duration);
    } else { this.paintState(state); this.scheduleIdle(); }
  }

  paintState(state) {
    this.robot.classList.toggle('is-won', Boolean(state.won));
    this.robot.classList.toggle('has-error', Boolean(state.error));
    this.robot.classList.remove('is-picking');
    this.root.dataset.won = String(Boolean(state.won));
    for (const marker of this.markers) {
      marker.element.hidden = classroomMarkerConsumed(marker, state);
      marker.element.classList.remove('is-collecting');
      marker.element.classList.remove('is-launching');
      marker.element.classList.toggle('is-ready', marker.tile === 'R' && Boolean(state.readyToLaunch) && !state.won);
      marker.element.classList.toggle('is-pressed', marker.tile === 'X' && Boolean(state.buttons?.includes(marker.key)));
    }
  }

  resumeTravel() {
    const motion = this.motion;
    if (!motion?.travel || this.reducedMotion) return;
    const elapsed = Math.max(0, this.now() - motion.started);
    if (elapsed >= MOVE_MS) return;
    // Removing a node stops its CSS transition. Continue from the same elapsed
    // position when a new UI host receives this persistent board.
    const progress = elapsed / MOVE_MS;
    this.robot.style.setProperty('transition', 'none', 'important');
    this.robot.style.left = `${motion.from.x + (motion.to.x - motion.from.x) * progress}%`;
    this.robot.style.top = `${motion.from.y + (motion.to.y - motion.from.y) * progress}%`;
    this.robot.getBoundingClientRect?.();
    const remaining = MOVE_MS - elapsed;
    this.robot.style.setProperty('transition', `left ${remaining}ms linear, top ${remaining}ms linear`, 'important');
    this.robot.style.left = `${motion.to.x}%`;
    this.robot.style.top = `${motion.to.y}%`;
  }

  clearMotion() {
    if (this.motion) {
      clearTimeout(this.motion.timer);
      clearTimeout(this.motion.arrivalTimer);
    }
    this.robot?.classList.remove('is-picking');
    this.markers?.forEach(marker => {
      marker.element.classList.remove('is-collecting');
      marker.element.classList.remove('is-launching');
    });
    this.motion = null;
  }

  cancelAnimation(state = this.lastState) {
    this.clearMotion();
    this.lastState = null;
    this.setState(state, false);
  }

  detach() {
    this.stopIdle();
    this.clearMotion();
    this.resizeObserver?.disconnect();
    this.root?.remove();
    this.host = null;
  }
}
