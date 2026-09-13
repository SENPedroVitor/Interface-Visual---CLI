/**
 * OpenUIRenderer
 * Safe controlled renderer for OpenUI specifications within Waddle messages.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import type { OpenUIASTNode, ActionHandler } from './types.ts';
import { parseOpenUI } from './parser.ts';
import { getComponentByName } from './registry.ts';
import './waddle-ui.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackText?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

class OpenUIErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[OpenUIRenderer] Component render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="wui-fallback-card">
          <strong>Interface Indisponível:</strong> Falha ao renderizar componente.
          {this.props.fallbackText && (
            <pre style={{ margin: '6px 0 0 0', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
              {this.props.fallbackText}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export interface OpenUIRendererProps {
  content?: string;
  nodes?: OpenUIASTNode[];
  onAction?: ActionHandler;
  className?: string;
}

export const OpenUIRenderer: React.FC<OpenUIRendererProps> = ({
  content,
  nodes: providedNodes,
  onAction,
  className = '',
}) => {
  let nodes: OpenUIASTNode[] = providedNodes || [];

  if (!providedNodes && content) {
    const parseResult = parseOpenUI(content);
    if (!parseResult.hasErrors && parseResult.nodes.length > 0) {
      nodes = parseResult.nodes;
    } else {
      // Fallback if parsing fails
      return (
        <div className={`wui-fallback-card ${className}`}>
          <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚡</span>
            <span>OpenUI Generative Interface</span>
          </div>
          <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--wui-text)' }}>
            {content}
          </pre>
        </div>
      );
    }
  }

  if (nodes.length === 0) {
    return null;
  }

  return (
    <div className={`wui-renderer-container ${className}`}>
      {nodes.map((node, index) => {
        const Component = getComponentByName(node.component);

        if (!Component) {
          return (
            <div key={index} className="wui-fallback-card" style={{ margin: '8px 0' }}>
              <div style={{ color: 'var(--wui-warning)', fontWeight: 600, marginBottom: '2px' }}>
                ⚠ Componente não registrado: {node.component}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--wui-text-muted)' }}>
                Este componente não faz parte da biblioteca controlada Waddle UI.
              </div>
              {node.raw && (
                <pre style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--wui-text)' }}>
                  {node.raw}
                </pre>
              )}
            </div>
          );
        }

        return (
          <OpenUIErrorBoundary key={index} fallbackText={node.raw}>
            <Component {...node.props} onAction={onAction} />
          </OpenUIErrorBoundary>
        );
      })}
    </div>
  );
};
