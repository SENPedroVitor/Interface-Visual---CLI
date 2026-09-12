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
from ..tools.stocks import register_stock_tools
from ..tools.sports import register_sports_tools
from ..tools.skills_tools import register_skill_tools
from ..skills.registry import SkillRegistry
from ..agents.base import Agent, AgentStatus
from ..agents.manager import ManagerAgent
from ..agents.worker import WorkerAgent
from ..storage.database import Database
from ..context.default_souls import get_default_soul, get_default_memories


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AgentRuntime:
    def __init__(
        self,
        event_bus: Optional[EventBus] = None,
        tool_registry: Optional[ToolRegistry] = None,
        db_path: Optional[str] = None,
        skills_dir: Optional[str | Path] = None,
    ) -> None:
        self.event_bus = event_bus or global_event_bus
        self.tool_registry = tool_registry or global_tool_registry
        self.task_manager = TaskManager(event_bus=self.event_bus)
        self.database = Database(db_path=db_path)
        self.skill_registry = SkillRegistry(skills_dir=skills_dir or "skills")
        self.agents: dict[str, Agent] = {}
        self._is_stopped = False
        self._active_run_id: Optional[str] = None

        # Register standard default tools
        register_filesystem_tools(self.tool_registry)
        register_shell_tools(self.tool_registry)
        register_stock_tools(self.tool_registry)
        register_sports_tools(self.tool_registry)
        register_skill_tools(self.tool_registry, self.skill_registry)

        # Wire database persistence to event bus
        self._setup_event_persistence()

        # Reflect real task-dependency waiting onto agent status
        self._setup_agent_state_wiring()

        # Register default agents (Manager + Worker)
        self._setup_default_agents()
        for profile in self.database.list_agent_profiles():
            existing = self.get_agent(profile.get("name", ""))
            if existing:
                existing.role = profile.get("role", existing.role)
                existing.description = profile.get("description", existing.description)
                existing.provider_id = profile.get("provider_id", existing.provider_id)
                if profile.get("soul"):
                    existing.soul = profile["soul"]
                if profile.get("skills"):
                    existing.skills = profile["skills"]
                if profile.get("memory"):
                    existing.memory = profile["memory"]
                if profile.get("avatar_config"):
                    existing.avatar_config = profile["avatar_config"]
                if profile.get("model_config"):
                    existing.model_config = profile["model_config"]
            else:
                self.register_agent(
                    WorkerAgent(
                        **profile,
                        event_bus=self.event_bus,
                        tool_registry=self.tool_registry,
                        database=self.database,
                        skill_registry=self.skill_registry,
                    )
                )

    def create_agent(
        self,
        name: str,
        role: str,
        description: str = "",
        provider_id: str = "ollama",
        soul: str = "",
        skills: Optional[list[str]] = None,
        memory: Optional[list[dict[str, Any]]] = None,
        avatar_config: Optional[dict[str, Any]] = None,
        model_config: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        name = name.strip()
        if not name or len(name) > 32 or not all(c.isalnum() or c in ' -_' for c in name):
            raise ValueError('Use um nome de até 32 caracteres, com letras, números ou espaços.')
        if name.casefold() in {n.casefold() for n in self.agents} | {'system', 'sistema', 'user', 'usuário'}:
            raise ValueError('Já existe um agente com esse nome ou o nome é reservado.')
        if role not in {'Research', 'Developer', 'Reviewer', 'Executor', 'Investor', 'Sports'}:
            raise ValueError('Escolha uma função válida.')
        if provider_id not in {'ollama', 'codex', 'claude'}:
            raise ValueError('Escolha um motor válido.')
        agent = WorkerAgent(
            name=name,
            role=role,
            description=description.strip(),
            provider_id=provider_id,
            soul=soul or "",
            skills=skills or [],
            memory=memory or [],
            avatar_config=avatar_config or {},
            model_config=model_config or {},
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
        )
        self.database.save_agent(agent.name, agent.role, agent.description, agent.provider_id)
        if any([soul, skills, memory, avatar_config, model_config]):
            self.database.update_agent_full(agent.name, {
                "role": agent.role,
                "description": agent.description,
                "provider_id": agent.provider_id,
                "soul": agent.soul,
                "skills": agent.skills,
                "memory": agent.memory,
                "avatar_config": agent.avatar_config,
                "model_config": agent.model_config,
            })
        self.register_agent(agent)
        return self.get_agent_details(agent.name)

    def update_agent(self, name: str, role: str, description: str = "", provider_id: str = "ollama") -> dict[str, Any]:
        agent = self.get_agent(name)
        if not agent:
            raise ValueError('Agente não encontrado.')
        if name in {'Quinta', 'Manager', 'Worker'}:
            raise ValueError('Esse agente do sistema não pode ser editado por aqui.')
        if role not in {'Research', 'Developer', 'Reviewer', 'Executor', 'Investor', 'Sports'}:
            raise ValueError('Escolha uma função válida.')
        if provider_id not in {'ollama', 'codex', 'claude'}:
            raise ValueError('Escolha um motor válido.')
        agent.role = role
        agent.description = description.strip()
        agent.provider_id = provider_id
        self.database.update_agent(agent.name, agent.role, agent.description, agent.provider_id)
        return agent.to_dict()

    def get_agent_details(self, name: str) -> dict[str, Any]:
        agent = self.get_agent(name)
        if not agent:
            raise ValueError('Agente não encontrado.')
        p = self.database.get_agent_profile(name) or {}
        return {
            **agent.to_dict(),
            "soul": agent.soul or p.get("soul", "") or get_default_soul(name),
            "skills": agent.skills or p.get("skills", []),
            "memory": agent.memory or p.get("memory", []) or get_default_memories(name),
            "avatar_config": agent.avatar_config or p.get("avatar_config", {}),
            "model_config": agent.model_config or p.get("model_config", {}),
        }

    def update_agent_details(self, name: str, data: dict[str, Any]) -> dict[str, Any]:
        agent = self.get_agent(name)
        if not agent:
            raise ValueError('Agente não encontrado.')
        if "role" in data and data["role"]:
            agent.role = data["role"]
        if "description" in data:
            agent.description = data["description"].strip()
        if "provider_id" in data and data["provider_id"]:
            agent.provider_id = data["provider_id"]
        if "soul" in data:
            agent.soul = data["soul"]
        if "skills" in data:
            agent.skills = data["skills"]
        if "memory" in data:
            agent.memory = data["memory"]
        if "avatar_config" in data:
            agent.avatar_config = data["avatar_config"]
        if "model_config" in data:
            agent.model_config = data["model_config"]

        self.database.update_agent_full(agent.name, {
            "role": agent.role,
            "description": agent.description,
            "provider_id": agent.provider_id,
            "soul": agent.soul,
            "skills": agent.skills,
            "memory": agent.memory,
            "avatar_config": agent.avatar_config,
            "model_config": agent.model_config,
        })
        return self.get_agent_details(name)

    # ---------------- Groups / Squads ----------------
    def list_groups(self) -> list[dict[str, Any]]:
        return self.database.list_groups()

    def create_group(self, name: str, description: str = "", members: Optional[list[str]] = None, avatar_icon: str = "users") -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ValueError("O nome do grupo é obrigatório.")
        import re
        group_id = f"group-{re.sub(r'[^a-z0-9]', '-', name.lower()).strip('-')}-{uuid.uuid4().hex[:4]}"
        return self.database.save_group(group_id, name, description, members or [], avatar_icon)

    def update_group(self, group_id: str, name: Optional[str] = None, description: Optional[str] = None, members: Optional[list[str]] = None, avatar_icon: Optional[str] = None) -> Optional[dict[str, Any]]:
        return self.database.update_group(group_id, name, description, members, avatar_icon)

    def delete_group(self, group_id: str) -> bool:
        return self.database.delete_group(group_id)

    # ---------------- Backup ----------------
    def export_backup(self) -> dict[str, Any]:
        return self.database.export_backup()

    def import_backup(self, data: dict[str, Any]) -> dict[str, Any]:
        result = self.database.import_backup(data)
        for profile in self.database.list_agent_profiles():
            existing = self.get_agent(profile["name"])
            if existing:
                existing.role = profile.get("role", existing.role)
                existing.description = profile.get("description", existing.description)
                existing.provider_id = profile.get("provider_id", existing.provider_id)
                existing.soul = profile.get("soul", existing.soul)
                existing.skills = profile.get("skills", existing.skills)
                existing.memory = profile.get("memory", existing.memory)
                existing.avatar_config = profile.get("avatar_config", existing.avatar_config)
                existing.model_config = profile.get("model_config", existing.model_config)
            else:
                self.register_agent(
                    WorkerAgent(
                        **profile,
                        event_bus=self.event_bus,
                        tool_registry=self.tool_registry,
                        database=self.database,
                    )
                )
        return {"success": True, "counts": result}

    def create_routine(self, agent_name: str, name: str, prompt: str, schedule: str) -> dict[str, Any]:
        agent = self.get_agent(agent_name)
        if not agent:
            raise ValueError('Agente não encontrado.')
        name = name.strip()
        prompt = prompt.strip()
        schedule = schedule.strip()
        if not name or len(name) > 80:
            raise ValueError('Use um nome de rotina com até 80 caracteres.')
        if not prompt:
            raise ValueError('Descreva o que a rotina deve fazer.')
        if not schedule:
            raise ValueError('Informe quando a rotina deve rodar.')
        routine = {
            "id": f"routine-{uuid.uuid4().hex[:10]}",
            "name": name,
            "agent_name": agent.name,
            "prompt": prompt,
            "schedule": schedule,
            "status": "draft",
            "created_at": _utc_iso(),
        }
        self.database.save_routine(routine)
        return routine

    def get_routine(self, routine_id: str) -> Optional[dict[str, Any]]:
        return self.database.get_routine(routine_id)

    def update_routine(
        self,
        routine_id: str,
        name: Optional[str] = None,
        prompt: Optional[str] = None,
        schedule: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        if status is not None and status not in ("draft", "active", "paused"):
            raise ValueError("Status de rotina inválido.")
        return self.database.update_routine(routine_id, name=name, prompt=prompt, schedule=schedule, status=status)

    def delete_routine(self, routine_id: str) -> bool:
        return self.database.delete_routine(routine_id)

    def _setup_default_agents(self) -> None:
        quinta = ManagerAgent(
            task_manager=self.task_manager,
            name="Quinta",
            role="Manager",
            description="Coordenação da equipe, planejamento e consolidação de resultados.",
            provider_id="ollama",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Quinta"),
            skills=["coordination", "planning", "delegation", "consolidation"],
            memory=get_default_memories("Quinta"),
            avatar_config={
                "color": "#9159fe",
                "imageUrl": "/avatars/chefe.png",
                "cosmetics": {"head": "crown"},
            },
        )
        atlas = WorkerAgent(
            name="Atlas",
            role="Research",
            description="Pesquisa de informações, análise de fontes e documentação.",
            provider_id="ollama",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Atlas"),
            skills=["research", "analysis", "documentation", "web_search"],
            memory=get_default_memories("Atlas"),
        )
        nero = WorkerAgent(
            name="Nero",
            role="Developer",
            description="Implementação de código, automação de terminal e manipulação de arquivos.",
            provider_id="codex",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Nero"),
            skills=["python", "shell", "debugging", "filesystem", "code_generation"],
            memory=get_default_memories("Nero"),
        )
        iris = WorkerAgent(
            name="Iris",
            role="Reviewer",
            description="Revisão de qualidade, validação de critérios e consistência.",
            provider_id="claude",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Iris"),
            skills=["code_review", "testing", "quality_assurance", "consistency_checking"],
            memory=get_default_memories("Iris"),
        )
        ma = WorkerAgent(
            name="Ma",
            role="Investor",
            description="Análise de mercado financeiro, cotações da B3, FIIs, indicadores técnicos e carteira de investimentos.",
            provider_id="ollama",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Ma"),
            skills=["market_analysis", "b3_stocks", "fiis", "indicators", "portfolio_management"],
            memory=get_default_memories("Ma"),
        )
        livro = WorkerAgent(
            name="Livro",
            role="Sports",
            description="Especialista esportivo em Futebol, Basquete (NBA), NFL e MLB. Tabelas de classificação, estatísticas, jogos e enciclopédia esportiva.",
            provider_id="ollama",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Livro"),
            skills=["football", "nba", "nfl", "mlb", "statistics", "sports_encyclopedia"],
            memory=get_default_memories("Livro"),
        )
        pixel = WorkerAgent(
            name="Pixel",
            role="Designer",
            description="Design de interface, direção visual, sistemas de componentes, Figma e refinamento de experiência.",
            provider_id="ollama",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Pixel"),
            skills=["ui_design", "components", "design_systems", "layout", "visual_hierarchy"],
            memory=get_default_memories("Pixel"),
            avatar_config={
                "color": "#ff7262",
                "imageUrl": "/avatars/brilho.png",
                "cosmetics": {"face": "design_nodes", "body": "status_bar"},
            },
        )
        motion = WorkerAgent(
            name="Motion",
            role="Motion",
            description="Microinterações, transições, estados animados e comportamento visual dos agentes.",
            provider_id="ollama",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Motion"),
            skills=["animations", "transitions", "microinteractions", "motion_lab", "visual_states"],
            memory=get_default_memories("Motion"),
            avatar_config={
                "color": "#a259ff",
                "imageUrl": "/avatars/chefe.png",
                "cosmetics": {"head": "timeline_rig", "body": "orbit_mark"},
            },
        )
        data = WorkerAgent(
            name="Data",
            role="Data",
            description="Análise de dados, métricas, organização de tabelas e síntese quantitativa.",
            provider_id="ollama",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Data"),
            skills=["data_analysis", "metrics", "quantitative_synthesis", "data_tables"],
            memory=get_default_memories("Data"),
            avatar_config={
                "color": "#14b8a6",
                "imageUrl": "/avatars/sabio.png",
                "cosmetics": {"face": "visor", "body": "data_grid"},
            },
        )
        ops = WorkerAgent(
            name="Ops",
            role="Operations",
            description="Rotinas, automações, organização operacional, acompanhamento e execução recorrente.",
            provider_id="ollama",
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            database=self.database,
            skill_registry=self.skill_registry,
            soul=get_default_soul("Ops"),
            skills=["routines", "automation", "operations", "recurring_tasks"],
            memory=get_default_memories("Ops"),
            avatar_config={
                "color": "#64748b",
                "imageUrl": "/avatars/padrao.png",
                "cosmetics": {"head": "signal_band", "hand": "side_panel"},
            },
        )
        self.register_agent(quinta)
        self.register_agent(atlas)
        self.register_agent(nero)
        self.register_agent(iris)
        self.register_agent(ma)
        self.register_agent(livro)
        self.register_agent(pixel)
        self.register_agent(motion)
        self.register_agent(data)
        self.register_agent(ops)
        quinta.collaborators = {
            "Atlas": atlas,
            "Nero": nero,
            "Iris": iris,
            "Ma": ma,
            "Livro": livro,
            "Pixel": pixel,
            "Motion": motion,
            "Data": data,
            "Ops": ops,
        }

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

        requested_agent = agent_name

        # Step 1: Manager plans objective into subtasks
        recipient = self.get_agent(requested_agent) if requested_agent else manager
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
            assigned_name = runnable_task.assigned_agent or "Nero"
            agent = self.agents.get(assigned_name) or self.agents.get("Nero") or self.agents.get("Worker")
            if not agent:
                await self.task_manager.update_status(
                    runnable_task.id, TaskStatus.FAILED, error=f"No agent found: {assigned_name}"
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
            {"run_id": run_id, "status": final_status, "objective": objective, "agent_name": requested_agent or 'Quinta'},
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
