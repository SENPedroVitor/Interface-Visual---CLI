import asyncio
import tempfile
import unittest
from pathlib import Path

from waddle.agents.worker import WorkerAgent
from waddle.context.prompt_builder import PromptBuilder
from waddle.core.event_bus import EventBus
from waddle.runtime.agent_runtime import AgentRuntime
from waddle.skills.registry import SkillRegistry
from waddle.skills.skill import Skill, parse_skill_file
from waddle.tools.registry import ToolRegistry
from waddle.tools.skills_tools import register_skill_tools


class TestSkills(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.skills_dir = Path("skills")
        self.event_bus = EventBus()
        self.tool_registry = ToolRegistry(event_bus=self.event_bus)
        self.skill_registry = SkillRegistry(skills_dir=self.skills_dir)
        register_skill_tools(self.tool_registry, self.skill_registry)

    def tearDown(self):
        try:
            self.tmp_dir.cleanup()
        except Exception:
            pass

    def test_parse_skill_file_with_frontmatter(self):
        tdd_path = self.skills_dir / "development" / "test-driven-development" / "SKILL.md"
        self.assertTrue(tdd_path.exists())

        skill = parse_skill_file(tdd_path)
        self.assertIsNotNone(skill)
        self.assertEqual(skill.name, "test-driven-development")
        self.assertIn("testes", skill.description.lower())
        self.assertIn("Nero", skill.recommended_agents)
        self.assertIn("read_file", skill.required_tools)
        self.assertEqual(skill.category, "development")
        self.assertIn("# Procedimento: Test-Driven Development (TDD)", skill.instructions)

    def test_parse_skill_file_fallback_and_missing(self):
        # Missing file
        self.assertIsNone(parse_skill_file(Path(self.tmp_dir.name) / "non_existent.md"))

        # File without frontmatter
        plain_file = Path(self.tmp_dir.name) / "plain_skill" / "SKILL.md"
        plain_file.parent.mkdir(parents=True, exist_ok=True)
        plain_file.write_text("# Plain Skill\nDirect markdown body.", encoding="utf-8")

        skill = parse_skill_file(plain_file)
        self.assertIsNotNone(skill)
        self.assertEqual(skill.name, "plain_skill")
        self.assertIn("# Plain Skill", skill.instructions)

    def test_skill_registry_discovery(self):
        registry = SkillRegistry(skills_dir=self.skills_dir)
        skills = registry.list_skills()
        names = {s.name for s in skills}

        self.assertIn("plan-objective", names)
        self.assertIn("test-driven-development", names)
        self.assertIn("review-code", names)
        self.assertIn("grounded-citations", names)

        # Case-insensitive lookup
        skill = registry.get_skill("TEST-DRIVEN-DEVELOPMENT")
        self.assertIsNotNone(skill)
        self.assertEqual(skill.name, "test-driven-development")

    def test_skill_registry_filtering_by_agent(self):
        registry = SkillRegistry(skills_dir=self.skills_dir)

        nero_skills = [s.name for s in registry.list_skills(agent_name="Nero")]
        self.assertIn("test-driven-development", nero_skills)

        iris_skills = [s.name for s in registry.list_skills(agent_name="Iris")]
        self.assertIn("review-code", iris_skills)

        atlas_skills = [s.name for s in registry.list_skills(agent_name="Atlas")]
        self.assertIn("grounded-citations", atlas_skills)

        quinta_skills = [s.name for s in registry.list_skills(agent_name="Quinta")]
        self.assertIn("plan-objective", quinta_skills)

    def test_format_skill_index_progressive_disclosure(self):
        registry = SkillRegistry(skills_dir=self.skills_dir)

        index_nero = registry.format_skill_index(agent_name="Nero")
        self.assertIn("[SKILLS PROCEDURAIS", index_nero)
        self.assertIn("test-driven-development", index_nero)
        self.assertIn("skill_view", index_nero)

        # Respect character limit
        truncated_index = registry.format_skill_index(agent_name="Nero", max_chars=40)
        self.assertIn("...", truncated_index)

    def test_skill_view_tool_execution(self):
        # Successful view
        res = asyncio.run(
            self.tool_registry.execute(
                "skill_view",
                {"skill_name": "test-driven-development"},
            )
        )
        self.assertTrue(res.success)
        self.assertEqual(res.result["name"], "test-driven-development")
        self.assertIn("Nero", res.result["recommended_agents"])
        self.assertIn("Test-Driven Development", res.result["instructions"])

        # Non-existent skill
        err_res = asyncio.run(
            self.tool_registry.execute(
                "skill_view",
                {"skill_name": "unknown-magic-skill"},
            )
        )
        self.assertFalse(err_res.success)
        self.assertIn("not found", err_res.error)

    def test_skill_list_tool_execution(self):
        res = asyncio.run(
            self.tool_registry.execute(
                "skill_list",
                {"agent_name": "Iris"},
            )
        )
        self.assertTrue(res.success)
        names = [s["name"] for s in res.result]
        self.assertIn("review-code", names)

    def test_prompt_builder_integrates_skill_index(self):
        builder = PromptBuilder(
            tool_registry=self.tool_registry,
            skill_registry=self.skill_registry,
        )
        nero = WorkerAgent(
            name="Nero",
            role="Developer",
            description="Dev bot",
            provider_id="codex",
            skills=["python"],
        )

        prompt = builder.build(
            agent=nero,
            objective="Implementar refatoração do módulo de tarefas",
            mode="tool_choice",
        )

        self.assertIn("[SKILLS PROCEDURAIS", prompt)
        self.assertIn("test-driven-development", prompt)
        self.assertIn("skill_view", prompt)

    def test_agent_runtime_wires_skills_end_to_end(self):
        db_file = str(Path(self.tmp_dir.name) / "runtime_skills.db")
        runtime = AgentRuntime(
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            db_path=db_file,
            skills_dir=self.skills_dir,
        )

        nero = runtime.get_agent("Nero")
        prompt = nero.prompt_builder.build(
            agent=nero,
            objective="Criar novos testes para o sistema",
        )
        self.assertIn("test-driven-development", prompt)

        tools = [t["name"] for t in runtime.tool_registry.list_tools()]
        self.assertIn("skill_view", tools)
        self.assertIn("skill_list", tools)


if __name__ == "__main__":
    unittest.main()
