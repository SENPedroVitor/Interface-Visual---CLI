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
 * One entry per real Waddle agent. The family should feel like one product
 * system: same clean pod face, different role-coded micro details.
 */
export const AGENT_VISUALS: Record<string, AgentVisual> = {
  Quinta:  { color: '#8b5cf6', marking: 'none',      clickAnim: 'hop',   quote: 'Delegando. O bando resolve.', imageUrl: '/avatars/chefe.png', cosmetics: { head: 'command_module', body: 'status_bar' } },
  Manager: { color: '#8b5cf6', marking: 'none',      clickAnim: 'hop',   quote: 'Delegando. O bando resolve.', imageUrl: '/avatars/chefe.png', cosmetics: { head: 'command_module', body: 'status_bar' } },
  Atlas:   { color: '#0ea5e9', marking: 'chevron',   clickAnim: 'fast',  quote: 'Já pesquisei isso — inclusive ontem.', imageUrl: '/avatars/sabio.png', cosmetics: { face: 'visor', hand: 'side_panel' } },
  Nero:    { color: '#3b82f6', marking: 'tuft',      clickAnim: 'jump2', quote: 'Na minha máquina funciona.', imageUrl: '/avatars/turbo.png', cosmetics: { face: 'code_cursor', body: 'status_bar' } },
  Worker:  { color: '#3b82f6', marking: 'tuft',      clickAnim: 'jump2', quote: 'Na minha máquina funciona.', imageUrl: '/avatars/turbo.png', cosmetics: { face: 'code_cursor', body: 'status_bar' } },
  Iris:    { color: '#10b981', marking: 'chinstrap', clickAnim: 'tilt',  quote: 'Ah, ótimo. O que poderia dar errado?', imageUrl: '/avatars/eco.png', cosmetics: { body: 'shield_mark' } },
  Ma:      { color: '#f59e0b', marking: 'whistle',   clickAnim: 'hop',   quote: 'De olho na B3, dividendos e IBOVESPA. Ma aprova este investimento!', imageUrl: '/avatars/totem.png', cosmetics: { body: 'data_grid', hand: 'side_panel' } },
  Livro:   { color: '#6366f1', marking: 'whistle',   clickAnim: 'fast',  quote: 'Consultando a enciclopédia esportiva. Futebol, NBA, NFL e MLB na ponta da língua!', imageUrl: '/avatars/livro.png', cosmetics: { head: 'signal_band', body: 'status_bar' } },
  Pixel:   { color: '#ff7262', marking: 'none',      clickAnim: 'tilt',  quote: 'Ajustando o visual sem enfeitar demais.', imageUrl: '/avatars/brilho.png', cosmetics: { face: 'design_nodes', body: 'status_bar' } },
  Motion:  { color: '#a259ff', marking: 'none',      clickAnim: 'fast',  quote: 'Deixa comigo, eu coloco isso pra se mover.', imageUrl: '/avatars/chefe.png', cosmetics: { head: 'timeline_rig', body: 'orbit_mark' } },
  Data:    { color: '#14b8a6', marking: 'chevron',   clickAnim: 'hop',   quote: 'Transformei bagunça em leitura.', imageUrl: '/avatars/sabio.png', cosmetics: { face: 'visor', body: 'data_grid' } },
  Ops:     { color: '#64748b', marking: 'tuft',      clickAnim: 'jump2', quote: 'Rotina criada. Agora deixa rodar.', imageUrl: '/avatars/padrao.png', cosmetics: { head: 'signal_band', hand: 'side_panel' } },
};

const DEFAULT_VISUAL: AgentVisual = { color: '#1e1e1e', marking: 'none', clickAnim: 'hop', quote: '', imageUrl: '/avatars/padrao.png' };

export function agentVisual(name: string, role?: string, customConfig?: any): AgentVisual {
  const roleAgent = ({
    Research: 'Atlas',
    Developer: 'Nero',
    Reviewer: 'Iris',
    Investor: 'Ma',
    Sports: 'Livro',
    Designer: 'Pixel',
    Motion: 'Motion',
    Data: 'Data',
    Operations: 'Ops',
  } as Record<string, string>)[role || ''];
  const base = AGENT_VISUALS[name] || AGENT_VISUALS[roleAgent] || DEFAULT_VISUAL;
  if (!customConfig) return base;

  const cfg = customConfig.avatar_config || customConfig;
  let resolvedImageUrl: string | undefined = base.imageUrl;
  if (cfg.imageUrl === null || cfg.imageUrl === '' || cfg.imageUrl === 'mascot' || cfg.useMascot) {
    resolvedImageUrl = undefined;
  } else if (cfg.imageUrl && (cfg.imageUrl.startsWith('data:') || cfg.imageUrl.startsWith('http') || cfg.imageUrl.startsWith('blob:') || cfg.imageUrl.startsWith('/'))) {
    resolvedImageUrl = cfg.imageUrl;
  } else if (cfg.color || cfg.cosmetics || cfg.marking) {
    resolvedImageUrl = undefined;
  }

  return {
    ...base,
    color: cfg.color || base.color,
    marking: cfg.marking || base.marking,
    cosmetics: cfg.cosmetics !== undefined ? cfg.cosmetics : base.cosmetics,
    imageUrl: resolvedImageUrl,
  };
}
