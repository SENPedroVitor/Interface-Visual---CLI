import React from 'react';
import { TaskPlanProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';
import { StatusPill } from '../common/StatusPill.tsx';

export const TaskPlan: React.FC<TaskPlanProps> = ({
  title = 'Plano de Execução',
  tasks = [],
  progress,
  showActions = true,
  onAction,
}) => {
  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const totalCount = tasks.length;
  const computedProgress = progress !== undefined ? progress : totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="wui-card wui-animate-in">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="wui-card-title">{title}</span>
        </div>
        <span className="wui-card-subtitle">
          {completedCount} / {totalCount} concluídas
        </span>
      </div>

      <div className="wui-card-body">
        {/* Progress Bar */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '6px' }}>
            <span style={{ color: 'var(--wui-text-muted)' }}>Progresso da Equipe</span>
            <span style={{ fontWeight: 600 }}>{computedProgress}%</span>
          </div>
          <div className="wui-progress-track">
            <div className="wui-progress-fill" style={{ width: `${computedProgress}%` }} />
          </div>
        </div>

        {/* Task Items */}
        <div className="wui-task-list">
          {tasks.map((task, idx) => (
            <div key={task.id || idx} className="wui-task-item">
              <div className="wui-task-left">
                <span className="wui-task-agent-badge">{task.agent}</span>
                <span className="wui-task-desc">{task.action}</span>
              </div>
              <StatusPill status={task.status} />
            </div>
          ))}
        </div>
      </div>

      {showActions && (
        <div className="wui-card-footer">
          <ActionButton
            action="task.cancel"
            payload={{ planTitle: title }}
            variant="danger"
            size="sm"
            onClick={() => onAction?.('task.cancel', { planTitle: title })}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            action="task.details"
            payload={{ planTitle: title }}
            variant="secondary"
            size="sm"
            onClick={() => onAction?.('task.details', { planTitle: title })}
          >
            Ver detalhes
          </ActionButton>
        </div>
      )}
    </div>
  );
};
