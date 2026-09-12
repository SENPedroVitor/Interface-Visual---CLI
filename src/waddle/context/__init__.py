"""Context assembly system for Waddle Agent OS.

Builds complete, budget-aware prompts by combining agent identity, soul,
skills, memory, conversation history, tools and objectives.
"""

from .prompt_builder import PromptBuilder, PromptBudget
from .model_budgets import get_model_budget, MODEL_BUDGETS
from .conversation_context import build_conversation_context
from .memory_builder import build_memory_context
from .tool_context import build_tool_context
from .default_souls import get_default_soul, get_default_memories

__all__ = [
    "PromptBuilder",
    "PromptBudget",
    "get_model_budget",
    "MODEL_BUDGETS",
    "build_conversation_context",
    "build_memory_context",
    "build_tool_context",
    "get_default_soul",
    "get_default_memories",
]
