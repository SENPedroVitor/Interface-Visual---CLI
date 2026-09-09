import React, { useState } from 'react';
import { ProviderInfo, Task, ToolInfo, WaddleEvent } from '../types';

interface DeveloperDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  tools: ToolInfo[];
  providers: ProviderInfo[];
  events: WaddleEvent[];
  onKillSwitch?: () => void;
}

type Tab = 'tasks' | 'tools' | 'providers' | 'events';

export const DeveloperDrawer: React.FC<DeveloperDrawerProps> = ({
  isOpen,
  onClose,
  tasks,
  tools,
  providers,
  events,
  onKillSwitch,
}) => {
  const [tab, setTab] = useState<Tab>('tasks');

  if (!isOpen) return null;

  return (
    <>
      <div className="dev-drawer-overlay" onClick={onClose} />
      <aside className="dev-drawer">
        <div className="dev-drawer-header">
          <span className="dev-drawer-title">Developer Mode</span>
          <button className="btn-dev-close" onClick={onClose} title="Fechar">✕</button>
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['tasks', 'tools', 'providers', 'events'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '10px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--gray-900)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.12s',
                textTransform: 'capitalize',
              }}
            >
              {t === 'tasks' ? 'Tarefas' : t === 'tools' ? 'Ferramentas' : t === 'providers' ? 'Motores' : 'Eventos'}
            </button>
          ))}
        </div>

        <div className="dev-drawer-content">
          {/* Tasks */}
          {tab === 'tasks' && (
            <div>
              <div className="dev-section-title">Tarefas em Execução</div>
              {tasks.length === 0 ? (
                <div className="dev-empty">Nenhuma tarefa no momento.</div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="dev-task-row">
                    <span className={`dev-task-status ${task.status}`}>{task.status}</span>
                    <span className="dev-task-title">{task.title}</span>
                    {task.assigned_agent && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{task.assigned_agent}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tools */}
          {tab === 'tools' && (
            <div>
              <div className="dev-section-title">Ferramentas Registradas</div>
              {tools.length === 0 ? (
                <div className="dev-empty">Nenhuma ferramenta registrada.</div>
              ) : (
                tools.map((tool) => (
                  <div key={tool.name} className="dev-tool-row">
                    <span className="dev-tool-name">{tool.name}</span>
                    <span className={`dev-tool-risk ${tool.risk_level}`}>{tool.risk_level}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Providers */}
          {tab === 'providers' && (
            <div>
              <div className="dev-section-title">Motores conectáveis</div>
              {providers.length === 0 ? (
                <div className="dev-empty">Nenhum motor detectado.</div>
              ) : (
                providers.map((provider) => (
                  <div key={provider.id} className="dev-provider-row">
                    <div>
                      <span className="dev-tool-name">{provider.name}</span>
                      <div className="dev-event-data">{provider.detail}</div>
                      {provider.path && <div className="dev-event-data">{provider.path}</div>}
                    </div>
                    <span className={`dev-provider-status ${provider.available ? 'available' : provider.installed ? 'installed' : 'missing'}`}>
                      {provider.available ? 'pronto' : provider.installed ? 'instalado' : 'faltando'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Events */}
          {tab === 'events' && (
            <div>
              <div className="dev-section-title">Eventos Recentes</div>
              {events.length === 0 ? (
                <div className="dev-empty">Nenhum evento recebido.</div>
              ) : (
                events.slice(0, 30).map((ev) => (
                  <div key={ev.id} className="dev-event-row">
                    <div className="dev-event-type">{ev.type}</div>
                    <div className="dev-event-data">{JSON.stringify(ev.data).slice(0, 80)}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Kill switch */}
          {onKillSwitch && (
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button className="btn-kill-switch" onClick={onKillSwitch}>
                Parar todos os agentes
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
