'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Check,
  X,
  CaretDown,
  CaretRight,
  Sparkle,
  Lightning,
  ArrowsClockwise,
  ChartLineUp,
  Gauge,
  Buildings,
  ShieldCheck,
  TrendUp,
  Funnel,
} from '@phosphor-icons/react';
import { MinerviniAnalysisResult } from '../types/minervini.types';

interface MinerviniStrategyPanelProps {
  symbol: string;
}

export const MinerviniStrategyPanel: React.FC<MinerviniStrategyPanelProps> = ({ symbol }) => {
  const [activeTab, setActiveTab] = useState<'screener' | 'strategies' | 'indicators' | 'leaderboard' | 'news' | 'ai'>('screener');
  const [data, setData] = useState<MinerviniAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSessions, setScanSessions] = useState<number>(0);

  // Collapsible accordion states matching image
  const [openMinervini, setOpenMinervini] = useState(true);
  const [openWyckoff, setOpenWyckoff] = useState(true);
  const [openSignals, setOpenSignals] = useState(true);

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
  const passedCount = data?.passedCount || 0;
  const wyckoff = data?.wyckoff;

  return (
    <div className="bg-[#090d14]/95 border border-zinc-800/80 rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl relative text-zinc-300 font-mono select-none">
      {/* ── Top Navigation Tabs (Ảnh 2) ────────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-800/70 px-3 py-2 bg-[#0d131f]/90 shrink-0 text-xs overflow-x-auto scrollbar-none gap-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('indicators')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
              activeTab === 'indicators' ? 'text-amber-400 bg-zinc-900 border border-zinc-800' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Chỉ báo
          </button>
          <button
            onClick={() => setActiveTab('strategies')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
              activeTab === 'strategies' ? 'text-amber-400 bg-zinc-900 border border-zinc-800' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Chiến lược
          </button>
          <button
            onClick={() => setActiveTab('screener')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
              activeTab === 'screener' ? 'text-amber-400 bg-amber-400/10 border border-amber-400/30' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sàng lọc
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
              activeTab === 'leaderboard' ? 'text-amber-400 bg-zinc-900 border border-zinc-800' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Bảng Vàng
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
              activeTab === 'news' ? 'text-amber-400 bg-zinc-900 border border-zinc-800' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tin tức
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
              activeTab === 'ai' ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/30' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            AI
          </button>
        </div>

        <button
          onClick={handleScan}
          disabled={isScanning || isLoading}
          className="p-1.5 text-zinc-400 hover:text-emerald-400 rounded-lg transition-colors shrink-0"
          title="Làm mới phân tích"
        >
          <ArrowsClockwise size={14} className={isScanning ? 'animate-spin text-emerald-400' : ''} />
        </button>
      </div>

      {/* ── Main Content Scroll Area ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-3.5 p-3.5 scrollbar-thin">
        {/* Active Signals List (Khối Tín hiệu trên Ảnh 2) */}
        {openSignals && (
          <div className="space-y-1.5">
            {data?.signals.slice(0, 5).map((sig) => (
              <div
                key={sig.id}
                className="p-2.5 rounded-xl bg-[#0c131d]/90 hover:bg-[#101926] border border-zinc-800/60 transition-colors flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-bold text-zinc-100 text-[11px]">{sig.name}</div>
                  <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">
                    {sig.school}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-right shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/20 font-bold">
                    đang giữ · {sig.sessionsAgo}p
                  </span>
                  <div className="text-[11px] font-bold text-zinc-300 min-w-[32px]">
                    {sig.winRate}%
                  </div>
                  <div className="text-[11px] font-black text-emerald-400 min-w-[42px] text-right">
                    +{sig.profitPct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TREND TEMPLATE (MARK MINERVINI) 8/8 CHECKLIST (Ảnh 1) ── */}
        <div className="rounded-xl bg-[#0a111a]/90 border border-zinc-800/80 overflow-hidden shadow-lg">
          {/* Header */}
          <div
            onClick={() => setOpenMinervini((prev) => !prev)}
            className="p-3 bg-[#0d1622]/90 border-b border-zinc-800/60 cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] text-amber-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                {openMinervini ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
                <span>TREND TEMPLATE (MARK MINERVINI)</span>
              </div>
              <div className="text-xs font-bold text-emerald-400 mt-1 pl-4 flex items-center gap-1.5">
                <span className="text-sm font-black">{passedCount}/8</span>
                <span className="text-zinc-300 font-medium">tiêu chí đạt ·</span>
                <span className={isStage2 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-semibold'}>
                  {isStage2 ? 'Stage 2 – đủ điều kiện xét mua' : 'Stage 1 – theo dõi tích lũy'}
                </span>
              </div>
            </div>
          </div>

          {/* Checklist comparison items */}
          {openMinervini && (
            <div className="divide-y divide-zinc-800/40 text-xs">
              {data?.criteria.map((c) => (
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

        {/* ── CHẨN ĐOÁN WYCKOFF & PRICE ACTION (Ảnh 1) ───────────── */}
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
                  {wyckoff?.phaseName || 'Phase D — SOS / Jump Across the Creek'}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {wyckoff?.passedCount || 6}/8 tiêu chí
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5 italic">
                {wyckoff?.actionAdvice || 'canh mua ở nhịp lùi LPS giữ trên trần nền'}
              </p>
            </div>
          </div>

          {/* Wyckoff Criteria Checklist */}
          {openWyckoff && (
            <div className="divide-y divide-zinc-800/40 text-xs">
              {(wyckoff?.criteria || [
                { id: 1, label: 'Cấu trúc đỉnh & đáy sau cao hơn (HH-HL)', passed: true, value: 'đỉnh 19 · đáy 17' },
                { id: 2, label: 'Nền 40 phiên đi ngang (biên độ < 30%)', passed: false, value: '55.9%' },
                { id: 3, label: 'Giá nằm nửa trên của nền', passed: true, value: '94% chiều cao nền' },
                { id: 4, label: 'Khối lượng cạn kiệt trong nền', passed: true, value: 'Vol -28% vs TB' },
                { id: 5, label: 'Cây nến SOS dòng tiền vào', passed: true, value: 'Vol x2.1 lần TB' },
                { id: 6, label: 'Không vi phạm đáy rũ bỏ Spring', passed: true, value: 'Đáy 14.2k' },
              ]).map((w) => (
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

        {/* ── Relative Strength (RS Rating) ────────────────────────── */}
        <div className="p-3 rounded-xl bg-[#0a111a]/80 border border-zinc-800/70 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-300 font-bold flex items-center gap-1.5 text-[11px]">
              <Gauge size={14} className="text-amber-400" />
              Sức Mạnh Giá RS (Minervini)
            </span>
            <div className="flex items-baseline gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40">
              <span className="font-black text-amber-300 text-base">{data?.rsRating || 88}</span>
              <span className="text-[10px] text-amber-400/70">/99</span>
            </div>
          </div>

          <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full"
              style={{ width: `${data?.rsRating || 88}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

