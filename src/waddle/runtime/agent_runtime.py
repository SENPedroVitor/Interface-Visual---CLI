"""Agent Runtime for Waddle Agent OS.

Coordinates agents, task lifecycle, tool executions, storage persistence, and emergency stop.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional
import uuid

from ..core.event_bus import EventBus, Event, global_event_bus
from ..tasks.task import Task, TaskStatus
from ..tasks.manager import TaskManager
from ..tools.registry import ToolRegistry, global_tool_registry
from ..tools.filesystem import register_filesystem_tools
from ..tools.shell import register_shell_tools
from ..agents.base import Agent, AgentStatus
from ..agents.manager import ManagerAgent
from ..agents.worker import WorkerAgent
from ..storage.database import Database


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AgentRuntime:
    def __init__(
        self,
        event_bus: Optional[EventBus] = None,
        tool_registry: Optional[ToolRegistry] = None,
        db_path: Optional[str] = None,
    ) -> None:
        self.event_bus = event_bus or global_event_bus
        self.tool_registry = tool_registry or global_tool_registry
        self.task_manager = TaskManager(event_bus=self.event_bus)
        self.database = Database(db_path=db_path)
        self.agents: dict[str, Agent] = {}
        self._is_stopped = False
        self._active_run_id: Optional[str] = None

        # Register standard default tools
        register_filesystem_tools(self.tool_registry)
        register_shell_tools(self.tool_registry)

        # Wire database persistence to event bus
        self._setup_event_persistence()

        # Reflect real task-dependency waiting onto agent status
        self._setup_agent_state_wiring()

        # Register default agents (Manager + Worker)
        self._setup_default_agents()
        for profile in self.database.list_agent_profiles():
            self.register_agent(WorkerAgent(**profile, event_bus=self.event_bus, tool_registry=self.tool_registry))

    def create_agent(self, name: str, role: str, description: str = "") -> dict[str, Any]:
        name = name.strip()
        if not name or len(name) > 32 or not all(c.isalnum() or c in ' -_' for c in name):
            raise ValueError('Use um nome de até 32 caracteres, com letras, números ou espaços.')
        if name.casefold() in {n.casefold() for n in self.agents} | {'system', 'sistema', 'user', 'usuário'}:
            raise ValueError('Já existe um agente com esse nome ou o nome é reservado.')
        if role not in {'Research', 'Developer', 'Reviewer', 'Executor'}:
            raise ValueError('Escolha uma função válida.')
        agent = WorkerAgent(name=name, role=role, description=description.strip(), event_bus=self.event_bus, tool_registry=self.tool_registry)
        self.database.save_agent(agent.name, agent.role, agent.description)
        self.register_agent(agent)
        return agent.to_dict()

    def _setup_default_agents(self) -> None:
        quinta = ManagerAgent(
            task_manager=self.task_manager,
            name="Quinta",
            role="Manager",
            description="Coordenação da equipe, planejamento e consolidação de resultados.",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
        )
        atlas = WorkerAgent(
            name="Atlas",
            role="Research",
            description="Pesquisa de informações, análise de fontes e documentação.",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
        )
        nero = WorkerAgent(
            name="Nero",
            role="Developer",
            description="Implementação de código, automação de terminal e manipulação de arquivos.",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
        )
        iris = WorkerAgent(
            name="Iris",
            role="Reviewer",
            description="Revisão de qualidade, validação de critérios e consistência.",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
        )
        self.register_agent(quinta)
        self.register_agent(atlas)
        self.register_agent(nero)
        self.register_agent(iris)

        # Aliases for backwards compatibility with legacy tests
        self.agents["Manager"] = quinta
        self.agents["Worker"] = nero

    def _setup_event_persistence(self) -> None:
        async def on_any_event(event: Event) -> None:
            try:
                self.database.save_event(
                    event_id=event.id,
                    event_type=event.type,
                    source=event.source,
                    data=event.data,
                    timestamp=event.timestamp,
                )
                if event.type == "agent.message":
                    msg_dict = event.data.get("message", {})
                    if msg_dict:
                        self.database.save_message(msg_dict)
            except Exception as err:
                print(f"[AgentRuntime] Persistence error: {err}")

        self.event_bus.subscribe("*", on_any_event)

    def _setup_agent_state_wiring(self) -> None:
        """Reflect the task manager's real dependency waiting onto the
        assigned agent's status, so the mascot's motion honestly shows when
        an agent is stuck waiting on another task rather than sitting idle."""

        async def on_task_created(event: Event) -> None:
            task = event.data.get("task", {})
            if task.get("status") != "blocked":
                return
            agent = self.agents.get(task.get("assigned_agent") or "")
            if agent:
                await agent.set_status(AgentStatus.WAITING)

        async def on_task_unblocked(event: Event) -> None:
            task = event.data.get("task", {})
            agent = self.agents.get(task.get("assigned_agent") or "")
            if agent and agent.status == AgentStatus.WAITING:
                await agent.set_status(AgentStatus.IDLE)

        self.event_bus.subscribe("task.created", on_task_created)
        self.event_bus.subscribe("task.unblocked", on_task_unblocked)

    def register_agent(self, agent: Agent) -> None:
        self.agents[agent.name] = agent

    def get_agent(self, name: str) -> Optional[Agent]:
        return self.agents.get(name)

    def list_agents(self) -> list[dict[str, Any]]:
        activity = self.database.agent_activity()
        seen_ids = set()
        result = []
        for agent in self.agents.values():
            if agent.id not in seen_ids:
                seen_ids.add(agent.id)
                result.append({**agent.to_dict(), 'last_activity_at': activity.get(agent.name)})
        return result

    async def run_objective(self, objective: str, parameters: Optional[dict[str, Any]] = None, agent_name: Optional[str] = None) -> dict[str, Any]:
        """Execute a full workflow starting from a user objective."""
        self._is_stopped = False
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        self._active_run_id = run_id
        start_ts = _utc_iso()

        self.database.save_run(run_id=run_id, objective=objective, status="running", created_at=start_ts)

        await self.event_bus.emit(
            "run.started",
            {"run_id": run_id, "objective": objective, "agent_name": agent_name or 'Quinta'},
            source="runtime",
        )

        manager: Optional[ManagerAgent] = self.agents.get("Quinta") or self.agents.get("Manager")  # type: ignore
        if not manager or not isinstance(manager, ManagerAgent):
            raise RuntimeError("Manager agent is required to coordinate run.")

        # Step 1: Manager plans objective into subtasks
        recipient = self.get_agent(agent_name) if agent_name else manager
        if recipient is None:
            raise ValueError('Agente não encontrado.')
        plan_parameters = dict(parameters or {})
        if recipient is not manager:
            plan_parameters['_assigned_agent'] = recipient.name
        tasks = await manager.plan_objective(objective, plan_parameters, response_agent=recipient)
        for t in tasks:
            self.database.save_task(t.to_dict(), run_id=run_id)

        # Step 2: Loop until all runnable tasks are executed or system stopped
        all_completed = True
        has_failed = False

        while not self._is_stopped:
            runnable_task = self.task_manager.get_next_runnable_task()
            if not runnable_task:
                # Check if any tasks are still running or blocked
                current_tasks = self.task_manager.list_tasks()
                active = [t for t in current_tasks if t["status"] in ("running", "blocked", "pending")]
                if not active:
                    break
                # If blocked without runnable, check if deadlock or failure occurred
                blocked_tasks = [t for t in current_tasks if t["status"] == "blocked"]
                failed_tasks = [t for t in current_tasks if t["status"] == "failed"]
                if blocked_tasks and failed_tasks:
                    has_failed = True
                    break
                await asyncio.sleep(0.05)
                continue

            # Mark task running
            await self.task_manager.update_status(runnable_task.id, TaskStatus.RUNNING)
            self.database.save_task(runnable_task.to_dict(), run_id=run_id)

            # Determine agent
            agent_name = runnable_task.assigned_agent or "Nero"
            agent = self.agents.get(agent_name) or self.agents.get("Nero") or self.agents.get("Worker")
            if not agent:
                await self.task_manager.update_status(
                    runnable_task.id, TaskStatus.FAILED, error=f"No agent found: {agent_name}"
                )
                self.database.save_task(runnable_task.to_dict(), run_id=run_id)
                has_failed = True
                continue

            try:
                task_output = await agent.execute_task(runnable_task)
                await self.task_manager.update_status(
                    runnable_task.id, TaskStatus.COMPLETED, output=task_output
                )
                self.database.save_task(runnable_task.to_dict(), run_id=run_id)
            except Exception as exc:
                err = str(exc)
                await self.task_manager.update_status(
                    runnable_task.id, TaskStatus.FAILED, error=err
                )
                self.database.save_task(runnable_task.to_dict(), run_id=run_id)
                has_failed = True

        final_status = "cancelled" if self._is_stopped else ("failed" if has_failed else "completed")
        self.database.save_run(
            run_id=run_id,
            objective=objective,
            status=final_status,
            created_at=start_ts,
            completed_at=_utc_iso(),
        )

        await self.event_bus.emit(
            f"run.{final_status}",
            {"run_id": run_id, "status": final_status, "objective": objective, "agent_name": agent_name or 'Quinta'},
            source="runtime",
        )

        return {
            "run_id": run_id,
            "status": final_status,
            "tasks": self.task_manager.list_tasks(),
        }

    async def stop_all(self, reason: str = "Kill Switch activated by user") -> dict[str, Any]:
        """Emergency kill switch stopping all agent executions immediately."""
        self._is_stopped = True
        cancelled = await self.task_manager.cancel_all(reason=reason)

        for agent in self.agents.values():
            await agent.set_status(AgentStatus.STOPPED)

        if self._active_run_id:
            self.database.save_run(
                run_id=self._active_run_id,
                objective="Interrupted by Kill Switch",
                status="cancelled",
                created_at=_utc_iso(),
                completed_at=_utc_iso(),
            )

        return {
            "status": "stopped",
            "cancelled_tasks": cancelled,
            "reason": reason,
        }
