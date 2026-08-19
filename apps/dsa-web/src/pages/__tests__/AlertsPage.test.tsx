import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AlertsPage from '../AlertsPage';

const {
  listRules,
  listRuleTargets,
  createRule,
  getRule,
  deleteRule,
  enableRule,
  disableRule,
  testRule,
  listTriggers,
  listNotifications,
} = vi.hoisted(() => ({
  listRules: vi.fn(),
  listRuleTargets: vi.fn(),
  createRule: vi.fn(),
  getRule: vi.fn(),
  deleteRule: vi.fn(),
  enableRule: vi.fn(),
  disableRule: vi.fn(),
  testRule: vi.fn(),
  listTriggers: vi.fn(),
  listNotifications: vi.fn(),
}));

vi.mock('../../api/alerts', () => ({
  alertsApi: {
    listRules,
    listRuleTargets,
    createRule,
    getRule,
    deleteRule,
    enableRule,
    disableRule,
    testRule,
    listTriggers,
    listNotifications,
  },
}));

vi.mock('../../api/portfolio', () => ({
  portfolioApi: {
    getAccounts: vi.fn().mockResolvedValue({ accounts: [] }),
    getSnapshot: vi.fn().mockResolvedValue({ positions: [] }),
  },
}));

vi.mock('../../api/systemConfig', () => ({
  systemConfigApi: {
    getWatchlist: vi.fn().mockResolvedValue([]),
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(),
  },
}));

vi.mock('../../components/StockAutocomplete', () => ({
  StockAutocomplete: ({
    value,
    onChange,
    ariaLabel,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <input
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const parsedError = {
  title: '加载失败',
  message: '告警 API 不可用',
  rawMessage: '告警 API 不可用',
  category: 'http_error' as const,
  status: 500,
};

const rule = {
  id: 1,
  name: '茅台价格突破',
  targetScope: 'single_symbol' as const,
  target: '600519',
  alertType: 'price_cross' as const,
  parameters: { direction: 'above' as const, price: 1800 },
  severity: 'warning' as const,
  enabled: true,
  source: 'api',
  createdAt: '2026-05-18T09:00:00',
  updatedAt: '2026-05-18T09:30:00',
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  listRules.mockImplementation(async (query: { page?: number; pageSize?: number } = {}) => {
    if (query.pageSize === 100) {
      return { items: [rule], total: 1, page: 1, pageSize: 100 };
    }
    return { items: [rule], total: 1, page: query.page ?? 1, pageSize: query.pageSize ?? 10 };
  });
  listRuleTargets.mockResolvedValue({ items: [{ target: '600519', targetScope: 'single_symbol' }] });
  listTriggers.mockResolvedValue({
    items: [
      {
        id: 10,
        ruleId: 1,
        ruleName: '茅台价格突破',
        alertType: 'price_cross',
        target: '600519',
        observedValue: 1801,
        threshold: 1800,
        reason: '600519 price above 1800',
        dataSource: 'realtime_quote',
        dataTimestamp: '2026-05-18T09:30:00',
        triggeredAt: '2026-05-18T09:30:01',
        status: 'triggered',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  });
  listNotifications.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  getRule.mockImplementation(async (ruleId: number) => ({ ...rule, id: ruleId }));
  testRule.mockResolvedValue({
    ruleId: 1,
    status: 'triggered',
    triggered: true,
    observedValue: 1801,
    message: '600519 price above 1800',
  });
  createRule.mockResolvedValue(rule);
  disableRule.mockResolvedValue({ ...rule, enabled: false });
  enableRule.mockResolvedValue(rule);
  deleteRule.mockResolvedValue({ deleted: 1 });
});

describe('AlertsPage', () => {
  it('loads rules, trigger history, and notification empty state', async () => {
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('管理事件告警、日线技术指标、自选股、持仓/账户联动和大盘红绿灯规则，执行一次性测试，并查看后台评估任务记录的触发历史。')).toBeInTheDocument();
    expect(await screen.findAllByText('茅台价格突破')).not.toHaveLength(0);
    expect(screen.queryByText('暂无通知尝试记录')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '触发历史' }));
    expect(await screen.findByText('600519 价格上破 1800')).toBeInTheDocument();
    expect(screen.getAllByText('茅台价格突破').length).toBeGreaterThan(0);
    expect(screen.getAllByText('600519').length).toBeGreaterThan(0);
    expect(screen.getByText('1 条记录')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '通知尝试记录' }));
    expect(await screen.findByText('暂无通知尝试记录')).toBeInTheDocument();
    expect(listRules).toHaveBeenCalledWith({
      enabled: undefined,
      alertType: undefined,
      target: undefined,
      page: 1,
      pageSize: 10,
    });
    expect(listTriggers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: undefined,
      ruleId: undefined,
      target: undefined,
      sortBy: 'triggered_at',
      sortOrder: 'desc',
    });
    expect(listNotifications).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('resolves missing trigger rule names via rule detail API', async () => {
    listTriggers.mockResolvedValueOnce({
      items: [
        {
          id: 18,
          ruleId: 18,
          target: 'AAPL',
          observedValue: null,
          threshold: null,
          reason: 'Yahoo Finance unavailable',
          dataSource: 'daily_data',
          dataTimestamp: null,
          triggeredAt: '2026-08-07T08:08:00',
          status: 'failed',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    getRule.mockResolvedValueOnce({
      ...rule,
      id: 18,
      name: 'AAPL KDJ bearish_cross',
      target: 'AAPL',
      alertType: 'kdj_cross',
    });

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: '触发历史' }));
    await waitFor(() => expect(getRule).toHaveBeenCalledWith(18));
    expect(await screen.findByText('AAPL KDJ bearish_cross')).toBeInTheDocument();
    expect(screen.queryByText('规则 #18')).not.toBeInTheDocument();
  });

  it('filters trigger history by status, rule, and target', async () => {
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: '触发历史' }));
    expect(await screen.findByText('600519 价格上破 1800')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '全部状态' }));
    fireEvent.click(await screen.findByRole('option', { name: '失败' }));
    await waitFor(() => expect(listTriggers).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'failed',
      page: 1,
    })));

    fireEvent.click(screen.getByRole('button', { name: '全部规则' }));
    fireEvent.click(await screen.findByRole('option', { name: '茅台价格突破' }));
    await waitFor(() => expect(listTriggers).toHaveBeenLastCalledWith(expect.objectContaining({
      ruleId: 1,
      page: 1,
    })));

    fireEvent.click(screen.getByRole('button', { name: '全部目标' }));
    fireEvent.click(await screen.findByRole('option', { name: '600519' }));
    await waitFor(() => expect(listTriggers).toHaveBeenLastCalledWith(expect.objectContaining({
      target: '600519',
      page: 1,
    })));

    fireEvent.click(screen.getByRole('button', { name: '按状态排序' }));
    await waitFor(() => expect(listTriggers).toHaveBeenLastCalledWith(expect.objectContaining({
      sortBy: 'status',
      sortOrder: 'asc',
    })));
  });

  it('paginates trigger history', async () => {
    listTriggers
      .mockResolvedValueOnce({
        items: Array.from({ length: 20 }, (_, index) => ({
          id: index + 1,
          ruleId: 1,
          ruleName: '茅台价格突破',
          alertType: 'price_cross',
          target: '600519',
          observedValue: null,
          threshold: 1800,
          reason: `page1-${index}`,
          dataSource: 'daily_data',
          dataTimestamp: null,
          triggeredAt: `2026-05-18T09:${String(index).padStart(2, '0')}:00`,
          status: 'failed',
        })),
        total: 21,
        page: 1,
        pageSize: 20,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 21,
            ruleId: 1,
            ruleName: '茅台价格突破',
            alertType: 'price_cross',
            target: '600519',
            observedValue: 1801,
            threshold: 1800,
            reason: '600519 price above 1800',
            dataSource: 'realtime_quote',
            dataTimestamp: '2026-05-17T09:30:00',
            triggeredAt: '2026-05-17T09:30:01',
            status: 'triggered',
          },
        ],
        total: 21,
        page: 2,
        pageSize: 20,
      });

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: '触发历史' }));
    expect(await screen.findByText('21 条记录')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(listTriggers).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 20,
      status: undefined,
      ruleId: undefined,
      target: undefined,
      sortBy: 'triggered_at',
      sortOrder: 'desc',
    }));
    expect(await screen.findByText('600519 价格上破 1800')).toBeInTheDocument();
  });

  it('runs a dry-run test and renders only declared response fields', async () => {
    listTriggers.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '测试' }));

    await waitFor(() => expect(testRule).toHaveBeenCalledWith(1));
    expect(await screen.findByText('测试结果')).toBeInTheDocument();
    expect(screen.getByText(/600519 price above 1800/)).toBeInTheDocument();
    expect(screen.getByText(/观察值：\s*1801/)).toBeInTheDocument();
    expect(screen.queryByText(/realtime_quote/)).not.toBeInTheDocument();
  });

  it('renders batch dry-run summary and target results', async () => {
    testRule.mockResolvedValueOnce({
      ruleId: 1,
      targetScope: 'watchlist',
      status: 'triggered',
      triggered: true,
      observedValue: 11,
      message: 'Evaluated 2 targets',
      evaluatedCount: 2,
      triggeredCount: 1,
      degradedCount: 1,
      skippedCount: 0,
      targetResults: [
        {
          target: '600519',
          displayTarget: '自选股 - 600519',
          status: 'triggered',
          recordStatus: 'triggered',
          triggered: true,
          observedValue: 11,
          message: 'triggered',
        },
        {
          target: '000001',
          displayTarget: '自选股 - 000001',
          status: 'not_triggered',
          recordStatus: 'degraded',
          triggered: false,
          observedValue: null,
          message: 'degraded',
        },
      ],
    });
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '测试' }));

    expect(await screen.findByText(/评估 2 · 触发 1 · 降级 1 · 跳过 0/)).toBeInTheDocument();
    expect(screen.getByText('自选股 - 600519')).toBeInTheDocument();
    expect(screen.getByText(/not_triggered \/ degraded/)).toBeInTheDocument();
  });

  it('creates a rule through the page form and reloads rules', async () => {
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    await screen.findByText('茅台价格突破');
    fireEvent.click(screen.getByRole('button', { name: '创建规则' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('标的代码'), { target: { value: 'aapl' } });
    fireEvent.change(within(dialog).getByLabelText('价格阈值'), { target: { value: '200' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建规则' }));

    await waitFor(() => {
      expect(createRule).toHaveBeenCalledWith(expect.objectContaining({
        target: 'AAPL',
        alertType: 'price_cross',
        parameters: { direction: 'above', price: 200 },
      }));
    });
    expect(await screen.findByText(/已创建告警规则/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps create form values when create API fails', async () => {
    createRule.mockRejectedValueOnce({ parsedError });
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    await screen.findByText('茅台价格突破');
    fireEvent.click(screen.getByRole('button', { name: '创建规则' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('标的代码'), { target: { value: 'aapl' } });
    fireEvent.change(within(dialog).getByLabelText('价格阈值'), { target: { value: '200' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建规则' }));

    expect(await within(dialog).findByText('加载失败')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('标的代码')).toHaveValue('aapl');
    expect(within(dialog).getByLabelText('价格阈值')).toHaveValue(200);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('clamps rules pagination when a mutation leaves the current page empty', async () => {
    const page2Rule = { ...rule, id: 2, name: '第二页规则', target: 'AAPL' };
    listRules.mockImplementation(async (query: { page?: number; pageSize?: number } = {}) => {
      if (query.pageSize === 100) {
        return { items: [rule, page2Rule], total: 2, page: 1, pageSize: 100 };
      }
      if (query.page === 2) {
        return { items: [page2Rule], total: 11, page: 2, pageSize: 10 };
      }
      return { items: [rule], total: 11, page: 1, pageSize: 10 };
    });

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    expect(await screen.findAllByText('茅台价格突破')).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(await screen.findByText('第二页规则')).toBeInTheDocument();

    listRules.mockImplementation(async (query: { page?: number; pageSize?: number } = {}) => {
      if (query.pageSize === 100) {
        return { items: [rule], total: 1, page: 1, pageSize: 100 };
      }
      if (query.page === 2) {
        return { items: [], total: 10, page: 2, pageSize: 10 };
      }
      return { items: [rule], total: 10, page: 1, pageSize: 10 };
    });

    fireEvent.click(screen.getByLabelText('删除 第二页规则'));
    fireEvent.click(await screen.findByRole('button', { name: '删除' }));

    await waitFor(() => expect(deleteRule).toHaveBeenCalledWith(2));
    await waitFor(() => {
      expect(listRules).toHaveBeenCalledWith({
        enabled: undefined,
        alertType: undefined,
        target: undefined,
        page: 1,
        pageSize: 10,
      });
    });
    expect(await screen.findAllByText('茅台价格突破')).not.toHaveLength(0);
  });

  it('keeps the latest rules response when filter requests resolve out of order', async () => {
    const initialRequest = createDeferred<{ items: Array<typeof rule>; total: number; page: number; pageSize: number }>();
    const filteredRequest = createDeferred<{ items: Array<typeof rule>; total: number; page: number; pageSize: number }>();
    const staleRule = { ...rule, id: 3, name: '旧筛选规则', enabled: true };
    const filteredRule = { ...rule, id: 4, name: '停用规则', enabled: false };
    listRules.mockReset().mockImplementation(async (query: { enabled?: boolean; pageSize?: number } = {}) => {
      if (query.pageSize === 100) {
        return { items: [rule], total: 1, page: 1, pageSize: 100 };
      }
      if (query.enabled === false) {
        return filteredRequest.promise;
      }
      return initialRequest.promise;
    });

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('启停状态'), { target: { value: 'disabled' } });
    await waitFor(() => expect(listRules).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
      pageSize: 10,
    })));

    filteredRequest.resolve({ items: [filteredRule], total: 1, page: 1, pageSize: 10 });
    expect(await screen.findByText('停用规则')).toBeInTheDocument();

    initialRequest.resolve({ items: [staleRule], total: 1, page: 1, pageSize: 10 });
    await waitFor(() => expect(screen.queryByText('旧筛选规则')).not.toBeInTheDocument());
    expect(screen.getByText('停用规则')).toBeInTheDocument();
  });

  it('filters rules by selecting an existing target', async () => {
    listRuleTargets.mockRejectedValueOnce(new Error('targets endpoint unavailable'));

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('茅台价格突破')).toBeInTheDocument();
    await waitFor(() => expect(listRuleTargets).toHaveBeenCalled());
    await waitFor(() => expect(listRules).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
    }));
    fireEvent.change(await screen.findByLabelText('目标'), { target: { value: '600519' } });
    await waitFor(() => expect(listRules).toHaveBeenCalledWith({
      enabled: undefined,
      alertType: undefined,
      target: '600519',
      page: 1,
      pageSize: 10,
    }));
  });

  it('switches between rules, triggers, and notifications tabs', async () => {
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('茅台价格突破')).toBeInTheDocument();
    expect(screen.queryByText('600519 价格上破 1800')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '触发历史' }));
    expect(await screen.findByText('600519 价格上破 1800')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '通知尝试记录' }));
    expect(await screen.findByText('暂无通知尝试记录')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '告警规则' }));
    expect(await screen.findByText('茅台价格突破')).toBeInTheDocument();
  });

  it('renders API errors through ApiErrorAlert', async () => {
    listRules.mockRejectedValueOnce({ parsedError });

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('加载失败')).toBeInTheDocument();
    expect(screen.getByText('告警 API 不可用')).toBeInTheDocument();
  });
});
