import React, { useId, useState, useEffect, useRef } from 'react';

export type AgentState = 'idle' | 'working' | 'thinking' | 'done' | 'stopped';

export interface WaddleAvatarProps {
  /** Agent accent color or custom body color (defaults to classic dark penguin #1e1e1e) */
  color?: string;
  /** State drives expression and animation: idle, working, thinking, done, stopped */
  state?: AgentState;
  /** Size in pixels (width and height) */
  size?: number;
  className?: string;
  /** Whether to show the active working indicator badge */
  showPresence?: boolean;
  /** Whether the avatar follows cursor position with eyes & subtle 3D tilt */
  trackMouse?: boolean;
  /** Whether clicking / hovering produces interactive expressions */
  interactive?: boolean;
  /** Optional click callback */
  onClick?: () => void;
}

/**
 * WaddleAvatar — Official Waddle Agent OS Mascot & Agent Avatar
 * 
 * Features:
 * - Pure circular silhouette (perfect at 24px, 36px, 64px, 130px)
 * - White chest arch with uniform crescent border
 * - Minimalist inverted triangle amber beak with subtle 2.5D parallax
 * - Dynamic mouse tracking: pupils track cursor across screen & head tilts gently in 3D
 * - Natural autonomous blinking engine (periodic organic blinks even while tracking)
 * - Interactive: click for happy wink & bounce (`^ ^`)
 * - State-driven: idle, working (squint + presence pulse), thinking (tilt + curious gaze), done (smiles), stopped (faded)
 */
export const WaddleAvatar: React.FC<WaddleAvatarProps> = ({
  color = '#1e1e1e',
  state = 'idle',
  size = 36,
  className = '',
  showPresence = true,
  trackMouse = false,
  interactive = false,
  onClick,
}) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `waddle-clip-${uid}`;
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse tracking offset
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [clickedHappy, setClickedHappy] = useState(false);
  const [isNaturalBlink, setIsNaturalBlink] = useState(false);

  // Animation parameters per state
  const isStopped = state === 'stopped';
  const isWorking = state === 'working';
  const isThinking = state === 'thinking';
  const isDone = state === 'done' || clickedHappy;

  // Track mouse coordinates relative to avatar center
  useEffect(() => {
    if (!trackMouse || isStopped) {
      setMouseOffset({ x: 0, y: 0 });
      return;
    }

    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        // Clamped logarithmic response
        const maxDist = Math.max(window.innerWidth, window.innerHeight) * 0.65;
        const normalized = Math.min(dist / maxDist, 1);

        setMouseOffset({
          x: Math.cos(angle) * normalized,
          y: Math.sin(angle) * normalized,
        });
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [trackMouse, isStopped]);

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

  const handleClick = () => {
    if (interactive) {
      setClickedHappy(true);
      setTimeout(() => setClickedHappy(false), 950);
    }
    onClick?.();
  };

  // Pupil offsets
  const pupilShiftX = trackMouse ? mouseOffset.x * 2.6 : 0;
  const pupilShiftY = trackMouse ? mouseOffset.y * 2.4 : 0;

  // Parallax shifts for 2.5D depth illusion
  const beakShiftX = trackMouse ? mouseOffset.x * 1.3 : 0;
  const beakShiftY = trackMouse ? mouseOffset.y * 1.1 : 0;
  const bellyShiftX = trackMouse ? mouseOffset.x * 0.6 : 0;
  const bellyShiftY = trackMouse ? mouseOffset.y * 0.5 : 0;

  // 3D head tilt
  const tiltX = trackMouse ? -mouseOffset.y * 8 : 0;
  const tiltY = trackMouse ? mouseOffset.x * 9 : 0;

  const motionClass =
    isWorking ? 'waddle-motion-working' :
    isThinking ? 'waddle-motion-thinking' :
    isDone ? 'waddle-motion-done' :
    isStopped ? 'waddle-motion-stopped' : 'waddle-motion-idle';

  return (
    <div
      ref={containerRef}
      className={`waddle-avatar-wrapper ${motionClass} ${className}`}
      data-state={state}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        opacity: isStopped ? 0.45 : 1,
        cursor: interactive ? 'pointer' : 'inherit',
        perspective: 600,
        transition: 'opacity 0.3s ease',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        style={{
          overflow: 'visible',
          display: 'block',
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) ${isHovered && interactive ? 'scale(1.05)' : 'scale(1)'}`,
          transition: trackMouse
            ? 'transform 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)'
            : 'transform 0.25s ease-out',
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="50" cy="50" r="44" />
          </clipPath>
        </defs>

        {/* Penguin Main Body (Circle) */}
        <circle
          cx="50"
          cy="50"
          r="44"
          fill={color}
          className="waddle-body-circle"
        />

        {/* Subtle top-light rim / highlight */}
        <circle
          cx="50"
          cy="50"
          r="43.5"
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1"
        />

        {/* White Chest / Belly Bib — with slight parallax */}
        <path
          d="M 21.5 70 Q 50 48.5 78.5 70 A 35.5 35.5 0 0 1 21.5 70 Z"
          fill="#ffffff"
          className="waddle-belly"
          style={{
            transform: `translate(${bellyShiftX}px, ${bellyShiftY}px)`,
            transition: 'transform 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        />

        {/* Beak — Minimalist inverted warm amber triangle with 2.5D parallax */}
        <polygon
          points="43,51.5 57,51.5 50,63.5"
          fill="#ff7a18"
          className="waddle-beak"
          style={{
            transform: `translate(${beakShiftX}px, ${beakShiftY}px)`,
            transition: 'transform 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        />

        {/* Dynamic Eye Expressions */}
        <g className="waddle-eyes-group">
          {isDone ? (
            /* Happy curved smile eyes */
            <g
              stroke="#ffffff"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            >
              <path d="M 30.5 43 Q 36.5 36.5 42.5 43" />
              <path d="M 57.5 43 Q 63.5 36.5 69.5 43" />
            </g>
          ) : isStopped ? (
            /* Calm sleeping/closed eye lines */
            <g
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity="0.8"
            >
              <line x1="31" y1="42" x2="42" y2="42" />
              <line x1="58" y1="42" x2="69" y2="42" />
            </g>
          ) : (
            /* Expressive ring eyes */
            <g
              className={`waddle-eyes ${isWorking ? 'eyes-working' : ''}`}
              style={{
                transform: isNaturalBlink ? 'scaleY(0.08)' : 'scaleY(1)',
                transformOrigin: '50px 42px',
                transition: 'transform 0.08s ease-in-out',
              }}
            >
              {/* Left Eye */}
              <g className="waddle-eye left-eye">
                <circle cx="36.5" cy="42" r="6.5" fill="#ffffff" />
                <circle
                  cx={36.5 + (isThinking ? -1.5 : pupilShiftX)}
                  cy={42 + (isThinking ? -2 : pupilShiftY)}
                  r={isWorking ? 2.8 : 3.3}
                  fill={color === '#1e1e1e' || color === '#18181b' ? '#18181b' : color}
                  style={{
                    transition: trackMouse ? 'cx 0.08s ease-out, cy 0.08s ease-out' : 'cx 0.2s, cy 0.2s',
                  }}
                />
              </g>

              {/* Right Eye */}
              <g className="waddle-eye right-eye">
                <circle cx="63.5" cy="42" r="6.5" fill="#ffffff" />
                <circle
                  cx={63.5 + (isThinking ? -1.5 : pupilShiftX)}
                  cy={42 + (isThinking ? -2 : pupilShiftY)}
                  r={isWorking ? 2.8 : 3.3}
                  fill={color === '#1e1e1e' || color === '#18181b' ? '#18181b' : color}
                  style={{
                    transition: trackMouse ? 'cx 0.08s ease-out, cy 0.08s ease-out' : 'cx 0.2s, cy 0.2s',
                  }}
                />
              </g>
            </g>
          )}
        </g>
      </svg>

      {/* Active Presence Badge (Working / Thinking) */}
      {showPresence && (isWorking || isThinking) && (
        <span
          className="waddle-presence-dot"
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: Math.max(8, size * 0.26),
            height: Math.max(8, size * 0.26),
            borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #ffffff',
            boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.2)',
          }}
        />
      )}

      <style>{`
        /* Idle: gentle breathing pulse + subtle natural waddle */
        .waddle-avatar-wrapper.waddle-motion-idle:not([data-track="true"]) svg {
          animation: waddleIdleMotion 3.6s ease-in-out infinite;
          transform-origin: 50% 50%;
        }

        /* Working: focused, faster rhythm */
        .waddle-avatar-wrapper.waddle-motion-working svg {
          animation: waddleWorkingMotion 1.1s ease-in-out infinite;
          transform-origin: 50% 50%;
        }

        /* Thinking: curious tilt & gaze */
        .waddle-avatar-wrapper.waddle-motion-thinking svg {
          animation: waddleThinkingMotion 2.2s ease-in-out infinite;
          transform-origin: 50% 50%;
        }

        /* Done: happy bounce */
        .waddle-avatar-wrapper.waddle-motion-done svg {
          animation: waddleDoneBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
          transform-origin: 50% 50%;
        }

        /* Working eyes squint slightly for focus */
        .eyes-working {
          animation: waddleEyeFocus 1.1s ease-in-out infinite;
          transform-origin: 50% 42px;
        }

        .waddle-presence-dot {
          animation: waddlePresencePulse 1.6s ease-in-out infinite;
        }

        @keyframes waddleIdleMotion {
          0%, 100% {
            transform: scale(1) rotate(0deg);
          }
          25% {
            transform: scale(1.02, 0.99) rotate(-1.2deg);
          }
          75% {
            transform: scale(0.99, 1.02) rotate(1.2deg);
          }
        }

        @keyframes waddleWorkingMotion {
          0%, 100% {
            transform: scale(1) translateY(0);
          }
          50% {
            transform: scale(1.035, 0.97) translateY(-1px);
          }
        }

        @keyframes waddleThinkingMotion {
          0%, 100% {
            transform: rotate(0deg) scale(1);
          }
          50% {
            transform: rotate(2.5deg) scale(1.02);
          }
        }

        @keyframes waddleDoneBounce {
          0% { transform: scale(0.92); }
          50% { transform: scale(1.08) translateY(-3px); }
          100% { transform: scale(1) translateY(0); }
        }

        @keyframes waddleEyeFocus {
          0%, 100% {
            transform: scaleY(0.72);
          }
          50% {
            transform: scaleY(0.85);
          }
        }

        @keyframes waddlePresencePulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default WaddleAvatar;
