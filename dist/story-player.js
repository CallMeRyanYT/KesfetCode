// Plays story scenes: painted backdrops, a talking KAŞİF, NOVA's glowing orb,
// voiced lines with word-by-word subtitles, answer buttons and effects.
import { LINES, voicePath } from './story-script.js';
import { talkingRobotMarkup, TalkingRobot, voiceMeter } from './talking-robot.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const NAMES = { kasif: ['KAŞİF', 'KAŞİF'], nova: ['NOVA', 'NOVA'], you: ['YOU', 'SEN'] };
const GEM = '<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 2 36 16 20 46 4 16Z" fill="#7ff4ff" stroke="#1d9bb5" stroke-width="2.5" stroke-linejoin="round"/><path d="M4 16h32M20 2l-7 14 7 30 7-30Z" fill="none" stroke="#1d9bb5" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 12l5-5" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>';
const NOVA_ORB = '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="nova-core" cx="42%" cy="38%"><stop stop-color="#ffffff"/><stop offset=".35" stop-color="#9ff4ff"/><stop offset=".75" stop-color="#2a9fe8"/><stop offset="1" stop-color="#1650b8"/></radialGradient></defs><circle class="nova-ring nova-ring-a" cx="60" cy="60" r="54" fill="none" stroke="#8ff1ff" stroke-width="2" stroke-dasharray="14 10"/><circle class="nova-ring nova-ring-b" cx="60" cy="60" r="45" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="4 8"/><circle class="nova-core" cx="60" cy="60" r="34" fill="url(#nova-core)"/><path d="M44 50q4-6 9 0m14 0q4-6 9 0" stroke="#0d3a6e" stroke-width="3.5" fill="none" stroke-linecap="round"/><path class="nova-mouth" d="M50 68q10 7 20 0" stroke="#0d3a6e" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>';

/** Where a point of a `cover`-fitted image lands inside its box, in pixels. */
export function coverPoint(box, image, x, y, focus = [.5, .5]) {
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const w = image.width * scale, h = image.height * scale;
  return { x: (box.width - w) * focus[0] + x * w, y: (box.height - h) * focus[1] + y * h };
}

/** Splits a line into words with the time each one should light up. */
export function wordTimings(text, duration) {
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map(word => word.replace(/[^\p{L}\p{N}]/gu, '').length + 2);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let elapsed = 0;
  return words.map((word, i) => { const at = elapsed; elapsed += weights[i] / total * duration; return { word, at }; });
}

export function estimatedDuration(text) { return Math.max(1400, text.length * 62); }

/**
 * Plays a scene and resolves when it ends or is skipped.
 * Options: lang ('en'|'tr'), voice (play audio), reducedMotion.
 */
export function playScene(scene, { lang = 'en', voice = true, reducedMotion = false } = {}) {
  const L = lang === 'tr' ? 1 : 0;
  const t = (en, tr) => L ? tr : en;
  const stage = document.createElement('div');
  stage.className = `story-stage${scene.short ? ' is-short' : ''}${reducedMotion ? ' is-still' : ''}${scene.steps.some(step => step.fx === 'boot') ? ' is-asleep' : ''}`;
  stage.setAttribute('role', 'dialog');
  stage.setAttribute('aria-modal', 'true');
  stage.setAttribute('aria-label', t('Story', 'Hikâye'));
  if (scene.nova === 'center') stage.classList.add('nova-center');
  const focus = scene.focus || [.5, .5];
  stage.innerHTML = `<div class="story-bg" style="background-image:url('${scene.backdrop}');background-position:${focus[0] * 100}% ${focus[1] * 100}%"></div><div class="story-vignette"></div>
    <div class="story-fx" aria-hidden="true"></div>
    ${scene.nova ? `<div class="story-nova" aria-hidden="true">${NOVA_ORB}<span>NOVA</span></div>` : ''}
    <div class="story-cast">${talkingRobotMarkup({ mood: 'neutral', id: 'story-kasif', className: 'story-kasif' })}<span class="story-shadow"></span></div>
    <div class="story-counter" hidden>${GEM}<b>0</b><small>/ 15</small></div>
    <button class="story-skip" type="button">${t('Skip', 'Geç')} <span aria-hidden="true">⏭</span></button>
    <div class="story-choices" role="group" aria-label="${t('Your answer', 'Cevabın')}"></div>
    <div class="story-subtitle" aria-live="polite"><span class="story-speaker"></span><p class="story-text"></p><button class="story-next" type="button" aria-label="${t('Next', 'İleri')}">▶</button></div>`;
  document.body.append(stage);
  const robot = new TalkingRobot(stage.querySelector('.story-kasif'));
  const nova = stage.querySelector('.story-nova');
  const subtitle = stage.querySelector('.story-subtitle');
  const speaker = stage.querySelector('.story-speaker');
  const textEl = stage.querySelector('.story-text');
  const choices = stage.querySelector('.story-choices');
  const fx = stage.querySelector('.story-fx');
  const counter = stage.querySelector('.story-counter');
  let finished = false, audio = null, advance = null, novaFrame = 0;
  requestAnimationFrame(() => stage.classList.add('is-open'));

  const stopVoice = () => {
    if (audio) { audio.pause(); audio.src = ''; audio = null; }
    robot.stopTalking();
    cancelAnimationFrame(novaFrame); nova?.style.setProperty('--level', 0); nova?.classList.remove('is-talking');
  };
  // A tap first finishes the current line, then moves on.
  const tapNext = () => advance?.();
  stage.querySelector('.story-next').addEventListener('click', tapNext);
  subtitle.addEventListener('click', event => { if (event.target === subtitle || event.target.closest('.story-text')) tapNext(); });
  stage.querySelector('.story-bg').addEventListener('click', tapNext);

  async function sayLine(id) {
    const line = LINES[id];
    if (!line || finished) return;
    const text = L ? line.tr : line.en;
    stage.dataset.speaker = line.who;
    speaker.textContent = NAMES[line.who]?.[L] || '';
    if (line.who === 'kasif') { robot.setMood(line.mood || 'neutral'); if (!reducedMotion && line.act) robot.act(line.act); }
    else if (line.who === 'nova') robot.setMood('neutral');
    let duration = estimatedDuration(text), meter = null;
    if (voice && line.who !== 'you') {
      audio = new Audio(voicePath(id, lang));
      audio.preload = 'auto';
      const loaded = new Promise(resolve => { audio.addEventListener('loadedmetadata', resolve, { once: true }); audio.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 1200); });
      await loaded;
      if (finished) return;
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        duration = audio.duration * 1000;
        meter = voiceMeter(audio);
        audio.play().catch(() => { meter = null; });
      } else audio = null;
    }
    const timings = wordTimings(text, duration);
    textEl.innerHTML = timings.map(({ word }) => `<span>${esc(word)}</span> `).join('');
    const spans = [...textEl.children];
    if (line.who === 'kasif') robot.talk({ meter, duration });
    if (line.who === 'nova' && nova) {
      nova.classList.add('is-talking');
      const start = performance.now();
      const pulse = now => { const level = meter ? meter() : (now - start < duration ? .45 + .35 * Math.sin((now - start) / 70) : 0); nova.style.setProperty('--level', level.toFixed(2)); novaFrame = requestAnimationFrame(pulse); };
      novaFrame = requestAnimationFrame(pulse);
    }
    const started = performance.now();
    await new Promise(resolve => {
      let done = false;
      const light = () => {
        const elapsed = performance.now() - started;
        spans.forEach((span, i) => span.classList.toggle('is-spoken', elapsed >= timings[i].at));
        if (!done) requestAnimationFrame(light);
      };
      requestAnimationFrame(light);
      const complete = () => { done = true; spans.forEach(span => span.classList.add('is-spoken')); };
      let timer = setTimeout(() => { complete(); stopVoice(); subtitle.classList.add('is-waiting'); timer = setTimeout(finish, scene.short ? 900 : 1400); }, duration + 150);
      const finish = () => { clearTimeout(timer); done = true; advance = null; subtitle.classList.remove('is-waiting'); resolve(); };
      advance = () => {
        if (!done) { clearTimeout(timer); complete(); stopVoice(); subtitle.classList.add('is-waiting'); advance = finish; timer = setTimeout(finish, 1600); }
        else finish();
      };
    });
    stopVoice();
  }

  function choose(options) {
    return new Promise(resolve => {
      robot.setMood('thinking');
      speaker.textContent = NAMES.you[L]; stage.dataset.speaker = 'you';
      textEl.textContent = t('What will you say?', 'Ne söyleyeceksin?');
      choices.innerHTML = options.map(([answer], i) => `<button type="button" class="story-choice" data-index="${i}"><span aria-hidden="true">${['💬', '✨', '🚀'][i] || '💬'}</span>${esc(L ? LINES[answer].tr : LINES[answer].en)}</button>`).join('');
      choices.classList.add('is-open');
      choices.querySelector('button')?.focus({ preventScroll: true });
      choices.onclick = event => {
        const button = event.target.closest('.story-choice');
        if (!button) return;
        choices.onclick = null; choices.classList.remove('is-open');
        const [answer, reply] = options[Number(button.dataset.index)];
        resolve({ answer, reply });
      };
    });
  }

  function burst(kind, count, origin) {
    if (reducedMotion) return;
    const box = stage.getBoundingClientRect();
    const from = origin || { x: box.width * .3, y: box.height * .55 };
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('i');
      piece.className = `story-${kind}`;
      const angle = (i / count) * Math.PI * 2 + Math.random() * .4, distance = 90 + Math.random() * 140;
      piece.style.cssText = `left:${from.x}px;top:${from.y}px;--dx:${Math.cos(angle) * distance}px;--dy:${Math.sin(angle) * distance - 40}px;--delay:${Math.random() * .15}s;--hue:${Math.floor(Math.random() * 60) + 30}`;
      fx.append(piece);
      setTimeout(() => piece.remove(), 1600);
    }
  }

  async function crystals(count) {
    counter.hidden = false;
    const value = counter.querySelector('b');
    const from = Number(value.textContent) || 0;
    if (count <= from) { value.textContent = count; return wait(400); }
    const box = stage.getBoundingClientRect(), target = counter.getBoundingClientRect();
    const flights = Math.min(5, count - from);
    for (let i = 0; i < flights; i++) {
      const gem = document.createElement('i');
      gem.className = 'story-flying-gem';
      gem.innerHTML = GEM;
      gem.style.cssText = `left:${box.width * (.25 + Math.random() * .3)}px;top:${box.height * (.45 + Math.random() * .15)}px;--tx:${target.left - box.left + 10}px;--ty:${target.top - box.top + 4}px;--delay:${i * .14}s`;
      fx.append(gem);
      setTimeout(() => gem.remove(), 1500 + i * 140);
    }
    await wait(reducedMotion ? 200 : 900 + flights * 140);
    counter.classList.remove('is-bump'); void counter.offsetWidth; counter.classList.add('is-bump');
    value.textContent = count;
    await wait(500);
  }

  async function launch() {
    const bg = stage.querySelector('.story-bg');
    const box = stage.getBoundingClientRect(), art = bg.getBoundingClientRect();
    // The painted rocket stands at about 81% across and 36% down the launch backdrop.
    // Measure the drifting backdrop as it is now, so the flame sits under the rocket.
    const spot = coverPoint(art, { width: 1672, height: 941 }, .81, .36, focus);
    const base = { x: art.left - box.left + spot.x, y: art.top - box.top + spot.y };
    stage.classList.add('is-launching');
    const flame = document.createElement('i');
    flame.className = 'story-liftoff';
    flame.style.cssText = `left:${base.x}px;top:${base.y}px`;
    fx.append(flame);
    if (!reducedMotion) for (let i = 0; i < 14; i++) setTimeout(() => burst('smoke', 2, { x: base.x, y: base.y + 10 }), i * 120);
    await wait(reducedMotion ? 600 : 2600);
    stage.classList.add('is-flash');
    await wait(400);
    bg.style.backgroundImage = "url('/assets/spaceport-live.webp')";
    bg.style.backgroundPosition = '50% 50%';
    stage.classList.remove('is-launching'); flame.remove();
    await wait(500);
    stage.classList.remove('is-flash');
    burst('sparkle', 22, { x: box.width * .5, y: box.height * .35 });
  }

  async function titleCard(pair) {
    const card = document.createElement('div');
    card.className = 'story-title-card';
    card.innerHTML = `<strong>${esc(pair[L])}</strong>`;
    stage.append(card);
    requestAnimationFrame(() => card.classList.add('is-shown'));
    await new Promise(resolve => { const done = () => { clearTimeout(timer); resolve(); }; const timer = setTimeout(done, 3200); card.addEventListener('click', done, { once: true }); advance = done; });
  }

  const run = (async () => {
    await wait(scene.short ? 250 : 700);
    for (const step of scene.steps) {
      if (finished) break;
      if (step.line) await sayLine(step.line);
      else if (step.choice) {
        const { answer, reply } = await choose(step.choice);
        if (finished) break;
        await sayLine(answer);
        if (reply) await sayLine(reply);
      } else if (step.fx === 'sparkles') { burst('sparkle', 16); robot.act('celebrate'); await wait(700); }
      else if (step.fx === 'boot') { stage.classList.remove('is-asleep'); stage.classList.add('is-booting'); await wait(reducedMotion ? 300 : 1300); stage.classList.remove('is-booting'); }
      else if (step.fx === 'crystals') await crystals(step.count);
      else if (step.fx === 'launch') await launch();
      else if (step.title) await titleCard(step.title);
    }
  })();

  return new Promise(resolve => {
    const close = () => {
      if (finished) return;
      finished = true; stopVoice(); advance?.();
      document.removeEventListener('keydown', keys, true);
      stage.classList.remove('is-open');
      setTimeout(() => { stage.remove(); resolve(); }, 350);
    };
    const keys = event => {
      // The story owns the keyboard while it plays; the puzzle underneath stays still.
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest?.('button')) { event.preventDefault(); tapNext(); }
    };
    document.addEventListener('keydown', keys, true);
    stage.querySelector('.story-skip').addEventListener('click', close);
    run.then(() => wait(scene.short ? 200 : 600)).then(close);
  });
}

/** A short voiced reaction from the in-mission companion robot. */
export function companionSay(id, { lang = 'en', voice = true, host = document } = {}) {
  const line = LINES[id];
  const root = host.querySelector?.('.mission-companion [data-talking-robot]');
  if (!line || !root) return;
  const robot = new TalkingRobot(root);
  robot.setMood(line.mood || 'happy');
  const text = lang === 'tr' ? line.tr : line.en;
  const bubble = host.querySelector('.mission-companion .companion-reaction');
  if (bubble) { bubble.textContent = text; bubble.classList.remove('is-shown'); void bubble.offsetWidth; bubble.classList.add('is-shown'); }
  let meter = null, duration = estimatedDuration(text);
  if (voice) {
    const audio = new Audio(voicePath(id, lang));
    audio.addEventListener('loadedmetadata', () => { if (Number.isFinite(audio.duration)) duration = audio.duration * 1000; }, { once: true });
    meter = voiceMeter(audio);
    audio.play().catch(() => {});
  }
  robot.talk({ meter, duration });
  clearTimeout(root._reactionTimer);
  root._reactionTimer = setTimeout(() => { robot.stopTalking(); robot.setMood('neutral'); bubble?.classList.remove('is-shown'); }, Math.max(1600, duration + 400));
}
