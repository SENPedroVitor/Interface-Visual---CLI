import React, { useState } from 'react';
import { Agent } from '../types';
import { WaddleAvatar, AgentState } from './WaddleAvatar';

export interface AgentSidebarProps {
  agents: Agent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onOpenDeveloperMode: () => void;
  onKillSwitch: () => void;
  isKillSwitchActive: boolean;
  systemStatus: 'active' | 'stopped';
  agentPreviews: Record<string, string>;
}

// Agent accent colours — maps to Grok Bot xAI colour palette
const AGENT_COLORS: Record<string, string> = {
  Quinta:  '#9159FE',
  Manager: '#9159FE',
  Atlas:   '#3b82f6',
  Nero:    '#22c55e',
  Worker:  '#22c55e',
  Iris:    '#f97316',
};

function agentStateFromStatus(status: string): AgentState {
  if (status === 'working')  return 'working';
  if (status === 'waiting')  return 'thinking';
  if (status === 'stopped')  return 'stopped';
  return 'idle';
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  onOpenDeveloperMode,
  agentPreviews,
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
          <WaddleAvatar color="#18181b" size={22} showPresence={false} />
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
          const agentColor = AGENT_COLORS[agent.name] || '#9159FE';
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
                color={agentColor}
                state={avatarState}
                size={36}
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
        <button className="sidebar-footer-btn" onClick={onOpenDeveloperMode}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" strokeLinecap="round" />
          </svg>
          Plugins
        </button>

        <div className="sidebar-footer-btn" style={{ cursor: 'default' }}>
          <div className="user-avatar-placeholder">U</div>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Usuário</span>
        </div>
      </div>
    </aside>
  );
};
