import { MarkingType } from '../components/WaddleAvatar';

export interface AgentVisual {
  color: string;
  marking: MarkingType;
  clickAnim: 'hop' | 'fast' | 'jump2' | 'tilt';
  quote: string;
}

/**
 * One entry per real Waddle agent, mapped onto the same "species marking"
 * idea as the reference flock: a role gets a matching marking, not an
 * arbitrary one — Atlas/Research -> Gentoo's brow chevron, Nero/Código ->
 * Rockhopper's tuft, Iris/QA -> Chinstrap's line. Quinta (Manager) stays
 * plain, same as the reference's own Manager entry.
 */
export const AGENT_VISUALS: Record<string, AgentVisual> = {
  Quinta:  { color: '#9159FE', marking: 'none',      clickAnim: 'hop',   quote: 'Delegando. O bando resolve.' },
  Manager: { color: '#9159FE', marking: 'none',      clickAnim: 'hop',   quote: 'Delegando. O bando resolve.' },
  Atlas:   { color: '#3b82f6', marking: 'chevron',   clickAnim: 'fast',  quote: 'Já pesquisei isso — inclusive ontem.' },
  Nero:    { color: '#22c55e', marking: 'tuft',      clickAnim: 'jump2', quote: 'Na minha máquina funciona.' },
  Worker:  { color: '#22c55e', marking: 'tuft',      clickAnim: 'jump2', quote: 'Na minha máquina funciona.' },
  Iris:    { color: '#f97316', marking: 'chinstrap', clickAnim: 'tilt',  quote: 'Ah, ótimo. O que poderia dar errado?' },
};

const DEFAULT_VISUAL: AgentVisual = { color: '#9159FE', marking: 'none', clickAnim: 'hop', quote: '' };

export function agentVisual(name: string): AgentVisual {
  return AGENT_VISUALS[name] || DEFAULT_VISUAL;
}
