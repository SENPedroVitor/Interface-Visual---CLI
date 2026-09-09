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
/** Soft mascot eyes share one gaze, with state expressions taking priority over the cursor. */
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
  const eyeInk = '#111116';
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
    const eyeGap = Math.min(cfg.gap, 7.6);
    const x = 60 + eyeGap * side;
    const common = { fill: 'none', stroke: eyeInk, strokeLinecap: 'round' as const };
    if (state === 'done') {
      return <path d={`M${x - 4.2} 44.8 Q${x} 48.5 ${x + 4.2} 44.8`} {...common} strokeWidth="3.1" />;
    }
    if (state === 'stopped') {
      return <path d={`M${x - 4.5} 45h9`} {...common} strokeWidth="3.1" />;
    }
    if (state === 'blocked') {
      return (
        <path d={`M${x - 3.5} 41.8l7 7M${x + 3.5} 41.8l-7 7`} {...common} strokeWidth="2.8" />
      );
    }
    if (state === 'thinking') {
      const y = side < 0 ? 43.8 : 45.8;
      return (
        <g className="waddle-eye-minimal">
          <ellipse className="waddle-eye-ink" cx={x - .4} cy={y} rx="3.35" ry="4.45" />
          <circle className="waddle-eye-shine" cx={x - 1.2} cy={y - 1.55} r=".55" />
          <path d={`M${x - 4.2} ${y - 4.4} Q${x} ${y - 6.2} ${x + 4.2} ${y - 4.4}`} {...common} strokeWidth="1.8" opacity=".72" />
        </g>
      );
    }
    const eyeY = state === 'waiting' ? 45.5 : 44.9;
    const eyeRx = state === 'waiting' ? 3.45 : state === 'working' ? 3.25 : 3.45;
    const eyeRy = state === 'waiting' ? 3.25 : state === 'working' ? 4.8 : 4.35;
    const eyeX = state === 'waiting' ? x + .8 : x;
    return (
      <g className="waddle-eye-minimal">
        <ellipse className="waddle-eye-ink" cx={eyeX} cy={eyeY} rx={eyeRx} ry={eyeRy} />
        {state !== 'waiting' && <circle className="waddle-eye-shine" cx={eyeX - .8} cy={eyeY - 1.45} r=".55" />}
      </g>
    );
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
              <g transform={gaze} className="waddle-expression" fill={eyeInk} stroke={eyeInk}>
                {([-1, 1] as const).map(side => {
                  const x = 60 + Math.min(cfg.gap, 7.6) * side;
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
            {!plain && marking === 'chevron' && <g className="waddle-accessory" fill="none" stroke="rgba(255,250,240,.74)" strokeWidth="3" strokeLinecap="round">
              <path d="M47 34 Q60 28 73 34" />
              <path d="M42 39 Q60 31 78 39" strokeWidth="1.8" opacity=".45" />
            </g>}
            {!plain && marking === 'tuft' && <g className="waddle-accessory" fill="none" stroke="#fffaf2" strokeWidth="4.5" strokeLinecap="round">
              <path d="M26 61 C26 13 94 13 94 61" />
              <path d="M26 57v12M94 57v12" strokeWidth="9" />
            </g>}
            {!plain && marking === 'chinstrap' && <path className="waddle-accessory" d="M80 32l-4 10M82 30l3-4" stroke={eyeInk} strokeWidth="2.5" strokeLinecap="round" />}
          </g>
        </g>
      </svg>
      {showPresence && state !== 'idle' && <span className="waddle-presence-dot" />}
      {bubble && quote && <span className="waddle-bubble">{quote}</span>}
    </div>
  );
};
export default WaddleAvatar;
