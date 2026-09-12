import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Bot, ListTodo, FolderKanban, Repeat, Terminal } from 'lucide-react';
import { Agent, Task, ArtifactSummary, RoutineSummary } from '../types';
import { WaddleAvatar } from './WaddleAvatar';
import { StatusBadge, getAgentStatusBadge } from './StatusBadge';
import { roleLabel } from '../utils/agentState';
import { agentVisual } from '../utils/agentVisuals';
import { formatBytes } from '../hooks/use-dropzone';
import { cn } from '../lib/utils';
import './ToolbarExpandable.css';

/* ── Custom zero-dependency hooks ───────────────────────────────────── */

export function useMeasure<T extends HTMLElement = HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  const ref = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect) {
        setBounds({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, bounds] as const;
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains((event.target as Node) || null)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

/* ── Motion physics configuration ───────────────────────────────────── */
const transition = {
  type: 'spring' as const,
  bounce: 0.1,
  duration: 0.28,
};

export interface ToolbarExpandableProps {
  currentAgent?: Agent | null;
  tasks?: Task[];
  artifacts?: ArtifactSummary[];
  routines?: RoutineSummary[];
  onEditAgent?: () => void;
  onOpenRoutine?: (routineId: string) => void;
  onOpenDropzone?: () => void;
  onOpenDeveloperMode?: () => void;
  className?: string;
}

export const ToolbarExpandable: React.FC<ToolbarExpandableProps> = ({
  currentAgent,
  tasks = [],
  artifacts = [],
  routines = [],
  onEditAgent,
  onOpenRoutine,
  onOpenDropzone,
  onOpenDeveloperMode,
  className,
}) => {
  const [active, setActive] = useState<number | null>(null);
  const [contentRef, { height: heightContent }] = useMeasure<HTMLDivElement>();
  const [menuRef] = useMeasure<HTMLDivElement>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useClickOutside(containerRef, () => {
    setIsOpen(false);
    setActive(null);
  });

  const agentName = currentAgent?.name || 'Agente';
  const agentVis = agentVisual(agentName, currentAgent?.role, currentAgent?.avatar_config);
  const statusInfo = getAgentStatusBadge(currentAgent?.status || 'idle');

  const agentTasks = tasks
    .filter(t => !currentAgent || t.assigned_agent === agentName)
    .slice(0, 3);

  const agentArtifacts = artifacts
    .filter(a => !currentAgent || a.agent_name === agentName)
    .slice(0, 3);

  const agentRoutines = routines
    .filter(r => !currentAgent || r.agent_name === agentName)
    .slice(0, 3);

  /* ── 5 Core project items ─────────────────────────────────────────── */
  const items = [
    {
      id: 1,
      label: 'Agente',
      title: <Bot size={17} />,
      content: (
        <div className="toolbar-tab-content">
          <div className="toolbar-agent-header">
            <WaddleAvatar
              size={36}
              color={agentVis.color}
              marking={agentVis.marking}
              imageUrl={agentVis.imageUrl}
            />
            <div className="toolbar-agent-meta">
              <div className="toolbar-agent-name-row">
                <span className="toolbar-agent-name">{agentName}</span>
                <StatusBadge
                  variant={statusInfo.variant}
                  pulse={statusInfo.dotPulse}
                  size="sm"
                  label={statusInfo.label}
                />
              </div>
              <span className="toolbar-agent-role">{roleLabel(currentAgent?.role || 'Executor')}</span>
            </div>
          </div>
          <p className="toolbar-agent-desc">
            {currentAgent?.description || 'Pronto para executar tarefas, analisar código e colaborar.'}
          </p>
          {onEditAgent && (
            <button
              type="button"
              className="toolbar-btn-action"
              onClick={() => {
                onEditAgent();
                setIsOpen(false);
              }}
            >
              Configurar no Studio
            </button>
          )}
        </div>
      ),
    },
    {
      id: 2,
      label: 'Tarefas',
      title: <ListTodo size={17} />,
      content: (
        <div className="toolbar-tab-content">
          <div className="toolbar-section-header">
            <span className="toolbar-section-title">Tarefas Recentes</span>
            <span className="toolbar-badge-count">{tasks.length}</span>
          </div>
          <div className="toolbar-items-list">
            {agentTasks.length === 0 ? (
              <div className="toolbar-empty-hint">Nenhuma tarefa pendente no momento.</div>
            ) : (
              agentTasks.map(task => (
                <div key={task.id} className="toolbar-list-item">
                  <span className="toolbar-item-name">{task.title}</span>
                  <span className={`toolbar-tag status-${task.status}`}>{task.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ),
    },
    {
      id: 3,
      label: 'Arquivos',
      title: <FolderKanban size={17} />,
      content: (
        <div className="toolbar-tab-content">
          <div className="toolbar-section-header">
            <span className="toolbar-section-title">Arquivos & Artifacts</span>
            <span className="toolbar-badge-count">{artifacts.length}</span>
          </div>
          <div className="toolbar-items-list">
            {agentArtifacts.length === 0 ? (
              <div className="toolbar-empty-hint">Nenhum arquivo gerado ainda.</div>
            ) : (
              agentArtifacts.map(art => (
                <div key={art.id} className="toolbar-list-item" title={art.path}>
                  <span className="toolbar-item-name">{art.filename}</span>
                  <span className="toolbar-size-tag">{art.bytes ? formatBytes(art.bytes) : 'doc'}</span>
                </div>
              ))
            )}
          </div>
          {onOpenDropzone && (
            <button
              type="button"
              className="toolbar-btn-action"
              onClick={() => {
                onOpenDropzone();
                setIsOpen(false);
              }}
            >
              Anexar Arquivos (Dropzone)
            </button>
          )}
        </div>
      ),
    },
    {
      id: 4,
      label: 'Rotinas',
      title: <Repeat size={17} />,
      content: (
        <div className="toolbar-tab-content">
          <div className="toolbar-section-header">
            <span className="toolbar-section-title">Rotinas Automatizadas</span>
            <span className="toolbar-badge-count">{routines.length}</span>
          </div>
          <div className="toolbar-items-list">
            {agentRoutines.length === 0 ? (
              <div className="toolbar-empty-hint">Nenhuma rotina para este agente.</div>
            ) : (
              agentRoutines.map(rt => (
                <div
                  key={rt.id}
                  className="toolbar-list-item is-clickable"
                  onClick={() => {
                    onOpenRoutine?.(rt.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="toolbar-item-name">{rt.name}</span>
                  <span className="toolbar-schedule-tag">{rt.schedule || 'manual'}</span>
                </div>
              ))
            )}
          </div>
          {onOpenRoutine && agentRoutines[0] && (
            <button
              type="button"
              className="toolbar-btn-action"
              onClick={() => {
                onOpenRoutine(agentRoutines[0].id);
                setIsOpen(false);
              }}
            >
              Gerenciar Rotinas
            </button>
          )}
        </div>
      ),
    },
    {
      id: 5,
      label: 'Terminal & Dev',
      title: <Terminal size={17} />,
      content: (
        <div className="toolbar-tab-content">
          <div className="toolbar-section-header">
            <span className="toolbar-section-title">Console & Provedores</span>
          </div>
          <div className="toolbar-sys-info">
            <div className="toolbar-sys-row">
              <span>Provedor Ativo:</span>
              <strong>Ollama (Llama 3.2)</strong>
            </div>
            <div className="toolbar-sys-row">
              <span>Status CLI / OS:</span>
              <strong className="text-success">Conectado</strong>
            </div>
          </div>
          {onOpenDeveloperMode && (
            <button
              type="button"
              className="toolbar-btn-action"
              onClick={() => {
                onOpenDeveloperMode();
                setIsOpen(false);
              }}
            >
              Abrir Modo Desenvolvedor
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MotionConfig transition={transition}>
      <div className={cn('toolbar-expandable-anchor', className)} ref={containerRef}>
        <div className="toolbar-expandable-card">
          {/* Expandable Top Content */}
          <div className="toolbar-expandable-viewport">
            <AnimatePresence initial={false} mode="sync">
              {isOpen ? (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: heightContent || 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="toolbar-content-motion-box"
                >
                  <div ref={contentRef} className="toolbar-content-inner">
                    {items.map(item => {
                      const isSelected = active === item.id;
                      if (!isSelected) return null;

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.18 }}
                        >
                          {item.content}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Bottom Icons Row */}
          <div className="toolbar-icons-row" ref={menuRef}>
            {items.map(item => {
              const isActive = active === item.id;

              return (
                <button
                  key={item.id}
                  aria-label={item.label}
                  title={item.label}
                  className={cn('toolbar-icon-btn', isActive && 'is-active')}
                  type="button"
                  onClick={() => {
                    if (!isOpen) setIsOpen(true);
                    if (active === item.id) {
                      setIsOpen(false);
                      setActive(null);
                      return;
                    }
                    setActive(item.id);
                  }}
                >
                  {item.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
};

export default ToolbarExpandable;
