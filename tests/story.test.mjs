import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { storyBeat, storyScene, pendingBeat, readSeen, markSeen, resetSeen, STORY_BOOK } from '../dist/story.js';
import { LINES, SCENES, REACTIONS, voicePath } from '../dist/story-script.js';
import { wordTimings, coverPoint, estimatedDuration } from '../dist/story-player.js';
import { mouthShape, MOODS } from '../dist/talking-robot.js';
import { updatePlan, compareVersions } from '../dist/app-update.js';

const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };

test('The story follows finished-mission counts: short beats, a scene per world and a finale', () => {
  assert.equal(storyBeat(0, 15), null);
  assert.equal(storyBeat(1, 15), 'mission-1');
  assert.equal(storyBeat(5, 15), 'world-1');
  assert.equal(storyBeat(10, 15), 'world-2');
  assert.equal(storyBeat(14, 15), 'mission-14');
  assert.equal(storyBeat(15, 15), 'finale');
  // Levels may change: a longer chapter still ends with the finale and never lacks a line.
  assert.equal(storyBeat(20, 20), 'finale');
  for (let n = 1; n < 40; n++) {
    const scene = storyScene(storyBeat(n, 40));
    assert.ok(scene, `beat ${n}`);
    for (const step of scene.steps) if (step.line) assert.ok(LINES[step.line], `${step.line} exists`);
  }
});

test('A beat plays once, only when a win finishes a new mission', () => {
  const seen = new Set();
  assert.equal(pendingBeat({ before: 2, after: 3, total: 15, seen }), 'mission-3');
  assert.equal(pendingBeat({ before: 3, after: 3, total: 15, seen }), null, 'replaying a finished mission');
  seen.add('mission-3');
  assert.equal(pendingBeat({ before: 2, after: 3, total: 15, seen }), null, 'already watched');
  assert.equal(pendingBeat({ before: 14, after: 15, total: 15, seen }), 'finale');
});

test('Watched scenes are remembered and cleared with progress', () => {
  const storage = memory();
  assert.equal(readSeen(storage).size, 0);
  markSeen('intro', storage); markSeen('world-1', storage);
  assert.deepEqual([...readSeen(storage)], ['intro', 'world-1']);
  resetSeen(storage);
  assert.equal(readSeen(storage).size, 0);
  storage.setItem('kesfet-story-v1', '{broken');
  assert.equal(readSeen(storage).size, 0, 'corrupt data is ignored');
});

test('Every scene and reaction refers to written lines in both languages, with voice files', () => {
  const used = new Set();
  for (const id of STORY_BOOK) assert.ok(SCENES[id], id);
  for (const scene of Object.values(SCENES)) for (const step of scene.steps) {
    if (step.line) used.add(step.line);
    if (step.choice) for (const [answer, reply] of step.choice) { used.add(answer); if (reply) used.add(reply); }
  }
  for (const list of Object.values(REACTIONS)) list.forEach(id => used.add(id));
  for (const id of used) {
    const line = LINES[id];
    assert.ok(line, id);
    assert.ok(line.en && line.tr, `${id} has English and Turkish`);
    assert.ok(['kasif', 'nova', 'you'].includes(line.who));
    if (line.mood) assert.ok(MOODS.includes(line.mood), `${id} mood`);
  }
  for (const [id, line] of Object.entries(LINES)) {
    if (line.who === 'you') continue;
    for (const lang of ['en', 'tr']) assert.ok(existsSync(`dist${voicePath(id, lang)}`), `${lang} voice for ${id}`);
  }
});

test('Subtitles light words in order across the spoken duration', () => {
  const words = wordTimings('Hello there, explorer!', 3000);
  assert.deepEqual(words.map(w => w.word), ['Hello', 'there,', 'explorer!']);
  assert.equal(words[0].at, 0);
  assert.ok(words[1].at > 0 && words[2].at > words[1].at && words[2].at < 3000);
  assert.ok(estimatedDuration('Hi') >= 1400);
});

test('Effects land on the painted rocket for any screen shape', () => {
  const image = { width: 1672, height: 941 };
  const wide = coverPoint({ width: 1672, height: 941 }, image, .8, .36);
  assert.deepEqual([Math.round(wide.x), Math.round(wide.y)], [1338, 339]);
  const tall = coverPoint({ width: 800, height: 1200 }, image, .5, .5);
  assert.deepEqual([Math.round(tall.x), Math.round(tall.y)], [400, 600]);
});

test('The robot mouth opens with the voice and rests in each mood', () => {
  for (const mood of MOODS) assert.ok(mouthShape(mood, 0).d.startsWith('M'));
  assert.equal(mouthShape('happy', .8).filled, true);
  assert.notEqual(mouthShape('happy', .2).d, mouthShape('happy', .9).d);
});

test('The Android updater installs new game files, or asks for a new app when needed', () => {
  assert.equal(compareVersions('1.10.0', '1.9.2'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  const manifest = { version: 'abc', url: '/app-update/x.zip', minNativeVersion: '1.0.0', apkUrl: 'https://example.test/apk' };
  assert.deepEqual(updatePlan(manifest, { running: 'abc', native: '1.0.0' }), { action: 'none' });
  assert.deepEqual(updatePlan(manifest, { running: 'old', native: '1.0.0' }), { action: 'bundle', version: 'abc' });
  assert.deepEqual(updatePlan({ ...manifest, minNativeVersion: '2.0.0' }, { running: 'old', native: '1.4.0' }), { action: 'native', url: 'https://example.test/apk' });
  assert.deepEqual(updatePlan(null), { action: 'none' });
});
