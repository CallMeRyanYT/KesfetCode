import test from 'node:test';
import assert from 'node:assert/strict';
import { isFirstMission, guideStep, guideMarkup } from '../dist/first-mission-guide.js';
import { icon } from '../dist/icons.js';

test('Opening guide is confined to chapter one, mission one', () => {
  for (let chapter = 0; chapter < 3; chapter++) {
    for (let missionId = 1; missionId <= 30; missionId++) {
      assert.equal(isFirstMission(chapter, missionId), chapter === 0 && missionId === 1);
    }
  }
});

test('Guide moves from placing a connected block to starting the program', () => {
  const state = Object.freeze({ chapter: 0, missionId: 1, blockCount: 0, running: false, won: false, dismissed: false });
  assert.equal(guideStep(state), 'drag');
  assert.equal(guideStep({ ...state, blockCount: 1 }), 'run');
  assert.equal(guideStep({ ...state, blockCount: 2 }), 'run');
  assert.equal(guideStep({ ...state, blockCount: 1, running: true }), null);
  assert.equal(guideStep({ ...state, won: true }), null);
  assert.equal(guideStep({ ...state, dismissed: true }), null);
  assert.equal(guideStep({ ...state, chapter: 1 }), null);
  assert.equal(guideStep({ ...state, missionId: 2 }), null);
  assert.equal(state.blockCount, 0);
});

test('Right guide teaches the available block in English and Turkish', () => {
  const en = guideMarkup('drag', 'en', 'right');
  const tr = guideMarkup('drag', 'tr', 'right');
  assert.match(en, /Drag Right below Start and snap it into place/);
  assert.match(tr, /Sağ bloğunu Başla bloğunun altına sürükleyip birleştir/);
  assert.ok(en.includes(`${icon('right')}<span>Right</span>`));
  assert.ok(tr.includes(`${icon('right')}<span>Sağ</span>`));
  assert.doesNotMatch(en, /Drag Forward/);
});

test('Default guide teaches Up and then asks the player to press Start', () => {
  const en = guideMarkup('drag', 'en');
  const tr = guideMarkup('drag', 'tr');
  assert.match(en, /Drag Up below Start and snap it into place/);
  assert.match(tr, /Yukarı bloğunu Başla bloğunun altına sürükleyip birleştir/);
  assert.ok(en.includes(`${icon('up')}<span>Up</span>`));
  assert.ok(tr.includes(`${icon('up')}<span>Yukarı</span>`));
  assert.doesNotMatch(en, /Forward|Backward/);
  assert.doesNotMatch(tr, /İleri|Geri/);
  for (const lang of ['en', 'tr']) {
    assert.match(guideMarkup('run', lang, 'up'), /data-guide-step="run"/);
    assert.equal(guideMarkup(null, lang, 'up'), '');
  }
  assert.match(guideMarkup('run', 'en'), /press the yellow Start block/);
  assert.match(guideMarkup('run', 'tr'), /sarı Başla bloğuna bas/);
  assert.match(guideMarkup('run', 'en'), /class="tip-hand"/);
  assert.doesNotMatch(guideMarkup('run', 'en'), /class="tip-ghost"/);
});
