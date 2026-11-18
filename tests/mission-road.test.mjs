import test from 'node:test';
import assert from 'node:assert/strict';
import { missionRoadSteps, missionRoadMarkup, mountMissionRoad } from '../dist/mission-road.js';

test('The road includes every mission, marks saved completions including gaps, and keeps one current mission', () => {
  const stars = [3, 0, 2, 0, 1];
  const steps = missionRoadSteps({ currentMission: 3, stars });
  assert.equal(steps.length, 30);
  assert.deepEqual(steps.filter(step => step.completed).map(step => step.mission), [1, 3, 5]);
  assert.deepEqual(steps.filter(step => step.current).map(step => step.mission), [3]);
  assert.equal(steps[2].completed, true);
  assert.equal(steps[29].mission, 30);
  assert.deepEqual(stars, [3, 0, 2, 0, 1]);
});

test('The accessible road exposes navigation, completion status, and the current step in both languages', () => {
  const english = missionRoadMarkup({ currentMission: 2, stars: [3] });
  assert.match(english, /<nav class="mission-road" aria-label="Your mission journey"/);
  assert.match(english, /1 \/ 30 complete/);
  assert.match(english, /Mission 2 \/ 30/);
  assert.match(english, /data-level="0" aria-label="Mission 1, completed"/);
  assert.match(english, /data-level="1" aria-label="Mission 2, not completed, current mission" aria-current="step"/);
  assert.match(english, /data-level="29" aria-label="Mission 30, not completed"/);
  assert.equal((english.match(/aria-current="step"/g) || []).length, 1);
  assert.equal((english.match(/<button /g) || []).length, 30);
  assert.doesNotMatch(english, /disabled|locked/);
  const turkish = missionRoadMarkup({ currentMission: 1, stars: [1, 2], lang: 'tr' });
  assert.match(turkish, /Görev yolculuğun/);
  assert.match(turkish, /2 \/ 30 tamamlandı/);
  assert.match(turkish, /Görev 1, tamamlandı, 1 yıldız, şu anki görev/);
});

test('One and two star completions have a warning marker and remain navigable', () => {
  const markup = missionRoadMarkup({ currentMission: 2, stars: [1, 2, 3] });
  assert.match(markup, /is-complete is-partial"><button[^>]+aria-label="Mission 1, completed, 1 star"><span aria-hidden="true">!<\/span>/);
  assert.match(markup, /is-complete is-partial is-current"><button[^>]+aria-label="Mission 2, completed, 2 stars, current mission"[^>]*><span aria-hidden="true">!<\/span>/);
  assert.match(markup, /is-complete"><button[^>]+aria-label="Mission 3, completed"><svg/);
  assert.doesNotMatch(markup, /disabled|locked/);
});

test('Invalid inputs still produce a bounded road with exactly one current mission', () => {
  assert.equal(missionRoadSteps({ currentMission: -9 })[0].current, true);
  assert.equal(missionRoadSteps({ currentMission: 90 })[29].current, true);
  assert.equal(missionRoadSteps({ currentMission: NaN })[0].current, true);
  assert.equal(missionRoadSteps({ total: 999 }).length, 30);
  assert.equal(missionRoadSteps({ total: 0 }).length, 30);
  assert.equal(missionRoadSteps({ stars: [NaN, Infinity, '3', -2] }).filter(step => step.completed).length, 0);
  assert.doesNotThrow(() => missionRoadMarkup({ stars: null }));
});

function roadFixture({ chapter, current, width = 300, selectedLeft = 500 }) {
  const listeners = new Map();
  const scroller = {
    scrollLeft: 0, scrollWidth: 1050, clientWidth: width,
    getBoundingClientRect: () => ({ left: 100, width }),
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type)
  };
  const selected = { getBoundingClientRect: () => ({ left: selectedLeft, width: 26 }) };
  const host = {
    dataset: { roadKey: String(chapter), currentMission: String(current) },
    matches: () => true,
    querySelector: selector => selector === '.mission-road-scroll' ? scroller : selected
  };
  return { host, scroller, listeners };
}

test('Only the road scrolls to frame the current mission, preserving user scrolling across edits', () => {
  const first = roadFixture({ chapter: 90, current: 15 });
  const cleanup = mountMissionRoad(first.host);
  assert.equal(first.scroller.scrollLeft, 263);
  first.scroller.scrollLeft = 480;
  first.listeners.get('scroll')();
  cleanup();
  assert.equal(first.listeners.size, 0);
  const edited = roadFixture({ chapter: 90, current: 15, selectedLeft: 900 });
  mountMissionRoad(edited.host)();
  assert.equal(edited.scroller.scrollLeft, 480);
  const changed = roadFixture({ chapter: 90, current: 16, selectedLeft: 950 });
  mountMissionRoad(changed.host)();
  assert.equal(changed.scroller.scrollLeft, 713);
  const last = roadFixture({ chapter: 91, current: 30, selectedLeft: 1100 });
  mountMissionRoad(last.host)();
  assert.equal(last.scroller.scrollLeft, 750);
  assert.doesNotThrow(() => mountMissionRoad(null)());
});
