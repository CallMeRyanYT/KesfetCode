import test from 'node:test';
import assert from 'node:assert/strict';
import { createPuzzleWorkspace, puzzleBlockCount, puzzleStackBlocks, movePuzzleStack, removePuzzleBlock, puzzleDropDestination, CONNECTED_STACK, PUZZLE_GEOMETRY } from '../dist/puzzle-workspace.js';
import { expandProgram, LEVELS } from '../dist/engine.js';
import { chapterMission } from '../dist/opening-missions.js';

const card = (type, count) => count === undefined ? { type } : { type, count };
const source = (index = 0, stackId = CONNECTED_STACK) => ({ kind: 'stack', stackId, index });
const join = (index, stackId = CONNECTED_STACK) => ({ kind: 'connect', stackId, index });
const free = (x = 220, y = 100) => ({ kind: 'free', x, y });
const types = blocks => blocks.map(block => block.type);

test('palette creates separate puzzle pieces or joins them below Start without executing', () => {
  const empty = createPuzzleWorkspace();
  const loose = movePuzzleStack(empty, { kind: 'palette', type: 'up' }, free());
  assert.deepEqual(empty.connected, []);
  assert.deepEqual(loose.connected, []);
  assert.equal(loose.detached.length, 1);
  assert.deepEqual(loose.detached[0].blocks, [card('up')]);
  const connected = movePuzzleStack(loose, source(0, loose.detached[0].id), join(0));
  assert.deepEqual(connected.connected, [card('up')]);
  assert.equal(connected.detached.length, 0);
  assert.equal(puzzleBlockCount(connected), 1);
});

test('dragging a middle command carries its whole suffix and leaves the prefix attached', () => {
  const original = createPuzzleWorkspace([card('up'), card('left', 4), card('collect')]);
  const detached = movePuzzleStack(original, source(1), free(250, 80));
  assert.deepEqual(detached.connected, [card('up')]);
  assert.deepEqual(detached.detached[0].blocks, [card('left', 4), card('collect')]);
  assert.deepEqual(original.connected, [card('up'), card('left', 4), card('collect')]);
  assert.equal(puzzleBlockCount(detached), 3);
});

test('dragging the first card releases all commands while Start remains the fixed origin', () => {
  const next = movePuzzleStack(createPuzzleWorkspace([card('up'), card('down')]), source(), free());
  assert.deepEqual(next.connected, []);
  assert.deepEqual(types(next.detached[0].blocks), ['up', 'down']);
  assert.deepEqual(PUZZLE_GEOMETRY, { x: 30, y: 24, width: 164, height: 58, startHeight: 58 });
});

test('a detached chain can be moved without changing its identity or counts', () => {
  const first = movePuzzleStack(createPuzzleWorkspace([card('down', 4), card('right', 2)]), source(), free());
  const id = first.detached[0].id;
  const moved = movePuzzleStack(first, source(0, id), free(305, 240));
  assert.equal(moved.detached.length, 1);
  assert.equal(moved.detached[0].id, id);
  assert.equal(moved.detached[0].x, 305);
  assert.equal(moved.detached[0].y, 240);
  assert.deepEqual(moved.detached[0].blocks, [card('down', 4), card('right', 2)]);
  assert.equal(moved.nextId, first.nextId);
});

test('a suffix can be inserted before another command in its original chain', () => {
  const next = movePuzzleStack(createPuzzleWorkspace([card('up'), card('right'), card('down'), card('left')]), source(2), join(1));
  assert.deepEqual(types(next.connected), ['up', 'down', 'left', 'right']);
  assert.deepEqual(next.detached, []);
});

test('detached suffixes insert between existing connected commands with metadata intact', () => {
  let model = movePuzzleStack(createPuzzleWorkspace([card('up'), card('right', 3), card('down', 4)]), source(1), free());
  const id = model.detached[0].id;
  model = movePuzzleStack(model, { kind: 'palette', type: 'collect' }, join(1));
  model = movePuzzleStack(model, source(0, id), join(1));
  assert.deepEqual(model.connected, [card('up'), card('right', 3), card('down', 4), card('collect')]);
  assert.deepEqual(model.detached, []);
});

test('joining loose stacks keeps them disconnected until the player attaches to Start', () => {
  let model = movePuzzleStack(createPuzzleWorkspace(), { kind: 'palette', type: 'left' }, free());
  model = movePuzzleStack(model, { kind: 'palette', type: 'down' }, free(380, 160));
  const [left, down] = model.detached;
  model = movePuzzleStack(model, source(0, down.id), join(1, left.id));
  assert.equal(model.detached.length, 1);
  assert.deepEqual(types(model.detached[0].blocks), ['left', 'down']);
  assert.deepEqual(model.connected, []);
  model = movePuzzleStack(model, source(0, left.id), join(0));
  assert.deepEqual(types(model.connected), ['left', 'down']);
});

test('splitting a detached stack leaves the prefix at its original coordinates', () => {
  let model = movePuzzleStack(createPuzzleWorkspace([card('up'), card('down'), card('left')]), source(), free(200, 150));
  const id = model.detached[0].id;
  model = movePuzzleStack(model, source(1, id), free(390, 280));
  assert.equal(model.detached.length, 2);
  assert.deepEqual(model.detached[0], { id, x: 200, y: 150, blocks: [card('up')] });
  assert.deepEqual(types(model.detached[1].blocks), ['down', 'left']);
  assert.notEqual(model.detached[1].id, id);
});

test('dropping onto the carried suffix, missing stacks, and invalid drops never lose commands', () => {
  const original = createPuzzleWorkspace([card('up'), card('right'), card('down')]);
  for (const destination of [null, join(2), join(3), join(0, 'missing'), join(-1), free(NaN, 3), { kind: 'invalid' }]) {
    assert.equal(movePuzzleStack(original, source(1), destination), original);
  }
  assert.equal(movePuzzleStack(original, source(-1), free()), original);
  assert.equal(movePuzzleStack(original, source(0, 'missing'), join(0)), original);
  assert.equal(puzzleBlockCount(original), 3);
});

test('trash removes only the carried suffix and a remove button removes just one card', () => {
  const original = createPuzzleWorkspace([card('up'), card('right', 4), card('down')]);
  const trash = movePuzzleStack(original, source(1), { kind: 'trash' });
  assert.deepEqual(trash.connected, [card('up')]);
  const remove = removePuzzleBlock(original, CONNECTED_STACK, 1);
  assert.deepEqual(types(remove.connected), ['up', 'down']);
  assert.equal(removePuzzleBlock(original, 'missing', 0), original);
});

test('the block limit includes disconnected puzzle pieces but still permits moving existing pieces', () => {
  let model = movePuzzleStack(createPuzzleWorkspace([card('up'), card('down')]), source(1), free());
  assert.equal(puzzleBlockCount(model), 2);
  assert.equal(movePuzzleStack(model, { kind: 'palette', type: 'left' }, join(1), { maxBlocks: 2 }), model);
  const id = model.detached[0].id;
  model = movePuzzleStack(model, source(0, id), join(1), { maxBlocks: 2 });
  assert.deepEqual(types(model.connected), ['up', 'down']);
  assert.equal(movePuzzleStack(model, { kind: 'palette', type: 'repeat' }, free(), { allowedTypes: ['up', 'down'] }), model);
});

test('snap previews use actual connector positions and accept an empty Start chain', () => {
  const model = createPuzzleWorkspace([card('up'), card('right')]);
  assert.deepEqual(puzzleDropDestination(model, { kind: 'palette', type: 'left' }, { x: 35, y: 143 }), { kind: 'connect', stackId: CONNECTED_STACK, index: 1, x: 30, y: 140 });
  assert.deepEqual(puzzleDropDestination(createPuzzleWorkspace(), { kind: 'palette', type: 'up' }, { x: 30, y: 82 }), { kind: 'connect', stackId: CONNECTED_STACK, index: 0, x: 30, y: 82 });
  const originalJoin = puzzleDropDestination(model, source(1), { x: 30, y: 140 });
  assert.deepEqual(originalJoin, { kind: 'connect', stackId: CONNECTED_STACK, index: 1, x: 30, y: 140 });
  assert.equal(movePuzzleStack(model, source(1), originalJoin), model);
  assert.deepEqual(puzzleDropDestination(model, { kind: 'palette', type: 'left' }, { x: 300, y: 90 }), { kind: 'free', x: 300, y: 90 });
});

function assertSeparated(model) {
  const rects = [{ x: 30, y: 24, width: 164, height: 58 + model.connected.length * 58 + 8 },
    ...model.detached.map(stack => ({ x: stack.x, y: stack.y, width: 164, height: stack.blocks.length * 58 + 8 }))];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, `overlap between rectangles ${i} and ${j}`);
  }
}

test('releasing over the Start body far from its connector parks a detached card clear of it', () => {
  const empty = createPuzzleWorkspace(), palette = { kind: 'palette', type: 'up' };
  for (const point of [{ x: 30, y: 24 }, { x: 30, y: 0 }, { x: 70, y: 40 }, { x: 0, y: 20 }]) {
    const destination = puzzleDropDestination(empty, palette, point);
    assert.equal(destination.kind, 'free');
    const result = movePuzzleStack(empty, palette, destination);
    assert.deepEqual(result.connected, []);
    assert.deepEqual(result.detached[0].blocks, [card('up')]);
    assertSeparated(result);
  }
});

test('only a release within the connector proximity attaches; bodies have no broad attraction', () => {
  const model = createPuzzleWorkspace([card('up'), card('right'), card('down')]);
  const palette = { kind: 'palette', type: 'left' };
  assert.equal(puzzleDropDestination(model, palette, { x: 30, y: 111 }).kind, 'free');
  const destination = puzzleDropDestination(model, palette, { x: 48, y: 184 });
  assert.deepEqual(destination, { kind: 'connect', stackId: CONNECTED_STACK, index: 2, x: 30, y: 198 });
  assert.deepEqual(types(movePuzzleStack(model, palette, destination).connected), ['up', 'right', 'left', 'down']);
  const returned = puzzleDropDestination(model, source(), { x: 30, y: 82 });
  assert.equal(movePuzzleStack(model, source(), returned), model);
  const empty = createPuzzleWorkspace();
  assert.equal(puzzleDropDestination(empty, palette, { x: 58, y: 104 }).kind, 'connect');
  assert.equal(puzzleDropDestination(empty, palette, { x: 58.01, y: 104 }).kind, 'free');
  assert.equal(puzzleDropDestination(empty, palette, { x: 58, y: 104.01 }).kind, 'free');
});

test('release choice is stateless after passing other connectors', () => {
  const model = createPuzzleWorkspace([card('up'), card('down')]), palette = { kind: 'palette', type: 'left' };
  assert.equal(puzzleDropDestination(model, palette, { x: 30, y: 82 }).index, 0);
  assert.equal(puzzleDropDestination(model, palette, { x: 30, y: 119 }).index, 1);
  assert.equal(puzzleDropDestination(model, palette, { x: 30, y: 111 }).kind, 'free');
  assert.equal(puzzleDropDestination(model, palette, { x: 30, y: 198 }).index, 2);
});

test('dropping over a loose stack joins that stack while keeping it detached from Start', () => {
  const model = movePuzzleStack(createPuzzleWorkspace(), { kind: 'palette', type: 'up' }, free(260, 200));
  const destination = puzzleDropDestination(model, { kind: 'palette', type: 'down' }, { x: 265, y: 210 });
  assert.equal(destination.kind, 'connect');
  assert.equal(destination.stackId, model.detached[0].id);
  const result = movePuzzleStack(model, { kind: 'palette', type: 'down' }, destination);
  assert.deepEqual(result.connected, []);
  assert.equal(result.detached.length, 1);
  assertSeparated(result);
});

test('direct free placement cannot overlap Start, the connected chain, or another detached stack', () => {
  let model = createPuzzleWorkspace([card('up'), card('right')]);
  for (const point of [free(30, 24), free(30, 82), free(30, 140), free(190, 90), free(210, 90)]) {
    model = movePuzzleStack(model, { kind: 'palette', type: 'down' }, point);
    assertSeparated(model);
  }
  assert.equal(model.detached.length, 5);
  assert.equal(puzzleBlockCount(model), 7);
});

test('free release coordinates match the collision-free final stack position', () => {
  const model = movePuzzleStack(createPuzzleWorkspace([card('up')]), { kind: 'palette', type: 'left' }, free(220, 100));
  const palette = { kind: 'palette', type: 'down' };
  const destination = puzzleDropDestination(model, palette, { x: 195, y: 24 });
  assert.equal(destination.kind, 'free');
  const result = movePuzzleStack(model, palette, destination);
  assert.deepEqual({ x: result.detached.at(-1).x, y: result.detached.at(-1).y }, { x: destination.x, y: destination.y });
  assertSeparated(result);
});

test('growing the connected program parks loose stacks away from its new footprint', () => {
  let model = movePuzzleStack(createPuzzleWorkspace([card('up')]), { kind: 'palette', type: 'left' }, free(30, 220));
  const looseId = model.detached[0].id;
  for (let count = 0; count < 4; count++) {
    model = movePuzzleStack(model, { kind: 'palette', type: 'right' }, join(model.connected.length));
    assertSeparated(model);
  }
  assert.equal(model.detached[0].id, looseId);
  assert.deepEqual(model.detached[0].blocks, [card('left')]);
  assert.equal(model.connected.length, 5);
});

test('connecting a suffix anchors the chosen loose connector even when an older stack obstructs its expansion', () => {
  const model = createPuzzleWorkspace([card('down', 4), card('left', 2), card('right', 3)]);
  model.detached = [
    { id: 'loose-1', x: 300, y: 300, blocks: [card('up', 6)] },
    { id: 'loose-2', x: 300, y: 100, blocks: [card('up', 5)] },
  ];
  model.nextId = 3;
  const destination = puzzleDropDestination(model, source(), { x: 300, y: 158 });
  assert.deepEqual(destination, { kind: 'connect', stackId: 'loose-2', index: 1, x: 300, y: 158 });
  const result = movePuzzleStack(model, source(), destination);
  const target = result.detached.find(stack => stack.id === 'loose-2');
  assert.deepEqual({ x: target.x, y: target.y }, { x: 300, y: 100 });
  assert.deepEqual({ x: target.x, y: target.y + destination.index * 58 }, { x: destination.x, y: destination.y });
  assert.deepEqual(target.blocks, [card('up', 5), card('down', 4), card('left', 2), card('right', 3)]);
  assert.deepEqual(result.connected, []);
  const obstruction = result.detached.find(stack => stack.id === 'loose-1');
  assert.deepEqual(obstruction.blocks, [card('up', 6)]);
  assert.notEqual(obstruction.y, 300);
  assert.equal(puzzleBlockCount(result), 5);
  assertSeparated(result);
  assert.equal(model.detached[1].y, 100);
  assert.equal(model.detached[0].y, 300);
});

test('only commands attached to Start reach the real engine, including expanded direction counts', () => {
  const mission = chapterMission(LEVELS[12], 1);
  let model = createPuzzleWorkspace([card('up', 4), card('down', 2)]);
  model = movePuzzleStack(model, source(1), free());
  assert.equal(puzzleBlockCount(model), 2);
  assert.deepEqual(expandProgram(mission, model.connected, 1).map(action => action.type), ['up', 'up', 'up', 'up']);
  model = movePuzzleStack(model, source(0, model.detached[0].id), join(1));
  assert.deepEqual(expandProgram(mission, model.connected, 1).map(action => action.type), ['up', 'up', 'up', 'up', 'down', 'down']);
});

test('reset produces a fresh empty canvas without retaining loose pieces or sharing command metadata', () => {
  const commands = [card('up', 4)];
  const first = createPuzzleWorkspace(commands);
  first.connected[0].count = 2;
  assert.equal(commands[0].count, 4);
  const second = createPuzzleWorkspace();
  assert.deepEqual(second, { connected: [], detached: [], nextId: 1 });
  assert.equal(puzzleStackBlocks(second, CONNECTED_STACK).length, 0);
});
