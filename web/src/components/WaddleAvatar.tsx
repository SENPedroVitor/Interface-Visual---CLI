import React, { useEffect, useRef, useState } from 'react';
import { registerEye } from '../lib/eyeTracker';
import './WaddleAvatar.css';

export type AgentState =
  | 'idle' | 'listening' | 'thinking' | 'planning' | 'waiting'
  | 'working' | 'creating' | 'done' | 'blocked' | 'stopped';
export type MarkingType = 'none' | 'chevron' | 'tuft' | 'chinstrap' | 'tie' | 'whistle';
export type ClickAnim = 'hop' | 'fast' | 'jump2' | 'tilt';

export interface AvatarCosmetics {
  head?: 'none' | 'luffy_hat' | 'headphones' | 'crown' | string;
  face?: 'none' | 'zoro_scar' | 'glasses' | 'sunglasses' | string;
  body?: 'none' | 'tie' | 'bowtie' | 'whistle' | string;
  hand?: 'none' | 'coffee' | string;
}

export const STATE_LABELS: Record<AgentState, string> = {
  idle: 'Disponível', listening: 'Ouvindo', thinking: 'Pensando', planning: 'Planejando',
  waiting: 'Aguardando', working: 'Trabalhando', creating: 'Criando',
  done: 'Concluído', blocked: 'Precisa de atenção', stopped: 'Parado',
};

export interface WaddleAvatarProps {
  color?: string; state?: AgentState; size?: number; className?: string;
  showPresence?: boolean; trackMouse?: boolean; interactive?: boolean;
  marking?: MarkingType; clickAnim?: ClickAnim; quote?: string; plain?: boolean;
  gazeX?: number; onClick?: () => void;
  cosmetics?: AvatarCosmetics;
  imageUrl?: string;
  motion?: 'off' | 'standard' | 'organic';
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

function getContrastEyeColor(hexColor: string): string {
  if (!hexColor) return '#181820';
  const hex = hexColor.replace('#', '');
  const fullHex = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const r = parseInt(fullHex.substring(0, 2), 16) || 0;
  const g = parseInt(fullHex.substring(2, 4), 16) || 0;
  const b = parseInt(fullHex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0f172a' : '#ffffff';
}

export const WaddleAvatar: React.FC<WaddleAvatarProps> = ({
  color, state = 'idle', size = 36, className = '', showPresence = false,
  trackMouse = false, interactive = false, marking = 'none', clickAnim = 'hop',
  quote, gazeX = 0, onClick, imageUrl, cosmetics,
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

  const isCustomUploadedImage = Boolean(
    imageUrl && (
      imageUrl.startsWith('data:') ||
      imageUrl.startsWith('http:') ||
      imageUrl.startsWith('https:') ||
      imageUrl.startsWith('blob:')
    )
  );

  // Compute palette / color
  let faceColor = '#f3f4f6';
  let eyeColor = '#1e1e1e';

  const stockPalette = imageUrl ? officialPalette(imageUrl) : null;

  if (color) {
    faceColor = color;
    eyeColor = getContrastEyeColor(color);
  } else if (stockPalette) {
    faceColor = stockPalette.face;
    eyeColor = stockPalette.eyes;
  } else if (marking === 'chevron') {
    faceColor = '#bfe8db';
    eyeColor = '#123f3a';
  } else if (marking === 'tuft') {
    faceColor = '#bed5ff';
    eyeColor = '#14284b';
  } else if (marking === 'chinstrap') {
    faceColor = '#bce7cb';
    eyeColor = '#16382a';
  } else if (marking === 'tie') {
    faceColor = '#e7d1b8';
    eyeColor = '#3a2a1d';
  } else if (marking === 'whistle') {
    faceColor = '#bfdcff';
    eyeColor = '#1e3a5f';
  }

  const manualGazeX = Math.max(-1, Math.min(1, gazeX)) * 3.2;

  useEffect(() => {
    const gaze = gazeRef.current;
    const stateAllowsPointerGaze = state === 'idle' || state === 'waiting';
    if (!gaze || isCustomUploadedImage || !trackMouse || !stateAllowsPointerGaze) return undefined;
    return registerEye(gaze, 50, 52, 3.2);
  }, [faceColor, state, trackMouse, isCustomUploadedImage]);

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
      {isCustomUploadedImage ? (
        <img
          className="waddle-avatar-image"
          src={imageUrl}
          alt=""
          style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%', display: 'block' }}
        />
      ) : (
        <svg
          className="waddle-vector-avatar"
          viewBox="0 0 100 100"
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
        >
          <g className="waddle-body">
            <rect x="14" y="30" width="72" height="42" rx="21" fill={faceColor} />
            <g className={`waddle-eye-state waddle-eye-state--${state}`}>
              <g ref={gazeRef} className="waddle-gaze">
                <g className="waddle-manual-gaze" transform={`translate(${manualGazeX} 0)`}>
                  <ellipse className="waddle-eye-shape" cx="37" cy="52" rx="4.4" ry="5.8" fill={eyeColor} />
                  <ellipse className="waddle-eye-shape" cx="63" cy="52" rx="4.4" ry="5.8" fill={eyeColor} />
                </g>
              </g>
            </g>

            {/* Cosmetics: Body */}
            {cosmetics?.body === 'tie' && (
              <g className="cosmetic-tie">
                <polygon points="47,68 53,68 52,71 48,71" fill="#dc2626" />
                <polygon points="48,71 52,71 54,86 50,90 46,86" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.8" />
              </g>
            )}
            {cosmetics?.body === 'money_tie' && (
              <g className="cosmetic-money-tie">
                <polygon points="47,68 53,68 52,71 48,71" fill="#059669" />
                <polygon points="48,71 52,71 54,86 50,90 46,86" fill="#10b981" stroke="#047857" strokeWidth="0.8" />
                <text x="50" y="81" fontSize="7" fontWeight="bold" textAnchor="middle" fill="#ecfdf5">$</text>
              </g>
            )}
            {cosmetics?.body === 'bowtie' && (
              <g className="cosmetic-bowtie">
                <polygon points="42,67 50,71 42,75" fill="#6366f1" stroke="#4338ca" strokeWidth="0.8" />
                <polygon points="58,67 50,71 58,75" fill="#6366f1" stroke="#4338ca" strokeWidth="0.8" />
                <circle cx="50" cy="71" r="2.2" fill="#4f46e5" />
              </g>
            )}
            {cosmetics?.body === 'whistle' && (
              <g className="cosmetic-whistle">
                <path d="M42 66 Q 50 72 58 66" fill="none" stroke="#64748b" strokeWidth="1.2" />
                <rect x="47" y="70" width="8" height="5" rx="1.5" fill="#94a3b8" stroke="#475569" strokeWidth="0.8" />
                <circle cx="48" cy="72.5" r="1.8" fill="#cbd5e1" />
              </g>
            )}
            {cosmetics?.body === 'leaf_badge' && (
              <g className="cosmetic-leaf">
                <path d="M28 66 C 26 60, 36 60, 36 68 C 36 72, 30 72, 28 66 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.8" />
                <line x1="29" y1="67" x2="34" y2="63" stroke="#166534" strokeWidth="0.8" />
              </g>
            )}

            {/* Cosmetics: Face */}
            {cosmetics?.face === 'glasses' && (
              <g className="cosmetic-glasses">
                <rect x="27" y="44" width="18" height="16" rx="4" fill="none" stroke="#1e293b" strokeWidth="2" />
                <rect x="55" y="44" width="18" height="16" rx="4" fill="none" stroke="#1e293b" strokeWidth="2" />
                <path d="M45 51 Q 50 48 55 51" fill="none" stroke="#1e293b" strokeWidth="2" />
                <line x1="27" y1="49" x2="16" y2="47" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="73" y1="49" x2="84" y2="47" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            )}
            {cosmetics?.face === 'sunglasses' && (
              <g className="cosmetic-sunglasses">
                <polygon points="26,45 45,45 43,59 28,59" fill="#09090b" stroke="#27272a" strokeWidth="1.2" />
                <polygon points="55,45 74,45 72,59 57,59" fill="#09090b" stroke="#27272a" strokeWidth="1.2" />
                <line x1="45" y1="46" x2="55" y2="46" stroke="#09090b" strokeWidth="2.5" />
                <line x1="29" y1="48" x2="41" y2="56" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
                <line x1="58" y1="48" x2="70" y2="56" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
              </g>
            )}
            {cosmetics?.face === 'zoro_scar' && (
              <g className="cosmetic-zoro-scar">
                <line x1="31" y1="42" x2="43" y2="62" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                <line x1="33" y1="48" x2="37" y2="46" stroke="#991b1b" strokeWidth="1" />
                <line x1="37" y1="56" x2="41" y2="54" stroke="#991b1b" strokeWidth="1" />
              </g>
            )}

            {/* Cosmetics: Head */}
            {cosmetics?.head === 'crown' && (
              <g className="cosmetic-crown">
                <polygon points="34,31 38,18 44,25 50,16 56,25 62,18 66,31" fill="#f59e0b" stroke="#b45309" strokeWidth="1.2" />
                <rect x="34" y="29" width="32" height="3.5" rx="1.5" fill="#d97706" />
                <circle cx="50" cy="20" r="1.5" fill="#ef4444" />
                <circle cx="38" cy="22" r="1.2" fill="#3b82f6" />
                <circle cx="62" cy="22" r="1.2" fill="#22c55e" />
              </g>
            )}
            {cosmetics?.head === 'luffy_hat' && (
              <g className="cosmetic-luffy-hat">
                <ellipse cx="50" cy="30" rx="26" ry="6" fill="#fbbf24" stroke="#d97706" strokeWidth="1.2" />
                <path d="M36 30 C36 17, 64 17, 64 30 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="1.2" />
                <path d="M37 27 C43 25, 57 25, 63 27 L63 29 C57 27, 43 27, 37 29 Z" fill="#ef4444" />
              </g>
            )}
            {cosmetics?.head === 'headphones' && (
              <g className="cosmetic-headphones">
                <path d="M22 50 A 28 28 0 0 1 78 50" fill="none" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
                <path d="M22 50 A 28 28 0 0 1 78 50" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
                <rect x="15" y="42" width="7" height="18" rx="3.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
                <rect x="78" y="42" width="7" height="18" rx="3.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
              </g>
            )}
            {cosmetics?.head === 'sports_headband' && (
              <g className="cosmetic-sports-headband">
                <rect x="14" y="32" width="72" height="7" rx="3.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.8" />
                <line x1="16" y1="35.5" x2="84" y2="35.5" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            )}

            {/* Cosmetics: Hand */}
            {cosmetics?.hand === 'coffee' && (
              <g className="cosmetic-coffee">
                <rect x="76" y="55" width="12" height="13" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
                <path d="M88 58 C 91 58, 91 64, 88 64" fill="none" stroke="#94a3b8" strokeWidth="1.2" />
                <ellipse cx="82" cy="56" rx="5" ry="1.5" fill="#78350f" />
                <path d="M79 52 Q 80 50 79 48" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />
                <path d="M83 51 Q 84 49 83 47" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />
              </g>
            )}
          </g>
        </svg>
      )}
      {showPresence && state !== 'idle' && <span className="waddle-presence-dot" />}
      {bubble && quote && <span className="waddle-bubble">{quote}</span>}
    </div>
  );
};

export default WaddleAvatar;
