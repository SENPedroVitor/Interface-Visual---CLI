"""Skill data model and SKILL.md parser for Waddle Agent OS."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


@dataclass
class Skill:
    name: str
    description: str
    version: str = "1.0.0"
    platforms: list[str] = field(default_factory=list)
    recommended_agents: list[str] = field(default_factory=list)
    required_tools: list[str] = field(default_factory=list)
    instructions: str = ""
    category: str = "general"
    file_path: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "platforms": self.platforms,
            "recommended_agents": self.recommended_agents,
            "required_tools": self.required_tools,
            "instructions": self.instructions,
            "category": self.category,
            "file_path": self.file_path,
        }


def _parse_yaml_frontmatter(raw_header: str) -> dict[str, Any]:
    """Lightweight zero-dependency parser for SKILL.md YAML frontmatter."""
    data: dict[str, Any] = {}
    current_key: Optional[str] = None
    current_parent: Optional[str] = None
    current_list: Optional[list[str]] = None

    for line in raw_header.splitlines():
        # Remove comments and trailing whitespace
        line_clean = re.sub(r'#.*$', '', line).rstrip()
        if not line_clean.strip():
            continue

        indent = len(line_clean) - len(line_clean.lstrip())
        stripped = line_clean.strip()

        # List item: "- value"
        if stripped.startswith("- "):
            val = stripped[2:].strip().strip('"\'')
            if current_list is not None:
                current_list.append(val)
            continue

        # Key-value or block header
        if ":" in stripped:
            k, _, v = stripped.partition(":")
            k = k.strip()
            v = v.strip().strip('"\'')

            if indent == 0:
                current_parent = None
                if not v:
                    # Could be parent block or empty list
                    data[k] = []
                    current_key = k
                    current_list = data[k]
                    # Or a dict parent if next lines indent keys
                    if k in {"waddle", "metadata"}:
                        current_parent = k
                        data[k] = {}
                        current_list = None
                else:
                    data[k] = v
                    current_key = k
                    current_list = None
            elif indent > 0 and current_parent:
                if not v:
                    data[current_parent][k] = []
                    current_key = k
                    current_list = data[current_parent][k]
                else:
                    data[current_parent][k] = v
                    current_key = k
                    current_list = None
            elif indent > 0 and current_key:
                # Subkey under current_key
                if not isinstance(data.get(current_key), dict):
                    data[current_key] = {}
                if not v:
                    data[current_key][k] = []
                    current_list = data[current_key][k]
                else:
                    data[current_key][k] = v
                    current_list = None

    return data


def parse_skill_file(file_path: str | Path) -> Optional[Skill]:
    """Parse a SKILL.md file with YAML frontmatter and markdown body."""
    path = Path(file_path)
    if not path.is_file():
        return None

    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return None

    header_dict: dict[str, Any] = {}
    instructions = content.strip()

    # Split frontmatter delimited by '---'
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            raw_header = parts[1]
            instructions = parts[2].strip()
            header_dict = _parse_yaml_frontmatter(raw_header)

    name = header_dict.get("name") or path.parent.name
    desc = header_dict.get("description") or f"Procedimento para {name}"
    version = header_dict.get("version") or "1.0.0"

    platforms = header_dict.get("platforms")
    if not isinstance(platforms, list):
        platforms = [platforms] if platforms else []

    # Extract recommended_agents and required_tools from waddle: block or root
    waddle_block = header_dict.get("waddle") or {}
    if not isinstance(waddle_block, dict):
        waddle_block = {}

    recommended_agents = (
        waddle_block.get("recommended_agents")
        or header_dict.get("recommended_agents")
        or []
    )
    if not isinstance(recommended_agents, list):
        recommended_agents = [recommended_agents] if recommended_agents else []

    required_tools = (
        waddle_block.get("required_tools")
        or header_dict.get("required_tools")
        or []
    )
    if not isinstance(required_tools, list):
        required_tools = [required_tools] if required_tools else []

    # Infer category from parent directory if standard
    category = "general"
    parent_dir = path.parent.parent.name
    if parent_dir in {"development", "review", "research", "planning", "finance", "sports", "system", "general"}:
        category = parent_dir
    elif header_dict.get("category"):
        category = str(header_dict["category"])

    return Skill(
        name=str(name).strip(),
        description=str(desc).strip(),
        version=str(version).strip(),
        platforms=[str(p) for p in platforms],
        recommended_agents=[str(a) for a in recommended_agents],
        required_tools=[str(t) for t in required_tools],
        instructions=instructions,
        category=category,
        file_path=str(path.resolve()),
    )
