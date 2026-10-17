'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Check,
  X,
  CaretDown,
  CaretRight,
  ArrowsClockwise,
  Gauge,
  ChartLineUp,
  Funnel,
  TrendUp,
  Brain,
  Crown,
  Info,
  Sparkle,
} from '@phosphor-icons/react';
import { MinerviniAnalysisResult } from '../types/minervini.types';

interface MinerviniStrategyPanelProps {
  symbol: string;
}

export const MinerviniStrategyPanel: React.FC<MinerviniStrategyPanelProps> = ({ symbol }) => {
  const [activeTab, setActiveTab] = useState<'strategies' | 'indicators' | 'screener' | 'leaderboard' | 'ai'>('strategies');
  const [data, setData] = useState<MinerviniAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Collapsible accordion states
  const [openMinervini, setOpenMinervini] = useState(true);
  const [openWyckoff, setOpenWyckoff] = useState(true);

  const fetchAnalysis = useCallback(() => {
    if (!symbol) return;
    setIsLoading(true);
    fetch(`/api/market/minervini/analysis?symbol=${symbol}`)
      .then((res) => res.json())
      .then((resData) => {
        setIsLoading(false);
        if (resData.success && resData.data) {
          setData(resData.data);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [symbol]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      fetchAnalysis();
      setIsScanning(false);
    }, 500);
  };

  const isStage2 = data?.passedCount === 8;
  const passedCount = data?.passedCount ?? 0;
  const wyckoff = data?.wyckoff;

  return (
    <div className="bg-[#090d14]/95 flex flex-col h-full overflow-hidden text-zinc-300 font-mono select-none">
      {/* ── Top Header: Title & Minimalist Scan Button ────────────── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/60 border-b border-zinc-800/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkle className="w-3.5 h-3.5 text-amber-400 shrink-0" weight="fill" />
          <span className="text-xs font-mono font-bold text-zinc-100 tracking-tight truncate">
            Chiến Lược Minervini
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 font-semibold uppercase tracking-wider hidden sm:inline shrink-0">
            Trend Template
          </span>
        </div>

        {/* Minimalist Scan Button */}
        <button
          onClick={handleScan}
          disabled={isScanning || isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100 border border-zinc-700/80 hover:border-zinc-500 text-[11px] font-mono font-medium transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-50 shrink-0 group shadow-sm"
          title="Bấm để tính toán và quét lại 8 tiêu chí Trend Template & RS Rating"
        >
          <ArrowsClockwise
            size={12}
            className={`text-amber-400/90 group-hover:text-amber-300 transition-transform ${
              isScanning || isLoading ? 'animate-spin' : 'group-hover:rotate-180 duration-300'
            }`}
          />
          <span className="text-[11px]">{isScanning || isLoading ? 'Đang quét...' : 'Quét lại'}</span>
        </button>
      </div>

      {/* ── Segmented Navigation Tabs Bar ───────────────────────── */}
      <div className="px-3 pt-2 pb-2 bg-zinc-950/80 shrink-0 border-b border-zinc-800/60">
        <div className="bg-zinc-900/80 p-0.5 rounded-xl border border-zinc-800/90 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('strategies')}
            className={`flex-1 whitespace-nowrap text-center py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'strategies'
                ? 'bg-zinc-800 text-amber-400 font-bold shadow-sm border border-zinc-700/70'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            Chiến lược
          </button>
          <button
            onClick={() => setActiveTab('indicators')}
            className={`flex-1 whitespace-nowrap text-center py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'indicators'
                ? 'bg-zinc-800 text-zinc-100 font-bold shadow-sm border border-zinc-700/70'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            Chỉ báo
          </button>
          <button
            onClick={() => setActiveTab('screener')}
            className={`flex-1 whitespace-nowrap text-center py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'screener'
                ? 'bg-zinc-800 text-zinc-100 font-bold shadow-sm border border-zinc-700/70'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            Sàng lọc
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 whitespace-nowrap text-center py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-zinc-800 text-amber-300 font-bold shadow-sm border border-zinc-700/70'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            Bảng Vàng
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 whitespace-nowrap text-center py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'ai'
                ? 'bg-cyan-500/15 text-cyan-300 font-bold shadow-sm border border-cyan-500/30'
                : 'text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            AI
          </button>
        </div>
      </div>

      {/* ── Main Content Scroll Area ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-3.5 p-3.5 scrollbar-thin">
        {isLoading && !data && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-xs">
            <ArrowsClockwise size={20} className="animate-spin text-amber-400 mb-2" />
            <span>Đang tính toán tiêu chí Minervini từ nến DNSE...</span>
          </div>
        )}

        {/* ── TAB 1: CHIẾN LƯỢC (TREND TEMPLATE + WYCKOFF + RS) ──── */}
        {activeTab === 'strategies' && (
          <>
            {/* 1. TREND TEMPLATE (MARK MINERVINI) 8/8 CHECKLIST */}
            <div className="rounded-xl bg-[#0a111a]/90 border border-zinc-800/80 overflow-hidden shadow-lg">
              {/* Header */}
              <div
                onClick={() => setOpenMinervini((prev) => !prev)}
                className="p-3 bg-[#0d1622]/90 border-b border-zinc-800/60 cursor-pointer flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-amber-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                    {openMinervini ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
                    <span>TREND TEMPLATE (MARK MINERVINI)</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    passedCount >= 6 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                    passedCount >= 4 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                    'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    {passedCount}/8 đạt
                  </span>
                </div>

                <div className="pl-4 flex items-center gap-2 text-xs">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border inline-block ${
                    isStage2
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : data?.stageName?.includes('Stage 4')
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}>
                    {isStage2 ? 'Stage 2 – Đủ điều kiện xét mua' : (data?.stageName || 'Stage 1 – Tích lũy')}
                  </span>
                </div>
              </div>

              {/* Checklist comparison items */}
              {openMinervini && data?.criteria && (
                <div className="divide-y divide-zinc-800/40 text-xs">
                  {data.criteria.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-3 hover:bg-zinc-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 text-zinc-200">
                        {c.passed ? (
                          <Check size={14} weight="bold" className="text-cyan-400 shrink-0" />
                        ) : (
                          <X size={14} weight="bold" className="text-rose-500 shrink-0" />
                        )}
                        <span className="text-[11px] font-medium text-zinc-200">{c.label}</span>
                      </div>

                      <div className="font-mono text-xs font-bold text-zinc-400 text-right shrink-0">
                        {c.comparisonValue || c.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. CHẨN ĐOÁN WYCKOFF & PRICE ACTION TỪ NẾN THỰC TẾ */}
            <div className="rounded-xl bg-[#0a111a]/90 border border-zinc-800/80 overflow-hidden shadow-lg">
              {/* Header */}
              <div
                onClick={() => setOpenWyckoff((prev) => !prev)}
                className="p-3 bg-[#0d1622]/90 border-b border-zinc-800/60 cursor-pointer"
              >
                <div className="text-[11px] text-amber-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                  {openWyckoff ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
                  <span>CHẨN ĐOÁN WYCKOFF & PRICE ACTION</span>
                </div>

                <div className="mt-1.5 pl-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400 text-xs">
                      {wyckoff?.phaseName || 'Đang phân tích cấu trúc nền giá...'}
                    </span>
                    {wyckoff && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {wyckoff.passedCount}/8 tiêu chí
                      </span>
                    )}
                  </div>
                  {wyckoff?.actionAdvice && (
                    <p className="text-[11px] text-zinc-400 mt-0.5 italic">
                      {wyckoff.actionAdvice}
                    </p>
                  )}
                </div>
              </div>

              {/* Wyckoff Criteria Checklist */}
              {openWyckoff && wyckoff?.criteria && (
                <div className="divide-y divide-zinc-800/40 text-xs">
                  {wyckoff.criteria.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between py-2 px-3 hover:bg-zinc-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 text-zinc-200">
                        {w.passed ? (
                          <Check size={14} weight="bold" className="text-cyan-400 shrink-0" />
                        ) : (
                          <X size={14} weight="bold" className="text-rose-500 shrink-0" />
                        )}
                        <span className="text-[11px] font-medium text-zinc-200">{w.label}</span>
                      </div>

                      <div className="font-mono text-xs font-bold text-zinc-400 text-right shrink-0">
                        {w.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. RELATIVE STRENGTH (RS RATING) */}
            {data && (
              <div className="p-3 rounded-xl bg-[#0a111a]/80 border border-zinc-800/70 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-300 font-bold flex items-center gap-1.5 text-[11px]">
                    <Gauge size={14} className="text-amber-400" />
                    Sức Mạnh Giá RS (Minervini vs VNINDEX)
                  </span>
                  <div className="flex items-baseline gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40">
                    <span className="font-black text-amber-300 text-base">{data.rsRating}</span>
                    <span className="text-[10px] text-amber-400/70">/99</span>
                  </div>
                </div>

                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800 mb-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, data.rsRating))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                  <span>Yếu (&lt;50)</span>
                  <span>Khá (50-69)</span>
                  <span className={data.rsRating >= 70 ? 'text-emerald-400 font-bold' : ''}>Dẫn dắt (≥70)</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: CHỈ BÁO KỸ THUẬT THỰC TẾ ────────────────────── */}
        {activeTab === 'indicators' && data && (
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-[#0a111a]/90 border border-zinc-800/80">
              <div className="text-[11px] font-bold text-amber-400 uppercase mb-2.5 flex items-center gap-1.5">
                <ChartLineUp size={14} />
                <span>Các Đường Trung Bình Động (SMA)</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-400">SMA 50 ngày (Ngắn hạn)</span>
                  <span className="font-bold text-cyan-400">{data.sma50.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-400">SMA 150 ngày (Trung hạn)</span>
                  <span className="font-bold text-amber-300">{data.sma150.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-400">SMA 200 ngày (Dài hạn)</span>
                  <span className="font-bold text-rose-400">{data.sma200.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-400">Xu hướng SMA 200 (1 tháng)</span>
                  <span className={`font-bold ${data.sma200SlopeUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {data.sma200SlopeUp ? 'Dốc lên (Tích cực)' : 'Đi ngang / Dốc xuống'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0a111a]/90 border border-zinc-800/80">
              <div className="text-[11px] font-bold text-amber-400 uppercase mb-2.5 flex items-center gap-1.5">
                <TrendUp size={14} />
                <span>Khung Giá 52 Tuần</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-400">Đỉnh 52 tuần</span>
                  <span className="font-bold text-zinc-100">{data.high52W.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-400">Khoảng cách tới Đỉnh 52T</span>
                  <span className={`font-bold ${data.distFrom52WHighPct >= -15 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {data.distFrom52WHighPct > 0 ? `+${data.distFrom52WHighPct}%` : `${data.distFrom52WHighPct}%`}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-400">Đáy 52 tuần</span>
                  <span className="font-bold text-zinc-100">{data.low52W.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-400">Cách đáy 52T</span>
                  <span className="font-bold text-emerald-400">+{data.distFrom52WLowPct}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: SÀNG LỌC MINERVINI ──────────────────────────── */}
        {activeTab === 'screener' && data && (
          <div className="space-y-2.5">
            <div className="p-3.5 rounded-xl bg-[#0a111a]/90 border border-zinc-800/80 text-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] uppercase">
                <Funnel size={14} />
                <span>Tổng Kết Sàng Lọc Mã {data.symbol}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-400">Chu kỳ cổ phiếu</div>
                  <div className="font-bold text-zinc-100">{data.stageName}</div>
                </div>
                <span className={`text-[11px] font-black px-2 py-1 rounded ${
                  data.stage === 2 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  STAGE {data.stage}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-400">Tiêu chuẩn Trend Template</div>
                  <div className="font-bold text-zinc-100">{passedCount}/8 tiêu chí thỏa mãn</div>
                </div>
                <span className={`text-[11px] font-black px-2 py-1 rounded ${
                  isStage2 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {isStage2 ? 'ĐẠT CHUẨN' : 'CHƯA ĐỦ'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-400">Sức mạnh giá RS Rating</div>
                  <div className="font-bold text-zinc-100">{data.rsRating}/99 điểm</div>
                </div>
                <span className={`text-[11px] font-black px-2 py-1 rounded ${
                  data.rsRating >= 70 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {data.rsRating >= 70 ? 'KHỎE HƠN TT' : 'TRUNG BÌNH'}
                </span>
              </div>

              {data.sector && (
                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Nhóm ngành</div>
                    <div className="font-bold text-zinc-100">{data.sector}</div>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 px-2 py-0.5 rounded bg-zinc-800">
                    {data.sectorStatus || 'Đang theo dõi'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: BẢNG VÀNG ───────────────────────────────────── */}
        {activeTab === 'leaderboard' && (
          <div className="p-4 rounded-xl bg-[#0a111a]/90 border border-zinc-800/80 text-center space-y-3">
            <Crown size={28} className="text-amber-400 mx-auto" weight="fill" />
            <div className="text-xs font-bold text-zinc-200">Bảng Vàng Stage 2 Toàn Thị Trường</div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tính năng quét tự động toàn bộ cổ phiếu thỏa mãn đồng thời 8/8 tiêu chí Trend Template và RS &ge; 70 trên HOSE & HNX đang được hoàn thiện kết nối dữ liệu.
            </p>
            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-[11px] text-zinc-400 text-left flex items-start gap-2">
              <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
              <span>Hiện tại, bạn có thể nhập trực tiếp bất kỳ mã cổ phiếu nào (ví dụ: VCB, FPT, HPG, SSI, DGC...) vào ô tìm kiếm để kiểm tra tức thì.</span>
            </div>
          </div>
        )}

        {/* ── TAB 5: AI PHÂN TÍCH THỰC TẾ ────────────────────────── */}
        {activeTab === 'ai' && data && (
          <div className="p-3.5 rounded-xl bg-[#0a111a]/90 border border-zinc-800/80 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-[11px] uppercase">
              <Brain size={14} />
              <span>AI Đánh Giá Kỹ Thuật: {data.symbol}</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/70 border border-zinc-800/60 text-[11px] leading-relaxed text-zinc-300 space-y-2">
              <p>
                • <strong>Xu hướng chính:</strong> Cổ phiếu đang ở <strong>{data.stageName}</strong> với <strong>{passedCount}/8</strong> tiêu chuẩn xu hướng được đáp ứng.
              </p>
              <p>
                • <strong>Sức mạnh tương quan:</strong> Chỉ số RS đạt <strong>{data.rsRating}/99</strong>{data.rsRating >= 70 ? ', nằm trong nhóm cổ phiếu dẫn dắt khỏe hơn VN-Index.' : ', cần thêm sự xác nhận từ dòng tiền.'}
              </p>
              <p>
                • <strong>Chiến lược hành động:</strong> {isStage2 ? 'Đủ điều kiện xem xét các điểm mua breakout nền giá VCP hoặc nhịp hồi hỗ trợ MA50.' : 'Nên kiên nhẫn quan sát quá trình hình thành nền giá tích lũy trước khi mở vị thế.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
