// Tablet support: fullscreen on the first touch, plus an always-visible
// fullscreen button. Browsers only allow fullscreen from a user gesture, so the
// game enters it on the first tap rather than at page load.

const root = () => document.documentElement;
export const fullscreenElement = (doc = document) => doc.fullscreenElement || doc.webkitFullscreenElement || null;
export const fullscreenSupported = (doc = document) => Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);

/** Large touch screens: coarse pointer and a short side of at least 600 CSS pixels. */
export function isTabletLike(win = globalThis) {
  const coarse = win.matchMedia?.('(pointer: coarse)')?.matches;
  const short = Math.min(win.screen?.width || 0, win.screen?.height || 0);
  // iPadOS reports itself as a Mac; touch points reveal the tablet.
  const ipad = /Macintosh/.test(win.navigator?.userAgent || '') && (win.navigator?.maxTouchPoints || 0) > 1;
  return Boolean((coarse || ipad) && short >= 600);
}

/** Installed to the home screen, the app already fills the screen. */
const standalone = (win = globalThis) => Boolean(win.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)')?.matches || win.navigator?.standalone);

export function enterFullscreen(doc = document) {
  const el = doc.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request || fullscreenElement(doc)) return Promise.resolve(false);
  try {
    const result = request.call(el, { navigationUI: 'hide' });
    return Promise.resolve(result).then(() => true, () => false);
  } catch { return Promise.resolve(false); }
}
export function exitFullscreen(doc = document) {
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
  if (!exit || !fullscreenElement(doc)) return Promise.resolve(false);
  try { return Promise.resolve(exit.call(doc)).then(() => true, () => false); } catch { return Promise.resolve(false); }
}

const ENTER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
const EXIT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';

export function mountTabletSupport({ lang = () => 'en' } = {}) {
  const doc = document, html = root();
  const tablet = isTabletLike();
  html.dataset.device = tablet ? 'tablet' : 'desktop';
  if (!fullscreenSupported(doc) || standalone()) return () => {};

  // The button lives outside #app, so re-rendering a page never removes it.
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'fullscreen-toggle';
  doc.body.append(button);
  // A child who leaves fullscreen with this button is not pulled back in.
  let userExited = false;

  const paint = () => {
    const on = Boolean(fullscreenElement(doc));
    const tr = lang() === 'tr';
    html.dataset.fullscreen = on ? 'on' : 'off';
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
    const label = on ? (tr ? 'Tam ekrandan çık' : 'Exit full screen') : (tr ? 'Tam ekran' : 'Full screen');
    button.setAttribute('aria-label', label);
    button.innerHTML = `${on ? EXIT_ICON : ENTER_ICON}<span>${label}</span>`;
  };
  const toggle = event => {
    event.stopPropagation();
    if (fullscreenElement(doc)) { userExited = true; exitFullscreen(doc); }
    else { userExited = false; enterFullscreen(doc); }
  };
  // Any tap on a tablet counts as the gesture that opens fullscreen.
  const autoEnter = event => {
    if (!tablet || userExited || fullscreenElement(doc) || event.target?.closest?.('.fullscreen-toggle')) return;
    enterFullscreen(doc);
  };
  button.addEventListener('click', toggle);
  doc.addEventListener('pointerup', autoEnter, true);
  doc.addEventListener('fullscreenchange', paint);
  doc.addEventListener('webkitfullscreenchange', paint);
  const relabel = new MutationObserver(paint);
  relabel.observe(html, { attributes: true, attributeFilter: ['lang'] });
  paint();
  return () => {
    button.remove(); relabel.disconnect();
    doc.removeEventListener('pointerup', autoEnter, true);
    doc.removeEventListener('fullscreenchange', paint);
    doc.removeEventListener('webkitfullscreenchange', paint);
  };
}
