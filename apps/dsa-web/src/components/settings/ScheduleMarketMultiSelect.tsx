import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Globe2 } from 'lucide-react';
import { useUiLanguage } from '../../contexts/UiLanguageContext';
import { cn } from '../../utils/cn';
import {
  SCHEDULE_STOCK_MARKETS,
  type ScheduleStockMarket,
} from '../../utils/scheduleSlots';

type ScheduleMarketMultiSelectProps = {
  value: readonly ScheduleStockMarket[];
  disabled?: boolean;
  'aria-label'?: string;
  onChange: (value: ScheduleStockMarket[]) => void;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export const ScheduleMarketMultiSelect: React.FC<ScheduleMarketMultiSelectProps> = ({
  value,
  disabled = false,
  'aria-label': ariaLabel,
  onChange,
}) => {
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const menuOpen = open && !disabled;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const regionLabels: Record<ScheduleStockMarket, string> = {
    cn: t('home.marketRegionCn'),
    hk: t('home.marketRegionHk'),
    us: t('home.marketRegionUs'),
    jp: t('home.marketRegionJp'),
    kr: t('home.marketRegionKr'),
    tw: t('home.marketRegionTw'),
  };

  const displayed = SCHEDULE_STOCK_MARKETS.filter((market) => value.includes(market));
  const triggerLabel = displayed.length === SCHEDULE_STOCK_MARKETS.length
    ? t('home.marketRegionAll')
    : displayed.map((market) => regionLabels[market]).join(' + ') || t('settings.schedulerSelectMarkets');

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setMenuPosition(null);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const preferredWidth = Math.min(22 * 16, window.innerWidth - viewportPadding * 2);
    const width = Math.max(rect.width, Math.min(preferredWidth, window.innerWidth - viewportPadding * 2));
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding,
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
    const available = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(160, Math.min(360, available - 8));
    const top = openUpward
      ? Math.max(viewportPadding, rect.top - maxHeight - 8)
      : Math.min(rect.bottom + 8, window.innerHeight - viewportPadding - 160);

    setMenuPosition({
      top,
      left,
      width,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, menuOpen]);

  useEffect(() => {
    if (!disabled) {
      return undefined;
    }
    const closeTimer = window.setTimeout(() => {
      setOpen(false);
      setMenuPosition(null);
    }, 0);
    return () => window.clearTimeout(closeTimer);
  }, [disabled]);

  const toggleMarket = (market: ScheduleStockMarket) => {
    if (disabled) return;
    const next = new Set<ScheduleStockMarket>(displayed);
    if (next.has(market)) {
      if (next.size === 1) return;
      next.delete(market);
    } else {
      next.add(market);
    }
    onChange(SCHEDULE_STOCK_MARKETS.filter((item) => next.has(item)));
  };

  const menu = menuOpen && menuPosition
    ? createPortal(
      <div
        ref={menuRef}
        role="dialog"
        aria-label={t('settings.schedulerSelectMarkets')}
        data-testid="scheduler-market-menu"
        style={{
          position: 'fixed',
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          maxHeight: menuPosition.maxHeight,
          zIndex: 80,
        }}
        className="overflow-y-auto rounded-2xl border settings-border bg-card p-2 shadow-xl"
      >
        <div className="border-b settings-border px-2.5 py-2">
          <p className="text-sm font-semibold text-foreground">{t('settings.schedulerMarkets')}</p>
          <p className="mt-1 text-xs leading-5 text-muted-text">{t('settings.schedulerMarketsHint')}</p>
        </div>
        <div className="space-y-1 py-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([...SCHEDULE_STOCK_MARKETS])}
            className="flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-secondary-text transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded border border-cyan/60 bg-cyan/10">
              <Check
                className={cn(
                  'h-3 w-3 text-cyan',
                  displayed.length === SCHEDULE_STOCK_MARKETS.length ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden="true"
              />
            </span>
            <span className="font-medium">{t('home.marketRegionAll')}</span>
          </button>
          <div className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-2">
            {SCHEDULE_STOCK_MARKETS.map((market) => {
              const checked = displayed.includes(market);
              return (
                <label
                  key={market}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-secondary-text transition-colors hover:bg-background/60 hover:text-foreground"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={checked}
                    onChange={() => toggleMarket(market)}
                    className="h-4 w-4 rounded border-border text-cyan focus:ring-cyan/20"
                  />
                  <span>{regionLabels[market]}</span>
                  <span className="ml-auto text-[11px] uppercase text-muted-text">{market}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-label={ariaLabel || t('settings.schedulerSelectMarkets')}
        data-testid="scheduler-market-trigger"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border settings-border bg-card/90 px-2.5 text-left text-xs text-foreground transition',
          'hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-cyan/20 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <Globe2 className="h-3.5 w-3.5 flex-shrink-0 text-cyan" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 flex-shrink-0 transition-transform', menuOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  );
};
