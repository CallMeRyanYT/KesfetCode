import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, MAX_DIRECTION_COUNT, initialState, simulate, expandProgram, relativeSolution, directionCountsAvailable, programBlockCount, missionTargetProgram, missionBlockTarget, scoreRun } from '../dist/engine.js';
import { chapterMission } from '../dist/opening-missions.js';

const blocks = (...types) => types.map(type => ({ type }));
const fixture = (grid, extra = {}) => ({ id: 13, grid, heading: 'right', robotRelative: false, curriculum: 1, energy: null, ...extra });

test('physical card count ignores direction repetitions and counts every loop card only once', () => {
  const program = [{ type: 'right', count: 10 }, { type: 'repeat', count: 8, body: [{ type: 'down', count: 4 }, { type: 'collect' }] }, { type: 'launch' }];
  assert.equal(programBlockCount(program), 5);
  assert.equal(programBlockCount([]), 0);
  assert.throws(() => programBlockCount(null), /invalid-program/);
  assert.throws(() => programBlockCount([{ type: 'repeat', count: 3 }]), /invalid-program/);
});

test('Explorer always uses one physical card per step', () => {
  // Code.org puzzles 2–7: one card per tile.
  assert.deepEqual(LEVELS.slice(0, 6).map(base => missionBlockTarget(chapterMission(base, 0))), [2, 2, 2, 3, 3, 2]);
  for (const base of LEVELS.slice(0, 5)) {
    const level = chapterMission(base, 0), reference = missionTargetProgram(level);
    assert.equal(directionCountsAvailable(level), false);
    assert.deepEqual(reference, level.solution);
    assert.equal(programBlockCount(reference), level.solution.length);
    assert.ok(reference.every(block => (block.count ?? 1) === 1));
  }
});

test('long movement runs split at the actual count control limit without changing authored action data', () => {
  const level = fixture([`S${'.'.repeat(24)}E`], { target: 25, solution: blocks(...Array(25).fill('right')) });
  const unchanged = structuredClone(level);
  const reference = missionTargetProgram(level);
  assert.deepEqual(reference, [{ type: 'right', count: MAX_DIRECTION_COUNT }, { type: 'right', count: MAX_DIRECTION_COUNT }, { type: 'right', count: 5 }]);
  assert.equal(missionBlockTarget(level), 3);
  assert.equal(simulate(level, reference).won, true);
  assert.deepEqual(expandProgram(level, reference).map(action => action.type), level.solution.map(block => block.type));
  assert.deepEqual(level, unchanged);
});

test('relative movement is converted before compression so changing robot headings stays correct', () => {
  const level = fixture(['S..', '##.', '##E'], { robotRelative: true, curriculum: 1, allowTurns: true, target: 4, solution: blocks('right', 'right', 'down', 'down') });
  const reference = missionTargetProgram(level);
  assert.deepEqual(reference, [{ type: 'up', count: 2 }, { type: 'right' }, { type: 'up' }]);
  assert.equal(missionBlockTarget(level), 3);
  assert.deepEqual(expandProgram(level, reference).map(action => action.type), ['up', 'up', 'right', 'up']);
  assert.deepEqual(simulate(level, reference), simulate(level, relativeSolution(level)));
  assert.equal(simulate(level, reference).won, true);
  assert.deepEqual(level.solution, blocks('right', 'right', 'down', 'down'));
});

test('compression preserves objective actions, repeated turns, command metadata and original objects', () => {
  const marker = Object.freeze({ color: 'blue', path: Object.freeze([1, 2]) });
  const solution = Object.freeze([
    Object.freeze({ type: 'right', marker }), Object.freeze({ type: 'right', marker }),
    Object.freeze({ type: 'right', marker: Object.freeze({ color: 'green', path: Object.freeze([1, 2]) }) }),
    Object.freeze({ type: 'collect', description: 'crystal' }),
    Object.freeze({ type: 'right' }), Object.freeze({ type: 'press' }),
    Object.freeze({ type: 'turnRight' }), Object.freeze({ type: 'turnRight' }), Object.freeze({ type: 'launch' })
  ]);
  const level = fixture(['S.E'], { allowTurns: true, solution });
  const reference = missionTargetProgram(level);
  assert.equal(reference.length, 8);
  assert.deepEqual(reference[0], { type: 'right', marker: { color: 'blue', path: [1, 2] }, count: 2 });
  assert.deepEqual(reference[1], solution[2]);
  assert.deepEqual(reference.slice(2), solution.slice(3));
  assert.notEqual(reference[0].marker, marker);
  assert.equal(solution[0].count, undefined);
  assert.equal(reference.filter(block => block.type === 'turnRight').length, 2);
  const distinct = missionTargetProgram(fixture(['S.E'], { solution: [{ type: 'right', marker: new Map([['id', 1]]) }, { type: 'right', marker: new Map([['id', 2]]) }] }));
  assert.equal(distinct.length, 2);
  assert.equal(distinct[0].marker.get('id'), 1);
  assert.equal(distinct[1].marker.get('id'), 2);
});

test('fallback fixtures retain their authored target when no reference solution is available', () => {
  assert.deepEqual(missionTargetProgram(fixture(['SE'], { target: 7 })), []);
  assert.equal(missionBlockTarget(fixture(['SE'], { target: 7 })), 7);
  assert.equal(missionBlockTarget(fixture(['SE'], { target: 7, solution: [] })), 7);
  assert.equal(missionBlockTarget(fixture(['SE'], { target: NaN })), 1);
  assert.equal(missionBlockTarget(fixture(['SE'], { target: '7' })), 1);
});

test('stars use all connected physical cards, including an unexecuted tail after the goal', () => {
  const level = fixture(['S.E'], { target: 2, solution: blocks('right', 'right') });
  const reference = missionTargetProgram(level);
  assert.equal(missionBlockTarget(level), 1);
  assert.equal(programBlockCount(reference), 1);
  for (let extra = 0; extra <= 7; extra++) {
    const program = [...reference, ...blocks(...Array(extra).fill('up'))];
    const state = simulate(level, program);
    assert.equal(state.won, true);
    assert.equal(state.error, null);
    assert.equal(state.steps, 2);
    assert.equal(programBlockCount(program), 1 + extra);
    assert.equal(scoreRun(level, state, programBlockCount(program)), extra === 0 ? 3 : extra <= 4 ? 2 : 1);
  }
  const split = blocks('right', 'right');
  assert.equal(scoreRun(level, simulate(level, split), programBlockCount(split)), 2);
});

test('failed runs, missing crystals and invalid physical counts retain safe scores', () => {
  const level = fixture(['SC.E'], { target: 4, solution: blocks('right', 'collect', 'right', 'right') });
  const incomplete = simulate(level, [{ type: 'right', count: 3 }]);
  assert.equal(incomplete.won, true);
  assert.equal(scoreRun(level, incomplete, 1), 1);
  const reference = missionTargetProgram(level), won = simulate(level, reference);
  assert.equal(scoreRun(level, won, programBlockCount(reference)), 3);
  assert.equal(scoreRun(level, initialState(level), 0), 0);
  assert.equal(scoreRun(level, { ...won, error: 'wall' }, 1), 0);
  for (const invalid of [undefined, null, NaN, Infinity, -Infinity, -1, 0, 1.5, '1', true, 2 ** 53]) assert.equal(scoreRun(level, won, invalid), 1);
});

test('all ninety chapter references preserve the exact gameplay, win and match their physical card budgets', () => {
  for (let chapter = 0; chapter < 3; chapter++) for (const base of LEVELS) {
    const level = chapterMission(base, chapter), unchanged = structuredClone(level), reference = missionTargetProgram(level);
    const canonical = relativeSolution(level), state = simulate(level, reference), label = `Chapter ${chapter + 1}, mission ${base.id}`;
    assert.deepEqual(expandProgram(level, reference).map(action => action.type), expandProgram(level, canonical).map(action => action.type), label);
    assert.deepEqual(state, simulate(level, canonical), label);
    assert.equal(state.won, true, label);
    assert.equal(state.error, null, label);
    assert.equal(programBlockCount(reference), missionBlockTarget(level), label);
    assert.equal(scoreRun(level, state, programBlockCount(reference)), 3, label);
    assert.deepEqual(level, unchanged, label);
    assert.equal(level.target, level.solution.length, label);
  }
});
