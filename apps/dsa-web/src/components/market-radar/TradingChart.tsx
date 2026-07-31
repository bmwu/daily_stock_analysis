import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { MarketRadarChart } from '../../types/marketRadar';
import { formatAmount, formatNetFlow, number2, signed, tradingMinuteOfDay } from './formatters';

export type ChartTheme = 'dark' | 'light';

const KLINE_WINDOWS = [20, 30, 60, 120] as const;

export function TradingChart({ data, mode, theme }: { data: MarketRadarChart; mode: "intraday" | "kline"; theme: ChartTheme }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [klineWindow, setKlineWindow] = useState<(typeof KLINE_WINDOWS)[number]>(30);
  const candles = useMemo(() => data.candles.slice(-klineWindow), [data.candles, klineWindow]);
  const count = mode === "intraday" ? data.intraday.length : candles.length;

  useEffect(() => {
    const el = canvas.current;
    if (!el || count < 2) return;

    function draw() {
      if (!el) return;
      const ratio = window.devicePixelRatio || 1;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      el.width = Math.max(1, Math.round(box.width * ratio));
      el.height = Math.max(1, Math.round(box.height * ratio));
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const rootStyle = getComputedStyle(document.documentElement);
      const colorToken = (name: string, fallback: string) => rootStyle.getPropertyValue(name).trim() || fallback;
      const upColor = colorToken("--red", "#ff5b70");
      const downColor = colorToken("--green", "#19c99a");
      const averageColor = colorToken("--amber", "#ffb453");
      const axisColor = colorToken("--chart-axis", "#8290a3");
      const gridColor = colorToken("--chart-grid", "rgba(82,108,139,.28)");
      const softGridColor = colorToken("--chart-grid-soft", "rgba(82,108,139,.16)");
      const crosshairColor = colorToken("--chart-crosshair", "rgba(218,234,250,.72)");
      const pointBackground = colorToken("--chart-point-bg", "#08101b");
      const tagBackground = colorToken("--chart-tag-bg", "#dceafb");
      const tagForeground = colorToken("--chart-tag-fg", "#07101a");
      const upTagForeground = colorToken("--status-up-fg", "#17080c");
      const downTagForeground = colorToken("--status-down-fg", "#04140f");
      const futureBackground = colorToken("--chart-future-bg", "rgba(130,144,163,.055)");

      const padding = { left: 12, right: 70, top: 22, bottom: 28 };
      const plotRight = box.width - padding.right;
      const plotBottom = box.height - 82;
      const volumeTop = plotBottom + 17;
      const volumeBottom = box.height - padding.bottom;
      const plotWidth = Math.max(1, plotRight - padding.left);
      const plotHeight = Math.max(1, plotBottom - padding.top);
      const prices = mode === "intraday" ? data.intraday.map((point) => point.price) : candles.flatMap((candle) => [candle.low, candle.high]);
      const averages = mode === "intraday" ? data.intraday.map((point) => point.average) : [];
      const volumes = mode === "intraday" ? data.intraday.map((point) => point.volume) : candles.map((candle) => candle.volume);
      const scaleValues = mode === "intraday" && data.previousClose > 0 ? [...prices, ...averages, data.previousClose] : [...prices, ...averages];
      const rawMin = Math.min(...scaleValues);
      const rawMax = Math.max(...scaleValues);
      const baseRange = rawMax - rawMin || Math.max(Math.abs(rawMax) * .004, .01);
      const scalePadding = mode === "intraday" ? .07 : .08;
      const min = rawMin - baseRange * scalePadding;
      const max = rawMax + baseRange * scalePadding;
      const range = max - min;
      const xFor = (index: number) => mode === "intraday"
        ? padding.left + (tradingMinuteOfDay(data.intraday[index]?.time ?? "09:30") / 240) * plotWidth
        : padding.left + (index / (count - 1)) * plotWidth;
      const yFor = (value: number) => padding.top + ((max - value) / range) * plotHeight;
      const currentPrice = mode === "intraday" ? data.intraday.at(-1)?.price ?? data.currentPrice : candles.at(-1)?.close ?? data.currentPrice;
      const positive = currentPrice >= data.previousClose;
      const color = positive ? upColor : downColor;

      ctx.clearRect(0, 0, box.width, box.height);
      if (mode === "intraday") {
        const latestX = xFor(count - 1);
        if (latestX < plotRight - 1) {
          ctx.fillStyle = futureBackground;
          ctx.fillRect(latestX, padding.top, plotRight - latestX, volumeBottom - padding.top);
          if (plotRight - latestX > 92) {
            ctx.fillStyle = axisColor;
            ctx.textAlign = "center";
            ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.fillText("尚未交易", latestX + (plotRight - latestX) / 2, padding.top + 12);
          }
        }
      }
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textBaseline = "middle";
      for (let index = 0; index <= 4; index += 1) {
        const y = padding.top + (index / 4) * plotHeight;
        const value = max - (index / 4) * range;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(plotRight, y);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = axisColor;
        ctx.textAlign = "left";
        ctx.fillText(value.toFixed(2), plotRight + 8, y);
      }

      const xLabels: Array<{ x: number; label: string; align: CanvasTextAlign }> = mode === "intraday"
        ? [
            { x: padding.left, label: "09:30", align: "left" },
            { x: padding.left + plotWidth * .25, label: "10:30", align: "center" },
            { x: padding.left + plotWidth * .5, label: "11:30 / 13:00", align: "center" },
            { x: padding.left + plotWidth * .75, label: "14:00", align: "center" },
            { x: plotRight, label: "15:00", align: "right" },
          ]
        : [0, Math.floor((count - 1) / 2), count - 1].map((index) => ({
            x: xFor(index),
            label: candles[index]?.date.slice(5) ?? "—",
            align: index === 0 ? "left" : index === count - 1 ? "right" : "center",
          }));
      xLabels.forEach(({ x, label, align }) => {
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, volumeBottom);
        ctx.strokeStyle = softGridColor;
        ctx.stroke();
        ctx.fillStyle = axisColor;
        ctx.textAlign = align;
        ctx.fillText(label, x, volumeBottom + 17);
      });

      const maxVolume = Math.max(...volumes, 1);
      const barStep = mode === "intraday" ? plotWidth / 240 : plotWidth / Math.max(1, count - 1);
      const barWidth = Math.max(1, Math.min(mode === "kline" ? 18 : 4, barStep * (mode === "kline" ? .72 : .64)));
      volumes.forEach((volume, index) => {
        const rising = mode === "intraday"
          ? index === 0 || data.intraday[index].price >= data.intraday[index - 1].price
          : candles[index].close >= candles[index].open;
        const height = (volume / maxVolume) * Math.max(1, volumeBottom - volumeTop);
        ctx.fillStyle = rising ? colorToken("--chart-volume-up", "rgba(255,91,112,.48)") : colorToken("--chart-volume-down", "rgba(25,201,154,.48)");
        ctx.fillRect(xFor(index) - barWidth / 2, volumeBottom - height, barWidth, height);
      });

      if (mode === "intraday") {
        const points = data.intraday.map((point, index) => ({ x: xFor(index), y: yFor(point.price) }));
        const averagePoints = data.intraday.map((point, index) => ({ x: xFor(index), y: yFor(point.average) }));
        const gradient = ctx.createLinearGradient(0, padding.top, 0, plotBottom);
        gradient.addColorStop(0, positive ? colorToken("--chart-up-fill", "rgba(255,91,112,.24)") : colorToken("--chart-down-fill", "rgba(25,201,154,.22)"));
        gradient.addColorStop(1, colorToken("--chart-fill-end", "rgba(10,16,27,0)"));
        ctx.beginPath();
        ctx.moveTo(points[0].x, plotBottom);
        points.forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points.at(-1)!.x, plotBottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.beginPath();
        averagePoints.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
        ctx.strokeStyle = averageColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.beginPath();
        points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (data.previousClose > 0) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(padding.left, yFor(data.previousClose));
          ctx.lineTo(plotRight, yFor(data.previousClose));
          ctx.strokeStyle = colorToken("--chart-previous", "rgba(141,160,183,.58)");
          ctx.stroke();
          ctx.restore();
        }
      } else {
        candles.forEach((candle, index) => {
          const x = xFor(index);
          const rising = candle.close >= candle.open;
          const candleColor = rising ? upColor : downColor;
          ctx.beginPath();
          ctx.moveTo(x, yFor(candle.high));
          ctx.lineTo(x, yFor(candle.low));
          ctx.strokeStyle = candleColor;
          ctx.lineWidth = 1.8;
          ctx.stroke();
          const bodyTop = yFor(Math.max(candle.open, candle.close));
          const bodyBottom = yFor(Math.min(candle.open, candle.close));
          const trueBodyHeight = Math.abs(bodyBottom - bodyTop);
          const bodyHeight = Math.max(4, trueBodyHeight);
          const bodyY = trueBodyHeight < 4 ? (bodyTop + bodyBottom) / 2 - 2 : bodyTop;
          ctx.save();
          ctx.globalAlpha = rising ? .72 : .82;
          ctx.fillStyle = candleColor;
          ctx.fillRect(x - barWidth / 2, bodyY, barWidth, bodyHeight);
          ctx.restore();
          ctx.strokeStyle = candleColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(x - barWidth / 2, bodyY, barWidth, bodyHeight);

          const bodyChange = candle.open ? ((candle.close / candle.open) - 1) * 100 : 0;
          if (Math.abs(bodyChange) >= 3 || index === candles.length - 1) {
            const labelY = rising ? Math.max(padding.top + 9, yFor(candle.high) - 10) : Math.min(plotBottom - 8, yFor(candle.low) + 11);
            ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.textAlign = index > candles.length - 4 ? "right" : index < 2 ? "left" : "center";
            ctx.fillStyle = candleColor;
            ctx.fillText((bodyChange > 0 ? "+" : "") + bodyChange.toFixed(1) + "%", x, labelY);
          }
        });
      }

      const highIndex = mode === "intraday"
        ? data.intraday.reduce((best, point, index) => point.price > data.intraday[best].price ? index : best, 0)
        : candles.reduce((best, candle, index) => candle.high > candles[best].high ? index : best, 0);
      const lowIndex = mode === "intraday"
        ? data.intraday.reduce((best, point, index) => point.price < data.intraday[best].price ? index : best, 0)
        : candles.reduce((best, candle, index) => candle.low < candles[best].low ? index : best, 0);
      const highPrice = mode === "intraday" ? data.intraday[highIndex].price : candles[highIndex].high;
      const lowPrice = mode === "intraday" ? data.intraday[lowIndex].price : candles[lowIndex].low;
      [[highIndex, highPrice, "高", upColor], [lowIndex, lowPrice, "低", downColor]].forEach(([rawIndex, rawPrice, label, labelColor]) => {
        const index = Number(rawIndex);
        const price = Number(rawPrice);
        const x = xFor(index);
        const y = yFor(price);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = String(labelColor);
        ctx.fill();
        ctx.fillStyle = String(labelColor);
        ctx.textAlign = x > plotRight - 100 ? "right" : "left";
        ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(String(label) + " " + price.toFixed(2), x + (x > plotRight - 100 ? -7 : 7), y + (String(label) === "高" ? -11 : 12));
      });

      const latestY = yFor(currentPrice);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, latestY);
      ctx.lineTo(plotRight, latestY);
      ctx.strokeStyle = positive ? "rgba(255,91,112,.55)" : "rgba(25,201,154,.55)";
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.fillRect(plotRight + 4, latestY - 10, 62, 20);
      ctx.fillStyle = positive ? upTagForeground : downTagForeground;
      ctx.textAlign = "center";
      ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(currentPrice.toFixed(2), plotRight + 35, latestY);

      if (hoverIndex !== null && hoverIndex < count) {
        const inspectedPrice = hoverPrice ?? (mode === "intraday" ? data.intraday[hoverIndex].price : candles[hoverIndex].close);
        const point = { x: xFor(hoverIndex), y: yFor(inspectedPrice) };
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = crosshairColor;
        ctx.beginPath();
        ctx.moveTo(point.x, padding.top);
        ctx.lineTo(point.x, plotBottom);
        ctx.moveTo(padding.left, point.y);
        ctx.lineTo(plotRight, point.y);
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = pointBackground;
        ctx.fill();
        const inspectedColor = mode === "kline" && candles[hoverIndex].close < candles[hoverIndex].open ? downColor : upColor;
        ctx.strokeStyle = mode === "intraday" ? color : inspectedColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = tagBackground;
        ctx.fillRect(plotRight + 4, point.y - 10, 62, 20);
        ctx.fillStyle = tagForeground;
        ctx.textAlign = "center";
        ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(inspectedPrice.toFixed(2), plotRight + 35, point.y);
      }
    }

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [candles, count, data, hoverIndex, hoverPrice, mode, theme]);

  function selectPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const left = 12;
    const right = box.width - 70;
    const x = Math.min(right, Math.max(left, event.clientX - box.left));
    if (mode === "intraday") {
      const targetMinute = ((x - left) / Math.max(1, right - left)) * 240;
      const latestMinute = tradingMinuteOfDay(data.intraday.at(-1)?.time ?? "09:30");
      if (targetMinute > latestMinute + .5) {
        setHoverIndex(null);
        setHoverPrice(null);
        return;
      }
      const index = data.intraday.reduce((best, point, pointIndex) =>
        Math.abs(tradingMinuteOfDay(point.time) - targetMinute) < Math.abs(tradingMinuteOfDay(data.intraday[best].time) - targetMinute)
          ? pointIndex
          : best, 0);
      setHoverIndex(index);
      setHoverPrice(data.intraday[index].price);
      return;
    }
    const index = Math.round(((x - left) / Math.max(1, right - left)) * (count - 1));
    const candle = candles[index];
    const top = 22;
    const bottom = box.height - 82;
    const plotHeight = Math.max(1, bottom - top);
    const lowsAndHighs = candles.flatMap((item) => [item.low, item.high]);
    const rawMin = Math.min(...lowsAndHighs);
    const rawMax = Math.max(...lowsAndHighs);
    const baseRange = rawMax - rawMin || Math.max(Math.abs(rawMax) * .004, .01);
    const min = rawMin - baseRange * .08;
    const max = rawMax + baseRange * .08;
    const pointerY = Math.min(bottom, Math.max(top, event.clientY - box.top));
    const pointerPrice = max - ((pointerY - top) / plotHeight) * (max - min);
    setHoverIndex(index);
    setHoverPrice(Math.min(candle.high, Math.max(candle.low, pointerPrice)));
  }

  const inspectedMinute = mode === "intraday" && hoverIndex !== null ? data.intraday[hoverIndex] : null;
  const inspectedCandle = mode === "kline" && hoverIndex !== null ? candles[hoverIndex] : null;
  const inspectedPrice = hoverPrice ?? inspectedMinute?.price ?? inspectedCandle?.close ?? null;
  const comparePrice = inspectedMinute
    ? data.previousClose
    : inspectedCandle && hoverIndex !== null && hoverIndex > 0 ? candles[hoverIndex - 1].close : data.previousClose;
  const change = inspectedPrice !== null && comparePrice ? ((inspectedPrice / comparePrice) - 1) * 100 : null;

  return (
    <div className={"interactive-chart " + mode}>
      <div className="chart-legend">
        {mode === "intraday" ? <><span className="price-line">价格</span><span className="average-line">均价</span><span className="volume-line">成交量</span></> : <><span className="rise-candle">上涨</span><span className="fall-candle">下跌</span><span className="volume-line">成交量</span></>}
      </div>
      {mode === "kline" && <div className="kline-zoom-controls" aria-label="日K显示范围">
        <button type="button" onClick={() => setKlineWindow(KLINE_WINDOWS[Math.max(0, KLINE_WINDOWS.indexOf(klineWindow) - 1)])} disabled={klineWindow === KLINE_WINDOWS[0]} title="放大K线，减少可见交易日">＋ 放大</button>
        <strong>{Math.min(klineWindow, candles.length)}日</strong>
        <button type="button" onClick={() => setKlineWindow(KLINE_WINDOWS[Math.min(KLINE_WINDOWS.length - 1, KLINE_WINDOWS.indexOf(klineWindow) + 1)])} disabled={klineWindow === KLINE_WINDOWS.at(-1)} title="缩小K线，显示更多交易日">－ 缩小</button>
        <button type="button" className="overview" onClick={() => setKlineWindow(120)} disabled={klineWindow === 120}>全景</button>
      </div>}
      <canvas
        className="sparkline"
        ref={canvas}
        aria-label={mode === "intraday" ? "当日分时价格图，可用鼠标或键盘查看分钟行情" : `近${Math.min(klineWindow, candles.length)}个交易日K线图，可用鼠标或键盘查看日线行情`}
        tabIndex={0}
        onPointerMove={selectPointer}
        onPointerDown={selectPointer}
        onPointerLeave={() => { setHoverIndex(null); setHoverPrice(null); }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const next = Math.min(count - 1, Math.max(0, (hoverIndex ?? count - 1) + (event.key === "ArrowLeft" ? -1 : 1)));
          setHoverIndex(next);
          setHoverPrice(mode === "intraday" ? data.intraday[next].price : candles[next].close);
        }}
      />
      {hoverIndex !== null && inspectedPrice !== null && (
        <div className={"chart-hover-card " + (hoverIndex < count / 2 ? "right" : "left")} role="status">
          <small>{inspectedMinute?.time ?? inspectedCandle?.date} · {mode === "intraday" ? "分时" : "日K指针价"}</small>
          <div className="hover-price-row"><b>{number2.format(inspectedPrice)}</b><em className={change === null ? "neutral" : change >= 0 ? "up" : "down"}>{change === null ? "—" : signed(change, "%")}</em></div>
          {inspectedMinute && <div className="chart-detail-grid"><span>均价 <b>{number2.format(inspectedMinute.average)}</b></span><span>成交 <b>{formatAmount(inspectedMinute.volume)}手</b></span></div>}
          {inspectedCandle && <div className="chart-detail-grid ohlc">
            <span>开 <b>{number2.format(inspectedCandle.open)}</b></span><span>高 <b className="up">{number2.format(inspectedCandle.high)}</b></span>
            <span>低 <b className="down">{number2.format(inspectedCandle.low)}</b></span><span>收 <b>{number2.format(inspectedCandle.close)}</b></span>
            <span>实体 <b className={inspectedCandle.close >= inspectedCandle.open ? "up" : "down"}>{signed(((inspectedCandle.close / inspectedCandle.open) - 1) * 100, "%")}</b></span>
            <span>振幅 <b>{number2.format(((inspectedCandle.high - inspectedCandle.low) / inspectedCandle.open) * 100)}%</b></span>
          </div>}
          {inspectedCandle && <div className="chart-flow-grid">
            <span>主力净额 <b className={inspectedCandle.mainNetFlow == null ? "neutral" : inspectedCandle.mainNetFlow >= 0 ? "up" : "down"}>{formatNetFlow(inspectedCandle.mainNetFlow ?? null)}</b></span>
            <span>超大单 <b className={inspectedCandle.superLargeNetFlow == null ? "neutral" : inspectedCandle.superLargeNetFlow >= 0 ? "up" : "down"}>{formatNetFlow(inspectedCandle.superLargeNetFlow ?? null)}</b></span>
            <span>大单 <b className={inspectedCandle.largeNetFlow == null ? "neutral" : inspectedCandle.largeNetFlow >= 0 ? "up" : "down"}>{formatNetFlow(inspectedCandle.largeNetFlow ?? null)}</b></span>
            <small>东方财富公开资金流 · 净额口径</small>
          </div>}
        </div>
      )}
    </div>
  );
}

export function DemoChart() {
  return (
    <div className="demo-chart" aria-label="等待实时行情">
      {[44, 52, 49, 63, 58, 72, 67, 78, 71, 86, 83, 92].map((height, index) => (
        <i key={index} style={{ height: height + "%" }} />
      ))}
    </div>
  );
}

