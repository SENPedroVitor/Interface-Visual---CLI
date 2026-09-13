import React from 'react';
import { ReviewSummaryProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';

export const ReviewSummary: React.FC<ReviewSummaryProps> = ({
  title = 'Revisão da Iris',
  criticalCount = 0,
  warningCount = 0,
  passedCount = 0,
  mainIssue,
  details = [],
  status,
  onAction,
}) => {
  const isApproved = status === 'approved' || (criticalCount === 0 && warningCount === 0);

  return (
    <div className="wui-card wui-animate-in">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="wui-card-title">{title}</span>
        </div>
        <span className={`wui-pill ${isApproved ? 'is-done' : 'is-failed'}`}>
          {isApproved ? '✓ Aprovado' : '⚠ Requer Ajustes'}
        </span>
      </div>

      <div className="wui-card-body">
        {/* Count Pill Badges */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <div className="wui-metric-box" style={{ flex: 1, textAlign: 'center', borderColor: criticalCount > 0 ? 'var(--wui-danger)' : undefined }}>
            <div className="wui-metric-label" style={{ color: 'var(--wui-danger)' }}>Critical</div>
            <div className="wui-metric-val" style={{ color: criticalCount > 0 ? 'var(--wui-danger)' : undefined }}>
              {criticalCount}
            </div>
          </div>
          <div className="wui-metric-box" style={{ flex: 1, textAlign: 'center', borderColor: warningCount > 0 ? 'var(--wui-warning)' : undefined }}>
            <div className="wui-metric-label" style={{ color: 'var(--wui-warning)' }}>Warning</div>
            <div className="wui-metric-val" style={{ color: warningCount > 0 ? 'var(--wui-warning)' : undefined }}>
              {warningCount}
            </div>
          </div>
          <div className="wui-metric-box" style={{ flex: 1, textAlign: 'center' }}>
            <div className="wui-metric-label" style={{ color: 'var(--wui-success)' }}>Passed</div>
            <div className="wui-metric-val" style={{ color: 'var(--wui-success)' }}>
              {passedCount}
            </div>
          </div>
        </div>

        {mainIssue && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              background: criticalCount > 0 ? 'var(--wui-danger-bg)' : 'var(--wui-warning-bg)',
              color: criticalCount > 0 ? 'var(--wui-danger)' : 'var(--wui-warning)',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠</span>
            <span>{mainIssue}</span>
          </div>
        )}

        {details.length > 0 && (
          <ul style={{ paddingLeft: '18px', margin: '10px 0 0 0', fontSize: '12.5px', color: 'var(--wui-text-muted)' }}>
            {details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="wui-card-footer">
        <ActionButton
          action="review.full"
          payload={{ title, criticalCount, warningCount, mainIssue }}
          variant="secondary"
          size="sm"
          onClick={() => onAction?.('review.full', { title, criticalCount, warningCount, mainIssue })}
        >
          Ver revisão completa
        </ActionButton>
        {criticalCount > 0 && (
          <ActionButton
            action="review.fix"
            payload={{ mainIssue }}
            variant="danger"
            size="sm"
            onClick={() => onAction?.('review.fix', { mainIssue })}
          >
            Solicitar correção
          </ActionButton>
        )}
      </div>
    </div>
  );
};
