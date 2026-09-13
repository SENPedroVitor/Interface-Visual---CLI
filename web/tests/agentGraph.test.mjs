import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AgentGraphPayloadSchema,
  NodeTypeSchema,
  NodeStatusSchema,
} from '../src/components/agent-graph/AgentGraph.contract.ts';
import { getNodeShapePath } from '../src/components/agent-graph/AgentGraph.shapes.ts';
import { computeAgentGraphLayout } from '../src/components/agent-graph/AgentGraph.layout.ts';

test('Zod contract validates valid agent graph payload', () => {
  const valid = {
    status: 'ready',
    nodes: [
      { id: 'n1', label: 'Agent 1', type: 'agent', status: 'done' },
      { id: 'n2', label: 'Tool 1', type: 'tool', status: 'running', detail: 'executing' },
      { id: 'n3', label: 'Decide', type: 'decision', status: 'idle' },
      { id: 'n4', label: 'Output', type: 'io', status: 'skipped' },
    ],
    edges: [
      { from: 'n1', to: 'n2', active: true },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4', label: 'Pass' },
    ],
  };

  const parseResult = AgentGraphPayloadSchema.safeParse(valid);
  assert.equal(parseResult.success, true);
});

test('Zod contract rejects invalid node type or status', () => {
  const invalidType = {
    status: 'ready',
    nodes: [{ id: 'n1', label: 'Test', type: 'unknown_type', status: 'done' }],
    edges: [],
  };
  assert.equal(AgentGraphPayloadSchema.safeParse(invalidType).success, false);

  const invalidStatus = {
    status: 'ready',
    nodes: [{ id: 'n1', label: 'Test', type: 'agent', status: 'active' }], // 'active' is not valid status; 'running' is
    edges: [],
  };
  assert.equal(AgentGraphPayloadSchema.safeParse(invalidStatus).success, false);
});

test('Shape generator outputs valid SVG paths for each orthogonal type', () => {
  const agentPath = getNodeShapePath('agent', 160, 50);
  assert.ok(agentPath.startsWith('M'));
  assert.ok(agentPath.endsWith('Z'));
  assert.ok(agentPath.includes('Q')); // Rounded corners

  const toolPath = getNodeShapePath('tool', 160, 50);
  assert.ok(toolPath.startsWith('M'));
  assert.ok(toolPath.endsWith('Z'));
  assert.ok(toolPath.includes('L')); // Chamfered corners

  const decisionPath = getNodeShapePath('decision', 160, 50);
  assert.ok(decisionPath.startsWith('M'));
  assert.ok(decisionPath.endsWith('Z'));

  const ioPath = getNodeShapePath('io', 160, 50);
  assert.ok(ioPath.startsWith('M'));
  assert.ok(ioPath.endsWith('Z'));
  assert.ok(ioPath.includes('A')); // Arc curves for pill ends
});

test('Topological layout assigns progressive layers in horizontal mode', () => {
  const nodes = [
    { id: 'a', label: 'Start', type: 'io', status: 'done' },
    { id: 'b', label: 'Process', type: 'agent', status: 'running' },
    { id: 'c', label: 'End', type: 'io', status: 'idle' },
  ];
  const edges = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ];

  const layout = computeAgentGraphLayout(nodes, edges, { direction: 'right' });
  assert.equal(layout.nodes.length, 3);
  assert.equal(layout.edges.length, 2);

  const nodeA = layout.nodes.find((n) => n.id === 'a');
  const nodeB = layout.nodes.find((n) => n.id === 'b');
  const nodeC = layout.nodes.find((n) => n.id === 'c');

  assert.equal(nodeA.layer, 0);
  assert.equal(nodeB.layer, 1);
  assert.equal(nodeC.layer, 2);

  // In horizontal right direction, x increases with layer
  assert.ok(nodeA.x < nodeB.x, `Expected nodeA.x (${nodeA.x}) < nodeB.x (${nodeB.x})`);
  assert.ok(nodeB.x < nodeC.x, `Expected nodeB.x (${nodeB.x}) < nodeC.x (${nodeC.x})`);
});

test('Topological layout assigns progressive coordinates in vertical mode', () => {
  const nodes = [
    { id: 'top', label: 'Top', type: 'agent', status: 'done' },
    { id: 'bottom', label: 'Bottom', type: 'agent', status: 'idle' },
  ];
  const edges = [{ from: 'top', to: 'bottom' }];

  const layout = computeAgentGraphLayout(nodes, edges, { direction: 'down' });
  const top = layout.nodes.find((n) => n.id === 'top');
  const bottom = layout.nodes.find((n) => n.id === 'bottom');

  assert.ok(top.y < bottom.y, `Expected top.y (${top.y}) < bottom.y (${bottom.y})`);
});

test('Topological layout breaks cycles and creates arched return wires', () => {
  const nodes = [
    { id: 'planner', label: 'Planner', type: 'agent', status: 'done' },
    { id: 'coder', label: 'Coder', type: 'agent', status: 'running' },
    { id: 'reviewer', label: 'Reviewer', type: 'decision', status: 'idle' },
  ];
  // Cycle: planner -> coder -> reviewer -> coder
  const edges = [
    { from: 'planner', to: 'coder' },
    { from: 'coder', to: 'reviewer' },
    { from: 'reviewer', to: 'coder', label: 'Revise' }, // cycle wire!
  ];

  const layout = computeAgentGraphLayout(nodes, edges, { direction: 'right' });
  assert.equal(layout.nodes.length, 3);
  assert.equal(layout.edges.length, 3);

  const cycleEdge = layout.edges.find((e) => e.from === 'reviewer' && e.to === 'coder');
  assert.ok(cycleEdge, 'Cycle edge must be present');
  assert.equal(cycleEdge.isCycle, true);
  assert.ok(cycleEdge.pathData.includes('C') || cycleEdge.pathData.includes('Q'), 'Cycle edge must have curved path');
});

test('Topological layout drops self-loops and invalid endpoints cleanly', () => {
  const nodes = [{ id: 'valid', label: 'Valid', type: 'agent', status: 'done' }];
  const edges = [
    { from: 'valid', to: 'valid' }, // self-loop
    { from: 'valid', to: 'missing_node' }, // missing target
    { from: 'missing_source', to: 'valid' }, // missing source
  ];

  const layout = computeAgentGraphLayout(nodes, edges);
  assert.equal(layout.nodes.length, 1);
  assert.equal(layout.edges.length, 0);
  assert.equal(layout.droppedEdgeCount, 3);
});
