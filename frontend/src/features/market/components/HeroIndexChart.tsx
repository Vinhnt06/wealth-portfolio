'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  AreaSeries,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';

export interface Candle {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type ChartKind = 'area' | 'candle';

interface Props {
  candles: Candle[];
  kind: ChartKind;
  showMA20: boolean;
  showMA50: boolean;
  showVolume: boolean;
  height?: number;
  /** Báo lên cha cây nến đang được rê chuột tới (null = rời chart). */
  onHover?: (c: Candle | null, prev: Candle | null) => void;
}

const UP = '#10b981';
const DOWN = '#e5484d';

function sma(data: Candle[], period: number) {
  const out: { time: Time; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) out.push({ time: data[i].time as Time, value: sum / period });
  }
  return out;
}

export const HeroIndexChart: React.FC<Props> = ({
  candles,
  kind,
  showMA20,
  showMA50,
  showVolume,
  height = 320,
  onHover,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const hoverCb = useRef(onHover);
  hoverCb.current = onHover;

  const byTime = useMemo(() => {
    const m = new Map<string, number>();
    candles.forEach((c, i) => m.set(c.time, i));
    return m;
  }, [candles]);
  const byTimeRef = useRef(byTime);
  byTimeRef.current = byTime;
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const [tip, setTip] = useState<{ x: number; y: number; c: Candle; prev: Candle | null } | null>(null);

  // Khởi tạo chart (chỉ khi đổi loại chart / chiều cao)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8a8a8a',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.04)', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#555', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#222' },
        horzLine: { color: '#555', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#222' },
      },
      rightPriceScale: { borderColor: '#1f1f1f', scaleMargins: { top: 0.08, bottom: 0.2 } },
      timeScale: { borderColor: '#1f1f1f', rightOffset: 4, fixLeftEdge: true, timeVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    if (kind === 'area') {
      mainRef.current = chart.addSeries(AreaSeries, {
        lineColor: UP,
        topColor: 'rgba(16,185,129,0.38)',
        bottomColor: 'rgba(16,185,129,0.02)',
        lineWidth: 2,
        priceLineStyle: LineStyle.Dashed,
        priceLineColor: UP,
        crosshairMarkerRadius: 5,
      });
    } else {
      mainRef.current = chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderVisible: false,
        wickUpColor: UP,
        wickDownColor: DOWN,
        priceLineStyle: LineStyle.Dashed,
      });
    }

    ma20Ref.current = chart.addSeries(LineSeries, {
      color: '#e5a93b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ma50Ref.current = chart.addSeries(LineSeries, {
      color: '#6aa9ff',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    volRef.current = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    chart.subscribeCrosshairMove((p) => {
      const t = p.time as string | undefined;
      const idx = t ? byTimeRef.current.get(t) : undefined;
      if (!p.point || idx === undefined) {
        setTip(null);
        hoverCb.current?.(null, null);
        return;
      }
      const list = candlesRef.current;
      const c = list[idx];
      const prev = idx > 0 ? list[idx - 1] : null;
      setTip({ x: p.point.x, y: p.point.y, c, prev });
      hoverCb.current?.(c, prev);
    });

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      mainRef.current = null;
    };
  }, [kind, height]);

  // Đổ dữ liệu + fit lại khi đổi dữ liệu
  useEffect(() => {
    const chart = chartRef.current;
    const main = mainRef.current;
    if (!chart || !main || candles.length === 0) return;

    if (kind === 'area') {
      (main as ISeriesApi<'Area'>).setData(candles.map((c) => ({ time: c.time as Time, value: c.close })));
    } else {
      (main as ISeriesApi<'Candlestick'>).setData(
        candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
      );
    }

    // Màu vùng area theo xu hướng của khoảng đang xem
    if (kind === 'area') {
      const up = candles[candles.length - 1].close >= candles[0].close;
      const col = up ? UP : DOWN;
      (main as ISeriesApi<'Area'>).applyOptions({
        lineColor: col,
        priceLineColor: col,
        topColor: up ? 'rgba(16,185,129,0.38)' : 'rgba(229,72,77,0.34)',
        bottomColor: up ? 'rgba(16,185,129,0.02)' : 'rgba(229,72,77,0.02)',
      });
    }

    ma20Ref.current?.setData(sma(candles, 20));
    ma50Ref.current?.setData(sma(candles, 50));
    volRef.current?.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: c.volume ?? 0,
        color: c.close >= c.open ? 'rgba(16,185,129,0.35)' : 'rgba(229,72,77,0.35)',
      }))
    );
    chart.timeScale().fitContent();
  }, [candles, kind]);

  useEffect(() => {
    ma20Ref.current?.applyOptions({ visible: showMA20 });
  }, [showMA20, kind]);
  useEffect(() => {
    ma50Ref.current?.applyOptions({ visible: showMA50 });
  }, [showMA50, kind]);
  useEffect(() => {
    volRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume, kind]);

  const fmt = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tipLeft = tip ? (tip.x > (wrapRef.current?.clientWidth ?? 0) - 190 ? tip.x - 180 : tip.x + 16) : 0;

  return (
    <div className="relative w-full select-none">
      <div ref={wrapRef} className="w-full rounded-xl overflow-hidden" style={{ height }} />

      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-[168px] rounded-lg border border-[#2a2a2a] bg-[#0d0d0d]/95 backdrop-blur px-3 py-2 font-mono text-[11px] shadow-xl"
          style={{ left: tipLeft, top: Math.max(8, Math.min(tip.y - 40, height - 120)) }}
        >
          <div className="text-[#888] mb-1">
            {new Date(tip.c.time).toLocaleDateString('vi-VN', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
          <Row k="Mở" v={fmt(tip.c.open)} />
          <Row k="Cao" v={fmt(tip.c.high)} cls="text-[#10b981]" />
          <Row k="Thấp" v={fmt(tip.c.low)} cls="text-[#e5484d]" />
          <Row k="Đóng" v={fmt(tip.c.close)} cls="text-white font-bold" />
          {tip.prev && (
            <Row
              k="So phiên trước"
              v={`${tip.c.close >= tip.prev.close ? '+' : ''}${(((tip.c.close - tip.prev.close) / tip.prev.close) * 100).toFixed(2)}%`}
              cls={tip.c.close >= tip.prev.close ? 'text-[#10b981]' : 'text-[#e5484d]'}
            />
          )}
          {!!tip.c.volume && <Row k="KL" v={`${(tip.c.volume / 1_000_000).toFixed(1)}M`} />}
        </div>
      )}
    </div>
  );
};

const Row = ({ k, v, cls = 'text-zinc-200' }: { k: string; v: string; cls?: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-[#666]">{k}</span>
    <span className={cls}>{v}</span>
  </div>
);
