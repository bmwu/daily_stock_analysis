const STORAGE_KEY = 'dsa.marketRadar.favoriteIndexCodes.v1';

export const DEFAULT_FAVORITE_INDEX_CODES = ['000001', '399001', '399006'] as const;

export function loadFavoriteIndexCodes(): string[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_FAVORITE_INDEX_CODES];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_FAVORITE_INDEX_CODES];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_FAVORITE_INDEX_CODES];
    }
    const codes = parsed
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return codes.length > 0 ? codes : [...DEFAULT_FAVORITE_INDEX_CODES];
  } catch {
    return [...DEFAULT_FAVORITE_INDEX_CODES];
  }
}

export function saveFavoriteIndexCodes(codes: string[]): string[] {
  const normalized = Array.from(
    new Set(codes.map((code) => String(code || '').trim()).filter(Boolean)),
  );
  const next = normalized.length > 0 ? normalized : [...DEFAULT_FAVORITE_INDEX_CODES];
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function toggleFavoriteIndexCode(codes: string[], code: string): string[] {
  const target = String(code || '').trim();
  if (!target) {
    return codes;
  }
  if (codes.includes(target)) {
    return saveFavoriteIndexCodes(codes.filter((item) => item !== target));
  }
  return saveFavoriteIndexCodes([...codes, target]);
}

/** Keep favorites, but order them by catalog (market) sequence. */
export function orderFavoriteCodesByCatalog(favoriteCodes: string[], catalogCodes: string[]): string[] {
  const favoriteSet = new Set(
    favoriteCodes.map((code) => String(code || '').trim()).filter(Boolean),
  );
  const ordered = catalogCodes
    .map((code) => String(code || '').trim())
    .filter((code) => code && favoriteSet.has(code));
  // Keep unknown favorites (not in catalog) at the end in original relative order.
  for (const code of favoriteSet) {
    if (!ordered.includes(code)) {
      ordered.push(code);
    }
  }
  return ordered;
}
