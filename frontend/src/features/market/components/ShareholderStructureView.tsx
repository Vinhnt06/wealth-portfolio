'use client';

import React, { useState, useMemo } from 'react';
import {
  MagnifyingGlass,
  TrendUp,
  TrendDown,
  Info,
  CheckCircle,
  Sparkle,
} from '@phosphor-icons/react';
import { AgmIngestionModal } from './AgmIngestionModal';

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

export interface TotalShareholdersSnapshot {
  year: string;
  period: string;
  totalShareholders: number;
  changeFromPrev: number;
  changePercent: number;
  recordDate?: string;
  sourceDoc?: string;
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
  totalShareholdersHistory?: TotalShareholdersSnapshot[];
  totalShareholdersCurrent?: number;
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
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'MAJOR' | 'INSIDER' | 'CORPORATE' | 'INDIVIDUAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [isAgmModalOpen, setIsAgmModalOpen] = useState(false);

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

  // Timeline Data for Total Shareholders (100% Real Data from ĐHĐCĐ & VSDC, empty if unverified)
  const timelineData = useMemo(() => {
    const rawTotalHistory = structure?.totalShareholdersHistory || [];

    if (rawTotalHistory.length > 0) {
      return rawTotalHistory.map((d, idx) => {
        const prev = idx > 0 ? rawTotalHistory[idx - 1] : null;
        const changeFromPrev = prev ? d.totalShareholders - prev.totalShareholders : (d.changeFromPrev || 0);
        const changePercent = prev && prev.totalShareholders > 0
          ? Number(((changeFromPrev / prev.totalShareholders) * 100).toFixed(2))
          : (d.changePercent || 0);

        return {
          year: d.year,
          period: d.period || `ĐHĐCĐ ${d.year}`,
          totalShareholders: d.totalShareholders,
          changeFromPrev,
          changePercent,
          isIncrease: changeFromPrev > 0,
          isDecrease: changeFromPrev < 0,
          recordDate: d.recordDate,
          sourceDoc: d.sourceDoc,
        };
      });
    }

    return [];
  }, [structure?.totalShareholdersHistory]);

  // SVG Line Chart Coordinate Mapping for Total Shareholders
  const chartWidth = 640;
  const chartHeight = 180;
  const paddingLeft = 58;
  const paddingRight = 32;
  const paddingTop = 25;
  const paddingBottom = 35;

  const drawableWidth = chartWidth - paddingLeft - paddingRight;
  const drawableHeight = chartHeight - paddingTop - paddingBottom;

  // Calculate dynamic maxHolders and nice round Y-axis ticks
  const { maxVal, yTicks } = useMemo(() => {
    if (timelineData.length === 0) return { maxVal: 100000, yTicks: [0, 25000, 50000, 75000, 100000] };

    const rawMax = Math.max(...timelineData.map((d) => d.totalShareholders));
    let step = 10000;
    if (rawMax > 200000) step = 50000;
    else if (rawMax > 100000) step = 25000;
    else if (rawMax > 50000) step = 10000;
    else if (rawMax > 20000) step = 5000;
    else step = 1000;

    const ceiling = Math.ceil((rawMax * 1.12) / step) * step;
    const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((ceiling / 4) * i));

    return { maxVal: Math.max(1, ceiling), yTicks: ticks };
  }, [timelineData]);

  // Format Y-axis tick values (e.g. 50K, 150K, 300K)
  const formatYTick = (val: number) => {
    if (val === 0) return '0';
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
    return val.toString();
  };

  // Chart points mapped to (x, y)
  const chartPoints = useMemo(() => {
    if (timelineData.length === 0) return [];

    return timelineData.map((d, idx) => {
      const x = paddingLeft + (idx / Math.max(1, timelineData.length - 1)) * drawableWidth;
      const y = paddingTop + drawableHeight - (d.totalShareholders / maxVal) * drawableHeight;
      return {
        ...d,
        x,
        y,
      };
    });
  }, [timelineData, maxVal, drawableWidth, drawableHeight, paddingLeft, paddingTop]);

  // Smooth Bezier Curve generator for Total Shareholders
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

  // Gradient area path under total shareholders line
  const areaPath = useMemo(() => {
    if (chartPoints.length === 0 || !lineCurvePath) return '';
    const bottomY = paddingTop + drawableHeight;
    const lastX = chartPoints[chartPoints.length - 1].x;
    const firstX = chartPoints[0].x;
    return `${lineCurvePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [chartPoints, lineCurvePath, paddingTop, drawableHeight]);

  // Active hover point
  const activePoint = hoveredPointIndex !== null ? chartPoints[hoveredPointIndex] : chartPoints[chartPoints.length - 1];

  // Filtered individual shareholders for detail table
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

  // Top 10 shareholders for bar chart comparison (sorted descending)
  const top10Shareholders = useMemo(() => {
    return [...rawShareholders]
      .sort((a, b) => (b.ownership_percentage || 0) - (a.ownership_percentage || 0))
      .slice(0, 10);
  }, [rawShareholders]);

  // Breakdown items with verified data from exchange API
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

  const latestShareholderSnapshot = timelineData.length > 0 ? timelineData[timelineData.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-bold text-zinc-100 tracking-tight">
              Biểu Đồ Xu Hướng & Cơ Cấu Cổ Đông
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              <span>Dữ liệu thực tế từ Biên bản ĐHĐCĐ & BCTC</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Biểu đồ biến động số lượng cổ đông theo từng năm (ĐHĐCĐ) và chi tiết danh sách cổ đông công bố.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] font-mono text-zinc-400 block">
              Ghi nhận <span className="text-zinc-200 font-bold">{rawShareholders.length}</span> cổ đông nắm giữ
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {structure ? `${(100 - structure.freeFloatPercentage).toFixed(2)}% nắm giữ trực tiếp` : ''}
            </span>
          </div>

          <button
            onClick={() => setIsAgmModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-emerald-500 hover:text-zinc-950 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold transition-all shadow-sm cursor-pointer"
          >
            Bóc Tách ĐHĐCĐ
          </button>
        </div>
      </div>

      {/* 4 Summary Cards (Bento 2.0 Row) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Khối Ngoại (Foreign) */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-[11px] font-mono font-medium uppercase tracking-wider">Khối Ngoại</span>
            <span className="text-[10px] font-mono text-zinc-500">
              {structure && structure.maximumForeignPercentage > 0
                ? `Max ${structure.maximumForeignPercentage.toFixed(1)}%`
                : ''}
            </span>
          </div>
          <div className="text-xl font-mono font-bold text-emerald-400">
            {structure ? `${structure.foreignPercentage.toFixed(2)}%` : '--%'}
          </div>
          <div className="text-[11px] font-mono text-zinc-400 mt-1">
            {structure && structure.foreignerVolume > 0 ? (
              formatShares(structure.foreignerVolume)
            ) : structure ? (
              formatShares(Math.round((structure.totalShares * structure.foreignPercentage) / 100))
            ) : (
              '--'
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

        {/* Card 3: Free Float / Trôi Nổi */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-[11px] font-mono font-medium uppercase tracking-wider">Trôi Nổi (Free-Float)</span>
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

        {/* Card 4: Tổng Số Cổ Đông (ĐHĐCĐ) hoặc Cổ Phiếu Lưu Hành */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-[11px] font-mono font-medium uppercase tracking-wider">
              {latestShareholderSnapshot ? 'Tổng Số Cổ Đông' : 'Cổ Phiếu Lưu Hành'}
            </span>
          </div>
          <div className="text-xl font-mono font-bold text-zinc-100">
            {latestShareholderSnapshot ? (
              `${latestShareholderSnapshot.totalShareholders.toLocaleString('vi-VN')} CĐ`
            ) : structure?.totalShares ? (
              formatShares(structure.totalShares)
            ) : (
              'Chưa có dữ liệu'
            )}
          </div>
          <div className="text-[11px] font-mono text-emerald-400 mt-1 flex items-center justify-between">
            {latestShareholderSnapshot ? (
              <>
                <span>{latestShareholderSnapshot.period}</span>
                {latestShareholderSnapshot.changePercent !== 0 && (
                  <span className={latestShareholderSnapshot.changeFromPrev >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {latestShareholderSnapshot.changeFromPrev >= 0 ? '+' : ''}{latestShareholderSnapshot.changePercent.toFixed(1)}%
                  </span>
                )}
              </>
            ) : (
              <span>Vốn ĐL: ~{structure?.totalShares ? `${((structure.totalShares * 10) / 1e9).toFixed(1)}k tỷ` : '--'}</span>
            )}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1 truncate">
            {latestShareholderSnapshot ? 'Chốt tại kỳ ĐHĐCĐ & VSDC' : 'Chưa có biên bản ĐHĐCĐ chốt số'}
          </div>
        </div>
      </div>

      {/* 2 Main Visual Panels Grid (Left 7 cols: Historical Shareholder Count Line Chart | Right 5 cols: Donut Chart Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (7 cols): BIỂU ĐỒ BIẾN ĐỘNG SỐ LƯỢNG CỔ ĐÔNG QUA CÁC NĂM */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-zinc-200">
                Biến Động Số Lượng Cổ Đông Theo Từng Năm
              </h3>
              <span className="text-[11px] text-zinc-500 block">
                Số liệu thực tế trích xuất từ Biên bản kiểm tra tư cách cổ đông ĐHĐCĐ & VSDC
              </span>
            </div>
            {timelineData.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                  <span className="text-zinc-300">Tổng cổ đông (Nhà đầu tư)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500/30 border border-emerald-400 inline-block" />
                  <span className="text-zinc-400">Kỳ ĐHĐCĐ</span>
                </div>
              </div>
            )}
          </div>

          {/* Conditional Line Chart Rendering: "Cái nào có thì vẽ, cái nào không có thì ghi là chưa có" */}
          {timelineData.length === 0 ? (
            <div className="py-14 px-6 flex flex-col items-center justify-center text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800/80 space-y-3">
              <Info className="w-8 h-8 text-zinc-500" />
              <div className="space-y-1">
                <div className="text-zinc-300 text-xs font-mono font-semibold">
                  Chưa có dữ liệu chuỗi lịch sử ĐHĐCĐ cho mã {symbol}
                </div>
                <p className="text-zinc-500 text-[11px] max-w-md leading-relaxed">
                  Tổng số lượng cổ đông toàn công ty chỉ được VSDC chốt tại các kỳ họp ĐHĐCĐ thường niên. Dữ liệu biên bản ĐHĐCĐ của mã này chưa được ghi nhận trong kho lưu trữ đã kiểm chứng.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative w-full overflow-hidden pt-1">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-auto overflow-visible select-none"
                >
                  <defs>
                    <linearGradient id="emeraldGradientArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="70%" stopColor="#10b981" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines & Y-axis labels */}
                  {yTicks.map((val) => {
                    const y = paddingTop + drawableHeight - (val / maxVal) * drawableHeight;
                    return (
                      <g key={val}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={chartWidth - paddingRight}
                          y2={y}
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeDasharray={val === 0 ? undefined : '3 3'}
                        />
                        <text
                          x={paddingLeft - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          className="text-[9px] font-mono fill-zinc-500"
                        >
                          {formatYTick(val)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Gradient Area under curve */}
                  {areaPath && <path d={areaPath} fill="url(#emeraldGradientArea)" />}

                  {/* Primary Line: Total Shareholders (Solid Emerald Line) */}
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
                        <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />

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

                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 4.5}
                          fill="#09090b"
                          stroke="#10b981"
                          strokeWidth={isHovered ? 2.5 : 2}
                        />

                        {/* Total Shareholders Pill Badge above node */}
                        <g transform={`translate(${pt.x}, ${Math.max(12, pt.y - 14)})`}>
                          <rect
                            x={-34}
                            y={-10}
                            width={68}
                            height={17}
                            rx={4}
                            fill="rgba(9, 13, 22, 0.94)"
                            stroke={isHovered ? '#10b981' : 'rgba(255, 255, 255, 0.18)'}
                            strokeWidth={isHovered ? 1.2 : 0.8}
                          />
                          <text
                            x={0}
                            y={2.5}
                            textAnchor="middle"
                            className="text-[9px] font-mono font-bold fill-zinc-200"
                          >
                            {pt.totalShareholders.toLocaleString('vi-VN')} CĐ
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
                          {pt.period}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Active Milestone Telemetry Card */}
              {activePoint && (
                <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div>
                    <span className="text-zinc-400 text-[11px] block">Mốc báo cáo</span>
                    <span className="font-bold text-zinc-100 text-sm">{activePoint.period}</span>
                  </div>

                  <div className="flex items-center gap-5 flex-wrap">
                    <div>
                      <span className="text-zinc-500 text-[10px] block">Số lượng cổ đông</span>
                      <span className="font-bold text-emerald-400 text-base">
                        {activePoint.totalShareholders.toLocaleString('vi-VN')} nhà đầu tư
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 text-[10px] block">Biến động so với kỳ trước</span>
                      <span
                        className={`font-bold text-sm flex items-center gap-1 ${
                          activePoint.changeFromPrev > 0
                            ? 'text-emerald-400'
                            : activePoint.changeFromPrev < 0
                            ? 'text-rose-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {activePoint.changeFromPrev > 0 && <TrendUp className="w-3.5 h-3.5" />}
                        {activePoint.changeFromPrev < 0 && <TrendDown className="w-3.5 h-3.5" />}
                        {activePoint.changeFromPrev > 0
                          ? `+${activePoint.changeFromPrev.toLocaleString('vi-VN')} CĐ (+${activePoint.changePercent.toFixed(1)}%)`
                          : activePoint.changeFromPrev < 0
                          ? `${activePoint.changeFromPrev.toLocaleString('vi-VN')} CĐ (${activePoint.changePercent.toFixed(1)}%)`
                          : 'Kỳ tham chiếu ban đầu'}
                      </span>
                    </div>
                  </div>

                  {activePoint.sourceDoc && (
                    <div className="w-full pt-2 mt-1 border-t border-zinc-800/80 flex items-center justify-between flex-wrap gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                        <span className="text-zinc-500 font-semibold uppercase tracking-wider shrink-0">Nguồn đối chứng:</span>
                        <span className="text-emerald-400/90 truncate font-sans font-medium">{activePoint.sourceDoc}</span>
                      </div>
                      {activePoint.recordDate && (
                        <span className="text-zinc-500 font-mono shrink-0">
                          Chốt sổ VSDC: <span className="text-zinc-300">{activePoint.recordDate}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right (5 cols): DONUT BREAKDOWN & FREE-FLOAT */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 space-y-4 flex flex-col justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-zinc-200">
              Cơ Cấu Sở Hữu & Tỷ Lệ Trôi Nổi
            </h3>
            <span className="text-[11px] text-zinc-500 block">
              Phân bổ giữa Nhà Nước, Khối Ngoại, Nội Bộ và Cổ đông nhỏ lẻ (Free-Float)
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

          {/* Legend with Details */}
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
        </div>
      </div>

      {/* Middle Section: TOP CỔ ĐÔNG LỚN & BAN LÃNH ĐẠO (BAR CHART) */}
      {top10Shareholders.length > 0 && (
        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-zinc-200">
                So Sánh Tỷ Lệ Sở Hữu Top Cổ Đông Lớn & Ban Lãnh Đạo
              </h3>
              <span className="text-[11px] text-zinc-500 block">
                Xếp hạng theo % cổ phần sở hữu và giá trị vốn hóa thị trường tương ứng
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
              <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">TC: Tổ chức</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">CN: Cá nhân</span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {top10Shareholders.map((sh, idx) => {
              const maxPct = top10Shareholders[0]?.ownership_percentage || 1;
              const barWidth = Math.max(4, ((sh.ownership_percentage || 0) / maxPct) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 truncate max-w-[65%]">
                      <span className="w-5 text-zinc-500 font-bold text-[11px]">#{idx + 1}</span>
                      <span
                        className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold shrink-0 ${
                          sh.owner_type === 'CORPORATE'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {sh.owner_type === 'CORPORATE' ? 'TC' : 'CN'}
                      </span>
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

      {/* Bottom Section: DANH SÁCH CHI TIẾT TỪNG CỔ ĐÔNG ĐÃ CÔNG BỐ (VỚI BỘ LỌC & TÌM KIẾM) */}
      <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-200">
              Danh Sách Toàn Bộ Cổ Đông Đã Công Bố
            </h3>
            <span className="text-[11px] text-zinc-500 block">
              Hiển thị {filteredShareholders.length} / {rawShareholders.length} cổ đông đã công bố thông tin theo luật chứng khoán
            </span>
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

        {/* Filter Category Tabs */}
        <div className="flex items-center flex-wrap gap-1.5 pt-1">
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
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold shrink-0 ${
                            sh.owner_type === 'CORPORATE'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {sh.owner_type === 'CORPORATE' ? 'TC' : 'CN'}
                        </span>
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
      {/* AI AGM Ingestion Modal */}
      <AgmIngestionModal
        isOpen={isAgmModalOpen}
        onClose={() => setIsAgmModalOpen(false)}
        currentSymbol={symbol}
        onDataSaved={() => window.location.reload()}
      />
    </div>
  );
};
