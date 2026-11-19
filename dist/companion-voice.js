// KAŞİF's voice during missions. One line plays at a time: mission openings
// queue their lines, and quick reactions are skipped while he is talking or
// shortly after, so voices never overlap or pile up.
import { voiceMeter, mouthShape } from './talking-robot.js';

/** Short, stable id for a sentence (FNV-1a), shared with scripts/voices.mjs. */
export function hashText(text) {
  let hash = 0x811c9dc5;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
/** Voice file for a mission tip; tips change with the levels, so files follow the text. */
export const tipVoicePath = (text, lang) => `/assets/voice/${lang === 'tr' ? 'tr' : 'en'}/tip-${hashText(text)}.mp3`;

// The voice files are already sped up when generated (scripts/voices.mjs);
// live time-stretching on tablets made speech choppy, so lines play at 1×.
export const VOICE_RATE = 1;
const estimate = text => Math.max(1100, String(text).length * 50);

export class CompanionVoice {
  constructor({ enabled = () => true, doc = globalThis.document, now = () => performance.now() } = {}) {
    this.enabled = enabled; this.doc = doc; this.now = now;
    this.queue = []; this.current = null; this.cooldownUntil = 0; this.frame = 0; this.level = 0;
  }
  get busy() { return Boolean(this.current || this.queue.length); }

  /** Queues lines ({ text, src, mood, act }); by default replaces anything playing. */
  say(entries, { interrupt = true } = {}) {
    if (interrupt) this.stop();
    this.queue.push(...entries.filter(entry => entry?.text));
    if (!this.current) this.next();
  }

  /** A quick reaction; skipped while talking or within the cooldown. */
  react(entry, { cooldown = 3000, urgent = false } = {}) {
    const now = this.now();
    // Urgent reactions (a bump) may cut in; others wait their turn.
    if (!entry || (!urgent && this.busy) || now < this.cooldownUntil) return false;
    this.cooldownUntil = now + cooldown;
    this.say([entry], { interrupt: urgent });
    return true;
  }

  stop() {
    this.queue = [];
    this.current?.finish(false);
    this.current = null;
    this.restore();
  }

  next() {
    const entry = this.queue.shift();
    if (!entry) { this.current = null; this.restore(); return; }
    this.play(entry);
  }

  play(entry) {
    let audio = null, meter = null, timer = 0, done = false;
    const started = this.now();
    let duration = estimate(entry.text);
    const finish = (advance = true) => {
      if (done) return;
      done = true;
      clearTimeout(timer); cancelAnimationFrame(this.frame); this.frame = 0;
      meter?.release?.();
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load?.(); }
      if (this.current === token) this.current = null;
      if (advance) setTimeout(() => { if (!this.current) this.next(); }, 250);
    };
    const token = { entry, finish };
    this.current = token;
    if (this.enabled() && entry.src && typeof Audio !== 'undefined') {
      audio = new Audio(entry.src);
      audio.playbackRate = VOICE_RATE;
      audio.preservesPitch = true;
      audio.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          duration = audio.duration * 1000 / VOICE_RATE;
          clearTimeout(timer); timer = setTimeout(finish, Math.max(0, duration - (this.now() - started)) + 600);
        }
      }, { once: true });
      audio.addEventListener('ended', () => finish(), { once: true });
      audio.addEventListener('error', () => { meter = null; }, { once: true });
      meter = voiceMeter(audio);
      audio.play().catch(() => { meter = null; });
      timer = setTimeout(finish, duration + 4000);
    } else timer = setTimeout(finish, duration);
    // Show the face and caption straight away, not only on the next animation frame.
    this.apply(entry, 0);
    this.act(entry.act);

    const tick = () => {
      if (done) return;
      const t = (this.now() - started) / 1000;
      const target = meter ? meter() : (this.now() - started < duration ? .35 + .3 * Math.sin(t * 17) * Math.sin(t * 5.3) + .2 * Math.sin(t * 29) : 0);
      this.level += (Math.max(0, target) - this.level) * (target > this.level ? .55 : .3);
      this.apply(entry, this.level < .08 ? 0 : this.level);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  // The page re-renders often; every frame finds the companion currently on screen.
  apply(entry, open) {
    const host = this.doc?.querySelector('.mission-companion');
    if (!host) return;
    host.classList.add('is-speaking');
    const tip = host.querySelector('.companion-tip');
    if (tip) {
      if (!Object.hasOwn(tip, 'restoreText')) tip.restoreText = tip.textContent;
      if (tip.textContent !== entry.text) tip.textContent = entry.text;
    }
    const robot = host.querySelector('[data-talking-robot]');
    if (!robot) return;
    const mood = entry.mood || 'happy';
    if (robot.dataset.mood !== mood) robot.dataset.mood = mood;
    robot.classList.add('is-talking');
    const shape = mouthShape(mood, open);
    for (const mouth of robot.querySelectorAll('.tr-mouth')) {
      if (mouth.getAttribute('d') !== shape.d) mouth.setAttribute('d', shape.d);
      mouth.setAttribute('fill', shape.filled ? '#2a1600' : 'none');
    }
  }

  act(name) {
    const body = this.doc?.querySelector('.mission-companion .talking-robot-body');
    if (!body || !name || this.doc.documentElement.dataset.sceneryMotion === 'off') return;
    body.classList.remove('tr-hop', 'tr-wiggle', 'tr-celebrate', 'tr-nod', 'tr-lean', 'tr-dizzy');
    void body.offsetWidth;
    body.classList.add(`tr-${name}`);
    setTimeout(() => body.classList.remove(`tr-${name}`), 1400);
  }

  /** Back to the resting companion: its tip text, happy face, mouth closed. */
  restore() {
    const host = this.doc?.querySelector('.mission-companion');
    if (!host) return;
    host.classList.remove('is-speaking');
    const tip = host.querySelector('.companion-tip');
    if (tip && Object.hasOwn(tip, 'restoreText')) { tip.textContent = tip.restoreText; delete tip.restoreText; }
    const robot = host.querySelector('[data-talking-robot]');
    if (!robot) return;
    robot.classList.remove('is-talking');
    robot.dataset.mood = 'happy';
    const shape = mouthShape('happy', 0);
    for (const mouth of robot.querySelectorAll('.tr-mouth')) { mouth.setAttribute('d', shape.d); mouth.setAttribute('fill', 'none'); }
  }
}
