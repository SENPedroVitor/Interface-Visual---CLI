import { MarkingType, AvatarCosmetics } from '../components/WaddleAvatar';

export interface AgentVisual {
  color: string;
  marking: MarkingType;
  clickAnim: 'hop' | 'fast' | 'jump2' | 'tilt';
  quote: string;
  cosmetics?: AvatarCosmetics;
  imageUrl?: string;
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
  Ma:      { color: '#1f6aa5', marking: 'tie',        clickAnim: 'hop',   quote: 'De olho na B3, dividendos e IBOVESPA. Ma aprova este investimento!' },
  Livro:   { color: '#059669', marking: 'whistle',    clickAnim: 'fast',  quote: 'Consultando a enciclopédia esportiva. Futebol, NBA, NFL e MLB na ponta da língua!' },
};

const DEFAULT_VISUAL: AgentVisual = { color: '#9159FE', marking: 'none', clickAnim: 'hop', quote: '' };

export function agentVisual(name: string, role?: string, customConfig?: any): AgentVisual {
  const roleAgent = ({ Research: 'Atlas', Developer: 'Nero', Reviewer: 'Iris', Investor: 'Ma', Sports: 'Livro' } as Record<string, string>)[role || ''];
  const base = AGENT_VISUALS[name] || AGENT_VISUALS[roleAgent] || DEFAULT_VISUAL;
  if (!customConfig) return base;

  const cfg = customConfig.avatar_config || customConfig;
  return {
    ...base,
    color: cfg.color || base.color,
    marking: cfg.marking || base.marking,
    cosmetics: cfg.cosmetics !== undefined ? cfg.cosmetics : base.cosmetics,
    imageUrl: cfg.imageUrl || base.imageUrl,
  };
}
