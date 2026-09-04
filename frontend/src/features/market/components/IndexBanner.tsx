'use client';

import React from 'react';
import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

const MOCK_INDEX_DATA = [
  {
    symbol: 'VNINDEX',
    name: 'VN-Index',
    value: 1284.52,
    change: +12.34,
    percentChange: +0.97,
    advances: 245,
    declines: 112,
    noChanges: 68,
    totalVolume: '685.4M',
    totalValue: '18,420B',
  },
  {
    symbol: 'VN30',
    name: 'VN30-Index',
    value: 1312.80,
    change: +15.60,
    percentChange: +1.20,
    advances: 22,
    declines: 5,
    noChanges: 3,
    totalVolume: '290.1M',
    totalValue: '9,850B',
  },
  {
    symbol: 'HNX',
    name: 'HNX-Index',
    value: 242.15,
    change: -0.85,
    percentChange: -0.35,
    advances: 85,
    declines: 104,
    noChanges: 55,
    totalVolume: '78.2M',
    totalValue: '1,320B',
  },
];

export const IndexBanner: React.FC = () => {
  const { indexes } = useMarketStore();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {MOCK_INDEX_DATA.map((item) => {
        const liveIndex = indexes[item.symbol];
        const val = liveIndex?.value ?? item.value;
        const chg = liveIndex?.change ?? item.change;
        const pct = liveIndex?.changePercent ?? item.percentChange;

        const isPositive = chg >= 0;
        const totalCount = item.advances + item.declines + item.noChanges;
        const advPct = (item.advances / totalCount) * 100;
        const decPct = (item.declines / totalCount) * 100;
        const ncPct = (item.noChanges / totalCount) * 100;

        return (
          <div
            key={item.symbol}
            className="p-4 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl transition-all duration-200 group relative overflow-hidden backdrop-blur-sm"
          >
            {/* Background Glow Pill */}
            <div
              className={`absolute -right-8 -top-8 w-24 h-24 rounded-full blur-3xl opacity-15 pointer-events-none transition-colors ${
                isPositive ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-zinc-100 tracking-wide">{item.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  HOSE
                </span>
              </div>
              <div
                className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                  isPositive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {isPositive ? <TrendUp className="w-3.5 h-3.5" /> : <TrendDown className="w-3.5 h-3.5" />}
                <span>
                  {isPositive ? '+' : ''}
                  {chg.toFixed(2)} ({isPositive ? '+' : ''}
                  {pct.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Big Value Number */}
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-mono font-extrabold text-2xl tracking-tight text-zinc-100">
                {val.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-mono text-zinc-500">điểm</span>
            </div>

            {/* Advance / Decline Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-zinc-800">
                <div style={{ width: `${advPct}%` }} className="bg-emerald-500 transition-all duration-300" title={`Tăng: ${item.advances}`} />
                <div style={{ width: `${ncPct}%` }} className="bg-amber-400 transition-all duration-300" title={`TC: ${item.noChanges}`} />
                <div style={{ width: `${decPct}%` }} className="bg-rose-500 transition-all duration-300" title={`Giảm: ${item.declines}`} />
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold">{item.advances} Tăng</span>
                  <span className="text-amber-400 font-semibold">{item.noChanges} TC</span>
                  <span className="text-rose-400 font-semibold">{item.declines} Giảm</span>
                </div>
                <div className="text-zinc-500">GT: {item.totalValue} đ</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
