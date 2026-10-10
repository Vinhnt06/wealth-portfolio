'use client';

import React, { useEffect } from 'react';
import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import realIndexesData from '../data/realIndexes.json';

interface IndexInfo {
  symbol: string;
  name: string;
  exchange: string;
  value: number;
  change: number;
  percentChange: number;
  advances: number;
  declines: number;
  noChanges: number;
  totalVolume: string;
  totalValue: string;
}

const REAL_INDEX_DATA: IndexInfo[] = realIndexesData as IndexInfo[];

export const IndexBanner: React.FC = () => {
  const { indexes, selectedIndexSymbol, setSelectedIndexSymbol, updateIndex } = useMarketStore();

  // Initial and periodic fetch of latest live index data from DNSE via API route
  useEffect(() => {
    let isMounted = true;
    const fetchIndexes = async () => {
      const symbols = ['VNINDEX', 'VN30', 'HNX', 'UPCOM'];
      await Promise.allSettled(
        symbols.map(async (sym) => {
          try {
            const res = await fetch(`/api/market/quote?symbol=${sym}`);
            const json = await res.json();
            if (isMounted && json.success && json.data) {
              const d = json.data;
              updateIndex({
                symbol: sym,
                name: sym === 'VNINDEX' ? 'VN-Index' : sym === 'VN30' ? 'VN30-Index' : sym === 'HNX' ? 'HNX-Index' : 'UPCOM-Index',
                value: d.price,
                change: d.change,
                changePercent: d.changePercent,
                totalVolume: d.volume,
                totalValue: d.totalValue || 0,
                advances: 0,
                declines: 0,
                noChanges: 0,
                timestamp: d.timestamp,
              });
            }
          } catch {
            // fallback gracefully to realIndexes.json
          }
        })
      );
    };

    fetchIndexes();
    const interval = setInterval(fetchIndexes, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [updateIndex]);

  // Deterministic sparkline points for realistic intraday trajectory
  const getSparklinePath = (item: IndexInfo, isPositive: boolean) => {
    // Generate 12 sample intraday points
    const factors = isPositive
      ? [-0.3, -0.1, -0.4, 0.1, 0.2, -0.05, 0.4, 0.35, 0.6, 0.5, 0.8, 1.0]
      : [0.2, 0.3, 0.1, -0.2, -0.1, -0.4, -0.3, -0.6, -0.5, -0.8, -0.7, -1.0];
    
    const pts = factors.map((f, i) => {
      const x = (i / (factors.length - 1)) * 120;
      // map to height 36px, middle is 18px
      const y = Math.max(2, Math.min(34, 18 - (f * 12)));
      return { x, y };
    });

    const pathD = pts.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
    const areaD = `${pathD} L 120 36 L 0 36 Z`;
    return { pathD, areaD };
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {REAL_INDEX_DATA.map((item) => {
        const liveIndex = indexes[item.symbol];
        const val = liveIndex?.value ?? item.value;
        const chg = liveIndex?.change ?? item.change;
        const pct = liveIndex?.changePercent ?? item.percentChange;

        const isPositive = chg >= 0;
        const isSelected = selectedIndexSymbol === item.symbol;
        const advances = (liveIndex && liveIndex.advances > 0) ? liveIndex.advances : item.advances;
        const declines = (liveIndex && liveIndex.declines > 0) ? liveIndex.declines : item.declines;
        const noChanges = (liveIndex && liveIndex.noChanges > 0) ? liveIndex.noChanges : item.noChanges;
        const totalCount = advances + declines + noChanges;
        const advPct = (advances / totalCount) * 100;
        const decPct = (declines / totalCount) * 100;
        const ncPct = (noChanges / totalCount) * 100;

        let displayTotalVal = item.totalValue;
        if (liveIndex?.totalValue && liveIndex.totalValue > 0) {
          displayTotalVal = `${(liveIndex.totalValue / 1e9).toLocaleString('en-US', { maximumFractionDigits: 0 })} Tỷ`;
        }

        const { pathD, areaD } = getSparklinePath(item, isPositive);
        const strokeColor = isPositive ? '#10b981' : '#f43f5e';

        return (
          <div
            key={item.symbol}
            onClick={() => setSelectedIndexSymbol(item.symbol)}
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
                  {item.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  {item.exchange}
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

            {/* Main Value + Sparkline Mini Chart */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono font-black text-2xl tracking-tight text-zinc-100">
                    {val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  GTGD: <span className="text-zinc-300 font-semibold">{displayTotalVal}</span>
                </span>
              </div>

              {/* Sparkline Canvas */}
              <div className="w-[110px] h-[34px] shrink-0">
                <svg viewBox="0 0 120 36" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id={`grad-${item.symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={areaD} fill={`url(#grad-${item.symbol})`} />
                  <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Advance / Decline Progress Bar */}
            <div className="space-y-1">
              <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-zinc-800">
                <div style={{ width: `${advPct}%` }} className="bg-emerald-500 transition-all duration-300" title={`Tăng: ${advances}`} />
                <div style={{ width: `${ncPct}%` }} className="bg-amber-400 transition-all duration-300" title={`TC: ${noChanges}`} />
                <div style={{ width: `${decPct}%` }} className="bg-rose-500 transition-all duration-300" title={`Giảm: ${declines}`} />
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-semibold">{advances}↑</span>
                  <span className="text-amber-400 font-semibold">{noChanges}—</span>
                  <span className="text-rose-400 font-semibold">{declines}↓</span>
                </div>
                <span className="text-[9px] text-zinc-500 font-sans">
                  {isSelected ? 'Đang chọn' : 'Bấm để xem'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
