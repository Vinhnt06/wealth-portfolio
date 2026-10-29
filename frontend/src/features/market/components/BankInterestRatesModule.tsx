'use client';

import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  Bank,
  MagnifyingGlass,
  ArrowsClockwise,
  ShieldCheck,
  TrendUp,
  Sparkle,
  CheckCircle,
  CaretRight,
  Buildings,
} from '@phosphor-icons/react';

export interface BankRateItem {
  bank: string;
  type: 'counter' | 'online';
  rate1M: string;
  rate3M: string;
  rate6M: string;
  rate12M: string;
  rate18M?: string;
  rate24M: string;
  rate36M?: string;
}

const TERM_LABELS = {
  rate1M: '01 Tháng',
  rate3M: '03 Tháng',
  rate6M: '06 Tháng',
  rate12M: '12 Tháng (Chuẩn)',
  rate18M: '18 Tháng',
  rate24M: '24 Tháng',
  rate36M: '36 Tháng',
} as const;

type TermKey = keyof typeof TERM_LABELS;

export const BankInterestRatesModule: React.FC = memo(() => {
  const [rateType, setRateType] = useState<'online' | 'counter'>('online');
  const [selectedTerm, setSelectedTerm] = useState<TermKey>('rate12M');
  const [bankGroupFilter, setBankGroupFilter] = useState<'all' | 'big4' | 'private'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratesData, setRatesData] = useState<{
    counter: BankRateItem[];
    online: BankRateItem[];
    updateTime: string;
  }>({
    counter: [],
    online: [],
    updateTime: '',
  });
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  const fetchRates = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const url = forceRefresh
        ? `/api/macro/bank-rates?refresh=true&t=${Date.now()}`
        : '/api/macro/bank-rates';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setRatesData({
            counter: json.data.counter || [],
            online: json.data.online || [],
            updateTime: json.data.updateTime || '',
          });
          setLastSyncTime(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
        }
      }
    } catch (err) {
      console.error('Lỗi nạp dữ liệu lãi suất ngân hàng realtime:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchRates(false);
    // Auto-refresh every 30s for realtime updates
    const timer = setInterval(() => fetchRates(false), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentList = rateType === 'online' ? ratesData.online : ratesData.counter;

  // Filter and Sort banks
  const filteredBanks = useMemo(() => {
    return currentList.filter((b) => {
      const isBig4 = /Vietcombank|BIDV|VietinBank|Agribank/i.test(b.bank);
      if (bankGroupFilter === 'big4' && !isBig4) return false;
      if (bankGroupFilter === 'private' && isBig4) return false;
      if (searchQuery.trim()) {
        return b.bank.toLowerCase().includes(searchQuery.toLowerCase().trim());
      }
      return true;
    });
  }, [currentList, bankGroupFilter, searchQuery]);

  // Sort descending by selected term rate
  const sortedBanks = useMemo(() => {
    return [...filteredBanks].sort((a, b) => {
      const rateA = parseFloat(a[selectedTerm] || '0') || 0;
      const rateB = parseFloat(b[selectedTerm] || '0') || 0;
      return rateB - rateA;
    });
  }, [filteredBanks, selectedTerm]);

  // Top 3 banks with highest rate for the selected term
  const top3Banks = useMemo(() => {
    return [...currentList]
      .sort((a, b) => (parseFloat(b[selectedTerm] || '0') || 0) - (parseFloat(a[selectedTerm] || '0') || 0))
      .slice(0, 3);
  }, [currentList, selectedTerm]);

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden font-mono" suppressHydrationWarning>
      {/* ── Subheader ── */}
      <div className="px-5 py-3.5 border-b border-[#1a1a1a] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d0d0d]" suppressHydrationWarning>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Bank className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
            <span>BẢNG SO SÁNH LÃI SUẤT TIẾT KIỆM NGÂN HÀNG (VIETNAM BANK SAVINGS RATES)</span>
          </h2>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            REALTIME (30s)
          </span>
          <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <ShieldCheck className="w-3 h-3" />
            CHÍNH THỨC TỪ HỆ THỐNG NHTM
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500" suppressHydrationWarning>
          <span suppressHydrationWarning>
            {!mounted
              ? 'Đang kết nối...'
              : lastSyncTime
              ? `Đồng bộ: ${lastSyncTime}`
              : ratesData.updateTime
              ? `Cập nhật: ${ratesData.updateTime}`
              : 'Đang tải...'}
          </span>
          <button
            onClick={() => fetchRates(true)}
            disabled={loading}
            className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
            title="Lấy dữ liệu realtime ngay lập tức"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Top 3 Highest Yield Highlight Cards ── */}
      <div className="p-4 sm:p-5 border-b border-[#1a1a1a] bg-[#0c0c0c]">
        <div className="flex items-center justify-between mb-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 text-zinc-300 font-semibold">
            <TrendUp className="w-4 h-4 text-emerald-400" />
            Top 3 Ngân Hàng Lãi Suất Cao Nhất Kỳ Hạn {TERM_LABELS[selectedTerm]} ({rateType === 'online' ? 'Online' : 'Tại quầy'})
          </span>
          <span className="text-[11px] text-zinc-500">Tự động sắp xếp theo thứ hạng</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {top3Banks.map((b, idx) => {
            const isBig4 = /Vietcombank|BIDV|VietinBank|Agribank/i.test(b.bank);
            return (
              <div
                key={b.bank}
                className="p-3.5 rounded-lg bg-[#141414] border border-[#222222] hover:border-zinc-700 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      TOP #{idx + 1}
                    </span>
                    {isBig4 && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        BIG 4 CHÍNH THỨC
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm text-zinc-100">{b.bank}</h3>
                  <div className="text-[10px] text-zinc-500 mt-0.5 flex gap-2">
                    <span>6T: {b.rate6M}%</span>
                    <span>12T: {b.rate12M}%</span>
                    <span>24T: {b.rate24M}%</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xl font-black text-emerald-400 tabular-nums">
                    {b[selectedTerm]}%
                  </span>
                  <div className="text-[10px] text-zinc-500">/ năm</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Filter Controls Bar ── */}
      <div className="p-4 border-b border-[#1a1a1a] flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs bg-[#0f0f0f]">
        {/* Rate Type (Online vs Counter) */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 uppercase text-[11px]">Kênh gửi:</span>
          <div className="flex p-0.5 bg-black border border-zinc-800 rounded-lg">
            <button
              onClick={() => setRateType('online')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                rateType === 'online'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Gửi Online (Lãi cao hơn)
            </button>
            <button
              onClick={() => setRateType('counter')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                rateType === 'counter'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tại Quầy Giao Dịch
            </button>
          </div>
        </div>

        {/* Group Filter (All / Big 4 Official / Private) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-zinc-500 uppercase text-[11px] mr-1">Nhóm:</span>
          <button
            onClick={() => setBankGroupFilter('all')}
            className={`px-2.5 py-1 rounded text-[11px] border transition-all ${
              bankGroupFilter === 'all'
                ? 'bg-zinc-800 text-zinc-100 border-zinc-700 font-semibold'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            Tất cả ({currentList.length})
          </button>
          <button
            onClick={() => setBankGroupFilter('big4')}
            className={`px-2.5 py-1 rounded text-[11px] border transition-all flex items-center gap-1 ${
              bankGroupFilter === 'big4'
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 font-bold'
                : 'text-amber-400/80 border-amber-500/20 hover:text-amber-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>🏛️ Big 4 Nhà Nước (Chính Thức)</span>
          </button>
          <button
            onClick={() => setBankGroupFilter('private')}
            className={`px-2.5 py-1 rounded text-[11px] border transition-all ${
              bankGroupFilter === 'private'
                ? 'bg-zinc-800 text-zinc-100 border-zinc-700 font-semibold'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            NHTM Cổ Phần
          </button>
        </div>

        {/* Term Selector */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-zinc-500 uppercase text-[11px] mr-1">Kỳ hạn:</span>
          {(['rate1M', 'rate3M', 'rate6M', 'rate12M', 'rate18M', 'rate24M', 'rate36M'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTerm(t)}
              className={`px-2 py-0.5 rounded text-[11px] border transition-all ${
                selectedTerm === t
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold'
                  : 'text-zinc-400 border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              {t === 'rate12M' ? '12T (Chuẩn)' : t.replace('rate', '')}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-56">
          <MagnifyingGlass className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm ngân hàng (VCB, BIDV...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-full"
          />
        </div>
      </div>

      {/* ── Bank Rates Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-[11px] text-zinc-500 uppercase tracking-wider bg-[#0a0a0a]">
              <th className="py-2.5 px-4 font-medium">Ngân Hàng</th>
              <th className="py-2.5 px-3 font-medium text-right">01T</th>
              <th className="py-2.5 px-3 font-medium text-right">03T</th>
              <th className="py-2.5 px-3 font-medium text-right font-semibold text-zinc-300">06T</th>
              <th className="py-2.5 px-3 font-medium text-right font-bold text-emerald-400">12T (Chuẩn)</th>
              <th className="py-2.5 px-3 font-medium text-right text-zinc-300">18T</th>
              <th className="py-2.5 px-3 font-medium text-right">24T</th>
              <th className="py-2.5 px-3 font-medium text-right">36T</th>
              <th className="py-2.5 px-4 font-medium text-center">Phân Loại</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {sortedBanks.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-zinc-500">
                  {loading ? 'Đang tải dữ liệu biểu lãi suất...' : 'Không tìm thấy ngân hàng phù hợp'}
                </td>
              </tr>
            ) : (
              sortedBanks.map((b) => {
                const isBig4 = /Vietcombank|BIDV|VietinBank|Agribank/i.test(b.bank);
                return (
                  <tr
                    key={b.bank}
                    className={`transition-colors ${
                      isBig4
                        ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.07]'
                        : 'hover:bg-[#161616]'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-bold text-zinc-200 flex items-center gap-2">
                      <span className={isBig4 ? 'text-amber-300 font-extrabold' : 'text-zinc-200'}>
                        {b.bank}
                      </span>
                      {isBig4 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-0.5">
                          🏛️ CHÍNH THỨC BIG 4
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">{b.rate1M}%</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">{b.rate3M}%</td>
                    <td className="py-2.5 px-3 text-right text-zinc-200 font-semibold tabular-nums">{b.rate6M}%</td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-400 tabular-nums text-sm">
                      {b.rate12M}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-300 tabular-nums">{b.rate18M ? `${b.rate18M}%` : '-'}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">{b.rate24M}%</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">{b.rate36M ? `${b.rate36M}%` : '-'}</td>
                    <td className="py-2.5 px-4 text-center">
                      {isBig4 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          NHTM Nhà Nước
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500">NHTM Cổ Phần</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

BankInterestRatesModule.displayName = 'BankInterestRatesModule';
