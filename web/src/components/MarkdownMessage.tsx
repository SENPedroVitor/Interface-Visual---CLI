import React, { useState } from 'react';
import { IconCopy, IconCheck } from './Icons';

/**
 * Quick heuristic used by ConversationView to decide whether a message is
 * worth running through the block parser below, or can stay as plain
 * word-by-word RevealText. Kept intentionally narrow — this is not a full
 * CommonMark implementation, just the handful of patterns models actually
 * produce (fenced code, bullet/numbered lists, bold/italic, inline code).
 */
export function looksLikeMarkdown(text: string): boolean {
  return /```|(^|\n)\s*[-*]\s+\S|(^|\n)\s*\d+\.\s+\S|\*\*[^*\n]+\*\*|`[^`\n]+`/.test(text);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const CopyButton: React.FC<{ text: string; className: string; label: string; copiedLabel: string }> = ({
  text,
  className,
  label,
  copiedLabel,
}) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyToClipboard(text)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }
      }}
    >
      {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
};

const CodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang }) => (
  <div className="md-code-block">
    <div className="md-code-header">
      <span className="md-code-lang">{lang || 'texto'}</span>
      <CopyButton text={code} className="md-copy-btn" label="Copiar" copiedLabel="Copiado" />
    </div>
    <pre className="md-code-pre">
      <code>{code}</code>
    </pre>
  </div>
);

/** Inline formatting: **bold**, *italic*, `code` — applied within one line/paragraph run. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-c-${i}`} className="md-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<em key={`${keyPrefix}-i-${i}`}>{token.slice(1, -1)}</em>);
    }
    last = re.lastIndex;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Splits a non-code text block into paragraphs and bullet/numbered lists. */
function renderTextBlock(content: string, keyPrefix: string): React.ReactNode[] {
  const lines = content.split('\n');
  const out: React.ReactNode[] = [];
  let buffer: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let idx = 0;

  const flushBuffer = () => {
    if (buffer.length) {
      out.push(
        <React.Fragment key={`${keyPrefix}-t-${idx++}`}>
          {renderInline(buffer.join('\n'), `${keyPrefix}-t${idx}`)}
        </React.Fragment>
      );
      buffer = [];
    }
  };

  const flushList = () => {
    if (list) {
      const items = list.items;
      const ordered = list.ordered;
      out.push(
        ordered ? (
          <ol className="md-list" key={`${keyPrefix}-l-${idx++}`}>
            {items.map((item, i) => (
              <li key={i}>{renderInline(item, `${keyPrefix}-li${idx}-${i}`)}</li>
            ))}
          </ol>
        ) : (
          <ul className="md-list" key={`${keyPrefix}-l-${idx++}`}>
            {items.map((item, i) => (
              <li key={i}>{renderInline(item, `${keyPrefix}-li${idx}-${i}`)}</li>
            ))}
          </ul>
        )
      );
      list = null;
    }
  };

  for (const rawLine of lines) {
    const bulletMatch = /^\s*[-*]\s+(.*)$/.exec(rawLine);
    const numberMatch = /^\s*\d+\.\s+(.*)$/.exec(rawLine);
    if (bulletMatch) {
      flushBuffer();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bulletMatch[1]);
    } else if (numberMatch) {
      flushBuffer();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numberMatch[1]);
    } else {
      flushList();
      buffer.push(rawLine);
    }
  }
  flushList();
  flushBuffer();
  return out;
}

interface Block {
  type: 'code' | 'text';
  content: string;
  lang?: string;
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) blocks.push({ type: 'text', content: text.slice(last, match.index) });
    blocks.push({ type: 'code', content: match[2].replace(/\n$/, ''), lang: match[1] || undefined });
    last = re.lastIndex;
  }
  if (last < text.length) blocks.push({ type: 'text', content: text.slice(last) });
  return blocks;
}

export const MarkdownMessage: React.FC<{ text: string }> = ({ text }) => {
  const blocks = parseBlocks(text);
  return (
    <>
      {blocks.map((block, i) =>
        block.type === 'code' ? (
          <CodeBlock key={i} code={block.content} lang={block.lang} />
        ) : (
          <React.Fragment key={i}>{renderTextBlock(block.content, `b${i}`)}</React.Fragment>
        )
      )}
    </>
  );
};

export { CopyButton };
export default MarkdownMessage;
