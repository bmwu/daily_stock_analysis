# -*- coding: utf-8 -*-
import pytest

from src.services.market_radar_service import MarketRadarService


def test_build_chart_rejects_non_ashare_code():
    service = MarketRadarService.__new__(MarketRadarService)
    with pytest.raises(ValueError):
        service.build_chart("AAPL", mode="intraday")


def test_build_overview_shape(monkeypatch):
    service = MarketRadarService.__new__(MarketRadarService)

    monkeypatch.setattr(service, "_load_indices", lambda errors: [{"code": "000001", "name": "上证指数", "price": 3000}])
    monkeypatch.setattr(service, "_load_portfolio", lambda errors: ({}, {"cash": 1.0, "total_asset": 2.0}))
    monkeypatch.setattr(service, "_load_watchlist", lambda errors: ["600519"])

    class _Monitor:
        def compute_for_codes(self, codes, portfolio_by_code=None, include_bars=True):
            items = []
            for code in codes:
                items.append({"code": code, "name": code, "signals": [], "price": 1.0, "change_pct": 0.0})
            return {"items": items, "errors": []}

    service.monitor = _Monitor()
    payload = service.build_overview()
    assert "updated_at" in payload
    assert payload["indices"][0]["code"] == "000001"
    assert payload["watchlist"][0]["code"] == "600519"
    assert payload["holdings"] == []
