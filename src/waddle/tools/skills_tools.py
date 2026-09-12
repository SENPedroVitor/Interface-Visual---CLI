"""Skill viewing and inspection tools for Waddle Agent OS."""
from __future__ import annotations

from typing import Any, Optional
from .registry import Permission, RiskLevel, Tool, ToolRegistry
from ..skills.registry import SkillRegistry


def register_skill_tools(tool_registry: ToolRegistry, skill_registry: SkillRegistry) -> None:
    """Register skill inspection tools into ToolRegistry."""

    def skill_view(skill_name: str) -> dict[str, Any]:
        """Load full procedural steps, guidelines and metadata for a skill."""
        skill = skill_registry.get_skill(skill_name)
        if not skill:
            available = [s.name for s in skill_registry.list_skills()]
            raise ValueError(f"Skill '{skill_name}' not found. Available skills: {available}")
        return {
            "name": skill.name,
            "description": skill.description,
            "version": skill.version,
            "category": skill.category,
            "recommended_agents": skill.recommended_agents,
            "required_tools": skill.required_tools,
            "instructions": skill.instructions,
            "file_path": skill.file_path,
        }

    def skill_list(agent_name: Optional[str] = None) -> list[dict[str, Any]]:
        """List all available procedural skills, optionally filtered by agent."""
        skills = skill_registry.list_skills(agent_name)
        return [
            {
                "name": s.name,
                "description": s.description,
                "category": s.category,
                "recommended_agents": s.recommended_agents,
            }
            for s in skills
        ]

    tool_registry.register(
        Tool(
            name="skill_view",
            description="Carrega o procedimento e instruções completas de uma skill procedural a partir do seu nome.",
            handler=skill_view,
            input_schema={"skill_name": "string (identificador da skill, ex: 'test-driven-development')"},
            output_schema={"name": "string", "description": "string", "instructions": "string"},
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )

    tool_registry.register(
        Tool(
            name="skill_list",
            description="Lista as skills procedurais cadastradas no sistema com breve descrição.",
            handler=skill_list,
            input_schema={"agent_name": "string (opcional, nome do agente para filtrar)"},
            output_schema={"skills": "list of objects"},
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )
