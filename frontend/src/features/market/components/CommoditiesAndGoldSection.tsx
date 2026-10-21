'use client';

import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Coins, 
  Bank, 
  ArrowsClockwise, 
  TrendUp, 
  TrendDown, 
  MagnifyingGlass, 
  Lightning, 
  ShieldCheck,
  CheckCircle,
  CaretRight
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

interface CommodityItem {
  id: string;
  name: string;
  category: 'oil' | 'gold_world' | 'gold_vn' | 'metal' | 'currency';
  price: number | string;
  unit: string;
  change: number;
  changePercent?: number;
  buyPrice?: number;
  sellPrice?: number;
  spread?: number;
  brand?: string;
  updatedAt: string;
  isRealtime: boolean;
}

interface BankRateItem {
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

export const CommoditiesAndGoldSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'commodities' | 'gold_vn' | 'bank_rates'>('commodities');
  const [commodities, setCommodities] = useState<CommodityItem[]>([]);
  const [bankRates, setBankRates] = useState<{ counter: BankRateItem[]; online: BankRateItem[]; updateTime: string }>({
    counter: [],
    online: [],
    updateTime: '',
  });
  const [rateType, setRateType] = useState<'online' | 'counter'>('online');
  const [selectedTerm, setSelectedTerm] = useState<'rate1M' | 'rate3M' | 'rate6M' | 'rate12M' | 'rate18M' | 'rate24M' | 'rate36M'>('rate12M');
  const [bankSearch, setBankSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [lastDate, setLastDate] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resComm, resBank] = await Promise.all([
        fetch('/api/macro/commodities', { cache: 'no-store' }),
        fetch('/api/macro/bank-rates', { cache: 'no-store' }),
      ]);

      if (resComm.ok) {
        const commJson = await resComm.json();
        if (commJson.success) setCommodities(commJson.data);
      }

      if (resBank.ok) {
        const bankJson = await resBank.json();
        if (bankJson.success) setBankRates(bankJson.data);
      }

      const now = new Date();
      setLastRefreshed(now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }));
      setLastDate(now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }));
    } catch (err) {
      console.error('Lỗi tải dữ liệu hàng hóa & lãi suất:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
    // Auto-refresh commodities every 15s for continuous realtime updates
    const timer = setInterval(fetchData, 15000);
    return () => clearInterval(timer);
  }, []);

  const globalItems = commodities.filter((c) => c.category !== 'gold_vn');
  const vnGoldItems = commodities.filter((c) => c.category === 'gold_vn');

  const currentBankList = rateType === 'online' ? bankRates.online : bankRates.counter;
  const filteredBanks = currentBankList.filter((b) =>
    b.bank.toLowerCase().includes(bankSearch.toLowerCase().trim())
  );

  const sortedBanks = [...filteredBanks].sort((a, b) => {
    const valA = parseFloat(a[selectedTerm] || '0') || 0;
    const valB = parseFloat(b[selectedTerm] || '0') || 0;
    return valB - valA;
  });

  const termLabels = {
    rate1M: '1 Tháng',
    rate3M: '3 Tháng',
    rate6M: '6 Tháng',
    rate12M: '12 Tháng (Phổ biến)',
    rate18M: '18 Tháng',
    rate24M: '24 Tháng',
    rate36M: '36 Tháng',
  };

  return (
    <div suppressHydrationWarning className="p-6 md:p-8 bg-zinc-950/90 border border-zinc-800/80 rounded-3xl backdrop-blur-2xl space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Accent Blur */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Coins className="w-5 h-5" weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono font-black text-base sm:text-lg text-zinc-100 tracking-tight whitespace-nowrap">
                GIÁ DẦU, GIÁ VÀNG & LÃI SUẤT TIẾT KIỆM
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                REAL DATA 100%
              </span>
              <span suppressHydrationWarning className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1.5 shadow-inner shrink-0 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Cập nhật {mounted && (lastDate || lastRefreshed) ? `${lastDate ? `ngày ${lastDate}` : ''} ${lastRefreshed ? `lúc ${lastRefreshed}` : ''}`.trim() : 'theo thời gian thực'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 truncate">
              Dữ liệu năng lượng quốc tế theo thời gian thực & biểu giá vàng, lãi suất ngân hàng 24HMoney
            </p>
          </div>
        </div>

        {/* Right Action Tools: Tabs & Refresh (Always in one line, perfectly aligned) */}
        <div className="flex items-center gap-2 shrink-0 self-start lg:self-auto overflow-x-auto max-w-full pb-1 lg:pb-0 scrollbar-none">
          <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl shrink-0 whitespace-nowrap select-none">
            <button
              onClick={() => setActiveTab('commodities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'commodities'
                  ? 'bg-zinc-800 text-amber-400 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Flame size={14} weight="fill" className={activeTab === 'commodities' ? 'text-amber-400' : ''} />
              Dầu & Vàng Thế Giới
            </button>
            <button
              onClick={() => setActiveTab('gold_vn')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'gold_vn'
                  ? 'bg-zinc-800 text-yellow-400 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Coins size={14} weight="fill" className={activeTab === 'gold_vn' ? 'text-yellow-400' : ''} />
              <span>Vàng Trong Nước</span>
              <span className="hidden xl:inline text-[10px] text-zinc-500 font-normal">(SJC/DOJI)</span>
            </button>
            <button
              onClick={() => setActiveTab('bank_rates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'bank_rates'
                  ? 'bg-zinc-800 text-emerald-400 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bank size={14} weight="fill" className={activeTab === 'bank_rates' ? 'text-emerald-400' : ''} />
              Lãi Suất Tiết Kiệm
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            title="Làm mới dữ liệu thật"
            className="p-2 h-9 w-9 flex items-center justify-center shrink-0 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-50 shadow-sm"
          >
            <ArrowsClockwise size={16} className={loading ? 'animate-spin text-emerald-400' : ''} />
          </button>
        </div>
      </div>

      {/* ── TAB 1: DẦU & VÀNG THẾ GIỚI (REALTIME) ── */}
      {activeTab === 'commodities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Lightning size={14} weight="fill" />
              Dữ liệu trực tuyến từ sàn NYMEX / COMEX / ICE (Cập nhật realtime mỗi 30s)
            </span>
            {lastRefreshed && <span>Cập nhật lúc: {lastRefreshed}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {globalItems.map((item) => {
              const isUp = item.change >= 0;
              return (
                <motion.div
                  key={item.id}
                  whileHover={{ y: -2 }}
                  className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-zinc-300">{item.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      REALTIME
                    </span>
                  </div>

                  <div className="space-y-1 font-mono">
                    <div className="text-3xl font-black text-white tracking-tight">
                      {typeof item.price === 'number' ? item.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : item.price}
                      <span className="text-xs font-normal text-zinc-400 ml-1.5">{item.unit}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className={`flex items-center gap-0.5 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isUp ? <TrendUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}
                        {isUp ? '+' : ''}{item.change}
                      </span>
                      {item.changePercent !== undefined && (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] ${isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {isUp ? '+' : ''}{item.changePercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span>{item.category === 'currency' ? 'Chỉ số tiền tệ (ICE)' : 'Hợp đồng tương lai'}</span>
                    <span className="text-zinc-400 font-semibold">{item.updatedAt}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: VÀNG TRONG NƯỚC (SJC, DOJI, PNJ) ── */}
      {activeTab === 'gold_vn' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-zinc-400">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <ShieldCheck size={16} weight="fill" />
              Biểu giá niêm yết chính thức hôm nay tại các đơn vị kinh doanh vàng lớn
            </span>
            <span>Nguồn: 24HMoney & Doanh nghiệp kinh doanh vàng</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vnGoldItems.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ y: -2 }}
                className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-3 font-mono"
              >
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {item.brand}
                    </span>
                    <h3 className="font-bold text-zinc-200 text-xs tracking-tight line-clamp-1">{item.name}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-400 font-bold block uppercase">Mua Vào</span>
                    <span className="text-base font-black text-emerald-400">
                      {(item.buyPrice ? item.buyPrice / 1_000_000 : 0).toFixed(2)}
                      <span className="text-[10px] text-zinc-500 font-normal ml-1">Tr</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-400 font-bold block uppercase">Bán Ra</span>
                    <span className="text-base font-black text-rose-400">
                      {(item.sellPrice ? item.sellPrice / 1_000_000 : 0).toFixed(2)}
                      <span className="text-[10px] text-zinc-500 font-normal ml-1">Tr</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 text-zinc-400 border-t border-zinc-800/60">
                  <span>Chênh lệch Mua - Bán:</span>
                  <span className="font-bold text-zinc-200">
                    {item.spread ? (item.spread / 1_000_000).toFixed(2) : '-'} triệu VNĐ/lượng
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: LÃI SUẤT TIẾT KIỆM NGÂN HÀNG ── */}
      {activeTab === 'bank_rates' && (
        <div className="space-y-5">
          {/* Controls Bar: Type (Online vs Counter) + Term Selector + Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            {/* Toggle Online vs Counter */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase">Hình thức:</span>
              <div className="flex p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                <button
                  onClick={() => setRateType('online')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    rateType === 'online'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Gửi Online (Lãi cao hơn)
                </button>
                <button
                  onClick={() => setRateType('counter')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    rateType === 'counter'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Gửi Tại Quầy
                </button>
              </div>
            </div>

            {/* Term Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase mr-1">Kỳ hạn so sánh:</span>
              {(['rate6M', 'rate12M', 'rate18M', 'rate24M', 'rate36M'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTerm(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                    selectedTerm === t
                      ? 'bg-zinc-800 text-zinc-100 border-zinc-600'
                      : 'bg-zinc-950/60 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {termLabels[t]}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <MagnifyingGlass className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên ngân hàng (VCB, BIDV...)"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 w-full lg:w-64"
              />
            </div>
          </div>

          {/* Top 3 Highlight Banners */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sortedBanks.slice(0, 3).map((b, idx) => (
              <div
                key={b.bank}
                className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900/90 to-zinc-950 border border-emerald-500/20 relative overflow-hidden"
              >
                <div className="flex items-center justify-between font-mono mb-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    TOP #{idx + 1} LÃI SUẤT CAO NHẤT
                  </span>
                  <span className="text-[11px] text-zinc-400">{termLabels[selectedTerm]}</span>
                </div>
                <div className="flex items-baseline justify-between font-mono mt-1">
                  <h4 className="font-bold text-base text-zinc-100">{b.bank}</h4>
                  <span className="text-2xl font-black text-emerald-400">{b[selectedTerm]}%</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400 mt-2 pt-2 border-t border-zinc-800/60 flex justify-between">
                  <span>6T: {b.rate6M}%</span>
                  <span>12T: {b.rate12M}%</span>
                  <span>18T: {b.rate18M || '-'}%</span>
                  <span>24T: {b.rate24M}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Full Bank Rates Table */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden font-mono text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800/80 text-[11px]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Ngân Hàng</th>
                    <th className="py-3 px-3 text-right">01 Tháng</th>
                    <th className="py-3 px-3 text-right">03 Tháng</th>
                    <th className="py-3 px-3 text-right font-bold text-zinc-200">06 Tháng</th>
                    <th className="py-3 px-3 text-right font-bold text-emerald-400">12 Tháng</th>
                    <th className="py-3 px-3 text-right text-zinc-200">18 Tháng</th>
                    <th className="py-3 px-3 text-right">24 Tháng</th>
                    <th className="py-3 px-3 text-right text-zinc-300">36 Tháng</th>
                    <th className="py-3 px-4 text-center">Xếp Hạng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {sortedBanks.map((b, idx) => {
                    const isBig4 = /Vietcombank|BIDV|VietinBank|Agribank/i.test(b.bank);
                    return (
                      <tr key={b.bank} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-zinc-200 flex items-center gap-2">
                          <span>{b.bank}</span>
                          {isBig4 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                              BIG 4
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-400">{b.rate1M}%</td>
                        <td className="py-2.5 px-3 text-right text-zinc-400">{b.rate3M}%</td>
                        <td className="py-2.5 px-3 text-right text-zinc-200 font-semibold">{b.rate6M}%</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-400 text-sm">
                          {b.rate12M}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-200">{b.rate18M ? `${b.rate18M}%` : '-'}</td>
                        <td className="py-2.5 px-3 text-right text-zinc-300">{b.rate24M}%</td>
                        <td className="py-2.5 px-3 text-right text-zinc-400">{b.rate36M ? `${b.rate36M}%` : '-'}</td>
                        <td className="py-2.5 px-4 text-center text-[10px] text-zinc-500 font-bold">
                          #{idx + 1}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {bankRates.updateTime && (
              <div className="p-3 bg-zinc-900/40 border-t border-zinc-800/60 text-right text-[11px] text-zinc-500">
                Biểu lãi suất cập nhật lúc: {bankRates.updateTime} (24HMoney)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
