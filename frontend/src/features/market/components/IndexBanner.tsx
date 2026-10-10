'use client';

import React, { useEffect, useState } from 'react';
import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import { MarketIndexData } from '../types/dnse.types';

const DEFAULT_INDEX_CONFIG: { symbol: string; name: string; exchange: string }[] = [
  { symbol: 'VNINDEX', name: 'VN-Index', exchange: 'HOSE' },
  { symbol: 'VN30', name: 'VN30-Index', exchange: 'HOSE' },
  { symbol: 'HNX', name: 'HNX-Index', exchange: 'HNX' },
  { symbol: 'UPCOM', name: 'UPCOM-Index', exchange: 'UPCOM' },
];

export const IndexBanner: React.FC = () => {
  const { indexes, selectedIndexSymbol, setSelectedIndexSymbol, updateIndex } = useMarketStore();
  const [isLoading, setIsLoading] = useState(true);

  // Periodic fetch of latest live index data from DNSE Lightspeed REST API
  useEffect(() => {
    let isMounted = true;
    const fetchIndexes = async () => {
      try {
        const res = await fetch('/api/market/quotes');
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.indexes)) {
          json.indexes.forEach((idx: MarketIndexData) => {
            updateIndex({
              symbol: idx.symbol,
              name: idx.name,
              exchange: idx.exchange,
              value: idx.value,
              change: idx.change,
              changePercent: (idx as any).percentChange ?? idx.changePercent ?? 0,
              open: idx.open,
              high: idx.high,
              low: idx.low,
              totalVolume: (idx as any).volume ?? idx.totalVolume ?? 0,
              totalValue: idx.totalValue || 0,
              advances: 0,
              declines: 0,
              noChanges: 0,
              timestamp: Date.now(),
              sparkline: idx.sparkline || [],
            });
          });
          setIsLoading(false);
        }
      } catch {
        // network issue - state preserved
      }
    };

    fetchIndexes();
    const interval = setInterval(fetchIndexes, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [updateIndex]);

  // Generate SVG path from real price points
  const getRealSparklinePath = (points?: number[]) => {
    if (!points || points.length < 2) {
      return { pathD: 'M 0 18 L 120 18', areaD: 'M 0 18 L 120 18 L 120 36 L 0 36 Z' };
    }
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const pts = points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * 120;
      // map to height 34px, with 4px padding
      const y = 30 - ((val - min) / range) * 24;
      return { x, y };
    });

    const pathD = pts.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
    const areaD = `${pathD} L 120 36 L 0 36 Z`;
    return { pathD, areaD };
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {DEFAULT_INDEX_CONFIG.map((cfg) => {
        const liveIndex = indexes[cfg.symbol];
        const val = liveIndex?.value;
        const chg = liveIndex?.change ?? 0;
        const pct = liveIndex?.changePercent ?? 0;
        const open = liveIndex?.open;
        const high = liveIndex?.high;
        const low = liveIndex?.low;
        const volume = liveIndex?.totalVolume ?? 0;
        const sparkline = liveIndex?.sparkline;

        const isPositive = chg >= 0;
        const isSelected = selectedIndexSymbol === cfg.symbol;
        const { pathD, areaD } = getRealSparklinePath(sparkline);
        const strokeColor = isPositive ? '#10b981' : '#f43f5e';

        // Calculate progress percentage of current value in day's High-Low range
        let rangePct = 50;
        if (high && low && high > low && val) {
          rangePct = Math.min(100, Math.max(0, ((val - low) / (high - low)) * 100));
        }

        return (
          <div
            key={cfg.symbol}
            onClick={() => setSelectedIndexSymbol(cfg.symbol)}
            className={`p-4 rounded-2xl transition-all duration-200 cursor-pointer group relative overflow-hidden backdrop-blur-md ${
              isSelected
                ? 'bg-zinc-900/95 border-2 border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/30'
                : 'bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/90 hover:bg-zinc-900/80'
            }`}
          >
            {/* Background Glow */}
            <div
              className={`absolute -right-8 -top-8 w-24 h-24 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors ${
                isPositive ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />

            {/* Header: Title + Change pill */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-zinc-100 tracking-wide group-hover:text-emerald-400 transition-colors">
                  {cfg.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  {cfg.exchange}
                </span>
              </div>
              <div
                className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  isPositive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {isPositive ? <TrendUp className="w-3 h-3" /> : <TrendDown className="w-3 h-3" />}
                <span>
                  {isPositive ? '+' : ''}
                  {chg.toFixed(2)} ({isPositive ? '+' : ''}
                  {pct.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Main Value + Real Sparkline Chart */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono font-black text-2xl tracking-tight text-zinc-100">
                    {val ? val.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                  KL: <span className="text-cyan-400 font-semibold">{volume > 0 ? `${(volume / 1_000_000).toFixed(2)}M cp` : '--'}</span>
                </div>
              </div>

              {/* Sparkline Canvas from Real Historical DNSE Candles */}
              <div className="w-[110px] h-[34px] shrink-0" title="Đường giá 15 phiên gần nhất (Real DNSE Data)">
                <svg viewBox="0 0 120 36" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id={`grad-${cfg.symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
                      <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={areaD} fill={`url(#grad-${cfg.symbol})`} />
                  <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Real Intraday Range Corridor (Low - High) */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800/60">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-zinc-500">
                  Đáy: <strong className="text-rose-400 font-bold">{low ? low.toFixed(2) : '--'}</strong>
                </span>
                <span className="text-zinc-500">
                  Mở: <strong className="text-zinc-300 font-semibold">{open ? open.toFixed(2) : '--'}</strong>
                </span>
                <span className="text-zinc-500">
                  Đỉnh: <strong className="text-emerald-400 font-bold">{high ? high.toFixed(2) : '--'}</strong>
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-zinc-800/90 overflow-hidden relative" title={`Biên độ phiên: ${low || '--'} - ${high || '--'}`}>
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${rangePct}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 pt-0.5">
                <span className="text-emerald-400/90 font-medium">DNSE Lightspeed Live</span>
                <span className="font-sans text-zinc-400">{isSelected ? 'Đang chọn' : 'Bấm để xem'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
