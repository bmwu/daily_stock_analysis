# -*- coding: utf-8 -*-
"""Market radar overview + chart assembly (M2)."""

from __future__ import annotations

import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import requests

from data_provider import DataFetcherManager
from data_provider.akshare_fetcher import USER_AGENTS
from data_provider.base import normalize_stock_code
from src.services.stock_list_parser import split_stock_list
from src.services.trading_signal_monitor import (
    TradingSignalMonitor,
    fetch_tencent_daily_bars,
    portfolio_snapshots_from_service_payload,
)

logger = logging.getLogger(__name__)

CN_TZ = timezone(timedelta(hours=8))

INDEX_META = [
    {"code": "000001", "name": "上证指数", "symbol": "sh000001"},
    {"code": "399001", "name": "深证成指", "symbol": "sz399001"},
    {"code": "399006", "name": "创业板指", "symbol": "sz399006"},
]


def _now_iso() -> str:
    return datetime.now(CN_TZ).isoformat(timespec="seconds")


def _quote_time_to_iso(value: Optional[str]) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) >= 14:
        return (
            f"{digits[0:4]}-{digits[4:6]}-{digits[6:8]}T"
            f"{digits[8:10]}:{digits[10:12]}:{digits[12:14]}+08:00"
        )
    return _now_iso()


def _listed_symbol(code: str) -> str:
    code = (code or "").strip()
    if code.startswith(("5", "6", "9")):
        return f"sh{code}"
    return f"sz{code}"


class MarketRadarService:
    def __init__(self, data_manager: Optional[DataFetcherManager] = None):
        self.data_manager = data_manager or DataFetcherManager()
        self.monitor = TradingSignalMonitor(data_manager=self.data_manager)

    def build_overview(self) -> Dict[str, Any]:
        errors: List[Dict[str, str]] = []
        indices = self._load_indices(errors)
        portfolio_by_code, account = self._load_portfolio(errors)
        watchlist_codes = self._load_watchlist(errors)

        holding_codes = [
            code for code in portfolio_by_code.keys()
            if code.isdigit() and len(code) == 6
        ]
        watch_codes = []
        seen_watch = set()
        for raw in watchlist_codes:
            code = normalize_stock_code(raw)
            if not code.isdigit() or len(code) != 6 or code in seen_watch:
                continue
            seen_watch.add(code)
            watch_codes.append(code)
        # One batch quote + parallel bars for union(holdings, watchlist).
        union_codes = list(dict.fromkeys([*holding_codes, *watch_codes]))
        payload = self.monitor.compute_for_codes(
            union_codes,
            portfolio_by_code=portfolio_by_code,
            include_bars=True,
        )
        by_code = {
            str(item.get("code")): item
            for item in (payload.get("items") or [])
            if isinstance(item, dict) and item.get("code")
        }
        for err in payload.get("errors") or []:
            if isinstance(err, dict):
                errors.append(err)

        return {
            "updated_at": _now_iso(),
            "provider": "tencent/shared-data-provider",
            "indices": indices,
            "account": account,
            "holdings": [by_code[c] for c in holding_codes if c in by_code],
            "watchlist": [by_code[c] for c in watch_codes if c in by_code],
            "errors": errors,
        }

    def build_chart(self, code: str, mode: str = "intraday") -> Dict[str, Any]:
        normalized = normalize_stock_code((code or "").strip())
        if not normalized.isdigit() or len(normalized) != 6:
            raise ValueError("仅支持 6 位 A 股/ETF 代码的分时与 K 线")

        mode_norm = (mode or "intraday").strip().lower()
        if mode_norm not in {"intraday", "kline", "both"}:
            raise ValueError("mode must be intraday|kline|both")

        symbol = _listed_symbol(normalized)
        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Referer": "https://gu.qq.com/",
            "Accept": "application/json,text/plain,*/*",
        }

        intraday: List[Dict[str, Any]] = []
        candles: List[Dict[str, Any]] = []
        previous_close = 0.0
        current_price = 0.0
        date_text = ""
        updated_at = _now_iso()

        if mode_norm in {"intraday", "both"}:
            try:
                minute_url = f"https://web.ifzq.gtimg.cn/appstock/app/minute/query?code={symbol}"
                minute_json = requests.get(minute_url, headers=headers, timeout=5).json()
                minute_node = (minute_json.get("data") or {}).get(symbol) or {}
                quote_row = ((minute_node.get("qt") or {}).get(symbol) or [])
                date_text = str(((minute_node.get("data") or {}).get("date")) or "")
                if len(quote_row) > 4:
                    try:
                        previous_close = float(quote_row[4])
                    except (TypeError, ValueError):
                        previous_close = 0.0
                if len(quote_row) > 3:
                    try:
                        current_price = float(quote_row[3])
                    except (TypeError, ValueError):
                        current_price = 0.0
                if len(quote_row) > 30:
                    updated_at = _quote_time_to_iso(quote_row[30])

                previous_cumulative_volume = 0.0
                for row in ((minute_node.get("data") or {}).get("data") or []):
                    parts = str(row).strip().split()
                    if len(parts) < 3:
                        continue
                    time_raw, price_text, volume_text = parts[0], parts[1], parts[2]
                    amount_text = parts[3] if len(parts) > 3 else "0"
                    try:
                        price = float(price_text)
                        cumulative_volume = float(volume_text)
                        amount = float(amount_text)
                    except (TypeError, ValueError):
                        continue
                    volume = max(0.0, cumulative_volume - previous_cumulative_volume)
                    previous_cumulative_volume = cumulative_volume
                    average = (
                        amount / cumulative_volume / 100.0
                        if cumulative_volume > 0 and amount > 0
                        else price
                    )
                    t = time_raw
                    if len(t) >= 4 and ":" not in t:
                        t = f"{t[0:2]}:{t[2:4]}"
                    intraday.append(
                        {
                            "time": t,
                            "price": price,
                            "average": average,
                            "volume": volume,
                            "amount": amount,
                        }
                    )
                if not current_price and intraday:
                    current_price = float(intraday[-1]["price"])
            except Exception as exc:
                logger.info("market radar intraday failed for %s: %s", normalized, type(exc).__name__)

        if mode_norm in {"kline", "both"}:
            try:
                # Fast path: direct Tencent fq kline (same as 持仓雷达).
                bars = fetch_tencent_daily_bars(normalized, days=180, timeout=5.0)
                for bar in bars[-120:]:
                    candles.append(
                        {
                            "date": str(bar.get("date") or "")[:10],
                            "open": bar.get("open"),
                            "close": bar.get("close"),
                            "high": bar.get("high"),
                            "low": bar.get("low"),
                            "volume": bar.get("volume"),
                            "main_net_flow": None,
                            "large_net_flow": None,
                            "super_large_net_flow": None,
                        }
                    )
                if not previous_close and len(candles) >= 2:
                    previous_close = float(candles[-2]["close"] or 0)
                if not current_price and candles:
                    current_price = float(candles[-1]["close"] or 0)
            except Exception as exc:
                logger.info("market radar kline failed for %s: %s", normalized, type(exc).__name__)

        return {
            "code": normalized,
            "date": date_text,
            "previous_close": previous_close,
            "current_price": current_price,
            "updated_at": updated_at,
            "intraday": intraday if mode_norm in {"intraday", "both"} else [],
            "candles": candles if mode_norm in {"kline", "both"} else [],
            "provider": "tencent/shared-data-provider",
            "mode": mode_norm,
        }

    def _load_indices(self, errors: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        # Prefer Tencent batch (fast, same as 持仓雷达); skip slow multi-source index chain.
        try:
            from data_provider.akshare_fetcher import TENCENT_REALTIME_ENDPOINT

            symbols = [item["symbol"] for item in INDEX_META]
            url = f"http://{TENCENT_REALTIME_ENDPOINT}={','.join(symbols)}"
            headers = {
                "Referer": "http://finance.qq.com",
                "User-Agent": random.choice(USER_AGENTS),
            }
            response = requests.get(url, headers=headers, timeout=5)
            response.encoding = "gbk"
            content = response.text
            results = []
            for meta in INDEX_META:
                marker = f'v_{meta["symbol"]}="'
                start = content.find(marker)
                if start < 0:
                    continue
                start += len(marker)
                end = content.find('"', start)
                if end < 0:
                    continue
                fields = content[start:end].split("~")
                if len(fields) < 33:
                    continue
                try:
                    price = float(fields[3])
                    change_pct = float(fields[32]) if fields[32] else 0.0
                    change = float(fields[31]) if len(fields) > 31 and fields[31] else None
                except (TypeError, ValueError):
                    continue
                results.append(
                    {
                        "code": meta["code"],
                        "name": fields[1] or meta["name"],
                        "price": price,
                        "change_pct": change_pct,
                        "change": change,
                        "amount": None,
                    }
                )
            if results:
                return results
        except Exception as exc:
            errors.append({"code": "indices", "error": f"tencent_indices:{type(exc).__name__}"})

        try:
            rows = self.data_manager.get_main_indices(region="cn") or []
            normalized = []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                normalized.append(
                    {
                        "code": str(row.get("code") or row.get("symbol") or ""),
                        "name": str(row.get("name") or ""),
                        "price": row.get("price") or row.get("close") or row.get("latest"),
                        "change_pct": row.get("change_pct") or row.get("change_percent"),
                        "change": row.get("change") or row.get("change_amount"),
                        "amount": row.get("amount"),
                    }
                )
            return normalized[:6]
        except Exception as exc:
            errors.append({"code": "indices", "error": f"main_indices:{type(exc).__name__}"})
            return []

    def _load_watchlist(self, errors: List[Dict[str, str]]) -> List[str]:
        try:
            from src.services.system_config_service import SystemConfigService

            service = SystemConfigService()
            config_data = service.get_config(include_schema=False)
            stock_list_str = ""
            for item in config_data.get("items", []):
                if item.get("key") == "STOCK_LIST":
                    stock_list_str = str(item.get("value", ""))
                    break
            return split_stock_list(stock_list_str)
        except Exception as exc:
            errors.append({"code": "watchlist", "error": type(exc).__name__})
            return []

    def _load_portfolio(self, errors: List[Dict[str, str]]):
        try:
            from src.services.portfolio_service import PortfolioService

            snapshot = PortfolioService().get_portfolio_snapshot(include_realtime=False)
            portfolio_by_code = portfolio_snapshots_from_service_payload(snapshot)
            account = {
                "cash": snapshot.get("total_cash"),
                "total_asset": snapshot.get("total_equity"),
                "market_value": snapshot.get("total_market_value"),
                "unrealized_pnl": snapshot.get("unrealized_pnl"),
                "realized_pnl": snapshot.get("realized_pnl"),
                "daily_profit": snapshot.get("daily_pnl") or snapshot.get("daily_profit"),
                "total_profit": snapshot.get("unrealized_pnl"),
                "currency": snapshot.get("currency"),
                "account_count": snapshot.get("account_count"),
            }
            return portfolio_by_code, account
        except Exception as exc:
            errors.append({"code": "portfolio", "error": type(exc).__name__})
            return {}, None
