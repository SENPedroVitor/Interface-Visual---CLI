import React, { useId } from 'react';
import './AnimatedAgentAvatar.css';

export type AvatarState = 'idle' | 'thinking' | 'streaming' | 'working' | 'stopped';
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AnimatedAgentAvatarProps {
  size?: AvatarSize;
  state?: AvatarState;
  avatarUrl?: string;
  agentName?: string;
  showRings?: boolean;
  className?: string;
  onClick?: () => void;
  title?: string;
}

const DEFAULT_AVATARS: Record<string, string> = {
  Quinta: '/waddle.svg',
  Manager: '/waddle.svg',
  Atlas: '/waddle.svg',
  Nero: '/waddle.svg',
  Worker: '/waddle.svg',
  Iris: '/waddle.svg',
};

export const AnimatedAgentAvatar: React.FC<AnimatedAgentAvatarProps> = ({
  size = 'md',
  state = 'idle',
  avatarUrl,
  agentName = 'Quinta',
  showRings = true,
  className = '',
  onClick,
  title,
}) => {
  const instanceId = useId().replace(/:/g, '');
  const outerGradId = `grokOuterGrad-${instanceId}`;
  const innerGradId = `grokInnerGrad-${instanceId}`;

  // Select appropriate mascot SVG based on agent and state
  let resolvedAvatar = avatarUrl || DEFAULT_AVATARS[agentName] || '/waddle.svg';
  if (state === 'thinking') {
    resolvedAvatar = '/waddle_thinking.svg';
  } else if (state === 'streaming' && (agentName === 'Quinta' || agentName === 'Manager')) {
    resolvedAvatar = '/waddle_typing.svg';
  }

  return (
    <div
      className={`grok-avatar-wrapper size-${size} state-${state} ${className}`}
      onClick={onClick}
      title={title || `${agentName} (${state})`}
      role="img"
      aria-label={`${agentName} avatar`}
    >
      {/* Sonar Ripple Rings (Active in streaming/working mode) */}
      {(state === 'streaming' || state === 'working') && (
        <>
          <span className="grok-sonar-ring ring-1" />
          <span className="grok-sonar-ring ring-2" />
        </>
      )}

      {/* Luminescent Orbital SVG Rings */}
      {showRings && (
        <div className="grok-orbit-layer">
          <svg viewBox="0 0 100 100" className="grok-svg-canvas">
            <defs>
              <linearGradient id={outerGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4cc5ff" stopOpacity="1" />
                <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a5f3fc" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={innerGradId} x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Static background orbital guide tracks */}
            <circle cx="50" cy="50" r="44" className="grok-track-static" />
            <circle cx="50" cy="50" r="37" className="grok-track-static" />

            {/* Dynamic Outer Kinetic Beam Arc */}
            <circle
              cx="50"
              cy="50"
              r="44"
              className="grok-beam-outer"
              style={{ stroke: `url(#${outerGradId})` }}
            />

            {/* Dynamic Inner Counter-Rotating Beam Arc */}
            <circle
              cx="50"
              cy="50"
              r="37"
              className="grok-beam-inner"
              style={{ stroke: `url(#${innerGradId})` }}
            />
          </svg>
        </div>
      )}

      {/* Central Core Pod with Aura and Mascot */}
      <div className="grok-core-pod">
        <div className="grok-ambient-aura" />
        {resolvedAvatar ? (
          <img
            src={resolvedAvatar}
            alt={agentName}
            className="grok-core-img"
            onError={(e) => {
              // Fallback to default mascot if specific one fails
              (e.target as HTMLImageElement).src = '/waddle.svg';
            }}
          />
        ) : (
          <div className="grok-geometric-symbol">
            <div className="grok-gem-spark" />
          </div>
        )}
      </div>
    </div>
  );
};
