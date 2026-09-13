import { z } from 'zod';

export const NodeTypeSchema = z.enum(['agent', 'tool', 'decision', 'io']);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const NodeStatusSchema = z.enum(['idle', 'running', 'done', 'failed', 'skipped']);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

export const NodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: NodeTypeSchema,
  status: NodeStatusSchema,
  detail: z.string().optional(),
});
export type AgentGraphNode = z.infer<typeof NodeSchema>;

export const EdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  active: z.boolean().optional(),
  label: z.string().optional(),
});
export type AgentGraphEdge = z.infer<typeof EdgeSchema>;

export const EnvelopeStatusSchema = z.enum(['loading', 'empty', 'error', 'ready']);
export type EnvelopeStatus = z.infer<typeof EnvelopeStatusSchema>;

export const AgentGraphPayloadSchema = z.object({
  status: EnvelopeStatusSchema,
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});
export type AgentGraphPayload = z.infer<typeof AgentGraphPayloadSchema>;

export type GraphDirection = 'right' | 'down';
export type GraphFit = 'width' | 'scroll';
