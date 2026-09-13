import React, { forwardRef, useState, useMemo, useCallback } from 'react';
import {
  AgentGraphPayloadSchema,
  type AgentGraphPayload,
  type GraphDirection,
  type GraphFit,
} from './AgentGraph.contract.ts';
import { getNodeShapePath } from './AgentGraph.shapes.ts';
import { computeAgentGraphLayout, clamp } from './AgentGraph.layout.ts';
import './AgentGraph.css';

export interface AgentGraphProps {
  data: AgentGraphPayload;
  direction?: GraphDirection;
  fit?: GraphFit;
  zoom?: number;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  gap?: number;
  layerGap?: number;
  showLegend?: boolean;
  'aria-label'?: string;
  className?: string;
}

export const AgentGraph = forwardRef<HTMLElement, AgentGraphProps>(
  (
    {
      data,
      direction = 'right',
      fit = 'width',
      zoom = 1,
      interactive = false,
      selectedId = null,
      onSelect,
      gap = 16,
      layerGap = 60,
      showLegend = false,
      'aria-label': ariaLabel = 'Agent workflow',
      className = '',
    },
    ref
  ) => {
    // 1. Zod Contract Validation
    const parseResult = useMemo(() => AgentGraphPayloadSchema.safeParse(data), [data]);
    const validData = parseResult.success ? parseResult.data : null;

    // Hovered node state for trace dimming
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [focusedId, setFocusedId] = useState<string | null>(null);

    // Effective active node for highlight calculation (hover wins, falls back to keyboard focus, then selection)
    const activeHighlightId = hoveredId || focusedId || selectedId;

    // Clamped parameters
    const safeGap = clamp(gap, 8, 48);
    const safeLayerGap = clamp(layerGap, 16, 80);

    // Compute layout topology
    const layout = useMemo(() => {
      if (!validData || validData.status !== 'ready' || validData.nodes.length === 0) {
        return null;
      }
      return computeAgentGraphLayout(validData.nodes, validData.edges, {
        direction,
        nodeGap: safeGap,
        layerGap: safeLayerGap,
        nodeWidth: 175,
        nodeHeight: 56,
      });
    }, [validData, direction, safeGap, safeLayerGap]);

    // Trace Dimming graph connectivity sets
    const { highlightedNodes, highlightedEdges } = useMemo(() => {
      if (!activeHighlightId || !validData) {
        return { highlightedNodes: new Set<string>(), highlightedEdges: new Set<string>() };
      }

      const nodeSet = new Set<string>([activeHighlightId]);
      const edgeSet = new Set<string>();

      for (const e of validData.edges) {
        if (e.from === activeHighlightId || e.to === activeHighlightId) {
          nodeSet.add(e.from);
          nodeSet.add(e.to);
          edgeSet.add(`${e.from}->${e.to}`);
        }
      }

      return { highlightedNodes: nodeSet, highlightedEdges: edgeSet };
    }, [activeHighlightId, validData]);

    // Keyboard navigation handlers
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent, nodeId: string) => {
        if (!interactive || !layout) return;

        const nodeIndex = layout.nodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1) return;

        let nextIndex = nodeIndex;
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault();
            nextIndex = (nodeIndex + 1) % layout.nodes.length;
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault();
            nextIndex = (nodeIndex - 1 + layout.nodes.length) % layout.nodes.length;
            break;
          case 'Home':
            e.preventDefault();
            nextIndex = 0;
            break;
          case 'End':
            e.preventDefault();
            nextIndex = layout.nodes.length - 1;
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (onSelect) {
              onSelect(selectedId === nodeId ? null : nodeId);
            }
            return;
          case 'Escape':
            e.preventDefault();
            if (onSelect) {
              onSelect(null);
            }
            return;
          default:
            return;
        }

        const nextNode = layout.nodes[nextIndex];
        if (nextNode) {
          const el = document.getElementById(`ag-node-${nextNode.id}`);
          el?.focus();
          setFocusedId(nextNode.id);
        }
      },
      [interactive, layout, onSelect, selectedId]
    );

    // Empty state
    if (!validData || validData.status === 'empty' || (validData.nodes && validData.nodes.length === 0)) {
      return (
        <figure ref={ref} className={`agent-graph-root ${className}`} aria-label={ariaLabel}>
          <div className="agent-graph-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 8, opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Nenhum nó no fluxo ou grafo vazio.</span>
          </div>
        </figure>
      );
    }

    // Error state
    if (!parseResult.success || validData.status === 'error') {
      return (
        <figure ref={ref} className={`agent-graph-root ${className}`} aria-label={ariaLabel}>
          <div className="agent-graph-error">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 8 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <strong>Erro no Grafo de Arquitetura</strong>
            <span style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>
              {parseResult.success ? 'Status marcado como erro' : 'Contrato Zod inválido'}
            </span>
          </div>
        </figure>
      );
    }

    // Loading state
    if (validData.status === 'loading' || !layout) {
      return (
        <figure ref={ref} className={`agent-graph-root ${className}`} aria-label={ariaLabel}>
          <div className="agent-graph-empty">
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '2px solid rgba(0,0,0,0.1)',
                borderTopColor: '#3b82f6',
                animation: 'spin 0.8s linear infinite',
                marginBottom: 10,
              }}
            />
            <span>Calculando topologia do fluxo...</span>
          </div>
        </figure>
      );
    }

    const { bounds, nodes, edges } = layout;
    const hasHighlight = activeHighlightId !== null;

    return (
      <figure
        ref={ref}
        className={`agent-graph-root ${className}`}
        aria-label={ariaLabel}
        data-direction={direction}
        data-fit={fit}
      >
        <div
          className={`agent-graph-viewport ${
            fit === 'scroll' ? 'is-scrollable' : 'is-width-fit'
          }`}
        >
          <svg
            className={`agent-graph-svg ${hasHighlight ? 'has-highlight' : ''}`}
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
            width={fit === 'scroll' ? Math.round(bounds.width * (zoom || 1)) : '100%'}
            height={fit === 'scroll' ? Math.round(bounds.height * (zoom || 1)) : undefined}
            preserveAspectRatio="xMidYMid meet"
            role={interactive ? 'listbox' : 'img'}
            aria-label={ariaLabel}
            aria-activedescendant={selectedId ? `ag-node-${selectedId}` : undefined}
            style={{ minHeight: fit === 'width' ? 180 : undefined }}
          >
            {/* SVG Defs: Marker Arrowheads */}
            <defs>
              <marker
                id="ag-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--gray-400, #94a3b8)" />
              </marker>

              <marker
                id="ag-arrow-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6" />
              </marker>

              <marker
                id="ag-arrow-highlight"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
              </marker>
            </defs>

            {/* Edges Layer */}
            <g className="ag-edges-layer">
              {edges.map((edge) => {
                const isEdgeHighlighted = highlightedEdges.has(edge.id);
                const markerType = edge.active
                  ? 'url(#ag-arrow-active)'
                  : isEdgeHighlighted
                  ? 'url(#ag-arrow-highlight)'
                  : 'url(#ag-arrow)';

                return (
                  <g
                    key={edge.id}
                    className={`ag-edge ${edge.active ? 'is-active' : ''} ${
                      edge.isCycle ? 'is-cycle' : ''
                    } ${isEdgeHighlighted ? 'is-highlighted' : ''}`}
                  >
                    <path
                      d={edge.pathData}
                      className={`ag-edge-path ${edge.active ? 'is-active' : ''} ${
                        edge.isCycle ? 'is-cycle' : ''
                      }`}
                      markerEnd={markerType}
                    >
                      {edge.active && (
                        <animate
                          attributeName="stroke-dashoffset"
                          values="24;0"
                          dur="1.2s"
                          repeatCount="indefinite"
                        />
                      )}
                    </path>

                    {/* Edge Label */}
                    {edge.label && edge.labelPoint && (
                      <g
                        className="ag-edge-label"
                        transform={`translate(${edge.labelPoint.x}, ${edge.labelPoint.y})`}
                      >
                        <rect
                          x={-28}
                          y={-9}
                          width={56}
                          height={18}
                          className="ag-edge-label-bg"
                        />
                        <text className="ag-edge-label-text">{edge.label}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Nodes Layer */}
            <g className="ag-nodes-layer">
              {nodes.map((node) => {
                const isSelected = selectedId === node.id;
                const isNodeHighlighted = highlightedNodes.has(node.id);
                const shapePath = getNodeShapePath(node.type, node.width, node.height);

                return (
                  <g
                    key={node.id}
                    id={`ag-node-${node.id}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    className={`ag-node type-${node.type} status-${node.status} ${
                      isSelected ? 'is-selected' : ''
                    } ${isNodeHighlighted ? 'is-highlighted' : ''} ${
                      interactive ? 'is-interactive' : ''
                    }`}
                    role={interactive ? 'option' : undefined}
                    aria-selected={isSelected}
                    tabIndex={interactive ? 0 : -1}
                    onClick={() => {
                      if (interactive && onSelect) {
                        onSelect(isSelected ? null : node.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setFocusedId(node.id)}
                    onBlur={() => setFocusedId(null)}
                    onKeyDown={(e) => handleKeyDown(e, node.id)}
                  >
                    <title>
                      {`${node.label} (${node.type} • ${node.status})${
                        node.detail ? ` - ${node.detail}` : ''
                      }`}
                    </title>

                    {/* Shape Outline: Shape encodes TYPE */}
                    <path className="ag-node-shape" d={shapePath} />

                    {/* Small Status Indicator Dot */}
                    <circle
                      className="ag-node-dot"
                      cx={-node.width / 2 + 16}
                      cy={-node.height / 2 + 16}
                      r={3.5}
                    />

                    {/* Small Type Label (agent / tool / decision / io) */}
                    <text
                      className="ag-node-type-label"
                      x={-node.width / 2 + 26}
                      y={-node.height / 2 + 16}
                      textAnchor="start"
                    >
                      {node.type}
                    </text>

                    {/* Primary Label */}
                    <text
                      className="ag-node-text"
                      x={0}
                      y={node.detail ? 2 : 5}
                    >
                      {node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label}
                    </text>

                    {/* Detail / Subtext */}
                    {node.detail && (
                      <text className="ag-node-subtext" x={0} y={16}>
                        {node.detail.length > 24 ? `${node.detail.slice(0, 23)}…` : node.detail}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="agent-graph-legend">
            <div className="agent-graph-legend-group">
              <span className="agent-graph-legend-title">Forma (Tipo):</span>
              <span className="agent-graph-legend-item">Retângulo: Agent</span>
              <span className="agent-graph-legend-item">Chanfrado: Tool</span>
              <span className="agent-graph-legend-item">Hexágono: Decision</span>
              <span className="agent-graph-legend-item">Pílula: I/O</span>
            </div>
            <div className="agent-graph-legend-group">
              <span className="agent-graph-legend-title">Cor (Status):</span>
              <span className="agent-graph-legend-item">
                <span className="agent-graph-legend-swatch idle" /> Idle
              </span>
              <span className="agent-graph-legend-item">
                <span className="agent-graph-legend-swatch running" /> Running
              </span>
              <span className="agent-graph-legend-item">
                <span className="agent-graph-legend-swatch done" /> Done
              </span>
              <span className="agent-graph-legend-item">
                <span className="agent-graph-legend-swatch failed" /> Failed
              </span>
              <span className="agent-graph-legend-item">
                <span className="agent-graph-legend-swatch skipped" /> Skipped
              </span>
            </div>
          </div>
        )}
      </figure>
    );
  }
);

AgentGraph.displayName = 'AgentGraph';
