import React, { useEffect, useState, useCallback } from 'react';
import { Agent, Task, ToolInfo, WaddleEvent, SystemStatus } from './types';
import { fetchStatus, fetchTools, submitObjective, triggerKillSwitch, connectWebSocket } from './services/api';
import { AgentSidebar } from './components/AgentSidebar';
import { ConversationView, ChatItem } from './components/ConversationView';
import { DeveloperDrawer } from './components/DeveloperDrawer';

export const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [events, setEvents] = useState<WaddleEvent[]>([]);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<'active' | 'stopped'>('active');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(false);
  const [isDevDrawerOpen, setIsDevDrawerOpen] = useState<boolean>(false);

  // Track last message per agent for sidebar preview
  const [agentPreviews, setAgentPreviews] = useState<Record<string, string>>({});

  const refreshData = useCallback(async () => {
    try {
      const statusData: SystemStatus = await fetchStatus();
      const agentsList = statusData.agents || [];
      setAgents(agentsList);
      setTasks(statusData.tasks || []);
      setSystemStatus(statusData.status);

      if (!selectedAgentId && agentsList.length > 0) {
        const quinta = agentsList.find((a) => a.name === 'Quinta') || agentsList[0];
        setSelectedAgentId(quinta.id);
      }

      const toolsData = await fetchTools();
      setTools(toolsData || []);
    } catch (err) {
      console.error('[API Error]', err);
    }
  }, [selectedAgentId]);

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
        const newItem: ChatItem = {
          id: msg.id || String(Date.now()),
          type: 'message',
          sender: (['quinta', 'atlas', 'nero', 'iris'].includes(senderLower)
            ? senderLower
            : 'system') as ChatItem['sender'],
          senderName: msg.from,
          content: msg.content,
          timestamp: ts,
        };
        setChatItems((prev) => [...prev, newItem]);

        // Update sidebar preview for the agent
        if (msg.from) {
          setAgentPreviews((prev) => ({
            ...prev,
            [`agent-${msg.from.toLowerCase()}`]: msg.content?.slice(0, 60) || '',
          }));
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
              senderName: task.assigned_agent,
              activityStatus: 'Em andamento',
              content: task.title,
              timestamp: ts,
            },
          ]);
        }
      } else if (newEvent.type === 'tool.completed') {
        const data = newEvent.data || {};
        if (data.tool_name === 'write_file' || data.tool_name === 'read_file') {
          setChatItems((prev) => [
            ...prev,
            {
              id: `art-${newEvent.id}`,
              type: 'artifact',
              sender: 'nero',
              senderName: 'Nero',
              content: '',
              timestamp: ts,
              artifact: {
                filename: 'waddle_result.txt',
                description: 'Arquivo gerado pela equipe',
                bytes: 94,
                content: 'Gerado pelo Waddle Agent OS:\nExecução realizada por Quinta, Atlas, Nero e Iris.',
              },
            },
          ]);
        }
      } else if (newEvent.type === 'system.kill_switch') {
        setSystemStatus('stopped');
        setChatItems((prev) => [
          ...prev,
          {
            id: newEvent.id,
            type: 'message',
            sender: 'system',
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

  const handleSendMessage = async (text: string) => {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChatItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        type: 'message',
        sender: 'user',
        content: text,
        timestamp: ts,
      },
    ]);

    setIsSending(true);
    try {
      await submitObjective(text);
      await refreshData();
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

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0] || null;

  return (
    <div className="app-shell">
      <AgentSidebar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
        onOpenDeveloperMode={() => setIsDevDrawerOpen(true)}
        onKillSwitch={handleKillSwitch}
        isKillSwitchActive={isKillSwitchActive}
        systemStatus={systemStatus}
        agentPreviews={agentPreviews}
      />

      <ConversationView
        currentAgent={selectedAgent}
        chatItems={chatItems}
        onSendMessage={handleSendMessage}
        isSending={isSending}
      />

      <DeveloperDrawer
        isOpen={isDevDrawerOpen}
        onClose={() => setIsDevDrawerOpen(false)}
        tasks={tasks}
        tools={tools}
        events={events}
        onKillSwitch={handleKillSwitch}
      />
    </div>
  );
};

export default App;
