import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createRobotRig, createDriveRig, straightenRobotHead } from '../dist/robot-rig.js';
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
  animate(robotPose('idle', 0), 0, 1, true);
  const shoulders = mesh.skeleton.bones.slice(1);
  shoulders.forEach((bone, index) => {
    assert.ok(Math.abs(bone.rotation.z) < .2, 'Pickup must not fold arms across the torso');
    assert.ok(bone.position.z > data.pivots[index][2], 'Hands lift in front of the body');
    assert.ok(Math.abs(bone.position.x) > Math.abs(data.pivots[index][0]), 'Shoulders retain side clearance');
  });
  animate(robotPose('idle', 0), 0, 0, true);
  shoulders.forEach((bone,index)=>assert.deepEqual(bone.position.toArray(),data.pivots[index]));

  animate({ ...robotPose('idle', 0), armLift: 1 }, 0, false, true);
  model.updateMatrixWorld(true);
  for (const [i] of data.weights) {
    original.fromBufferAttribute(geometry.attributes.position, i);
    mesh.getVertexPosition(i, posed);
    assert.ok(original.distanceTo(posed) < 1e-6, 'Happy pose must restore the original arms');
  }
});

test('Drive wheels roll together, turn in opposite directions, and reset for reduced motion', () => {
  const parent = new THREE.Group();
  const drive = createDriveRig(parent);
  const wheels = parent.getObjectByName('kasif-drive-base').children.filter(child => child.isGroup);
  assert.equal(wheels.length, 4);
  drive(1, 0);
  assert.ok(wheels.every(wheel => wheel.rotation.x > 6));
  drive(0, .8);
  assert.ok(wheels.filter(wheel => wheel.userData.side === -1).every(wheel => wheel.rotation.x < 0));
  assert.ok(wheels.filter(wheel => wheel.userData.side === 1).every(wheel => wheel.rotation.x > 0));
  drive(1, 1, true);
  assert.ok(wheels.every(wheel => wheel.rotation.x === 0));
});

test('Idle arm surfaces clear the original tires and drive wheels, including reduced motion', () => {
  const file = readFileSync(new URL('../dist/assets/joybot.glb', import.meta.url));
  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.toString('utf8', 20, 20 + jsonLength));
  const primitive = gltf.meshes[0].primitives[0];
  function readAccessor(id) {
    const accessor = gltf.accessors[id], view = gltf.bufferViews[accessor.bufferView];
    const start = 28 + jsonLength + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const count = accessor.count * (accessor.type === 'VEC3' ? 3 : 1);
    const bytes = accessor.componentType === 5123 ? 2 : 4;
    return Array.from({ length: count }, (_, i) => accessor.componentType === 5126
      ? file.readFloatLE(start + i * bytes)
      : bytes === 2 ? file.readUInt16LE(start + i * bytes) : file.readUInt32LE(start + i * bytes));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(readAccessor(primitive.attributes.POSITION), 3));
  geometry.setIndex(readAccessor(primitive.indices));
  const data = JSON.parse(readFileSync(new URL('../dist/assets/robot-arm-weights.json', import.meta.url)));
  const influenced = new Set(data.weights.map(([vertex]) => vertex));
  const model = new THREE.Group();
  model.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  straightenRobotHead(model, data);
  const animate = createRobotRig(model, data);
  const mesh = model.children.find(child => child.isSkinnedMesh);
  const bounds = new THREE.Box3().setFromObject(model);
  const height = bounds.getSize(new THREE.Vector3()).y;
  const center = bounds.getCenter(new THREE.Vector3());
  model.scale.setScalar(1 / height);
  model.position.set(-center.x / height, -bounds.min.y / height, -center.z / height);
  model.updateMatrixWorld(true);
  // The static lower geometry bounds both authored tire assemblies.
  const originalTires = [new THREE.Box3(), new THREE.Box3()];
  const point = new THREE.Vector3();
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    point.fromBufferAttribute(geometry.attributes.position, i);
    if (!influenced.has(i) && point.y < -.26 && Math.abs(point.x) > .045) {
      const side = point.x < 0 ? 0 : 1;
      originalTires[side].expandByPoint(point.applyMatrix4(model.matrixWorld));
    }
  }
  const drive = new THREE.Group(); createDriveRig(drive); drive.updateMatrixWorld(true);
  const wheelBounds = [...originalTires, ...drive.getObjectByName('kasif-drive-base').children
    .filter(child => child.isGroup).map(wheel => new THREE.Box3().setFromObject(wheel))]
    .map(box => box.expandByScalar(.02));
  const indices = geometry.index.array, triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    const ids = [indices[i], indices[i + 1], indices[i + 2]];
    if (ids.some(id => influenced.has(id))) triangles.push(ids);
  }
  const posed = new Map([...new Set(triangles.flat())].map(id => [id, new THREE.Vector3()]));
  const triangle = new THREE.Triangle();
  for (let sample = 0; sample <= 120; sample++) {
    const time = sample / 3, still = sample === 120;
    animate(robotPose(still ? 'still' : 'idle', 0, time), time, false, still);
    model.updateMatrixWorld(true);
    for (const [id, vertex] of posed) mesh.getVertexPosition(id, vertex).applyMatrix4(mesh.matrixWorld);
    for (const [a, b, c] of triangles) {
      triangle.set(posed.get(a), posed.get(b), posed.get(c));
      assert.ok(wheelBounds.every(box => !box.intersectsTriangle(triangle)), `Arm intersects tire clearance at idle sample ${sample}`);
    }
  }
});
