import test from 'node:test';
import assert from 'node:assert/strict';

// A minimal Web Audio stand-in that counts live connections.
class Node { constructor(ctx) { this.ctx = ctx; this.outputs = 0; } connect() { this.outputs += 1; this.ctx.connections += 1; } disconnect() { this.ctx.connections -= this.outputs; this.outputs = 0; } }
class FakeContext {
  constructor() { this.state = 'running'; this.connections = 0; this.destination = new Node(this); FakeContext.created += 1; FakeContext.last = this; }
  createMediaElementSource() { return new Node(this); }
  createAnalyser() { const node = new Node(this); node.fftSize = 512; node.getByteTimeDomainData = samples => samples.fill(128); return node; }
  createGain() { const node = new Node(this); node.gain = { value: 1 }; return node; }
  createDynamicsCompressor() { const node = new Node(this); for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = { value: 0 }; return node; }
  resume() {}
}
FakeContext.created = 0;
globalThis.AudioContext = FakeContext;
const { voiceMeter, voiceNodes } = await import('../dist/talking-robot.js');

test('Each voice line releases its audio nodes, so long sessions never pile up processing', () => {
  const lines = Array.from({ length: 40 }, () => new EventTarget());
  const meters = lines.map(audio => voiceMeter(audio));
  assert.equal(voiceNodes.live, 40);
  assert.equal(FakeContext.created, 1, 'one shared audio context');
  // Finish half the lines normally and stop the rest early.
  lines.slice(0, 20).forEach(audio => audio.dispatchEvent(new Event('ended')));
  meters.slice(20).forEach(meter => meter.release());
  assert.equal(voiceNodes.live, 0);
  // Only the shared output (gain → limiter → speakers) stays connected.
  assert.equal(FakeContext.last.connections, 2);
  assert.equal(meters[0](), 0, 'a released meter reads silence');
});
