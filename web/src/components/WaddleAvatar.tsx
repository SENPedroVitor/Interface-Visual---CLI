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
const SHAPES = {
  none: { rx: 37, ry: 42, top: 25, waist: 84, gap: 9, tilt: 0 },
  chevron: { rx: 42, ry: 37, top: 29, waist: 80, gap: 10, tilt: 0 },
  tuft: { rx: 35, ry: 40, top: 27, waist: 83, gap: 9, tilt: -3 },
  chinstrap: { rx: 34, ry: 45, top: 23, waist: 87, gap: 9, tilt: 3 },
  tie: { rx: 36, ry: 41, top: 25, waist: 84, gap: 9, tilt: 0 },
  whistle: { rx: 36, ry: 41, top: 25, waist: 84, gap: 9, tilt: 0 },
};
/** Soft mascot eyes share one gaze, with state expressions taking priority over the cursor. */
export const WaddleAvatar: React.FC<WaddleAvatarProps> = ({
  color = '#1e1e1e', state = 'idle', size = 36, className = '', showPresence = false,
  trackMouse = false, interactive = false, marking = 'none', clickAnim = 'hop',
  quote, plain = false, gazeX, onClick, cosmetics, imageUrl,
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

  if (imageUrl) {
    return (
      <div
        className={`waddle-avatar-wrapper ${className}`}
        data-state={state}
        data-reaction={jump ? clickAnim : undefined}
        data-interactive={interactive || undefined}
        style={{ width: size, height: size, position: 'relative' }}
        onClick={reactToClick}
        title={STATE_LABELS[state]}
      >
        <img
          src={imageUrl}
          alt=""
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            border: `2px solid ${color || '#38bdf8'}`,
            display: 'block',
          }}
        />
        {showPresence && state !== 'idle' && <span className="waddle-presence-dot" />}
        {bubble && quote && <span className="waddle-bubble">{quote}</span>}
      </div>
    );
  }

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

  const hasExplicitCosmetics = Boolean(cosmetics);
  const headItem = cosmetics?.head ?? (!hasExplicitCosmetics && !plain && marking === 'none' ? 'luffy_hat' : 'none');
  const faceItem = cosmetics?.face ?? (!hasExplicitCosmetics && !plain && marking === 'chevron' ? 'glasses' : !hasExplicitCosmetics && !plain && marking === 'chinstrap' ? 'zoro_scar' : 'none');
  const bodyItem = cosmetics?.body ?? (!hasExplicitCosmetics && !plain && marking === 'tie' ? 'tie' : 'none');
  const handItem = cosmetics?.hand ?? 'none';
  const legacyTuft = !hasExplicitCosmetics && !plain && marking === 'tuft';

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

            {/* Eyes & Gaze */}
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

            {/* Face Cosmetics */}
            {faceItem === 'zoro_scar' && (
              <g className="waddle-cosmetic-scar">
                <path d="M51 34 L54 54" stroke="#991b1b" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="49.5" y1="40" x2="54.5" y2="39" stroke="#7f1d1d" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="51" y1="47" x2="56" y2="46" stroke="#7f1d1d" strokeWidth="1.2" strokeLinecap="round" />
              </g>
            )}

            {faceItem === 'glasses' && (
              <g className="waddle-cosmetic-glasses">
                <rect x="46" y="38" width="12" height="12" rx="4" fill="rgba(255,255,255,0.15)" stroke="#38bdf8" strokeWidth="1.8" />
                <rect x="62" y="38" width="12" height="12" rx="4" fill="rgba(255,255,255,0.15)" stroke="#38bdf8" strokeWidth="1.8" />
                <path d="M58 43 Q60 41 62 43" fill="none" stroke="#38bdf8" strokeWidth="1.8" />
                <line x1="46" y1="42" x2="38" y2="40" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="74" y1="42" x2="82" y2="40" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="48" y1="40" x2="51" y2="43" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
                <line x1="64" y1="40" x2="67" y2="43" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
              </g>
            )}

            {faceItem === 'sunglasses' && (
              <g className="waddle-cosmetic-sunglasses">
                <path d="M44 39 Q52 39 57 40 Q57 46 55 49 Q48 52 44 48 Z" fill="#09090b" stroke="#27272a" strokeWidth="1" />
                <path d="M63 40 Q68 39 76 39 Q76 48 72 52 Q65 49 63 46 Z" fill="#09090b" stroke="#27272a" strokeWidth="1" />
                <line x1="43" y1="40" x2="77" y2="40" stroke="#3f3f46" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="47" y1="42" x2="52" y2="47" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="66" y1="42" x2="71" y2="47" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
              </g>
            )}

            {/* Head Cosmetics */}
            {headItem === 'luffy_hat' && (
              <g className="waddle-cosmetic-hat">
                <ellipse cx="60" cy="24" rx="34" ry="9" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
                <path d="M42 22 C42 8 78 8 78 22 Z" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
                <path d="M42 21 C50 19 70 19 78 21 L78 24 C70 22 50 22 42 24 Z" fill="#ef4444" />
                <path d="M48 15 Q60 13 72 15" fill="none" stroke="#eab308" strokeWidth="0.8" opacity="0.6" />
              </g>
            )}

            {(headItem === 'headphones' || legacyTuft) && (
              <g className="waddle-cosmetic-headphones">
                <path d="M28 54 C28 10 92 10 92 54" fill="none" stroke="#0ea5e9" strokeWidth="4.2" strokeLinecap="round" />
                <path d="M44 15 C52 13 68 13 76 15" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                <rect x="23" y="44" width="9" height="18" rx="4.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                <circle cx="27.5" cy="53" r="2" fill="#38bdf8" />
                <rect x="88" y="44" width="9" height="18" rx="4.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                <circle cx="92.5" cy="53" r="2" fill="#38bdf8" />
              </g>
            )}

            {headItem === 'crown' && (
              <g className="waddle-cosmetic-crown">
                <polygon points="42,26 42,14 51,20 60,8 69,20 78,14 78,26" fill="#fbbf24" stroke="#d97706" strokeWidth="1.2" />
                <rect x="42" y="24" width="36" height="3" fill="#f59e0b" />
                <circle cx="60" cy="18" r="2.2" fill="#ef4444" stroke="#991b1b" strokeWidth="0.6" />
                <circle cx="49" cy="20" r="1.6" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.5" />
                <circle cx="71" cy="20" r="1.6" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.5" />
              </g>
            )}

            {/* Body Cosmetics */}
            {bodyItem === 'tie' && (
              <g className="waddle-cosmetic-tie">
                <polygon points="56,62 64,62 66,67 60,70 54,67" fill="#b91c1c" />
                <polygon points="56,69 64,69 66,93 60,99 54,93" fill="#dc2626" />
                <line x1="56" y1="65" x2="64" y2="65" stroke="#7f1d1d" strokeWidth="1" />
              </g>
            )}

            {bodyItem === 'bowtie' && (
              <g className="waddle-cosmetic-bowtie">
                <polygon points="60,65 51,60 51,70" fill="#a855f7" stroke="#7e22ce" strokeWidth="0.8" />
                <polygon points="60,65 69,60 69,70" fill="#a855f7" stroke="#7e22ce" strokeWidth="0.8" />
                <rect x="58.5" y="63" width="3" height="4" rx="1" fill="#7e22ce" />
              </g>
            )}

            {(bodyItem === 'whistle' || marking === 'whistle') && (
              <g className="waddle-cosmetic-whistle">
                <path d="M50 58 Q60 68 70 58" fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="58" cy="74" r="5" fill="#94a3b8" stroke="#475569" strokeWidth="0.8" />
                <rect x="58" y="70" width="7" height="4" rx="1" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
                <circle cx="58" cy="74" r="2" fill="#475569" />
              </g>
            )}

            {/* Hand Cosmetics */}
            {handItem === 'coffee' && (
              <g className="waddle-cosmetic-coffee">
                <rect x="74" y="72" width="14" height="15" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
                <path d="M88 74 Q94 79 88 84" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                <ellipse cx="81" cy="74" rx="5" ry="1.5" fill="#78350f" />
                <path d="M78 69 Q76 66 79 63" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M83 70 Q85 66 82 62" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
              </g>
            )}
          </g>
        </g>
      </svg>
      {showPresence && state !== 'idle' && <span className="waddle-presence-dot" />}
      {bubble && quote && <span className="waddle-bubble">{quote}</span>}
    </div>
  );
};
export default WaddleAvatar;
