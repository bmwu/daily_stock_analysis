# -*- coding: utf-8 -*-
"""Assemble watchlist/portfolio universe and compute trading signals."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence

from data_provider import DataFetcherManager
from data_provider.base import normalize_stock_code
from src.services.trading_signal_service import (
    PortfolioSnapshot,
    TradingSignalResult,
    compute_signals,
)

logger = logging.getLogger(__name__)


def _bars_from_dataframe(df) -> List[Dict[str, float]]:
    if df is None or getattr(df, "empty", True):
        return []
    rows: List[Dict[str, float]] = []
    # Accept both Chinese and English column names used across fetchers.
    colmap = {
        "open": ("open", "开盘", "Open"),
        "close": ("close", "收盘", "Close"),
        "high": ("high", "最高", "High"),
        "low": ("low", "最低", "Low"),
        "volume": ("volume", "成交量", "Volume"),
    }
    resolved = {}
    columns = {str(c): c for c in df.columns}
    lower_map = {str(c).lower(): c for c in df.columns}
    for key, aliases in colmap.items():
        for alias in aliases:
            if alias in columns:
                resolved[key] = columns[alias]
                break
            if alias.lower() in lower_map:
                resolved[key] = lower_map[alias.lower()]
                break
    if "close" not in resolved:
        return []
    for _, row in df.iterrows():
        item = {}
        for key, col in resolved.items():
            try:
                item[key] = float(row[col])
            except (TypeError, ValueError):
                item[key] = 0.0
        for key in ("open", "high", "low", "volume"):
            item.setdefault(key, item.get("close", 0.0) if key != "volume" else 0.0)
        rows.append(item)
    return rows


def _portfolio_snapshots_from_payload(snapshot: Optional[Dict[str, Any]]) -> Dict[str, PortfolioSnapshot]:
    """Build per-code PortfolioSnapshot from PortfolioService.get_portfolio_snapshot()."""
    out: Dict[str, PortfolioSnapshot] = {}
    if not isinstance(snapshot, dict):
        return out

    accounts = snapshot.get("accounts")
    if not isinstance(accounts, list):
        # Some callers may pass a single account public payload.
        if isinstance(snapshot.get("positions"), list):
            accounts = [snapshot]
        else:
            accounts = []

    for account in accounts:
        if not isinstance(account, dict):
            continue
        positions = account.get("positions") or []
        total_equity = float(account.get("total_equity") or 0.0)
        for pos in positions:
            if not isinstance(pos, dict):
                continue
            raw_code = str(pos.get("symbol") or pos.get("code") or "").strip()
            code = normalize_stock_code(raw_code)
            if not code:
                continue
            qty = float(pos.get("quantity") or pos.get("qty") or 0.0)
            if qty <= 0:
                continue
            market_value = float(pos.get("market_value") or pos.get("marketValue") or 0.0)
            weight = (market_value / total_equity * 100.0) if total_equity > 0 and market_value > 0 else 0.0
            cost = pos.get("avg_cost")
            if cost is None:
                cost = pos.get("cost")
            try:
                cost_f = float(cost) if cost is not None else None
            except (TypeError, ValueError):
                cost_f = None
            out[code] = PortfolioSnapshot(
                code=code,
                weight=weight,
                cost=cost_f,
                quantity=qty,
                monitor_quantity=qty,
                frozen=float(pos.get("frozen") or 0.0),
                cost_warning=bool(pos.get("cost_warning") or False),
                asset_type=str(pos.get("asset_type") or "A股"),
            )
    return out


class TradingSignalMonitor:
    """Fetch shared quotes/bars and compute signals for a code universe."""

    def __init__(self, data_manager: Optional[DataFetcherManager] = None):
        self.data_manager = data_manager or DataFetcherManager()

    def compute_for_codes(
        self,
        codes: Sequence[str],
        *,
        portfolio_by_code: Optional[Dict[str, PortfolioSnapshot]] = None,
        include_bars: bool = True,
    ) -> Dict[str, Any]:
        normalized: List[str] = []
        seen = set()
        for raw in codes or []:
            code = normalize_stock_code((raw or "").strip())
            if not code or code in seen:
                continue
            # M1: A-share / ETF numeric codes only for tencent batch path.
            if not code.isdigit() or len(code) != 6:
                continue
            seen.add(code)
            normalized.append(code)

        quotes = self.data_manager.get_realtime_quotes(normalized) if normalized else {}
        portfolio_by_code = portfolio_by_code or {}
        items: List[Dict[str, Any]] = []
        errors: List[Dict[str, str]] = []

        for code in normalized:
            quote = quotes.get(code)
            if quote is None:
                errors.append({"code": code, "error": "quote_unavailable"})
                continue
            bars: List[Dict[str, float]] = []
            if include_bars:
                try:
                    df = self.data_manager.get_daily_data(code, days=90)
                    bars = _bars_from_dataframe(df)
                except Exception as exc:
                    logger.info("daily bars unavailable for %s: %s", code, type(exc).__name__)
                    errors.append({"code": code, "error": f"bars_unavailable:{type(exc).__name__}"})
            result = compute_signals(
                quote=quote,
                bars=bars,
                portfolio=portfolio_by_code.get(code),
                code=code,
            )
            items.append(
                {
                    "code": code,
                    "name": getattr(quote, "name", "") or "",
                    "price": getattr(quote, "price", None),
                    "change_pct": getattr(quote, "change_pct", None),
                    "quote_source": getattr(getattr(quote, "source", None), "value", getattr(quote, "source", None)),
                    **result.to_dict(),
                }
            )

        return {
            "count": len(items),
            "items": items,
            "errors": errors,
        }


def portfolio_snapshots_from_service_payload(snapshot: Optional[Dict[str, Any]]) -> Dict[str, PortfolioSnapshot]:
    return _portfolio_snapshots_from_payload(snapshot)
