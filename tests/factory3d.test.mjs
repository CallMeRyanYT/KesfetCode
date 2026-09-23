import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Factory3D } from '../dist/factory3d.js';
import { MOVE_MS, PICKUP_MS } from '../dist/robot-motion.js';
import { LEVELS } from '../dist/engine.js';

function fixture() {
  const view = Object.create(Factory3D.prototype);
  Object.assign(view, {
    mode: 'game', rows: 5, cols: 5, worldNumber: 4, level: { grid: ['#####', '#####', 'SBC.E', '#####', '#####'] },
    robot: new THREE.Group(), robotBody: new THREE.Group(), impactBurst: new THREE.Group(), pickupBurst: new THREE.Group(), chargeHalo: new THREE.Group(),
    host: { dataset: {} }, materials: new Map(), fans: [], goalRings: [], beacons: [], doors: [], reducedMotion: false, animateDrive() {},
    motion: null, turn: null, winTime: null, launchTime: null, errorTime: null,
    collectibles: [{ key: '2,1', tile: 'B', kind: 'battery', object: new THREE.Group(), ring: new THREE.Group(), x: -1.28, z: 0, baseY: .9, collectedAt: null }]
  });
  const state = { row: 2, col: 0, heading: 'right', steps: 0, energy: 2, capacity: 4, crystals: [], batteries: [], keys: [], items: [], doors: [], won: false, error: null, event: null };
  view.setState(state, false);
  return { view, state };
}

test('Battery collection starts after arrival, leaves time for recharge, and does not become victory', () => {
  const { view, state } = fixture();
  const next = { ...state, col: 1, steps: 1, energy: 4, batteries: ['2,1'], event: 'battery' };
  view.setState(next, true);
  assert.equal(view.pickup.kind, 'battery');
  assert.ok(Math.abs(view.pickup.start - view.motion.start - MOVE_MS) < 1e-8);
  assert.equal(view.winTime, null);
  const item = view.collectibles[0];
  view.animateWorld(view.pickup.start - 1, 0, 0, 'move', 0);
  assert.equal(item.object.visible, true);
  view.animateWorld(view.pickup.start + PICKUP_MS / 2, 0, 0, 'battery', PICKUP_MS / 2);
  assert.equal(item.object.visible, true);
  assert.equal(view.chargeHalo.visible, true);
  view.animateWorld(view.pickup.start + PICKUP_MS, 0, 0, 'idle', 0);
  assert.equal(item.object.visible, false);
  assert.equal(view.chargeHalo.visible, false);
  view.setState({ ...next, col: 2, steps: 2, event: 'crystal', crystals: ['2,2'] }, true);
  assert.equal(view.pickup.kind, 'crystal');
  assert.equal(view.lastState.won, false);
});

test('UI rerender preserves a pickup and restart cancels it even at the same coordinates', () => {
  const { view, state } = fixture();
  const next = { ...state, col: 1, steps: 1, batteries: ['2,1'], event: 'battery' };
  view.setState(next, true);
  const motion = view.motion, pickup = view.pickup;
  view.setState({ ...next }, false);
  assert.equal(view.motion, motion);
  assert.equal(view.pickup, pickup);
  // The reset state can share coordinates (for example, restarting a turn at S).
  view.setState({ ...state, col: 1 }, false);
  assert.equal(view.motion, null);
  assert.equal(view.pickup, null);
  assert.equal(view.collectibles[0].object.visible, true);
  assert.equal(view.chargeHalo.visible, false);
  assert.equal(view.robot.rotation.y, Math.PI / 2);
});

test('Explicit stop immediately settles movement and consumed objects', () => {
  const { view, state } = fixture();
  const next = { ...state, col: 1, steps: 1, batteries: ['2,1'], event: 'battery' };
  view.setState(next, true);
  view.cancelAnimation(next);
  assert.equal(view.motion, null);
  assert.equal(view.pickup, null);
  assert.equal(view.robot.position.x, view.robotPosition({...state,col:1}).x);
  assert.equal(view.collectibles[0].object.visible, false);
});

test('Relative turns use the engine heading and reduced motion snaps without wheel or pickup travel', () => {
  const { view, state } = fixture();
  view.setState({ ...state, steps: 1, heading: 'down', event: 'turn' }, true);
  assert.equal(view.targetRotation, 0);
  assert.ok(Math.abs(view.turn.delta + Math.PI / 2) < 1e-10);
  view.cancelAnimation(state); view.reducedMotion = true;
  view.setState({ ...state, col: 1, steps: 1, event: 'battery', batteries: ['2,1'] }, true);
  assert.equal(view.motion, null);
  assert.equal(view.robot.position.x, view.robotPosition({...state,col:1}).x);
  assert.equal(view.collectibles[0].object.visible, false);
});

test('Largest rectangular grids stay centered, with matching independent row and column extents', () => {
  const { view } = fixture();
  view.rows = 9; view.cols = 11;
  assert.equal(view.position(4, 5).x, 0);
  assert.equal(view.position(4, 5).z, 0);
  assert.equal(view.position(0, 0).x, -view.position(8, 10).x);
  assert.equal(view.position(0, 0).z, -view.position(8, 10).z);
});

test('Two door panels independently animate and return closed after reset', () => {
  const { view, state } = fixture();
  view.doors = ['2,2', '2,3'].map(key => ({ key, panel: new THREE.Group(), light: new THREE.Mesh(), openedAt: null }));
  view.setState({ ...state, steps: 1, doors: ['2,2'], event: 'door' }, true);
  view.animateWorld(performance.now() + 400, 0, 0, 'idle', 0);
  assert.ok(Math.abs(view.doors[0].panel.scale.y - .1) < 1e-8);
  assert.equal(view.doors[1].panel.scale.y, 1);
  view.setState(state, false);
  assert.ok(view.doors.every(door => door.panel.scale.y === 1 && door.panel.position.y === 0));
});

test('Every campaign board builds matching collectibles and doors with camera bounds for its grid', () => {
  const { view } = fixture();
  Object.assign(view, {
    world: new THREE.Group(), scene: new THREE.Scene(), geometries: new Map(), labels: [], theme: null,
    keyLight: new THREE.DirectionalLight(), renderer: { setSize() {} }, camera: new THREE.OrthographicCamera(),
    host: { dataset: {}, clientWidth: 480, clientHeight: 400 }
  });
  // Canvas text rasterization is browser-owned; use actual Three meshes for all scene layout.
  view.label = function (value, parent, xyz) {
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1, .25), new THREE.MeshBasicMaterial({ map: new THREE.Texture() }));
    label.position.set(...xyz); label.userData.value = value; parent.add(label); this.labels.push(label); return label;
  };
  const colors = new Set();
  for (const level of LEVELS) {
    view.buildWorld(level); view.resize();
    const tiles = level.grid.join('');
    assert.equal(view.rows, level.grid.length);
    assert.equal(view.cols, level.grid[0].length);
    assert.equal(view.collectibles.length, [...tiles].filter(tile => 'CBKLPabc'.includes(tile)).length);
    assert.equal(view.doors.length, [...tiles].filter(tile => 'DF'.includes(tile)).length);
    assert.equal(!!view.rocket, tiles.includes('R'));
    assert.ok(view.camera.right > view.boardWidth / 2);
    assert.ok(view.camera.top > view.boardDepth / 2 - 1);
    colors.add(view.palette.tile);
  }
  assert.equal(colors.size, 6);
});

test('Rendered driving traverses intermediate positions and articulates the body before arrival', () => {
  const { view, state } = fixture();
  const previousDocument = globalThis.document;
  globalThis.document = { hidden: false };
  try {
    view.host.isConnected = true;
    view.controls = { update() {} };
    view.camera = new THREE.OrthographicCamera();
    view.renderer = { render() {} };
    const poses = [];
    view.animateArms = pose => poses.push({...pose});
    view.setState({...state, col:1, steps:1, event:'move'}, true);
    // This timestamp exposes endpoint rounding when subtracting frame times.
    view.motion.start = 344.004;
    const start = view.motion.start;
    const from = view.robot.position.x;
    const to = view.robotPosition({...state,col:1}).x;
    view.tick(start + MOVE_MS * .25);
    assert.ok(view.robot.position.x > from && view.robot.position.x < to);
    assert.ok(Math.abs(view.robotBody.rotation.x) > .03);
    assert.ok(Math.abs(poses.at(-1).armSwing) > .1);
    const quarter = view.robot.position.x;
    view.tick(start + MOVE_MS * .5);
    assert.ok(view.robot.position.x > quarter && view.robot.position.x < to);
    assert.ok(view.driveDistance > 0);
    view.tick(start + MOVE_MS);
    assert.equal(view.robot.position.x, to);
    assert.equal(view.motion, null);
    view.zoom(10);
    assert.equal(view.camera.zoom, 3);
    view.zoom(-10);
    assert.equal(view.camera.zoom, .65);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('Pickups stop outside the prop and reach above the head then disappear after collection', () => {
  const {view,state}=fixture();
  const next={...state,col:1,steps:1,event:'battery',batteries:['2,1']};
  view.setState(next,true);
  const center=view.position(2,1);
  const parked=view.robotPosition(next);
  assert.ok(parked.distanceTo(center)>=.71);
  view.robot.position.copy(parked);
  const item=view.collectibles[0];
  view.animateWorld(view.pickup.start+PICKUP_MS*.35,0,0,'battery',0);
  assert.ok(item.object.position.distanceTo(view.robot.position)>.8);
  view.animateWorld(view.pickup.start+PICKUP_MS*.7,0,0,'battery',0);
  assert.ok(item.object.position.y>1);
  assert.ok(item.object.scale.x<1);
  view.animateWorld(view.pickup.start+PICKUP_MS*.8,0,0,'battery',0);
  assert.equal(item.object.visible,true);
  assert.ok(item.object.position.y >= 1.16);
  view.animateWorld(view.pickup.start+PICKUP_MS,0,0,'battery',0);
  assert.equal(item.object.visible,false);
  assert.ok(item.object.position.y >= 1.16);
});
