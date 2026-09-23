import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { robotPose, MOVE_MS, TURN_MS, PICKUP_MS, PICKUP_EVENTS, WIN_MS, LAUNCH_MS, COUNTDOWN_MS, PRESS_MS, IMPACT_MS, pickupProgress, launchStage } from './robot-motion.js';
import { createRobotFace } from './robot-face.js';
import { createRobotRig, createDriveRig, straightenRobotHead } from './robot-rig.js';

const TILE = 1.28;
const ease = t => t * t * (3 - 2 * t);
const facing = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 };
const palettes = {
  1: { name: 'KEŞFET LAB', ground: 0xe1eaf2, tile: 0xe3edf5, wall: 0x7b93a7, accent: 0xff9f43, rail: 0x536e84 },
  2: { name: 'TRAINING ZONE', ground: 0xe1e8e7, tile: 0xe0f0ed, wall: 0x7cafa8, accent: 0xffb448, rail: 0x497b79 },
  3: { name: 'DISCOVERY VALLEY', ground: 0xd6e6ce, tile: 0xe0e8bf, wall: 0x87937d, accent: 0x77bc58, rail: 0x658452 },
  4: { name: 'ENERGY CENTER', ground: 0xd5e9e7, tile: 0xd9f0ed, wall: 0x527d86, accent: 0x60e0b6, rail: 0x325565 },
  5: { name: 'ROBOT BASE', ground: 0xe0e3e9, tile: 0xd8e1eb, wall: 0x657a94, accent: 0xffba43, rail: 0x3d526b },
  6: { name: 'KEŞFET-1 LAUNCH CENTER', ground: 0xe1def0, tile: 0xe2e5f4, wall: 0x7a81a4, accent: 0xb397ff, rail: 0x535b83 }
};
const itemColors = { crystal: 0x65d8fa, battery: 0x81edb3, key: 0xffd058, component: 0xffa654, fragment: 0xc5a1ff, goal: 0x8be7bd, launch: 0xffc665 };

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
    // Robot actions teach the program: use the explicit in-game setting.
    // OS reduced motion still controls decorative CSS, not essential tile travel.
    this.reducedMotion = false;
    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.robot = new THREE.Group();
    this.robotBody = new THREE.Group();
    this.robot.add(this.robotBody);
    this.scene.add(this.robot);
    this.animateDrive = createDriveRig(this.robotBody);
    this.driveDistance = 0;


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
    this.pickupBurst = new THREE.Group();
    this.scene.add(this.pickupBurst);
    this.pickupBurst.visible = false;
    for (let i = 0; i < 12; i++) this.shape('octahedron', [.07], this.material(0x65d8fa, .2, .3, 0x237191), this.pickupBurst);
    this.chargeHalo = this.shape('torus', [.6, .025], this.material(0x81edb3, .2, .35, 0x279856), this.scene);
    this.chargeHalo.rotation.x = Math.PI / 2;
    this.chargeHalo.visible = false;
    this.camera = new THREE.OrthographicCamera(-6, 6, 6, -6, .1, 80);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
      this.controls.enableZoom = true;
      this.controls.minZoom = .65;
      this.controls.maxZoom = 3;
      this.controls.zoomSpeed = .65;
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
    this.scene.add(new THREE.HemisphereLight(0xc8eaff, 0x687482, .8));
    this.keyLight = new THREE.DirectionalLight(0xfff1dd, 4.2);
    this.keyLight.position.set(-3, 9, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.left = this.keyLight.shadow.camera.bottom = -8;
    this.keyLight.shadow.camera.right = this.keyLight.shadow.camera.top = 8;
    this.keyLight.shadow.normalBias = .018;
    this.keyLight.shadow.bias = -.0004;
    this.scene.add(this.keyLight);
    const rim = new THREE.DirectionalLight(0x93cfff, 1.2);
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
      straightenRobotHead(this.model, rigData);
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
      this.levelId = level?.id;
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
        : kind === 'octahedron' ? new THREE.OctahedronGeometry(...dimensions)
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
    mesh.userData.canvas = canvas;
    mesh.userData.background = background;
    mesh.userData.color = color;
    mesh.userData.value = value;
    this.labels.push(mesh);
    parent.add(mesh);
    return mesh;
  }

  clearWorld() {
    for (const label of this.labels || []) {
      label.material.map.dispose(); label.material.dispose(); label.geometry.dispose();
    }
    this.labels = [];
    this.world.clear();
    this.collectibles = [];
    this.doors = [];
    this.buttons = [];
    this.goalRings = [];
    this.heroCrystal = null;
    this.rocket = this.flame = this.countdownLabel = null;
    this.fans = [];
    this.beacons = [];
  }

  position(row, col) {
    return new THREE.Vector3((col - (this.cols - 1) / 2) * TILE, .12, (row - (this.rows - 1) / 2) * TILE);
  }

  buildWorld(level) {
    this.clearWorld();
    this.level = level;
    this.rows = this.mode === 'menu' ? 5 : level.grid.length;
    this.cols = this.mode === 'menu' ? 5 : level.grid[0].length;
    this.worldNumber = this.mode === 'menu' ? 1 : (level.world || 1);
    this.palette = palettes[this.worldNumber] || palettes[1];
    this.showcase = this.mode !== 'menu' && level.id === 1 && !level.curriculum;
    this.boardWidth = this.cols * TILE + .9;
    this.boardDepth = this.rows * TILE + .9;
    this.pickup = this.pressTime = this.errorTime = this.winTime = this.launchTime = this.turn = null;
    this.impactBurst.visible = false;
    this.pickupBurst.visible = this.chargeHalo.visible = false;
    this.robot.visible = true;
    this.driveDistance = this.driveTurn = 0;
    if (this.mode === 'menu') {
      this.robot.scale.setScalar(2.8); this.robot.position.set(0,0,0);
      this.robot.rotation.set(0,.10,0); this.lastState = null;
      this.setTheme(this.theme || 'dark'); return;
    }
    this.floor = null;
    if(this.showcase) {
      this.boardWidth=3.5;this.boardDepth=2.5;
      this.buildFirstMission();
      const theme=this.theme;this.theme=null;this.setTheme(theme||'light');
      return;
    }
    this.box(this.boardWidth, .62, this.boardDepth, 0x72513a, this.world, [0, -.48, 0]);
    this.box(this.boardWidth + .08, .18, this.boardDepth + .08, 0x75a942, this.world, [0, -.12, 0]);
    for (let i=0; i<this.cols; i++) {
      const x = this.position(0,i).x;
      for (const side of [-1,1]) {
        const stone=this.shape('octahedron',[.28],this.material(0x88715a),this.world,[x,-.62,side*(this.boardDepth/2-.12)]);
        stone.scale.set(1.8,.7,1);
      }
    }
    if (this.mode === 'menu') this.buildLobby();
    else this.buildLevel(level);
    const extent = Math.max(this.boardWidth, this.boardDepth) / 2 + 2;
    this.keyLight.shadow.camera.left = this.keyLight.shadow.camera.bottom = -extent;
    this.keyLight.shadow.camera.right = this.keyLight.shadow.camera.top = extent;
    this.keyLight.shadow.camera.updateProjectionMatrix();
    const theme = this.theme; this.theme = null; this.setTheme(theme || 'light');
  }

  tree(parent, x, z) {
    this.shape('cylinder', [.11, .15, .8], this.material(0x91734f), parent, [x, .5, z]);
    this.shape('cylinder', [0, .50, .85], this.material(0x328249), parent, [x, .91, z]);
    this.shape('cylinder', [0, .36, .75], this.material(0x65ad49), parent, [x, 1.35, z]);
  }

  buildFirstMission() {
    this.robot.scale.setScalar(1.42);
    // Only the two playable squares are shown: the hidden boundary remains in
    // the puzzle grid, so movement and collision rules are unchanged.
    for(const col of [1,2]) {
      const p=this.position(2,col),g=new THREE.Group();g.position.set(p.x,0,p.z);this.world.add(g);
      this.box(1.25,.70,1.25,0x875033,g,[0,-.47,0]);
      this.box(1.27,.15,1.27,0x527c20,g,[0,-.055,0]);
      this.box(1.26,.09,1.26,0x8abd31,g,[0,.045,0]);
      // Rounded earth clods form stratified soil, rather than a flat brown box.
      for(let side=0;side<4;side++)for(let layer=0;layer<3;layer++)for(let n=0;n<5;n++){
        const along=-.50+n*.245+(layer%2)*.035;
        const x=side<2?along:(side===2?-.60:.60),z=side<2?(side===0?-.60:.60):along;
        const rock=this.shape('sphere',[.17],this.material([0x9b6040,0xa66c45,0x815037][(n+layer+col)%3],0,.98),g,[x,-.22-layer*.21,z]);
        rock.scale.set(side<2?1.15:.5,.7,side<2?.5:1.15);
      }
      // Individual overhanging turf tips and tiny grass tufts catch the light.
      for(let side=0;side<4;side++)for(let n=0;n<11;n++){
        const along=-.56+n*.112,x=side<2?along:(side===2?-.63:.63),z=side<2?(side===0?-.63:.63):along;
        const blade=this.shape('cylinder',[.045,0,.11+(n%3)*.025],this.material(n%2?0x73ab24:0x639421,0,.9),g,[x,-.095,z]);blade.rotation.z=.15*Math.sin(n);
      }
      for(let n=0;n<24;n++){
        const x=Math.sin(n*7.1+col)*.57,z=Math.cos(n*3.7)*.57;
        if(Math.abs(x)<.4&&Math.abs(z)<.4)continue;
        this.shape('sphere',[.024],this.material(n%3?0x95c944:0xb5d663,0,.95),g,[x,.10,z]).scale.set(1,.35,1);
      }
      for(const [x,z] of [[-.47,.44],[.47,-.45]]){
        for(let petal=0;petal<5;petal++){const a=petal*Math.PI*2/5;this.shape('sphere',[.035],this.material(col===1?0xffd4de:0xfff3cd,0,.8),g,[x+Math.cos(a)*.046,.12,z+Math.sin(a)*.046]).scale.y=.45;}
        this.shape('sphere',[.025],this.material(0xffcd44,0,.7),g,[x,.13,z]);
      }
    }
    const p=this.position(2,2);
    this.shape('cylinder',[.38,.42,.12],this.material(0x647688,.45,.45),this.world,[p.x,.15,p.z]);
    this.shape('cylinder',[.33,.36,.055],this.material(0xcbdbe6,.4,.3),this.world,[p.x,.24,p.z]);
    const ring=this.ring(this.world,p.x,p.z,0x45efff,.29);ring.position.y=.28;this.goalRings.push(ring);
    for(let n=0;n<8;n++){const a=n*Math.PI/4;const seam=this.box(.018,.08,.085,0x405a70,this.world,[p.x+Math.cos(a)*.38,.21,p.z+Math.sin(a)*.38]);seam.rotation.y=-a;}
    // A luminous goal hologram rises out of the robot's way on arrival.
    this.heroCrystal=new THREE.Group();this.heroCrystal.position.set(p.x,.66,p.z);this.world.add(this.heroCrystal);
    for(const [x,y,z,size] of [[0,0,0,.24],[-.18,-.20,.08,.12],[.18,-.17,.04,.13]]){
      const gem=this.shape('octahedron',[size],this.material(0x29cfff,.3,.16,0x087eae),this.heroCrystal,[x,y,z]);gem.scale.y=1.8;
      const wire=new THREE.LineSegments(new THREE.EdgesGeometry(gem.geometry),new THREE.LineBasicMaterial({color:0xb3faff}));gem.add(wire);
    }
    for(const side of [-1,1]) {this.box(1.12,.012,.018,0x6dffce,this.world,[p.x,.10,p.z+side*.55]);this.box(.018,.012,1.12,0x6dffce,this.world,[p.x+side*.55,.10,p.z]);}
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
    return battery;
  }

  ring(parent, x, z, color, radius = .40) {
    const ring = this.shape('torus', [radius, .023], this.material(color, .2, .4, color), parent, [x, .13, z]);
    ring.rotation.x = Math.PI / 2;
    return ring;
  }

  makeCollectible(tile, row, col) {
    const p = this.position(row, col);
    const kind = tile === 'C' ? 'crystal' : tile === 'B' ? 'battery' : 'KL'.includes(tile) ? 'key' : tile === 'P' ? 'component' : 'fragment';
    const color = tile === 'L' ? 0xc5a1ff : itemColors[kind];
    const object = tile === 'B' ? this.makeBattery(this.world, p.x, p.z) : new THREE.Group();
    if (tile !== 'B') {
      object.position.set(p.x, .72, p.z); this.world.add(object);
      if (tile === 'C') {
        const crystal = this.shape('octahedron', [.36], this.material(color, .38, .18, 0x145b82), object);
        crystal.scale.y = 1.5;
        this.shape('octahedron', [.10], this.material(0xd7f9ff, .4, .18), object, [.23, .05, .08]);
      } else if ('KL'.includes(tile)) {
        this.shape('torus', [.15, .053], this.material(color, .7, .3), object, [0, .13, 0]);
        this.box(.07, .36, .07, color, object, [0, -.12, 0], false);
        this.box(.16, .06, .07, color, object, [.045, -.23, 0], false);
        this.box(.13, .06, .07, color, object, [.035, -.11, 0], false);
      } else if (tile === 'P') {
        this.box(.43, .43, .36, 0xd9e5f2, object, [0, 0, 0]);
        this.box(.47, .10, .40, color, object, [0, 0, 0]);
        this.shape('sphere', [.11], this.material(0x79e7ed, .2, .2, 0x2d9198), object, [0, .10, .20]);
        for (const side of [-1, 1]) this.box(.13, .25, .10, 0x718397, object, [side * .28, 0, 0]);
      } else {
        this.box(.42, .43, .11, color, object, [0, 0, 0]);
        this.label({ a: 'K', b: 'Ş', c: 'F' }[tile], object, [0, 0, .065], .32, '#ffffff', '#8062bc');
      }
    }
    const ring = this.ring(this.world, p.x, p.z, color);
    this.collectibles.push({ key: `${row},${col}`, tile, kind, object, ring, baseY: object.position.y, x: p.x, z: p.z, collectedAt: null });
  }

  makeButton(row, col) {
    const p = this.position(row, col);
    const button = new THREE.Group(); button.position.set(p.x, .105, p.z); this.world.add(button);
    this.shape('cylinder', [.36, .36, .045], this.material(0x536b83, .45, .32), button, [0, 0, 0]);
    const cap = this.shape('cylinder', [.22, .20, .12], this.material(0xff9d45, .35, .28, 0xf06d1d), button, [0, .095, 0]);
    const ring = this.shape('torus', [.31, .022], this.material(0xffc968, .25, .35, 0xf38d25), button, [0, .06, 0]);
    ring.rotation.x = Math.PI / 2;
    this.label('PRESS', button, [0, .13, .22], .48, '#ffffff', '#7d4b2d').rotation.x = -Math.PI / 2;
    this.buttons.push({ key: `${row},${col}`, base: button, cap, ring, pressedAt: null });
  }

  makeDoor(tile, row, col) {
    const p = this.position(row, col);
    const color = tile === 'F' ? 0xaf8afa : 0xffbd4b;
    const gate = new THREE.Group(); gate.position.set(p.x, .1, p.z); this.world.add(gate);
    const horizontal = this.level.grid[row]?.[col - 1] !== '#' || this.level.grid[row]?.[col + 1] !== '#';
    gate.rotation.y = horizontal ? 0 : Math.PI / 2;
    for (const side of [-1, 1]) this.box(.16, 1.5, .14, 0x33495d, gate, [0, .7, side * .54]);
    this.box(.24, .18, 1.22, color, gate, [0, 1.45, 0]);
    const panel = new THREE.Group(); gate.add(panel);
    this.box(.10, 1.2, .91, color, panel, [0, .62, 0]);
    for (let i = 0; i < 5; i++) this.box(.12, .035, .9, 0x736d71, panel, [0, .18 + i * .22, 0], false);
    const light = this.shape('sphere', [.065], this.material(color, .2, .35, color), gate, [.14, 1.46, 0]);
    this.doors.push({ key: `${row},${col}`, panel, light, openedAt: null });
  }

  makeGoal(row, col, rocket = false) {
    const p = this.position(row, col);
    this.shape('cylinder', [.48, .52, .055], this.material(0x455d74), this.world, [p.x, .105, p.z]);
    const ring = this.ring(this.world, p.x, p.z, rocket ? 0xc5a1ff : 0x5edbb6, .46);
    this.goalRings.push(ring);
    if (rocket) {
      const ship = new THREE.Group(); ship.position.set(p.x + .36, .20, p.z - .20); ship.scale.setScalar(.64);
      this.world.add(ship); this.rocket = ship; this.rocketBaseY = ship.position.y;
      this.shape('cylinder', [.30, .34, 1.6], this.material(0xeaf2ff, .5, .32), ship, [0, 1.06, 0]);
      this.shape('cylinder', [0, .30, .55], this.material(0xffa257, .4), ship, [0, 2.13, 0]);
      this.shape('cylinder', [.35, .35, .17], this.material(0x8999c4, .6), ship, [0, .40, 0]);
      this.shape('cylinder', [.31, .31, .10], this.material(0xb5a1f4, .4), ship, [0, 1.62, 0]);
      const window = this.shape('sphere', [.16], this.material(0x64ccea, .4, .18, 0x175e81), ship, [0, 1.32, .28]);
      window.scale.z = .3;
      for (let i = 0; i < 4; i++) {
        const fin = this.box(.12, .54, .38, 0x8794cf, ship, [Math.sin(i * Math.PI / 2) * .32, .33, Math.cos(i * Math.PI / 2) * .32]);
        fin.rotation.y = i * Math.PI / 2;
      }
      this.label('KEŞFET-1', ship, [0, .93, .342], .64);
      this.flame = new THREE.Group(); this.flame.position.y = -.20; ship.add(this.flame);
      const flame = this.shape('cylinder', [.24, 0, .95], this.material(0xffad38, .1, .4, 0xff7021), this.flame);
      this.shape('cylinder', [.12, 0, .70], this.material(0xfff6bb, .1, .4, 0xffd66d), this.flame, [0, .12, .04]);
      flame.castShadow = false; this.flame.visible = false;
      this.countdownLabel = this.label('', this.world, [p.x, 2.7, p.z], 1.2, '#ffffff', '#5263a4');
      this.countdownLabel.visible = false;
    } else {
      this.shape('cylinder', [.026, .026, .63], this.material(0x3d6370), this.world, [p.x + .42, .42, p.z - .36]);
      const flag = this.box(.34, .23, .02, 0x52c7a4, this.world, [p.x + .26, .67, p.z - .36], false);
      flag.rotation.y = -.1;
    }
  }

  buildLobby() {
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const p = this.position(r, c);
      this.box(1.22, .14, 1.22, (r + c) % 2 ? 0xc0cdd5 : 0xd7e0e6, this.world, [p.x, .01, p.z]);
    }
    this.shape('cylinder', [1.45, 1.6, .25], this.material(0x33475e, .45), this.world, [-.35, .2, .6]);
    const pad = this.shape('torus', [1.34, .04], this.material(0xffa52e, .25, .4, 0xff6700), this.world, [-.35, .34, .6]);
    pad.rotation.x = Math.PI / 2;
    this.machine(this.world, -2.65, -2.25, 0);
    this.machine(this.world, 2.5, -2.5, 2);
    this.machine(this.world, 2.5, -1.2, 1);
    const battery = this.makeBattery(this.world, 2, 1.55);
    this.collectibles.push({ key: 'lobby', tile: 'B', kind: 'battery', object: battery, ring: this.ring(this.world, 2, 1.55, 0xffce4a), baseY: .9, x: 2, z: 1.55, collectedAt: null });
    this.robot.scale.setScalar(2.45);
    this.robot.position.set(-.35, .34, .6);
    this.robot.rotation.y = .2;
    this.label('KAŞİF', this.world, [-2.35, .18, 2.75], .9).rotation.x = -Math.PI / 2;
  }

  buildLevel(level) {
    this.robot.scale.setScalar(1.42);
    level.grid.forEach((row, r) => [...row].forEach((tile, c) => {
      const p = this.position(r, c);
      const color = tile === '#' ? 0x85b94e : tile === 'S' ? 0xbbea77 : 'ER'.includes(tile) ? 0xa9e67c : (r+c)%2 ? 0xd3d0c5 : 0xe1dfd4;
      this.box(1.22, .16, 1.22, color, this.world, [p.x, .015, p.z]);
      if (tile === '#') {
        const index = r * this.cols + c;
        if (this.worldNumber <= 3) {
          const rock = this.shape('octahedron', [.49], this.material(index % 2 ? 0x969b86 : 0x7a887e), this.world, [p.x, .33, p.z]);
          rock.scale.set(1.1, .70, 1); rock.rotation.y = index * .7;
          if (index % 3 === 0) this.tree(this.world, p.x, p.z);
        } else if (this.worldNumber === 2) {
          this.box(.89, .33, .89, index % 2 ? 0x77aba7 : 0xa1c8be, this.world, [p.x, .27, p.z]);
          this.box(.72, .035, .09, 0xffc565, this.world, [p.x, .45, p.z], false);
        } else if (this.worldNumber === 4) {
          this.box(.80, .46, .82, 0x527381, this.world, [p.x, .32, p.z]);
          for (const side of [-1, 1]) this.box(.08, .26, .035, 0x6ce3c0, this.world, [p.x + side * .23, .33, p.z + .42], false);
        } else if (this.worldNumber === 6) {
          this.box(.97, .28, .96, 0x8390b0, this.world, [p.x, .24, p.z]);
          this.box(.74, .035, .74, 0xbfc9e0, this.world, [p.x, .405, p.z]);
        } else this.machine(this.world, p.x, p.z, index);
      }
      else {
        // Small corner marks keep each walkable tile easy to count in 3D.
        for (const side of [-1, 1]) this.box(.14, .012, .035, 0x9eaeba, this.world, [p.x + side * .45, .102, p.z + .45], false);
        if ('CBKLPabc'.includes(tile)) this.makeCollectible(tile, r, c);
        if (tile === 'X') this.makeButton(r, c);
        if ('DF'.includes(tile)) this.makeDoor(tile, r, c);
        if ('ER'.includes(tile)) this.makeGoal(r, c, tile === 'R');
        if (tile === 'S') {
          const arrow = this.label('➜', this.world, [p.x, .108, p.z], .62, '#9e581f', '#ffd396');
          arrow.rotation.x = -Math.PI / 2;
          arrow.rotateZ({ right: 0, up: Math.PI / 2, left: Math.PI, down: -Math.PI / 2 }[level.heading || 'right']);
        }
      }
    }));
    // Grid labels are functional coordinates, anchored to the factory floor.
    for (let i = 0; i < this.cols; i++) this.label(String(i + 1), this.world, [this.position(0, i).x, .105, this.boardDepth / 2 - .32], .38).rotation.x = -Math.PI / 2;
    for (let i = 0; i < this.rows; i++) this.label(String(i + 1), this.world, [-this.boardWidth / 2 + .24, .105, this.position(i, 0).z], .38).rotation.x = -Math.PI / 2;
  }

  setTheme(theme) {
    if (!this.renderer || this.theme === theme) return;
    this.theme = theme;
    const dark = theme === 'dark';
    const background = dark ? 0x142236 : (this.palette?.ground || 0xe7edf3);
    this.scene.background = null;
    this.scene.fog = null;
    if (this.floor) this.floor.material = this.material(dark ? 0x1c2f46 : background, .05, .85);
    this.keyLight.intensity = dark ? 2.5 : 3.0;
    this.keyLight.color.setHex(this.showcase ? 0xffe3b0 : 0xfff1dd);
    this.renderer.toneMappingExposure = dark ? .95 : 1.05;
  }

  resize() {
    if (!this.renderer || !this.host) return;
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const extent = Math.max(this.boardWidth || 7.3, this.boardDepth || 7.3);
    const half = this.mode === 'menu' ? Math.max(2.0, 1.6 / aspect)
      : Math.max(extent * .48 + .45, (extent * .63 + .5) / aspect);
    this.camera.left = -half * aspect; this.camera.right = half * aspect;
    this.camera.top = half; this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  resetCamera(top = false) {
    if (!this.controls) return;
    this.cameraMode = top ? 'top' : 'default';
    this.camera.zoom = this.showcase ? 1.3 : 1;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, this.mode === 'menu' ? .5 : .15, 0);
    if(this.showcase)this.controls.target.set(-.64,.12,0);
    const scale = Math.max(1, Math.max(this.boardWidth || 7.3, this.boardDepth || 7.3) / 7.3);
    this.camera.position.set(top ? 0 : 3.7 * scale, top ? 15 * scale : 10.8 * scale, top ? .1 : 13.5 * scale);
    if(this.showcase&&!top)this.camera.position.set(2.8,3.0,5.7);
    if (this.mode === 'menu') { this.controls.target.set(0,1.4,0); this.camera.position.set(.4,2.1,10); this.camera.zoom=1; this.camera.updateProjectionMatrix(); }
    this.controls.update();
  }

  setReducedMotion(reduced) {
    if (this.reducedMotion === reduced) return;
    this.reducedMotion = reduced;
    if (reduced) this.cancelAnimation(this.lastState);
  }

  zoom(amount) {
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom + amount, .65, 3);
    this.camera.updateProjectionMatrix();
  }

  setState(state, animate = true, direction) {
    if (this.mode !== 'game' || !state) return;
    const prior = this.lastState;
    if (!prior || state.steps === 0) {
      this.cancelAnimation(state);
      return;
    }
    // UI rerenders reattach the same canvas; they must not replay or cancel a pickup.
    if (prior.steps === state.steps && prior.row === state.row && prior.col === state.col && prior.error === state.error && prior.won === state.won && prior.heading === state.heading) {
      this.paintState(state);
      return;
    }
    const now = performance.now();
    const moving = prior.row !== state.row || prior.col !== state.col;
    const animated = animate && !this.reducedMotion;
    const arrival = now + (animated && moving ? MOVE_MS : 0);
    this.lastState = { ...state };
    if (moving) {
      const target = this.robotPosition(state);
      if (animated) this.motion = { from: this.robot.position.clone(), to: target, start: now };
      else { this.robot.position.copy(target); this.motion = null; }
    }
    this.targetRotation = facing[state.heading] ?? facing[direction] ?? this.targetRotation ?? Math.PI / 2;
    if (state.heading !== prior.heading) {
      const delta = Math.atan2(Math.sin(this.targetRotation - this.robot.rotation.y), Math.cos(this.targetRotation - this.robot.rotation.y));
      if (animated) this.turn = { start: now, from: this.robot.rotation.y, delta };
      else { this.robot.rotation.y = this.targetRotation; this.turn = null; }
    }
    this.pickup = animate && PICKUP_EVENTS.includes(state.event) ? { kind: state.event, start: arrival } : null;
    this.pressTime = animate && state.event === 'button' ? arrival : null;
    if (state.won && !prior.won && state.event !== 'launch') this.winTime = arrival;
    if (state.event === 'launch' && !prior.won) this.launchTime = animate ? now : now - LAUNCH_MS;
    if (state.error && !prior.error) {
      this.errorTime = now;
      this.impactDirection = ['wall', 'door', 'button', 'invalid'].includes(state.error) ? (state.attemptedHeading || state.heading || direction) : null;
    }
    this.syncObjects(state, animated, arrival, now);
    this.paintState(state);
  }

  robotPosition(state) {
    const p = this.position(state.row, state.col);
    if (this.level?.grid[state.row]?.[state.col] === 'R') { p.x -= .26; p.z += .17; }
    // Stop beside a collectible rather than driving the chassis through it.
    if ('CBKLPabc'.includes(this.level?.grid[state.row]?.[state.col] || ' ')) {
      const angle = facing[state.heading] ?? Math.PI/2;
      p.x -= Math.sin(angle)*.72; p.z -= Math.cos(angle)*.72;
    }
    return p;
  }

  paintState(state) {
    if (this.host) {
      this.host.dataset.row = state.row;
      this.host.dataset.col = state.col;
      this.host.dataset.heading = state.heading || 'right';
      this.host.dataset.doorOpen = !!state.doors?.length;
      this.host.dataset.won = state.won;
      this.host.dataset.event = state.event || '';
      this.host.dataset.world = this.worldNumber;
      this.host.dataset.energy = state.energy ?? 'unlimited';
      this.host.dataset.buttons = state.buttons?.length || 0;
    }
  }

  syncObjects(state, animate = false, arrival = 0, now = 0, reset = false) {
    for (const item of this.collectibles) {
      const collected = item.tile === 'C' ? state.crystals?.includes(item.key)
        : item.tile === 'B' ? state.batteries?.includes(item.key)
          : 'KL'.includes(item.tile) ? state.keys?.includes(item.tile) : state.items?.includes(item.key);
      if (!collected) item.collectedAt = null;
      else if (reset || item.collectedAt === null) item.collectedAt = animate && item.key === `${state.row},${state.col}` ? arrival : -Infinity;
      if (item.collectedAt === -Infinity) item.object.visible = item.ring.visible = false;
      else if (item.collectedAt === null) {
        item.object.visible = item.ring.visible = true;
        item.object.position.set(item.x, item.baseY, item.z); item.object.scale.setScalar(1);
        item.ring.scale.setScalar(1);
      }
    }
    for (const door of this.doors) {
      const opened = state.doors?.includes(door.key);
      if (!opened) door.openedAt = null;
      else if (reset || door.openedAt === null) door.openedAt = animate ? now : -Infinity;
      if (!animate) {
        door.panel.position.y = opened ? 1.15 : 0;
        door.panel.scale.y = opened ? .1 : 1;
      }
      door.light.material = this.material(opened ? 0x69e0af : 0xffbd4b, .2, .35, opened ? 0x2a9c69 : 0xcc8029);
    }
    for (const button of this.buttons || []) {
      const pressed = state.buttons?.includes(button.key);
      if (!pressed) button.pressedAt = null;
      else if (reset || button.pressedAt === null) button.pressedAt = animate ? now : -Infinity;
      if (!animate) {
        button.cap.position.y = pressed ? .045 : .095;
        button.cap.scale.y = pressed ? .7 : 1;
        button.ring.material = this.material(pressed ? 0x72e3ab : 0xffc968, .25, .35, pressed ? 0x2c9c67 : 0xf38d25);
      }
    }
  }

  cancelAnimation(state = this.lastState) {
    this.motion = this.turn = this.pickup = this.pressTime = this.errorTime = this.winTime = this.launchTime = null;
    this.impactBurst.visible = this.pickupBurst.visible = this.chargeHalo.visible = false;
    this.driveDistance = this.driveTurn = 0;
    this.robotBody.position.set(0, 0, 0); this.robotBody.rotation.set(0, 0, 0); this.robotBody.scale.setScalar(1);
    this.animateDrive(0, 0, this.reducedMotion);
    this.animateArms?.(robotPose('still', 0), 0, false, true);
    if (this.rocket) { this.rocket.position.y = this.rocketBaseY; this.rocket.visible = !(state?.won && state.event === 'launch'); }
    if (this.flame) this.flame.visible = false;
    if (this.countdownLabel) this.countdownLabel.visible = false;
    if (!state || this.mode !== 'game') return;
    this.lastState = { ...state };
    this.robot.position.copy(this.robotPosition(state));
    this.targetRotation = facing[state.heading] ?? Math.PI / 2;
    this.robot.rotation.y = this.targetRotation;
    this.syncObjects(state, false, 0, 0, true);
    this.paintState(state);
    if (this.host) { this.host.dataset.animation = 'idle'; this.host.dataset.countdown = ''; }
  }

  tick(now) {
    if (!this.host?.isConnected || document.hidden || this.status === 'unavailable') return;
    const dt = Math.min((now - (this.lastTime || now)) / 1000, .05);
    this.lastTime = now;
    const t = now / 1000;
    this.controls.update(dt);
    const state = this.mode === 'game' ? this.lastState : null;
    if(this.heroCrystal){this.heroCrystal.visible=!state?.won;this.heroCrystal.rotation.y=this.reducedMotion?0:t*.22;this.heroCrystal.position.y=.66+(this.reducedMotion?0:Math.sin(t*2)*.025);}
    const tired = state && Number.isFinite(state.energy) && state.energy <= Math.max(2, Math.floor((state.capacity || 10) * .25));
    const exhausted = state?.error === 'energy';
    let animation = this.mode === 'menu' ? 'wave' : exhausted ? 'sleep' : tired ? 'tired' : state?.readyToLaunch ? 'ready' : 'idle', elapsed = 0;
    if (this.motion) {
      const fraction = pickupProgress(now, this.motion.start, MOVE_MS);
      const previousPosition = this.robot.position.clone();
      this.robot.position.lerpVectors(this.motion.from, this.motion.to, ease(fraction));
      this.driveDistance += previousPosition.distanceTo(this.robot.position) / this.robot.scale.x;
      animation = 'move'; elapsed = now - this.motion.start;
      if (fraction === 1) this.motion = null;
    }
    if (this.turn) {
      const fraction = Math.min(1, (now - this.turn.start) / TURN_MS);
      const previous = this.robot.rotation.y;
      this.robot.rotation.y = this.turn.from + this.turn.delta * ease(fraction);
      this.driveTurn = (this.driveTurn || 0) + this.robot.rotation.y - previous;
      if (!this.motion) { animation = 'turn'; elapsed = now - this.turn.start; }
      if (fraction === 1) this.turn = null;
    }
    if (this.pickup && now >= this.pickup.start && now < this.pickup.start + PICKUP_MS) {
      animation = this.pickup.kind; elapsed = now - this.pickup.start;
    }
    if (this.pressTime !== null && now >= this.pressTime && now - this.pressTime < PRESS_MS) {
      animation = 'press'; elapsed = now - this.pressTime;
    }
    if (this.winTime !== null && now >= this.winTime && now - this.winTime < WIN_MS) { animation = 'win'; elapsed = now - this.winTime; }
    if (this.launchTime !== null && now - this.launchTime < LAUNCH_MS) { animation = 'launch'; elapsed = now - this.launchTime; }
    if (this.errorTime !== null && now - this.errorTime < IMPACT_MS && this.impactDirection) { animation = 'impact'; elapsed = now - this.errorTime; }
    const pose = robotPose(this.reducedMotion ? 'still' : animation, elapsed, this.reducedMotion ? 0 : t);
    if (this.host.dataset.animation !== animation) this.host.dataset.animation = animation;
    this.robotBody.position.set(0, pose.y, pose.z);
    const celebrating = PICKUP_EVENTS.includes(animation) || animation === 'press' || animation === 'win';
    let lookToPlayer = 0;
    if (celebrating && !this.reducedMotion) {
      const look = Math.atan2(this.camera.position.x - this.robot.position.x, this.camera.position.z - this.robot.position.z) - this.robot.rotation.y;
      const duration = animation === 'win' ? WIN_MS : PICKUP_MS;
      lookToPlayer = Math.atan2(Math.sin(look), Math.cos(look)) * Math.sin(Math.min(1, elapsed / duration) * Math.PI) * .7;
    }
    this.robotBody.rotation.set(pose.rx, lookToPlayer, pose.rz);
    this.robotBody.scale.set(pose.sx, pose.sy, pose.sx);
    const pickupPhase = this.pickup ? (now - this.pickup.start) / PICKUP_MS : -1;
    const carrying = !this.reducedMotion && pickupPhase >= 0 && pickupPhase < 1
      ? ease(Math.min(1, pickupPhase / .35)) * (1 - ease(Math.max(0, (pickupPhase - .82) / .18))) : 0;
    this.animateArms?.(pose, t, carrying, this.reducedMotion);
    this.animateDrive(this.driveDistance, this.driveTurn || 0, this.reducedMotion);
    const mood = animation === 'wave' ? 'happy' : animation === 'impact' ? 'impact' : animation === 'sleep' ? 'sleep' : animation === 'battery' ? 'charging'
      : animation === 'press' || PICKUP_EVENTS.includes(animation) || animation === 'win' || animation === 'launch' || state?.won ? 'happy'
        : state?.error ? 'sad' : tired ? 'tired' : animation === 'move' || animation === 'turn' ? 'focused' : 'calm';
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
    this.animateWorld(now, t, dt, animation, elapsed);
    this.host.dataset.robotX = this.robot.position.x.toFixed(4);
    this.host.dataset.robotZ = this.robot.position.z.toFixed(4);
    this.host.dataset.bodyTilt = this.robotBody.rotation.x.toFixed(4);
    this.host.dataset.armSwing = pose.armSwing.toFixed(4);
    this.host.dataset.driveDistance = this.driveDistance.toFixed(4);
    this.host.dataset.storedItems = String((state?.crystals?.length||0)+(state?.keys?.length||0)+(state?.items?.length||0)+(state?.batteries?.length||0));
    this.host.dataset.zoom = this.camera.zoom.toFixed(2);
    this.renderer.render(this.scene, this.camera);
  }

  animateWorld(now, t, dt, animation, elapsed) {
    for (const item of this.collectibles) {
      if (item.collectedAt !== null && now >= item.collectedAt) {
        const p = pickupProgress(now, item.collectedAt);
        item.object.visible = !this.reducedMotion && p < .84;
        item.ring.visible = false;
        this.robotBody.updateWorldMatrix(true, false);
        const hand = this.robotBody.localToWorld(new THREE.Vector3(.40,.85,.12));
        const overhead = this.robotBody.localToWorld(new THREE.Vector3(0,1.16,.12));
        const origin = new THREE.Vector3(item.x,item.baseY,item.z);
        if (this.reducedMotion || p >= 1) item.object.position.copy(overhead);
        else if (p < .35) item.object.position.lerpVectors(origin,hand,ease(p/.35));
        else item.object.position.lerpVectors(hand,overhead,ease(Math.min(1,(p-.35)/.43)));
        item.object.rotation.y = this.robot.rotation.y;
        item.object.scale.setScalar(.45);

      } else if (!this.reducedMotion) {
        item.object.rotation.y = t * .8;
        item.object.position.y = item.baseY + Math.sin(t * 2 + item.x) * .065;
      }
    }
    for (const door of this.doors) {
      const p = door.openedAt === null ? 0 : this.reducedMotion ? 1 : ease(Math.min(1, (now - door.openedAt) / 350));
      door.panel.position.y = p * 1.15; door.panel.scale.y = 1 - p * .9;
    }
    for (const button of this.buttons || []) {
      const p = button.pressedAt === null ? 0 : this.reducedMotion ? 1 : ease(Math.min(1, (now - button.pressedAt) / 260));
      button.cap.position.y = .095 - p * .05;
      button.cap.scale.y = 1 - p * .3;
      button.ring.material = this.material(p > .8 ? 0x72e3ab : 0xffc968, .25, .35, p > .8 ? 0x2c9c67 : 0xf38d25);
    }
    if (!this.reducedMotion) {
      for (const fan of this.fans) fan.rotation.y += dt * .8;
      for (const beacon of this.beacons) beacon.scale.setScalar(1 + Math.sin(t * 2) * .08);
      for (const ring of this.goalRings) ring.scale.setScalar(1 + Math.sin(t * 2) * .035);
    }
    const celebrate = PICKUP_EVENTS.includes(animation) || animation === 'press' || animation === 'win';
    this.pickupBurst.visible = celebrate && !this.reducedMotion;
    this.chargeHalo.visible = animation === 'battery' && !this.reducedMotion;
    if (this.pickupBurst.visible) {
      const p = Math.min(1, elapsed / (animation === 'win' ? WIN_MS : animation === 'press' ? PRESS_MS : PICKUP_MS));
      const color = animation === 'press' ? 0xffc968 : itemColors[animation] || itemColors.goal;
      this.pickupBurst.position.copy(this.robot.position); this.pickupBurst.position.y += .5;
      this.pickupBurst.children.forEach((spark, i) => {
        const angle = i / 12 * Math.PI * 2 + p * 1.2;
        spark.material = this.material(color, .2, .3, color);
        spark.position.set(Math.cos(angle) * (.4 + p * .5), Math.sin(p * Math.PI) * .7 + (i % 3) * .14, Math.sin(angle) * (.4 + p * .5));
        spark.rotation.set(p * 5 + i, p * 3, p * 4);
        spark.scale.setScalar(Math.sin(p * Math.PI) * (i % 2 ? 1.1 : .7));
      });
    }
    if (this.chargeHalo.visible) {
      const p = elapsed / PICKUP_MS;
      this.chargeHalo.position.copy(this.robot.position); this.chargeHalo.position.y += .12 + p;
      this.chargeHalo.scale.setScalar(.8 + Math.sin(p * Math.PI) * .3);
    }
    if (this.rocket && this.launchTime !== null) this.animateLaunch(now);
  }

  animateLaunch(now) {
    const elapsed = now - this.launchTime;
    const stage = launchStage(elapsed);
    this.host.dataset.countdown = stage;
    const label = this.countdownLabel;
    const value = stage === 'liftoff' ? (this.lang === 'tr' ? 'KALKIŞ!' : 'LIFTOFF!') : stage;
    label.visible = elapsed < LAUNCH_MS;
    label.quaternion.copy(this.camera.quaternion);
    if (label.userData.value !== value) {
      const canvas = label.userData.canvas, context = canvas.getContext('2d');
      context.fillStyle = label.userData.background; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.font = 'bold 76px sans-serif'; context.fillText(value, 256, 65);
      label.material.map.needsUpdate = true; label.userData.value = value;
    }
    const lifting = elapsed >= COUNTDOWN_MS;
    this.flame.visible = lifting && !this.reducedMotion && elapsed < LAUNCH_MS;
    if (lifting) {
      const p = Math.min(1, (elapsed - COUNTDOWN_MS) / (LAUNCH_MS - COUNTDOWN_MS));
      this.rocket.position.y = this.rocketBaseY + (this.reducedMotion ? 0 : p * p * 15);
      this.rocket.visible = this.reducedMotion ? p < 1 : p < .99;
      if (!this.reducedMotion) this.flame.scale.set(1 + Math.sin(elapsed * .04) * .08, 1 + p, 1);
    }
  }

  retry() {
    if (this.status === 'error') this.loadRobot();
    else if (this.status === 'unavailable') location.reload();
  }
}
