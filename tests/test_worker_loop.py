import asyncio
import json
import tempfile
import unittest
from pathlib import Path

from waddle.agents.worker import WorkerAgent
from waddle.core.event_bus import EventBus
from waddle.runtime.agent_runtime import AgentRuntime
from waddle.tasks.task import Task
from waddle.tools.registry import ToolRegistry


class TestWorkerLoop(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.tmp_dir.name) / "test_worker.db")
        self.event_bus = EventBus()
        self.tool_registry = ToolRegistry(event_bus=self.event_bus)
        self.runtime = AgentRuntime(
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            db_path=self.db_path,
        )
        self.nero: WorkerAgent = self.runtime.get_agent("Nero")

    def tearDown(self):
        try:
            self.tmp_dir.cleanup()
        except Exception:
            pass

    def test_parse_action_json_valid_and_variations(self):
        # Tool call
        payload = '{"action": "tool_call", "tool": "write_file", "params": {"path": "a.txt"}}'
        parsed = WorkerAgent._parse_action_json(payload)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["action"], "tool_call")
        self.assertEqual(parsed["tool"], "write_file")

        # Markdown wrapped
        wrapped = f"Pensamento: preciso salvar o arquivo.\n```json\n{payload}\n```"
        parsed_md = WorkerAgent._parse_action_json(wrapped)
        self.assertIsNotNone(parsed_md)
        self.assertEqual(parsed_md["tool"], "write_file")

        # Finish action
        finish = '{"action": "finish", "final_answer": "Tudo concluído com perfeição."}'
        parsed_finish = WorkerAgent._parse_action_json(finish)
        self.assertIsNotNone(parsed_finish)
        self.assertEqual(parsed_finish["action"], "finish")
        self.assertEqual(parsed_finish["final_answer"], "Tudo concluído com perfeição.")

        # Invalid
        self.assertIsNone(WorkerAgent._parse_action_json("Texto sem nenhum JSON aqui."))

    def test_format_observations(self):
        results = [
            {"tool_name": "list_directory", "success": True, "result": {"files": ["main.py", "README.md"]}},
            {"tool_name": "read_file", "success": False, "error": "Arquivo não encontrado"},
        ]
        formatted = WorkerAgent._format_observations(results)
        self.assertIn("Passo 1: Chamou list_directory -> SUCESSO", formatted)
        self.assertIn("main.py", formatted)
        self.assertIn("Passo 2: Chamou read_file -> FALHA (Arquivo não encontrado)", formatted)

    def test_autonomous_tool_loop_executes_tool_and_finishes(self):
        test_file = str(Path(self.tmp_dir.name) / "autonomous_output.txt")

        calls_received = []

        def fake_llm(agent, prompt):
            calls_received.append(prompt)
            # Step 1: Agent decides to write a file
            if len(calls_received) == 1:
                return json.dumps({
                    "action": "tool_call",
                    "tool": "write_file",
                    "params": {"path": test_file, "content": "Gerado pelo loop autônomo ReAct!"},
                })
            # Step 2: Agent observes write_file succeeded and finishes
            return json.dumps({
                "action": "finish",
                "final_answer": "Arquivo autônomo gerado e verificado com sucesso!",
            })

        self.nero.llm_generate = fake_llm

        task = Task(
            title="Criar arquivo de relatório autonomamente",
            description="Escreva o relatório no caminho especificado e conclua.",
            assigned_agent="Nero",
            input_data={},  # No pre-configured tool_calls -> triggers autonomous loop
        )

        output = asyncio.run(self.nero.execute_task(task))

        # Check results
        self.assertEqual(len(calls_received), 2)
        self.assertEqual(output.get("final_answer"), "Arquivo autônomo gerado e verificado com sucesso!")
        self.assertTrue(Path(test_file).exists())
        self.assertEqual(Path(test_file).read_text(encoding="utf-8"), "Gerado pelo loop autônomo ReAct!")
        self.assertEqual(len(output["results"]), 1)
        self.assertEqual(output["results"][0]["tool_name"], "write_file")
        self.assertTrue(output["results"][0]["success"])

    def test_autonomous_tool_loop_respects_max_steps_guardrail(self):
        loop_counter = [0]

        def infinite_loop_llm(agent, prompt):
            loop_counter[0] += 1
            # Always requests another list_directory tool call without finishing
            return json.dumps({
                "action": "tool_call",
                "tool": "list_directory",
                "params": {"path": self.tmp_dir.name},
            })

        self.nero.llm_generate = infinite_loop_llm

        task = Task(
            title="Tarefa em loop",
            description="Tentar infinitamente",
            assigned_agent="Nero",
            input_data={},
        )

        output = asyncio.run(self.nero.execute_task(task))

        # Guardrail is max_steps=4
        self.assertEqual(loop_counter[0], 4)
        self.assertEqual(len(output["results"]), 4)

    def test_autonomous_tool_loop_offline_fallback(self):
        self.nero.llm_generate = None

        task = Task(
            title="Tarefa sem LLM online",
            description="Executar sem provedor LLM ativo",
            assigned_agent="Nero",
            input_data={},
        )

        output = asyncio.run(self.nero.execute_task(task))

        self.assertIn("results", output)
        self.assertEqual(output["results"][0]["action"], "default_execution")


if __name__ == "__main__":
    unittest.main()
