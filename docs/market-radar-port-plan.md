# Plan: Port 持仓雷达功能 to DSA

> 本文档与实现计划对齐。**以代码与本文件为准**；旧草案中「扩 DecisionSignal 字段 / 新建 `src/data_provider/` 平行 Fetcher / localStorage 持仓主账本」等主张已废弃。

## 定位

| 能力 | 角色 | 触发 |
|------|------|------|
| **分析**（已有） | LLM 报告 / DecisionSignal | `analyze_stock`、定时任务 |
| **盯盘**（新增） | R1–R77 纪律规则 + ~12 条可计算四色信号 | 按需 API；后续实时大盘页 |

共享两层：`data_provider` 行情/K 线 + 规则 Catalog。盯盘不跑 LLM；分析不必等盯盘。

命名空间：

- **R1–R77**：纪律规则（本模块）
- **B1–B7**：`CORE_TRADING_SKILL_POLICY` / Skill YAML `core_rules`（分析基线，勿与 R 混用）

## 阶段

### M1 — 后端底座（已实现方向）

| 组件 | 路径 |
|------|------|
| 腾讯批量实时 | `AkshareFetcher.get_realtime_quotes_tencent` + `DataFetcherManager.get_realtime_quotes` |
| 规则 Catalog | `src/services/trading_signal_rules.py` |
| Evaluator | `src/services/trading_signal_service.py`（移植 `buildSignals`） |
| Monitor / Notifier | `trading_signal_monitor.py` / `trading_signal_notifier.py` |
| API | `/api/v1/trading-signals/rules`、`/compute`、`/latest` |
| 配置 | `ENABLE_TRADING_SIGNALS`（默认 false）、`TRADING_SIGNAL_NOTIFY_*` |
| Pipeline | `enable_trading_signals` 时 fail-open 写入 `result.trading_signal_summary` |

**明确不做（M1）：**

- 不给 `DecisionSignalRecord` 增加 `signal_color` / `signal_rule_ids`
- 不新建 `src/data_provider/tencent_realtime_fetcher.py`
- 不把 77 条文案当成 77 条可执行规则
- MVP 先 A 股/ETF（6 位数字代码）

### M2 — 实时大盘页（已实现方向）

- API：`GET /api/v1/market-radar/overview`、`GET /api/v1/market-radar/chart`
- Web：`apps/dsa-web/src/pages/MarketRadarPage.tsx` + `components/market-radar/*`
- 路由：侧边栏「首页」→ `/`（MarketRadar）；「诊股」→ `/analysis`（原分析工作台）；旧 `/market-radar` 重定向到 `/`
- 持仓/自选复用现有 Portfolio / watchlist API；持仓管理跳转 `/portfolio`，不用 localStorage 再造账本
- 仍依赖 `ENABLE_TRADING_SIGNALS=true`
- 指数区：主条显示本机「常用」指数；顶栏「更多指数」打开抽屉（跨市场全表、按区 Tab 筛选，设/取消常用，localStorage）

### M3 — 增强（进行中 / 待做）

- Overview 持仓/自选：去掉 A 股硬过滤，统一 `get_realtime_quotes`（已实现方向）
- 图表：日 K 走通用 `get_daily_data`；非 A 股分时暂无则降级（已实现方向）
- 信号：多市场日线后再算；无 bars 时列表保留报价并显示「信号暂不可用」（已实现方向）
- 分析 context 注入触发 R-id
- 点选主条指数后按所属市场过滤持仓/自选（已定交互，暂未做）
- B↔R 对照收敛（可选）

## 四色含义

| 颜色 | 含义 |
|------|------|
| GREEN | 风险/警示（优先防风险，不是买点） |
| ORANGE | 预警/需确认 |
| BLUE | 观察 |
| RED | 偏多确认（观察买点，非自动下单） |

注意：与行情「红涨绿跌」不是同一套语义。

## 验证（M1）

```bash
python -m pytest tests/test_trading_signal_service.py tests/test_tencent_realtime_batch.py -v
ENABLE_TRADING_SIGNALS=true
# GET /api/v1/trading-signals/rules
# POST /api/v1/trading-signals/compute  {"codes":["600519"],"notify":false}
```
