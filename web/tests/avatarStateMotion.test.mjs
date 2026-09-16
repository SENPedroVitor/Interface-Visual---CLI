import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const avatarTsx = readFileSync(join(root, 'src/components/WaddleAvatar.tsx'), 'utf8');
const avatarCss = readFileSync(join(root, 'src/components/WaddleAvatar.css'), 'utf8');
const motionLab = readFileSync(join(root, 'src/components/AvatarMotionLab.tsx'), 'utf8');

function bodyRuleFor(state) {
  const escapedState = state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    String.raw`data-state="${escapedState}"\]\s+\.waddle-body\s*\{(?<body>[^}]*)\}`,
    'm',
  ).exec(avatarCss)?.groups?.body || '';
}

function expressionBlockFor(className) {
  const start = avatarTsx.indexOf(`className="${className}"`);
  assert.notEqual(start, -1, `${className} expression block should exist`);
  const nextStateBranch = avatarTsx.indexOf(') :', start + className.length);
  return avatarTsx.slice(start, nextStateBranch === -1 ? avatarTsx.length : nextStateBranch);
}

test('thinking and blocked compress into direct status symbols', () => {
  const thinkingRule = bodyRuleFor('thinking');
  assert.match(thinkingRule, /opacity\s*:\s*0\b/);
  assert.match(thinkingRule, /animation\s*:\s*none\s*!important/);
  assert.match(avatarCss, /data-state="thinking"\]\s+\.waddle-thinking-dots\s*\{[^}]*opacity\s*:\s*1/s);

  const blockedRule = bodyRuleFor('blocked');
  assert.match(blockedRule, /opacity\s*:\s*0\b/);
  assert.match(blockedRule, /animation\s*:\s*none\s*!important/);
  assert.match(avatarCss, /data-state="blocked"\]\s+\.waddle-blocked-mark\s*\{[^}]*opacity\s*:\s*1/s);

  assert.match(avatarTsx, /state === 'thinking' \|\| state === 'blocked'\)\s*\?\s*0/);
});

test('avatar lifecycle states use motion hooks instead of unsupported lab states', () => {
  assert.match(avatarCss, /data-state="thinking"\]\s+\.waddle-body/);
  assert.match(avatarCss, /data-state="waiting"\]\s+\.waddle-body/);
  assert.match(avatarCss, /data-state="blocked"\]\s+\.waddle-body/);
  assert.match(avatarCss, /waddleDoneSettle/);

  assert.doesNotMatch(motionLab, /\blistening\b|\bplanning\b|\bcreating\b/);
  assert.doesNotMatch(motionLab, /\smotion=\{/);
});

test('visible lifecycle states only use eye expressions outside thinking and blocked', () => {
  assert.match(avatarTsx, /waddle-eyes-working/);
  assert.match(avatarTsx, /waddle-eyes-waiting/);
  assert.match(avatarTsx, /waddle-eyes-done/);
  const waitingBlock = expressionBlockFor('waddle-eyes-waiting');
  assert.match(waitingBlock, /<(?:rect|ellipse)/);
  assert.match(waitingBlock, /waddle-eye-waiting-(?:left|right)/);
  assert.doesNotMatch(avatarTsx, /waddle-working-pulse|waddle-waiting-mark|waddle-done-spark/);
  assert.doesNotMatch(avatarCss, /waddleWorkingPulse|waddleWaitingMark|waddleDoneSpark/);
});

test('done uses only happy eyes without orbit or check mark', () => {
  assert.match(avatarTsx, /waddle-eyes-done/);
  const doneBlock = expressionBlockFor('waddle-eyes-done');
  assert.match(doneBlock, /<path/);
  assert.match(doneBlock, /Olhos calmos de concluído/);
  assert.doesNotMatch(avatarTsx, /waddle-done-orbit|waddle-done-spark|waddle-done-check/);
  assert.doesNotMatch(avatarCss, /waddleDoneOrbit|waddleDoneSpark/);
});

test('motion lab comparison cards do not add presence dots to expressions', () => {
  assert.doesNotMatch(motionLab, /showPresence/);
});

test('motion lab expression board keeps state motion visible even in static comparison mode', () => {
  assert.match(motionLab, /const EXPRESSION_CARD_VARIANT: MotionVariant = 'organic'/);
  assert.match(motionLab, /amlab__avatar amlab__avatar--\$\{EXPRESSION_CARD_VARIANT\}/);
});

test('avatar states have distinct motion vocabulary', () => {
  assert.match(avatarCss, /waddleIdleCurious/);
  assert.match(avatarCss, /waddleIdleGaze/);
  assert.match(avatarCss, /waddleWork/);
  assert.match(avatarCss, /waddleFocusedEyes/);
  assert.match(avatarCss, /waddleWait/);
  assert.match(avatarCss, /waddleWaitingEyes/);
  assert.match(avatarCss, /waddleDoneSettle/);
  assert.match(avatarCss, /waddleDoneRest/);
  assert.match(avatarCss, /waddleDoneCalmBlink/);
});
