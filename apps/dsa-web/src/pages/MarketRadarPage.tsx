import type React from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiErrorAlert, EmptyState, InlineAlert } from '../components/common';
import { MarketIndexStrip } from '../components/market-radar/MarketIndexStrip';
import { QuoteList } from '../components/market-radar/QuoteList';
import { RulePanel } from '../components/market-radar/RulePanel';
import { SignalCenter } from '../components/market-radar/SignalCenter';
import { TradingChart } from '../components/market-radar/TradingChart';
import { useMarketRadarChart, useMarketRadarOverview } from '../hooks/useMarketRadarData';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { cn } from '../utils/cn';

type Universe = 'holdings' | 'watchlist';
type ChartMode = 'intraday' | 'kline';

function fmt(n?: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

const MarketRadarPage: React.FC = () => {
  const { t } = useUiLanguage();
  const { data, loading, error, refresh } = useMarketRadarOverview(30000);
  const [universe, setUniverse] = useState<Universe>('holdings');
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('intraday');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const instruments = useMemo(() => {
    if (!data) return [];
    return universe === 'holdings' ? data.holdings : data.watchlist;
  }, [data, universe]);

  const effectiveCode = activeCode || instruments[0]?.code || null;
  const activeInstrument = instruments.find((item) => item.code === effectiveCode) || null;
  const { data: chart, loading: chartLoading, error: chartError } = useMarketRadarChart(
    effectiveCode,
    chartMode,
  );

  if (error && !data) {
    const disabled =
      error.status === 503
      || /trading_signals_disabled|ENABLE_TRADING_SIGNALS/i.test(
        `${error.message || ''} ${error.rawMessage || ''}`,
      );
    return (
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-3 py-4 sm:px-5 lg:px-6">
        <ApiErrorAlert error={error} />
        {disabled ? (
          <InlineAlert
            variant="warning"
            message="请先在设置或 `.env` 中开启 ENABLE_TRADING_SIGNALS=true，然后刷新本页。"
          />
        ) : null}
        <button type="button" className="btn-secondary w-fit" onClick={() => void refresh()}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-3 py-4 sm:px-5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-primary-text">{t('layout.route.marketRadar.title')}</h1>
          <p className="text-xs text-secondary-text">{t('layout.route.marketRadar.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/portfolio" className="btn-secondary text-xs">持仓管理</Link>
          <button type="button" className="btn-primary text-xs" onClick={() => void refresh()}>
            刷新
          </button>
        </div>
      </div>

      {loading && !data ? (
        <EmptyState title="加载中" description="正在拉取指数、持仓/自选与规则信号…" />
      ) : null}

      {data ? (
        <>
          <MarketIndexStrip
            indices={data.indices || []}
            account={data.account}
            updatedAt={data.updatedAt}
          />

          {(data.errors || []).length ? (
            <InlineAlert
              variant="warning"
              message={`部分数据降级：${(data.errors || []).slice(0, 3).map((e) => e.error || e.code).join('；')}`}
            />
          ) : null}

          <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
            <div className="overflow-hidden rounded-lg border border-border/50 bg-panel/20">
              <div className="flex border-b border-border/50">
                <button
                  type="button"
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs',
                    universe === 'holdings' ? 'bg-accent/10 text-accent' : 'text-secondary-text',
                  )}
                  onClick={() => setUniverse('holdings')}
                >
                  持仓 ({data.holdings.length})
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs',
                    universe === 'watchlist' ? 'bg-accent/10 text-accent' : 'text-secondary-text',
                  )}
                  onClick={() => setUniverse('watchlist')}
                >
                  自选 ({data.watchlist.length})
                </button>
              </div>
              <div className="max-h-[720px] overflow-auto">
                <QuoteList
                  items={instruments}
                  activeCode={effectiveCode}
                  onSelect={setActiveCode}
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <div className="overflow-hidden rounded-lg border border-border/50 bg-panel/20">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-primary-text">
                      {activeInstrument
                        ? `${activeInstrument.name || ''} ${effectiveCode}`
                        : '行情图'}
                    </div>
                    {activeInstrument ? (
                      <div className="mt-0.5 flex items-baseline gap-2 text-xs tabular-nums">
                        <span className="text-base font-semibold text-primary-text">
                          {fmt(activeInstrument.price)}
                        </span>
                        <span
                          className={
                            (activeInstrument.changePct || 0) > 0
                              ? 'text-success'
                              : (activeInstrument.changePct || 0) < 0
                                ? 'text-danger'
                                : 'text-secondary-text'
                          }
                        >
                          {activeInstrument.changePct == null
                            ? '—'
                            : `${activeInstrument.changePct > 0 ? '+' : ''}${fmt(activeInstrument.changePct)}%`}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={cn(
                        'rounded border px-2.5 py-1 text-xs',
                        chartMode === 'intraday'
                          ? 'border-accent text-accent'
                          : 'border-border/60 text-secondary-text',
                      )}
                      onClick={() => setChartMode('intraday')}
                    >
                      分时
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'rounded border px-2.5 py-1 text-xs',
                        chartMode === 'kline'
                          ? 'border-accent text-accent'
                          : 'border-border/60 text-secondary-text',
                      )}
                      onClick={() => setChartMode('kline')}
                    >
                      日K
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  {chartError ? <div className="mb-2"><ApiErrorAlert error={chartError} /></div> : null}
                  <TradingChart chart={chart} mode={chartMode} loading={chartLoading} />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border/50 bg-panel/20">
                <div className="border-b border-border/50 px-3 py-2 text-sm font-medium">
                  四色信号 · 绿风险 / 橙预警 / 蓝观察 / 红确认
                </div>
                <div className="h-[300px]">
                  <SignalCenter instruments={instruments} onSelectRule={setSelectedRuleId} />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border/50 bg-panel/20">
              <div className="h-[720px]">
                <RulePanel selectedRuleId={selectedRuleId} onSelect={setSelectedRuleId} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default MarketRadarPage;
