import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, ListFilter } from 'lucide-react';
import { Badge, Card, EmptyState, Loading, Pagination } from '../common';
import { useUiLanguage } from '../../contexts/UiLanguageContext';
import {
  ALERT_TRIGGER_HISTORY_TEXT,
} from '../../locales/featureText';
import { formatUiText } from '../../i18n/uiText';
import type { AlertTriggerItem, AlertTriggerStatus } from '../../types/alerts';
import {
  formatTriggerDataSource,
  formatTriggerLimitation,
  formatTriggerObservedOrThreshold,
  formatTriggerQualityLevel,
  formatTriggerReason,
  formatTriggerStatus,
} from '../../utils/alertTriggerDisplay';
import { formatDateTime } from '../../utils/format';
import { getMarketPhaseSummaryLabel } from '../../utils/marketPhase';
import { cn } from '../../utils/cn';

export type TriggerStatusFilter = 'all' | AlertTriggerStatus;
export type TriggerSortBy = 'triggered_at' | 'status' | 'target' | 'rule_name';
export type TriggerSortOrder = 'asc' | 'desc';

export interface TriggerRuleOption {
  id: number;
  name: string;
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'triggered') return 'success';
  if (status === 'skipped' || status === 'degraded') return 'warning';
  if (status === 'failed') return 'danger';
  return 'default';
}

function renderRuleTargetCell(trigger: AlertTriggerItem, language: 'zh' | 'en'): React.ReactNode {
  const text = ALERT_TRIGGER_HISTORY_TEXT[language];
  const target = String(trigger.target || '').trim() || '--';
  const ruleName = trigger.ruleName?.trim()
    || (trigger.ruleId != null ? formatUiText(text.ruleIdFallback, { id: trigger.ruleId }) : text.unknownRule);

  return (
    <div className="space-y-1">
      <div className="font-medium text-secondary-text">{ruleName}</div>
      <div className="font-mono text-xs text-muted-text">{target}</div>
    </div>
  );
}

function renderObservedThreshold(trigger: AlertTriggerItem): React.ReactNode {
  return (
    <span className="whitespace-nowrap text-secondary-text">
      {formatTriggerObservedOrThreshold(trigger.observedValue)}
      {' / '}
      {formatTriggerObservedOrThreshold(trigger.threshold)}
    </span>
  );
}

function renderPhaseQuality(trigger: AlertTriggerItem, language: 'zh' | 'en'): React.ReactNode {
  const text = ALERT_TRIGGER_HISTORY_TEXT[language];
  const phase = getMarketPhaseSummaryLabel(trigger.marketPhaseSummary, language);
  const quality = formatTriggerQualityLevel(
    trigger.analysisContextPackOverview?.dataQuality?.level,
    language,
  );
  const limitations = (trigger.analysisContextPackOverview?.dataQuality?.limitations ?? [])
    .slice(0, 2)
    .map((item) => formatTriggerLimitation(item, language));
  if (!phase && !quality && limitations.length === 0) {
    return <span className="text-xs text-muted-text">--</span>;
  }
  return (
    <div className="space-y-1">
      {phase ? (
        <Badge variant="default">
          {phase.replace('市场阶段: ', '').replace('市场阶段：', '').replace('Market phase: ', '')}
        </Badge>
      ) : null}
      {quality ? (
        <div className="whitespace-nowrap text-xs text-secondary-text">
          {text.qualityPrefix}{quality}
        </div>
      ) : null}
      {limitations.length ? (
        <div className="min-w-[12rem] text-xs text-muted-text">{limitations.join(language === 'zh' ? '；' : '; ')}</div>
      ) : null}
    </div>
  );
}

function SortButton({
  active,
  order,
  label,
  onClick,
}: {
  active: boolean;
  order: TriggerSortOrder;
  label: string;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-cyan/10 text-cyan'
          : 'text-muted-text hover:bg-hover hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function HeaderFilterMenu({
  label,
  active,
  options,
  value,
  onChange,
}: {
  label: string;
  active: boolean;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        title={label}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
          active || open
            ? 'bg-cyan/10 text-cyan'
            : 'text-muted-text hover:bg-hover hover:text-foreground',
        )}
      >
        <ListFilter className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-1 max-h-64 min-w-[11rem] overflow-y-auto rounded-xl border border-border/70 bg-elevated p-1 shadow-xl"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value || '__all__'}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  selected
                    ? 'bg-cyan/10 text-cyan'
                    : 'text-secondary-text hover:bg-hover hover:text-foreground',
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

interface AlertTriggerHistoryProps {
  triggers: AlertTriggerItem[];
  isLoading?: boolean;
  page: number;
  pageSize: number;
  total: number;
  statusFilter: TriggerStatusFilter;
  ruleFilter: string;
  targetFilter: string;
  sortBy: TriggerSortBy;
  sortOrder: TriggerSortOrder;
  ruleOptions: TriggerRuleOption[];
  targetOptions: string[];
  onStatusFilterChange: (value: TriggerStatusFilter) => void;
  onRuleFilterChange: (value: string) => void;
  onTargetFilterChange: (value: string) => void;
  onSortChange: (sortBy: TriggerSortBy) => void;
  onPageChange: (page: number) => void;
}

export const AlertTriggerHistory: React.FC<AlertTriggerHistoryProps> = ({
  triggers,
  isLoading = false,
  page,
  pageSize,
  total,
  statusFilter,
  ruleFilter,
  targetFilter,
  sortBy,
  sortOrder,
  ruleOptions,
  targetOptions,
  onStatusFilterChange,
  onRuleFilterChange,
  onTargetFilterChange,
  onSortChange,
  onPageChange,
}) => {
  const { language } = useUiLanguage();
  const text = ALERT_TRIGGER_HISTORY_TEXT[language];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = statusFilter !== 'all' || Boolean(ruleFilter) || Boolean(targetFilter);

  const statusOptions = [
    { value: 'all', label: text.statusFilterAll },
    { value: 'triggered', label: text.statusLabels.triggered },
    { value: 'skipped', label: text.statusLabels.skipped },
    { value: 'degraded', label: text.statusLabels.degraded },
    { value: 'failed', label: text.statusLabels.failed },
  ];
  const ruleSelectOptions = [
    { value: '', label: text.ruleFilterAll },
    ...ruleOptions.map((rule) => ({ value: String(rule.id), label: rule.name })),
  ];
  const targetSelectOptions = [
    { value: '', label: text.targetFilterAll },
    ...targetOptions.map((target) => ({ value: target, label: target })),
  ];

  return (
    <Card variant="bordered" padding="md">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[8rem]" />
            <col className="w-[14rem]" />
            <col className="w-[12rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[7.5rem]" />
            <col className="w-[11.5rem]" />
            <col />
          </colgroup>
          <thead className="border-b border-border/60 text-xs text-muted-text">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                <div className="flex items-center gap-1">
                  <span>{text.status}</span>
                  <HeaderFilterMenu
                    label={text.statusFilterAll}
                    active={statusFilter !== 'all'}
                    options={statusOptions}
                    value={statusFilter}
                    onChange={(value) => onStatusFilterChange(value as TriggerStatusFilter)}
                  />
                  <SortButton
                    active={sortBy === 'status'}
                    order={sortOrder}
                    label={text.sortByStatus}
                    onClick={() => onSortChange('status')}
                  />
                </div>
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                <div className="flex flex-wrap items-center gap-1">
                  <span>{text.ruleTarget}</span>
                  <HeaderFilterMenu
                    label={text.ruleFilterAll}
                    active={Boolean(ruleFilter)}
                    options={ruleSelectOptions}
                    value={ruleFilter}
                    onChange={onRuleFilterChange}
                  />
                  <HeaderFilterMenu
                    label={text.targetFilterAll}
                    active={Boolean(targetFilter)}
                    options={targetSelectOptions}
                    value={targetFilter}
                    onChange={onTargetFilterChange}
                  />
                  <SortButton
                    active={sortBy === 'rule_name'}
                    order={sortOrder}
                    label={text.sortByRule}
                    onClick={() => onSortChange('rule_name')}
                  />
                  <SortButton
                    active={sortBy === 'target'}
                    order={sortOrder}
                    label={text.sortByTarget}
                    onClick={() => onSortChange('target')}
                  />
                </div>
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">{text.phaseQuality}</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">{text.observedThreshold}</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">{text.dataSource}</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">{text.evaluatedAt}</th>
              <th className="px-3 py-2 font-medium">{text.reason}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10">
                  <Loading label={text.loading} />
                </td>
              </tr>
            ) : null}
            {!isLoading && triggers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10">
                  <EmptyState
                    icon={<Activity className="h-6 w-6" />}
                    title={text.emptyTitle}
                    description={hasFilters ? text.emptyFilteredDescription : text.emptyDescription}
                  />
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? triggers.map((trigger) => (
                <tr key={trigger.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-3">
                    <Badge variant={statusVariant(trigger.status)}>
                      {formatTriggerStatus(trigger.status, language)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{renderRuleTargetCell(trigger, language)}</td>
                  <td className="px-3 py-3">{renderPhaseQuality(trigger, language)}</td>
                  <td className="px-3 py-3">{renderObservedThreshold(trigger)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-secondary-text">
                    {formatTriggerDataSource(trigger.dataSource, language)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-secondary-text">
                    {trigger.triggeredAt ? formatDateTime(trigger.triggeredAt) : '--'}
                  </td>
                  <td className="px-3 py-3 text-secondary-text">
                    {formatTriggerReason(trigger.reason, language, trigger.diagnostics)}
                  </td>
                </tr>
              ))
              : null}
          </tbody>
        </table>
      </div>

      {!isLoading && total > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-secondary-text">
            {formatUiText(text.subtitle, { total })}
          </p>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            className="justify-end"
          />
        </div>
      ) : null}
    </Card>
  );
};
