"""Manager Agent implementation for Waddle Agent OS."""
from __future__ import annotations

from typing import Any, Optional
from .base import Agent, AgentStatus
from ..tasks.task import Task
from ..tasks.manager import TaskManager
from ..core.event_bus import EventBus
from ..tools.registry import ToolRegistry


class ManagerAgent(Agent):
    def __init__(
        self,
        task_manager: TaskManager,
        name: str = "Quinta",
        role: str = "Manager",
        description: str = "Coordenação da equipe, planejamento e consolidação de resultados.",
        event_bus: Optional[EventBus] = None,
        tool_registry: Optional[ToolRegistry] = None,
    ) -> None:
        super().__init__(
            name=name,
            role=role,
            description=description,
            event_bus=event_bus,
            tool_registry=tool_registry,
        )
        self.task_manager = task_manager

    async def plan_objective(self, objective: str, parameters: Optional[dict[str, Any]] = None, response_agent: Optional[Agent] = None) -> list[Task]:
        """Decompose a high-level user objective into executable tasks for the team."""
        speaker = response_agent or self
        await speaker.set_status(AgentStatus.THINKING)
        await speaker.send_message(
            to_agent="System",
            msg_type="status_update",
            content=f"Analisando objetivo e coordenando a equipe: '{objective}'",
        )

        params = parameters or {}
        tasks_created: list[Task] = []

        if "arquivo" in objective.lower() or "file" in objective.lower() or "salvar" in objective.lower():
            # Step 1: Nero writes the file
            task1 = await self.task_manager.create_task(
                title=f"Criar arquivo: {objective[:32]}",
                description=objective,
                assigned_agent=params.get('_assigned_agent', 'Nero'),
                input_data={
                    "tool_calls": [
                        {
                            "tool": "write_file",
                            "params": {
                                "path": params.get("path", "waddle_result.txt"),
                                "content": params.get("content", f"Gerado pelo Waddle Agent OS:\nObjetivo: {objective}\n"),
                            },
                        }
                    ]
                },
            )
            tasks_created.append(task1)

            # Step 2: Iris reviews/verifies file
            task2 = await self.task_manager.create_task(
                title=f"Revisar e verificar arquivo",
                description="Validar integridade do arquivo gerado.",
                assigned_agent="Iris",
                dependencies=[task1.id],
                input_data={
                    "tool_calls": [
                        {
                            "tool": "read_file",
                            "params": {"path": params.get("path", "waddle_result.txt")},
                        }
                    ]
                },
            )
            tasks_created.append(task2)
        elif "pesquis" in objective.lower() or "analis" in objective.lower() or "research" in objective.lower():
            # Atlas investigates
            task = await self.task_manager.create_task(
                title=f"Pesquisar e analisar: {objective[:35]}",
                description=objective,
                assigned_agent=params.get('_assigned_agent', 'Atlas'),
                input_data={
                    "tool_calls": [
                        {
                            "tool": "list_directory",
                            "params": {"path": params.get("path", ".")},
                        }
                    ]
                },
            )
            tasks_created.append(task)
        elif "comando" in objective.lower() or "executar" in objective.lower() or "shell" in objective.lower() or "run" in objective.lower():
            cmd = params.get("command", "echo Waddle Agent OS Running")
            task = await self.task_manager.create_task(
                title=f"Executar comando: {cmd[:30]}",
                description=objective,
                assigned_agent=params.get('_assigned_agent', 'Nero'),
                input_data={
                    "tool_calls": [
                        {
                            "tool": "run_command",
                            "params": {"command": cmd},
                        }
                    ]
                },
            )
            tasks_created.append(task)
        else:
            # No task-shaped keyword matched — this reads as a plain
            # question/chat message, so Quinta replies directly instead of
            # spawning a worker task with nothing concrete to execute.
            # NOTE: there is no LLM plugged in yet (see docs/Waddle_Agent_OS_Plano.md
            # scope) — this is a placeholder acknowledgement, not a real answer.
            await speaker.send_message(
                to_agent="System",
                msg_type="answer",
                content=(
                    f'Recebi sua mensagem: "{objective}". Ainda não tenho um '
                    "modelo de linguagem real plugado para responder de "
                    "verdade — esta é uma resposta de teste."
                ),
            )

        if tasks_created:
            await speaker.send_message(
                to_agent="System",
                msg_type="status_update",
                content=f"Plano pronto: {len(tasks_created)} etapas para executar.",
            )
        await speaker.set_status(AgentStatus.IDLE)
        return tasks_created

    async def execute_task(self, task: Task) -> Any:
        # If the manager itself is assigned a task (e.g. consolidation)
        self.current_task_id = task.id
        await self.set_status(AgentStatus.WORKING)
        try:
            return {"status": "completed", "manager": "Objective reviewed and consolidated."}
        finally:
            self.current_task_id = None
            await self.set_status(AgentStatus.IDLE)
