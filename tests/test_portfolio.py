"""Unit tests for stock portfolio management, trade recording, and average price calculations."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from waddle.tools.stocks import (
    record_trade,
    get_portfolio_view,
    _load_portfolio,
    _save_portfolio,
)


class TestPortfolio(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.portfolio_file = Path(self.tmp_dir.name) / "stock_portfolio.json"

    def tearDown(self):
        self.tmp_dir.cleanup()

    def _patch_file(self):
        return patch("waddle.tools.stocks._get_portfolio_file", return_value=self.portfolio_file)

    def test_initial_portfolio_created(self):
        with self._patch_file():
            data = _load_portfolio()
            self.assertEqual(data["cash_balance"], 10000.0)
            self.assertEqual(data["positions"], {})
            self.assertTrue(self.portfolio_file.exists())

    def test_buy_trade_and_average_price(self):
        with self._patch_file():
            # Buy 100 PETR4 @ 30.00
            res1 = record_trade("PETR4", "compra", 100, price=30.0)
            self.assertEqual(res1["remaining_cash"], 7000.0)
            self.assertEqual(res1["shares"], 100)

            data1 = _load_portfolio()
            pos = data1["positions"]["PETR4"]
            self.assertEqual(pos["shares"], 100)
            self.assertEqual(pos["average_price"], 30.0)
            self.assertEqual(pos["total_invested"], 3000.0)

            # Buy another 100 PETR4 @ 40.00
            res2 = record_trade("PETR4", "compra", 100, price=40.0)
            self.assertEqual(res2["remaining_cash"], 3000.0)

            data2 = _load_portfolio()
            pos2 = data2["positions"]["PETR4"]
            self.assertEqual(pos2["shares"], 200)
            # Weighted average: (3000 + 4000) / 200 = 35.0
            self.assertEqual(pos2["average_price"], 35.0)
            self.assertEqual(pos2["total_invested"], 7000.0)

    def test_sell_trade_updates_cash_and_shares(self):
        with self._patch_file():
            record_trade("VALE3", "compra", 50, price=60.0)  # Cost 3000, cash 7000
            res = record_trade("VALE3", "venda", 20, price=70.0)  # Total 1400, cash 8400
            self.assertEqual(res["remaining_cash"], 8400.0)

            data = _load_portfolio()
            pos = data["positions"]["VALE3"]
            self.assertEqual(pos["shares"], 30)
            # Average price stays 60.0
            self.assertEqual(pos["average_price"], 60.0)

    def test_sell_all_removes_position(self):
        with self._patch_file():
            record_trade("MXRF11", "compra", 100, price=10.0)
            record_trade("MXRF11", "venda", 100, price=10.5)

            data = _load_portfolio()
            self.assertNotIn("MXRF11", data["positions"])
            self.assertEqual(data["cash_balance"], 10050.0)

    def test_insufficient_funds_raises_error(self):
        with self._patch_file():
            with self.assertRaises(ValueError) as ctx:
                record_trade("WEGE3", "compra", 1000, price=50.0)  # Needs 50,000
            self.assertIn("Saldo insuficiente", str(ctx.exception))

    def test_sell_more_than_owned_raises_error(self):
        with self._patch_file():
            with self.assertRaises(ValueError) as ctx:
                record_trade("ITUB4", "venda", 10, price=30.0)
            self.assertIn("Quantidade insuficiente", str(ctx.exception))

    @patch("waddle.tools.stocks.get_stock_quote")
    def test_portfolio_view_calculates_pnl(self, mock_quote):
        mock_quote.return_value = {"price": 40.0, "change_pct": 2.5}
        with self._patch_file():
            record_trade("PETR4", "compra", 100, price=30.0)  # Invested: 3000, Cash: 7000
            view = get_portfolio_view()
            self.assertEqual(view["cash_balance"], 7000.0)
            self.assertEqual(view["total_invested"], 3000.0)
            self.assertEqual(view["positions_value"], 4000.0)
            self.assertEqual(view["net_worth"], 11000.0)
            self.assertEqual(view["total_pnl_brl"], 1000.0)
            self.assertEqual(view["total_pnl_pct"], 33.33)


if __name__ == "__main__":
    unittest.main()
