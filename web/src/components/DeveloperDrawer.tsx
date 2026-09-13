import React, { useState, useMemo } from 'react';
import { Agent, ProviderInfo, Task, ToolInfo, WaddleEvent } from '../types';
import { IconClose } from './Icons';
import {
  AgentGraph,
  type AgentGraphPayload,
  type AgentGraphNode,
  type AgentGraphEdge,
  type NodeType,
  type NodeStatus,
  type GraphDirection,
  type GraphFit,
} from './agent-graph';

interface DeveloperDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  agents?: Agent[];
  tasks: Task[];
  tools: ToolInfo[];
  providers: ProviderInfo[];
  events: WaddleEvent[];
  onKillSwitch?: () => void;
}

type Tab = 'tasks' | 'architecture' | 'tools' | 'providers' | 'events';
type ArchitecturePreset = 'active_tasks' | 'waddle_core' | 'parallel' | 'loop';

/** Maps Waddle Task[] to topological AgentGraphPayload */
function buildTasksGraph(tasks: Task[]): AgentGraphPayload {
  if (!tasks || tasks.length === 0) {
    return {
      status: 'empty',
      nodes: [],
      edges: [],
    };
  }

  const nodes: AgentGraphNode[] = tasks.map((t) => {
    let type: NodeType = 'agent';
    const lowTitle = (t.title || '').toLowerCase();
    if (
      lowTitle.includes('revis') ||
      lowTitle.includes('verif') ||
      lowTitle.includes('aprov') ||
      lowTitle.includes('decis') ||
      lowTitle.includes('avalia')
    ) {
      type = 'decision';
    } else if (
      lowTitle.includes('exec') ||
      lowTitle.includes('tool') ||
      lowTitle.includes('busca') ||
      lowTitle.includes('terminal') ||
      lowTitle.includes('script')
    ) {
      type = 'tool';
    } else if (
      lowTitle.includes('início') ||
      lowTitle.includes('fim') ||
      lowTitle.includes('input') ||
      lowTitle.includes('output') ||
      lowTitle.includes('prompt')
    ) {
      type = 'io';
    }

    let status: NodeStatus = 'idle';
    if (t.status === 'running') status = 'running';
    else if (t.status === 'completed') status = 'done';
    else if (t.status === 'failed' || t.status === 'cancelled') status = 'failed';
    else if (t.status === 'blocked' || t.status === 'waiting_review' || t.status === 'queued' || t.status === 'pending') {
      status = 'idle';
    }

    return {
      id: t.id,
      label: t.title,
      type,
      status,
      detail: t.assigned_agent ? `@${t.assigned_agent} (${t.priority})` : t.priority,
    };
  });

  const edges: AgentGraphEdge[] = [];
  tasks.forEach((t, index) => {
    if (t.dependencies && t.dependencies.length > 0) {
      t.dependencies.forEach((depId) => {
        edges.push({
          from: depId,
          to: t.id,
          active: t.status === 'running',
        });
      });
    } else if (index > 0 && tasks.length <= 6) {
      edges.push({
        from: tasks[index - 1].id,
        to: t.id,
        active: t.status === 'running',
      });
    }
  });

  return {
    status: 'ready',
    nodes,
    edges,
  };
}

/** Pre-configured multi-agent topology showcase */
const WADDLE_CORE_PRESET: AgentGraphPayload = {
  status: 'ready',
  nodes: [
    { id: 'user_req', label: 'Prompt / Objetivo', type: 'io', status: 'done', detail: 'Entrada de Usuário' },
    { id: 'orchestrator', label: 'Quinta (Planner)', type: 'agent', status: 'done', detail: 'Decomposição de tarefas' },
    { id: 'research', label: 'Atlas (Research)', type: 'agent', status: 'done', detail: 'Busca de contexto & docs' },
    { id: 'tool_search', label: 'Tool: Search', type: 'tool', status: 'done', detail: 'Varredura de arquivos' },
    { id: 'coder', label: 'Nero (Developer)', type: 'agent', status: 'running', detail: 'Síntese de código' },
    { id: 'tool_bash', label: 'Tool: Terminal', type: 'tool', status: 'running', detail: 'Execução de testes' },
    { id: 'critic', label: 'Revisor / Gate', type: 'decision', status: 'idle', detail: 'Inspeção de qualidade' },
    { id: 'delivery', label: 'Artefato Final', type: 'io', status: 'idle', detail: 'Resposta & arquivos' },
  ],
  edges: [
    { from: 'user_req', to: 'orchestrator' },
    { from: 'orchestrator', to: 'research' },
    { from: 'research', to: 'tool_search' },
    { from: 'tool_search', to: 'coder' },
    { from: 'coder', to: 'tool_bash', active: true },
    { from: 'tool_bash', to: 'critic' },
    { from: 'critic', to: 'delivery', label: 'Pass' },
    { from: 'critic', to: 'coder', label: 'Retry', active: true }, // Cycle return wire
  ],
};

const PARALLEL_PRESET: AgentGraphPayload = {
  status: 'ready',
  nodes: [
    { id: 'task_start', label: 'Disparo Inicial', type: 'io', status: 'done' },
    { id: 'dispatcher', label: 'Despachante', type: 'agent', status: 'done', detail: 'Fanning out' },
    { id: 'w_web', label: 'Worker: Web', type: 'agent', status: 'done', detail: 'Scraping docs' },
    { id: 'w_db', label: 'Worker: DB', type: 'agent', status: 'running', detail: 'Query PostgreSQL' },
    { id: 'w_cache', label: 'Worker: Cache', type: 'agent', status: 'idle', detail: 'Redis sync' },
    { id: 'join', label: 'Consolidador', type: 'decision', status: 'idle', detail: 'Redução / Aggregator' },
    { id: 'task_end', label: 'Conclusão', type: 'io', status: 'idle' },
  ],
  edges: [
    { from: 'task_start', to: 'dispatcher' },
    { from: 'dispatcher', to: 'w_web' },
    { from: 'dispatcher', to: 'w_db', active: true },
    { from: 'dispatcher', to: 'w_cache' },
    { from: 'w_web', to: 'join' },
    { from: 'w_db', to: 'join' },
    { from: 'w_cache', to: 'join' },
    { from: 'join', to: 'task_end' },
  ],
};

const LOOP_PRESET: AgentGraphPayload = {
  status: 'ready',
  nodes: [
    { id: 'in', label: 'Dados Iniciais', type: 'io', status: 'done' },
    { id: 'prep', label: 'Pré-processador', type: 'agent', status: 'done' },
    { id: 'opt_skip', label: 'Filtro Opcional', type: 'tool', status: 'skipped', detail: 'Ignorado (heurística)' },
    { id: 'agent_loop', label: 'Agente Reflexivo', type: 'agent', status: 'running', detail: 'Otimização contínua' },
    { id: 'eval', label: 'Convergência?', type: 'decision', status: 'idle' },
    { id: 'out', label: 'Saída Validada', type: 'io', status: 'idle' },
  ],
  edges: [
    { from: 'in', to: 'prep' },
    { from: 'prep', to: 'opt_skip' },
    { from: 'opt_skip', to: 'agent_loop' },
    { from: 'prep', to: 'agent_loop' },
    { from: 'agent_loop', to: 'eval', active: true },
    { from: 'eval', to: 'agent_loop', label: 'Iterar' },
    { from: 'eval', to: 'out', label: 'Concluir' },
  ],
};

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
  const [archPreset, setArchPreset] = useState<ArchitecturePreset>(
    tasks && tasks.length > 0 ? 'active_tasks' : 'waddle_core'
  );
  const [direction, setDirection] = useState<GraphDirection>('right');
  const [fit, setFit] = useState<GraphFit>('scroll');
  const [zoom, setZoom] = useState<number>(1);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Compute active architecture data
  const currentGraphData = useMemo<AgentGraphPayload>(() => {
    switch (archPreset) {
      case 'active_tasks':
        return buildTasksGraph(tasks);
      case 'parallel':
        return PARALLEL_PRESET;
      case 'loop':
        return LOOP_PRESET;
      case 'waddle_core':
      default:
        return WADDLE_CORE_PRESET;
    }
  }, [archPreset, tasks]);

  // Find currently selected node for Inspector card
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !currentGraphData.nodes) return null;
    return currentGraphData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, currentGraphData]);

  if (!isOpen) return null;

  return (
    <>
      <div className="dev-drawer-overlay" onClick={onClose} />
      <aside
        className={`dev-drawer ${
          tab === 'architecture' ? (isMaximized ? 'dev-drawer-maximized' : 'dev-drawer-wide') : ''
        }`}
      >
        <div className="dev-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dev-drawer-title">Developer Mode</span>
            {tab === 'architecture' && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  background: 'rgba(59, 130, 246, 0.18)',
                  color: '#38bdf8',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                Topologia SVG
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {tab === 'architecture' && (
              <button
                type="button"
                className="btn-dev-header-action"
                onClick={() => setIsMaximized((m) => !m)}
                title={isMaximized ? 'Restaurar largura padrão' : 'Expandir para tela ampla'}
              >
                {isMaximized ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>
            )}
            <button className="btn-dev-close" onClick={onClose} title="Fechar">
              <IconClose size={14} />
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['tasks', 'architecture', 'tools', 'providers', 'events'] as Tab[]).map((t) => (
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
                fontSize: 12,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.12s',
                textTransform: 'capitalize',
              }}
            >
              {t === 'tasks'
                ? 'Tarefas'
                : t === 'architecture'
                ? 'Arquitetura'
                : t === 'tools'
                ? 'Ferramentas'
                : t === 'providers'
                ? 'Motores'
                : 'Eventos'}
            </button>
          ))}
        </div>

        <div className="dev-drawer-content">
          {/* Architecture Tab */}
          {tab === 'architecture' && (
            <div className="dev-architecture-tab">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="dev-section-title" style={{ margin: 0 }}>
                  Topologia & Fluxo de Agentes
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pure SVG Flow</div>
              </div>

              {/* Presets and Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {/* Preset Selector */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className={`btn-arch-preset ${archPreset === 'active_tasks' ? 'active' : ''}`}
                    onClick={() => {
                      setArchPreset('active_tasks');
                      setSelectedNodeId(null);
                    }}
                  >
                    Tarefas Ativas ({tasks.length})
                  </button>
                  <button
                    className={`btn-arch-preset ${archPreset === 'waddle_core' ? 'active' : ''}`}
                    onClick={() => {
                      setArchPreset('waddle_core');
                      setSelectedNodeId(null);
                    }}
                  >
                    Waddle Multi-Agente
                  </button>
                  <button
                    className={`btn-arch-preset ${archPreset === 'parallel' ? 'active' : ''}`}
                    onClick={() => {
                      setArchPreset('parallel');
                      setSelectedNodeId(null);
                    }}
                  >
                    Pipeline Paralelo
                  </button>
                  <button
                    className={`btn-arch-preset ${archPreset === 'loop' ? 'active' : ''}`}
                    onClick={() => {
                      setArchPreset('loop');
                      setSelectedNodeId(null);
                    }}
                  >
                    Refinamento em Loop
                  </button>
                </div>

                {/* Graph Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-hover)',
                    padding: '6px 10px',
                    borderRadius: 8,
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Direção:</span>
                    <button
                      className={`btn-arch-toggle ${direction === 'right' ? 'active' : ''}`}
                      onClick={() => setDirection('right')}
                      title="Fluxo horizontal (esquerda para direita)"
                    >
                      ➔ Horizontal
                    </button>
                    <button
                      className={`btn-arch-toggle ${direction === 'down' ? 'active' : ''}`}
                      onClick={() => setDirection('down')}
                      title="Fluxo vertical (topo para base)"
                    >
                      ⬇ Vertical
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Ajuste:</span>
                    <button
                      className={`btn-arch-toggle ${fit === 'scroll' ? 'active' : ''}`}
                      onClick={() => setFit('scroll')}
                      title="Exibir em resolução 100% com rolagem livre"
                    >
                      100% Scroll
                    </button>
                    <button
                      className={`btn-arch-toggle ${fit === 'width' ? 'active' : ''}`}
                      onClick={() => setFit('width')}
                      title="Encolher para caber na largura da gaveta"
                    >
                      Ajustar
                    </button>

                    {fit === 'scroll' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '1px 3px' }}>
                        <button
                          type="button"
                          className="btn-arch-toggle"
                          style={{ padding: '2px 6px', fontWeight: 'bold' }}
                          onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
                          title="Reduzir zoom"
                        >
                          −
                        </button>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', minWidth: 34, textAlign: 'center' }}>
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          type="button"
                          className="btn-arch-toggle"
                          style={{ padding: '2px 6px', fontWeight: 'bold' }}
                          onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.15) * 100) / 100))}
                          title="Aumentar zoom"
                        >
                          +
                        </button>
                        {zoom !== 1 && (
                          <button
                            type="button"
                            className="btn-arch-toggle"
                            style={{ padding: '1px 4px', fontSize: 9 }}
                            onClick={() => setZoom(1)}
                            title="Resetar para 100%"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      className={`btn-arch-toggle ${showLegend ? 'active' : ''}`}
                      onClick={() => setShowLegend(!showLegend)}
                      title="Alternar legenda"
                      style={{ marginLeft: 'auto' }}
                    >
                      {showLegend ? 'Ocultar Legenda' : 'Ver Legenda'}
                    </button>
                  </div>
                </div>

                {fit === 'scroll' && direction === 'right' && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
                    <span>💡 <em>Dica: Role horizontalmente pelo painel abaixo para ver todos os nós, ou teste o modo <strong>⬇ Vertical</strong> para fluxo em pilha.</em></span>
                  </div>
                )}
              </div>

              {/* AgentGraph Component */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  background: 'var(--bg-main)',
                  overflow: 'hidden',
                  padding: 8,
                }}
              >
                <AgentGraph
                  data={currentGraphData}
                  direction={direction}
                  fit={fit}
                  zoom={zoom}
                  interactive={true}
                  selectedId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                  showLegend={showLegend}
                  aria-label="Diagrama da Arquitetura Multi-Agente"
                />
              </div>

              {/* Selected Node Inspector */}
              {selectedNode && (
                <div className="dev-arch-inspector">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Nó Selecionado: {selectedNode.label}
                    </span>
                    <button
                      onClick={() => setSelectedNodeId(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                      title="Limpar seleção"
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 8,
                      fontSize: 11,
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>ID: </span>
                      <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedNode.id}</code>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Tipo (Forma): </span>
                      <strong>{selectedNode.type}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Status (Cor): </span>
                      <span className={`dev-task-status ${selectedNode.status}`}>
                        {selectedNode.status}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Detalhe: </span>
                      <span>{selectedNode.detail || 'Nenhum detalhe adicional'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                    <span
                      className={`dev-provider-status ${
                        provider.available ? 'available' : provider.installed ? 'installed' : 'missing'
                      }`}
                    >
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
