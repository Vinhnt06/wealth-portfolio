'use client';

import React from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useDnseWebSocket } from '../../features/market/hooks/useDnseWebSocket';
import { MarketSearch } from '../../features/market/components/MarketSearch';
import { IndexBanner } from '../../features/market/components/IndexBanner';
import { ExpandableChart } from '../../features/market/components/ExpandableChart';
import { MarketTabbedSidebar } from '../../features/market/components/MarketTabbedSidebar';
import { WatchlistTable } from '../../features/market/components/WatchlistTable';
import { MarketSummaryBar } from '../../features/market/components/MarketSummaryBar';
import { MacroDataSection } from '../../features/market/components/MacroDataSection';
import { WifiHigh, WifiSlash, Sparkle } from '@phosphor-icons/react';

export default function MarketTerminalPage() {
  // Connect to Realtime WebSocket Data Stream
  const { wsStatus } = useDnseWebSocket();

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Top Header Bar */}
        <div className="relative z-50 flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono font-black text-xl text-zinc-100 tracking-tight">THỊ TRƯỜNG CHỨNG KHOÁN</h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  LIVE TERMINAL
                </span>
              </div>
              <p className="text-xs text-zinc-400">Hệ thống phân tích & theo dõi diễn biến thị trường thời gian thực</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stock Search Command Palette */}
            <MarketSearch />

            {/* Connection Status Pill */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
                wsStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : wsStatus === 'connecting'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {wsStatus === 'connected' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <WifiHigh className="w-4 h-4" />
                  <span>TRỰC TUYẾN (&lt; 12ms)</span>
                </>
              ) : wsStatus === 'connecting' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>ĐANG KẾT NỐI...</span>
                </>
              ) : (
                <>
                  <WifiSlash className="w-4 h-4" />
                  <span>NGOẠI TUYẾN</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Full-Width Market Index Banner (VNINDEX, VN30, HNX) */}
        <IndexBanner />

        {/* Main Terminal Workspace (Balanced 8:4 Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main K-Line TradingView Chart (8 cols) */}
          <div className="lg:col-span-8">
            <ExpandableChart />
          </div>

          {/* Compact Tabbed Sidebar (OrderBook ↔ Info ↔ Foreign Flow) (4 cols) */}
          <div className="lg:col-span-4 min-h-[460px]">
            <MarketTabbedSidebar />
          </div>
        </div>

        {/* Secondary Section: Watchlist & Market Summary (Balanced 8:4 Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* High-density Realtime Watchlist (8 cols) */}
          <div className="lg:col-span-8">
            <WatchlistTable />
          </div>

          {/* Market Overview & Top Gainers/Losers (4 cols) */}
          <div className="lg:col-span-4">
            <MarketSummaryBar />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
