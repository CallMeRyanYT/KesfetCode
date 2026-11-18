import test from 'node:test';
import assert from 'node:assert/strict';
import { verticalInsertionIndex, scrollTopForBlock } from '../dist/program-layout.js';

test('vertical insertion uses the top and bottom halves of each command', () => {
  const rects = [
    { top: 100, height: 80, left: 400, width: 200 },
    { top: 190, height: 80, left: 10, width: 40 },
    { top: 280, height: 100, left: 200, width: 500 },
  ];
  assert.equal(verticalInsertionIndex(rects, 80), 0);
  assert.equal(verticalInsertionIndex(rects, 139), 0);
  assert.equal(verticalInsertionIndex(rects, 140), 1);
  assert.equal(verticalInsertionIndex(rects, 229), 1);
  assert.equal(verticalInsertionIndex(rects, 230), 2);
  assert.equal(verticalInsertionIndex(rects, 330), 3);
  assert.equal(verticalInsertionIndex(rects, 600), 3);
  assert.equal(verticalInsertionIndex([], 400), 0);
});

test('running commands scroll only enough to become visible in the shelf', () => {
  const shelf = { top: 200, bottom: 500, height: 300 };
  assert.equal(scrollTopForBlock({ top: 240, bottom: 320, height: 80 }, shelf, 100), 100);
  assert.equal(scrollTopForBlock({ top: 180, bottom: 260, height: 80 }, shelf, 100), 68);
  assert.equal(scrollTopForBlock({ top: 440, bottom: 520, height: 80 }, shelf, 100), 132);
  assert.equal(scrollTopForBlock({ top: 180, bottom: 260, height: 80 }, shelf, 5), 0);
});

test('an oversized command follows its top instead of oscillating between edges', () => {
  assert.equal(scrollTopForBlock(
    { top: 240, bottom: 640, height: 400 },
    { top: 200, bottom: 500, height: 300 },
    100,
  ), 128);
});
