'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  User,
  Buildings,
  ChartPie,
  TrendUp,
  TrendDown,
  Globe,
  ShieldCheck,
  Funnel,
  MagnifyingGlass,
  ArrowLeft,
  ArrowRight,
  Info,
  Calendar,
  CurrencyCircleDollar,
  CheckCircle,
  Eye,
  ChartLineUp,
} from '@phosphor-icons/react';

export interface Shareholder {
  name: string;
  shares_owned: number;
  ownership_percentage: number;
  update_date?: string;
  owner_type?: 'INDIVIDUAL' | 'CORPORATE';
  position?: string;
  is_major?: boolean;
  is_insider?: boolean;
}

export interface ShareholderBreakdownItem {
  id: string;
  label: string;
  percentage: number;
  volume: number;
  color: string;
}

export interface HistoricalSnapshot {
  date: string;
  majorHoldersPct: number;
  freeFloatPct: number;
  shareholderRecorded: number;
}

export interface ShareholderStructure {
  totalShares: number;
  statePercentage: number;
  stateVolume: number;
  foreignPercentage: number;
  foreignerVolume: number;
  maximumForeignPercentage: number;
  bodPercentage: number;
  institutionPercentage: number;
  otherPercentage: number;
  otherVolume: number;
  freeFloat: number;
  freeFloatPercentage: number;
  concentrationLevel: 'CÔ ĐẶC CAO' | 'CƠ CẤU CÂN BẰNG' | 'ĐA SỞ HỮU';
  breakdown: ShareholderBreakdownItem[];
  historicalSnapshots?: HistoricalSnapshot[];
}

interface ShareholderStructureViewProps {
  companyData: {
    symbol: string;
    shareholders: Shareholder[];
    shareholderStructure?: ShareholderStructure | null;
  } | null;
  livePrice?: number;
}

export const ShareholderStructureView: React.FC<ShareholderStructureViewProps> = ({
  companyData,
  livePrice = 0,
}) => {
  // Modes: 'overview' (Biểu đồ đường xu hướng tăng giảm & cơ cấu) vs 'detail' (Cơ cấu chi tiết từng cổ đông)
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'MAJOR' | 'INSIDER' | 'CORPORATE' | 'INDIVIDUAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const symbol = companyData?.symbol || 'CP';
  const rawShareholders = useMemo(() => companyData?.shareholders || [], [companyData]);
  const structure = companyData?.shareholderStructure;

  // Format shares to human-readable string (Triệu / Tỷ CP)
  const formatShares = (vol: number) => {
    if (!vol) return '0 CP';
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)} tỷ CP`;
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)} tr CP`;
    return `${vol.toLocaleString('vi-VN')} CP`;
  };

  // Format market value based on livePrice (Tỷ VNĐ)
  const formatMarketValue = (shares: number) => {
    if (!shares || !livePrice) return '--';
    const valueVnd = shares * livePrice;
    const valueBillion = valueVnd / 1_000_000_000;
    if (valueBillion >= 1_000) return `${(valueBillion / 1_000).toFixed(2)} nghìn tỷ`;
    return `${valueBillion.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  };

  // Filtered individual shareholders for detail view
  const filteredShareholders = useMemo(() => {
    let list = [...rawShareholders];

    if (filterCategory === 'MAJOR') {
      list = list.filter((s) => (s.ownership_percentage || 0) >= 5.0 || s.is_major);
    } else if (filterCategory === 'INSIDER') {
      list = list.filter((s) => s.is_insider || Boolean(s.position));
    } else if (filterCategory === 'CORPORATE') {
      list = list.filter((s) => s.owner_type === 'CORPORATE');
    } else if (filterCategory === 'INDIVIDUAL') {
      list = list.filter((s) => s.owner_type === 'INDIVIDUAL');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || (s.position && s.position.toLowerCase().includes(q)));
    }

    return list;
  }, [rawShareholders, filterCategory, searchQuery]);

  // Top 10 shareholders for bar chart comparison in detail view
  const top10Shareholders = useMemo(() => {
    return [...rawShareholders]
      .sort((a, b) => (b.ownership_percentage || 0) - (a.ownership_percentage || 0))
      .slice(0, 10);
  }, [rawShareholders]);

  // Breakdown items with safe defaults if API hasn't loaded structure yet
  const breakdownItems = useMemo(() => {
    if (structure?.breakdown && structure.breakdown.length > 0) {
      return structure.breakdown;
    }
    const majorTotal = rawShareholders.reduce((sum, s) => sum + (s.ownership_percentage || 0), 0);
    const freeFloat = Math.max(0, 100 - majorTotal);
    return [
      { id: 'major', label: 'Cổ đông lớn & Nội bộ', percentage: Number(majorTotal.toFixed(2)), volume: 0, color: '#10b981' },
      { id: 'freefloat', label: 'Cổ đông nhỏ lẻ (Trôi nổi)', percentage: Number(freeFloat.toFixed(2)), volume: 0, color: '#71717a' },
    ];
  }, [structure, rawShareholders]);

  // Calculate SVG Donut Coordinates
  const donutData = useMemo(() => {
    const total = breakdownItems.reduce((acc, curr) => acc + curr.percentage, 0);
    if (total <= 0) return [];

    let accumulatedAngle = 0;
    const radius = 80;
    const innerRadius = 54;
    const center = 100;

    return breakdownItems.map((item) => {
      const sliceAngle = (item.percentage / total) * 360;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + sliceAngle;
      accumulatedAngle += sliceAngle;

      const startRad = ((startAngle - 90) * Math.PI) / 180.0;
      const endRad = ((endAngle - 90) * Math.PI) / 180.0;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const ix1 = center + innerRadius * Math.cos(endRad);
      const iy1 = center + innerRadius * Math.sin(endRad);
      const ix2 = center + innerRadius * Math.cos(startRad);
      const iy2 = center + innerRadius * Math.sin(startRad);

      const largeArc = sliceAngle > 180 ? 1 : 0;

      const pathData = `
        M ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        L ${ix1} ${iy1}
        A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}
        Z
      `;

      return {
        ...item,
        pathData,
        startAngle,
        endAngle,
      };
    });
  }, [breakdownItems]);

  // Comprehensive Timeline Data for Line Chart (100% Real Data from Filings)
  const timelineData = useMemo(() => {
    const rawSnaps = structure?.historicalSnapshots || [];
    const currentMajor = Number((100 - (structure?.freeFloatPercentage || 50)).toFixed(2));
    const currentFreeFloat = structure?.freeFloatPercentage || Number((100 - currentMajor).toFixed(2));

    let snaps: HistoricalSnapshot[] = [];

    if (rawSnaps.length > 0) {
      snaps = [...rawSnaps];
      // If latest period is missing current real-time verified list, append it
      const last = snaps[snaps.length - 1];
      if (last && last.date !== 'Hiện Tại' && rawShareholders.length > 0) {
        // Only append if last record is older than recent
        snaps.push({
          date: 'Hiện Tại',
          majorHoldersPct: currentMajor,
          freeFloatPct: currentFreeFloat,
          shareholderRecorded: rawShareholders.length,
        });
      }
    } else if (rawShareholders.length > 0) {
      // Single real point anchored to current official list if no historical filings
      snaps = [
        {
          date: 'Hiện Tại',
          majorHoldersPct: currentMajor,
          freeFloatPct: currentFreeFloat,
          shareholderRecorded: rawShareholders.length,
        },
      ];
    }

    return snaps.map((s, idx) => {
      const prev = idx > 0 ? snaps[idx - 1] : null;
      const delta = prev ? Number((s.majorHoldersPct - prev.majorHoldersPct).toFixed(2)) : 0;
      return {
        ...s,
        delta,
        isIncrease: delta > 0,
        isDecrease: delta < 0,
      };
    });
  }, [structure, rawShareholders]);

  // SVG Line Chart Coordinate Mapping
  const chartWidth = 640;
  const chartHeight = 175;
  const paddingLeft = 45;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 35;

  const drawableWidth = chartWidth - paddingLeft - paddingRight;
  const drawableHeight = chartHeight - paddingTop - paddingBottom;

  // Chart Y-axis range (0% to 100%)
  const chartPoints = useMemo(() => {
    if (timelineData.length === 0) return [];

    return timelineData.map((d, idx) => {
      const x = paddingLeft + (idx / Math.max(1, timelineData.length - 1)) * drawableWidth;
      const y = paddingTop + drawableHeight - (d.majorHoldersPct / 100) * drawableHeight;
      return {
        ...d,
        x,
        y,
      };
    });
  }, [timelineData, drawableWidth, drawableHeight, paddingLeft, paddingTop]);

  // Smooth Bezier Curve generator for Major Shareholders
  const lineCurvePath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    if (chartPoints.length === 1) return `M ${chartPoints[0].x} ${chartPoints[0].y}`;

    let path = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    for (let i = 0; i < chartPoints.length - 1; i++) {
      const p0 = chartPoints[i];
      const p1 = chartPoints[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      path += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }
    return path;
  }, [chartPoints]);

  // Gradient area path under major holders line
  const areaPath = useMemo(() => {
    if (chartPoints.length === 0 || !lineCurvePath) return '';
    const bottomY = paddingTop + drawableHeight;
    const lastX = chartPoints[chartPoints.length - 1].x;
    const firstX = chartPoints[0].x;
    return `${lineCurvePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [chartPoints, lineCurvePath, paddingTop, drawableHeight]);

  // Active hover point
  const activePoint = hoveredPointIndex !== null ? chartPoints[hoveredPointIndex] : chartPoints[chartPoints.length - 1];

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-navigation Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2 tracking-tight">
              <ChartLineUp className="w-5 h-5 text-emerald-400" />
              <span>Biểu Đồ Xu Hướng & Cơ Cấu Cổ Đông</span>
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[11px] font-mono font-bold text-zinc-300">
              {symbol}
            </span>
            {structure?.concentrationLevel && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  structure.concentrationLevel === 'CÔ ĐẶC CAO'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : structure.concentrationLevel === 'ĐA SỞ HỮU'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {structure.concentrationLevel}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            Biểu đồ đường biến động tỷ lệ sở hữu qua các thời kỳ và chi tiết danh sách cổ đông thực tế.
          </p>
        </div>

        {/* View Mode Toggle Switcher */}
        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            onClick={() => setViewMode('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              viewMode === 'overview'
                ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ChartLineUp className="w-4 h-4" />
            <span>Biểu Đồ Xu Hướng</span>
          </button>
          <button
            onClick={() => setViewMode('detail')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              viewMode === 'detail'
                ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Chi Tiết Từng Cổ Đông ({rawShareholders.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: BIỂU ĐỒ ĐƯỜNG TĂNG GIẢM CỔ ĐÔNG & CƠ CẤU TỔNG THỂ (FIRST) */}
      {/* ========================================================================= */}
      {viewMode === 'overview' && (
        <div className="space-y-6">
          {/* Bento KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Card 1: Khối Ngoại */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all">
              <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider">Khối Ngoại</span>
                <Globe className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-mono font-bold text-emerald-400">
                {structure ? `${structure.foreignPercentage.toFixed(2)}%` : '--%'}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-1 flex items-center justify-between">
                <span>{structure ? formatShares(structure.foreignerVolume) : '--'}</span>
                {structure?.maximumForeignPercentage && (
                  <span className="text-zinc-500 text-[10px]">Max: {structure.maximumForeignPercentage}%</span>
                )}
              </div>
              {structure && structure.maximumForeignPercentage > 0 && (
                <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (structure.foreignPercentage / structure.maximumForeignPercentage) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Card 2: Nhà Nước / Ban Lãnh Đạo */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all">
              <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider">
                  {structure && structure.statePercentage > 0 ? 'Nhà Nước' : 'Ban Lãnh Đạo & HĐQT'}
                </span>
                <ShieldCheck className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-xl font-mono font-bold text-sky-400">
                {structure
                  ? structure.statePercentage > 0
                    ? `${structure.statePercentage.toFixed(2)}%`
                    : `${structure.bodPercentage.toFixed(2)}%`
                  : '--%'}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-1">
                {structure
                  ? structure.statePercentage > 0
                    ? formatShares(structure.stateVolume)
                    : formatShares(Math.round((structure.totalShares * structure.bodPercentage) / 100))
                  : '--'}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 truncate">
                {structure && structure.statePercentage > 0 ? 'Đại diện vốn sở hữu nhà nước' : 'Thành viên HĐQT & BĐH'}
              </div>
            </div>

            {/* Card 3: Free Float / Cổ Đông Nhỏ Lẻ */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all">
              <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider">Trôi Nổi (Free-Float)</span>
                <Users className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-mono font-bold text-amber-400">
                {structure ? `${structure.freeFloatPercentage.toFixed(2)}%` : '--%'}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-1">
                {structure ? formatShares(structure.freeFloat) : '--'}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 truncate">
                Lưu hành tự do ngoài thị trường
              </div>
            </div>

            {/* Card 4: Tổng Cổ Phiếu & Giá Trị Vốn Hóa */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all">
              <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider">Tổng CP Lưu Hành</span>
                <CurrencyCircleDollar className="w-4 h-4 text-zinc-300" />
              </div>
              <div className="text-xl font-mono font-bold text-zinc-100">
                {structure ? formatShares(structure.totalShares) : '--'}
              </div>
              <div className="text-[11px] font-mono text-emerald-400 mt-1">
                {structure && livePrice > 0 ? formatMarketValue(structure.totalShares) : '--'}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 truncate">
                Vốn hóa tính theo thị giá thực
              </div>
            </div>
          </div>

          {/* 2 Main Charts Grid: LINE CHART (Đường Tăng Giảm) & Donut Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Chart 1 (Left 7 cols): BIỂU ĐỒ ĐƯỜNG BIẾN ĐỘNG TĂNG GIẢM CỔ ĐÔNG QUA CÁC KỲ */}
            <div className="lg:col-span-7 p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                    <ChartLineUp className="w-4 h-4 text-emerald-400" />
                    Biểu Đồ Xu Hướng Sở Hữu & Số Lượng Cổ Đông
                  </h3>
                  <span className="text-[11px] text-zinc-500 block">
                    Thống kê số lượng cổ đông ghi nhận và tỷ lệ nắm giữ của Cổ đông lớn qua các kỳ báo cáo thực tế
                  </span>
                </div>
                {/* Legend badges */}
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                    <span className="text-zinc-300">Tỷ lệ Cổ đông lớn & Nội bộ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500/30 border border-emerald-400 inline-block" />
                    <span className="text-zinc-400">Số lượng cổ đông ghi nhận</span>
                  </div>
                </div>
              </div>

              {/* Real SVG Interactive Line Chart */}
              <div className="relative w-full overflow-hidden pt-1">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-auto overflow-visible select-none"
                >
                  <defs>
                    {/* Emerald glowing gradient fill under curve */}
                    <linearGradient id="emeraldGradientArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="70%" stopColor="#10b981" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines & Y-axis labels */}
                  {[0, 25, 50, 75, 100].map((pct) => {
                    const y = paddingTop + drawableHeight - (pct / 100) * drawableHeight;
                    return (
                      <g key={pct}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={chartWidth - paddingRight}
                          y2={y}
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeDasharray={pct === 0 || pct === 100 ? undefined : '3 3'}
                        />
                        <text
                          x={paddingLeft - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          className="text-[9px] font-mono fill-zinc-500"
                        >
                          {pct}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Gradient Area under line */}
                  {areaPath && <path d={areaPath} fill="url(#emeraldGradientArea)" />}

                  {/* Primary Line: Major Shareholders % (Solid Emerald Line) */}
                  {lineCurvePath && (
                    <path
                      d={lineCurvePath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Hover Vertical Crosshair */}
                  {activePoint && (
                    <line
                      x1={activePoint.x}
                      y1={paddingTop}
                      x2={activePoint.x}
                      y2={paddingTop + drawableHeight}
                      stroke="rgba(16, 185, 129, 0.5)"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Interactive Nodes / Data Points */}
                  {chartPoints.map((pt, idx) => {
                    const isHovered = hoveredPointIndex === idx;
                    return (
                      <g
                        key={idx}
                        className="cursor-pointer transition-transform"
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                      >
                        {/* Invisible large touch target */}
                        <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />

                        {/* Outer Pulse Ring */}
                        {isHovered && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={9}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2"
                            opacity="0.7"
                            className="animate-ping"
                          />
                        )}

                        {/* Node circle */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 4.5}
                          fill="#09090b"
                          stroke="#10b981"
                          strokeWidth={isHovered ? 2.5 : 2}
                        />

                        {/* Total Shareholders & Delta Pill Badge above node */}
                        <g transform={`translate(${pt.x}, ${Math.max(10, pt.y - 14)})`}>
                          <rect
                            x={-28}
                            y={-10}
                            width={56}
                            height={16}
                            rx={4}
                            fill="rgba(9, 13, 22, 0.92)"
                            stroke={isHovered ? '#10b981' : 'rgba(255, 255, 255, 0.15)'}
                            strokeWidth={isHovered ? 1.2 : 0.8}
                          />
                          <text
                            x={0}
                            y={2}
                            textAnchor="middle"
                            className="text-[9px] font-mono font-bold fill-zinc-200"
                          >
                            {pt.shareholderRecorded} CĐ
                          </text>
                        </g>

                        {/* X-axis Date Text Label */}
                        <text
                          x={pt.x}
                          y={paddingTop + drawableHeight + 20}
                          textAnchor="middle"
                          className={`text-[10px] font-mono transition-colors ${
                            isHovered ? 'fill-emerald-400 font-bold' : 'fill-zinc-400'
                          }`}
                        >
                          {pt.date}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Active Milestone Telemetry Card */}
              {activePoint && (
                <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-zinc-400 text-[11px] block">Mốc báo cáo</span>
                      <span className="font-bold text-zinc-100 text-sm">Kỳ {activePoint.date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-wrap">
                    <div>
                      <span className="text-zinc-500 text-[10px] block">Tổng số cổ đông</span>
                      <span className="font-bold text-emerald-400 text-base">
                        {activePoint.shareholderRecorded} cổ đông
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 text-[10px] block">Tỷ lệ Cổ đông lớn & Nội bộ</span>
                      <span className="font-bold text-zinc-100 text-sm">
                        {activePoint.majorHoldersPct.toFixed(2)}%
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 text-[10px] block">Biến động tỷ lệ</span>
                      <span
                        className={`font-bold text-sm flex items-center gap-1 ${
                          activePoint.delta > 0
                            ? 'text-emerald-400'
                            : activePoint.delta < 0
                            ? 'text-rose-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {activePoint.delta > 0 && <TrendUp className="w-3.5 h-3.5" />}
                        {activePoint.delta < 0 && <TrendDown className="w-3.5 h-3.5" />}
                        {activePoint.delta > 0
                          ? `+${activePoint.delta.toFixed(2)}% (Tích lũy)`
                          : activePoint.delta < 0
                          ? `${activePoint.delta.toFixed(2)}% (Phân phối)`
                          : '0.00% (Ổn định)'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Informative Note */}
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-[11px] text-zinc-400 flex items-start gap-2 leading-relaxed">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Quy luật Smart Money & Tăng giảm cổ đông:</strong> Khi đường xu hướng sở hữu cổ đông lớn đi lên (tăng tỷ lệ nắm giữ), dòng tiền thông minh đang gom hàng, trôi nổi ngoài thị trường thu hẹp giúp giá cổ phiếu dễ bứt phá mạnh khi có thanh khoản kích hoạt.
                </span>
              </div>
            </div>

            {/* Chart 2 (Right 5 cols): Cơ Cấu Sở Hữu Hiện Tại (Interactive Donut Ring Chart) */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <ChartPie className="w-4 h-4 text-emerald-400" />
                  Cơ Cấu Sở Hữu Hiện Tại
                </h3>
                <span className="text-[11px] text-zinc-500 block">
                  Tỷ trọng các nhóm cổ đông theo báo cáo mới nhất
                </span>
              </div>

              {/* SVG Donut Chart */}
              <div className="flex items-center justify-center py-2 relative">
                <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
                  {donutData.map((slice) => {
                    const isHovered = hoveredSlice === slice.id;
                    return (
                      <path
                        key={slice.id}
                        d={slice.pathData}
                        fill={slice.color}
                        className="transition-all duration-200 cursor-pointer"
                        style={{
                          opacity: hoveredSlice ? (isHovered ? 1 : 0.4) : 0.9,
                          transformOrigin: 'center',
                          transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                        }}
                        onMouseEnter={() => setHoveredSlice(slice.id)}
                        onMouseLeave={() => setHoveredSlice(null)}
                      />
                    );
                  })}
                </svg>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Free Float</span>
                  <span className="text-xl font-mono font-bold text-zinc-100">
                    {structure ? `${structure.freeFloatPercentage.toFixed(1)}%` : '--'}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">Trôi nổi tự do</span>
                </div>
              </div>

              {/* Legend with Interactive Hover Details */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                {breakdownItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      hoveredSlice === item.id ? 'bg-zinc-800/80 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800/40'
                    }`}
                    onMouseEnter={() => setHoveredSlice(item.id)}
                    onMouseLeave={() => setHoveredSlice(null)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate max-w-[150px]">{item.label}</span>
                    </div>
                    <div className="text-right flex items-center gap-2 shrink-0">
                      {item.volume > 0 && (
                        <span className="text-zinc-500 text-[11px] hidden sm:inline">
                          {formatShares(item.volume)}
                        </span>
                      )}
                      <span className="font-bold text-zinc-100">{item.percentage.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Prominent CTA Button to Drill Down into Details */}
              <button
                onClick={() => setViewMode('detail')}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/80 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 font-mono font-bold text-xs transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-md"
              >
                <span>XEM CHI TIẾT DANH SÁCH TỪNG CỔ ĐÔNG ({rawShareholders.length})</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: CHI TIẾT TỪNG CỔ ĐÔNG (TOP 10 BAR CHART & BẢNG BỘ LỌC TOÀN DIỆN) */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && (
        <div className="space-y-6">
          {/* Back button & Title */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setViewMode('overview')}
              className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay Lại Biểu Đồ Xu Hướng Tổng Quan</span>
            </button>
            <span className="text-xs font-mono text-zinc-500">
              Đang hiển thị {filteredShareholders.length} / {rawShareholders.length} cổ đông ghi nhận
            </span>
          </div>

          {/* Top 10 Major Shareholders Bar Chart Comparison */}
          {top10Shareholders.length > 0 && (
            <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    So Sánh Tỷ Lệ Sở Hữu Top 10 Cổ Đông Lớn Nhất
                  </h3>
                  <span className="text-[11px] text-zinc-500 block">
                    Xếp hạng theo tỷ lệ % cổ phần nắm giữ và giá trị vốn hóa tương ứng
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {top10Shareholders.map((sh, idx) => {
                  const maxPct = top10Shareholders[0]?.ownership_percentage || 1;
                  const barWidth = Math.max(4, ((sh.ownership_percentage || 0) / maxPct) * 100);

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2 truncate max-w-[65%]">
                          <span className="w-5 text-zinc-500 font-bold text-[11px]">#{idx + 1}</span>
                          {sh.owner_type === 'CORPORATE' ? (
                            <Buildings className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          <span className="font-sans font-medium text-zinc-200 truncate">{sh.name}</span>
                          {sh.is_major && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                              ≥5%
                            </span>
                          )}
                          {sh.position && (
                            <span className="text-[10px] text-zinc-400 truncate hidden sm:inline">
                              • {sh.position}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {livePrice > 0 && (
                            <span className="text-zinc-400 text-[11px] hidden md:inline">
                              {formatMarketValue(sh.shares_owned)}
                            </span>
                          )}
                          <span className="font-bold text-emerald-400 w-16 text-right">
                            {sh.ownership_percentage ? `${sh.ownership_percentage.toFixed(2)}%` : '--'}
                          </span>
                        </div>
                      </div>

                      {/* Bar comparison indicator */}
                      <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden flex">
                        <div
                          className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter Bar & Search Input */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {/* Category Filter Tabs */}
            <div className="flex items-center flex-wrap gap-1.5">
              <button
                onClick={() => setFilterCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  filterCategory === 'ALL'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                Tất Cả ({rawShareholders.length})
              </button>
              <button
                onClick={() => setFilterCategory('MAJOR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  filterCategory === 'MAJOR'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                Cổ Đông Lớn (≥5%)
              </button>
              <button
                onClick={() => setFilterCategory('INSIDER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  filterCategory === 'INSIDER'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                Ban Lãnh Đạo & Nội Bộ
              </button>
              <button
                onClick={() => setFilterCategory('CORPORATE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  filterCategory === 'CORPORATE'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                Tổ Chức / Pháp Nhân
              </button>
              <button
                onClick={() => setFilterCategory('INDIVIDUAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  filterCategory === 'INDIVIDUAL'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                Cá Nhân
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <MagnifyingGlass className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên cổ đông..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-sans text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
          </div>

          {/* Detailed Shareholders Table */}
          {filteredShareholders.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-zinc-500">
              Không tìm thấy cổ đông phù hợp với bộ lọc đã chọn.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/30">
              <table className="w-full text-xs font-mono">
                <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4 text-center font-semibold w-12">#</th>
                    <th className="py-3 px-4 text-left font-semibold">Tên Cổ Đông</th>
                    <th className="py-3 px-4 text-left font-semibold">Chức Vụ / Quan Hệ</th>
                    <th className="py-3 px-4 text-right font-semibold">Số Lượng Cổ Phiếu</th>
                    <th className="py-3 px-4 text-right font-semibold">Tỷ Lệ Sở Hữu</th>
                    <th className="py-3 px-4 text-right font-semibold">Giá Trị Thị Trường</th>
                    <th className="py-3 px-4 text-right font-semibold">Ngày Cập Nhật</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredShareholders.map((sh, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="py-3 px-4 text-center text-zinc-500 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {sh.owner_type === 'CORPORATE' ? (
                            <Buildings className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          <span className="font-sans font-medium text-zinc-100">{sh.name}</span>
                          {sh.is_major && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                              ≥5%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 font-sans">
                        {sh.position || '--'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-zinc-100">
                        {sh.shares_owned ? sh.shares_owned.toLocaleString('vi-VN') : '--'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">
                        {sh.ownership_percentage ? `${sh.ownership_percentage.toFixed(2)}%` : '--'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-300">
                        {formatMarketValue(sh.shares_owned)}
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-500 text-[11px]">
                        {sh.update_date ? sh.update_date.split('T')[0] : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
