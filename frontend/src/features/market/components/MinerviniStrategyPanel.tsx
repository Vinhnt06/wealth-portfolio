'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  WarningCircle,
  Sparkle,
  ArrowClockwise,
  TrendUp,
  TrendDown,
  ShieldCheck,
  Lightning,
  Funnel,
  ChartLineUp,
  Gauge,
  ArrowsClockwise,
  Buildings,
} from '@phosphor-icons/react';
import { MinerviniAnalysisResult } from '../types/minervini.types';

interface MinerviniStrategyPanelProps {
  symbol: string;
}

export const MinerviniStrategyPanel: React.FC<MinerviniStrategyPanelProps> = ({ symbol }) => {
  const [activeTab, setActiveTab] = useState<'screener' | 'strategies' | 'indicators'>('screener');
  const [data, setData] = useState<MinerviniAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSessions, setScanSessions] = useState<number>(5);

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
    }, 600);
  };

  const isStage2 = data?.passedCount === 8;
  const passedCount = data?.passedCount || 0;

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 flex flex-col h-full overflow-hidden shadow-2xl relative text-zinc-300">
      {/* Panel Top Header & Mode Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('screener')}
            className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
              activeTab === 'screener'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            Sàng lọc
          </button>
          <button
            onClick={() => setActiveTab('strategies')}
            className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
              activeTab === 'strategies'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            Chiến lược
          </button>
          <button
            onClick={() => setActiveTab('indicators')}
            className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
              activeTab === 'indicators'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            Chỉ báo
          </button>
        </div>

        <button
          onClick={handleScan}
          disabled={isScanning || isLoading}
          className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 rounded-lg transition-colors disabled:opacity-40"
          title="Làm mới phân tích"
        >
          <ArrowsClockwise size={15} className={isScanning ? 'animate-spin text-emerald-400' : ''} />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
        {/* Scanner Bar (Ảnh 2, 3) */}
        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs font-mono shadow-md">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2.5">
            <span className="flex items-center gap-1.5 font-bold text-zinc-200 uppercase tracking-tight">
              <Lightning size={14} className="text-amber-400 animate-pulse" />
              Quét Tín Hiệu Trên Mã {symbol}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              Realtime DNSE
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[11px] text-zinc-400 whitespace-nowrap">Phiên:</span>
              <select
                value={scanSessions}
                onChange={(e) => setScanSessions(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-bold focus:outline-none focus:border-amber-400 w-full"
              >
                <option value={0}>0 (Phiên hiện tại)</option>
                <option value={1}>1 (Phiên trước)</option>
                <option value={3}>3 phiên gần nhất</option>
                <option value={5}>5 phiên gần nhất</option>
                <option value={10}>10 phiên gần nhất</option>
                <option value={20}>20 phiên gần nhất</option>
              </select>
            </div>

            {/* High-visibility prominent Quét button matching user Image 2 */}
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="px-4 py-1.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 border border-rose-400/30 active:scale-95"
            >
              <Funnel size={14} weight="fill" className={isScanning ? 'animate-spin' : ''} />
              <span>{isScanning ? 'Đang quét...' : 'Quét'}</span>
            </button>
          </div>
        </div>

        {/* ── TREND TEMPLATE (MARK MINERVINI) 8/8 Checklist ──────── */}
        <div className="p-3.5 rounded-xl bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800/80 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-extrabold flex items-center gap-1">
                <Sparkle size={12} />
                Trend Template (Mark Minervini)
              </div>
              <h4 className="font-mono font-black text-sm text-zinc-100 mt-0.5">
                Giai Đoạn 2 (Stage 2 Advancing)
              </h4>
            </div>

            {/* Score Badge */}
            <div
              className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border flex items-center gap-1.5 ${
                isStage2
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : passedCount >= 6
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              <span>{passedCount}/8 Tiêu chí</span>
            </div>
          </div>

          {/* Status Subtitle */}
          <div className="text-[11px] font-mono mb-3 px-2 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 flex items-center justify-between">
            <span>Trạng thái:</span>
            <span className={isStage2 ? 'text-emerald-400 font-bold' : 'text-zinc-400 font-semibold'}>
              {isStage2 ? 'Stage 2 - Đủ điều kiện xét mua' : `${data?.stageName || 'Chưa đủ 8 tiêu chí'}`}
            </span>
          </div>

          {/* 8 Criteria Checklist Items */}
          <div className="space-y-2 font-mono text-[11px]">
            {data?.criteria.map((c) => (
              <div
                key={c.id}
                className={`p-2 rounded-lg border transition-all flex items-start gap-2 ${
                  c.passed
                    ? 'bg-emerald-500/[0.04] border-emerald-500/20 text-zinc-200'
                    : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-500'
                }`}
              >
                {c.passed ? (
                  <CheckCircle size={15} weight="fill" className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={15} weight="fill" className="text-zinc-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${c.passed ? 'text-zinc-200' : 'text-zinc-400'}`}>
                      {c.label}
                    </span>
                    <span className={`text-[10px] font-bold ${c.passed ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {c.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Sức Mạnh Giá (Relative Strength - RS Rating 1-99) */}
          <div className="mt-3.5 pt-3 border-t border-zinc-800/80">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-zinc-300 flex items-center gap-1.5 font-bold">
                <Gauge size={16} className="text-amber-400" />
                Chỉ Số Sức Mạnh Giá RS (Minervini)
              </span>
              <div className="flex items-baseline gap-1 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                <span className="font-mono font-black text-amber-300 text-lg leading-none">
                  {data?.rsRating || 50}
                </span>
                <span className="text-[10px] text-amber-400/70 font-semibold font-mono">/99</span>
                {(data?.rsRating || 0) >= 80 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400 text-zinc-950">
                    Leader
                  </span>
                )}
              </div>
            </div>

            {/* Gauge Progress Bar */}
            <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  (data?.rsRating || 0) >= 80
                    ? 'bg-gradient-to-r from-amber-400 to-emerald-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : (data?.rsRating || 0) >= 70
                    ? 'bg-emerald-500'
                    : 'bg-zinc-600'
                }`}
                style={{ width: `${data?.rsRating || 50}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-1">
              <span>Yếu (RS 1-49)</span>
              <span>Trung bình (RS 50-69)</span>
              <span className="text-amber-400 font-bold">Leader (RS 70-99)</span>
            </div>
          </div>
        </div>

        {/* ── Xếp Hạng Ngành & Sức Mạnh Dòng Tiền (Sector Ranking) ───────── */}
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs font-mono shadow-md">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-bold text-zinc-200 uppercase tracking-tight flex items-center gap-1.5 text-[11px]">
              <Buildings size={14} className="text-amber-400" />
              Sức Mạnh Nhóm Ngành (Sector RS)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {data?.sectorStatus || 'Dẫn dắt (Leading)'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 block uppercase font-semibold">Nhóm Ngành</span>
              <span className="font-bold text-zinc-100 truncate block mt-0.5" title={data?.sector}>
                {data?.sector || 'Chung'}
              </span>
              <span className="text-[10px] font-bold text-amber-400 block mt-1">
                {data?.sectorRank || 'Top 1 / 18 ngành'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 block uppercase font-semibold">RS Ngành</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-cyan-400">{data?.sectorRS || 88}</span>
                <span className="text-[10px] text-zinc-500 font-bold">/ 99</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
                Dòng tiền ưu tiên
              </span>
            </div>
          </div>
        </div>

        {/* ── Chiến Lược Tín Hiệu (Strategy Signals List) ───────────── */}
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs font-mono">
          <div className="flex items-center justify-between mb-3 text-[11px]">
            <span className="font-bold text-zinc-200 uppercase tracking-tight flex items-center gap-1.5">
              <ChartLineUp size={14} className="text-emerald-400" />
              Chiến Lược Tín Hiệu Kỹ Thuật
            </span>
            <span className="text-[10px] text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              58 Chiến lược
            </span>
          </div>

          <div className="space-y-2">
            {data?.signals.map((sig) => (
              <div
                key={sig.id}
                className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
              >
                <div>
                  <div className="font-bold text-zinc-200 text-[11px]">{sig.name}</div>
                  <div className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">
                    {sig.school}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <div className="text-[10px] text-zinc-400">
                    <div>Thắng <span className="font-bold text-zinc-200">{sig.winRate}%</span></div>
                    <div className="text-emerald-400 font-bold">+{sig.profitPct}%</div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sig.status === 'MUA'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {sig.status === 'MUA' ? `MUA · ${sig.sessionsAgo}p` : sig.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
