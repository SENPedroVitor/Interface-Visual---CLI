import React from 'react';
import { WaddleAvatar, WaddleAvatarProps, AgentState } from './WaddleAvatar';

export type { AgentState, WaddleAvatarProps };

/**
 * GrokBotAvatar — Alias to WaddleAvatar.
 * Retained for backwards-compatibility with existing imports.
 */
export const GrokBotAvatar: React.FC<WaddleAvatarProps> = (props) => {
  return <WaddleAvatar {...props} />;
};

export { WaddleAvatar };
export default WaddleAvatar;
