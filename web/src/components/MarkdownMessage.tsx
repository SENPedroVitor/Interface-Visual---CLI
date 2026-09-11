import React, { useState } from 'react';
import { IconCopy, IconCheck } from './Icons';
import { HeroVideoDialog } from './HeroVideoDialog';

/**
 * Check if a URL or text contains a video link (YouTube, Vimeo, direct MP4/WebM).
 */
export function isVideoUrl(text: string): boolean {
  return (
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|vimeo\.com\/(?:video\/)?\d+)/i.test(text) ||
    /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(text)
  );
}

/**
 * Quick heuristic used by ConversationView to decide whether a message is
 * worth running through the block parser below, or can stay as plain
 * word-by-word RevealText.
 */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /```|(^|\n)\s*[-*]\s+\S|(^|\n)\s*\d+\.\s+\S|\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)/.test(text) ||
    isVideoUrl(text)
  );
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

/** Inline formatting: **bold**, *italic*, `code`, [link](url) — applied within one line/paragraph run. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
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
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push(
          <a
            key={`${keyPrefix}-a-${i}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="md-link"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(<em key={`${keyPrefix}-i-${i}`}>{token.slice(1, -1)}</em>);
    }
    last = re.lastIndex;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function parseLineWithVideo(line: string): {
  textBefore?: string;
  videoUrl: string;
  thumbUrl?: string;
  title?: string;
  textAfter?: string;
} | null {
  const trimmed = line.trim();

  // 1. Markdown image-link: [![title](thumb)](video)
  const mdImgLink = /^([\s\S]*?)\[!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)\]\((https?:\/\/[^\s)]+)\)([\s\S]*)$/.exec(trimmed);
  if (mdImgLink && isVideoUrl(mdImgLink[4])) {
    return {
      textBefore: mdImgLink[1].trim() || undefined,
      title: mdImgLink[2].trim() || undefined,
      thumbUrl: mdImgLink[3].trim(),
      videoUrl: mdImgLink[4].trim(),
      textAfter: mdImgLink[5].trim() || undefined,
    };
  }

  // 2. Markdown link: [title](video)
  const mdLink = /^([\s\S]*?)\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)([\s\S]*)$/.exec(trimmed);
  if (mdLink && isVideoUrl(mdLink[3])) {
    return {
      textBefore: mdLink[1].trim() || undefined,
      title: mdLink[2].trim() || undefined,
      videoUrl: mdLink[3].trim(),
      textAfter: mdLink[4].trim() || undefined,
    };
  }

  // 3. Raw video URL anywhere in line
  const rawVideoRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=[a-zA-Z0-9_-]{11}|embed\/[a-zA-Z0-9_-]{11}|shorts\/[a-zA-Z0-9_-]{11})|youtu\.be\/[a-zA-Z0-9_-]{11}|vimeo\.com\/(?:video\/)?\d+|(?:[^\s)]+\.(?:mp4|webm|ogg|mov)(?:\?[^\s)]*)?)))/i;
  const rawMatch = rawVideoRegex.exec(trimmed);
  if (rawMatch) {
    const before = trimmed.slice(0, rawMatch.index).trim();
    const after = trimmed.slice(rawMatch.index + rawMatch[0].length).trim();
    return {
      textBefore: before || undefined,
      videoUrl: rawMatch[0],
      textAfter: after || undefined,
    };
  }

  return null;
}

/** Splits a non-code text block into paragraphs, lists, and HeroVideoDialog cards. */
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
    // Check if line contains a video to render as HeroVideoDialog
    const videoData = parseLineWithVideo(rawLine);
    if (videoData) {
      flushList();
      if (videoData.textBefore) buffer.push(videoData.textBefore);
      flushBuffer();
      out.push(
        <div key={`${keyPrefix}-v-${idx++}`} className="md-video-card-wrap">
          <HeroVideoDialog
            videoSrc={videoData.videoUrl}
            thumbnailSrc={videoData.thumbUrl}
            thumbnailAlt={videoData.title || 'Assistir vídeo'}
            animationStyle="from-center"
          />
        </div>
      );
      if (videoData.textAfter) buffer.push(videoData.textAfter);
      continue;
    }

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
