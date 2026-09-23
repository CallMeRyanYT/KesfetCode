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
  const root = new THREE.Bone(); root.name = 'KAŞİF-armature';
  const arms = data.pivots.map((pivot, index) => {
    const bone = new THREE.Bone(); bone.name = `shoulder-${index}`;
    bone.position.set(...pivot); root.add(bone); return bone;
  });
  mesh.add(root);
  source.parent.add(mesh);
  source.removeFromParent();
  model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([root, ...arms]));
  // The left shoulder sits lower on the authored model. Separate rest angles
  // keep both hands relaxed outside the tires through the entire idle sway.
  const restRotationZ = [-78, 40].map(THREE.MathUtils.degToRad);
  return (pose, time, carrying = false, reducedMotion = false) => {
    // Keep the shoulders outside the torso: the old 1.72 lift folded them inward.
    const carry = Number(carrying);
    const baseLift = THREE.MathUtils.lerp(pose.armLift, 1.08, carry);
    arms.forEach((bone, index) => {
      const lift = !carrying && pose.wave ? (index === 0 ? 0 : .95) : baseLift;
      const side = index === 0 ? -1 : 1;
      const breathe = reducedMotion || carrying ? 0 : Math.sin(time * 1.4 + index * .8) * .045;
      bone.rotation.z = restRotationZ[index] * (1 - lift) + side * breathe;
      bone.position.copy(new THREE.Vector3(...data.pivots[index]));
      bone.position.x += (index === 0 ? 1 : -1) * .035 * carry;
      bone.position.z += .055 * carry;
      bone.rotation.x = (index === 0 ? 1 : -1) * (carrying || pose.wave && index === 0 ? 0 : pose.armSwing);
    });
  };
}

/** A small drive base gives the supplied static robot real rolling wheel details. */
export function createDriveRig(parent) {
  const base = new THREE.Group();
  base.name = 'kasif-drive-base';
  parent.add(base);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x243448, roughness: .8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb5c8d8, metalness: .65, roughness: .32 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff9c30, metalness: .25, roughness: .4 });
  const tireGeometry = new THREE.CylinderGeometry(.145, .145, .10, 16);
  const hubGeometry = new THREE.CylinderGeometry(.088, .088, .112, 12);
  const spokeGeometry = new THREE.BoxGeometry(.118, .019, .13);
  const treadGeometry = new THREE.BoxGeometry(.105, .025, .032);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(.48, .10, .43), rubber);
  chassis.position.y = .14; base.add(chassis);
  const wheels = [];
  for (const side of [-1, 1]) for (const z of [-.13, .13]) {
    const wheel = new THREE.Group();
    wheel.position.set(side * .27, .145, z);
    wheel.userData.side = side;
    for (const [geometry, material] of [[tireGeometry, rubber], [hubGeometry, metal]]) {
      const part = new THREE.Mesh(geometry, material);
      part.rotation.z = Math.PI / 2; part.castShadow = true; wheel.add(part);
    }
    const spoke = new THREE.Mesh(spokeGeometry, orange); wheel.add(spoke);
    for (let i = 0; i < 10; i++) {
      const angle = i / 10 * Math.PI * 2;
      const tread = new THREE.Mesh(treadGeometry, rubber);
      tread.position.set(0, Math.cos(angle) * .145, Math.sin(angle) * .145);
      tread.rotation.x = angle; wheel.add(tread);
    }
    base.add(wheel); wheels.push(wheel);
  }
  return (distance = 0, turn = 0, reducedMotion = false) => {
    for (const wheel of wheels) wheel.rotation.x = reducedMotion ? 0 : distance / .145 + wheel.userData.side * turn * 1.9;
  };
}

/** Level the authored tilted head around its neck, leaving arm vertices untouched. */
export function straightenRobotHead(model, data) {
  const right = new THREE.Vector3(.967905,.217780,.125428).normalize();
  const normal = new THREE.Vector3(-.153157,.115449,.981435).normalize();
  const up = new THREE.Vector3().crossVectors(normal,right).normalize();
  right.crossVectors(up,normal).normalize();
  const correction = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal)).invert();
  const pivot = new THREE.Vector3(-.025,.09,0);
  const armVertices = new Set(data.weights.map(entry=>entry[0]));
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const positions=mesh.geometry.attributes.position, point=new THREE.Vector3();
    for(let i=0;i<positions.count;i++) {
      point.fromBufferAttribute(positions,i);
      if(armVertices.has(i)||point.y<=.09)continue;
      const weight=THREE.MathUtils.smoothstep(point.y,.09,.14);
      const corrected=point.clone().sub(pivot).applyQuaternion(correction).add(pivot);
      point.lerp(corrected,weight);positions.setXYZ(i,point.x,point.y,point.z);
    }
    positions.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  });
  model.userData.headCorrection={correction,pivot};
}
