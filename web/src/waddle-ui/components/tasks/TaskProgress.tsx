import React from 'react';
import { TaskProgressProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';
import { StatusPill } from '../common/StatusPill.tsx';

export const TaskProgress: React.FC<TaskProgressProps> = ({
  title,
  currentStep,
  progress = 0,
  totalSteps,
  currentStepIndex,
  status = 'running',
  estimatedTimeRemaining,
  onAction,
}) => {
  const normalizedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="wui-card wui-animate-in">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" strokeLinecap="round" />
          </svg>
          <span className="wui-card-title">{title}</span>
        </div>
        <StatusPill status={status === 'completed' ? 'done' : status === 'paused' ? 'warning' : status} />
      </div>

      <div className="wui-card-body">
        {currentStep && (
          <div style={{ marginBottom: '10px', fontSize: '13px', color: 'var(--wui-text)' }}>
            <strong>Etapa atual:</strong> {currentStep}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
          <span style={{ color: 'var(--wui-text-muted)' }}>
            {currentStepIndex && totalSteps ? `Passo ${currentStepIndex} de ${totalSteps}` : 'Progresso'}
          </span>
          <span style={{ fontWeight: 700, color: 'var(--wui-text)' }}>{normalizedProgress}%</span>
        </div>

        <div className="wui-progress-track" style={{ height: '8px' }}>
          <div
            className="wui-progress-fill"
            style={{
              width: `${normalizedProgress}%`,
              background: status === 'failed' ? 'var(--wui-danger)' : undefined,
            }}
          />
        </div>

        {estimatedTimeRemaining && (
          <div style={{ fontSize: '11.5px', color: 'var(--wui-text-muted)', marginTop: '8px', textAlign: 'right' }}>
            Tempo estimado: {estimatedTimeRemaining}
          </div>
        )}
      </div>

      <div className="wui-card-footer">
        {status === 'running' && (
          <ActionButton
            action="task.cancel"
            payload={{ title }}
            variant="danger"
            size="sm"
            onClick={() => onAction?.('task.cancel', { title })}
          >
            Cancelar
          </ActionButton>
        )}
        <ActionButton
          action="task.details"
          payload={{ title }}
          variant="secondary"
          size="sm"
          onClick={() => onAction?.('task.details', { title })}
        >
          Ver tarefas
        </ActionButton>
      </div>
    </div>
  );
};
