import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CompanionVoice, hashText, tipVoicePath } from '../dist/companion-voice.js';
import { LEVELS, normalizeProgress, completeLevel } from '../dist/engine.js';
import { chapterMission } from '../dist/opening-missions.js';
import { chapterMissionCount } from '../dist/chapter-config.js';
import { missionTip } from '../dist/mission-companion.js';

test('Every Explorer mission tip has a voice file in both languages', () => {
  assert.equal(hashText('Hello'), hashText('Hello'));
  assert.notEqual(hashText('Hello'), hashText('Hello!'));
  for (const base of LEVELS.slice(0, chapterMissionCount(0))) {
    const mission = chapterMission(base, 0);
    for (const lang of ['en', 'tr']) {
      const path = tipVoicePath(missionTip(mission, 0, lang), lang);
      assert.ok(existsSync(`dist${path}`), `mission ${mission.id} ${lang}: ${path}`);
    }
  }
});

function harness(t) {
  const frames = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
  t.after(() => { globalThis.requestAnimationFrame = frames; globalThis.cancelAnimationFrame = cancel; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let clock = 0;
  const voice = new CompanionVoice({ enabled: () => false, doc: null, now: () => clock });
  return { voice, advance: ms => { clock += ms; t.mock.timers.tick(ms); } };
}

test('KAŞİF speaks one line at a time and queued lines follow in order', t => {
  const { voice, advance } = harness(t);
  voice.say([{ text: 'Story line' }, { text: 'Mission tip' }]);
  assert.equal(voice.current.entry.text, 'Story line');
  assert.equal(voice.queue.length, 1);
  advance(1500);           // the first line ends (estimated length)
  assert.equal(voice.current, null);
  advance(400);            // a short pause, then the next line
  assert.equal(voice.current.entry.text, 'Mission tip');
});

test('Reactions never talk over a line and respect a cooldown', t => {
  const { voice, advance } = harness(t);
  voice.say([{ text: 'Mission tip' }]);
  assert.equal(voice.react({ text: 'Crystal collected!' }), false, 'busy');
  advance(2000);
  assert.equal(voice.react({ text: 'Crystal collected!' }), true);
  advance(1500);
  assert.equal(voice.react({ text: 'Shiny!' }), false, 'cooldown');
  advance(2000);
  assert.equal(voice.react({ text: 'Shiny!' }), true);
});

test('Stopping clears the queue immediately', t => {
  const { voice } = harness(t);
  voice.say([{ text: 'One' }, { text: 'Two' }]);
  voice.stop();
  assert.equal(voice.current, null);
  assert.equal(voice.queue.length, 0);
  assert.equal(voice.busy, false);
});

test('Stars only rise: replays keep the best score, and test-mode missions still save', () => {
  let progress = normalizeProgress(null);
  progress = completeLevel(progress, 0, 3);
  progress = completeLevel(progress, 0, 1);
  assert.equal(progress.stars[0], 3);
  // Mission 7 is still locked by progress; it saves only when forced (all missions open).
  assert.equal(completeLevel(progress, 6, 2).stars[6], 0);
  assert.equal(completeLevel(progress, 6, 2, 0, { force: true }).stars[6], 2);
});
