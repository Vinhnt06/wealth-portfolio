'use client';

import React, { useState, useEffect, memo } from 'react';
import {
  GlobeHemisphereWest,
  TrendUp,
  TrendDown,
  ArrowsClockwise,
  Scales,
  ChartLineUp,
  ShieldCheck,
  Lightning,
  CaretDown,
  CaretUp,
  CurrencyDollar,
  Bank
} from '@phosphor-icons/react';

interface MarketIndexItem {
  symbol: string;
  name: string;
  category: 'equity' | 'yield' | 'volatility' | 'currency';
  price: number;
  change: number;
  changePercent: number;
  unit?: string;
  note?: string;
}

interface UsInflationData {
  period: string;
  cpiYoY: number;
  cpiMoM: number;
  coreCpiYoY: number;
  fedTarget: number;
  nextReleaseDate: string;
}

interface VietnamImpactItem {
  pillar: string;
  status: 'Tích Cực' | 'Trung Lập' | 'Thận Trọng';
  statusColor: 'emerald' | 'amber' | 'rose';
  headline: string;
  detail: string;
}

interface USGlobalMacroData {
  indices: MarketIndexItem[];
  usInflation: UsInflationData;
  vietnamImpact: VietnamImpactItem[];
  updateTime: string;
}

export const USGlobalMacroSection: React.FC = memo(() => {
  const [data, setData] = useState<USGlobalMacroData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await fetch('/api/macro/us-global', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json);
          setLastRefreshed(json.updateTime || new Date().toLocaleTimeString('vi-VN'));
        }
      }
    } catch (err) {
      console.error('Lỗi fetch dữ liệu thị trường Mỹ realtime:', err);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    const timer = setInterval(() => fetchData(false), 30000); // 30s auto-refresh
    return () => clearInterval(timer);
  }, []);

  if (!data) {
    return (
      <div className="p-6 md:p-8 bg-zinc-950/90 border border-zinc-800/80 rounded-3xl space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
          <div className="h-6 w-80 bg-zinc-800/60 rounded-lg animate-pulse" />
          <div className="h-8 w-32 bg-zinc-800/40 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="h-56 bg-zinc-900/60 rounded-2xl animate-pulse" />
          <div className="h-56 bg-zinc-900/60 rounded-2xl animate-pulse" />
          <div className="h-56 bg-zinc-900/60 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const { indices, usInflation, vietnamImpact } = data;
  const equityIndices = indices.filter((i) => i.category === 'equity');
  const tnxItem = indices.find((m) => m.symbol === '^TNX');
  const dxyItem = indices.find((m) => m.symbol === 'DX-Y.NYB');
  const vixItem = indices.find((m) => m.symbol === '^VIX');

  return (
    <div suppressHydrationWarning className="relative overflow-hidden p-6 md:p-8 bg-zinc-950/90 border border-zinc-800/80 rounded-3xl backdrop-blur-2xl space-y-6 shadow-2xl transition-all">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── 1. Header Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <GlobeHemisphereWest className="w-5 h-5" weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono font-black text-base sm:text-lg text-zinc-100 tracking-tight whitespace-nowrap">
                THỊ TRƯỜNG MỸ & CHỈ SỐ QUỐC TẾ TÁC ĐỘNG VIỆT NAM
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
                YAHOO FINANCE LIVE API
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                REALTIME NY & CBOE
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 truncate">
              Dữ liệu trực tiếp S&P 500, Nasdaq, Dow Jones, Lợi suất US 10Y, DXY, VIX & Ma trận tương quan TTCK Việt Nam
            </p>
          </div>
        </div>

        {/* Right Tools: Status + Refresh + Collapse/Expand */}
        <div className="flex items-center gap-2 shrink-0 self-start lg:self-auto">
          <span suppressHydrationWarning className="text-[11px] font-mono font-bold px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-2 shadow-inner whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
            <span>Cập nhật lúc: {lastRefreshed || 'Realtime'}</span>
          </span>

          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            title="Làm mới dữ liệu trực tiếp từ Yahoo Finance"
            className="p-2 h-9 w-9 flex items-center justify-center shrink-0 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-cyan-400 transition-colors disabled:opacity-50 shadow-sm"
          >
            <ArrowsClockwise size={16} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Mở rộng chi tiết' : 'Thu gọn'}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-mono text-xs font-bold transition-all shadow-sm"
          >
            <span>{isCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
            {isCollapsed ? <CaretDown size={14} weight="bold" /> : <CaretUp size={14} weight="bold" />}
          </button>
        </div>
      </div>

      {/* ── 1.5 Mini Quick Summary Strip (Hiển thị khi thu gọn) ── */}
      {isCollapsed && (
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 font-mono text-xs transition-opacity duration-200">
          <div className="flex flex-wrap items-center gap-4">
            {equityIndices.map((idx) => (
              <div key={idx.symbol} className="flex items-center gap-1">
                <span className="text-zinc-500">{idx.name}:</span>
                <span className="font-bold text-zinc-200">{idx.price.toLocaleString('en-US')}</span>
                <span className={`text-[10px] font-bold ${idx.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {idx.change >= 0 ? '+' : ''}{idx.changePercent}%
                </span>
              </div>
            ))}

            {tnxItem && (
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">US10Y:</span>
                <span className="font-bold text-amber-400">{tnxItem.price.toFixed(2)}%</span>
                <span className={`text-[10px] font-bold ${tnxItem.change >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {tnxItem.change >= 0 ? '+' : ''}{tnxItem.changePercent}%
                </span>
              </div>
            )}

            {dxyItem && (
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">DXY:</span>
                <span className="font-bold text-cyan-400">{dxyItem.price.toFixed(2)}</span>
                <span className={`text-[10px] font-bold ${dxyItem.change >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {dxyItem.change >= 0 ? '+' : ''}{dxyItem.changePercent}%
                </span>
              </div>
            )}

            {vixItem && (
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">VIX:</span>
                <span className="font-bold text-white">{vixItem.price.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
            Tác động VN: Tích cực (Tỷ giá dịu, SBV nới lỏng)
          </div>
        </div>
      )}

      {/* ── 2. Full Content (Chỉ hiển thị khi !isCollapsed) ── */}
      {!isCollapsed && (
        <div className="space-y-6 transition-opacity duration-200">
          {/* ── Bento 2.0 Asymmetric Macro Hub (3 Cards: 4 cols - 4 cols - 4 cols) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* ── CARD 1: CHỨNG KHOÁN MỸ - WALL STREET (4 Cột) ── */}
            <div className="lg:col-span-4 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all hover:-translate-y-0.5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <ChartLineUp className="w-5 h-5" weight="bold" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider">Chứng Khoán Mỹ (Live)</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  NYSE / NASDAQ
                </span>
              </div>

              {/* 3 Main US Indices */}
              <div className="space-y-2.5 font-mono">
                {equityIndices.map((idx) => {
                  const isUp = idx.change >= 0;
                  return (
                    <div
                      key={idx.symbol}
                      className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-zinc-100 block">{idx.name}</span>
                        <span className="text-[10px] text-zinc-500">{idx.note}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-white block">
                          {idx.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isUp ? <TrendUp size={11} weight="bold" /> : <TrendDown size={11} weight="bold" />}
                          {isUp ? '+' : ''}{idx.changePercent}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>Nguồn dữ liệu:</span>
                <span className="text-zinc-300 font-bold">Yahoo Finance Live API</span>
              </div>
            </div>

            {/* ── CARD 2: DXY & US 10Y TREASURY YIELD (4 Cột) ── */}
            <div className="lg:col-span-4 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all hover:-translate-y-0.5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2 text-cyan-400">
                  <CurrencyDollar className="w-5 h-5" weight="bold" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider">Tỷ Giá DXY & Lợi Suất US 10Y</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                  BOND & FX
                </span>
              </div>

              {/* DXY & US 10Y Dual Display */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                {dxyItem && (
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-semibold">Chỉ Số DXY (USD Index)</span>
                      <span className="text-2xl font-black text-cyan-400 mt-1 block">{dxyItem.price.toFixed(2)}</span>
                    </div>
                    <span className={`text-[10px] font-bold flex items-center mt-2 ${dxyItem.change >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {dxyItem.change >= 0 ? '+' : ''}{dxyItem.changePercent}% trong ngày
                    </span>
                  </div>
                )}

                {tnxItem && (
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-semibold">Lợi Suất US 10Y</span>
                      <span className="text-2xl font-black text-amber-400 mt-1 block">{tnxItem.price.toFixed(2)}%</span>
                    </div>
                    <span className={`text-[10px] font-bold flex items-center mt-2 ${tnxItem.change >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {tnxItem.change >= 0 ? '+' : ''}{tnxItem.changePercent}% trong ngày
                    </span>
                  </div>
                )}
              </div>

              {/* US Inflation Summary */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 font-mono text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px]">Lạm phát CPI Mỹ ({usInflation.period}):</span>
                  <span className="text-white font-bold">{usInflation.cpiYoY}% (Lõi: {usInflation.coreCpiYoY}%)</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, (usInflation.fedTarget / usInflation.cpiYoY) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Mục tiêu Fed: {usInflation.fedTarget}%</span>
                  <span>Kỳ ra CPI tới: {usInflation.nextReleaseDate}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>Ảnh hưởng:</span>
                <span className="text-zinc-300 font-bold">Quyết định chênh lệch lãi suất USD-VND</span>
              </div>
            </div>

            {/* ── CARD 3: VIX & GLOBAL RISK APPETITE (4 Cột) ── */}
            <div className="lg:col-span-4 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all hover:-translate-y-0.5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <Lightning className="w-5 h-5" weight="bold" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider">Chỉ Số Sợ Hãi VIX & Rủi Ro</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  CBOE VOLATILITY
                </span>
              </div>

              {/* VIX Big Gauge */}
              {vixItem && (() => {
                const isHighRisk = vixItem.price > 25;
                const isModerate = vixItem.price >= 18 && vixItem.price <= 25;
                return (
                  <div className="space-y-3 font-mono">
                    <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-zinc-400 block font-semibold">Chỉ Số CBOE VIX:</span>
                        <span className="text-3xl font-black text-white mt-1 block">{vixItem.price.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block border ${
                          isHighRisk
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : isModerate
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {isHighRisk ? 'Rủi Ro Cao' : isModerate ? 'Tâm Lý Ổn Định' : 'Hưng Phấn / Thấp'}
                        </span>
                        <span className="text-[10px] text-zinc-500 block mt-1">Ngưỡng an toàn: &lt; 20</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Mức độ biến động toàn cầu:</span>
                        <span className="font-bold text-zinc-200">{vixItem.price < 20 ? 'Thấp (Bình thường)' : 'Biến động mạnh'}</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isHighRisk ? 'bg-rose-500' : isModerate ? 'bg-amber-400' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, (vixItem.price / 40) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>Dòng vốn ngoại FII:</span>
                <span className="text-emerald-400 font-bold">Hưởng lợi khi VIX ổn định</span>
              </div>
            </div>

          </div>

          {/* ── 3. Vietnam Macro Impact Barometer (Ma trận Tác động Việt Nam) ── */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" weight="fill" />
              <span>MA TRẬN ĐÁNH GIÁ TÁC ĐỘNG VĨ MÔ QUỐC TẾ ĐẾN KINH TẾ & TTCK VIỆT NAM</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              {vietnamImpact.map((item, idx) => {
                const isEmerald = item.statusColor === 'emerald';
                const isAmber = item.statusColor === 'amber';
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-2 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
                      <span className="text-xs font-bold text-zinc-200">{item.pillar}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isEmerald
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : isAmber
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white tracking-tight">{item.headline}</h4>
                      <p className="text-[11px] font-sans text-zinc-400 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
});
USGlobalMacroSection.displayName = 'USGlobalMacroSection';
