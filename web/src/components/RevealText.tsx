import React, { useMemo } from 'react';

interface RevealTextProps {
  /** Raw message text (whitespace/newlines are preserved via CSS white-space: pre-wrap on the parent bubble) */
  text: string;
  /** Only animate messages that just arrived; historical messages render instantly */
  animate?: boolean;
  /** Total reveal duration target in ms, regardless of message length */
  maxDurationMs?: number;
}

/**
 * Reveals text word-by-word with a soft blur/fade-up stagger, evoking a
 * reply "materializing" rather than popping in as one block.
 * Whitespace (including newlines) is preserved verbatim between words.
 */
export const RevealText: React.FC<RevealTextProps> = ({
  text,
  animate = true,
  maxDurationMs = 900,
}) => {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);

  if (!animate) {
    return <>{text}</>;
  }

  const wordCount = tokens.filter((t) => t.trim().length > 0).length || 1;
  const step = Math.max(10, Math.min(45, maxDurationMs / wordCount));

  let wordIndex = 0;
  return (
    <>
      {tokens.map((token, i) => {
        if (!token.trim()) {
          // Whitespace / newline run — render verbatim, no animation.
          return <React.Fragment key={i}>{token}</React.Fragment>;
        }
        const delay = wordIndex * step;
        wordIndex += 1;
        return (
          <span key={i} className="reveal-word" style={{ animationDelay: `${delay}ms` }}>
            {token}
          </span>
        );
      })}
    </>
  );
};

export default RevealText;
