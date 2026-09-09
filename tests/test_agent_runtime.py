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
        provider_by_name = {agent["name"]: agent["provider_id"] for agent in agents}
        self.assertEqual(provider_by_name["Nero"], "codex")
        self.assertEqual(provider_by_name["Iris"], "claude")

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

    def test_quinta_runs_local_team_discussion_for_plain_messages(self):
        manager = self.runtime.get_agent('Quinta')
        manager.llm_generate = lambda agent, prompt: f"{agent.name} opinou sobre o pedido."

        asyncio.run(self.runtime.run_objective('como melhoramos o projeto?', agent_name='Quinta'))

        messages = self.runtime.database.list_messages(limit=10)
        discussions = [msg for msg in messages if msg['type'] == 'discussion']
        self.assertEqual({msg['from'] for msg in discussions}, {'Atlas', 'Nero', 'Iris'})
        self.assertTrue(all(msg['to'] == 'Quinta' for msg in discussions))
        self.assertTrue(all(msg['data']['conversation_agent'] == 'quinta' for msg in discussions))
        self.assertTrue(any(msg['type'] == 'answer' and msg['from'] == 'Quinta' for msg in messages))

    def test_quinta_no_api_keys_request_gets_local_fallback_summary(self):
        manager = self.runtime.get_agent('Quinta')
        manager.llm_generate = None
        manager._ollama_answer = lambda agent, prompt: "Use API keys externas para resolver."

        asyncio.run(self.runtime.run_objective('como melhorar sem API keys?', agent_name='Quinta'))

        messages = self.runtime.database.list_messages(limit=10)
        answer = next(msg for msg in messages if msg['type'] == 'answer' and msg['from'] == 'Quinta')
        discussions = [msg for msg in messages if msg['type'] == 'discussion']
        self.assertIn('sem API keys', answer['content'])
        self.assertIn('Ollama', answer['content'])
        self.assertNotIn('Use API keys externas', answer['content'])
        self.assertTrue(all('API externa' not in msg['content'] for msg in discussions))
        self.assertTrue(any(msg['from'] == 'Atlas' and 'localmente' in msg['content'] for msg in discussions))

    def test_custom_agent_profile_can_be_updated(self):
        self.runtime.create_agent('Luna', 'Research', 'Pesquisa local')
        updated = self.runtime.update_agent('Luna', role='Reviewer', description='Revisa entregas', provider_id='claude')
        self.assertEqual(updated['role'], 'Reviewer')
        self.assertEqual(updated['description'], 'Revisa entregas')
        self.assertEqual(updated['provider_id'], 'claude')

        bus = EventBus()
        restored = AgentRuntime(event_bus=bus, tool_registry=ToolRegistry(event_bus=bus), db_path=str(self.runtime.database.path))
        self.assertEqual(restored.get_agent('Luna').role, 'Reviewer')
        self.assertEqual(restored.get_agent('Luna').description, 'Revisa entregas')
        self.assertEqual(restored.get_agent('Luna').provider_id, 'claude')

    def test_history_groups_messages_by_agent(self):
        self.runtime.create_agent('Luna', 'Research')
        asyncio.run(self.runtime.run_objective('olá', agent_name='Luna'))
        luna_messages = self.runtime.database.list_messages(agent_name='Luna')
        self.assertTrue(luna_messages)
        self.assertTrue(all(msg['from'] == 'Luna' or msg['to'] == 'Luna' for msg in luna_messages))

    def test_artifacts_are_derived_from_completed_write_tasks(self):
        test_file = str(Path(self.tmp_dir.name) / "artifact.txt")
        asyncio.run(
            self.runtime.run_objective(
                "Criar arquivo com resultado e verificar",
                {"path": test_file, "content": "artifact body"},
            )
        )

        artifacts = self.runtime.database.list_artifacts()
        self.assertEqual(artifacts[0]['filename'], 'artifact.txt')
        self.assertEqual(artifacts[0]['agent_name'], 'Nero')
        self.assertEqual(artifacts[0]['bytes'], len("artifact body"))

    def test_routines_are_saved_for_existing_agents(self):
        routine = self.runtime.create_routine(
            agent_name='Nero',
            name='Revisar pendências',
            prompt='Verifique tarefas bloqueadas e sugira o próximo passo.',
            schedule='todo dia as 09:00',
        )

        self.assertEqual(routine['agent_name'], 'Nero')
        self.assertEqual(routine['status'], 'draft')
        self.assertEqual(self.runtime.database.list_routines(agent_name='Nero')[0]['name'], 'Revisar pendências')

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
