"""Tool Registry and Execution System for Waddle Agent OS."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import Enum
import inspect
import time
from typing import Any, Callable, Coroutine, Optional

from ..core.event_bus import EventBus, global_event_bus


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Permission(str, Enum):
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"


@dataclass
class Tool:
    name: str
    description: str
    handler: Callable[..., Any]
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    risk_level: RiskLevel = RiskLevel.LOW
    permission: Permission = Permission.ALLOW

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "risk_level": self.risk_level.value if isinstance(self.risk_level, RiskLevel) else self.risk_level,
            "permission": self.permission.value if isinstance(self.permission, Permission) else self.permission,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
        }


@dataclass
class ToolExecutionResult:
    tool_name: str
    success: bool
    result: Any = None
    error: Optional[str] = None
    duration_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "success": self.success,
            "result": self.result,
            "error": self.error,
            "duration_ms": self.duration_ms,
        }


class ToolRegistry:
    def __init__(self, event_bus: Optional[EventBus] = None) -> None:
        self.event_bus = event_bus or global_event_bus
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[Tool]:
        return self._tools.get(name)

    def list_tools(self) -> list[dict[str, Any]]:
        return [tool.to_dict() for tool in self._tools.values()]

    def set_permission(self, tool_name: str, permission: Permission) -> bool:
        if tool_name in self._tools:
            self._tools[tool_name].permission = permission
            return True
        return False

    async def execute(
        self,
        tool_name: str,
        params: dict[str, Any],
        agent_id: str = "anonymous",
        task_id: Optional[str] = None,
    ) -> ToolExecutionResult:
        tool = self.get_tool(tool_name)
        if not tool:
            return ToolExecutionResult(
                tool_name=tool_name,
                success=False,
                error=f"Tool '{tool_name}' is not registered in ToolRegistry.",
            )

        if tool.permission == Permission.DENY:
            return ToolExecutionResult(
                tool_name=tool_name,
                success=False,
                error=f"Tool '{tool_name}' is DENIED by current security policy.",
            )

        if tool.permission == Permission.ASK:
            # Emit approval required event
            await self.event_bus.emit(
                "approval.required",
                {
                    "tool_name": tool_name,
                    "agent_id": agent_id,
                    "task_id": task_id,
                    "params": params,
                    "risk_level": tool.risk_level.value,
                },
                source="tool_registry",
            )
            # In Phase 1 MVP, if configured to ASK and no automated approver, we report waiting
            return ToolExecutionResult(
                tool_name=tool_name,
                success=False,
                error=f"Tool '{tool_name}' requires human approval (ASK policy).",
            )

        start_time = time.perf_counter()
        await self.event_bus.emit(
            "tool.started",
            {"tool_name": tool_name, "agent_id": agent_id, "task_id": task_id, "params": params},
            source="tool_registry",
        )

        try:
            if inspect.iscoroutinefunction(tool.handler):
                res = await tool.handler(**params)
            else:
                res = tool.handler(**params)
                if inspect.iscoroutine(res):
                    res = await res

            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            result = ToolExecutionResult(
                tool_name=tool_name,
                success=True,
                result=res,
                duration_ms=duration_ms,
            )
            await self.event_bus.emit(
                "tool.completed",
                {"tool_name": tool_name, "agent_id": agent_id, "task_id": task_id, "duration_ms": duration_ms},
                source="tool_registry",
            )
            return result
        except Exception as e:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            err_msg = str(e)
            await self.event_bus.emit(
                "tool.failed",
                {"tool_name": tool_name, "agent_id": agent_id, "task_id": task_id, "error": err_msg},
                source="tool_registry",
            )
            return ToolExecutionResult(
                tool_name=tool_name,
                success=False,
                error=err_msg,
                duration_ms=duration_ms,
            )


# Default singleton registry
global_tool_registry = ToolRegistry()
