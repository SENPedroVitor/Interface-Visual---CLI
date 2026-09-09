import { useEffect, useRef, useState } from 'react';
import { Agent, WaddleEvent } from '../types';

/** Keep terminal expressions visible briefly; never delay actual task execution. */
export function useAgentPresence(agents: Agent[], events: WaddleEvent[]): Agent[] {
  const [expressions, setExpressions] = useState<Record<string, Agent['status']>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const seen = useRef(new Set<string>());

  useEffect(() => {
    for (const event of [...events].reverse()) {
      if (seen.current.has(event.id)) continue;
      seen.current.add(event.id);

      const data = event.data;
      const name = data.agent_name || data.task?.assigned_agent ||
        (event.type.startsWith('run.') ? data.agent_name || 'Quinta' : undefined);
      if (!name) continue;

      const id = `agent-${name.toLowerCase()}`;
      let status: Agent['status'] | undefined;
      if (event.type === 'task.completed' || event.type === 'run.completed') status = 'done';
      else if (event.type === 'task.failed' || event.type === 'run.failed') status = 'blocked';
      else if (event.type === 'agent.status_change' && data.new_status !== 'idle') status = data.new_status;
      else if (event.type === 'task.running') status = 'working';
      if (!status) continue;

      clearTimeout(timers.current[id]);
      setExpressions(prev => ({ ...prev, [id]: status! }));
      // Polling owns long-lived states. Only completion needs an animation hold.
      timers.current[id] = setTimeout(() => {
        setExpressions(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, status === 'done' ? 2400 : status === 'blocked' ? 4000 : 300);
    }

    seen.current = new Set(events.map(event => event.id));
  }, [events]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  return agents.map(agent => ({ ...agent, status: agent.status === 'stopped' ? 'stopped' : expressions[agent.id] || agent.status }));
}
