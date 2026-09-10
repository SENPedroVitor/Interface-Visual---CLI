import React, { useEffect, useRef, useState } from 'react';
import { registerEye } from '../lib/eyeTracker';
import './WaddleAvatar.css';

export type AgentState = 'idle' | 'working' | 'thinking' | 'waiting' | 'done' | 'blocked' | 'stopped';
export type MarkingType = 'none' | 'chevron' | 'tuft' | 'chinstrap' | 'tie' | 'whistle';
export type ClickAnim = 'hop' | 'fast' | 'jump2' | 'tilt';

export interface AvatarCosmetics {
  head?: 'none' | 'command_module' | 'signal_band' | 'timeline_rig' | 'headphones' | 'crown' | string;
  face?: 'none' | 'visor' | 'design_nodes' | 'code_cursor' | 'glasses' | 'sunglasses' | string;
  body?: 'none' | 'status_bar' | 'data_grid' | 'shield_mark' | 'orbit_mark' | 'tie' | 'bowtie' | 'whistle' | string;
  hand?: 'none' | 'side_panel' | 'coffee' | string;
}

export const STATE_LABELS: Record<AgentState, string> = {
  idle: 'Disponível', working: 'Trabalhando', thinking: 'Pensando',
  waiting: 'Aguardando', done: 'Concluído', blocked: 'Precisa de atenção', stopped: 'Parado',
};

export interface WaddleAvatarProps {
  color?: string; state?: AgentState; size?: number; className?: string;
  showPresence?: boolean; trackMouse?: boolean; interactive?: boolean;
  marking?: MarkingType; clickAnim?: ClickAnim; quote?: string; plain?: boolean;
  gazeX?: number; onClick?: () => void;
  cosmetics?: AvatarCosmetics;
  imageUrl?: string;
}

interface AvatarPalette {
  face: string;
  eyes: string;
}

const OFFICIAL_AVATAR_PALETTES: Record<string, AvatarPalette> = {
  'padrao.png': { face: '#f3f4f6', eyes: '#1e1e1e' },
  'chefe.png': { face: '#d6c5ff', eyes: '#2d1b4e' },
  'sabio.png': { face: '#bfe8db', eyes: '#123f3a' },
  'turbo.png': { face: '#bed5ff', eyes: '#14284b' },
  'eco.png': { face: '#bce7cb', eyes: '#16382a' },
  'totem.png': { face: '#e7d1b8', eyes: '#3a2a1d' },
  'livro.png': { face: '#bfdcff', eyes: '#1e3a5f' },
  'brilho.png': { face: '#f2bfdf', eyes: '#4a1440' },
};

function officialPalette(imageUrl: string): AvatarPalette | null {
  const filename = imageUrl.split('/').pop()?.split(/[?#]/)[0]?.toLowerCase();
  return filename ? OFFICIAL_AVATAR_PALETTES[filename] || null : null;
}

export const WaddleAvatar: React.FC<WaddleAvatarProps> = ({
  color = '#1e1e1e', state = 'idle', size = 36, className = '', showPresence = false,
  trackMouse = false, interactive = false, marking = 'none', clickAnim = 'hop',
  quote, gazeX = 0, onClick, cosmetics, imageUrl,
}) => {
  const [jump, setJump] = useState(false);
  const [bubble, setBubble] = useState(false);
  const jumpTimer = useRef<ReturnType<typeof setTimeout>>();
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>();
  const gazeRef = useRef<SVGGElement>(null);

  useEffect(() => () => {
    clearTimeout(jumpTimer.current);
    clearTimeout(bubbleTimer.current);
  }, []);

  const reactToClick = () => {
    if (interactive) {
      setJump(true);
      clearTimeout(jumpTimer.current);
      jumpTimer.current = setTimeout(() => setJump(false), 600);
      if (quote) {
        setBubble(true);
        clearTimeout(bubbleTimer.current);
        bubbleTimer.current = setTimeout(() => setBubble(false), 2800);
      }
    }
    onClick?.();
  };

  const resolvedImage = imageUrl || (
    marking === 'chevron' || color === '#123f3a' || color === '#3b82f6' ? '/avatars/sabio.png' :
    marking === 'tuft' || color === '#14284b' || color === '#22c55e' ? '/avatars/turbo.png' :
    marking === 'chinstrap' || color === '#16382a' || color === '#f97316' ? '/avatars/eco.png' :
    marking === 'tie' || color === '#3a2a1d' || color === '#1f6aa5' ? '/avatars/totem.png' :
    marking === 'whistle' || color === '#1e3a5f' || color === '#059669' ? '/avatars/livro.png' :
    color === '#2d1b4e' || color === '#9159fe' ? '/avatars/chefe.png' :
    color === '#4a1440' ? '/avatars/brilho.png' :
    '/avatars/padrao.png'
  );
  const palette = officialPalette(resolvedImage);
  const manualGazeX = Math.max(-1, Math.min(1, gazeX)) * 3.2;
  const accent = color;

  useEffect(() => {
    const gaze = gazeRef.current;
    const stateAllowsPointerGaze = state === 'idle' || state === 'waiting';
    if (!gaze || !palette || !trackMouse || !stateAllowsPointerGaze) return undefined;
    return registerEye(gaze, 50, 52, 3.2);
  }, [palette, state, trackMouse]);

  return (
    <div
      className={`waddle-avatar-wrapper ${className}`}
      data-state={state}
      data-reaction={jump ? clickAnim : undefined}
      data-interactive={interactive || undefined}
      style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={reactToClick}
      title={STATE_LABELS[state]}
    >
      {palette ? (
        <svg
          className="waddle-vector-avatar"
          viewBox="0 0 100 100"
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
        >
          <g className="waddle-body">
            <rect x="14" y="30" width="72" height="42" rx="21" fill={palette.face} />
            <AvatarCosmeticLayer cosmetics={cosmetics} accent={accent} ink={palette.eyes} />
            <g className={`waddle-eye-state waddle-eye-state--${state}`}>
              <g ref={gazeRef} className="waddle-gaze">
                <g className="waddle-manual-gaze" transform={`translate(${manualGazeX} 0)`}>
                  <ellipse className="waddle-eye-shape" cx="37" cy="52" rx="4.4" ry="5.8" fill={palette.eyes} />
                  <ellipse className="waddle-eye-shape" cx="63" cy="52" rx="4.4" ry="5.8" fill={palette.eyes} />
                </g>
              </g>
            </g>
          </g>
        </svg>
      ) : (
        <img
          className="waddle-avatar-image"
          src={resolvedImage}
          alt=""
          style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
        />
      )}
      {showPresence && state !== 'idle' && <span className="waddle-presence-dot" />}
      {bubble && quote && <span className="waddle-bubble">{quote}</span>}
    </div>
  );
};

export default WaddleAvatar;

function AvatarCosmeticLayer({
  cosmetics,
  accent,
  ink,
}: {
  cosmetics?: AvatarCosmetics;
  accent: string;
  ink: string;
}): React.ReactElement | null {
  if (!cosmetics) return null;

  const head = cosmetics.head || 'none';
  const face = cosmetics.face || 'none';
  const body = cosmetics.body || 'none';
  const hand = cosmetics.hand || 'none';
  const hasAny = [head, face, body, hand].some(item => item && item !== 'none');
  if (!hasAny) return null;

  return (
    <g className="waddle-cosmetics" color={accent}>
      <HeadCosmetic type={head} accent={accent} ink={ink} />
      <FaceCosmetic type={face} accent={accent} ink={ink} />
      <BodyCosmetic type={body} accent={accent} ink={ink} />
      <HandCosmetic type={hand} accent={accent} ink={ink} />
    </g>
  );
}

function HeadCosmetic({ type, accent, ink }: { type: string; accent: string; ink: string }) {
  switch (type) {
    case 'command_module':
    case 'crown':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--head">
          <rect x="41" y="23.5" width="18" height="7" rx="3.5" fill={accent} opacity="0.92" />
          <circle cx="46.5" cy="27" r="1.2" fill="#fff" opacity="0.85" />
          <circle cx="53.5" cy="27" r="1.2" fill="#fff" opacity="0.55" />
        </g>
      );
    case 'signal_band':
    case 'headphones':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--head" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="3.2">
          <path d="M27 39.5c4.9-7.6 13-11.5 23-11.5s18.1 3.9 23 11.5" opacity="0.74" />
          <path d="M24.5 44v7.5M75.5 44v7.5" stroke={ink} opacity="0.62" />
        </g>
      );
    case 'timeline_rig':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--head" fill="none" stroke={accent} strokeLinecap="round" strokeLinejoin="round">
          <path d="M35 25.5h30" strokeWidth="3.2" opacity="0.75" />
          <circle cx="40" cy="25.5" r="2.4" fill={accent} stroke="none" />
          <circle cx="50" cy="25.5" r="2.4" fill={accent} stroke="none" opacity="0.72" />
          <circle cx="60" cy="25.5" r="2.4" fill={accent} stroke="none" opacity="0.48" />
        </g>
      );
    default:
      return null;
  }
}

function FaceCosmetic({ type, accent, ink }: { type: string; accent: string; ink: string }) {
  switch (type) {
    case 'visor':
    case 'glasses':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--face" fill="none" stroke={accent} strokeLinecap="round" strokeLinejoin="round">
          <path d="M28.5 47.5h43" strokeWidth="3.4" opacity="0.52" />
          <path d="M34 43.2h32" strokeWidth="1.7" opacity="0.44" />
        </g>
      );
    case 'design_nodes':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--face">
          <circle cx="31.5" cy="42" r="3.4" fill="#ff7262" />
          <circle cx="40.5" cy="42" r="3.4" fill="#a259ff" />
          <circle cx="31.5" cy="51" r="3.4" fill="#1abcfe" />
          <circle cx="40.5" cy="51" r="3.4" fill="#0acf83" />
        </g>
      );
    case 'code_cursor':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--face" fill="none" stroke={accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
          <path d="M29 43.5 23.5 49l5.5 5.5" />
          <path d="M71 43.5 76.5 49 71 54.5" />
          <path d="M51 42.5v13" stroke={ink} opacity="0.55" />
        </g>
      );
    default:
      return null;
  }
}

function BodyCosmetic({ type, accent, ink }: { type: string; accent: string; ink: string }) {
  switch (type) {
    case 'status_bar':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--body">
          <rect x="34" y="68.5" width="32" height="3.6" rx="1.8" fill={accent} opacity="0.7" />
          <circle cx="70" cy="70.3" r="1.8" fill={ink} opacity="0.46" />
        </g>
      );
    case 'data_grid':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--body" fill={accent} opacity="0.72">
          <rect x="37" y="66" width="4" height="6" rx="1.2" />
          <rect x="45" y="62" width="4" height="10" rx="1.2" />
          <rect x="53" y="58" width="4" height="14" rx="1.2" />
          <rect x="61" y="64" width="4" height="8" rx="1.2" />
        </g>
      );
    case 'shield_mark':
    case 'leaf_badge':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--body" fill="none" stroke={accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
          <path d="M50 59.5 59 62.6v5.8c0 5.1-3.9 8.5-9 10.3-5.1-1.8-9-5.2-9-10.3v-5.8l9-3.1Z" opacity="0.74" />
          <path d="m45.8 68.5 2.7 2.7 5.8-6" />
        </g>
      );
    case 'orbit_mark':
    case 'whistle':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--body" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="2.2" opacity="0.72">
          <ellipse cx="50" cy="68.5" rx="16" ry="4.8" />
          <path d="M39.5 65.2c4.7-5.8 16.2-5.8 21 0" />
          <circle cx="62.5" cy="68.5" r="2.6" fill={accent} stroke="none" />
        </g>
      );
    default:
      return null;
  }
}

function HandCosmetic({ type, accent, ink }: { type: string; accent: string; ink: string }) {
  switch (type) {
    case 'side_panel':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--side-panel">
          <rect x="79" y="43" width="10" height="20" rx="4" fill={accent} opacity="0.82" />
          <path d="M82 49h4M82 54h4M82 59h2.5" stroke="#fff" strokeLinecap="round" strokeWidth="1.5" opacity="0.72" />
        </g>
      );
    case 'coffee':
      return (
        <g className="waddle-cosmetic waddle-cosmetic--side-panel" fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
          <path d="M79.5 58.5h7v6a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3v-6Z" />
          <path d="M86.5 60h2.2a2 2 0 0 1 0 4h-2.2" />
          <path d="M81 55.5v-3M84 55.5v-3" stroke={accent} />
        </g>
      );
    default:
      return null;
  }
}
