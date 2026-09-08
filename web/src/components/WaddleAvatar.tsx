import React, { useId, useState, useEffect, useRef } from 'react';
import { registerEye } from '../lib/eyeTracker';

export type AgentState = 'idle' | 'working' | 'thinking' | 'done' | 'blocked' | 'stopped';

/** Species-style marking, same idea as the reference flock: a role gets a
 * matching marking/accessory (see utils/agentVisuals.ts), not an arbitrary
 * skin. */
export type MarkingType = 'none' | 'chevron' | 'tuft' | 'chinstrap';

export type ClickAnim = 'hop' | 'fast' | 'jump2' | 'tilt';

const JUMP_DURATION_MS: Record<ClickAnim, number> = {
  hop: 550,
  fast: 450,
  jump2: 780,
  tilt: 750,
};

interface EyeConfig {
  cx: number; // center x of the eye pair
  y: number;
  gap: number; // half-distance between the two eyes
  r: number; // dot radius
}

interface MarkingConfig {
  body: { cx: number; cy: number; rx: number; ry: number };
  /** Extra body plumage (eyebrow arc, tufts) — raw SVG, painted right after the body. */
  bodyMarks?: (clipId: string) => string;
  belly: { cy: number; rx: number; ry: number } | null;
  /** Drawn between the belly and the beak (e.g. the chinstrap's throat line). */
  front?: () => string;
  beak: { y: number; w: number; h: number } | null;
  eye: EyeConfig;
  /** The accessory that reads as personality at a glance — hat, goggles, headphones, scar. */
  accessory?: (eye: EyeConfig) => string;
  tilt?: number;
  scale?: number;
}

const MARKING_CONFIG: Record<MarkingType, MarkingConfig> = {
  none: {
    body: { cx: 60, cy: 61, rx: 43, ry: 47 },
    belly: { cy: 83, rx: 27, ry: 19 },
    beak: { y: 52, w: 7, h: 11 },
    eye: { cx: 63, y: 42, gap: 10, r: 4.8 },
    accessory: () =>
      '<ellipse cx="60" cy="14" rx="32" ry="7.5" fill="#F5C542"/>' +
      '<rect x="45" y="0" width="30" height="14" rx="5" fill="#F5C542"/>' +
      '<path d="M45 8h30v1.5c0 3.5-2.5 5-6 5h-18c-3.5 0-6-1.5-6-5z" fill="#E5484D"/>',
  },
  chevron: {
    body: { cx: 60, cy: 64, rx: 50, ry: 40 },
    bodyMarks: (clipId) =>
      `<defs><clipPath id="${clipId}"><ellipse cx="60" cy="64" rx="50" ry="40"/></clipPath></defs>` +
      `<g clip-path="url(#${clipId})">` +
      '<path d="M40 36 Q46 18 60 17 Q74 18 80 36" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '</g>',
    belly: { cy: 84, rx: 31, ry: 16 },
    beak: { y: 52, w: 7, h: 10 },
    eye: { cx: 58, y: 44, gap: 10, r: 4.5 },
    accessory: (eye) => {
      const L = eye.cx - eye.gap;
      const R = eye.cx + eye.gap;
      const y = eye.y;
      return (
        `<path d="M${L - 10} ${y - 2} L20 ${y - 8}" stroke="#1D1D1F" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M${R + 10} ${y - 2} L100 ${y - 8}" stroke="#1D1D1F" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="${L}" cy="${y}" r="11" fill="rgba(255,255,255,.28)" stroke="#1D1D1F" stroke-width="3"/>` +
        `<circle cx="${R}" cy="${y}" r="11" fill="rgba(255,255,255,.28)" stroke="#1D1D1F" stroke-width="3"/>`
      );
    },
  },
  tuft: {
    body: { cx: 60, cy: 64, rx: 38, ry: 41 },
    bodyMarks: () =>
      '<g stroke="#facc15" stroke-width="4.5" stroke-linecap="round" fill="none">' +
      '<path d="M41 38 Q31 28 27 18"/><path d="M47 32 Q42 21 40 12"/>' +
      '<path d="M79 38 Q89 28 93 18"/><path d="M73 32 Q78 21 80 12"/>' +
      '</g>',
    belly: { cy: 84, rx: 23, ry: 15 },
    beak: { y: 54, w: 6.5, h: 10 },
    eye: { cx: 62, y: 46, gap: 9.5, r: 4.3 },
    accessory: () =>
      '<path d="M18 60 A44 44 0 0 1 102 60" stroke="#F5F5F7" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<circle cx="18" cy="64" r="10" fill="#F5F5F7"/><circle cx="102" cy="64" r="10" fill="#F5F5F7"/>' +
      '<circle cx="18" cy="64" r="4" fill="#17171A"/><circle cx="102" cy="64" r="4" fill="#17171A"/>',
    tilt: -4,
  },
  chinstrap: {
    body: { cx: 60, cy: 58, rx: 37, ry: 49 },
    belly: { cy: 80, rx: 21, ry: 23 },
    front: () => '<path d="M42 62 Q60 71 78 62" stroke="#1D1D1F" stroke-width="4" fill="none" stroke-linecap="round"/>',
    beak: { y: 50, w: 6.5, h: 10 },
    eye: { cx: 56, y: 40, gap: 9, r: 4.5 },
    accessory: (eye) => {
      const x = eye.cx - eye.gap;
      const y = eye.y;
      const scar = (d: string, wOut: number, wIn: number) =>
        `<path d="${d}" stroke="#F1E9DC" stroke-width="${wOut}" fill="none" stroke-linecap="round"/>` +
        `<path d="${d}" stroke="#26262A" stroke-width="${wIn}" fill="none" stroke-linecap="round"/>`;
      return (
        scar(`M${x - 2} ${y - 11} L${x + 2} ${y + 11}`, 5, 2) +
        scar(`M${x - 7} ${y - 2} L${x + 6} ${y - 4}`, 3.5, 1.4) +
        scar(`M${x - 6} ${y + 7} L${x + 7} ${y + 5}`, 3.5, 1.4)
      );
    },
    tilt: -2.5,
  },
};

export interface WaddleAvatarProps {
  /** Agent accent color or custom body color (defaults to classic dark penguin #1e1e1e) */
  color?: string;
  /** State drives expression and animation: idle, working, thinking, done, blocked, stopped */
  state?: AgentState;
  /** Size in pixels (width and height) */
  size?: number;
  className?: string;
  /** Whether to show the active working indicator badge */
  showPresence?: boolean;
  /** Whether the eyes follow the cursor */
  trackMouse?: boolean;
  /** Whether clicking produces a jump reaction (and a quote bubble, if provided) */
  interactive?: boolean;
  /** Species-style marking/accessory distinguishing this agent's role at a glance */
  marking?: MarkingType;
  /** Which jump signature plays on click */
  clickAnim?: ClickAnim;
  /** Short line shown in a speech bubble on click. Omit to skip the bubble entirely. */
  quote?: string;
  /** Skips the accessory — for tiny/brand contexts where a hat or goggles would be visual noise. */
  plain?: boolean;
  /**
   * Manual gaze override, -1 (full left) to 1 (full right), 0 = resting.
   * When set, the eyes ignore the cursor entirely and point this way instead
   * — e.g. following text as it's typed. Smoothed with a CSS transition
   * rather than the cursor engine's per-frame lerp, since it only changes a
   * few times a second (on keystrokes), not 60 times a second.
   */
  gazeX?: number;
  /** Optional click callback */
  onClick?: () => void;
}

/**
 * WaddleAvatar — Official Waddle Agent OS Mascot & Agent Avatar
 *
 * - A body silhouette + accessory per role (hat / goggles / headphones / scar)
 * - Eyes are two small white dots that shift a couple pixels toward the
 *   cursor, via a single shared engine (lib/eyeTracker) — reads each eye's
 *   real on-screen rest point through the *owning `<svg>`'s* transform
 *   matrix, so multiple avatars at different sizes all track correctly
 *   without feeding an element's own transform back into itself
 * - Natural autonomous blinking, independent of cursor tracking
 * - Interactive: click plays a per-agent jump (hop/fast/jump2/tilt) and,
 *   if a quote is provided, a speech bubble
 * - State-driven: idle, working (squint + pulse), thinking (curious gaze),
 *   blocked (patient hold), done (smiles), stopped (faded)
 */
export const WaddleAvatar: React.FC<WaddleAvatarProps> = ({
  color = '#1e1e1e',
  state = 'idle',
  size = 36,
  className = '',
  showPresence = true,
  trackMouse = false,
  interactive = false,
  marking = 'none',
  clickAnim = 'hop',
  quote,
  plain = false,
  gazeX,
  onClick,
}) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `waddle-clip-${uid}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const leftEyeRef = useRef<SVGCircleElement>(null);
  const rightEyeRef = useRef<SVGCircleElement>(null);

  const [isNaturalBlink, setIsNaturalBlink] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const jumpTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const bubbleTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const isStopped = state === 'stopped';
  const isWorking = state === 'working';
  const isThinking = state === 'thinking';
  const isBlocked = state === 'blocked';
  const isDone = state === 'done';

  const cfg = MARKING_CONFIG[marking] || MARKING_CONFIG.none;
  const scaledSize = Math.round(size * (cfg.scale || 1));

  const hasManualGaze = typeof gazeX === 'number';

  // Eyes only hand themselves to the cursor-tracking engine when there's no
  // fixed expression already dictated by the current state, and no manual
  // gaze override in play.
  const isTrackingEyes = !hasManualGaze && trackMouse && !isStopped && !isDone;
  const eyeMaxOffset = 2.2;

  useEffect(() => {
    if (!isTrackingEyes) return;
    const leftX = cfg.eye.cx - cfg.eye.gap;
    const rightX = cfg.eye.cx + cfg.eye.gap;
    const unregisterLeft = leftEyeRef.current
      ? registerEye(leftEyeRef.current, leftX, cfg.eye.y, eyeMaxOffset)
      : undefined;
    const unregisterRight = rightEyeRef.current
      ? registerEye(rightEyeRef.current, rightX, cfg.eye.y, eyeMaxOffset)
      : undefined;
    return () => {
      unregisterLeft?.();
      unregisterRight?.();
    };
  }, [isTrackingEyes, cfg.eye.cx, cfg.eye.gap, cfg.eye.y]);

  // Periodic natural autonomous blink
  useEffect(() => {
    if (isStopped) return;
    let blinkTimer: ReturnType<typeof setTimeout>;
    let openTimer: ReturnType<typeof setTimeout>;

    const scheduleBlink = () => {
      const nextDelay = 3000 + Math.random() * 2600; // 3.0s to 5.6s
      blinkTimer = setTimeout(() => {
        setIsNaturalBlink(true);
        openTimer = setTimeout(() => {
          setIsNaturalBlink(false);
          scheduleBlink();
        }, 150);
      }, nextDelay);
    };

    scheduleBlink();
    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(openTimer);
    };
  }, [isStopped]);

  useEffect(() => {
    return () => {
      clearTimeout(jumpTimeoutRef.current);
      clearTimeout(bubbleTimeoutRef.current);
    };
  }, []);

  const handleClick = () => {
    if (interactive) {
      setIsJumping(false);
      requestAnimationFrame(() => setIsJumping(true));
      clearTimeout(jumpTimeoutRef.current);
      jumpTimeoutRef.current = setTimeout(() => setIsJumping(false), JUMP_DURATION_MS[clickAnim]);

      if (quote) {
        setShowBubble(true);
        clearTimeout(bubbleTimeoutRef.current);
        bubbleTimeoutRef.current = setTimeout(() => setShowBubble(false), 1800 + quote.length * 35);
      }
    }
    onClick?.();
  };

  const motionClass =
    isJumping ? `waddle-jump-${clickAnim}` :
    isWorking ? 'waddle-motion-working' :
    isThinking ? 'waddle-motion-thinking' :
    isDone ? 'waddle-motion-done' :
    isBlocked ? 'waddle-motion-blocked' :
    isStopped ? 'waddle-motion-stopped' : 'waddle-motion-idle';

  const presenceColor = isBlocked ? '#f59e0b' : '#22c55e';

  // A simple white dot — shifts a couple pixels toward the cursor (or a
  // manual gazeX target) rather than rotating.
  function renderEye(eyeRef: React.RefObject<SVGCircleElement>, x: number) {
    const { y, r } = cfg.eye;
    let transformAttr: string | undefined;
    let gazingClass = '';
    if (hasManualGaze) {
      transformAttr = `translate(${gazeX! * 3} 0)`;
      gazingClass = 'waddle-eye-gazing';
    } else if (!isTrackingEyes) {
      const fx = isThinking ? -1.5 : 0;
      const fy = isThinking ? -2 : isBlocked ? 2.5 : 0;
      transformAttr = `translate(${fx} ${fy})`;
    }
    return (
      <g
        className="blink"
        style={{
          transform: isNaturalBlink ? 'scaleY(0.1)' : 'scaleY(1)',
          transformOrigin: `${x}px ${y}px`,
          transition: 'transform 0.08s ease-in-out',
        }}
      >
        <circle ref={eyeRef} className={gazingClass} cx={x} cy={y} r={r} fill="#ffffff" transform={transformAttr} />
      </g>
    );
  }

  const leftX = cfg.eye.cx - cfg.eye.gap;
  const rightX = cfg.eye.cx + cfg.eye.gap;
  const tiltAttr = cfg.tilt ? `rotate(${cfg.tilt} 60 70)` : undefined;

  return (
    <div
      ref={containerRef}
      className={`waddle-avatar-wrapper ${motionClass} ${className}`}
      data-state={state}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        opacity: isStopped ? 0.45 : isBlocked ? 0.72 : 1,
        cursor: interactive ? 'pointer' : 'inherit',
        transition: 'opacity 0.3s ease',
      }}
    >
      <svg
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
        width={scaledSize}
        height={scaledSize}
        style={{ overflow: 'visible', display: 'block' }}
      >
        <g transform={tiltAttr}>
          {/* Body silhouette */}
          <ellipse cx={cfg.body.cx} cy={cfg.body.cy} rx={cfg.body.rx} ry={cfg.body.ry} fill={color} />
          {cfg.bodyMarks && <g dangerouslySetInnerHTML={{ __html: cfg.bodyMarks(clipId) }} />}

          {/* White belly */}
          {cfg.belly && (
            <ellipse cx="60" cy={cfg.belly.cy} rx={cfg.belly.rx} ry={cfg.belly.ry} fill="#ffffff" />
          )}

          {cfg.front && <g dangerouslySetInnerHTML={{ __html: cfg.front() }} />}

          {/* Beak */}
          {cfg.beak && (
            <path
              d={`M${60 - cfg.beak.w} ${cfg.beak.y} L${60 + cfg.beak.w} ${cfg.beak.y} L60 ${cfg.beak.y + cfg.beak.h} Z`}
              fill="#ff7a18"
            />
          )}

          {/* Eyes or alternate expression */}
          {isDone ? (
            <g stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none">
              <path d={`M ${leftX - 7} ${cfg.eye.y} Q ${leftX} ${cfg.eye.y - 8} ${leftX + 7} ${cfg.eye.y}`} />
              <path d={`M ${rightX - 7} ${cfg.eye.y} Q ${rightX} ${cfg.eye.y - 8} ${rightX + 7} ${cfg.eye.y}`} />
            </g>
          ) : isStopped ? (
            <g stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" opacity="0.8">
              <line x1={leftX - 7} y1={cfg.eye.y} x2={leftX + 7} y2={cfg.eye.y} />
              <line x1={rightX - 7} y1={cfg.eye.y} x2={rightX + 7} y2={cfg.eye.y} />
            </g>
          ) : (
            <g style={{ transformOrigin: `${cfg.eye.cx}px ${cfg.eye.y}px` }}>
              {renderEye(leftEyeRef, leftX)}
              {renderEye(rightEyeRef, rightX)}
            </g>
          )}

          {/* Accessory — the personality read at a glance */}
          {!plain && cfg.accessory && <g dangerouslySetInnerHTML={{ __html: cfg.accessory(cfg.eye) }} />}
        </g>
      </svg>

      {/* Active Presence Badge (Working / Thinking / Blocked) */}
      {showPresence && (isWorking || isThinking || isBlocked) && (
        <span
          className="waddle-presence-dot"
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: Math.max(8, size * 0.26),
            height: Math.max(8, size * 0.26),
            borderRadius: '50%',
            background: presenceColor,
            border: '2px solid #ffffff',
            boxShadow: isBlocked
              ? '0 0 0 2px rgba(245, 158, 11, 0.2)'
              : '0 0 0 2px rgba(34, 197, 94, 0.2)',
          }}
        />
      )}

      {/* Speech bubble on click */}
      {showBubble && quote && <span className="waddle-bubble">{quote}</span>}

      <style>{`
        /* No idle/working/thinking/blocked ambient loop — the body stays
           still unless something real is happening: the eyes react to the
           cursor, an occasional natural blink, a one-shot bounce on done,
           and a one-shot jump on click. The presence dot (color) already
           carries the working/thinking/blocked distinction without needing
           the whole character to wiggle forever. */

        /* Done: happy bounce (one-shot — plays once, does not loop) */
        .waddle-avatar-wrapper.waddle-motion-done svg {
          animation: waddleDoneBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
          transform-origin: 50% 50%;
        }

        /* Click reactions — one per agent personality, one-shot */
        .waddle-avatar-wrapper.waddle-jump-hop svg   { animation: waddleJumpHop 0.55s ease; transform-origin: 50% 50%; }
        .waddle-avatar-wrapper.waddle-jump-fast svg  { animation: waddleJumpFast 0.45s ease; transform-origin: 50% 50%; }
        .waddle-avatar-wrapper.waddle-jump-jump2 svg { animation: waddleJumpJump2 0.78s ease; transform-origin: 50% 50%; }
        .waddle-avatar-wrapper.waddle-jump-tilt svg  { animation: waddleJumpTilt 0.75s ease-in-out; transform-origin: 50% 50%; }

        /* Only the manual-gaze mode gets a CSS transition on rotation — the
           cursor engine sets this same attribute at 60fps with its own
           JS-side lerp, and layering a CSS transition on top of that would
           make real-time tracking feel laggy instead of crisp. */
        .waddle-eye-gazing {
          transition: transform 0.18s ease;
        }

        .waddle-presence-dot {
          animation: waddlePresencePulse 1.6s ease-in-out infinite;
        }

        .waddle-bubble {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          width: max-content;
          max-width: 160px;
          background: var(--bg-main, #fff);
          border: 1px solid var(--border, rgba(0,0,0,0.1));
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 500;
          text-align: center;
          line-height: 1.35;
          color: var(--text-primary, #26262a);
          box-shadow: 0 8px 22px var(--shadow-strong, rgba(0,0,0,0.15));
          pointer-events: none;
          z-index: 20;
          animation: waddleBubbleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .waddle-bubble::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: var(--bg-main, #fff);
        }

        @keyframes waddleBubbleIn {
          from { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.85); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); }
        }

        @keyframes waddleDoneBounce {
          0% { transform: scale(0.92); }
          50% { transform: scale(1.08) translateY(-3px); }
          100% { transform: scale(1) translateY(0); }
        }

        @keyframes waddleJumpHop {
          0%   { transform: none; }
          20%  { transform: translateY(3px) scale(1.06, 0.92); }
          50%  { transform: translateY(-17px) scale(0.96, 1.06); }
          75%  { transform: translateY(0) scale(1.05, 0.94); }
          100% { transform: none; }
        }

        @keyframes waddleJumpFast {
          0%   { transform: none; }
          15%  { transform: scale(1.05, 0.93); }
          32%  { transform: translateY(-9px) scale(0.97, 1.05); }
          48%  { transform: scale(1.04, 0.95); }
          64%  { transform: translateY(-7px) scale(0.98, 1.04); }
          85%  { transform: scale(1.04, 0.94); }
          100% { transform: none; }
        }

        @keyframes waddleJumpJump2 {
          0%   { transform: none; }
          15%  { transform: translateY(2px) scale(1.05, 0.92); }
          40%  { transform: translateY(-24px) rotate(-11deg) scale(0.95, 1.08); }
          55%  { transform: translateY(-20px) rotate(9deg); }
          80%  { transform: translateY(0) scale(1.06, 0.9) rotate(-3deg); }
          90%  { transform: rotate(2deg); }
          100% { transform: none; }
        }

        @keyframes waddleJumpTilt {
          0%, 100% { transform: none; }
          28%, 62% { transform: rotate(9deg) translateY(-1px); }
          82%      { transform: rotate(-2deg); }
        }

        @keyframes waddlePresencePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
          50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
        }
      `}</style>
    </div>
  );
};

export default WaddleAvatar;
