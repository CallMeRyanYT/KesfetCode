// Decides which story moment plays. Progress, not puzzle content, drives the
// story: finishing a mission for the first time advances it by one beat.
import { LINES, SCENES, WORLD_BACKDROPS } from './story-script.js';

export const WORLD_SIZE = 5;
const STORE = 'kesfet-story-v1';
const EXTRA = ['m-extra-1', 'm-extra-2', 'm-extra-3'];

/** The beat for reaching `completed` finished missions out of `total`. */
export function storyBeat(completed, total) {
  if (!Number.isInteger(completed) || completed < 1) return null;
  if (completed >= total) return 'finale';
  if (completed % WORLD_SIZE === 0) return `world-${completed / WORLD_SIZE}`;
  return `mission-${completed}`;
}

/** A playable scene for a beat id. Mission beats are short, single-line moments. */
export function storyScene(id) {
  if (SCENES[id]) return { id, ...SCENES[id] };
  // Worlds without a written scene (a chapter grew longer) get a short moment.
  const world = /^world-(\d+)$/.exec(id || '');
  const match = world ? [, Number(world[1]) * WORLD_SIZE] : /^mission-(\d+)$/.exec(id || '');
  if (!match) return null;
  const n = Number(match[1]);
  const line = LINES[`m-${n}`] ? `m-${n}` : EXTRA[n % EXTRA.length];
  const place = Math.min(WORLD_BACKDROPS.length - 1, Math.floor((n - 1) / WORLD_SIZE));
  return { id, short: true, backdrop: WORLD_BACKDROPS[place], steps: [{ line }, { fx: 'sparkles' }] };
}

/** Scenes listed in the story book, in order. */
export const STORY_BOOK = ['intro', 'world-1', 'world-2', 'finale'];

export function readSeen(storage = globalThis.localStorage) {
  try { const data = JSON.parse(storage?.getItem(STORE) || '{}'); return new Set(Array.isArray(data.seen) ? data.seen : []); }
  catch { return new Set(); }
}
export function markSeen(id, storage = globalThis.localStorage) {
  const seen = readSeen(storage); seen.add(id);
  try { storage?.setItem(STORE, JSON.stringify({ seen: [...seen] })); } catch {}
  return seen;
}
export function resetSeen(storage = globalThis.localStorage) { try { storage?.removeItem(STORE); } catch {} }

/**
 * After a win: the beat to play, if this win finished a new mission and its
 * beat has not been watched. `before`/`after` are completed-mission counts.
 */
export function pendingBeat({ before, after, total, seen }) {
  if (!(after > before)) return null;
  const id = storyBeat(after, total);
  return id && !seen.has(id) ? id : null;
}
