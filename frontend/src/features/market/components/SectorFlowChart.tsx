'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { SessionSectorFlow } from './SectorMoneyFlowTable';
import { ChartLineUp, ChartBar } from '@phosphor-icons/react';

export interface SectorConfig {
  key: string;
  name: string;
  color: string;
  short: string;
  getValue: (item: SessionSectorFlow, mode: 'ratio' | 'value') => number | undefined;
}

export const CORE_SECTORS: SectorConfig[] = [
  { key: 'nh', name: 'Ngân hàng', color: '#3b82f6', short: 'NH', getValue: (i, m) => (m === 'ratio' ? i.nh?.ratioPct : i.nh?.total) },
  { key: 'ck', name: 'Chứng khoán', color: '#f59e0b', short: 'CK', getValue: (i, m) => (m === 'ratio' ? i.ck?.ratioPct : i.ck?.total) },
  { key: 'bds', name: 'Bất động sản', color: '#10b981', short: 'BĐS', getValue: (i, m) => (m === 'ratio' ? i.bds?.ratioPct : i.bds?.total) },
  { key: 'thep', name: 'Thép', color: '#06b6d4', short: 'Thép', getValue: (i, m) => (m === 'ratio' ? i.thep?.ratioPct : i.thep?.total) },
  { key: 'vin', name: 'Họ Vin', color: '#f43f5e', short: 'VIN', getValue: (i, m) => (m === 'ratio' ? i.vin?.ratioPct : i.vin?.total) },
];

export const ALL_11_SECTORS: SectorConfig[] = [
  { key: 'nh', name: 'Ngân hàng', color: '#3b82f6', short: 'NH', getValue: (i, m) => (m === 'ratio' ? i.nh?.ratioPct : i.nh?.total) },
  { key: 'bds', name: 'Bất động sản', color: '#10b981', short: 'BĐS', getValue: (i, m) => (m === 'ratio' ? i.bds?.ratioPct : i.bds?.total) },
  { key: 'ck', name: 'Chứng khoán', color: '#f59e0b', short: 'CK', getValue: (i, m) => (m === 'ratio' ? i.ck?.ratioPct : i.ck?.total) },
  { key: 'thep', name: 'Thép', color: '#06b6d4', short: 'Thép', getValue: (i, m) => (m === 'ratio' ? i.thep?.ratioPct : i.thep?.total) },
  { key: 'vin', name: 'Họ Vin', color: '#f43f5e', short: 'VIN', getValue: (i, m) => (m === 'ratio' ? i.vin?.ratioPct : i.vin?.total) },
  { key: 'dau_khi', name: 'Dầu khí', color: '#14b8a6', short: 'Dầu Khí', getValue: (i, m) => (m === 'ratio' ? i.dau_khi?.ratioPct : i.dau_khi?.total) },
  { key: 'ban_le', name: 'Bán lẻ', color: '#ec4899', short: 'Bán Lẻ', getValue: (i, m) => (m === 'ratio' ? i.ban_le?.ratioPct : i.ban_le?.total) },
  { key: 'hoa_chat', name: 'Hóa chất', color: '#eab308', short: 'Hóa Chất', getValue: (i, m) => (m === 'ratio' ? i.hoa_chat?.ratioPct : i.hoa_chat?.total) },
  { key: 'thuc_pham', name: 'Thực phẩm', color: '#84cc16', short: 'Thực Phẩm', getValue: (i, m) => (m === 'ratio' ? i.thuc_pham?.ratioPct : i.thuc_pham?.total) },
  { key: 'cntt', name: 'Công nghệ', color: '#0284c7', short: 'CNTT', getValue: (i, m) => (m === 'ratio' ? i.cntt?.ratioPct : i.cntt?.total) },
  { key: 'cong_nghiep', name: 'Công nghiệp', color: '#64748b', short: 'Công Nghiệp', getValue: (i, m) => (m === 'ratio' ? i.cong_nghiep?.ratioPct : i.cong_nghiep?.total) },
];

interface SectorFlowChartProps {
  data: SessionSectorFlow[];
  variant?: 'core' | 'full';
  title?: string;
  subtitle?: string;
}

export function SectorFlowChart({
  data,
  variant = 'core',
  title,
  subtitle,
}: SectorFlowChartProps) {
  const [chartMode, setChartMode] = useState<'ratio' | 'value'>('ratio');
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const sectors = variant === 'full' ? ALL_11_SECTORS : CORE_SECTORS;

  // Chart data in chronological order (oldest -> newest, left -> right)
  const chartData = [...data]
    .reverse()
    .map((item) => {
      const row: Record<string, any> = {
        date: item.displayDate || item.date.slice(5),
        fullDate: item.date,
        totalMarket: item.totalMarket,
      };
      sectors.forEach((sec) => {
        row[sec.name] = sec.getValue(item, chartMode);
      });
      return row;
    });

  const targetSector = activeSector || hoveredSector;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = chartData.find((d) => d.date === label);

    return (
      <div className="p-3 bg-zinc-900/95 border border-zinc-700/80 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono space-y-2 min-w-[210px] z-50">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-sans">
          <span className="font-semibold text-zinc-200">Phiên: {item?.fullDate || label}</span>
          <span className="text-[11px] text-emerald-400">
            Tổng: {item?.totalMarket?.toLocaleString('vi-VN')} Tỷ
          </span>
        </div>

        <div className="space-y-1">
          {payload.map((entry: any, idx: number) => {
            const isEntryActive = targetSector === entry.name;
            return (
              <div
                key={idx}
                className={`flex items-center justify-between gap-4 px-1.5 py-0.5 rounded transition-colors ${
                  isEntryActive ? 'bg-zinc-800 font-bold text-white' : 'text-zinc-300'
                }`}
              >
                <span className="flex items-center gap-1.5 font-sans">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span>{entry.name}:</span>
                </span>
                <span className="font-bold text-zinc-100">
                  {entry.value !== undefined ? entry.value?.toLocaleString('vi-VN') : '-'}
                  {chartMode === 'ratio' ? '%' : ' Tỷ'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const defaultTitle =
    variant === 'full'
      ? 'Biểu Đồ Luân Chuyển Toàn Bộ 11 Nhóm Ngành'
      : 'Biểu Đồ Luân Chuyển Dòng Tiền Nhóm Trụ Cột';

  const defaultSubtitle =
    variant === 'full'
      ? 'Quan sát sự luân chuyển thanh khoản trên toàn bộ 11 phân ngành thị trường'
      : 'Quan sát sự dịch chuyển tỷ trọng thanh khoản giữa các nhóm dẫn dắt thị trường';

  return (
    <div className="p-5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-xl space-y-4">
      {/* Chart Title & Toggle Mode */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <ChartLineUp className="w-4 h-4 text-emerald-400" />
            <span>{title || defaultTitle}</span>
            {targetSector && (
              <span className="text-[11px] font-normal font-mono px-2 py-0.5 rounded bg-zinc-800 text-emerald-400 border border-emerald-500/30">
                Focus: {targetSector}
              </span>
            )}
          </h3>
          <p className="text-xs text-zinc-400">{subtitle || defaultSubtitle}</p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium">
          <button
            onClick={() => setChartMode('ratio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              chartMode === 'ratio'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ChartLineUp className="w-3.5 h-3.5" />
            <span>Tỉ Lệ % Dòng Tiền</span>
          </button>
          <button
            onClick={() => setChartMode('value')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              chartMode === 'value'
                ? 'bg-zinc-800 text-blue-400 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ChartBar className="w-3.5 h-3.5" />
            <span>Giá Trị Khớp Lệnh (Tỷ VNĐ)</span>
          </button>
        </div>
      </div>

      {/* ── INTERACTIVE FOCUS LEGEND ── */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-900">
        <span className="text-[11px] font-sans text-zinc-500 mr-1">Tập trung:</span>
        <button
          onClick={() => {
            setActiveSector(null);
            setHoveredSector(null);
          }}
          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
            activeSector === null
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Tất cả ({sectors.length})
        </button>

        {sectors.map((sec) => {
          const isActive = activeSector === sec.name;
          const isDimmed = activeSector !== null && !isActive;

          return (
            <button
              key={sec.key}
              onClick={() => setActiveSector(isActive ? null : sec.name)}
              onMouseEnter={() => setHoveredSector(sec.name)}
              onMouseLeave={() => setHoveredSector(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-zinc-800 text-white font-bold border shadow-lg ring-1 scale-105'
                  : isDimmed
                  ? 'opacity-35 text-zinc-500 hover:opacity-75'
                  : 'bg-zinc-900/70 text-zinc-300 border border-zinc-800/80 hover:bg-zinc-800/80 font-medium'
              }`}
              style={{
                borderColor: isActive ? sec.color : undefined,
                boxShadow: isActive ? `0 0 12px ${sec.color}40` : undefined,
              }}
              title={`Nhấp để làm nổi bật đường ${sec.name}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                style={{
                  backgroundColor: sec.color,
                  boxShadow: isActive ? `0 0 8px ${sec.color}` : undefined,
                }}
              />
              <span>{sec.name}</span>
            </button>
          );
        })}
      </div>

      {/* Chart Canvas */}
      <div className={`${variant === 'full' ? 'h-[320px]' : 'h-[280px]'} w-full min-w-0 relative`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {chartMode === 'ratio' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {sectors.map((sec) => (
                  <linearGradient key={sec.key} id={`grad_${sec.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sec.color} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={sec.color} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#3f3f46' }}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                unit="%"
                axisLine={{ stroke: '#3f3f46' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {sectors.map((sec) => {
                const isFocused = targetSector === sec.name;
                const isDimmed = targetSector !== null && !isFocused;

                const strokeWidth = isFocused ? 3.5 : isDimmed ? 1 : 1.8;
                const strokeOpacity = isDimmed ? 0.12 : 1;
                const fillOpacity = isFocused ? 0.45 : isDimmed ? 0.02 : 0.2;

                return (
                  <Area
                    key={sec.key}
                    type="monotone"
                    dataKey={sec.name}
                    stroke={sec.color}
                    fill={`url(#grad_${sec.key})`}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    fillOpacity={fillOpacity}
                    isAnimationActive={false}
                  />
                );
              })}
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#3f3f46' }}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                unit=" Tỷ"
                axisLine={{ stroke: '#3f3f46' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {sectors.map((sec) => {
                const isFocused = targetSector === sec.name;
                const isDimmed = targetSector !== null && !isFocused;

                const strokeWidth = isFocused ? 3.5 : isDimmed ? 1 : 1.8;
                const strokeOpacity = isDimmed ? 0.12 : 1;

                return (
                  <Line
                    key={sec.key}
                    type="monotone"
                    dataKey={sec.name}
                    stroke={sec.color}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    dot={false}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
