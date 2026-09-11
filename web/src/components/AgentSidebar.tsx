import React, { useState } from 'react';
import { Agent, Task, GroupSummary } from '../types';
import { WaddleAvatar, STATE_LABELS } from './WaddleAvatar';
import { agentStateFromStatus, activityTime, roleLabel } from '../utils/agentState';
import { agentVisual } from '../utils/agentVisuals';
import { VectorIcon, IconPlug } from './Icons';
import { UserProfile } from './UserConfigModal';
import { UserAvatar } from './UserAvatar';

export interface AgentSidebarProps {
  agents: Agent[];
  groups?: GroupSummary[];
  tasks: Task[];
  selectedAgentId: string;
  selectedGroupId?: string;
  onSelectAgent: (id: string) => void;
  onSelectGroup?: (id: string) => void;
  onOpenDeveloperMode: () => void;
  onOpenPlugins: () => void;
  onKillSwitch: () => void;
  isKillSwitchActive: boolean;
  systemStatus: 'active' | 'stopped';
  agentPreviews: Record<string, string>;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  onOpenActionMenu: (rect: DOMRect) => void;
  userProfile?: UserProfile;
  onOpenUserConfig?: () => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agents,
  groups = [],
  tasks,
  selectedAgentId,
  selectedGroupId,
  onSelectAgent,
  onSelectGroup,
  onOpenDeveloperMode,
  onOpenPlugins,
  agentPreviews,
  isDarkTheme,
  onToggleTheme,
  onOpenActionMenu,
  userProfile,
  onOpenUserConfig,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = agents.filter(
    (a) =>
      !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      roleLabel(a.role).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const previewFor = (agent: Agent, avatarState: ReturnType<typeof agentStateFromStatus>) => {
    const activeTask = tasks.find(task =>
      task.assigned_agent === agent.name && ['running', 'pending', 'blocked'].includes(task.status)
    );

    if (activeTask?.status === 'running') return `Agora: ${activeTask.title}`;
    if (activeTask?.status === 'pending') return `Na fila: ${activeTask.title}`;
    if (activeTask?.status === 'blocked') return `Aguardando: ${activeTask.title}`;
    if (agent.status !== 'idle') return STATE_LABELS[avatarState];
    return agentPreviews[agent.id] || roleLabel(agent.role);
  };

  return (
    <aside className="sidebar">
      {/* Brand logo + New button */}
      <div className="sidebar-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WaddleAvatar color="#18181b" size={22} showPresence={false} plain />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Waddle</span>
        </div>
        <button
          className="btn-new-agent"
          title="Menu de Criação (+)"
          onClick={(e) => onOpenActionMenu(e.currentTarget.getBoundingClientRect())}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            className="search-input"
            placeholder="Buscar agentes"
            aria-label="Buscar agentes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Squads & Equipes Section (Permanent + Custom) */}
      <div className="sidebar-section-squads" style={{ padding: '4px 12px 8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Squads & Canais
          </span>
          <button
            type="button"
            className="sidebar-new-squad-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenActionMenu?.(e.currentTarget.getBoundingClientRect());
            }}
            title="Criar novo squad ou grupo"
          >
            +
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Permanent Team Channel: Inter-Bots Discussion */}
          <button
            className={`agent-list-item ${selectedGroupId === 'team-squad' ? 'active' : ''}`}
            onClick={() => onSelectGroup?.('team-squad')}
            style={{ padding: '8px 10px' }}
            title="Equipe Waddle — Canal coletivo com todos os bots"
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', flexShrink: 0 }}>
              <VectorIcon name="users" size={18} />
            </div>
            <div className="agent-list-info">
              <div className="agent-list-row1">
                <span className="agent-list-name" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Equipe Waddle</span>
                <span style={{ fontSize: '0.68rem', color: '#a855f7', fontWeight: 600 }}>Inter-Bots</span>
              </div>
              <div className="agent-list-row2">
                <span className="agent-list-preview" style={{ fontSize: '0.72rem' }}>
                  Canal coletivo da equipe
                </span>
              </div>
            </div>
          </button>

          {/* User-created custom squads */}
          {groups.filter(g => g.id !== 'team-squad').map((group) => {
            const isGroupActive = selectedGroupId === group.id;
            return (
              <button
                key={group.id}
                className={`agent-list-item ${isGroupActive ? 'active' : ''}`}
                onClick={() => onSelectGroup?.(group.id)}
                style={{ padding: '8px 10px' }}
                title={`${group.name} (${group.members.join(', ')})`}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', flexShrink: 0 }}>
                  <VectorIcon name={group.avatar_icon || 'users'} size={18} />
                </div>
                <div className="agent-list-info">
                  <div className="agent-list-row1">
                    <span className="agent-list-name" style={{ fontSize: '0.85rem' }}>{group.name}</span>
                    <span style={{ fontSize: '0.68rem', color: '#a855f7', fontWeight: 600 }}>{group.members.length} bots</span>
                  </div>
                  <div className="agent-list-row2">
                    <span className="agent-list-preview" style={{ fontSize: '0.72rem' }}>
                      {group.description || group.members.join(', ')}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent list */}
      <nav className="sidebar-agents">
        {filtered.map((agent) => {
          const isActive = selectedAgentId === agent.id && !selectedGroupId;
          const visual = agentVisual(agent.name, agent.role, agent);
          const avatarState = agentStateFromStatus(agent.status);
          const preview = previewFor(agent, avatarState);

          return (
            <button
              key={agent.id}
              className={`agent-list-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectAgent(agent.id)}
              aria-current={isActive ? 'page' : undefined}
              title={`${agent.name} · ${STATE_LABELS[avatarState]}`}
            >
              <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                <WaddleAvatar
                  color={visual.color}
                  state={avatarState}
                  size={36}
                  marking={visual.marking}
                  cosmetics={visual.cosmetics}
                  imageUrl={visual.imageUrl}
                  clickAnim={visual.clickAnim}
                  trackMouse
                  interactive
                />
              </div>

              <div className="agent-list-info">
                <div className="agent-list-row1">
                  <span className="agent-list-name">{agent.name}</span>
                </div>
                <div className="agent-list-row2">
                  <span className="agent-list-preview">{preview}</span>
                  <span className="agent-list-time">
                    {['working', 'thinking', 'waiting'].includes(agent.status) ? 'Agora' : activityTime(agent.last_activity_at)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          className={`sidebar-footer-btn theme-toggle-btn ${isDarkTheme ? 'is-dark' : ''}`}
          onClick={onToggleTheme}
          title={isDarkTheme ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          <span className="theme-toggle-icon">
            <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" strokeLinecap="round" />
            </svg>
            <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20.5 14.2A8.5 8.5 0 019.8 3.5a8.5 8.5 0 1010.7 10.7z" strokeLinejoin="round" />
            </svg>
          </span>
          {isDarkTheme ? 'Modo escuro' : 'Modo claro'}
        </button>

        <button className="sidebar-footer-btn" onClick={onOpenPlugins}>
          <IconPlug size={16} />
          Plugins
        </button>

        <button className="sidebar-footer-btn" onClick={onOpenDeveloperMode}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" strokeLinecap="round" />
          </svg>
          Desenvolvedor
        </button>

        <button
          type="button"
          className="sidebar-footer-btn sidebar-user-btn"
          onClick={onOpenUserConfig}
          title="Configurar Perfil de Usuário"
          style={{ cursor: 'pointer', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <UserAvatar
            size={24}
            name={userProfile?.name}
            color={userProfile?.avatarColor || '#6366f1'}
            imageUrl={userProfile?.avatarImage}
          />
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
            {userProfile?.name || 'Meu Perfil'}
          </span>
        </button>
      </div>
    </aside>
  );
};
