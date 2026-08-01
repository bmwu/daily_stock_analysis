import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, Plus } from 'lucide-react';
import { alertsApi } from '../api/alerts';
import type { ParsedApiError } from '../api/error';
import { getParsedApiError } from '../api/error';
import { AlertRuleForm } from '../components/alerts/AlertRuleForm';
import {
  AlertRuleList,
  type AlertRuleBusyState,
  type AlertRuleEnabledFilter,
  type AlertTypeFilter,
} from '../components/alerts/AlertRuleList';
import { AlertTriggerHistory } from '../components/alerts/AlertTriggerHistory';
import {
  ApiErrorAlert,
  AppPage,
  Card,
  Drawer,
  EmptyState,
  InlineAlert,
  Loading,
  PageHeader,
} from '../components/common';
import type {
  AlertNotificationItem,
  AlertRuleCreateRequest,
  AlertRuleItem,
  AlertRuleTargetOption,
  AlertRuleTestResponse,
  AlertTriggerItem,
  AlertType,
} from '../types/alerts';
import { formatDateTime } from '../utils/format';
import { cn } from '../utils/cn';

const RULES_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 20;

type AlertsMainTab = 'rules' | 'triggers' | 'notifications';

function enabledFilterToQuery(value: AlertRuleEnabledFilter): boolean | undefined {
  if (value === 'enabled') return true;
  if (value === 'disabled') return false;
  return undefined;
}

function alertTypeFilterToQuery(value: AlertTypeFilter): AlertType | undefined {
  return value === 'all' ? undefined : value;
}

function testVariant(result: AlertRuleTestResponse): 'success' | 'warning' | 'danger' {
  if (result.status === 'evaluation_error') return 'danger';
  return result.triggered ? 'success' : 'warning';
}

function renderTestResultMessage(result: AlertRuleTestResponse): React.ReactNode {
  const targetResults = result.targetResults ?? [];
  return (
    <div className="space-y-2">
      <div>
        {result.message}
        {' · 状态：'}
        {result.status}
        {' · 触发：'}
        {result.triggered ? '是' : '否'}
        {' · 观察值：'}
        {result.observedValue == null ? '--' : String(result.observedValue)}
      </div>
      {result.evaluatedCount != null && result.evaluatedCount > 1 ? (
        <div className="text-xs">
          评估 {result.evaluatedCount} · 触发 {result.triggeredCount ?? 0} · 降级 {result.degradedCount ?? 0} · 跳过 {result.skippedCount ?? 0}
        </div>
      ) : null}
      {targetResults.length > 1 ? (
        <div className="grid gap-1 text-xs">
          {targetResults.slice(0, 20).map((item) => (
            <div key={`${item.target}-${item.status}`} className="flex flex-wrap justify-between gap-2">
              <span>{item.displayTarget ?? item.target}</span>
              <span>
                {item.status}
                {item.recordStatus ? ` / ${item.recordStatus}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const notificationChannelLabel: Record<string, string> = {
  __cooldown__: '业务冷却',
  __cooldown_read_failed__: '冷却读取失败',
  __noise_suppressed__: '通知降噪',
  __no_channel__: '无可用渠道',
  __dispatch__: '通知调度',
  __context__: '会话渠道',
};

function formatNotificationChannel(channel: string): string {
  return notificationChannelLabel[channel] ?? channel;
}

function formatNotificationStatus(notification: AlertNotificationItem): string {
  if (notification.success) return '成功';
  if (notification.errorCode === 'cooldown_active') return '冷却抑制';
  if (notification.errorCode === 'cooldown_read_failed') return '冷却读取失败';
  if (notification.errorCode === 'noise_suppressed') return '降噪抑制';
  if (notification.errorCode === 'no_channel') return '无渠道';
  return '失败';
}

const AlertsPage: React.FC = () => {
  useEffect(() => {
    document.title = '告警中心 - DSA';
  }, []);

  const [mainTab, setMainTab] = useState<AlertsMainTab>('rules');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [rulesTotal, setRulesTotal] = useState(0);
  const [rulesPage, setRulesPage] = useState(1);
  const [enabledFilter, setEnabledFilter] = useState<AlertRuleEnabledFilter>('all');
  const [alertTypeFilter, setAlertTypeFilter] = useState<AlertTypeFilter>('all');
  const [targetFilter, setTargetFilter] = useState('');
  const [targetOptions, setTargetOptions] = useState<AlertRuleTargetOption[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<ParsedApiError | null>(null);
  const [rulesLoaded, setRulesLoaded] = useState(false);

  const [triggers, setTriggers] = useState<AlertTriggerItem[]>([]);
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [triggersError, setTriggersError] = useState<ParsedApiError | null>(null);

  const [notifications, setNotifications] = useState<AlertNotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<ParsedApiError | null>(null);

  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<ParsedApiError | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [busyRule, setBusyRule] = useState<AlertRuleBusyState | null>(null);
  const [testResult, setTestResult] = useState<AlertRuleTestResponse | null>(null);
  const rulesRequestIdRef = useRef(0);

  const loadRules = useCallback(async (pageOverride?: number) => {
    const requestId = rulesRequestIdRef.current + 1;
    rulesRequestIdRef.current = requestId;
    const isLatestRequest = () => rulesRequestIdRef.current === requestId;
    const requestedPage = pageOverride ?? rulesPage;
    const baseQuery = {
      enabled: enabledFilterToQuery(enabledFilter),
      alertType: alertTypeFilterToQuery(alertTypeFilter),
      target: targetFilter.trim() || undefined,
      pageSize: RULES_PAGE_SIZE,
    };
    setRulesLoading(true);
    try {
      let response = await alertsApi.listRules({ ...baseQuery, page: requestedPage });
      if (!isLatestRequest()) return null;
      const lastPage = Math.max(1, Math.ceil(response.total / RULES_PAGE_SIZE));
      if (response.items.length === 0 && response.total > 0 && requestedPage > lastPage) {
        setRulesPage(lastPage);
        response = await alertsApi.listRules({ ...baseQuery, page: lastPage });
        if (!isLatestRequest()) return null;
      } else if (pageOverride !== undefined && pageOverride !== rulesPage) {
        setRulesPage(pageOverride);
      }
      setRules(response.items);
      setRulesTotal(response.total);
      setRulesError(null);
      setRulesLoaded(true);
      return response;
    } catch (error) {
      if (!isLatestRequest()) return null;
      setRulesError(getParsedApiError(error));
      return null;
    } finally {
      if (isLatestRequest()) {
        setRulesLoading(false);
      }
    }
  }, [alertTypeFilter, enabledFilter, rulesPage, targetFilter]);

  const loadRuleTargets = useCallback(async () => {
    const applyTargets = (items: AlertRuleTargetOption[]) => {
      const unique = new Map<string, AlertRuleTargetOption>();
      for (const item of items) {
        const target = String(item.target || '').trim();
        if (!target || unique.has(target)) continue;
        unique.set(target, {
          target,
          targetScope: item.targetScope || 'single_symbol',
        });
      }
      const next = Array.from(unique.values()).sort((left, right) => (
        left.target.localeCompare(right.target, 'en')
      ));
      setTargetOptions(next);
      setTargetFilter((current) => (
        current && !next.some((item) => item.target === current) ? '' : current
      ));
    };

    try {
      const response = await alertsApi.listRuleTargets();
      applyTargets(response.items ?? []);
      return;
    } catch {
      // Older backends may not expose /rules/targets yet; fall back below.
    }

    try {
      const response = await alertsApi.listRules({ page: 1, pageSize: 100 });
      applyTargets(
        (response.items ?? []).map((rule) => ({
          target: rule.target,
          targetScope: rule.targetScope,
        })),
      );
    } catch {
      // Keep whatever options we already have.
    }
  }, []);

  const loadTriggers = useCallback(async () => {
    setTriggersLoading(true);
    try {
      const response = await alertsApi.listTriggers({ page: 1, pageSize: HISTORY_PAGE_SIZE });
      setTriggers(response.items);
      setTriggersError(null);
    } catch (error) {
      setTriggersError(getParsedApiError(error));
    } finally {
      setTriggersLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const response = await alertsApi.listNotifications({ page: 1, pageSize: HISTORY_PAGE_SIZE });
      setNotifications(response.items);
      setNotificationsError(null);
    } catch (error) {
      setNotificationsError(getParsedApiError(error));
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    void loadRuleTargets();
  }, [loadRuleTargets]);

  useEffect(() => {
    if (rules.length === 0) return;
    setTargetOptions((prev) => {
      const unique = new Map(prev.map((item) => [item.target, item]));
      let changed = false;
      for (const rule of rules) {
        const target = String(rule.target || '').trim();
        if (!target || unique.has(target)) continue;
        unique.set(target, { target, targetScope: rule.targetScope });
        changed = true;
      }
      if (!changed) return prev;
      return Array.from(unique.values()).sort((left, right) => (
        left.target.localeCompare(right.target, 'en')
      ));
    });
  }, [rules]);

  useEffect(() => {
    if (!rulesLoaded) return;
    void loadTriggers();
    void loadNotifications();
  }, [loadNotifications, loadTriggers, rulesLoaded]);

  const handleCreateRule = async (payload: AlertRuleCreateRequest) => {
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const created = await alertsApi.createRule(payload);
      setCreateSuccess(`已创建告警规则「${created.name}」`);
      setCreateDrawerOpen(false);
      await loadRuleTargets();
      await loadRules(1);
      return true;
    } catch (error) {
      setCreateError(getParsedApiError(error));
      return false;
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleEnabled = async (rule: AlertRuleItem) => {
    setBusyRule({ id: rule.id, action: 'toggle' });
    try {
      if (rule.enabled) {
        await alertsApi.disableRule(rule.id);
      } else {
        await alertsApi.enableRule(rule.id);
      }
      await loadRules();
    } catch (error) {
      setRulesError(getParsedApiError(error));
    } finally {
      setBusyRule(null);
    }
  };

  const handleDeleteRule = async (rule: AlertRuleItem) => {
    setBusyRule({ id: rule.id, action: 'delete' });
    try {
      await alertsApi.deleteRule(rule.id);
      await loadRuleTargets();
      await loadRules();
    } catch (error) {
      setRulesError(getParsedApiError(error));
    } finally {
      setBusyRule(null);
    }
  };

  const handleTestRule = async (rule: AlertRuleItem) => {
    setBusyRule({ id: rule.id, action: 'test' });
    setTestResult(null);
    try {
      const result = await alertsApi.testRule(rule.id);
      setTestResult(result);
    } catch (error) {
      setRulesError(getParsedApiError(error));
    } finally {
      setBusyRule(null);
    }
  };

  return (
    <AppPage className="max-w-none space-y-5">
      <PageHeader
        eyebrow="Alert Center"
        title="告警中心"
        description="管理事件告警、日线技术指标、自选股、持仓/账户联动和大盘红绿灯规则，执行一次性测试，并查看后台评估任务记录的触发历史。"
        actions={(
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => {
              setCreateError(null);
              setCreateDrawerOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            创建规则
          </button>
        )}
      />

      {createError && !createDrawerOpen ? (
        <ApiErrorAlert error={createError} onDismiss={() => setCreateError(null)} />
      ) : null}
      {createSuccess ? (
        <InlineAlert
          title="创建成功"
          message={createSuccess}
          variant="success"
          action={(
            <button type="button" className="text-sm underline" onClick={() => setCreateSuccess(null)}>
              关闭
            </button>
          )}
        />
      ) : null}
      {rulesError ? <ApiErrorAlert error={rulesError} onDismiss={() => setRulesError(null)} /> : null}

      <div className="space-y-4">
        <div className="inline-flex rounded-xl border border-border/70 bg-elevated/30 p-1" role="tablist" aria-label="告警中心主视图">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'rules'}
            className={cn(
              'rounded-lg px-4 py-2 text-sm transition-colors',
              mainTab === 'rules'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-secondary-text hover:text-foreground',
            )}
            onClick={() => setMainTab('rules')}
          >
            告警规则
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'triggers'}
            className={cn(
              'rounded-lg px-4 py-2 text-sm transition-colors',
              mainTab === 'triggers'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-secondary-text hover:text-foreground',
            )}
            onClick={() => setMainTab('triggers')}
          >
            触发历史
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'notifications'}
            className={cn(
              'rounded-lg px-4 py-2 text-sm transition-colors',
              mainTab === 'notifications'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-secondary-text hover:text-foreground',
            )}
            onClick={() => setMainTab('notifications')}
          >
            通知尝试记录
          </button>
        </div>

        {mainTab === 'rules' ? (
          <div className="space-y-4" role="tabpanel" aria-label="告警规则">
            <AlertRuleList
              className="flex h-full min-h-0 flex-col"
              rules={rules}
              total={rulesTotal}
              page={rulesPage}
              pageSize={RULES_PAGE_SIZE}
              isLoading={rulesLoading}
              enabledFilter={enabledFilter}
              alertTypeFilter={alertTypeFilter}
              targetFilter={targetFilter}
              targetOptions={targetOptions}
              onEnabledFilterChange={(value) => {
                setEnabledFilter(value);
                setRulesPage(1);
              }}
              onAlertTypeFilterChange={(value) => {
                setAlertTypeFilter(value);
                setRulesPage(1);
              }}
              onTargetFilterChange={(value) => {
                setTargetFilter(value);
                setRulesPage(1);
              }}
              onPageChange={setRulesPage}
              onToggleEnabled={(rule) => void handleToggleEnabled(rule)}
              onDelete={(rule) => void handleDeleteRule(rule)}
              onTest={(rule) => void handleTestRule(rule)}
              busyRule={busyRule}
            />
            {testResult ? (
              <InlineAlert
                title="测试结果"
                variant={testVariant(testResult)}
                message={renderTestResultMessage(testResult)}
              />
            ) : null}
          </div>
        ) : null}

        {mainTab === 'triggers' ? (
          <div className="space-y-4" role="tabpanel" aria-label="触发历史">
            {triggersError ? (
              <ApiErrorAlert error={triggersError} onDismiss={() => setTriggersError(null)} />
            ) : null}
            <AlertTriggerHistory triggers={triggers} isLoading={triggersLoading} />
          </div>
        ) : null}

        {mainTab === 'notifications' ? (
          <div className="space-y-4" role="tabpanel" aria-label="通知尝试记录">
            {notificationsError ? (
              <ApiErrorAlert error={notificationsError} onDismiss={() => setNotificationsError(null)} />
            ) : null}
            <Card variant="bordered" padding="md">
              {notificationsLoading ? <Loading label="正在加载通知尝试记录" /> : null}
              {!notificationsLoading && notifications.length === 0 ? (
                <EmptyState
                  icon={<BellRing className="h-6 w-6" />}
                  title="暂无通知尝试记录"
                  description="当前没有可展示的通知尝试明细；告警触发仍会按已配置通知渠道发送。"
                />
              ) : null}
              {!notificationsLoading && notifications.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="border-b border-border/60 text-xs uppercase text-muted-text">
                      <tr>
                        <th className="px-3 py-2 font-medium">渠道</th>
                        <th className="px-3 py-2 font-medium">状态</th>
                        <th className="px-3 py-2 font-medium">错误码</th>
                        <th className="px-3 py-2 font-medium">耗时</th>
                        <th className="px-3 py-2 font-medium">时间</th>
                        <th className="px-3 py-2 font-medium">诊断</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {notifications.map((notification) => (
                        <tr key={notification.id}>
                          <td className="px-3 py-3">{formatNotificationChannel(notification.channel)}</td>
                          <td className="px-3 py-3">{formatNotificationStatus(notification)}</td>
                          <td className="px-3 py-3">{notification.errorCode ?? '--'}</td>
                          <td className="px-3 py-3">
                            {notification.latencyMs == null ? '--' : `${notification.latencyMs}ms`}
                          </td>
                          <td className="px-3 py-3">{formatDateTime(notification.createdAt)}</td>
                          <td className="px-3 py-3">{notification.diagnostics ?? '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}
      </div>

      <Drawer
        isOpen={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        title="创建规则"
        resizable
        initialWidthRatio={0.5}
      >
        <div className="space-y-4">
          {createError ? (
            <ApiErrorAlert error={createError} onDismiss={() => setCreateError(null)} />
          ) : null}
          <AlertRuleForm onSubmit={handleCreateRule} isSubmitting={createLoading} />
        </div>
      </Drawer>
    </AppPage>
  );
};

export default AlertsPage;
