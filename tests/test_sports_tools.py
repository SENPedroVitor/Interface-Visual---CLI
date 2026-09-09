"""Unit tests for Waddle Sports Tools (Futebol, NBA, NFL, MLB)."""
import unittest

from waddle.tools.registry import ToolRegistry
from waddle.tools.sports import (
    register_sports_tools,
    sports_get_standings,
    sports_get_team_info,
    sports_get_matches,
    sports_get_trivia_and_rules,
)


class TestSportsTools(unittest.TestCase):
    def setUp(self):
        self.registry = ToolRegistry()
        register_sports_tools(self.registry)

    def test_tools_registered(self):
        tools = self.registry.list_tools()
        names = {t["name"] for t in tools}
        self.assertIn("sports_get_standings", names)
        self.assertIn("sports_get_team_info", names)
        self.assertIn("sports_get_matches", names)
        self.assertIn("sports_get_trivia_and_rules", names)

    def test_standings_brasileirao(self):
        res = sports_get_standings("brasileirao")
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("sport"), "Futebol")
        table = res.get("table", [])
        self.assertGreater(len(table), 0)
        top = table[0]
        self.assertIn("team", top)
        self.assertIn("pos", top)

    def test_standings_nba(self):
        res = sports_get_standings("nba")
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("sport"), "Basquete")
        table = res.get("table", [])
        self.assertGreater(len(table), 0)
        celtics_or_okc = [t for t in table if "Boston Celtics" in t.get("team", "") or "Thunder" in t.get("team", "")]
        self.assertTrue(len(celtics_or_okc) > 0)

    def test_standings_nfl(self):
        res = sports_get_standings("nfl")
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("sport"), "NFL")
        table = res.get("table", [])
        self.assertGreater(len(table), 0)
        chiefs = [t for t in table if "Chiefs" in t.get("team", "")]
        self.assertTrue(len(chiefs) > 0)

    def test_standings_mlb(self):
        res = sports_get_standings("mlb")
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("sport"), "MLB")
        table = res.get("table", [])
        self.assertGreater(len(table), 0)
        dodgers = [t for t in table if "Dodgers" in t.get("team", "")]
        self.assertTrue(len(dodgers) > 0)

    def test_team_info_builtin_and_search(self):
        # Built-in Brazilian soccer club
        fla = sports_get_team_info("Flamengo")
        self.assertTrue(fla.get("success"))
        self.assertIn("Maracana", fla.get("stadium", ""))

        # Built-in NBA team
        lal = sports_get_team_info("Lakers")
        self.assertTrue(lal.get("success"))
        self.assertEqual(lal.get("sport"), "Basquete")

        # Built-in NFL team
        chiefs = sports_get_team_info("Chiefs")
        self.assertTrue(chiefs.get("success"))
        self.assertIn("Super Bowl", chiefs.get("titles", ""))

        # Built-in MLB team
        yankees = sports_get_team_info("Yankees")
        self.assertTrue(yankees.get("success"))
        self.assertIn("World Series", yankees.get("titles", ""))

    def test_matches_lookup(self):
        res = sports_get_matches("Flamengo")
        self.assertTrue(res.get("success"))
        self.assertIn("past_matches", res)
        self.assertIn("upcoming_matches", res)

    def test_trivia_and_rules(self):
        nba_rules = sports_get_trivia_and_rules("nba_playoffs")
        self.assertTrue(nba_rules.get("success"))
        self.assertIn("Playoffs", nba_rules.get("content", ""))

        nfl_rules = sports_get_trivia_and_rules("nfl_rules")
        self.assertTrue(nfl_rules.get("success"))
        self.assertIn("Touchdown", nfl_rules.get("content", ""))

        mlb_rules = sports_get_trivia_and_rules("mlb_rules")
        self.assertTrue(mlb_rules.get("success"))
        self.assertIn("innings", mlb_rules.get("content", ""))


if __name__ == "__main__":
    unittest.main()
