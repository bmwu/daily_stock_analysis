import { useCallback, useEffect, useRef, useState } from 'react';
import { marketRadarApi } from '../api/marketRadar';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import type { MarketRadarChart, MarketRadarOverview } from '../types/marketRadar';

const DEFAULT_POLL_MS = 30000;
const chartCache = new Map<string, MarketRadarChart>();

function chartCacheKey(code: string, mode: string): string {
  return `${code}:${mode}`;
}

export function useMarketRadarOverview(pollMs: number = DEFAULT_POLL_MS) {
  const [data, setData] = useState<MarketRadarOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const overview = await marketRadarApi.getOverview();
      setData(overview);
      setError(null);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setLoading(false);
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

  return { data, loading, error, refresh };
}

export function useMarketRadarChart(code: string | null, mode: 'intraday' | 'kline' = 'intraday') {
  const [data, setData] = useState<MarketRadarChart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!code) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const key = chartCacheKey(code, mode);
    const cached = chartCache.get(key);
    if (cached) {
      setData(cached);
      setError(null);
    }

    const requestId = ++requestIdRef.current;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const chart = await marketRadarApi.getChart(code as string, mode);
        if (!active || requestId !== requestIdRef.current) return;
        chartCache.set(key, chart);
        setData(chart);
        setError(null);
      } catch (err) {
        if (!active || requestId !== requestIdRef.current) return;
        setError(getParsedApiError(err));
        if (!cached) {
          setData(null);
        }
      } finally {
        if (active && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [code, mode]);

  return {
    data: code ? data : null,
    loading: Boolean(code) && loading,
    error: code ? error : null,
  };
}
