// Over-the-air updates for the Android app. Every launch (and every return to
// the app) checks the website for a newer game; all tablets therefore run the
// same version as soon as they are opened. The browser version ignores this.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BUILD } from './build-info.js';

export const UPDATE_MANIFEST = 'https://kesfetcode.vercel.app/app-update.json';
const STATUS_KEY = 'kesfet-update-status';

/** Compares dotted versions numerically: "1.10.0" is newer than "1.9.2". */
export function compareVersions(a = '0', b = '0') {
  const pa = String(a).split(/[.-]/).map(n => parseInt(n, 10) || 0), pb = String(b).split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/** What to do with a manifest: nothing, ask for a new APK, or install the new game files. */
export function updatePlan(manifest, { running = BUILD.version, native = '0' } = {}) {
  if (!manifest?.version || !manifest?.url) return { action: 'none' };
  if (compareVersions(native, manifest.minNativeVersion || '0') < 0) return { action: 'native', url: manifest.apkUrl };
  if (manifest.version === running) return { action: 'none' };
  return { action: 'bundle', version: manifest.version };
}

/** The options the updater plugin needs; it refuses a download without the zip's SHA-256. */
export function downloadOptions(manifest, manifestUrl = UPDATE_MANIFEST) {
  return { url: new URL(manifest.url, manifestUrl).href, version: manifest.version, checksum: manifest.sha256 };
}

export function readUpdateStatus(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(STATUS_KEY) || 'null') || {}; } catch { return {}; }
}
function writeStatus(patch) {
  const next = { ...readUpdateStatus(), ...patch, at: new Date().toISOString() };
  try { localStorage.setItem(STATUS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

async function fetchManifest(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

const t = (lang, en, tr) => lang() === 'tr' ? tr : en;

function overlay(lang) {
  const el = document.createElement('div');
  el.className = 'app-updating';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="app-updating-card"><img src="/assets/mission-guide-robot.webp" alt=""><strong>${t(lang, 'Updating KAŞİF…', 'KAŞİF güncelleniyor…')}</strong><span>${t(lang, 'Loading new adventures. Please wait.', 'Yeni maceralar yükleniyor. Lütfen bekle.')}</span><div class="app-updating-bar"><i></i></div></div>`;
  document.body.append(el);
  return { progress: percent => el.querySelector('i').style.width = `${Math.max(4, Math.min(100, percent))}%`, remove: () => el.remove() };
}

function banner(kind, message, action, lang) {
  document.querySelector('.app-native-update')?.remove();
  const el = document.createElement('div');
  el.className = `app-native-update is-${kind}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${message}</span>${action ? `<a href="${action.url}" target="_blank" rel="noopener">${action.label}</a>` : ''}<button type="button" aria-label="${t(lang, 'Close', 'Kapat')}">×</button>`;
  el.querySelector('button').addEventListener('click', () => el.remove());
  document.body.append(el);
}

let controls = null;
/** The running updater, for the version panel: its status and a manual check. */
export const appUpdater = () => controls;

/**
 * Starts the updater. `canInterrupt` says whether reloading right now is safe
 * (for example, not in the middle of a child's mission).
 */
export function startAppUpdates({ lang = () => 'en', canInterrupt = () => true, manifestUrl = UPDATE_MANIFEST } = {}) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const Updater = registerPlugin('CapacitorUpdater');
  // Confirms this game version started correctly; otherwise the plugin rolls back.
  Updater.notifyAppReady().catch(error => writeStatus({ result: 'error', error: `notifyAppReady: ${error?.message || error}` }));
  let busy = false, native = '';

  const check = async ({ launch = false, manual = false } = {}) => {
    if (busy) return readUpdateStatus();
    busy = true;
    let screen = null, listener = null;
    try {
      const current = await Updater.current().catch(() => ({}));
      native = current?.native || native;
      writeStatus({ running: BUILD.version, native, result: 'checking', error: '' });
      const manifest = await fetchManifest(manifestUrl);
      const plan = updatePlan(manifest, { running: BUILD.version, native });
      if (plan.action === 'native') {
        banner('native', t(lang, 'A new version of the app is ready. Please install it (ask your teacher).', 'Uygulamanın yeni sürümü hazır. Lütfen yükle (öğretmenine sor).'), { url: plan.url, label: t(lang, 'Download', 'İndir') }, lang);
        return writeStatus({ latest: manifest.version, result: 'needs-new-app' });
      }
      if (plan.action !== 'bundle') return writeStatus({ latest: manifest.version, result: 'up-to-date' });

      // Reuse a bundle that finished downloading earlier.
      const existing = (await Updater.list().catch(() => ({ bundles: [] }))).bundles?.find(b => b.version === plan.version && b.status === 'success');
      const applyNow = launch || manual || canInterrupt();
      if (applyNow && !existing) {
        screen = overlay(lang);
        listener = await Updater.addListener('download', event => screen.progress(event.percent)).catch(() => null);
      }
      writeStatus({ latest: manifest.version, result: 'downloading' });
      const bundle = existing || await Updater.download(downloadOptions(manifest, manifestUrl));
      writeStatus({ result: applyNow ? 'installing' : 'ready-next-start' });
      if (applyNow) await Updater.set({ id: bundle.id });
      else await Updater.next({ id: bundle.id });
      return readUpdateStatus();
    } catch (error) {
      screen?.remove();
      const message = String(error?.message || error || 'unknown error');
      // Never fail silently: the teacher sees why, and the next launch tries again.
      if (launch || manual) banner('error', t(lang, `Update failed: ${message}`, `Güncelleme başarısız: ${message}`), null, lang);
      return writeStatus({ result: navigator.onLine ? 'error' : 'offline', error: message });
    } finally {
      listener?.remove?.();
      busy = false;
    }
  };

  controls = { check: () => check({ manual: true }), status: readUpdateStatus, native: () => native, running: BUILD.version };
  check({ launch: true });
  const resume = () => { if (document.visibilityState === 'visible') check(); };
  document.addEventListener('visibilitychange', resume);
  return () => document.removeEventListener('visibilitychange', resume);
}

/** Short form of a game version for people: "game-dd6884be7c25" → "dd6884". */
export const shortGame = version => String(version || 'dev').replace(/^game-/, '').slice(0, 6);
export function versionLabel(native, game) { return `${native ? `v${native}` : 'web'} · ${shortGame(game)}`; }

/** A small version label in the bottom-left corner of the menu screens. */
export function mountVersionLabel(doc = document) {
  const label = doc.createElement('div');
  label.className = 'app-version-label';
  label.setAttribute('aria-hidden', 'true');
  doc.body.append(label);
  const paint = native => { label.textContent = versionLabel(native, BUILD.version); };
  paint('');
  if (Capacitor.isNativePlatform()) registerPlugin('CapacitorUpdater').current().then(current => paint(current?.native || ''), () => {});
  return label;
}
