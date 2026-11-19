'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { IndexBanner } from './IndexBanner';
import { MarketIndexChart } from './MarketIndexChart';
import { WatchlistTable } from './WatchlistTable';
import { MarketSummaryBar } from './MarketSummaryBar';
import { MarketHeatmap } from './MarketHeatmap';
import { EconomicCycleWheel } from './EconomicCycleWheel';
import { USGlobalMacroSection } from './USGlobalMacroSection';

interface MarketOverviewSectionProps {
  onSelectSector?: (sectorName: string) => void;
  defaultTab?: 'heatmap' | 'chart';
}

interface BoardRow {
  exchange: string;
  price: number;
  refPrice: number;
  ceiling: number;
  floor: number;
  volume: number;
  totalValue: number;
  foreignBuyValue?: number;
  foreignSellValue?: number;
}

/** Độ rộng & thanh khoản sàn HOSE, tính từ bảng giá sống (/api/market/heatmap). Không có số ghi sẵn. */
const MarketBreadthCards: React.FC = () => {
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/market/heatmap');
        const json = await res.json();
        if (alive && json.success && Array.isArray(json.data)) {
          setRows(json.data);
          setStale(Boolean(json.stale));
        }
      } catch {
        // giữ số đang có
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const stats = useMemo(() => {
    const hose = rows.filter((r) => r.exchange === 'HOSE' && r.refPrice > 0 && r.price > 0);
    const up = hose.filter((r) => r.price > r.refPrice);
    const down = hose.filter((r) => r.price < r.refPrice);
    const flat = hose.length - up.length - down.length;
    const ceil = hose.filter((r) => r.ceiling > 0 && r.price >= r.ceiling).length;
    const floor = hose.filter((r) => r.floor > 0 && r.price <= r.floor).length;
    const value = hose.reduce((a, r) => a + (r.totalValue || 0), 0);
    const volume = hose.reduce((a, r) => a + (r.volume || 0), 0);
    const withForeign = hose.filter((r) => typeof r.foreignBuyValue === 'number' && typeof r.foreignSellValue === 'number');
    const foreignNet = withForeign.reduce((a, r) => a + (r.foreignBuyValue as number) - (r.foreignSellValue as number), 0);
    const pct = (n: number) => (hose.length ? Math.round((n / hose.length) * 100) : 0);
    return { total: hose.length, up: up.length, down: down.length, flat, ceil, floor, value, volume, foreignNet, hasForeign: withForeign.length > 0, pct };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 text-xs font-mono text-zinc-500">
        Đang tải độ rộng & thanh khoản thị trường…
      </div>
    );
  }

  return (
    <>
      <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <h4 className="text-xs font-mono font-bold text-zinc-200">ĐỘ RỘNG THỊ TRƯỜNG (HOSE)</h4>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">{stats.total} Mã</span>
        </div>
        {stale && <p className="text-[10px] font-mono text-amber-300/90 mb-2">⚠ Nguồn giá đang lỗi — số chốt gần nhất</p>}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mb-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] text-emerald-400 block font-semibold">TĂNG GIÁ</span>
            <span className="text-base font-bold text-emerald-400 mt-0.5 block">{stats.up} ({stats.pct(stats.up)}%)</span>
            <span className="text-[9px] text-fuchsia-400/90 block mt-0.5 font-medium">{stats.ceil} mã Trần (CE)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] text-amber-400 block font-semibold">KHÔNG ĐỔI</span>
            <span className="text-base font-bold text-amber-400 mt-0.5 block">{stats.flat} ({stats.pct(stats.flat)}%)</span>
            <span className="text-[9px] text-amber-500/80 block mt-0.5">Tham chiếu</span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] text-rose-400 block font-semibold">GIẢM GIÁ</span>
            <span className="text-base font-bold text-rose-400 mt-0.5 block">{stats.down} ({stats.pct(stats.down)}%)</span>
            <span className="text-[9px] text-cyan-400/90 block mt-0.5 font-medium">{stats.floor} mã Sàn (FL)</span>
          </div>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden flex bg-zinc-800">
          <div className="h-full bg-emerald-500" style={{ width: `${stats.pct(stats.up)}%` }} />
          <div className="h-full bg-amber-400" style={{ width: `${stats.pct(stats.flat)}%` }} />
          <div className="h-full bg-rose-500" style={{ width: `${stats.pct(stats.down)}%` }} />
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <h4 className="text-xs font-mono font-bold text-zinc-200">THANH KHOẢN HOSE (KHỚP LỆNH)</h4>
          </div>
        </div>
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Tổng Giá Trị Giao Dịch:</span>
            <span className="text-sm font-bold text-zinc-100">{(stats.value / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ VNĐ</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Tổng Khối Lượng CP:</span>
            <span className="text-sm font-bold text-zinc-200">{(stats.volume / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu CP</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Giao dịch Khối Ngoại:</span>
            <span className={`text-sm font-bold ${stats.foreignNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.hasForeign
                ? `${stats.foreignNet >= 0 ? '+' : ''}${(stats.foreignNet / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ VNĐ (${stats.foreignNet >= 0 ? 'Mua ròng' : 'Bán ròng'})`
                : '—'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export const MarketOverviewSection: React.FC<MarketOverviewSectionProps> = React.memo(({
  onSelectSector,
  defaultTab = 'heatmap'
}) => {
  const [overviewTab, setOverviewTab] = useState<'heatmap' | 'chart'>(defaultTab);

  return (
    <div className="space-y-6">
      {/* 1. Full-Width Market Index Banner (VN-INDEX 1735.09, VN30, HNX, UPCOM) */}
      <IndexBanner />

      {/* Overview Section Header & View Toggle (Seamless inline segment, no navbar clash) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-zinc-300 tracking-wider uppercase">
            TRUNG TÂM PHÂN TÍCH TOÀN CẢNH
          </span>
          <span className="text-[11px] text-zinc-600 hidden sm:inline">•</span>
          <span className="text-xs text-zinc-400 hidden sm:inline">
            {overviewTab === 'heatmap' ? 'Bản đồ nhiệt vốn hóa & thanh khoản các nhóm ngành' : 'Đồ thị chỉ số kỹ thuật & cán cân độ rộng thị trường'}
          </span>
        </div>

        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-950/90 border border-zinc-800/80 backdrop-blur-xl">
          <button
            onClick={() => setOverviewTab('heatmap')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              overviewTab === 'heatmap'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
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
            <span>Biểu Đồ & Độ Rộng</span>
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
          <MarketBreadthCards />
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

      {/* 4. US Market, FedWatch & Global Macro Impact Barometer */}
      <USGlobalMacroSection />
    </div>
  );
});
MarketOverviewSection.displayName = 'MarketOverviewSection';
