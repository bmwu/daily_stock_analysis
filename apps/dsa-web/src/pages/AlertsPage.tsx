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
import { AlertTriggerHistory, type TriggerSortBy, type TriggerSortOrder, type TriggerStatusFilter } from '../components/alerts/AlertTriggerHistory';
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
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { ALERT_PAGE_TEXT } from '../locales/featureText';
import { formatUiText } from '../i18n/uiText';
import type { UiLanguage } from '../i18n/uiText';
import { formatDateTime } from '../utils/format';
import { cn } from '../utils/cn';

const RULES_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 20;

type AlertsMainTab = 'rules' | 'triggers' | 'notifications';
type AlertPageText = (typeof ALERT_PAGE_TEXT)[UiLanguage];

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

function renderTestResultMessage(result: AlertRuleTestResponse, text: AlertPageText): React.ReactNode {
  const targetResults = result.targetResults ?? [];
  return (
    <div className="space-y-2">
      <div>
        {result.message}
        {` · ${text.statusPrefix} `}
        {result.status}
        {` · ${text.triggeredPrefix} `}
        {result.triggered ? text.yes : text.no}
        {` · ${text.observedPrefix} `}
        {result.observedValue == null ? '--' : String(result.observedValue)}
      </div>
      {result.evaluatedCount != null && result.evaluatedCount > 1 ? (
        <div className="text-xs">
          {formatUiText(text.evalSummary, {
            evaluated: result.evaluatedCount,
            triggered: result.triggeredCount ?? 0,
            degraded: result.degradedCount ?? 0,
            skipped: result.skippedCount ?? 0,
          })}
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

function formatNotificationChannel(channel: string, text: AlertPageText): string {
  const labels: Record<string, string> = {
    __cooldown__: text.channelCooldown,
    __cooldown_read_failed__: text.channelCooldownReadFailed,
    __noise_suppressed__: text.channelNoiseSuppressed,
    __no_channel__: text.channelNoChannel,
    __dispatch__: text.channelDispatch,
    __context__: text.channelContext,
  };
  return labels[channel] ?? channel;
}

function formatNotificationStatus(notification: AlertNotificationItem, text: AlertPageText): string {
  if (notification.success) return text.success;
  if (notification.errorCode === 'cooldown_active') return text.cooldownActive;
  if (notification.errorCode === 'cooldown_read_failed') return text.cooldownReadFailed;
  if (notification.errorCode === 'noise_suppressed') return text.noiseSuppressed;
  if (notification.errorCode === 'no_channel') return text.noChannel;
  return text.failure;
}

const AlertsPage: React.FC = () => {
  const { language } = useUiLanguage();
  const text = ALERT_PAGE_TEXT[language];
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
  const [triggersTotal, setTriggersTotal] = useState(0);
  const [triggersPage, setTriggersPage] = useState(1);
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [triggersError, setTriggersError] = useState<ParsedApiError | null>(null);
  const [triggerStatusFilter, setTriggerStatusFilter] = useState<TriggerStatusFilter>('all');
  const [triggerRuleFilter, setTriggerRuleFilter] = useState('');
  const [triggerTargetFilter, setTriggerTargetFilter] = useState('');
  const [triggerSortBy, setTriggerSortBy] = useState<TriggerSortBy>('triggered_at');
  const [triggerSortOrder, setTriggerSortOrder] = useState<TriggerSortOrder>('desc');
  const [triggerRuleOptions, setTriggerRuleOptions] = useState<Array<{ id: number; name: string }>>([]);

  const [notifications, setNotifications] = useState<AlertNotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<ParsedApiError | null>(null);

  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<ParsedApiError | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [busyRule, setBusyRule] = useState<AlertRuleBusyState | null>(null);
  const [testResult, setTestResult] = useState<AlertRuleTestResponse | null>(null);
  const rulesRequestIdRef = useRef(0);
  const ruleMetaCacheRef = useRef<Map<number, { name: string; alertType?: string }>>(new Map());

  const rememberRuleMeta = useCallback((ruleId: number, name: string, alertType?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    ruleMetaCacheRef.current.set(ruleId, { name: trimmed, alertType });
  }, []);

  const enrichTriggersWithRuleMeta = useCallback(async (items: AlertTriggerItem[]) => {
    const missingIds = Array.from(new Set(
      items
        .filter((item) => item.ruleId != null && !String(item.ruleName || '').trim())
        .map((item) => Number(item.ruleId))
        .filter((ruleId) => Number.isFinite(ruleId) && ruleId > 0 && !ruleMetaCacheRef.current.has(ruleId)),
    ));

    await Promise.all(missingIds.map(async (ruleId) => {
      try {
        const rule = await alertsApi.getRule(ruleId);
        rememberRuleMeta(rule.id, rule.name, rule.alertType);
      } catch {
        // Rule may have been deleted; keep fallback label in the table.
      }
    }));

    return items.map((item) => {
      if (item.ruleId == null) return item;
      const cached = ruleMetaCacheRef.current.get(Number(item.ruleId));
      if (!cached) return item;
      return {
        ...item,
        ruleName: String(item.ruleName || '').trim() || cached.name,
        alertType: item.alertType || cached.alertType || item.alertType,
      };
    });
  }, [rememberRuleMeta]);

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
      for (const rule of response.items) {
        rememberRuleMeta(rule.id, rule.name, rule.alertType);
      }
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
  }, [alertTypeFilter, enabledFilter, rememberRuleMeta, rulesPage, targetFilter]);

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

  const buildTriggerQuery = useCallback((page: number) => {
    const ruleId = triggerRuleFilter.trim() ? Number(triggerRuleFilter) : undefined;
    return {
      page,
      pageSize: HISTORY_PAGE_SIZE,
      status: triggerStatusFilter === 'all' ? undefined : triggerStatusFilter,
      ruleId: Number.isFinite(ruleId) && ruleId! > 0 ? ruleId : undefined,
      target: triggerTargetFilter.trim() || undefined,
      sortBy: triggerSortBy,
      sortOrder: triggerSortOrder,
    };
  }, [triggerRuleFilter, triggerSortBy, triggerSortOrder, triggerStatusFilter, triggerTargetFilter]);

  const loadTriggers = useCallback(async (pageOverride?: number) => {
    const requestedPage = pageOverride ?? triggersPage;
    setTriggersLoading(true);
    try {
      let response = await alertsApi.listTriggers(buildTriggerQuery(requestedPage));
      const lastPage = Math.max(1, Math.ceil(response.total / HISTORY_PAGE_SIZE));
      if (response.items.length === 0 && response.total > 0 && requestedPage > lastPage) {
        setTriggersPage(lastPage);
        response = await alertsApi.listTriggers(buildTriggerQuery(lastPage));
      } else if (pageOverride !== undefined && pageOverride !== triggersPage) {
        setTriggersPage(pageOverride);
      }
      const enrichedItems = await enrichTriggersWithRuleMeta(response.items);
      setTriggers(enrichedItems);
      setTriggersTotal(response.total);
      setTriggersError(null);
    } catch (error) {
      setTriggersError(getParsedApiError(error));
    } finally {
      setTriggersLoading(false);
    }
  }, [buildTriggerQuery, enrichTriggersWithRuleMeta, triggersPage]);

  const loadTriggerFilterOptions = useCallback(async () => {
    try {
      const response = await alertsApi.listRules({ page: 1, pageSize: 100 });
      const options = (response.items ?? [])
        .map((rule) => ({
          id: rule.id,
          name: String(rule.name || '').trim() || `#${rule.id}`,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'en'));
      setTriggerRuleOptions(options);
      for (const rule of response.items ?? []) {
        rememberRuleMeta(rule.id, rule.name, rule.alertType);
      }
    } catch {
      // Keep whatever options we already have.
    }
  }, [rememberRuleMeta]);

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
    void loadTriggerFilterOptions();
  }, [loadTriggerFilterOptions]);

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
  }, [loadTriggers, rulesLoaded]);

  useEffect(() => {
    if (!rulesLoaded) return;
    void loadNotifications();
  }, [loadNotifications, rulesLoaded]);

  const handleCreateRule = async (payload: AlertRuleCreateRequest) => {
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const created = await alertsApi.createRule(payload);
      setCreateSuccess(formatUiText(text.createSuccessMessage, { name: created.name }));
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
        title={text.title}
        description={text.description}
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
            {text.createRule}
          </button>
        )}
      />

      {createError && !createDrawerOpen ? (
        <ApiErrorAlert error={createError} onDismiss={() => setCreateError(null)} />
      ) : null}
      {createSuccess ? (
        <InlineAlert
          title={text.createSuccessTitle}
          message={createSuccess}
          variant="success"
          action={(
            <button type="button" className="text-sm underline" onClick={() => setCreateSuccess(null)}>
              {text.close}
            </button>
          )}
        />
      ) : null}
      {rulesError ? <ApiErrorAlert error={rulesError} onDismiss={() => setRulesError(null)} /> : null}

      <div className="space-y-4">
        <div className="inline-flex rounded-xl border border-border/70 bg-elevated/30 p-1" role="tablist" aria-label={text.mainTablistAria}>
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
            {text.tabRules}
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
            {text.tabTriggers}
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
            {text.tabNotifications}
          </button>
        </div>

        {mainTab === 'rules' ? (
          <div className="space-y-4" role="tabpanel" aria-label={text.panelRulesAria}>
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
                title={text.testResultTitle}
                variant={testVariant(testResult)}
                message={renderTestResultMessage(testResult, text)}
              />
            ) : null}
          </div>
        ) : null}

        {mainTab === 'triggers' ? (
          <div className="space-y-4" role="tabpanel" aria-label={text.panelTriggersAria}>
            {triggersError ? (
              <ApiErrorAlert error={triggersError} onDismiss={() => setTriggersError(null)} />
            ) : null}
            <AlertTriggerHistory
              triggers={triggers}
              isLoading={triggersLoading}
              page={triggersPage}
              pageSize={HISTORY_PAGE_SIZE}
              total={triggersTotal}
              statusFilter={triggerStatusFilter}
              ruleFilter={triggerRuleFilter}
              targetFilter={triggerTargetFilter}
              sortBy={triggerSortBy}
              sortOrder={triggerSortOrder}
              ruleOptions={triggerRuleOptions}
              targetOptions={targetOptions.map((item) => item.target)}
              onStatusFilterChange={(value) => {
                setTriggerStatusFilter(value);
                setTriggersPage(1);
              }}
              onRuleFilterChange={(value) => {
                setTriggerRuleFilter(value);
                setTriggersPage(1);
              }}
              onTargetFilterChange={(value) => {
                setTriggerTargetFilter(value);
                setTriggersPage(1);
              }}
              onSortChange={(nextSortBy) => {
                if (triggerSortBy === nextSortBy) {
                  setTriggerSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
                } else {
                  setTriggerSortBy(nextSortBy);
                  setTriggerSortOrder(nextSortBy === 'triggered_at' ? 'desc' : 'asc');
                }
                setTriggersPage(1);
              }}
              onPageChange={setTriggersPage}
            />
          </div>
        ) : null}

        {mainTab === 'notifications' ? (
          <div className="space-y-4" role="tabpanel" aria-label={text.panelNotificationsAria}>
            {notificationsError ? (
              <ApiErrorAlert error={notificationsError} onDismiss={() => setNotificationsError(null)} />
            ) : null}
            <Card variant="bordered" padding="md">
              {notificationsLoading ? <Loading label={text.loadingNotifications} /> : null}
              {!notificationsLoading && notifications.length === 0 ? (
                <EmptyState
                  icon={<BellRing className="h-6 w-6" />}
                  title={text.emptyNotificationsTitle}
                  description={text.emptyNotificationsDescription}
                />
              ) : null}
              {!notificationsLoading && notifications.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="border-b border-border/60 text-xs uppercase text-muted-text">
                      <tr>
                        <th className="px-3 py-2 font-medium">{text.channel}</th>
                        <th className="px-3 py-2 font-medium">{text.status}</th>
                        <th className="px-3 py-2 font-medium">{text.errorCode}</th>
                        <th className="px-3 py-2 font-medium">{text.latency}</th>
                        <th className="px-3 py-2 font-medium">{text.time}</th>
                        <th className="px-3 py-2 font-medium">{text.diagnostics}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {notifications.map((notification) => (
                        <tr key={notification.id}>
                          <td className="px-3 py-3">{formatNotificationChannel(notification.channel, text)}</td>
                          <td className="px-3 py-3">{formatNotificationStatus(notification, text)}</td>
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
        title={text.createRule}
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
