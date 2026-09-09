"""Unit tests for Stock Market Tools and Investor Agent integration."""
import unittest
from unittest.mock import patch
from pathlib import Path
import tempfile

from waddle.tools.stocks import (
    _normalize_ticker,
    _clean_display_ticker,
    get_stock_quote,
    get_stock_technicals,
    get_market_overview,
    get_portfolio_view,
    record_trade,
    register_stock_tools,
)
from waddle.tools.registry import ToolRegistry
from waddle.runtime.agent_runtime import AgentRuntime


class TestStockTools(unittest.TestCase):
    def test_normalize_ticker(self):
        self.assertEqual(_normalize_ticker("PETR4"), "PETR4.SA")
        self.assertEqual(_normalize_ticker("VALE3"), "VALE3.SA")
        self.assertEqual(_normalize_ticker("MXRF11"), "MXRF11.SA")
        self.assertEqual(_normalize_ticker("PETR4.SA"), "PETR4.SA")
        self.assertEqual(_normalize_ticker("IBOVESPA"), "^BVSP")
        self.assertEqual(_normalize_ticker("DOLAR"), "USDBRL=X")
        self.assertEqual(_normalize_ticker("AAPL"), "AAPL")

    def test_clean_display_ticker(self):
        self.assertEqual(_clean_display_ticker("PETR4.SA"), "PETR4")
        self.assertEqual(_clean_display_ticker("AAPL"), "AAPL")
        self.assertEqual(_clean_display_ticker("^BVSP"), "^BVSP")

    @patch("waddle.tools.stocks._fetch_yahoo_chart")
    def test_get_stock_quote_mocked(self, mock_fetch):
        mock_fetch.return_value = {
            "meta": {
                "symbol": "PETR4.SA",
                "regularMarketPrice": 48.50,
                "chartPreviousClose": 47.00,
                "regularMarketDayHigh": 49.00,
                "regularMarketDayLow": 46.80,
                "fiftyTwoWeekHigh": 50.00,
                "fiftyTwoWeekLow": 30.00,
                "regularMarketVolume": 15000000,
                "exchangeName": "SAO",
                "currency": "BRL",
            }
        }
        quote = get_stock_quote("PETR4")
        self.assertEqual(quote["ticker"], "PETR4")
        self.assertEqual(quote["price"], 48.50)
        self.assertEqual(quote["change"], 1.50)
        self.assertEqual(quote["change_pct"], 3.19)
        self.assertEqual(quote["currency"], "BRL")

    @patch("waddle.tools.stocks._fetch_yahoo_chart")
    def test_get_stock_technicals_mocked(self, mock_fetch):
        # Generate 30 closing prices with an upward trend
        closes = [40.0 + i * 0.5 for i in range(30)]
        mock_fetch.return_value = {
            "meta": {"symbol": "VALE3.SA"},
            "indicators": {"quote": [{"close": closes}]},
        }
        tech = get_stock_technicals("VALE3")
        self.assertEqual(tech["ticker"], "VALE3")
        self.assertGreater(tech["current_price"], 50.0)
        self.assertIsNotNone(tech["rsi_14"])
        self.assertIsNotNone(tech["sma_20"])
        self.assertIn("Alta", tech["trend"])

    def test_register_stock_tools(self):
        registry = ToolRegistry()
        register_stock_tools(registry)
        tool_names = [t["name"] for t in registry.list_tools()]
        self.assertIn("stock_get_quote", tool_names)
        self.assertIn("stock_get_technicals", tool_names)
        self.assertIn("stock_market_overview", tool_names)
        self.assertIn("stock_portfolio_view", tool_names)
        self.assertIn("stock_portfolio_record_trade", tool_names)

    def test_runtime_registers_ma_agent(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = str(Path(tmpdir) / "test.db")
            runtime = AgentRuntime(db_path=db_path)
            self.assertIn("Ma", runtime.agents)
            ma = runtime.get_agent("Ma")
            self.assertIsNotNone(ma)
            self.assertEqual(ma.role, "Investor")
            tool_names = [t["name"] for t in runtime.tool_registry.list_tools()]
            self.assertIn("stock_get_quote", tool_names)
            quinta = runtime.get_agent("Quinta")
            self.assertIn("Ma", quinta.collaborators)


if __name__ == "__main__":
    unittest.main()
