import React from 'react';
import { Agent } from '../types';
import { IconBrain, IconZap, IconGear } from './Icons';

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
                <div className="agent-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {agent.name === 'Manager' ? <IconBrain size={15} /> : <IconZap size={15} />}
                  </span>
                  <span>{agent.name}</span>
                  <span className="agent-role-badge">{agent.role}</span>
                </div>
                <span className={`status-badge ${agent.status}`}>
                  {agent.status}
                </span>
              </div>

              <div className="agent-desc">{agent.description}</div>

              {agent.current_task_id && (
                <div className="agent-active-task" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <IconGear size={13} /> Tarefa:
                  </span>
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
