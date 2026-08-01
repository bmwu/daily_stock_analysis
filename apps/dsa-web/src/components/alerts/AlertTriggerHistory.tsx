import type React from 'react';
import { Activity } from 'lucide-react';
import { Badge, Card, EmptyState, Loading } from '../common';
import { useUiLanguage } from '../../contexts/UiLanguageContext';
import { ALERT_TRIGGER_HISTORY_TEXT } from '../../locales/featureText';
import type { AlertTriggerItem } from '../../types/alerts';
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

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'triggered') return 'success';
  if (status === 'skipped' || status === 'degraded') return 'warning';
  if (status === 'failed') return 'danger';
  return 'default';
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

interface AlertTriggerHistoryProps {
  triggers: AlertTriggerItem[];
  isLoading?: boolean;
}

export const AlertTriggerHistory: React.FC<AlertTriggerHistoryProps> = ({ triggers, isLoading = false }) => {
  const { language } = useUiLanguage();
  const text = ALERT_TRIGGER_HISTORY_TEXT[language];

  return (
    <Card variant="bordered" padding="md">
      {isLoading ? <Loading label={text.loading} /> : null}
      {!isLoading && triggers.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title={text.emptyTitle}
          description={text.emptyDescription}
        />
      ) : null}
      {!isLoading && triggers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[7rem]" />
              <col className="w-[14rem]" />
              <col className="w-[7rem]" />
              <col className="w-[6rem]" />
              <col className="w-[5.5rem]" />
              <col className="w-[7.5rem]" />
              <col className="w-[11.5rem]" />
              <col />
            </colgroup>
            <thead className="border-b border-border/60 text-xs text-muted-text">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">{text.status}</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">{text.phaseQuality}</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">{text.target}</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">{text.observedValue}</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">{text.threshold}</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">{text.dataSource}</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">{text.dataTime}</th>
                <th className="px-3 py-2 font-medium">{text.reason}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {triggers.map((trigger) => (
                <tr key={trigger.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-3">
                    <Badge variant={statusVariant(trigger.status)}>
                      {formatTriggerStatus(trigger.status, language)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{renderPhaseQuality(trigger, language)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-secondary-text">{trigger.target}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-secondary-text">
                    {formatTriggerObservedOrThreshold(trigger.observedValue)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-secondary-text">
                    {formatTriggerObservedOrThreshold(trigger.threshold)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-secondary-text">
                    {formatTriggerDataSource(trigger.dataSource, language)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-secondary-text">
                    {formatDateTime(trigger.dataTimestamp ?? trigger.triggeredAt)}
                  </td>
                  <td className="px-3 py-3 text-secondary-text">
                    {formatTriggerReason(trigger.reason, language, trigger.diagnostics)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
};
