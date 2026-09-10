import { AgentState } from '../components/WaddleAvatar';

/** Maps the backend's real AgentStatus 1:1 onto the mascot's motion states. */
export function agentStateFromStatus(status?: string): AgentState {
  if (status === 'working')  return 'working';
  if (status === 'thinking') return 'thinking';
  if (status === 'blocked')  return 'blocked';
  if (status === 'stopped')  return 'stopped';
  if (status === 'waiting') return 'waiting';
  if (status === 'done' || status === 'completed') return 'done';
  return 'idle';
}

export function roleLabel(role: string): string {
  return ({
    Manager: 'Coordenação',
    Research: 'Pesquisa',
    Developer: 'Desenvolvimento',
    Reviewer: 'Revisão',
    Executor: 'Execução',
    Investor: 'Investimentos',
    Sports: 'Esportes',
    Designer: 'Design',
    Motion: 'Motion',
    Data: 'Dados',
    Operations: 'Operações',
  } as Record<string, string>)[role] || role;
}

export function activityTime(timestamp?: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? 'Ontem' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
