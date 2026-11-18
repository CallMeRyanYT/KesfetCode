import test from 'node:test';
import assert from 'node:assert/strict';
import { confettiTrajectory, mountVictoryCelebration } from '../dist/victory-celebration.js';

function fixture({ animated = true } = {}) {
  const animations = [];
  const timers = {
    pending: new Map(), next: 0,
    setTimeout(callback, delay) { const id = ++this.next; this.pending.set(id, { callback, delay }); return id; },
    clearTimeout(id) { this.pending.delete(id); },
    finish() { for (const [id, entry] of [...this.pending]) { this.pending.delete(id); entry.callback(); } }
  };
  const document = { createElement };
  function createElement() {
    return {
      ownerDocument: document, children: [], attributes: {},
      style: { setProperty(name, value) { this[name] = value; } },
      setAttribute(name, value) { this.attributes[name] = value; },
      append(child) { this.children.push(child); child.parent = this; },
      remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; },
      animate: animated ? function (frames, options) {
        const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
        animations.push(animation);
        return animation;
      } : undefined
    };
  }
  return { host: createElement(), timers, animations };
}

test('Confetti launches upward, slows to its apex, and accelerates down under gravity', () => {
  const physics = { velocityX: 18, velocityY: -120, gravity: 120, spin: 90 };
  assert.deepEqual(confettiTrajectory(physics, 0), { x: 0, y: 0, rotation: 0 });
  assert.ok(confettiTrajectory(physics, .1).y < 0);
  const apex = -physics.velocityY / physics.gravity;
  const before = confettiTrajectory(physics, apex - .1);
  const top = confettiTrajectory(physics, apex);
  const after = confettiTrajectory(physics, apex + .1);
  assert.ok(before.y > top.y && after.y > top.y);
  assert.ok(Math.abs(before.y - after.y) < 1e-10);
  const falling = [1, 1.25, 1.5, 1.75].map(time => confettiTrajectory(physics, time).y);
  assert.ok(falling[3] - falling[2] > falling[2] - falling[1]);
  assert.ok(falling[2] - falling[1] > falling[1] - falling[0]);
  const landed = confettiTrajectory(physics, 2.5);
  assert.ok(landed.y > 24, 'The particle falls below its launch point and out of view');
  assert.equal(landed.x, 45);
  assert.equal(landed.rotation, 225);
});

test('Victory owns one finite, decorative burst in the success dialog and removes it automatically', () => {
  const { host, timers, animations } = fixture();
  const dispose = mountVictoryCelebration(host, { timers, random: () => .5 });
  assert.equal(host.children.length, 1);
  const layer = host.children[0];
  assert.equal(layer.attributes['aria-hidden'], 'true');
  assert.ok(layer.children.length >= 36 && layer.children.length <= 100);
  assert.equal(timers.pending.size, 1);
  assert.ok([...timers.pending.values()][0].delay <= 4000);
  assert.equal(animations.length, 72);
  const position = frame => frame.transform.match(/translate3d\(([-\d.]+)vw,([-\d.]+)vh,0\)/).slice(1).map(Number);
  assert.ok(animations.some(animation => position(animation.frames[1])[0] > 0));
  assert.ok(animations.some(animation => position(animation.frames[1])[0] < 0));
  for (const { frames, options } of animations) {
    assert.equal(options.easing, 'linear');
    assert.ok(options.duration + options.delay < 3500);
    assert.ok(position(frames[1])[1] < 0);
    assert.ok(Math.min(...frames.map(frame => position(frame)[1])) < -40);
    assert.ok(position(frames.at(-1))[1] >= 24);
    const endY = frames.slice(-4).map(frame => position(frame)[1]);
    assert.ok(endY[3] - endY[2] > endY[2] - endY[1]);
    assert.ok(endY[2] - endY[1] > endY[1] - endY[0]);
  }
  timers.finish();
  assert.equal(host.children.length, 0);
  assert.equal(timers.pending.size, 0);
  assert.ok(animations.every(animation => animation.cancelled));
  dispose();
  assert.equal(host.children.length, 0);
});

test('Leaving or replaying immediately clears the burst and its pending timer', () => {
  const { host, timers, animations } = fixture();
  for (let replay = 0; replay < 3; replay++) {
    const dispose = mountVictoryCelebration(host, { timers });
    assert.equal(host.children.length, 1);
    dispose(); dispose();
    assert.equal(host.children.length, 0);
    assert.equal(timers.pending.size, 0);
    assert.ok(animations.every(animation => animation.cancelled));
  }
  timers.finish();
  assert.equal(host.children.length, 0);
});

test('The in-game Motion off setting uses a smaller stationary celebration with a short lifetime', () => {
  const { host, timers, animations } = fixture();
  mountVictoryCelebration(host, { timers, reducedMotion: true });
  assert.match(host.children[0].className, /is-still/);
  assert.ok(host.children[0].children.length < 24);
  assert.ok([...timers.pending.values()][0].delay <= 1500);
  assert.equal(animations.length, 0);
  timers.finish();
  assert.equal(host.children.length, 0);
});

test('Default and explicit Motion on celebrate even when the OS requests reduced motion', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  let preferenceReads = 0;
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: () => { preferenceReads++; return { matches: true }; }
  });
  try {
    for (const options of [{}, { reducedMotion: false }]) {
      const { host, timers, animations } = fixture();
      const dispose = mountVictoryCelebration(host, { timers, ...options });
      assert.doesNotMatch(host.children[0].className, /is-still/);
      assert.equal(animations.length, 72);
      assert.equal(host.children[0].children.length, 72);
      assert.ok(animations.every(animation => animation.options.easing === 'linear'));
      dispose();
      assert.ok(animations.every(animation => animation.cancelled));
    }
    assert.equal(preferenceReads, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'matchMedia', previous);
    else delete globalThis.matchMedia;
  }
});

test('A browser without Web Animations gets stationary decoration instead of invisible particles', () => {
  const { host, timers, animations } = fixture({ animated: false });
  mountVictoryCelebration(host, { timers, reducedMotion: false });
  assert.match(host.children[0].className, /is-still/);
  assert.equal(animations.length, 0);
  timers.finish();
  assert.equal(host.children.length, 0);
});

test('A missing success dialog never schedules decoration', () => {
  const { timers } = fixture();
  const dispose = mountVictoryCelebration(null, { timers });
  dispose();
  assert.equal(timers.pending.size, 0);
});
