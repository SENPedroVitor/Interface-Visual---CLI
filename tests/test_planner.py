import asyncio
import json
import tempfile
import unittest
from pathlib import Path

from waddle.agents.manager import ManagerAgent
from waddle.core.event_bus import EventBus
from waddle.runtime.agent_runtime import AgentRuntime
from waddle.tools.registry import ToolRegistry


class TestPlanner(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.tmp_dir.name) / "test_planner.db")
        self.event_bus = EventBus()
        self.tool_registry = ToolRegistry(event_bus=self.event_bus)
        self.runtime = AgentRuntime(
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            db_path=self.db_path,
        )
        self.manager: ManagerAgent = self.runtime.get_agent("Quinta")

    def tearDown(self):
        try:
            self.tmp_dir.cleanup()
        except Exception:
            pass

    def test_parse_tasks_json_valid_and_markdown_wrappers(self):
        # Direct json array
        raw_json = json.dumps([
            {"title": "Tarefa 1", "assigned_agent": "Atlas", "description": "Desc 1", "dependencies": []},
            {"title": "Tarefa 2", "assigned_agent": "Nero", "description": "Desc 2", "dependencies": [0]},
        ])
        specs = ManagerAgent._parse_tasks_json(raw_json)
        self.assertEqual(len(specs), 2)
        self.assertEqual(specs[0]["title"], "Tarefa 1")
        self.assertEqual(specs[1]["dependencies"], [0])

        # Markdown wrapped
        markdown_text = f"Aqui está o plano:\n```json\n{raw_json}\n```\nEspero que ajude!"
        specs_md = ManagerAgent._parse_tasks_json(markdown_text)
        self.assertEqual(len(specs_md), 2)
        self.assertEqual(specs_md[0]["assigned_agent"], "Atlas")

        # Invalid json
        self.assertEqual(ManagerAgent._parse_tasks_json("Não é um json válido."), [])
        self.assertEqual(ManagerAgent._parse_tasks_json('{"tipo": "objeto_simples"}'), [])

    def test_plan_with_llm_creates_tasks_and_resolves_dependencies(self):
        plan_response = json.dumps([
            {
                "title": "Mapear arquivos do módulo",
                "assigned_agent": "Atlas",
                "description": "Analisar estrutura de diretórios e imports",
                "dependencies": [],
                "input_data": {"action": "list_files"},
            },
            {
                "title": "Implementar refatoração",
                "assigned_agent": "Nero",
                "description": "Reescrever classes com novos tipos",
                "dependencies": [0],
                "input_data": {"action": "refactor"},
            },
            {
                "title": "Revisar cobertura de testes",
                "assigned_agent": "Iris",
                "description": "Garantir 100% dos testes passando",
                "dependencies": [1],
                "input_data": {"action": "review"},
            },
        ])

        self.manager.llm_generate = lambda agent, prompt: plan_response

        tasks = asyncio.run(
            self.manager._plan_with_llm(
                objective="Refatorar arquitetura do módulo de eventos",
                speaker=self.manager,
                params={},
            )
        )

        self.assertEqual(len(tasks), 3)
        # Task 0: Atlas
        self.assertEqual(tasks[0].title, "Mapear arquivos do módulo")
        self.assertEqual(tasks[0].assigned_agent, "Atlas")
        self.assertEqual(tasks[0].dependencies, [])

        # Task 1: Nero depends on Task 0
        self.assertEqual(tasks[1].title, "Implementar refatoração")
        self.assertEqual(tasks[1].assigned_agent, "Nero")
        self.assertEqual(tasks[1].dependencies, [tasks[0].id])

        # Task 2: Iris depends on Task 1
        self.assertEqual(tasks[2].title, "Revisar cobertura de testes")
        self.assertEqual(tasks[2].assigned_agent, "Iris")
        self.assertEqual(tasks[2].dependencies, [tasks[1].id])

    def test_plan_objective_uses_llm_planner_when_available(self):
        plan_response = json.dumps([
            {
                "title": "Auditoria de segurança",
                "assigned_agent": "Atlas",
                "description": "Verificar portas e dependências",
                "dependencies": [],
            },
            {
                "title": "Corrigir vulnerabilidades",
                "assigned_agent": "Nero",
                "description": "Atualizar pacotes",
                "dependencies": [0],
            },
        ])
        self.manager.llm_generate = lambda agent, prompt: plan_response

        tasks = asyncio.run(
            self.manager.plan_objective("Executar auditoria de segurança completa no projeto")
        )

        self.assertEqual(len(tasks), 2)
        self.assertEqual(tasks[0].assigned_agent, "Atlas")
        self.assertEqual(tasks[1].assigned_agent, "Nero")
        self.assertEqual(tasks[1].dependencies, [tasks[0].id])

    def test_plan_objective_falls_back_to_heuristics_when_llm_fails(self):
        # LLM returns non-json text
        self.manager.llm_generate = lambda agent, prompt: "Não consigo planejar agora."

        test_file = str(Path(self.tmp_dir.name) / "config.json")
        tasks = asyncio.run(
            self.manager.plan_objective(
                "Criar arquivo de configuração com dados padrão",
                parameters={"path": test_file, "content": '{"version": 1}'},
            )
        )

        self.assertEqual(len(tasks), 2)
        self.assertEqual(tasks[0].assigned_agent, "Nero")
        self.assertEqual(tasks[1].assigned_agent, "Iris")
        self.assertEqual(tasks[1].dependencies, [tasks[0].id])

    def test_discuss_with_team_multi_round_critique(self):
        self.manager.llm_generate = lambda agent, prompt: f"{agent.name}: Análise detalhada para {agent.role}."

        opinions = asyncio.run(
            self.manager.discuss_with_team(
                "Avaliar transição para banco PostgreSQL em produção",
                rounds=2,
                with_critique=True,
            )
        )

        # Round 1: Atlas, Nero, Iris (3 opinions)
        # Round 2: Iris critique + Nero refinement (2 opinions)
        self.assertGreaterEqual(len(opinions), 5)

        round_critique = [op for op in opinions if "[Revisão Crítica]" in op["content"]]
        self.assertEqual(len(round_critique), 1)
        self.assertEqual(round_critique[0]["agent"], "Iris")

        round_refinement = [op for op in opinions if "[Ajuste Técnico]" in op["content"]]
        self.assertEqual(len(round_refinement), 1)
        self.assertEqual(round_refinement[0]["agent"], "Nero")


if __name__ == "__main__":
    unittest.main()
