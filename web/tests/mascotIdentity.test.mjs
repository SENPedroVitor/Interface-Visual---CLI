import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const visuals = readFileSync(join(root, 'src/utils/agentVisuals.ts'), 'utf8');
const conversation = readFileSync(join(root, 'src/components/ConversationView.tsx'), 'utf8');

function colorFor(name) {
  const match = new RegExp(`${name}:\\s+\\{\\s*color:\\s*'([^']+)'`).exec(visuals);
  assert.ok(match, `visual for ${name} should define an identity color`);
  return match[1];
}

test('primary mascots have distinct identity colors', () => {
  const colors = ['Quinta', 'Ma', 'Livro', 'Mosbey'].map(colorFor);
  assert.equal(new Set(colors).size, colors.length);
});

test('empty-state greeting is deterministic and does not rotate automatically', () => {
  assert.match(conversation, /agentGreetings\[0\]/);
  assert.doesNotMatch(conversation, /Math\.random\(\)/);
  assert.doesNotMatch(conversation, /handleNextGreeting/);
});

test('direct message avatar reuses the resolved header visual for the active agent', () => {
  assert.match(conversation, /const agentVis\s*=\s*agentVisual\(agentName/);
  assert.match(conversation, /senderEffective\.toLowerCase\(\) === agentName\.toLowerCase\(\)/);
  assert.match(conversation, /\? agentVis\s*:\s*agentVisual\(senderEffective\)/);
  assert.match(conversation, /cosmetics=\{senderVis\.cosmetics\}/);
  assert.match(conversation, /state=\{item\.justArrived \? 'done' : 'idle'\}/);
});
