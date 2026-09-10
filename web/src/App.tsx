import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Agent, ArtifactSummary, ProviderInfo, RoutineSummary, Task, ToolInfo, WaddleEvent, SystemStatus, GroupSummary } from './types';
import { fetchHistory, fetchProviders, fetchStatus, fetchTools, submitObjective, triggerKillSwitch, connectWebSocket } from './services/api';
import { AgentSidebar } from './components/AgentSidebar';
import { ConversationView, ChatItem } from './components/ConversationView';
import { DeveloperDrawer } from './components/DeveloperDrawer';
import { useTimeOfDay } from './hooks/useTimeOfDay';
import { useAgentPresence } from './hooks/useAgentPresence';
import { AgentStudioModal } from './components/AgentStudioModal';
import { GlobalActionMenu } from './components/GlobalActionMenu';
import { NewGroupDialog } from './components/NewGroupDialog';
import { RoutineDrawer } from './components/RoutineDrawer';
import { PluginsModal } from './components/PluginsModal';
import { ConversationOverview } from './components/ConversationOverview';

/** agent_id from the event bus looks like "agent-nero" — recover a display name from it. */
function agentNameFromId(agentId?: string): { key: ChatItem['sender']; name: string } {
  const key = (agentId || '').replace(/^agent-/, '').toLowerCase();
  if (key) {
    return { key: key as ChatItem['sender'], name: key.charAt(0).toUpperCase() + key.slice(1) };
  }
  return { key: 'system', name: 'Sistema' };
}

/**
 * Turns a real tool_name + params into a plain-language activity label — no
 * invented content. The real value (path/command) is wrapped in backticks so
 * ConversationView can render it as an inline code chip.
 */
function describeToolCall(toolName: string, params: Record<string, any> = {}): string {
  if (toolName === 'write_file' && params.path) return `Escrevendo \`${params.path}\``;
  if (toolName === 'read_file' && params.path) return `Lendo \`${params.path}\``;
  if (toolName === 'list_directory' && params.path) return `Listando \`${params.path}\``;
  if (toolName === 'run_command' && params.command) return `Executando \`${params.command}\``;
  return `Executando \`${toolName}\``;
}

const TOOL_ICONS: Record<string, string> = {
  write_file: 'write_file',
  read_file: 'read_file',
  list_directory: 'list_directory',
  run_command: 'run_command',
};

const THEME_STORAGE_KEY = 'waddle-theme';

/** Explicit choice (if any) always wins; otherwise follow the OS preference. */
function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.dataset.theme = stored;
      return;
    }
    // No explicit choice yet — track the system setting live.
    delete document.documentElement.dataset.theme;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      const value = next ? 'dark' : 'light';
      document.documentElement.dataset.theme = value;
      localStorage.setItem(THEME_STORAGE_KEY, value);
      return next;
    });
  }, []);

  return { isDark, toggleTheme };
}

export const App: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const dayPart = useTimeOfDay();
  useEffect(() => {
    document.documentElement.dataset.daypart = dayPart;
  }, [dayPart]);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [events, setEvents] = useState<WaddleEvent[]>([]);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);
  const [systemStatus, setSystemStatus] = useState<'active' | 'stopped'>('active');
  const [apiError, setApiError] = useState('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(false);
  const [isDevDrawerOpen, setIsDevDrawerOpen] = useState<boolean>(false);

  // Modals state
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<DOMRect | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioAgent, setStudioAgent] = useState<Agent | null>(null);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [openRoutineId, setOpenRoutineId] = useState<string | null>(null);
  const [isPluginsOpen, setIsPluginsOpen] = useState(false);
  const [presentation, setPresentation] = useState(false);

  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setPresentation(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);

  // Track last message per agent for sidebar preview
  const [agentPreviews, setAgentPreviews] = useState<Record<string, string>>({});
  const [isOverviewCompact, setIsOverviewCompact] = useState<boolean>(() => {
    return localStorage.getItem('waddle-overview-compact') === 'true';
  });

  const handleToggleOverviewCompact = useCallback(() => {
    setIsOverviewCompact((prev) => {
      const next = !prev;
      localStorage.setItem('waddle-overview-compact', String(next));
      return next;
    });
  }, []);

  const visibleAgents = useAgentPresence(agents, events);
  const selectedAgent = visibleAgents.find((a) => a.id === selectedAgentId) || visibleAgents[0] || null;
  const activeGroup = groups.find((g) => g.id === selectedGroupId);

  const currentViewAgent: Agent | null = activeGroup
    ? {
        id: activeGroup.id,
        name: activeGroup.name,
        role: `Squad (${activeGroup.members.length} bots)`,
        description: activeGroup.description || 'Squad colaborativo de agentes.',
        status: 'idle',
        avatar_config: {
          color: '#a855f7',
          marking: 'none',
          cosmetics: { head: 'crown' },
        },
      }
    : selectedAgent;

  const selectedAgentRef = useRef(selectedAgent);
  useEffect(() => {
    selectedAgentRef.current = selectedAgent;
  }, [selectedAgent]);

  const writeContentCacheRef = useRef<Record<string, string>>({});
  const historyHydratedRef = useRef(false);

  const refreshData = useCallback(async () => {
    try {
      setApiError('');
      const statusData: SystemStatus = await fetchStatus();
      const agentsList = statusData.agents || [];
      setAgents(agentsList);
      setTasks(statusData.tasks || []);
      setSystemStatus(statusData.status);

      if (agentsList.length > 0) {
        const quinta = agentsList.find((a) => a.name === 'Quinta') || agentsList[0];
        setSelectedAgentId(prev => prev || quinta.id);
      }

      // Fetch Groups
      try {
        const gRes = await fetch('/api/groups');
        if (gRes.ok) {
          const gData = await gRes.json();
          setGroups(gData || []);
        }
      } catch (_) {}

      const toolsData = await fetchTools();
      setTools(toolsData || []);
      const providersData = await fetchProviders();
      setProviders(providersData || []);

      const historyData = await fetchHistory();
      setArtifacts(historyData.artifacts || []);
      setRoutines(historyData.routines || []);
      if (!historyHydratedRef.current && historyData.messages?.length) {
        const restored = [...historyData.messages].reverse().map((msg): ChatItem => ({
          id: msg.id,
          type: 'message',
          sender: msg.from.toLowerCase(),
          agentKey: (msg.data?.conversation_agent || msg.from).toLowerCase(),
          senderName: msg.from,
          content: msg.content,
          timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          justArrived: false,
        }));
        setChatItems(restored);
        historyHydratedRef.current = true;
      }
    } catch (err) {
      setApiError('Servidor local indisponível. Confira se a API está rodando em 127.0.0.1:8000.');
      console.error('[API Error]', err);
    }
  }, []);

  useEffect(() => {
    refreshData();

    const cleanupWs = connectWebSocket((newEvent: WaddleEvent) => {
      setEvents((prev) => [newEvent, ...prev.slice(0, 99)]);

      const ts = new Date(newEvent.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      if (newEvent.type === 'agent.message') {
        const msg = newEvent.data.message || {};
        const senderLower = (msg.from || '').toLowerCase();
        const conversationAgent = (msg.data?.conversation_agent || msg.from || '').toLowerCase();
        const newItem: ChatItem = {
          id: msg.id || String(Date.now()),
          type: 'message',
          sender: senderLower || 'system',
          agentKey: conversationAgent || senderLower || 'system',
          senderName: msg.from,
          content: msg.content,
          timestamp: ts,
          // Decided once, right here, at creation — never recomputed on a
          // later re-render (this component re-renders on every websocket
          // event via refreshData() below, which would otherwise flip this
          // false mid-animation and make the reveal look instantaneous).
          justArrived: true,
        };
        setChatItems((prev) => [...prev, newItem]);

        // A finished write_file becomes a real artifact card — real
        // filename and byte count from the tool result, real content
        // recovered from the write_file call we cached above (same
        // task_id), never invented.
        if (msg.type === 'task_result' && Array.isArray(msg.data?.results)) {
          msg.data.results.forEach((result: any, idx: number) => {
            if (result?.tool_name === 'write_file' && result.success && result.result?.path) {
              const fullPath: string = result.result.path;
              const filename = fullPath.split(/[\\/]/).pop() || fullPath;
              setChatItems((prev) => [
                ...prev,
                {
                  id: `art-${newItem.id}-${idx}`,
                  type: 'artifact',
                  sender: newItem.sender,
                  agentKey: newItem.agentKey,
                  senderName: msg.from,
                  content: '',
                  timestamp: ts,
                  artifact: {
                    filename,
                    description: `Gerado por ${msg.from}`,
                    bytes: result.result.bytes_written,
                    content: writeContentCacheRef.current[msg.task_id],
                  },
                },
              ]);
            }
          });
        }

        // Update sidebar preview for the agent
        if (msg.from) {
          setAgentPreviews((prev) => ({
            ...prev,
            [`agent-${msg.from.toLowerCase()}`]: msg.content?.slice(0, 60) || '',
          }));
        }
      } else if (newEvent.type === 'task.created') {
        // Chats are separated per bot now, so without this, delegation is
        // invisible from Quinta's own thread — you'd have to already know
        // to switch to the worker's tab to see she handed something off.
        const task = newEvent.data.task;
        if (task && task.assigned_agent && task.assigned_agent !== 'Quinta') {
          setChatItems((prev) => [
            ...prev,
            {
              id: `delegate-${task.id}`,
              type: 'context_activity',
              sender: 'quinta',
              agentKey: 'quinta',
              senderName: 'Quinta',
              activityStatus: `→ ${task.assigned_agent}`,
              activityState: 'done',
              content: task.title,
              timestamp: ts,
            },
          ]);
        }
      } else if (newEvent.type === 'task.running') {
        const task = newEvent.data.task;
        if (task && task.assigned_agent && task.assigned_agent !== 'Quinta') {
          setChatItems((prev) => [
            ...prev,
            {
              id: `act-${task.id}`,
              type: 'context_activity',
              sender: task.assigned_agent.toLowerCase() as ChatItem['sender'],
              agentKey: task.assigned_agent.toLowerCase(),
              senderName: task.assigned_agent,
              activityStatus: 'Em andamento',
              content: task.title,
              timestamp: ts,
            },
          ]);
        }
      } else if (newEvent.type === 'tool.started') {
        const data = newEvent.data || {};
        if (data.tool_name === 'write_file' && data.task_id && typeof data.params?.content === 'string') {
          writeContentCacheRef.current[data.task_id] = data.params.content;
        }
        const agent = agentNameFromId(data.agent_id);
        const activityId = `act-${data.task_id || data.agent_id}-${data.tool_name}`;
        setChatItems((prev) => [
          ...prev,
          {
            id: activityId,
            type: 'context_activity',
            sender: agent.key,
            agentKey: agent.key,
            senderName: agent.name,
            activityStatus: 'Em andamento',
            activityState: 'running',
            activityIcon: TOOL_ICONS[data.tool_name] || 'tool',
            content: describeToolCall(data.tool_name, data.params || {}),
            timestamp: ts,
          },
        ]);
      } else if (newEvent.type === 'tool.completed') {
        const data = newEvent.data || {};
        const activityId = `act-${data.task_id || data.agent_id}-${data.tool_name}`;
        setChatItems((prev) =>
          prev.map((item) =>
            item.id === activityId
              ? { ...item, activityStatus: `Concluído em ${Math.round(data.duration_ms || 0)}ms`, activityState: 'done' }
              : item
          )
        );
      } else if (newEvent.type === 'tool.failed') {
        const data = newEvent.data || {};
        const activityId = `act-${data.task_id || data.agent_id}-${data.tool_name}`;
        setChatItems((prev) =>
          prev.map((item) =>
            item.id === activityId
              ? { ...item, activityStatus: 'Falhou', activityState: 'failed', content: `${item.content} — ${data.error || 'erro desconhecido'}` }
              : item
          )
        );
      } else if (newEvent.type === 'system.kill_switch') {
        setSystemStatus('stopped');
        setChatItems((prev) => [
          ...prev,
          {
            id: newEvent.id,
            type: 'message',
            sender: 'system',
            agentKey: (selectedAgentRef.current?.name || 'Quinta').toLowerCase(),
            senderName: 'Sistema',
            content: 'Parada de emergência acionada. Todas as tarefas foram canceladas.',
            timestamp: ts,
          },
        ]);
      }

      refreshData();
    });

    const timer = setInterval(refreshData, 5000);
    return () => {
      cleanupWs();
      clearInterval(timer);
    };
  }, [refreshData]);

  const handleExportBackup = async () => {
    try {
      const res = await fetch('/api/backup/export');
      if (!res.ok) throw new Error('Falha ao exportar backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `waddle-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Erro ao exportar backup.');
    }
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsed }),
      });
      if (!res.ok) throw new Error('Falha ao importar backup.');
      await refreshData();
      alert('Backup restaurado com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao importar backup.');
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSending) return;

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetAgentName = activeGroup ? activeGroup.members[0] || 'Quinta' : selectedAgent?.name || 'Quinta';
    const conversationKey = activeGroup ? activeGroup.name.toLowerCase() : (selectedAgent?.name || 'Quinta').toLowerCase();

    setChatItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        type: 'message',
        sender: 'user',
        agentKey: conversationKey,
        content: text,
        timestamp: ts,
      },
    ]);

    setIsSending(true);
    try {
      await submitObjective(text, undefined, targetAgentName);
      await refreshData();
    } catch (err) {
      setChatItems(prev => [...prev, { id: `error-${Date.now()}`, type: 'message', sender: 'system', senderName: 'Sistema', agentKey: conversationKey, content: 'Não foi possível enviar a mensagem. Confira se o servidor está disponível e tente novamente.', timestamp: ts }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKillSwitch = async () => {
    if (!window.confirm('Parar todos os agentes imediatamente?')) return;
    setIsKillSwitchActive(true);
    try {
      await triggerKillSwitch();
      setSystemStatus('stopped');
      await refreshData();
    } finally {
      setIsKillSwitchActive(false);
    }
  };

  const filteredChatItems = activeGroup
    ? chatItems.filter(item =>
        activeGroup.members.some(m => m.toLowerCase() === item.agentKey) ||
        item.agentKey === activeGroup.name.toLowerCase() ||
        item.agentKey === activeGroup.id
      )
    : chatItems.filter(item => item.agentKey === (selectedAgent?.name || 'Quinta').toLowerCase());

  return (
    <div className={`app-shell ${presentation ? 'is-presentation' : ''}`}>
      <AgentSidebar
        agents={visibleAgents}
        groups={groups}
        tasks={tasks}
        selectedAgentId={selectedAgentId}
        selectedGroupId={selectedGroupId}
        onSelectAgent={(id) => {
          setSelectedAgentId(id);
          setSelectedGroupId(undefined);
        }}
        onSelectGroup={(id) => {
          setSelectedGroupId(id);
        }}
        onOpenDeveloperMode={() => setIsDevDrawerOpen(true)}
        onOpenPlugins={() => setIsPluginsOpen(true)}
        onKillSwitch={handleKillSwitch}
        isKillSwitchActive={isKillSwitchActive}
        systemStatus={systemStatus}
        agentPreviews={agentPreviews}
        isDarkTheme={isDark}
        onToggleTheme={toggleTheme}
        onOpenActionMenu={(rect) => {
          setActionMenuAnchor(rect);
          setIsActionMenuOpen(true);
        }}
      />


      <ConversationView
        key={selectedGroupId || selectedAgent?.id}
        currentAgent={currentViewAgent}
        isGroup={!!activeGroup}
        chatItems={filteredChatItems}
        onSendMessage={handleSendMessage}
        isSending={isSending}
        presentation={presentation}
        onTogglePresentation={() => setPresentation(prev => !prev)}
        tasks={tasks}
        artifacts={artifacts}
        routines={routines}
        onEditAgent={() => {
          setStudioAgent(selectedAgent);
          setIsStudioOpen(true);
        }}
        onOpenRoutine={(id) => setOpenRoutineId(id)}
        apiError={apiError}
      />

      <ConversationOverview
        currentAgent={currentViewAgent}
        currentGroup={activeGroup}
        agents={visibleAgents}
        tasks={tasks}
        artifacts={artifacts}
        routines={routines}
        onOpenRoutine={(id) => setOpenRoutineId(id)}
        isCompact={isOverviewCompact}
        onToggleCompact={handleToggleOverviewCompact}
        onCustomizeAgent={(agent) => {
          setStudioAgent(agent);
          setIsStudioOpen(true);
        }}
      />

      <RoutineDrawer
        isOpen={!!openRoutineId}
        routineId={openRoutineId}
        onClose={() => setOpenRoutineId(null)}
        onChanged={refreshData}
      />

      <PluginsModal
        isOpen={isPluginsOpen}
        onClose={() => setIsPluginsOpen(false)}
        tools={tools}
        providers={providers}
      />

      <GlobalActionMenu
        isOpen={isActionMenuOpen}
        anchorRect={actionMenuAnchor}
        onClose={() => setIsActionMenuOpen(false)}
        onNewBot={() => {
          setStudioAgent(null);
          setIsStudioOpen(true);
        }}
        onNewGroup={() => setIsNewGroupOpen(true)}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />

      {isStudioOpen && (
        <AgentStudioModal
          isOpen={isStudioOpen}
          agent={studioAgent}
          onClose={() => setIsStudioOpen(false)}
          onSaved={async (saved) => {
            await refreshData();
            if (saved?.name) {
              const found = agents.find(a => a.name.toLowerCase() === saved.name.toLowerCase());
              if (found) setSelectedAgentId(found.id);
            }
          }}
        />
      )}

      {isNewGroupOpen && (
        <NewGroupDialog
          isOpen={isNewGroupOpen}
          agents={visibleAgents}
          onClose={() => setIsNewGroupOpen(false)}
          onCreated={async (newGrp) => {
            await refreshData();
            setSelectedGroupId(newGrp.id);
          }}
        />
      )}

      <DeveloperDrawer
        isOpen={isDevDrawerOpen}
        onClose={() => setIsDevDrawerOpen(false)}
        tasks={tasks}
        tools={tools}
        providers={providers}
        events={events}
        onKillSwitch={handleKillSwitch}
      />
    </div>
  );
};

export default App;
