// KAŞİF with a living face. The painted robot keeps its body; an SVG face drawn
// in the same tilt as its screen blinks, changes mood and moves its mouth in
// time with recorded voice lines.

export const MOODS = ['neutral', 'happy', 'surprised', 'thinking', 'sad', 'dizzy'];
export const ACTIONS = ['hop', 'wiggle', 'celebrate', 'nod', 'lean', 'dizzy'];

/** Mouth outline for a mood at rest, or an open talking mouth (0 = closed, 1 = wide). */
export function mouthShape(mood = 'neutral', open = 0) {
  if (open > .06) {
    const depth = 22 + 78 * Math.min(1, open), side = 60 + 22 * Math.min(1, open);
    return { d: `M-${side} -8Q0 0 ${side} -8Q${side * .72} ${depth * .85} 0 ${depth}Q-${side * .72} ${depth * .85} -${side} -8Z`, filled: true };
  }
  switch (mood) {
    case 'happy': return { d: 'M-100 -16Q0 70 100 -16', filled: false };
    case 'surprised': return { d: 'M-24 6a24 30 0 1 0 48 0a24 30 0 1 0-48 0', filled: true };
    case 'thinking': return { d: 'M-46 10Q10 2 52 -6', filled: false };
    case 'sad': return { d: 'M-70 30Q0 -22 70 30', filled: false };
    case 'dizzy': return { d: 'M-72 8q18-20 36 0t36 0t36 0t36 0', filled: false };
    default: return { d: 'M-80 -6Q0 46 80 -6', filled: false };
  }
}

// Each feature has a wide, faint copy underneath: a glow without an SVG blur
// filter, so the face never has to be re-filtered while it animates.
const EYE = `<rect class="tr-eye-open" x="-28" y="-46" width="56" height="92" rx="28" stroke-width="26" fill-opacity=".25" stroke-opacity=".22"/><rect class="tr-eye-open" x="-28" y="-46" width="56" height="92" rx="28"/><path class="tr-eye-happy" d="M-50 18Q0-52 50 18" fill="none" stroke-width="46" stroke-opacity=".22" stroke-linecap="round"/><path class="tr-eye-happy" d="M-50 18Q0-52 50 18" fill="none" stroke-width="22" stroke-linecap="round"/><path class="tr-eye-dizzy" d="M0 0m-5 0a5 5 0 1 1 10 0a12 12 0 1 1-24 0a19 19 0 1 1 38 0a26 26 0 1 1-52 0" fill="none" stroke-width="9" stroke-linecap="round"/>`;

/** Markup for a talking KAŞİF. `id` keeps SVG filter ids unique on a page. */
export function talkingRobotMarkup({ mood = 'neutral', className = '', id = 'tr' } = {}) {
  const rest = mouthShape(mood);
  return `<span class="talking-robot ${className}" data-mood="${mood}" data-talking-robot aria-hidden="true"><span class="tr-dizzy-stars" aria-hidden="true"><i>★</i><i>★</i><i>★</i></span><span class="talking-robot-body"><img class="talking-robot-img" src="/assets/kasif-talking.webp" alt="" draggable="false"><svg class="tr-face" viewBox="0 0 1142 1377" aria-hidden="true"><defs><linearGradient id="${id}-gloss" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="M392 168Q560 120 760 110Q770 140 750 160Q560 170 405 222Z" fill="url(#${id}-gloss)"/><g transform="rotate(-10 590 315)"><g class="tr-blush" fill="#ff6f9c"><ellipse cx="420" cy="352" rx="44" ry="20"/><ellipse cx="760" cy="350" rx="44" ry="20"/></g><g fill="#ffd23f" stroke="#ffd23f"><g class="tr-look"><g class="tr-eye" transform="translate(477 276)">${EYE}</g><g class="tr-eye" transform="translate(703 275)">${EYE}</g></g><path class="tr-mouth" transform="translate(586 378)" d="${rest.d}" fill="${rest.filled ? '#2a1600' : 'none'}" stroke-width="42" stroke-opacity=".2" stroke-linecap="round" stroke-linejoin="round"/><path class="tr-mouth" transform="translate(586 378)" d="${rest.d}" fill="${rest.filled ? '#2a1600' : 'none'}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></g></g></svg></span></span>`;
}

let sharedContext = null;
const context = () => {
  if (sharedContext) return sharedContext;
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  sharedContext = AudioContext ? new AudioContext() : null;
  return sharedContext;
};

// One shared output for every voice line: a little headroom and a limiter, so
// voices mixed with sound effects never clip. Built once, never per line.
let voiceOutput = null;
function sharedOutput(ctx) {
  if (voiceOutput?.context === ctx) return voiceOutput.input;
  const gain = ctx.createGain(); gain.gain.value = .82;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = .003; limiter.release.value = .2;
  gain.connect(limiter); limiter.connect(ctx.destination);
  voiceOutput = { context: ctx, input: gain };
  return gain;
}

/** Live nodes per voice line; tests and diagnostics can read this. */
export const voiceNodes = { live: 0 };

/**
 * Reads how loud a playing <audio> element is, 0–1, for lip-sync. The line's
 * own nodes are disconnected when it ends or is stopped (call meter.release()),
 * so a long session never piles up audio processing and starts to stutter.
 */
export function voiceMeter(audio) {
  try {
    const ctx = context();
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser); source.connect(sharedOutput(ctx));
    voiceNodes.live += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true; voiceNodes.live -= 1;
      try { source.disconnect(); analyser.disconnect(); } catch {}
    };
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('emptied', release, { once: true });
    audio.addEventListener('error', release, { once: true });
    const samples = new Uint8Array(analyser.fftSize);
    const meter = () => {
      if (released) return 0;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) { const v = (value - 128) / 128; sum += v * v; }
      return Math.min(1, Math.sqrt(sum / samples.length) * 4.2);
    };
    meter.release = release;
    return meter;
  } catch { return null; }
}

/** Controls one rendered talking robot. */
export class TalkingRobot {
  constructor(root) {
    this.root = root;
    this.mouths = [...root.querySelectorAll('.tr-mouth')];
    this.mood = root.dataset.mood || 'neutral';
    this.level = 0;
    this.frame = 0;
  }
  setMood(mood) {
    if (!MOODS.includes(mood)) mood = 'neutral';
    this.mood = mood; this.root.dataset.mood = mood;
    if (!this.frame) this.setMouth(0);
  }
  setMouth(open) {
    const shape = mouthShape(this.mood, open);
    for (const mouth of this.mouths) {
      mouth.setAttribute('d', shape.d);
      mouth.setAttribute('fill', shape.filled ? '#2a1600' : 'none');
    }
  }
  act(name) {
    if (!ACTIONS.includes(name)) return;
    const body = this.root.querySelector('.talking-robot-body');
    body.classList.remove(...ACTIONS.map(action => `tr-${action}`));
    void body.offsetWidth;
    body.classList.add(`tr-${name}`);
    clearTimeout(this.actTimer);
    this.actTimer = setTimeout(() => body.classList.remove(`tr-${name}`), 1400);
  }
  /**
   * Moves the mouth while speaking. `meter` returns loudness (from voiceMeter);
   * without one, a gentle babble follows the text for `duration` ms.
   */
  talk({ meter = null, duration = 2000 } = {}) {
    this.stopTalking();
    this.root.classList.add('is-talking');
    const start = performance.now();
    const tick = now => {
      const t = (now - start) / 1000;
      const target = meter ? meter() : (now - start < duration ? .35 + .3 * Math.sin(t * 17) * Math.sin(t * 5.3) + .2 * Math.sin(t * 29) : 0);
      // Opening is quick and closing a little slower, like real speech.
      this.level += (Math.max(0, target) - this.level) * (target > this.level ? .55 : .3);
      this.setMouth(this.level < .08 ? 0 : this.level);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
  stopTalking() {
    cancelAnimationFrame(this.frame); this.frame = 0; this.level = 0;
    this.root.classList.remove('is-talking');
    this.setMouth(0);
  }
}

let blinkTimer = 0;
/**
 * Makes every talking robot on the page blink every few seconds. Blinks are a
 * short class toggle, so nothing animates (or repaints) between blinks.
 */
export function startBlinking(doc = document) {
  if (blinkTimer) return;
  const blink = () => {
    if (!doc.hidden && doc.documentElement.dataset.sceneryMotion !== 'off') {
      for (const robot of doc.querySelectorAll('[data-talking-robot]')) {
        robot.classList.add('is-blinking');
        setTimeout(() => robot.classList.remove('is-blinking'), 140);
      }
    }
    blinkTimer = setTimeout(blink, 3200 + Math.random() * 2600);
  };
  blinkTimer = setTimeout(blink, 2000);
}
