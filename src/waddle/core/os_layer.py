"""Cross-platform OS abstraction layer for Waddle Agent OS.

Guarantees seamless execution on Windows and Linux without hardcoded Unix/Windows paths or shell assumptions.
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


def get_platform_name() -> str:
    if sys.platform.startswith("win"):
        return "windows"
    if sys.platform.startswith("darwin"):
        return "macos"
    return "linux"


def get_waddle_data_dir() -> Path:
    """Return persistent app data directory for Waddle based on OS standards."""
    platform = get_platform_name()
    if platform == "windows":
        app_data = os.getenv("LOCALAPPDATA")
        base = Path(app_data) if app_data else Path.home() / "AppData" / "Local"
    else:
        xdg_data = os.getenv("XDG_DATA_HOME")
        base = Path(xdg_data) if xdg_data else Path.home() / ".local" / "share"
    
    target = base / "waddle"
    target.mkdir(parents=True, exist_ok=True)
    return target


def get_workspace_dir() -> Path:
    """Return current working directory or custom workspace root."""
    custom = os.getenv("WADDLE_WORKSPACE")
    if custom:
        p = Path(custom).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p
    # Default to current project root
    return Path.cwd().resolve()


@dataclass
class CommandResult:
    command: str
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float

    @property
    def is_success(self) -> bool:
        return self.exit_code == 0


async def run_os_command(
    command: str,
    cwd: Optional[Path | str] = None,
    timeout_seconds: float = 60.0,
    env_vars: Optional[dict[str, str]] = None,
) -> CommandResult:
    """Execute a shell command asynchronously across Windows and Linux.
    
    On Windows, uses cmd.exe /c or direct subprocess.
    On Linux/macOS, uses /bin/sh -c.
    """
    start_time = time.perf_counter()
    target_cwd = str(cwd) if cwd else str(get_workspace_dir())
    current_env = dict(os.environ)
    if env_vars:
        current_env.update(env_vars)

    platform = get_platform_name()
    if platform == "windows":
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=target_cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=current_env,
        )
    else:
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=target_cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            shell=True,
            executable="/bin/sh",
            env=current_env,
        )

    try:
        stdout_data, stderr_data = await asyncio.wait_for(
            process.communicate(), timeout=timeout_seconds
        )
        exit_code = process.returncode if process.returncode is not None else -1
        stdout_str = stdout_data.decode("utf-8", errors="replace")
        stderr_str = stderr_data.decode("utf-8", errors="replace")
    except asyncio.TimeoutError:
        try:
            process.kill()
            await process.wait()
        except Exception:
            pass
        exit_code = -1
        stdout_str = ""
        stderr_str = f"Command timed out after {timeout_seconds} seconds"

    duration_ms = (time.perf_counter() - start_time) * 1000
    return CommandResult(
        command=command,
        exit_code=exit_code,
        stdout=stdout_str,
        stderr=stderr_str,
        duration_ms=round(duration_ms, 2),
    )
