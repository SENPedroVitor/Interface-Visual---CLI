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
        # dependent review task, which is born BLOCKED until Nero finishes —
        # a real dependency signal, not a simulated one.
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
        self.assertIn("blocked", iris_statuses)
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
