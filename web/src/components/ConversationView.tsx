import React, { useState, useRef, useEffect } from 'react';
import { Agent } from '../types';
import { WaddleAvatar, AgentState } from './WaddleAvatar';
import { RevealText } from './RevealText';
import { agentStateFromStatus } from '../utils/agentState';
import { agentVisual } from '../utils/agentVisuals';

export interface ChatItem {
  id: string;
  type: 'message' | 'context_activity' | 'artifact';
  sender: 'user' | 'quinta' | 'atlas' | 'nero' | 'iris' | 'system';
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
}

const SENDER_COLOR_CLASS: Record<string, string> = {
  quinta: 'quinta',
  atlas:  'atlas',
  nero:   'nero',
  iris:   'iris',
  system: 'system',
};

const QUICK_SUGGESTIONS = [
  'Analise a arquitetura do projeto e sugira melhorias.',
  'Crie um arquivo de documentação com os agentes.',
  'Execute a verificação de integridade do sistema.',
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
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);
  const endRef    = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
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
  const agentVis    = agentVisual(agentName);
  const headerState: AgentState = isSending ? 'working' : agentStateFromStatus(currentAgent?.status);

  // Sweeps the composer-peek avatar's gaze left-to-right as you type,
  // resetting every ~30 characters — a "reading" illusion, not a pixel-exact
  // caret tracker. Backspacing naturally pulls the gaze back too, for free.
  const isTyping = inputText.length > 0;
  const gazeX = isTyping ? ((inputText.length % 30) / 30) * 2 - 1 : 0;

  return (
    <div className="main-panel">

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
          <span className="panel-agent-name">{agentName}</span>
        </div>

        <div className="panel-header-right">
          <button className="panel-icon-btn" title="Modo apresentação">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="4" width="20" height="14" rx="2" />
              <path d="M8 20h8M12 18v2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Message Stream ── */}
      <div className="messages-area">

        {chatItems.length === 0 && !isSending ? (
          /* Empty State Hero with Interactive Mouse-Tracking Penguin */
          <div className="empty-state">
            <div className="empty-avatar-hero">
              <WaddleAvatar
                color={agentVis.color}
                state="idle"
                size={130}
                marking={agentVis.marking}
                clickAnim={agentVis.clickAnim}
                quote={agentVis.quote}
                trackMouse={true}
                interactive={true}
                className="hero-penguin"
              />
            </div>
            <h2 className="empty-title">{agentName}</h2>
            <div className="empty-role-badge">{currentAgent?.role || 'Agente de IA Autônomo'}</div>
            <p className="empty-desc">
              {agentName === 'Quinta'
                ? 'Coordeno a equipe para pesquisar, escrever código e validar resultados. O que fazemos hoje?'
                : currentAgent?.description || 'Pronto para trabalhar.'}
            </p>
            <div className="quick-actions">
              {QUICK_SUGGESTIONS.map((s, i) => (
                <button key={i} className="quick-action-btn" onClick={() => setInputText(s)}>
                  {s}
                </button>
              ))}
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
                      {item.activityIcon && <span className="activity-icon">{item.activityIcon}</span>}
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
                        <div className="artifact-icon-box">📄</div>
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
        <div className={`composer-peek ${isTyping ? 'is-typing' : ''}`}>
          <WaddleAvatar
            color={agentVis.color}
            state="idle"
            size={40}
            marking={agentVis.marking}
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
            placeholder={`Message ${agentName}`}
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
