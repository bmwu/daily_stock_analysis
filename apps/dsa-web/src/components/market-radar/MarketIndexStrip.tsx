import type React from 'react';
import type { MarketRadarAccount, MarketRadarIndex } from '../../types/marketRadar';

function fmt(n?: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

function signedClass(n?: number | null): string {
  if (n == null || Number.isNaN(n) || n === 0) return 'text-secondary-text';
  return n > 0 ? 'text-success' : 'text-danger';
}

type Props = {
  indices: MarketRadarIndex[];
  account: MarketRadarAccount | null;
  updatedAt?: string;
};

export const MarketIndexStrip: React.FC<Props> = ({ indices, account, updatedAt }) => {
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-border/50 pb-3">
      {indices.map((item) => (
        <div key={`${item.code}-${item.name}`} className="min-w-[108px]">
          <div className="text-[11px] text-muted-text">{item.name}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold tabular-nums text-primary-text">{fmt(item.price)}</span>
            <span className={`text-xs tabular-nums ${signedClass(item.changePct)}`}>
              {item.changePct == null ? '—' : `${item.changePct > 0 ? '+' : ''}${fmt(item.changePct)}%`}
            </span>
          </div>
        </div>
      ))}
      {account ? (
        <div className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
          <div>
            <span className="text-muted-text">总资产 </span>
            <span className="font-medium text-primary-text">{fmt(account.totalAsset)}</span>
          </div>
          <div>
            <span className="text-muted-text">市值 </span>
            <span className="font-medium text-primary-text">{fmt(account.marketValue)}</span>
          </div>
          <div>
            <span className="text-muted-text">现金 </span>
            <span className="font-medium text-primary-text">{fmt(account.cash)}</span>
          </div>
          <div>
            <span className="text-muted-text">浮盈 </span>
            <span className={`font-medium ${signedClass(account.unrealizedPnl)}`}>
              {fmt(account.unrealizedPnl)}
            </span>
          </div>
        </div>
      ) : null}
      {updatedAt ? <div className="w-full text-[11px] text-muted-text">更新于 {updatedAt}</div> : null}
    </div>
  );
};
