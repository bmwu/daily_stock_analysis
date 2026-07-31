import type React from 'react';
import { useEffect, useRef } from 'react';
import type { MarketRadarChart } from '../../types/marketRadar';

type Props = {
  chart: MarketRadarChart | null;
  mode: 'intraday' | 'kline';
  loading?: boolean;
};

export const TradingChart: React.FC<Props> = ({ chart, mode, loading }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chart) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 320;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = 14;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(148,163,184,0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (mode === 'intraday') {
      const points = chart.intraday || [];
      if (points.length < 2) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('暂无分时数据', 20, 28);
        return;
      }
      const prices = points.map((p) => p.price);
      const min = Math.min(...prices, chart.previousClose || prices[0]);
      const max = Math.max(...prices, chart.previousClose || prices[0]);
      const span = max - min || 1;

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(148,163,184,0.45)';
      ctx.beginPath();
      const y0 = pad + ((max - (chart.previousClose || min)) / span) * (height - pad * 2);
      ctx.moveTo(pad, y0);
      ctx.lineTo(width - pad, y0);
      ctx.stroke();
      ctx.setLineDash([]);

      const pathPoints: Array<{ x: number; y: number }> = points.map((point, index) => ({
        x: pad + (index / (points.length - 1)) * (width - pad * 2),
        y: pad + ((max - point.price) / span) * (height - pad * 2),
      }));
      const last = pathPoints[pathPoints.length - 1];
      const up = (chart.currentPrice ?? prices[prices.length - 1]) >= (chart.previousClose || 0);
      const gradient = ctx.createLinearGradient(0, pad, 0, height - pad);
      gradient.addColorStop(0, up ? 'rgba(0,212,255,0.28)' : 'rgba(255,68,102,0.22)');
      gradient.addColorStop(1, 'rgba(11,18,32,0)');
      ctx.beginPath();
      pathPoints.forEach((p, index) => {
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.lineTo(last.x, height - pad);
      ctx.lineTo(pathPoints[0].x, height - pad);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.strokeStyle = up ? '#00d4ff' : '#ff6680';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      pathPoints.forEach((p, index) => {
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      return;
    }

    const candles = chart.candles || [];
    if (!candles.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('暂无 K 线数据', 20, 28);
      return;
    }
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const span = max - min || 1;
    const slot = (width - pad * 2) / candles.length;
    candles.forEach((candle, index) => {
      const x = pad + index * slot + slot / 2;
      const yHigh = pad + ((max - candle.high) / span) * (height - pad * 2);
      const yLow = pad + ((max - candle.low) / span) * (height - pad * 2);
      const yOpen = pad + ((max - candle.open) / span) * (height - pad * 2);
      const yClose = pad + ((max - candle.close) / span) * (height - pad * 2);
      const up = candle.close >= candle.open;
      ctx.strokeStyle = up ? '#00ff88' : '#ff4466';
      ctx.fillStyle = up ? '#00ff88' : '#ff4466';
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();
      const top = Math.min(yOpen, yClose);
      const body = Math.max(2, Math.abs(yClose - yOpen));
      ctx.fillRect(x - Math.max(1, slot * 0.28), top, Math.max(2, slot * 0.56), body);
    });
  }, [chart, mode]);

  return (
    <div className="relative h-[320px] w-full overflow-hidden border border-slate-700/60 bg-[#0b1220]">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b1220]/60 text-sm text-slate-300">
          更新中…
        </div>
      ) : null}
      {!chart && !loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
          选择左侧标的查看图表
        </div>
      ) : null}
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
};
