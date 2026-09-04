'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, CandlestickData, Time } from 'lightweight-charts';
import { useMarketStore } from '../store/marketStore';
import { TrendUp, Clock, ArrowsOutSimple } from '@phosphor-icons/react';

const RESOLUTIONS = ['1M', '5M', '15M', '1H', '1D'] as const;
type Resolution = typeof RESOLUTIONS[number];

export function MarketCandleChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const { selectedSymbol, ticks } = useMarketStore();
  const [resolution, setResolution] = useState<Resolution>('5M');
  const currentTick = ticks[selectedSymbol];

  // Helper to generate seed candles for chosen symbol & resolution
  const generateInitialCandles = useCallback((sym: string): CandlestickData<Time>[] => {
    const candles: CandlestickData<Time>[] = [];
    const basePrice = currentTick ? currentTick.referencePrice : 30000;
    const now = Math.floor(Date.now() / 1000);
    const step = resolution === '1M' ? 60 : resolution === '5M' ? 300 : resolution === '15M' ? 900 : resolution === '1H' ? 3600 : 86400;

    let price = basePrice;
    for (let i = 120; i >= 0; i--) {
      const time = (now - i * step) as Time;
      const change = (Math.random() - 0.48) * (basePrice * 0.01);
      const open = price;
      const close = Math.round(open + change);
      const high = Math.max(open, close) + Math.round(Math.random() * basePrice * 0.003);
      const low = Math.min(open, close) - Math.round(Math.random() * basePrice * 0.003);

      candles.push({ time, open, high, low, close });
      price = close;
    }
    return candles;
  }, [resolution, currentTick]);

  // Chart setup effect
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        vertLine: { color: '#10b981', labelBackgroundColor: '#18181b' },
        horzLine: { color: '#10b981', labelBackgroundColor: '#18181b' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: 380,
    });

    chartRef.current = chart;

    // lightweight-charts v5 API uses addSeries(CandlestickSeries, options)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    seriesRef.current = candlestickSeries;

    const initialData = generateInitialCandles(selectedSymbol);
    candlestickSeries.setData(initialData);
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
  }, [selectedSymbol, resolution, generateInitialCandles]);

  // Live update effect when currentTick changes
  useEffect(() => {
    if (!seriesRef.current || !currentTick) return;

    const now = Math.floor(Date.now() / 1000) as Time;
    const price = currentTick.price;

    seriesRef.current.update({
      time: now,
      open: currentTick.open || price,
      high: Math.max(currentTick.high || price, price),
      low: Math.min(currentTick.low || price, price),
      close: price,
    });
  }, [currentTick]);

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col h-full">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400">
            <TrendUp size={18} weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-100 text-sm tracking-tight">{selectedSymbol}</h3>
              <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                DNSE Real-time
              </span>
            </div>
            {currentTick && (
              <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
                <span className="text-zinc-100 font-bold">{(currentTick.price / 1000).toFixed(2)}</span>
                <span className={currentTick.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {currentTick.change >= 0 ? '+' : ''}{(currentTick.change / 1000).toFixed(2)} ({currentTick.changePercent.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Resolution Selector Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
          <Clock size={14} className="text-zinc-400 ml-1.5 mr-0.5" />
          {RESOLUTIONS.map((res) => (
            <button
              key={res}
              onClick={() => setResolution(res)}
              className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg transition-all ${
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
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg ml-1"
            title="Reset Chart View"
          >
            <ArrowsOutSimple size={14} />
          </button>
        </div>
      </div>

      {/* Lightweight Chart Container */}
      <div ref={chartContainerRef} className="w-full flex-1 min-h-[360px] rounded-xl overflow-hidden" />
    </div>
  );
}
