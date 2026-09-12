"""Hybrid conversation context: shared global + private agent history.

Every agent receives:
  - The current user objective
  - Recent user messages (shared)
  - A summary of shared findings from other agents (shared context)

Each agent also receives:
  - Its own previous messages (private history)

Messages from other agents' internal exchanges are NOT included — only
their contributions to the shared task context travel across agents.
"""
from __future__ import annotations

from typing import Any, Optional


# Message types that carry meaningful content (not noise)
_CONTENT_TYPES = {"answer", "discussion", "task_result", "question", "handoff"}

# Types that are internal status noise
_NOISE_TYPES = {"status_update"}


def build_conversation_context(
    messages: list[dict[str, Any]],
    agent_name: str,
    budget_chars: int = 1200,
    max_messages: int = 20,
) -> tuple[str, str]:
    """Build hybrid conversation context for an agent.

    Parameters
    ----------
    messages : list[dict]
        Recent messages from the database, ordered newest-first.
        Each dict should have: ``from``, ``to``, ``type``, ``content``.
    agent_name : str
        The name of the agent receiving the prompt.
    budget_chars : int
        Maximum characters for the history section.
    max_messages : int
        Hard limit on number of messages to include.

    Returns
    -------
    tuple[str, str]
        ``(shared_context, private_history)``

        - ``shared_context``: user messages + cross-agent findings relevant
          to the current conversation.
        - ``private_history``: this agent's own recent messages.
    """
    if not messages:
        return "", ""

    # Reverse to chronological order (oldest first)
    chronological = list(reversed(messages[:max_messages * 2]))

    shared_lines: list[str] = []
    private_lines: list[str] = []
    shared_len = 0
    private_len = 0

    half_budget = budget_chars // 2

    for msg in chronological:
        msg_type = msg.get("type", "")
        if msg_type in _NOISE_TYPES:
            continue

        sender = msg.get("from", "")
        receiver = msg.get("to", "")
        content = str(msg.get("content", "")).strip()
        if not content:
            continue

        # Truncate very long messages
        if len(content) > 400:
            content = content[:397] + "..."

        line = f"[{sender}]: {content}\n"

        # --- Shared context: user messages + cross-agent contributions ---
        if sender.lower() in ("user", "usuário", "usuario", "system"):
            if shared_len + len(line) <= half_budget:
                shared_lines.append(line)
                shared_len += len(line)
        # Other agents' answers/discussion (shared findings)
        elif sender != agent_name and msg_type in _CONTENT_TYPES:
            summary_line = f"[{sender}]: {content}\n"
            if shared_len + len(summary_line) <= half_budget:
                shared_lines.append(summary_line)
                shared_len += len(summary_line)

        # --- Private history: this agent's own messages ---
        if sender == agent_name or receiver == agent_name:
            if private_len + len(line) <= half_budget:
                private_lines.append(line)
                private_len += len(line)

    shared_text = ""
    if shared_lines:
        shared_text = "Contexto da conversa:\n" + "".join(shared_lines)

    private_text = ""
    if private_lines:
        private_text = "Suas mensagens anteriores:\n" + "".join(private_lines)

    return shared_text, private_text
