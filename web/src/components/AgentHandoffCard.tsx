import React from 'react';
import { WaddleAvatar } from './WaddleAvatar';
import { agentVisual } from '../utils/agentVisuals';
import { roleLabel } from '../utils/agentState';
import './AgentHandoffCard.css';

export interface AgentHandoffCardProps {
  fromAgent: string;
  toAgent: string;
  taskTitle: string;
  taskStatus?: 'delegating' | 'working' | 'done' | string;
  summary?: string;
  timestamp?: string;
}

export const AgentHandoffCard: React.FC<AgentHandoffCardProps> = ({
  fromAgent,
  toAgent,
  taskTitle,
  taskStatus = 'working',
  summary,
  timestamp,
}) => {
  const fromVis = agentVisual(fromAgent);
  const toVis = agentVisual(toAgent);
  const isDone = taskStatus === 'done' || taskStatus === 'completed';

  return (
    <div className="agent-handoff-card" role="region" aria-label={`Delegação de ${fromAgent} para ${toAgent}`}>
      {/* Card Header with Badges */}
      <div className="handoff-header">
        <div className="handoff-label-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Handoff de Tarefa</span>
        </div>

        <div className={`handoff-status-pill ${isDone ? 'is-done' : 'is-working'}`}>
          <span className="handoff-status-dot" />
          <span>{isDone ? 'Síntese concluída ✓' : 'Especialista em execução'}</span>
          {timestamp && <span style={{ opacity: 0.65, marginLeft: 4 }}>· {timestamp}</span>}
        </div>
      </div>

      {/* Visual Connected Nodes Flow with Animated Beam */}
      <div className="handoff-flow-row">
        {/* Source Node (Coordinator) */}
        <div className="handoff-node">
          <WaddleAvatar
            color={fromVis.color}
            state="idle"
            size={30}
            marking={fromVis.marking}
            cosmetics={fromVis.cosmetics}
            imageUrl={fromVis.imageUrl}
            plain
          />
          <div className="handoff-node-info">
            <div className="handoff-node-name">{fromAgent}</div>
            <div className="handoff-node-role">Coordenação</div>
          </div>
        </div>

        {/* Animated Transmission Beam */}
        <div className="handoff-beam" aria-hidden="true">
          <div className="handoff-beam-track">
            <div className="handoff-beam-pulse" />
          </div>
          <div className="handoff-beam-arrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Target Node (Specialist) */}
        <div className="handoff-node">
          <WaddleAvatar
            color={toVis.color}
            state={isDone ? 'done' : 'working'}
            size={30}
            marking={toVis.marking}
            cosmetics={toVis.cosmetics}
            imageUrl={toVis.imageUrl}
            plain
          />
          <div className="handoff-node-info">
            <div className="handoff-node-name">{toAgent}</div>
            <div className="handoff-node-role">{roleLabel(toAgent)}</div>
          </div>
        </div>
      </div>

      {/* Task Description */}
      <div className="handoff-task-box">
        <div className="handoff-task-title">{taskTitle}</div>
        {summary && <div className="handoff-task-summary">{summary}</div>}
      </div>
    </div>
  );
};
