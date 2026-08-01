import { useCallback, useEffect, useRef, useState } from 'react';
import { marketRadarApi } from '../api/marketRadar';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import type { MarketRadarChart, MarketRadarOverview } from '../types/marketRadar';

const DEFAULT_POLL_MS = 30000;
const chartCache = new Map<string, MarketRadarChart>();

/** Stale kline payloads without dates (pre-fix US/HK bars) must not stick in memory. */
function isUsableChartCache(chart: MarketRadarChart | undefined): chart is MarketRadarChart {
  if (!chart) return false;
  const candles = chart.candles || [];
  if (candles.length === 0) return true;
  return candles.some((candle) => Boolean(candle.date && String(candle.date).trim()));
}

export function useMarketRadarOverview(pollMs: number = DEFAULT_POLL_MS) {
  const [data, setData] = useState<MarketRadarOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const timerRef = useRef<number | null>(null);
  const firstRef = useRef(true);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const overview = await marketRadarApi.getOverview();
      setData(overview);
      setError(null);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (pollMs > 0) {
      timerRef.current = window.setInterval(() => {
        void refresh();
      }, pollMs);
    }
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [pollMs, refresh]);

  return { data, loading, refreshing, error, refresh };
}

/** Original radar loads both intraday + kline once per stock. */
export function useMarketRadarChart(code: string | null) {
  const [data, setData] = useState<MarketRadarChart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const requestIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!code) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = chartCache.get(code);
    if (isUsableChartCache(cached)) {
      setData(cached);
      setError(null);
    } else if (cached) {
      chartCache.delete(code);
    }

    const requestId = ++requestIdRef.current;
    let active = true;

    async function load(showSpinner: boolean) {
      if (showSpinner && !isUsableChartCache(chartCache.get(code as string))) {
        setLoading(true);
      }
      try {
        const chart = await marketRadarApi.getChart(code as string, 'both');
        if (!active || requestId !== requestIdRef.current) return;
        chartCache.set(code as string, chart);
        setData(chart);
        setError(null);
      } catch (err) {
        if (!active || requestId !== requestIdRef.current) return;
        setError(getParsedApiError(err));
        if (!isUsableChartCache(chartCache.get(code as string))) {
          setData(null);
        }
      } finally {
        if (active && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void load(true);
    timerRef.current = window.setInterval(() => {
      void load(false);
    }, 30000);

    return () => {
      active = false;
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [code]);

  return {
    data: code ? data : null,
    loading: Boolean(code) && loading,
    error: code ? error : null,
  };
}
