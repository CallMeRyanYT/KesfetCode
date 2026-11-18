import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, MAX_DIRECTION_COUNT, MAX_BLOCKS, MAX_REPEATS, isDirectionBlock, directionCountsAvailable, directionBlockCount, expandProgram, simulate, scoreRun, programBlockCount, missionTargetProgram } from '../dist/engine.js';
import { chapterMission } from '../dist/opening-missions.js';

const fixture = (grid, extra = {}) => ({id:25, grid, energy:null, target:80, heading:'right', robotRelative:false, ...extra});
const explicit = (type, count) => Array.from({length:count}, () => ({type}));
test('Direction counts default to one and support only movement commands', () => {
  assert.equal(MAX_DIRECTION_COUNT, 10);
  for (const type of ['up','right','down','left','forward']) {
    assert.equal(isDirectionBlock(type), true);
    assert.equal(directionBlockCount({type}), 1);
    assert.equal(directionBlockCount({type, count:MAX_DIRECTION_COUNT}), MAX_DIRECTION_COUNT);
  }
  for (const type of ['turnRight','turnLeft','collect','press','launch','repeat',undefined,null]) assert.equal(isDirectionBlock(type), false);
  assert.equal(directionBlockCount({type:'collect'}), 1);
});

test('Chapter one unlocks direction counts at mission six while older chapters keep them', () => {
  for (let id = 1; id <= 5; id++) {
    const level = chapterMission(LEVELS[id - 1], 0);
    assert.equal(directionCountsAvailable(level), false, `Chapter one mission ${id}`);
    assert.throws(() => expandProgram(level, [{type:'up', count:2}]), /invalid-block/);
    assert.throws(() => expandProgram(level, [{type:'repeat', count:2, body:[{type:'up', count:2}]}]), /invalid-block/);
    assert.equal(expandProgram(level, [{type:'up', count:1}]).length, 1);
    assert.equal(simulate(level, level.solution).won, true);
  }
  const unlocked = chapterMission(LEVELS[5], 0);
  assert.equal(directionCountsAvailable(unlocked), true);
  assert.equal(expandProgram(unlocked, [{type:'up', count:2}]).length, 2);
  for (const chapter of [1, 2]) {
    const older = chapterMission(LEVELS[1], chapter);
    assert.equal(directionCountsAvailable(older), true);
    assert.equal(expandProgram(older, [{type:'up', count:2}]).length, 2);
    assert.equal(simulate(older, [{type:'up', count:2}]).won, true);
  }
  assert.equal(directionCountsAvailable(LEVELS[0]), true);
});

test('A counted route keeps command order and card keys while collecting a crystal', () => {
  const level = fixture(['S...#','###.#','#E.C#'], {target:8});
  const counted = [{type:'right',count:3},{type:'down',count:2},{type:'collect'},{type:'left',count:2}];
  const unchanged = structuredClone(counted);
  const expanded = expandProgram(level, counted);
  assert.deepEqual(expanded.map(action => action.type), ['right','right','right','down','down','collect','left','left']);
  assert.deepEqual(expanded.map(action => action.key), ['0','0','0','1','1','2','3','3']);
  assert.deepEqual(expanded.map(action => action.index), [0,0,0,1,1,2,3,3]);
  const result = simulate(level, counted);
  assert.deepEqual(result, simulate(level, expanded));
  assert.equal(result.won, true);
  assert.equal(result.steps, 8);
  assert.equal(result.moves, 7);
  assert.deepEqual(result.crystals, ['2,3']);
  assert.equal(scoreRun(level, result, programBlockCount(counted)), 3);
  assert.deepEqual(counted, unchanged);
});

test('All four directions, forward movement, and robot-relative moves repeat one step at a time', () => {
  const floor = ['.....','.....','..S..','.....','.....'];
  for (const type of ['up','right','down','left']) {
    for (const robotRelative of [false,true]) {
      const level = fixture(floor, {robotRelative, heading:'up'});
      assert.deepEqual(simulate(level, [{type,count:2}]), simulate(level, explicit(type,2)));
    }
  }
  const olderChapter = fixture(['S..E'], {allowTurns:true,target:3});
  const counted = [{type:'forward',count:3}];
  assert.deepEqual(simulate(olderChapter,counted), simulate(olderChapter,explicit('forward',3)));
  assert.equal(simulate(olderChapter,counted).won, true);
});

test('Counted movement preserves battery charging, exhaustion, and collision stopping', () => {
  const battery = fixture(['S.B.C.E'], {energy:4,target:7});
  const counted = [{type:'right',count:4},{type:'collect'},{type:'right',count:2}];
  const separate = [...explicit('right',4),{type:'collect'},...explicit('right',2)];
  const result = simulate(battery,counted);
  assert.deepEqual(result,simulate(battery,separate));
  assert.equal(result.won,true);
  assert.equal(result.energy,0);
  assert.deepEqual(result.batteries,['0,2']);
  for (const [level,error,col] of [
    [fixture(['S.#...E']), 'wall', 1],
    [fixture(['S.....E'],{energy:2}), 'energy', 2],
    [fixture(['S.D...E']), 'door', 1]
  ]) {
    const state=simulate(level,[{type:'right',count:6}]);
    assert.deepEqual(state,simulate(level,explicit('right',6)));
    assert.equal(state.error,error);
    assert.equal(state.col,col);
    assert.equal(state.steps,2);
  }
});

test('Counted card scoring uses physical cards while expanded separate commands use more cards', () => {
  const level=fixture(['S..E'],{target:3});
  const counted=[{type:'right',count:2},{type:'left'},{type:'right',count:2}];
  const expanded=expandProgram(level,counted);
  const state=simulate(level,counted);
  assert.equal(state.won,true);
  assert.equal(state.steps,5);
  assert.equal(counted.length,3);
  assert.equal(scoreRun(level,state,programBlockCount(counted)),3);
  assert.equal(scoreRun(level,simulate(level,expanded),programBlockCount(expanded)),2);
});

test('Invalid direction counts and counts on non-movement commands are rejected', () => {
  const level=fixture(['SCX.R'],{id:30,allowTurns:true});
  for (const count of [0,-1,MAX_DIRECTION_COUNT+1,1.5,Infinity,-Infinity,NaN,'4',null,true,{},[]]) {
    assert.throws(()=>directionBlockCount({type:'right',count}), /invalid-block/);
    assert.throws(()=>expandProgram(level,[{type:'right',count}]), /invalid-block/);
  }
  for (const type of ['turnRight','turnLeft','collect','press','launch']) {
    assert.throws(()=>expandProgram(level,[{type,count:2}]), /invalid-block/);
    assert.equal(expandProgram(level,[{type,count:1}]).length,1);
  }
  for (const block of [null,undefined,[],4,'up']) assert.throws(()=>directionBlockCount(block), /invalid-block/);
  assert.throws(()=>expandProgram(fixture(['S.E']),[{type:'forward',count:2}]), /invalid-block/);
});

test('Legacy local and whole-program repeats preserve counted card keys and enforce 800 commands', () => {
  const level=fixture(['S.........E']);
  const program=[{type:'repeat',count:2,body:[{type:'right',count:3},{type:'left',count:2}]},{type:'up',count:2}];
  const expanded=expandProgram(level,program);
  assert.deepEqual(expanded.map(action=>action.key),['0.0','0.0','0.0','0.1','0.1','0.0','0.0','0.0','0.1','0.1','1','1']);
  assert.deepEqual(expanded.map(action=>action.iteration),[1,1,1,1,1,2,2,2,2,2,1,1]);
  assert.equal(expandProgram(level,Array.from({length:MAX_BLOCKS},()=>({type:'right',count:MAX_DIRECTION_COUNT}))).length,800);
  const maxLegacy=[{type:'repeat',count:MAX_REPEATS,body:Array.from({length:8},()=>({type:'right',count:MAX_DIRECTION_COUNT}))}];
  assert.equal(expandProgram(level,maxLegacy).length,800);
  assert.throws(()=>expandProgram(level,maxLegacy,2),/invalid-program/);
  assert.throws(()=>expandProgram(level,[{type:'repeat',count:MAX_REPEATS,body:Array.from({length:9},()=>({type:'right',count:MAX_DIRECTION_COUNT}))}]),/invalid-program/);
  assert.throws(()=>expandProgram(level,Array.from({length:9},()=>({type:'right',count:MAX_DIRECTION_COUNT})),MAX_REPEATS),/invalid-program/);
  assert.throws(()=>expandProgram(level,[{type:'repeat',count:2,body:[{type:'repeat',count:2,body:[{type:'right'}]}]}]),/invalid-repeat/);
});

test('Every authored campaign and chapter-one solution keeps its gameplay and score with counts only where unlocked', () => {
  for (const original of LEVELS) {
    for (const level of [original,chapterMission(original,0)]) {
      const unchanged=structuredClone(level.solution);
      const counted=missionTargetProgram(level);
      const expanded=expandProgram(level,counted);
      const state=simulate(level,counted);
      assert.deepEqual(state,simulate(level,level.solution),`Mission ${level.id}`);
      assert.equal(state.won,true,`Mission ${level.id}`);
      assert.equal(scoreRun(level,state,programBlockCount(counted)),3,`Mission ${level.id}`);
      assert.deepEqual(level.solution,unchanged);
    }
  }
});
