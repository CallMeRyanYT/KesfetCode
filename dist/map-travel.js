// KAŞİF walks along the Explorer map from where the child last saw him to the
// next mission, turning each finished mission green as he passes it.
const KEY = chapter => `kesfet-map-position-${chapter}`;
export const HOP_MS = 650;

/** Where the walk starts and ends. A first visit or a reset just places him. */
export function travelPlan(stored, target) {
  if (!Number.isInteger(stored) || stored < 0 || stored >= target) return { from: target, to: target };
  return { from: stored, to: target };
}

export function readPosition(chapter, storage = globalThis.localStorage) {
  try { const value = Number.parseInt(storage?.getItem(KEY(chapter)), 10); return Number.isInteger(value) ? value : null; } catch { return null; }
}
export function savePosition(chapter, index, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY(chapter), String(index)); } catch {}
}
export function resetPositions(storage = globalThis.localStorage) {
  for (const chapter of [0, 1, 2]) { try { storage?.removeItem(KEY(chapter)); } catch {} }
}

/**
 * Animates the walk on a rendered map. `onDone` runs when KAŞİF arrives (at
 * once when there is nowhere to walk). Returns a cleanup function.
 */
export function mountMapTravel(root, { chapter = 0, target, reducedMotion = false, onDone = () => {} } = {}) {
  const map = root.querySelector(`.chapter-map-${chapter}`);
  const robot = map?.querySelector('.map-traveler');
  const nodes = map ? [...map.querySelectorAll('.mission-node')] : [];
  if (!robot || !nodes[target]) { onDone(); return () => {}; }
  const { from, to } = travelPlan(readPosition(chapter), target);
  // Finished missions on the way are shown unfinished until he walks past them.
  const passing = new Set(nodes.slice(from, to).filter(node => node.classList.contains('earned')));
  passing.forEach(node => node.classList.remove('earned'));
  const place = index => {
    robot.style.left = nodes[index].style.getPropertyValue('--x');
    robot.style.top = nodes[index].style.getPropertyValue('--y');
  };
  let stopped = false, timer = 0, at = from;
  const finish = () => {
    passing.forEach(node => node.classList.add('earned'));
    place(to); savePosition(chapter, to); robot.classList.remove('is-walking');
    onDone();
  };
  robot.classList.add('is-instant');
  place(from);
  void robot.offsetWidth;
  robot.classList.remove('is-instant');
  robot.hidden = false;
  if (from === to || reducedMotion) { finish(); return () => {}; }
  robot.classList.add('is-walking');
  const hop = () => {
    if (stopped) return;
    at += 1;
    place(at);
    timer = setTimeout(() => {
      const left = nodes[at - 1];
      if (passing.has(left)) { left.classList.add('earned', 'just-earned'); passing.delete(left); }
      if (at < to) timer = setTimeout(hop, 120);
      else finish();
    }, HOP_MS);
  };
  timer = setTimeout(hop, 600);
  return () => {
    if (stopped) return;
    stopped = true; clearTimeout(timer);
    // Leaving mid-walk still counts as having arrived, so the walk never repeats.
    savePosition(chapter, to);
  };
}
