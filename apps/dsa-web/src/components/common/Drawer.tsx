import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUiLanguage } from '../../contexts/UiLanguageContext';
import { cn } from '../../utils/cn';

let activeDrawerCount = 0;

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  zIndex?: number;
  side?: 'left' | 'right';
  backdropClassName?: string;
  /** Enable drag-to-resize on the panel edge. */
  resizable?: boolean;
  /** Initial width as a fraction of the viewport (0-1). Used when resizable. */
  initialWidthRatio?: number;
  minWidthRatio?: number;
  maxWidthRatio?: number;
}

/**
 * Side drawer component with terminal-inspired styling.
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 'max-w-2xl',
  zIndex = 50,
  side = 'right',
  backdropClassName,
  resizable = false,
  initialWidthRatio = 0.5,
  minWidthRatio = 0.28,
  maxWidthRatio = 0.9,
}) => {
  const { t } = useUiLanguage();
  const [widthRatio, setWidthRatio] = useState(initialWidthRatio);
  const dragStateRef = useRef<{ startX: number; startRatio: number } | null>(null);

  useEffect(() => {
    if (isOpen && resizable) {
      setWidthRatio(initialWidthRatio);
    }
  }, [initialWidthRatio, isOpen, resizable]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      activeDrawerCount++;
      if (activeDrawerCount === 1) {
        document.body.style.overflow = 'hidden';
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        activeDrawerCount--;
        if (activeDrawerCount === 0) {
          document.body.style.overflow = '';
        }
      };
    }
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen || !resizable) return undefined;

    const clampRatio = (value: number) => Math.min(maxWidthRatio, Math.max(minWidthRatio, value));

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const deltaX = event.clientX - drag.startX;
      const viewportWidth = Math.max(window.innerWidth, 1);
      const deltaRatio = deltaX / viewportWidth;
      const nextRatio = side === 'right'
        ? drag.startRatio - deltaRatio
        : drag.startRatio + deltaRatio;
      setWidthRatio(clampRatio(nextRatio));
    };

    const onPointerUp = () => {
      dragStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isOpen, maxWidthRatio, minWidthRatio, resizable, side]);

  if (!isOpen) return null;

  const titleId = title ? `drawer-title-${side}` : undefined;
  const sidePositionClass = side === 'left' ? 'left-0 justify-start' : 'right-0 justify-end';
  const borderClass = side === 'left' ? 'border-r' : 'border-l';
  const panelStyle = resizable
    ? { width: `${Math.round(widthRatio * 1000) / 10}%` }
    : undefined;

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizable) return;
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      startX: event.clientX,
      startRatio: widthRatio,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex }} role="presentation">
      <div
        className={cn(
          'absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300',
          backdropClassName,
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'absolute inset-y-0 flex',
          sidePositionClass,
          resizable ? null : cn('w-full', width),
        )}
        style={panelStyle}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            'relative flex w-full flex-col bg-card',
            borderClass,
            side === 'right' ? 'border-border/80' : 'border-border/70 shadow-2xl',
            side === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right',
          )}
        >
          {resizable ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('common.resizeDrawer')}
              aria-valuemin={Math.round(minWidthRatio * 100)}
              aria-valuemax={Math.round(maxWidthRatio * 100)}
              aria-valuenow={Math.round(widthRatio * 100)}
              tabIndex={0}
              className={cn(
                'absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none',
                side === 'right' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
              )}
              onPointerDown={startResize}
            >
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/80" />
            </div>
          ) : null}
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            {title ? (
              <div>
                <span className="label-uppercase">DETAIL VIEW</span>
                <h2 id={titleId} className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
              </div>
            ) : <div />}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-secondary-text transition-colors hover:bg-hover hover:text-foreground"
              aria-label={t('common.closeDrawer')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
