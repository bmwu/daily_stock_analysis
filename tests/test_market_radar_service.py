# -*- coding: utf-8 -*-
from src.services.market_radar_service import MarketRadarService


def test_build_chart_allows_non_ashare_with_daily_fallback(monkeypatch):
    service = MarketRadarService.__new__(MarketRadarService)

    class _DataManager:
        def get_realtime_quote(self, code):
            return None

    monkeypatch.setattr(
        "src.services.market_radar_service.fetch_daily_bars_for_code",
        lambda _dm, code, days=180: [
            {"date": "2026-07-01", "open": 1, "close": 2, "high": 3, "low": 1, "volume": 10},
            {"date": "2026-07-02", "open": 2, "close": 2.5, "high": 3, "low": 2, "volume": 11},
        ],
    )
    service.data_manager = _DataManager()
    kline = service.build_chart("AAPL", mode="kline")
    assert kline["code"] == "AAPL"
    assert len(kline["candles"]) == 2
    assert kline["intraday"] == []
    assert kline.get("degraded") == []

    both = service.build_chart("AAPL", mode="both")
    assert len(both["candles"]) == 2
    assert both["intraday"] == []
    assert "intraday_unsupported_market" in (both.get("degraded") or [])


def test_build_overview_shape(monkeypatch):
    service = MarketRadarService.__new__(MarketRadarService)

    monkeypatch.setattr(service, "_load_indices", lambda errors: [{"code": "000001", "name": "上证指数", "region": "cn", "price": 3000}])
    monkeypatch.setattr(service, "_load_portfolio", lambda errors: ({}, {"cash": 1.0, "total_asset": 2.0}))
    monkeypatch.setattr(service, "_load_watchlist", lambda errors: ["600519"])

    class _Monitor:
        def compute_for_codes(self, codes, portfolio_by_code=None, include_bars=True):
            items = []
            for code in codes:
                items.append(
                    {
                        "code": code,
                        "name": code,
                        "signals": [],
                        "price": 1.0,
                        "change_pct": 0.0,
                        "signals_available": True,
                    }
                )
            return {"items": items, "errors": []}

    service.monitor = _Monitor()
    payload = service.build_overview()
    assert "updated_at" in payload
    assert payload["indices"][0]["code"] == "000001"
    assert payload["index_catalog"][0]["code"] == "000001"
    assert any(item["region"] == "us" for item in payload["index_catalog"])
    assert payload["watchlist"][0]["code"] == "600519"
    assert payload["holdings"] == []


def test_normalize_index_quote_prefers_price_fields():
    from src.services.market_radar_service import _normalize_index_quote

    row = _normalize_index_quote(
        code="HSI",
        name="恒生指数",
        region="hk",
        row={"current": 18000.5, "change_percent": 1.2, "change_amount": 10},
    )
    assert row["price"] == 18000.5
    assert row["change_pct"] == 1.2
    assert row["change"] == 10
    assert row["region"] == "hk"


def test_build_overview_quotes_non_ashare_watchlist(monkeypatch):
    service = MarketRadarService.__new__(MarketRadarService)

    monkeypatch.setattr(service, "_load_indices", lambda errors: [])
    monkeypatch.setattr(service, "_load_portfolio", lambda errors: ({}, None))
    monkeypatch.setattr(service, "_load_watchlist", lambda errors: ["600519", "BABA"])

    class _Monitor:
        def compute_for_codes(self, codes, portfolio_by_code=None, include_bars=True):
            assert "BABA" in codes
            assert "600519" in codes
            return {
                "items": [
                    {
                        "code": "600519",
                        "name": "贵州茅台",
                        "signals": [],
                        "price": 1800.0,
                        "signals_available": True,
                    },
                    {
                        "code": "BABA",
                        "name": "阿里巴巴",
                        "signals": [],
                        "price": 90.0,
                        "signals_available": False,
                        "signals_unavailable_reason": "bars_unavailable",
                        "quote_source": "yfinance",
                    },
                ],
                "errors": [{"code": "BABA", "error": "bars_unavailable"}],
            }

    service.monitor = _Monitor()
    payload = service.build_overview()
    codes = [item["code"] for item in payload["watchlist"]]
    assert codes == ["600519", "BABA"]
    baba = payload["watchlist"][1]
    assert baba["price"] == 90.0
    assert baba["signals_available"] is False
    assert baba["quote_source"] == "yfinance"
    assert any(err.get("code") == "BABA" for err in payload["errors"])


def test_compute_for_codes_accepts_non_ashare(monkeypatch):
    from types import SimpleNamespace

    from src.services.trading_signal_monitor import TradingSignalMonitor

    monitor = TradingSignalMonitor.__new__(TradingSignalMonitor)

    class _DataManager:
        def get_realtime_quotes(self, codes, prefer_tencent_batch=True, log_final_failure=False):
            return {
                "AAPL": SimpleNamespace(
                    name="Apple",
                    price=100.0,
                    change_pct=1.0,
                    change_amount=1.0,
                    open_price=99.0,
                    high=101.0,
                    low=98.0,
                    pre_close=99.0,
                    volume=1,
                    amount=1,
                    turnover_rate=1,
                    source="yfinance",
                )
            }

    monkeypatch.setattr(
        "src.services.trading_signal_monitor.fetch_daily_bars_for_code",
        lambda *_args, **_kwargs: [],
    )
    monitor.data_manager = _DataManager()
    payload = monitor.compute_for_codes(["AAPL"], include_bars=True)
    assert payload["count"] == 1
    item = payload["items"][0]
    assert item["code"] == "AAPL"
    assert item["price"] == 100.0
    assert item["signals_available"] is False
    assert item["signals_unavailable_reason"] == "bars_unavailable"
