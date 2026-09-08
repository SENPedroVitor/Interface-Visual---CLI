import { AgentState } from '../components/WaddleAvatar';

/** Maps the backend's real AgentStatus 1:1 onto the mascot's motion states. */
export function agentStateFromStatus(status?: string): AgentState {
  if (status === 'working')  return 'working';
  if (status === 'thinking') return 'thinking';
  if (status === 'blocked')  return 'blocked';
  if (status === 'stopped')  return 'stopped';
  return 'idle';
}
