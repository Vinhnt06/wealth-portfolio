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
import { VolumeSurgeLiveTicker } from '../../features/market/components/VolumeSurgeLiveTicker';
import { RealtimeVolumeSurgeRadar } from '../../features/market/components/RealtimeVolumeSurgeRadar';
import { MinerviniExpectancyCalculator } from '../../features/market/components/MinerviniExpectancyCalculator';
import { VolumeSurgeAlertToast } from '../../features/market/components/VolumeSurgeAlertToast';
import { ArrowLeft, Lightning } from '@phosphor-icons/react';
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
    if (tab === 'flow' || tab === 'screener' || tab === 'rrg' || tab === 'overview' || tab === 'radar') {
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
          accentColor: 'bg-cyan-400',
        };
      case 'screener':
        return {
          title: 'Bộ Lọc Minervini SEPA',
          subtitle: 'Mô hình Trend Template & Tiêu chuẩn tăng trưởng đà giá Mark Minervini',
          accentColor: 'bg-amber-400',
        };
      case 'radar':
        return {
          title: 'Radar Bùng Nổ Khối Lượng Realtime',
          subtitle: 'Phát hiện sớm các điểm bùng nổ thanh khoản và bứt phá dòng tiền trên toàn thị trường',
          accentColor: 'bg-amber-400',
        };
      case 'expectancy':
        return {
          title: 'Hàm Kỳ Vọng Toán Học & Điểm Mua / Cắt Lỗ Tối Ưu',
          subtitle: 'Mô hình định lượng Mark Minervini — Quản trị rủi ro, xác định mức cắt lỗ & tỷ lệ R:R để không thua lỗ',
          accentColor: 'bg-emerald-400',
        };
      case 'rrg':
        return {
          title: 'Ma Trận Luân Chuyển Dòng Tiền RRG',
          subtitle: 'Biểu đồ Relative Rotation Graph — 4 góc phần tư Leading, Weakening, Lagging, Improving',
          accentColor: 'bg-emerald-400',
        };
      case 'detail':
        return {
          title: `Biểu Đồ Kỹ Thuật: ${selectedSymbol}`,
          subtitle: 'Sổ lệnh đa mức giá, khớp lệnh trực tiếp & Báo cáo tài chính chuyên sâu',
          accentColor: 'bg-emerald-400',
        };
      default:
        return {
          title: 'Tổng Quan Thị Trường Chứng Khoán',
          subtitle: 'Chỉ số realtime, Bản đồ nhiệt toàn thị trường & Phân tích độ rộng cung cầu',
          accentColor: 'bg-emerald-400',
        };
    }
  };

  const meta = getViewMeta();

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Command Bar (Streamlined, uncluttered, typography-focused) */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-xl">
        {/* Left: Dynamic View Context Title */}
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-8 rounded-full ${meta.accentColor} shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.4)]`} />
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight">
              {meta.title}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Right Tools: Radar Button + Expectancy Button + Back button + Live Market Session Pill */}
        <div className="flex items-center gap-2.5">
          {/* Nút Mở Radar Nổ Vol Realtime */}
          <button
            onClick={() => setViewMode(viewMode === 'radar' ? 'overview' : 'radar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all active:scale-[0.98] ${
              viewMode === 'radar'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700'
            }`}
            title="Mở Radar Bùng Nổ Khối Lượng Realtime Toàn Thị Trường"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Radar Nổ Vol</span>
          </button>

          {/* Nút Mở Hàm Kỳ Vọng & Quản Trị Rủi Ro Minervini */}
          <button
            onClick={() => setViewMode(viewMode === 'expectancy' ? 'overview' : 'expectancy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all active:scale-[0.98] ${
              viewMode === 'expectancy'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700'
            }`}
            title="Hàm Kỳ Vọng Toán Học & Điểm Mua / Cắt Lỗ Tối Ưu (Mark Minervini)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Kỳ Vọng R:R Minervini</span>
          </button>

          {viewMode !== 'overview' && (
            <button
              onClick={() => setViewMode('overview')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-mono font-bold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Tổng Quan</span>
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
                <span className="hidden sm:inline">TRỰC TUYẾN • {sessionInfo.sessionBadge}</span>
              </>
            ) : mounted && sessionInfo?.isLunchBreak ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="hidden sm:inline">NGHỈ TRƯA (11:30 - 13:00)</span>
              </>
            ) : mounted && sessionInfo ? (
              <>
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                <span className="hidden sm:inline">{sessionInfo.sessionBadge}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
                <span className="hidden sm:inline">ĐANG KẾT NỐI...</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Live Streaming Realtime Volume Surge Ticker Bar */}
      <VolumeSurgeLiveTicker onOpenRadar={() => setViewMode('radar')} />

      {/* Dynamic Context View: Macro Overview vs Minervini Screener vs Sector Flow vs RRG vs Radar vs Stock Deep-Dive */}
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
      ) : viewMode === 'radar' ? (
        <RealtimeVolumeSurgeRadar />
      ) : viewMode === 'expectancy' ? (
        <MinerviniExpectancyCalculator />
      ) : (
        <StockDetailSection onBackToOverview={() => setViewMode('overview')} />
      )}

      {/* Floating Volume Surge In-App Alert Reminder (Anti-Spam Filtered) */}
      <VolumeSurgeAlertToast />
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
