# -*- coding: utf-8 -*-
"""Localized copy for alert-center notification messages."""

from __future__ import annotations

from typing import Dict, Optional

from src.report_language import normalize_report_language

_ALERT_NOTIFICATION_LABELS: Dict[str, Dict[str, str]] = {
    "zh": {
        "event_alert_title": "事件告警",
        "rule_label": "规则",
        "triggered_rules_heading": "触发规则",
        "rules_count": "{count} 条规则",
        "alert_triggered_fallback": "告警已触发",
        "reason_with_rule": "{reason}（规则: {rule}）",
    },
    "en": {
        "event_alert_title": "Event Alert",
        "rule_label": "Rule",
        "triggered_rules_heading": "Triggered rules",
        "rules_count": "{count} rules",
        "alert_triggered_fallback": "Alert triggered",
        "reason_with_rule": "{reason} (Rule: {rule})",
    },
    "ko": {
        "event_alert_title": "이벤트 알림",
        "rule_label": "규칙",
        "triggered_rules_heading": "트리거된 규칙",
        "rules_count": "{count}개 규칙",
        "alert_triggered_fallback": "알림이 트리거되었습니다",
        "reason_with_rule": "{reason} (규칙: {rule})",
    },
}


def get_alert_notification_labels(language: Optional[str] = None) -> Dict[str, str]:
    """Return alert notification labels for the resolved report language."""

    normalized = normalize_report_language(language)
    return dict(_ALERT_NOTIFICATION_LABELS[normalized])
