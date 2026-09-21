import * as THREE from 'three';

/** Add shoulder joints to the original static mesh without modifying the GLB. */
export function createRobotRig(model, data) {
  let source;
  model.traverse(object => { if (object.isMesh) source = object; });
  if (!source || source.geometry.attributes.position.count !== data.vertexCount) throw new Error('Robot rig does not match the supplied model');
  const indices = new Uint16Array(data.vertexCount * 4);
  const weights = new Float32Array(data.vertexCount * 4);
  for (let vertex = 0; vertex < data.vertexCount; vertex++) weights[vertex * 4] = 1;
  // These weights follow connected mechanical parts, keeping the head and wheels still.
  for (const [vertex, bone, weight] of data.weights) {
    weights[vertex * 4] = 1 - weight;
    indices[vertex * 4 + 1] = bone;
    weights[vertex * 4 + 1] = weight;
  }
  source.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  source.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(source.geometry, source.material);
  mesh.name = source.name;
  mesh.position.copy(source.position);
  mesh.quaternion.copy(source.quaternion);
  mesh.scale.copy(source.scale);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const root = new THREE.Bone(); root.name = 'body';
  const arms = data.pivots.map((pivot, index) => {
    const bone = new THREE.Bone(); bone.name = `shoulder-${index}`;
    bone.position.set(...pivot); root.add(bone); return bone;
  });
  mesh.add(root);
  source.parent.add(mesh);
  source.removeFromParent();
  model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([root, ...arms]));
  return (pose, time, carrying = false, reducedMotion = false) => {
    const lift = carrying ? Math.max(.94, pose.armLift) : pose.armLift;
    arms.forEach((bone, index) => {
      const side = index === 0 ? -1 : 1;
      const breathe = reducedMotion ? 0 : Math.sin(time * 1.4 + index * .8) * .045;
      bone.rotation.z = data.idleRotationZ[index] * (1 - lift) + side * breathe;
      bone.rotation.x = (index === 0 ? 1 : -1) * pose.armSwing;
    });
  };
}
