import React, { useEffect, useRef, useState } from 'react';
import { registerEye } from '../lib/eyeTracker';
import './WaddleAvatar.css';

export type AgentState = 'idle' | 'working' | 'thinking' | 'waiting' | 'done' | 'blocked' | 'stopped';
export type MarkingType = 'none' | 'chevron' | 'tuft' | 'chinstrap';
export type ClickAnim = 'hop' | 'fast' | 'jump2' | 'tilt';
export const STATE_LABELS: Record<AgentState, string> = {
  idle: 'Disponível', working: 'Trabalhando', thinking: 'Pensando',
  waiting: 'Aguardando', done: 'Concluído', blocked: 'Precisa de atenção', stopped: 'Parado',
};
export interface WaddleAvatarProps {
  color?: string; state?: AgentState; size?: number; className?: string;
  showPresence?: boolean; trackMouse?: boolean; interactive?: boolean;
  marking?: MarkingType; clickAnim?: ClickAnim; quote?: string; plain?: boolean;
  gazeX?: number; onClick?: () => void;
}
const SHAPES = {
  none: { rx: 37, ry: 42, top: 25, waist: 84, gap: 9, tilt: 0 },
  chevron: { rx: 42, ry: 37, top: 29, waist: 80, gap: 10, tilt: 0 },
  tuft: { rx: 35, ry: 40, top: 27, waist: 83, gap: 9, tilt: -3 },
  chinstrap: { rx: 34, ry: 45, top: 23, waist: 87, gap: 9, tilt: 3 },
};
function eyeInk(color: string) {
  const hex = color.replace('#', '');
  if (!/^[a-f\d]{6}$/i.test(hex)) return '#15151b';
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 < .42 ? '#fffaf0' : '#15151b';
}

/** Capsule eyes share one gaze, with state expressions taking priority over the cursor. */
export const WaddleAvatar: React.FC<WaddleAvatarProps> = ({
  color = '#1e1e1e', state = 'idle', size = 36, className = '', showPresence = false,
  trackMouse = false, interactive = false, marking = 'none', clickAnim = 'hop',
  quote, plain = false, gazeX, onClick,
}) => {
  const gazeRef = useRef<SVGGElement>(null);
  const [blink, setBlink] = useState(false);
  const [jump, setJump] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const jumpTimer = useRef<ReturnType<typeof setTimeout>>();
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>();
  const cfg = SHAPES[marking];
  const ink = eyeInk(color);
  const tracking = trackMouse && gazeX === undefined && state === 'idle' && !reduced;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (tracking && gazeRef.current) return registerEye(gazeRef.current, 60, 44, 2.4);
  }, [tracking]);
  useEffect(() => {
    setBlink(false);
    if (reduced || state === 'stopped' || state === 'done') return;
    let timer: ReturnType<typeof setTimeout>;
    let open: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        open = setTimeout(() => { setBlink(false); schedule(); }, 120);
      }, 3200 + Math.random() * 2500);
    };
    schedule();
    return () => { clearTimeout(timer); clearTimeout(open); };
  }, [state, reduced]);
  useEffect(() => () => { clearTimeout(jumpTimer.current); clearTimeout(bubbleTimer.current); }, []);
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
  const gaze = state === 'thinking' ? 'translate(-2 -2)' : state === 'blocked' ? 'translate(0 1.5)' :
    state === 'waiting' ? 'translate(2 0)' : state === 'idle' && gazeX !== undefined ? `translate(${Math.max(-1, Math.min(1, gazeX)) * 2.4} 0)` : undefined;
  const bodyPath = `M${60 - cfg.rx} ${cfg.waist} C${18 + cfg.tilt} ${cfg.top + 42} ${25 + cfg.tilt} ${cfg.top} 60 ${cfg.top} C${95 + cfg.tilt} ${cfg.top} ${102 + cfg.tilt} ${cfg.top + 42} ${60 + cfg.rx} ${cfg.waist} C${88 + cfg.tilt} 105 ${32 + cfg.tilt} 105 ${60 - cfg.rx} ${cfg.waist}Z`;
  const bellyPath = `M${60 - cfg.rx * .52} 79 C${45} 62 ${75} 62 ${60 + cfg.rx * .52} 79 C${82} 103 ${38} 103 ${60 - cfg.rx * .52} 79Z`;
  const eyeFor = (side: -1 | 1) => {
    const x = 60 + cfg.gap * side;
    const common = { fill: 'none', stroke: ink, strokeLinecap: 'round' as const };
    if (state === 'done') {
      return <path d={`M${x - 4.5} 45 Q${x} 49 ${x + 4.5} 45`} {...common} strokeWidth="3.4" />;
    }
    if (state === 'stopped') {
      return <path d={`M${x - 4} 45h8`} {...common} strokeWidth="3.5" />;
    }
    if (state === 'blocked') {
      return <path d={`M${x - 3.5} 40l7 8M${x + 3.5} 40l-7 8`} {...common} strokeWidth="3.2" />;
    }
    if (state === 'thinking') {
      return <path d={`M${x - 5} ${side < 0 ? 43 : 46} Q${x} ${side < 0 ? 39 : 42} ${x + 5} ${side < 0 ? 43 : 46}`} {...common} strokeWidth="3.4" />;
    }
    if (state === 'waiting') {
      return <ellipse className="waddle-eye-capsule" cx={x} cy="45" rx="4.4" ry="3.8" fill={ink} stroke="none" />;
    }
    if (state === 'working') {
      return <ellipse className="waddle-eye-capsule" cx={x} cy="44" rx="3.8" ry="5" fill={ink} stroke="none" />;
    }
    return <ellipse className="waddle-eye-capsule" cx={x} cy="44" rx="4" ry="5.8" fill={ink} stroke="none" />;
  };
  return (
    <div className={`waddle-avatar-wrapper ${className}`} data-state={state}
      data-reaction={jump ? clickAnim : undefined} data-interactive={interactive || undefined}
      style={{ width: size, height: size }} onClick={reactToClick} title={STATE_LABELS[state]}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={`body-glow-${color.replace('#', '')}-${marking}`} x1="36" y1="24" x2="88" y2="104" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".20" />
            <stop offset=".42" stopColor={color} stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity=".22" />
          </linearGradient>
          <radialGradient id={`belly-glow-${color.replace('#', '')}-${marking}`} cx="48%" cy="36%" r="68%">
            <stop offset="0" stopColor="#fffdfa" />
            <stop offset="1" stopColor="#f4ecdc" />
          </radialGradient>
        </defs>
        <g className="waddle-body">
          <g transform={`rotate(${cfg.tilt} 60 64)`}>
            <ellipse className="waddle-ground-shadow" cx="60" cy="104" rx={cfg.rx * .62} ry="6" />
            <path className="waddle-shell" d={bodyPath} fill={color} />
            <path className="waddle-body-shade" d={bodyPath} fill={`url(#body-glow-${color.replace('#', '')}-${marking})`} />
            <path className="waddle-belly" d={bellyPath} fill={`url(#belly-glow-${color.replace('#', '')}-${marking})`} />
            <path className="waddle-beak" d="M55 57 Q60 54 65 57 L60 63 Z" fill="#f4ae4f" />
            <g ref={gazeRef} className="waddle-gaze">
              <g transform={gaze} className="waddle-expression" fill={ink} stroke={ink}>
                {([-1, 1] as const).map(side => {
                  const x = 60 + cfg.gap * side;
                  return <g key={side} className="waddle-eye" transform={blink && !['done', 'stopped', 'blocked', 'thinking'].includes(state) ? `translate(${x} 44) scale(1 .16) translate(${-x} -44)` : undefined}>
                    {eyeFor(side)}
                  </g>;
                })}
              </g>
            </g>
            {!plain && marking === 'none' && <g className="waddle-accessory" fill="#f4cb63">
              <rect x="47" y="12" width="26" height="12" rx="4" />
              <path d="M38 24 Q60 19 82 24" stroke="#f4cb63" strokeWidth="5" strokeLinecap="round" />
              <path d="M49 21h22" stroke="#b86f36" strokeWidth="2" strokeLinecap="round" />
            </g>}
            {!plain && marking === 'chevron' && <g className="waddle-accessory" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round">
              <rect x="38.5" y="33.5" width="19" height="20" rx="8" />
              <rect x="62.5" y="33.5" width="19" height="20" rx="8" />
              <path d="M58 42h4M39 41l-8-2M81 41l8-2" />
            </g>}
            {!plain && marking === 'tuft' && <g className="waddle-accessory" fill="none" stroke="#fffaf2" strokeWidth="4.5" strokeLinecap="round">
              <path d="M26 61 C26 13 94 13 94 61" />
              <path d="M26 57v12M94 57v12" strokeWidth="9" />
            </g>}
            {!plain && marking === 'chinstrap' && <path className="waddle-accessory" d="M80 32l-4 10M82 30l3-4" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />}
          </g>
        </g>
      </svg>
      {showPresence && state !== 'idle' && <span className="waddle-presence-dot" />}
      {bubble && quote && <span className="waddle-bubble">{quote}</span>}
    </div>
  );
};
export default WaddleAvatar;
