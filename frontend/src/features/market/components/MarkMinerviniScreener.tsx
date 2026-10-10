'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkle,
  TrendUp,
  TrendDown,
  Funnel,
  ArrowClockwise,
  CheckCircle,
  XCircle,
  MagnifyingGlass,
  ChartLineUp,
  Coins,
  Gauge,
  Tag,
  ArrowRight,
  ShieldCheck,
  Flame,
  Buildings,
  CaretUp,
  CaretDown,
  CaretUpDown,
  SquaresFour,
  Table as TableIcon,
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import { MinerviniScreenerItem } from '../types/minervini.types';
import { getStockPriceColor } from '../utils/priceColors';

type ScreenerTab = 'overview' | 'performance' | 'technicals' | 'valuation';
type ViewMode = 'table' | 'sectors';

export const MarkMinerviniScreener: React.FC = () => {
  const { setSelectedSymbol, setViewMode } = useMarketStore();

  const [items, setItems] = useState<MinerviniScreenerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ScreenerTab>('overview');
  const [mainViewMode, setMainViewMode] = useState<ViewMode>('table');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [minRs, setMinRs] = useState<number>(50);
  const [onlyStage2, setOnlyStage2] = useState<boolean>(false);

  // Sorting state (Auto-sorts dynamically when clicked)
  const [sortKey, setSortKey] = useState<string>('rsRating');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Active filter chips (matching Image 1)
  const [activeChips] = useState<string[]>([
    'Vốn hóa >= 1.000 Tỷ VNĐ',
    'Khối lượng TB 10N >= 300K',
    'Giá > SMA 50',
    'Giá > SMA 150',
    'Giá > SMA 200',
    'SMA 50 > SMA 150',
    'SMA 150 > SMA 200',
    'Hiệu suất 1Y >= 20%',
    'RS Rating >= 70',
  ]);

  const fetchScreenerData = async () => {
    setIsLoading(true);
    try {
      // Fetch full universe (stage2=false & minRS=1) so client has all 80+ stocks to filter and sort
      const res = await fetch('/api/market/minervini/screener?stage2=false&minRS=1');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setItems(data.data);
        setLastUpdated(
          new Date().toLocaleTimeString('vi-VN', {
            hour12: false,
            timeZone: 'Asia/Ho_Chi_Minh',
          }) + ' (UTC+7)'
        );
      }
    } catch (err) {
      console.error('Failed to fetch Minervini screener:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScreenerData();
  }, []);

  // Distinct sectors
  const sectors = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.sector) set.add(item.sector);
    });
    return Array.from(set).sort();
  }, [items]);

  // Handle column header click to auto-sort
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' || key === 'name' || key === 'sector' ? 'asc' : 'desc');
    }
  };

  // Filtered and automatically sorted items
  const filteredAndSortedItems = useMemo(() => {
    // 1. Filter
    const filtered = items.filter((item) => {
      if (searchQuery) {
        const query = searchQuery.toUpperCase().trim();
        const matchSymbol = item.symbol.toUpperCase().includes(query);
        const matchName = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchSymbol && !matchName) return false;
      }

      if (selectedSector !== 'all' && item.sector !== selectedSector) {
        return false;
      }

      if (item.rsRating < minRs) {
        return false;
      }

      if (onlyStage2 && !item.isStage2Eligible) {
        return false;
      }

      return true;
    });

    // 2. Sort dynamically
    return filtered.sort((a: any, b: any) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortDir === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [items, searchQuery, selectedSector, minRs, onlyStage2, sortKey, sortDir]);

  // Sector groups for "Top cổ phiếu theo nhóm ngành"
  const sectorGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        sector: string;
        items: MinerviniScreenerItem[];
        avgRs: number;
        stage2Count: number;
        avgChange: number;
      }
    > = {};

    items.forEach((item) => {
      const sec = item.sector || 'Chung';
      if (!groups[sec]) {
        groups[sec] = {
          sector: sec,
          items: [],
          avgRs: 0,
          stage2Count: 0,
          avgChange: 0,
        };
      }
      groups[sec].items.push(item);
    });

    return Object.values(groups)
      .map((g) => {
        // Sort items inside sector by RS Rating descending
        g.items.sort((a, b) => b.rsRating - a.rsRating);
        const totalRs = g.items.reduce((acc, x) => acc + x.rsRating, 0);
        const totalChg = g.items.reduce((acc, x) => acc + x.changePct, 0);
        g.avgRs = Math.round(totalRs / (g.items.length || 1));
        g.avgChange = Math.round((totalChg / (g.items.length || 1)) * 100) / 100;
        g.stage2Count = g.items.filter((x) => x.isStage2Eligible).length;
        return g;
      })
      .sort((a, b) => b.avgRs - a.avgRs); // Rank leading industry sectors first
  }, [items]);

  // Summary counts
  const stage2Count = useMemo(() => items.filter((x) => x.isStage2Eligible).length, [items]);
  const leadersCount = useMemo(() => items.filter((x) => x.rsRating >= 90).length, [items]);
  const topSectors = useMemo(() => {
    return sectorGroups.slice(0, 3).map((g) => g.sector);
  }, [sectorGroups]);

  const handleSelectStock = (symbol: string) => {
    setSelectedSymbol(symbol);
    setViewMode('detail');
  };

  const renderSortIcon = (field: string) => {
    if (sortKey !== field) {
      return <CaretUpDown className="w-3.5 h-3.5 text-zinc-600 inline ml-1 opacity-60" />;
    }
    return sortDir === 'asc' ? (
      <CaretUp className="w-3.5 h-3.5 text-amber-400 inline ml-1 font-bold" />
    ) : (
      <CaretDown className="w-3.5 h-3.5 text-amber-400 inline ml-1 font-bold" />
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner: Minervini Pro Screener ─────────────────── */}
      <div className="p-6 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
                <Sparkle className="w-5 h-5" weight="fill" />
              </span>
              <h2 className="text-xl font-mono font-black text-zinc-100 tracking-tight">
                BỘ LỌC CỔ PHIẾU MARK MINERVINI
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                TREND TEMPLATE STAGE 2
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Chiến lược tìm kiếm siêu cổ phiếu tăng trưởng đột biến (SEPA) & Xếp hạng Sức mạnh Giá Tương đối (RS Rating 1-99)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Table vs Sectors */}
            <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 font-mono text-xs">
              <button
                onClick={() => setMainViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  mainViewMode === 'table'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <TableIcon className="w-4 h-4" />
                <span>Bảng Lọc Chi Tiết</span>
              </button>
              <button
                onClick={() => setMainViewMode('sectors')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  mainViewMode === 'sectors'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Buildings className="w-4 h-4" />
                <span>Top CP Theo Nhóm Ngành</span>
              </button>
            </div>

            {/* Quick Scan Button */}
            <button
              onClick={fetchScreenerData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:via-orange-400 hover:to-rose-500 text-zinc-950 font-mono font-black text-xs transition-all shadow-lg shadow-amber-500/25 active:scale-95 border border-amber-300/40 cursor-pointer"
            >
              <ArrowClockwise className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} weight="bold" />
              <span>{isLoading ? 'ĐANG QUÉT...' : '⚡ QUÉT LẠI'}</span>
            </button>
          </div>
        </div>

        {/* ── Metric Summary Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Đạt Trend Template (8/8)</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-emerald-400">{stage2Count}</span>
              <span className="text-xs font-mono text-zinc-500">/ {items.length} mã quét</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Top Leaders (RS &gt;= 90)</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-amber-400">{leadersCount}</span>
              <span className="text-xs font-mono text-zinc-500">cổ phiếu siêu sao</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Top Ngành Dẫn Sóng</span>
              <TrendUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xs font-mono font-bold text-zinc-200 truncate mt-1">
              {topSectors.length > 0 ? topSectors.join(' · ') : 'Chứng khoán, Thép, Công nghệ'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Nguồn Dữ Liệu</span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                100% REAL DNSE
              </span>
            </div>
            <div className="text-xs font-mono text-zinc-300 mt-1">
              DNSE Entrade API (365 phiên thật)
            </div>
          </div>
        </div>

        {/* ── Active Preset Filter Chips ─────────────────────────────── */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center gap-2 mb-2">
            <Funnel className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
              Tiêu chí bộ lọc Mark Minervini (Trend Template 8/8):
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-medium shadow-sm hover:border-amber-400 transition-all cursor-default"
              >
                <span>{chip}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 1: TOP CỔ PHIẾU THEO NHÓM NGÀNH (SECTOR LEADERS)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mainViewMode === 'sectors' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Buildings className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-mono font-bold text-zinc-100 text-sm">
                  XẾP HẠNG VÀ TOP CỔ PHIẾU THEO TỪNG NHÓM NGÀNH
                </h3>
                <p className="text-xs text-zinc-400 font-sans">
                  Sức mạnh ngành trung bình (Average RS) & Các mã dẫn sóng (Leaders) đạt chuẩn Minervini
                </p>
              </div>
            </div>
            <button
              onClick={() => setMainViewMode('table')}
              className="text-xs font-mono font-bold text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/30 transition-colors"
            >
              Chuyển sang Bảng Lọc Toàn Bộ →
            </button>
          </div>

          {/* Grid of Sector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectorGroups.map((group, gIdx) => {
              const isLeadSector = gIdx < 3;
              return (
                <div
                  key={group.sector}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between backdrop-blur-xl relative overflow-hidden ${
                    isLeadSector
                      ? 'bg-zinc-950/95 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20'
                      : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700/80'
                  }`}
                >
                  <div>
                    {/* Header: Sector rank & Avg RS */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                            gIdx === 0
                              ? 'bg-amber-400 text-zinc-950'
                              : gIdx === 1
                              ? 'bg-zinc-300 text-zinc-950'
                              : gIdx === 2
                              ? 'bg-amber-700 text-zinc-100'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          #{gIdx + 1}
                        </span>
                        <h4 className="font-mono font-bold text-sm text-zinc-100">{group.sector}</h4>
                      </div>

                      {/* Prominent Sector RS Pill */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono font-bold text-xs shadow-sm">
                        <Sparkle weight="fill" className="w-3.5 h-3.5 text-amber-400" />
                        <span>RS Ngành: {group.avgRs}/99</span>
                      </div>
                    </div>

                    {/* Sector Sub-metrics */}
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-3.5">
                      <span>{group.items.length} mã theo dõi</span>
                      <span className="text-emerald-400 font-bold">
                        {group.stage2Count}/{group.items.length} mã Stage 2
                      </span>
                      <span
                        className={`font-bold ${
                          group.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {group.avgChange >= 0 ? '+' : ''}
                        {group.avgChange.toFixed(2)}%
                      </span>
                    </div>

                    {/* Leaders List for this sector */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                        Top Cổ Phiếu Dẫn Dắt (Leaders):
                      </span>
                      {group.items.slice(0, 4).map((stock, sIdx) => {
                        const priceColor = getStockPriceColor({
                          price: stock.price,
                          changePercent: stock.changePct,
                          exchange: stock.exchange,
                        });
                        const isUp = stock.changePct > 0;
                        return (
                          <div
                            key={stock.symbol}
                            onClick={() => handleSelectStock(stock.symbol)}
                            className="p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-amber-400/50 transition-all cursor-pointer flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-zinc-500 font-mono text-xs font-bold w-4">
                                {sIdx + 1}.
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-xs text-zinc-100 group-hover:text-amber-400 transition-colors">
                                    {stock.symbol}
                                  </span>
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                                    {stock.exchange}
                                  </span>
                                  {stock.isStage2Eligible && (
                                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      8/8
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-zinc-400 truncate max-w-[130px] font-sans">
                                  {stock.name}
                                </p>
                              </div>
                            </div>

                            <div className="text-right flex items-center gap-3">
                              {/* Prominent RS Rating */}
                              <div className="text-right">
                                <span className="font-mono font-black text-xs sm:text-sm px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-sm block">
                                  RS {stock.rsRating}
                                </span>
                              </div>

                              <div>
                                <div className={`font-mono text-xs font-bold ${priceColor.colorClass}`}>
                                  {(stock.price / 1000).toFixed(2)}k
                                </div>
                                <div
                                  className={`font-mono text-[10px] font-bold ${priceColor.colorClass}`}
                                >
                                  {isUp ? '+' : ''}
                                  {stock.changePct.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card footer: filter this sector in table */}
                  <div className="pt-3 mt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <button
                      onClick={() => {
                        setSelectedSector(group.sector);
                        setMainViewMode('table');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold transition-colors inline-flex items-center gap-1"
                    >
                      <span>Lọc riêng ngành này</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <span>{group.items.length} cổ phiếu</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 2: BẢNG LỌC TOÀN BỘ CỔ PHIẾU (INTERACTIVE TABLE)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mainViewMode === 'table' && (
        <div className="space-y-4">
          {/* ── Search, Sector, RS Controls & Sub-Tabs ─────────────────────── */}
          <div className="p-4 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
            {/* Sub-tabs switcher */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tổng Quan
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'performance'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Hiệu Suất & RS
              </button>
              <button
                onClick={() => setActiveTab('technicals')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'technicals'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Kỹ Thuật MA
              </button>
              <button
                onClick={() => setActiveTab('valuation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'valuation'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Định Giá & Tăng Trưởng
              </button>
            </div>

            {/* Quick Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Quick Search */}
              <div className="relative">
                <MagnifyingGlass className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm mã hoặc tên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 w-44 transition-all"
                />
              </div>

              {/* Sector Selector */}
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono focus:outline-none focus:border-amber-400"
              >
                <option value="all">Tất cả ngành ({items.length})</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Min RS rating */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl text-xs font-mono">
                <span className="text-zinc-500">RS &gt;=</span>
                <select
                  value={minRs}
                  onChange={(e) => setMinRs(Number(e.target.value))}
                  className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="0">Tất cả</option>
                  <option value="50">50</option>
                  <option value="70">70 (Chuẩn)</option>
                  <option value="80">80 (Mạnh)</option>
                  <option value="90">90 (Siêu sao)</option>
                </select>
              </div>

              {/* Only Stage 2 toggle */}
              <button
                onClick={() => setOnlyStage2(!onlyStage2)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                  onlyStage2
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Chỉ Stage 2 (8/8)</span>
              </button>
            </div>
          </div>

          {/* ── Quick Sort Shortcuts Ribbon ───────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Sắp Xếp Nhanh:</span>
              <button
                onClick={() => {
                  setSortKey('rsRating');
                  setSortDir('desc');
                }}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  sortKey === 'rsRating'
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 font-black'
                    : 'bg-zinc-900 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                🔥 Top RS Rating
              </button>
              <button
                onClick={() => {
                  setSortKey('changePct');
                  setSortDir('desc');
                }}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  sortKey === 'changePct'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-black'
                    : 'bg-zinc-900 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                % Tăng Mạnh Nhất
              </button>
              <button
                onClick={() => {
                  setSortKey('volume');
                  setSortDir('desc');
                }}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  sortKey === 'volume'
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-black'
                    : 'bg-zinc-900 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                ⚡ Khối Lượng Cao
              </button>
              <button
                onClick={() => {
                  setSortKey('score');
                  setSortDir('desc');
                }}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  sortKey === 'score'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-black'
                    : 'bg-zinc-900 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                🛡️ Tiêu Chí 8/8
              </button>
            </div>
            <div className="text-[11px] text-zinc-500">
              Bấm vào bất kỳ tiêu đề cột nào để tự động đảo chiều sắp xếp (↑ / ↓)
            </div>
          </div>

          {/* ── Screener Data Table ───────────────────────────────────────── */}
          <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[11px] border-b border-zinc-800/80 select-none">
                  <tr>
                    <th
                      onClick={() => handleSort('symbol')}
                      className="py-3 px-4 cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      Mã CP {renderSortIcon('symbol')}
                    </th>
                    <th
                      onClick={() => handleSort('price')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      Giá (VND) {renderSortIcon('price')}
                    </th>
                    <th
                      onClick={() => handleSort('changePct')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      % Thay đổi {renderSortIcon('changePct')}
                    </th>
                    <th
                      onClick={() => handleSort('volume')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      Khối lượng {renderSortIcon('volume')}
                    </th>
                    <th
                      onClick={() => handleSort('relVol')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      KL Tương đối {renderSortIcon('relVol')}
                    </th>

                    {activeTab === 'overview' && (
                      <>
                        <th
                          onClick={() => handleSort('mktCapT')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Vốn hóa (Tỷ) {renderSortIcon('mktCapT')}
                        </th>
                        <th
                          onClick={() => handleSort('pe')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          P/E {renderSortIcon('pe')}
                        </th>
                        <th
                          onClick={() => handleSort('epsGrowthYoY')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          EPS YoY {renderSortIcon('epsGrowthYoY')}
                        </th>
                        <th
                          onClick={() => handleSort('sector')}
                          className="py-3 px-3 cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Ngành {renderSortIcon('sector')}
                        </th>
                      </>
                    )}

                    {activeTab === 'performance' && (
                      <>
                        <th
                          onClick={() => handleSort('perf1W')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          1 Tuần {renderSortIcon('perf1W')}
                        </th>
                        <th
                          onClick={() => handleSort('perf1M')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          1 Tháng {renderSortIcon('perf1M')}
                        </th>
                        <th
                          onClick={() => handleSort('perf1Y')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          1 Năm {renderSortIcon('perf1Y')}
                        </th>
                        <th
                          onClick={() => handleSort('distHigh')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Cách đỉnh 52W {renderSortIcon('distHigh')}
                        </th>
                      </>
                    )}

                    {activeTab === 'technicals' && (
                      <>
                        <th
                          onClick={() => handleSort('sma50')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          SMA 50 {renderSortIcon('sma50')}
                        </th>
                        <th
                          onClick={() => handleSort('sma150')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          SMA 150 {renderSortIcon('sma150')}
                        </th>
                        <th
                          onClick={() => handleSort('sma200')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          SMA 200 {renderSortIcon('sma200')}
                        </th>
                        <th
                          onClick={() => handleSort('distLow')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Trên đáy 52W {renderSortIcon('distLow')}
                        </th>
                      </>
                    )}

                    {activeTab === 'valuation' && (
                      <>
                        <th
                          onClick={() => handleSort('pe')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          P/E {renderSortIcon('pe')}
                        </th>
                        <th
                          onClick={() => handleSort('epsDiluted')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          EPS Pha Loãng {renderSortIcon('epsDiluted')}
                        </th>
                        <th
                          onClick={() => handleSort('epsGrowthYoY')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Tăng trưởng YoY {renderSortIcon('epsGrowthYoY')}
                        </th>
                        <th
                          onClick={() => handleSort('dividendYield')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Cổ tức (%) {renderSortIcon('dividendYield')}
                        </th>
                      </>
                    )}

                    {/* Prominent RS Rating Header */}
                    <th
                      onClick={() => handleSort('rsRating')}
                      className="py-3 px-3 text-center cursor-pointer hover:bg-zinc-800/80 hover:text-amber-300 transition-colors bg-amber-500/10"
                    >
                      RS Rating {renderSortIcon('rsRating')}
                    </th>
                    <th
                      onClick={() => handleSort('score')}
                      className="py-3 px-3 text-center cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      Stage 2 {renderSortIcon('score')}
                    </th>
                    <th className="py-3 px-4 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {filteredAndSortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-zinc-500 font-mono">
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <ArrowClockwise className="w-5 h-5 animate-spin text-amber-400" />
                            <span>Đang tính toán tiêu chuẩn Minervini từ hệ thống DNSE...</span>
                          </div>
                        ) : (
                          'Không tìm thấy cổ phiếu nào khớp với bộ lọc hiện tại.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedItems.map((item) => {
                      const priceColor = getStockPriceColor({
                        price: item.price,
                        changePercent: item.changePct,
                        exchange: item.exchange,
                      });
                      const isUp = item.changePct > 0;

                      const rsBadgeColor =
                        item.rsRating >= 90
                          ? 'bg-amber-400 text-zinc-950 border-amber-300 font-black shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                          : item.rsRating >= 80
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 font-black'
                          : item.rsRating >= 70
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700';

                      return (
                        <tr
                          key={item.symbol}
                          onClick={() => handleSelectStock(item.symbol)}
                          className="hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                        >
                          {/* Symbol & Name */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-zinc-100 group-hover:text-amber-400 transition-colors">
                                {item.symbol}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                                {item.exchange}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 truncate max-w-[150px] font-sans">
                              {item.name}
                            </p>
                          </td>

                          {/* Price */}
                          <td className="py-3 px-3 text-right">
                            <span className={`font-mono font-bold text-xs ${priceColor.colorClass}`}>
                              {item.price.toLocaleString('vi-VN')}
                            </span>
                          </td>

                          {/* Change % */}
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${priceColor.badgeBgClass}`}
                            >
                              {isUp ? '+' : ''}
                              {item.changePct.toFixed(2)}%
                            </span>
                          </td>

                          {/* Volume */}
                          <td className="py-3 px-3 text-right text-zinc-300">
                            {item.volume.toLocaleString('vi-VN')}
                          </td>

                          {/* Relative Volume */}
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`font-mono font-bold ${
                                item.relVol >= 1.5
                                  ? 'text-amber-400'
                                  : item.relVol >= 1.0
                                  ? 'text-emerald-400'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {item.relVol.toFixed(2)}x
                            </span>
                          </td>

                          {/* Tab-dependent columns */}
                          {activeTab === 'overview' && (
                            <>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.mktCapT.toFixed(1)}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-400">
                                {item.pe ? item.pe.toFixed(1) : 'N/A'}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span
                                  className={
                                    item.epsGrowthYoY >= 25
                                      ? 'text-emerald-400 font-bold'
                                      : item.epsGrowthYoY >= 0
                                      ? 'text-zinc-300'
                                      : 'text-rose-400'
                                  }
                                >
                                  {item.epsGrowthYoY ? `${item.epsGrowthYoY > 0 ? '+' : ''}${item.epsGrowthYoY.toFixed(1)}%` : 'N/A'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-zinc-400 truncate max-w-[130px]">
                                {item.sector}
                              </td>
                            </>
                          )}

                          {activeTab === 'performance' && (
                            <>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.perf1W !== undefined ? `${item.perf1W > 0 ? '+' : ''}${item.perf1W.toFixed(2)}%` : '0%'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.perf1M !== undefined ? `${item.perf1M > 0 ? '+' : ''}${item.perf1M.toFixed(2)}%` : '0%'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.perf1Y !== undefined ? `${item.perf1Y > 0 ? '+' : ''}${item.perf1Y.toFixed(2)}%` : '0%'}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span
                                  className={
                                    (item.distHigh ?? 0) >= -10
                                      ? 'text-emerald-400 font-bold'
                                      : (item.distHigh ?? 0) >= -25
                                      ? 'text-amber-400'
                                      : 'text-zinc-400'
                                  }
                                >
                                  {item.distHigh !== undefined ? `${item.distHigh.toFixed(1)}%` : '--'}
                                </span>
                              </td>
                            </>
                          )}

                          {activeTab === 'technicals' && (
                            <>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.sma50 ? item.sma50.toFixed(2) : '--'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.sma150 ? item.sma150.toFixed(2) : '--'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.sma200 ? item.sma200.toFixed(2) : '--'}
                              </td>
                              <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                                {item.distLow !== undefined ? `+${item.distLow.toFixed(1)}%` : '--'}
                              </td>
                            </>
                          )}

                          {activeTab === 'valuation' && (
                            <>
                              <td className="py-3 px-3 text-right text-zinc-400">
                                {item.pe ? item.pe.toFixed(1) : 'N/A'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.epsDiluted ? item.epsDiluted.toLocaleString('vi-VN') : 'N/A'}
                              </td>
                              <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                                +{item.epsDilutedGrowthYoY ? item.epsDilutedGrowthYoY.toFixed(1) : '0'}%
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-400">
                                {item.dividendYield ? `${item.dividendYield.toFixed(1)}%` : '0.0%'}
                              </td>
                            </>
                          )}

                          {/* Large Prominent RS Rating */}
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-xl text-sm font-mono font-black border ${rsBadgeColor}`}>
                              {item.rsRating}
                            </span>
                          </td>

                          {/* Stage 2 Pass / Fail */}
                          <td className="py-3 px-3 text-center">
                            {item.isStage2Eligible ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                                <span>8/8 ĐẠT</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700 text-[10px]">
                                <span>{item.criteriaPassed}/8</span>
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectStock(item.symbol);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400 text-amber-400 hover:text-zinc-950 border border-amber-400/20 text-[11px] font-mono font-bold transition-all inline-flex items-center gap-1"
                            >
                              <span>Xem Chart</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
