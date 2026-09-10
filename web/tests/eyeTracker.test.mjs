import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateGazeOffset } from '../src/lib/eyeTracker.ts';

test('keeps the gaze centered when the pointer is on the eye origin', () => {
  assert.deepEqual(calculateGazeOffset(50, 50, 50, 50, 3), { x: 0, y: 0 });
});

test('moves proportionally while the pointer is near the avatar', () => {
  assert.deepEqual(calculateGazeOffset(125, 50, 50, 50, 3), { x: 1.5, y: 0 });
});

test('clamps distant pointers to the configured maximum offset', () => {
  assert.deepEqual(calculateGazeOffset(500, 50, 50, 50, 3), { x: 3, y: 0 });
});

test('keeps diagonal movement inside the maximum radius', () => {
  const result = calculateGazeOffset(500, 500, 50, 50, 3);
  assert.ok(Math.hypot(result.x, result.y) <= 3.000001);
});
