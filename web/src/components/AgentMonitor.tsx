import React from 'react';
import { Agent } from '../types';

interface AgentMonitorProps {
  agents: Agent[];
}

export const AgentMonitor: React.FC<AgentMonitorProps> = ({ agents }) => {
  return (
    <div className="panel-card">
      <div className="panel-title">
        <span>Agentes Ativos</span>
        <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
          {agents.length} REGISTRADOS
        </span>
      </div>

      <div className="agents-list">
        {agents.length === 0 ? (
          <div className="empty-placeholder">Nenhum agente registrado no momento.</div>
        ) : (
          agents.map((agent) => (
            <div key={agent.id} className="agent-card">
              <div className="agent-header">
                <div className="agent-name">
                  <span>{agent.name === 'Manager' ? '🧠' : '⚡'}</span>
                  <span>{agent.name}</span>
                  <span className="agent-role-badge">{agent.role}</span>
                </div>
                <span className={`status-badge ${agent.status}`}>
                  {agent.status}
                </span>
              </div>

              <div className="agent-desc">{agent.description}</div>

              {agent.current_task_id && (
                <div className="agent-active-task">
                  <span>⚙️ Tarefa:</span>
                  <span>{agent.current_task_id}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
