'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CandlestickData,
  HistogramData,
  LineData,
  Time,
} from 'lightweight-charts';
import { useMarketStore } from '../store/marketStore';
import { TrendUp, TrendDown, Clock, ArrowsOutSimple, Eye, EyeSlash, ChartLine, Sparkle } from '@phosphor-icons/react';

// Timeframe Resolution Presets
const RESOLUTIONS = [
  { id: '1m', label: '1M' },
  { id: '5m', label: '5M' },
  { id: '15m', label: '15M' },
  { id: '1h', label: '1H' },
  { id: '1D', label: '1D' },
  { id: '1Mo', label: '1Tháng' },
  { id: '3Mo', label: '3Tháng' },
  { id: '6Mo', label: '6Tháng' },
  { id: '1Y', label: '1Năm' },
  { id: 'ALL', label: 'Tất cả' },
] as const;

type ResolutionId = typeof RESOLUTIONS[number]['id'];

// Seeded PRNG for 100% deterministic, consistent historical bars per symbol
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Generate N trading day strings (YYYY-MM-DD) excluding weekends (Saturday/Sunday)
function getTradingDayStrings(count: number): string[] {
  const dates: string[] = [];
  const curr = new Date();

  while (dates.length < count) {
    const day = curr.getDay();
    if (day !== 0 && day !== 6) { // Exclude Sunday (0) & Saturday (6)
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    curr.setDate(curr.getDate() - 1);
  }
  return dates.reverse();
}

// Generate intraday timestamps (in seconds)
function getIntradayTimestamps(count: number, stepSec: number): number[] {
  const times: number[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const alignedNow = Math.floor(nowSec / stepSec) * stepSec;

  for (let i = count - 1; i >= 0; i--) {
    times.push(alignedNow - i * stepSec);
  }
  return times;
}

// ── Official TradingView Pro Embed Component ──────────────────────────
function TradingViewProEmbed({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = `tv_widget_${symbol.toLowerCase()}`;

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).TradingView !== 'undefined' && containerRef.current) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: `HOSE:${symbol.toUpperCase()}`,
          interval: 'D',
          timezone: 'Asia/Ho_Chi_Minh',
          theme: 'dark',
          style: '1',
          locale: 'vi',
          toolbar_bg: '#09090b',
          enable_publishing: false,
          allow_symbol_change: false,
          container_id: containerId,
          hide_side_toolbar: false,
          studies: ['MASimple@tv-basicstudies', 'RSI@tv-basicstudies'],
        });
      }
    };
    containerRef.current.appendChild(script);
  }, [symbol, containerId]);

  return (
    <div className="w-full h-[460px] min-h-[460px] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800/80">
      <div id={containerId} ref={containerRef} className="w-full h-[460px] min-h-[460px]" />
    </div>
  );
}

// ── Main MarketCandleChart Component ─────────────────────────────────
export function MarketCandleChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lastCandleRef = useRef<{ time: Time; open: number; high: number; low: number; close: number } | null>(null);

  const { selectedSymbol, ticks } = useMarketStore();
  const [chartMode, setChartMode] = useState<'tradingview' | 'native'>('native');
  const [resolution, setResolution] = useState<ResolutionId>('1D');
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(true);
  const [hoveredData, setHoveredData] = useState<{
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    change?: number;
    changePct?: number;
  } | null>(null);

  const currentTick = ticks[selectedSymbol];

  // Base reference prices in thousands (e.g., HPG = 28.5k, VCB = 92.5k)
  const getBasePriceK = useCallback((sym: string) => {
    const defaultPricesK: Record<string, number> = {
      HPG: 28.5, VCB: 92.5, SSI: 34.2, VHM: 42.3, TCB: 23.8,
      FPT: 134.5, MBB: 24.1, MWG: 64.2, VNM: 67.8, VIC: 44.6,
      STB: 29.8, VPB: 19.2, BID: 49.5, NVL: 14.2, DIG: 26.5,
      PDR: 22.1, SHB: 11.5, ACB: 24.8, EIB: 18.5, LPB: 31.2,
      VCG: 25.0, GEX: 21.8, POW: 11.8, KBC: 29.5, DGC: 98.5,
    };
    if (defaultPricesK[sym]) return defaultPricesK[sym];
    if (currentTick?.price) return currentTick.price / 1000;
    return 25.0;
  }, [currentTick]);

  // Seeded deterministic candle generator (0% randomness shift on re-render)
  const generateInitialData = useCallback((sym: string, res: ResolutionId) => {
    const candles: CandlestickData<Time>[] = [];
    const volumes: HistogramData<Time>[] = [];
    const ma20Data: LineData<Time>[] = [];
    const ma50Data: LineData<Time>[] = [];

    const baseK = getBasePriceK(sym);
    const targetK = currentTick?.price ? currentTick.price / 1000 : baseK;

    let count = 120;
    let isDaily = false;
    let stepSec = 900;

    switch (res) {
      case '1m': count = 120; stepSec = 60; break;
      case '5m': count = 120; stepSec = 300; break;
      case '15m': count = 120; stepSec = 900; break;
      case '1h': count = 120; stepSec = 3600; break;
      case '1D': count = 120; isDaily = true; break;
      case '1Mo': count = 30; isDaily = true; break;
      case '3Mo': count = 90; isDaily = true; break;
      case '6Mo': count = 150; isDaily = true; break;
      case '1Y': count = 250; isDaily = true; break;
      case 'ALL': count = 400; isDaily = true; break;
    }

    const timeList: Time[] = isDaily
      ? (getTradingDayStrings(count) as Time[])
      : (getIntradayTimestamps(count, stepSec) as unknown as Time[]);

    // Seed PRNG using symbol string code to ensure 100% deterministic consistency
    let seed = 0;
    for (let s = 0; s < sym.length; s++) seed += sym.charCodeAt(s);

    const rawCandles: { time: Time; open: number; high: number; low: number; close: number; volume: number }[] = [];

    let currPrice = targetK * (0.95 + seededRandom(seed++) * 0.05);

    for (let i = 0; i < count; i++) {
      const time = timeList[i];
      const isLast = (i === count - 1);
      const open = Math.round(currPrice * 100) / 100;

      let close: number;
      if (isLast) {
        close = Math.round(targetK * 100) / 100;
      } else {
        const wave = Math.sin(i / 8) * (targetK * 0.008);
        const meanRevert = (targetK - open) * 0.04;
        const noise = (seededRandom(seed++) - 0.495) * (targetK * 0.006);
        close = Math.round((open + wave + meanRevert + noise) * 100) / 100;
      }

      close = Math.max(targetK * 0.88, Math.min(targetK * 1.12, close));

      const wickPadding = Math.max(0.02, Math.abs(close - open) * 0.5 + targetK * 0.002);
      const high = Math.round((Math.max(open, close) + seededRandom(seed++) * wickPadding) * 100) / 100;
      const low = Math.round((Math.min(open, close) - seededRandom(seed++) * wickPadding) * 100) / 100;
      const volume = Math.floor(seededRandom(seed++) * 600000) + 120000;

      rawCandles.push({ time, open, high, low, close, volume });
      currPrice = close;
    }

    for (let i = 0; i < rawCandles.length; i++) {
      const item = rawCandles[i];
      candles.push({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      });

      volumes.push({
        time: item.time,
        value: item.volume,
        color: item.close >= item.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      });

      if (i >= 19) {
        const slice = rawCandles.slice(i - 19, i + 1);
        const sum = slice.reduce((acc, c) => acc + c.close, 0);
        ma20Data.push({ time: item.time, value: Math.round((sum / 20) * 100) / 100 });
      }

      if (i >= 49) {
        const slice = rawCandles.slice(i - 49, i + 1);
        const sum = slice.reduce((acc, c) => acc + c.close, 0);
        ma50Data.push({ time: item.time, value: Math.round((sum / 50) * 100) / 100 });
      }
    }

    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      lastCandleRef.current = {
        time: last.time,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      };
    }

    return { candles, volumes, ma20Data, ma50Data };
  }, [getBasePriceK, currentTick]);

  // Mount Lightweight Chart for Native Mode
  useEffect(() => {
    if (chartMode !== 'native' || !chartContainerRef.current) return;
    const container = chartContainerRef.current;
    const isDaily = resolution === '1D' || resolution.includes('Mo') || resolution.includes('Y') || resolution === 'ALL';

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#71717a',
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
        alignLabels: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: !isDaily,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: 400,
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
    });
    candleSeriesRef.current = candlestickSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const ma20Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'MA20',
    });
    ma20SeriesRef.current = ma20Series;

    const ma50Series = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'MA50',
    });
    ma50SeriesRef.current = ma50Series;

    const { candles, volumes, ma20Data, ma50Data } = generateInitialData(selectedSymbol, resolution);
    candlestickSeries.setData(candles);
    volumeSeries.setData(volumes);
    if (showMA20) ma20Series.setData(ma20Data);
    if (showMA50) ma50Series.setData(ma50Data);

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoveredData(null);
        return;
      }
      const candleData = param.seriesData.get(candlestickSeries) as any;
      const volData = param.seriesData.get(volumeSeries) as any;
      if (candleData) {
        const change = candleData.close - candleData.open;
        const changePct = candleData.open ? (change / candleData.open) * 100 : 0;
        setHoveredData({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value,
          change,
          changePct,
        });
      }
    });

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
  }, [chartMode, selectedSymbol, resolution, generateInitialData, showMA20, showMA50]);

  // Live WebSocket Tick Update for Native Mode
  useEffect(() => {
    if (chartMode !== 'native' || !candleSeriesRef.current || !volumeSeriesRef.current || !currentTick) return;

    const livePriceK = Math.round((currentTick.price / 1000) * 100) / 100;
    const tickVol = currentTick.volume || 1000;

    if (lastCandleRef.current) {
      const updatedOpen = lastCandleRef.current.open;
      const updatedHigh = Math.max(lastCandleRef.current.high, livePriceK);
      const updatedLow = Math.min(lastCandleRef.current.low, livePriceK);

      lastCandleRef.current = {
        ...lastCandleRef.current,
        high: updatedHigh,
        low: updatedLow,
        close: livePriceK,
      };

      candleSeriesRef.current.update({
        time: lastCandleRef.current.time,
        open: updatedOpen,
        high: updatedHigh,
        low: updatedLow,
        close: livePriceK,
      });

      volumeSeriesRef.current.update({
        time: lastCandleRef.current.time,
        value: tickVol,
        color: livePriceK >= updatedOpen ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      });
    }
  }, [chartMode, currentTick]);

  const priceDisplayK = currentTick?.price ? (currentTick.price / 1000).toFixed(2) : '--';
  const changeK = currentTick?.change ? (currentTick.change / 1000).toFixed(2) : '0.00';
  const changePct = currentTick?.changePercent ? currentTick.changePercent.toFixed(2) : '0.00';
  const isPositive = currentTick ? currentTick.change >= 0 : true;

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/60 rounded-2xl p-4 backdrop-blur-xl flex flex-col h-full relative overflow-hidden">
      {/* Background Watermark Ticker Symbol */}
      <div className="absolute right-6 bottom-10 text-8xl font-mono font-black text-white/[0.02] select-none pointer-events-none tracking-tighter">
        {selectedSymbol}
      </div>

      {/* Chart Control Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3 mb-3 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            {isPositive ? <TrendUp size={18} weight="bold" /> : <TrendDown size={18} weight="bold" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono font-bold text-zinc-100 text-sm tracking-tight">{selectedSymbol}</h3>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                HOSE
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
              <span className="text-zinc-100 font-extrabold">{priceDisplayK}k</span>
              <span className={isPositive ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {isPositive ? '+' : ''}{changeK} ({isPositive ? '+' : ''}{changePct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Engine Switcher & Indicator Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Engine Mode Toggle */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setChartMode('tradingview')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg transition-all ${
                chartMode === 'tradingview'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkle size={12} weight="bold" />
              <span>TradingView Pro (100% Real)</span>
            </button>

            <button
              onClick={() => setChartMode('native')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg transition-all ${
                chartMode === 'native'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ChartLine size={12} weight="bold" />
              <span>Native Stream</span>
            </button>
          </div>

          {/* Controls specific to Native mode */}
          {chartMode === 'native' && (
            <>
              <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80">
                <button
                  onClick={() => setShowMA20(!showMA20)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-semibold rounded-lg transition-colors ${
                    showMA20 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {showMA20 ? <Eye size={12} /> : <EyeSlash size={12} />}
                  <span>MA20</span>
                </button>

                <button
                  onClick={() => setShowMA50(!showMA50)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-semibold rounded-lg transition-colors ${
                    showMA50 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {showMA50 ? <Eye size={12} /> : <EyeSlash size={12} />}
                  <span>MA50</span>
                </button>
              </div>

              <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80 overflow-x-auto max-w-full">
                <Clock size={13} className="text-zinc-500 ml-1 mr-0.5 shrink-0" />
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => setResolution(res.id)}
                    className={`px-2 py-1 text-[10px] font-mono font-medium rounded-lg transition-all shrink-0 ${
                      resolution === res.id
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    {res.label}
                  </button>
                ))}
                <button
                  onClick={() => chartRef.current?.timeScale().fitContent()}
                  className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg ml-0.5 shrink-0"
                  title="Căn chỉnh biểu đồ"
                >
                  <ArrowsOutSimple size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Native Mode Crosshair Inspection Bar */}
      {chartMode === 'native' && (
        <div className="flex flex-wrap items-center gap-4 px-3 py-1.5 mb-2 bg-zinc-900/40 border border-zinc-800/40 rounded-xl text-[11px] font-mono z-10 text-zinc-400">
          <div>O: <span className="text-zinc-200 font-bold">{hoveredData?.open ? hoveredData.open.toFixed(2) : priceDisplayK}</span></div>
          <div>H: <span className="text-emerald-400 font-bold">{hoveredData?.high ? hoveredData.high.toFixed(2) : (currentTick?.high ? (currentTick.high/1000).toFixed(2) : priceDisplayK)}</span></div>
          <div>L: <span className="text-rose-400 font-bold">{hoveredData?.low ? hoveredData.low.toFixed(2) : (currentTick?.low ? (currentTick.low/1000).toFixed(2) : priceDisplayK)}</span></div>
          <div>C: <span className="text-zinc-100 font-bold">{hoveredData?.close ? hoveredData.close.toFixed(2) : priceDisplayK}</span></div>
          {hoveredData?.changePct !== undefined && (
            <div className={hoveredData.changePct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {hoveredData.changePct >= 0 ? '+' : ''}{hoveredData.changePct.toFixed(2)}%
            </div>
          )}
          {hoveredData?.volume && (
            <div className="ml-auto text-zinc-500">Vol: <span className="text-zinc-300 font-bold">{hoveredData.volume.toLocaleString()}</span></div>
          )}
        </div>
      )}

      {/* Main Chart Area */}
      <div className="w-full flex-1 min-h-[420px] rounded-xl overflow-hidden z-10">
        {chartMode === 'tradingview' ? (
          <TradingViewProEmbed symbol={selectedSymbol} />
        ) : (
          <div ref={chartContainerRef} className="w-full h-full min-h-[420px]" />
        )}
      </div>
    </div>
  );
}
