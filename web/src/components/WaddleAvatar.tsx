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
  bodyShape?: 'pill' | 'circle' | 'squircle' | 'crown' | string;
}

export type EyeStyle = 'default' | 'nico' | 'slashes';
export type BodyShape = 'pill' | 'circle' | 'squircle' | 'crown';

export const STATE_LABELS: Record<AgentState, string> = {
  idle: 'Disponível', working: 'Trabalhando', thinking: 'Pensando',
  waiting: 'Aguardando', done: 'Pronto 😉', blocked: 'Dúvida (o que falta)', stopped: 'Parado',
};

export interface WaddleAvatarProps {
  color?: string; state?: AgentState; size?: number; className?: string;
  showPresence?: boolean; trackMouse?: boolean; interactive?: boolean;
  marking?: MarkingType; clickAnim?: ClickAnim; quote?: string; plain?: boolean;
  gazeX?: number;
  gazeY?: number;
  onClick?: () => void;
  cosmetics?: AvatarCosmetics;
  imageUrl?: string;
  eyeStyle?: EyeStyle;
  bodyShape?: BodyShape;
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
  quote: _quote, gazeX = 0, gazeY = 0, onClick, imageUrl, cosmetics, eyeStyle = 'default',
  bodyShape,
}) => {
  const [jump, setJump] = useState(false);
  const [isAnnoyed, setIsAnnoyed] = useState(false);
  const jumpTimer = useRef<ReturnType<typeof setTimeout>>();
  const annoyedTimer = useRef<ReturnType<typeof setTimeout>>();
  const gazeRef = useRef<SVGGElement>(null);
  const activeBodyShape: BodyShape = bodyShape || (cosmetics?.bodyShape as BodyShape) || (cosmetics?.head === 'crown' ? 'crown' : 'pill');

  useEffect(() => () => {
    clearTimeout(jumpTimer.current);
    clearTimeout(annoyedTimer.current);
  }, []);

  const reactToClick = () => {
    if (interactive) {
      setIsAnnoyed(true);
      setJump(true);
      clearTimeout(jumpTimer.current);
      jumpTimer.current = setTimeout(() => setJump(false), 700);
      clearTimeout(annoyedTimer.current);
      annoyedTimer.current = setTimeout(() => setIsAnnoyed(false), 1400);
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

  const isNicoEyes = eyeStyle === 'nico' || cosmetics?.face === 'nico_eyes' || state === 'blocked';
  const isSlashesEyes = !isNicoEyes && (eyeStyle === 'slashes' || cosmetics?.face === 'slashes_eyes');
  const manualGazeX = Math.max(-1, Math.min(1, gazeX)) * 3.2;
  const manualGazeY = Math.max(-1, Math.min(1, gazeY)) * 2.8;

  useEffect(() => {
    const gaze = gazeRef.current;
    const stateAllowsPointerGaze = state === 'idle' || state === 'waiting';
    if (!gaze || isCustomUploadedImage || !trackMouse || !stateAllowsPointerGaze) return undefined;
    return registerEye(gaze, 50, 52, 3.2);
  }, [faceColor, state, trackMouse, isCustomUploadedImage]);

  return (
    <div
      className={`waddle-avatar-wrapper ${className} ${isAnnoyed ? 'is-annoyed' : ''}`}
      data-state={state}
      data-reaction={isAnnoyed ? 'annoyed' : jump ? clickAnim : undefined}
      data-interactive={interactive || undefined}
      style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={reactToClick}
      title={STATE_LABELS[state]}
    >
      {isCustomUploadedImage ? (
        <>
          <img
            className="waddle-avatar-image"
            src={imageUrl}
            alt=""
            style={{
              width: size,
              height: size,
              objectFit: 'cover',
              borderRadius: '50%',
              display: 'block',
              opacity: (state === 'thinking' || state === 'blocked') ? 0 : 1,
              transform: manualGazeY > 0 ? `translateY(${Math.min(manualGazeY * 0.5, 2)}px)` : undefined,
              transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />

          {state === 'thinking' && (
            <svg
              className="waddle-vector-avatar"
              viewBox="0 0 100 100"
              width={size}
              height={size}
              style={{ position: 'absolute', inset: 0 }}
              aria-hidden="true"
              focusable="false"
            >
              <g className="waddle-thinking-dots" style={{ opacity: 1, transform: 'scale(1)' }} aria-label="Pensando">
                <circle className="waddle-thinking-dot dot-1" cx="28" cy="50" r="7.5" fill={faceColor} stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" />
                <circle className="waddle-thinking-dot dot-2" cx="50" cy="50" r="7.5" fill={faceColor} stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" />
                <circle className="waddle-thinking-dot dot-3" cx="72" cy="50" r="7.5" fill={faceColor} stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" />
              </g>
            </svg>
          )}
          {state === 'blocked' && (
            <svg
              className="waddle-vector-avatar"
              viewBox="0 0 100 100"
              width={size}
              height={size}
              style={{ position: 'absolute', inset: 0 }}
              aria-hidden="true"
              focusable="false"
            >
              <g className="waddle-blocked-mark" style={{ opacity: 1, transform: 'scale(1)' }} aria-label="Bloqueado / Dúvida">
                <path
                  className="waddle-blocked-stem"
                  d="M 45.5 29 C 45.5 26 54.5 26 54.5 29 L 53.2 59 C 53.2 61.2 46.8 61.2 46.8 59 Z"
                  fill={eyeColor}
                />
                <circle className="waddle-blocked-dot" cx="50" cy="70.5" r="4.3" fill={eyeColor} />
              </g>
            </svg>
          )}
        </>
      ) : (
        <svg
          className="waddle-vector-avatar"
          viewBox="0 0 100 100"
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
        >
          <g className="waddle-thinking-dots" aria-label="Pensando">
            <circle className="waddle-thinking-dot dot-1" cx="28" cy="50" r="7.5" fill={faceColor} stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" />
            <circle className="waddle-thinking-dot dot-2" cx="50" cy="50" r="7.5" fill={faceColor} stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" />
            <circle className="waddle-thinking-dot dot-3" cx="72" cy="50" r="7.5" fill={faceColor} stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" />
          </g>
          <g className="waddle-blocked-mark" aria-label="Bloqueado / Dúvida">
            <path
              className="waddle-blocked-stem"
              d="M 45.5 29 C 45.5 26 54.5 26 54.5 29 L 53.2 59 C 53.2 61.2 46.8 61.2 46.8 59 Z"
              fill={eyeColor}
            />
            <circle className="waddle-blocked-dot" cx="50" cy="70.5" r="4.3" fill={eyeColor} />
          </g>
          <g className="waddle-body" data-shape={activeBodyShape}>
            {activeBodyShape === 'crown' ? (
              <path
                className="waddle-body-shape waddle-body-crown"
                d="M 14 51 L 14 36 Q 14 32, 19 29 L 23 23 Q 26 19, 29 23 L 35 29 Q 38 31, 41 28 L 47 19 Q 50 15, 53 19 L 59 28 Q 62 31, 65 29 L 71 23 Q 74 19, 77 23 L 81 29 Q 86 32, 86 36 L 86 51 A 21 21 0 0 1 65 72 L 35 72 A 21 21 0 0 1 14 51 Z"
                fill={faceColor}
              />
            ) : activeBodyShape === 'circle' ? (
              <circle cx="50" cy="51" r="30" fill={faceColor} />
            ) : activeBodyShape === 'squircle' ? (
              <rect x="21" y="22" width="58" height="58" rx="18" fill={faceColor} />
            ) : (
              <rect x="14" y="30" width="72" height="42" rx="21" fill={faceColor} />
            )}

            {/* Emblemas & Logos no Corpo */}
            {cosmetics?.body === 'figma' && (
              <g
                className="cosmetic-emblem cosmetic-figma"
                transform={`translate(50, 51) scale(${activeBodyShape === 'pill' ? 0.92 : 1.15})`}
              >
                {/* 5 peças icônicas da logo do Figma */}
                <path d="M -9 -13.5 L 0 -13.5 L 0 -4.5 L -9 -4.5 A 4.5 4.5 0 0 1 -9 -13.5 Z" fill="#F24E1E" />
                <path d="M 0 -13.5 L 9 -13.5 A 4.5 4.5 0 0 1 9 -4.5 L 0 -4.5 Z" fill="#A259FF" />
                <path d="M -9 -4.5 L 0 -4.5 L 0 4.5 L -9 4.5 A 4.5 4.5 0 0 1 -9 -4.5 Z" fill="#FF7262" />
                <circle cx="4.5" cy="0" r="4.5" fill="#1ABCFE" />
                <path d="M -9 4.5 L 0 4.5 L 0 9 A 4.5 4.5 0 0 1 -4.5 13.5 A 4.5 4.5 0 0 1 -9 9 Z" fill="#0ACF83" />
              </g>
            )}

            {cosmetics?.body === 'dev_code' && (
              <g className="cosmetic-emblem cosmetic-dev-code" transform="translate(50, 51)">
                <rect x="-19" y="-9.5" width="38" height="19" rx="5" fill="rgba(0,0,0,0.28)" />
                <text x="0" y="3.5" fontFamily="var(--font-mono, monospace)" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#38bdf8">&lt;/&gt;</text>
              </g>
            )}

            {cosmetics?.body === 'terminal' && (
              <g className="cosmetic-emblem cosmetic-terminal" transform="translate(50, 51)">
                <rect x="-19" y="-9.5" width="38" height="19" rx="5" fill="rgba(0,0,0,0.32)" />
                <text x="-2" y="3.5" fontFamily="var(--font-mono, monospace)" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#4ade80">&gt;_</text>
              </g>
            )}

            {cosmetics?.body === 'react' && (
              <g className="cosmetic-emblem cosmetic-react" transform="translate(50, 51) scale(0.85)">
                <ellipse cx="0" cy="0" rx="14" ry="5" fill="none" stroke="#61dafb" strokeWidth="1.2" opacity="0.9" />
                <ellipse cx="0" cy="0" rx="14" ry="5" fill="none" stroke="#61dafb" strokeWidth="1.2" opacity="0.9" transform="rotate(60)" />
                <ellipse cx="0" cy="0" rx="14" ry="5" fill="none" stroke="#61dafb" strokeWidth="1.2" opacity="0.9" transform="rotate(120)" />
                <circle cx="0" cy="0" r="2.2" fill="#61dafb" />
              </g>
            )}

            {cosmetics?.body === 'python' && (
              <g className="cosmetic-emblem cosmetic-python" transform="translate(50, 51) scale(0.65)">
                <path d="M -1.5 -13 C -8 -13 -10 -10 -10 -6 L -10 -3 L -1 -3 L -1 -1 L -12 -1 C -16 -1 -16 5 -16 8 C -16 12 -12 13 -8 13 L -5 13 L -5 10 C -5 7 -2 5 1 5 L 5 5 C 7 5 9 3 9 0 L 9 -6 C 9 -10 6 -13 -1.5 -13 Z" fill="#387eb8" />
                <path d="M 1.5 13 C 8 13 10 10 10 6 L 10 3 L 1 3 L 1 1 L 12 1 C 16 1 16 -5 16 -8 C 16 -12 12 -13 8 -13 L 5 -13 L 5 -10 C 5 -7 2 -5 -1 -5 L -5 -5 C -7 -5 -9 -3 -9 0 L -9 6 C -9 10 -6 13 1.5 13 Z" fill="#ffe052" />
                <circle cx="-5" cy="-8" r="1.2" fill="#ffffff" />
                <circle cx="5" cy="8" r="1.2" fill="#ffffff" />
              </g>
            )}

            {cosmetics?.body === 'github' && (
              <g className="cosmetic-emblem cosmetic-github" transform="translate(50, 51) scale(0.75)">
                <circle cx="0" cy="0" r="13" fill="rgba(0,0,0,0.3)" />
                <path d="M0 -10 C -5.5 -10 -10 -5.5 -10 0 C -10 4.4 -7.1 8.1 -3.2 9.4 C -2.7 9.5 -2.5 9.2 -2.5 8.9 L -2.5 7.1 C -5.3 7.7 -5.9 5.8 -5.9 5.8 C -6.3 4.7 -7 4.4 -7 4.4 C -7.9 3.8 -6.9 3.8 -6.9 3.8 C -5.9 3.9 -5.4 4.9 -5.4 4.9 C -4.5 6.4 -3.1 6 -2.5 5.7 C -2.4 5 -2.1 4.5 -1.8 4.2 C -4 4 -6.4 3.1 -6.4 -0.7 C -6.4 -1.8 -6 -2.7 -5.3 -3.4 C -5.4 -3.7 -5.8 -4.7 -5.2 -6.1 C -5.2 -6.1 -4.3 -6.4 -2.3 -5 C -1.4 -5.2 -0.5 -5.3 0.4 -5.3 C 1.3 -5.3 2.2 -5.2 3.1 -5 C 5.1 -6.4 6 -6.1 6 -6.1 C 6.6 -4.7 6.2 -3.7 6.1 -3.4 C 6.8 -2.7 7.2 -1.8 7.2 -0.7 C 7.2 3.1 4.8 4 2.6 4.2 C 3 4.5 3.3 5.2 3.3 6.2 L 3.3 8.9 C 3.3 9.2 3.5 9.5 4 9.4 C 7.9 8.1 10.8 4.4 10.8 0 C 10.8 -5.5 6.3 -10 0 -10 Z" fill="#ffffff" />
              </g>
            )}

            <g className={`waddle-eye-state waddle-eye-state--${state}`}>
              <g ref={gazeRef} className="waddle-gaze">
                <g className="waddle-manual-gaze" transform={`translate(${manualGazeX} ${manualGazeY})`}>
                  {isAnnoyed ? (
                    <g className="waddle-eyes-annoyed" aria-label="Olhos irritados">
                      <path
                        className="waddle-eye-shape waddle-eye-annoyed-left"
                        d="M 32.6 49.5 L 41.4 54.5 A 4.4 5.8 0 0 1 32.6 49.5 Z"
                        fill={eyeColor}
                      />
                      <path
                        className="waddle-eye-shape waddle-eye-annoyed-right"
                        d="M 67.4 49.5 L 58.6 54.5 A 4.4 5.8 0 0 0 67.4 49.5 Z"
                        fill={eyeColor}
                      />
                    </g>
                  ) : isNicoEyes ? (
                    <g className="waddle-eyes-nico">
                      <rect
                        className="waddle-eye-shape waddle-eye-nico-left"
                        x="32.5"
                        y="41.5"
                        width="9"
                        height="19"
                        rx="4.5"
                        fill={eyeColor}
                        transform="rotate(6 37 51)"
                      />
                      <rect
                        className="waddle-eye-shape waddle-eye-nico-right"
                        x="53"
                        y="48"
                        width="19"
                        height="6.2"
                        rx="3.1"
                        fill={eyeColor}
                        transform="rotate(8 62.5 51.1)"
                      />
                    </g>
                  ) : isSlashesEyes ? (
                    <g className="waddle-eyes-slashes">
                      <rect
                        className="waddle-eye-shape waddle-eye-slashes-left"
                        x="33.5"
                        y="42"
                        width="7.5"
                        height="18"
                        rx="3.75"
                        fill={eyeColor}
                        transform="rotate(18 37.25 51)"
                      />
                      <rect
                        className="waddle-eye-shape waddle-eye-slashes-right"
                        x="52.5"
                        y="42"
                        width="7.5"
                        height="18"
                        rx="3.75"
                        fill={eyeColor}
                        transform="rotate(18 56.25 51)"
                      />
                    </g>
                  ) : (
                    <>
                      <ellipse className="waddle-eye-shape waddle-eye-left" cx="37" cy="52" rx="4.4" ry="5.8" fill={eyeColor} />
                      <ellipse className="waddle-eye-shape waddle-eye-right" cx="63" cy="52" rx="4.4" ry="5.8" fill={eyeColor} />
                    </>
                  )}
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
    </div>
  );
};

export default WaddleAvatar;
