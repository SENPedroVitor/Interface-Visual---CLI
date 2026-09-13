import React, { useState } from 'react';
import './ToolCallCard.css';

export interface ToolCallCardProps {
  id: string;
  toolName: string;
  commandOrQuery?: string;
  status: 'running' | 'done' | 'failed';
  duration?: string;
  outputSummary?: string;
  details?: string;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({
  toolName,
  commandOrQuery,
  status = 'running',
  duration,
  outputSummary,
  details,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`tool-call-card is-${status}`} role="status" aria-live="polite">
      <div
        className="tool-call-header"
        onClick={() => details && setIsExpanded(!isExpanded)}
        title={details ? (isExpanded ? 'Recolher detalhes' : 'Ver detalhes da execução') : undefined}
      >
        <div className="tool-call-left">
          {/* Morphing Icon Box: ⚙ -> ✓ */}
          <div className={`tool-call-icon-box is-${status}`}>
            {status === 'running' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" strokeLinecap="round" />
              </svg>
            ) : status === 'done' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
              </svg>
            )}
          </div>

          <div className="tool-call-title-box">
            <div className="tool-call-name">
              <span>{toolName}</span>
              {commandOrQuery && (
                <code className="tool-call-param-code" title={commandOrQuery}>
                  {commandOrQuery}
                </code>
              )}
            </div>
          </div>
        </div>

        <div className="tool-call-right">
          <span className={`tool-call-status-badge is-${status}`}>
            {status === 'running'
              ? 'Executando...'
              : status === 'done'
              ? duration || 'Concluído ✓'
              : 'Falhou'}
          </span>

          {details && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                color: 'var(--text-muted)',
              }}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Rhythmic Progress Sweep while running */}
      {status === 'running' && (
        <div className="tool-call-progress-track" aria-hidden="true">
          <div className="tool-call-progress-bar" />
        </div>
      )}

      {/* Expandable details / output summary */}
      {isExpanded && (details || outputSummary) && (
        <div className="tool-call-details">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {details || outputSummary}
          </pre>
        </div>
      )}
    </div>
  );
};
