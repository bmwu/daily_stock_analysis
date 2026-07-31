import type React from 'react';
import type { MarketRadarInstrument } from '../../types/marketRadar';
import { cn } from '../../utils/cn';

function fmt(n?: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

const LEVEL_DOT: Record<string, string> = {
  green: 'bg-emerald-400',
  orange: 'bg-amber-400',
  blue: 'bg-sky-400',
  red: 'bg-rose-400',
};

type Props = {
  items: MarketRadarInstrument[];
  activeCode: string | null;
  onSelect: (code: string) => void;
};

export const QuoteList: React.FC<Props> = ({ items, activeCode, onSelect }) => {
  if (!items.length) {
    return <div className="p-3 text-sm text-muted-text">暂无标的</div>;
  }
  return (
    <div className="divide-y divide-border/40">
      {items.map((item) => {
        const active = item.code === activeCode;
        const change = item.changePct;
        const levels = Array.from(new Set((item.signals || []).map((s) => s.level)));
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => onSelect(item.code)}
            className={cn(
              'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
              active ? 'bg-accent/12' : 'hover:bg-panel/50',
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate text-sm font-medium text-primary-text">
                <span className="truncate">{item.name || item.code}</span>
                {levels.map((level) => (
                  <span
                    key={level}
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', LEVEL_DOT[level] || 'bg-muted-text')}
                    title={level}
                  />
                ))}
              </div>
              <div className="text-[11px] text-muted-text">{item.code}</div>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-sm font-medium">{fmt(item.price)}</div>
              <div
                className={cn(
                  'text-xs',
                  change != null && change > 0
                    ? 'text-success'
                    : change != null && change < 0
                      ? 'text-danger'
                      : 'text-secondary-text',
                )}
              >
                {change == null ? '—' : `${change > 0 ? '+' : ''}${fmt(change)}%`}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
