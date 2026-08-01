# -*- coding: utf-8 -*-
"""Regression: Yahoo fast_info previousClose can disagree with regularMarketPreviousClose."""

from data_provider.yfinance_fetcher import _prefer_yahoo_regular_market_fields


def test_prefer_yahoo_regular_market_previous_close_over_fast_info():
    # BABA-style mismatch: fast_info previousClose=118.5 -> 3.16%,
    # while regularMarketPreviousClose=116.32 -> ~5.10%.
    price, prev_close, change_amount, change_pct, amplitude = _prefer_yahoo_regular_market_fields(
        price=122.25,
        prev_close=118.5,
        change_amount=3.75,
        change_pct=3.16,
        amplitude=2.84,
        high=122.585,
        low=119.22,
        ticker_info={
            "regularMarketPrice": 122.25,
            "regularMarketPreviousClose": 116.32,
            "previousClose": 116.32,
            "regularMarketChange": 5.93,
            "regularMarketChangePercent": 5.09801,
        },
    )
    assert price == 122.25
    assert prev_close == 116.32
    assert change_amount == 5.93
    assert round(change_pct, 2) == 5.1
    assert amplitude is not None
    assert amplitude > 2.84  # recalculated against correct previous close


def test_prefer_yahoo_falls_back_to_recompute_when_percent_missing():
    price, prev_close, change_amount, change_pct, _amplitude = _prefer_yahoo_regular_market_fields(
        price=100.0,
        prev_close=90.0,
        change_amount=10.0,
        change_pct=11.11,
        amplitude=None,
        high=101.0,
        low=99.0,
        ticker_info={"regularMarketPreviousClose": 95.0, "regularMarketPrice": 100.0},
    )
    assert prev_close == 95.0
    assert change_amount == 5.0
    assert round(change_pct, 4) == round(5.0 / 95.0 * 100, 4)
