"""Select and format relevant memories for prompt injection.

Phase 1: injects all memories from the agent's profile, truncated to budget.
Future: semantic search for relevance to the current objective.
"""
from __future__ import annotations

from typing import Any


def build_memory_context(
    memories: list[dict[str, Any]],
    budget_chars: int = 500,
) -> str:
    """Format agent memories into a prompt section within a character budget.

    Parameters
    ----------
    memories : list[dict]
        List of memory entries. Each entry should have a ``fact`` key with a
        string value, e.g. ``{"fact": "Nero cuida de código."}``.
    budget_chars : int
        Maximum characters for the memory section.

    Returns
    -------
    str
        Formatted memory block, or empty string if no memories.
    """
    if not memories:
        return ""

    header = "Memórias relevantes:\n"
    lines: list[str] = []
    current_len = len(header)

    for entry in memories:
        fact = ""
        if isinstance(entry, dict):
            fact = str(entry.get("fact") or entry.get("content") or entry.get("text") or "").strip()
        elif isinstance(entry, str):
            fact = entry.strip()
        if not fact:
            continue

        line = f"- {fact}\n"
        if current_len + len(line) > budget_chars:
            break
        lines.append(line)
        current_len += len(line)

    if not lines:
        return ""
    return header + "".join(lines)
