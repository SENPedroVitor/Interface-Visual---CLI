"""Shell tools for Waddle Agent OS."""
from __future__ import annotations

from typing import Any, Optional
from .registry import Tool, ToolRegistry, RiskLevel, Permission
from ..core.os_layer import run_os_command


async def run_command_tool(
    command: str,
    cwd: Optional[str] = None,
    timeout_seconds: float = 60.0,
) -> dict[str, Any]:
    """Execute a shell command through OS abstraction layer."""
    res = await run_os_command(command=command, cwd=cwd, timeout_seconds=timeout_seconds)
    return {
        "command": res.command,
        "exit_code": res.exit_code,
        "stdout": res.stdout,
        "stderr": res.stderr,
        "duration_ms": res.duration_ms,
        "success": res.is_success,
    }


def register_shell_tools(registry: ToolRegistry) -> None:
    registry.register(
        Tool(
            name="run_command",
            description="Execute a shell command safely across Windows and Linux.",
            handler=run_command_tool,
            input_schema={"command": "string", "cwd": "string (optional)", "timeout_seconds": "number (optional)"},
            output_schema={"exit_code": "integer", "stdout": "string", "stderr": "string", "success": "boolean"},
            risk_level=RiskLevel.MEDIUM,
            permission=Permission.ALLOW,
        )
    )
