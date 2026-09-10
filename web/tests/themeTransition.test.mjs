import assert from 'node:assert/strict';
import test from 'node:test';

import { getThemeRevealClipPaths } from '../src/lib/themeTransition.ts';

test('builds centered circular reveal clip paths in percentages', () => {
  assert.deepEqual(
    getThemeRevealClipPaths({
      cx: 50,
      cy: 50,
      maxRadius: Math.hypot(50, 50),
      viewportWidth: 100,
      viewportHeight: 100,
    }),
    ['circle(0% at 50% 50%)', 'circle(70.7107% at 50% 50%)']
  );
});

test('keeps the reveal origin tied to the clicked button', () => {
  const [, end] = getThemeRevealClipPaths({
    cx: 32,
    cy: 96,
    maxRadius: Math.hypot(168, 204),
    viewportWidth: 200,
    viewportHeight: 300,
  });

  assert.match(end, /^circle\(.+ at 16% 32%\)$/);
});
