import type { NodeType } from './AgentGraph.contract.ts';

/**
 * Returns an SVG path string for a node centered at (0, 0) with dimensions (width, height).
 * Type picks the outline shape:
 * - agent: rounded rectangle
 * - tool: chamfered plate (45° beveled corners)
 * - decision: hexagon
 * - io: stadium (pill shape with semi-circle ends)
 */
export function getNodeShapePath(type: NodeType, width: number, height: number): string {
  const w = width;
  const h = height;
  const hw = w / 2;
  const hh = h / 2;

  switch (type) {
    case 'agent': {
      // Rounded box
      const r = Math.min(12, hh, hw);
      return `M ${-hw + r} ${-hh} ` +
        `L ${hw - r} ${-hh} ` +
        `Q ${hw} ${-hh} ${hw} ${-hh + r} ` +
        `L ${hw} ${hh - r} ` +
        `Q ${hw} ${hh} ${hw - r} ${hh} ` +
        `L ${-hw + r} ${hh} ` +
        `Q ${-hw} ${hh} ${-hw} ${hh - r} ` +
        `L ${-hw} ${-hh + r} ` +
        `Q ${-hw} ${-hh} ${-hw + r} ${-hh} Z`;
    }

    case 'tool': {
      // Chamfered plate
      const c = Math.min(10, hh * 0.35, hw * 0.2);
      return `M ${-hw + c} ${-hh} ` +
        `L ${hw - c} ${-hh} ` +
        `L ${hw} ${-hh + c} ` +
        `L ${hw} ${hh - c} ` +
        `L ${hw - c} ${hh} ` +
        `L ${-hw + c} ${hh} ` +
        `L ${-hw} ${hh - c} ` +
        `L ${-hw} ${-hh + c} Z`;
    }

    case 'decision': {
      // Hexagon (pointy left and right edges for horizontal flow readability)
      const p = Math.min(16, hw * 0.25);
      return `M ${-hw + p} ${-hh} ` +
        `L ${hw - p} ${-hh} ` +
        `L ${hw} 0 ` +
        `L ${hw - p} ${hh} ` +
        `L ${-hw + p} ${hh} ` +
        `L ${-hw} 0 Z`;
    }

    case 'io': {
      // Stadium / Pill
      const r = hh;
      return `M ${-hw + r} ${-hh} ` +
        `L ${hw - r} ${-hh} ` +
        `A ${r} ${r} 0 0 1 ${hw} 0 ` +
        `A ${r} ${r} 0 0 1 ${hw - r} ${hh} ` +
        `L ${-hw + r} ${hh} ` +
        `A ${r} ${r} 0 0 1 ${-hw} 0 ` +
        `A ${r} ${r} 0 0 1 ${-hw + r} ${-hh} Z`;
    }

    default: {
      return `M ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh} L ${-hw} ${hh} Z`;
    }
  }
}
