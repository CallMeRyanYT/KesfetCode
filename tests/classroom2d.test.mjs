import test from 'node:test';
import assert from 'node:assert/strict';
import { Classroom2D, classroomLayout, classroomPosition, classroomTileSize, classroomTerrain, classroomMarkerConsumed } from '../dist/classroom2d.js';
import { MOVE_MS, PICKUP_MS, LAUNCH_MS } from '../dist/robot-motion.js';

function element() {
  const classes = new Set();
  return {
    dataset: {},
    style: { setProperty(name, value) { this[name] = value; } },
    classList: {
      add(name) { classes.add(name); },
      toggle(name, value) { if (value) classes.add(name); else classes.delete(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    remove() { this.removed = true; }
  };
}

const state = (overrides = {}) => ({ row: 1, col: 1, steps: 0, heading: 'right', won: false, error: null, crystals: [], batteries: [], keys: [], items: [], doors: [], buttons: [], readyToLaunch: false, event: null, phase: 0, ...overrides });
function fixture() {
  const board = new Classroom2D();
  board.builds = 0;
  board.buildBoard = function () {
    this.builds++;
    this.root = element();
    this.plane = element();
    this.robot = element();
    this.markers = this.layout.cells.filter(cell => !['.', 'S', '#'].includes(cell.tile)).map(cell => ({ ...cell, element: element() }));
  };
  const host = () => ({
    loading: { hidden: false },
    prepend(root) { this.root = root; },
    querySelector() { return this.loading; },
    getBoundingClientRect() { return { width: 355, height: 288 }; }
  });
  const level = { id: 1, curriculum: 0, grid: ['#####', '#S.E#', '#####'] };
  board.attach(host(), { level, state: state() });
  return { board, level, host };
}

function renderedFixture(t, level, reduced = false) {
  const previousDocument = globalThis.document;
  const createElement = () => ({
    ...element(), children: [],
    append(child) { this.children.push(child); },
    setAttribute(name, value) { this[name] = value; },
    querySelector(selector) {
      if (selector === '.classroom-plane') return this.plane ||= createElement();
      return null;
    }
  });
  globalThis.document = { createElement };
  let board;
  t.after(() => {
    board?.detach();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  board = new Classroom2D();
  board.setReducedMotion(reduced);
  const host = {
    prepend(root) { this.root = root; }, querySelector() { return null; },
    getBoundingClientRect() { return { width: 700, height: 700 }; }
  };
  board.attach(host, { level, state: state() });
  return { board, host };
}

test('Playable rows and columns map to literal screen directions without rotating the board', () => {
  const horizontal = classroomLayout(['#####', '#E.S#', '#####']);
  assert.equal(horizontal.rows, 1);
  assert.equal(horizontal.cols, 3);
  assert.equal(horizontal.cells.length, 3);
  assert.ok(Math.abs(classroomPosition(horizontal, { row: 1, col: 1 }).x - 100 / 6) < 1e-10);
  assert.ok(Math.abs(classroomPosition(horizontal, { row: 1, col: 3 }).x - 500 / 6) < 1e-10);
  const vertical = classroomLayout(['#####', '##S##', '##.##', '##E##', '#####']);
  const start = classroomPosition(vertical, { row: 1, col: 2 });
  const end = classroomPosition(vertical, { row: 3, col: 2 });
  assert.equal(start.x, end.x);
  assert.ok(start.y < end.y);
  const bend = classroomLayout(['#####', '#S.##', '##.E#', '#####']);
  assert.equal(bend.cells.length, 4);
  assert.equal(bend.cols, 3);
  assert.equal(bend.rows, 2);
});

test('Five equal horizontal tiles and a three tile vertical route fit phone and desktop scenes', () => {
  for (const [width, height] of [[1000, 288], [355, 320], [320, 288]]) {
    for (const grid of [['#######', '#S...E#', '#######'], ['#####', '##S##', '##.##', '##E##', '#####']]) {
      const layout = classroomLayout(grid);
      const tile = classroomTileSize(layout, width, height);
      assert.ok(tile * layout.cols <= width - 28);
      assert.ok(tile * layout.rows <= height - 46);
      assert.ok(tile >= 58, 'Opening route icons remain legible on a phone');
    }
  }
});

test('An attach during movement preserves the robot element, animation and visible crystal until arrival', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { board, level, host } = fixture();
  const root = board.root;
  const won = state({ col: 3, steps: 2, won: true });
  board.setState(won, true);
  const motion = board.motion;
  assert.equal(board.markers[0].element.hidden, false);
  const nextHost = host();
  board.attach(nextHost, { level: { ...level }, state: { ...won }, theme: 'dark', lang: 'tr' });
  board.setState({ ...won });
  assert.equal(board.root, root);
  assert.equal(board.motion, motion);
  assert.equal(board.builds, 1);
  assert.equal(nextHost.loading.hidden, true);
  assert.equal(board.root.dataset.theme, 'dark');
  t.mock.timers.tick(MOVE_MS - 1);
  assert.equal(board.markers[0].element.hidden, false);
  t.mock.timers.tick(1);
  assert.equal(board.markers[0].element.hidden, true);
  assert.equal(board.robot.classList.contains('is-won'), true);
  assert.equal(board.motion, null);
});

test('A UI rerender resumes a half-finished visual move with the original arrival deadline', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { board, level, host } = fixture();
  let now = 0;
  board.now = () => now;
  const target = state({ col: 3, steps: 2, won: true });
  board.setState(target, true);
  const motion = board.motion;
  let resumedPosition;
  board.robot.getBoundingClientRect = () => { resumedPosition = { left: parseFloat(board.robot.style.left), top: parseFloat(board.robot.style.top) }; };
  now = MOVE_MS / 2;
  t.mock.timers.tick(MOVE_MS / 2);
  board.attach(host(), { level, state: { ...target } });
  assert.ok(Math.abs(resumedPosition.left - 50) < 1e-10);
  assert.equal(resumedPosition.top, 50);
  assert.equal(board.robot.style.transition, `left ${MOVE_MS / 2}ms linear, top ${MOVE_MS / 2}ms linear`);
  assert.ok(Math.abs(parseFloat(board.robot.style.left) - 500 / 6) < 1e-10);
  assert.equal(board.motion, motion);
  t.mock.timers.tick(MOVE_MS / 2);
  assert.equal(board.motion, null);
  assert.equal(board.markers[0].element.hidden, true);
});

test('Replay cancels a pending arrival and restores the crystal and exact start coordinates', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { board } = fixture();
  board.setState(state({ col: 3, steps: 2, won: true }), true);
  board.cancelAnimation(state());
  assert.ok(Math.abs(parseFloat(board.robot.style.left) - 100 / 6) < 1e-10);
  assert.equal(board.robot.style.top, '50%');
  assert.equal(board.robot.style.transition, 'none');
  assert.equal(board.markers[0].element.hidden, false);
  t.mock.timers.tick(MOVE_MS * 2);
  assert.equal(board.markers[0].element.hidden, false);
  assert.equal(board.robot.classList.contains('is-won'), false);
});

test('Turning animations off snaps an active move; switching levels cannot receive a stale win', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { board, host, level } = fixture();
  board.setState(state({ col: 3, steps: 2, won: true }), true);
  board.setReducedMotion(true);
  assert.equal(board.motion, null);
  assert.equal(board.robot.style.transition, 'none');
  assert.equal(board.markers[0].element.hidden, true);
  board.setReducedMotion(false);
  board.cancelAnimation(state());
  board.setState(state({ col: 3, steps: 2, won: true }), true);
  board.attach(host(), { level: { ...level, id: 2, grid: ['#####', '#E.S#', '#####'] }, state: state({ col: 3 }) });
  t.mock.timers.tick(MOVE_MS * 2);
  assert.equal(board.builds, 2);
  assert.equal(board.markers[0].element.hidden, false);
  assert.equal(board.robot.classList.contains('is-won'), false);
});

test('An 8 by 8 campaign board has 64 cells and preserves blocked terrain around its route', () => {
  const grid = ['########', '########', '########', '###E####', '###.####', '###S####', '########', '########'];
  const layout = classroomLayout(grid);
  assert.equal(layout.cells.length, 64);
  assert.equal(layout.cells.filter(cell => !cell.blocked).length, 3);
  assert.equal(layout.rows, 8);
  assert.equal(layout.cols, 8);
  assert.equal(layout.minRow, 0);
  assert.equal(layout.minCol, 0);
  assert.deepEqual(classroomPosition(layout, { row: 5, col: 3 }), { x: 43.75, y: 68.75 });
  for (const [width, height] of [[1000, 440], [355, 390], [320, 390]]) {
    const tile = classroomTileSize(layout, width, height);
    assert.ok(tile * 8 <= width - 28);
    assert.ok(tile * 8 <= height - 46);
    assert.ok(tile >= 36, 'Icons remain large enough on narrow phone boards');
  }
});

test('Decorative props only use blocked terrain and each world has a distinct theme', () => {
  const layout = classroomLayout(['########', '########', '########', '###E####', '###.####', '###S####', '########', '########']);
  const expected = {
    1: ['planter', 'bush', 'rock', 'tree'], 2: ['bush', 'post', 'rock', 'planter'],
    3: ['tree', 'rock', 'bush'], 4: ['solar', 'bush', 'cable', 'console'],
    5: ['crate', 'bush', 'console', 'rock'], 6: ['rock', 'dish', 'console', 'crate']
  };
  for (const world of [1, 2, 3, 4, 5, 6]) {
    const props = new Set();
    for (const cell of layout.cells) {
      const kind = classroomTerrain(world, cell);
      assert.equal(classroomTerrain(world, cell), kind, 'Scenery stays stable across rerenders');
      if (!cell.blocked) assert.equal(kind, null);
      if (kind) { assert.ok(expected[world].includes(kind)); props.add(kind); }
    }
    assert.ok(props.size >= 3);
  }
});

test('Every Explorer mission uses the painted mission-one board, props, robot and finish flag', t => {
  const grid = ['########', '########', '########', '#SC.E###', '########', '########', '########', '########'];
  const { board } = renderedFixture(t, { id: 7, world: 1, curriculum: 0, grid });
  const crystal = board.markers.find(marker => marker.tile === 'C');
  const exit = board.markers.find(marker => marker.tile === 'E');
  assert.ok(crystal.element.className.includes('classroom-crystal'));
  assert.ok(crystal.element.innerHTML.includes('classroom-crystal-gem'));
  assert.ok(crystal.element.innerHTML.includes('classroom-crystal-shadow'));
  assert.ok(!exit.element.className.includes('classroom-crystal'));
  const terrain = board.plane.children.filter(child => child.dataset.walkable === 'false');
  assert.ok(board.root.className.includes('classroom-reference-board'));
  assert.ok(terrain.some(tile => /level-one-(tree|bush|rock|crate)\.webp/.test(tile.innerHTML)));
  assert.ok(terrain.every(tile => !/classroom-tree-crown|prop-(post|planter)/.test(tile.innerHTML)));
  assert.ok(exit.element.innerHTML.includes('reference-flag'));
  const path = board.plane.children.filter(child => child.dataset.walkable === 'true');
  assert.equal(path.length, 4);
  assert.ok(path.every(tile => !tile.innerHTML.includes('classroom-terrain-prop')));
  assert.ok(board.robot.innerHTML.includes('level-one-robot.webp'));
});

test('Ambient Motion preference is applied before the board appears and survives reattachment and level changes', t => {
  const level = { id: 1, world: 1, curriculum: 0, grid: ['#####', '#SE##', '#####'] };
  const { board, host } = renderedFixture(t, level, true);
  const goal = board.markers.find(marker => marker.tile === 'E');
  assert.ok(goal.element.innerHTML.includes('classroom-crystal-gem'), 'Mission one uses the original crystal artwork');
  assert.ok(!goal.element.innerHTML.includes('level-one-crystal.webp'));
  assert.equal(board.root.dataset.motion, 'off');
  assert.ok(board.markers[0].element.className.includes('classroom-crystal'), 'Opening crystal goal floats like later collectibles');
  const root = board.root;
  board.attach(host, { level, state: state(), lang: 'tr' });
  assert.equal(board.root, root);
  assert.equal(board.root.dataset.motion, 'off');
  board.setReducedMotion(false);
  assert.equal(board.root.dataset.motion, 'on');
  board.attach(host, { level: { ...level, id: 2 }, state: state() });
  assert.notEqual(board.root, root);
  assert.equal(board.root.dataset.motion, 'on');
  assert.equal(board.motion, null, 'Ambient art does not create or extend a gameplay move');
});

test('Markers disappear only after their own collectible or door state; pressed consoles and launch readiness stay visible', () => {
  const marker = (tile, key = '1,2') => ({ tile, key });
  const gathered = state({ crystals: ['1,2'], batteries: ['1,2'], keys: ['K'], doors: ['1,2'], items: ['1,2'], buttons: ['1,2'], readyToLaunch: true });
  for (const tile of ['C', 'B', 'K', 'D', 'F', 'P', 'a', 'b', 'c']) assert.equal(classroomMarkerConsumed(marker(tile), gathered), true);
  assert.equal(classroomMarkerConsumed(marker('L'), gathered), false);
  assert.equal(classroomMarkerConsumed(marker('C', '3,4'), gathered), false);
  assert.equal(classroomMarkerConsumed(marker('X'), gathered), false);
  assert.equal(classroomMarkerConsumed(marker('R'), gathered), false);
  assert.equal(classroomMarkerConsumed(marker('E'), gathered), false);
  assert.equal(classroomMarkerConsumed(marker('E'), { ...gathered, won: true }), true);
  assert.equal(classroomMarkerConsumed(marker('R'), { ...gathered, won: true, event: 'launch' }), true);
});

test('A moving battery pickup finishes after arrival and pickup, and replay cancels both phases', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { board, host, level } = fixture();
  board.attach(host(), { level: { ...level, grid: ['#####', '#SBE#', '#####'] }, state: state() });
  const charged = state({ col: 2, steps: 1, event: 'battery', batteries: ['1,2'] });
  board.setState(charged, true);
  t.mock.timers.tick(MOVE_MS);
  assert.equal(board.markers[0].element.hidden, false);
  assert.equal(board.markers[0].element.classList.contains('is-collecting'), true);
  t.mock.timers.tick(PICKUP_MS);
  assert.equal(board.markers[0].element.hidden, true);
  board.cancelAnimation(state());
  board.setState(charged, true);
  board.cancelAnimation(state());
  t.mock.timers.tick(MOVE_MS + PICKUP_MS);
  assert.equal(board.markers[0].element.hidden, false);
  assert.equal(board.markers[0].element.classList.contains('is-collecting'), false);
});

test('The ready rocket remains visible until a launch finishes, and restart removes a stale departure', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { board, level, host } = fixture();
  board.attach(host(), { level: { ...level, id: 30, grid: ['#####', '#SR.#', '#####'] }, state: state() });
  const ready = state({ col: 2, steps: 1, readyToLaunch: true, event: 'ready', phase: 5 });
  board.setState(ready);
  assert.equal(board.markers[0].element.classList.contains('is-ready'), true);
  const launched = { ...ready, readyToLaunch: false, steps: 2, won: true, event: 'launch' };
  board.setState(launched, true);
  assert.equal(board.markers[0].element.hidden, false);
  assert.equal(board.markers[0].element.classList.contains('is-launching'), true);
  t.mock.timers.tick(LAUNCH_MS);
  assert.equal(board.markers[0].element.hidden, true);
  board.cancelAnimation(state());
  board.setState(ready);
  board.setState(launched, true);
  board.cancelAnimation(state());
  t.mock.timers.tick(LAUNCH_MS);
  assert.equal(board.markers[0].element.hidden, false);
  assert.equal(board.markers[0].element.classList.contains('is-launching'), false);
});
