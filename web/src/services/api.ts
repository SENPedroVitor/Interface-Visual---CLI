import { Agent, AgentMessage, HistorySnapshot, ProviderCredential, ProviderInfo, RoutineDetail, RoutineSummary, SystemStatus, ToolInfo, WaddleEvent } from '../types';

// Prefer same-origin requests so the Vite proxy and the FastAPI static build
// share one contract. Explicit URLs remain available for remote deployments.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const configuredWsBase = (import.meta.env.VITE_WS_URL || '').replace(/\/+$/, '').replace(/\/ws$/, '');
const WS_BASE = (configuredWsBase || (
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    : 'ws://127.0.0.1:8000'
)).replace(/\/$/, '');

export async function fetchStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/api/status`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function submitObjective(
  objective: string,
  parameters?: Record<string, any>,
  agentName?: string,
  groupId?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/objectives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objective, parameters, agent_name: agentName, group_id: groupId }),
  });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function createAgent(profile: {
  name: string;
  role: string;
  description: string;
  avatar_config?: any;
  provider_id?: string;
}): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Confira o nome e a função do agente.');
  }
  return res.json();
}

export async function updateAgent(name: string, profile: { role: string; description: string; provider_id?: string }): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...profile }),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Não foi possível atualizar o agente.');
  }
  return res.json();
}

export async function fetchHistory(limit = 80): Promise<HistorySnapshot> {
  const res = await fetch(`${API_BASE}/api/history?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function fetchAgentHistory(agentName: string, limit = 80): Promise<{ messages: AgentMessage[] }> {
  const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentName)}/history?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function fetchRoutines(agentName?: string): Promise<RoutineSummary[]> {
  const suffix = agentName ? `?agent_name=${encodeURIComponent(agentName)}` : '';
  const res = await fetch(`${API_BASE}/api/routines${suffix}`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function createRoutine(routine: {
  name: string;
  agent_name: string;
  prompt: string;
  schedule: string;
}): Promise<RoutineSummary> {
  const res = await fetch(`${API_BASE}/api/routines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(routine),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Não foi possível criar a rotina.');
  }
  return res.json();
}

export async function fetchRoutine(routineId: string): Promise<RoutineDetail> {
  const res = await fetch(`${API_BASE}/api/routines/${encodeURIComponent(routineId)}`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function updateRoutine(
  routineId: string,
  patch: Partial<{ name: string; prompt: string; schedule: string; status: string }>
): Promise<RoutineSummary> {
  const res = await fetch(`${API_BASE}/api/routines/${encodeURIComponent(routineId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Não foi possível atualizar a rotina.');
  }
  return res.json();
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/routines/${encodeURIComponent(routineId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
}

export async function runRoutineNow(routineId: string): Promise<{ id: string; status: string; triggered_at: string }> {
  const res = await fetch(`${API_BASE}/api/routines/${encodeURIComponent(routineId)}/run`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Não foi possível executar a rotina agora.');
  }
  return res.json();
}

export async function triggerKillSwitch(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/kill-switch`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function resumeRuntime(): Promise<{ status: string; resumed_agents: number }> {
  const res = await fetch(`${API_BASE}/api/resume`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function fetchTools(): Promise<ToolInfo[]> {
  const res = await fetch(`${API_BASE}/api/tools`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function fetchProviders(): Promise<ProviderInfo[]> {
  const res = await fetch(`${API_BASE}/api/providers`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function fetchProviderCredentials(): Promise<ProviderCredential[]> {
  const res = await fetch(`${API_BASE}/api/credentials`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const records = await res.json();
  return (Array.isArray(records) ? records : []).map((item) => ({
    ...item,
    id: item.id || item.provider_id,
    provider: item.provider || item.provider_id,
    name: item.name || item.provider_id,
  }));
}

export async function saveProviderCredential(input: {
  provider: string;
  name: string;
  api_key: string;
  model?: string;
  base_url?: string;
}): Promise<ProviderCredential> {
  const providerId = input.provider.trim().toLowerCase();
  const res = await fetch(`${API_BASE}/api/credentials/${encodeURIComponent(providerId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: input.api_key, model: input.model, base_url: input.base_url }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : `HTTP error! status: ${res.status}`);
  }
  const item = await res.json();
  return { ...item, id: item.id || item.provider_id, provider: item.provider || item.provider_id, name: input.name || item.provider_id };
}

export async function deleteProviderCredential(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
}

export async function testProviderCredential(id: string): Promise<{ ok: boolean; detail?: string }> {
  const res = await fetch(`${API_BASE}/api/credentials/${encodeURIComponent(id)}/test`, { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.detail === 'string' ? body.detail : `HTTP error! status: ${res.status}`);
  }
  return body;
}

export interface TerminalSession {
  session_id: string;
  provider: 'codex' | 'claude';
  cwd: string;
  running: boolean;
  websocket: string;
}

export async function createTerminalSession(
  provider: 'codex' | 'claude',
  cwd?: string,
): Promise<TerminalSession> {
  const res = await fetch(`${API_BASE}/api/terminal/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, cwd }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.detail === 'string' ? body.detail : `HTTP error! status: ${res.status}`);
  return body;
}

export async function stopTerminalSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/terminal/sessions/${encodeURIComponent(sessionId)}/stop`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
}

export function connectTerminalSession(
  sessionId: string,
  onMessage: (message: any) => void,
  onConnectionChange?: (connected: boolean) => void,
): () => void {
  const ws = new WebSocket(`${WS_BASE}/ws/terminal/${encodeURIComponent(sessionId)}`);
  ws.onopen = () => onConnectionChange?.(true);
  ws.onclose = () => onConnectionChange?.(false);
  ws.onerror = () => onConnectionChange?.(false);
  ws.onmessage = (event) => {
    try { onMessage(JSON.parse(event.data)); } catch { /* ignore malformed stream chunks */ }
  };
  return () => ws.close();
}

export function sendTerminalInput(sessionId: string, text: string): void {
  // The interactive socket is intentionally opened by the terminal panel; this
  // helper is kept for callers that own a WebSocket and is not used for secrets.
  void fetch(`${API_BASE}/api/terminal/sessions/${encodeURIComponent(sessionId)}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export function connectWebSocket(
  onEvent: (event: WaddleEvent) => void,
  onHistorySync?: (events: WaddleEvent[]) => void,
  onConnectionChange?: (connected: boolean) => void
): () => void {
  let ws: WebSocket | null = null;
  let isClosedIntentionally = false;
  let retryTimer: any = null;

  function connect() {
    try {
      ws = new WebSocket(`${WS_BASE}/ws/events`);

      ws.onopen = () => {
        onConnectionChange?.(true);
      };

      ws.onmessage = (messageEvent) => {
        try {
          const payload = JSON.parse(messageEvent.data);
          if (payload.type === 'history_sync' && Array.isArray(payload.events)) {
            onHistorySync?.(payload.events);
          } else {
            onEvent(payload);
          }
        } catch (e) {
          console.error('[WS Parse Error]', e);
        }
      };

      ws.onclose = () => {
        onConnectionChange?.(false);
        if (!isClosedIntentionally) {
          retryTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        onConnectionChange?.(false);
      };
    } catch {
      onConnectionChange?.(false);
      if (!isClosedIntentionally) {
        retryTimer = setTimeout(connect, 3000);
      }
    }
  }

  connect();

  return () => {
    isClosedIntentionally = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (ws) ws.close();
  };
}
