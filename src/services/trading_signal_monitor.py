# -*- coding: utf-8 -*-
"""Assemble watchlist/portfolio universe and compute trading signals."""

from __future__ import annotations

import logging
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Sequence

import requests

from data_provider import DataFetcherManager
from data_provider.akshare_fetcher import USER_AGENTS
from data_provider.base import normalize_stock_code
from src.services.trading_signal_service import (
    PortfolioSnapshot,
    compute_signals,
)

logger = logging.getLogger(__name__)


def _bars_from_dataframe(df) -> List[Dict[str, float]]:
    if df is None or getattr(df, "empty", True):
        return []
    rows: List[Dict[str, float]] = []
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


def _listed_symbol(code: str) -> str:
    code = (code or "").strip()
    if code.startswith(("5", "6", "9")):
        return f"sh{code}"
    return f"sz{code}"


def fetch_tencent_daily_bars(code: str, *, days: int = 90, timeout: float = 5.0) -> List[Dict[str, float]]:
    """Fast path: direct Tencent fq kline (same source as 持仓雷达 getBars)."""
    symbol = _listed_symbol(code)
    url = (
        "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
        f"?param={symbol},day,,,{max(30, int(days))},qfq"
    )
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Referer": "https://gu.qq.com/",
        "Accept": "application/json,text/plain,*/*",
    }
    response = requests.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    node = (payload.get("data") or {}).get(symbol) or {}
    raw = node.get("qfqday") or node.get("day") or []
    rows: List[Dict[str, float]] = []
    for row in raw:
        if not isinstance(row, (list, tuple)) or len(row) < 6:
            continue
        try:
            rows.append(
                {
                    "date": str(row[0]),
                    "open": float(row[1]),
                    "close": float(row[2]),
                    "high": float(row[3]),
                    "low": float(row[4]),
                    "volume": float(row[5]),
                }
            )
        except (TypeError, ValueError):
            continue
    return rows


def _portfolio_snapshots_from_payload(snapshot: Optional[Dict[str, Any]]) -> Dict[str, PortfolioSnapshot]:
    """Build per-code PortfolioSnapshot from PortfolioService.get_portfolio_snapshot()."""
    out: Dict[str, PortfolioSnapshot] = {}
    if not isinstance(snapshot, dict):
        return out

    accounts = snapshot.get("accounts")
    if not isinstance(accounts, list):
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

    def _load_bars_map(self, codes: Sequence[str]) -> Dict[str, List[Dict[str, float]]]:
        """Parallel Tencent daily bars; skip slow multi-source daily failover on overview path."""
        if not codes:
            return {}
        results: Dict[str, List[Dict[str, float]]] = {}
        workers = min(8, max(1, len(codes)))

        def _one(code: str):
            try:
                return code, fetch_tencent_daily_bars(code, days=90, timeout=5.0)
            except Exception as exc:
                logger.info("tencent bars unavailable for %s: %s", code, type(exc).__name__)
                return code, []

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_one, code) for code in codes]
            for fut in as_completed(futures):
                code, bars = fut.result()
                results[code] = bars
        return results

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
            if not code.isdigit() or len(code) != 6:
                continue
            seen.add(code)
            normalized.append(code)

        quotes = self.data_manager.get_realtime_quotes(normalized) if normalized else {}
        portfolio_by_code = portfolio_by_code or {}
        bars_map = self._load_bars_map(normalized) if include_bars else {}
        items: List[Dict[str, Any]] = []
        errors: List[Dict[str, str]] = []

        for code in normalized:
            quote = quotes.get(code)
            if quote is None:
                errors.append({"code": code, "error": "quote_unavailable"})
                continue
            bars = bars_map.get(code) or []
            if include_bars and not bars:
                errors.append({"code": code, "error": "bars_unavailable"})
            result = compute_signals(
                quote=quote,
                bars=bars,
                portfolio=portfolio_by_code.get(code),
                code=code,
            )
            port = portfolio_by_code.get(code)
            price = getattr(quote, "price", None)
            try:
                price_f = float(price) if price is not None else None
            except (TypeError, ValueError):
                price_f = None
            cost = getattr(port, "cost", None) if port else None
            qty = float(getattr(port, "quantity", 0) or 0) if port else 0.0
            market_value = (price_f * qty) if price_f is not None and qty else None
            profit = None
            profit_percent = None
            if price_f is not None and cost is not None and qty:
                try:
                    cost_f = float(cost)
                    profit = (price_f - cost_f) * qty
                    profit_percent = ((price_f / cost_f) - 1.0) * 100.0 if cost_f else None
                except (TypeError, ValueError, ZeroDivisionError):
                    profit = None
                    profit_percent = None
            if result.up_trend:
                trend = "up"
            elif result.down_trend:
                trend = "down"
            else:
                trend = "mixed"
            items.append(
                {
                    "code": code,
                    "name": getattr(quote, "name", "") or "",
                    "asset_type": getattr(port, "asset_type", None) if port else "A股",
                    "price": price_f,
                    "change_pct": getattr(quote, "change_pct", None),
                    "change": getattr(quote, "change_amount", None) or getattr(quote, "change", None),
                    "open": getattr(quote, "open_price", None) or getattr(quote, "open", None),
                    "high": getattr(quote, "high", None),
                    "low": getattr(quote, "low", None),
                    "previous_close": getattr(quote, "pre_close", None) or getattr(quote, "previous_close", None),
                    "volume": getattr(quote, "volume", None),
                    "amount": getattr(quote, "amount", None),
                    "turnover": getattr(quote, "turnover_rate", None) or getattr(quote, "turnover", None),
                    "market_value": market_value,
                    "quantity": qty or None,
                    "baseline_weight": getattr(port, "weight", None) if port else None,
                    "profit": profit,
                    "profit_percent": profit_percent,
                    "trend": trend,
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
