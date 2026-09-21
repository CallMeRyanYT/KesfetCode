import test from 'node:test';
import assert from 'node:assert/strict';
import { robotPose, MOVE_MS, PRESS_MS, PRESS_LAND_MS, IMPACT_MS } from '../dist/robot-motion.js';

test('Robot returns to the tile center and full scale after each action', () => {
  for (const [action, duration] of [['move', MOVE_MS], ['press', PRESS_MS], ['impact', IMPACT_MS], ['win', 1900]]) {
    const pose = robotPose(action, duration);
    for (const key of ['y', 'z', 'rx', 'rz', 'sparks']) assert.ok(Math.abs(pose[key]) < .001, `${action}: ${key}`);
    assert.ok(Math.abs(pose.sy - 1) < .001);
    assert.ok(Math.abs(pose.sx - 1) < .001);
  }
});

test('Button press leaves the floor, lands on the sound cue, then recovers', () => {
  assert.ok(robotPose('press', PRESS_MS * .4).y > .7);
  assert.equal(robotPose('press', PRESS_LAND_MS).y, 0);
  assert.ok(robotPose('press', PRESS_LAND_MS + 80).sy < 1);
});

test('Wall impact advances toward the obstacle and recoils without leaving its tile', () => {
  assert.ok(robotPose('impact', IMPACT_MS * .2).z > .15);
  assert.ok(robotPose('impact', IMPACT_MS * .6).z < 0);
  for (let elapsed = 0; elapsed <= IMPACT_MS; elapsed += 5) {
    const pose = robotPose('impact', elapsed);
    assert.ok(Math.abs(pose.z) < .25);
    assert.ok(Object.values(pose).every(Number.isFinite));
  }
});
