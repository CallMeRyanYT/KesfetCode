import test from 'node:test';
import assert from 'node:assert/strict';
import { travelPlan, readPosition, savePosition, resetPositions } from '../dist/map-travel.js';

const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };

test('KAŞİF walks from where the child last saw him to the next mission', () => {
  assert.deepEqual(travelPlan(0, 1), { from: 0, to: 1 });
  assert.deepEqual(travelPlan(0, 5), { from: 0, to: 5 }, 'several finished missions make a longer walk');
  assert.deepEqual(travelPlan(null, 3), { from: 3, to: 3 }, 'a first visit just places him');
  assert.deepEqual(travelPlan(7, 2), { from: 2, to: 2 }, 'after a reset he does not walk backwards');
  assert.deepEqual(travelPlan(4, 4), { from: 4, to: 4 });
});

test('His map position is remembered per chapter and cleared with progress', () => {
  const storage = memory();
  assert.equal(readPosition(0, storage), null);
  savePosition(0, 6, storage); savePosition(1, 2, storage);
  assert.equal(readPosition(0, storage), 6);
  assert.equal(readPosition(1, storage), 2);
  resetPositions(storage);
  assert.equal(readPosition(0, storage), null);
});
