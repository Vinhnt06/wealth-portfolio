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
              ceilingCount: idx.ceilingCount ?? 0,
              advances: idx.advances ?? 0,
              noChanges: idx.noChanges ?? 0,
              declines: idx.declines ?? 0,
              floorCount: idx.floorCount ?? 0,
              totalStocks: idx.totalStocks,
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

        // Real Market Breadth counts (Tím / Xanh / Vàng / Đỏ / Sàn)
        // adv includes ceil, dec includes flr (standard Vietnam exchange format)
        const ceil = liveIndex?.ceilingCount ?? 0;
        const adv = liveIndex?.advances ?? 0;
        const ref = liveIndex?.noChanges ?? 0;
        const dec = liveIndex?.declines ?? 0;
        const flr = liveIndex?.floorCount ?? 0;

        const totalTraded = adv + ref + dec;
        const pureUp = Math.max(0, adv - ceil);
        const pureDown = Math.max(0, dec - flr);

        const ceilPct = totalTraded > 0 ? (ceil / totalTraded) * 100 : 0;
        const advPct = totalTraded > 0 ? (pureUp / totalTraded) * 100 : 0;
        const refPct = totalTraded > 0 ? (ref / totalTraded) * 100 : 0;
        const decPct = totalTraded > 0 ? (pureDown / totalTraded) * 100 : 0;
        const flrPct = totalTraded > 0 ? (flr / totalTraded) * 100 : 0;

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
            </div>

            {/* Real Market Breadth (Thống kê mã: Tím / Xanh / Vàng / Đỏ / Sàn) */}
            <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-zinc-400 font-medium">
                  Độ rộng ({totalTraded > 0 ? totalTraded : liveIndex?.totalStocks || '--'} mã):
                </span>
                <span className="text-[9px] text-zinc-500 font-sans">Phiên gần nhất</span>
              </div>

              {/* 5-Color Proportion Bar */}
              {totalTraded > 0 && (
                <div
                  className="h-1.5 w-full rounded-full bg-zinc-800/90 overflow-hidden flex"
                  title={`Trần: ${ceil} | Tăng: ${adv} | TC: ${ref} | Giảm: ${dec} | Sàn: ${flr}`}
                >
                  {ceil > 0 && <div style={{ width: `${ceilPct}%` }} className="h-full bg-fuchsia-500" />}
                  {pureUp > 0 && <div style={{ width: `${advPct}%` }} className="h-full bg-emerald-500" />}
                  {ref > 0 && <div style={{ width: `${refPct}%` }} className="h-full bg-amber-400" />}
                  {pureDown > 0 && <div style={{ width: `${decPct}%` }} className="h-full bg-rose-500" />}
                  {flr > 0 && <div style={{ width: `${flrPct}%` }} className="h-full bg-cyan-400" />}
                </div>
              )}

              {/* 5 Badges for Trần / Tăng / TC / Giảm / Sàn */}
              <div className="grid grid-cols-5 gap-1 text-center font-mono text-[10px]">
                <div className="px-1 py-0.5 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400" title="Mã Trần">
                  <div className="text-[8px] text-fuchsia-400/80 font-sans">Trần</div>
                  <span className="font-bold">{ceil}</span>
                </div>
                <div className="px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" title="Mã Tăng">
                  <div className="text-[8px] text-emerald-400/80 font-sans">Tăng</div>
                  <span className="font-bold">{adv}</span>
                </div>
                <div className="px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400" title="Mã Tham chiếu">
                  <div className="text-[8px] text-amber-400/80 font-sans">TC</div>
                  <span className="font-bold">{ref}</span>
                </div>
                <div className="px-1 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400" title="Mã Giảm">
                  <div className="text-[8px] text-rose-400/80 font-sans">Giảm</div>
                  <span className="font-bold">{dec}</span>
                </div>
                <div className="px-1 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400" title="Mã Sàn">
                  <div className="text-[8px] text-cyan-400/80 font-sans">Sàn</div>
                  <span className="font-bold">{flr}</span>
                </div>
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
