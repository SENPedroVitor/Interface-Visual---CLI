import React, { useState } from 'react';
import { Agent } from '../types';
import { WaddleAvatar } from './WaddleAvatar';
import { agentStateFromStatus } from '../utils/agentState';
import { agentVisual } from '../utils/agentVisuals';

export interface AgentSidebarProps {
  agents: Agent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onOpenDeveloperMode: () => void;
  onKillSwitch: () => void;
  isKillSwitchActive: boolean;
  systemStatus: 'active' | 'stopped';
  agentPreviews: Record<string, string>;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  onOpenDeveloperMode,
  agentPreviews,
  isDarkTheme,
  onToggleTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = agents.filter(
    (a) =>
      !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="sidebar">
      {/* Brand logo + New button */}
      <div className="sidebar-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WaddleAvatar color="#18181b" size={22} showPresence={false} plain />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Waddle</span>
        </div>
        <button className="btn-new-agent" title="Novo agente">
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
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Agent list */}
      <nav className="sidebar-agents">
        {filtered.map((agent) => {
          const isActive = selectedAgentId === agent.id;
          const visual = agentVisual(agent.name);
          const avatarState = agentStateFromStatus(agent.status);
          const preview = agentPreviews[agent.id] ||
            (agent.status === 'working' ? 'Trabalhando...' :
             agent.status === 'waiting' ? 'Aguardando...' : 'Disponível');

          return (
            <button
              key={agent.id}
              className={`agent-list-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectAgent(agent.id)}
            >
              {/* Minimalist circular penguin avatar with motion states */}
              <WaddleAvatar
                color={visual.color}
                state={avatarState}
                size={36}
                marking={visual.marking}
                clickAnim={visual.clickAnim}
                trackMouse
                interactive
              />

              <div className="agent-list-info">
                <div className="agent-list-row1">
                  <span className="agent-list-name">{agent.name}</span>
                  <span className="agent-list-time">
                    {agent.status === 'working' ? 'Agora' : 'Ontem'}
                  </span>
                </div>
                <div className="agent-list-preview">{preview}</div>
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

        <button className="sidebar-footer-btn" onClick={onOpenDeveloperMode}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" strokeLinecap="round" />
          </svg>
          Desenvolvedor
        </button>

        <div className="sidebar-footer-btn" style={{ cursor: 'default' }}>
          <div className="user-avatar-placeholder">U</div>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Usuário</span>
        </div>
      </div>
    </aside>
  );
};
