import apiClient from './index';
import { toCamelCase } from './utils';
import type { MarketRadarChart, MarketRadarOverview } from '../types/marketRadar';

export const marketRadarApi = {
  async getOverview(): Promise<MarketRadarOverview> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/market-radar/overview');
    return toCamelCase(response.data) as MarketRadarOverview;
  },

  async getChart(code: string, mode: 'intraday' | 'kline' | 'both' = 'both'): Promise<MarketRadarChart> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/market-radar/chart', {
      params: { code, mode },
    });
    return toCamelCase(response.data) as MarketRadarChart;
  },
};
