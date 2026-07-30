# -*- coding: utf-8 -*-
from types import SimpleNamespace

from data_provider.akshare_fetcher import (
    AkshareFetcher,
    _parse_tencent_realtime_payload,
)
from data_provider.base import DataFetcherManager
from data_provider.realtime_types import RealtimeSource, UnifiedRealtimeQuote


def _fake_tencent_row(code: str, name: str, price: float) -> str:
    # Need >= 45 fields for parser
    fields = [""] * 50
    fields[1] = name
    fields[2] = code
    fields[3] = str(price)
    fields[4] = str(price - 1)
    fields[5] = str(price - 0.5)
    fields[6] = "1000"
    fields[31] = "1.0"
    fields[32] = "1.2"
    fields[33] = str(price + 1)
    fields[34] = str(price - 2)
    fields[35] = f"{price}/1000/123456"
    fields[37] = "12.3456"
    fields[38] = "1.5"
    fields[43] = "2.0"
    fields[44] = "100"
    fields[45] = "200"
    fields[46] = "1.1"
    fields[49] = "1.2"
    prefix = "sh" if code.startswith(("6", "5", "9")) else "sz"
    return f'v_{prefix}{code}="{"~".join(fields)}"'


def test_parse_tencent_realtime_payload_batch():
    payload = ";".join(
        [
            _fake_tencent_row("600519", "贵州茅台", 1800.0),
            _fake_tencent_row("000001", "平安银行", 12.3),
            "",
        ]
    )
    parsed = _parse_tencent_realtime_payload(
        payload,
        requested_codes=["600519", "000001"],
    )
    assert set(parsed.keys()) == {"600519", "000001"}
    assert parsed["600519"].price == 1800.0
    assert parsed["600519"].source == RealtimeSource.TENCENT
    assert parsed["000001"].name == "平安银行"


def test_get_realtime_quotes_tencent_batches(monkeypatch):
    fetcher = AkshareFetcher()
    monkeypatch.setattr(fetcher, "_enforce_rate_limit", lambda: None)

    class _Resp:
        status_code = 200
        text = ";".join(
            [
                _fake_tencent_row("600519", "贵州茅台", 1800.0),
                _fake_tencent_row("000001", "平安银行", 12.3),
            ]
        )
        encoding = "gbk"

    calls = []

    def _get(url, headers=None, timeout=10):
        calls.append(url)
        return _Resp()

    monkeypatch.setattr(
        "data_provider.akshare_fetcher.requests.get",
        _get,
    )
    monkeypatch.setattr(
        "data_provider.akshare_fetcher.get_realtime_circuit_breaker",
        lambda: SimpleNamespace(
            is_available=lambda key: True,
            record_success=lambda key: None,
            record_failure=lambda key, error=None: None,
        ),
    )

    result = fetcher.get_realtime_quotes_tencent(["600519", "000001"])
    assert set(result.keys()) == {"600519", "000001"}
    assert calls and "sh600519" in calls[0] and "sz000001" in calls[0]


def test_manager_get_realtime_quotes_fallback(monkeypatch):
    manager = DataFetcherManager.__new__(DataFetcherManager)

    class _Ak:
        def get_realtime_quotes_tencent(self, codes):
            return {
                "600519": UnifiedRealtimeQuote(
                    code="600519",
                    name="贵州茅台",
                    source=RealtimeSource.TENCENT,
                    price=1800.0,
                    change_pct=1.0,
                )
            }

    monkeypatch.setattr(manager, "_get_fetcher_by_name", lambda *a, **k: _Ak())
    monkeypatch.setattr(
        manager,
        "_enrich_realtime_quote",
        lambda quote, **kwargs: quote,
    )

    missing_calls = []

    def _single(code, log_final_failure=False):
        missing_calls.append(code)
        return UnifiedRealtimeQuote(
            code=code,
            name="fallback",
            source=RealtimeSource.FALLBACK,
            price=10.0,
            change_pct=0.0,
        )

    monkeypatch.setattr(manager, "get_realtime_quote", _single)
    monkeypatch.setattr(
        "src.config.get_config",
        lambda: SimpleNamespace(enable_realtime_quote=True, realtime_cache_ttl=60),
    )

    result = manager.get_realtime_quotes(["600519", "000001"])
    assert "600519" in result
    assert "000001" in result
    assert missing_calls == ["000001"]
