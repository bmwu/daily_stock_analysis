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
  price?: number | null;
  changePct?: number | null;
  quoteSource?: string | null;
  signals: MarketRadarSignal[];
  ma5?: number | null;
  ma30?: number | null;
  volumeRatio?: number | null;
  position60?: number | null;
  upTrend?: boolean;
  downTrend?: boolean;
};

export type MarketRadarIndex = {
  code: string;
  name: string;
  price?: number | null;
  changePct?: number | null;
  change?: number | null;
  amount?: number | null;
};

export type MarketRadarAccount = {
  cash?: number | null;
  totalAsset?: number | null;
  marketValue?: number | null;
  unrealizedPnl?: number | null;
  realizedPnl?: number | null;
  currency?: string | null;
  accountCount?: number | null;
};

export type MarketRadarOverview = {
  updatedAt: string;
  provider: string;
  indices: MarketRadarIndex[];
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
  mode: string;
};
