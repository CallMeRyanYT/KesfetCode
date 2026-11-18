import test from 'node:test';
import assert from 'node:assert/strict';
import { isTabletLike, enterFullscreen, exitFullscreen, fullscreenElement } from '../dist/tablet.js';
import { birdPose, MAP_WATER, CARD_WATER } from '../dist/illustration-motion.js';

const device = ({ coarse = false, width = 1024, height = 768, ua = 'Mozilla/5.0 (Linux; Android 14)', touch = 0 } = {}) => ({
  matchMedia: query => ({ matches: query === '(pointer: coarse)' && coarse }),
  screen: { width, height },
  navigator: { userAgent: ua, maxTouchPoints: touch }
});

test('Tablets are touch screens with a short side of at least 600 pixels, including iPads that report a Mac', () => {
  assert.equal(isTabletLike(device({ coarse: true, width: 1180, height: 820 })), true);
  assert.equal(isTabletLike(device({ coarse: true, width: 820, height: 1180 })), true);
  assert.equal(isTabletLike(device({ coarse: false, width: 1024, height: 1366, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touch: 5 })), true);
  assert.equal(isTabletLike(device({ coarse: true, width: 390, height: 844 })), false, 'phones are excluded');
  assert.equal(isTabletLike(device({ coarse: false, width: 1920, height: 1080, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touch: 0 })), false, 'desktop Macs are excluded');
});

test('Fullscreen uses the standard API, falls back to the WebKit prefix, and never throws', async () => {
  const calls = [];
  const doc = { fullscreenElement: null, documentElement: { webkitRequestFullscreen() { calls.push('enter'); } }, webkitExitFullscreen() { calls.push('exit'); } };
  assert.equal(await enterFullscreen(doc), true);
  doc.webkitFullscreenElement = doc.documentElement;
  assert.equal(fullscreenElement(doc), doc.documentElement);
  assert.equal(await enterFullscreen(doc), false, 'already fullscreen');
  assert.equal(await exitFullscreen(doc), true);
  assert.deepEqual(calls, ['enter', 'exit']);
  const refusing = { fullscreenElement: null, documentElement: { requestFullscreen: () => Promise.reject(new TypeError('denied')) } };
  assert.equal(await enterFullscreen(refusing), false);
  assert.equal(await enterFullscreen({ fullscreenElement: null, documentElement: {} }), false);
});

test('Birds glide smoothly across the map and their wings stay within a natural range', () => {
  const bird = { y: .3, amp: .02, duration: 26, delay: -4, size: 1 };
  let previous = birdPose(bird, 0);
  for (let t = .05; t < 26; t += .05) {
    const pose = birdPose(bird, t);
    assert.ok(pose.lift >= -1 && pose.lift <= 1);
    assert.ok(Math.abs(pose.lift - previous.lift) < .75, 'wings never snap between poses');
    // Apart from the single off-screen wrap back to the left edge, flight is steady.
    if (pose.x > previous.x) {
      assert.ok(pose.x - previous.x < .005);
      assert.ok(Math.abs(pose.y - previous.y) < .005, 'no vertical jumps');
    }
    previous = pose;
  }
});

test('Water regions never overlap, so no pixel is animated twice', () => {
  for (const regions of [MAP_WATER, CARD_WATER]) {
    for (const [i, a] of regions.entries()) for (const b of regions.slice(i + 1)) {
      const overlap = a.r[0] < b.r[2] && b.r[0] < a.r[2] && a.r[1] < b.r[3] && b.r[1] < a.r[3];
      assert.equal(overlap, false, `${a.r} overlaps ${b.r}`);
    }
  }
});
