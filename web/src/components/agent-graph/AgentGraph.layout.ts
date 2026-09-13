import type { AgentGraphEdge, AgentGraphNode, GraphDirection } from './AgentGraph.contract.ts';

export interface LayoutNode extends AgentGraphNode {
  layer: number;
  slot: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BendPoint {
  id: string;
  edgeId: string;
  layer: number;
  slot: number;
  x: number;
  y: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  active?: boolean;
  label?: string;
  isCycle: boolean;
  pathData: string;
  labelPoint?: { x: number; y: number };
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

export interface LayoutOptions {
  direction?: GraphDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  layerGap?: number;
  nodeGap?: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  bounds: {
    width: number;
    height: number;
    minX: number;
    minY: number;
  };
  droppedEdgeCount: number;
  layerCount: number;
  maxSlots: number;
}

export function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val) || !Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes topological layout for an Agent Workflow Graph.
 * Pure function: Topology in, deterministic coordinates out.
 */
export function computeAgentGraphLayout(
  rawNodes: AgentGraphNode[],
  rawEdges: AgentGraphEdge[],
  options: LayoutOptions = {}
): LayoutResult {
  const direction: GraphDirection = options.direction === 'down' ? 'down' : 'right';
  const nodeWidth = clamp(options.nodeWidth ?? 176, 80, 480);
  const nodeHeight = clamp(options.nodeHeight ?? 58, 40, 200);
  const layerGap = clamp(options.layerGap ?? 60, 24, 240);
  const nodeGap = clamp(options.nodeGap ?? 16, 8, 160);

  // 1. Normalise Nodes (First ID wins)
  const nodeMap = new Map<string, AgentGraphNode>();
  const nodes: AgentGraphNode[] = [];
  for (const n of rawNodes) {
    if (!nodeMap.has(n.id)) {
      nodeMap.set(n.id, n);
      nodes.push(n);
    }
  }

  // 2. Normalise Edges (Drop unknown endpoints and self-loops, merge duplicates)
  let droppedEdgeCount = 0;
  const edgeDedupe = new Map<string, { from: string; to: string; active?: boolean; label?: string }>();

  for (const e of rawEdges) {
    if (!nodeMap.has(e.from) || !nodeMap.has(e.to) || e.from === e.to) {
      droppedEdgeCount++;
      continue;
    }
    const pairKey = `${e.from}->${e.to}`;
    const existing = edgeDedupe.get(pairKey);
    if (existing) {
      existing.active = existing.active || Boolean(e.active);
      if (!existing.label && e.label) existing.label = e.label;
    } else {
      edgeDedupe.set(pairKey, { from: e.from, to: e.to, active: e.active, label: e.label });
    }
  }
  const cleanEdges = Array.from(edgeDedupe.values());

  if (nodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      bounds: { width: 0, height: 0, minX: 0, minY: 0 },
      droppedEdgeCount,
      layerCount: 0,
      maxSlots: 0,
    };
  }

  // 3. Rank with Kahn Drain + Longest Path & Cycle Handling
  const incomingMap = new Map<string, Set<string>>();
  const outgoingMap = new Map<string, Set<string>>();
  for (const n of nodes) {
    incomingMap.set(n.id, new Set());
    outgoingMap.set(n.id, new Set());
  }
  for (const e of cleanEdges) {
    incomingMap.get(e.to)!.add(e.from);
    outgoingMap.get(e.from)!.add(e.to);
  }

  const inDegree = new Map<string, number>();
  nodes.forEach(n => inDegree.set(n.id, incomingMap.get(n.id)!.size));

  const settledLayers = new Map<string, number>();
  const cycleEdges = new Set<string>(); // "from->to"

  // Queue of nodes with inDegree 0
  let queue: string[] = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
  nodes.filter(n => inDegree.get(n.id) === 0).forEach(n => settledLayers.set(n.id, 0));

  while (settledLayers.size < nodes.length) {
    if (queue.length === 0) {
      // CYCLE DETECTED!
      // Pick the weakest remaining node (fewest unresolved inputs, original input order breaks ties)
      let candidateId = '';
      let minUnresolved = Infinity;

      for (const n of nodes) {
        if (!settledLayers.has(n.id)) {
          const unresolvedCount = inDegree.get(n.id) || 0;
          if (unresolvedCount < minUnresolved) {
            minUnresolved = unresolvedCount;
            candidateId = n.id;
          }
        }
      }

      if (!candidateId) break;

      // Force candidate to be a root
      // Mark all incoming edges from unsettled nodes as cycle return edges
      const inSet = incomingMap.get(candidateId) || new Set();
      for (const fromId of inSet) {
        if (!settledLayers.has(fromId)) {
          cycleEdges.add(`${fromId}->${candidateId}`);
          inDegree.set(candidateId, (inDegree.get(candidateId) || 1) - 1);
        }
      }

      // Compute layer based on already settled inputs
      let maxSettledInputLayer = -1;
      for (const fromId of inSet) {
        if (settledLayers.has(fromId)) {
          maxSettledInputLayer = Math.max(maxSettledInputLayer, settledLayers.get(fromId)!);
        }
      }
      settledLayers.set(candidateId, maxSettledInputLayer + 1);
      queue.push(candidateId);
    }

    const currentId = queue.shift()!;
    const currentLayer = settledLayers.get(currentId)!;

    // Relax outgoing edges
    const outSet = outgoingMap.get(currentId) || new Set();
    for (const toId of outSet) {
      const edgeKey = `${currentId}->${toId}`;
      if (cycleEdges.has(edgeKey)) continue;

      // Longest path: layer(v) = max(layer(v), currentLayer + 1)
      if (!settledLayers.has(toId)) {
        const nextInDegree = (inDegree.get(toId) || 1) - 1;
        inDegree.set(toId, nextInDegree);
        if (nextInDegree <= 0) {
          // Find max layer of all incoming forward edges to toId
          const toInputs = incomingMap.get(toId) || new Set();
          let maxInputLayer = currentLayer;
          for (const inpId of toInputs) {
            if (settledLayers.has(inpId) && !cycleEdges.has(`${inpId}->${toId}`)) {
              maxInputLayer = Math.max(maxInputLayer, settledLayers.get(inpId)!);
            }
          }
          settledLayers.set(toId, maxInputLayer + 1);
          queue.push(toId);
        }
      }
    }
  }

  // Ensure all nodes have layers
  nodes.forEach(n => {
    if (!settledLayers.has(n.id)) settledLayers.set(n.id, 0);
  });

  // 4. Bend Points for Layer-Skipping Wires
  interface LayerItem {
    id: string;
    isBend: boolean;
    edgeId?: string;
    node?: AgentGraphNode;
    bend?: BendPoint;
    barycenter: number;
    slot: number;
  }

  const maxLayer = Math.max(0, ...Array.from(settledLayers.values()));
  const layers: LayerItem[][] = Array.from({ length: maxLayer + 1 }, () => []);

  // Insert real nodes into layers
  nodes.forEach(n => {
    const l = settledLayers.get(n.id)!;
    layers[l].push({
      id: n.id,
      isBend: false,
      node: n,
      barycenter: 0,
      slot: 0,
    });
  });

  // Find long forward edges and create bend points
  const bendPointsByEdge = new Map<string, BendPoint[]>();
  const forwardEdges = cleanEdges.filter(e => !cycleEdges.has(`${e.from}->${e.to}`));

  forwardEdges.forEach((e, edgeIdx) => {
    const fromL = settledLayers.get(e.from)!;
    const toL = settledLayers.get(e.to)!;
    const edgeId = `edge-${e.from}-${e.to}-${edgeIdx}`;

    if (toL - fromL > 1) {
      const bends: BendPoint[] = [];
      for (let l = fromL + 1; l < toL; l++) {
        const bpId = `bend-${edgeId}-L${l}`;
        const bp: BendPoint = {
          id: bpId,
          edgeId,
          layer: l,
          slot: 0,
          x: 0,
          y: 0,
        };
        bends.push(bp);
        layers[l].push({
          id: bpId,
          isBend: true,
          edgeId,
          bend: bp,
          barycenter: 0,
          slot: 0,
        });
      }
      bendPointsByEdge.set(edgeId, bends);
    }
  });

  // Assign initial slots based on position in array
  layers.forEach(layer => {
    layer.forEach((item, idx) => {
      item.slot = idx;
      item.barycenter = idx;
    });
  });

  // 5. Barycenter Sweeps to Minimize Crossings (3 Passes)
  // Build lookup of item slots
  const getItemSlot = (id: string, l: number): number => {
    const found = layers[l]?.find(it => it.id === id);
    return found ? found.slot : 0;
  };

  // Helper to get connected predecessor slots
  const getPredecessorAvgSlot = (item: LayerItem, l: number): number => {
    if (l === 0) return item.slot;
    const predSlots: number[] = [];

    if (!item.isBend) {
      const inNodes = incomingMap.get(item.id) || new Set();
      for (const pId of inNodes) {
        if (cycleEdges.has(`${pId}->${item.id}`)) continue;
        const pL = settledLayers.get(pId)!;
        if (pL === l - 1) {
          predSlots.push(getItemSlot(pId, l - 1));
        } else if (pL < l - 1) {
          // Check for bend point in l - 1
          const bId = `bend-edge-${pId}-${item.id}-L${l - 1}`;
          predSlots.push(getItemSlot(bId, l - 1));
        }
      }
    } else {
      // Bend point: predecessor is in layer l - 1 (either another bend or the start node)
      const eParts = item.edgeId!.split('-'); // edge-from-to-idx
      const fromId = eParts[1];
      const pL = settledLayers.get(fromId)!;
      if (pL === l - 1) {
        predSlots.push(getItemSlot(fromId, l - 1));
      } else {
        const prevBendId = `bend-${item.edgeId}-L${l - 1}`;
        predSlots.push(getItemSlot(prevBendId, l - 1));
      }
    }

    if (predSlots.length === 0) return item.slot;
    return predSlots.reduce((a, b) => a + b, 0) / predSlots.length;
  };

  // Helper to get connected successor slots
  const getSuccessorAvgSlot = (item: LayerItem, l: number): number => {
    if (l === maxLayer) return item.slot;
    const succSlots: number[] = [];

    if (!item.isBend) {
      const outNodes = outgoingMap.get(item.id) || new Set();
      for (const sId of outNodes) {
        if (cycleEdges.has(`${item.id}->${sId}`)) continue;
        const sL = settledLayers.get(sId)!;
        if (sL === l + 1) {
          succSlots.push(getItemSlot(sId, l + 1));
        } else if (sL > l + 1) {
          const bId = `bend-edge-${item.id}-${sId}-L${l + 1}`;
          succSlots.push(getItemSlot(bId, l + 1));
        }
      }
    } else {
      // Bend point: successor is in layer l + 1
      const eParts = item.edgeId!.split('-');
      const toId = eParts[2];
      const sL = settledLayers.get(toId)!;
      if (sL === l + 1) {
        succSlots.push(getItemSlot(toId, l + 1));
      } else {
        const nextBendId = `bend-${item.edgeId}-L${l + 1}`;
        succSlots.push(getItemSlot(nextBendId, l + 1));
      }
    }

    if (succSlots.length === 0) return item.slot;
    return succSlots.reduce((a, b) => a + b, 0) / succSlots.length;
  };

  // 3-Pass Alternating Barycenter Sweeps
  // Pass 1: Downward (using predecessors)
  for (let l = 1; l <= maxLayer; l++) {
    layers[l].forEach(item => { item.barycenter = getPredecessorAvgSlot(item, l); });
    layers[l].sort((a, b) => (a.barycenter !== b.barycenter ? a.barycenter - b.barycenter : a.slot - b.slot));
    layers[l].forEach((item, idx) => { item.slot = idx; });
  }

  // Pass 2: Upward (using successors)
  for (let l = maxLayer - 1; l >= 0; l--) {
    layers[l].forEach(item => { item.barycenter = getSuccessorAvgSlot(item, l); });
    layers[l].sort((a, b) => (a.barycenter !== b.barycenter ? a.barycenter - b.barycenter : a.slot - b.slot));
    layers[l].forEach((item, idx) => { item.slot = idx; });
  }

  // Pass 3: Downward
  for (let l = 1; l <= maxLayer; l++) {
    layers[l].forEach(item => { item.barycenter = getPredecessorAvgSlot(item, l); });
    layers[l].sort((a, b) => (a.barycenter !== b.barycenter ? a.barycenter - b.barycenter : a.slot - b.slot));
    layers[l].forEach((item, idx) => { item.slot = idx; });
  }

  // 6. Coordinate Assignment with Fanning / Centering
  const maxSlotsInAnyLayer = Math.max(1, ...layers.map(l => l.length));

  const rankPitch = (direction === 'right' ? nodeWidth : nodeHeight) + layerGap;
  const slotPitch = (direction === 'right' ? nodeHeight : nodeWidth) + nodeGap;

  const PADDING_RANK = 48;
  const PADDING_SLOT = 40;
  const RETURN_ARC_EXTRA = cycleEdges.size > 0 ? 56 : 0;

  const layoutNodesMap = new Map<string, LayoutNode>();
  const bendCoordsMap = new Map<string, { x: number; y: number }>();

  layers.forEach((layer, layerIdx) => {
    const slotsInLayer = layer.length;
    // Fanning / centering across the widest layer
    const slotOffset = ((maxSlotsInAnyLayer - slotsInLayer) * slotPitch) / 2;

    layer.forEach(item => {
      const rankCoord = PADDING_RANK + layerIdx * rankPitch + (direction === 'right' ? nodeWidth : nodeHeight) / 2;
      const slotCoord = PADDING_SLOT + RETURN_ARC_EXTRA + slotOffset + item.slot * slotPitch + (direction === 'right' ? nodeHeight : nodeWidth) / 2;

      const x = direction === 'right' ? rankCoord : slotCoord;
      const y = direction === 'right' ? slotCoord : rankCoord;

      if (!item.isBend && item.node) {
        layoutNodesMap.set(item.id, {
          ...item.node,
          layer: layerIdx,
          slot: item.slot,
          x,
          y,
          width: nodeWidth,
          height: nodeHeight,
        });
      } else if (item.bend) {
        bendCoordsMap.set(item.id, { x, y });
        item.bend.x = x;
        item.bend.y = y;
      }
    });
  });

  // 7. Path Generation: Cubic Béziers for Forward & Arched Return Wires for Cycles
  const layoutEdges: LayoutEdge[] = [];

  cleanEdges.forEach((e, idx) => {
    const fromNode = layoutNodesMap.get(e.from);
    const toNode = layoutNodesMap.get(e.to);
    if (!fromNode || !toNode) return;

    const edgeId = `edge-${e.from}-${e.to}-${idx}`;
    const isCycle = cycleEdges.has(`${e.from}->${e.to}`);

    if (isCycle) {
      // Return wire bowing outside the boxes to prevent collision
      // In direction 'right': leaves top/bottom and curves back
      let startPoint = { x: fromNode.x, y: fromNode.y - nodeHeight / 2 };
      let endPoint = { x: toNode.x, y: toNode.y - nodeHeight / 2 };
      const apexY = PADDING_SLOT + 12; // High apex near top edge
      const cp1X = fromNode.x;
      const cp1Y = apexY;
      const cp2X = toNode.x;
      const cp2Y = apexY;

      const pathData = `M ${startPoint.x} ${startPoint.y} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endPoint.x} ${endPoint.y}`;
      const labelPoint = { x: (fromNode.x + toNode.x) / 2, y: apexY - 6 };

      layoutEdges.push({
        id: edgeId,
        from: e.from,
        to: e.to,
        active: e.active,
        label: e.label,
        isCycle: true,
        pathData,
        labelPoint,
        startPoint,
        endPoint,
      });
    } else {
      // Forward wire: smooth tangent-continuous cubic Bézier passing through bends
      const bends = bendPointsByEdge.get(edgeId) || [];

      // Determine attachment points on the perimeter of boxes
      const startPoint = direction === 'right'
        ? { x: fromNode.x + nodeWidth / 2, y: fromNode.y }
        : { x: fromNode.x, y: fromNode.y + nodeHeight / 2 };

      const endPoint = direction === 'right'
        ? { x: toNode.x - nodeWidth / 2, y: toNode.y }
        : { x: toNode.x, y: toNode.y - nodeHeight / 2 };

      const allPoints: { x: number; y: number }[] = [startPoint];
      bends.forEach(b => allPoints.push({ x: b.x, y: b.y }));
      allPoints.push(endPoint);

      // Generate tangent-continuous cubic Bézier runs
      let path = `M ${allPoints[0].x} ${allPoints[0].y}`;
      for (let i = 0; i < allPoints.length - 1; i++) {
        const p1 = allPoints[i];
        const p2 = allPoints[i + 1];
        if (direction === 'right') {
          const midX = p1.x + (p2.x - p1.x) * 0.5;
          path += ` C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
        } else {
          const midY = p1.y + (p2.y - p1.y) * 0.5;
          path += ` C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;
        }
      }

      const midIdx = Math.floor((allPoints.length - 1) / 2);
      const labelPoint = {
        x: (allPoints[midIdx].x + allPoints[midIdx + 1].x) / 2,
        y: (allPoints[midIdx].y + allPoints[midIdx + 1].y) / 2 - 8,
      };

      layoutEdges.push({
        id: edgeId,
        from: e.from,
        to: e.to,
        active: e.active,
        label: e.label,
        isCycle: false,
        pathData: path,
        labelPoint,
        startPoint,
        endPoint,
      });
    }
  });

  // 8. Compute Canvas Bounds
  const totalRankLength = PADDING_RANK * 2 + (maxLayer + 1) * rankPitch;
  const totalSlotLength = PADDING_SLOT * 2 + RETURN_ARC_EXTRA + maxSlotsInAnyLayer * slotPitch;

  const totalWidth = direction === 'right' ? totalRankLength : totalSlotLength;
  const totalHeight = direction === 'right' ? totalSlotLength : totalRankLength;

  return {
    nodes: Array.from(layoutNodesMap.values()),
    edges: layoutEdges,
    bounds: {
      width: Math.round(totalWidth),
      height: Math.round(totalHeight),
      minX: 0,
      minY: 0,
    },
    droppedEdgeCount,
    layerCount: maxLayer + 1,
    maxSlots: maxSlotsInAnyLayer,
  };
}
