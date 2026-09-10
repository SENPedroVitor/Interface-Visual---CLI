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
  Quinta:  { color: '#2d1b4e', marking: 'none',      clickAnim: 'hop',   quote: 'Delegando. O bando resolve.', imageUrl: '/avatars/chefe.png' },
  Manager: { color: '#2d1b4e', marking: 'none',      clickAnim: 'hop',   quote: 'Delegando. O bando resolve.', imageUrl: '/avatars/chefe.png' },
  Atlas:   { color: '#123f3a', marking: 'chevron',   clickAnim: 'fast',  quote: 'Já pesquisei isso — inclusive ontem.', imageUrl: '/avatars/sabio.png' },
  Nero:    { color: '#14284b', marking: 'tuft',      clickAnim: 'jump2', quote: 'Na minha máquina funciona.', imageUrl: '/avatars/turbo.png' },
  Worker:  { color: '#14284b', marking: 'tuft',      clickAnim: 'jump2', quote: 'Na minha máquina funciona.', imageUrl: '/avatars/turbo.png' },
  Iris:    { color: '#16382a', marking: 'chinstrap', clickAnim: 'tilt',  quote: 'Ah, ótimo. O que poderia dar errado?', imageUrl: '/avatars/eco.png' },
  Ma:      { color: '#3a2a1d', marking: 'whistle',   clickAnim: 'hop',   quote: 'De olho na B3, dividendos e IBOVESPA. Ma aprova este investimento!', imageUrl: '/avatars/totem.png' },
  Livro:   { color: '#1e3a5f', marking: 'whistle',   clickAnim: 'fast',  quote: 'Consultando a enciclopédia esportiva. Futebol, NBA, NFL e MLB na ponta da língua!', imageUrl: '/avatars/livro.png' },
};

const DEFAULT_VISUAL: AgentVisual = { color: '#1e1e1e', marking: 'none', clickAnim: 'hop', quote: '', imageUrl: '/avatars/padrao.png' };

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
