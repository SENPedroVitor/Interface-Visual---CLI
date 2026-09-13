import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseOpenUI, looksLikeOpenUI } from '../src/waddle-ui/parser.ts';
import { actionRouter, ALLOWED_ACTIONS } from '../src/waddle-ui/actions.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const registryTs = readFileSync(join(root, 'src/waddle-ui/registry.ts'), 'utf8');

test('OpenUI Parser parses Function-call syntax correctly', () => {
  const code = `TaskPlan(
    title="Plano da Quinta",
    tasks=[{"agent": "Atlas", "action": "Pesquisando", "status": "running"}],
    progress=50
  )`;

  const result = parseOpenUI(code);
  assert.equal(result.hasErrors, false);
  assert.equal(result.nodes.length, 1);

  const node = result.nodes[0];
  assert.equal(node.component, 'TaskPlan');
  assert.equal(node.props.title, 'Plano da Quinta');
  assert.equal(node.props.progress, 50);
  assert.equal(Array.isArray(node.props.tasks), true);
  assert.equal(node.props.tasks[0].agent, 'Atlas');
  assert.equal(node.props.tasks[0].status, 'running');
});

test('OpenUI Parser parses JSON syntax correctly', () => {
  const jsonCode = JSON.stringify({
    component: 'ApprovalCard',
    props: {
      agent: 'Nero',
      action: 'npm install playwright',
      risk: 'medium',
      reason: 'Instalação de dependência',
    },
  });

  const result = parseOpenUI(jsonCode);
  assert.equal(result.hasErrors, false);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].component, 'ApprovalCard');
  assert.equal(result.nodes[0].props.agent, 'Nero');
  assert.equal(result.nodes[0].props.risk, 'medium');
});

test('OpenUI Parser parses JSX-like tag syntax correctly', () => {
  const tagCode = `<MatchCard homeTeam="Corinthians" awayTeam="Palmeiras" homeScore="2" awayScore="1" isLive="true" />`;

  const result = parseOpenUI(tagCode);
  assert.equal(result.hasErrors, false);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].component, 'MatchCard');
  assert.equal(result.nodes[0].props.homeTeam, 'Corinthians');
  assert.equal(result.nodes[0].props.awayTeam, 'Palmeiras');
  assert.equal(result.nodes[0].props.homeScore, 2);
  assert.equal(result.nodes[0].props.awayScore, 1);
  assert.equal(result.nodes[0].props.isLive, true);
});

test('OpenUI detection heuristic recognizes valid signatures', () => {
  assert.equal(looksLikeOpenUI('openui', 'TaskPlan(...)'), true);
  assert.equal(looksLikeOpenUI('genui', 'MatchCard(...)'), true);
  assert.equal(looksLikeOpenUI(undefined, 'StockCard(symbol="PETR4", price="38,24")'), true);
  assert.equal(looksLikeOpenUI(undefined, '<ApprovalCard agent="Nero" />'), true);
  assert.equal(looksLikeOpenUI(undefined, 'Olá mundo normal em markdown'), false);
});

test('Registry defines official controlled components', () => {
  // Check required components from Section 31
  const required = [
    'TaskPlan',
    'TaskProgress',
    'ApprovalCard',
    'ToolCall',
    'MatchCard',
    'LiveScore',
    'StockCard',
    'PortfolioCard',
    'ResearchSummary',
    'SourceCard',
    'ReviewSummary',
    'RiskCard',
  ];

  for (const comp of required) {
    assert.match(registryTs, new RegExp(`\\b${comp}\\b`));
  }
});

test('ActionRouter dispatches events to subscribers and records history', () => {
  const dispatched = [];
  const unsub = actionRouter.subscribe((action) => {
    dispatched.push(action);
  });

  actionRouter.dispatch('task.cancel', { taskId: 'task-123' });
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].action, 'task.cancel');
  assert.equal(dispatched[0].payload.taskId, 'task-123');

  unsub();
});
