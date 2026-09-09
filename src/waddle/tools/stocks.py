"""Stock Market, B3, FIIs and Portfolio Management tools for Waddle Agent OS."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.parse
import urllib.request

from .registry import Tool, ToolRegistry, RiskLevel, Permission
from ..core.os_layer import get_waddle_data_dir

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

TICKER_ALIASES: Dict[str, str] = {
    "IBOV": "^BVSP",
    "IBOVESPA": "^BVSP",
    "DOLAR": "USDBRL=X",
    "DÓLAR": "USDBRL=X",
    "USD": "USDBRL=X",
    "SP500": "^GSPC",
    "S&P500": "^GSPC",
    "BITCOIN": "BTC-USD",
    "BTC": "BTC-USD",
    "ETHEREUM": "ETH-USD",
    "ETH": "ETH-USD",
}


def _normalize_ticker(ticker: str) -> str:
    raw = ticker.strip().upper()
    if raw in TICKER_ALIASES:
        return TICKER_ALIASES[raw]
    if raw.startswith("^") or "=" in raw or "-" in raw:
        return raw
    # If standard Brazilian ticker (ends with 3, 4, 11, 5, 6, etc. and not ending in .SA)
    if not raw.endswith(".SA") and any(raw.endswith(digit) for digit in ("3", "4", "5", "6", "11", "34")):
        return f"{raw}.SA"
    return raw


def _clean_display_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    if t.endswith(".SA"):
        return t[:-3]
    return t


def _fetch_yahoo_chart(symbol: str, interval: str = "1d", range_: str = "5d") -> dict[str, Any]:
    encoded_sym = urllib.parse.quote(symbol)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded_sym}?interval={interval}&range={range_}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        result = data.get("chart", {}).get("result")
        if not result:
            err = data.get("chart", {}).get("error", {}).get("description", "Ativo não encontrado")
            raise ValueError(f"Yahoo Finance API error: {err}")
        return result[0]
    except Exception as e:
        raise RuntimeError(f"Erro ao buscar cotação de '{symbol}': {e}")


def get_stock_quote(ticker: str) -> dict[str, Any]:
    """Obtém a cotação atual e variação em tempo real de uma ação, FII ou índice (B3 ou Internacional)."""
    symbol = _normalize_ticker(ticker)
    chart = _fetch_yahoo_chart(symbol, interval="1d", range_="5d")
    meta = chart.get("meta", {})
    
    regular_price = meta.get("regularMarketPrice")
    prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
    
    change = None
    change_pct = None
    if regular_price is not None and prev_close is not None and prev_close > 0:
        change = round(regular_price - prev_close, 4)
        change_pct = round((change / prev_close) * 100, 2)

    currency = meta.get("currency", "BRL")
    if symbol.endswith(".SA"):
        currency = "BRL"

    return {
        "ticker": _clean_display_ticker(symbol),
        "symbol": symbol,
        "price": regular_price,
        "currency": currency,
        "change": change,
        "change_pct": change_pct,
        "previous_close": prev_close,
        "day_high": meta.get("regularMarketDayHigh"),
        "day_low": meta.get("regularMarketDayLow"),
        "fifty_two_week_high": meta.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": meta.get("fiftyTwoWeekLow"),
        "volume": meta.get("regularMarketVolume"),
        "exchange": meta.get("exchangeName", "B3" if symbol.endswith(".SA") else "US"),
    }


def get_stock_technicals(ticker: str) -> dict[str, Any]:
    """Calcula indicadores técnicos (RSI 14, Médias Móveis SMA20/SMA50 e tendência) para o ativo."""
    symbol = _normalize_ticker(ticker)
    chart = _fetch_yahoo_chart(symbol, interval="1d", range_="3mo")
    
    indicators = chart.get("indicators", {})
    quotes = indicators.get("quote", [{}])[0]
    closes = [c for c in quotes.get("close", []) if c is not None]
    
    if len(closes) < 14:
        raise ValueError(f"Histórico insuficiente para cálculo técnico de {ticker} (mínimo 14 pregões).")

    current_price = closes[-1]
    sma20 = round(sum(closes[-20:]) / min(len(closes), 20), 2) if len(closes) >= 20 else None
    sma50 = round(sum(closes[-50:]) / min(len(closes), 50), 2) if len(closes) >= 50 else None

    # RSI 14
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0 for d in deltas[-14:]]
    losses = [-d if d < 0 else 0 for d in deltas[-14:]]
    
    avg_gain = sum(gains) / 14
    avg_loss = sum(losses) / 14
    
    if avg_loss == 0:
        rsi = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi = round(100 - (100 / (1 + rs)), 2)

    # Trend calculation
    trend = "Lateral"
    if sma20:
        if current_price > sma20:
            trend = "Alta (acima da MM20)"
            if sma50 and sma20 > sma50:
                trend = "Forte Alta (MM20 > MM50)"
        else:
            trend = "Baixa (abaixo da MM20)"
            if sma50 and sma20 < sma50:
                trend = "Forte Baixa (MM20 < MM50)"

    rsi_assessment = "Neutro"
    if rsi >= 70:
        rsi_assessment = "Sobrecomprado (atenção para realização de lucros)"
    elif rsi <= 30:
        rsi_assessment = "Sobrevendido (potencial oportunidade de compra)"

    return {
        "ticker": _clean_display_ticker(symbol),
        "current_price": round(current_price, 2),
        "rsi_14": rsi,
        "rsi_assessment": rsi_assessment,
        "sma_20": sma20,
        "sma_50": sma50,
        "trend": trend,
        "data_points": len(closes),
    }


def get_market_overview() -> dict[str, Any]:
    """Retorna um resumo instantâneo dos principais índices e moedas do mercado (Ibov, Dólar, S&P 500, Bitcoin)."""
    benchmarks = [
        ("IBOVESPA", "^BVSP"),
        ("Dólar Comercial", "USDBRL=X"),
        ("S&P 500", "^GSPC"),
        ("Bitcoin", "BTC-USD"),
    ]
    summary = []
    for name, sym in benchmarks:
        try:
            q = get_stock_quote(sym)
            summary.append({
                "name": name,
                "ticker": q["ticker"],
                "price": q["price"],
                "change_pct": q["change_pct"],
                "currency": q["currency"],
            })
        except Exception:
            continue
    return {"market_summary": summary}


def _get_portfolio_file() -> Path:
    data_dir = get_waddle_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "stock_portfolio.json"


def _load_portfolio() -> dict[str, Any]:
    p = _get_portfolio_file()
    if not p.exists():
        initial = {
            "cash_balance": 10000.0,
            "currency": "BRL",
            "positions": {},  # ticker: {"shares": float, "average_price": float, "total_invested": float}
            "trade_history": [],
        }
        p.write_text(json.dumps(initial, indent=2, ensure_ascii=False), encoding="utf-8")
        return initial
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"cash_balance": 10000.0, "currency": "BRL", "positions": {}, "trade_history": []}


def _save_portfolio(data: dict[str, Any]) -> None:
    p = _get_portfolio_file()
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def get_portfolio_view() -> dict[str, Any]:
    """Consulta a carteira de investimentos em ações/FIIs com cotações atuais, preço médio e rentabilidade acumulada."""
    data = _load_portfolio()
    positions = data.get("positions", {})
    cash = float(data.get("cash_balance", 0.0))

    total_invested = 0.0
    current_portfolio_value = 0.0
    detailed_positions = []

    for tkr, info in positions.items():
        shares = float(info.get("shares", 0.0))
        avg_price = float(info.get("average_price", 0.0))
        invested = float(info.get("total_invested", shares * avg_price))
        total_invested += invested

        # Live quote
        current_price = avg_price
        day_change_pct = 0.0
        try:
            q = get_stock_quote(tkr)
            if q.get("price") is not None:
                current_price = float(q["price"])
            if q.get("change_pct") is not None:
                day_change_pct = float(q["change_pct"])
        except Exception:
            pass

        pos_current_value = round(shares * current_price, 2)
        current_portfolio_value += pos_current_value

        pnl_brl = round(pos_current_value - invested, 2)
        pnl_pct = round((pnl_brl / invested * 100) if invested > 0 else 0.0, 2)

        detailed_positions.append({
            "ticker": tkr,
            "shares": shares,
            "average_price": avg_price,
            "current_price": current_price,
            "invested_brl": invested,
            "current_value_brl": pos_current_value,
            "pnl_brl": pnl_brl,
            "pnl_pct": pnl_pct,
            "day_change_pct": day_change_pct,
        })

    net_worth = round(cash + current_portfolio_value, 2)
    total_pnl_brl = round(current_portfolio_value - total_invested, 2)
    total_pnl_pct = round((total_pnl_brl / total_invested * 100) if total_invested > 0 else 0.0, 2)

    return {
        "cash_balance": round(cash, 2),
        "total_invested": round(total_invested, 2),
        "positions_value": round(current_portfolio_value, 2),
        "net_worth": net_worth,
        "total_pnl_brl": total_pnl_brl,
        "total_pnl_pct": total_pnl_pct,
        "positions": detailed_positions,
    }


def record_trade(ticker: str, operation: str, shares: float, price: Optional[float] = None) -> dict[str, Any]:
    """Registra uma operação de compra ('compra') ou venda ('venda') de ações ou FIIs na carteira."""
    clean_ticker = _clean_display_ticker(ticker)
    op = operation.strip().lower()
    if op not in {"compra", "buy", "venda", "sell"}:
        raise ValueError("Operação inválida. Use 'compra' ou 'venda'.")
    is_buy = op in {"compra", "buy"}

    if shares <= 0:
        raise ValueError("A quantidade de cotas/ações deve ser maior que zero.")

    if price is None or price <= 0:
        q = get_stock_quote(ticker)
        price = q.get("price")
        if price is None:
            raise ValueError(f"Não foi possível obter o preço automático de {clean_ticker}. Forneça o preço.")

    trade_cost = round(shares * price, 2)
    data = _load_portfolio()
    cash = float(data.get("cash_balance", 0.0))
    positions = data.get("positions", {})

    if is_buy:
        if cash < trade_cost:
            raise ValueError(f"Saldo insuficiente. Custo: R$ {trade_cost:.2f}, Saldo disponível: R$ {cash:.2f}")
        data["cash_balance"] = round(cash - trade_cost, 2)
        
        current_pos = positions.get(clean_ticker, {"shares": 0.0, "average_price": 0.0, "total_invested": 0.0})
        prev_shares = float(current_pos["shares"])
        prev_invested = float(current_pos["total_invested"])
        
        new_shares = prev_shares + shares
        new_invested = prev_invested + trade_cost
        new_avg = round(new_invested / new_shares, 2)

        positions[clean_ticker] = {
            "shares": new_shares,
            "average_price": new_avg,
            "total_invested": round(new_invested, 2),
        }
    else:
        # Venda
        current_pos = positions.get(clean_ticker)
        if not current_pos or float(current_pos["shares"]) < shares:
            avail = current_pos["shares"] if current_pos else 0
            raise ValueError(f"Quantidade insuficiente para venda de {clean_ticker}. Disponível: {avail}, Tentou vender: {shares}")
        
        prev_shares = float(current_pos["shares"])
        avg_price = float(current_pos["average_price"])
        
        new_shares = prev_shares - shares
        data["cash_balance"] = round(cash + trade_cost, 2)
        
        if new_shares == 0:
            del positions[clean_ticker]
        else:
            positions[clean_ticker] = {
                "shares": new_shares,
                "average_price": avg_price,
                "total_invested": round(new_shares * avg_price, 2),
            }

    data["positions"] = positions
    data.setdefault("trade_history", []).append({
        "ticker": clean_ticker,
        "operation": "compra" if is_buy else "venda",
        "shares": shares,
        "price": price,
        "total": trade_cost,
    })
    _save_portfolio(data)

    return {
        "message": f"{'Compra' if is_buy else 'Venda'} de {shares} {clean_ticker} a R$ {price:.2f} registrada com sucesso!",
        "ticker": clean_ticker,
        "shares": shares,
        "price": price,
        "total": trade_cost,
        "remaining_cash": data["cash_balance"],
    }


def register_stock_tools(registry: ToolRegistry) -> None:
    """Registra as ferramentas de bolsa de valores e investimentos no ToolRegistry do Waddle."""
    registry.register(
        Tool(
            name="stock_get_quote",
            description="Obtém a cotação em tempo real de uma ação da B3 (ex: PETR4, VALE3, ITUB4), FII (ex: MXRF11), índice ou ativo internacional.",
            handler=get_stock_quote,
            input_schema={
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "Código do ativo na B3 ou global (ex: PETR4, VALE3, MXRF11, AAPL, IBOVESPA)"},
                },
                "required": ["ticker"],
            },
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )

    registry.register(
        Tool(
            name="stock_get_technicals",
            description="Calcula indicadores técnicos avançados (RSI 14, Médias Móveis SMA20/SMA50 e tendência de mercado) para um ativo da bolsa.",
            handler=get_stock_technicals,
            input_schema={
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "Código do ativo (ex: PETR4, VALE3, MXRF11, AAPL)"},
                },
                "required": ["ticker"],
            },
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )

    registry.register(
        Tool(
            name="stock_market_overview",
            description="Retorna um resumo instantâneo dos principais índices e moedas: Ibovespa, Dólar, S&P 500 e Bitcoin.",
            handler=get_market_overview,
            input_schema={"type": "object", "properties": {}},
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )

    registry.register(
        Tool(
            name="stock_portfolio_view",
            description="Consulta a carteira de investimentos com saldo em caixa, cotas de cada ação/FII, preço médio, valor atual e rentabilidade acumulada.",
            handler=get_portfolio_view,
            input_schema={"type": "object", "properties": {}},
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )

    registry.register(
        Tool(
            name="stock_portfolio_record_trade",
            description="Registra uma operação de aporte (compra) ou venda de ações ou FIIs na carteira de investimentos com cálculo de preço médio.",
            handler=record_trade,
            input_schema={
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "Código do ativo (ex: PETR4, MXRF11)"},
                    "operation": {"type": "string", "enum": ["compra", "venda"], "description": "'compra' ou 'venda'"},
                    "shares": {"type": "number", "description": "Quantidade de ações ou cotas"},
                    "price": {"type": "number", "description": "Preço unitário em R$ (opcional, busca a cotação atual se omitido)"},
                },
                "required": ["ticker", "operation", "shares"],
            },
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )
