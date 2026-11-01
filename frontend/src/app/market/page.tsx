'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useDnseWebSocket } from '../../features/market/hooks/useDnseWebSocket';
import { useMarketStore } from '../../features/market/store/marketStore';
import { MarketOverviewSection } from '../../features/market/components/MarketOverviewSection';
import { StockDetailSection } from '../../features/market/components/StockDetailSection';
import { MarkMinerviniScreener } from '../../features/market/components/MarkMinerviniScreener';
import { RelativeRotationGraphCard } from '../../features/market/components/RelativeRotationGraph';
import { SectorMoneyFlowSection } from '../../features/market/components/SectorMoneyFlowSection';
import {
  ChartPieSlice,
  Buildings,
  WifiHigh,
  TrendUp,
  Funnel,
  Clock,
  Compass,
  ArrowLeft,
} from '@phosphor-icons/react';
import { getMarketSessionInfo } from '../../features/market/utils/marketHours';

function MarketTerminalContent() {
  // Connect to Realtime WebSocket Data Stream
  const { wsStatus } = useDnseWebSocket();
  const searchParams = useSearchParams();

  // Mode and active stock selection from unified store
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
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Sync tab search param with viewMode
  React.useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'flow' || tab === 'screener' || tab === 'rrg' || tab === 'overview') {
      setViewMode(tab);
    }
  }, [searchParams, setViewMode]);

  // View Metadata for Header
  const getViewMeta = () => {
    switch (viewMode) {
      case 'flow':
        return {
          title: 'Giám Sát Dòng Tiền 11 Nhóm Ngành',
          subtitle: 'Xếp hạng thanh khoản, phân bổ dòng tiền thực tế & Ma trận nhiệt toàn ngành',
          icon: TrendUp,
          color: 'text-cyan-400',
          borderColor: 'border-cyan-500/30',
          bgColor: 'bg-cyan-500/10',
        };
      case 'screener':
        return {
          title: 'Bộ Lọc Minervini SEPA',
          subtitle: 'Mô hình Trend Template & Tiêu chuẩn tăng trưởng đà giá Mark Minervini',
          icon: Funnel,
          color: 'text-amber-400',
          borderColor: 'border-amber-500/30',
          bgColor: 'bg-amber-500/10',
        };
      case 'rrg':
        return {
          title: 'Ma Trận Luân Chuyển Dòng Tiền RRG',
          subtitle: 'Biểu đồ Relative Rotation Graph — 4 góc phần tư Leading, Weakening, Lagging, Improving',
          icon: Compass,
          color: 'text-emerald-400',
          borderColor: 'border-emerald-500/30',
          bgColor: 'bg-emerald-500/10',
        };
      case 'detail':
        return {
          title: `Biểu Đồ Kỹ Thuật: ${selectedSymbol}`,
          subtitle: 'Sổ lệnh đa mức giá, khớp lệnh trực tiếp & Báo cáo tài chính chuyên sâu',
          icon: Buildings,
          color: 'text-emerald-400',
          borderColor: 'border-emerald-500/30',
          bgColor: 'bg-emerald-500/10',
        };
      default:
        return {
          title: 'Tổng Quan Thị Trường Chứng Khoán',
          subtitle: 'Chỉ số realtime, Bản đồ nhiệt toàn thị trường & Phân tích độ rộng cung cầu',
          icon: ChartPieSlice,
          color: 'text-emerald-400',
          borderColor: 'border-emerald-500/30',
          bgColor: 'bg-emerald-500/10',
        };
    }
  };

  const meta = getViewMeta();
  const IconComponent = meta.icon;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Command Bar (Streamlined, uncluttered, no stacked navbar clash) */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-xl">
        {/* Left: Dynamic View Context Title */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-zinc-900 border ${meta.borderColor} flex items-center justify-center ${meta.color} shrink-0`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight">
                {meta.title}
              </h1>
              {viewMode !== 'overview' && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border uppercase ${meta.bgColor} ${meta.color} ${meta.borderColor}`}>
                  {viewMode.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Right Tools: Back button (if inside a sub-tool) + Live Market Session Pill */}
        <div className="flex items-center gap-3">
          {viewMode !== 'overview' && (
            <button
              onClick={() => setViewMode('overview')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-mono font-bold text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/60 transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về Tổng Quan</span>
            </button>
          )}

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

      {/* Dynamic Context View: Macro Overview vs Minervini Screener vs Sector Flow vs RRG vs Stock Deep-Dive */}
      {viewMode === 'overview' ? (
        <MarketOverviewSection onSelectSector={() => setViewMode('screener')} />
      ) : viewMode === 'screener' ? (
        <MarkMinerviniScreener />
      ) : viewMode === 'flow' ? (
        <SectorMoneyFlowSection />
      ) : viewMode === 'rrg' ? (
        <div className="space-y-6">
          <RelativeRotationGraphCard defaultHeight={700} />
        </div>
      ) : (
        <StockDetailSection onBackToOverview={() => setViewMode('overview')} />
      )}
    </div>
  );
}

export default function MarketTerminalPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-zinc-500 font-mono text-xs">Đang tải Terminal...</div>}>
        <MarketTerminalContent />
      </Suspense>
    </DashboardLayout>
  );
}
