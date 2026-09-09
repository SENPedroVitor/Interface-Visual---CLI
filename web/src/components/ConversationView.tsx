import React, { useState, useRef, useEffect } from 'react';
import { Agent, ArtifactSummary, RoutineSummary, Task } from '../types';
import { WaddleAvatar, AgentState, STATE_LABELS } from './WaddleAvatar';
import { RevealText } from './RevealText';
import { agentStateFromStatus, roleLabel } from '../utils/agentState';
import { agentVisual } from '../utils/agentVisuals';
import { VectorIcon, IconDocument } from './Icons';

export interface ChatItem {
  id: string;
  type: 'message' | 'context_activity' | 'artifact';
  sender: string;
  /** Which bot's separate conversation this item belongs to (lowercase agent name) — App.tsx tags every item with this at creation. */
  agentKey: string;
  senderName?: string;
  content: string;
  timestamp: string;
  activityStatus?: string;
  activityState?: 'running' | 'done' | 'failed';
  activityIcon?: string;
  /**
   * Set once, at creation time, by whoever pushes this item into chatItems —
   * never recomputed on re-render. ConversationView re-renders on every
   * websocket event (App.tsx calls refreshData() after each one), so a
   * "was this seen before" flag recalculated per-render would flip to
   * false mid-animation the instant any unrelated re-render happened to
   * land — which is exactly why the reveal used to look instantaneous.
   */
  justArrived?: boolean;
  artifact?: {
    filename: string;
    description: string;
    content?: string;
    bytes?: number;
  };
}

interface ConversationViewProps {
  currentAgent: Agent | null;
  chatItems: ChatItem[];
  onSendMessage: (text: string) => Promise<void>;
  isSending: boolean;
  presentation: boolean;
  onTogglePresentation: () => void;
  tasks: Task[];
  artifacts: ArtifactSummary[];
  routines: RoutineSummary[];
  onEditAgent: () => void;
  apiError?: string;
}

const SENDER_COLOR_CLASS: Record<string, string> = {
  quinta: 'quinta',
  atlas:  'atlas',
  nero:   'nero',
  iris:   'iris',
  ma:     'ma',
  system: 'system',
};

const QUICK_SUGGESTIONS = [
  'Analise a arquitetura do projeto e sugira melhorias.',
  'Crie um arquivo de documentação com os agentes.',
  'Execute a verificação de integridade do sistema.',
];

const INVESTOR_SUGGESTIONS = [
  'Como está o Ibovespa e o Dólar hoje?',
  'Qual a cotação e indicadores de PETR4 e VALE3?',
  'Analise o FII MXRF11 para dividendos.',
  'Como está o saldo e rentabilidade da minha carteira?',
];

/** Renders `code`-wrapped segments (real file paths/commands) as inline code chips. */
function renderActivityContent(content: string): React.ReactNode {
  return content.split(/(`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code key={i} className="activity-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  currentAgent,
  chatItems,
  onSendMessage,
  isSending,
  presentation,
  onTogglePresentation,
  tasks,
  artifacts,
  routines,
  onEditAgent,
  apiError,
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);
  const [avatarFlight, setAvatarFlight] = useState(false);
  const endRef    = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasTypingRef = useRef(false);

  useEffect(() => {
    if (chatItems.length || isSending) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems, isSending]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [inputText]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const agentName   = currentAgent?.name || 'Quinta';
  const agentVis    = agentVisual(agentName, currentAgent?.role);
  const headerState: AgentState = isSending ? 'working' : agentStateFromStatus(currentAgent?.status);

  // Sweeps the composer-peek avatar's gaze left-to-right as you type,
  // resetting every ~30 characters — a "reading" illusion, not a pixel-exact
  // caret tracker. Backspacing naturally pulls the gaze back too, for free.
  const isTyping = inputText.length > 0;
  const gazeX = isTyping ? ((inputText.length % 30) / 30) * 2 - 1 : 0;
  const hasEmptyHero = chatItems.length === 0 && !isSending;
  const showComposerPeek = isTyping && (!hasEmptyHero || avatarFlight);
  const agentTasks = tasks
    .filter(task => task.assigned_agent === agentName)
    .slice(-3)
    .reverse();
  const agentArtifacts = artifacts
    .filter(artifact => artifact.agent_name === agentName)
    .slice(0, 3);
  const agentRoutines = routines
    .filter(routine => routine.agent_name === agentName)
    .slice(0, 3);

  useEffect(() => {
    if (isTyping && !wasTypingRef.current && hasEmptyHero) {
      setAvatarFlight(true);
      const timer = window.setTimeout(() => setAvatarFlight(false), 950);
      wasTypingRef.current = true;
      return () => window.clearTimeout(timer);
    }

    if (!isTyping) wasTypingRef.current = false;
  }, [hasEmptyHero, isTyping]);

  return (
    <div className={`main-panel ${avatarFlight ? 'is-avatar-flight' : ''}`}>

      {/* ── Panel Header ── */}
      <header className="panel-header">
        <div className="panel-header-left">
          <WaddleAvatar
            color={agentVis.color}
            state={headerState}
            size={26}
            marking={agentVis.marking}
            clickAnim={agentVis.clickAnim}
            trackMouse
            interactive
          />
          <span className="panel-agent-name">{agentName}<small className="panel-presence-label" role="status">{STATE_LABELS[headerState]}</small></span>
        </div>

        <div className="panel-header-right">
          <button className="panel-icon-btn" title={presentation ? 'Sair da apresentação (Esc)' : 'Modo apresentação'} aria-pressed={presentation} onClick={onTogglePresentation}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="4" width="20" height="14" rx="2" />
              <path d="M8 20h8M12 18v2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Message Stream ── */}
      <div className="messages-area">
        {apiError && <div className="connection-banner" role="status">{apiError}</div>}

        {chatItems.length === 0 && !isSending ? (
          /* Empty State Hero with Interactive Mouse-Tracking Penguin */
          <div className="empty-state">
            <div className={`empty-avatar-hero ${avatarFlight ? 'is-departing' : ''} ${isTyping ? 'is-parked-in-composer' : ''}`}>
              <WaddleAvatar
                color={agentVis.color}
                state={headerState}
                size={112}
                marking={agentVis.marking}
                clickAnim={agentVis.clickAnim}
                quote={agentVis.quote}
                trackMouse={true}
                interactive={true}
                className="hero-penguin"
              />
            </div>
            <h2 className="empty-title">{agentName}</h2>
            <div className="empty-role-badge">{roleLabel(currentAgent?.role || 'Agente')}</div>
            <p className="empty-desc">
              {agentName === 'Quinta'
                ? 'Coordeno a equipe para pesquisar, escrever código e validar resultados. O que fazemos hoje?'
                : currentAgent?.description || 'Pronto para trabalhar.'}
            </p>
            <div className="quick-actions">
              {(agentName === 'Ma' || currentAgent?.role === 'Investor' ? INVESTOR_SUGGESTIONS : QUICK_SUGGESTIONS).map((s, i) => (
                <button key={i} className="quick-action-btn" onClick={() => setInputText(s)}>
                  {s}
                </button>
              ))}
            </div>

            <div className="agent-memory-panel">
              <div className="agent-memory-header">
                <span>Memória do agente</span>
                <button type="button" onClick={onEditAgent}>Editar perfil</button>
              </div>

              <div className="agent-memory-grid">
                <section>
                  <h3>Trabalho recente</h3>
                  {agentTasks.length ? agentTasks.map(task => (
                    <div className="memory-row" key={task.id}>
                      <span>{task.title}</span>
                      <small>{task.status}</small>
                    </div>
                  )) : <p>Nenhuma tarefa recente para este agente.</p>}
                </section>

                <section>
                  <h3>Artifacts</h3>
                  {agentArtifacts.length ? agentArtifacts.map(artifact => (
                    <div className="memory-row" key={artifact.id} title={artifact.path}>
                      <span>{artifact.filename}</span>
                      <small>{artifact.bytes ? `${artifact.bytes} bytes` : 'arquivo'}</small>
                    </div>
                  )) : <p>Nenhum arquivo gerado ainda.</p>}
                </section>

                <section>
                  <h3>Rotinas</h3>
                  {agentRoutines.length ? agentRoutines.map(routine => (
                    <div className="memory-row" key={routine.id} title={routine.prompt}>
                      <span>{routine.name}</span>
                      <small>{routine.schedule}</small>
                    </div>
                  )) : <p>Nenhuma rotina configurada ainda.</p>}
                </section>
              </div>
            </div>
          </div>

        ) : (
          <>
            {/* Date separator */}
            <div className="date-separator">
              {new Date().toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </div>

            {chatItems.map((item) => {

              /* Context Activity card */
              if (item.type === 'context_activity') {
                return (
                  <div key={item.id} className="activity-inline">
                    <div className="activity-inline-header">
                      <span className={`activity-dot ${item.activityState || 'running'}`} />
                      {item.activityIcon && (
                        <span className="activity-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <VectorIcon name={item.activityIcon} size={14} />
                        </span>
                      )}
                      <span>{item.senderName || 'Agente'}</span>
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                        · {item.activityStatus || 'Em andamento'}
                      </span>
                    </div>
                    <div className={`activity-inline-body ${item.activityState === 'running' ? 'is-running' : ''}`}>
                      {renderActivityContent(item.content)}
                    </div>
                  </div>
                );
              }

              /* Artifact card */
              if (item.type === 'artifact' && item.artifact) {
                const isExpanded = expandedArtifactId === item.id;
                return (
                  <div key={item.id} className="artifact-card" style={{ margin: '2px 20px' }}>
                    <div className="artifact-card-header">
                      <div className="artifact-file-info">
                        <div className="artifact-icon-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconDocument size={18} />
                        </div>
                        <div>
                          <div className="artifact-name">{item.artifact.filename}</div>
                          <div className="artifact-sub">
                            {item.artifact.description}
                            {item.artifact.bytes ? ` · ${item.artifact.bytes} bytes` : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn-artifact-toggle"
                        onClick={() => setExpandedArtifactId(isExpanded ? null : item.id)}
                      >
                        {isExpanded ? 'Recolher' : 'Visualizar'}
                      </button>
                    </div>
                    {isExpanded && item.artifact.content && (
                      <pre className="artifact-content-pre">{item.artifact.content}</pre>
                    )}
                  </div>
                );
              }

              /* Chat message bubble */
              const isUser     = item.sender === 'user';
              const colorClass = SENDER_COLOR_CLASS[item.sender] || 'system';
              const senderVis  = agentVisual(item.senderName || '');

              return (
                <div key={item.id} className={`msg-row ${isUser ? 'user-msg' : 'agent-msg'}`}>
                  {!isUser && (
                    <div className={`msg-sender-name ${colorClass}`}>
                      <WaddleAvatar
                        color={senderVis.color}
                        state="idle"
                        size={16}
                        marking={senderVis.marking}
                        plain
                      />
                      {item.senderName || agentName}
                    </div>
                  )}
                  <div className="msg-bubble">
                    {isUser ? (
                      item.content
                    ) : (
                      <RevealText text={item.content} animate={!!item.justArrived} />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator — classic WhatsApp/iMessage-style three dots */}
            {isSending && (
              <div className="msg-row agent-msg">
                <div className={`msg-sender-name ${SENDER_COLOR_CLASS[agentName.toLowerCase()] || 'quinta'}`}>
                  <WaddleAvatar color={agentVis.color} state="working" size={16} marking={agentVis.marking} plain />
                  {agentName}
                </div>
                <div className="typing-indicator">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
          </>
        )}

        <div ref={endRef} />
      </div>

      {/* ── Composer ── */}
      <div className="composer-area">
        {avatarFlight && (
          <div className="hero-to-composer-flight" aria-hidden="true">
            <WaddleAvatar
              color={agentVis.color}
              state="idle"
              size={112}
              marking={agentVis.marking}
              plain={false}
            />
          </div>
        )}

        <div className={`composer-peek ${showComposerPeek ? 'is-typing' : ''}`}>
          <WaddleAvatar
            color={agentVis.color}
            state="idle"
            size={40}
            marking={agentVis.marking}
            gazeX={gazeX}
          />
        </div>

        {agentName === 'Livro' && (
          <div className="quick-action-chips" style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="quick-chip"
              onClick={() => setInputText("Tabela de classificação do Brasileirão")}
              style={{ padding: '4px 10px', borderRadius: '16px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', background: 'var(--bg-secondary, #1a1a24)', color: 'var(--text-primary, #fff)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <VectorIcon name="trophy" size={13} color="#059669" /> Tabela Brasileirão
            </button>
            <button
              type="button"
              className="quick-chip"
              onClick={() => setInputText("Classificação da NBA")}
              style={{ padding: '4px 10px', borderRadius: '16px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', background: 'var(--bg-secondary, #1a1a24)', color: 'var(--text-primary, #fff)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <VectorIcon name="basketball" size={13} color="#ea580c" /> Classificação NBA
            </button>
            <button
              type="button"
              className="quick-chip"
              onClick={() => setInputText("Tabela da NFL e conferências")}
              style={{ padding: '4px 10px', borderRadius: '16px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', background: 'var(--bg-secondary, #1a1a24)', color: 'var(--text-primary, #fff)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <VectorIcon name="football" size={13} color="#d97706" /> NFL & Super Bowl
            </button>
            <button
              type="button"
              className="quick-chip"
              onClick={() => setInputText("Classificação da MLB e beisebol")}
              style={{ padding: '4px 10px', borderRadius: '16px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', background: 'var(--bg-secondary, #1a1a24)', color: 'var(--text-primary, #fff)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <VectorIcon name="baseball" size={13} color="#3b82f6" /> MLB Beisebol
            </button>
            <button
              type="button"
              className="quick-chip"
              onClick={() => setInputText("Próximos jogos do Flamengo")}
              style={{ padding: '4px 10px', borderRadius: '16px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', background: 'var(--bg-secondary, #1a1a24)', color: 'var(--text-primary, #fff)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <VectorIcon name="ball" size={13} color="#ef4444" /> Próximos Jogos
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="composer-box">
          <button type="button" className="btn-composer-attach" title="Anexar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            className="composer-input"
            placeholder={`Mensagem para ${agentName}`}
            aria-label={`Mensagem para ${agentName}`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isSending}
          />

          <button type="button" className="btn-composer-mic" title="Microfone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="9" y="2" width="6" height="13" rx="3" />
              <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6" strokeLinecap="round" />
            </svg>
          </button>

          <button
            type="submit"
            className="btn-composer-send"
            disabled={!inputText.trim() || isSending}
            title="Enviar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};
