import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, DIRECTIONS, initialState, relativeSolution, simulate, step, scoreRun, availableActions } from '../dist/engine.js';
import { chapterMission, isOpeningMission } from '../dist/opening-missions.js';

const openingCases = [
  { id: 1, direction: 'up', moves: 1, start: [4, 3], finish: [3, 3], playable: 2 },
  { id: 2, direction: 'left', moves: 2, start: [3, 4], finish: [3, 2], playable: 3 },
  { id: 3, direction: 'down', moves: 2, start: [2, 3], finish: [4, 3], playable: 3 },
  { id: 4, direction: 'right', moves: 4, start: [3, 1], finish: [3, 5], playable: 5 }
];

for (const route of openingCases) {
  test(`Chapter 1 mission ${route.id} follows screen ${route.direction} for ${route.moves} move(s), independently of the robot heading`, () => {
    const mission = chapterMission(LEVELS[route.id - 1], 0);
    assert.equal(mission.robotRelative, false);
    assert.equal(mission.allowTurns, false);
    assert.equal(mission.grid.join('').replaceAll('#', '').length, route.playable);
    assert.deepEqual(availableActions(mission), DIRECTIONS);
    assert.deepEqual(mission.solution, Array.from({ length: route.moves }, () => ({ type: route.direction })));
    for (const heading of DIRECTIONS) {
      let state = { ...initialState(mission), heading };
      assert.deepEqual([state.row, state.col], route.start);
      for (let move = 1; move <= route.moves; move++) {
        state = step(mission, state, route.direction);
        assert.equal(state.error, null);
        assert.equal(state.won, move === route.moves);
        assert.equal(state.moves, move);
      }
      assert.deepEqual([state.row, state.col], route.finish);
      assert.equal(scoreRun(mission, state, route.moves), 3);
      assert.equal(scoreRun(mission, state, route.moves + 1), 2);
    }
    assert.equal(simulate(mission, mission.solution).won, true);
    assert.equal(simulate(mission, mission.solution.slice(0, -1)).won, false);
    assert.deepEqual(relativeSolution(mission), mission.solution);
  });

  test(`Chapter 1 mission ${route.id} safely rejects a wrong screen direction and turning`, () => {
    const mission = chapterMission(LEVELS[route.id - 1], 0);
    for (const direction of DIRECTIONS.filter(direction => direction !== route.direction)) {
      const start = { ...initialState(mission), heading: direction };
      const blocked = step(mission, start, direction);
      assert.equal(blocked.error, 'wall');
      assert.equal(blocked.won, false);
      assert.deepEqual([blocked.row, blocked.col], route.start);
      assert.equal(blocked.moves, 0);
      assert.equal(start.error, null);
    }
    for (const action of ['turnRight', 'turnLeft']) assert.equal(step(mission, initialState(mission), action).error, 'invalid');
  });
}

test('Opening mission changes preserve older chapter routes and the authored campaign', () => {
  for (const base of LEVELS.slice(0, 4)) {
    const snapshot = structuredClone(base);
    chapterMission(base, 0);
    assert.deepEqual(base, snapshot);
    for (const chapter of [1, 2]) {
      const mission = chapterMission(base, chapter);
      assert.deepEqual(mission.grid, snapshot.grid);
      assert.deepEqual(mission.solution, snapshot.solution);
      assert.deepEqual(mission.objective, snapshot.objective);
      assert.deepEqual(mission.hint, snapshot.hint);
      assert.equal(mission.heading, snapshot.heading);
      assert.equal(mission.robotRelative, true);
      assert.equal(mission.allowTurns, true);
      assert.equal(mission.curriculum, chapter);
      assert.equal(simulate(mission, relativeSolution(mission)).won, true);
    }
  }
  for (const base of LEVELS.slice(4)) {
    const mission = chapterMission(base, 0);
    assert.equal(mission.robotRelative, false);
    assert.equal(mission.allowTurns, false);
    assert.equal(mission.grid.length, 8);
    assert.ok(mission.grid.every(row=>row.length===8));
  }
  for (const id of [1, 2, 3, 4]) assert.equal(isOpeningMission(0, id), true);
  assert.equal(isOpeningMission(0, 5), false);
  assert.equal(isOpeningMission(1, 2), false);
  assert.equal(isOpeningMission(2, 4), false);
});
