# -*- coding: utf-8 -*-
"""Notify on green/orange trading signals (opt-in, fail-open)."""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Simple in-process cooldown: (code, level, title) -> last_sent_ts
_COOLDOWN: Dict[Tuple[str, str, str], float] = {}
_DEFAULT_COOLDOWN_SECONDS = 1800


def _should_notify(level: str) -> bool:
    return level in {"green", "orange"}


def notify_trading_signals(
    *,
    items: Iterable[Dict[str, Any]],
    notification_service: Any = None,
    cooldown_seconds: int = _DEFAULT_COOLDOWN_SECONDS,
    enabled: bool = True,
) -> Dict[str, Any]:
    """
    Send alert-route notifications for green/orange signals.

    Channel failures never raise to callers.
    """
    if not enabled:
        return {"sent": 0, "skipped": 0, "errors": 0}

    if notification_service is None:
        try:
            from src.notification import NotificationService
            from src.config import get_config

            notification_service = NotificationService(get_config())
        except Exception as exc:
            logger.warning("Trading signal notifier init failed: %s", type(exc).__name__)
            return {"sent": 0, "skipped": 0, "errors": 1}

    sent = 0
    skipped = 0
    errors = 0
    now = time.time()
    cooldown = max(0, int(cooldown_seconds or 0))

    for item in items or []:
        code = str(item.get("code") or "")
        name = str(item.get("name") or code)
        signals = item.get("signals") or []
        for signal in signals:
            if not isinstance(signal, dict):
                continue
            level = str(signal.get("level") or "")
            if not _should_notify(level):
                skipped += 1
                continue
            title = str(signal.get("title") or "")
            key = (code, level, title)
            last = _COOLDOWN.get(key)
            if last is not None and cooldown > 0 and (now - last) < cooldown:
                skipped += 1
                continue
            detail = str(signal.get("detail") or "")
            rule = str(signal.get("rule") or "")
            text = (
                f"【盯盘信号-{level.upper()}】{name}({code})\n"
                f"{title}\n"
                f"{detail}\n"
                f"规则: {rule}"
            )
            try:
                ok = notification_service.send(text, route_type="alert")
                if ok:
                    _COOLDOWN[key] = now
                    sent += 1
                else:
                    errors += 1
            except Exception as exc:
                errors += 1
                logger.warning(
                    "Trading signal notify failed code=%s level=%s error=%s",
                    code,
                    level,
                    type(exc).__name__,
                )
    return {"sent": sent, "skipped": skipped, "errors": errors}
