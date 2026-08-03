import type { BacktestPhaseFilter } from '../types/backtest';
import type { AlertTargetScope, AlertType, MarketLightStatus, MarketRegion, PortfolioStopLossMode } from '../types/alerts';
import type { PortfolioCashDirection, PortfolioCorporateActionType, PortfolioSide } from '../types/portfolio';
import type { UiLanguage } from '../i18n/uiText';

type Option<T extends string = string> = { value: T; label: string };
const alertTypes: AlertType[] = ['price_cross', 'price_change_percent', 'volume_spike', 'ma_price_cross', 'rsi_threshold', 'macd_cross', 'kdj_cross', 'cci_threshold', 'portfolio_stop_loss', 'portfolio_concentration', 'portfolio_drawdown', 'portfolio_price_stale', 'market_light_status', 'market_light_score_drop'];
const symbolAlertTypes = alertTypes.slice(0, 8);
const portfolioAlertTypes = alertTypes.slice(8, 12);
const marketAlertTypes = alertTypes.slice(12);

export const BACKTEST_TEXT = {
  zh: { documentTitle: '策略回测 - DSA', codePlaceholder: '按股票代码筛选（留空表示全部）', filter: '筛选', evalWindow: '评估窗口', phase: '阶段', startDate: '开始日期', startDateAria: '分析开始日期', endDate: '结束日期', endDateAria: '分析结束日期', oneDayValidation: '1 日验证', forceRerun: '强制重跑', running: '回测中...', runBacktest: '运行回测', oneDayModeDescription: '1 日验证模式会用下一个交易日收盘表现校验 AI 预测。', windowModeDescription: '将评估窗口设为 1，可查看 AI 预测与下一个交易日收盘表现的匹配情况。', overallPerformance: '整体表现', noMetricsTitle: '暂无指标', noMetricsDescription: '运行回测后会生成组合级表现指标。', loadingResults: '正在加载结果...', noResultsTitle: '暂无结果', noResultsDescription: '运行回测后可评估历史分析准确性。', nextDayValidation: '次日验证', resultSet: '结果集', allStocks: '全部股票', filteredStock: '筛选 {code}', dayWindow: '{days} 日窗口', fromDate: '自 {date}', toDate: '至 {date}', scrollHint: '小屏幕可横向滚动', stock: '股票', analysisDate: '分析日期', aiPrediction: 'AI 预测', actualPerformance: '实际表现', windowReturn: '窗口收益', accuracy: '准确性', directionMatch: '方向匹配', result: '结果', status: '状态', totalPage: '共 {total} 条结果 · 第 {page} / {pages} 页', directionAccuracy: '方向准确率', winRate: '胜率', avgSimulatedReturn: '平均模拟收益', avgStockReturn: '平均个股收益', stopLossTriggerRate: '止损触发率', takeProfitTriggerRate: '止盈触发率', avgDaysToFirstHit: '平均命中天数', evaluationCount: '评估数', outcomeSummary: '盈 / 亏 / 中', phaseDistribution: '阶段分布：{text}', processed: '已处理:', saved: '已保存:', completed: '已完成:', insufficient: '数据不足:', errors: '错误:', yes: '是', no: '否', unknown: '未知' },
  en: { documentTitle: 'Strategy Backtest - DSA', codePlaceholder: 'Filter by stock code (leave empty for all)', filter: 'Filter', evalWindow: 'Evaluation window', phase: 'Phase', startDate: 'Start date', startDateAria: 'Analysis start date', endDate: 'End date', endDateAria: 'Analysis end date', oneDayValidation: '1D validation', forceRerun: 'Force rerun', running: 'Backtesting...', runBacktest: 'Run backtest', oneDayModeDescription: '1D validation checks AI predictions against the next trading day close.', windowModeDescription: 'Set the evaluation window to 1 to compare AI predictions with the next trading day close.', overallPerformance: 'Overall performance', noMetricsTitle: 'No metrics', noMetricsDescription: 'Portfolio-level performance metrics appear after a backtest runs.', loadingResults: 'Loading results...', noResultsTitle: 'No results', noResultsDescription: 'Run a backtest to evaluate historical analysis accuracy.', nextDayValidation: 'Next-day validation', resultSet: 'Result set', allStocks: 'All stocks', filteredStock: 'Filtered {code}', dayWindow: '{days}-day window', fromDate: 'from {date}', toDate: 'to {date}', scrollHint: 'Scroll horizontally on small screens', stock: 'Stock', analysisDate: 'Analysis date', aiPrediction: 'AI prediction', actualPerformance: 'Actual performance', windowReturn: 'Window return', accuracy: 'Accuracy', directionMatch: 'Direction match', result: 'Result', status: 'Status', totalPage: '{total} results · Page {page} / {pages}', directionAccuracy: 'Direction accuracy', winRate: 'Win rate', avgSimulatedReturn: 'Avg simulated return', avgStockReturn: 'Avg stock return', stopLossTriggerRate: 'Stop-loss trigger rate', takeProfitTriggerRate: 'Take-profit trigger rate', avgDaysToFirstHit: 'Avg days to first hit', evaluationCount: 'Evaluations', outcomeSummary: 'Win / Loss / Neutral', phaseDistribution: 'Phase breakdown: {text}', processed: 'Processed:', saved: 'Saved:', completed: 'Completed:', insufficient: 'Insufficient:', errors: 'Errors:', yes: 'Yes', no: 'No', unknown: 'Unknown' },
} as const;

export const BACKTEST_PHASE_FILTER_OPTIONS: Record<UiLanguage, Array<Option<BacktestPhaseFilter>>> = {
  zh: [{ value: 'all', label: '全部阶段' }, { value: 'premarket', label: '盘前' }, { value: 'intraday', label: '盘中' }, { value: 'postmarket', label: '盘后' }, { value: 'unknown', label: '未知' }],
  en: [{ value: 'all', label: 'All phases' }, { value: 'premarket', label: 'Pre-market' }, { value: 'intraday', label: 'Intraday' }, { value: 'postmarket', label: 'Post-market' }, { value: 'unknown', label: 'Unknown' }],
};
export const BACKTEST_PHASE_LABELS: Record<UiLanguage, Record<string, string>> = { zh: { premarket: '盘前', intraday: '盘中', postmarket: '盘后', unknown: '未知' }, en: { premarket: 'Pre-market', intraday: 'Intraday', postmarket: 'Post-market', unknown: 'Unknown' } };
export const BACKTEST_OUTCOME_LABELS: Record<UiLanguage, Record<string, string>> = { zh: { win: '盈利', loss: '亏损', neutral: '中性' }, en: { win: 'Win', loss: 'Loss', neutral: 'Neutral' } };
export const BACKTEST_STATUS_LABELS: Record<UiLanguage, Record<string, string>> = { zh: { completed: '已完成', insufficient: '数据不足', insufficient_data: '数据不足', error: '错误' }, en: { completed: 'Completed', insufficient: 'Insufficient data', insufficient_data: 'Insufficient data', error: 'Error' } };
export const BACKTEST_MOVEMENT_LABELS: Record<UiLanguage, Record<string, string>> = { zh: { up: '上涨', down: '下跌', flat: '持平' }, en: { up: 'Up', down: 'Down', flat: 'Flat' } };
export const BACKTEST_DIRECTION_EXPECTED_LABELS: Record<UiLanguage, Record<string, string>> = { zh: { long: '做多', cash: '空仓', up: '看涨', down: '看跌', not_down: '不看跌', flat: '持平' }, en: { long: 'Long', cash: 'Cash', up: 'Bullish', down: 'Bearish', not_down: 'Not bearish', flat: 'Flat' } };

export const ALERT_TYPE_LABELS: Record<UiLanguage, Record<AlertType, string>> = {
  zh: { price_cross: '价格突破', price_change_percent: '涨跌幅', volume_spike: '成交量放大', ma_price_cross: '价格均线穿越', rsi_threshold: 'RSI 阈值', macd_cross: 'MACD 金叉/死叉', kdj_cross: 'KDJ 金叉/死叉', cci_threshold: 'CCI 阈值', portfolio_stop_loss: '组合止损', portfolio_concentration: '组合集中度', portfolio_drawdown: '组合回撤', portfolio_price_stale: '组合价格状态', market_light_status: '大盘红绿灯状态', market_light_score_drop: '大盘红绿灯分数下降' },
  en: { price_cross: 'Price crossing', price_change_percent: 'Price change', volume_spike: 'Volume spike', ma_price_cross: 'Price/MA crossing', rsi_threshold: 'RSI threshold', macd_cross: 'MACD cross', kdj_cross: 'KDJ cross', cci_threshold: 'CCI threshold', portfolio_stop_loss: 'Portfolio stop loss', portfolio_concentration: 'Portfolio concentration', portfolio_drawdown: 'Portfolio drawdown', portfolio_price_stale: 'Portfolio price status', market_light_status: 'Market traffic light status', market_light_score_drop: 'Market traffic light score drop' },
};
export const ALERT_SEVERITY_LABELS: Record<UiLanguage, Record<string, string>> = { zh: { info: '提示', warning: '警告', critical: '严重' }, en: { info: 'Info', warning: 'Warning', critical: 'Critical' } };
export const ALERT_SCOPE_LABELS: Record<UiLanguage, Record<AlertTargetScope, string>> = { zh: { single_symbol: '单标的', watchlist: '自选股', portfolio_holdings: '持仓标的', portfolio_account: '持仓账户', market: '大盘市场' }, en: { single_symbol: 'Single symbol', watchlist: 'Watchlist', portfolio_holdings: 'Portfolio holdings', portfolio_account: 'Portfolio account', market: 'Market' } };
export const ALERT_MARKET_REGION_LABELS: Record<UiLanguage, Record<MarketRegion, string>> = { zh: { cn: 'A 股', hk: '港股', us: '美股' }, en: { cn: 'A-shares', hk: 'Hong Kong', us: 'US' } };
export const ALERT_MARKET_LIGHT_STATUS_LABELS: Record<UiLanguage, Record<MarketLightStatus, string>> = { zh: { yellow: '黄灯', red: '红灯' }, en: { yellow: 'Yellow', red: 'Red' } };
export const ALERT_DIRECTION_LABELS = {
  zh: { abovePrice: '上破', belowPrice: '下破', upChange: '上涨', downChange: '下跌', aboveThreshold: '上穿', belowThreshold: '下穿', bullishCross: '金叉', bearishCross: '死叉', stopLossNear: '接近止损', stopLossBreach: '已触发止损' },
  en: { abovePrice: 'above', belowPrice: 'below', upChange: 'up', downChange: 'down', aboveThreshold: 'above', belowThreshold: 'below', bullishCross: 'bullish cross', bearishCross: 'bearish cross', stopLossNear: 'Near stop loss', stopLossBreach: 'Stop loss breached' },
} as const;
export const ALERT_LIST_TEXT = {
  zh: { title: '告警规则', subtitle: '{total} 条规则', enabledFilter: '启停状态', alertTypeFilter: '规则类型', targetFilter: '目标', targetFilterAll: '全部目标', loadingRules: '正在加载规则', emptyTitle: '暂无告警规则', emptyDescription: '创建规则后，后台评估任务会按轮询周期处理已启用的告警。', rule: '规则', target: '目标', type: '类型', parameters: '参数', status: '状态', cooldown: '冷却', updatedAt: '更新时间', action: '操作', source: '来源：{source}', allAccounts: '全部账户', accountTarget: '账户 {target}', enabled: '已启用', disabled: '已停用', coolingDown: '冷却中', notCoolingDown: '未冷却', childTargetCooldown: '子目标见触发历史', test: '测试', testing: '测试中', disabling: '停用中', enabling: '启用中', disable: '停用', enable: '启用', delete: '删除', cancel: '取消', scoreDropAtLeast: 'Score 下降 >= {value}', deleteAria: '删除 {name}', deleteTitle: '删除告警规则', deleteMessage: '确认删除「{name}」吗？该操作不会删除已有触发历史。' },
  en: { title: 'Alert rules', subtitle: '{total} rules', enabledFilter: 'Status', alertTypeFilter: 'Rule type', targetFilter: 'Target', targetFilterAll: 'All targets', loadingRules: 'Loading rules', emptyTitle: 'No alert rules', emptyDescription: 'After rules are created, background evaluation processes enabled alerts on the polling schedule.', rule: 'Rule', target: 'Target', type: 'Type', parameters: 'Parameters', status: 'Status', cooldown: 'Cooldown', updatedAt: 'Updated', action: 'Actions', source: 'Source: {source}', allAccounts: 'All accounts', accountTarget: 'Account {target}', enabled: 'Enabled', disabled: 'Disabled', coolingDown: 'Cooling down', notCoolingDown: 'Not cooling down', childTargetCooldown: 'Per-target cooldowns are in trigger history', test: 'Test', testing: 'Testing', disabling: 'Disabling', enabling: 'Enabling', disable: 'Disable', enable: 'Enable', delete: 'Delete', cancel: 'Cancel', scoreDropAtLeast: 'Score drop >= {value}', deleteAria: 'Delete {name}', deleteTitle: 'Delete alert rule', deleteMessage: 'Delete "{name}"? Existing trigger history will be kept.' },
} as const;
export const ALERT_TRIGGER_HISTORY_TEXT = {
  zh: {
    loading: '正在加载触发历史',
    emptyTitle: '暂无触发历史',
    emptyDescription: '后台评估会记录已触发、已跳过、降级和失败状态；正常未触发不会写入历史。',
    status: '状态',
    phaseQuality: '阶段 / 质量',
    target: '目标',
    observedValue: '观察值',
    threshold: '阈值',
    dataSource: '数据源',
    dataTime: '数据时间',
    reason: '原因',
    qualityPrefix: '质量：',
    statusLabels: { triggered: '已触发', skipped: '已跳过', degraded: '降级', failed: '失败' },
    qualityLevels: { good: '良好', usable: '可用', limited: '受限', poor: '较差' },
    blockLabels: { quote: '行情', daily_bars: '日线', technical: '技术', news: '新闻', fundamentals: '基本面', chip: '筹码' },
    blockStatusLabels: {
      available: '可用',
      missing: '缺失',
      not_supported: '不支持',
      fallback: '降级',
      stale: '过期',
      estimated: '估算',
      partial: '部分可用',
      fetch_failed: '抓取失败',
    },
    dataSources: {
      realtime_quote: '实时行情',
      daily_data: '日线数据',
      portfolio_risk: '持仓风险',
      portfolio_snapshot: '持仓快照',
      market_light: '大盘红绿灯',
    },
    directions: {
      above: '上破',
      below: '下破',
      up: '上涨',
      down: '下跌',
      bullish_cross: '金叉',
      bearish_cross: '死叉',
    },
    marketStatuses: { red: '红灯', yellow: '黄灯', green: '绿灯' },
    stopLossModes: { near: '接近止损', breach: '已触发止损' },
    reasonExact: {
      'No realtime quote available': '暂无实时行情',
      'No valid realtime price available': '暂无有效实时价格',
      'No valid realtime change percent available': '暂无有效实时涨跌幅',
      'No daily volume data available': '暂无日线成交量数据',
      'Malformed daily volume data response': '日线成交量数据格式异常',
      'Average volume is not available': '无法计算平均成交量',
      'No daily indicator data available': '暂无日线技术指标数据',
      'Malformed daily indicator data response': '日线技术指标数据格式异常',
      'Alert evaluation failed': '告警评估失败',
      'dry-run evaluation timed out': '试运行评估超时',
      'market light data is unavailable': '大盘红绿灯数据不可用',
      'previous market light snapshot not found': '未找到上一期大盘红绿灯快照',
      'previous market light snapshot is not before current trade_date': '上一期大盘红绿灯快照不早于当前交易日',
      'previous market light data is unavailable': '上一期大盘红绿灯数据不可用',
      'No targets were evaluated': '未评估到任何目标',
      'No watchlist targets to evaluate': '没有可评估的自选股目标',
      'No portfolio_holdings targets to evaluate': '没有可评估的持仓标的目标',
    },
    reasonPrefixes: {
      'unsupported runtime alert type: ': '不支持的运行时告警类型：',
      'unsupported market alert_type: ': '不支持的大盘告警类型：',
      'unsupported portfolio alert_type: ': '不支持的持仓告警类型：',
      'market light snapshot unavailable: ': '大盘红绿灯快照不可用：',
      'previous market light snapshot unavailable: ': '上一期大盘红绿灯快照不可用：',
    },
    reasonTemplates: {
      priceTriggered: '{code} 价格{direction} {price}',
      priceTriggeredCurrent: '{code} 价格{direction} {price}：当前 {current}',
      priceNotTriggered: '{code} 当前价 {current} 未{direction} {price}',
      changeTriggered: '{code} 涨跌幅{direction} {threshold}%：当前 {current}%',
      changeNotTriggered: '{code} 当前涨跌幅 {current}% 未{direction} {threshold}%',
      volumeTriggered: '{code} 成交量放大：{volume}（均量 {ratio} 倍）',
      volumeNotTriggered: '{code} 成交量倍数 {ratio}x 未超过 {multiplier}x',
      skippedOverflow: '已跳过超过软上限的 {count} 个目标',
      marketStatusMatched: '大盘红绿灯状态为{status}，命中 {statuses}',
      marketStatusNotMatched: '大盘红绿灯状态为{status}，未命中 {statuses}',
      stopLossAffected: '{account} 止损（{mode}）：影响 {count} 个标的',
      stopLossNone: '{account} 止损（{mode}）：无受影响标的',
      concentration: '{account} 集中度最高权重 {value}%',
      drawdown: '{account} 最大回撤 {value}%',
    },
  },
  en: {
    loading: 'Loading trigger history',
    emptyTitle: 'No trigger history',
    emptyDescription: 'Background evaluation records triggered, skipped, degraded, and failed statuses; normal non-triggers are not written.',
    status: 'Status',
    phaseQuality: 'Phase / quality',
    target: 'Target',
    observedValue: 'Observed',
    threshold: 'Threshold',
    dataSource: 'Data source',
    dataTime: 'Data time',
    reason: 'Reason',
    qualityPrefix: 'Quality: ',
    statusLabels: { triggered: 'Triggered', skipped: 'Skipped', degraded: 'Degraded', failed: 'Failed' },
    qualityLevels: { good: 'Good', usable: 'Usable', limited: 'Limited', poor: 'Poor' },
    blockLabels: { quote: 'quote', daily_bars: 'daily bars', technical: 'technical', news: 'news', fundamentals: 'fundamentals', chip: 'chip' },
    blockStatusLabels: {
      available: 'available',
      missing: 'missing',
      not_supported: 'not supported',
      fallback: 'fallback',
      stale: 'stale',
      estimated: 'estimated',
      partial: 'partial',
      fetch_failed: 'fetch failed',
    },
    dataSources: {
      realtime_quote: 'Realtime quote',
      daily_data: 'Daily data',
      portfolio_risk: 'Portfolio risk',
      portfolio_snapshot: 'Portfolio snapshot',
      market_light: 'Market light',
    },
    directions: {
      above: 'above',
      below: 'below',
      up: 'up',
      down: 'down',
      bullish_cross: 'bullish cross',
      bearish_cross: 'bearish cross',
    },
    marketStatuses: { red: 'red', yellow: 'yellow', green: 'green' },
    stopLossModes: { near: 'near', breach: 'breach' },
    reasonExact: {},
    reasonPrefixes: {},
    reasonTemplates: {
      priceTriggered: '{code} price {direction} {price}',
      priceTriggeredCurrent: '{code} price {direction} {price}: current = {current}',
      priceNotTriggered: '{code} price {current} did not cross {direction} {price}',
      changeTriggered: '{code} change {direction} {threshold}%: current = {current}%',
      changeNotTriggered: '{code} change {current}% did not cross {direction} {threshold}%',
      volumeTriggered: '{code} volume spike: {volume} ({ratio}x avg)',
      volumeNotTriggered: '{code} volume ratio {ratio}x did not exceed {multiplier}x',
      skippedOverflow: 'Skipped {count} targets over soft cap',
      marketStatusMatched: 'Market Light status {status} matched {statuses}',
      marketStatusNotMatched: 'Market Light status {status} did not match {statuses}',
      stopLossAffected: '{account} stop-loss {mode}: {count} affected symbols',
      stopLossNone: '{account} stop-loss {mode}: no affected symbols',
      concentration: '{account} concentration top weight {value}%',
      drawdown: '{account} max drawdown {value}%',
    },
  },
} as const;
export const ALERT_ENABLED_FILTER_OPTIONS: Record<UiLanguage, Array<Option<'all' | 'enabled' | 'disabled'>>> = { zh: [{ value: 'all', label: '全部状态' }, { value: 'enabled', label: '已启用' }, { value: 'disabled', label: '已停用' }], en: [{ value: 'all', label: 'All statuses' }, { value: 'enabled', label: 'Enabled' }, { value: 'disabled', label: 'Disabled' }] };
export const ALERT_TYPE_FILTER_OPTIONS: Record<UiLanguage, Array<Option<'all' | AlertType>>> = { zh: [{ value: 'all', label: '全部类型' }, ...alertTypes.map((value) => ({ value, label: ALERT_TYPE_LABELS.zh[value] }))], en: [{ value: 'all', label: 'All types' }, ...alertTypes.map((value) => ({ value, label: ALERT_TYPE_LABELS.en[value] }))] };
export const ALERT_PAGE_TEXT = {
  zh: {
    title: '告警中心',
    description: '管理事件告警、日线技术指标、自选股、持仓/账户联动和大盘红绿灯规则，执行一次性测试，并查看后台评估任务记录的触发历史。',
    createRule: '创建规则',
    createSuccessTitle: '创建成功',
    createSuccessMessage: '已创建告警规则「{name}」',
    close: '关闭',
    mainTablistAria: '告警中心主视图',
    tabRules: '告警规则',
    tabTriggers: '触发历史',
    tabNotifications: '通知尝试记录',
    panelRulesAria: '告警规则',
    panelTriggersAria: '触发历史',
    panelNotificationsAria: '通知尝试记录',
    testResultTitle: '测试结果',
    loadingNotifications: '正在加载通知尝试记录',
    emptyNotificationsTitle: '暂无通知尝试记录',
    emptyNotificationsDescription: '当前没有可展示的通知尝试明细；告警触发仍会按已配置通知渠道发送。',
    channel: '渠道',
    status: '状态',
    errorCode: '错误码',
    latency: '耗时',
    time: '时间',
    diagnostics: '诊断',
    statusPrefix: '状态：',
    triggeredPrefix: '触发：',
    observedPrefix: '观察值：',
    yes: '是',
    no: '否',
    evalSummary: '评估 {evaluated} · 触发 {triggered} · 降级 {degraded} · 跳过 {skipped}',
    success: '成功',
    failure: '失败',
    cooldownActive: '冷却抑制',
    cooldownReadFailed: '冷却读取失败',
    noiseSuppressed: '降噪抑制',
    noChannel: '无渠道',
    channelCooldown: '业务冷却',
    channelCooldownReadFailed: '冷却读取失败',
    channelNoiseSuppressed: '通知降噪',
    channelNoChannel: '无可用渠道',
    channelDispatch: '通知调度',
    channelContext: '会话渠道',
  },
  en: {
    title: 'Alert center',
    description: 'Manage event alerts, daily technical rules, watchlist, portfolio/account rules, and market traffic-light rules; run one-off tests; and review trigger history from background evaluation.',
    createRule: 'Create rule',
    createSuccessTitle: 'Created',
    createSuccessMessage: 'Created alert rule "{name}"',
    close: 'Close',
    mainTablistAria: 'Alert center views',
    tabRules: 'Alert rules',
    tabTriggers: 'Trigger history',
    tabNotifications: 'Notification attempts',
    panelRulesAria: 'Alert rules',
    panelTriggersAria: 'Trigger history',
    panelNotificationsAria: 'Notification attempts',
    testResultTitle: 'Test result',
    loadingNotifications: 'Loading notification attempts',
    emptyNotificationsTitle: 'No notification attempts',
    emptyNotificationsDescription: 'No per-channel notification attempts to show yet. Triggered alerts still send through configured channels.',
    channel: 'Channel',
    status: 'Status',
    errorCode: 'Error code',
    latency: 'Latency',
    time: 'Time',
    diagnostics: 'Diagnostics',
    statusPrefix: 'Status:',
    triggeredPrefix: 'Triggered:',
    observedPrefix: 'Observed:',
    yes: 'Yes',
    no: 'No',
    evalSummary: 'Evaluated {evaluated} · Triggered {triggered} · Degraded {degraded} · Skipped {skipped}',
    success: 'Success',
    failure: 'Failed',
    cooldownActive: 'Cooldown suppressed',
    cooldownReadFailed: 'Cooldown read failed',
    noiseSuppressed: 'Noise suppressed',
    noChannel: 'No channel',
    channelCooldown: 'Business cooldown',
    channelCooldownReadFailed: 'Cooldown read failed',
    channelNoiseSuppressed: 'Noise suppression',
    channelNoChannel: 'No available channel',
    channelDispatch: 'Dispatch',
    channelContext: 'Session channel',
  },
} as const;
export const ALERT_FORM_TEXT = {
  zh: { accountLoadFailed: '账户加载失败', allAccounts: '全部账户', cardTitle: '创建告警规则', cardSubtitle: 'Web 告警中心', ruleName: '规则名称', ruleNamePlaceholder: '可选，例如 茅台价格突破', targetScope: '目标范围', targetCode: '标的代码', target: '目标', marketRegion: '市场区域', account: '账户', ruleType: '规则类型', severity: '严重级别', direction: '方向', priceThreshold: '价格阈值', changePctThreshold: '涨跌幅阈值（%）', volumeMultiplier: '成交量放大倍数', crossDirection: '交叉方向', thresholdDirection: '阈值方向', maDirection: '穿越方向', maWindow: '均线周期', rsiPeriod: 'RSI 周期', rsiThreshold: 'RSI 阈值', fastPeriod: '快线周期', slowPeriod: '慢线周期', signalPeriod: '信号周期', kdjPeriod: 'KDJ 周期', kPeriod: 'K 平滑周期', dPeriod: 'D 平滑周期', cciPeriod: 'CCI 周期', cciThreshold: 'CCI 阈值', stopLossMode: '止损模式', triggerStatus: '触发状态', scoreDropThreshold: 'Score 下降阈值', enableAfterCreate: '创建后立即启用', creating: '创建中...', create: '创建规则', positiveNumber: '{label}必须是大于 0 的数字', integerRange: '{label}必须是 {min} 到 {max} 的整数', required: '{label}不能为空', finiteNumber: '{label}必须是有效数字', rsiRange: 'RSI 阈值必须在 0 到 100 之间', requiredBarsLimit: '{label} 周期组合需要 {requiredBars} 根日线，最多支持 {max} 根', fastLessThanSlow: '快线周期必须小于慢线周期', noMarketStatus: '至少选择一个红绿灯状态', invalidStockCode: '股票代码格式不正确' },
  en: { accountLoadFailed: 'Account loading failed', allAccounts: 'All accounts', cardTitle: 'Create alert rule', cardSubtitle: 'Web alert center', ruleName: 'Rule name', ruleNamePlaceholder: 'Optional, e.g. Moutai price crossing', targetScope: 'Target scope', targetCode: 'Symbol', target: 'Target', marketRegion: 'Market region', account: 'Account', ruleType: 'Rule type', severity: 'Severity', direction: 'Direction', priceThreshold: 'Price threshold', changePctThreshold: 'Change threshold (%)', volumeMultiplier: 'Volume multiplier', crossDirection: 'Cross direction', thresholdDirection: 'Threshold direction', maDirection: 'Cross direction', maWindow: 'MA window', rsiPeriod: 'RSI period', rsiThreshold: 'RSI threshold', fastPeriod: 'Fast period', slowPeriod: 'Slow period', signalPeriod: 'Signal period', kdjPeriod: 'KDJ period', kPeriod: 'K smoothing period', dPeriod: 'D smoothing period', cciPeriod: 'CCI period', cciThreshold: 'CCI threshold', stopLossMode: 'Stop-loss mode', triggerStatus: 'Trigger status', scoreDropThreshold: 'Score drop threshold', enableAfterCreate: 'Enable immediately', creating: 'Creating...', create: 'Create rule', positiveNumber: '{label} must be a number greater than 0', integerRange: '{label} must be an integer from {min} to {max}', required: '{label} is required', finiteNumber: '{label} must be a valid number', rsiRange: 'RSI threshold must be between 0 and 100', requiredBarsLimit: '{label} requires {requiredBars} daily bars, up to {max} are supported', fastLessThanSlow: 'Fast period must be less than slow period', noMarketStatus: 'Select at least one traffic light status', invalidStockCode: 'Invalid stock code format' },
} as const;
export const ALERT_SYMBOL_TYPE_OPTIONS: Record<UiLanguage, Array<Option<AlertType>>> = { zh: symbolAlertTypes.map((value) => ({ value, label: ALERT_TYPE_LABELS.zh[value] })), en: symbolAlertTypes.map((value) => ({ value, label: ALERT_TYPE_LABELS.en[value] })) };
export const ALERT_PORTFOLIO_TYPE_OPTIONS: Record<UiLanguage, Array<Option<AlertType>>> = { zh: portfolioAlertTypes.map((value) => ({ value, label: ALERT_TYPE_LABELS.zh[value] })), en: portfolioAlertTypes.map((value) => ({ value, label: ALERT_TYPE_LABELS.en[value] })) };
export const ALERT_MARKET_TYPE_OPTIONS: Record<UiLanguage, Array<Option<AlertType>>> = { zh: marketAlertTypes.map((value) => ({ value, label: ALERT_TYPE_LABELS.zh[value] })), en: marketAlertTypes.map((value) => ({ value, label: ALERT_TYPE_LABELS.en[value] })) };
export const ALERT_TARGET_SCOPE_OPTIONS: Record<UiLanguage, Array<Option<AlertTargetScope>>> = { zh: Object.entries(ALERT_SCOPE_LABELS.zh).map(([value, label]) => ({ value: value as AlertTargetScope, label })), en: Object.entries(ALERT_SCOPE_LABELS.en).map(([value, label]) => ({ value: value as AlertTargetScope, label })) };
export const ALERT_SEVERITY_OPTIONS: Record<UiLanguage, Array<Option<'info' | 'warning' | 'critical'>>> = { zh: Object.entries(ALERT_SEVERITY_LABELS.zh).map(([value, label]) => ({ value: value as 'info' | 'warning' | 'critical', label })), en: Object.entries(ALERT_SEVERITY_LABELS.en).map(([value, label]) => ({ value: value as 'info' | 'warning' | 'critical', label })) };
export const ALERT_PRICE_DIRECTION_OPTIONS: Record<UiLanguage, Array<Option<'above' | 'below'>>> = { zh: [{ value: 'above', label: '上破' }, { value: 'below', label: '下破' }], en: [{ value: 'above', label: 'Crosses above' }, { value: 'below', label: 'Crosses below' }] };
export const ALERT_CHANGE_DIRECTION_OPTIONS: Record<UiLanguage, Array<Option<'up' | 'down'>>> = { zh: [{ value: 'up', label: '上涨达到' }, { value: 'down', label: '下跌达到' }], en: [{ value: 'up', label: 'Rises by' }, { value: 'down', label: 'Falls by' }] };
export const ALERT_THRESHOLD_DIRECTION_OPTIONS: Record<UiLanguage, Array<Option<'above' | 'below'>>> = { zh: [{ value: 'above', label: '上穿' }, { value: 'below', label: '下穿' }], en: [{ value: 'above', label: 'Crosses above' }, { value: 'below', label: 'Crosses below' }] };
export const ALERT_CROSS_DIRECTION_OPTIONS: Record<UiLanguage, Array<Option<'bullish_cross' | 'bearish_cross'>>> = { zh: [{ value: 'bullish_cross', label: '金叉' }, { value: 'bearish_cross', label: '死叉' }], en: [{ value: 'bullish_cross', label: 'Bullish cross' }, { value: 'bearish_cross', label: 'Bearish cross' }] };
export const ALERT_STOP_LOSS_MODE_OPTIONS: Record<UiLanguage, Array<Option<PortfolioStopLossMode>>> = { zh: [{ value: 'near', label: '接近止损' }, { value: 'breach', label: '已触发止损' }], en: [{ value: 'near', label: 'Near stop loss' }, { value: 'breach', label: 'Stop loss breached' }] };
export const ALERT_MARKET_REGION_OPTIONS: Record<UiLanguage, Array<Option<MarketRegion>>> = { zh: [{ value: 'cn', label: 'A 股（cn）' }, { value: 'hk', label: '港股（hk）' }, { value: 'us', label: '美股（us）' }], en: [{ value: 'cn', label: 'A-shares (cn)' }, { value: 'hk', label: 'Hong Kong (hk)' }, { value: 'us', label: 'US (us)' }] };
export const ALERT_MARKET_LIGHT_STATUS_OPTIONS: Record<UiLanguage, Array<Option<MarketLightStatus>>> = { zh: [{ value: 'red', label: '红灯' }, { value: 'yellow', label: '黄灯' }], en: [{ value: 'red', label: 'Red' }, { value: 'yellow', label: 'Yellow' }] };

export const PORTFOLIO_TEXT = {
  zh: { documentTitle: '持仓分析 - DSA', title: '持仓管理', description: '组合快照、手工录入、CSV 导入与风险分析（支持全组合 / 单账户切换）', accountView: '账户视图', allAccounts: '全部账户', costMethod: '成本口径', fifo: '先进先出（FIFO）', avg: '均价成本（AVG）', collapseCreate: '收起新建', createAccount: '新建账户', deleteAccount: '删除账户', deletingAccount: '删除中...', deleteAccountTitle: '删除持仓账户', deleteAccountConfirm: '确认删除', deleteAccountMessage: '确认删除账户 {name}（#{id}）吗？删除后该账户会从默认列表、快照、风险和录入入口隐藏；历史流水不会物理删除。', refreshing: '刷新中...', refreshData: '刷新数据', noAccounts: '还没有可用账户，请先创建账户后再录入交易或导入 CSV。', riskDegraded: '风险模块降级', operationHint: '操作提示', analysisTask: '分析任务', snapshotPartialTitle: '组合估值限制', totalEquity: '总权益', totalMarketValue: '总市值', totalCash: '总现金', fxStatus: '汇率状态', refreshFx: '刷新汇率', stale: '过期', latest: '最新', fxRefreshResult: '汇率刷新结果', positionsTitle: '持仓明细', countItems: '共 {count} 项', noPositionsTitle: '当前无持仓数据', noPositionsDescription: '录入交易或导入 CSV 后，这里会展示按账户汇总的持仓明细。', account: '账户', code: '代码', quantity: '数量', avgCost: '均价', lastPrice: '现价', marketValue: '市值', unrealizedPnl: '未实现盈亏', returnPct: '收益率', action: '操作', submitting: '提交中', analyze: '分析', sectorConcentration: '行业集中度分布', positionConcentrationFallback: '行业数据暂不可用，当前展示个股集中度', noConcentrationTitle: '暂无集中度数据', noConcentrationDescription: '风险模块完成计算后，这里会展示行业或个股维度的集中度分布。', displayScope: '展示口径', sectorDimension: '行业维度', positionDimensionFallback: '个股维度（降级显示）', sectorAlert: '板块集中度告警', topWeight: 'Top1 权重', yes: '是', no: '否', writeBlocked: '当前处于“全部账户”视图。为避免误写，请先选择一个具体账户后再进行手工录入或 CSV 提交。', drawdownMonitor: '回撤监控', maxDrawdown: '最大回撤', currentDrawdown: '当前回撤', alert: '告警', stopLossWarning: '止损接近预警', triggeredCount: '触发数', nearCount: '接近数', scope: '口径', accountCount: '账户数', currency: '计价币种', costMethodShort: '成本法', aiRiskSignals: 'AI 风险信号', aiRiskUnavailable: '信号风险暂不可用', aiRiskTotal: '风险信号', sellSignals: '卖出', reduceSignals: '减仓', alertSignals: '预警', noAiRiskSignals: '暂无防御型信号' },
  en: { documentTitle: 'Portfolio Analysis - DSA', title: 'Portfolio management', description: 'Portfolio snapshots, manual entries, CSV import, and risk analysis with full-portfolio or single-account views', accountView: 'Account view', allAccounts: 'All accounts', costMethod: 'Cost method', fifo: 'FIFO', avg: 'Average cost', collapseCreate: 'Collapse', createAccount: 'New account', deleteAccount: 'Delete account', deletingAccount: 'Deleting...', deleteAccountTitle: 'Delete portfolio account', deleteAccountConfirm: 'Delete account', deleteAccountMessage: 'Delete account {name} (#{id})? It will be hidden from default lists, snapshots, risk views, and entry forms; historical ledger rows are not physically deleted.', refreshing: 'Refreshing...', refreshData: 'Refresh data', noAccounts: 'No accounts are available. Create an account before entering trades or importing CSV files.', riskDegraded: 'Risk module degraded', operationHint: 'Operation hint', analysisTask: 'Analysis task', snapshotPartialTitle: 'Portfolio valuation limitations', totalEquity: 'Total equity', totalMarketValue: 'Total market value', totalCash: 'Total cash', fxStatus: 'FX status', refreshFx: 'Refresh FX', stale: 'Stale', latest: 'Current', fxRefreshResult: 'FX refresh result', positionsTitle: 'Positions', countItems: '{count} items', noPositionsTitle: 'No positions', noPositionsDescription: 'After you enter trades or import CSV data, account-level positions appear here.', account: 'Account', code: 'Code', quantity: 'Quantity', avgCost: 'Avg cost', lastPrice: 'Last price', marketValue: 'Market value', unrealizedPnl: 'Unrealized P/L', returnPct: 'Return', action: 'Action', submitting: 'Submitting', analyze: 'Analyze', sectorConcentration: 'Sector concentration', positionConcentrationFallback: 'Sector data unavailable; showing position concentration', noConcentrationTitle: 'No concentration data', noConcentrationDescription: 'Sector or position concentration appears after the risk module finishes.', displayScope: 'Display scope', sectorDimension: 'Sector', positionDimensionFallback: 'Position fallback', sectorAlert: 'Sector concentration alert', topWeight: 'Top1 weight', yes: 'Yes', no: 'No', writeBlocked: 'You are viewing all accounts. Select a specific account before manual entry or CSV submission to avoid writing to the wrong scope.', drawdownMonitor: 'Drawdown monitor', maxDrawdown: 'Max drawdown', currentDrawdown: 'Current drawdown', alert: 'Alert', stopLossWarning: 'Stop-loss proximity warning', triggeredCount: 'Triggered', nearCount: 'Near', scope: 'Scope', accountCount: 'Accounts', currency: 'Quote currency', costMethodShort: 'Cost method', aiRiskSignals: 'AI risk signals', aiRiskUnavailable: 'Signal risk unavailable', aiRiskTotal: 'Risk signals', sellSignals: 'Sell', reduceSignals: 'Reduce', alertSignals: 'Alert', noAiRiskSignals: 'No defensive signals' },
} as const;
export const PORTFOLIO_SIDE_LABELS: Record<UiLanguage, Record<PortfolioSide, string>> = { zh: { buy: '买入', sell: '卖出' }, en: { buy: 'Buy', sell: 'Sell' } };
export const PORTFOLIO_CASH_DIRECTION_LABELS: Record<UiLanguage, Record<PortfolioCashDirection, string>> = { zh: { in: '流入', out: '流出' }, en: { in: 'Inflow', out: 'Outflow' } };
export const PORTFOLIO_CORPORATE_ACTION_LABELS: Record<UiLanguage, Record<PortfolioCorporateActionType, string>> = { zh: { cash_dividend: '现金分红', split_adjustment: '拆并股调整' }, en: { cash_dividend: 'Cash dividend', split_adjustment: 'Split adjustment' } };
