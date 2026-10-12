'use client';

import React from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useDnseWebSocket } from '../../features/market/hooks/useDnseWebSocket';
import { useMarketStore } from '../../features/market/store/marketStore';
import { MarketOverviewSection } from '../../features/market/components/MarketOverviewSection';
import { StockDetailSection } from '../../features/market/components/StockDetailSection';
import { MarkMinerviniScreener } from '../../features/market/components/MarkMinerviniScreener';
import {
  ChartPieSlice,
  Buildings,
  WifiHigh,
  WifiSlash,
  Sparkle,
  TrendUp,
  Funnel,
  Clock,
} from '@phosphor-icons/react';
import { getMarketSessionInfo } from '../../features/market/utils/marketHours';

export default function MarketTerminalPage() {
  // Connect to Realtime WebSocket Data Stream
  const { wsStatus } = useDnseWebSocket();

  // Mode and active stock selection from unified store
  const { viewMode, setViewMode, selectedSymbol } = useMarketStore();

  // Market session state (HOSE/HNX trading schedule)
  const [sessionInfo, setSessionInfo] = React.useState(getMarketSessionInfo());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setSessionInfo(getMarketSessionInfo());
    }, 30000); // Cập nhật mỗi 30s
    return () => clearInterval(timer);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Top Header Command Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-xl shadow-xl">
          {/* Left Title & System Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkle className="w-5 h-5 animate-pulse" weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono font-black text-lg sm:text-xl text-zinc-100 tracking-tight">
                  THỊ TRƯỜNG CHỨNG KHOÁN
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  REALTIME TERMINAL
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 hidden md:inline-block">
                  MINERVINI SYSTEM
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Hệ thống dữ liệu giao dịch trực tiếp Lightspeed & Bộ lọc Mark Minervini SEPA
              </p>
            </div>
          </div>

          {/* Center Mode Switcher Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800/80">
            <button
              onClick={() => setViewMode('overview')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                viewMode === 'overview'
                  ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <ChartPieSlice className="w-4 h-4" />
              <span>Tổng Quan</span>
            </button>

            <button
              onClick={() => setViewMode('screener')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                viewMode === 'screener'
                  ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Funnel className="w-4 h-4" weight="fill" />
              <span>Bộ Lọc Minervini</span>
            </button>

            <button
              onClick={() => setViewMode('detail')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                viewMode === 'detail'
                  ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Buildings className="w-4 h-4" />
              <span>Chart & Chi Tiết: {selectedSymbol}</span>
            </button>
          </div>

          {/* Right Tools: WebSocket Status Pill */}
          <div className="flex items-center gap-3">
            {/* Connection Status & Market Session Pill */}
            <div
              title={`${sessionInfo.sessionName} • ${sessionInfo.nextSessionText}`}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-default ${
                sessionInfo.isOpen
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : sessionInfo.isLunchBreak
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  : 'bg-zinc-900/90 text-zinc-400 border-zinc-800/80'
              }`}
            >
              {sessionInfo.isOpen ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <WifiHigh className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">TRỰC TUYẾN • {sessionInfo.sessionBadge}</span>
                </>
              ) : sessionInfo.isLunchBreak ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">NGHỈ TRƯA (11:30 - 13:00)</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span className="hidden sm:inline">{sessionInfo.sessionBadge}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Context View: Macro Overview vs Minervini Screener vs Stock Deep-Dive */}
        {viewMode === 'overview' ? (
          <MarketOverviewSection onSelectSector={() => setViewMode('screener')} />
        ) : viewMode === 'screener' ? (
          <MarkMinerviniScreener />
        ) : (
          <StockDetailSection onBackToOverview={() => setViewMode('overview')} />
        )}
      </div>
    </DashboardLayout>
  );
}
