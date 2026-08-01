# -*- coding: utf-8 -*-
"""Market radar overview + chart assembly (M2)."""

from __future__ import annotations

import logging
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import requests

from data_provider import DataFetcherManager
from data_provider.akshare_fetcher import USER_AGENTS, _parse_tencent_amount
from data_provider.base import normalize_stock_code
from src.services.stock_list_parser import split_stock_list
from src.services.trading_signal_monitor import (
    TradingSignalMonitor,
    fetch_daily_bars_for_code,
    fetch_tencent_daily_bars,
    portfolio_snapshots_from_service_payload,
)

logger = logging.getLogger(__name__)

CN_TZ = timezone(timedelta(hours=8))
_INDEX_QUOTE_CACHE: Dict[str, Any] = {"at": 0.0, "rows": [], "errors": []}
_INDEX_QUOTE_CACHE_TTL_SECONDS = 60.0

# Static catalog for Market Radar index strip + “更多” drawer.
# ``tencent_symbol`` enables fast CN batch quotes; other regions use get_main_indices.
INDEX_CATALOG: List[Dict[str, str]] = [
    {"code": "000001", "name": "上证指数", "region": "cn", "tencent_symbol": "sh000001"},
    {"code": "399001", "name": "深证成指", "region": "cn", "tencent_symbol": "sz399001"},
    {"code": "399006", "name": "创业板指", "region": "cn", "tencent_symbol": "sz399006"},
    {"code": "000688", "name": "科创50", "region": "cn", "tencent_symbol": "sh000688"},
    {"code": "000016", "name": "上证50", "region": "cn", "tencent_symbol": "sh000016"},
    {"code": "000300", "name": "沪深300", "region": "cn", "tencent_symbol": "sh000300"},
    {"code": "HSI", "name": "恒生指数", "region": "hk"},
    {"code": "HSTECH", "name": "恒生科技指数", "region": "hk"},
    {"code": "HSCEI", "name": "国企指数", "region": "hk"},
    {"code": "SPX", "name": "标普500", "region": "us"},
    {"code": "IXIC", "name": "纳斯达克", "region": "us"},
    {"code": "DJI", "name": "道琼斯", "region": "us"},
    {"code": "N225", "name": "日经225", "region": "jp"},
    {"code": "TOPX", "name": "东证指数", "region": "jp"},
    {"code": "KS11", "name": "KOSPI", "region": "kr"},
    {"code": "KQ11", "name": "KOSDAQ", "region": "kr"},
    {"code": "TWII", "name": "台湾加权", "region": "tw"},
]

# Backward-compatible alias used by older CN-only Tencent path.
INDEX_META = [
    {
        "code": item["code"],
        "name": item["name"],
        "symbol": item.get("tencent_symbol") or "",
    }
    for item in INDEX_CATALOG
    if item.get("region") == "cn" and item.get("tencent_symbol")
]

DEFAULT_FAVORITE_INDEX_CODES = ["000001", "399001", "399006"]


def index_catalog_payload() -> List[Dict[str, str]]:
    return [
        {"code": item["code"], "name": item["name"], "region": item["region"]}
        for item in INDEX_CATALOG
    ]


def _index_code_aliases(code: str) -> set[str]:
    raw = (code or "").strip()
    if not raw:
        return set()
    aliases = {raw, raw.upper(), raw.lower()}
    if raw.lower().startswith(("sh", "sz")) and len(raw) > 2:
        aliases.add(raw[2:])
        aliases.add(raw[2:].upper())
    return aliases


def _coerce_index_amount(value: Any) -> Optional[float]:
    """Index amount for display; treat missing/non-positive as unavailable."""
    if value is None:
        return None
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if amount != amount or amount <= 0:  # NaN or non-positive
        return None
    return amount


def _normalize_index_quote(
    *,
    code: str,
    name: str,
    region: str,
    row: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload = row if isinstance(row, dict) else {}
    return {
        "code": code,
        "name": str(payload.get("name") or name),
        "region": region,
        "price": payload.get("price")
        if payload.get("price") is not None
        else payload.get("current")
        if payload.get("current") is not None
        else payload.get("close")
        if payload.get("close") is not None
        else payload.get("latest"),
        "change_pct": payload.get("change_pct")
        if payload.get("change_pct") is not None
        else payload.get("change_percent"),
        "change": payload.get("change")
        if payload.get("change") is not None
        else payload.get("change_amount"),
        "amount": _coerce_index_amount(payload.get("amount")),
    }


def _merge_index_quote(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    """Prefer existing filled fields; fill gaps (esp. amount) from incoming."""
    merged = dict(existing)
    for key in ("name", "price", "change_pct", "change", "amount"):
        if merged.get(key) is None and incoming.get(key) is not None:
            merged[key] = incoming[key]
        elif key == "name" and incoming.get("name") and merged.get("name") in (None, "", merged.get("code")):
            merged[key] = incoming["name"]
    return merged


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



def _unsupported_watchlist_item(code: str, reason: str) -> Dict[str, Any]:
    """Keep non-quotable watchlist symbols visible in Market Radar lists."""
    return {
        "code": code,
        "name": code,
        "asset_type": "other",
        "price": None,
        "change_pct": None,
        "change": None,
        "open": None,
        "high": None,
        "low": None,
        "previous_close": None,
        "volume": None,
        "amount": None,
        "turnover": None,
        "signals": [],
        "quote_source": reason,
        "signals_available": False,
        "signals_unavailable_reason": reason,
        "trend": "mixed",
        "up_trend": False,
        "down_trend": False,
    }


class MarketRadarService:
    def __init__(self, data_manager: Optional[DataFetcherManager] = None):
        self.data_manager = data_manager or DataFetcherManager()
        self.monitor = TradingSignalMonitor(data_manager=self.data_manager)

    def build_overview(self) -> Dict[str, Any]:
        errors: List[Dict[str, str]] = []
        index_errors: List[Dict[str, str]] = []
        portfolio_by_code, account = self._load_portfolio(errors)
        watchlist_codes = self._load_watchlist(errors)

        holding_codes: List[str] = []
        seen_holdings = set()
        for code in portfolio_by_code.keys():
            normalized = normalize_stock_code(code)
            if not normalized or normalized in seen_holdings:
                continue
            seen_holdings.add(normalized)
            holding_codes.append(normalized)

        watch_codes: List[str] = []
        seen_watch = set()
        for raw in watchlist_codes:
            code = normalize_stock_code(raw)
            if not code or code in seen_watch:
                continue
            seen_watch.add(code)
            watch_codes.append(code)

        # Quotes + bars for the full holdings/watchlist universe (all markets).
        union_codes = list(dict.fromkeys([*holding_codes, *watch_codes]))

        # Indices and stock universe in parallel — indices must not serialize behind bars.
        with ThreadPoolExecutor(max_workers=2) as pool:
            fut_indices = pool.submit(self._load_indices, index_errors)
            fut_quotes = pool.submit(
                self.monitor.compute_for_codes,
                union_codes,
                portfolio_by_code=portfolio_by_code,
                include_bars=True,
            )
            indices = fut_indices.result()
            payload = fut_quotes.result()

        errors.extend(index_errors)
        by_code = {
            str(item.get("code")): item
            for item in (payload.get("items") or [])
            if isinstance(item, dict) and item.get("code")
        }
        for err in payload.get("errors") or []:
            if isinstance(err, dict):
                errors.append(err)

        def _resolve_list(codes: List[str]) -> List[Dict[str, Any]]:
            rows: List[Dict[str, Any]] = []
            for code in codes:
                item = by_code.get(code)
                if item is not None:
                    rows.append(item)
                else:
                    rows.append(_unsupported_watchlist_item(code, "quote_unavailable"))
            return rows

        return {
            "updated_at": _now_iso(),
            "provider": "tencent/shared-data-provider",
            "indices": indices,
            "index_catalog": index_catalog_payload(),
            "account": account,
            "holdings": _resolve_list(holding_codes),
            "watchlist": _resolve_list(watch_codes),
            "errors": errors,
        }

    def build_chart(self, code: str, mode: str = "intraday") -> Dict[str, Any]:
        normalized = normalize_stock_code((code or "").strip())
        if not normalized:
            raise ValueError("股票代码无效")

        mode_norm = (mode or "intraday").strip().lower()
        if mode_norm not in {"intraday", "kline", "both"}:
            raise ValueError("mode must be intraday|kline|both")

        is_cn = normalized.isdigit() and len(normalized) == 6
        providers: List[str] = []
        degraded: List[str] = []

        intraday: List[Dict[str, Any]] = []
        candles: List[Dict[str, Any]] = []
        previous_close = 0.0
        current_price = 0.0
        date_text = ""
        updated_at = _now_iso()

        if mode_norm in {"intraday", "both"}:
            if is_cn:
                try:
                    symbol = _listed_symbol(normalized)
                    headers = {
                        "User-Agent": random.choice(USER_AGENTS),
                        "Referer": "https://gu.qq.com/",
                        "Accept": "application/json,text/plain,*/*",
                    }
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
                    if intraday:
                        providers.append("tencent_intraday")
                except Exception as exc:
                    logger.info("market radar intraday failed for %s: %s", normalized, type(exc).__name__)
                    degraded.append("intraday_unavailable")
            else:
                degraded.append("intraday_unsupported_market")

        if mode_norm in {"kline", "both"}:
            bars: List[Dict[str, Any]] = []
            if is_cn:
                try:
                    bars = fetch_tencent_daily_bars(normalized, days=180, timeout=5.0)
                    if bars:
                        providers.append("tencent_kline")
                except Exception as exc:
                    logger.info("market radar tencent kline failed for %s: %s", normalized, type(exc).__name__)
            if not bars:
                bars = fetch_daily_bars_for_code(self.data_manager, normalized, days=180)
                if bars:
                    providers.append("daily_data_kline")
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
            if mode_norm in {"kline", "both"} and not candles:
                degraded.append("kline_unavailable")

        if not current_price:
            try:
                quote = self.data_manager.get_realtime_quote(normalized)
                if quote is not None and getattr(quote, "price", None) is not None:
                    current_price = float(quote.price)
                    if not previous_close:
                        prev = getattr(quote, "pre_close", None) or getattr(quote, "previous_close", None)
                        if prev is not None:
                            previous_close = float(prev)
                    providers.append("realtime_quote")
            except Exception as exc:
                logger.info("market radar quote fallback failed for %s: %s", normalized, type(exc).__name__)

        provider = "/".join(providers) if providers else "shared-data-provider"
        if degraded:
            provider = f"{provider}|degraded:{','.join(degraded)}" if providers else f"degraded:{','.join(degraded)}"

        return {
            "code": normalized,
            "date": date_text,
            "previous_close": previous_close,
            "current_price": current_price,
            "updated_at": updated_at,
            "intraday": intraday if mode_norm in {"intraday", "both"} else [],
            "candles": candles if mode_norm in {"kline", "both"} else [],
            "provider": provider,
            "mode": mode_norm,
            "degraded": degraded,
        }

    def _load_indices(self, errors: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """Load quotes for the full index catalog (CN via Tencent, others via get_main_indices)."""
        import time as _time

        now = _time.monotonic()
        cached_at = float(_INDEX_QUOTE_CACHE.get("at") or 0.0)
        if now - cached_at < _INDEX_QUOTE_CACHE_TTL_SECONDS and _INDEX_QUOTE_CACHE.get("rows"):
            for err in _INDEX_QUOTE_CACHE.get("errors") or []:
                if isinstance(err, dict):
                    errors.append(err)
            return list(_INDEX_QUOTE_CACHE["rows"])

        local_errors: List[Dict[str, str]] = []
        by_code: Dict[str, Dict[str, Any]] = {}

        # 1) Fast CN path via Tencent batch.
        cn_items = [item for item in INDEX_CATALOG if item.get("region") == "cn" and item.get("tencent_symbol")]
        if cn_items:
            try:
                from data_provider.akshare_fetcher import TENCENT_REALTIME_ENDPOINT

                symbols = [item["tencent_symbol"] for item in cn_items]
                url = f"http://{TENCENT_REALTIME_ENDPOINT}={','.join(symbols)}"
                headers = {
                    "Referer": "http://finance.qq.com",
                    "User-Agent": random.choice(USER_AGENTS),
                }
                response = requests.get(url, headers=headers, timeout=5)
                response.encoding = "gbk"
                content = response.text
                for meta in cn_items:
                    marker = f'v_{meta["tencent_symbol"]}="'
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
                    by_code[meta["code"]] = _normalize_index_quote(
                        code=meta["code"],
                        name=fields[1] or meta["name"],
                        region="cn",
                        row={
                            "price": price,
                            "change_pct": change_pct,
                            "change": change,
                            "amount": _parse_tencent_amount(fields),
                        },
                    )
            except Exception as exc:
                local_errors.append({"code": "indices", "error": f"tencent_indices:{type(exc).__name__}"})

        # 2) Fill missing codes via get_main_indices (parallel by region).
        # Do NOT re-fetch a region only to backfill amount — that made CN/overseas
        # yfinance/efinance serialize and blow the Web 30s client timeout.
        regions = sorted({item["region"] for item in INDEX_CATALOG})
        regions_needed = [
            region
            for region in regions
            if any(
                item["code"] not in by_code
                for item in INDEX_CATALOG
                if item["region"] == region
            )
        ]

        def _fetch_region(region: str):
            try:
                return region, self.data_manager.get_main_indices(region=region) or [], None
            except Exception as exc:  # noqa: BLE001 — region fail-open
                return region, [], exc

        if regions_needed:
            workers = min(6, len(regions_needed))
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = [pool.submit(_fetch_region, region) for region in regions_needed]
                try:
                    for fut in as_completed(futures, timeout=12.0):
                        region, rows, exc = fut.result()
                        if exc is not None:
                            local_errors.append(
                                {"code": f"indices_{region}", "error": f"main_indices:{type(exc).__name__}"}
                            )
                            continue
                        catalog_in_region = [item for item in INDEX_CATALOG if item["region"] == region]
                        for row in rows:
                            if not isinstance(row, dict):
                                continue
                            raw_code = str(row.get("code") or row.get("symbol") or "").strip()
                            aliases = _index_code_aliases(raw_code)
                            matched = next(
                                (
                                    item
                                    for item in catalog_in_region
                                    if item["code"] in aliases
                                    or bool(aliases & _index_code_aliases(item["code"]))
                                ),
                                None,
                            )
                            if not matched:
                                continue
                            incoming = _normalize_index_quote(
                                code=matched["code"],
                                name=matched["name"],
                                region=matched["region"],
                                row=row,
                            )
                            existing = by_code.get(matched["code"])
                            if existing is None:
                                by_code[matched["code"]] = incoming
                            else:
                                by_code[matched["code"]] = _merge_index_quote(existing, incoming)
                except TimeoutError:
                    local_errors.append({"code": "indices", "error": "main_indices:TimeoutError"})
                    for fut in futures:
                        fut.cancel()

        # Preserve catalog order; include catalog entries even when quote is missing.
        results: List[Dict[str, Any]] = []
        for item in INDEX_CATALOG:
            quoted = by_code.get(item["code"])
            if quoted:
                results.append(quoted)
            else:
                results.append(
                    _normalize_index_quote(
                        code=item["code"],
                        name=item["name"],
                        region=item["region"],
                    )
                )

        _INDEX_QUOTE_CACHE["at"] = now
        _INDEX_QUOTE_CACHE["rows"] = list(results)
        _INDEX_QUOTE_CACHE["errors"] = list(local_errors)
        errors.extend(local_errors)
        return results

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
