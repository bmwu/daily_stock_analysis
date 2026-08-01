import { ALERT_TRIGGER_HISTORY_TEXT } from '../locales/featureText';
import type { UiLanguage } from '../i18n/uiText';

type TriggerHistoryText = (typeof ALERT_TRIGGER_HISTORY_TEXT)[UiLanguage];

function formatNullable(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '--';
  return String(value);
}

export function formatTriggerStatus(status: string, language: UiLanguage): string {
  const labels = ALERT_TRIGGER_HISTORY_TEXT[language].statusLabels as Record<string, string>;
  return labels[status] ?? status;
}

export function formatTriggerQualityLevel(level: string | null | undefined, language: UiLanguage): string | null {
  if (!level) return null;
  const labels = ALERT_TRIGGER_HISTORY_TEXT[language].qualityLevels as Record<string, string>;
  return labels[level] ?? level;
}

export function formatTriggerLimitation(value: string, language: UiLanguage): string {
  const text = ALERT_TRIGGER_HISTORY_TEXT[language];
  const [rawKey, ...statusParts] = value.split(':');
  if (!rawKey || statusParts.length === 0) {
    return value;
  }

  const key = rawKey.trim();
  const status = statusParts.join(':').trim();
  if (!key || !status) {
    return value;
  }

  const blockLabel = (text.blockLabels as Record<string, string>)[key] ?? key;
  const statusLabel = (text.blockStatusLabels as Record<string, string>)[status] ?? status;
  return language === 'zh' ? `${blockLabel}：${statusLabel}` : `${blockLabel}: ${statusLabel}`;
}

export function formatTriggerDataSource(dataSource: string | null | undefined, language: UiLanguage): string {
  if (!dataSource) return '--';
  const labels = ALERT_TRIGGER_HISTORY_TEXT[language].dataSources as Record<string, string>;
  return labels[dataSource] ?? dataSource;
}

function formatDirection(token: string, text: TriggerHistoryText): string {
  return (text.directions as Record<string, string>)[token] ?? token;
}

function formatMarketStatus(token: string, text: TriggerHistoryText): string {
  return (text.marketStatuses as Record<string, string>)[token] ?? token;
}

function formatStopLossMode(token: string, text: TriggerHistoryText): string {
  return (text.stopLossModes as Record<string, string>)[token] ?? token;
}

function translateKnownPhrase(reason: string, text: TriggerHistoryText): string | null {
  const exact = (text.reasonExact as Record<string, string>)[reason];
  if (exact) return exact;

  for (const [prefix, template] of Object.entries(text.reasonPrefixes)) {
    if (reason.startsWith(prefix)) {
      return `${template}${reason.slice(prefix.length)}`;
    }
  }
  return null;
}

export function formatTriggerReason(
  reason: string | null | undefined,
  language: UiLanguage,
  fallback?: string | null,
): string {
  const raw = (reason || fallback || '').trim();
  if (!raw) return '--';

  const text = ALERT_TRIGGER_HISTORY_TEXT[language];
  if (language === 'en') {
    return raw;
  }

  const known = translateKnownPhrase(raw, text);
  if (known) return known;

  let match = raw.match(/^(\S+) price (above|below) ([0-9.]+)(?:: current = ([0-9.]+))?$/i);
  if (match) {
    const [, code, direction, price, current] = match;
    const dir = formatDirection(direction.toLowerCase(), text);
    return current
      ? text.reasonTemplates.priceTriggeredCurrent
        .replace('{code}', code)
        .replace('{direction}', dir)
        .replace('{price}', price)
        .replace('{current}', current)
      : text.reasonTemplates.priceTriggered
        .replace('{code}', code)
        .replace('{direction}', dir)
        .replace('{price}', price);
  }

  match = raw.match(/^(\S+) price ([0-9.]+) did not cross (above|below) ([0-9.]+)$/i);
  if (match) {
    const [, code, current, direction, price] = match;
    return text.reasonTemplates.priceNotTriggered
      .replace('{code}', code)
      .replace('{current}', current)
      .replace('{direction}', formatDirection(direction.toLowerCase(), text))
      .replace('{price}', price);
  }

  match = raw.match(/^(\S+) change (up|down) ([0-9.+-]+)%: current = ([0-9.+-]+)%$/i);
  if (match) {
    const [, code, direction, threshold, current] = match;
    return text.reasonTemplates.changeTriggered
      .replace('{code}', code)
      .replace('{direction}', formatDirection(direction.toLowerCase(), text))
      .replace('{threshold}', threshold)
      .replace('{current}', current);
  }

  match = raw.match(/^(\S+) change ([0-9.+-]+)% did not cross (up|down) ([0-9.+-]+)%$/i);
  if (match) {
    const [, code, current, direction, threshold] = match;
    return text.reasonTemplates.changeNotTriggered
      .replace('{code}', code)
      .replace('{current}', current)
      .replace('{direction}', formatDirection(direction.toLowerCase(), text))
      .replace('{threshold}', threshold);
  }

  match = raw.match(/^(\S+) volume spike: ([0-9,]+) \(([0-9.]+)x avg\)$/i);
  if (match) {
    const [, code, volume, ratio] = match;
    return text.reasonTemplates.volumeTriggered
      .replace('{code}', code)
      .replace('{volume}', volume)
      .replace('{ratio}', ratio);
  }

  match = raw.match(/^(\S+) volume ratio ([0-9.]+)x did not exceed ([0-9.]+)x$/i);
  if (match) {
    const [, code, ratio, multiplier] = match;
    return text.reasonTemplates.volumeNotTriggered
      .replace('{code}', code)
      .replace('{ratio}', ratio)
      .replace('{multiplier}', multiplier);
  }

  match = raw.match(/^Skipped (\d+) targets over soft cap$/i);
  if (match) {
    return text.reasonTemplates.skippedOverflow.replace('{count}', match[1]);
  }

  match = raw.match(/^Market Light status (\w+) matched \[(.+)\]$/i);
  if (match) {
    const [, status, list] = match;
    const joiner = language === 'zh' ? '、' : ', ';
    const statuses = list.split(',').map((item) => formatMarketStatus(item.trim().replace(/['"]/g, ''), text)).join(joiner);
    return text.reasonTemplates.marketStatusMatched
      .replace('{status}', formatMarketStatus(status, text))
      .replace('{statuses}', statuses);
  }

  match = raw.match(/^Market Light status (\w+) did not match \[(.+)\]$/i);
  if (match) {
    const [, status, list] = match;
    const joiner = language === 'zh' ? '、' : ', ';
    const statuses = list.split(',').map((item) => formatMarketStatus(item.trim().replace(/['"]/g, ''), text)).join(joiner);
    return text.reasonTemplates.marketStatusNotMatched
      .replace('{status}', formatMarketStatus(status, text))
      .replace('{statuses}', statuses);
  }

  match = raw.match(/^(.+) stop-loss (near|breach): (\d+) affected symbols$/i);
  if (match) {
    const [, account, mode, count] = match;
    return text.reasonTemplates.stopLossAffected
      .replace('{account}', account)
      .replace('{mode}', formatStopLossMode(mode.toLowerCase(), text))
      .replace('{count}', count);
  }

  match = raw.match(/^(.+) stop-loss (near|breach): no affected symbols$/i);
  if (match) {
    const [, account, mode] = match;
    return text.reasonTemplates.stopLossNone
      .replace('{account}', account)
      .replace('{mode}', formatStopLossMode(mode.toLowerCase(), text));
  }

  match = raw.match(/^(.+) concentration top weight ([0-9.]+)%$/i);
  if (match) {
    const [, account, value] = match;
    return text.reasonTemplates.concentration
      .replace('{account}', account)
      .replace('{value}', value);
  }

  match = raw.match(/^(.+) max drawdown ([0-9.]+)%$/i);
  if (match) {
    const [, account, value] = match;
    return text.reasonTemplates.drawdown
      .replace('{account}', account)
      .replace('{value}', value);
  }

  return raw;
}

export function formatTriggerObservedOrThreshold(value?: string | number | null): string {
  return formatNullable(value);
}
