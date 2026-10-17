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

  // Mode and active stock selection from unified store with fine-grained selectors
  const viewMode = useMarketStore((s) => s.viewMode);
  const setViewMode = useMarketStore((s) => s.setViewMode);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  // Mount state & market session state (HOSE/HNX trading schedule)
  const [mounted, setMounted] = React.useState(false);
  const [sessionInfo, setSessionInfo] = React.useState<ReturnType<typeof getMarketSessionInfo> | null>(null);

  React.useEffect(() => {
    setMounted(true);
    setSessionInfo(getMarketSessionInfo());
    const timer = setInterval(() => {
      setSessionInfo(getMarketSessionInfo());
    }, 30000); // Cập nhật mỗi 30s
    return () => clearInterval(timer);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Top Header Command Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-xl">
          {/* Left Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
              <ChartPieSlice className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight">
                Thị Trường Chứng Khoán
              </h1>
              <p className="text-xs text-zinc-400">
                Dữ liệu giao dịch trực tiếp & Bộ lọc Mark Minervini SEPA
              </p>
            </div>
          </div>

          {/* Center Mode Switcher Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900/90 border border-zinc-800">
            <button
              onClick={() => setViewMode('overview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'overview'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ChartPieSlice className="w-3.5 h-3.5" />
              <span>Tổng quan</span>
            </button>

            <button
              onClick={() => setViewMode('screener')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'screener'
                  ? 'bg-zinc-800 text-amber-300 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Funnel className="w-3.5 h-3.5" />
              <span>Bộ lọc Minervini</span>
            </button>

            <button
              onClick={() => setViewMode('detail')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'detail'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Buildings className="w-3.5 h-3.5" />
              <span>Biểu đồ & Chi tiết: {selectedSymbol}</span>
            </button>
          </div>

          {/* Right Tools: Connection Status */}
          <div className="flex items-center gap-3">
            {/* Connection Status & Market Session Pill */}
            <div
              suppressHydrationWarning
              title={
                mounted && sessionInfo
                  ? `${sessionInfo.sessionName} • ${sessionInfo.nextSessionText}`
                  : 'Đang kết nối phiên thị trường...'
              }
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-default ${
                mounted && sessionInfo?.isOpen
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : mounted && sessionInfo?.isLunchBreak
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  : 'bg-zinc-900/90 text-zinc-400 border-zinc-800/80'
              }`}
            >
              {mounted && sessionInfo?.isOpen ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <WifiHigh className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">TRỰC TUYẾN • {sessionInfo.sessionBadge}</span>
                </>
              ) : mounted && sessionInfo?.isLunchBreak ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">NGHỈ TRƯA (11:30 - 13:00)</span>
                </>
              ) : mounted && sessionInfo ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span className="hidden sm:inline">{sessionInfo.sessionBadge}</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span className="hidden sm:inline">ĐANG KẾT NỐI...</span>
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
