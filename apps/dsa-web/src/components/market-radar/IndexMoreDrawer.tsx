import type React from 'react';
import { useMemo, useState } from 'react';
import { Drawer } from '../common/Drawer';
import type { MarketRadarIndex, MarketRadarIndexCatalogItem } from '../../types/marketRadar';
import { formatAmount, number2, signed } from './formatters';

const REGION_TABS: Array<{ id: 'all' | string; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'cn', label: 'A股' },
  { id: 'hk', label: '港股' },
  { id: 'us', label: '美股' },
  { id: 'jp', label: '日股' },
  { id: 'kr', label: '韩股' },
  { id: 'tw', label: '台股' },
];

function n(value?: number | null, fallback = 0): number {
  return value == null || Number.isNaN(Number(value)) ? fallback : Number(value);
}

type Props = {
  open: boolean;
  onClose: () => void;
  catalog: MarketRadarIndexCatalogItem[];
  quotes: MarketRadarIndex[];
  favoriteCodes: string[];
  onToggleFavorite: (code: string) => void;
};

export const IndexMoreDrawer: React.FC<Props> = ({
  open,
  onClose,
  catalog,
  quotes,
  favoriteCodes,
  onToggleFavorite,
}) => {
  const [region, setRegion] = useState<'all' | string>('all');
  const quoteByCode = useMemo(() => {
    const map = new Map<string, MarketRadarIndex>();
    for (const item of quotes) {
      map.set(item.code, item);
    }
    return map;
  }, [quotes]);

  const rows = useMemo(() => {
    const favoriteSet = new Set(favoriteCodes);
    return catalog
      .filter((item) => region === 'all' || item.region === region)
      .map((item) => {
        const quote = quoteByCode.get(item.code);
        return {
          code: item.code,
          name: quote?.name || item.name,
          region: item.region,
          price: quote?.price,
          changePct: quote?.changePct,
          change: quote?.change,
          amount: quote?.amount,
          favorite: favoriteSet.has(item.code),
        };
      });
  }, [catalog, favoriteCodes, quoteByCode, region]);

  return (
    <Drawer isOpen={open} onClose={onClose} title="指数列表" width="max-w-xl" side="right">
      <div className="index-more-drawer">
        <div className="index-region-tabs" role="tablist" aria-label="指数市场筛选">
          {REGION_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={region === tab.id}
              className={region === tab.id ? 'active' : ''}
              onClick={() => setRegion(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="index-more-list">
          {rows.length === 0 ? (
            <div className="index-more-empty">该分区暂无指数</div>
          ) : (
            rows.map((item) => (
              <article className="index-more-row" key={item.code}>
                <div className="index-more-main">
                  <div className="index-more-title">
                    <strong>{item.name}</strong>
                    <small>{item.code}</small>
                  </div>
                  <div className="index-more-quote">
                    <span>{item.price == null ? '—' : number2.format(n(item.price))}</span>
                    <span className={n(item.changePct) >= 0 ? 'up' : 'down'}>
                      {item.changePct == null ? '—' : signed(n(item.changePct), '%')}
                    </span>
                    <span className="muted">{item.amount == null ? '' : `额 ${formatAmount(n(item.amount))}`}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={item.favorite ? 'index-fav-btn active' : 'index-fav-btn'}
                  onClick={() => onToggleFavorite(item.code)}
                >
                  {item.favorite ? '取消常用' : '设为常用'}
                </button>
              </article>
            ))
          )}
        </div>
      </div>
    </Drawer>
  );
};
