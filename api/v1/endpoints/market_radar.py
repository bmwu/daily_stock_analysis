# -*- coding: utf-8 -*-
"""Market radar API endpoints (M2)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Security
from fastapi.security import APIKeyCookie

from api.v1.schemas.common import ErrorResponse
from src.auth import COOKIE_NAME
from src.config import get_config
from src.services.market_radar_service import MarketRadarService

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


def _require_enabled() -> None:
    config = get_config()
    if not bool(getattr(config, "enable_trading_signals", False)):
        raise HTTPException(
            status_code=503,
            detail={
                "error": "trading_signals_disabled",
                "message": "Market radar disabled. Set ENABLE_TRADING_SIGNALS=true.",
            },
        )


@router.get(
    "/overview",
    responses={**AUTH_RESPONSE},
    summary="Market radar overview (indices + holdings/watchlist signals)",
)
def market_radar_overview() -> dict:
    _require_enabled()
    try:
        return MarketRadarService().build_overview()
    except Exception as exc:
        logger.error("market radar overview failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "market radar overview failed"},
        ) from exc


@router.get(
    "/chart",
    responses={**AUTH_RESPONSE},
    summary="Market radar chart (intraday or kline)",
)
def market_radar_chart(
    code: str = Query(..., min_length=4, max_length=16),
    mode: str = Query("intraday"),
) -> dict:
    _require_enabled()
    try:
        return MarketRadarService().build_chart(code=code, mode=mode)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "validation_error", "message": str(exc)},
        ) from exc
    except Exception as exc:
        logger.error("market radar chart failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "market radar chart failed"},
        ) from exc
