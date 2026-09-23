import * as THREE from 'three';

// A small animated display sits just above the supplied robot's face panel.
// The expressions are drawn here so every gameplay reaction is visible even
// when the supplied GLB has a static face texture.
export function createRobotFace(root) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 432;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.36, .30), material);
  const right = new THREE.Vector3(.967905, .217780, .125428).normalize();
  const normal = new THREE.Vector3(-.153157, .115449, .981435).normalize();
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  right.crossVectors(up, normal).normalize();
  face.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
  face.position.set(-.066135, .284378, .127595);
  const alignment=root.userData.headCorrection;
  if(alignment){face.position.sub(alignment.pivot).applyQuaternion(alignment.correction).add(alignment.pivot);face.quaternion.premultiply(alignment.correction);}
  root.add(face);
  let previous = '';
  return (mood, seconds = 0, reducedMotion = false) => {
    face.visible = true;
    const blink = !reducedMotion && seconds % 4.6 > 4.43;
    const key = `${mood}:${blink}`;
    if (previous === key) return;
    previous = key;
    context.clearRect(0, 0, 512, 432);
    context.fillStyle = '#070b0c';
    context.beginPath(); context.roundRect(0, 0, 512, 432, 18); context.fill();
    context.strokeStyle = mood === 'charging' ? '#a7ffac' : mood === 'sleep' ? '#9fc4ff' : mood === 'impact' ? '#ff9c70' : mood === 'tired' ? '#ffb86b' : mood === 'happy' ? '#7ff3ad' : '#ffd35b'; context.lineWidth = 15;
    context.lineCap = 'round'; context.lineJoin = 'round';
    const curve = (x1,y1,cx,cy,x2,y2) => {
      context.beginPath(); context.moveTo(x1,y1); context.quadraticCurveTo(cx,cy,x2,y2); context.stroke();
    };
    if (mood === 'happy') {
      context.fillStyle = '#7ff3ad';
      for (const [x, y] of [[159, 171], [353, 171]]) {
        context.beginPath();
        for (let point = 0; point < 8; point++) {
          const angle = point / 8 * Math.PI * 2;
          const radius = point % 2 ? 17 : 34;
          const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
          if (point === 0) context.moveTo(px, py); else context.lineTo(px, py);
        }
        context.closePath(); context.fill();
      }
      curve(188,270,256,340,324,270);
    } else if (mood === 'sleep') {
      curve(128,180,159,193,191,180); curve(321,180,352,193,384,180);
      curve(216,287,256,278,296,287);
      context.fillStyle = '#9fc4ff'; context.font = 'bold 58px sans-serif'; context.fillText('Z', 377, 110); context.font = 'bold 38px sans-serif'; context.fillText('z', 422, 70);
    } else if (mood === 'impact') {
      context.fillStyle = '#ff9c70'; context.font = 'bold 62px sans-serif'; context.fillText('*', 114, 132); context.fillText('*', 365, 132);
      curve(129,178,158,154,188,178); curve(324,178,354,154,383,178);
      curve(211,296,256,278,301,296);
    } else if (mood === 'sad') {
      curve(128,175,157,195,191,165);
      curve(321,165,355,195,384,175);
      curve(187,304,256,252,325,304);
    } else if (mood === 'tired') {
      curve(128,180,159,185,191,180); curve(321,180,352,185,384,180);
      curve(209,294,256,280,303,294);
    } else if (mood === 'charging') {
      curve(128,184,159,146,191,184); curve(321,184,352,146,384,184);
      curve(193,270,256,334,319,270);
      context.lineWidth = 10;
      context.beginPath(); context.moveTo(256,64); context.lineTo(238,102); context.lineTo(269,102); context.lineTo(250,139); context.stroke();
    } else if (mood === 'focused') {
      curve(128,171,159,159,191,171); curve(321,171,352,159,384,171);
      curve(218,287,256,298,294,287);
    } else {
      if (blink) {
        curve(132,175,159,180,187,175); curve(325,175,352,180,380,175);
      } else {
        curve(132,176,158,140,187,176); curve(325,176,353,140,380,176);
      }
      curve(208,275,256,307,304,275);
    }
    texture.needsUpdate = true;
  };
}
