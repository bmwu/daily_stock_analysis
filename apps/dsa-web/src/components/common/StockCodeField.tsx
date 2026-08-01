import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { StockAutocomplete } from '../StockAutocomplete';
import { useWatchlist } from '../../hooks/useWatchlist';
import { portfolioApi } from '../../api/portfolio';
import { useUiLanguage } from '../../contexts/UiLanguageContext';
import { cn } from '../../utils/cn';

export type StockCodeFieldSource = 'watchlist' | 'portfolio' | 'history' | 'popular';

export type StockCodeCandidate = {
  code: string;
  displayCode?: string;
  name?: string;
  market?: string;
  source: StockCodeFieldSource;
};

export type StockCodeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (
    code: string,
    meta?: { name?: string; market?: string; displayCode?: string; source?: string },
  ) => void;
  onSelectCandidate?: (candidate: StockCodeCandidate) => void;
  placeholder?: string;
  ariaLabel?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  sources?: StockCodeFieldSource[];
  extraCandidates?: StockCodeCandidate[];
  enableAutocomplete?: boolean;
  showCandidateChips?: boolean;
  emptyWatchlistHref?: string;
  chipLimitPerSource?: number;
};

const DEFAULT_SOURCES: StockCodeFieldSource[] = ['watchlist'];
const SOURCE_ORDER: StockCodeFieldSource[] = ['watchlist', 'portfolio', 'history', 'popular'];

const PLAIN_INPUT_CLASS =
  'input-surface input-focus-glow h-11 w-full rounded-xl border bg-transparent px-4 text-sm transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

function candidateKey(candidate: Pick<StockCodeCandidate, 'code' | 'market' | 'source'>): string {
  return `${candidate.source}:${(candidate.market || '').toLowerCase()}:${candidate.code.trim().toUpperCase()}`;
}

export function StockCodeField({
  value,
  onChange,
  onSubmit,
  onSelectCandidate,
  placeholder,
  ariaLabel,
  label,
  disabled = false,
  className,
  inputClassName,
  sources = DEFAULT_SOURCES,
  extraCandidates = [],
  enableAutocomplete = true,
  showCandidateChips = true,
  emptyWatchlistHref = '/analysis',
  chipLimitPerSource = 12,
}: StockCodeFieldProps) {
  const { t } = useUiLanguage();
  const watchlist = useWatchlist();
  const [portfolioCandidates, setPortfolioCandidates] = useState<StockCodeCandidate[]>([]);
  const enabledSources = useMemo(
    () => SOURCE_ORDER.filter((source) => sources.includes(source)),
    [sources],
  );

  const portfolioEnabled = enabledSources.includes('portfolio');

  useEffect(() => {
    if (!portfolioEnabled) {
      return;
    }
    let cancelled = false;
    void portfolioApi
      .getSnapshot({ includeRealtime: false })
      .then((snapshot) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const next: StockCodeCandidate[] = [];
        for (const account of snapshot.accounts || []) {
          for (const position of account.positions || []) {
            const code = String(position.symbol || '').trim();
            if (!code) continue;
            const key = code.toUpperCase();
            if (seen.has(key)) continue;
            seen.add(key);
            next.push({
              code,
              displayCode: code,
              market: position.market,
              source: 'portfolio',
            });
          }
        }
        setPortfolioCandidates(next);
      })
      .catch(() => {
        if (!cancelled) setPortfolioCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [portfolioEnabled]);

  const grouped = useMemo(() => {
    const groups: Record<StockCodeFieldSource, StockCodeCandidate[]> = {
      watchlist: [],
      portfolio: [],
      history: [],
      popular: [],
    };
    if (enabledSources.includes('watchlist')) {
      for (const code of watchlist.watchlistCodes) {
        const trimmed = code.trim();
        if (!trimmed) continue;
        groups.watchlist.push({ code: trimmed, displayCode: trimmed, source: 'watchlist' });
      }
    }
    if (enabledSources.includes('portfolio')) {
      groups.portfolio = portfolioCandidates;
    }
    for (const candidate of extraCandidates) {
      if (!enabledSources.includes(candidate.source)) continue;
      if (candidate.source === 'watchlist' || candidate.source === 'portfolio') continue;
      groups[candidate.source].push(candidate);
    }
    for (const source of SOURCE_ORDER) {
      const seen = new Set<string>();
      const deduped: StockCodeCandidate[] = [];
      for (const item of groups[source]) {
        const code = item.code.trim().toUpperCase();
        if (!code) continue;
        const key = item.market
          ? `${String(item.market).toLowerCase()}:${code}`
          : code;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
        if (deduped.length >= chipLimitPerSource) break;
      }
      groups[source] = deduped;
    }
    return groups;
  }, [chipLimitPerSource, enabledSources, extraCandidates, portfolioCandidates, watchlist.watchlistCodes]);

  const sourceLabel = (source: StockCodeFieldSource): string => {
    if (source === 'watchlist') return t('stockCodeField.watchlist');
    if (source === 'portfolio') return t('stockCodeField.portfolio');
    if (source === 'history') return t('stockCodeField.history');
    return t('stockCodeField.popular');
  };

  const handlePick = (candidate: StockCodeCandidate) => {
    const nextValue = candidate.displayCode || candidate.code;
    onChange(nextValue);
    if (onSelectCandidate) {
      onSelectCandidate(candidate);
      return;
    }
    onSubmit?.(candidate.code, {
      name: candidate.name,
      market: candidate.market,
      displayCode: candidate.displayCode,
      source: candidate.source,
    });
  };

  const handlePlainKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !disabled && value.trim()) {
      event.preventDefault();
      onSubmit?.(value.trim());
    }
  };

  const showEmptyWatchlistHint =
    enabledSources.includes('watchlist')
    && !watchlist.isLoading
    && grouped.watchlist.length === 0;

  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <label className="mb-1.5 block text-xs font-medium text-secondary-text">{label}</label>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          {enableAutocomplete ? (
            <StockAutocomplete
              value={value}
              onChange={onChange}
              onSubmit={(code, name, source, metadata) => {
                onSubmit?.(code, {
                  name,
                  market: metadata?.market,
                  displayCode: metadata?.displayCode,
                  source,
                });
              }}
              disabled={disabled}
              placeholder={placeholder}
              ariaLabel={ariaLabel || label}
              className={inputClassName}
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handlePlainKeyDown}
              placeholder={placeholder}
              aria-label={ariaLabel || label}
              disabled={disabled}
              className={cn(PLAIN_INPUT_CLASS, inputClassName)}
            />
          )}
        </div>
        {enabledSources.includes('watchlist') && grouped.watchlist.length > 0 ? (
          <select
            className="input-surface input-focus-glow h-11 shrink-0 rounded-xl border bg-transparent px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            defaultValue=""
            aria-label={t('stockCodeField.pickFromWatchlist')}
            disabled={disabled}
            onChange={(event) => {
              const nextCode = event.target.value;
              event.target.value = '';
              if (!nextCode) return;
              const candidate = grouped.watchlist.find((item) => item.code === nextCode);
              if (candidate) handlePick(candidate);
            }}
          >
            <option value="">{t('stockCodeField.pickFromWatchlist')}</option>
            {grouped.watchlist.map((candidate) => (
              <option key={candidateKey(candidate)} value={candidate.code}>
                {candidate.displayCode || candidate.code}
                {candidate.name ? ` ${candidate.name}` : ''}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {showCandidateChips ? (
        <div className="mt-3 space-y-3">
          {enabledSources.map((source) => {
            const items = grouped[source];
            if (source === 'watchlist' && items.length === 0) {
              return showEmptyWatchlistHint ? (
                <div key={source} className="text-xs text-muted-text">
                  <span>{t('stockCodeField.emptyWatchlist')}</span>
                  {emptyWatchlistHref ? (
                    <>
                      {' · '}
                      <Link to={emptyWatchlistHref} className="text-primary hover:underline">
                        {t('stockCodeField.goAddWatchlist')}
                      </Link>
                    </>
                  ) : null}
                </div>
              ) : null;
            }
            if (items.length === 0) return null;
            return (
              <div key={source}>
                <p className="text-xs font-medium uppercase text-muted-text">{sourceLabel(source)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {items.map((candidate) => (
                    <button
                      key={candidateKey(candidate)}
                      type="button"
                      disabled={disabled}
                      className="rounded-full border border-border/70 bg-elevated/40 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => handlePick(candidate)}
                    >
                      <span className="font-mono">{candidate.displayCode ?? candidate.code}</span>
                      {candidate.name ? (
                        <span className="ml-1 text-secondary-text">{candidate.name}</span>
                      ) : null}
                      {candidate.market ? (
                        <span className="ml-1 text-muted-text">/ {candidate.market}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
