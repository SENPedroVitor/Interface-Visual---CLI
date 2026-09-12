import React, { useState } from 'react';
import { Agent, ArtifactSummary, GroupSummary, RoutineSummary, Task } from '../types';
import { agentStateFromStatus, roleLabel } from '../utils/agentState';
import { agentVisual } from '../utils/agentVisuals';
import { STATE_LABELS, WaddleAvatar } from './WaddleAvatar';
import { IconPanelCompact, IconZap, IconTarget, IconDocument, IconUsers, IconGear } from './Icons';
import { ToolbarExpandable } from './ToolbarExpandable';
import './ConversationOverview.css';

interface ConversationOverviewProps {
  currentAgent: Agent | null;
  currentGroup?: GroupSummary;
  agents: Agent[];
  tasks: Task[];
  artifacts: ArtifactSummary[];
  routines: RoutineSummary[];
  onOpenRoutine: (id: string) => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
  onCustomizeAgent?: (agent: Agent) => void;
  onOpenDeveloperMode?: () => void;
}

const taskStatusLabel: Record<Task['status'], string> = {
  pending: 'Pendente',
  queued: 'Na fila',
  running: 'Rodando',
  blocked: 'Bloqueada',
  waiting_review: 'Em revisão',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};

const routineStatusLabel: Record<RoutineSummary['status'], string> = {
  active: 'Ativa',
  paused: 'Pausada',
  draft: 'Rascunho',
};

function bytesLabel(bytes?: number | null) {
  if (!bytes) return 'Arquivo';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function scopeNames(currentAgent: Agent | null, currentGroup?: GroupSummary) {
  if (currentGroup?.members.length) return currentGroup.members.map((name) => name.toLowerCase());
  return currentAgent?.name ? [currentAgent.name.toLowerCase()] : [];
}

export const ConversationOverview: React.FC<ConversationOverviewProps> = ({
  currentAgent,
  currentGroup,
  agents,
  tasks,
  artifacts,
  routines,
  onOpenRoutine,
  isCompact: propIsCompact,
  onToggleCompact: propOnToggleCompact,
  onCustomizeAgent,
  onOpenDeveloperMode,
}) => {
  const [internalCompact, setInternalCompact] = useState(() => {
    return localStorage.getItem('waddle-overview-compact') === 'true';
  });

  const isCompact = propIsCompact !== undefined ? propIsCompact : internalCompact;

  const toggleCompact = () => {
    if (propOnToggleCompact) {
      propOnToggleCompact();
    } else {
      setInternalCompact((prev) => {
        const next = !prev;
        localStorage.setItem('waddle-overview-compact', String(next));
        return next;
      });
    }
  };

  const names = scopeNames(currentAgent, currentGroup);
  const isInScope = (agentName?: string | null) => (
    names.length === 0 || names.includes((agentName || '').toLowerCase())
  );
  const overviewAgent = currentAgent || agents[0] || null;
  const visual = overviewAgent ? agentVisual(overviewAgent.name, overviewAgent.role, overviewAgent.avatar_config) : null;
  const state = agentStateFromStatus(overviewAgent?.status);
  const scopedTasks = tasks.filter((task) => isInScope(task.assigned_agent)).slice(0, 4);
  const scopedArtifacts = artifacts.filter((artifact) => isInScope(artifact.agent_name)).slice(0, 4);
  const scopedRoutines = routines.filter((routine) => isInScope(routine.agent_name)).slice(0, 4);
  const teamAgents = currentGroup?.members.length
    ? agents.filter((agent) => currentGroup.members.includes(agent.name))
    : agents.filter((agent) => agent.id === overviewAgent?.id || agent.name !== overviewAgent?.name).slice(0, 4);

  return (
    <aside
      className={`conversation-overview ${isCompact ? 'is-compact' : ''}`}
      aria-label="Visão geral da conversa"
    >
      <header className="conversation-overview__header">
        {!isCompact && (
          <div className="conversation-overview__header-text">
            <span className="conversation-overview__eyebrow">Contexto</span>
            <h2>Visão geral</h2>
          </div>
        )}
        <button
          type="button"
          className="conversation-overview__toggle-btn"
          title={isCompact ? 'Expandir visão geral' : 'Modo compacto (Recolher visão geral)'}
          aria-label={isCompact ? 'Expandir visão geral' : 'Modo compacto'}
          aria-pressed={isCompact}
          onClick={toggleCompact}
        >
          <IconPanelCompact size={18} />
        </button>
      </header>

      {overviewAgent && visual && (
        isCompact ? (
          <div
            className="conversation-overview__compact-avatar"
            title={`${overviewAgent.name} · ${STATE_LABELS[state]}`}
            onClick={toggleCompact}
          >
            <WaddleAvatar
              size={36}
              color={visual.color}
              state={state}
              marking={visual.marking}
              cosmetics={visual.cosmetics}
              imageUrl={visual.imageUrl}
              showPresence
              trackMouse
            />
          </div>
        ) : (
          <section className="conversation-overview__profile" aria-label="Perfil em foco">
            <WaddleAvatar
              size={64}
              color={visual.color}
              state={state}
              marking={visual.marking}
              cosmetics={visual.cosmetics}
              imageUrl={visual.imageUrl}
              showPresence
              trackMouse
            />
            <div className="conversation-overview__profile-copy">
              <div className="conversation-overview__profile-name-row">
                <h3>{overviewAgent.name}</h3>
                {onCustomizeAgent && (
                  <button
                    type="button"
                    className="conversation-overview__profile-gear-btn"
                    onClick={() => onCustomizeAgent(overviewAgent)}
                    title={`Configurações de ${overviewAgent.name}`}
                    aria-label={`Configurações de ${overviewAgent.name}`}
                  >
                    <IconGear size={15} />
                  </button>
                )}
              </div>
              <p>{currentGroup ? currentGroup.description || overviewAgent.description : roleLabel(overviewAgent.role)}</p>
              <span className={`conversation-overview__status conversation-overview__status--${state}`}>
                {STATE_LABELS[state]}
              </span>
            </div>
          </section>
        )
      )}

      {!isCompact && (
        <div style={{ margin: '4px 0 8px' }}>
          <ToolbarExpandable
            currentAgent={overviewAgent}
            tasks={tasks}
            artifacts={artifacts}
            routines={routines}
            onEditAgent={() => overviewAgent && onCustomizeAgent?.(overviewAgent)}
            onOpenRoutine={onOpenRoutine}
            onOpenDeveloperMode={onOpenDeveloperMode}
          />
        </div>
      )}

      {isCompact ? (
        <div className="conversation-overview__compact-rail">
          <button
            type="button"
            className="conversation-overview__compact-btn"
            title={`Rotinas (${scopedRoutines.length})`}
            onClick={() => {
              if (scopedRoutines.length === 1) {
                onOpenRoutine(scopedRoutines[0].id);
              } else {
                toggleCompact();
              }
            }}
          >
            <IconZap size={17} />
            {scopedRoutines.length > 0 && (
              <span className="conversation-overview__compact-badge">{scopedRoutines.length}</span>
            )}
          </button>

          <button
            type="button"
            className="conversation-overview__compact-btn"
            title={`Tarefas (${scopedTasks.length})`}
            onClick={toggleCompact}
          >
            <IconTarget size={17} />
            {scopedTasks.length > 0 && (
              <span className="conversation-overview__compact-badge">{scopedTasks.length}</span>
            )}
          </button>

          <button
            type="button"
            className="conversation-overview__compact-btn"
            title={`Arquivos (${scopedArtifacts.length})`}
            onClick={toggleCompact}
          >
            <IconDocument size={17} />
            {scopedArtifacts.length > 0 && (
              <span className="conversation-overview__compact-badge">{scopedArtifacts.length}</span>
            )}
          </button>

          <button
            type="button"
            className="conversation-overview__compact-btn"
            title={`Equipe (${teamAgents.length})`}
            onClick={toggleCompact}
          >
            <IconUsers size={17} />
            {teamAgents.length > 0 && (
              <span className="conversation-overview__compact-badge">{teamAgents.length}</span>
            )}
          </button>
        </div>
      ) : (
        <>
          <section className="conversation-overview__section" aria-labelledby="overview-routines">
            <div className="conversation-overview__section-head">
              <h3 id="overview-routines">Rotinas</h3>
              <span>{scopedRoutines.length}</span>
            </div>
            <div className="conversation-overview__stack">
              {scopedRoutines.length ? scopedRoutines.map((routine) => (
                <button
                  className="conversation-overview__row conversation-overview__row--button"
                  key={routine.id}
                  onClick={() => onOpenRoutine(routine.id)}
                >
                  <span>{routine.name}</span>
                  <small>{routineStatusLabel[routine.status]} · {routine.schedule}</small>
                </button>
              )) : <p className="conversation-overview__empty">Nenhuma rotina nesse contexto.</p>}
            </div>
          </section>

          <section className="conversation-overview__section" aria-labelledby="overview-tasks">
            <div className="conversation-overview__section-head">
              <h3 id="overview-tasks">Tarefas</h3>
              <span>{scopedTasks.length}</span>
            </div>
            <div className="conversation-overview__stack">
              {scopedTasks.length ? scopedTasks.map((task) => (
                <div className="conversation-overview__row" key={task.id}>
                  <span>{task.title}</span>
                  <small>{taskStatusLabel[task.status]} · {task.priority}</small>
                </div>
              )) : <p className="conversation-overview__empty">Sem tarefas recentes.</p>}
            </div>
          </section>

          <section className="conversation-overview__section" aria-labelledby="overview-artifacts">
            <div className="conversation-overview__section-head">
              <h3 id="overview-artifacts">Arquivos</h3>
              <span>{scopedArtifacts.length}</span>
            </div>
            <div className="conversation-overview__stack">
              {scopedArtifacts.length ? scopedArtifacts.map((artifact) => (
                <div className="conversation-overview__row" key={artifact.id}>
                  <span>{artifact.filename || artifact.title}</span>
                  <small>{artifact.agent_name} · {bytesLabel(artifact.bytes)}</small>
                </div>
              )) : <p className="conversation-overview__empty">Nenhum arquivo gerado ainda.</p>}
            </div>
          </section>

          <section className="conversation-overview__section" aria-labelledby="overview-team">
            <div className="conversation-overview__section-head">
              <h3 id="overview-team">Equipe</h3>
              <span>{teamAgents.length}</span>
            </div>
            <div className="conversation-overview__team">
              {teamAgents.map((agent) => {
                const agentState = agentStateFromStatus(agent.status);
                const teamVisual = agentVisual(agent.name, agent.role, agent.avatar_config);
                return (
                  <div className="conversation-overview__team-row" key={agent.id}>
                    <WaddleAvatar
                      size={28}
                      color={teamVisual.color}
                      state={agentState}
                      marking={teamVisual.marking}
                      cosmetics={teamVisual.cosmetics}
                      imageUrl={teamVisual.imageUrl}
                    />
                    <span>{agent.name}</span>
                    <small>{STATE_LABELS[agentState]}</small>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </aside>
  );
};

export default ConversationOverview;
