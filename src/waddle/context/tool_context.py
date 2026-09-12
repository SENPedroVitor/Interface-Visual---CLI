"""Format available tools for prompt injection.

Filters by permission (hides DENY tools) and formats as a compact list
suitable for inclusion in an LLM prompt.
"""
from __future__ import annotations

from typing import Optional
from ..tools.registry import ToolRegistry, Permission


def build_tool_context(
    registry: ToolRegistry,
    budget_chars: int = 400,
    agent_role: Optional[str] = None,
) -> str:
    """Return a formatted string of available tools within a character budget.

    Parameters
    ----------
    registry : ToolRegistry
        The global or scoped tool registry.
    budget_chars : int
        Maximum characters for the tools section.
    agent_role : str, optional
        If provided, can be used in the future to filter tools by agent role.
    """
    tools = registry.list_tools()
    if not tools:
        return ""

    lines: list[str] = []
    current_len = 0
    header = "Ferramentas disponíveis:\n"
    current_len += len(header)

    for tool in tools:
        # Skip denied tools — agent shouldn't know about them
        perm = tool.get("permission", "allow")
        if perm == Permission.DENY.value or perm == Permission.DENY:
            continue

        name = tool.get("name", "")
        desc = tool.get("description", "")
        # Truncate long descriptions
        if len(desc) > 60:
            desc = desc[:57] + "..."

        line = f"- {name}: {desc}\n"
        if current_len + len(line) > budget_chars:
            break
        lines.append(line)
        current_len += len(line)

    if not lines:
        return ""
    return header + "".join(lines)
