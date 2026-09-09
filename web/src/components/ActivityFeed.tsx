import React from 'react';
import { WaddleEvent } from '../types';

interface ActivityFeedProps {
  events: WaddleEvent[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events }) => {
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getEventDescription = (event: WaddleEvent) => {
    const data = event.data || {};

    if (event.type === 'agent.message') {
      const msg = data.message || {};
      return `${msg.from} -> ${msg.to} [${msg.type}]: "${msg.content}"`;
    }
    if (event.type === 'task.created') {
      return `Nova tarefa criada: "${data.task?.title || data.task_id}"`;
    }
    if (event.type === 'task.running') {
      return `Execução iniciada: "${data.task?.title || data.task_id}"`;
    }
    if (event.type === 'task.completed') {
      return `Tarefa concluída com sucesso: "${data.task?.title || data.task_id}"`;
    }
    if (event.type === 'tool.started') {
      return `Tool chamada [${data.tool_name}] pelo agente ${data.agent_id}`;
    }
    if (event.type === 'tool.completed') {
      return `Tool [${data.tool_name}] finalizada em ${data.duration_ms}ms`;
    }
    if (event.type === 'system.kill_switch') {
      return `[KILL SWITCH]: Todas as tarefas foram interrompidas (${data.reason})`;
    }
    if (event.type === 'run.started') {
      return `Novo objetivo iniciado: "${data.objective}"`;
    }

    return JSON.stringify(data);
  };

  return (
    <div className="panel-card activity-column">
      <div className="panel-title">
        <span>Live Activity Feed</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>STREAM VIA WEBSOCKET</span>
      </div>

      <div className="activity-feed">
        {events.length === 0 ? (
          <div className="empty-placeholder">Nenhum evento registrado ainda.</div>
        ) : (
          events.map((event, index) => {
            const cssClass = event.type.replace('.', '-');
            return (
              <div key={event.id || index} className={`activity-item ${cssClass} animate-fade-in`}>
                <div className="activity-meta">
                  <span className="activity-type-tag">{event.type}</span>
                  <span>{formatTime(event.timestamp)}</span>
                </div>
                <div className="activity-body">{getEventDescription(event)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
