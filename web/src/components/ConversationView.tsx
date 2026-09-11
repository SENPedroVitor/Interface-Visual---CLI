import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Agent, ArtifactSummary, RoutineSummary, Task } from '../types';
import { WaddleAvatar, AgentState } from './WaddleAvatar';
import { RevealText } from './RevealText';
import { TypingAnimation } from './TypingAnimation';
import { agentStateFromStatus, roleLabel } from '../utils/agentState';
import { agentVisual } from '../utils/agentVisuals';
import { VectorIcon, IconDocument, IconCheck, IconAlert, IconGear } from './Icons';
import { MarkdownMessage, looksLikeMarkdown, CopyButton } from './MarkdownMessage';
import { Dropzone } from './Dropzone';
import { TypingIndicator } from './TypingIndicator';
import { formatBytes } from '../hooks/use-dropzone';
import { getAgentGreetings } from '../utils/agentGreetings';
import { StatusBadge, getAgentStatusBadge } from './StatusBadge';
import { DatePicker } from './DatePicker';
import { Paperclip, FileText, Image as ImageIcon, X, Calendar as CalendarIcon } from 'lucide-react';

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
  onSendMessage: (text: string, files?: File[]) => Promise<void>;
  isSending: boolean;
  presentation: boolean;
  onTogglePresentation: () => void;
  tasks?: Task[];
  artifacts?: ArtifactSummary[];
  routines?: RoutineSummary[];
  onEditAgent: () => void;
  onOpenRoutine?: (routineId: string) => void;
  onOpenDeveloperMode?: () => void;
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
  tasks = [],
  artifacts = [],
  routines = [],
  onEditAgent,
  onOpenRoutine = () => {},
  apiError,
}) => {
  const [inputText, setInputText] = useState('');
  const [isDropzoneOpen, setIsDropzoneOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);
  const endRef    = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);


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
    if ((!text && attachedFiles.length === 0) || isSending) return;
    const filesToSend = [...attachedFiles];
    setInputText('');
    setAttachedFiles([]);
    setIsDropzoneOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await onSendMessage(text, filesToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleContainerDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer?.types?.includes('Files')) {
      dragCounterRef.current += 1;
      setIsDraggingOverChat(true);
    }
  };

  const handleContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleContainerDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOverChat(false);
    }
  };

  const handleContainerDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingOverChat(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setAttachedFiles((prev) => [...prev, ...files]);
    }
  };

  const agentName   = currentAgent?.name || 'Quinta';
  const agentVis    = agentVisual(agentName, currentAgent?.role);
  const headerState: AgentState = isSending ? 'working' : agentStateFromStatus(currentAgent?.status);
  const agentStatusInfo = getAgentStatusBadge(currentAgent?.status || (isSending ? 'working' : 'idle'));

  const agentGreetings = useMemo(
    () => getAgentGreetings(agentName, currentAgent?.role),
    [agentName, currentAgent?.role]
  );

  const [greetingIndex, setGreetingIndex] = useState(() =>
    Math.floor(Math.random() * (agentGreetings.length || 1))
  );

  useEffect(() => {
    setGreetingIndex(Math.floor(Math.random() * (agentGreetings.length || 1)));
  }, [agentName, agentGreetings.length]);

  const currentGreeting =
    agentGreetings[greetingIndex % agentGreetings.length] ||
    currentAgent?.description ||
    'Pronto para trabalhar.';

  const handleNextGreeting = () => {
    setGreetingIndex((prev) => (prev + 1) % agentGreetings.length);
  };

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
    <div
      className="main-panel"
      onDragEnter={handleContainerDragEnter}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      {/* Full-panel Drag Overlay */}
      {isDraggingOverChat && (
        <div className="conversation-drop-overlay">
          <div className="conversation-drop-modal">
            <Dropzone
              size="lg"
              multiple
              maxSize={50 * 1024 * 1024}
              title="Solte os arquivos para anexar"
              description="Eles serão incluídos na sua próxima mensagem"
              onFilesAccepted={(files) => {
                setAttachedFiles((prev) => [...prev, ...files]);
                setIsDraggingOverChat(false);
              }}
            />
          </div>
        </div>
      )}

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
          <span className="panel-agent-name">
            {agentName}
            <StatusBadge
              variant={agentStatusInfo.variant}
              pulse={agentStatusInfo.dotPulse}
              size="sm"
              label={agentStatusInfo.label}
              isPill={false}
              style={{ marginLeft: '8px' }}
            />
          </span>
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
            <div
              className="empty-avatar-hero"
              onClick={handleNextGreeting}
              title="Clique no mascote para trocar a frase"
              style={{ cursor: 'pointer' }}
            >
              <WaddleAvatar
                color={agentVis.color}
                state={headerState}
                size={112}
                marking={agentVis.marking}
                clickAnim={agentVis.clickAnim}
                quote={currentGreeting}
                imageUrl={agentVis.imageUrl}
                trackMouse={!isTyping}
                interactive={true}
                className="hero-penguin"
                gazeX={gazeX}
              />
            </div>
            <h2 className="empty-title">{agentName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 12px' }}>
              <div className="empty-role-badge">{roleLabel(currentAgent?.role || 'Agente')}</div>
            </div>
            <p
              className="empty-desc"
              onClick={handleNextGreeting}
              title="Clique para trocar a frase"
              style={{ cursor: 'pointer' }}
            >
              <TypingAnimation
                key={`${agentName}-${greetingIndex}`}
                typeSpeed={18}
                delay={120}
                showCursor={true}
                blinkCursor={true}
                cursorStyle="line"
              >
                {currentGreeting}
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
                      onClick={() => onOpenRoutine?.(routine.id)}
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

            {/* Typing indicator — accessible presence indicator with wave animation */}
            {isSending && (
              <div className="msg-row agent-msg" style={{ marginTop: '4px' }}>
                <TypingIndicator
                  variant="bubble"
                  size="md"
                  name={agentName}
                  avatar={
                    agentVis.imageUrl
                      ? { src: agentVis.imageUrl, alt: agentName }
                      : undefined
                  }
                  locale="pt"
                />
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
          {/* Dropzone expandable panel */}
          {isDropzoneOpen && (
            <div className="composer-dropzone-panel">
              <Dropzone
                size="md"
                multiple
                maxSize={50 * 1024 * 1024}
                accept=".pdf,.doc,.docx,.txt,.md,.json,.csv,.py,.ts,.tsx,.js,.jsx,.zip,image/*"
                title="Solte arquivos aqui ou clique para selecionar"
                description="Suporta código, PDFs, imagens e documentos até 50 MB"
                onFilesAccepted={(newFiles) => {
                  setAttachedFiles((prev) => [...prev, ...newFiles]);
                  setIsDropzoneOpen(false);
                }}
              />
            </div>
          )}

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
            {/* Attachment preview pills */}
            {attachedFiles.length > 0 && (
              <div className="composer-attachments-row">
                {attachedFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="composer-attachment-pill">
                    <span className="attachment-pill-icon">
                      {file.type.startsWith('image/') ? (
                        <ImageIcon size={13} />
                      ) : (
                        <FileText size={13} />
                      )}
                    </span>
                    <span className="attachment-pill-name" title={file.name}>
                      {file.name}
                    </span>
                    <span className="attachment-pill-size">
                      {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      className="attachment-pill-remove"
                      title="Remover arquivo"
                      onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}


            <div className="composer-input-row">
              <button
                type="button"
                className={`btn-composer-attach ${isDropzoneOpen ? 'is-active' : ''}`}
                title={isDropzoneOpen ? 'Fechar área de arquivos' : 'Anexar arquivos (Dropzone)'}
                onClick={() => setIsDropzoneOpen((prev) => !prev)}
              >
                {isDropzoneOpen ? <X size={17} /> : <Paperclip size={17} />}
              </button>

              {/* DatePicker calendar button & popover */}
              <div className="composer-datepicker-anchor">
                <button
                  type="button"
                  className={`btn-composer-calendar ${isDatePickerOpen ? 'is-active' : ''}`}
                  title={isDatePickerOpen ? 'Fechar calendário' : 'Escolher data / Agendar'}
                  onClick={() => setIsDatePickerOpen(prev => !prev)}
                >
                  <CalendarIcon size={17} />
                </button>

                {isDatePickerOpen && (
                  <DatePicker
                    hideTrigger={true}
                    open={true}
                    placement="top"
                    align="left"
                    onInsert={(formatted) => {
                      setInputText(prev => {
                        const trimmed = prev.trim();
                        return trimmed ? `${trimmed} (Data: ${formatted})` : `Agendar para ${formatted}`;
                      });
                      setIsDatePickerOpen(false);
                      textareaRef.current?.focus();
                    }}
                    onClose={() => setIsDatePickerOpen(false)}
                  />
                )}
              </div>

              <textarea
                ref={textareaRef}
                className="composer-input"
                placeholder={attachedFiles.length > 0 ? `Adicione uma mensagem com os ${attachedFiles.length} arquivo(s)...` : `Mensagem para ${agentName}`}
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
                disabled={(!inputText.trim() && attachedFiles.length === 0) || isSending}
                title="Enviar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
