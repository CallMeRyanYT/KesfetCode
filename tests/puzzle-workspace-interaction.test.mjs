import test from 'node:test';
import assert from 'node:assert/strict';
import { createPuzzleWorkspace, movePuzzleStack, mountPuzzleInteractions } from '../dist/puzzle-workspace.js';

class Surface extends EventTarget {
  constructor(kind, rect = {}) {
    super(); this.kind = kind; this.rect = rect; this.children = []; this.dataset = {}; this.style = {}; this.scrollTop = 0; this.scrollLeft = 0; this.hidden = false;
    const classes = new Set();
    this.classList = { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
  }
  getBoundingClientRect() { return this.rect; }
  closest(selector) {
    if (this.kind === 'palette' && selector.includes('[data-add]')) return this;
    if (this.kind === 'card' && selector.includes('[data-puzzle-index]')) return this;
    if (this.kind === 'count' && selector.includes('.direction-count')) return this;
    return null;
  }
  setAttribute() {}
  append(node) { this.children.push(node); node.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.removed = true; }
}

function setup() {
  const saved = Object.fromEntries(['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, globalThis[key]]));
  const root = new Surface('root'), doc = new Surface('document'), windowSurface = new Surface('window'), body = new Surface('body');
  const canvas = new Surface('canvas', { left: 100, top: 100, right: 600, bottom: 600, width: 500, height: 500 });
  const plane = new Surface('plane'), trash = new Surface('trash', { left: 0, top: 450, right: 80, bottom: 520 });
  const palette = new Surface('palette', { left: 0, top: 100, right: 88, bottom: 158, width: 88, height: 58 }); palette.dataset.add = 'up';
  const card = new Surface('card', { left: 130, top: 182, right: 294, bottom: 240, width: 164, height: 58 }); card.dataset.puzzleStack = 'start'; card.dataset.puzzleIndex = '0';
  const count = new Surface('count');
  root.querySelector = selector => selector === '.puzzle-canvas' ? canvas : selector === '.puzzle-plane' ? plane : selector === '[data-puzzle-trash]' ? trash : null;
  root.querySelectorAll = selector => selector.includes('[data-puzzle-stack=') ? [card] : [card, trash];
  doc.createElement = () => new Surface('created'); doc.body = body;
  globalThis.document = doc; globalThis.window = windowSurface;
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  let model = createPuzzleWorkspace(), drops = 0;
  const dispose = mountPuzzleInteractions(root, {
    getWorkspace: () => model,
    renderGhost: () => '<div>Up</div>',
    onDrop: (source, destination) => { drops++; model = movePuzzleStack(model, source, destination); },
  });
  const emit = (surface, type, target, properties = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'target', { value: target });
    Object.assign(event, { pointerId: 1, button: 0, clientX: 20, clientY: 120, ...properties });
    surface.dispatchEvent(event); return event;
  };
  return { root, doc, canvas, plane, body, palette, card, count, emit, get model() { return model; }, set model(value) { model = value; }, get drops() { return drops; }, cleanup() { dispose(); Object.assign(globalThis, saved); } };
}

test('pointer dragging previews a connector and commits the real block only on release', () => {
  const ui = setup();
  try {
    ui.emit(ui.root, 'pointerdown', ui.palette);
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 150, clientY: 202 });
    assert.equal(ui.model.connected.length, 0);
    assert.equal(ui.drops, 0);
    assert.equal(ui.body.children.length, 1);
    assert.equal(ui.plane.children[0].hidden, false);
    assert.equal(ui.plane.children[0].style.left, '30px');
    assert.equal(ui.plane.children[0].style.top, '82px');
    ui.emit(ui.doc, 'pointerup', ui.palette, { clientX: 150, clientY: 202 });
    assert.deepEqual(ui.model.connected, [{ type: 'up' }]);
    assert.equal(ui.drops, 1);
    assert.equal(ui.body.children.length, 0);
    assert.equal(ui.plane.children.length, 0);
  } finally { ui.cleanup(); }
});

test('dragging a placed stack over the toolbox highlights it and deletes on release', () => {
  const ui = setup();
  try {
    ui.model = createPuzzleWorkspace([{ type: 'up' }, { type: 'down' }]);
    ui.emit(ui.root, 'pointerdown', ui.card, { clientX: 150, clientY: 202 });
    ui.emit(ui.doc, 'pointermove', ui.card, { clientX: 40, clientY: 480 });
    assert.equal(ui.root.querySelector('[data-puzzle-trash]').classList.contains('puzzle-trash-active'), true);
    assert.equal(ui.model.connected.length, 2);
    ui.emit(ui.doc, 'pointerup', ui.card, { clientX: 40, clientY: 480 });
    assert.equal(ui.model.connected.length, 0);
    assert.equal(ui.root.querySelector('[data-puzzle-trash]').classList.contains('puzzle-trash-active'), false);
  } finally { ui.cleanup(); }
});

test('dragging a palette block over the toolbox does not activate deletion', () => {
  const ui = setup();
  try {
    ui.emit(ui.root, 'pointerdown', ui.palette);
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 40, clientY: 480 });
    assert.equal(ui.root.querySelector('[data-puzzle-trash]').classList.contains('puzzle-trash-active'), false);
    ui.emit(ui.doc, 'pointerup', ui.palette, { clientX: 40, clientY: 480 });
    assert.equal(ui.model.connected.length, 0);
  } finally { ui.cleanup(); }
});

test('gliding over Start follows the grab point freely; a distant release parks clear without attaching', () => {
  const ui = setup();
  try {
    ui.emit(ui.root, 'pointerdown', ui.palette);
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 150, clientY: 144 });
    const ghost = ui.body.children[0], cue = ui.plane.children[0];
    assert.equal(ghost.classList.contains('puzzle-is-snapped'), false);
    assert.equal(ghost.style.left, '130px');
    assert.equal(ghost.style.top, '124px');
    assert.equal(cue.hidden, true);
    assert.deepEqual(ui.model.connected, []);
    assert.deepEqual(ui.model.detached, []);
    ui.emit(ui.doc, 'pointerup', ui.palette, { clientX: 150, clientY: 144 });
    assert.deepEqual(ui.model.connected, []);
    assert.equal(ui.model.detached.length, 1);
    assert.equal(ui.model.detached[0].x, 30);
    assert.equal(ui.model.detached[0].y, 102);
  } finally { ui.cleanup(); }
});

test('passing connected blocks neither attracts the ghost nor moves the target; only the release connector wins', () => {
  const ui = setup(); ui.model = createPuzzleWorkspace([{ type: 'right' }]);
  try {
    ui.emit(ui.root, 'pointerdown', ui.palette);
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 150, clientY: 202 });
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 150, clientY: 231 });
    assert.equal(ui.plane.children[0].hidden, true);
    assert.equal(ui.body.children[0].style.top, '211px');
    assert.equal(ui.card.style.transform, undefined);
    assert.equal(ui.card.classList.contains('puzzle-preview-shift'), false);
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 150, clientY: 239 });
    assert.equal(ui.plane.children[0].style.top, '140px');
    assert.equal(ui.body.children[0].style.top, '219px');
    assert.equal(ui.card.style.transform, undefined);
    assert.deepEqual(ui.model.connected, [{ type: 'right' }]);
    ui.emit(ui.doc, 'pointerup', ui.palette, { clientX: 150, clientY: 239 });
    assert.deepEqual(ui.model.connected, [{ type: 'right' }, { type: 'up' }]);
  } finally { ui.cleanup(); }
});

test('a near connector cue never pulls the held block into place, but release attaches it', () => {
  const ui = setup();
  try {
    ui.emit(ui.root, 'pointerdown', ui.palette);
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 155, clientY: 208 });
    assert.equal(ui.body.children[0].style.left, '135px');
    assert.equal(ui.body.children[0].style.top, '188px');
    assert.equal(ui.plane.children[0].style.left, '30px');
    assert.equal(ui.plane.children[0].style.top, '82px');
    assert.equal(ui.body.children[0].classList.contains('puzzle-is-snapped'), false);
    assert.deepEqual(ui.model.connected, []);
    ui.emit(ui.doc, 'pointerup', ui.palette, { clientX: 155, clientY: 208 });
    assert.deepEqual(ui.model.connected, [{ type: 'up' }]);
  } finally { ui.cleanup(); }
});

test('a suffix glides freely over a loose target and joins only upon release near its connector', () => {
  const ui = setup(); ui.model = createPuzzleWorkspace([{ type: 'down' }, { type: 'left', count: 2 }, { type: 'right' }]);
  ui.model.detached = [
    { id: 'loose-1', x: 300, y: 350, blocks: [{ type: 'collect' }] },
    { id: 'loose-2', x: 300, y: 100, blocks: [{ type: 'up' }, { type: 'up', count: 4 }] },
  ];
  ui.model.nextId = 3;
  const first = new Surface('card'), tail = new Surface('card');
  first.dataset.puzzleStack = tail.dataset.puzzleStack = 'loose-2';
  first.dataset.puzzleIndex = '0'; tail.dataset.puzzleIndex = '1';
  ui.root.querySelectorAll = selector => selector.includes('[data-puzzle-stack="loose-2"]') ? [first, tail]
    : selector.includes('[data-puzzle-stack=') ? [ui.card] : [ui.card, first, tail];
  try {
    ui.emit(ui.root, 'pointerdown', ui.card, { clientX: 150, clientY: 202 });
    ui.emit(ui.doc, 'pointermove', ui.card, { clientX: 420, clientY: 278 });
    assert.equal(ui.plane.children[0].style.left, '300px');
    assert.equal(ui.plane.children[0].style.top, '158px');
    assert.equal(ui.body.children[0].style.left, '400px');
    assert.equal(ui.body.children[0].style.top, '258px');
    assert.equal(tail.style.transform, undefined);
    assert.equal(first.style.transform, undefined);
    assert.equal(ui.model.connected.length, 3);
    ui.emit(ui.doc, 'pointerup', ui.card, { clientX: 420, clientY: 278 });
    const target = ui.model.detached.find(stack => stack.id === 'loose-2');
    assert.equal(target.x, 300); assert.equal(target.y, 100);
    assert.equal(target.y + 58, 158);
    assert.deepEqual(target.blocks, [{ type: 'up' }, { type: 'down' }, { type: 'left', count: 2 }, { type: 'right' }, { type: 'up', count: 4 }]);
    assert.deepEqual(ui.model.connected, []);
    assert.equal(tail.style.transform, undefined);
  } finally { ui.cleanup(); }
});

test('scaled and scrolled canvas geometry keeps the ghost, preview and committed connector aligned', () => {
  const ui = setup();
  ui.canvas.scrollLeft = 20; ui.canvas.scrollTop = 60;
  ui.canvas.rect = { left: 100, top: 100, right: 850, bottom: 850, width: 750, height: 750 };
  ui.plane.offsetWidth = 340; ui.plane.offsetHeight = 360;
  ui.plane.rect = { left: 70, top: 10, width: 510, height: 540 };
  ui.palette.rect = { left: 0, top: 100, right: 132, bottom: 187, width: 132, height: 87 };
  try {
    ui.emit(ui.root, 'pointerdown', ui.palette, { clientX: 30, clientY: 130 });
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 145, clientY: 163 });
    assert.equal(ui.plane.children[0].style.left, '30px');
    assert.equal(ui.plane.children[0].style.top, '82px');
    assert.equal(ui.body.children[0].style.left, '115px');
    assert.equal(ui.body.children[0].style.top, '133px');
    assert.equal(ui.body.children[0].style.scale, '1.5 1.5');
    ui.emit(ui.doc, 'pointerup', ui.palette, { clientX: 145, clientY: 163 });
    assert.deepEqual(ui.model.connected, [{ type: 'up' }]);
  } finally { ui.cleanup(); }
});

test('the exact right-edge grab point is preserved while moving a suffix onto blank canvas', () => {
  const ui = setup(); ui.model = createPuzzleWorkspace([{ type: 'up', count: 4 }]);
  try {
    ui.emit(ui.root, 'pointerdown', ui.card, { clientX: 293, clientY: 235 });
    ui.emit(ui.doc, 'pointermove', ui.card, { clientX: 500, clientY: 430 });
    assert.equal(ui.body.children[0].style.left, '337px');
    assert.equal(ui.body.children[0].style.top, '377px');
    ui.emit(ui.doc, 'pointerup', ui.card, { clientX: 500, clientY: 430 });
    assert.equal(ui.model.detached[0].x, 237);
    assert.equal(ui.model.detached[0].y, 277);
    assert.deepEqual(ui.model.detached[0].blocks, [{ type: 'up', count: 4 }]);
  } finally { ui.cleanup(); }
});

test('dragging a connected card onto blank canvas leaves visible loose blocks that do not execute', () => {
  const ui = setup(); ui.model = createPuzzleWorkspace([{ type: 'up', count: 4 }, { type: 'left' }]);
  try {
    ui.emit(ui.root, 'pointerdown', ui.card, { clientX: 150, clientY: 202 });
    ui.emit(ui.doc, 'pointermove', ui.card, { clientX: 430, clientY: 330 });
    assert.equal(ui.model.connected.length, 2);
    ui.emit(ui.doc, 'pointerup', ui.card, { clientX: 430, clientY: 330 });
    assert.deepEqual(ui.model.connected, []);
    assert.deepEqual(ui.model.detached[0].blocks, [{ type: 'up', count: 4 }, { type: 'left' }]);
    assert.equal(ui.card.classList.contains('puzzle-being-dragged'), false);
  } finally { ui.cleanup(); }
});

test('Escape, pointer cancellation, and outside drops preserve the original program', () => {
  for (const end of ['Escape', 'pointercancel', 'outside']) {
    const ui = setup(); ui.model = createPuzzleWorkspace([{ type: 'up' }]); const original = ui.model;
    try {
      ui.emit(ui.root, 'pointerdown', ui.card, { clientX: 150, clientY: 202 });
      ui.emit(ui.doc, 'pointermove', ui.card, { clientX: 430, clientY: 330 });
      if (end === 'Escape') ui.emit(ui.doc, 'keydown', ui.card, { key: 'Escape' });
      else if (end === 'pointercancel') ui.emit(ui.doc, 'pointercancel', ui.card);
      else ui.emit(ui.doc, 'pointerup', ui.card, { clientX: 900, clientY: 900 });
      assert.equal(ui.model, original);
      assert.equal(ui.drops, 0);
      assert.equal(ui.body.children.length, 0);
    } finally { ui.cleanup(); }
  }
});

test('count buttons and a simple palette click do not begin a drag gesture', () => {
  const ui = setup();
  try {
    ui.emit(ui.root, 'pointerdown', ui.count);
    ui.emit(ui.doc, 'pointermove', ui.count, { clientX: 150, clientY: 202 });
    ui.emit(ui.doc, 'pointerup', ui.count, { clientX: 150, clientY: 202 });
    ui.emit(ui.root, 'pointerdown', ui.palette);
    ui.emit(ui.doc, 'pointerup', ui.palette);
    assert.equal(ui.drops, 0);
    assert.equal(ui.body.children.length, 0);
  } finally { ui.cleanup(); }
});

test('a cancelled gesture suppresses its compatibility click while a fresh click remains usable', () => {
  const ui = setup(); ui.model = createPuzzleWorkspace([{ type: 'right' }]);
  try {
    ui.emit(ui.root, 'pointerdown', ui.palette);
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 150, clientY: 202 });
    assert.equal(ui.card.style.transform, undefined);
    ui.emit(ui.doc, 'keydown', ui.palette, { key: 'Escape' });
    assert.equal(ui.card.style.transform, undefined);
    assert.deepEqual(ui.model.connected, [{ type: 'right' }]);
    assert.equal(ui.emit(ui.root, 'click', ui.palette).defaultPrevented, true);
    ui.emit(ui.root, 'pointerdown', ui.palette);
    ui.emit(ui.doc, 'pointerup', ui.palette);
    assert.equal(ui.emit(ui.root, 'click', ui.palette).defaultPrevented, false);
    assert.equal(ui.drops, 0);
  } finally { ui.cleanup(); }
});

test('a second touch cannot replace, commit, or cancel the active drag', () => {
  const ui = setup();
  try {
    ui.emit(ui.root, 'pointerdown', ui.palette);
    ui.emit(ui.doc, 'pointermove', ui.palette, { clientX: 150, clientY: 202 });
    ui.emit(ui.root, 'pointerdown', ui.card, { pointerId: 2, isPrimary: false });
    ui.emit(ui.doc, 'pointercancel', ui.card, { pointerId: 2 });
    ui.emit(ui.doc, 'pointerup', ui.card, { pointerId: 2, clientX: 430, clientY: 330 });
    assert.equal(ui.drops, 0);
    assert.equal(ui.body.children.length, 1);
    ui.emit(ui.doc, 'pointerup', ui.palette, { clientX: 150, clientY: 202 });
    assert.deepEqual(ui.model.connected, [{ type: 'up' }]);
  } finally { ui.cleanup(); }
});

test('native drag fallback uses the same snap model and carries counted cards intact', () => {
  const ui = setup();
  try {
    let hiddenNativeImage = false;
    const transfer = {
      setData(type, value) { assert.equal(type, 'text/plain'); assert.equal(value, 'kesfet-puzzle-block'); },
      setDragImage(image, x, y) { assert.equal(image.width, 1); assert.equal(image.height, 1); assert.equal(x, 0); assert.equal(y, 0); hiddenNativeImage = true; }
    };
    ui.emit(ui.root, 'dragstart', ui.palette, { dataTransfer: transfer });
    assert.equal(hiddenNativeImage, true);
    ui.emit(ui.root, 'dragover', ui.canvas, { clientX: 160, clientY: 202, dataTransfer: transfer });
    ui.emit(ui.root, 'drop', ui.canvas, { clientX: 160, clientY: 202, dataTransfer: transfer });
    assert.deepEqual(ui.model.connected, [{ type: 'up' }]);
    assert.equal(ui.drops, 1);
    assert.equal(ui.body.children.length, 0);
  } finally { ui.cleanup(); }
});

test('native dragging uses its actual grab offset instead of a fixed hotspot', () => {
  const ui = setup();
  try {
    const transfer = { setData() {} };
    ui.emit(ui.root, 'dragstart', ui.palette, { clientX: 70, clientY: 150, dataTransfer: transfer });
    ui.emit(ui.root, 'dragover', ui.canvas, { clientX: 400, clientY: 390, dataTransfer: transfer });
    assert.equal(ui.body.children[0].style.left, '330px');
    assert.equal(ui.body.children[0].style.top, '340px');
    ui.emit(ui.root, 'drop', ui.canvas, { clientX: 400, clientY: 390, dataTransfer: transfer });
    assert.deepEqual(ui.model.connected, []);
    assert.equal(ui.model.detached[0].x, 230);
    assert.equal(ui.model.detached[0].y, 240);
  } finally { ui.cleanup(); }
});
