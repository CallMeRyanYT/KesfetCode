import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createRobotRig } from '../dist/robot-rig.js';
import { robotPose } from '../dist/robot-motion.js';

test('The supplied robot can lower both arms without moving the rest of its mesh', () => {
  const file = readFileSync(new URL('../dist/assets/joybot.glb', import.meta.url));
  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.toString('utf8', 20, 20 + jsonLength));
  const accessor = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
  const view = gltf.bufferViews[accessor.bufferView];
  const start = 28 + jsonLength + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const positions = new Float32Array(accessor.count * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = file.readFloatLE(start + i * 4);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const model = new THREE.Group();
  model.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  const data = JSON.parse(readFileSync(new URL('../dist/assets/robot-arm-weights.json', import.meta.url)));
  assert.equal(data.vertexCount, accessor.count);
  const animate = createRobotRig(model, data);
  const mesh = model.children.find(child => child.isSkinnedMesh);
  const influenced = new Set(data.weights.map(entry => entry[0]));
  for (const [,bone,weight] of data.weights) {
    assert.ok(bone === 1 || bone === 2);
    assert.ok(weight > 0 && weight <= 1);
  }
  animate(robotPose('idle', 0), 0, false, true);
  model.updateMatrixWorld(true);
  let moved = 0;
  const original = new THREE.Vector3(), posed = new THREE.Vector3();
  for (let i = 0; i < accessor.count; i++) {
    original.fromBufferAttribute(geometry.attributes.position, i);
    mesh.getVertexPosition(i, posed);
    assert.ok([posed.x, posed.y, posed.z].every(Number.isFinite));
    if (!influenced.has(i)) assert.ok(original.distanceTo(posed) < 1e-6, `Stationary vertex ${i} moved`);
    else if (original.distanceTo(posed) > .05) moved++;
  }
  assert.ok(moved > 500, 'Both arms should visibly lower');
  animate({ ...robotPose('idle', 0), armLift: 1 }, 0, false, true);
  model.updateMatrixWorld(true);
  for (const [i] of data.weights) {
    original.fromBufferAttribute(geometry.attributes.position, i);
    mesh.getVertexPosition(i, posed);
    assert.ok(original.distanceTo(posed) < 1e-6, 'Happy pose must restore the original arms');
  }
});
