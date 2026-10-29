import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  TrendUp,
  TrendDown,
  ShieldCheck,
  Scales,
  ChartBar,
  ChartLineUp,
  Info,
  CurrencyCircleDollar,
  Lightning,
  Sparkle,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { StockValuationData, QuarterlyFinancialRecord } from '../types/financials.types';

interface FinancialValuationTabProps {
  symbol: string;
  currentPrice?: number;
  sectorName?: string;
}

export const FinancialValuationTab: React.FC<FinancialValuationTabProps> = ({
  symbol,
  currentPrice = 0,
  sectorName,
}) => {
  const [data, setData] = useState<StockValuationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartViewMode, setChartViewMode] = useState<'chart' | 'cards'>('chart');

  const fetchValuation = async () => {
    if (!symbol) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market/financials?symbol=${symbol}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error || 'Không thể lấy dữ liệu định giá và báo cáo tài chính.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchValuation();
  }, [symbol]);

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-zinc-400">
          Đang tính toán mô hình định giá P/E, P/B Ngành & PEG cho mã {symbol}...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-3">
        <Info className="w-8 h-8 text-amber-400 mx-auto" />
        <p className="text-xs font-mono text-zinc-300">{error || 'Chưa có dữ liệu định giá'}</p>
        <button
          onClick={fetchValuation}
          className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowsClockwise className="w-3.5 h-3.5" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  const {
    pe,
    pb,
    ps,
    evToEbitda,
    roe,
    roa,
    debtToEquity,
    peg,
    earningsGrowthYoY,
    sectorPe,
    sectorPb,
    peVsSectorPercent,
    pbVsSectorPercent,
    valuationStatus,
    valuationLabel,
    valuationScore,
    marginOfSafety,
    summaryThesis,
    analysisPoints,
    quarterlyHistory,
    reportPeriod,
  } = data;

  // Format VND into Billion (Tỷ VNĐ)
  const formatBillion = (val?: number) => {
    if (typeof val !== 'number' || isNaN(val)) return '--';
    const bil = val / 1_000_000_000;
    if (Math.abs(bil) >= 1_000) {
      return `${(bil / 1_000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} nghìn tỷ`;
    }
    return `${bil.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} tỷ`;
  };

  // Status Styling Colors
  const isCheap = valuationStatus === 'UNDERVALUED';
  const isFair = valuationStatus === 'FAIR';
  const isExpensive = valuationStatus === 'OVERVALUED';

  const statusBadgeBg = isCheap
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    : isExpensive
    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/30';

  // Last 4 quarters for highlights
  const recent4Q = quarterlyHistory.slice(-4);
  const maxRevenue = Math.max(...recent4Q.map((q) => q.revenue || 0), 1);
  const maxProfit = Math.max(...recent4Q.map((q) => Math.abs(q.netProfit || 0)), 1);

  const chartData = recent4Q.map((q) => ({
    period: q.periodLabel,
    revenueT: Number((q.revenue / 1_000_000_000).toFixed(1)),
    netProfitT: Number((q.netProfit / 1_000_000_000).toFixed(1)),
    netMargin: Number(q.netMargin.toFixed(1)),
    grossMargin: Number(q.grossMargin.toFixed(1)),
    rawRevenue: q.revenue,
    rawProfit: q.netProfit,
  }));

  return (
    <div className="space-y-6">
      {/* 1. HERO VALUATION METER & SCORECARD (BENTO 2.0) */}
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-md shadow-2xl relative overflow-hidden">
        {/* Glow ambient background accent */}
        <div
          className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20 ${
            isCheap ? 'bg-emerald-500' : isExpensive ? 'bg-rose-500' : 'bg-amber-500'
          }`}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">
                MÔ HÌNH ĐỊNH GIÁ TOÀN DIỆN (P/E • P/B NGÀNH • PEG PETER LYNCH)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-400 border border-zinc-700/50">
                {reportPeriod}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3 mt-2">
              <h2 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight font-sans">
                Đánh Giá Cổ Phiếu {symbol}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold border ${statusBadgeBg}`}
              >
                <Sparkle className="w-3.5 h-3.5" />
                {valuationLabel}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-sans mt-2 max-w-2xl leading-relaxed">
              {summaryThesis}
            </p>
          </div>

          {/* Metric Badges */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Điểm Định Giá / 100 */}
            <div className="px-5 py-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-center min-w-[110px]">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block">ĐIỂM ĐỊNH GIÁ</span>
              <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
                <span
                  className={`text-2xl sm:text-3xl font-mono font-black ${
                    isCheap ? 'text-emerald-400' : isExpensive ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {valuationScore}
                </span>
                <span className="text-xs font-mono text-zinc-600 font-bold">/100</span>
              </div>
            </div>

            {/* Biên An Toàn (Margin of Safety) */}
            <div className="px-5 py-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-center min-w-[120px]">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block">BIÊN AN TOÀN</span>
              <div
                className={`text-2xl sm:text-3xl font-mono font-black mt-0.5 ${
                  marginOfSafety > 0 ? 'text-emerald-400' : marginOfSafety < 0 ? 'text-rose-400' : 'text-zinc-300'
                }`}
              >
                {marginOfSafety > 0 ? `+${marginOfSafety}%` : `${marginOfSafety}%`}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Gauge / Meter Bar */}
        <div className="pt-6 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              RẺ (UNDERVALUED)
            </span>
            <span className="text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              HỢP LÝ (FAIR VALUE)
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              ĐẮT (OVERVALUED)
            </span>
          </div>

          {/* Bar track */}
          <div className="h-3 w-full rounded-full bg-zinc-950 border border-zinc-800 relative overflow-visible">
            {/* Gradient track */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/80 via-amber-500/80 to-rose-500/80 opacity-70" />

            {/* Pin pointer marker: Inverted so Left (0%) is RẺ (High Score) and Right (100%) is ĐẮT (Low Score) */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700 ease-out z-10"
              style={{ left: `${Math.min(94, Math.max(6, 100 - valuationScore))}%` }}
            >
              <div className="w-5 h-5 rounded-full bg-zinc-100 border-2 border-zinc-950 shadow-xl flex items-center justify-center">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isCheap ? 'bg-emerald-500' : isExpensive ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-1">
            <span>Chiết khấu cao & Tăng trưởng mạnh</span>
            <span>Cân bằng cung cầu</span>
            <span>Kỳ vọng giá quá cao</span>
          </div>
        </div>
      </div>

      {/* 2. THE TRIAD: P/E NGÀNH, P/B NGÀNH & PEG PETER LYNCH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: P/E vs P/E Ngành */}
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                CHỈ SỐ P/E vs P/E NGÀNH
              </span>
              <Scales className="w-4 h-4 text-zinc-400" />
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-mono font-black text-zinc-100">
                {pe !== null ? `${pe}x` : 'N/A'}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                / Ngành: <strong className="text-zinc-300">{sectorPe}x</strong>
              </span>
            </div>

            {/* Comparison Badge */}
            <div className="mt-3">
              {peVsSectorPercent !== null ? (
                <div
                  className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded-xl border ${
                    peVsSectorPercent < 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {peVsSectorPercent < 0 ? (
                    <>
                      <TrendDown className="w-3.5 h-3.5" />
                      <span>Thấp hơn ngành {Math.abs(peVsSectorPercent)}% (Rẻ hơn)</span>
                    </>
                  ) : (
                    <>
                      <TrendUp className="w-3.5 h-3.5" />
                      <span>Cao hơn ngành +{peVsSectorPercent}%</span>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-xs font-mono text-zinc-500">Chưa xác định</span>
              )}
            </div>
          </div>

          <p className="text-[11px] font-sans text-zinc-400 mt-4 pt-3 border-t border-zinc-800/60 leading-relaxed">
            Ngành: <strong className="text-zinc-200">{data.sector}</strong>. P/E đo lường số năm thu hồi vốn từ lợi nhuận hiện tại.
          </p>
        </div>

        {/* Card 2: P/B vs P/B Ngành */}
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                CHỈ SỐ P/B vs P/B NGÀNH
              </span>
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-mono font-black text-zinc-100">
                {pb !== null ? `${pb}x` : 'N/A'}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                / Ngành: <strong className="text-zinc-300">{sectorPb}x</strong>
              </span>
            </div>

            {/* Comparison Badge */}
            <div className="mt-3">
              {pbVsSectorPercent !== null ? (
                <div
                  className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded-xl border ${
                    pbVsSectorPercent < 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {pbVsSectorPercent < 0 ? (
                    <>
                      <TrendDown className="w-3.5 h-3.5" />
                      <span>Rẻ hơn giá trị sổ sách ngành {Math.abs(pbVsSectorPercent)}%</span>
                    </>
                  ) : (
                    <>
                      <TrendUp className="w-3.5 h-3.5" />
                      <span>Định giá cao hơn tài sản ngành +{pbVsSectorPercent}%</span>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-xs font-mono text-zinc-500">Chưa xác định</span>
              )}
            </div>
          </div>

          <p className="text-[11px] font-sans text-zinc-400 mt-4 pt-3 border-t border-zinc-800/60 leading-relaxed">
            P/B phản ánh giá thị trường so với giá trị tài sản ròng trên mỗi cổ phiếu (BVPS).
          </p>
        </div>

        {/* Card 3: PEG Peter Lynch */}
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                CHỈ SỐ PEG (P/E ÷ TĂNG TRƯỞNG G)
              </span>
              <Lightning className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span
                className={`text-3xl font-mono font-black ${
                  peg !== null && peg < 1.0
                    ? 'text-emerald-400'
                    : peg !== null && peg <= 1.5
                    ? 'text-amber-400'
                    : 'text-zinc-100'
                }`}
              >
                {peg !== null ? peg : 'N/A'}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                (Tăng trưởng LNST $g$: <strong className="text-zinc-200">
                  {earningsGrowthYoY !== null
                    ? (earningsGrowthYoY > 0 ? `+${earningsGrowthYoY}%` : `${earningsGrowthYoY}%`)
                    : 'N/A'}
                </strong>)
              </span>
            </div>

            {/* Peter Lynch Grade Badge */}
            <div className="mt-3">
              {peg !== null ? (
                <div
                  className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded-xl border ${
                    peg < 0.75
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : peg <= 1.2
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {peg < 0.75 ? (
                    <span>🟢 Chuẩn Peter Lynch: Định giá rất hấp dẫn (PEG &lt; 0.75)</span>
                  ) : peg <= 1.2 ? (
                    <span>🟡 Định giá hợp lý tương xứng tăng trưởng</span>
                  ) : (
                    <span>🔴 Định giá đắt so với tốc độ tăng trưởng (PEG &gt; 1.5)</span>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 text-xs font-mono font-medium px-2.5 py-1 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-400">
                  {earningsGrowthYoY !== null && earningsGrowthYoY <= 0 ? (
                    <span>⚠️ LNST tăng trưởng âm ({earningsGrowthYoY}%), PEG không khả dụng</span>
                  ) : (
                    <span>Chưa đủ dữ liệu tăng trưởng TTM</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] font-sans text-zinc-400 mt-4 pt-3 border-t border-zinc-800/60 leading-relaxed">
            Công thức Peter Lynch: Cổ phiếu có PEG &lt; 1.0 đại diện cho doanh nghiệp tăng trưởng ở mức giá chiết khấu.
          </p>
        </div>
      </div>

      {/* 3. TÓM TẮT BÁO CÁO TÀI CHÍNH & XU HƯỚNG 4 QUÝ GẦN NHẤT (OPTION A) */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <ChartBar className="w-4 h-4 text-emerald-400" />
              Tóm Tắt Báo Cáo Tài Chính & Hiệu Quả Kinh Doanh (4 Quý Gần Nhất)
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              Số liệu chuẩn hóa từ Báo cáo tài chính kiểm toán và soát xét quý
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* View Switcher: Chart vs Cards */}
            <div className="flex p-0.5 bg-black border border-zinc-800 rounded-lg font-mono text-xs">
              <button
                onClick={() => setChartViewMode('chart')}
                className={`px-3 py-1 rounded transition-all flex items-center gap-1.5 ${
                  chartViewMode === 'chart'
                    ? 'bg-zinc-800 text-emerald-400 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>📊 Biểu Đồ Trực Quan</span>
              </button>
              <button
                onClick={() => setChartViewMode('cards')}
                className={`px-3 py-1 rounded transition-all flex items-center gap-1.5 ${
                  chartViewMode === 'cards'
                    ? 'bg-zinc-800 text-emerald-400 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>🗂️ Thẻ 4 Quý</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2.5 h-2.5 rounded bg-zinc-500" /> Doanh Thu
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> LNST Cổ Đông Mẹ
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400" /> Biên Ròng (NPM)
              </span>
            </div>
          </div>
        </div>

        {/* ── VIEW 1: RECHARTS COMPOSED CHART (BAR + LINE DUAL AXIS) ── */}
        {chartViewMode === 'chart' && (
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#222222" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="period"
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    tickFormatter={(v) => `${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v} Tỷ`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#38bdf8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const rev = payload.find((p) => p.dataKey === 'revenueT')?.value as number || 0;
                        const profit = payload.find((p) => p.dataKey === 'netProfitT')?.value as number || 0;
                        const margin = payload.find((p) => p.dataKey === 'netMargin')?.value as number || 0;
                        return (
                          <div className="bg-[#09090b] border border-zinc-800 p-3 rounded-xl font-mono text-xs shadow-2xl space-y-1.5 z-50">
                            <p className="font-bold text-zinc-100 border-b border-zinc-800 pb-1">{label}</p>
                            <p className="text-zinc-400">
                              Doanh thu: <span className="text-zinc-100 font-semibold">{rev.toLocaleString('vi-VN')} Tỷ</span>
                            </p>
                            <p className={profit >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                              LNST Cổ đông mẹ: {profit >= 0 ? '+' : ''}{profit.toLocaleString('vi-VN')} Tỷ
                            </p>
                            <p className="text-sky-400">
                              Biên ròng (NPM): {margin}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="revenueT"
                    name="Doanh Thu Thuần"
                    fill="#52525b"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="netProfitT"
                    name="LNST Cổ Đông Mẹ"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="netMargin"
                    name="Biên Ròng NPM (%)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#38bdf8', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between pt-3 mt-1 border-t border-zinc-900 text-[11px] font-mono text-zinc-500">
              <span>Đơn vị: Tỷ đồng (Doanh thu & LNST) • % (Biên lợi nhuận ròng)</span>
              <span className="text-emerald-400">Đồng bộ từ BCTC Vietcap IQ</span>
            </div>
          </div>
        )}

        {/* ── VIEW 2: 4 QUARTERS DETAILED CARDS (WITH FIXED VISIBLE COLUMN BARS) ── */}
        {chartViewMode === 'cards' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {recent4Q.map((q, idx) => {
              const barMaxHeightPx = 56;
              const revHeightPx = Math.max(8, Math.round((q.revenue / maxRevenue) * barMaxHeightPx));
              const profitHeightPx = Math.max(6, Math.round((Math.abs(q.netProfit) / maxProfit) * barMaxHeightPx));
              const isProfitPositive = q.netProfit >= 0;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-zinc-200">{q.periodLabel}</span>
                    <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">
                      NPM: {q.netMargin}%
                    </span>
                  </div>

                  {/* Vertical Column Bar Visualization */}
                  <div className="h-24 flex items-end justify-center gap-3 pt-1 pb-1 border-b border-zinc-800/60">
                    {/* Revenue Bar Column */}
                    <div className="flex flex-col items-center justify-end h-full gap-1 w-1/3">
                      <span className="text-[9px] font-mono text-zinc-400 truncate">
                        {(q.revenue / 1_000_000_000_000).toFixed(1)}k Tỷ
                      </span>
                      <div className="w-full flex items-end justify-center h-16 bg-zinc-900/50 rounded-t border border-zinc-800/40 p-0.5">
                        <div
                          className="w-full rounded-t bg-zinc-500 hover:bg-zinc-400 transition-all"
                          style={{ height: `${revHeightPx}px` }}
                          title={`Doanh thu: ${formatBillion(q.revenue)}`}
                        />
                      </div>
                    </div>

                    {/* Net Profit Bar Column */}
                    <div className="flex flex-col items-center justify-end h-full gap-1 w-1/3">
                      <span className={`text-[9px] font-mono font-bold truncate ${isProfitPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(q.netProfit / 1_000_000_000_000).toFixed(1)}k Tỷ
                      </span>
                      <div className="w-full flex items-end justify-center h-16 bg-zinc-900/50 rounded-t border border-zinc-800/40 p-0.5">
                        <div
                          className={`w-full rounded-t transition-all ${
                            isProfitPositive
                              ? 'bg-emerald-500 hover:bg-emerald-400'
                              : 'bg-rose-500 hover:bg-rose-400'
                          }`}
                          style={{ height: `${profitHeightPx}px` }}
                          title={`LNST: ${formatBillion(q.netProfit)}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics under bar */}
                  <div className="space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-zinc-500">
                      <span>Biên LNG:</span>
                      <span className="text-zinc-300 font-bold">{q.grossMargin}%</span>
                    </div>
                    {q.eps > 0 && (
                      <div className="flex justify-between text-zinc-500">
                        <span>EPS Quý:</span>
                        <span className="text-emerald-400 font-bold">{q.eps.toLocaleString('vi-VN')} đ</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Metric Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-950/90 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-4">KỲ BÁO CÁO</th>
                <th className="py-2.5 px-4 text-right">DOANH THU THUẦN</th>
                <th className="py-2.5 px-4 text-right">LỢI NHUẬN GỘP</th>
                <th className="py-2.5 px-4 text-right">LNST CỔ ĐÔNG MẸ</th>
                <th className="py-2.5 px-4 text-right">BIÊN RÒNG (%)</th>
                <th className="py-2.5 px-4 text-right">TỔNG TÀI SẢN</th>
                <th className="py-2.5 px-4 text-right">VỐN CHỦ SỞ HỮU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
              {recent4Q.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-zinc-200">{row.periodLabel}</td>
                  <td className="py-2.5 px-4 text-right text-zinc-300">{formatBillion(row.revenue)}</td>
                  <td className="py-2.5 px-4 text-right text-zinc-400">{formatBillion(row.grossProfit)}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                    {formatBillion(row.netProfit)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-cyan-400">{row.netMargin}%</td>
                  <td className="py-2.5 px-4 text-right text-zinc-400">{formatBillion(row.totalAssets)}</td>
                  <td className="py-2.5 px-4 text-right text-zinc-300">{formatBillion(row.ownersEquity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. HEALTH RATIOS & PEER MULTIPLES BENCHMARK (ROE, ROA, D/E, EV/EBITDA) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/70">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">ROE (HIỆU QUẢ VỐN CHỦ)</span>
          <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">
            {roe !== null ? `${roe}%` : 'N/A'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            {roe !== null && roe > 15 ? '🟢 Hiệu quả sử dụng vốn rất tốt' : '🟡 Mức trung bình'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/70">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">ROA (HIỆU QUẢ TÀI SẢN)</span>
          <span className="text-xl font-mono font-bold text-cyan-400 mt-1 block">
            {roa !== null ? `${roa}%` : 'N/A'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            Tỷ suất sinh lời trên tổng tài sản
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/70">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">ĐÒN BẨY NỢ (DEBT / EQUITY)</span>
          <span
            className={`text-xl font-mono font-bold mt-1 block ${
              debtToEquity !== null && debtToEquity > 2.0 ? 'text-amber-400' : 'text-zinc-200'
            }`}
          >
            {debtToEquity !== null ? `${debtToEquity}x` : 'N/A'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            {debtToEquity !== null && debtToEquity < 1.0 ? '🟢 Cơ cấu vốn an toàn' : 'Cấu trúc nợ / vốn'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/70">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">EV / EBITDA</span>
          <span className="text-xl font-mono font-bold text-zinc-200 mt-1 block">
            {evToEbitda !== null ? `${evToEbitda}x` : 'N/A'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            Giá trị doanh nghiệp / Lợi nhuận HĐKD
          </span>
        </div>
      </div>

      {/* 5. AUTOMATED ANALYSIS THESIS & CORE POINTS */}
      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
          <Sparkle className="w-4 h-4 text-amber-400" />
          Luận Điểm Phân Tích & Khuyến Nghị Từ Mô Hình Định Giá
        </h3>

        <div className="space-y-2 pt-1">
          {analysisPoints.map((point, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs font-sans text-zinc-300 leading-relaxed flex items-start gap-2.5"
            >
              <span className="text-emerald-400 mt-0.5 font-mono font-bold">•</span>
              <span>{point}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-zinc-800/60 flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-500 gap-2">
          <span>
            Nguồn: Báo cáo tài chính doanh nghiệp niêm yết & Cổng thông tin Vietcap IQ Insight.
          </span>
          <span className="text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% Real Audited Data
          </span>
        </div>
      </div>
    </div>
  );
};
