'use client';

import React, { useState, useEffect } from 'react';
import {
  Gear,
  ArrowsDownUp,
  WarningCircle,
  TrendUp,
  TrendDown,
  Sparkle,
  ArrowClockwise,
  Eye,
  Rows,
  SquaresFour,
  X,
  Info,
} from '@phosphor-icons/react';

export interface SectorItemData {
  total: number;
  buy: number;
  sell: number;
  ratioPct: number;
  isClimax: boolean;
  isTrough: boolean;
}

export interface SessionSectorFlow {
  date: string;
  displayDate: string;
  totalMarket: number;
  bds: SectorItemData;
  nh: SectorItemData;
  ck: SectorItemData;
  thep: SectorItemData;
  thuc_pham?: SectorItemData;
  cong_nghiep?: SectorItemData;
  ban_le?: SectorItemData;
  dau_khi?: SectorItemData;
  cntt?: SectorItemData;
  hoa_chat?: SectorItemData;
  vin: SectorItemData;
  isLive?: boolean;
}

interface SectorMoneyFlowTableProps {
  onDataLoaded?: (data: SessionSectorFlow[]) => void;
}

// Meta definition for sectors
const SECTOR_META: Record<string, { label: string; code: string; color: string }> = {
  bds: { label: 'Bất động sản', code: 'BĐS', color: '#10b981' },
  nh: { label: 'Ngân hàng', code: 'NH', color: '#3b82f6' },
  ck: { label: 'Dịch vụ tài chính / CK', code: 'CK', color: '#f59e0b' },
  thep: { label: 'Tài nguyên Cơ bản / Thép', code: 'Thép', color: '#06b6d4' },
  thuc_pham: { label: 'Thực phẩm & Đồ uống', code: 'TP', color: '#84cc16' },
  cong_nghiep: { label: 'Hàng & DV Công nghiệp', code: 'CN', color: '#6366f1' },
  ban_le: { label: 'Bán lẻ', code: 'Bán Lẻ', color: '#ec4899' },
  dau_khi: { label: 'Dầu khí & Năng lượng', code: 'Dầu Khí', color: '#14b8a6' },
  cntt: { label: 'Công nghệ Thông tin', code: 'CNTT', color: '#8b5cf6' },
  hoa_chat: { label: 'Hóa chất & Phân bón', code: 'Hóa Chất', color: '#eab308' },
  vin: { label: 'Họ Vin (VIC/VHM/VRE)', code: 'VIN', color: '#f43f5e' },
};

/**
 * Heatmap Color Interpolation:
 * Xanh lá cây (dòng tiền mạnh nhất) -> Xanh lục -> Vàng/Cam (trung bình) -> Đỏ (dòng tiền yếu / ít nhất)
 */
export function getMoneyFlowHeatStyle(pct: number | undefined): {
  className: string;
  badgeClass: string;
  dotColor: string;
} {
  if (pct === undefined || isNaN(pct)) {
    return {
      className: 'bg-zinc-900/60 text-zinc-400',
      badgeClass: 'bg-zinc-800 text-zinc-400',
      dotColor: '#71717a',
    };
  }

  if (pct >= 25) {
    // Rất mạnh (Xanh lá đậm tươi - High inflow)
    return {
      className: 'bg-emerald-600/75 text-emerald-50 font-bold border border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.25)]',
      badgeClass: 'bg-emerald-950/90 text-emerald-300 border border-emerald-600/50',
      dotColor: '#10b981',
    };
  } else if (pct >= 18) {
    // Mạnh (Xanh lục vừa)
    return {
      className: 'bg-emerald-700/65 text-emerald-100 font-semibold border border-emerald-500/30',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50',
      dotColor: '#059669',
    };
  } else if (pct >= 12) {
    // Khá tốt (Xanh chuối / Teal)
    return {
      className: 'bg-teal-700/60 text-teal-100 font-medium border border-teal-600/30',
      badgeClass: 'bg-teal-950/80 text-teal-300 border border-teal-700/40',
      dotColor: '#0d9488',
    };
  } else if (pct >= 8) {
    // Trung bình khá (Vàng sáng / Amber)
    return {
      className: 'bg-amber-600/65 text-amber-50 font-medium border border-amber-500/30',
      badgeClass: 'bg-amber-950/80 text-amber-300 border border-amber-600/40',
      dotColor: '#f59e0b',
    };
  } else if (pct >= 5) {
    // Trung bình (Cam / Orange)
    return {
      className: 'bg-orange-600/60 text-orange-100 border border-orange-500/30',
      badgeClass: 'bg-orange-950/80 text-orange-300 border border-orange-600/40',
      dotColor: '#ea580c',
    };
  } else if (pct >= 2.5) {
    // Thấp (Đỏ cam / Rose)
    return {
      className: 'bg-rose-700/60 text-rose-100 border border-rose-600/30',
      badgeClass: 'bg-rose-950/80 text-rose-300 border border-rose-700/40',
      dotColor: '#e11d48',
    };
  } else {
    // Rất thấp / Cạn kiệt (Đỏ gạch sẫm - Dried up)
    return {
      className: 'bg-red-900/65 text-red-200 border border-red-800/40',
      badgeClass: 'bg-red-950/80 text-red-300 border border-red-800/50',
      dotColor: '#991b1b',
    };
  }
}

export function SectorMoneyFlowTable({ onDataLoaded }: SectorMoneyFlowTableProps) {
  const [data, setData] = useState<SessionSectorFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState<number>(20);
  const [warnings, setWarnings] = useState<string[]>([]);

  // View Layout Mode:
  // - 'timeline': Bảng theo từng phiên (ngang)
  // - 'matrix': Ma trận nhiệt tỷ trọng ngành (dọc theo ngành, ngang theo ngày - y hệt ảnh người dùng)
  const [viewLayout, setViewLayout] = useState<'timeline' | 'matrix'>('timeline');

  // Compact Mode vs Detailed Mode in Timeline View
  // - compact (true): Chỉ hiển thị Tổng & % (Ẩn Mua CĐ, Bán CĐ)
  // - detailed (false): Hiển thị đầy đủ Mua CĐ, Bán CĐ
  const [isCompact, setIsCompact] = useState<boolean>(true);

  // Detail Modal for a specific session
  const [selectedSession, setSelectedSession] = useState<SessionSectorFlow | null>(null);

  const fetchData = async (limitVal: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market/sector-flow?limit=${limitVal}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setData(json.data);
          setWarnings(json.warnings || []);
          if (onDataLoaded) onDataLoaded(json.data);
        }
      }
    } catch (e) {
      console.error('Failed to load sector flow data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(limit);
  }, [limit]);

  const formatVal = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '-';
    return val.toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  // Reversible sorted sessions for matrix (oldest -> newest or newest -> oldest)
  const matrixSessions = [...data].reverse();

  return (
    <div className="space-y-4">
      {/* Top Banner: Climax & Market Money Flow Warning Bar */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
            <WarningCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Cảnh Báo Dòng Tiền:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {warnings.map((w, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
              >
                <Sparkle className="w-3 h-3 text-amber-400" />
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Control Bar: Title, View Switcher, Compact/Detail Toggle, Timeframe */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
            ₫
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-100 flex items-center gap-2">
              Bảng Theo Dõi Dòng Tiền Ngành
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-normal">
                Đơn vị: Tỷ VNĐ
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Màu nhiệt biểu thị độ mạnh dòng tiền: <span className="text-emerald-400 font-medium">Xanh lá (Hút tiền mạnh)</span> &rarr; <span className="text-amber-400 font-medium">Vàng/Cam (Trung bình)</span> &rarr; <span className="text-rose-400 font-medium">Đỏ (Cạn kiệt)</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Switcher: Timeline vs Heatmap Matrix */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium">
            <button
              onClick={() => setViewLayout('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewLayout === 'timeline'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              <span>Bảng Theo Phiên</span>
            </button>
            <button
              onClick={() => setViewLayout('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewLayout === 'matrix'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <SquaresFour className="w-3.5 h-3.5" />
              <span>Ma Trận Nhiệt Ngành</span>
            </button>
          </div>

          {/* Compact Toggle Button (Only active in Timeline View) */}
          {viewLayout === 'timeline' && (
            <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium">
              <button
                onClick={() => setIsCompact(true)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  isCompact
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Thu Gọn (Tổng & %)
              </button>
              <button
                onClick={() => setIsCompact(false)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  !isCompact
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Chi Tiết (Mua/Bán CĐ)
              </button>
            </div>
          )}

          {/* Timeframe Limit Pills */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs font-medium">
            <button
              onClick={() => setLimit(10)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                limit === 10 ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              10 Phiên
            </button>
            <button
              onClick={() => setLimit(20)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                limit === 20 ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              20 Phiên
            </button>
            <button
              onClick={() => setLimit(30)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                limit === 30 ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              30 Phiên
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(limit)}
            disabled={loading}
            title="Làm mới dữ liệu"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <ArrowClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* HEATMAP COLOR LEGEND */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-zinc-950/60 border border-zinc-800/60 rounded-xl text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-400 font-medium">Thang đo nhiệt dòng tiền:</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600/80 text-emerald-100 border border-emerald-400/30">
            &ge; 25% Cực mạnh
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-700/65 text-emerald-100">
            18% - 25% Mạnh
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-teal-700/60 text-teal-100">
            12% - 18% Khá tốt
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-600/65 text-amber-50">
            8% - 12% Trung bình khá
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-orange-600/60 text-orange-100">
            4% - 8% Trung bình
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-700/60 text-rose-100">
            2.5% - 4% Thấp
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-900/65 text-red-200">
            &lt; 2.5% Cạn kiệt
          </span>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          HOSE + HNX + UPCOM • Realtime
        </span>
      </div>

      {/* VIEW 1: TIMELINE TABLE (BẢNG THEO PHIÊN) */}
      {viewLayout === 'timeline' && (
        <div className="relative overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/90 shadow-2xl">
          <table className="w-full text-left text-xs text-zinc-200 border-collapse">
            <thead className="bg-zinc-900/95 text-zinc-300 font-mono text-[11px] sticky top-0 z-20 backdrop-blur-md border-b border-zinc-800">
              <tr>
                <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/80 text-zinc-400">
                  Ngày GD
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/80 text-emerald-400 bg-emerald-950/20">
                  Tổng TT
                </th>

                {/* Ngân hàng */}
                <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-blue-950/30 text-blue-300 font-bold">
                  Tổng NH
                </th>
                {!isCompact && (
                  <>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                      Mua NH
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                      Bán NH
                    </th>
                  </>
                )}
                <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-center font-bold text-blue-300">
                  % NH
                </th>

                {/* Chứng khoán */}
                <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-amber-950/20 text-amber-300 font-bold">
                  Tổng CK
                </th>
                {!isCompact && (
                  <>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                      Mua CK
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                      Bán CK
                    </th>
                  </>
                )}
                <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-center font-bold text-amber-300">
                  % CK
                </th>

                {/* Bất động sản */}
                <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-emerald-950/20 text-emerald-300 font-bold">
                  Tổng BĐS
                </th>
                {!isCompact && (
                  <>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                      Mua BĐS
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                      Bán BĐS
                    </th>
                  </>
                )}
                <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-center font-bold text-emerald-300">
                  % BĐS
                </th>

                {/* Thép */}
                <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-cyan-950/30 text-cyan-300 font-bold">
                  Tổng Thép
                </th>
                {!isCompact && (
                  <>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                      Mua Thép
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                      Bán Thép
                    </th>
                  </>
                )}
                <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-center font-bold text-cyan-300">
                  % Thép
                </th>

                {/* Họ Vin */}
                <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-indigo-950/30 text-indigo-300 font-bold">
                  Tổng VIN
                </th>
                {!isCompact && (
                  <>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                      Mua VIN
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                      Bán VIN
                    </th>
                  </>
                )}
                <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-center font-bold text-indigo-300">
                  % VIN
                </th>

                {/* Soi chi tiết */}
                <th className="px-3 py-3 whitespace-nowrap text-center text-zinc-400">
                  Chi Tiết
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800/60 font-mono text-[12px]">
              {loading ? (
                <tr>
                  <td colSpan={20} className="px-6 py-12 text-center text-zinc-400 font-sans text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ArrowClockwise className="w-5 h-5 text-emerald-400 animate-spin" />
                      <span>Đang tải số liệu dòng tiền ngành thực tế...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const nhStyle = getMoneyFlowHeatStyle(row.nh?.ratioPct);
                  const ckStyle = getMoneyFlowHeatStyle(row.ck?.ratioPct);
                  const bdsStyle = getMoneyFlowHeatStyle(row.bds?.ratioPct);
                  const thepStyle = getMoneyFlowHeatStyle(row.thep?.ratioPct);
                  const vinStyle = getMoneyFlowHeatStyle(row.vin?.ratioPct);

                  return (
                    <tr
                      key={row.date}
                      className={`hover:bg-zinc-800/30 transition-colors ${
                        row.isLive ? 'bg-emerald-950/10' : ''
                      }`}
                    >
                      {/* Ngày GD */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/80 font-bold text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          {row.isLive && (
                            <span
                              title="Phiên trực tiếp hôm nay"
                              className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                            />
                          )}
                          <span>{row.displayDate || row.date}</span>
                        </div>
                      </td>

                      {/* Tổng TT */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/80 font-bold text-emerald-400 bg-emerald-950/10">
                        {formatVal(row.totalMarket)}
                      </td>

                      {/* Ngân hàng */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/30">
                        {formatVal(row.nh?.total)}
                      </td>
                      {!isCompact && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.nh?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.nh?.sell)}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-800/80 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] ${nhStyle.className}`}
                        >
                          {formatVal(row.nh?.ratioPct)}%
                        </span>
                      </td>

                      {/* Chứng khoán */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/30">
                        {formatVal(row.ck?.total)}
                      </td>
                      {!isCompact && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.ck?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.ck?.sell)}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-800/80 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] ${ckStyle.className}`}
                        >
                          {formatVal(row.ck?.ratioPct)}%
                        </span>
                      </td>

                      {/* Bất động sản */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/30">
                        {formatVal(row.bds?.total)}
                      </td>
                      {!isCompact && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.bds?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.bds?.sell)}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-800/80 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] ${bdsStyle.className}`}
                        >
                          {formatVal(row.bds?.ratioPct)}%
                        </span>
                      </td>

                      {/* Thép */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/30">
                        {formatVal(row.thep?.total)}
                      </td>
                      {!isCompact && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.thep?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.thep?.sell)}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-800/80 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] ${thepStyle.className}`}
                        >
                          {formatVal(row.thep?.ratioPct)}%
                        </span>
                      </td>

                      {/* Họ Vin */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/30">
                        {formatVal(row.vin?.total)}
                      </td>
                      {!isCompact && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.vin?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.vin?.sell)}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-800/80 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] ${vinStyle.className}`}
                        >
                          {formatVal(row.vin?.ratioPct)}%
                        </span>
                      </td>

                      {/* Button Xem Chi Tiết */}
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <button
                          onClick={() => setSelectedSession(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-[11px] font-sans"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 2: SECTOR HEATMAP MATRIX (MA TRẬN NHIỆT TỶ TRỌNG NGÀNH - CHUẨN THEO ẢNH NGƯỜI DÙNG) */}
      {viewLayout === 'matrix' && (
        <div className="relative overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/90 shadow-2xl">
          <table className="w-full text-left text-xs text-zinc-200 border-collapse">
            <thead className="bg-zinc-900/95 text-zinc-300 font-mono text-[11px] sticky top-0 z-20 backdrop-blur-md border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap border-r border-zinc-800/80 min-w-[200px] text-zinc-300 font-sans font-bold">
                  NGÀNH
                </th>
                {matrixSessions.map((s) => (
                  <th
                    key={s.date}
                    className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/60 text-center text-zinc-400 min-w-[100px]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {s.isLive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                      <span>{s.date}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800/60 font-mono text-[12px]">
              {Object.entries(SECTOR_META).map(([secKey, meta]) => {
                return (
                  <tr key={secKey} className="hover:bg-zinc-800/20 transition-colors">
                    {/* Tên ngành */}
                    <td className="px-4 py-3 whitespace-nowrap border-r border-zinc-800/80 font-sans font-semibold text-zinc-200 bg-zinc-900/40">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span>{meta.label}</span>
                      </div>
                    </td>

                    {/* Các ô tỷ trọng theo từng ngày kèm màu nhiệt */}
                    {matrixSessions.map((s) => {
                      const itemData = (s as any)[secKey] as SectorItemData | undefined;
                      const pct = itemData?.ratioPct;
                      const heat = getMoneyFlowHeatStyle(pct);

                      return (
                        <td
                          key={s.date}
                          className="p-1 border-r border-zinc-800/60 text-center"
                          title={`${meta.label} (${s.date}): ${pct}% • Tổng GTGD: ${formatVal(itemData?.total)} Tỷ`}
                        >
                          <div
                            className={`py-2 px-2 rounded-lg font-bold transition-transform hover:scale-105 cursor-pointer ${heat.className}`}
                            onClick={() => setSelectedSession(s)}
                          >
                            <span>{pct !== undefined ? `${pct.toFixed(2)}%` : '-'}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL SOI CHI TIẾT PHIÊN GIAO DỊCH */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  Chi Tiết Khớp Lệnh Dòng Tiền • Phiên {selectedSession.date}
                  {selectedSession.isLive && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                      Live
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Tổng thanh khoản thị trường: <strong className="text-emerald-400 font-mono">{formatVal(selectedSession.totalMarket)} Tỷ VNĐ</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content: Grid Breakdown per Sector */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {Object.entries(SECTOR_META).map(([key, meta]) => {
                const item = (selectedSession as any)[key] as SectorItemData | undefined;
                if (!item) return null;
                const heat = getMoneyFlowHeatStyle(item.ratioPct);
                const netBuyVal = (item.buy || 0) - (item.sell || 0);

                return (
                  <div
                    key={key}
                    className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <div>
                        <div className="font-semibold text-zinc-200 text-xs sm:text-sm">
                          {meta.label}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          Tổng: <strong className="text-zinc-100">{formatVal(item.total)} Tỷ</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <div className="text-emerald-400">Mua CĐ: {formatVal(item.buy)} Tỷ</div>
                        <div className="text-rose-400">Bán CĐ: {formatVal(item.sell)} Tỷ</div>
                      </div>

                      <div className="text-right pl-3 border-l border-zinc-800">
                        <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${heat.className}`}>
                          {item.ratioPct}%
                        </span>
                        <div className={`text-[10px] mt-1 ${netBuyVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {netBuyVal >= 0 ? `+${formatVal(netBuyVal)} Tỷ` : `${formatVal(netBuyVal)} Tỷ`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
