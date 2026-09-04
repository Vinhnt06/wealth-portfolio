'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, HistogramSeries, CandlestickData, HistogramData, Time } from 'lightweight-charts';
import { useMarketStore } from '../store/marketStore';
import { TrendUp, Clock, ArrowsOutSimple } from '@phosphor-icons/react';

const RESOLUTIONS = ['1m', '5m', '15m', '1h', '1D', '1Mo', '3Mo', '5Mo', '1Y', '3Y'] as const;
type Resolution = typeof RESOLUTIONS[number];

export function MarketCandleChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lastCandleRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  const { selectedSymbol, ticks } = useMarketStore();
  const [resolution, setResolution] = useState<Resolution>('15m');
  const currentTick = ticks[selectedSymbol];

  const getResolutionConfig = useCallback((res: Resolution) => {
    switch (res) {
      case '1m': return { step: 60, count: 120, isDaily: false };       // 2 hours of 1m candles
      case '5m': return { step: 300, count: 120, isDaily: false };      // 10 hours of 5m candles
      case '15m': return { step: 900, count: 120, isDaily: false };     // 30 hours of 15m candles
      case '1h': return { step: 3600, count: 120, isDaily: false };     // 5 days of 1h candles
      case '1D': return { step: 86400, count: 120, isDaily: true };     // 120 daily candles
      case '1Mo': return { step: 86400, count: 30, isDaily: true };     // 30 daily candles (1 Month)
      case '3Mo': return { step: 86400, count: 90, isDaily: true };     // 90 daily candles (3 Months)
      case '5Mo': return { step: 86400, count: 150, isDaily: true };    // 150 daily candles (5 Months)
      case '1Y': return { step: 86400 * 7, count: 52, isDaily: true };  // 52 weekly candles (1 Year)
      case '3Y': return { step: 86400 * 30, count: 36, isDaily: true }; // 36 monthly candles (3 Years)
    }
  }, []);

  // Generate historical candles for all resolutions (1m up to 3 Years)
  const generateInitialData = useCallback((sym: string, res: Resolution) => {
    const candles: CandlestickData<Time>[] = [];
    const volumes: HistogramData<Time>[] = [];

    const basePrices: Record<string, number> = {
      HPG: 28500, VCB: 92500, SSI: 35000, VHM: 41800, TCB: 23800,
      FPT: 132000, MBB: 24000, MWG: 64500, VNM: 67800, VIC: 44500,
      STB: 29800, VPB: 19200, BID: 49500, NVL: 14200, DIG: 26500,
      PDR: 22100, SHB: 11500, ACB: 24800, EIB: 18500, LPB: 31200,
    };
    const endPrice = basePrices[sym] || (currentTick?.price ? currentTick.price : 25000);

    const { step } = getResolutionConfig(res);
    const isDaily = res === '1D' || res.includes('Mo') || res.includes('Y');

    const countMap: Record<Resolution, number> = {
      '1m': 120, '5m': 120, '15m': 120, '1h': 120,
      '1D': 120, '1Mo': 30, '3Mo': 90, '5Mo': 150, '1Y': 52, '3Y': 36
    };
    const count = countMap[res];

    const nowSec = Math.floor(Date.now() / 1000);
    const alignedNow = isDaily ? Math.floor(nowSec / 86400) * 86400 : Math.floor(nowSec / step) * step;

    let current = endPrice;
    const rawList: { time: Time; open: number; high: number; low: number; close: number; volume: number }[] = [];

    for (let i = 0; i < count; i++) {
      const time = (alignedNow - i * step) as Time;
      const volatility = Math.max(10, Math.round(endPrice * (res.includes('Y') ? 0.015 : 0.004)));
      const change = Math.round((Math.random() - 0.49) * volatility);

      const close = current;
      const open = close - change;
      const high = Math.max(open, close) + Math.round(Math.random() * volatility * 0.5);
      const low = Math.min(open, close) - Math.round(Math.random() * volatility * 0.5);
      const volume = Math.floor(Math.random() * 150000) + 25000;

      rawList.push({ time, open, high, low, close, volume });
      current = open;
    }

    const sorted = rawList.reverse();

    sorted.forEach((item) => {
      candles.push({ time: item.time, open: item.open, high: item.high, low: item.low, close: item.close });
      volumes.push({
        time: item.time,
        value: item.volume,
        color: item.close >= item.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      });
    });

    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      lastCandleRef.current = { time: Number(last.time), open: last.open, high: last.high, low: last.low, close: last.close };
    }

    return { candles, volumes };
  }, [currentTick, getResolutionConfig]);

  // Chart setup effect — ONLY runs when selectedSymbol or resolution changes!
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const isDaily = resolution === '1D' || resolution.includes('Mo') || resolution.includes('Y');

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#71717a',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      crosshair: {
        vertLine: { color: '#10b981', labelBackgroundColor: '#18181b' },
        horzLine: { color: '#10b981', labelBackgroundColor: '#18181b' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        timeVisible: !isDaily,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: 380,
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });
    candleSeriesRef.current = candlestickSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const { candles, volumes } = generateInitialData(selectedSymbol, resolution);
    candlestickSeries.setData(candles);
    volumeSeries.setData(volumes);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [selectedSymbol, resolution, generateInitialData]);

  // Smooth live tick updates
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !currentTick) return;

    const isDaily = resolution === '1D' || resolution.includes('Mo') || resolution.includes('Y');
    const { step } = getResolutionConfig(resolution);
    const nowSec = Math.floor(Date.now() / 1000);
    const bucketTime = (isDaily ? Math.floor(nowSec / 86400) * 86400 : Math.floor(nowSec / step) * step) as Time;
    const price = currentTick.price;
    const tickVol = currentTick.volume || 1000;

    let updatedOpen = price;
    let updatedHigh = price;
    let updatedLow = price;

    if (lastCandleRef.current && lastCandleRef.current.time === Number(bucketTime)) {
      updatedOpen = lastCandleRef.current.open;
      updatedHigh = Math.max(lastCandleRef.current.high, price);
      updatedLow = Math.min(lastCandleRef.current.low, price);
    } else if (lastCandleRef.current) {
      updatedOpen = lastCandleRef.current.close;
      updatedHigh = Math.max(updatedOpen, price);
      updatedLow = Math.min(updatedOpen, price);
    }

    lastCandleRef.current = {
      time: Number(bucketTime),
      open: updatedOpen,
      high: updatedHigh,
      low: updatedLow,
      close: price,
    };

    candleSeriesRef.current.update({
      time: bucketTime,
      open: updatedOpen,
      high: updatedHigh,
      low: updatedLow,
      close: price,
    });

    volumeSeriesRef.current.update({
      time: bucketTime,
      value: tickVol,
      color: price >= updatedOpen ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
    });
  }, [currentTick, resolution, getResolutionConfig]);

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/60 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-full relative overflow-hidden">
      {/* Background Watermark Ticker Symbol */}
      <div className="absolute right-8 bottom-12 text-7xl font-mono font-black text-white/[0.02] select-none pointer-events-none tracking-tighter">
        {selectedSymbol}
      </div>

      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3 mb-4 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <TrendUp size={18} weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono font-bold text-zinc-100 text-sm tracking-tight">{selectedSymbol}</h3>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                HOSE
              </span>
            </div>
            {currentTick && (
              <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
                <span className="text-zinc-100 font-bold">{(currentTick.price / 1000).toFixed(2)}k</span>
                <span className={currentTick.change >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {currentTick.change >= 0 ? '+' : ''}{(currentTick.change / 1000).toFixed(2)} ({currentTick.changePercent.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Timeframe Selector Tabs (1m, 5m, 15m, 1h, 1D, 1Mo, 3Mo, 1Y, 3Y) */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80 overflow-x-auto max-w-full">
          <Clock size={14} className="text-zinc-500 ml-1.5 mr-0.5 shrink-0" />
          {RESOLUTIONS.map((res) => (
            <button
              key={res}
              onClick={() => setResolution(res)}
              className={`px-2 py-1 text-[10px] font-mono font-medium rounded-lg transition-all shrink-0 ${
                resolution === res
                  ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {res}
            </button>
          ))}
          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg ml-1 shrink-0"
            title="Reset Chart View"
          >
            <ArrowsOutSimple size={14} />
          </button>
        </div>
      </div>

      {/* Lightweight TradingView Chart Container */}
      <div ref={chartContainerRef} className="w-full flex-1 min-h-[360px] rounded-xl overflow-hidden z-10" />
    </div>
  );
}
