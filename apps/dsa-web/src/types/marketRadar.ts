export type MarketRadarSignalLevel = 'green' | 'orange' | 'blue' | 'red';

export type MarketRadarSignal = {
  level: MarketRadarSignalLevel;
  rule: string;
  title: string;
  detail: string;
  ruleIds?: string[];
};

export type MarketRadarInstrument = {
  code: string;
  name: string;
  assetType?: string;
  price?: number | null;
  changePct?: number | null;
  change?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  previousClose?: number | null;
  volume?: number | null;
  amount?: number | null;
  turnover?: number | null;
  marketValue?: number | null;
  quantity?: number | null;
  baselineWeight?: number | null;
  profit?: number | null;
  profitPercent?: number | null;
  quoteSource?: string | null;
  signals: MarketRadarSignal[];
  signalsAvailable?: boolean;
  signalsUnavailableReason?: string | null;
  ma5?: number | null;
  ma30?: number | null;
  volumeRatio?: number | null;
  position60?: number | null;
  bollMid?: number | null;
  bollUpper?: number | null;
  bollLower?: number | null;
  upTrend?: boolean;
  downTrend?: boolean;
  trend?: 'up' | 'down' | 'mixed';
};

export type MarketRadarIndex = {
  code: string;
  name: string;
  region?: string;
  price?: number | null;
  changePct?: number | null;
  change?: number | null;
  amount?: number | null;
};

export type MarketRadarIndexCatalogItem = {
  code: string;
  name: string;
  region: string;
};

export type MarketRadarAccount = {
  cash?: number | null;
  totalAsset?: number | null;
  marketValue?: number | null;
  unrealizedPnl?: number | null;
  realizedPnl?: number | null;
  dailyProfit?: number | null;
  totalProfit?: number | null;
  currency?: string | null;
  accountCount?: number | null;
};

export type MarketRadarOverview = {
  updatedAt: string;
  provider: string;
  indices: MarketRadarIndex[];
  indexCatalog?: MarketRadarIndexCatalogItem[];
  account: MarketRadarAccount | null;
  holdings: MarketRadarInstrument[];
  watchlist: MarketRadarInstrument[];
  errors: Array<{ code?: string; error?: string }>;
};

export type MarketRadarIntradayPoint = {
  time: string;
  price: number;
  average: number;
  volume: number;
  amount: number;
};

export type MarketRadarCandle = {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  mainNetFlow?: number | null;
  largeNetFlow?: number | null;
  superLargeNetFlow?: number | null;
};

export type MarketRadarChart = {
  code: string;
  date: string;
  previousClose: number;
  currentPrice: number;
  updatedAt: string;
  intraday: MarketRadarIntradayPoint[];
  candles: MarketRadarCandle[];
  provider: string;
  mode?: string;
  degraded?: string[];
};
