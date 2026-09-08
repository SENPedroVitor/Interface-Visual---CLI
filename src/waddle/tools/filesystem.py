"""Filesystem tools for Waddle Agent OS."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from .registry import Tool, ToolRegistry, RiskLevel, Permission
from ..core.os_layer import get_workspace_dir


def _resolve_safe_path(target_path: str) -> Path:
    p = Path(target_path)
    if not p.is_absolute():
        p = (get_workspace_dir() / p).resolve()
    return p


def read_file(path: str) -> str:
    """Read full text content of a file."""
    p = _resolve_safe_path(path)
    if not p.exists():
        raise FileNotFoundError(f"File not found: {path}")
    if not p.is_file():
        raise ValueError(f"Path is not a file: {path}")
    return p.read_text(encoding="utf-8", errors="replace")


def write_file(path: str, content: str, overwrite: bool = True) -> dict[str, Any]:
    """Write text content to a file."""
    p = _resolve_safe_path(path)
    if p.exists() and not overwrite:
        raise FileExistsError(f"File already exists and overwrite is False: {path}")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return {"path": str(p), "bytes_written": len(content.encode("utf-8"))}


def list_directory(path: str = ".") -> list[dict[str, Any]]:
    """List files and directories in path."""
    p = _resolve_safe_path(path)
    if not p.exists() or not p.is_dir():
        raise NotADirectoryError(f"Directory not found: {path}")
    items = []
    for child in p.iterdir():
        items.append({
            "name": child.name,
            "is_dir": child.is_dir(),
            "size": child.stat().st_size if child.is_file() else 0,
        })
    return items


def register_filesystem_tools(registry: ToolRegistry) -> None:
    registry.register(
        Tool(
            name="read_file",
            description="Read text content from a file inside the workspace or absolute path.",
            handler=read_file,
            input_schema={"path": "string"},
            output_schema={"content": "string"},
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )
    registry.register(
        Tool(
            name="write_file",
            description="Write content to a file inside the workspace or absolute path.",
            handler=write_file,
            input_schema={"path": "string", "content": "string", "overwrite": "boolean"},
            output_schema={"path": "string", "bytes_written": "integer"},
            risk_level=RiskLevel.MEDIUM,
            permission=Permission.ALLOW,
        )
    )
    registry.register(
        Tool(
            name="list_directory",
            description="List directory items inside the workspace or absolute path.",
            handler=list_directory,
            input_schema={"path": "string"},
            output_schema={"items": "array"},
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )
