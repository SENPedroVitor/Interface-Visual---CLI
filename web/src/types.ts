export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  provider_id?: string;
  status: 'idle' | 'working' | 'waiting' | 'thinking' | 'blocked' | 'stopped' | 'done';
  last_activity_at?: string;
  current_task_id?: string | null;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  content: string;
  task_id?: string | null;
  data: Record<string, any>;
  timestamp: string;
}

export interface ArtifactSummary {
  id: string;
  task_id: string;
  title: string;
  agent_name: string;
  path: string;
  filename: string;
  bytes?: number | null;
  created_at?: string | null;
}

export interface RoutineSummary {
  id: string;
  name: string;
  agent_name: string;
  prompt: string;
  schedule: string;
  status: 'draft' | 'active' | 'paused';
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_agent?: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'queued' | 'running' | 'blocked' | 'waiting_review' | 'completed' | 'failed' | 'cancelled';
  dependencies: string[];
  input_data?: Record<string, any>;
  output_data?: any;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ToolInfo {
  name: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  permission: 'allow' | 'ask' | 'deny';
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
}

export interface ProviderInfo {
  id: 'ollama' | 'codex' | 'claude' | string;
  name: string;
  kind: 'local-llm' | 'code-agent' | string;
  installed: boolean;
  available: boolean;
  command: string;
  path?: string | null;
  version?: string | null;
  detail: string;
}

export interface WaddleEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface SystemStatus {
  status: 'active' | 'stopped';
  active_run_id?: string | null;
  agents: Agent[];
  tasks: Task[];
  tools_count: number;
}

export interface HistorySnapshot {
  runs: Array<Record<string, any>>;
  recent_events: WaddleEvent[];
  messages: AgentMessage[];
  artifacts: ArtifactSummary[];
  routines: RoutineSummary[];
}
