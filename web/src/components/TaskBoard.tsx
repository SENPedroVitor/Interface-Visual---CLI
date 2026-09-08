import React from 'react';
import { Task } from '../types';

interface TaskBoardProps {
  tasks: Task[];
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks }) => {
  return (
    <div className="panel-card">
      <div className="panel-title">
        <span>Fila & Pipeline de Tarefas</span>
        <span style={{ fontSize: '12px', color: 'var(--cyan-accent)', fontFamily: 'var(--font-mono)' }}>
          {tasks.length} TAREFAS
        </span>
      </div>

      <div className="tasks-container">
        {tasks.length === 0 ? (
          <div className="empty-placeholder">
            Nenhuma tarefa em execução. Submeta um objetivo acima para iniciar o workflow multiagente.
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className={`task-item ${task.status}`}>
              <div className="task-header">
                <div className="task-title">
                  {task.status === 'running' && <span className="animate-spin" style={{ display: 'inline-block', marginRight: '6px' }}>⏳</span>}
                  {task.status === 'completed' && <span style={{ marginRight: '6px' }}>✅</span>}
                  {task.status === 'blocked' && <span style={{ marginRight: '6px' }}>🔒</span>}
                  {task.status === 'failed' && <span style={{ marginRight: '6px' }}>❌</span>}
                  {task.status === 'cancelled' && <span style={{ marginRight: '6px' }}>⛔</span>}
                  <span>{task.title}</span>
                </div>
                <span className={`status-badge ${task.status}`}>{task.status}</span>
              </div>

              <div className="task-meta">
                <span>Agente: <span className="task-agent">{task.assigned_agent || 'Não atribuído'}</span></span>
                <span>• Prioridade: {task.priority}</span>
                {task.dependencies && task.dependencies.length > 0 && (
                  <span>• Bloqueado por: {task.dependencies.join(', ')}</span>
                )}
              </div>

              {task.output_data && (
                <div className="task-output-box">
                  <strong>Resultado:</strong>
                  <div>
                    {typeof task.output_data === 'object'
                      ? JSON.stringify(task.output_data, null, 2)
                      : String(task.output_data)}
                  </div>
                </div>
              )}

              {task.error && (
                <div className="task-output-box" style={{ borderColor: 'var(--danger)', color: '#fca5a5' }}>
                  <strong>Erro:</strong> {task.error}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
