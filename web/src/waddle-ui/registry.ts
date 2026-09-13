/**
 * Controlled Registry of Generative UI Components for Waddle Agent OS.
 * Only components explicitly registered here are allowed to render.
 */

import React from 'react';
import { ActionButton } from './components/common/ActionButton.tsx';
import { MetricCard } from './components/common/MetricCard.tsx';
import { StatusPill } from './components/common/StatusPill.tsx';
import { TaskPlan } from './components/tasks/TaskPlan.tsx';
import { TaskProgress } from './components/tasks/TaskProgress.tsx';
import { ApprovalCard } from './components/approvals/ApprovalCard.tsx';
import { ToolCall } from './components/tools/ToolCall.tsx';
import { MatchCard } from './components/sports/MatchCard.tsx';
import { LiveScore } from './components/sports/LiveScore.tsx';
import { StockCard } from './components/finance/StockCard.tsx';
import { PortfolioCard } from './components/finance/PortfolioCard.tsx';
import { ResearchSummary } from './components/research/ResearchSummary.tsx';
import { SourceCard } from './components/research/SourceCard.tsx';
import { ReviewSummary } from './components/review/ReviewSummary.tsx';
import { RiskCard } from './components/review/RiskCard.tsx';

export interface ComponentMetadata {
  name: string;
  agent: string;
  description: string;
  category: 'tasks' | 'approvals' | 'sports' | 'finance' | 'research' | 'review' | 'tools' | 'common';
  exampleOpenUI: string;
  defaultProps: Record<string, any>;
}

export const waddleUIRegistry: Record<string, React.ComponentType<any>> = {
  // Tasks
  TaskPlan,
  TaskProgress,

  // Approvals & Governance
  ApprovalCard,

  // Tools
  ToolCall,

  // Sports
  MatchCard,
  LiveScore,

  // Finance
  StockCard,
  PortfolioCard,

  // Research
  ResearchSummary,
  SourceCard,

  // Review
  ReviewSummary,
  RiskCard,

  // Common
  ActionButton,
  MetricCard,
  StatusPill,
};

export const componentMetadataList: ComponentMetadata[] = [
  {
    name: 'TaskPlan',
    agent: 'Quinta',
    category: 'tasks',
    description: 'Plano de coordenação e delegação de tarefas para a equipe de agentes.',
    exampleOpenUI: `TaskPlan(
  title="Plano da Quinta",
  tasks=[
    {"agent": "Atlas", "action": "Pesquisando arquitetura", "status": "running"},
    {"agent": "Nero", "action": "Analisando código e testes", "status": "running"},
    {"agent": "Iris", "action": "Aguardando revisão", "status": "pending"}
  ],
  progress=45
)`,
    defaultProps: {
      title: 'Plano da Quinta',
      tasks: [
        { agent: 'Atlas', action: 'Pesquisando arquitetura', status: 'running' },
        { agent: 'Nero', action: 'Analisando código e testes', status: 'running' },
        { agent: 'Iris', action: 'Aguardando revisão', status: 'pending' },
      ],
      progress: 45,
    },
  },
  {
    name: 'TaskProgress',
    agent: 'Quinta / Geral',
    category: 'tasks',
    description: 'Acompanhamento do progresso de tarefas com etapas e percentual.',
    exampleOpenUI: `TaskProgress(
  title="Refatoração da API",
  currentStep="Executando testes unitários",
  progress=75,
  currentStepIndex=3,
  totalSteps=4,
  status="running"
)`,
    defaultProps: {
      title: 'Refatoração da API',
      currentStep: 'Executando testes unitários',
      progress: 75,
      currentStepIndex: 3,
      totalSteps: 4,
      status: 'running',
    },
  },
  {
    name: 'ApprovalCard',
    agent: 'Nero / Ops',
    category: 'approvals',
    description: 'Cartão de governança e permissão para comandos ou ações de risco.',
    exampleOpenUI: `ApprovalCard(
  agent="Nero",
  action="npm install playwright",
  risk="medium",
  target="npm install playwright",
  reason="Instalar dependência para suíte de testes de ponta a ponta"
)`,
    defaultProps: {
      agent: 'Nero',
      action: 'npm install playwright',
      risk: 'medium',
      target: 'npm install playwright',
      reason: 'Instalar dependência para suíte de testes de ponta a ponta',
    },
  },
  {
    name: 'ToolCall',
    agent: 'Geral',
    category: 'tools',
    description: 'Chamada estruturada de ferramenta do Waddle com tempo e status.',
    exampleOpenUI: `ToolCall(
  toolName="read_file",
  commandOrQuery="src/waddle/runtime/agent_runtime.py",
  duration="42ms",
  status="done"
)`,
    defaultProps: {
      toolName: 'read_file',
      commandOrQuery: 'src/waddle/runtime/agent_runtime.py',
      duration: '42ms',
      status: 'done',
    },
  },
  {
    name: 'MatchCard',
    agent: 'Livro',
    category: 'sports',
    description: 'Cartão de partida esportiva com placar, status e autores de gols.',
    exampleOpenUI: `MatchCard(
  homeTeam="Corinthians",
  awayTeam="Palmeiras",
  homeScore=2,
  awayScore=1,
  matchTime="72'",
  league="Brasileirão",
  isLive=true,
  goals=[
    {"team": "Corinthians", "player": "Yuri Alberto", "minute": "37"},
    {"team": "Corinthians", "player": "Memphis", "minute": "54"}
  ]
)`,
    defaultProps: {
      homeTeam: 'Corinthians',
      awayTeam: 'Palmeiras',
      homeScore: 2,
      awayScore: 1,
      matchTime: "72'",
      league: 'Brasileirão',
      isLive: true,
      goals: [
        { team: 'Corinthians', player: 'Yuri Alberto', minute: '37' },
        { team: 'Corinthians', player: 'Memphis', minute: '54' },
      ],
    },
  },
  {
    name: 'LiveScore',
    agent: 'Livro',
    category: 'sports',
    description: 'Placar compacto em tempo real com linha do tempo de eventos.',
    exampleOpenUI: `LiveScore(
  matchTitle="Corinthians 2 × 1 Palmeiras",
  minute="78'",
  score="2 × 1",
  events=[
    {"type": "goal", "detail": "Gol de Yuri Alberto", "minute": "37'"},
    {"type": "goal", "detail": "Gol de Memphis", "minute": "54'"}
  ]
)`,
    defaultProps: {
      matchTitle: 'Corinthians 2 × 1 Palmeiras',
      minute: "78'",
      score: '2 × 1',
      events: [
        { type: 'goal', detail: 'Gol de Yuri Alberto', minute: "37'" },
        { type: 'goal', detail: 'Gol de Memphis', minute: "54'" },
      ],
    },
  },
  {
    name: 'StockCard',
    agent: 'Ma',
    category: 'finance',
    description: 'Card financeiro com cotação, indicadores técnicos e tendências.',
    exampleOpenUI: `StockCard(
  symbol="PETR4",
  price="38,24",
  changePercent=1.7,
  rsi=61,
  trend="Alta",
  sma20="37,80"
)`,
    defaultProps: {
      symbol: 'PETR4',
      price: '38,24',
      changePercent: 1.7,
      rsi: 61,
      trend: 'Alta',
      sma20: '37,80',
    },
  },
  {
    name: 'PortfolioCard',
    agent: 'Ma',
    category: 'finance',
    description: 'Resumo consolidado de carteira de investimentos e alocação.',
    exampleOpenUI: `PortfolioCard(
  title="Carteira Principal",
  totalBalance="R$ 142.850,00",
  dailyChange="+R$ 1.420,00",
  dailyPercent="+1.0%",
  assets=[
    {"symbol": "PETR4", "allocation": "30%", "balance": "R$ 42.855"},
    {"symbol": "VALE3", "allocation": "25%", "balance": "R$ 35.712"},
    {"symbol": "MXRF11", "allocation": "45%", "balance": "R$ 64.283"}
  ]
)`,
    defaultProps: {
      title: 'Carteira Principal',
      totalBalance: 'R$ 142.850,00',
      dailyChange: '+R$ 1.420,00',
      dailyPercent: '+1.0%',
      assets: [
        { symbol: 'PETR4', allocation: '30%', balance: 'R$ 42.855' },
        { symbol: 'VALE3', allocation: '25%', balance: 'R$ 35.712' },
        { symbol: 'MXRF11', allocation: '45%', balance: 'R$ 64.283' },
      ],
    },
  },
  {
    name: 'ResearchSummary',
    agent: 'Atlas',
    category: 'research',
    description: 'Resumo estruturado de pesquisa e referências encontradas.',
    exampleOpenUI: `ResearchSummary(
  topic="Arquitetura de Generative UI",
  keyFindings=[
    "OpenUI padroniza componentes sem permitir código arbitrário",
    "Preserva segurança total através de Controlled Rendering",
    "Compatível com modelos locais de baixo consumo de contexto"
  ],
  sources=[
    {"title": "thesysdev/openui", "relevance": "Alta"},
    {"title": "Hermes Agent Skills", "relevance": "Alta"},
    {"title": "Model Context Protocol SDK", "relevance": "Média"}
  ],
  confidenceScore=94
)`,
    defaultProps: {
      topic: 'Arquitetura de Generative UI',
      keyFindings: [
        'OpenUI padroniza componentes sem permitir código arbitrário',
        'Preserva segurança total através de Controlled Rendering',
        'Compatível com modelos locais de baixo consumo de contexto',
      ],
      sources: [
        { title: 'thesysdev/openui', relevance: 'Alta' },
        { title: 'Hermes Agent Skills', relevance: 'Alta' },
        { title: 'Model Context Protocol SDK', relevance: 'Média' },
      ],
      confidenceScore: 94,
    },
  },
  {
    name: 'SourceCard',
    agent: 'Atlas',
    category: 'research',
    description: 'Card de citação e documento de origem analisado.',
    exampleOpenUI: `SourceCard(
  title="openui/README.md",
  url="github.com/thesysdev/openui",
  sourceType="web",
  relevance="Alta",
  snippet="OpenUI allows developers to turn AI into dynamic UI components."
)`,
    defaultProps: {
      title: 'openui/README.md',
      url: 'github.com/thesysdev/openui',
      sourceType: 'web',
      relevance: 'Alta',
      snippet: 'OpenUI allows developers to turn AI into dynamic UI components.',
    },
  },
  {
    name: 'ReviewSummary',
    agent: 'Iris',
    category: 'review',
    description: 'Relatório visual de revisão de código, testes e segurança.',
    exampleOpenUI: `ReviewSummary(
  title="Revisão da Iris",
  criticalCount=1,
  warningCount=3,
  passedCount=8,
  mainIssue="Permission Layer incompleto em comandos shell",
  details=[
    "Validação de entrada sem checagem de escape",
    "Falta de timeout em subprocessos síncronos"
  ]
)`,
    defaultProps: {
      title: 'Revisão da Iris',
      criticalCount: 1,
      warningCount: 3,
      passedCount: 8,
      mainIssue: 'Permission Layer incompleto em comandos shell',
      details: [
        'Validação de entrada sem checagem de escape',
        'Falta de timeout em subprocessos síncronos',
      ],
    },
  },
  {
    name: 'RiskCard',
    agent: 'Iris',
    category: 'review',
    description: 'Cartão de aviso e mitigação de riscos em alterações críticas.',
    exampleOpenUI: `RiskCard(
  title="Risco de Regressão em Execução Concorrente",
  severity="high",
  description="A alteração nos locks de banco de dados pode causar race condition sob alta carga.",
  impactArea="src/waddle/storage/database.py",
  mitigation="Aplicar transações com isolation level SERIALIZABLE."
)`,
    defaultProps: {
      title: 'Risco de Regressão em Execução Concorrente',
      severity: 'high',
      description: 'A alteração nos locks de banco de dados pode causar race condition sob alta carga.',
      impactArea: 'src/waddle/storage/database.py',
      mitigation: 'Aplicar transações com isolation level SERIALIZABLE.',
    },
  },
];

export function getComponentByName(name: string): React.ComponentType<any> | null {
  const normalized = Object.keys(waddleUIRegistry).find(
    (k) => k.toLowerCase() === name.toLowerCase()
  );
  return normalized ? waddleUIRegistry[normalized] : null;
}

export function isValidComponent(name: string): boolean {
  return getComponentByName(name) !== null;
}
