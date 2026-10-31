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
  Legend,
  CartesianGrid,
} from 'recharts';
import { SessionSectorFlow } from './SectorMoneyFlowTable';
import { ChartLineUp, ChartBar } from '@phosphor-icons/react';

interface SectorFlowChartProps {
  data: SessionSectorFlow[];
}

export function SectorFlowChart({ data }: SectorFlowChartProps) {
  const [chartMode, setChartMode] = useState<'ratio' | 'value'>('ratio');

  // Chart data needs chronological order (oldest -> newest, left -> right)
  const chartData = [...data]
    .reverse()
    .map((item) => ({
      date: item.displayDate || item.date.slice(5),
      fullDate: item.date,
      totalMarket: item.totalMarket,
      'Ngân hàng': chartMode === 'ratio' ? item.nh?.ratioPct : item.nh?.total,
      'Chứng khoán': chartMode === 'ratio' ? item.ck?.ratioPct : item.ck?.total,
      'Bất động sản': chartMode === 'ratio' ? item.bds?.ratioPct : item.bds?.total,
      'Thép': chartMode === 'ratio' ? item.thep?.ratioPct : item.thep?.total,
      'Họ Vin': chartMode === 'ratio' ? item.vin?.ratioPct : item.vin?.total,
    }));

  const colors = {
    'Ngân hàng': '#3b82f6', // Blue
    'Chứng khoán': '#f59e0b', // Amber
    'Bất động sản': '#10b981', // Emerald
    'Thép': '#06b6d4', // Cyan
    'Họ Vin': '#f43f5e', // Rose
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = chartData.find((d) => d.date === label);

    return (
      <div className="p-3 bg-zinc-900/95 border border-zinc-700/80 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono space-y-2 min-w-[200px]">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-sans">
          <span className="font-semibold text-zinc-200">Phiên: {item?.fullDate || label}</span>
          <span className="text-[11px] text-emerald-400">
            Tổng: {item?.totalMarket?.toLocaleString('vi-VN')} Tỷ
          </span>
        </div>

        <div className="space-y-1">
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-zinc-300 font-sans">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-bold text-zinc-100">
                {entry.value?.toLocaleString('vi-VN')}
                {chartMode === 'ratio' ? '%' : ' Tỷ'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-xl space-y-4">
      {/* Chart Title & Toggle Mode */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <ChartLineUp className="w-4 h-4 text-emerald-400" />
            Biểu Đồ Luân Chuyển Dòng Tiền Ngành
          </h3>
          <p className="text-xs text-zinc-400">
            Quan sát sự dịch chuyển tỷ trọng thanh khoản giữa các nhóm dẫn dắt thị trường
          </p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium">
          <button
            onClick={() => setChartMode('ratio')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              chartMode === 'ratio'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ChartLineUp className="w-3.5 h-3.5" />
            <span>Tỉ Lệ % Dòng Tiền</span>
          </button>
          <button
            onClick={() => setChartMode('value')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              chartMode === 'value'
                ? 'bg-zinc-800 text-blue-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ChartBar className="w-3.5 h-3.5" />
            <span>Giá Trị Khớp Lệnh (Tỷ VNĐ)</span>
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'ratio' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {Object.entries(colors).map(([key, color]) => (
                  <linearGradient key={key} id={`grad_${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.0} />
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
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
              />
              <Area
                type="monotone"
                dataKey="Ngân hàng"
                stroke={colors['Ngân hàng']}
                fill={`url(#grad_Ngân hàng)`}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Chứng khoán"
                stroke={colors['Chứng khoán']}
                fill={`url(#grad_Chứng khoán)`}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Bất động sản"
                stroke={colors['Bất động sản']}
                fill={`url(#grad_Bất động sản)`}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Thép"
                stroke={colors['Thép']}
                fill={`url(#grad_Thép)`}
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="Họ Vin"
                stroke={colors['Họ Vin']}
                fill={`url(#grad_Họ Vin)`}
                strokeWidth={1.5}
              />
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
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="Ngân hàng"
                stroke={colors['Ngân hàng']}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Chứng khoán"
                stroke={colors['Chứng khoán']}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Bất động sản"
                stroke={colors['Bất động sản']}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Thép"
                stroke={colors['Thép']}
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Họ Vin"
                stroke={colors['Họ Vin']}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
