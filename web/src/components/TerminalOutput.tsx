import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, RotateCcw, Terminal as TerminalIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import './TerminalOutput.css';

export interface TerminalLine {
  id: string;
  raw: string;
  type: 'command' | 'output' | 'success' | 'error' | 'warning' | 'comment';
  promptPrefix?: string;
  content: string;
}

export interface TerminalOutputProps {
  code: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  typingSpeedMs?: number;
  lineDelayMs?: number;
}

function parseTerminalLines(code: string): TerminalLine[] {
  const lines = code.trim().split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trimStart();

    // Comment
    if (trimmed.startsWith('#') && !trimmed.startsWith('#!')) {
      return {
        id: `line-${idx}`,
        raw: line,
        type: 'comment',
        content: line,
      };
    }

    // Command patterns: $, >, PS >, npm, pnpm, yarn, git, python, pytest, cargo, docker
    const cmdMatch = line.match(/^(\$|>|#|PS\s+[^\>]*>)\s*(.*)$/);
    if (cmdMatch) {
      return {
        id: `line-${idx}`,
        raw: line,
        type: 'command',
        promptPrefix: cmdMatch[1] === '>' ? '❯' : cmdMatch[1] === '$' ? '$' : cmdMatch[1],
        content: cmdMatch[2],
      };
    }

    // If starts with standard cli tools directly
    if (/^(npm|npx|pnpm|yarn|git|python|python3|pip|pytest|uvicorn|docker|curl|wget|cargo|go\s+run)\s+/.test(trimmed)) {
      return {
        id: `line-${idx}`,
        raw: line,
        type: 'command',
        promptPrefix: '$',
        content: trimmed,
      };
    }

    // Success line
    if (/(✔|passed|success|completed|done in|ready in|build finished)/i.test(line)) {
      return {
        id: `line-${idx}`,
        raw: line,
        type: 'success',
        content: line,
      };
    }

    // Error line
    if (/(error:|failed:|fatal:|exception:|err!|exit code [1-9])/i.test(line)) {
      return {
        id: `line-${idx}`,
        raw: line,
        type: 'error',
        content: line,
      };
    }

    // Warning line
    if (/(warn:|warning:|caution:)/i.test(line)) {
      return {
        id: `line-${idx}`,
        raw: line,
        type: 'warning',
        content: line,
      };
    }

    // Standard output
    return {
      id: `line-${idx}`,
      raw: line,
      type: 'output',
      content: line,
    };
  });
}

export const TerminalOutput: React.FC<TerminalOutputProps> = ({
  code,
  title = 'bash',
  className,
  autoPlay = true,
  lineDelayMs = 120,
}) => {
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState(0); // For re-triggering animation
  const [isInstant, setIsInstant] = useState(!autoPlay);

  const lines = useMemo(() => parseTerminalLines(code), [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  const handleReplay = () => {
    setIsInstant(false);
    setKey((prev) => prev + 1);
  };

  return (
    <div className={cn('terminal-window', className)}>
      {/* macOS Window Header */}
      <div className="terminal-header">
        <div className="terminal-controls">
          <span className="terminal-dot terminal-dot-close" />
          <span className="terminal-dot terminal-dot-minimize" />
          <span className="terminal-dot terminal-dot-expand" />
        </div>

        <div className="terminal-title">
          <TerminalIcon size={12} className="terminal-title-icon" />
          <span>{title}</span>
        </div>

        <div className="terminal-actions">
          <button
            type="button"
            className="terminal-action-btn"
            onClick={() => setIsInstant((prev) => !prev)}
            title={isInstant ? 'Modo animado' : 'Modo instantâneo'}
          >
            {isInstant ? 'Animar' : 'Pular'}
          </button>
          <button
            type="button"
            className="terminal-action-btn"
            onClick={handleReplay}
            title="Repetir animação"
          >
            <RotateCcw size={12} />
          </button>
          <button
            type="button"
            className="terminal-action-btn"
            onClick={handleCopy}
            title="Copiar comando"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Screen Body */}
      <div className="terminal-body" key={key}>
        {lines.map((line, idx) => {
          const delay = isInstant ? 0 : (idx * lineDelayMs) / 1000;

          return (
            <motion.div
              key={`${key}-${line.id}`}
              className={cn('terminal-line', `terminal-line-${line.type}`)}
              initial={isInstant ? false : { opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay,
                duration: isInstant ? 0 : 0.2,
                ease: 'easeOut',
              }}
            >
              {line.type === 'command' && (
                <span className="terminal-prompt">
                  {line.promptPrefix || '$'}
                </span>
              )}
              <span className="terminal-line-content">
                {line.content || '\u00A0'}
              </span>
              {!isInstant && idx === lines.length - 1 && (
                <motion.span
                  className="terminal-cursor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.8,
                    delay: delay + 0.2,
                  }}
                >
                  ▋
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default TerminalOutput;
