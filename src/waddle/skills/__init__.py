"""Skills subsystem for Waddle Agent OS."""
from .skill import Skill, parse_skill_file
from .registry import SkillRegistry

__all__ = ["Skill", "SkillRegistry", "parse_skill_file"]
