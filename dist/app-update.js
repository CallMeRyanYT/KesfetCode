// Over-the-air updates for the Android app. Every launch (and every return to
// the app) checks the website for a newer game; all tablets therefore run the
// same version as soon as they are opened. The browser version ignores this.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BUILD } from './build-info.js';

export const UPDATE_MANIFEST = 'https://kesfetcode.vercel.app/app-update.json';

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
  if (manifest.version === running) return { action: 'none' };
  if (compareVersions(native, manifest.minNativeVersion || '0') < 0) return { action: 'native', url: manifest.apkUrl };
  return { action: 'bundle', version: manifest.version };
}

async function fetchManifest(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
    return response.ok ? await response.json() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function overlay(lang) {
  const tr = lang() === 'tr';
  const el = document.createElement('div');
  el.className = 'app-updating';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="app-updating-card"><img src="/assets/mission-guide-robot.webp" alt=""><strong>${tr ? 'KAŞİF güncelleniyor…' : 'Updating KAŞİF…'}</strong><span>${tr ? 'Yeni maceralar yükleniyor. Lütfen bekle.' : 'Loading new adventures. Please wait.'}</span><div class="app-updating-bar"><i></i></div></div>`;
  document.body.append(el);
  return { progress: percent => el.querySelector('i').style.width = `${Math.max(4, Math.min(100, percent))}%`, remove: () => el.remove() };
}

function nativeNotice(url, lang) {
  if (document.querySelector('.app-native-update')) return;
  const tr = lang() === 'tr';
  const el = document.createElement('div');
  el.className = 'app-native-update';
  el.innerHTML = `<span>${tr ? 'Uygulamanın yeni bir sürümü var. Öğretmenine haber ver.' : 'A new version of the app is available. Please tell your teacher.'}</span><a href="${url}" target="_blank" rel="noopener">${tr ? 'İndir' : 'Download'}</a><button type="button" aria-label="${tr ? 'Kapat' : 'Close'}">×</button>`;
  el.querySelector('button').addEventListener('click', () => el.remove());
  document.body.append(el);
}

/**
 * Starts the updater. `canInterrupt` says whether reloading right now is safe
 * (for example, not in the middle of a child's mission).
 */
export function startAppUpdates({ lang = () => 'en', canInterrupt = () => true, manifestUrl = UPDATE_MANIFEST } = {}) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const Updater = registerPlugin('CapacitorUpdater');
  // Confirms this game version started correctly; otherwise the plugin rolls back.
  Updater.notifyAppReady().catch(() => {});
  let busy = false;

  const check = async ({ launch = false } = {}) => {
    if (busy || !navigator.onLine) return;
    busy = true;
    try {
      const manifest = await fetchManifest(manifestUrl);
      const current = await Updater.current().catch(() => ({}));
      const plan = updatePlan(manifest, { running: BUILD.version, native: current?.native });
      if (plan.action === 'native') { nativeNotice(plan.url, lang); return; }
      if (plan.action !== 'bundle') return;
      // Reuse a bundle that finished downloading earlier.
      const existing = (await Updater.list().catch(() => ({ bundles: [] }))).bundles?.find(b => b.version === plan.version && b.status !== 'error');
      const applyNow = launch || canInterrupt();
      const screen = applyNow && !existing ? overlay(lang) : null;
      const listener = screen ? await Updater.addListener('download', e => screen.progress(e.percent)) : null;
      try {
        const bundle = existing || await Updater.download({ url: new URL(manifest.url, manifestUrl).href, version: plan.version });
        if (applyNow) await Updater.set({ id: bundle.id });
        else await Updater.next({ id: bundle.id });
      } catch {
        screen?.remove();
      } finally { listener?.remove?.(); }
    } finally { busy = false; }
  };

  check({ launch: true });
  const resume = () => { if (document.visibilityState === 'visible') check(); };
  document.addEventListener('visibilitychange', resume);
  return () => document.removeEventListener('visibilitychange', resume);
}
