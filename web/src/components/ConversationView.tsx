import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Agent, ArtifactSummary, RoutineSummary, Task } from '../types';
import { WaddleAvatar, AgentState, STATE_LABELS } from './WaddleAvatar';
import { RevealText } from './RevealText';
import { TypingAnimation } from './TypingAnimation';
import { agentStateFromStatus, roleLabel } from '../utils/agentState';
import { agentVisual } from '../utils/agentVisuals';
import { VectorIcon, IconDocument, IconCheck, IconAlert, IconGear } from './Icons';
import { MarkdownMessage, looksLikeMarkdown, CopyButton } from './MarkdownMessage';

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

/**
 * For squad/group chats: finds the last item of each consecutive run of
 * agent messages that involves 2+ distinct bots, and maps that item's id
 * to the participant names — used to drop a Grok-Bot-style collapsed
 * "Mensagens de X e Y" line right after that run, instead of repeating a
 * name+avatar on every single message (each bubble already has one).
 * Tool/artifact items in between don't break a run — they're the same turn.
 */
function computeGroupSummaryPoints(items: ChatItem[]): Map<string, string[]> {
  const points = new Map<string, string[]>();
  let runNames: string[] = [];
  let lastItemId: string | null = null;

  const flush = () => {
    const uniqueNames = Array.from(new Set(runNames));
    if (uniqueNames.length >= 2 && lastItemId) {
      points.set(lastItemId, uniqueNames);
    }
    runNames = [];
    lastItemId = null;
  };

  for (const item of items) {
    if (item.type !== 'message') continue;
    if (item.sender === 'user') {
      flush();
      continue;
    }
    runNames.push(item.senderName || item.sender);
    lastItemId = item.id;
  }
  flush();
  return points;
}

function GroupSummaryLine({ names }: { names: string[] }): React.ReactElement {
  return (
    <div className="group-summary-line">
      Mensagens de{' '}
      {names.map((name, i) => {
        const vis = agentVisual(name);
        const isLast = i === names.length - 1;
        const isSecondToLast = i === names.length - 2;
        return (
          <React.Fragment key={name}>
            <span className="group-summary-dot" style={{ background: vis.color }} />
            <strong>{name}</strong>
            {!isLast && (isSecondToLast ? ' e ' : ', ')}
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface ConversationViewProps {
  currentAgent: Agent | null;
  isGroup?: boolean;
  chatItems: ChatItem[];
  onSendMessage: (text: string) => Promise<void>;
  isSending: boolean;
  presentation: boolean;
  onTogglePresentation: () => void;
  tasks: Task[];
  artifacts: ArtifactSummary[];
  routines: RoutineSummary[];
  onEditAgent: () => void;
  onOpenRoutine: (routineId: string) => void;
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

const SPORTS_SUGGESTIONS = [
  'Tabela de classificação do Brasileirão atualizada',
  'Próximos jogos e classificação da NBA',
  'Tabela da NFL e conferências para o Super Bowl',
  'Próximos jogos do Flamengo e resultados recentes',
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
  isGroup = false,
  chatItems,
  onSendMessage,
  isSending,
  presentation,
  onTogglePresentation,
  tasks,
  artifacts,
  routines,
  onEditAgent,
  onOpenRoutine,
  apiError,
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);
  const endRef    = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  const showComposerPeek = isTyping;
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
  const groupSummaryPoints = useMemo(
    () => (isGroup ? computeGroupSummaryPoints(chatItems) : new Map<string, string[]>()),
    [isGroup, chatItems]
  );

  return (
    <div className="main-panel">

      {/* ── Panel Header ── */}
      <header className="panel-header">
        <div
          className="panel-header-left is-clickable"
          onClick={onEditAgent}
          title={isGroup ? `Configurações do squad ${agentName}` : `Configurações de ${agentName}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onEditAgent();
            }
          }}
        >
          <WaddleAvatar
            color={agentVis.color}
            state={headerState}
            size={26}
            marking={agentVis.marking}
            clickAnim={agentVis.clickAnim}
            imageUrl={agentVis.imageUrl}
            trackMouse
            interactive
          />
          <span className="panel-agent-name">{agentName}<small className="panel-presence-label" role="status">{STATE_LABELS[headerState]}</small></span>
        </div>

        <div className="panel-header-right">
          <button
            className="panel-icon-btn"
            title={isGroup ? 'Configurações do squad' : `Configurações de ${agentName}`}
            aria-label={isGroup ? 'Configurações do squad' : `Configurações de ${agentName}`}
            onClick={onEditAgent}
          >
            <IconGear size={17} />
          </button>

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
       <div className="messages-inner">
        {apiError && <div className="connection-banner" role="status">{apiError}</div>}

        {chatItems.length === 0 && !isSending ? (
          /* Empty State Hero with Interactive Mouse-Tracking Penguin */
          <div className="empty-state">
            <div className="empty-avatar-hero">
              <WaddleAvatar
                color={agentVis.color}
                state={headerState}
                size={112}
                marking={agentVis.marking}
                clickAnim={agentVis.clickAnim}
                quote={agentVis.quote}
                imageUrl={agentVis.imageUrl}
                trackMouse={!isTyping}
                interactive={true}
                className="hero-penguin"
                gazeX={gazeX}
              />
            </div>
            <h2 className="empty-title">{agentName}</h2>
            <div className="empty-role-badge">{roleLabel(currentAgent?.role || 'Agente')}</div>
            <p className="empty-desc">
              <TypingAnimation
                key={agentName}
                typeSpeed={20}
                delay={180}
                showCursor={true}
                blinkCursor={true}
                cursorStyle="line"
              >
                {agentName === 'Quinta'
                  ? 'Coordeno a equipe para pesquisar, escrever código e validar resultados. O que fazemos hoje?'
                  : currentAgent?.description || 'Pronto para trabalhar.'}
              </TypingAnimation>
            </p>
            <div className="quick-actions">
              {(agentName === 'Ma' || currentAgent?.role === 'Investor'
                ? INVESTOR_SUGGESTIONS
                : agentName === 'Livro' || currentAgent?.role === 'Sports'
                ? SPORTS_SUGGESTIONS
                : QUICK_SUGGESTIONS
              ).map((s, i) => (
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
                    <button
                      type="button"
                      className="memory-row memory-row-clickable"
                      key={routine.id}
                      title={routine.prompt}
                      onClick={() => onOpenRoutine(routine.id)}
                    >
                      <span>{routine.name}</span>
                      <small>{routine.schedule}</small>
                    </button>
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

              /* Context activity — one log line among the agent's other
                 activity items; see .activity-inline in index.css for how
                 consecutive lines merge into a single shared card. */
              if (item.type === 'context_activity') {
                const state = item.activityState || 'running';
                return (
                  <div key={item.id} className="activity-inline">
                    <span className="activity-state-icon" aria-hidden="true">
                      {state === 'failed' ? (
                        <IconAlert size={12} />
                      ) : state === 'done' ? (
                        <IconCheck size={12} />
                      ) : (
                        <span className="activity-dot" />
                      )}
                    </span>
                    {item.activityIcon && (
                      <span className="activity-icon">
                        <VectorIcon name={item.activityIcon} size={13} />
                      </span>
                    )}
                    <span className={`activity-line-text ${state === 'running' ? 'is-running' : ''}`}>
                      {renderActivityContent(item.content)}
                      {item.activityStatus && state !== 'running' && (
                        <span className="activity-line-meta"> · {item.activityStatus}</span>
                      )}
                    </span>
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
              const summaryNames = groupSummaryPoints.get(item.id);

              return (
                <React.Fragment key={item.id}>
                <div className={`msg-row ${isUser ? 'user-msg' : 'agent-msg'}`}>
                  {!isUser && (
                    <div className={`msg-sender-name ${colorClass}`}>
                      <WaddleAvatar
                        color={senderVis.color}
                        state="idle"
                        size={16}
                        marking={senderVis.marking}
                        imageUrl={senderVis.imageUrl}
                        plain
                      />
                      {item.senderName || agentName}
                    </div>
                  )}
                  <div className="msg-bubble">
                    {isUser ? (
                      item.content
                    ) : looksLikeMarkdown(item.content) ? (
                      <MarkdownMessage text={item.content} />
                    ) : (
                      <RevealText text={item.content} animate={!!item.justArrived} />
                    )}
                  </div>
                  {!isUser && item.content && (
                    <div className="msg-actions">
                      <CopyButton
                        text={item.content}
                        className="msg-copy-all-btn"
                        label="Copiar resposta"
                        copiedLabel="Copiado"
                      />
                    </div>
                  )}
                </div>
                {summaryNames && <GroupSummaryLine names={summaryNames} />}
                </React.Fragment>
              );
            })}

            {/* Typing indicator — classic WhatsApp/iMessage-style three dots */}
            {isSending && (
              <div className="msg-row agent-msg">
                <div className={`msg-sender-name ${SENDER_COLOR_CLASS[agentName.toLowerCase()] || 'quinta'}`}>
                  <WaddleAvatar color={agentVis.color} state="working" size={16} marking={agentVis.marking} imageUrl={agentVis.imageUrl} plain />
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
      </div>

      {/* ── Composer ── */}
      <div className="composer-area">
        <div className="composer-box-wrapper">
          <div className={`composer-peek ${showComposerPeek ? 'is-typing' : ''}`} aria-hidden="true">
            <WaddleAvatar
              color={agentVis.color}
              state="idle"
              size={40}
              marking={agentVis.marking}
              imageUrl={agentVis.imageUrl}
              gazeX={gazeX}
            />
          </div>

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
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
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
    </div>
  );
};
