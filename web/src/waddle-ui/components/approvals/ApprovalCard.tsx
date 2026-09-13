import React, { useState } from 'react';
import { ApprovalCardProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  agent = 'Agente',
  action = '',
  risk = 'medium',
  reason,
  target,
  initialStatus = 'pending',
  onAction,
}) => {
  const [resolvedStatus, setResolvedStatus] = useState<'pending' | 'approved' | 'rejected'>(initialStatus);
  const [allowMode, setAllowMode] = useState<'once' | 'always' | null>(null);

  const handleDeny = () => {
    setResolvedStatus('rejected');
    onAction?.('approval.deny', { agent, action, risk, approved: false });
  };

  const handleAllowOnce = () => {
    setResolvedStatus('approved');
    setAllowMode('once');
    onAction?.('approval.allow_once', { agent, action, risk, approved: true, scope: 'once' });
  };

  const handleAllowAlways = () => {
    setResolvedStatus('approved');
    setAllowMode('always');
    onAction?.('approval.allow_always', { agent, action, risk, approved: true, scope: 'always' });
  };

  return (
    <div className={`wui-card wui-approval-card is-${risk} wui-animate-in`} role="alertdialog">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="wui-card-title">Autorização de Execução</span>
        </div>
        <span
          className={`wui-pill ${
            risk === 'critical' || risk === 'high' ? 'is-failed' : 'is-warning'
          }`}
        >
          Risco: {risk.toUpperCase()}
        </span>
      </div>

      <div className="wui-card-body">
        <div style={{ marginBottom: '8px', fontSize: '13px' }}>
          <strong>{agent}</strong> deseja executar a seguinte operação:
        </div>

        <code className="wui-code-chip">{target || action}</code>

        {reason && (
          <div style={{ fontSize: '12px', color: 'var(--wui-text-muted)', marginTop: '6px' }}>
            <strong>Justificativa:</strong> {reason}
          </div>
        )}

        {resolvedStatus !== 'pending' && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              background: resolvedStatus === 'approved' ? 'var(--wui-success-bg)' : 'var(--wui-danger-bg)',
              color: resolvedStatus === 'approved' ? 'var(--wui-success)' : 'var(--wui-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {resolvedStatus === 'approved' ? (
              <>
                <span>✓</span>
                <span>
                  Permitido ({allowMode === 'always' ? 'Sempre permitir' : 'Uma vez'}). Execução liberada.
                </span>
              </>
            ) : (
              <>
                <span>✕</span>
                <span>Ação bloqueada e negada pelo usuário.</span>
              </>
            )}
          </div>
        )}
      </div>

      {resolvedStatus === 'pending' && (
        <div className="wui-card-footer">
          <ActionButton
            action="approval.deny"
            payload={{ agent, action, approved: false }}
            variant="danger"
            size="sm"
            onClick={handleDeny}
          >
            Negar
          </ActionButton>
          <ActionButton
            action="approval.allow_once"
            payload={{ agent, action, approved: true, scope: 'once' }}
            variant="secondary"
            size="sm"
            onClick={handleAllowOnce}
          >
            Permitir uma vez
          </ActionButton>
          <ActionButton
            action="approval.allow_always"
            payload={{ agent, action, approved: true, scope: 'always' }}
            variant="success"
            size="sm"
            onClick={handleAllowAlways}
          >
            Sempre permitir
          </ActionButton>
        </div>
      )}
    </div>
  );
};
