import React from 'react';
import { ResearchSummaryProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';

export const ResearchSummary: React.FC<ResearchSummaryProps> = ({
  topic,
  keyFindings = [],
  sourcesCount,
  sources = [],
  confidenceScore,
  onAction,
}) => {
  return (
    <div className="wui-card wui-animate-in">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
          </svg>
          <span className="wui-card-title">{topic || 'Síntese de Pesquisa'}</span>
        </div>
        {confidenceScore !== undefined && (
          <span className="wui-pill is-done" style={{ fontWeight: 600 }}>
            Confiança: {confidenceScore}%
          </span>
        )}
      </div>

      <div className="wui-card-body">
        {keyFindings.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--wui-text-muted)', fontWeight: 600, marginBottom: '6px' }}>
              Principais Constatações
            </div>
            <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
              {keyFindings.map((finding, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}

        {sources.length > 0 && (
          <div>
            <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--wui-text-muted)', fontWeight: 600, marginBottom: '6px' }}>
              Fontes Consultadas ({sourcesCount || sources.length})
            </div>
            <div className="wui-task-list">
              {sources.map((src, idx) => (
                <div key={idx} className="wui-task-item">
                  <div className="wui-task-left">
                    <span style={{ fontSize: '12px' }}>📄</span>
                    <strong style={{ fontSize: '13px' }}>{src.title}</strong>
                  </div>
                  <span
                    className={`wui-pill ${
                      src.relevance === 'Alta' ? 'is-done' : src.relevance === 'Média' ? 'is-warning' : 'is-pending'
                    }`}
                  >
                    Relevância: {src.relevance}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="wui-card-footer">
        <ActionButton
          action="source.open"
          payload={{ topic, sources }}
          variant="primary"
          size="sm"
          onClick={() => onAction?.('source.open', { topic, sources })}
        >
          Abrir fontes
        </ActionButton>
      </div>
    </div>
  );
};
