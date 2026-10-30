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
  TrendDown,
  Brain,
  Crown,
  Info,
  Sparkle,
  Flame,
  ShieldCheck,
  Coins,
  Target,
  Lock,
  Clock,
  Warning,
  CheckCircle,
  Prohibit,
  Crosshair,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { MinerviniAnalysisResult, RsLeaderboardItem } from '../types/minervini.types';
import { useMarketStore } from '../store/marketStore';

interface MinerviniStrategyPanelProps {
  symbol: string;
}

export const MinerviniStrategyPanel: React.FC<MinerviniStrategyPanelProps> = ({ symbol }) => {
  const { setSelectedSymbol } = useMarketStore();
  const [activeTab, setActiveTab] = useState<'strategies' | 'indicators' | 'screener' | 'leaderboard' | 'ai'>('strategies');
  const [data, setData] = useState<MinerviniAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<RsLeaderboardItem[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'rs80' | 'rs70'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Collapsible accordion states
  const [openMinervini, setOpenMinervini] = useState(true);
  const [openWyckoff, setOpenWyckoff] = useState(true);

  const fetchLeaderboard = useCallback(() => {
    setIsLeaderboardLoading(true);
    fetch('/api/market/minervini/leaderboard?limit=35')
      .then((res) => res.json())
      .then((resData) => {
        setIsLeaderboardLoading(false);
        if (resData.success && Array.isArray(resData.data)) {
          setLeaderboard(resData.data);
        }
      })
      .catch(() => {
        setIsLeaderboardLoading(false);
      });
  }, []);

  useEffect(() => {
    if (activeTab === 'leaderboard' && leaderboard.length === 0) {
      fetchLeaderboard();
    }
  }, [activeTab, leaderboard.length, fetchLeaderboard]);

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
                  <div className="flex items-center gap-1.5">
                    {data.rsRank && data.rsUniverseTotal && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        Top {data.rsRank}/{data.rsUniverseTotal}
                      </span>
                    )}
                    <div className="flex items-baseline gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40">
                      <span className="font-black text-amber-300 text-base">{data.rsRating}</span>
                      <span className="text-[10px] text-amber-400/70">/99</span>
                    </div>
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
                  <div className="font-bold text-zinc-100">
                    {data.rsRating}/99 điểm
                    {data.rsRank && data.rsUniverseTotal && (
                      <span className="text-[10px] text-zinc-400 font-normal ml-1.5 font-mono">
                        (Top {data.rsRank}/{data.rsUniverseTotal})
                      </span>
                    )}
                  </div>
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
                    <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                      <span>{data.sector}</span>
                      {data.sectorRank && (
                        <span className="text-[10px] font-mono text-zinc-400 font-normal">({data.sectorRank})</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    data.sectorStatus?.includes('Leading') || data.sectorStatus?.includes('Dẫn dắt')
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : data.sectorStatus?.includes('Improving') || data.sectorStatus?.includes('Cải thiện')
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                      : data.sectorStatus?.includes('Weakening') || data.sectorStatus?.includes('Suy yếu')
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : data.sectorStatus?.includes('Lagging') || data.sectorStatus?.includes('Tụt hậu')
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700/50'
                  }`}>
                    {data.sectorStatus || 'Chưa có dữ liệu RRG'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: BẢNG VÀNG SỨC MẠNH GIÁ RS (TOP LEADERS) ──────── */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-3 pb-3">
            {/* Header Banner & Controls */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#0c131d] to-[#080d14] border border-amber-500/20 shadow-lg">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                    <Crown size={16} className="text-amber-400" weight="fill" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-zinc-100 flex items-center gap-1.5 tracking-wide">
                      BẢNG VÀNG RS RATING (1-99)
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        TOP DẪN DẮT
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      Xếp hạng toàn thị trường (95 mã thanh khoản cao nhất)
                    </div>
                  </div>
                </div>

                <button
                  onClick={fetchLeaderboard}
                  disabled={isLeaderboardLoading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[10px] text-zinc-300 hover:text-zinc-100 font-mono transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Làm mới bảng xếp hạng RS"
                >
                  <ArrowsClockwise
                    size={11}
                    className={`text-amber-400 ${isLeaderboardLoading ? 'animate-spin' : ''}`}
                  />
                  <span>{isLeaderboardLoading ? 'Đang tải' : 'Cập nhật'}</span>
                </button>
              </div>

              {/* Filters & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                {/* Search Box */}
                <div className="relative flex-1">
                  <MagnifyingGlass size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value.toUpperCase().trim())}
                    placeholder="Tìm mã (VD: PET, VIC...)"
                    className="w-full pl-7 pr-2.5 py-1 text-[11px] font-mono bg-zinc-950/80 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-400/60"
                  />
                  {searchFilter && (
                    <button
                      onClick={() => setSearchFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-[10px]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
                  <button
                    onClick={() => setLeaderboardFilter('all')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      leaderboardFilter === 'all'
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-bold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => setLeaderboardFilter('rs80')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      leaderboardFilter === 'rs80'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-zinc-500 hover:text-emerald-400/80'
                    }`}
                  >
                    RS ≥ 80
                  </button>
                  <button
                    onClick={() => setLeaderboardFilter('rs70')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      leaderboardFilter === 'rs70'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                        : 'text-zinc-500 hover:text-amber-400/80'
                    }`}
                  >
                    RS ≥ 70
                  </button>
                </div>
              </div>
            </div>

            {/* Leaderboard Table / Card List */}
            {isLeaderboardLoading && leaderboard.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center space-y-2">
                <ArrowsClockwise size={20} className="text-amber-400 animate-spin mx-auto" />
                <div className="text-xs text-zinc-400 font-mono">Đang tính toán bảng xếp hạng RS Rating toàn thị trường...</div>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {leaderboard
                  .filter((item) => {
                    if (searchFilter && !item.symbol.includes(searchFilter)) return false;
                    if (leaderboardFilter === 'rs80') return item.rsRating >= 80;
                    if (leaderboardFilter === 'rs70') return item.rsRating >= 70;
                    return true;
                  })
                  .map((item) => {
                    const isSelected = item.symbol === symbol;
                    const isTop1 = item.rank === 1;
                    const isTop10 = item.rank <= 10;

                    return (
                      <div
                        key={item.symbol}
                        onClick={() => setSelectedSymbol(item.symbol)}
                        className={`group p-2.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/25 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                            : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800/70 hover:border-zinc-700'
                        }`}
                      >
                        {/* Left: Rank & Symbol */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Rank Badge */}
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                              isTop1
                                ? 'bg-amber-400 text-zinc-950 shadow-sm shadow-amber-400/30'
                                : item.rank === 2
                                ? 'bg-zinc-300 text-zinc-950 font-bold'
                                : item.rank === 3
                                ? 'bg-amber-700/80 text-amber-100 font-bold'
                                : isTop10
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold'
                                : 'bg-zinc-800/80 text-zinc-400 font-medium'
                            }`}
                          >
                            {item.rank}
                          </div>

                          {/* Symbol & Price */}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-xs text-zinc-100 group-hover:text-amber-300 transition-colors">
                                {item.symbol}
                              </span>
                              {isSelected && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  Đang xem
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-400">
                              {item.currentPrice > 0 ? `${item.currentPrice.toFixed(1)}k` : 'N/A'}
                            </div>
                          </div>
                        </div>

                        {/* Middle: Performance Metrics */}
                        <div className="hidden sm:flex flex-col items-end text-right font-mono text-[10px] px-2">
                          <div className="text-zinc-500 text-[9px]">Hiệu suất 3T / 1N</div>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className={item.q1Perf >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {item.q1Perf >= 0 ? `+${item.q1Perf}%` : `${item.q1Perf}%`}
                            </span>
                            <span className="text-zinc-600">/</span>
                            <span className={item.q4Perf >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {item.q4Perf >= 0 ? `+${item.q4Perf}%` : `${item.q4Perf}%`}
                            </span>
                          </div>
                        </div>

                        {/* Right: RS Rating Badge */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div
                            className={`px-2 py-1 rounded-lg border flex items-baseline gap-0.5 ${
                              item.rsRating >= 90
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                : item.rsRating >= 80
                                ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                                : item.rsRating >= 70
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400'
                            }`}
                          >
                            <span className="font-mono font-black text-xs leading-none">
                              {item.rsRating}
                            </span>
                            <span className="text-[9px] opacity-70 leading-none">/99</span>
                          </div>
                          <CaretRight size={12} className="text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Method Educational Badge */}
            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-[10px] text-zinc-400 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                <Info size={14} className="text-cyan-400 shrink-0" />
                <span>Quy chuẩn tính toán RS Rating IBD Minervini:</span>
              </div>
              <p className="leading-relaxed text-zinc-400 pl-4 font-mono">
                RS = 40% Q1 (3 tháng) + 20% Q2 (6 tháng) + 20% Q3 (9 tháng) + 20% Q4 (12 tháng). Phân vị Percentile (1-99) đối sánh trên 95 cổ phiếu thanh khoản cao nhất VN-Index. Tự động lưu và cập nhật mỗi ngày lúc 15:15.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB 5: AI KHUYẾN NGHỊ & KẾ HOẠCH GIẢI NGÂN VỐN ────────────────────────── */}
        {activeTab === 'ai' && data && (
          <div className="space-y-3.5 pb-2">
            {/* Header Card: AI Action Banner & Decision Verdict */}
            <div
              className={`p-3.5 rounded-xl border ${
                data.aiRecommendation?.actionColor === 'emerald'
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : data.aiRecommendation?.actionColor === 'rose'
                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                  : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
              }`}
            >
              {/* Verdict Top Bar */}
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-200">
                  <Brain size={16} weight="fill" className="text-cyan-400" />
                  <span>KHUYẾN NGHỊ THUẬT TOÁN AI</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Suitability Score */}
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-700/60 text-zinc-300">
                    Độ tin cậy: <strong className="text-amber-300">{data.aiRecommendation?.buySuitabilityScore || 50}/100</strong>
                  </span>
                  {/* Action Badge */}
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                      data.aiRecommendation?.actionColor === 'emerald'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : data.aiRecommendation?.actionColor === 'rose'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    }`}
                  >
                    {data.aiRecommendation?.action || 'THEO DÕI NỀN GIÁ'}
                  </span>
                </div>
              </div>

              {/* Explicit Decision Verdict Banner */}
              {data.aiRecommendation?.decisionVerdictText && (
                <div
                  className={`mb-2.5 px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                    data.aiRecommendation.decisionVerdict === 'BUY_NOW'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : data.aiRecommendation.decisionVerdict === 'DO_NOT_BUY'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  }`}
                >
                  {data.aiRecommendation.decisionVerdict === 'BUY_NOW' ? (
                    <CheckCircle size={15} weight="fill" className="text-emerald-400 shrink-0" />
                  ) : data.aiRecommendation.decisionVerdict === 'DO_NOT_BUY' ? (
                    <Prohibit size={15} weight="bold" className="text-rose-400 shrink-0" />
                  ) : (
                    <Clock size={15} weight="bold" className="text-amber-400 shrink-0" />
                  )}
                  <span>{data.aiRecommendation.decisionVerdictText}</span>
                </div>
              )}

              <div className="text-xs font-bold text-zinc-100 mb-1">
                {data.aiRecommendation?.headline}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {data.aiRecommendation?.summary}
              </p>
            </div>

            {/* CỔNG SỐ 1 BẮT BUỘC: BỘ LỌC XU HƯỚNG MARK MINERVINI (TREND TEMPLATE GATE) */}
            <div
              className={`p-3.5 rounded-xl border ${
                data.aiRecommendation?.trendGatePassed
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/25 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-200">
                  <ShieldCheck size={16} weight="fill" className={data.aiRecommendation?.trendGatePassed ? 'text-emerald-400' : 'text-rose-400'} />
                  <span>CỔNG SỐ 1: BỘ LỌC XU HƯỚNG MARK MINERVINI</span>
                </div>
                <span
                  className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                    data.aiRecommendation?.trendGatePassed
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                  }`}
                >
                  {data.aiRecommendation?.trendGatePassed
                    ? `✓ ĐẠT CHUẨN (${data.passedCount}/8 TIÊU CHÍ)`
                    : `✕ VI PHẠM (${data.passedCount}/8 TIÊU CHÍ ĐẠT)`}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed mb-2 text-zinc-300">
                {data.aiRecommendation?.trendGatePassed
                  ? 'Cổ phiếu bảo toàn hoàn hảo cấu trúc tăng trưởng Stage 2 theo đúng chuẩn Mark Minervini. Đường MA dài hạn dốc lên, giá nằm trên các mốc hỗ trợ chủ chốt. ĐỦ ĐIỀU KIỆN TIẾN HÀNH XÉT ĐIỂM GIẢI NGÂN.'
                  : 'Cổ phiếu KHÔNG đạt chuẩn xu hướng của Mark Minervini. Theo nguyên tắc sống còn số 1 của trường phái SEPA: KHÓA TOÀN BỘ ĐIỂM MUA — TUYỆT ĐỐI KHÔNG GIẢI NGÂN KHI TREND CHƯA ĐƯỢC BẢO TOÀN.'}
              </p>

              {/* Violated criteria tags if failed */}
              {!data.aiRecommendation?.trendGatePassed && data.aiRecommendation?.failedCriteria && data.aiRecommendation.failedCriteria.length > 0 && (
                <div className="pt-2 border-t border-rose-900/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-rose-400 block">Các tiêu chí bị vi phạm:</span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {data.aiRecommendation.failedCriteria.map((fc, i) => (
                      <span key={i} className="text-[10px] font-mono bg-rose-950/60 border border-rose-800/60 text-rose-300 px-2 py-0.5 rounded">
                        ✕ {fc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* THAM KHẢO BẮT ĐÁY (NẾU MUỐN MẠO HIỂM - CẢNH BÁO CỰC KỲ RỦI RO) */}
            {data.aiRecommendation?.bottomFishing?.isAvailable && (
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-rose-950/30 via-zinc-900/90 to-amber-950/20 border border-rose-500/30 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-rose-400">
                    <Warning size={16} weight="fill" className="text-rose-400" />
                    <span>THAM KHẢO BẮT ĐÁY (CỰC KỲ RỦI RO)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300">
                    BẮT DAO RƠI ⚠️
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-rose-900/40 grid grid-cols-3 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase">Vùng Hỗ Trợ</span>
                    <span className="font-bold text-amber-300">
                      {data.aiRecommendation.bottomFishing.supportPrice}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase">Cắt Lỗ Tuyệt Đối</span>
                    <span className="font-bold text-rose-400">
                      {data.aiRecommendation.bottomFishing.stopLossPrice} (-5%)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase">Tỷ Trọng Tối Đa</span>
                    <span className="font-bold text-zinc-300">
                      {data.aiRecommendation.bottomFishing.maxNavPct}% NAV
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-rose-300/90 leading-relaxed italic bg-rose-950/40 p-2 rounded border border-rose-900/40">
                  {data.aiRecommendation.bottomFishing.warning}
                </p>
              </div>
            )}

            {/* Block 1: THƯỚC ĐO ĐỘ NÓNG & RỦI RO MUA ĐUỔI (HEAT & EXTENDED CHECK) */}
            <div className="p-3.5 rounded-xl bg-[#0a111a]/90 border border-zinc-800/80 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-amber-400">
                  <Flame size={15} weight="fill" />
                  <span>ĐO ĐỘ NÓNG & RỦI RO MUA ĐUỔI</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    data.aiRecommendation?.heat.heatLevel === 'OVERHEATED' ||
                    data.aiRecommendation?.heat.heatLevel === 'HOT'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : data.aiRecommendation?.heat.heatLevel === 'WARM'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  }`}
                >
                  {data.aiRecommendation?.heat.heatLabel || 'Hạ nhiệt an toàn'}
                </span>
              </div>

              {/* Progress bar of Heat Score */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-zinc-400">
                  <span>
                    Chỉ số nhiệt lượng:{' '}
                    <strong className="text-zinc-200 font-mono">
                      {data.aiRecommendation?.heat.heatScore || 20}/100
                    </strong>
                  </span>
                  <span
                    className={
                      data.aiRecommendation?.heat.isOverextended
                        ? 'text-rose-400 font-bold'
                        : 'text-emerald-400 font-bold'
                    }
                  >
                    {data.aiRecommendation?.heat.isOverextended
                      ? '⚠️ CẢNH BÁO QUÁ NÓNG'
                      : '✓ VÙNG AN TOÀN'}
                  </span>
                </div>
                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (data.aiRecommendation?.heat.heatScore || 0) >= 70
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                        : (data.aiRecommendation?.heat.heatScore || 0) >= 40
                        ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(10, data.aiRecommendation?.heat.heatScore || 20)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Table of Criteria */}
              <div className="divide-y divide-zinc-800/50 text-xs pt-1">
                {data.aiRecommendation?.heat.criteria.map((hc) => (
                  <div key={hc.id} className="py-2 flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-zinc-200 font-medium text-[11px]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            hc.status === 'DANGER'
                              ? 'bg-rose-500'
                              : hc.status === 'WARNING'
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <span>{hc.label}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500">{hc.threshold}</div>
                      <div className="text-[10px] text-zinc-400 italic">{hc.note}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono text-xs font-bold ${
                          hc.status === 'DANGER'
                            ? 'text-rose-400'
                            : hc.status === 'WARNING'
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {hc.currentValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Block 2: QUY TẮC GIẢI NGÂN VỐN NHIỀU LẦN (SCALE-IN / KIM TỰ THÁP) */}
            <div className="p-3.5 rounded-xl bg-[#0a111a]/90 border border-zinc-800/80 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-amber-400">
                  <Coins size={15} weight="fill" />
                  <span>KẾ HOẠCH GIẢI NGÂN VỐN (3 LẦN)</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">Quy tắc Kim Tự Tháp 30% - 40% - 30%</span>
              </div>
              {/* Gate 1 Locking Warning if Trend Template Failed */}
              {!data.aiRecommendation?.trendGatePassed && (
                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                  <Prohibit size={18} weight="bold" className="text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong className="block text-rose-200 uppercase font-black tracking-wide">
                      KHÓA TOÀN BỘ LỆNH GIẢI NGÂN (VI PHẠM NGUYÊN TẮC SỐ 1)
                    </strong>
                    Cổ phiếu chưa bảo toàn xu hướng tăng Stage 2 của Mark Minervini (Chỉ đạt {data.passedCount}/8 tiêu chí). 
                    Toàn bộ các lần giải ngân bị khóa tuyệt đối để bảo vệ vốn. Tuyệt đối không bắt đáy hay mua dò đáy khi trend chưa được bảo toàn.
                  </div>
                </div>
              )}

              {/* Tranches List */}
              <div className="space-y-2">
                {data.aiRecommendation?.allocation.tranches.map((t) => (
                  <div
                    key={t.step}
                    className={`p-2.5 rounded-lg border text-xs ${
                      t.status === 'ACTIVE'
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                        : t.status === 'BLOCKED'
                        ? 'bg-rose-950/20 border-rose-900/40 text-zinc-400'
                        : 'bg-zinc-900/60 border-zinc-800/70 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-zinc-200 text-[11px]">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : t.status === 'BLOCKED'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {t.pct}% VỐN
                        </span>
                        <span>{t.name}</span>
                      </div>

                      {/* Tranche Status Badge */}
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase flex items-center gap-1 ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : t.status === 'BLOCKED'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : t.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-zinc-800/80 text-zinc-500 border-zinc-700/40'
                        }`}
                      >
                        {t.status === 'ACTIVE' ? (
                          <CheckCircle size={11} weight="fill" />
                        ) : t.status === 'BLOCKED' ? (
                          <Prohibit size={11} />
                        ) : t.status === 'PENDING' ? (
                          <Clock size={11} />
                        ) : (
                          <Lock size={11} />
                        )}
                        <span>{t.statusLabel || (t.status === 'ACTIVE' ? 'KÍCH HOẠT' : t.status === 'PENDING' ? 'CHỜ GIÁ' : 'TẠM KHÓA')}</span>
                      </span>
                    </div>

                    <div className="mb-1 pl-1">
                      <span className="text-[10px] text-zinc-500 mr-1.5">Mức giá kích hoạt:</span>
                      <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-500/30">
                        {t.targetPrice}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-snug pl-1">
                      {t.condition}
                    </p>
                  </div>
                ))}
              </div>

              {/* Risk/Reward & Stoploss Stats */}
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 grid grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Cắt Lỗ Tự Động</span>
                  <span className="font-bold text-rose-400">
                    {data.aiRecommendation?.allocation.stopLossPrice} ({data.aiRecommendation?.allocation.stopLossPct}%)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Mục Tiêu 1 (+15%)</span>
                  <span className="font-bold text-emerald-400">
                    {data.aiRecommendation?.allocation.targetPrice1}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Tỷ Lệ Lãi/Lỗ</span>
                  <span className="font-bold text-amber-300">
                    1 : {data.aiRecommendation?.allocation.riskRewardRatio}
                  </span>
                </div>
              </div>

              {/* Volatility & Support/Resistance Metrics */}
              {(data.aiRecommendation?.allocation.atr14 || data.aiRecommendation?.allocation.pivotResistance) && (
                <div className="px-2.5 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Crosshair size={13} className="text-cyan-400" />
                    <span>ATR(14): <strong className="text-zinc-200">{data.aiRecommendation.allocation.atr14} ({data.aiRecommendation.allocation.atrPct}%)</strong></span>
                  </div>
                  <div>
                    <span>Kháng cự Pivot: <strong className="text-amber-300">{data.aiRecommendation.allocation.pivotResistance}</strong></span>
                  </div>
                  {data.aiRecommendation.allocation.swingLowSupport && (
                    <div>
                      <span>Đáy Swing: <strong className="text-rose-400">{data.aiRecommendation.allocation.swingLowSupport}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Golden Rules */}
              <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-1">
                  <ShieldCheck size={13} className="text-amber-400" />
                  <span>3 NGUYÊN TẮC BẢO VỆ VỐN SỐNG CÒN:</span>
                </div>
                {data.aiRecommendation?.allocation.goldenRules.map((rule, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[11px] text-zinc-400 leading-snug">
                    <span className="text-amber-400 font-bold shrink-0">•</span>
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
