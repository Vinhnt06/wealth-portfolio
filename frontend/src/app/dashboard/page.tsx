'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { MarketPulseRibbon } from '../../features/market/components/MarketPulseRibbon';
import { HeroMarketBento } from '../../features/market/components/HeroMarketBento';
import { UnifiedMacroMatrix } from '../../features/market/components/UnifiedMacroMatrix';

const BankInterestRatesModule = dynamic(
  () =>
    import('../../features/market/components/BankInterestRatesModule').then(
      (m) => m.BankInterestRatesModule
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6 h-64 flex items-center justify-center font-mono text-xs text-zinc-500">
        Đang nạp bảng lãi suất ngân hàng realtime...
      </div>
    ),
  }
);

import {
  TrendUp,
  Scales,
  ArrowRight,
  ShieldCheck,
  Lightning,
  ChartLineUp,
  Table,
  CheckCircle,
  Bank,
} from '@phosphor-icons/react';

// Real liquid blue-chip watchlist for quick financial valuation preview
const BLUECHIP_WATCHLIST = [
  { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', sector: 'Thép & Kim loại' },
  { symbol: 'FPT', name: 'Tập đoàn FPT', sector: 'Công nghệ thông tin' },
  { symbol: 'VCB', name: 'Vietcombank', sector: 'Ngân hàng' },
  { symbol: 'MWG', name: 'Thế Giới Di Động', sector: 'Bán lẻ' },
  { symbol: 'VHM', name: 'Vinhomes', sector: 'Bất động sản' },
  { symbol: 'SSI', name: 'Chứng khoán SSI', sector: 'Dịch vụ tài chính' },
];

export default function DashboardPage() {
  const [valuationData, setValuationData] = useState<Record<string, any>>({});
  const [loadingValuations, setLoadingValuations] = useState<boolean>(true);

  // Fetch real financial valuation for watchlist
  useEffect(() => {
    let isMounted = true;
    async function loadQuickValuations() {
      try {
        const results = await Promise.allSettled(
          BLUECHIP_WATCHLIST.map(async (item) => {
            const res = await fetch(`/api/market/financials?symbol=${item.symbol}`, { cache: 'no-store' });
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                return { symbol: item.symbol, data: json.data };
              }
            }
            return null;
          })
        );

        if (!isMounted) return;
        const map: Record<string, any> = {};
        results.forEach((r) => {
          if (r.status === 'fulfilled' && r.value) {
            map[r.value.symbol] = r.value.data;
          }
        });
        setValuationData(map);
      } catch (err) {
        console.error('Lỗi fetch quick valuations:', err);
      } finally {
        if (isMounted) setLoadingValuations(false);
      }
    }

    loadQuickValuations();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1536px] mx-auto pb-16 font-sans">
        
        {/* ── 1. Top Real-time Market Pulse Ribbon ── */}
        <MarketPulseRibbon />

        {/* ── 2. Terminal Intelligence Header (Quiet, Utilitarian, Zero AI-Slop) ── */}
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">
                TERMINAL INTELLIGENCE & MARKET VALUATION
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                HỆ THỐNG DỮ LIỆU CHÍNH THỨC 100%
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Hệ thống giám sát dòng tiền thực, định giá P/E, P/B, PEG Peter Lynch, biểu lãi suất ngân hàng và vĩ mô tích hợp.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 font-mono text-xs">
            <Link
              href="/market"
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <span>Live Terminal</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
            </Link>
            <Link
              href="/market?symbol=HPG"
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Scales className="w-3.5 h-3.5" />
              <span>Định Giá Cổ Phiếu</span>
            </Link>
          </div>
        </div>

        {/* ── 3. Hero Asymmetric Market Bento (68% Chart / 32% Opportunities Radar) ── */}
        <section>
          <HeroMarketBento />
        </section>

        {/* ── 4. Unified Macro & Commodities Matrix (3-Column Bento) ── */}
        <section>
          <UnifiedMacroMatrix />
        </section>

        {/* ── 5. Vietnam Bank Savings Interest Rates Module (Chính Thức Hệ Thống NHTM & Big 4) ── */}
        <section>
          <BankInterestRatesModule />
        </section>

        {/* ── 6. Quick Valuation Screener: Real Blue-chip Valuation Benchmarks ── */}
        <section className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#1a1a1a] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0d0d0d]">
            <div className="flex items-center gap-2">
              <Scales className="w-4 h-4 text-emerald-400" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-200">
                BẢNG ĐỊNH GIÁ & TÀI CHÍNH CỔ PHIẾU TIÊU BIỂU (REAL FINANCIAL VALUATION)
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <ShieldCheck className="w-3 h-3" />
                BCTC KIỂM TOÁN CHÍNH THỨC
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
              <span>Nguồn: Vietcap IQ & Mô hình Peter Lynch</span>
              <Link
                href="/market"
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-semibold"
              >
                <span>Xem tất cả mã</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[11px] text-zinc-500 uppercase tracking-wider bg-[#0a0a0a]">
                  <th className="py-2.5 px-4 font-medium">Mã CK</th>
                  <th className="py-2.5 px-4 font-medium">Tên Doanh Nghiệp</th>
                  <th className="py-2.5 px-4 font-medium">Ngành</th>
                  <th className="py-2.5 px-4 font-medium text-right">P/E TTM</th>
                  <th className="py-2.5 px-4 font-medium text-right">P/E Ngành</th>
                  <th className="py-2.5 px-4 font-medium text-right">P/B</th>
                  <th className="py-2.5 px-4 font-medium text-right">P/B Ngành</th>
                  <th className="py-2.5 px-4 font-medium text-right">PEG Peter Lynch</th>
                  <th className="py-2.5 px-4 font-medium text-center">Đánh Giá Định Giá</th>
                  <th className="py-2.5 px-4 font-medium text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a] text-zinc-300">
                {BLUECHIP_WATCHLIST.map((item) => {
                  const val = valuationData[item.symbol];
                  const isLoading = loadingValuations && !val;

                  const pe = val?.valuation?.pe?.value;
                  const sectorPe = val?.valuation?.pe?.sectorBenchmark;
                  const pb = val?.valuation?.pb?.value;
                  const sectorPb = val?.valuation?.pb?.sectorBenchmark;
                  const peg = val?.valuation?.peg?.value;
                  const verdict = val?.valuation?.summaryVerdict;

                  return (
                    <tr
                      key={item.symbol}
                      className="hover:bg-[#161616] transition-colors group"
                    >
                      <td className="py-3 px-4 font-bold text-zinc-100 flex items-center gap-2">
                        <span>{item.symbol}</span>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 font-sans">{item.name}</td>
                      <td className="py-3 px-4 text-zinc-400 font-sans text-[11px]">{item.sector}</td>

                      {/* P/E TTM */}
                      <td className="py-3 px-4 text-right tabular-nums">
                        {isLoading ? (
                          <span className="text-zinc-600">...</span>
                        ) : pe ? (
                          <span className={pe < (sectorPe || 99) ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}>
                            {Number(pe).toFixed(1)}x
                          </span>
                        ) : (
                          <span className="text-zinc-600">N/A</span>
                        )}
                      </td>

                      {/* P/E Sector */}
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-500">
                        {sectorPe ? `${Number(sectorPe).toFixed(1)}x` : '-'}
                      </td>

                      {/* P/B */}
                      <td className="py-3 px-4 text-right tabular-nums">
                        {isLoading ? (
                          <span className="text-zinc-600">...</span>
                        ) : pb ? (
                          <span className={pb < (sectorPb || 99) ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}>
                            {Number(pb).toFixed(2)}x
                          </span>
                        ) : (
                          <span className="text-zinc-600">N/A</span>
                        )}
                      </td>

                      {/* P/B Sector */}
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-500">
                        {sectorPb ? `${Number(sectorPb).toFixed(2)}x` : '-'}
                      </td>

                      {/* PEG */}
                      <td className="py-3 px-4 text-right tabular-nums">
                        {isLoading ? (
                          <span className="text-zinc-600">...</span>
                        ) : peg ? (
                          <span
                            className={
                              peg < 1
                                ? 'text-emerald-400 font-bold'
                                : peg <= 1.5
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }
                          >
                            {Number(peg).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">N/A</span>
                        )}
                      </td>

                      {/* Verdict */}
                      <td className="py-3 px-4 text-center">
                        {isLoading ? (
                          <span className="text-zinc-600 text-[11px]">Đang tính...</span>
                        ) : verdict ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              verdict === 'Định Giá Hấp Dẫn'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : verdict === 'Định Giá Hợp Lý'
                                ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {verdict}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-[10px]">Trung lập</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/market?symbol=${item.symbol}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-zinc-400 group-hover:text-emerald-400 hover:bg-zinc-800/80 rounded transition-colors"
                        >
                          <span>Phân tích</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </DashboardLayout>
  );
}
