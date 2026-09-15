import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from waddle.runtime.agent_runtime import AgentRuntime
from waddle.tools.catalog import catalog_add_movie, register_catalog_tools
from waddle.tools.registry import ToolRegistry
from waddle.tools.sports import sports_get_standings


class TestSpecialistRouting(unittest.TestCase):
    def test_livro_match_task_uses_public_sports_tool_schema(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            runtime = AgentRuntime(db_path=str(Path(tmpdir) / "state.db"))
            manager = runtime.get_agent("Quinta")
            tasks = asyncio.run(manager.plan_objective("quais os próximos jogos do Liverpool", response_agent=runtime.get_agent("Livro")))

        self.assertEqual(tasks[0].assigned_agent, "Livro")
        self.assertEqual(tasks[0].input_data["tool_calls"][0]["tool"], "sports_get_matches")
        self.assertEqual(tasks[0].input_data["tool_calls"][0]["params"]["team_or_league"], "liverpool")

    def test_ma_market_overview_uses_registered_tool_name(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            runtime = AgentRuntime(db_path=str(Path(tmpdir) / "state.db"))
            manager = runtime.get_agent("Quinta")
            tasks = asyncio.run(manager.plan_objective("me dê um panorama do mercado hoje", response_agent=runtime.get_agent("Ma")))

        self.assertEqual(tasks[0].assigned_agent, "Ma")
        self.assertEqual(tasks[0].input_data["tool_calls"][0]["tool"], "stock_market_overview")

    def test_mosbey_creates_movie_task_for_faux_catalog(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            runtime = AgentRuntime(db_path=str(Path(tmpdir) / "state.db"))
            manager = runtime.get_agent("Quinta")
            mosbey = runtime.get_agent("Mosbey")
            self.assertIsNotNone(mosbey)
            self.assertEqual(mosbey.workspace_path, "D:\\Faux-catalago")
            tasks = asyncio.run(manager.plan_objective("adicione o filme Duna: Parte Dois no catálogo", response_agent=mosbey))

        self.assertEqual(tasks[0].assigned_agent, "Mosbey")
        self.assertEqual(tasks[0].input_data["tool_calls"][0]["tool"], "catalog_add_movie")
        self.assertEqual(tasks[0].input_data["tool_calls"][0]["params"]["title"], "Duna: Parte Dois")

    def test_livro_keeps_users_favorite_teams_in_memory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            runtime = AgentRuntime(db_path=str(Path(tmpdir) / "state.db"))
            livro = runtime.get_agent("Livro")
        facts = " ".join(item["fact"] for item in livro.memory)
        self.assertIn("Atlético Mineiro", facts)
        self.assertIn("Liverpool", facts)
        self.assertIn("Chicago Bears", facts)
        self.assertIn("Chicago Bulls", facts)

    def test_specialist_tools_are_registered(self):
        registry = ToolRegistry()
        register_catalog_tools(registry)
        self.assertIsNotNone(registry.get_tool("catalog_add_movie"))

    @patch("waddle.tools.sports._http_get_json")
    def test_sports_api_uses_current_season_when_not_provided(self, http_get):
        http_get.return_value = {"table": [{"intRank": "1", "strTeam": "Liverpool", "intPoints": "3"}]}
        result = sports_get_standings("premier league")
        self.assertTrue(result["success"])
        self.assertNotEqual(result["season"], "2024-2025")


if __name__ == "__main__":
    unittest.main()
