/**
 * Types for Waddle Generative UI (OpenUI).
 * Controlled rendering architecture for autonomous agents.
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface UIAction<TPayload = any> {
  id: string;
  action: string;
  payload?: TPayload;
  timestamp: string;
}

export type ActionHandler = (action: string, payload?: any) => void | Promise<void>;

export interface OpenUIASTNode {
  component: string;
  props: Record<string, any>;
  children?: (OpenUIASTNode | string)[];
  raw?: string;
}

export interface ParseResult {
  nodes: OpenUIASTNode[];
  error?: string;
  hasErrors: boolean;
}

/* =========================================================
   Component Prop Definitions
   ========================================================= */

export interface ActionButtonProps {
  action: string;
  payload?: Record<string, any>;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string | number;
  trend?: 'up' | 'down' | 'neutral';
  period?: string;
  badge?: string;
}

export interface StatusPillProps {
  status: 'idle' | 'running' | 'done' | 'failed' | 'pending' | 'warning';
  label?: string;
  size?: 'sm' | 'md';
}

/* Tasks */
export interface TaskPlanItem {
  id?: string;
  agent: string;
  action: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  detail?: string;
}

export interface TaskPlanProps {
  title: string;
  tasks: TaskPlanItem[];
  progress?: number;
  showActions?: boolean;
  onAction?: ActionHandler;
}

export interface TaskProgressProps {
  title: string;
  currentStep?: string;
  progress: number;
  totalSteps?: number;
  currentStepIndex?: number;
  status?: 'running' | 'completed' | 'paused' | 'failed';
  estimatedTimeRemaining?: string;
  onAction?: ActionHandler;
}

/* Approvals */
export interface ApprovalCardProps {
  agent: string;
  action: string;
  risk: RiskLevel;
  reason?: string;
  target?: string;
  requiresPermission?: boolean;
  initialStatus?: 'pending' | 'approved' | 'rejected';
  onAction?: ActionHandler;
}

/* Tools */
export interface ToolCallProps {
  toolName: string;
  commandOrQuery?: string;
  status?: 'running' | 'done' | 'failed';
  duration?: string;
  details?: string;
  outputPreview?: string;
}

/* Sports */
export interface MatchCardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  homeLogo?: string;
  awayLogo?: string;
  statusText?: string;
  matchTime?: string;
  league?: string;
  goals?: { team: string; player: string; minute: string }[];
  isLive?: boolean;
  onAction?: ActionHandler;
}

export interface LiveScoreProps {
  matchTitle: string;
  minute: string;
  score: string;
  events?: { type: 'goal' | 'card' | 'sub' | 'var'; detail: string; minute: string }[];
  onAction?: ActionHandler;
}

/* Finance */
export interface StockCardProps {
  symbol: string;
  price: string | number;
  currency?: string;
  changePercent: number | string;
  changeValue?: number | string;
  rsi?: number | string;
  trend?: 'Alta' | 'Baixa' | 'Lateral' | string;
  sma20?: string | number;
  high52w?: string | number;
  low52w?: string | number;
  onAction?: ActionHandler;
}

export interface PortfolioCardProps {
  title?: string;
  totalBalance: string;
  dailyChange: string;
  dailyPercent: string | number;
  assets?: { symbol: string; allocation: string; balance: string }[];
  onAction?: ActionHandler;
}

/* Research */
export interface SourceCardProps {
  title: string;
  url?: string;
  sourceType?: 'web' | 'file' | 'skill' | 'mcp' | 'doc';
  relevance: 'Alta' | 'Média' | 'Baixa' | string;
  snippet?: string;
  onAction?: ActionHandler;
}

export interface ResearchSummaryProps {
  topic: string;
  keyFindings: string[];
  sourcesCount?: number;
  sources?: { title: string; relevance: string; url?: string }[];
  confidenceScore?: number;
  onAction?: ActionHandler;
}

/* Review */
export interface ReviewSummaryProps {
  title: string;
  criticalCount: number;
  warningCount: number;
  passedCount: number;
  mainIssue?: string;
  details?: string[];
  status?: 'approved' | 'changes_requested';
  onAction?: ActionHandler;
}

export interface RiskCardProps {
  title: string;
  severity: RiskLevel;
  description: string;
  impactArea?: string;
  mitigation?: string;
  onAction?: ActionHandler;
}
