"""Skill Registry for discovering, indexing and querying procedural skills."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from .skill import Skill, parse_skill_file


class SkillRegistry:
    """Discovers and manages procedural SKILL.md files for agents."""

    def __init__(self, skills_dir: Optional[str | Path] = None):
        self.skills_dir = Path(skills_dir) if skills_dir else Path("skills")
        self._skills: dict[str, Skill] = {}
        if self.skills_dir.exists():
            self.load_skills()

    def load_skills(self) -> int:
        """Scan skills_dir recursively for SKILL.md files and register them."""
        loaded = 0
        if not self.skills_dir.exists():
            return 0

        for path in self.skills_dir.rglob("SKILL.md"):
            skill = parse_skill_file(path)
            if skill:
                self.register_skill(skill)
                loaded += 1
        return loaded

    def register_skill(self, skill: Skill) -> None:
        """Register or update a skill in the index."""
        self._skills[skill.name.lower()] = skill

    def get_skill(self, name: str) -> Optional[Skill]:
        """Retrieve a skill by name (case-insensitive)."""
        return self._skills.get(name.lower().strip())

    def list_skills(self, agent_name: Optional[str] = None) -> list[Skill]:
        """List skills, optionally filtered by agent recommendation.
        
        If agent_name is given, returns skills recommended for that agent plus
        general skills that have no recommended agents.
        """
        all_skills = list(self._skills.values())
        if not agent_name:
            return all_skills

        target = agent_name.lower().strip()
        matched: list[Skill] = []
        general: list[Skill] = []

        for skill in all_skills:
            rec_lower = [a.lower() for a in skill.recommended_agents]
            if target in rec_lower:
                matched.append(skill)
            elif not rec_lower:
                general.append(skill)

        return matched + general

    def format_skill_index(self, agent_name: Optional[str] = None, max_chars: int = 800) -> str:
        """Format a compact index for progressive disclosure in PromptBuilder.
        
        Injects only name and single-line description to stay well within budget.
        The full procedure is only loaded on-demand via the skill_view tool.
        """
        skills = self.list_skills(agent_name)
        if not skills:
            return ""

        header = "[SKILLS PROCEDURAIS (consulte o procedimento completo com a tool skill_view)]"
        lines = [header]
        current_len = len(header) + 1

        for skill in skills:
            entry = f"- {skill.name}: {skill.description}"
            if current_len + len(entry) + 1 > max_chars:
                lines.append("- ... (outras skills disponíveis via skill_view)")
                break
            lines.append(entry)
            current_len += len(entry) + 1

        return "\n".join(lines)
