import { describe, expect, it } from 'vitest';
import {
  currencySymbol,
  formatCompactMoney,
  formatMoneyAmount,
  normalizeCurrencyCode,
} from '../formatters';

describe('market radar money formatters', () => {
  it('maps common currency codes to symbols', () => {
    expect(normalizeCurrencyCode('usd')).toBe('USD');
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('CNY')).toBe('¥');
    expect(currencySymbol('HKD')).toBe('HK$');
    expect(currencySymbol('XYZ')).toBe('XYZ ');
  });

  it('formats account overview amounts with USD instead of hardcoded yuan', () => {
    expect(formatMoneyAmount(48900, 'USD')).toBe('$48,900');
    expect(formatCompactMoney(48900, 'USD')).toBe('$4.89万');
    expect(formatCompactMoney(-31260, 'USD')).toBe('-$3.13万');
  });

  it('keeps CNY symbol for A-share accounts', () => {
    expect(formatMoneyAmount(48900, 'CNY')).toBe('¥48,900');
    expect(formatCompactMoney(48900, null)).toBe('¥4.89万');
  });
});
