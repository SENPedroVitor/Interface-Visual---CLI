"""Worker Agent implementation for Waddle Agent OS."""
from __future__ import annotations

from typing import Any, Optional
from .base import Agent, AgentStatus
from ..tasks.task import Task
from ..core.event_bus import EventBus
from ..tools.registry import ToolRegistry


class WorkerAgent(Agent):
    def __init__(
        self,
        name: str = "Worker",
        role: str = "Executor",
        description: str = "Executes assigned tasks using authorized tools.",
        provider_id: str = "ollama",
        event_bus: Optional[EventBus] = None,
        tool_registry: Optional[ToolRegistry] = None,
    ) -> None:
        super().__init__(
            name=name,
            role=role,
            description=description,
            provider_id=provider_id,
            event_bus=event_bus,
            tool_registry=tool_registry,
        )

    async def execute_task(self, task: Task) -> Any:
        self.current_task_id = task.id
        await self.set_status(AgentStatus.THINKING)

        await self.send_message(
            to_agent="Manager",
            msg_type="status_update",
            content=f"Starting execution of task: '{task.title}'",
            task_id=task.id,
        )

        output: dict[str, Any] = {"summary": f"Completed task: {task.title}", "results": []}

        try:
            # Check if task specifies tool calls in input_data
            tool_calls = task.input_data.get("tool_calls", [])
            await self.set_status(AgentStatus.WORKING)
            if tool_calls:
                for call in tool_calls:
                    tool_name = call.get("tool")
                    params = call.get("params", {})
                    if not tool_name:
                        continue

                    exec_res = await self.tool_registry.execute(
                        tool_name=tool_name,
                        params=params,
                        agent_id=self.id,
                        task_id=task.id,
                    )
                    output["results"].append(exec_res.to_dict())
                    if not exec_res.success:
                        raise RuntimeError(f"Tool {tool_name} failed: {exec_res.error}")
            else:
                # Fallback action execution based on title/description or simple mock step
                action_type = task.input_data.get("action")
                if action_type == "write_file":
                    res = await self.tool_registry.execute(
                        "write_file",
                        {
                            "path": task.input_data.get("path", "output.txt"),
                            "content": task.input_data.get("content", ""),
                        },
                        agent_id=self.id,
                        task_id=task.id,
                    )
                    output["results"].append(res.to_dict())
                elif action_type == "run_command":
                    res = await self.tool_registry.execute(
                        "run_command",
                        {"command": task.input_data.get("command", "echo OK")},
                        agent_id=self.id,
                        task_id=task.id,
                    )
                    output["results"].append(res.to_dict())
                else:
                    output["results"].append({"action": "default_execution", "status": "ok"})

            await self.send_message(
                to_agent="Manager",
                msg_type="task_result",
                content=f"Successfully finished task: '{task.title}'",
                task_id=task.id,
                data=output,
            )
            return output

        except Exception as e:
            err_msg = str(e)
            await self.send_message(
                to_agent="Manager",
                msg_type="task_failed",
                content=f"Failed task '{task.title}': {err_msg}",
                task_id=task.id,
                data={"error": err_msg},
            )
            raise
        finally:
            self.current_task_id = None
            await self.set_status(AgentStatus.IDLE)
