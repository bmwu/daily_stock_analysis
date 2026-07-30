# -*- coding: utf-8 -*-
"""Deterministic four-color trading signal evaluator (port of buildSignals)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Sequence, Union

from src.services.trading_signal_rules import split_rule_ids


Number = Union[int, float]


@dataclass
class PortfolioSnapshot:
    """Optional holding fields used by position-related rules."""

    weight: float = 0.0
    cost: Optional[float] = None
    quantity: float = 0.0
    monitor_quantity: Optional[float] = None
    frozen: float = 0.0
    cost_warning: bool = False
    asset_type: str = "A股"
    code: str = ""


@dataclass
class TradingSignal:
    level: str  # green | orange | blue | red
    rule: str
    title: str
    detail: str

    @property
    def rule_ids(self) -> List[str]:
        return split_rule_ids(self.rule)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["rule_ids"] = self.rule_ids
        return payload


@dataclass
class TradingSignalResult:
    signals: List[TradingSignal] = field(default_factory=list)
    ma5: Optional[float] = None
    ma30: Optional[float] = None
    volume_ratio: Optional[float] = None
    position60: Optional[float] = None
    up_trend: bool = False
    down_trend: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "signals": [item.to_dict() for item in self.signals],
            "ma5": self.ma5,
            "ma30": self.ma30,
            "volume_ratio": self.volume_ratio,
            "position60": self.position60,
            "up_trend": self.up_trend,
            "down_trend": self.down_trend,
        }


def _average(values: Sequence[Number]) -> float:
    if not values:
        return 0.0
    return float(sum(values)) / float(len(values))


def _bar_get(bar: Any, key: str, default: float = 0.0) -> float:
    if isinstance(bar, Mapping):
        value = bar.get(key, default)
    else:
        value = getattr(bar, key, default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _quote_get(quote: Any, *names: str, default: Optional[float] = None) -> Optional[float]:
    for name in names:
        if isinstance(quote, Mapping):
            if name in quote and quote[name] is not None:
                try:
                    return float(quote[name])
                except (TypeError, ValueError):
                    continue
        else:
            value = getattr(quote, name, None)
            if value is not None:
                try:
                    return float(value)
                except (TypeError, ValueError):
                    continue
    return default


def _normalize_bars(bars: Sequence[Any]) -> List[Dict[str, float]]:
    rows: List[Dict[str, float]] = []
    for bar in bars or []:
        rows.append(
            {
                "open": _bar_get(bar, "open"),
                "close": _bar_get(bar, "close"),
                "high": _bar_get(bar, "high"),
                "low": _bar_get(bar, "low"),
                "volume": _bar_get(bar, "volume"),
            }
        )
    return rows


def _asset_type_from_code(code: str) -> str:
    code = (code or "").strip()
    if code.startswith(("5", "15", "16", "588")):
        return "ETF"
    return "A股"


def compute_signals(
    *,
    quote: Any,
    bars: Sequence[Any],
    portfolio: Optional[PortfolioSnapshot] = None,
    code: str = "",
) -> TradingSignalResult:
    """
    Port of 持仓雷达 ``buildSignals``.

    ``quote`` accepts UnifiedRealtimeQuote or a mapping with keys:
    price/f2, change_pct/f3, volume/f5, high/f15, low/f16, open_price/f17, pre_close/f18.
    """
    portfolio = portfolio or PortfolioSnapshot(code=code)
    if not portfolio.code and code:
        portfolio.code = code
    if not portfolio.asset_type:
        portfolio.asset_type = _asset_type_from_code(portfolio.code or code)

    price = _quote_get(quote, "price", "f2", default=0.0) or 0.0
    change_pct = _quote_get(quote, "change_pct", "f3", default=0.0) or 0.0
    volume = _quote_get(quote, "volume", "f5", default=0.0) or 0.0
    high = _quote_get(quote, "high", "f15", default=price) or price
    low = _quote_get(quote, "low", "f16", default=price) or price
    open_price = _quote_get(quote, "open_price", "open", "f17", default=price) or price

    safe_bars = _normalize_bars(bars)
    if not safe_bars:
        safe_bars = [
            {
                "open": open_price,
                "close": price,
                "high": high,
                "low": low,
                "volume": volume,
            }
        ]

    closes = [row["close"] for row in safe_bars]
    volumes = [row["volume"] for row in safe_bars]
    last = safe_bars[-1]

    ma5 = _average(closes[-5:])
    ma30 = _average(closes[-30:])
    previous_ma5 = _average(closes[-6:-1]) if len(closes) >= 6 else ma5
    previous_ma30 = _average(closes[-31:-1]) if len(closes) >= 31 else ma30
    avg_volume20 = _average(volumes[-21:-1]) if len(volumes) >= 2 else 0.0
    volume_ratio = (volume / avg_volume20) if avg_volume20 else 0.0

    prior20 = safe_bars[-21:-1]
    prior20_high = max((row["high"] for row in prior20), default=float("inf"))
    range60 = safe_bars[-60:]
    high60 = max(row["high"] for row in range60)
    low60 = min(row["low"] for row in range60)
    position60 = 50.0 if high60 == low60 else ((price - low60) / (high60 - low60)) * 100.0

    body = abs(last["close"] - last["open"])
    upper_shadow = last["high"] - max(last["open"], last["close"])
    lower_shadow = min(last["open"], last["close"]) - last["low"]
    near_high = position60 >= 80
    down_trend = (
        len(closes) >= 30
        and price < ma5
        and ma5 < ma30
        and previous_ma5 <= ma5
    )
    up_trend = (
        len(closes) >= 30
        and price > ma5
        and ma5 > ma30
        and ma5 > previous_ma5
        and ma30 > previous_ma30
    )

    has_price_limit = portfolio.asset_type in {"A股", "ETF"}
    stock_code = portfolio.code or code
    limit = 19.5 if stock_code.startswith(("300", "688", "588")) else 9.7
    range_span = high - low
    signals: List[TradingSignal] = []
    in_portfolio = bool(
        portfolio.quantity
        or portfolio.weight
        or portfolio.cost is not None
        or portfolio.frozen
        or portfolio.cost_warning
    )

    if in_portfolio and portfolio.weight >= 25:
        level = "green" if portfolio.weight >= 30 else "orange"
        signals.append(
            TradingSignal(
                level=level,
                rule="37",
                title="单股仓位接近上限",
                detail=f"当前仓位 {portfolio.weight:.2f}%，距离30%纪律上限较近。",
            )
        )
    if down_trend:
        signals.append(
            TradingSignal(
                level="orange",
                rule="2 · 4 · 6 · 76",
                title="下降趋势约束触发",
                detail="现价低于MA5，且MA5低于MA30；不宜仅因价格低而加仓。",
            )
        )
    if near_high and ma5 < previous_ma5:
        signals.append(
            TradingSignal(
                level="green",
                rule="17 · 20 · 47",
                title="高位五日线转弱",
                detail=f"股价位于60日区间顶部{(100 - position60):.1f}%内，MA5斜率转负。",
            )
        )
    if volume_ratio >= 1.5 and price <= open_price:
        signals.append(
            TradingSignal(
                level="green" if near_high else "orange",
                rule="20 · 32 · 35 · 47",
                title="放量但价格未走强",
                detail=f"成交量为20日均量的{volume_ratio:.2f}倍，现价未高于开盘价。",
            )
        )
    if upper_shadow >= max(body * 2, range and range_span * 0.3 or 0):
        signals.append(
            TradingSignal(
                level="green" if near_high else "orange",
                rule="3 · 27",
                title="长上影线风险",
                detail="上影长度显著超过实体，盘中高位存在抛压。",
            )
        )
    if lower_shadow >= max(body * 2, range and range_span * 0.3 or 0):
        signals.append(
            TradingSignal(
                level="blue",
                rule="3 · 41",
                title="长下影线观察",
                detail="下影长度显著超过实体，存在承接但仍需后续量价确认。",
            )
        )
    if has_price_limit and change_pct >= limit:
        signals.append(
            TradingSignal(
                level="blue",
                rule="9 · 18 · 19 · 54 · 55",
                title="涨停行为跟踪",
                detail=f"当前涨幅{change_pct:.2f}%，继续观察封板稳定性与次日承接。",
            )
        )
    if price > prior20_high and volume_ratio >= 1.5:
        signals.append(
            TradingSignal(
                level="red",
                rule="22 · 23 · 26 · 57",
                title="放量突破20日高点",
                detail=f"价格突破前20日高点，成交量为20日均量的{volume_ratio:.2f}倍。",
            )
        )
    if up_trend and volume_ratio >= 1.1:
        signals.append(
            TradingSignal(
                level="red",
                rule="2 · 8 · 26 · 64 · 73",
                title="上升趋势与量价共振",
                detail="现价>MA5>MA30，均线斜率向上且成交量未明显萎缩。",
            )
        )
    if change_pct <= -8:
        signals.append(
            TradingSignal(
                level="green",
                rule="30 · 32 · 50 · 66",
                title="快速下跌风险",
                detail=f"当日跌幅{abs(change_pct):.2f}%，优先检查破位与预设止损，不盲目抢反弹。",
            )
        )
    if change_pct >= 8 and (not has_price_limit or change_pct < limit):
        signals.append(
            TradingSignal(
                level="orange",
                rule="5 · 60 · 66",
                title="急涨但尚未封板",
                detail=f"当日涨幅{change_pct:.2f}%，按纪律不追高，观察回落风险。",
            )
        )
    if in_portfolio and (portfolio.cost is None or portfolio.cost_warning):
        detail = (
            "持仓成本缺失，暂不计算收益率。"
            if portfolio.cost is None
            else "持仓成本明显异常，收益率仅作占位，不用于交易判断。"
        )
        signals.append(
            TradingSignal(
                level="orange",
                rule="10 · 31 · 63",
                title="持仓成本数据待核实",
                detail=detail,
            )
        )
    monitor_qty = (
        portfolio.monitor_quantity
        if portfolio.monitor_quantity is not None
        else portfolio.quantity
    )
    if in_portfolio and portfolio.frozen > 0 and monitor_qty != portfolio.quantity:
        signals.append(
            TradingSignal(
                level="orange",
                rule="10 · 49 · 67",
                title="持仓数量存在冻结差异",
                detail=(
                    f"实际数量{portfolio.quantity}股，股票余额{monitor_qty}股，"
                    f"冻结{portfolio.frozen}股。"
                ),
            )
        )

    return TradingSignalResult(
        signals=signals,
        ma5=ma5 if len(closes) >= 5 else None,
        ma30=ma30 if len(closes) >= 30 else None,
        volume_ratio=volume_ratio or None,
        position60=position60 if len(closes) >= 5 else None,
        up_trend=up_trend,
        down_trend=down_trend,
    )


def summarize_trading_signals(result: Optional[TradingSignalResult]) -> Optional[Dict[str, Any]]:
    """Low-sensitivity summary for pipeline/report attachment."""
    if result is None:
        return None
    signals = result.signals or []
    if not signals:
        return {
            "signal_count": 0,
            "levels": [],
            "titles": [],
            "rule_ids": [],
        }
    levels = []
    titles = []
    rule_ids = []
    seen_levels = set()
    seen_rules = set()
    for item in signals:
        if item.level not in seen_levels:
            seen_levels.add(item.level)
            levels.append(item.level)
        titles.append(item.title)
        for rid in item.rule_ids:
            if rid not in seen_rules:
                seen_rules.add(rid)
                rule_ids.append(rid)
    return {
        "signal_count": len(signals),
        "levels": levels,
        "titles": titles[:8],
        "rule_ids": rule_ids,
        "ma5": result.ma5,
        "ma30": result.ma30,
        "volume_ratio": result.volume_ratio,
        "position60": result.position60,
        "up_trend": result.up_trend,
        "down_trend": result.down_trend,
    }


def format_triggered_rules_for_prompt(result: Optional[TradingSignalResult]) -> str:
    """Compact prompt fragment listing triggered R-ids."""
    if result is None or not result.signals:
        return ""
    lines = ["已触发纪律规则（R1-R77，确定性盯盘评估，供参考）："]
    for item in result.signals:
        lines.append(f"- [{item.level}] {item.title} ({item.rule})")
    return "\n".join(lines)
