'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lightning,
  Fire,
  TrendUp,
  TrendDown,
  Gauge,
  ArrowsClockwise,
  MagnifyingGlass,
  Funnel,
  ShieldCheck,
  WarningCircle,
  Sparkle,
  ArrowRight,
  ChartLineUp,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

interface SurgingStock {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  changePct: number;
  liveVol: number;
  avgVol20: number;
  rVol: number;
  projectedTotal: number;
  projectedRVol: number;
  effectiveRVol: number;
  totalValBillion: number;
  rsRating: number;
  surgeCategory: 'BUY_BREAKOUT' | 'SELL_SURGE' | 'ACCUMULATION';
  isMonster: boolean;
  signalTag: string;
  signalColor: string;
}

interface RadarData {
  success: boolean;
  updatedAt: string;
  sessionProgressPct: number;
  stats: {
    total: number;
    buyBreakouts: number;
    sellSurges: number;
    accumulations: number;
    monsterSurges: number;
  };
  data: SurgingStock[];
}

const SECTOR_OPTIONS = [
  { label: 'Tất cả ngành', value: 'all' },
  { label: 'Ngân hàng', value: 'ngân hàng' },
  { label: 'Bất động sản', value: 'bất động sản' },
  { label: 'Chứng khoán', value: 'chứng khoán' },
  { label: 'Thép / Vật liệu', value: 'nguyên vật liệu' },
  { label: 'Công nghệ', value: 'công nghệ' },
  { label: 'Bán lẻ & Tiêu dùng', value: 'bán lẻ' },
  { label: 'Dầu khí & Năng lượng', value: 'dầu khí' },
];

export const RealtimeVolumeSurgeRadar: React.FC = () => {
  const { setSelectedSymbol, setViewMode } = useMarketStore();
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'monster' | 'sell'>('all');
  const [minRVol, setMinRVol] = useState<number>(1.2);
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchRadar = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const res = await fetch(`/api/market/volume-surge-radar?minRVol=${minRVol}&sector=${selectedSector}&limit=60`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setRadarData(json);
        }
      }
    } catch (err) {
      console.error('Failed to load volume surge radar:', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [minRVol, selectedSector]);

  useEffect(() => {
    fetchRadar();
    const interval = setInterval(() => {
      fetchRadar(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchRadar]);

  const filteredList = useMemo(() => {
    if (!radarData || !radarData.data) return [];
    return radarData.data.filter((item) => {
      if (filterType === 'buy' && item.surgeCategory !== 'BUY_BREAKOUT') return false;
      if (filterType === 'monster' && !item.isMonster) return false;
      if (filterType === 'sell' && item.surgeCategory !== 'SELL_SURGE') return false;
      if (searchQuery) {
        const q = searchQuery.toUpperCase();
        return item.symbol.includes(q) || item.name.toUpperCase().includes(q);
      }
      return true;
    });
  }, [radarData, filterType, searchQuery]);

  const handleInspectStock = (symbol: string) => {
    setSelectedSymbol(symbol);
    setViewMode('detail');
    setTimeout(() => {
      document.getElementById('stock-orderbook-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const formatNumber = (num: number): string => {
    if (!num) return '0';
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
    return num.toLocaleString('vi-VN');
  };

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER BANNER ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-10 rounded-full bg-amber-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold text-zinc-100">
                  Radar Bùng Nổ Khối Lượng Realtime
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900 text-zinc-300 border border-zinc-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  REALTIME FEED
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Quét & phát hiện cổ phiếu bùng nổ thanh khoản vượt trung bình 20 phiên trên HOSE, HNX, UPCOM
                {radarData?.updatedAt && ` • Cập nhật lúc ${radarData.updatedAt}`}
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchRadar()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all disabled:opacity-50"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* ── 4 KEY BENTO METRIC TILES ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Tile 1: Buy Breakouts */}
        <button
          onClick={() => setFilterType('buy')}
          className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden cursor-pointer ${
            filterType === 'buy'
              ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Bùng Nổ Mua Mạnh</span>
            <TrendUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
              {radarData?.stats?.buyBreakouts ?? 0}
            </span>
            <span className="text-xs font-mono text-zinc-500">Mã (Giá Tăng)</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Cầu chủ động áp đảo, giá bứt phá nền
          </span>
        </button>

        {/* Tile 2: Monster Surges (>= 2.0x) */}
        <button
          onClick={() => setFilterType('monster')}
          className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden cursor-pointer ${
            filterType === 'monster'
              ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
              : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Nổ Vol &ge; 2.0x</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">2.0X</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">
              {radarData?.stats?.monsterSurges ?? 0}
            </span>
            <span className="text-xs font-mono text-zinc-500">Mã (&gt; 2.0x TB)</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Dòng tiền tay to / tổ chức đột biến
          </span>
        </button>

        {/* Tile 3: Total Surging Stocks */}
        <button
          onClick={() => setFilterType('all')}
          className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden cursor-pointer ${
            filterType === 'all'
              ? 'bg-zinc-900 border-zinc-600 shadow-lg'
              : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Tổng Mã Bùng Nổ</span>
            <Gauge className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-zinc-100">
              {radarData?.stats?.total ?? 0}
            </span>
            <span className="text-xs font-mono text-zinc-500">Mã Trên Sàn</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Đạt tiêu chuẩn thanh khoản &gt;= 100K CP
          </span>
        </button>

        {/* Tile 4: Sell Surges */}
        <button
          onClick={() => setFilterType('sell')}
          className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden cursor-pointer ${
            filterType === 'sell'
              ? 'bg-rose-500/10 border-rose-500/50 shadow-lg shadow-rose-500/10'
              : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Cảnh Báo Bán Xả</span>
            <TrendDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-rose-400">
              {radarData?.stats?.sellSurges ?? 0}
            </span>
            <span className="text-xs font-mono text-zinc-500">Mã (Giá Giảm)</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Áp lực chốt lời lớn hoặc phân phối
          </span>
        </button>
      </div>

      {/* ── TOOLBAR: FILTERS, SECTOR SELECT & SEARCH ── */}
      <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-medium">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterType === 'all'
                ? 'bg-zinc-800 text-zinc-100 font-bold shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tất Cả ({radarData?.stats?.total ?? 0})
          </button>
          <button
            onClick={() => setFilterType('buy')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              filterType === 'buy'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow'
                : 'text-zinc-400 hover:text-emerald-300'
            }`}
          >
            <TrendUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Bùng Nổ Mua ({radarData?.stats?.buyBreakouts ?? 0})</span>
          </button>
          <button
            onClick={() => setFilterType('monster')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              filterType === 'monster'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow'
                : 'text-zinc-400 hover:text-amber-300'
            }`}
          >
            <span>Nổ Vol &ge; 2x ({radarData?.stats?.monsterSurges ?? 0})</span>
          </button>
          <button
            onClick={() => setFilterType('sell')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              filterType === 'sell'
                ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 shadow'
                : 'text-zinc-400 hover:text-rose-300'
            }`}
          >
            <TrendDown className="w-3.5 h-3.5 text-rose-400" />
            <span>Bán Xả ({radarData?.stats?.sellSurges ?? 0})</span>
          </button>
        </div>

        {/* Threshold & Sector & Search Input */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Min rVol selector */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-500 px-2 text-[11px] font-sans">Ngưỡng rVol:</span>
            {[1.1, 1.3, 1.5, 2.0].map((v) => (
              <button
                key={v}
                onClick={() => setMinRVol(v)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  minRVol === v ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                &ge;{v}x
              </button>
            ))}
          </div>

          {/* Sector Filter */}
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono outline-none focus:border-amber-500/50"
          >
            {SECTOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-200">
                {opt.label}
              </option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative">
            <MagnifyingGlass className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm mã cổ phiếu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 font-mono placeholder:text-zinc-600 outline-none focus:border-amber-500/50 w-36 sm:w-44"
            />
          </div>
        </div>
      </div>

      {/* ── REALTIME SURGE CARDS & DATA TABLE ── */}
      {filteredList.length === 0 ? (
        <div className="p-12 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-center space-y-3">
          <WarningCircle className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm font-bold text-zinc-300">Không có mã nào thoả mãn bộ lọc nổ vol này</p>
          <p className="text-xs text-zinc-500">Thử hạ ngưỡng rVol xuống 1.1x hoặc chọn tất cả các ngành.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredList.map((item) => {
            const isBuy = item.changePct > 0;
            const isSell = item.changePct < 0;
            const rVolDisplay = item.effectiveRVol;

            return (
              <div
                key={item.symbol}
                className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 hover:border-zinc-700/90 transition-all shadow-xl group relative overflow-hidden flex flex-col justify-between space-y-4"
              >
                {/* Top Row: Symbol, Exchange, Price, Change */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-mono font-black text-zinc-100 group-hover:text-amber-400 transition-colors">
                          {item.symbol}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
                          {item.exchange}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[140px]">
                          {item.sector}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate mt-0.5 max-w-[240px]">{item.name}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-mono font-black text-zinc-100 block">
                        {item.price.toLocaleString('vi-VN')}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold flex items-center justify-end gap-0.5 ${
                          isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-zinc-400'
                        }`}
                      >
                        {isBuy ? <TrendUp className="w-3.5 h-3.5" /> : isSell ? <TrendDown className="w-3.5 h-3.5" /> : null}
                        {isBuy ? `+${item.changePct}%` : `${item.changePct}%`}
                      </span>
                    </div>
                  </div>

                  {/* Volume Breakout Gauge Bar */}
                  <div className="mt-4 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400 flex items-center gap-1.5">
                        <Lightning className="w-3.5 h-3.5 text-amber-400" />
                        Độ Nổ Vol:
                      </span>
                      <span
                        className={`font-black ${
                          item.isMonster
                            ? 'text-amber-400'
                            : isBuy
                            ? 'text-emerald-400'
                            : 'text-zinc-300'
                        }`}
                      >
                        {rVolDisplay}x SMA20
                      </span>
                    </div>

                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          item.isMonster
                            ? 'bg-gradient-to-r from-amber-500 to-amber-300'
                            : isBuy
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-zinc-500'
                        }`}
                        style={{ width: `${Math.min(100, (rVolDisplay / 3.0) * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-0.5">
                      <span>Khớp: {formatNumber(item.liveVol)} CP</span>
                      <span>TB20P: {formatNumber(item.avgVol20)} CP</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Badges & Action to inspect trajectory */}
                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${item.signalColor}`}>
                      {item.signalTag}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      GT: {item.totalValBillion} Tỷ
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      RS: <b className="text-zinc-200">{item.rsRating}</b>
                    </span>
                  </div>

                  <button
                    onClick={() => handleInspectStock(item.symbol)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 font-mono text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    title={`Xem biểu đồ so sánh đường cong nổ vol của ${item.symbol}`}
                  >
                    <span>Soi Nổ Vol</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
