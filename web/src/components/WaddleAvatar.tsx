import React, { useEffect, useRef, useState } from 'react';
import { registerEye } from '../lib/eyeTracker';
import './WaddleAvatar.css';

export type AgentState = 'idle' | 'working' | 'thinking' | 'waiting' | 'done' | 'blocked' | 'stopped';
export type MarkingType = 'none' | 'chevron' | 'tuft' | 'chinstrap' | 'tie' | 'whistle';
export type ClickAnim = 'hop' | 'fast' | 'jump2' | 'tilt';

export interface AvatarCosmetics {
  head?: 'none' | 'luffy_hat' | 'headphones' | 'crown' | string;
  face?: 'none' | 'zoro_scar' | 'glasses' | 'sunglasses' | string;
  body?: 'none' | 'tie' | 'bowtie' | 'whistle' | string;
  hand?: 'none' | 'coffee' | string;
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
  quote, gazeX = 0, onClick, imageUrl,
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
