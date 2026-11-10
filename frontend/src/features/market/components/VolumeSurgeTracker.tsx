'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChartLineUp,
  TrendUp,
  TrendDown,
  ArrowsClockwise,
  Gauge,
  Clock,
  ShieldCheck,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from 'recharts';

import { useMarketStore } from '../store/marketStore';

interface VolumePaceData {
  success: boolean;
  symbol: string;
  activeDate: string;
  displayDate: string;
  isTodayLive: boolean;
  latestActiveTime: string;
  baselineDays: number;
  baselineDates: string[];
  metrics: {
    todayTotalVol: number;
    avgTotalVol: number;
    sma20Vol: number;
    rVol: number;
    projectedTotalVol: number;
    projectedRVol: number;
    paceDeltaPct: number;
    isAboveAvg: boolean;
    isAboveSma20: boolean;
    status: 'BURST' | 'SURGE' | 'NORMAL' | 'DRYUP';
    statusLabel: string;
    statusBadge: string;
    statusDesc: string;
    breakoutTime: string | null;
    peakSlot: { time: string; vol: number };
  };
  timeline: Array<{
    time: string;
    todayCum: number | null;
    avgCum: number;
    avgCum20?: number;
    avgCum5?: number;
    projectedCum: number | null;
    diffPct: number;
    isAbove: boolean;
    isRecorded: boolean;
  }>;
  dailyHistory: Array<{
    date: string;
    displayDate: string;
    vol: number;
    close: number;
    changePct: number;
    sma20Vol: number;
    isAboveSma20: boolean;
    isToday: boolean;
  }>;
}

interface VolumeSurgeTrackerProps {
  symbol: string;
}

const formatNumber = (num: number): string => {
  if (!num || isNaN(num)) return '0';
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(1)}K`;
  }
  return num.toLocaleString('vi-VN');
};

export const VolumeSurgeTracker: React.FC<VolumeSurgeTrackerProps> = ({ symbol }) => {
  const [data, setData] = useState<VolumePaceData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [baselineDays, setBaselineDays] = useState<number>(20); // Default to 20 sessions baseline
  const [show5dLine, setShow5dLine] = useState<boolean>(true);
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);

  // Live WebSocket Tick from MarketStore
  const liveTick = useMarketStore((state) => (symbol ? state.ticks[symbol.toUpperCase()] : null));
  const currentLiveVol = liveTick?.volume || 0;

  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!symbol) return;
      if (!isBackground) setIsLoading(true);
      try {
        const res = await fetch(
          `/api/market/volume-pace?symbol=${encodeURIComponent(symbol)}&days=${baselineDays}&liveVol=${currentLiveVol}`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setData(json);
          }
        }
      } catch (err) {
        console.error('Failed to load volume pace data:', err);
      } finally {
        if (!isBackground) setIsLoading(false);
      }
    },
    [symbol, baselineDays, currentLiveVol]
  );

  useEffect(() => {
    fetchData();
    // Auto-refresh every 15 seconds during trading hours
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Transform timeline data for recharts
  const chartData = useMemo(() => {
    if (!data || !data.timeline) return [];
    return data.timeline.map((item) => ({
      time: item.time,
      todayCumM: item.todayCum !== null ? Number((item.todayCum / 1e6).toFixed(3)) : null,
      avgCumM: Number((item.avgCum / 1e6).toFixed(3)),
      avgCum20M: Number(((item.avgCum20 ?? item.avgCum) / 1e6).toFixed(3)),
      avgCum5M: Number(((item.avgCum5 ?? item.avgCum) / 1e6).toFixed(3)),
      projectedCumM: item.projectedCum !== null ? Number((item.projectedCum / 1e6).toFixed(3)) : null,
      rawTodayCum: item.todayCum,
      rawAvgCum: item.avgCum,
      rawAvgCum20: item.avgCum20 ?? item.avgCum,
      rawAvgCum5: item.avgCum5 ?? item.avgCum,
      rawProjectedCum: item.projectedCum,
      diffPct: item.diffPct,
      isAbove: item.isAbove,
      isRecorded: item.isRecorded,
    }));
  }, [data]);

  // Transform daily history data
  const barChartData = useMemo(() => {
    if (!data || !data.dailyHistory) return [];
    return data.dailyHistory.map((item) => ({
      displayDate: item.displayDate,
      date: item.date,
      volM: Number((item.vol / 1e6).toFixed(2)),
      rawVol: item.vol,
      close: item.close,
      changePct: item.changePct,
      sma20M: Number((item.sma20Vol / 1e6).toFixed(2)),
      isAboveSma20: item.isAboveSma20,
      isToday: item.isToday,
    }));
  }, [data]);

  if (isLoading && !data) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-center space-y-4">
        <div className="w-10 h-10 mx-auto rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        <p className="text-xs font-mono text-zinc-400">
          Đang tính toán đường cong thanh khoản & đối chiếu nổ vol của {symbol}...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-center space-y-3">
        <WarningCircle className="w-8 h-8 mx-auto text-amber-400" />
        <p className="text-sm font-bold text-zinc-200">Chưa có dữ liệu nến 5 phút cho {symbol}</p>
        <p className="text-xs text-zinc-500">Mã có thể chưa có phát sinh giao dịch trong các phiên gần đây.</p>
      </div>
    );
  }

  const { metrics } = data;
  const isSurgeAbove = metrics.isAboveAvg || metrics.rVol >= 1.25;

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER TOOLBAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ChartLineUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>So Sánh Nổ Vol & Đường Cong Thanh Khoản</span>
                <span className="font-mono text-emerald-400 font-black">{data.symbol}</span>
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  metrics.status === 'BURST'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                    : metrics.status === 'SURGE'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : metrics.status === 'DRYUP'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                {metrics.statusBadge}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              Phiên giao dịch {data.displayDate} • Đối chiếu trung bình {data.baselineDays} phiên gần nhất
              {data.isTodayLive && (
                <span className="text-emerald-400 ml-2 font-bold inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  REALTIME INTRADAY
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Controls: Baseline Selection (5 vs 10 vs 20 days) & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-medium">
            <span className="text-zinc-500 text-[11px] px-2 font-sans">Đường trung bình:</span>
            {[5, 10, 20].map((d) => (
              <button
                key={d}
                onClick={() => setBaselineDays(d)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  baselineDays === d
                    ? 'bg-zinc-800 text-emerald-400 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {d} Phiên
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            title="Làm mới số liệu"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── 4 KEY BENTO METRIC CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: rVol (Relative Volume) */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 relative overflow-hidden group hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Hệ Số Nổ Vol (rVol)</span>
            <Gauge className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-mono font-black ${
                metrics.rVol >= 1.5
                  ? 'text-emerald-400'
                  : metrics.rVol >= 1.0
                  ? 'text-amber-400'
                  : 'text-zinc-300'
              }`}
            >
              {metrics.rVol}x
            </span>
            <span className="text-xs font-mono text-zinc-500">vs SMA20 Vol</span>
          </div>
          <div className="mt-2.5">
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  metrics.rVol >= 1.5 ? 'bg-emerald-400' : metrics.rVol >= 1.0 ? 'bg-amber-400' : 'bg-zinc-500'
                }`}
                style={{ width: `${Math.min(100, (metrics.rVol / 2.5) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
              {metrics.rVol >= 1.3 ? 'Vượt mạnh trung bình 20 ngày' : 'Ngang mức trung bình thông thường'}
            </span>
          </div>
        </div>

        {/* Card 2: Intraday Pace Delta vs Same Time */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 relative overflow-hidden group hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Tốc Độ Cùng Giờ</span>
            {metrics.paceDeltaPct >= 0 ? (
              <TrendUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-mono font-black ${
                metrics.paceDeltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.paceDeltaPct >= 0 ? `+${metrics.paceDeltaPct}%` : `${metrics.paceDeltaPct}%`}
            </span>
            <span className="text-xs font-mono text-zinc-500">vs TB {baselineDays}P</span>
          </div>
          <p className="text-[10px] text-zinc-400 font-mono mt-2.5">
            {metrics.isAboveAvg ? (
              <span className="text-emerald-400 font-bold">Tốc độ khớp vượt mức trung bình</span>
            ) : (
              <span className="text-zinc-500">Hấp thụ chậm hơn tốc độ bình quân</span>
            )}
          </p>
        </div>

        {/* Card 3: Projected Volume */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 relative overflow-hidden group hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Dự Phóng Cả Phiên</span>
            <Gauge className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-zinc-100">
              {formatNumber(metrics.projectedTotalVol)}
            </span>
            <span className="text-xs font-mono text-zinc-400">CP</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>Thực tế: {formatNumber(metrics.todayTotalVol)} CP</span>
            <span className="text-emerald-400 font-bold">{metrics.projectedRVol}x SMA20</span>
          </div>
        </div>

        {/* Card 4: Breakout Timing & Peak Burst */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 relative overflow-hidden group hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Thời Điểm Bứt Phá</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-mono font-black text-amber-400">
              {metrics.breakoutTime ? `${metrics.breakoutTime}` : 'Chưa Vượt'}
            </span>
            {metrics.breakoutTime && (
              <span className="text-[11px] font-mono text-emerald-400 font-bold">VƯỢT ĐƯỜNG TB</span>
            )}
          </div>
          <p className="text-[10px] text-zinc-400 font-mono mt-2.5 truncate">
            Cao điểm khớp lệnh:{' '}
            <span className="text-zinc-200 font-bold">{metrics.peakSlot?.time}</span> (
            {formatNumber(metrics.peakSlot?.vol)} CP/5P)
          </p>
        </div>
      </div>

      {/* ── MAIN INTRADAY CUMULATIVE VOLUME CURVE (ĐƯỜNG CONG THANH KHOẢN TRONG PHIÊN) ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
              <ChartLineUp className="w-5 h-5 text-emerald-400" />
              <span>Biểu Đồ Luỹ Kế Khối Lượng Trong Phiên (Intraday Volume Trajectory)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              So sánh luỹ kế thực tế đến từng phút với trung bình 20 phiên (SMA20) và 5 phiên gần nhất
            </p>
          </div>

          {/* Legend Items */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-emerald-400 rounded-full" />
              <span className="text-zinc-200 font-bold">Hôm nay (Realtime)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-400" />
              <span className="text-amber-300 font-bold">TB 20 phiên (SMA20)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dotted border-sky-400" />
              <span className="text-sky-300">TB 5 phiên</span>
            </div>
            {data.isTodayLive && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-zinc-500" />
                <span className="text-zinc-400">Dự phóng</span>
              </div>
            )}
          </div>
        </div>

        {/* Trajectory Area Chart */}
        <div className="h-[360px] sm:h-[400px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
              <defs>
                {/* Gradient for today's volume area */}
                <linearGradient id="todayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                {/* Gradient for baseline average area */}
                <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />

              <XAxis
                dataKey="time"
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                interval={4} // show tick every ~25 mins
              />

              <YAxis
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                tickFormatter={(val) => `${val}M`}
                width={50}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    const diff20 = d.rawTodayCum !== null && d.rawAvgCum20 > 0
                      ? (((d.rawTodayCum - d.rawAvgCum20) / d.rawAvgCum20) * 100).toFixed(1)
                      : null;
                    const isCrossing20 = Number(diff20) >= 0;

                    return (
                      <div className="p-3.5 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-md text-xs font-mono space-y-2 min-w-[240px]">
                        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
                          <span className="font-bold text-zinc-100 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            Khung Giờ: {d.time}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isCrossing20 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {isCrossing20 ? 'VƯỢT SMA20' : 'DƯỚI SMA20'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              Hôm nay (Realtime):
                            </span>
                            <span className="font-bold text-zinc-100">
                              {d.rawTodayCum !== null ? `${formatNumber(d.rawTodayCum)} CP` : '-- (Chưa diễn ra)'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-amber-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              TB 20 phiên (SMA20):
                            </span>
                            <span className="text-zinc-300 font-bold">{formatNumber(d.rawAvgCum20)} CP</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sky-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-sky-400" />
                              TB 5 phiên:
                            </span>
                            <span className="text-zinc-300">{formatNumber(d.rawAvgCum5)} CP</span>
                          </div>

                          {d.rawProjectedCum !== null && (
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                                Dự phóng cả ngày:
                              </span>
                              <span className="text-zinc-300">{formatNumber(d.rawProjectedCum)} CP</span>
                            </div>
                          )}

                          {diff20 !== null && (
                            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 font-bold">
                              <span className="text-zinc-400">vs TB 20 phiên:</span>
                              <span className={Number(diff20) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {Number(diff20) >= 0 ? `+${diff20}%` : `${diff20}%`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* 20-Day SMA Baseline Curve (Amber dashed) */}
              <Area
                type="monotone"
                dataKey="avgCum20M"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#avgGrad)"
                name="TB 20 phiên (SMA20)"
              />

              {/* 5-Day Average Baseline Curve (Sky/Cyan dotted) */}
              <Area
                type="monotone"
                dataKey="avgCum5M"
                stroke="#38bdf8"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                fill="none"
                name="TB 5 phiên"
              />

              {/* Projected Curve (Dự phóng cho các slot chưa diễn ra) */}
              {data.isTodayLive && (
                <Area
                  type="monotone"
                  dataKey="projectedCumM"
                  stroke="#71717a"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  fill="none"
                  name="Dự phóng"
                />
              )}

              {/* Today's Actual Curve (Hôm nay thực tế, tăng dần đến hiện tại) */}
              <Area
                type="monotone"
                dataKey="todayCumM"
                stroke="#10b981"
                strokeWidth={3}
                fill="url(#todayGrad)"
                dot={false}
                activeDot={{ r: 6, fill: '#10b981', stroke: '#09090b', strokeWidth: 2 }}
                name="Hôm nay"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Narrative & Practical Guide */}
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-xs flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-zinc-200">Đánh Giá Kỹ Thuật Nổ Vol:</span>
            <p className="text-zinc-400 leading-relaxed">
              {metrics.statusDesc}{' '}
              {metrics.breakoutTime ? (
                <span className="text-emerald-400 font-bold font-mono">
                  Đường khối lượng hôm nay đã chính thức cắt vượt lên trên đường trung bình vào lúc {metrics.breakoutTime}
                  .
                </span>
              ) : (
                <span className="text-zinc-500 font-mono">
                  Đường khối lượng hôm nay vẫn đang vận động dưới đường trung bình {baselineDays} phiên.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── 20-SESSION VOLUME COMPARISON BAR CHART (CỘT KHỐI LƯỢNG 20 PHIÊN VS SMA20) ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
              <ChartLineUp className="w-5 h-5 text-amber-400" />
              <span>Biểu Đồ So Sánh Khối Lượng 20 Phiên & Đường MA20 Vol (Volume Breakout)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Nhận diện trực quan các phiên bùng nổ vượt đường trung bình 20 ngày (SMA20: {formatNumber(metrics.sma20Vol)} CP)
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-500 rounded" />
              <span className="text-zinc-300">Vượt SMA20 (Nổ Vol)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-zinc-600 rounded" />
              <span className="text-zinc-400">Dưới SMA20</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-amber-400" />
              <span className="text-amber-300 font-bold">Đường SMA20 Vol</span>
            </div>
          </div>
        </div>

        {/* 20-Day Bar Chart */}
        <div className="h-[240px] sm:h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 20, right: 15, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />

              <XAxis
                dataKey="displayDate"
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
              />

              <YAxis
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                tickFormatter={(val) => `${val}M`}
                width={50}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    const rVolDay = (d.rawVol / (metrics.sma20Vol || 1)).toFixed(2);
                    return (
                      <div className="p-3 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl text-xs font-mono space-y-1.5 min-w-[200px]">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1 font-bold">
                          <span className="text-zinc-200">Phiên: {d.displayDate}</span>
                          <span className={d.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {d.changePct >= 0 ? `+${d.changePct}%` : `${d.changePct}%`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Khối lượng:</span>
                          <span className="font-bold text-zinc-100">{formatNumber(d.rawVol)} CP</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Hệ số rVol:</span>
                          <span className={Number(rVolDay) >= 1.0 ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                            {rVolDay}x SMA20
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                          <span className="text-zinc-400">Giá đóng cửa:</span>
                          <span className="font-bold text-zinc-100">{d.close.toLocaleString('vi-VN')} đ</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Reference Line for 20-Day SMA Volume */}
              <ReferenceLine
                y={Number((metrics.sma20Vol / 1e6).toFixed(2))}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `SMA20 Vol: ${formatNumber(metrics.sma20Vol)}`,
                  fill: '#f59e0b',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                  position: 'insideTopRight',
                }}
              />

              <Bar dataKey="volM" radius={[4, 4, 0, 0]}>
                {barChartData.map((entry, index) => {
                  let fillColor = '#3f3f46'; // default zinc
                  if (entry.isToday) {
                    fillColor = entry.isAboveSma20 ? '#10b981' : '#f59e0b';
                  } else if (entry.isAboveSma20) {
                    fillColor = '#10b981';
                  }
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={fillColor}
                      stroke={entry.isToday ? '#ffffff' : 'none'}
                      strokeWidth={entry.isToday ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
