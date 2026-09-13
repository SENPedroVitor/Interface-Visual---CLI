import React from 'react';
import { RiskCardProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';

export const RiskCard: React.FC<RiskCardProps> = ({
  title,
  severity = 'medium',
  description,
  impactArea,
  mitigation,
  onAction,
}) => {
  return (
    <div className={`wui-card wui-approval-card is-${severity} wui-animate-in`}>
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="wui-card-title">{title}</span>
        </div>
        <span
          className={`wui-pill ${
            severity === 'critical' || severity === 'high' ? 'is-failed' : 'is-warning'
          }`}
        >
          {severity.toUpperCase()}
        </span>
      </div>

      <div className="wui-card-body">
        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.45 }}>{description}</p>

        {impactArea && (
          <div style={{ fontSize: '12px', color: 'var(--wui-text-muted)', marginTop: '8px' }}>
            <strong>Área de impacto:</strong> <code>{impactArea}</code>
          </div>
        )}

        {mitigation && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--wui-text)',
              background: 'var(--wui-surface)',
              padding: '8px 10px',
              borderRadius: '6px',
              marginTop: '8px',
              border: '1px solid var(--wui-border)',
            }}
          >
            <strong>Mitigação sugerida:</strong> {mitigation}
          </div>
        )}
      </div>

      <div className="wui-card-footer">
        <ActionButton
          action="review.fix"
          payload={{ title, severity }}
          variant="secondary"
          size="sm"
          onClick={() => onAction?.('review.fix', { title, severity })}
        >
          Tratar Risco
        </ActionButton>
      </div>
    </div>
  );
};
