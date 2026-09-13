import React from 'react';
import { SourceCardProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';

export const SourceCard: React.FC<SourceCardProps> = ({
  title,
  url,
  sourceType = 'doc',
  relevance = 'Alta',
  snippet,
  onAction,
}) => {
  return (
    <div className="wui-card wui-animate-in">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <span style={{ fontSize: '15px' }}>
            {sourceType === 'file' ? '📁' : sourceType === 'web' ? '🌐' : '📖'}
          </span>
          <span className="wui-card-title">{title}</span>
        </div>
        <span
          className={`wui-pill ${
            relevance === 'Alta' ? 'is-done' : relevance === 'Média' ? 'is-warning' : 'is-pending'
          }`}
        >
          {relevance}
        </span>
      </div>

      <div className="wui-card-body">
        {url && (
          <div style={{ fontSize: '12px', color: 'var(--wui-text-muted)', marginBottom: '8px', wordBreak: 'break-all' }}>
            <code>{url}</code>
          </div>
        )}
        {snippet && (
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--wui-text)', lineHeight: 1.45 }}>
            "{snippet}"
          </p>
        )}
      </div>

      <div className="wui-card-footer">
        <ActionButton
          action="source.open"
          payload={{ title, url }}
          variant="secondary"
          size="sm"
          onClick={() => onAction?.('source.open', { title, url })}
        >
          Inspecionar Fonte
        </ActionButton>
      </div>
    </div>
  );
};
