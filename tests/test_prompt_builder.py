import unittest

from waddle.agents.worker import WorkerAgent
from waddle.context.model_budgets import (
    PromptBudget,
    get_model_budget,
    MODEL_BUDGETS,
)
from waddle.context.default_souls import (
    get_default_soul,
    get_default_memories,
)
from waddle.context.tool_context import build_tool_context
from waddle.context.memory_builder import build_memory_context
from waddle.context.conversation_context import build_conversation_context
from waddle.context.prompt_builder import PromptBuilder
from waddle.tools.registry import ToolRegistry, Tool, Permission


class TestModelBudgets(unittest.TestCase):
    def test_known_models(self):
        budget_qwen = get_model_budget("qwen2.5:0.5b")
        self.assertEqual(budget_qwen.max_chars, 4800)
        self.assertEqual(budget_qwen.soul, 600)

        budget_gpt = get_model_budget("gpt-4o")
        self.assertGreater(budget_gpt.max_chars, budget_qwen.max_chars)

        budget_claude = get_model_budget("claude-3-5-sonnet")
        self.assertGreater(budget_claude.max_chars, budget_qwen.max_chars)

    def test_prefix_matching(self):
        budget_claude = get_model_budget("claude-3-opus-20240229")
        self.assertGreaterEqual(budget_claude.max_chars, 40000)

        budget_gpt = get_model_budget("gpt-4o-mini-2024-07-18")
        self.assertEqual(budget_gpt.max_chars, MODEL_BUDGETS["gpt-4o-mini"].max_chars)

    def test_unknown_model_fallback(self):
        budget = get_model_budget("unknown-exotic-model-v1")
        self.assertIsInstance(budget, PromptBudget)
        self.assertEqual(budget.max_chars, 4800)
        self.assertEqual(budget.soul, 600)


class TestDefaultSouls(unittest.TestCase):
    def test_all_10_built_in_agents_have_souls(self):
        expected_agents = [
            "Quinta", "Atlas", "Nero", "Iris", "Ma",
            "Livro", "Pixel", "Motion", "Data", "Ops"
        ]
        for name in expected_agents:
            soul = get_default_soul(name)
            self.assertTrue(len(soul) > 20, f"Soul for {name} is too short or missing")
            memories = get_default_memories(name)
            self.assertTrue(len(memories) > 0, f"Memories for {name} missing")
            for m in memories:
                self.assertIn("fact", m)

    def test_unknown_agent_returns_empty(self):
        self.assertEqual(get_default_soul("NonExistentAgent"), "")
        self.assertEqual(get_default_memories("NonExistentAgent"), [])


class TestToolContext(unittest.TestCase):
    def test_filters_deny_tools(self):
        registry = ToolRegistry()
        registry.register(
            Tool(
                name="allowed_tool",
                description="An allowed tool for testing",
                handler=lambda: "ok",
                permission=Permission.ALLOW,
            )
        )
        registry.register(
            Tool(
                name="denied_tool",
                description="A secret denied tool",
                handler=lambda: "no",
                permission=Permission.DENY,
            )
        )
        context = build_tool_context(registry, budget_chars=500)
        self.assertIn("allowed_tool", context)
        self.assertNotIn("denied_tool", context)

    def test_respects_character_budget(self):
        registry = ToolRegistry()
        for i in range(20):
            registry.register(
                Tool(
                    name=f"tool_{i}",
                    description=f"Long description for tool number {i} " * 5,
                    handler=lambda: "ok",
                    permission=Permission.ALLOW,
                )
            )
        context = build_tool_context(registry, budget_chars=150)
        self.assertLessEqual(len(context), 160)


class TestMemoryBuilder(unittest.TestCase):
    def test_formats_facts(self):
        memories = [
            {"fact": "O usuário prefere respostas em português."},
            {"fact": "Nero é responsável por desenvolvimento."},
        ]
        output = build_memory_context(memories, budget_chars=500)
        self.assertIn("Memórias relevantes:", output)
        self.assertIn("respostas em português", output)
        self.assertIn("Nero é responsável", output)

    def test_handles_strings_and_dicts(self):
        memories = [
            "Fato direto como string",
            {"content": "Fato dentro de content"},
        ]
        output = build_memory_context(memories, budget_chars=500)
        self.assertIn("Fato direto como string", output)
        self.assertIn("Fato dentro de content", output)

    def test_empty_memories(self):
        self.assertEqual(build_memory_context([]), "")


class TestConversationContext(unittest.TestCase):
    def test_hybrid_separation(self):
        messages = [
            {"from": "User", "to": "System", "type": "question", "content": "Como criar um script?"},
            {"from": "Atlas", "to": "Quinta", "type": "discussion", "content": "Atlas sugere usar argparse."},
            {"from": "Nero", "to": "Quinta", "type": "discussion", "content": "Nero começou a codificar o script."},
            {"from": "Iris", "to": "Quinta", "type": "status_update", "content": "internal noise"},
        ]
        shared, private = build_conversation_context(messages, agent_name="Nero", budget_chars=1000)

        # Shared should include user question and Atlas suggestion
        self.assertIn("Como criar um script?", shared)
        self.assertIn("Atlas sugere", shared)
        # Noise should be filtered
        self.assertNotIn("internal noise", shared)
        self.assertNotIn("internal noise", private)
        # Nero's private history contains Nero's own message
        self.assertIn("Nero começou a codificar", private)


class TestPromptBuilder(unittest.TestCase):
    def setUp(self):
        self.registry = ToolRegistry()
        self.registry.register(
            Tool(
                name="file_read",
                description="Lê arquivos do sistema",
                handler=lambda: "ok",
            )
        )
        self.builder = PromptBuilder(tool_registry=self.registry)

    def test_builds_full_prompt_for_agent(self):
        agent = WorkerAgent(
            name="Nero",
            role="Developer",
            soul="Você é Nero, o dev sênior.",
            skills=["python", "git"],
            memory=[{"fact": "Nero trabalha em equipe com Quinta e Iris."}],
        )
        prompt = self.builder.build_prompt(
            agent=agent,
            objective="Crie uma função de ordenação.",
            model="gpt-4o",
        )
        self.assertIn("Regras do sistema:", prompt)
        self.assertIn("Nero, o dev sênior", prompt)
        self.assertIn("Developer", prompt)
        self.assertIn("python", prompt)
        self.assertIn("Crie uma função de ordenação", prompt)
        self.assertIn("file_read", prompt)
        self.assertIn("Nero trabalha em equipe", prompt)

    def test_budget_preserves_soul_and_objective_under_tight_limit(self):
        agent = WorkerAgent(
            name="Nero",
            role="Developer",
            soul="Alma sagrada e inegociável do agente Nero.",
            skills=["python"],
            memory=[{"fact": f"Memória longa de teste número {i}" * 5} for i in range(10)],
        )
        # Use very tight budget model
        budget = PromptBudget(
            max_chars=800,
            system=200,
            soul=200,
            skills=50,
            objective=150,
            shared_context=50,
            memory=50,
            history=50,
            tools=50,
        )
        prompt = self.builder.build_prompt(
            agent=agent,
            objective="Objetivo essencial que não pode sumir.",
            budget=budget,
        )
        # Soul and objective must be preserved
        self.assertIn("Alma sagrada", prompt)
        self.assertIn("Objetivo essencial", prompt)

        huge_budget = PromptBudget(
            max_chars=900,
            system=180,
            soul=80,
            skills=400,
            objective=120,
            shared_context=200,
            memory=200,
            history=200,
            tools=200,
        )
        squeezed = self.builder.build_prompt(
            agent=WorkerAgent(
                name="Nero",
                role="Developer",
                soul="Alma sagrada e inegociável do agente Nero.",
                skills=["python"] * 40,
            ),
            objective="Objetivo essencial que não pode sumir.",
            budget=huge_budget,
            extra_context="contexto extra " * 80,
        )
        self.assertIn("Alma sagrada", squeezed)
        self.assertIn("Objetivo essencial", squeezed)
        self.assertLessEqual(len(squeezed), huge_budget.max_chars)

    def test_team_opinions_formatting(self):
        agent = WorkerAgent(name="Quinta", role="Manager")
        opinions = [
            {"agent": "Atlas", "opinion": "Recomendo abordagem X.", "provider": "ollama"},
            {"agent": "Nero", "opinion": "Podemos codificar Y.", "provider": "codex"},
        ]
        prompt = self.builder.build_prompt(
            agent=agent,
            objective="Consolide as ideias",
            team_opinions=opinions,
        )
        self.assertIn("Opiniões da equipe nesta rodada:", prompt)
        self.assertIn("Atlas (ollama): Recomendo abordagem X.", prompt)
        self.assertIn("Nero (codex): Podemos codificar Y.", prompt)


if __name__ == "__main__":
    unittest.main()
