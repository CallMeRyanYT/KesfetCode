import test from 'node:test';
import assert from 'node:assert/strict';
import { robotPose, MOVE_MS, TURN_MS, PICKUP_MS, PICKUP_EVENTS, WIN_MS, LAUNCH_MS, PRESS_MS, PRESS_LAND_MS, IMPACT_MS, pickupProgress, launchStage } from '../dist/robot-motion.js';

test('Robot returns to the tile center and full scale after each action', () => {
  for (const [action, duration] of [['move', MOVE_MS], ['turn', TURN_MS], ['press', PRESS_MS], ['impact', IMPACT_MS], ['win', WIN_MS], ['launch', LAUNCH_MS], ...PICKUP_EVENTS.map(event => [event, PICKUP_MS])]) {
    const pose = robotPose(action, duration);
    for (const key of ['y', 'z', 'rx', 'rz', 'sparks']) assert.ok(Math.abs(pose[key]) < .001, `${action}: ${key}`);
    assert.ok(Math.abs(pose.sy - 1) < .001);
    assert.ok(Math.abs(pose.sx - 1) < .001);
  }
});

test('Driving stays grounded and shows acceleration and braking rather than a hop', () => {
  for (let t = 0; t <= MOVE_MS; t += 5) {
    assert.equal(robotPose('move', t).y, 0);
    assert.equal(robotPose('move', t).sy, 1);
  }
  assert.ok(robotPose('move', MOVE_MS * .25).rx > 0);
  assert.ok(robotPose('move', MOVE_MS * .75).rx < 0);
});

test('Crystal celebration and battery charging have distinct expressive poses', () => {
  assert.ok(robotPose('crystal', PICKUP_MS * .3).y > 0);
  assert.equal(robotPose('battery', PICKUP_MS * .3).y, 0);
  for (const event of PICKUP_EVENTS) assert.ok(robotPose(event, PICKUP_MS / 2).armLift > .9);
  assert.ok(robotPose('tired', 0).rx > 0);
  assert.ok(robotPose('tired', 0).sy < 1);
});

test('Reduced motion is entirely still, including idle breathing', () => {
  assert.deepEqual(robotPose('still', 300, 2), { y: 0, z: 0, rx: 0, rz: 0, sx: 1, sy: 1, armLift: 0, armSwing: 0, sparks: 0 });
});

test('Pickup timeline starts on arrival and launch counts down before liftoff', () => {
  assert.equal(pickupProgress(400, 500), 0);
  assert.equal(pickupProgress(500, 500), 0);
  assert.equal(pickupProgress(500 + PICKUP_MS / 2, 500), .5);
  assert.equal(pickupProgress(500 + PICKUP_MS + 10, 500), 1);
  assert.deepEqual([0, 999, 1000, 1999, 2000, 2999, 3000, 4400].map(launchStage), ['3', '3', '2', '2', '1', '1', 'liftoff', 'liftoff']);
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

test('Wall impact tips the robot over then recovers, and victory dances swing the arms', () => {
  assert.ok(robotPose('impact', IMPACT_MS * .6).rx < -1);
  assert.ok(Math.abs(robotPose('impact', IMPACT_MS).rx) < .001);
  assert.ok(robotPose('win', WIN_MS * .25).armSwing < -.2);
  assert.ok(robotPose('win', WIN_MS * .4).armSwing > .2);
});
