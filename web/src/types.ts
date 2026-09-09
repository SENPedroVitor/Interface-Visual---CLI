export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'idle' | 'working' | 'waiting' | 'thinking' | 'blocked' | 'stopped' | 'done';
  last_activity_at?: string;
  current_task_id?: string | null;
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
