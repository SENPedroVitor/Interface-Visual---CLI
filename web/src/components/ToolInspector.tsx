import React from 'react';
import { ToolInfo } from '../types';

interface ToolInspectorProps {
  tools: ToolInfo[];
}

export const ToolInspector: React.FC<ToolInspectorProps> = ({ tools }) => {
  return (
    <section className="panel-card" style={{ marginTop: '4px' }}>
      <div className="panel-title">
        <span>Tool Registry & Segurança</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PERMISSÕES E RISCO</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {tools.map((tool) => (
          <div
            key={tool.name}
            style={{
              background: 'rgba(15, 19, 34, 0.7)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#c4b5fd' }}>
                {tool.name}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  textTransform: 'uppercase',
                  background: tool.risk_level === 'low' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: tool.risk_level === 'low' ? '#34d399' : '#fbbf24',
                  border: `1px solid ${tool.risk_level === 'low' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                }}
              >
                Risco {tool.risk_level} • {tool.permission}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tool.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
