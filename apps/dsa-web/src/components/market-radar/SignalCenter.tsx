import type React from 'react';
import { useMemo, useState } from 'react';
import type { MarketRadarInstrument, MarketRadarSignalLevel } from '../../types/marketRadar';
import { cn } from '../../utils/cn';

const LEVELS: Array<MarketRadarSignalLevel | 'all'> = ['all', 'green', 'orange', 'blue', 'red'];
const LEVEL_LABEL: Record<string, string> = {
  all: '全部',
  green: '风险',
  orange: '预警',
  blue: '观察',
  red: '确认',
};
const LEVEL_CLASS: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  orange: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  blue: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  red: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

type Props = {
  instruments: MarketRadarInstrument[];
  onSelectRule?: (ruleId: string) => void;
};

export const SignalCenter: React.FC<Props> = ({ instruments, onSelectRule }) => {
  const [filter, setFilter] = useState<MarketRadarSignalLevel | 'all'>('all');

  const rows = useMemo(() => {
    const out: Array<{ code: string; name: string; level: string; title: string; detail: string; rule: string }> = [];
    for (const item of instruments) {
      for (const signal of item.signals || []) {
        if (filter !== 'all' && signal.level !== filter) continue;
        out.push({
          code: item.code,
          name: item.name,
          level: signal.level,
          title: signal.title,
          detail: signal.detail,
          rule: signal.rule,
        });
      }
    }
    return out;
  }, [instruments, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-2 border-b border-border/50 p-3">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setFilter(level)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs',
              filter === level ? 'border-accent text-accent' : 'border-border/60 text-secondary-text',
            )}
          >
            {LEVEL_LABEL[level]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {!rows.length ? (
          <div className="p-4 text-sm text-muted-text">当前过滤条件下暂无信号</div>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((row, index) => (
              <li key={`${row.code}-${row.title}-${index}`} className="px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn('rounded border px-2 py-0.5 text-[11px]', LEVEL_CLASS[row.level] || '')}>
                    {LEVEL_LABEL[row.level] || row.level}
                  </span>
                  <span className="text-sm font-medium">{row.name || row.code}</span>
                  <span className="text-xs text-muted-text">{row.code}</span>
                </div>
                <div className="text-sm text-primary-text">{row.title}</div>
                <div className="mt-1 text-xs text-secondary-text">{row.detail}</div>
                <button
                  type="button"
                  className="mt-2 text-xs text-accent hover:underline"
                  onClick={() => {
                    const id = (row.rule.match(/\d+/) || [])[0];
                    if (id && onSelectRule) onSelectRule(id);
                  }}
                >
                  规则 {row.rule}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
