import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FAVORITE_INDEX_CODES,
  loadFavoriteIndexCodes,
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
});
