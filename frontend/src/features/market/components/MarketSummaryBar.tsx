'use client';

import React from 'react';
import { TrendUp, TrendDown, Globe, Scales, Lightning } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

export const MarketSummaryBar: React.FC = () => {
  const { setSelectedSymbol } = useMarketStore();

  const TOP_GAINERS = [
    { symbol: 'TCB', changePct: +2.55, price: 24.1 },
    { symbol: 'SSI', changePct: +2.27, price: 36.0 },
    { symbol: 'FPT', changePct: +1.95, price: 130.5 },
  ];

  const TOP_LOSERS = [
    { symbol: 'MWG', changePct: -1.23, price: 64.2 },
    { symbol: 'VHM', changePct: -1.19, price: 41.5 },
    { symbol: 'VIC', changePct: -0.88, price: 44.6 },
  ];

  return (
    <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl backdrop-blur-sm grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
      {/* Top Gainers */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <TrendUp className="w-4 h-4" />
          <span>TOP TĂNG GIÁ TRONG NGÀY</span>
        </div>
        <div className="flex items-center gap-2">
          {TOP_GAINERS.map((item) => (
            <button
              key={item.symbol}
              onClick={() => setSelectedSymbol(item.symbol)}
              className="flex-1 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex justify-between items-center"
            >
              <span className="font-bold text-zinc-100">{item.symbol}</span>
              <span className="text-emerald-400 font-bold">+{item.changePct}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-rose-400 font-bold">
          <TrendDown className="w-4 h-4" />
          <span>TOP GIẢM GIÁ TRONG NGÀY</span>
        </div>
        <div className="flex items-center gap-2">
          {TOP_LOSERS.map((item) => (
            <button
              key={item.symbol}
              onClick={() => setSelectedSymbol(item.symbol)}
              className="flex-1 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex justify-between items-center"
            >
              <span className="font-bold text-zinc-100">{item.symbol}</span>
              <span className="text-rose-400 font-bold">{item.changePct}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* Foreign Capital Overview */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-blue-400 font-bold">
          <Globe className="w-4 h-4" />
          <span>KHỐI NGOẠI MUA/BÁN RÒNG</span>
        </div>
        <div className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
          <div className="text-zinc-400">
            Tổng mua: <span className="text-emerald-400 font-bold">1,240 Tỷ</span>
          </div>
          <div className="text-zinc-400">
            Tổng bán: <span className="text-rose-400 font-bold">980 Tỷ</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
            +260 Tỷ
          </div>
        </div>
      </div>
    </div>
  );
};
