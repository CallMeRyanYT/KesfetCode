/** Animates pixels of the illustrations, not stand-in 3D characters or dotted lines. */
const cache = new Map();
function load(src) {
  if (!cache.has(src)) cache.set(src, new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;}));
  return cache.get(src);
}
// Trace the actual forearm and four fingers. The upper arm stays attached to
// the body; a rigid rotation at the elbow cannot stretch the painted armor.
const FOREARM = 'M311 682 L339 636 Q345 622 352 626 L355 626 Q352 620 352 611 '
  + 'Q345 603 345 593 Q345 585 352 585 Q360 585 365 600 L369 601 '
  + 'L376 572 Q378 563 385 564 Q395 565 393 574 L389 595 L393 599 '
  + 'L400 578 Q404 568 411 572 Q420 575 416 583 L407 604 L411 608 '
  + 'L417 595 Q422 588 428 593 Q433 597 427 605 L416 621 '
  + 'Q410 636 391 646 L387 657 Q366 692 344 705 '
  + 'Q330 718 318 707 Q311 700 311 682 Z';

function wavingArm(image, plate) {
  const path = new Path2D(FOREARM);
  const arm = document.createElement('canvas'); arm.width=image.width; arm.height=image.height;
  const a=arm.getContext('2d'); a.save(); a.clip(path); a.drawImage(image,0,0); a.restore();
  // Erase a padded footprint, including the old antialiased silhouette. The
  // former exact clip left stationary slivers behind the moving fingers.
  const base=document.createElement('canvas'); base.width=image.width; base.height=image.height;
  const b=base.getContext('2d'); b.fillStyle='#fff'; b.strokeStyle='#fff'; b.lineWidth=7; b.lineJoin='round';
  b.fill(path); b.stroke(path); b.globalCompositeOperation='source-in'; b.drawImage(plate,0,0);
  b.globalCompositeOperation='destination-over'; b.drawImage(image,0,0); b.globalCompositeOperation='source-over';
  return {arm,base};
}
function chapterSprite(source, chapter) {
  const sprite=document.createElement('canvas');sprite.width=512;sprite.height=1024;
  sprite.getContext('2d').drawImage(source,chapter*512,0,512,1024,0,0,512,1024);
  return sprite;
}
function satelliteLayer(img,chapter) {
  const layer=document.createElement('canvas');layer.width=512;layer.height=1024;
  const c=layer.getContext('2d');
  // Bowls and feed arms are rigid sprites; their support posts remain stationary.
  const path=new Path2D(chapter===1
    ? 'M358 237 Q381 223 421 248 L427 262 Q450 285 442 304 Q430 322 397 304 Q370 285 358 256 Z'
    : 'M365 328 Q392 310 426 340 L435 347 Q451 369 437 380 Q413 393 388 377 Q371 363 365 341 Z');
  c.clip(path);c.drawImage(img,0,0);
  return layer;
}
// Water is animated by moving soft highlight streaks over the untouched painting.
// Masks were traced from the artwork's water pixels, so rocks, roofs and the
// crystal stay dry. Rectangles are disjoint image-pixel regions; flow is the
// on-screen direction the water travels and speed is in image pixels/second.
export const MAP_WATER = [
  {r:[90,0,405,400],flow:[.3,1],speed:70,fall:true},
  {r:[255,470,660,610],flow:[1,.3],speed:16},
  {r:[660,560,800,705],flow:[0,1],speed:80,fall:true},
  {r:[620,705,980,815],flow:[.4,1],speed:30},
  {r:[770,815,930,950],flow:[0,1],speed:80,fall:true},
  {r:[930,815,1024,950],flow:[.25,1],speed:45,fall:true},
  {r:[340,815,770,1060],flow:[1,.3],speed:16},
  {r:[770,950,840,1060],flow:[1,.3],speed:16},
  {r:[840,950,1024,1400],flow:[.25,1],speed:45,fall:true}
];
export const CARD_WATER = [
  {r:[240,410,420,480],flow:[.15,1],speed:24},
  {r:[240,480,385,810],flow:[0,1],speed:70,fall:true},
  {r:[88,480,132,720],flow:[0,1],speed:60,fall:true},
  {r:[395,480,447,690],flow:[0,1],speed:60,fall:true}
];
const TILE = 128;
function streakTile(fall, seed = 7) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const tile = document.createElement('canvas'); tile.width = tile.height = TILE;
  const t = tile.getContext('2d'); t.lineCap = 'round';
  for (let i = 0; i < (fall ? 56 : 38); i++) {
    const x = rand() * TILE, y = rand() * TILE;
    const len = fall ? 18 + rand() * 50 : 5 + rand() * 12;
    const alpha = fall ? .22 + rand() * .4 : .16 + rand() * .32;
    t.strokeStyle = `rgba(240,255,255,${alpha.toFixed(2)})`;
    t.lineWidth = fall ? .8 + rand() * 1.8 : 1 + rand() * 1.4;
    // Each streak is drawn across the wrapped edges so the tile repeats seamlessly.
    for (const dx of [-TILE, 0, TILE]) for (const dy of [-TILE, 0, TILE]) {
      t.beginPath(); t.moveTo(x + dx, y + dy); t.lineTo(x + dx, y + dy + len); t.stroke();
    }
  }
  return tile;
}
function waterRegions(maskImage, regions) {
  const fallTile = streakTile(true), riverTile = streakTile(false, 19);
  return regions.map(region => {
    const [x0, y0, x1, y1] = region.r, w = x1 - x0, h = y1 - y0;
    const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
    mask.getContext('2d').drawImage(maskImage, x0, y0, w, h, 0, 0, w, h);
    const layer = document.createElement('canvas'); layer.width = w; layer.height = h;
    const l = layer.getContext('2d');
    const [dx, dy] = region.flow, len = Math.hypot(dx, dy);
    const tile = region.fall ? fallTile : riverTile;
    return { ...region, x: x0, y: y0, w, h, mask, layer, l,
      angle: Math.atan2(-dx / len, dy / len) * 180 / Math.PI,
      patterns: [l.createPattern(tile, 'repeat'), l.createPattern(tile, 'repeat')] };
  });
}
function paintWater(c, regions, time, overlay = true) {
  for (const p of regions) {
    const a = p.l;
    a.globalCompositeOperation = 'source-over'; a.clearRect(0, 0, p.w, p.h);
    // Two layers at different scales and speeds avoid a visibly repeating tile.
    [[1, 1, 1], [1.7, .62, .7]].forEach(([scale, rate, alpha], i) => {
      const pattern = p.patterns[i], travel = (time * p.speed * rate) % (TILE * scale);
      pattern.setTransform(new DOMMatrix().translate(p.w / 2, p.h / 2).rotate(p.angle).translate(0, travel).scale(scale));
      a.globalAlpha = alpha; a.fillStyle = pattern; a.fillRect(0, 0, p.w, p.h);
    });
    a.globalAlpha = 1; a.globalCompositeOperation = 'destination-in'; a.drawImage(p.mask, 0, 0);
    // A transparent overlay is cleared first; the card redraws its painting instead.
    if (overlay) c.clearRect(p.x, p.y, p.w, p.h);
    c.drawImage(p.layer, p.x, p.y);
  }
}
// Gull silhouettes keep their real proportions at every map size.
const BIRDS = [
  { y: .16, amp: .025, duration: 26, delay: 0, size: 1 },
  { y: .2, amp: .02, duration: 26, delay: -.6, size: .82 },
  { y: .42, amp: .03, duration: 31, delay: -12, size: .95 },
  { y: .62, amp: .025, duration: 28, delay: -20, size: .9 },
  { y: .66, amp: .02, duration: 28, delay: -20.7, size: .75 }
];
export function birdPose(bird, time) {
  const progress = ((((time + bird.delay) / bird.duration) % 1) + 1) % 1;
  const cycle = (((time + bird.delay * 1.7) % 3.2) + 3.2) % 3.2;
  // Flap for two seconds, then glide with the wings held in a shallow V. The
  // flap fades in and out, so the wings never snap between the two poses.
  const ease = x => x * x * (3 - 2 * x);
  const flapping = cycle < 2 ? ease(Math.min(1, cycle / .3, (2 - cycle) / .3)) : 0;
  const lift = .3 + flapping * (Math.sin(cycle * Math.PI * 2 / .45) - .3);
  return { x: -.06 + progress * 1.12, y: bird.y + Math.sin(progress * Math.PI * 2.4) * bird.amp, lift };
}
function paintBirds(c, width, height, time) {
  const span = Math.max(9, Math.min(20, width * .024));
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = c.fillStyle = 'rgba(20,44,58,.82)';
  for (const bird of BIRDS) {
    const { x, y, lift } = birdPose(bird, time), s = span * bird.size;
    c.save(); c.translate(x * width, y * height);
    c.lineWidth = Math.max(1.3, s * .12); c.beginPath();
    for (const side of [-1, 1]) {
      c.moveTo(0, 0);
      c.quadraticCurveTo(side * s * .42, -s * .2 - lift * s * .22, side * s, s * .06 - lift * s * .4);
    }
    c.stroke();
    c.beginPath(); c.ellipse(0, s * .03, s * .1, s * .065, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
}
export function mountIllustrations(root) {
  let stopped = false, frame = 0, last = 0, time = 0;
  const entries = [];
  const watcher = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(items => {
    for (const item of items) {
      const entry = entries.find(e => e.canvas === item.target);
      if (entry) entry.visible = item.isIntersecting;
    }
  });
  const add = entry => { entry.visible = true; entries.push(entry); watcher?.observe(entry.canvas); entry.canvas.dataset.ready = 'true'; };
  for (const canvas of root.querySelectorAll('canvas[data-illustration]')) {
    const kind = canvas.dataset.illustration;
    if (kind === 'birds') { add({ canvas, ctx: canvas.getContext('2d'), birds: true }); continue; }
    const home = kind === 'robot', chapter = kind === 'chapter' ? Number(canvas.dataset.chapter) : null;
    const src = home ? '/assets/spaceport-menu.webp' : canvas.dataset.src;
    const extra = home ? load('/assets/spaceport-arm-plate.webp')
      : chapter > 0 ? load('/assets/chapter-dish-plate.webp')
      : chapter === 0 ? load('/assets/chapter-one-card-water-mask.png')
      : canvas.dataset.mask ? load(canvas.dataset.mask) : Promise.resolve(null);
    Promise.all([load(src), extra]).then(([img, plate]) => {
      if (stopped) return;
      if (chapter !== null) { img = chapterSprite(img, chapter); if (chapter > 0 && plate) plate = chapterSprite(plate, chapter); }
      const entry = { canvas, ctx: canvas.getContext('2d'), img, plate, home, chapter };
      if (home) Object.assign(entry, wavingArm(img, plate));
      else if (chapter > 0) entry.dish = satelliteLayer(img, chapter);
      else if (chapter === 0) entry.regions = waterRegions(plate, CARD_WATER);
      else if (plate) entry.regions = waterRegions(plate, MAP_WATER);
      else { canvas.hidden = true; return; }
      canvas.width = img.width; canvas.height = img.height;
      add(entry);
    }).catch(() => { canvas.hidden = true; });
  }
  function tick(now) {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    if (now - last < 45 || document.hidden) return;
    const dt = Math.min(60, now - last); last = now;
    const enabled = document.documentElement.dataset.sceneryMotion !== 'off';
    if (enabled) time += dt / 1000;
    for (const e of entries) {
      // Off-screen artwork keeps its last frame and costs nothing while scrolling.
      if (!e.visible && e.drawn) continue;
      const { ctx: c, canvas, img } = e;
      if (e.birds) {
        const ratio = Math.min(2, globalThis.devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) continue;
        if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
        c.setTransform(ratio, 0, 0, ratio, 0, 0); c.clearRect(0, 0, w, h); paintBirds(c, w, h, time);
        e.drawn = true; continue;
      }
      if (e.drawn && !enabled) continue;
      if (e.home) {
        // Paint the full illustration once; afterwards only the waving forearm's area changes.
        if (!e.drawn) c.drawImage(img, 0, 0);
        c.save(); c.beginPath(); c.rect(280, 530, 190, 215); c.clip();
        c.drawImage(img, 0, 0);
        if (enabled) {
          c.drawImage(e.base, 0, 0);
          const angle = Math.sin(time * 2.8) * .13;
          c.save(); c.translate(327, 697); c.rotate(angle); c.translate(-327, -697); c.drawImage(e.arm, 0, 0); c.restore();
          // Original circular elbow cap covers the seam in both directions.
          c.save(); c.beginPath(); c.arc(327, 697, 11, 0, Math.PI * 2); c.clip(); c.drawImage(img, 0, 0); c.restore();
          canvas.dataset.armAngle = angle.toFixed(3);
        }
        c.restore();
      } else if (e.chapter > 0) {
        // Only the satellite dish moves; the rest of the card keeps its first paint.
        if (!e.drawn) c.drawImage(img, 0, 0);
        const pivot = e.chapter === 1 ? [380, 304] : [393, 376];
        c.save(); c.beginPath(); c.rect(pivot[0] - 50, pivot[1] - 110, 125, 140); c.clip();
        c.drawImage(enabled ? e.plate : img, 0, 0);
        if (enabled) {
          const angle = Math.sin(time * .8 + e.chapter) * .12;
          c.save(); c.translate(...pivot); c.rotate(angle); c.translate(-pivot[0], -pivot[1]);
          c.beginPath(); c.moveTo(...pivot); c.lineTo(pivot[0] + 16, pivot[1] - 9); c.strokeStyle = e.chapter === 1 ? '#665453' : '#444c70'; c.lineWidth = 8; c.lineCap = 'round'; c.stroke();
          c.drawImage(e.dish, 0, 0); c.restore(); canvas.dataset.dishAngle = angle.toFixed(3);
        }
        c.restore();
      } else if (e.chapter === 0) {
        // The card canvas is the artwork itself; redraw only the stream's rectangles.
        if (!e.drawn) c.drawImage(img, 0, 0);
        for (const p of e.regions) c.drawImage(img, p.x, p.y, p.w, p.h, p.x, p.y, p.w, p.h);
        if (enabled) paintWater(c, e.regions, time, false);
        canvas.dataset.flowTime = time.toFixed(2);
      } else {
        // The map canvas is a transparent overlay above the painting.
        if (enabled) { paintWater(c, e.regions, time); canvas.dataset.flowTime = time.toFixed(2); }
      }
      e.drawn = true;
    }
  }
  frame = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(frame); watcher?.disconnect(); };
}
