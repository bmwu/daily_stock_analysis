# -*- coding: utf-8 -*-
from src.services.trading_signal_rules import RULE_TEXT, list_rules, split_rule_ids
from src.services.trading_signal_service import (
    PortfolioSnapshot,
    compute_signals,
    format_triggered_rules_for_prompt,
    summarize_trading_signals,
)


def _bars(closes, volumes=None, opens=None, highs=None, lows=None):
    volumes = volumes or [1000] * len(closes)
    opens = opens or list(closes)
    highs = highs or [c * 1.01 for c in closes]
    lows = lows or [c * 0.99 for c in closes]
    rows = []
    for i, close in enumerate(closes):
        rows.append(
            {
                "open": opens[i],
                "close": close,
                "high": highs[i],
                "low": lows[i],
                "volume": volumes[i],
            }
        )
    return rows


def test_rule_catalog_has_77_entries():
    assert len(RULE_TEXT) == 77
    assert len(list_rules()) == 77
    assert split_rule_ids("17 · 20 · 47") == ["17", "20", "47"]


def test_down_trend_emits_orange_signal():
    # Build downtrend: price < ma5 < ma30 and previous_ma5 <= ma5
    closes = [200 - i for i in range(34)] + [160] * 6
    assert len(closes) >= 30
    quote = {
        "price": 159.0,
        "change_pct": -0.5,
        "volume": 1000,
        "open_price": 160.0,
        "high": 160.0,
        "low": 158.8,
    }
    result = compute_signals(quote=quote, bars=_bars(closes), code="600000")
    titles = [s.title for s in result.signals]
    assert "下降趋势约束触发" in titles
    assert result.down_trend is True


def test_sharp_drop_emits_green_signal():
    closes = [10 + i * 0.1 for i in range(40)]
    quote = {
        "price": closes[-1],
        "change_pct": -8.5,
        "volume": 1000,
        "open_price": closes[-1],
        "high": closes[-1],
        "low": closes[-1] * 0.9,
    }
    result = compute_signals(quote=quote, bars=_bars(closes), code="600000")
    levels = {s.level for s in result.signals}
    titles = [s.title for s in result.signals]
    assert "快速下跌风险" in titles
    assert "green" in levels


def test_volume_breakout_emits_red_signal():
    closes = [100] * 25 + [101, 102, 103, 104, 110]
    volumes = [1000] * 29 + [3000]
    highs = closes[:]
    highs[-1] = 111
    quote = {
        "price": 110,
        "change_pct": 5.0,
        "volume": 3000,
        "open_price": 104,
        "high": 111,
        "low": 104,
    }
    result = compute_signals(
        quote=quote,
        bars=_bars(closes, volumes=volumes, highs=highs),
        code="600000",
    )
    titles = [s.title for s in result.signals]
    assert "放量突破20日高点" in titles


def test_portfolio_weight_signal():
    closes = [100] * 40
    quote = {"price": 100, "change_pct": 0.5, "volume": 1000, "open_price": 99.5, "high": 101, "low": 99}
    portfolio = PortfolioSnapshot(code="600000", weight=32.0, quantity=100, cost=90.0)
    result = compute_signals(quote=quote, bars=_bars(closes), portfolio=portfolio, code="600000")
    titles = [s.title for s in result.signals]
    assert "单股仓位接近上限" in titles
    assert any(s.level == "green" for s in result.signals if s.title == "单股仓位接近上限")


def test_summary_and_prompt_helpers():
    closes = [100] * 40
    quote = {"price": 100, "change_pct": -9.0, "volume": 1000, "open_price": 100, "high": 100, "low": 90}
    result = compute_signals(quote=quote, bars=_bars(closes), code="600000")
    summary = summarize_trading_signals(result)
    assert summary["signal_count"] >= 1
    prompt = format_triggered_rules_for_prompt(result)
    assert "已触发纪律规则" in prompt
