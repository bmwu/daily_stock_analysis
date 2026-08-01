import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ApiErrorAlert, InlineAlert } from '../components/common';
import { DemoChart, TradingChart } from '../components/market-radar/TradingChart';
import { RuleBadges, SortHeader } from '../components/market-radar/chartUtils';
import { IndexMoreDrawer } from '../components/market-radar/IndexMoreDrawer';
import {
  formatAmount,
  levelLabel,
  money,
  number2,
  signed,
  tradingMinuteOfDay,
  type SortDirection,
  type SortKey,
} from '../components/market-radar/formatters';
import { useMarketRadarChart, useMarketRadarOverview } from '../hooks/useMarketRadarData';
import type { MarketRadarInstrument, MarketRadarSignalLevel } from '../types/marketRadar';
import { ruleText, splitRuleIds } from '../components/market-radar/ruleText';
import {
  loadFavoriteIndexCodes,
  orderFavoriteCodesByCatalog,
  toggleFavoriteIndexCode,
} from '../utils/marketRadarIndexFavorites';
import '../components/market-radar/marketRadar.css';

const ruleGroups = [
  { title: '股票池与方法', ids: '1 · 14 · 40 · 51 · 52 · 65', text: '坚持股票池、强弱节奏与既定方法；不追求绝对低点或高点。' },
  { title: '趋势优先', ids: '2 · 4 · 6 · 13 · 16 · 17 · 64 · 76', text: 'MA5、MA30与价格结构决定仓位节奏；下降趋势不新增。' },
  { title: '量价验证', ids: '8 · 20 · 21 · 26 · 32 · 33 · 35 · 46 · 47 · 57 · 73 · 77', text: '突破必须有量，放量滞涨和高位放量优先视为风险。' },
  { title: '形态观察', ids: '3 · 7 · 9 · 18 · 22 · 23 · 41 · 42 · 43 · 53', text: '长影线、布林线、盘整突破及一阳穿三线只作组合信号。' },
  { title: '盘中与尾盘', ids: '30 · 34 · 36 · 58 · 59 · 61 · 62', text: '急拉、杀跌、横盘和快慢节奏只作次日及盘中风险观察，不作确定预测。' },
  { title: '涨停行为', ids: '19 · 50 · 54 · 55 · 60 · 68 · 69 · 70 · 71', text: '开板、封板速度、缩量横盘与缺口共同评估强弱。' },
  { title: '交易纪律', ids: '5 · 10 · 11 · 31 · 37 · 38 · 39 · 45 · 49 · 56 · 63 · 66 · 67 · 74', text: '不追高、不借钱、少交易、单股不超30%，止损优先。' },
  { title: '需外部数据', ids: '12 · 15 · 24 · 25 · 27 · 28 · 29 · 44 · 48 · 72 · 75', text: '题材、筹码峰、主力和资金流缺乏可靠数据时明确标记无法验证。' },
];

function n(value?: number | null, fallback = 0): number {
  return value == null || Number.isNaN(Number(value)) ? fallback : Number(value);
}

function formatRadarPrice(item: MarketRadarInstrument): string {
  if (item.price == null) {
    return item.quoteSource ? '暂无行情' : '—';
  }
  return number2.format(n(item.price));
}

function signalsAvailable(item: MarketRadarInstrument): boolean {
  return item.signalsAvailable !== false;
}

function signalCountLabel(item: MarketRadarInstrument): string {
  if (!signalsAvailable(item)) {
    return '信号暂不可用';
  }
  return `${(item.signals || []).length}信号`;
}


function instrumentTrend(item: MarketRadarInstrument): 'up' | 'down' | 'mixed' {
  if (item.trend) return item.trend;
  if (item.upTrend) return 'up';
  if (item.downTrend) return 'down';
  return 'mixed';
}

const MarketRadarPage: React.FC = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const { data, loading, refreshing, error, refresh } = useMarketRadarOverview(30000);
  const [portfolioTab, setPortfolioTab] = useState<'holdings' | 'watchlist'>('holdings');
  const [selected, setSelected] = useState<string>('');
  const [signalFilter, setSignalFilter] = useState<'all' | MarketRadarSignalLevel>('all');
  const [ruleScope, setRuleScope] = useState<'current' | 'all'>('current');
  const [chartMode, setChartMode] = useState<'intraday' | 'kline'>('intraday');
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'changePercent',
    direction: 'desc',
  });
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [favoriteIndexCodes, setFavoriteIndexCodes] = useState<string[]>(() => loadFavoriteIndexCodes());
  const [indexDrawerOpen, setIndexDrawerOpen] = useState(false);
  const theme: 'dark' | 'light' = resolvedTheme === 'light' ? 'light' : 'dark';

  const collection = useMemo(
    () => (portfolioTab === 'holdings' ? data?.holdings ?? [] : data?.watchlist ?? []),
    [data, portfolioTab],
  );

  const indexCatalog = useMemo(() => {
    if (data?.indexCatalog && data.indexCatalog.length > 0) {
      return data.indexCatalog;
    }
    return (data?.indices || []).map((item) => ({
      code: item.code,
      name: item.name,
      region: item.region || 'cn',
    }));
  }, [data?.indexCatalog, data?.indices]);

  // Main strip follows catalog/market order (same as drawer), not favorite-toggle order.
  const favoriteIndices = useMemo(() => {
    const byCode = new Map((data?.indices || []).map((item) => [item.code, item]));
    const catalogByCode = new Map(indexCatalog.map((item) => [item.code, item]));
    return orderFavoriteCodesByCatalog(
      favoriteIndexCodes,
      indexCatalog.map((item) => item.code),
    )
      .map((code) => {
        const quoted = byCode.get(code);
        if (quoted) return quoted;
        const meta = catalogByCode.get(code);
        if (!meta) return null;
        return { code: meta.code, name: meta.name, region: meta.region };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [data?.indices, favoriteIndexCodes, indexCatalog]);

  const handleToggleFavoriteIndex = (code: string) => {
    setFavoriteIndexCodes((prev) => toggleFavoriteIndexCode(prev, code));
  };

  const sortedCollection = useMemo(() => {
    const trendRank = { down: 0, mixed: 1, up: 2 } as const;
    const numericValue = (item: MarketRadarInstrument) => {
      if (sort.key === 'price') return item.price ?? null;
      if (sort.key === 'changePercent') return item.changePct ?? null;
      if (sort.key === 'value') return portfolioTab === 'holdings' ? item.marketValue ?? null : item.amount ?? null;
      if (sort.key === 'performance') {
        return portfolioTab === 'holdings' ? item.profitPercent ?? null : item.turnover ?? null;
      }
      if (sort.key === 'trend') return trendRank[instrumentTrend(item)];
      if (sort.key === 'signals') return item.signals?.length ?? 0;
      return null;
    };
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...collection].sort((a, b) => {
      if (sort.key === 'name') return (a.name || '').localeCompare(b.name || '', 'zh-CN') * factor;
      const left = numericValue(a);
      const right = numericValue(b);
      if (left === null && right === null) return a.code.localeCompare(b.code);
      if (left === null) return 1;
      if (right === null) return -1;
      return (left - right) * factor || a.code.localeCompare(b.code);
    });
  }, [collection, portfolioTab, sort]);

  const active = collection.find((item) => item.code === selected) ?? collection[0] ?? null;
  const { data: chartData, loading: chartLoading, error: chartError } = useMarketRadarChart(active?.code ?? null);

  useEffect(() => {
    if (!active?.code) return;
    // Non-A shares have no reliable intraday yet — prefer daily candles.
    if (!/^\d{6}$/.test(active.code)) {
      setChartMode('kline');
    }
  }, [active?.code]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
        : { key, direction: key === 'name' ? 'asc' : 'desc' },
    );
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  const activeSignals = useMemo(() => active?.signals ?? [], [active]);
  const visibleSignals = useMemo(() => {
    const rows = activeSignals.map((signal) => ({
      ...signal,
      code: active?.code ?? '',
      name: active?.name ?? '',
    }));
    return signalFilter === 'all' ? rows : rows.filter((s) => s.level === signalFilter);
  }, [active, activeSignals, signalFilter]);

  const redCount = activeSignals.filter((s) => s.level === 'red').length;
  const greenCount = activeSignals.filter((s) => s.level === 'green').length;
  const orangeCount = activeSignals.filter((s) => s.level === 'orange').length;
  const blueCount = activeSignals.filter((s) => s.level === 'blue').length;

  const activeRuleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const signal of activeSignals) {
      for (const id of signal.ruleIds || splitRuleIds(signal.rule)) {
        ids.add(id);
      }
    }
    return Array.from(ids);
  }, [activeSignals]);

  const visibleRuleGroups = useMemo(() => {
    if (ruleScope === 'all') return ruleGroups;
    return ruleGroups
      .map((group) => {
        const ids = splitRuleIds(group.ids).filter((id) => activeRuleIds.includes(id));
        if (!ids.length) return null;
        return { ...group, ids: ids.join(' · ') };
      })
      .filter(Boolean) as typeof ruleGroups;
  }, [activeRuleIds, ruleScope]);

  if (error && !data) {
    const disabled =
      error.status === 503
      || /trading_signals_disabled|ENABLE_TRADING_SIGNALS/i.test(`${error.message || ''} ${error.rawMessage || ''}`);
    // Only hard-block when the feature is disabled; timeouts/partial upstream failures
    // should still render the shell so the home page remains usable.
    if (disabled) {
      return (
        <div className="market-radar-root" data-theme={theme}>
          <main className="shell">
            <ApiErrorAlert error={error} />
            <InlineAlert
              variant="warning"
              message="请先在设置或 `.env` 中开启 ENABLE_TRADING_SIGNALS=true，然后刷新本页。"
            />
            <button type="button" className="refresh-button" onClick={() => void refresh(true)}>重试</button>
          </main>
        </div>
      );
    }
  }

  const account = data?.account;
  const totalAsset = n(account?.totalAsset);
  const cash = n(account?.cash);
  const cashPct = totalAsset > 0 ? (cash / totalAsset) * 100 : 0;

  return (
    <div className="market-radar-root" data-theme={theme}>
      <main className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark"><b /><b /><b /></span>
            <div>
              <h1>持仓雷达</h1>
              <p>A股量价与风险监控台</p>
            </div>
          </div>
          <div className="market-status">
            <span className="live-dot" />
            <div>
              <strong>大盘与个股联动中</strong>
              <small>
                {data
                  ? `行情时间 ${new Date(data.updatedAt).toLocaleString('zh-CN', { hour12: false })}`
                  : '正在连接行情…'}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'}
            aria-pressed={theme === 'light'}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '◐'}</span>
            {theme === 'dark' ? '浅色' : '深色'}
          </button>
          <button
            type="button"
            className="refresh-button"
            onClick={() => void refresh(true)}
            disabled={refreshing}
            aria-label="刷新行情"
          >
            <span className={refreshing ? 'spin' : ''}>↻</span>
            {refreshing ? '刷新中' : '刷新行情'}
          </button>
          <button
            type="button"
            className="index-more-button"
            onClick={() => setIndexDrawerOpen(true)}
            aria-label="更多指数"
          >
            更多指数
            <small>{indexCatalog.length || '—'}</small>
          </button>
        </header>

        {error ? (
          <div className="error-banner">
            数据提醒：{error.message || '部分行情更新失败'}。
            {!data ? '页面仍可操作，请点击右上角「刷新行情」重试。' : '页面保留最近一次成功数据，不据此作交易判断。'}
          </div>
        ) : null}

        <section className="index-strip" aria-label="大盘指数">
          {loading && !data && [1, 2, 3].map((item) => <div className="index-card skeleton" key={item} />)}
          {favoriteIndices.map((index) => (
            <article className="index-card" key={index.code}>
              <div className="index-title">
                <span>{index.name}</span>
                <small>{index.code}</small>
              </div>
              <div className="index-main">
                <strong>{index.price == null ? '—' : number2.format(n(index.price))}</strong>
                <span className={n(index.changePct) >= 0 ? 'up' : 'down'}>
                  {index.changePct == null ? '—' : signed(n(index.changePct), '%')}
                </span>
              </div>
              <div className="index-foot">
                <span>{index.change == null ? '—' : signed(n(index.change))}</span>
                <span>成交额 {index.amount == null ? '—' : formatAmount(n(index.amount))}</span>
              </div>
            </article>
          ))}
          <article className="index-card account-summary">
            <div className="index-title">
              <span>账户概览</span>
              <small>组合快照</small>
            </div>
            <div className="index-main">
              <strong>¥{money.format(totalAsset)}</strong>
              <span className="neutral">现金 {number2.format(cashPct)}%</span>
            </div>
            <div className="index-foot">
              <span>持仓 {formatAmount(n(account?.marketValue))}</span>
              <span className={n(account?.totalProfit ?? account?.unrealizedPnl) >= 0 ? 'up' : 'down'}>
                累计 {formatAmount(n(account?.totalProfit ?? account?.unrealizedPnl))}
              </span>
            </div>
          </article>
        </section>

        <IndexMoreDrawer
          open={indexDrawerOpen}
          onClose={() => setIndexDrawerOpen(false)}
          catalog={indexCatalog}
          quotes={data?.indices || []}
          favoriteCodes={favoriteIndexCodes}
          onToggleFavorite={handleToggleFavoriteIndex}
        />

        <section className="workspace">
          <section className="panel quote-list-panel">
            <div className="panel-head quote-list-head">
              <div>
                <span className="eyebrow">MARKET NAVIGATOR</span>
                <h2>
                  行情导航 <small>{portfolioTab === 'holdings' ? '持仓' : '自选'}</small>
                </h2>
              </div>
              <span className="quote-live">
                <i />
                {collection.length} 只
              </span>
            </div>
            <div className="quote-list-toolbar">
              <div className="portfolio-tabs" role="tablist" aria-label="股票列表切换">
                <button
                  type="button"
                  className={portfolioTab === 'holdings' ? 'active' : ''}
                  onClick={() => setPortfolioTab('holdings')}
                  role="tab"
                >
                  当前持仓
                </button>
                <button
                  type="button"
                  className={portfolioTab === 'watchlist' ? 'active' : ''}
                  onClick={() => setPortfolioTab('watchlist')}
                  role="tab"
                >
                  我的自选
                </button>
              </div>
              <Link className="compact-manage-button" to="/portfolio" aria-label="管理持仓/自选">＋</Link>
            </div>
            <div className="quote-list-header" role="row">
              <SortHeader label="股票" sortKey="name" current={sort} onSort={toggleSort} />
              <SortHeader label="现价" sortKey="price" current={sort} onSort={toggleSort} />
              <SortHeader label="涨跌" sortKey="changePercent" current={sort} onSort={toggleSort} />
              <SortHeader
                label={portfolioTab === 'holdings' ? '收益' : '换手'}
                sortKey="performance"
                current={sort}
                onSort={toggleSort}
              />
            </div>
            <div className="quote-list" role="listbox" aria-label={portfolioTab === 'holdings' ? '持仓快速列表' : '自选股快速列表'}>
              {sortedCollection.map((item) => {
                const trend = instrumentTrend(item);
                const changePct = n(item.changePct);
                return (
                  <button
                    type="button"
                    className={'quote-list-row ' + (active?.code === item.code ? 'active' : '')}
                    key={item.code}
                    onClick={() => setSelected(item.code)}
                    role="option"
                    aria-selected={active?.code === item.code}
                  >
                    <span className="quote-identity">
                      <b>{item.name || item.code}</b>
                      <small>{item.code}</small>
                    </span>
                    <span>
                      <b className={item.price == null ? 'neutral' : changePct >= 0 ? 'up' : 'down'}>{formatRadarPrice(item)}</b>
                      <small>{item.price == null ? '非A股行情暂不支持' : trend === 'up' ? '上升' : trend === 'down' ? '下降' : '震荡'}</small>
                    </span>
                    <span>
                      <b className={changePct >= 0 ? 'up' : 'down'}>{signed(changePct, '%')}</b>
                      <small>{signed(n(item.change))}</small>
                    </span>
                    <span className="quote-result">
                      <b
                        className={
                          portfolioTab === 'holdings' && item.profitPercent != null
                            ? n(item.profitPercent) >= 0
                              ? 'up'
                              : 'down'
                            : 'neutral'
                        }
                      >
                        {portfolioTab === 'holdings'
                          ? item.profitPercent == null
                            ? '核实'
                            : signed(n(item.profitPercent), '%')
                          : `${number2.format(n(item.turnover))}%`}
                      </b>
                      <small>
                        <i
                          className={
                            !signalsAvailable(item)
                              ? 'blue'
                              : (item.signals || []).some((s) => s.level === 'green')
                                ? 'green'
                                : (item.signals || []).some((s) => s.level === 'orange')
                                  ? 'orange'
                                  : (item.signals || []).some((s) => s.level === 'red')
                                    ? 'red'
                                    : 'blue'
                          }
                        />
                        {signalCountLabel(item)}
                      </small>
                    </span>
                  </button>
                );
              })}
              {loading && !data && <div className="quote-list-loading">正在同步行情…</div>}
              {!loading && collection.length === 0 && (
                <div className="quote-list-loading">列表为空，请前往持仓页管理标的</div>
              )}
            </div>
            <div className="quote-list-foot">
              <span>红涨绿跌</span>
              <span>30秒刷新</span>
            </div>
          </section>

          <div className="primary-column">
            <section className="panel holdings-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">PORTFOLIO LEDGER</span>
                  <h2>
                    {portfolioTab === 'holdings' ? '持仓明细' : '自选明细'} <small>点击表头排序</small>
                  </h2>
                </div>
                <div className="panel-actions">
                  <div className="summary-chips">
                    <span>
                      <b>{collection.length}</b> 只监控
                    </span>
                    <span>
                      <b>{collection.filter((item) => n(item.changePct) > 0).length}</b> 只上涨
                    </span>
                  </div>
                  <Link className="manage-positions-button" to="/portfolio">
                    ＋ 管理持仓
                  </Link>
                </div>
              </div>
              <div className="holdings-table" role="table" aria-label={portfolioTab === 'holdings' ? '持仓列表' : '自选股列表'}>
                <div className="table-row table-header" role="row">
                  <SortHeader label="股票" sortKey="name" current={sort} onSort={toggleSort} />
                  <SortHeader label="价格" sortKey="price" current={sort} onSort={toggleSort} />
                  <SortHeader label="涨跌" sortKey="changePercent" current={sort} onSort={toggleSort} />
                  <SortHeader
                    label={portfolioTab === 'holdings' ? '市值' : '成交额'}
                    sortKey="value"
                    current={sort}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label={portfolioTab === 'holdings' ? '收益率' : '换手率'}
                    sortKey="performance"
                    current={sort}
                    onSort={toggleSort}
                  />
                  <SortHeader label="趋势" sortKey="trend" current={sort} onSort={toggleSort} />
                  <SortHeader label="信号" sortKey="signals" current={sort} onSort={toggleSort} />
                </div>
                {sortedCollection.map((item) => {
                  const trend = instrumentTrend(item);
                  const changePct = n(item.changePct);
                  return (
                    <button
                      type="button"
                      className={'table-row ' + (active?.code === item.code ? 'active' : '')}
                      key={item.code}
                      onClick={() => setSelected(item.code)}
                      role="row"
                    >
                      <span className="stock-name">
                        <b>{item.name || item.code}</b>
                        <small>
                          {item.code} · {portfolioTab === 'holdings' ? `${n(item.quantity)}股` : item.assetType || 'A股'}
                        </small>
                      </span>
                      <span>
                        <b className={item.price == null ? 'neutral' : changePct >= 0 ? 'up' : 'down'}>{formatRadarPrice(item)}</b>
                        <small>{item.price == null ? (item.quoteSource === 'market_radar_ashare_quotes_only' ? '实时大盘暂仅支持A股报价' : '行情暂不可用') : `今开 ${number2.format(n(item.open))}`}</small>
                      </span>
                      <span>
                        <b className={changePct >= 0 ? 'up' : 'down'}>{signed(changePct, '%')}</b>
                        <small className={changePct >= 0 ? 'up' : 'down'}>{signed(n(item.change))}</small>
                      </span>
                      <span>
                        <b>
                          {portfolioTab === 'holdings'
                            ? `¥${money.format(n(item.marketValue))}`
                            : formatAmount(n(item.amount))}
                        </b>
                        <small>
                          {portfolioTab === 'holdings'
                            ? `基线仓位 ${number2.format(n(item.baselineWeight))}%`
                            : `成交量 ${formatAmount(n(item.volume))}`}
                        </small>
                      </span>
                      <span>
                        {portfolioTab === 'holdings' ? (
                          <>
                            <b className={item.profit != null && n(item.profit) >= 0 ? 'up' : 'down'}>
                              {item.profit == null ? '待核实' : formatAmount(n(item.profit))}
                            </b>
                            <small>{item.profitPercent == null ? '成本异常' : signed(n(item.profitPercent), '%')}</small>
                          </>
                        ) : (
                          <>
                            <b>{number2.format(n(item.turnover))}%</b>
                            <small>
                              高 {number2.format(n(item.high))} · 低 {number2.format(n(item.low))}
                            </small>
                          </>
                        )}
                      </span>
                      <span>
                        <em className={'trend ' + trend}>
                          {trend === 'up' ? '上升' : trend === 'down' ? '下降' : '震荡'}
                        </em>
                        <small>MA5 {item.ma5 ? number2.format(item.ma5) : '—'}</small>
                      </span>
                      <span>
                        <b
                          className={
                            !signalsAvailable(item)
                              ? 'alert-count blue'
                              : (item.signals || []).some((s) => s.level === 'green')
                                ? 'alert-count green'
                                : (item.signals || []).some((s) => s.level === 'orange')
                                  ? 'alert-count orange'
                                  : (item.signals || []).some((s) => s.level === 'red')
                                    ? 'alert-count red'
                                    : 'alert-count blue'
                          }
                        >
                          {signalsAvailable(item) ? (item.signals || []).length : '—'}
                        </b>
                        <small>{signalsAvailable(item) ? '条命中' : '信号暂不可用'}</small>
                      </span>
                    </button>
                  );
                })}
                {loading && !data && <div className="table-loading">正在加载最新行情并计算规则信号…</div>}
                {!loading && collection.length === 0 && (
                  <div className="table-loading">列表为空，请前往持仓页添加标的。</div>
                )}
              </div>
            </section>

            <section className="panel detail-panel">
              <div className="detail-head">
                <div>
                  <span className="eyebrow">PRICE ACTION</span>
                  <h2>
                    {active?.name ?? '个股趋势'} <small>{active?.code}</small>
                  </h2>
                </div>
                <div className="detail-controls">
                  <div className="chart-tabs" role="tablist" aria-label="图表类型切换">
                    <button
                      type="button"
                      className={chartMode === 'intraday' ? 'active' : ''}
                      onClick={() => setChartMode('intraday')}
                      role="tab"
                    >
                      分时
                    </button>
                    <button
                      type="button"
                      className={chartMode === 'kline' ? 'active' : ''}
                      onClick={() => setChartMode('kline')}
                      role="tab"
                    >
                      K线
                    </button>
                  </div>
                  {active ? (
                    <div className="detail-price">
                      <strong className={n(active.changePct) >= 0 ? 'up' : 'down'}>
                        {number2.format(n(active.price))}
                      </strong>
                      <span className={n(active.changePct) >= 0 ? 'up' : 'down'}>
                        {signed(n(active.changePct), '%')}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="chart-wrap">
                {chartData
                  && (chartMode === 'intraday' ? chartData.intraday.length > 1 : chartData.candles.length > 1) ? (
                    <TradingChart key={`${chartData.code}-${chartMode}`} data={chartData} mode={chartMode} theme={theme} />
                  ) : null}
                {chartLoading ? (
                  <div className="chart-state">
                    <span className="spin">↻</span>
                    <b>正在加载{chartMode === 'intraday' ? '当日分时' : '日K线'}</b>
                  </div>
                ) : null}
                {!chartLoading && chartError ? (
                  <div className="chart-state error">
                    <span>!</span>
                    <b>{chartError.message || '图表行情暂不可用'}</b>
                    <small>其他行情与监控功能不受影响</small>
                  </div>
                ) : null}
                {!chartLoading
                  && !chartError
                  && chartData
                  && (chartMode === 'intraday' ? chartData.intraday.length <= 1 : chartData.candles.length <= 1) ? (
                    <div className="chart-state">
                      <span>—</span>
                      <b>
                        {chartMode === 'intraday' && (chartData.degraded || []).some((d) => d.includes('intraday'))
                          ? '当前市场暂无分时，可切换日K'
                          : '当前图表数据不足'}
                      </b>
                    </div>
                  ) : null}
                {!active ? <DemoChart /> : null}
                <div className="chart-badges">
                  {chartMode === 'intraday' ? (
                    <>
                      <span>
                        昨收 <b>{chartData?.previousClose ? number2.format(chartData.previousClose) : '—'}</b>
                      </span>
                      <span>
                        均价{' '}
                        <b>
                          {chartData?.intraday.at(-1)?.average
                            ? number2.format(chartData.intraday.at(-1)!.average)
                            : '—'}
                        </b>
                      </span>
                      <span>
                        分时点 <b>{chartData?.intraday.length ?? 0}</b>
                      </span>
                      <span>
                        行情日{' '}
                        <b>
                          {chartData?.date && chartData.date.length >= 8
                            ? `${chartData.date.slice(4, 6)}-${chartData.date.slice(6, 8)}`
                            : '—'}
                        </b>
                      </span>
                      <span>
                        交易进度{' '}
                        <b>
                          {chartData?.intraday.at(-1)?.time
                            ? `${Math.round((tradingMinuteOfDay(chartData.intraday.at(-1)!.time) / 240) * 100)}%`
                            : '—'}
                        </b>
                      </span>
                      <span>
                        时间轴 <b>固定至15:00</b>
                      </span>
                      <span>
                        纵轴 <b>行情区间自适应</b>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        MA5 <b>{active?.ma5 ? number2.format(active.ma5) : '—'}</b>
                      </span>
                      <span>
                        MA30 <b>{active?.ma30 ? number2.format(active.ma30) : '—'}</b>
                      </span>
                      <span>
                        量比20D <b>{active?.volumeRatio ? `${number2.format(active.volumeRatio)}×` : '—'}</b>
                      </span>
                      <span>
                        日K数量 <b>{chartData?.candles.length ?? 0}</b>
                      </span>
                      <span>
                        显示 <b>实体增强 · 真实价格比例</b>
                      </span>
                      <span>
                        十字线 <b>高低区间跟随</b>
                      </span>
                      <span>
                        资金流 <b>主力净额</b>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="metric-grid">
                <div>
                  <small>今开</small>
                  <b>{active ? number2.format(n(active.open)) : '—'}</b>
                </div>
                <div>
                  <small>最高</small>
                  <b className="up">{active ? number2.format(n(active.high)) : '—'}</b>
                </div>
                <div>
                  <small>最低</small>
                  <b className="down">{active ? number2.format(n(active.low)) : '—'}</b>
                </div>
                <div>
                  <small>换手率</small>
                  <b>{active ? `${number2.format(n(active.turnover))}%` : '—'}</b>
                </div>
                <div>
                  <small>成交额</small>
                  <b>{active ? formatAmount(n(active.amount)) : '—'}</b>
                </div>
                <div>
                  <small>布林中轨</small>
                  <b>{active?.bollMid ? number2.format(active.bollMid) : '—'}</b>
                </div>
              </div>
            </section>
          </div>

          <aside className="secondary-column">
            <section className="panel alert-panel">
              <div className="panel-head alert-head">
                <div>
                  <span className="eyebrow">SIGNAL CENTER · 当前股票</span>
                  <h2>
                    {active?.name ?? '异常与提醒'} <small>{active?.code}</small>
                  </h2>
                </div>
                <span className="pulse-label">
                  <i />
                  个股联动中
                </span>
              </div>
              <div className="signal-meaning" aria-label="提醒颜色说明">
                <div className="red">
                  <i />
                  <span>
                    <b>红色 · 上涨/正向</b>
                    <small>偏正面，趋势与量价确认</small>
                  </span>
                </div>
                <div className="green">
                  <i />
                  <span>
                    <b>绿色 · 下跌/负面</b>
                    <small>明确风险，优先处理</small>
                  </span>
                </div>
                <div className="orange">
                  <i />
                  <span>
                    <b>橙色 · 风险预警</b>
                    <small>偏负面，需要确认</small>
                  </span>
                </div>
                <div className="blue">
                  <i />
                  <span>
                    <b>蓝色 · 中性观察</b>
                    <small>不定方向，等待验证</small>
                  </span>
                </div>
              </div>
              <div className="alert-tabs">
                <button type="button" className={signalFilter === 'all' ? 'active' : ''} onClick={() => setSignalFilter('all')}>
                  全部 <b>{activeSignals.length}</b>
                </button>
                <button type="button" className={signalFilter === 'red' ? 'active' : ''} onClick={() => setSignalFilter('red')}>
                  红 <b>{redCount}</b>
                </button>
                <button type="button" className={signalFilter === 'green' ? 'active' : ''} onClick={() => setSignalFilter('green')}>
                  绿 <b>{greenCount}</b>
                </button>
                <button type="button" className={signalFilter === 'orange' ? 'active' : ''} onClick={() => setSignalFilter('orange')}>
                  橙 <b>{orangeCount}</b>
                </button>
                <button type="button" className={signalFilter === 'blue' ? 'active' : ''} onClick={() => setSignalFilter('blue')}>
                  蓝 <b>{blueCount}</b>
                </button>
              </div>
              <div className="alert-list">
                {visibleSignals.map((signal, index) => (
                  <article className={'alert-item ' + signal.level} key={`${signal.code}-${signal.rule}-${index}`}>
                    <div className="alert-icon">
                      {signal.level === 'green' ? '!' : signal.level === 'orange' ? '↑' : signal.level === 'blue' ? '◎' : '↗'}
                    </div>
                    <div>
                      <div className="alert-meta">
                        <b>{signal.name}</b>
                        <span>{signal.code}</span>
                        <em>{levelLabel(signal.level)}</em>
                      </div>
                      <h3>{signal.title}</h3>
                      <p>{signal.detail}</p>
                      <div className="alert-rule-line">
                        <RuleBadges value={signal.rule} onSelect={setSelectedRule} />
                        <small>悬停预览，点击打开独立规则</small>
                      </div>
                    </div>
                  </article>
                ))}
                {!loading && visibleSignals.length === 0 ? (
                  <div className="empty-state">
                    <span>✓</span>
                    <b>
                      {active && !signalsAvailable(active)
                        ? `${active.name}信号暂不可用`
                        : `${active?.name ?? '当前股票'}暂无该级别新增信号`}
                    </b>
                    <small>
                      {active && !signalsAvailable(active)
                        ? '日线数据尚未就绪，报价仍可查看；稍后刷新或切换股票'
                        : '切换左侧股票可查看对应异动；行情每30秒刷新'}
                    </small>
                  </div>
                ) : null}
                {loading && !data ? (
                  <div className="empty-state">
                    <span className="spin">↻</span>
                    <b>正在计算量价信号</b>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="panel rules-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">RULEBOOK 01—77 · 当前股票</span>
                  <h2>
                    {active?.name ?? '约束条件'} <small>{active?.code}</small>
                  </h2>
                </div>
                <div className="rule-scope-tabs" role="tablist" aria-label="约束条件范围">
                  <button
                    type="button"
                    className={ruleScope === 'current' ? 'active' : ''}
                    onClick={() => setRuleScope('current')}
                    role="tab"
                  >
                    当前命中 <b>{activeRuleIds.length}</b>
                  </button>
                  <button
                    type="button"
                    className={ruleScope === 'all' ? 'active' : ''}
                    onClick={() => setRuleScope('all')}
                    role="tab"
                  >
                    全部 <b>77</b>
                  </button>
                </div>
              </div>
              <div className="rule-list">
                {visibleRuleGroups.map((group) => (
                  <details key={group.title}>
                    <summary>
                      <span>{group.title}</span>
                      <RuleBadges value={group.ids} compact onSelect={setSelectedRule} />
                    </summary>
                    <p>{group.text}</p>
                  </details>
                ))}
                {!loading && ruleScope === 'current' && visibleRuleGroups.length === 0 ? (
                  <div className="rule-empty">
                    {active?.name ?? '当前股票'}暂未命中可计算约束，可切换“全部”查看完整规则库。
                  </div>
                ) : null}
              </div>
              <div className="discipline-card">
                <span>今日纪律</span>
                <strong>急涨不追，破位不拖</strong>
                <small>规则 5 · 32 · 37 · 38 · 66</small>
              </div>
            </section>
          </aside>
        </section>

        <footer>
          <span>
            大陆行情源：{data?.provider ?? '腾讯证券公开行情'} · 自动刷新30秒 · 持仓/自选复用 DSA 组合
          </span>
          <span>页面刷新会重新请求大盘与个股同一时点行情；行情仍可能受交易所或数据源延迟影响。</span>
        </footer>

        {selectedRule ? (
          <div className="rule-modal-backdrop" role="presentation" onClick={() => setSelectedRule(null)}>
            <section
              className="rule-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rule-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="rule-modal-close"
                type="button"
                onClick={() => setSelectedRule(null)}
                aria-label="关闭规则详情"
              >
                ×
              </button>
              <span>RULEBOOK 01—77</span>
              <h2 id="rule-modal-title">规则 {selectedRule}</h2>
              <p>{ruleText[selectedRule] ?? '规则内容待补充'}</p>
              <small>此规则为监控约束，不等于确定的买卖指令。</small>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default MarketRadarPage;
