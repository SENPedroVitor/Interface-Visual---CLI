"""Model-aware token budget profiles for Waddle prompt building.

Each profile defines how much prompt space is available for a given model,
and how that space is distributed across prompt sections.  The budgets are
*operational targets*, not goals to fill — the PromptBuilder will use as
little as needed and never pad to reach the target.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class PromptBudget:
    """Character-level budget for each prompt section.

    We work in *characters* (not tokens) for simplicity and speed.
    A rough 1 token ≈ 4 chars ratio is used when deriving from token limits.
    """
    max_chars: int
    system: int
    soul: int
    skills: int
    objective: int
    shared_context: int
    memory: int
    history: int
    tools: int

    @property
    def allocated(self) -> int:
        return (
            self.system + self.soul + self.skills + self.objective
            + self.shared_context + self.memory + self.history + self.tools
        )


# ---------------------------------------------------------------------------
# Pre-defined budgets per model family.
#
# Numbers are in *characters*.  Token limits are converted with the rough
# 1 token ≈ 4 chars heuristic, then we apply a conservative multiplier so
# the budget stays well under the model's real context window.
# ---------------------------------------------------------------------------

MODEL_BUDGETS: dict[str, PromptBudget] = {
    # --- Local / lightweight ---
    "qwen2.5:0.5b": PromptBudget(
        max_chars=4800,      # ~1200 tokens
        system=800,          # core rules, safety
        soul=600,            # personality summary
        skills=200,          # short capability list
        objective=700,       # current task/question
        shared_context=400,  # shared findings from other agents
        memory=500,          # relevant memories
        history=1000,        # recent conversation
        tools=300,           # available tool names
    ),
    "llama3.2:1b": PromptBudget(
        max_chars=6400,
        system=900,
        soul=700,
        skills=300,
        objective=800,
        shared_context=600,
        memory=700,
        history=1600,
        tools=400,
    ),
    "llama3.2:3b": PromptBudget(
        max_chars=12000,
        system=1000,
        soul=900,
        skills=400,
        objective=1000,
        shared_context=1200,
        memory=1200,
        history=4000,
        tools=600,
    ),

    # --- Cloud / large context ---
    "gpt-4o": PromptBudget(
        max_chars=48000,     # ~12k tokens (operational target, not 128k)
        system=2000,
        soul=2400,
        skills=1200,
        objective=2000,
        shared_context=4000,
        memory=4000,
        history=16000,
        tools=1600,
    ),
    "gpt-4o-mini": PromptBudget(
        max_chars=40000,
        system=1800,
        soul=2000,
        skills=1000,
        objective=1800,
        shared_context=3600,
        memory=3600,
        history=14000,
        tools=1400,
    ),
    "o1": PromptBudget(
        max_chars=48000,
        system=2000,
        soul=2400,
        skills=1200,
        objective=2000,
        shared_context=4000,
        memory=4000,
        history=16000,
        tools=1600,
    ),

    # --- Anthropic ---
    "claude-sonnet-5": PromptBudget(
        max_chars=64000,     # ~16k tokens (operational target, not 200k)
        system=2400,
        soul=3000,
        skills=1400,
        objective=2400,
        shared_context=5000,
        memory=5000,
        history=20000,
        tools=2000,
    ),
    "claude-opus-5": PromptBudget(
        max_chars=64000,
        system=2400,
        soul=3000,
        skills=1400,
        objective=2400,
        shared_context=5000,
        memory=5000,
        history=20000,
        tools=2000,
    ),
    "claude-haiku-4.5": PromptBudget(
        max_chars=40000,
        system=1800,
        soul=2000,
        skills=1000,
        objective=1800,
        shared_context=3600,
        memory=3600,
        history=14000,
        tools=1400,
    ),
}

# Fallback for unknown models — conservative, similar to small local models.
_DEFAULT_BUDGET = PromptBudget(
    max_chars=4800,
    system=800,
    soul=600,
    skills=200,
    objective=700,
    shared_context=400,
    memory=500,
    history=1000,
    tools=300,
)


def get_model_budget(model_name: Optional[str] = None) -> PromptBudget:
    """Return the budget for a given model name.

    Falls back to the conservative default if the model is unknown.
    Tries exact match first, then prefix match (e.g. ``gpt-4o-2024-11-20``
    matches ``gpt-4o``).
    """
    if not model_name:
        return _DEFAULT_BUDGET
    name = model_name.strip().lower()

    # Exact match
    if name in MODEL_BUDGETS:
        return MODEL_BUDGETS[name]

    # Prefix match — longest prefix wins
    best: Optional[str] = None
    for key in MODEL_BUDGETS:
        if name.startswith(key) and (best is None or len(key) > len(best)):
            best = key
    if best:
        return MODEL_BUDGETS[best]

    # Family heuristics
    if "gpt" in name or "codex" in name or "o1" in name or "o3" in name:
        return MODEL_BUDGETS["gpt-4o"]
    if "claude" in name:
        return MODEL_BUDGETS["claude-sonnet-5"]
    if "qwen" in name:
        return MODEL_BUDGETS["qwen2.5:0.5b"]
    if "llama" in name or "mistral" in name or "deepseek" in name:
        return MODEL_BUDGETS["llama3.2:3b"]

    return _DEFAULT_BUDGET
