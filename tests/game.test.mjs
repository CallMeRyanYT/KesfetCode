import test from 'node:test';
import assert from 'node:assert/strict';

test('Repeat executes the complete sequence in order and retains editor indices', () => {
  const blocks = [{type:'up'}, {type:'right'}];
  const expanded = expandProgram(LEVELS[0], blocks, 3);
  assert.deepEqual(expanded.map(b=>b.type), ['up','right','up','right','up','right']);
  assert.deepEqual(expanded.map(b=>b.index), [0,1,0,1,0,1]);
  assert.deepEqual(expanded.map(b=>b.iteration), [1,1,2,2,3,3]);
  assert.deepEqual(blocks, [{type:'up'}, {type:'right'}]);
  for(const count of [0,-1,11,1.5,Infinity,NaN,'3',null]) assert.throws(()=>expandProgram(LEVELS[0],blocks,count));
  assert.equal(expandProgram(LEVELS[0], Array.from({length:80},()=>({type:'up'})),10).length,800);
  assert.deepEqual(expandProgram(LEVELS[0],[],2),[]);
});

test('Local repeat groups leave later commands outside the loop',()=>{
  const blocks=[{type:'repeat',count:3,body:[{type:'up'}]},{type:'left'}];
  const instructions=expandProgram(LEVELS[0],blocks);
  assert.deepEqual(instructions.map(b=>b.type),['up','up','up','left']);
  assert.deepEqual(instructions.map(b=>b.key),['0.0','0.0','0.0','1']);
  assert.throws(()=>expandProgram(LEVELS[0],[{type:'repeat',count:3,body:[]}]));
  assert.throws(()=>expandProgram(LEVELS[0],[{type:'repeat',count:3,body:blocks}]));
});
import { LEVELS, WORLDS, CHAPTERS, MAX_BLOCKS, PROGRESS_VERSION, initialState, step, simulate, availableActions, expandProgram, scoreRun, normalizeProgress, isUnlocked, completeLevel } from '../dist/engine.js';
const program = (...types) => types.map(type => ({ type }));
const forward = count => Array.from({ length: count }, () => ({ type: 'right' }));
const move = (direction, count = 1) => Array.from({ length: count }, () => ({ type: direction }));
const countTile = (level, tile) => [...level.grid.join('')].filter(value => value === tile).length;
const fixture = (grid, extra = {}) => ({ id: 25, grid, energy: null, target: 80, heading: 'right', ...extra });

// Independent breadth-first search: no calls to initialState, step, simulate,
// expandProgram, or the authored solutions. This validates both level layout
// and energy feasibility independently of the production transition function.
function shortestRoute(level, { allCrystals = true, batteries = true } = {}) {
  const collectibles = new Map(), batteryTiles = new Map();
  let required = 0, start;
  for (let row = 0; row < level.grid.length; row++) for (let col = 0; col < level.grid[row].length; col++) {
    const tile = level.grid[row][col], position = `${row},${col}`;
    if (tile === 'S') start = [row, col];
    if ('CPabc'.includes(tile)) {
      const bit = 1 << collectibles.size;
      collectibles.set(position, bit);
      if ((allCrystals && tile === 'C') || level.requiredItems?.includes(tile)) required |= bit;
    }
    if (tile === 'B') batteryTiles.set(position, 1 << batteryTiles.size);
  }
  const headings = ['up', 'right', 'down', 'left'], vectors = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  const queue = [{ row: start[0], col: start[1], heading: headings.indexOf(level.heading || 'right'),
    energy: level.energy ?? -1, collected: 0, batteries: 0, keys: 0, phase: 0, distance: 0 }];
  const seen = new Set();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor];
    const identity = [state.row, state.col, state.heading, state.energy, state.collected, state.batteries, state.keys, state.phase].join(':');
    if (seen.has(identity)) continue;
    seen.add(identity);
    const standing = level.grid[state.row][state.col], standingPosition = `${state.row},${state.col}`;
    if ((standing === 'E' || standing === 'R') && (state.collected & required) === required) {
      if (standing === 'E') return state.distance;
      if (state.phase === 5) return state.distance + 1;
    }
    if (standing === 'E' || standing === 'R') continue;
    const standingBit = collectibles.get(standingPosition) || 0;
    if (standing === 'C' && standingBit && !(state.collected & standingBit)) {
      queue.push({ ...state, collected: state.collected | standingBit, phase: level.id === 30 && state.phase === 0 ? 1 : state.phase, distance: state.distance + 1 });
    }
    if (state.energy === 0) continue;
    for (const [heading, [dr, dc]] of vectors.entries()) {
      const row = state.row + dr, col = state.col + dc, tile = level.grid[row]?.[col];
      if (!tile || tile === '#') continue;
      if ((tile === 'D' && !(state.keys & 1)) || (tile === 'F' && !(state.keys & 2))) continue;
      const phase = level.id === 30 ? ['C', 'K', 'D', 'B', 'R'].indexOf(tile) : -1;
      if (phase > state.phase) continue;
      const position = `${row},${col}`, battery = batteryTiles.get(position) || 0;
      let energy = state.energy < 0 ? -1 : state.energy - 1;
      if (batteries && battery && !(state.batteries & battery)) energy = level.energy ?? -1;
      if (energy === 0 && !['E', 'R', 'C'].includes(tile)) continue;
      queue.push({ ...state, row, col, heading, energy, collected: state.collected | (tile === 'C' ? 0 : (collectibles.get(position) || 0)),
        batteries: state.batteries | battery, keys: state.keys | (tile === 'K' ? 1 : tile === 'L' ? 2 : 0),
        phase: phase === state.phase && tile !== 'C' ? state.phase + 1 : state.phase, distance: state.distance + 1 });
    }
  }
  return Infinity;
}

test('The story contains six bilingual worlds and thirty well-formed missions', () => {
  assert.equal(WORLDS.length, 6);
  assert.equal(LEVELS.length, 30);
  assert.deepEqual(CHAPTERS.map(chapter => chapter.names[0]), ['Level 1 – EXPLORER', 'Level 2 – INVENTOR', 'Level 3 – CODE MASTER']);
  assert.ok(CHAPTERS.every(chapter => chapter.scope.every(scope => scope === '1–30')));
  assert.deepEqual(CHAPTERS.map(chapter => chapter.learning[0]), ['Directions, sequencing, algorithms', 'Loops, repetition, optimization', 'Conditions, sensors, functions']);
  const glyphs = /^[#.SEC BKDLFPabcRX]+$/;
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(level.id, index + 1);
    assert.equal(level.world, Math.floor(index / 5) + 1);
    assert.ok(level.grid.every(row => row.length === level.grid[0].length && glyphs.test(row)));
    assert.equal(countTile(level, 'S'), 1);
    assert.equal(countTile(level, 'E') + countTile(level, 'R'), 1);
    for (const key of ['names', 'topics', 'objective', 'hint']) assert.ok(level[key].length === 2 && level[key].every(text => typeof text === 'string' && text.length > 0));
  }
  for (const world of WORLDS) for (const key of ['names', 'story', 'completion']) assert.equal(world[key].length, 2);
  assert.ok(LEVELS.slice(0, 15).every(level => level.energy === null));
  assert.equal(countTile(LEVELS[3], 'C'), 1);
  assert.equal(countTile(LEVELS[4], 'C'), 2);
  assert.equal(countTile(LEVELS[8], 'C'), 2);
  assert.equal(countTile(LEVELS[14], 'C'), 3);
  assert.ok(LEVELS.slice(0, 29).every(level => level.grid.length * level.grid[0].length < LEVELS[29].grid.length * LEVELS[29].grid[0].length));
});

for (const level of LEVELS) {
  test(`Mission ${level.id}: authored solution completes every objective within its three-star budget`, () => {
    const result = simulate(level, level.solution);
    assert.equal(result.won, true);
    assert.equal(result.error, null);
    assert.equal(result.crystals.length, countTile(level, 'C'));
    assert.ok(level.solution.length <= MAX_BLOCKS);
    assert.equal(scoreRun(level, result, level.solution.length), 3);
    assert.equal(level.grid[result.row][result.col], level.id === 30 ? 'R' : 'E');
  });
  test(`Mission ${level.id}: independent search proves its complete route and command budget`, () => {
    const shortest = shortestRoute(level);
    assert.ok(Number.isFinite(shortest), 'No independent solution exists');
    assert.equal(shortest, level.target, 'The three-star target must match the independently optimal route');
  });
}

test('Later battery puzzles genuinely require recharging, including the crystal detour', () => {
  const levels = LEVELS.filter(level => level.batteryRequired);
  assert.ok(levels.length >= 7);
  for (const level of levels) {
    assert.equal(shortestRoute(level, { batteries: false, allCrystals: level.batteryRequired === 'crystals' }), Infinity, `Mission ${level.id} can finish without recharging`);
  }
  assert.ok(Number.isFinite(shortestRoute(LEVELS[18], { batteries: false, allCrystals: false })));
});

test('Absolute direction commands move directly without rotation blocks', () => {
  const directions = ['up', 'right', 'down', 'left'];
  assert.deepEqual(availableActions(LEVELS[0]), directions);
  assert.deepEqual(availableActions(LEVELS[5]), directions);
  assert.deepEqual(availableActions(LEVELS[6]), directions);
  const level = fixture(['S..', '...', '..E'], { id: 7, energy: 6 }), start = initialState(level);
  const moved = step(level, start, 'right');
  assert.deepEqual([moved.row, moved.col, moved.energy, moved.heading, moved.moves], [0, 1, 5, 'right', 1]);
  const movedDown = step(level, moved, 'down');
  assert.deepEqual([movedDown.row, movedDown.col, movedDown.heading], [1, 1, 'down']);
  assert.equal(step(LEVELS[0], initialState(LEVELS[0]), 'spin').error, 'invalid');
});

test('Older age paths can opt into forward and turn blocks', () => {
  const level = fixture(['S..', '...', '..E'], { id: 8, energy: 5, allowTurns: true });
  const start = initialState(level);
  assert.deepEqual(availableActions(level).slice(0, 7), ['up', 'right', 'down', 'left', 'forward', 'turnRight', 'turnLeft']);
  const turned = step(level, start, 'turnRight');
  assert.deepEqual([turned.heading, turned.row, turned.col, turned.energy, turned.event], ['down', 0, 0, 5, 'turn']);
  const driven = step(level, turned, 'forward');
  assert.deepEqual([driven.heading, driven.row, driven.col, driven.energy, driven.event], ['down', 1, 0, 4, 'move']);
});

test('Button presses are explicit actions with a persistent happy event', () => {
  const level = fixture(['SX.E'], { id: 7, energy: 4 });
  const start = initialState(level);
  assert.ok(availableActions(level).includes('press'));
  const moved = step(level, start, 'right');
  assert.deepEqual([moved.row, moved.col, moved.energy], [0, 1, 3]);
  const pressed = step(level, moved, 'press');
  assert.equal(pressed.event, 'button');
  assert.deepEqual(pressed.buttons, ['0,1']);
  assert.equal(pressed.energy, 3);
  assert.equal(step(fixture(['S.E'], { id: 7 }), initialState(fixture(['S.E'], { id: 7 })), 'press').error, 'invalid');
});

test('Zero-energy arrivals leave a crystal waiting for an explicit collect action', () => {
  const level = LEVELS[16];
  const battery = simulate(level, forward(4));
  assert.equal(battery.event, 'battery');
  assert.equal(battery.energy, 4);
  assert.equal(battery.error, null);
  assert.equal(battery.won, false);
  const goal = simulate(level, level.solution);
  assert.equal(goal.energy, 0);
  assert.equal(goal.error, null);
  assert.equal(goal.won, true);
  const empty = fixture(['S.C.E'], { energy: 2 });
  const stranded = simulate(empty, forward(2));
  assert.equal(stranded.crystals.length, 0);
  assert.equal(stranded.energy, 0);
  assert.equal(stranded.error, null);
  const collected = step(empty, stranded, 'collect');
  assert.deepEqual(collected.crystals, ['0,2']);
  assert.equal(step(empty, collected, 'right').error, 'energy');
});

test('Pickups are one-use, crystals require a collect action, and restart restores all state', () => {
  const level = fixture(['SBC.E'], { energy: 6 });
  const first = simulate(level, [...forward(2), { type: 'collect' }]);
  assert.equal(first.energy, 5);
  assert.deepEqual(first.batteries, ['0,1']);
  assert.deepEqual(first.crystals, ['0,2']);
  const revisit = step(level, first, 'collect');
  assert.equal(revisit.error, 'collect');
  assert.equal(revisit.energy, 5);
  assert.deepEqual(revisit.batteries, ['0,1']);
  assert.deepEqual(revisit.crystals, ['0,2']);
  const reset = initialState(level);
  assert.equal(reset.energy, 6);
  for (const key of ['crystals', 'batteries', 'keys', 'doors', 'items']) assert.deepEqual(reset[key], []);
  assert.notEqual(reset.batteries, first.batteries);
});

test('Collisions preserve position and charge, stop execution, and do not mutate the prior state', () => {
  const level = fixture(['S#E'], { energy: 5 }), start = initialState(level);
  const before = structuredClone(start), state = step(level, start, 'right');
  assert.equal(state.error, 'wall');
  assert.deepEqual([state.row, state.col, state.energy, state.moves], [0, 0, 5, 0]);
  assert.deepEqual(start, before);
  assert.equal(step(level, state, 'left'), state);
});

test('The two distinct keys only open their matching doors', () => {
  assert.equal(simulate(fixture(['SDE']), forward(1)).error, 'door');
  assert.equal(simulate(fixture(['SKFE']), forward(2)).error, 'door');
  assert.equal(simulate(fixture(['SLDE']), forward(2)).error, 'door');
  const level = LEVELS[23], end = simulate(level, level.solution);
  assert.deepEqual(end.keys, ['K', 'L']);
  assert.equal(end.doors.length, 2);
  assert.deepEqual(initialState(level).doors, []);
});

test('Modules and every launch-code fragment are required before delivery', () => {
  const module = fixture(['SE', 'P#'], { requiredItems: ['P'] });
  assert.equal(simulate(module, forward(1)).error, 'items');
  for (const fragment of ['a', 'b', 'c']) {
    const original = LEVELS[28], without = { ...original, grid: original.grid.map(row => row.replace(fragment, '.')) };
    assert.equal(simulate(without, without.solution).error, 'items');
  }
  const end = simulate(LEVELS[28], LEVELS[28].solution);
  assert.equal(end.items.length, 3);
});

test('The finale requires the ordered objective chain and explicit launch at the rocket', () => {
  const level = LEVELS[29];
  assert.equal(availableActions(level).includes('launch'), false);
  assert.equal(step(level, initialState(level), 'launch').error, 'launch');
  const ready = simulate(level, level.solution.slice(0, -1));
  assert.equal(ready.won, false);
  assert.equal(ready.readyToLaunch, true);
  assert.equal(ready.phase, 5);
  assert.equal(availableActions(level, ready).includes('launch'), true);
  assert.equal(step(level, ready, 'launch').won, true);
  for (const tile of ['K', 'B', 'R']) {
    const outOfOrder = fixture([`S${tile}E`], { id: 30, energy: 3 });
    assert.equal(simulate(outOfOrder, forward(1)).error, 'sequence');
  }
  const exact = fixture(['SCKDBR'], { id: 30, energy: 4 });
  const arriving = simulate(exact, [{ type: 'right' }, { type: 'collect' }, ...forward(4)]);
  assert.equal(arriving.readyToLaunch, true);
  const zeroAtRocket = { ...arriving, energy: 0 };
  assert.equal(step(exact, zeroAtRocket, 'launch').won, true);
});

test('Stars distinguish reaching the exit, collecting all crystals, and efficient algorithms', () => {
  const level = LEVELS[12], direct = simulate(level, forward(4));
  assert.equal(direct.won, true);
  assert.equal(direct.crystals.length, 0);
  assert.equal(scoreRun(level, direct, 4), 1);
  const complete = simulate(level, level.solution);
  assert.equal(scoreRun(level, complete, level.target), 3);
  assert.equal(scoreRun(level, complete, level.target + 1), 2);
  assert.equal(scoreRun(level, initialState(level), 0), 0);
  assert.equal(shortestRoute(LEVELS[17]), 4);
  const long = [...move('right', 2), ...move('left', 2), ...move('right', 2)];
  assert.equal(simulate(LEVELS[17], long).error, 'energy');
});

test('Invalid, unavailable, sparse, oversized, and unsafe commands are rejected', () => {
  const level = LEVELS[29];
  for (const invalid of [null, {}, Array(3), [null], [{ type: 'constructor' }], [{ type: 'repeat' }], [{ type: 'spin' }]]) assert.throws(() => expandProgram(level, invalid));
  assert.throws(() => expandProgram(LEVELS[0], program('spin')));
  assert.throws(() => expandProgram(LEVELS[28], program('launch')));
  assert.throws(() => expandProgram(level, forward(MAX_BLOCKS + 1)));
  for (const action of ['constructor', 'toString', '__proto__', 'oops']) assert.equal(step(level, initialState(level), action).error, 'invalid');
  assert.equal(expandProgram(level, level.solution).at(-1).type, 'launch');
});

test('Thirty mission saves are versioned, contiguous, round-trip, and preserve best results', () => {
  let progress = normalizeProgress(null);
  assert.equal(progress.version, PROGRESS_VERSION);
  assert.equal(progress.stars.length, 30);
  assert.deepEqual(completeLevel(progress, 29, 3), progress);
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(isUnlocked(progress, index), true);
    progress = completeLevel(progress, index, 3, countTile(level, 'C'));
  }
  assert.equal(progress.stars.reduce((sum, stars) => sum + stars, 0), 90);
  assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(progress))), progress);
  assert.deepEqual(completeLevel(progress, 3, 1, 0), progress);
  assert.equal(isUnlocked(progress, -1), false);
  assert.equal(isUnlocked(progress, 30), false);
  assert.equal(normalizeProgress({ stars: [3, 3, 3, 3, 3] }).stars[0], 0);
  const corrupt = normalizeProgress({ version: 2, stars: [3, 2, 0, 3, 3], crystals: [100, -2] });
  assert.deepEqual(corrupt.stars.slice(0, 5), [3, 2, 0, 0, 0]);
  assert.ok(corrupt.crystals.every(value => value === 0));
  assert.equal(normalizeProgress({ version: 2, stars: ['3', 2] }).stars[0], 0);
  assert.equal(normalizeProgress({ version: 999, stars: [3] }).stars[0], 0);
});

test('Robot-relative commands rotate the direction frame after every move', async () => {
  const {resolveDirection, relativeSolution} = await import('../dist/engine.js');
  assert.equal(resolveDirection('right','right'),'down');
  assert.equal(resolveDirection('down','left'),'right');
  assert.equal(resolveDirection('left','up'),'left');
  assert.equal(resolveDirection('up','down'),'down');
  const level=fixture(['.....','..S..','.....','.....'],{robotRelative:true});
  let state=step(level,initialState(level),'right');
  assert.deepEqual([state.row,state.col,state.heading],[2,2,'down']);
  state=step(level,state,'left');
  assert.deepEqual([state.row,state.col,state.heading],[2,3,'right']);
  for(const authored of LEVELS){
    const relative={...authored,robotRelative:true};
    const outcome=simulate(relative,relativeSolution(relative));
    assert.equal(outcome.won,true,`Relative demo ${authored.id} must remain solvable`);
    assert.equal(outcome.error,null);
  }
});
