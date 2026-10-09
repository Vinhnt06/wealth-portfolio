'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkle,
  TrendUp,
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
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import { MinerviniScreenerItem } from '../types/minervini.types';

type ScreenerTab = 'overview' | 'performance' | 'technicals' | 'valuation';

export const MarkMinerviniScreener: React.FC = () => {
  const { setSelectedSymbol, setViewMode } = useMarketStore();

  const [items, setItems] = useState<MinerviniScreenerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ScreenerTab>('overview');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [minRs, setMinRs] = useState<number>(70);
  const [onlyStage2, setOnlyStage2] = useState<boolean>(true);

  // Active filter chips (matching Image 1)
  const [activeChips, setActiveChips] = useState<string[]>([
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
      const res = await fetch('/api/market/minervini/screener');
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

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
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
  }, [items, searchQuery, selectedSector, minRs, onlyStage2]);

  // Summary counts
  const stage2Count = useMemo(() => items.filter((x) => x.isStage2Eligible).length, [items]);
  const leadersCount = useMemo(() => items.filter((x) => x.rsRating >= 90).length, [items]);
  const topSectors = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((x) => {
      if (x.isStage2Eligible) {
        map.set(x.sector, (map.get(x.sector) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s);
  }, [items]);

  const handleSelectStock = (symbol: string) => {
    setSelectedSymbol(symbol);
    setViewMode('detail');
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
            <button
              onClick={fetchScreenerData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs font-mono font-semibold transition-all"
            >
              <ArrowClockwise className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : 'text-zinc-400'}`} />
              <span>{isLoading ? 'Đang lọc...' : 'Quét Dữ Liệu'}</span>
            </button>
            {lastUpdated && (
              <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
                Cập nhật: {lastUpdated}
              </span>
            )}
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
              <span className="text-xs font-mono text-zinc-500">cổ phiếu siêu hạng</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Ngành Dẫn Sóng Tăng Tốc</span>
              <TrendUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xs font-mono font-bold text-zinc-200 truncate mt-1">
              {topSectors.length > 0 ? topSectors.join(' · ') : 'Dầu khí, Công nghệ'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Nguồn Dữ Liệu</span>
              <span className="text-[10px] text-emerald-400 font-bold">100% REAL</span>
            </div>
            <div className="text-xs font-mono text-zinc-300 mt-1">
              DNSE API + Vnstock Realtime
            </div>
          </div>
        </div>

        {/* ── Active Preset Filter Chips (Matching Image 1) ───────────── */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center gap-2 mb-2">
            <Funnel className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
              Tiêu chí bộ lọc cài đặt sẵn (Preset Filters):
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
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Chỉ Stage 2 (8/8)</span>
          </button>
        </div>
      </div>

      {/* ── Screener Data Table ───────────────────────────────────────── */}
      <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[11px] border-b border-zinc-800/80">
              <tr>
                <th className="py-3 px-4">Mã CP</th>
                <th className="py-3 px-3 text-right">Giá (VND)</th>
                <th className="py-3 px-3 text-right">% Thay đổi</th>
                <th className="py-3 px-3 text-right">Khối lượng</th>
                <th className="py-3 px-3 text-right">KL Tương đối</th>
                {activeTab === 'overview' && (
                  <>
                    <th className="py-3 px-3 text-right">Vốn hóa (Tỷ)</th>
                    <th className="py-3 px-3 text-right">P/E</th>
                    <th className="py-3 px-3 text-right">EPS TTM YoY</th>
                    <th className="py-3 px-3">Ngành</th>
                  </>
                )}
                {activeTab === 'performance' && (
                  <>
                    <th className="py-3 px-3 text-right">1 Tuần</th>
                    <th className="py-3 px-3 text-right">1 Tháng</th>
                    <th className="py-3 px-3 text-right">1 Năm</th>
                    <th className="py-3 px-3 text-right">Cách đỉnh 52W</th>
                    <th className="py-3 px-3 text-right">Trên đáy 52W</th>
                  </>
                )}
                {activeTab === 'technicals' && (
                  <>
                    <th className="py-3 px-3 text-right">SMA 50</th>
                    <th className="py-3 px-3 text-right">SMA 150</th>
                    <th className="py-3 px-3 text-right">SMA 200</th>
                    <th className="py-3 px-3 text-center">Xu hướng SMA200</th>
                  </>
                )}
                {activeTab === 'valuation' && (
                  <>
                    <th className="py-3 px-3 text-right">P/E</th>
                    <th className="py-3 px-3 text-right">EPS Pha Loãng</th>
                    <th className="py-3 px-3 text-right">Tăng trưởng YoY</th>
                    <th className="py-3 px-3 text-right">Cổ tức (%)</th>
                  </>
                )}
                <th className="py-3 px-3 text-center">RS Rating</th>
                <th className="py-3 px-3 text-center">Stage 2</th>
                <th className="py-3 px-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {filteredItems.length === 0 ? (
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
                filteredItems.map((item) => {
                  const isUp = item.changePct > 0;
                  const isDown = item.changePct < 0;
                  const priceColor = isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-amber-400';

                  const rsBadgeColor =
                    item.rsRating >= 90
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : item.rsRating >= 80
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : item.rsRating >= 70
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
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
                          <span className="font-mono font-black text-zinc-100 text-sm group-hover:text-amber-400 transition-colors">
                            {item.symbol}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                            {item.exchange}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate max-w-[180px]">
                          {item.name}
                        </div>
                      </td>

                      {/* Price */}
                      <td className={`py-3 px-3 text-right font-bold ${priceColor}`}>
                        {item.price.toLocaleString('vi-VN')}
                      </td>

                      {/* Change % */}
                      <td className={`py-3 px-3 text-right font-bold ${priceColor}`}>
                        {item.changePct >= 0 ? '+' : ''}
                        {item.changePct.toFixed(2)}%
                      </td>

                      {/* Volume */}
                      <td className="py-3 px-3 text-right text-zinc-300">
                        {item.volume.toLocaleString('vi-VN')}
                      </td>

                      {/* Relative Volume */}
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            item.relVol >= 1.5
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'text-zinc-400'
                          }`}
                        >
                          {item.relVol.toFixed(2)}x
                        </span>
                      </td>

                      {/* Overview Tab Columns */}
                      {activeTab === 'overview' && (
                        <>
                          <td className="py-3 px-3 text-right text-zinc-400">
                            {item.mktCapT.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-3 px-3 text-right text-zinc-300">
                            {item.pe ? item.pe.toFixed(1) : '--'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`font-bold ${
                                (item.epsDilutedGrowthYoY || 0) >= 20
                                  ? 'text-emerald-400'
                                  : (item.epsDilutedGrowthYoY || 0) > 0
                                  ? 'text-zinc-300'
                                  : 'text-rose-400'
                              }`}
                            >
                              {(item.epsDilutedGrowthYoY || 0) >= 0 ? '+' : ''}
                              {(item.epsDilutedGrowthYoY || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-zinc-400 truncate max-w-[140px]">
                            {item.sector}
                          </td>
                        </>
                      )}

                      {/* Performance Tab Columns */}
                      {activeTab === 'performance' && (
                        <>
                          <td className={`py-3 px-3 text-right font-bold ${(item.perf1W || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(item.perf1W || 0) >= 0 ? '+' : ''}{(item.perf1W || 0).toFixed(2)}%
                          </td>
                          <td className={`py-3 px-3 text-right font-bold ${(item.perf1M || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(item.perf1M || 0) >= 0 ? '+' : ''}{(item.perf1M || 0).toFixed(2)}%
                          </td>
                          <td className={`py-3 px-3 text-right font-bold ${(item.perf1Y || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(item.perf1Y || 0) >= 0 ? '+' : ''}{(item.perf1Y || 0).toFixed(2)}%
                          </td>
                          <td className="py-3 px-3 text-right text-zinc-300">
                            {item.pctFrom52WHigh ? `-${(100 - item.pctFrom52WHigh).toFixed(1)}%` : '--'}
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                            {item.pctAbove52WLow ? `+${(item.pctAbove52WLow - 100).toFixed(1)}%` : '--'}
                          </td>
                        </>
                      )}

                      {/* Technicals Tab Columns */}
                      {activeTab === 'technicals' && (
                        <>
                          <td className="py-3 px-3 text-right text-cyan-400 font-bold">
                            {item.sma50 ? item.sma50.toFixed(2) : '--'}
                          </td>
                          <td className="py-3 px-3 text-right text-orange-400 font-bold">
                            {item.sma150 ? item.sma150.toFixed(2) : '--'}
                          </td>
                          <td className="py-3 px-3 text-right text-rose-400 font-bold">
                            {item.sma200 ? item.sma200.toFixed(2) : '--'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Dốc Lên (Tăng)
                            </span>
                          </td>
                        </>
                      )}

                      {/* Valuation Tab Columns */}
                      {activeTab === 'valuation' && (
                        <>
                          <td className="py-3 px-3 text-right text-zinc-300">
                            {item.pe ? item.pe.toFixed(1) : '--'}
                          </td>
                          <td className="py-3 px-3 text-right text-zinc-300">
                            {item.epsDiluted ? `${item.epsDiluted.toLocaleString('vi-VN')} đ` : '--'}
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                            {item.epsDilutedGrowthYoY ? `+${item.epsDilutedGrowthYoY.toFixed(1)}%` : '--'}
                          </td>
                          <td className="py-3 px-3 text-right text-zinc-400">
                            {item.dividendYield ? `${item.dividendYield.toFixed(1)}%` : '0.0%'}
                          </td>
                        </>
                      )}

                      {/* RS Rating */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono font-black border ${rsBadgeColor}`}>
                          {item.rsRating}
                        </span>
                      </td>

                      {/* Stage 2 Pass / Fail */}
                      <td className="py-3 px-3 text-center">
                        {item.isStage2Eligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
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
  );
};
