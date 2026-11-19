import { icon } from './icons.js';

const directionLabels = {
  up: ['Up', 'Yukarı'],
  right: ['Right', 'Sağ'],
  down: ['Down', 'Aşağı'],
  left: ['Left', 'Sol']
};
const guideDirection = direction => Object.hasOwn(directionLabels, direction) ? direction : 'up';
const handMarkup = '<div class="tip-hand"><svg viewBox="0 0 72 82"><circle class="tip-touch" cx="18" cy="17" r="13"/><path d="M27 68 9 46Q5 41 9 38Q13 35 18 40L26 48 11 20Q8 14 13 11Q18 8 22 14L35 35 30 24Q27 18 32 16Q37 14 40 20L47 33 43 24Q40 18 45 16Q50 14 53 20L59 34Q61 30 65 33Q70 37 69 47L66 61Q64 70 55 74L45 79Z"/></svg></div>';

export const isFirstMission = (chapter, missionId) => chapter === 0 && missionId === 1;

// `target` is how many blocks the first mission needs; Start is suggested once all are placed.
export function guideStep({ chapter, missionId, blockCount, running, won, dismissed, target = 1 }) {
  if (!isFirstMission(chapter, missionId) || running || won || dismissed) return null;
  return blockCount >= Math.max(1, target) ? 'run' : 'drag';
}

export function guideMarkup(step, lang, direction = 'up') {
  if (step !== 'drag' && step !== 'run') return '';
  const tr = lang === 'tr';
  if (step === 'run') {
    const message = tr ? 'Harika! Şimdi sarı Başla bloğuna bas.' : 'Great! Now press the yellow Start block.';
    return `<div class="first-mission-tip" data-guide-step="run"><span class="tip-number" aria-hidden="true">2</span><p role="status">${message}</p><button data-action="dismiss-guide" aria-label="${tr ? 'İpucunu kapat' : 'Dismiss tip'}">×</button><div class="tip-visual" aria-hidden="true" hidden>${handMarkup}</div></div>`;
  }
  const action = guideDirection(direction), label = directionLabels[action][tr ? 1 : 0];
  const message = tr ? `${label} bloğunu Başla bloğunun altına sürükleyip birleştir. İstersen bloğa tıklayabilirsin.` : `Drag ${label} below Start and snap it into place. You can also click the block.`;
  return `<div class="first-mission-tip" data-guide-step="drag"><span class="tip-number" aria-hidden="true">1</span><p role="status">${message}</p><button data-action="dismiss-guide" aria-label="${tr ? 'İpucunu kapat' : 'Dismiss tip'}">×</button><div class="tip-visual" aria-hidden="true" hidden><div class="tip-ghost"><span class="puzzle-command">${icon(action)}<span>${label}</span></span></div>${handMarkup}</div></div>`;
}

// This only positions decorative HTML. It never dispatches a drag, click, or
// game command; the player must add the real block and press Start themselves.
export function mountFirstMissionGuide(root, direction = 'up') {
  const tip = root.querySelector('.first-mission-tip');
  if (!tip) return () => {};
  if (tip.dataset.guideStep === 'run') {
    const start = root.querySelector('.puzzle-start');
    const visual = tip.querySelector('.tip-visual');
    if (!start || !visual) return () => {};
    let frame, dragging = false;
    const position = () => {
      const rect = start.getBoundingClientRect();
      visual.style.setProperty('--from-x', `${rect.left + rect.width / 2 - 28}px`);
      visual.style.setProperty('--from-y', `${rect.top + rect.height / 2 - 30}px`);
      visual.style.setProperty('--hand-offset-y', '19px');
      visual.hidden = dragging || document.querySelector('dialog[open]') !== null || rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); };
    const observer = new ResizeObserver(schedule);
    observer.observe(start); observer.observe(tip);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const hide = () => { dragging = true; visual.hidden = true; };
    const resume = () => { dragging = false; schedule(); };
    root.addEventListener('puzzle-dragstart', hide);
    root.addEventListener('puzzle-dragend', resume);
    position();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true);
      root.removeEventListener('puzzle-dragstart', hide); root.removeEventListener('puzzle-dragend', resume);
    };
  }
  if (tip.dataset.guideStep !== 'drag') return () => {};
  const visual = tip.querySelector('.tip-visual');
  const source = root.querySelector(`[data-add="${guideDirection(direction)}"]`);
  const target = root.querySelector('.first-block-slot');
  if (!source || !target) return () => {};
  visual.dataset.motion = 'on';
  source.classList.add('tip-source');
  target.classList.add('tip-target');

  let frame, dragging = false;
  const position = () => {
    const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
    const ghost = visual.querySelector('.tip-ghost'), puzzle = !!root.querySelector('.puzzle-editor');
    const ghostWidth = puzzle ? to.width : 62, ghostHeight = puzzle ? to.height : 60;
    if (puzzle) { ghost.style.width = `${ghostWidth}px`; ghost.style.height = `${ghostHeight}px`; }
    visual.style.setProperty('--hand-offset-x', `${(puzzle ? from.width : ghostWidth) / 2 - 13}px`);
    visual.style.setProperty('--from-x', `${puzzle ? from.left : from.left + from.width / 2 - ghostWidth / 2}px`);
    visual.style.setProperty('--from-y', `${from.top + from.height / 2 - ghostHeight / 2}px`);
    visual.style.setProperty('--to-x', `${puzzle ? to.left : to.left + to.width / 2 - ghostWidth / 2}px`);
    visual.style.setProperty('--to-y', `${to.top + to.height / 2 - ghostHeight / 2}px`);
    // Keep the finger upright and use the same offset throughout the carry.
    // Near the viewport edge, place it higher on the block instead of flipping.
    const handOffsetY = Math.min(19, window.innerHeight - 64 - Math.max(from.top + from.height / 2 - ghostHeight / 2, to.top + to.height / 2 - ghostHeight / 2));
    visual.style.setProperty('--hand-offset-y', `${handOffsetY}px`);
    // On phones both shelves come into view after scrolling down. Keep the
    // hand away from unrelated content while either shelf is off screen.
    visual.hidden = dragging || document.querySelector('dialog[open]') !== null
      || from.top < 0 || from.bottom > window.innerHeight || to.top < 0 || to.bottom > window.innerHeight;
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); };
  const observer = new ResizeObserver(schedule);
  observer.observe(source); observer.observe(target); observer.observe(tip);
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);
  // Hide the decorative hand while the player makes a real drag.
  const hide = () => { dragging = true; visual.hidden = true; };
  const resume = () => { dragging = false; schedule(); };
  root.addEventListener('dragstart', hide);
  root.addEventListener('dragend', resume);
  root.addEventListener('puzzle-dragstart', hide);
  root.addEventListener('puzzle-dragend', resume);
  position();
  return () => {
    cancelAnimationFrame(frame); observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule, true);
    root.removeEventListener('dragstart', hide);
    root.removeEventListener('dragend', resume);
    root.removeEventListener('puzzle-dragstart', hide);
    root.removeEventListener('puzzle-dragend', resume);
    source.classList.remove('tip-source'); target.classList.remove('tip-target');
  };
}
