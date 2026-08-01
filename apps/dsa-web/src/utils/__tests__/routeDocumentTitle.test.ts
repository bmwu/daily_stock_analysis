import { beforeEach, describe, expect, it } from 'vitest';
import { documentTitleForPath, SHELL_ROUTE_TITLE_KEYS } from '../routeDocumentTitle';
import { UI_TEXT } from '../../i18n/uiText';

describe('routeDocumentTitle', () => {
  const t = (key: keyof typeof UI_TEXT.zh) => UI_TEXT.zh[key];

  beforeEach(() => {
    document.title = 'stale-title';
  });

  it('covers every sidebar shell route', () => {
    expect(Object.keys(SHELL_ROUTE_TITLE_KEYS).sort()).toEqual([
      '/',
      '/alerts',
      '/analysis',
      '/backtest',
      '/chat',
      '/decision-signals',
      '/portfolio',
      '/screening',
      '/settings',
      '/usage',
    ]);
  });

  it('maps paths to nav-aligned document titles', () => {
    expect(documentTitleForPath('/', t)).toBe('首页 - DSA');
    expect(documentTitleForPath('/analysis', t)).toBe('诊股 - DSA');
    expect(documentTitleForPath('/chat', t)).toBe('问股 - DSA');
    expect(documentTitleForPath('/screening', t)).toBe('选股 - DSA');
    expect(documentTitleForPath('/portfolio', t)).toBe('持仓 - DSA');
    expect(documentTitleForPath('/decision-signals', t)).toBe('AI 建议 - DSA');
    expect(documentTitleForPath('/backtest', t)).toBe('回测 - DSA');
    expect(documentTitleForPath('/alerts', t)).toBe('告警 - DSA');
    expect(documentTitleForPath('/usage', t)).toBe('用量 - DSA');
    expect(documentTitleForPath('/settings', t)).toBe('设置 - DSA');
  });

  it('returns null for unknown paths', () => {
    expect(documentTitleForPath('/nope', t)).toBeNull();
  });
});
