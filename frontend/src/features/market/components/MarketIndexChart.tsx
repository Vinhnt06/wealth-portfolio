'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  Time
} from 'lightweight-charts';
import { TrendUp, ChartLine, Eye, EyeSlash, ArrowsOutSimple, SquaresFour } from '@phosphor-icons/react';
import vnindexHistory from '../data/vnindexHistory.json';
import realIndexesData from '../data/realIndexes.json';
import { useMarketStore } from '../store/marketStore';

const INDEX_CONFIG: Record<string, { name: string; exchange: string; scale: number; baseVal: number }> = {
  VNINDEX: { name: 'VN-INDEX', exchange: 'HOSE', scale: 1.0, baseVal: 1735.09 },
  VN30: { name: 'VN30-INDEX', exchange: 'HOSE', scale: 1.07973, baseVal: 1873.43 },
  HNX: { name: 'HNX-INDEX', exchange: 'HNX', scale: 0.15077, baseVal: 261.60 },
  UPCOM: { name: 'UPCOM-INDEX', exchange: 'UPCOM', scale: 0.05672, baseVal: 98.42 },
};

export const MarketIndexChart: React.FC = () => {
  const { selectedIndexSymbol, setSelectedIndexSymbol, indexes } = useMarketStore();
  const [viewGridMode, setViewGridMode] = useState(false);

  const activeIndexKey = INDEX_CONFIG[selectedIndexSymbol] ? selectedIndexSymbol : 'VNINDEX';
  const activeCfg = INDEX_CONFIG[activeIndexKey];
  const liveIndex = indexes[activeIndexKey];
  const currentVal = liveIndex?.value ?? activeCfg.baseVal;
  const currentChg = liveIndex?.change ?? (activeIndexKey === 'VNINDEX' ? -3.88 : activeIndexKey === 'VN30' ? -3.57 : 1.15);
  const currentPct = liveIndex?.changePercent ?? (activeIndexKey === 'VNINDEX' ? -0.22 : activeIndexKey === 'VN30' ? -0.19 : 0.44);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [timeframe, setTimeframe] = useState<'3M' | '6M' | '1Y' | 'ALL'>('1Y');
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(true);
  const [hoveredData, setHoveredData] = useState<{
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    changePct?: number;
  } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;

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
        timeVisible: true,
      },
      width: container.clientWidth,
      height: 420,
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const ma20Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      title: 'MA20',
    });
    ma20SeriesRef.current = ma20Series;

    const ma50Series = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      title: 'MA50',
    });
    ma50SeriesRef.current = ma50Series;

    // Filter historical candles according to timeframe
    const historyData = vnindexHistory as any[];
    let sliceCount = historyData.length;
    if (timeframe === '3M') sliceCount = 65;
    else if (timeframe === '6M') sliceCount = 130;
    else if (timeframe === '1Y') sliceCount = 250;

    const activeHistory = historyData.slice(-sliceCount);

    const candles = activeHistory.map((item) => ({
      time: item.time as Time,
      open: Math.round(item.open * activeCfg.scale * 100) / 100,
      high: Math.round(item.high * activeCfg.scale * 100) / 100,
      low: Math.round(item.low * activeCfg.scale * 100) / 100,
      close: Math.round(item.close * activeCfg.scale * 100) / 100,
    }));

    const volumes = activeHistory.map((item) => {
      let pseudoVol = Math.floor((650000000 + Math.sin(item.close) * 150000000) * activeCfg.scale);
      return {
        time: item.time as Time,
        value: Math.abs(pseudoVol),
        color: item.close >= item.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)',
      };
    });

    const ma20: { time: Time; value: number }[] = [];
    const ma50: { time: Time; value: number }[] = [];

    for (let i = 0; i < candles.length; i++) {
      if (i >= 19) {
        const sum20 = candles.slice(i - 19, i + 1).reduce((acc, c) => acc + c.close, 0);
        ma20.push({ time: candles[i].time, value: Math.round((sum20 / 20) * 100) / 100 });
      }
      if (i >= 49) {
        const sum50 = candles.slice(i - 49, i + 1).reduce((acc, c) => acc + c.close, 0);
        ma50.push({ time: candles[i].time, value: Math.round((sum50 / 50) * 100) / 100 });
      }
    }

    candleSeries.setData(candles);
    volumeSeries.setData(volumes);
    if (showMA20) ma20Series.setData(ma20);
    if (showMA50) ma50Series.setData(ma50);

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoveredData(null);
        return;
      }
      const c = param.seriesData.get(candleSeries) as any;
      if (c) {
        const change = c.close - c.open;
        const changePct = c.open ? (change / c.open) * 100 : 0;
        setHoveredData({
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          changePct,
        });
      }
    });

    const handleResize = () => {
      if (container && chart) {
        chart.applyOptions({ width: container.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [timeframe, showMA20, showMA50, activeIndexKey]);

  const isPositive = currentChg >= 0;

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Chart Control Ribbon Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3 mb-3">
        {/* Index Selector Tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            {Object.entries(INDEX_CONFIG).map(([key, cfg]) => {
              const isSelected = activeIndexKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedIndexSymbol(key)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-zinc-950 shadow-md font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  }`}
                >
                  {cfg.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-lg text-zinc-100">
              {currentVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {isPositive ? '+' : ''}{currentChg.toFixed(2)} ({isPositive ? '+' : ''}{currentPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Indicator toggles & Timeframe selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
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

          <div className="flex items-center bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
            {(['3M', '6M', '1Y', 'ALL'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg transition-all ${
                  timeframe === tf
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl border border-zinc-800"
            title="Căn chỉnh toàn màn hình"
          >
            <ArrowsOutSimple size={14} />
          </button>
        </div>
      </div>

      {/* Crosshair Inspection Bar */}
      {hoveredData && (
        <div className="flex flex-wrap items-center gap-4 px-3 py-1.5 mb-2 bg-zinc-900/50 border border-zinc-800/60 rounded-xl text-[11px] font-mono text-zinc-400">
          <div>O: <span className="text-zinc-200 font-bold">{hoveredData.open?.toFixed(2)}</span></div>
          <div>H: <span className="text-emerald-400 font-bold">{hoveredData.high?.toFixed(2)}</span></div>
          <div>L: <span className="text-rose-400 font-bold">{hoveredData.low?.toFixed(2)}</span></div>
          <div>C: <span className="text-zinc-100 font-bold">{hoveredData.close?.toFixed(2)}</span></div>
          {hoveredData.changePct !== undefined && (
            <div className={hoveredData.changePct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {hoveredData.changePct >= 0 ? '+' : ''}{hoveredData.changePct.toFixed(2)}%
            </div>
          )}
        </div>
      )}

      {/* Main Chart Canvas (Fixed Full-Height, Never Collapsed) */}
      <div className="w-full h-[420px] min-h-[420px] rounded-xl overflow-hidden">
        <div ref={chartContainerRef} className="w-full h-full min-h-[420px]" />
      </div>
    </div>
  );
};
