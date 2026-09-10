import React, { useEffect, useRef, useState } from 'react';
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

export const WaddleAvatar: React.FC<WaddleAvatarProps> = ({
  color = '#1e1e1e', state = 'idle', size = 36, className = '', showPresence = false,
  interactive = false, marking = 'none', clickAnim = 'hop',
  quote, onClick, imageUrl,
}) => {
  const [jump, setJump] = useState(false);
  const [bubble, setBubble] = useState(false);
  const jumpTimer = useRef<ReturnType<typeof setTimeout>>();
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>();

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
      <img
        src={resolvedImage}
        alt=""
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.32))',
        }}
      />
      {showPresence && state !== 'idle' && <span className="waddle-presence-dot" />}
      {bubble && quote && <span className="waddle-bubble">{quote}</span>}
    </div>
  );
};

export default WaddleAvatar;
