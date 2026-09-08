"""Base Agent definition and structured messaging for Waddle Agent OS."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
import uuid

from ..core.event_bus import EventBus, global_event_bus
from ..tasks.task import Task
from ..tools.registry import ToolRegistry, global_tool_registry


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AgentStatus(str, Enum):
    IDLE = "idle"
    WORKING = "working"
    WAITING = "waiting"
    STOPPED = "stopped"


@dataclass
class AgentMessage:
    from_agent: str
    to_agent: str
    type: str  # task_request, task_result, task_failed, question, answer, handoff, status_update
    content: str
    task_id: Optional[str] = None
    data: dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=_utc_iso)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "from": self.from_agent,
            "to": self.to_agent,
            "type": self.type,
            "content": self.content,
            "task_id": self.task_id,
            "data": self.data,
            "timestamp": self.timestamp,
        }


class Agent(ABC):
    def __init__(
        self,
        name: str,
        role: str,
        description: str = "",
        event_bus: Optional[EventBus] = None,
        tool_registry: Optional[ToolRegistry] = None,
    ) -> None:
        self.id = f"agent-{name.lower()}"
        self.name = name
        self.role = role
        self.description = description
        self.status = AgentStatus.IDLE
        self.current_task_id: Optional[str] = None
        self.event_bus = event_bus or global_event_bus
        self.tool_registry = tool_registry or global_tool_registry

    async def set_status(self, new_status: AgentStatus) -> None:
        old_status = self.status
        self.status = new_status
        await self.event_bus.emit(
            "agent.status_change",
            {
                "agent_id": self.id,
                "agent_name": self.name,
                "old_status": old_status.value,
                "new_status": new_status.value,
                "current_task_id": self.current_task_id,
            },
            source=self.name,
        )

    async def send_message(
        self,
        to_agent: str,
        msg_type: str,
        content: str,
        task_id: Optional[str] = None,
        data: Optional[dict[str, Any]] = None,
    ) -> AgentMessage:
        msg = AgentMessage(
            from_agent=self.name,
            to_agent=to_agent,
            type=msg_type,
            content=content,
            task_id=task_id,
            data=data or {},
        )
        await self.event_bus.emit(
            "agent.message",
            {"message": msg.to_dict()},
            source=self.name,
        )
        return msg

    @abstractmethod
    async def execute_task(self, task: Task) -> Any:
        """Execute the given task and return the output."""
        pass

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "description": self.description,
            "status": self.status.value if isinstance(self.status, AgentStatus) else self.status,
            "current_task_id": self.current_task_id,
        }
