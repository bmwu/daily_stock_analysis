import type { UiTextKey } from '../i18n/uiText';

/** Shell sidebar routes → browser tab title key (nav label). */
export const SHELL_ROUTE_TITLE_KEYS: Record<string, UiTextKey> = {
  '/': 'layout.route.home.title',
  '/analysis': 'layout.route.analysis.title',
  '/chat': 'layout.route.chat.title',
  '/portfolio': 'layout.route.portfolio.title',
  '/decision-signals': 'layout.route.decisionSignals.title',
  '/screening': 'layout.route.screening.title',
  '/backtest': 'layout.route.backtest.title',
  '/alerts': 'layout.route.alerts.title',
  '/usage': 'layout.route.usage.title',
  '/settings': 'layout.route.settings.title',
};

export function documentTitleForPath(
  pathname: string,
  t: (key: UiTextKey) => string,
): string | null {
  const key = SHELL_ROUTE_TITLE_KEYS[pathname];
  if (!key) {
    return null;
  }
  return `${t(key)} - DSA`;
}
