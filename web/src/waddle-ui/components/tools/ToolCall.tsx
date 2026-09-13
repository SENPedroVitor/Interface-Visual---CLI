import React, { useState } from 'react';
import { ToolCallProps } from '../../types.ts';
import { StatusPill } from '../common/StatusPill.tsx';

export const ToolCall: React.FC<ToolCallProps> = ({
  toolName,
  commandOrQuery,
  status = 'done',
  duration,
  details,
  outputPreview,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="wui-card wui-animate-in" style={{ margin: '6px 0' }}>
      <div
        className="wui-card-header"
        style={{ cursor: details || outputPreview ? 'pointer' : 'default', padding: '8px 12px' }}
        onClick={() => (details || outputPreview) && setIsExpanded(!isExpanded)}
      >
        <div className="wui-card-title-group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{toolName}</span>
          {commandOrQuery && (
            <code style={{ fontSize: '11.5px', color: 'var(--wui-text-muted)', background: 'var(--wui-surface)', padding: '2px 6px', borderRadius: '4px' }}>
              {commandOrQuery}
            </code>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {duration && <span style={{ fontSize: '11px', color: 'var(--wui-text-muted)' }}>{duration}</span>}
          <StatusPill status={status} />
        </div>
      </div>

      {isExpanded && (details || outputPreview) && (
        <div className="wui-card-body" style={{ padding: '10px 12px', background: 'var(--wui-surface)' }}>
          {details && (
            <div style={{ fontSize: '12px', marginBottom: outputPreview ? '6px' : '0' }}>
              {details}
            </div>
          )}
          {outputPreview && (
            <pre className="wui-code-chip" style={{ margin: 0, maxHeight: '160px' }}>
              {outputPreview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
