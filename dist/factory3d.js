import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { robotPose, MOVE_MS, PRESS_MS, PRESS_LAND_MS, IMPACT_MS } from './robot-motion.js';
import { createRobotFace } from './robot-face.js';
import { createRobotRig } from './robot-rig.js';

const TILE = 1.28;
const position = (row, col) => new THREE.Vector3((col - 2) * TILE, .12, (row - 2) * TILE);
const ease = t => t * t * (3 - 2 * t);
const facing = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 };

/** One persistent canvas, model and GPU context, reused across every UI render. */
export class Factory3D {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus;
    this.status = 'loading';
    this.modelStatus = 'loading';
    this.contextLost = false;
    this.progress = 0;
    this.mode = null;
    this.theme = null;
    this.host = null;
    this.lang = 'en';
    this.materials = new Map();
    this.geometries = new Map();
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.robot = new THREE.Group();
    this.robotBody = new THREE.Group();
    this.robot.add(this.robotBody);
    this.scene.add(this.robot);
    this.impactBurst = new THREE.Group();
    this.scene.add(this.impactBurst);
    this.impactBurst.visible = false;
    for (let i = 0; i < 5; i++) {
      const spark = new THREE.Group();
      for (let j = 0; j < 2; j++) {
        const bar = this.box(.13, .035, .035, i % 2 ? 0xffe78b : 0xff9c24, spark, [0, 0, 0], false);
        bar.rotation.z = j * Math.PI / 2;
      }
      this.impactBurst.add(spark);
    }
    this.camera = new THREE.OrthographicCamera(-6, 6, 6, -6, .1, 80);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
      this.renderer.domElement.className = 'factory-canvas';
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      this.renderer.domElement.addEventListener('webglcontextlost', e => {
        e.preventDefault(); this.contextLost = true; this.setStatus('unavailable');
      });
      this.renderer.domElement.addEventListener('webglcontextrestored', () => {
        this.contextLost = false; this.setStatus(this.modelStatus);
      });
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = .09;
      this.controls.enablePan = false;
      this.controls.enableZoom = false;
      // Keep directions intuitive: the front of the factory always stays in front.
      this.controls.minAzimuthAngle = -.6;
      this.controls.maxAzimuthAngle = .65;
      this.controls.minPolarAngle = .04;
      this.controls.maxPolarAngle = 1.12;
      this.controls.rotateSpeed = .45;
      this.controls.addEventListener('start', () => { this.cameraMode = 'free'; });
      this.setupLights();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.renderer.setAnimationLoop(time => this.tick(time));
      this.loadRobot();
    } catch (error) {
      console.warn('3D graphics unavailable', error);
      this.renderer?.setAnimationLoop(null);
      this.renderer?.dispose();
      this.renderer = null;
      this.setStatus('unavailable');
    }
  }

  setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xc8eaff, 0x687482, 2.4));
    this.keyLight = new THREE.DirectionalLight(0xfff1dd, 4.2);
    this.keyLight.position.set(-3, 9, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = this.keyLight.shadow.camera.bottom = -8;
    this.keyLight.shadow.camera.right = this.keyLight.shadow.camera.top = 8;
    this.keyLight.shadow.normalBias = .035;
    this.keyLight.shadow.bias = -.0004;
    this.scene.add(this.keyLight);
    const rim = new THREE.DirectionalLight(0x93cfff, 2.3);
    rim.position.set(4, 5, -5);
    this.scene.add(rim);
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(this.renderer);
    this.environment = generator.fromScene(room, .04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = .65;
    room.dispose();
    generator.dispose();
  }

  setStatus(status) {
    if (status !== 'unavailable') this.modelStatus = status;
    this.status = this.contextLost ? 'unavailable' : status;
    this.paintStatus();
    this.onStatus(this.status);
  }

  async loadRobot() {
    this.setStatus('loading');
    try {
      const [gltf, rigData] = await Promise.all([new GLTFLoader().loadAsync('/assets/joybot.glb', event => {
        this.progress = event.total ? Math.round(event.loaded / event.total * 100) : 0;
        this.paintStatus();
      }), fetch('/assets/robot-arm-weights.json').then(response => {
        if (!response.ok) throw new Error('Robot joints could not load');
        return response.json();
      })]);
      this.model = gltf.scene;
      this.animateArms = createRobotRig(this.model, rigData);
      const box = new THREE.Box3().setFromObject(this.model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      this.model.scale.setScalar(1 / size.y);
      this.model.position.set(-center.x / size.y, -box.min.y / size.y, -center.z / size.y);
      this.model.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Retain the supplied texture and colors exactly.
        for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
          mat.envMapIntensity = .7;
          if (mat.map) mat.map.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        }
      });
      this.robotBody.add(this.model);
      this.faceDisplay = createRobotFace(this.model);
      this.setStatus('ready');
    } catch (error) {
      console.warn('Robot could not be loaded', error);
      this.setStatus('error');
    }
  }

  attach(host, { mode, level, state, theme, lang }) {
    this.host = host;
    this.lang = lang;
    if (!this.renderer) { this.paintStatus(); return; }
    host.prepend(this.renderer.domElement);
    this.resizeObserver.disconnect();
    this.resizeObserver.observe(host);
    if (this.mode !== mode || (mode === 'game' && this.levelId !== level.id)) {
      this.mode = mode;
      this.levelId = level.id;
      this.buildWorld(level);
      this.lastState = null;
      this.motion = null;
      this.setState(state, false);
      this.resetCamera();
    }
    this.setTheme(theme);
    this.paintStatus();
    this.resize();
  }

  paintStatus() {
    if (!this.host) return;
    this.host.dataset.status = this.status;
    const status = this.host.querySelector('.scene-loading');
    if (!status) return;
    const tr = this.lang === 'tr';
    status.hidden = this.status === 'ready';
    status.querySelector('span').textContent = this.status === 'loading'
      ? `${tr ? 'Robotun hazırlanıyor' : 'Getting your robot ready'}${this.progress ? ` · ${this.progress}%` : '…'}`
      : this.status === 'error'
        ? (tr ? 'Robot yüklenemedi — yeniden dene' : 'The robot could not load — try again')
        : (tr ? '3D görünüm kullanılamıyor — grafik hızlandırmayı açıp sayfayı yenile' : '3D view unavailable — enable graphics acceleration and reload');
    const retry = status.querySelector('button');
    retry.hidden = this.status === 'loading';
    retry.textContent = tr ? 'Yeniden dene' : 'Try again';
  }

  material(color, metalness = .1, roughness = .55, emissive = 0) {
    const key = [color, metalness, roughness, emissive].join(':');
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: .8 }));
    return this.materials.get(key);
  }

  shape(kind, dimensions, material, parent, xyz = [0, 0, 0]) {
    const key = `${kind}:${dimensions.join(',')}`;
    if (!this.geometries.has(key)) {
      const geo = kind === 'box' ? new THREE.BoxGeometry(...dimensions)
        : kind === 'round' ? new RoundedBoxGeometry(...dimensions, 2, .06)
        : kind === 'cylinder' ? new THREE.CylinderGeometry(...dimensions, 24)
        : kind === 'torus' ? new THREE.TorusGeometry(...dimensions, 8, 32)
        : new THREE.SphereGeometry(...dimensions, 12, 8);
      this.geometries.set(key, geo);
    }
    const mesh = new THREE.Mesh(this.geometries.get(key), material);
    mesh.position.set(...xyz);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(w, h, d, color, parent, xyz, rounded = true) {
    return this.shape(rounded ? 'round' : 'box', [w, h, d], this.material(color), parent, xyz);
  }

  label(value, parent, xyz, width = 1.5, color = '#e8f1ff', background = '#273449') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = background; context.fillRect(0, 0, 512, 128);
    context.fillStyle = color; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = 'bold 52px sans-serif'; context.fillText(value, 256, 65);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map });
    const geometry = new THREE.PlaneGeometry(width, width / 4);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...xyz);
    this.labels.push(mesh);
    parent.add(mesh);
    return mesh;
  }

  clearWorld() {
    this.carriedBattery?.removeFromParent();
    this.carriedBattery = null;
    for (const label of this.labels || []) {
      label.material.map.dispose(); label.material.dispose(); label.geometry.dispose();
    }
    this.labels = [];
    this.world.clear();
    this.door = this.switchButton = this.battery = null;
    this.fans = [];
    this.floorMaterials = [];
  }

  buildWorld(level) {
    this.clearWorld();
    this.pressTime = this.errorTime = this.winTime = null;
    this.impactBurst.visible = false;
    this.floor = this.box(200, .1, 200, 0xdde5ed, this.world, [0, -.85, 0], false);
    this.box(7.6, .55, 7.4, 0x27374b, this.world, [0, -.43, 0]);
    this.box(7.7, .11, 7.5, 0x5a6b80, this.world, [0, -.13, 0]);
    // Factory perimeter: service pipes, wall panels, and safety rails.
    const back = new THREE.Group(); this.world.add(back);
    this.box(7.4, 1.05, .25, 0x506075, back, [0, .25, -3.7]);
    this.box(7.45, .10, .34, 0xff8328, back, [0, .82, -3.7]);
    for (let i = -3; i <= 3; i += 1.5) this.box(.045, .91, .03, 0x26374b, back, [i, .25, -3.55], false);
    const pipe = this.shape('cylinder', [.085, .085, 6.9], this.material(0xb2c5d7, .7, .3), back, [0, 1.03, -3.65]);
    pipe.rotation.z = Math.PI / 2;
    for (const x of [-3.1, 3.1]) {
      this.shape('cylinder', [.10, .10, 1.5], this.material(0xff8427, .5), back, [x, .7, -3.65]);
      this.shape('torus', [.14, .04], this.material(0x26364a), back, [x, .45, -3.53]);
    }
    for (let i = 0; i < 22; i++) {
      const stripe = this.box(.18, .025, .30, i % 2 ? 0x27374b : 0xffb436, this.world, [-3.5 + i * .333, -.05, 3.56], false);
      stripe.rotation.y = -.35;
    }
    this.label('KEṢFET LAB', back, [0, .36, -3.55], 1.95);

    if (this.mode === 'menu') this.buildLobby();
    else this.buildLevel(level);
    // Changing levels must also apply the current palette to the new floor.
    const theme = this.theme; this.theme = null; this.setTheme(theme || 'light');
  }

  machine(parent, x, z, index = 0) {
    const h = index % 3 === 0 ? .62 : .43;
    this.box(1.1, h, 1.1, index % 3 === 0 ? 0x658197 : 0x829aaa, parent, [x, h / 2 + .10, z]);
    this.box(1.12, .075, 1.12, 0xa7b8c4, parent, [x, h + .13, z]);
    if (index % 3 === 0) {
      const fan = new THREE.Group(); fan.position.set(x, h + .18, z); parent.add(fan);
      this.shape('cylinder', [.30, .30, .04], this.material(0x2d4257), fan);
      for (const rotation of [0, Math.PI / 2]) {
        const blade = this.box(.47, .025, .09, 0xa1bacb, fan, [0, .04, 0], false);
        blade.rotation.y = rotation;
      }
      this.fans.push(fan);
    } else {
      for (let i = 0; i < 3; i++) this.box(.6, .035, .018, 0x4a667b, parent, [x, .26 + .085 * i, z + .56], false);
    }
    this.box(.17, .06, .025, 0xffb844, parent, [x - .33, .24, z + .57], false);
  }

  makeBattery(parent, x, z) {
    const battery = new THREE.Group(); battery.position.set(x, .9, z); parent.add(battery);
    this.box(.43, .7, .3, 0xffbe2f, battery, [0, 0, 0]);
    this.box(.45, .14, .32, 0x27364b, battery, [0, .28, 0]);
    this.box(.45, .13, .32, 0x27364b, battery, [0, -.29, 0]);
    this.box(.18, .08, .19, 0xb7c9d8, battery, [0, .40, 0]);
    for (const zSide of [-.155, .155]) {
      this.box(.20, .055, .015, 0xffffff, battery, [0, .025, zSide], false);
      this.box(.055, .20, .015, 0xffffff, battery, [0, .025, zSide], false);
    }
    const glow = this.shape('torus', [.42, .027], this.material(0xffce4a, .2, .4, 0xffa200), parent, [x, .155, z]);
    glow.rotation.x = Math.PI / 2;
    this.battery = battery;
    this.batteryRing = glow;
    this.carriedBattery = battery.clone(true);
    this.carriedBattery.scale.setScalar(.65);
    this.carriedBattery.visible = false;
    this.robotBody.add(this.carriedBattery);
  }

  buildLobby() {
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const p = position(r, c);
      this.box(1.22, .14, 1.22, (r + c) % 2 ? 0xc0cdd5 : 0xd7e0e6, this.world, [p.x, .01, p.z]);
    }
    this.shape('cylinder', [1.45, 1.6, .25], this.material(0x33475e, .45), this.world, [-.35, .2, .6]);
    const pad = this.shape('torus', [1.34, .04], this.material(0xffa52e, .25, .4, 0xff6700), this.world, [-.35, .34, .6]);
    pad.rotation.x = Math.PI / 2;
    this.machine(this.world, -2.65, -2.25, 0);
    this.machine(this.world, 2.5, -2.5, 2);
    this.machine(this.world, 2.5, -1.2, 1);
    this.makeBattery(this.world, 2, 1.55);
    this.robot.scale.setScalar(2.45);
    this.robot.position.set(-.35, .34, .6);
    this.robot.rotation.y = .2;
    this.label('01 / 05', this.world, [-2.35, .18, 2.75], .9).rotation.x = -Math.PI / 2;
  }

  buildLevel(level) {
    this.robot.scale.setScalar(1.23);
    level.grid.forEach((row, r) => [...row].forEach((tile, c) => {
      const p = position(r, c);
      const color = tile === '#' ? 0x687f91 : tile === 'S' ? 0xffd396 : tile === 'X' ? 0xf7c27c : 0xe2eaf0;
      this.box(1.22, .16, 1.22, color, this.world, [p.x, .015, p.z]);
      if (tile === '#') this.machine(this.world, p.x, p.z, r * 5 + c);
      else {
        // Small corner marks keep each walkable tile easy to count in 3D.
        for (const side of [-1, 1]) this.box(.14, .012, .035, 0x9eaeba, this.world, [p.x + side * .45, .102, p.z + .45], false);
        if (tile === 'B') this.makeBattery(this.world, p.x, p.z);
        if (tile === 'X') {
          this.shape('cylinder', [.38, .42, .08], this.material(0x394e62), this.world, [p.x, .14, p.z]);
          this.switchButton = this.shape('cylinder', [.29, .29, .11], this.material(0xff7c22, .2, .4, 0x822c00), this.world, [p.x, .22, p.z]);
        }
        if (tile === 'D') {
          const gate = new THREE.Group(); gate.position.set(p.x, .1, p.z); this.world.add(gate);
          for (const side of [-1, 1]) this.box(.16, 1.5, .16, 0x33495d, gate, [0, .7, side * .53]);
          this.box(.24, .18, 1.24, 0xff8a27, gate, [0, 1.45, 0]);
          this.door = new THREE.Group(); gate.add(this.door);
          this.box(.10, 1.2, .88, 0xffb139, this.door, [0, .62, 0]);
          for (let i = 0; i < 5; i++) this.box(.12, .04, .88, 0x8f672c, this.door, [0, .18 + i * .22, 0], false);
        }
      }
    }));
    // Grid labels are functional coordinates, anchored to the factory floor.
    for (let i = 0; i < 5; i++) {
      this.label(String(i + 1), this.world, [(i - 2) * TILE, .105, 3.35], .38).rotation.x = -Math.PI / 2;
      this.label(String(i + 1), this.world, [-3.35, .105, (i - 2) * TILE], .38).rotation.x = -Math.PI / 2;
    }
  }

  setTheme(theme) {
    if (!this.renderer || this.theme === theme) return;
    this.theme = theme;
    const dark = theme === 'dark';
    this.scene.background = new THREE.Color(dark ? 0x142236 : 0xe7edf3);
    this.scene.fog = new THREE.Fog(dark ? 0x142236 : 0xe7edf3, 18, 38);
    if (this.floor) this.floor.material = this.material(dark ? 0x1c2f46 : 0xe7edf3, .05, .85);
    this.keyLight.intensity = dark ? 3.4 : 4.2;
    this.renderer.toneMappingExposure = dark ? 1.05 : 1.25;
  }

  resize() {
    if (!this.renderer || !this.host) return;
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const half = Math.max(this.mode === 'menu' ? 3.95 : 3.65, 4.7 / aspect);
    this.camera.left = -half * aspect; this.camera.right = half * aspect;
    this.camera.top = half; this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  resetCamera(top = false) {
    if (!this.controls) return;
    this.cameraMode = top ? 'top' : 'default';
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, this.mode === 'menu' ? .5 : .15, 0);
    this.camera.position.set(top ? 0 : 3.7, top ? 15 : 10.8, top ? .1 : 13.5);
    this.controls.update();
  }

  zoom(amount) {
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom + amount, .85, 1.45);
    this.camera.updateProjectionMatrix();
  }

  setState(state, animate = true, direction) {
    if (this.mode !== 'game' || !state) return;
    const prior = this.lastState;
    this.lastState = { ...state };
    if (!prior || prior.row !== state.row || prior.col !== state.col) {
      const target = position(state.row, state.col);
      if (animate && prior && !this.reducedMotion) this.motion = { from: this.robot.position.clone(), to: target, start: performance.now() };
      else { this.robot.position.copy(target); this.motion = null; }
    }
    if (direction && facing[direction] !== undefined) this.targetRotation = facing[direction];
    if (!prior || state.steps === 0) {
      this.targetRotation = .25;
      this.robot.rotation.y = this.targetRotation;
      this.winTime = null;
      this.errorTime = null;
      this.pressTime = null;
    }
    if (state.won && !prior?.won) this.winTime = performance.now() + MOVE_MS;
    if (direction === 'press' && animate && state.steps !== prior?.steps && !state.error) this.pressTime = performance.now();
    if (state.error && !prior?.error) {
      this.errorTime = performance.now();
      this.impactDirection = facing[direction] !== undefined ? direction : null;
    }
    if (this.door && !animate && !this.pressTime) this.door.position.y = state.doorOpen ? 1.35 : 0;
    if (this.battery) this.battery.visible = !state.won || !!this.motion;
    if (this.batteryRing) this.batteryRing.visible = !state.won;
    if (this.host) {
      this.host.dataset.row = state.row;
      this.host.dataset.col = state.col;
      this.host.dataset.doorOpen = state.doorOpen;
      this.host.dataset.won = state.won;
    }
  }

  tick(now) {
    if (!this.host?.isConnected || document.hidden || this.status === 'unavailable') return;
    const dt = Math.min((now - (this.lastTime || now)) / 1000, .05);
    this.lastTime = now;
    const t = now / 1000;
    this.controls.update(dt);
    if (this.mode === 'game' && ((this.winTime && now >= this.winTime) ||
        (this.pressTime && now - this.pressTime < PRESS_MS) ||
        (this.errorTime && now - this.errorTime > IMPACT_MS * .7))) {
      this.targetRotation = Math.atan2(this.camera.position.x - this.robot.position.x, this.camera.position.z - this.robot.position.z);
    }
    let animation = 'idle', elapsed = 0;
    if (this.motion) {
      const fraction = Math.min(1, (now - this.motion.start) / MOVE_MS);
      this.robot.position.lerpVectors(this.motion.from, this.motion.to, ease(fraction));
      animation = 'move'; elapsed = now - this.motion.start;
      if (fraction === 1) this.motion = null;
    }
    if (this.mode === 'game' && this.targetRotation !== undefined) {
      const delta = Math.atan2(Math.sin(this.targetRotation - this.robot.rotation.y), Math.cos(this.targetRotation - this.robot.rotation.y));
      this.robot.rotation.y += delta * Math.min(1, dt * 14);
    }
    if (!this.reducedMotion) {
      if (this.battery) { this.battery.rotation.y = t * .7; this.battery.position.y = .86 + Math.sin(t * 2) * .09; }
      for (const fan of this.fans) fan.rotation.y += dt * .8;
      if (this.winTime && now >= this.winTime && now - this.winTime < 1900) { animation = 'win'; elapsed = now - this.winTime; }
      if (this.pressTime && now - this.pressTime < PRESS_MS) { animation = 'press'; elapsed = now - this.pressTime; }
      if (this.errorTime && now - this.errorTime < IMPACT_MS && this.impactDirection) { animation = 'impact'; elapsed = now - this.errorTime; }
    }
    const pose = robotPose(this.reducedMotion ? 'still' : animation, elapsed, this.reducedMotion ? 0 : t);
    if (this.host.dataset.animation !== animation) this.host.dataset.animation = animation;
    this.robotBody.position.set(0, pose.y, pose.z);
    this.robotBody.rotation.set(pose.rx, 0, pose.rz);
    this.robotBody.scale.set(pose.sx, pose.sy, pose.sx);
    const holdingBattery = this.mode === 'game' && this.lastState?.won && now >= this.winTime;
    this.animateArms?.(pose, t, holdingBattery, this.reducedMotion);
    if (this.carriedBattery) {
      this.carriedBattery.visible = !!holdingBattery;
      if (holdingBattery) {
        const lift = this.reducedMotion ? 1 : ease(Math.min(1, (now - this.winTime) / 400));
        this.carriedBattery.position.set(0, .65 + lift * .59, (1 - lift) * .30);
        this.carriedBattery.rotation.set(0, 0, (1 - lift) * -.3);
      }
    }
    if (this.battery && holdingBattery) this.battery.visible = false;
    const mood = this.lastState?.error && this.mode === 'game' ? 'sad'
      : holdingBattery || animation === 'press' ? 'happy' : 'calm';
    this.faceDisplay?.(mood, t, this.reducedMotion);
    if (this.host.dataset.mood !== mood) this.host.dataset.mood = mood;
    this.impactBurst.visible = pose.sparks > .01;
    if (this.impactBurst.visible) {
      this.impactBurst.position.copy(this.robot.position);
      this.impactBurst.position.x += Math.sin(this.targetRotation) * .60;
      this.impactBurst.position.z += Math.cos(this.targetRotation) * .60;
      this.impactBurst.position.y += .9;
      this.impactBurst.children.forEach((spark, i) => {
        const angle = i / 5 * Math.PI * 2;
        spark.position.set(Math.cos(angle) * .28 * pose.sparks, Math.sin(angle) * .25 * pose.sparks, 0);
        spark.rotation.z = t * 2 + i;
        spark.scale.setScalar(pose.sparks);
      });
    }
    const landed = !this.pressTime || now - this.pressTime >= PRESS_LAND_MS || this.reducedMotion;
    const activated = this.lastState?.doorOpen && landed;
    if (this.switchButton) {
      this.switchButton.position.y = activated ? .16 : .22;
      this.switchButton.material = this.material(activated ? 0x5be1b1 : 0xff7c22, .2, .4, activated ? 0x168655 : 0x822c00);
    }
    if (this.door) {
      const target = activated ? 1.35 : 0;
      this.door.position.y += (target - this.door.position.y) * Math.min(1, dt * 10);
    }
    this.renderer.render(this.scene, this.camera);
  }

  retry() {
    if (this.status === 'error') this.loadRobot();
    else if (this.status === 'unavailable') location.reload();
  }
}
