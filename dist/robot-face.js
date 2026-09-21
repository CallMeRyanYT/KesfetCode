import * as THREE from 'three';

// A small animated display sits just above the supplied robot's face panel.
// The original textured face is revealed for the happy mood.
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
  root.add(face);
  let previous = '';
  return (mood, seconds = 0, reducedMotion = false) => {
    face.visible = mood !== 'happy';
    if (!face.visible) return;
    const blink = !reducedMotion && seconds % 4.6 > 4.43;
    const key = `${mood}:${blink}`;
    if (previous === key) return;
    previous = key;
    context.clearRect(0, 0, 512, 432);
    context.fillStyle = '#070b0c';
    context.beginPath(); context.roundRect(0, 0, 512, 432, 18); context.fill();
    context.strokeStyle = '#ffd35b'; context.lineWidth = 15;
    context.lineCap = 'round'; context.lineJoin = 'round';
    const curve = (x1,y1,cx,cy,x2,y2) => {
      context.beginPath(); context.moveTo(x1,y1); context.quadraticCurveTo(cx,cy,x2,y2); context.stroke();
    };
    if (mood === 'sad') {
      curve(128,175,157,195,191,165);
      curve(321,165,355,195,384,175);
      curve(187,304,256,252,325,304);
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
