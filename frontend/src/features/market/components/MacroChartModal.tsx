'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface MacroIndicatorTarget {
  id: string;
  symbol?: string;
  name: string;
  category: 'gold_vn' | 'gold_world' | 'oil' | 'currency' | 'yield' | 'equity' | 'metal';
  price: number | string;
  unit: string;
  change?: number;
  changePercent?: number;
  buyPrice?: number;
  sellPrice?: number;
  spread?: number;
}

interface MacroChartModalProps {
  indicator: MacroIndicatorTarget | null;
  onClose: () => void;
}

interface HistoryDataResponse {
  meta: {
    id: string;
    symbol: string;
    name: string;
    unit: string;
    category: string;
    macroContext: string;
    range: string;
  };
  stats: {
    current: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    pointsCount: number;
    startTime: string;
    endTime: string;
  };
  points: Array<{
    date: string;
    timestamp: number;
    value: number;
    open?: number;
    high?: number;
    low?: number;
    close: number;
  }>;
}

const RANGES = [
  { label: '7 Ngày', value: '7d' },
  { label: '1 Tháng', value: '1mo' },
  { label: '3 Tháng', value: '3mo' },
  { label: '6 Tháng', value: '6mo' },
  { label: '1 Năm', value: '1y' },
  { label: '5 Năm', value: '5y' },
];

export const MacroChartModal: React.FC<MacroChartModalProps> = ({ indicator, onClose }) => {
  const [selectedRange, setSelectedRange] = useState<string>('1mo');
  const [loading, setLoading] = useState<boolean>(true);
  const [historyData, setHistoryData] = useState<HistoryDataResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch chart history when indicator or range changes
  useEffect(() => {
    if (!indicator) return;

    let isMounted = true;
    setLoading(true);
    setFetchError(null);

    const queryId = indicator.id || indicator.symbol || 'gold_world';

    fetch(`/api/macro/history?id=${encodeURIComponent(queryId)}&range=${selectedRange}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Lỗi tải dữ liệu (${res.status})`);
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        if (json.success) {
          setHistoryData(json);
        } else {
          setFetchError(json.error || 'Không thể tải dữ liệu lịch sử');
        }
      })
      .catch((err) => {
        if (isMounted) setFetchError(err.message || 'Lỗi mạng');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [indicator, selectedRange]);

  if (!indicator) return null;

  const isGold = indicator.category === 'gold_vn' || indicator.category === 'gold_world';
  const strokeColor = isGold ? '#f59e0b' : (historyData?.stats.change ?? 0) >= 0 ? '#10b981' : '#f43f5e';
  const fillColor = isGold ? '#d97706' : (historyData?.stats.change ?? 0) >= 0 ? '#059669' : '#e11d48';

  const formatPriceValue = (val: number) => {
    if (indicator.category === 'gold_vn') return `${val.toLocaleString('vi-VN')} Tr.đ`;
    if (indicator.unit === 'USD/oz' || indicator.unit === 'USD/thùng') return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (indicator.unit === '%') return `${val.toFixed(2)}%`;
    if (indicator.unit === 'VNĐ') return `${val.toLocaleString('vi-VN')} đ`;
    return val.toLocaleString('vi-VN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-[#0e0e11] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header ── */}
        <div className="px-6 py-5 border-b border-[#1f1f23] flex items-start justify-between bg-[#121216]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold tracking-wider uppercase border ${
                  isGold
                    ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                    : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                }`}
              >
                {indicator.category === 'gold_vn'
                  ? 'VÀNG VIỆT NAM (SJC / 9999)'
                  : indicator.category === 'gold_world'
                  ? 'VÀNG THẾ GIỚI SPOT'
                  : indicator.category === 'oil'
                  ? 'NĂNG LƯỢNG TOÀN CẦU'
                  : 'CHỈ SỐ VĨ MÔ THAM CHIẾU'}
              </span>
              <span className="text-xs text-zinc-500 font-mono">100% REAL MARKET DATA</span>
            </div>

            <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              {historyData?.meta.name || indicator.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
            title="Đóng (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Metric Snapshot & Range Bar ── */}
        <div className="px-6 py-4 bg-[#141418] border-b border-[#1f1f23] flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">Giá Hiện Tại / Tham Chiếu</div>
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className="text-3xl font-bold font-mono tracking-tight text-zinc-50">
                {historyData
                  ? formatPriceValue(historyData.stats.current)
                  : typeof indicator.price === 'number'
                  ? formatPriceValue(indicator.price)
                  : indicator.price}
              </span>
              <span className="text-xs text-zinc-400 font-mono">({indicator.unit})</span>

              {historyData && (
                <span
                  className={`text-sm font-mono font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                    historyData.stats.change >= 0
                      ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-800/50'
                      : 'text-rose-400 bg-rose-950/50 border border-rose-800/50'
                  }`}
                >
                  {historyData.stats.change >= 0 ? '▲ +' : '▼ '}
                  {Math.abs(historyData.stats.change).toLocaleString('vi-VN')} (
                  {historyData.stats.changePercent >= 0 ? '+' : ''}
                  {historyData.stats.changePercent}%)
                </span>
              )}
            </div>
          </div>

          {/* Timeframe Buttons */}
          <div className="flex items-center gap-1 bg-[#09090b] p-1 rounded-lg border border-[#27272a]">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setSelectedRange(r.value)}
                className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  selectedRange === r.value
                    ? isGold
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                      : 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Key Statistics Ribbon ── */}
        {historyData && (
          <div className="px-6 py-3 bg-[#0d0d10] border-b border-[#1f1f23] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-[#141418] border border-[#222228]">
              <span className="text-zinc-500 block text-[11px] uppercase">Đỉnh Kỳ (High)</span>
              <span className="text-sm font-bold text-zinc-200 mt-0.5 block">
                {formatPriceValue(historyData.stats.high)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#141418] border border-[#222228]">
              <span className="text-zinc-500 block text-[11px] uppercase">Đáy Kỳ (Low)</span>
              <span className="text-sm font-bold text-zinc-200 mt-0.5 block">
                {formatPriceValue(historyData.stats.low)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#141418] border border-[#222228]">
              <span className="text-zinc-500 block text-[11px] uppercase">Biên Độ (Spread/Range)</span>
              <span className="text-sm font-bold text-amber-400 mt-0.5 block">
                {(historyData.stats.high - historyData.stats.low).toFixed(2)} {indicator.unit}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#141418] border border-[#222228]">
              <span className="text-zinc-500 block text-[11px] uppercase">Số Mốc Dữ Liệu</span>
              <span className="text-sm font-bold text-zinc-300 mt-0.5 block">
                {historyData.stats.pointsCount} phiên ({historyData.stats.startTime} → {historyData.stats.endTime})
              </span>
            </div>
          </div>
        )}

        {/* ── Chart Container ── */}
        <div className="p-6 flex-1 min-h-[340px] flex flex-col justify-center relative bg-[#09090b]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400 font-mono text-sm">
              <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span>Đang tải chuỗi lịch sử thị trường...</span>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-rose-400 font-mono text-sm">
              <span className="font-bold">Không thể hiển thị biểu đồ</span>
              <span className="text-xs text-zinc-500">{fetchError}</span>
            </div>
          ) : historyData && historyData.points.length > 0 ? (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={historyData.points}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="macroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={fillColor} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={fillColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222227" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#52525b"
                    fontSize={11}
                    fontFamily="JetBrains Mono, monospace"
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    minTickGap={30}
                  />
                  <YAxis
                    stroke="#52525b"
                    fontSize={11}
                    fontFamily="JetBrains Mono, monospace"
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(v) => v.toLocaleString('vi-VN')}
                    width={65}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-3 bg-[#18181b]/95 border border-[#3f3f46] rounded-xl shadow-xl backdrop-blur-md font-mono text-xs space-y-1">
                            <div className="text-zinc-400 font-semibold">{data.date}</div>
                            <div className="text-base font-bold text-zinc-100">
                              {formatPriceValue(data.value)} {indicator.unit}
                            </div>
                            {data.open && (
                              <div className="text-[11px] text-zinc-400">
                                Mở: {data.open} | Cao: {data.high} | Thấp: {data.low}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={strokeColor}
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#macroGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>

        {/* ── Macro Context & Footer ── */}
        <div className="px-6 py-4 bg-[#101014] border-t border-[#1f1f23] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-zinc-300 font-mono">Ý NGHĨA KINH TẾ & TÁC ĐỘNG VĨ MÔ:</span>
            <p className="text-zinc-400 leading-relaxed text-[12px]">
              {historyData?.meta.macroContext ||
                'Biến động chỉ số ảnh hưởng trực tiếp đến dòng tiền, lạm phát và khẩu vị rủi ro thị trường tài chính Việt Nam.'}
            </p>
          </div>

          <div className="text-right shrink-0 font-mono text-[11px] text-zinc-500">
            Nguồn: Yahoo Finance & 24HMoney
          </div>
        </div>
      </div>
    </div>
  );
};
