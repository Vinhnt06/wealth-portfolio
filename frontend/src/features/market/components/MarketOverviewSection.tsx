'use client';

import React, { useState } from 'react';
import { IndexBanner } from './IndexBanner';
import { MarketIndexChart } from './MarketIndexChart';
import { WatchlistTable } from './WatchlistTable';
import { MarketSummaryBar } from './MarketSummaryBar';
import { MarketHeatmap } from './MarketHeatmap';
import {
  CurrencyCircleDollar,
  Lightning,
  ArrowsLeftRight,
  ChartPieSlice,
  ShieldCheck,
  TrendUp,
  TrendDown,
  Flame,
  ChartLineUp
} from '@phosphor-icons/react';

export const MarketOverviewSection: React.FC = () => {
  const [overviewTab, setOverviewTab] = useState<'heatmap' | 'chart'>('heatmap');

  return (
    <div className="space-y-6">
      {/* 1. Full-Width Market Index Banner (VN-INDEX 1735.09, VN30, HNX, UPCOM) */}
      <IndexBanner />

      {/* Overview View Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center p-1 rounded-xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-xl">
          <button
            onClick={() => setOverviewTab('heatmap')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              overviewTab === 'heatmap'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Flame className="w-4 h-4" weight="fill" />
            <span>Bản Đồ Nhiệt (Heatmap)</span>
          </button>

          <button
            onClick={() => setOverviewTab('chart')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              overviewTab === 'chart'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <ChartLineUp className="w-4 h-4" />
            <span>Biểu Đồ Chỉ Số & Độ Rộng</span>
          </button>
        </div>
      </div>

      {/* 2. Main Terminal Hub: Heatmap or Index Chart */}
      {overviewTab === 'heatmap' ? (
        <MarketHeatmap />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Market Overview Chart - Fixed Full-Height, Never Collapsed */}
          <div className="lg:col-span-8 min-h-[460px]">
            <MarketIndexChart />
          </div>

        {/* Market Breadth & Macro Flow Statistics (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Card: Market Breadth (Độ rộng thị trường) */}
          <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
              <div className="flex items-center gap-2">
                <ChartPieSlice className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-mono font-bold text-zinc-200">ĐỘ RỘNG THỊ TRƯỜNG (HOSE)</h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                469 Mã
              </span>
            </div>

            {/* Distribution metrics */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] text-emerald-400 block font-semibold">TĂNG GIÁ</span>
                <span className="text-base font-bold text-emerald-400 mt-0.5 block">248 (53%)</span>
                <span className="text-[9px] text-fuchsia-400/90 block mt-0.5 font-medium">14 mã Trần (CE)</span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] text-amber-400 block font-semibold">KHÔNG ĐỔI</span>
                <span className="text-base font-bold text-amber-400 mt-0.5 block">62 (13%)</span>
                <span className="text-[9px] text-amber-500/80 block mt-0.5">Tham chiếu</span>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] text-rose-400 block font-semibold">GIẢM GIÁ</span>
                <span className="text-base font-bold text-rose-400 mt-0.5 block">159 (34%)</span>
                <span className="text-[9px] text-cyan-400/90 block mt-0.5 font-medium">3 mã Sàn (FL)</span>
              </div>
            </div>

            {/* Visual ratio bar */}
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-zinc-800">
              <div className="h-full bg-emerald-500" style={{ width: '53%' }} />
              <div className="h-full bg-amber-400" style={{ width: '13%' }} />
              <div className="h-full bg-rose-500" style={{ width: '34%' }} />
            </div>
          </div>

          {/* Card: Total Liquidity & Transaction Value */}
          <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
              <div className="flex items-center gap-2">
                <Lightning className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-mono font-bold text-zinc-200">THANH KHOẢN TOÀN THỊ TRƯỜNG</h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">+18.5% so với TB</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Tổng Giá Trị Giao Dịch:</span>
                <span className="text-sm font-bold text-zinc-100">24,850.4 tỷ VNĐ</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Tổng Khối Lượng CP:</span>
                <span className="text-sm font-bold text-zinc-200">985.2 triệu CP</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Giao dịch Khối Ngoại:</span>
                <span className="text-sm font-bold text-emerald-400">+428.5 tỷ VNĐ (Mua Ròng)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* 3. High-Density Realtime Watchlist (8 cols) & Top Movers Terminal (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Live Watchlist (Clicking any stock opens deep detail) */}
        <div className="lg:col-span-7 xl:col-span-8">
          <WatchlistTable />
        </div>

        {/* Top Market Gainers / Losers / Volume Movers */}
        <div className="lg:col-span-5 xl:col-span-4">
          <MarketSummaryBar />
        </div>
      </div>
    </div>
  );
};
