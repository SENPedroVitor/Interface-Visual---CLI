import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const avatarTsx = readFileSync(join(root, 'src/components/WaddleAvatar.tsx'), 'utf8');
const avatarCss = readFileSync(join(root, 'src/components/WaddleAvatar.css'), 'utf8');

test('interactive avatar click reaction is friendly rather than annoyed', () => {
  assert.doesNotMatch(avatarTsx, /annoyed|irritad/i);
  assert.doesNotMatch(avatarCss, /annoyed|irritad/i);
  assert.match(avatarTsx, /delighted|sparkle|happy|cute/i);
  assert.match(avatarCss, /delighted|sparkle|happy|cute/i);
});
