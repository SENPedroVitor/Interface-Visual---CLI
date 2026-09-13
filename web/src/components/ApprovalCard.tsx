import React, { useState } from 'react';
import './ApprovalCard.css';

export interface ApprovalCardProps {
  id: string;
  agentName: string;
  actionTitle: string;
  targetPathOrCommand?: string;
  initialStatus?: 'pending' | 'approved' | 'rejected';
  onApprove?: () => void;
  onReject?: () => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  agentName,
  actionTitle,
  targetPathOrCommand,
  initialStatus = 'pending',
  onApprove,
  onReject,
}) => {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>(initialStatus);

  const handleAllow = () => {
    setStatus('approved');
    onApprove?.();
  };

  const handleDeny = () => {
    setStatus('rejected');
    onReject?.();
  };

  return (
    <div className={`approval-card is-${status}`} role="alertdialog" aria-label={`Aprovação solicitada por ${agentName}`}>
      <div className="approval-header">
        <div className="approval-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Autorização Necessária</span>
        </div>
      </div>

      <div className="approval-body">
        <div className="approval-agent-line">
          <strong>{agentName}</strong> deseja executar uma ação no sistema:
        </div>
        <div className="approval-action-title">{actionTitle}</div>
        {targetPathOrCommand && (
          <code className="approval-command-chip">{targetPathOrCommand}</code>
        )}
      </div>

      <div className="approval-actions">
        {status === 'pending' ? (
          <>
            <button type="button" className="btn-approval-deny" onClick={handleDeny}>
              Negar
            </button>
            <button type="button" className="btn-approval-allow" onClick={handleAllow}>
              Permitir
            </button>
          </>
        ) : status === 'approved' ? (
          <div className="approval-resolved-banner is-approved">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Ação aprovada e liberada para o agente</span>
          </div>
        ) : (
          <div className="approval-resolved-banner is-rejected">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" strokeLinecap="round" />
              <line x1="9" y1="9" x2="15" y2="15" strokeLinecap="round" />
            </svg>
            <span>Ação rejeitada pelo usuário</span>
          </div>
        )}
      </div>
    </div>
  );
};
