# -*- coding: utf-8 -*-
"""Trading signal / discipline-rule API endpoints (M1)."""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Security
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, Field

from api.v1.schemas.common import ErrorResponse
from src.auth import COOKIE_NAME
from src.config import get_config
from src.services.system_config_service import SystemConfigService
from src.services.trading_signal_monitor import (
    TradingSignalMonitor,
    portfolio_snapshots_from_service_payload,
)
from src.services.trading_signal_notifier import notify_trading_signals
from src.services.trading_signal_rules import SIGNAL_COLOR_MEANINGS, list_rules
from src.services.stock_list_parser import split_stock_list

logger = logging.getLogger(__name__)

admin_session_cookie = APIKeyCookie(
    name=COOKIE_NAME,
    scheme_name="AdminSessionCookie",
    auto_error=False,
)
router = APIRouter(dependencies=[Security(admin_session_cookie)])

AUTH_RESPONSE = {
    401: {
        "model": ErrorResponse,
        "description": "未登录或管理员会话无效（ADMIN_AUTH_ENABLED=true 时）",
    },
}


class TradingSignalComputeRequest(BaseModel):
    codes: List[str] = Field(default_factory=list, description="显式股票代码列表")
    source: Optional[str] = Field(
        default=None,
        description="可选宇宙：watchlist | portfolio（可与 codes 合并）",
    )
    notify: bool = Field(default=False, description="是否对 green/orange 发送通知")
    include_bars: bool = Field(default=True, description="是否拉取日K用于信号计算")


class TradingSignalRulesResponse(BaseModel):
    count: int
    color_meanings: dict
    rules: list


def _feature_enabled() -> bool:
    config = get_config()
    return bool(getattr(config, "enable_trading_signals", False))


def _require_enabled() -> None:
    if not _feature_enabled():
        raise HTTPException(
            status_code=503,
            detail={
                "error": "trading_signals_disabled",
                "message": "Trading signals disabled. Set ENABLE_TRADING_SIGNALS=true.",
            },
        )


def _read_watchlist_codes() -> List[str]:
    service = SystemConfigService()
    config_data = service.get_config(include_schema=False)
    stock_list_str = ""
    for item in config_data.get("items", []):
        if item.get("key") == "STOCK_LIST":
            stock_list_str = str(item.get("value", ""))
            break
    return split_stock_list(stock_list_str)


def _load_portfolio_maps():
    try:
        from src.services.portfolio_service import PortfolioService

        snapshot = PortfolioService().get_portfolio_snapshot(include_realtime=False)
        return portfolio_snapshots_from_service_payload(snapshot), snapshot
    except Exception as exc:
        logger.info("portfolio snapshot unavailable for trading signals: %s", type(exc).__name__)
        return {}, None


@router.get(
    "/rules",
    response_model=TradingSignalRulesResponse,
    responses={**AUTH_RESPONSE},
    summary="List discipline rules R1-R77",
)
def get_trading_signal_rules() -> TradingSignalRulesResponse:
    rules = list_rules()
    return TradingSignalRulesResponse(
        count=len(rules),
        color_meanings=dict(SIGNAL_COLOR_MEANINGS),
        rules=rules,
    )


@router.post(
    "/compute",
    responses={**AUTH_RESPONSE},
    summary="Compute four-color trading signals",
)
def compute_trading_signals(request: TradingSignalComputeRequest) -> dict:
    _require_enabled()

    codes = list(request.codes or [])
    portfolio_by_code = {}
    source = (request.source or "").strip().lower()

    if source == "watchlist":
        codes.extend(_read_watchlist_codes())
    elif source == "portfolio":
        portfolio_by_code, _ = _load_portfolio_maps()
        codes.extend(portfolio_by_code.keys())
    elif source:
        raise HTTPException(
            status_code=400,
            detail={"error": "validation_error", "message": "source must be watchlist|portfolio"},
        )

    # If codes were provided without source=portfolio, still attach portfolio context when available.
    if not portfolio_by_code:
        portfolio_by_code, _ = _load_portfolio_maps()

    if not codes:
        raise HTTPException(
            status_code=400,
            detail={"error": "validation_error", "message": "codes or source is required"},
        )

    monitor = TradingSignalMonitor()
    result = monitor.compute_for_codes(
        codes,
        portfolio_by_code=portfolio_by_code,
        include_bars=request.include_bars,
    )

    notify_result = None
    config = get_config()
    if request.notify and getattr(config, "trading_signal_notify_enabled", True):
        notify_result = notify_trading_signals(
            items=result.get("items") or [],
            enabled=True,
            cooldown_seconds=int(getattr(config, "trading_signal_notify_cooldown_seconds", 1800) or 1800),
        )
    result["notify"] = notify_result
    result["enabled"] = True
    return result


@router.get(
    "/latest",
    responses={**AUTH_RESPONSE},
    summary="Compute signals for current watchlist (on-demand latest)",
)
def latest_trading_signals(notify: bool = False) -> dict:
    """M1: no persistent event store; equivalent to compute(source=watchlist)."""
    return compute_trading_signals(
        TradingSignalComputeRequest(source="watchlist", notify=notify, include_bars=True)
    )
