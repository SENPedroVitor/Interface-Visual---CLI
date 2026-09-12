/**
 * Repertório de frases e saudações carismáticas para os bots do Waddle.
 * Totalmente em texto limpo (sem emojis).
 */

export interface GreetingContext {
  dayOfWeek?: number; // 0 = Domingo, 3 = Quarta, 5 = Sexta
  hour?: number;
}

const QUINTA_GREETINGS_BASE = [
  'Vamos de café primeiro?',
  'Hoje o Galo joga, como está de ansiedade?',
  'Coordeno a equipe para pesquisar, escrever código e validar resultados. O que fazemos hoje?',
  'Café passado e terminal aberto. Qual é a boa de hoje?',
  'Fala comigo, chefe! O bando tá a postos. Por onde começamos?',
  'Bora colocar os outros bots pra trabalhar hoje?',
  'Mais um dia, mais uma missão. O que a gente resolve agora?',
  'Pode mandar a bronca que a equipe resolve.',
  'Organizado, determinado e pronto pro combate. O que temos pra hoje?',
  'Foco total por aqui! Qual é o objetivo de hoje?',
  'Reunião de alinhamento cancelada, direto pra ação. O que manda?',
  'Menos papo, mais entrega. Qual projeto vamos adiantar?',
  'Primeiro o café, depois os commits. Bora!',
  'Estratégia traçada. Só mandar a ordem que a gente executa.',
];

const NERO_GREETINGS = [
  'Na minha máquina funcionou, juro.',
  'Mais café, menos bugs. O que vamos codar hoje?',
  'Bora commitar antes que o chefe veja?',
  'Git push na sexta-feira? Com emoção!',
  'Compilando ideias e tomando café.',
  'Código limpo e deploy sem sustos. O que implementamos hoje?',
  'Terminal aberto, café fervendo. Manda a bronca!',
];

const ATLAS_GREETINGS = [
  'Já pesquisei sobre isso — inclusive ontem.',
  'Vasculhando a internet atrás das melhores respostas.',
  'Informação é poder. O que você quer descobrir hoje?',
  'Tenho dados, gráficos e café. O que vamos analisar?',
  'Fontes checadas e síntese pronta. Qual é a pauta?',
];

const IRIS_GREETINGS = [
  'Testando tudo antes que vá pra produção...',
  'O que poderia dar errado? Deixa que eu descubro.',
  'Qualidade em primeiro lugar. O que vamos validar hoje?',
  'Encontrei zero bugs até agora... estou desconfiada.',
  'Auditoria e testes prontos para rodar.',
];

const MA_GREETINGS = [
  'De olho na B3 e no IBOVESPA hoje!',
  'Comprar na baixa, vender na alta e tomar café.',
  'Mercado aberto e dividendos chamando. Qual é a análise de hoje?',
  'Patrimônio não dorme. Vamos analisar o que hoje?',
  'Estratégia de aportes na mesa. O que manda?',
];

const LIVRO_GREETINGS = [
  'Hoje o Galo joga, como está de ansiedade?',
  'Hoje tem jogo! Tabela na mão e rodada quente.',
  'Futebol, NBA, NFL... Manda a rodada de hoje!',
  'Clássico é clássico e vice-versa. Bora pro jogo!',
  'Consultando as estatísticas. Quem você acha que leva hoje?',
];

const DEFAULT_GREETINGS = [
  'Pronto para o trabalho. O que fazemos hoje?',
  'Vamos de café primeiro?',
  'Tudo em ordem por aqui. Qual é a próxima missão?',
  'Manda a tarefa que eu resolvo!',
];

export function getAgentGreetings(agentName: string, role?: string, context?: GreetingContext): string[] {
  const normalizedName = (agentName || '').trim().toLowerCase();
  const normalizedRole = (role || '').trim().toLowerCase();

  const now = new Date();
  const day = context?.dayOfWeek ?? now.getDay();
  const hour = context?.hour ?? now.getHours();

  let pool: string[] = [];

  if (normalizedName === 'quinta' || normalizedRole === 'manager') {
    pool = [...QUINTA_GREETINGS_BASE];

    // Toques contextuais adicionais
    if (day === 3 || day === 0) {
      // Quarta ou Domingo (dias clássicos de futebol)
      pool.unshift(
        'Hoje o Galo joga, como está de ansiedade?',
        'Dia de jogo do Galo! Vamos adiantar o trampo antes da bola rolar.'
      );
    } else if (day === 5) {
      // Sexta-feira
      pool.unshift(
        'Sextou! Mas com calma no deploy pra não quebrar nada. O que fechamos hoje?',
        'Sexta-feira sem estresse: manda o que precisa ser feito!'
      );
    }

    if (hour >= 5 && hour < 11) {
      pool.unshift(
        'Bom dia! Vamos de café primeiro?',
        'Café passado e equipe a postos. Por onde começamos hoje?'
      );
    } else if (hour >= 20 || hour < 5) {
      pool.unshift(
        'Trabalhando até tarde? Deixa comigo que agilizo o que puder!',
        'Plantão coruja ativo. O que vamos resolver antes de descansar?'
      );
    }
  } else if (normalizedName === 'nero' || normalizedRole === 'developer') {
    pool = [...NERO_GREETINGS];
  } else if (normalizedName === 'atlas' || normalizedRole === 'research') {
    pool = [...ATLAS_GREETINGS];
  } else if (normalizedName === 'iris' || normalizedRole === 'reviewer') {
    pool = [...IRIS_GREETINGS];
  } else if (normalizedName === 'ma' || normalizedRole === 'investor') {
    pool = [...MA_GREETINGS];
  } else if (normalizedName === 'livro' || normalizedRole === 'sports') {
    pool = [...LIVRO_GREETINGS];
  } else {
    pool = [...DEFAULT_GREETINGS];
  }

  // Remove duplicatas preservando ordem
  return Array.from(new Set(pool));
}

export function getRandomGreeting(agentName: string, role?: string): string {
  const greetings = getAgentGreetings(agentName, role);
  const idx = Math.floor(Math.random() * greetings.length);
  return greetings[idx] || 'Pronto para trabalhar.';
}
