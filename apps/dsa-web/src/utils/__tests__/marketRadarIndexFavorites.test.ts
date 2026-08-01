import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FAVORITE_INDEX_CODES,
  loadFavoriteIndexCodes,
  orderFavoriteCodesByCatalog,
  saveFavoriteIndexCodes,
  toggleFavoriteIndexCode,
} from '../marketRadarIndexFavorites';

describe('marketRadarIndexFavorites', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads defaults when storage is empty', () => {
    expect(loadFavoriteIndexCodes()).toEqual([...DEFAULT_FAVORITE_INDEX_CODES]);
  });

  it('persists favorites and toggles membership', () => {
    const saved = saveFavoriteIndexCodes(['000001', 'HSI']);
    expect(saved).toEqual(['000001', 'HSI']);
    expect(loadFavoriteIndexCodes()).toEqual(['000001', 'HSI']);

    expect(toggleFavoriteIndexCode(saved, 'HSI')).toEqual(['000001']);
    expect(toggleFavoriteIndexCode(['000001'], 'SPX')).toEqual(['000001', 'SPX']);
  });

  it('falls back to defaults when favorites would become empty', () => {
    expect(toggleFavoriteIndexCode(['000001'], '000001')).toEqual([...DEFAULT_FAVORITE_INDEX_CODES]);
  });

  it('orders favorites by catalog sequence instead of toggle order', () => {
    const catalog = ['000001', '399001', '399006', 'HSI', 'SPX', 'N225'];
    expect(orderFavoriteCodesByCatalog(['SPX', '000001', 'HSI'], catalog)).toEqual([
      '000001',
      'HSI',
      'SPX',
    ]);
  });
});
