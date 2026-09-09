import asyncio
import tempfile
import unittest
from pathlib import Path

from waddle.runtime.agent_runtime import AgentRuntime
from waddle.core.event_bus import EventBus
from waddle.tools.registry import ToolRegistry


class TestAgentRuntime(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        db_file = str(Path(self.tmp_dir.name) / "test_state.db")
        self.event_bus = EventBus()
        self.tool_registry = ToolRegistry(event_bus=self.event_bus)
        self.runtime = AgentRuntime(
            event_bus=self.event_bus,
            tool_registry=self.tool_registry,
            db_path=db_file,
        )

    def tearDown(self):
        try:
            self.tmp_dir.cleanup()
        except Exception:
            pass

    def test_default_agents_registered(self):
        agents = self.runtime.list_agents()
        names = [a["name"] for a in agents]
        self.assertIn("Quinta", names)
        self.assertIn("Nero", names)
        self.assertIn("Atlas", names)
        self.assertIn("Iris", names)

    def test_custom_agent_survives_restart_and_rejects_duplicate_names(self):
        self.runtime.create_agent('Luna', 'Research', 'Pesquisa local')
        with self.assertRaises(ValueError):
            self.runtime.create_agent('luna', 'Developer')
        with self.assertRaises(ValueError):
            self.runtime.create_agent('System', 'Research')
        bus = EventBus()
        restored = AgentRuntime(event_bus=bus, tool_registry=ToolRegistry(event_bus=bus), db_path=str(self.runtime.database.path))
        self.assertEqual(restored.get_agent('Luna').description, 'Pesquisa local')

    def test_objective_targets_custom_agent_and_records_real_activity(self):
        self.runtime.create_agent('Luna', 'Research')
        result = asyncio.run(self.runtime.run_objective('analisar diretório', {'path': self.tmp_dir.name}, agent_name='Luna'))
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['tasks'][0]['assigned_agent'], 'Luna')
        self.assertIsNotNone(next(a for a in self.runtime.list_agents() if a['name'] == 'Luna')['last_activity_at'])
        self.assertIsNone(next(a for a in self.runtime.list_agents() if a['name'] == 'Nero')['last_activity_at'])

    def test_plain_message_is_answered_by_selected_agent(self):
        self.runtime.create_agent('Luna', 'Research')
        replies = []
        async def record(event):
            if event.data['message']['type'] == 'answer':
                replies.append(event.data['message']['from'])
        self.event_bus.subscribe('agent.message', record)
        asyncio.run(self.runtime.run_objective('olá', agent_name='Luna'))
        self.assertEqual(replies, ['Luna'])

    def test_full_objective_execution(self):
        test_file = str(Path(self.tmp_dir.name) / "teste_resultado.txt")
        objective = "Criar arquivo com resultado e verificar"

        res = asyncio.run(
            self.runtime.run_objective(
                objective=objective,
                parameters={"path": test_file, "content": "Waddle Agent OS MVP funcionando!"},
            )
        )

        self.assertEqual(res["status"], "completed")
        self.assertTrue(Path(test_file).exists())
        self.assertEqual(Path(test_file).read_text(encoding="utf-8"), "Waddle Agent OS MVP funcionando!")

    def test_agent_blocks_on_unmet_dependency_then_recovers(self):
        # The "arquivo" objective assigns Nero a write_file task and Iris a
        # dependent review task. Iris should look like she is waiting on Nero,
        # not hard-failed or idle.
        test_file = str(Path(self.tmp_dir.name) / "teste_dependencia.txt")
        objective = "Criar arquivo com resultado e verificar"

        iris_statuses: list[str] = []

        async def track_iris(event):
            if event.data.get("agent_name") == "Iris":
                iris_statuses.append(event.data.get("new_status"))

        self.event_bus.subscribe("agent.status_change", track_iris)

        res = asyncio.run(
            self.runtime.run_objective(
                objective=objective,
                parameters={"path": test_file, "content": "dependency check"},
            )
        )

        self.assertEqual(res["status"], "completed")
        self.assertIn("waiting", iris_statuses)
        # Recovers once the dependency clears, and settles back to idle.
        self.assertEqual(iris_statuses[-1], "idle")
        self.assertEqual(self.runtime.get_agent("Iris").status.value, "idle")

    def test_kill_switch(self):
        res = asyncio.run(self.runtime.stop_all(reason="Emergencia"))
        self.assertEqual(res["status"], "stopped")
        agents = self.runtime.list_agents()
        for a in agents:
            self.assertEqual(a["status"], "stopped")


if __name__ == "__main__":
    unittest.main()
