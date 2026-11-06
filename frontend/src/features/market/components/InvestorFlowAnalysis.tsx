'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Fish,
  ShieldCheck,
  Users,
  TrendUp,
  TrendDown,
  Info,
  Clock,
  Sparkle,
  ArrowsClockwise,
  Fire,
  Funnel,
  ArrowUpRight,
  ArrowDownRight,
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

export interface OrderItem {
  id: string | number;
  time: string;
  investorType: 'Cá mập' | 'Sói già' | 'Cừu non';
  price: number;
  volume: number;
  value: number;
  type: 'M' | 'B';
}

interface TradesData {
  symbol: string;
  totalTrades: number;
  totalVolume: number;
  totalValue: number;
  netVolume: number;
  thresholds: {
    sharkMin: number;
    wolfMin: number;
    megaWhaleMin?: number;
    description: string;
  };
  summary: {
    netVolume: number;
    sharkNetVol: number;
    wolfNetVol: number;
    sheepNetVol: number;
    sharkBuyVal?: number;
    sharkSellVal?: number;
    sharkNetVal?: number;
    sharkBuyCount?: number;
    sharkSellCount?: number;
    wolfBuyVal?: number;
    wolfSellVal?: number;
    wolfNetVal?: number;
  };
  buy: {
    totalVolume: number;
    totalValue: number;
    shark: { volume: number; value: number; count: number; pct: number };
    wolf: { volume: number; value: number; count: number; pct: number };
    sheep: { volume: number; value: number; count: number; pct: number };
  };
  sell: {
    totalVolume: number;
    totalValue: number;
    shark: { volume: number; value: number; count: number; pct: number };
    wolf: { volume: number; value: number; count: number; pct: number };
    sheep: { volume: number; value: number; count: number; pct: number };
  };
  trades: OrderItem[];
  timestamp: number;
}

export const InvestorFlowAnalysis: React.FC = () => {
  const { selectedSymbol } = useMarketStore();
  const [timeframe, setTimeframe] = useState<'60' | '1D' | 'ALL'>('1D');
  const [activePage, setActivePage] = useState<1 | 2 | 3>(1);
  const [filterInvestor, setFilterInvestor] = useState<'shark' | 'wolf_shark' | 'all'>('shark');
  const [filterSide, setFilterSide] = useState<'all' | 'buy' | 'sell'>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [tradesData, setTradesData] = useState<TradesData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchRealTrades = useCallback(async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/market/trades?symbol=${selectedSymbol}&limit=500`);
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        setTradesData(resJson.data);
        setLastUpdated(new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }));
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu khớp lệnh thật:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    fetchRealTrades();
    const interval = setInterval(fetchRealTrades, 15000); // Tự động làm mới mỗi 15s
    return () => clearInterval(interval);
  }, [fetchRealTrades]);

  // Fallback defaults if loading or no trades yet
  const summary = tradesData?.summary || {
    netVolume: 0,
    sharkNetVol: 0,
    wolfNetVol: 0,
    sheepNetVol: 0,
  };

  const buy = tradesData?.buy || {
    totalVolume: 0,
    totalValue: 0,
    shark: { volume: 0, value: 0, count: 0, pct: 0 },
    wolf: { volume: 0, value: 0, count: 0, pct: 0 },
    sheep: { volume: 0, value: 0, count: 0, pct: 0 },
  };

  const sell = tradesData?.sell || {
    totalVolume: 0,
    totalValue: 0,
    shark: { volume: 0, value: 0, count: 0, pct: 0 },
    wolf: { volume: 0, value: 0, count: 0, pct: 0 },
    sheep: { volume: 0, value: 0, count: 0, pct: 0 },
  };

  const orders: OrderItem[] = tradesData?.trades || [];

  // Shark specific stats
  const sharkStats = useMemo(() => {
    const sharkTrades = orders.filter((o) => o.investorType === 'Cá mập');
    const sharkBuy = sharkTrades.filter((o) => o.type === 'M');
    const sharkSell = sharkTrades.filter((o) => o.type === 'B');

    const totalBuyVal = sharkBuy.reduce((sum, o) => sum + o.value, 0);
    const totalSellVal = sharkSell.reduce((sum, o) => sum + o.value, 0);
    const totalBuyVol = sharkBuy.reduce((sum, o) => sum + o.volume, 0);
    const totalSellVol = sharkSell.reduce((sum, o) => sum + o.volume, 0);
    const netVal = totalBuyVal - totalSellVal;
    const netVol = totalBuyVol - totalSellVol;
    const totalVal = totalBuyVal + totalSellVal;
    const buyPct = totalVal > 0 ? (totalBuyVal / totalVal) * 100 : 50;

    return {
      totalCount: sharkTrades.length,
      buyCount: sharkBuy.length,
      sellCount: sharkSell.length,
      totalBuyVal,
      totalSellVal,
      totalBuyVol,
      totalSellVol,
      netVal,
      netVol,
      buyPct,
      hasTrades: sharkTrades.length > 0,
    };
  }, [orders]);

  const sharkCount = useMemo(() => orders.filter((o) => o.investorType === 'Cá mập').length, [orders]);
  const wolfSharkCount = useMemo(
    () => orders.filter((o) => o.investorType === 'Cá mập' || o.investorType === 'Sói già').length,
    [orders]
  );

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filterInvestor === 'shark' && order.investorType !== 'Cá mập') return false;
      if (
        filterInvestor === 'wolf_shark' &&
        order.investorType !== 'Cá mập' &&
        order.investorType !== 'Sói già'
      )
        return false;
      if (filterSide === 'buy' && order.type !== 'M') return false;
      if (filterSide === 'sell' && order.type !== 'B') return false;
      return true;
    });
  }, [orders, filterInvestor, filterSide]);

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl space-y-4">
      {/* Top Header & Page Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Fish className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-mono font-bold text-xs sm:text-sm text-zinc-100 flex items-center gap-2">
                Phân loại nhà đầu tư
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  {selectedSymbol}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                  DỮ LIỆU THẬT 100%
                </span>
              </h3>
              <div className="group relative cursor-pointer text-zinc-500 hover:text-zinc-300">
                <Info className="w-3.5 h-3.5" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block w-64 p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-200 shadow-2xl z-50 leading-relaxed">
                  <div className="font-bold text-emerald-400 mb-1 border-b border-zinc-700 pb-1">
                    Tiêu chuẩn phân loại theo quy mô lệnh:
                  </div>
                  • <strong className="text-emerald-400">Cá mập</strong>: Lệnh &ge; 1 Tỷ VNĐ
                  <br />• <strong className="text-cyan-400">Sói già</strong>: Lệnh 500 Triệu &ndash; 1 Tỷ VNĐ
                  <br />• <strong className="text-amber-400">Cừu non</strong>: Lệnh &lt; 500 Triệu VNĐ
                  <div className="mt-1.5 pt-1 border-t border-zinc-800 text-[9px] text-zinc-400">
                    Phân tích từ sổ khớp lệnh chi tiết từng tick trong ngày.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-zinc-400 font-mono">Dòng tiền thông minh (Real Order Flow)</span>
              {lastUpdated && (
                <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> {lastUpdated}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Page Toggles & Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRealTrades()}
            disabled={loading}
            title="Làm mới dữ liệu khớp lệnh thật"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[10px] font-mono">
            {(['60', '1D', 'ALL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2 py-0.5 rounded ${
                  timeframe === t
                    ? 'bg-zinc-800 text-emerald-400 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t === '60' ? "60'" : t === '1D' ? '1D' : 'Tất cả'}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[10px] font-mono">
            {([1, 2, 3] as const).map((page) => (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`w-6 h-5 rounded flex items-center justify-center font-bold transition-all ${
                  activePage === page
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area based on Active Page */}
      {activePage === 1 && (
        <div className="space-y-4">
          {/* Visual Accumulation Flow Bar */}
          <div className="p-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-zinc-400">KLGD ròng tích lũy (Khớp thật):</span>
              <span className={`font-bold ${summary.netVolume >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {summary.netVolume >= 0 ? '+' : ''}{summary.netVolume.toLocaleString('vi-VN')} CP
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-zinc-400 block font-semibold">Cá mập (&ge;1 Tỷ)</span>
                <span className={`text-xs font-bold mt-0.5 block ${summary.sharkNetVol >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {summary.sharkNetVol >= 0 ? '+' : ''}{summary.sharkNetVol.toLocaleString('vi-VN')}
                </span>
                <span className="text-[9px] text-emerald-500/80">
                  {summary.sharkNetVol >= 0 ? 'Mua ròng' : 'Bán ròng'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-zinc-400 block font-semibold">Sói già (500Tr-1 Tỷ)</span>
                <span className={`text-xs font-bold mt-0.5 block ${summary.wolfNetVol >= 0 ? 'text-cyan-400' : 'text-orange-400'}`}>
                  {summary.wolfNetVol >= 0 ? '+' : ''}{summary.wolfNetVol.toLocaleString('vi-VN')}
                </span>
                <span className="text-[9px] text-cyan-500/80">
                  {summary.wolfNetVol >= 0 ? 'Mua ròng' : 'Bán ròng'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-zinc-400 block font-semibold">Cừu non (&lt;500Tr)</span>
                <span className={`text-xs font-bold mt-0.5 block ${summary.sheepNetVol >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {summary.sheepNetVol >= 0 ? '+' : ''}{summary.sheepNetVol.toLocaleString('vi-VN')}
                </span>
                <span className="text-[9px] text-amber-500/80">
                  {summary.sheepNetVol >= 0 ? 'Nhỏ lẻ mua' : 'Nhỏ lẻ bán'}
                </span>
              </div>
            </div>
          </div>

          {/* Two Side-by-Side Breakdown Cards: Mua vs Bán */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mua Side Breakdown */}
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <TrendUp className="w-3.5 h-3.5" />
                  Tỷ lệ MUA Chủ Động
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {buy.totalVolume > 0 ? `${buy.totalVolume.toLocaleString('vi-VN')} CP` : '0 CP'}
                </span>
              </div>

              {/* Progress segments */}
              <div className="space-y-2 text-[11px] font-mono">
                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Cá mập (&ge; 1 Tỷ)
                    </span>
                    <span className="font-bold text-emerald-400">{buy.shark.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, buy.shark.pct)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      Sói già (500Tr &ndash; 1 Tỷ)
                    </span>
                    <span className="font-bold text-cyan-400">{buy.wolf.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${Math.min(100, buy.wolf.pct)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Cừu non (&lt; 500Tr)
                    </span>
                    <span className="font-bold text-amber-400">{buy.sheep.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${Math.min(100, buy.sheep.pct)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bán Side Breakdown */}
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
                <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1.5">
                  <TrendDown className="w-3.5 h-3.5" />
                  Tỷ lệ BÁN Chủ Động
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {sell.totalVolume > 0 ? `${sell.totalVolume.toLocaleString('vi-VN')} CP` : '0 CP'}
                </span>
              </div>

              {/* Progress segments */}
              <div className="space-y-2 text-[11px] font-mono">
                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Cá mập (&ge; 1 Tỷ)
                    </span>
                    <span className="font-bold text-rose-400">{sell.shark.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${Math.min(100, sell.shark.pct)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      Sói già (500Tr &ndash; 1 Tỷ)
                    </span>
                    <span className="font-bold text-orange-400">{sell.wolf.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-orange-400 transition-all duration-500" style={{ width: `${Math.min(100, sell.wolf.pct)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-zinc-400" />
                      Cừu non (&lt; 500Tr)
                    </span>
                    <span className="font-bold text-zinc-300">{sell.sheep.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-zinc-400 transition-all duration-500" style={{ width: `${Math.min(100, sell.sheep.pct)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page 2: Summary Breakdown Cards */}
      {activePage === 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-emerald-400 mb-2 font-bold">
              <Fish className="w-4 h-4" />
              <span>Cá mập (&ge; 1 Tỷ)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tổng lệnh mua: <strong className="text-emerald-400">{buy.shark.count} lệnh</strong> ({buy.shark.volume.toLocaleString('vi-VN')} CP).
              <br />
              Tổng lệnh bán: <strong className="text-rose-400">{sell.shark.count} lệnh</strong> ({sell.shark.volume.toLocaleString('vi-VN')} CP).
              <br />
              Dòng tiền tổ chức và tay to tập trung lệnh quy mô lớn từ 1 Tỷ VNĐ trở lên.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-cyan-400 mb-2 font-bold">
              <Users className="w-4 h-4" />
              <span>Sói già (500Tr &ndash; 1 Tỷ)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tổng lệnh mua: <strong className="text-cyan-400">{buy.wolf.count} lệnh</strong> ({buy.wolf.volume.toLocaleString('vi-VN')} CP).
              <br />
              Tổng lệnh bán: <strong className="text-orange-400">{sell.wolf.count} lệnh</strong> ({sell.wolf.volume.toLocaleString('vi-VN')} CP).
              <br />
              Nhà đầu tư chuyên nghiệp giao dịch phân khúc từ 500 Triệu đến dưới 1 Tỷ VNĐ.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-amber-400 mb-2 font-bold">
              <Sparkle className="w-4 h-4" />
              <span>Cừu non (&lt; 500Tr)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tổng lệnh mua: <strong className="text-amber-400">{buy.sheep.count} lệnh</strong> ({buy.sheep.volume.toLocaleString('vi-VN')} CP).
              <br />
              Tổng lệnh bán: <strong className="text-zinc-300">{sell.sheep.count} lệnh</strong> ({sell.sheep.volume.toLocaleString('vi-VN')} CP).
              <br />
              Nhỏ lẻ giao dịch dưới 500 Triệu VNĐ, phản ánh tâm lý thị trường đại chúng.
            </p>
          </div>
        </div>
      )}

      {/* Page 3 or bottom log: Live Order Feed */}
      {(activePage === 1 || activePage === 3) && (
        <div className="space-y-3 pt-1">
          {/* ── Whale Radar Telemetry Strip ── */}
          <div className="p-3 rounded-xl bg-zinc-950/80 border border-emerald-500/30 shadow-[0_4px_20px_-8px_rgba(16,185,129,0.2)] flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Fish className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                    Radar Lệnh Cá Mập
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    &ge; 1 TỶ VNĐ
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Lọc độc quyền lệnh tay to trong {orders.length} ticks gần nhất
                </p>
              </div>
            </div>

            {/* Live Metrics */}
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <div className="text-left md:text-right">
                <div className="text-[9px] text-zinc-500 uppercase">Cá Mập Mua</div>
                <div className="font-bold text-emerald-400">
                  {(sharkStats.totalBuyVal / 1_000_000_000).toFixed(2)} tỷ{' '}
                  <span className="text-[9px] text-zinc-500 font-normal font-sans">({sharkStats.buyCount} lệnh)</span>
                </div>
              </div>

              <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

              <div className="text-left md:text-right">
                <div className="text-[9px] text-zinc-500 uppercase">Cá Mập Bán</div>
                <div className="font-bold text-rose-400">
                  {(sharkStats.totalSellVal / 1_000_000_000).toFixed(2)} tỷ{' '}
                  <span className="text-[9px] text-zinc-500 font-normal font-sans">({sharkStats.sellCount} lệnh)</span>
                </div>
              </div>

              <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

              <div className="text-left md:text-right">
                <div className="text-[9px] text-zinc-500 uppercase">Ròng Cá Mập</div>
                <div
                  className={`font-bold flex items-center gap-1 ${
                    sharkStats.netVal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {sharkStats.netVal >= 0 ? <TrendUp className="w-3.5 h-3.5" /> : <TrendDown className="w-3.5 h-3.5" />}
                  <span>
                    {sharkStats.netVal >= 0 ? '+' : ''}
                    {(sharkStats.netVal / 1_000_000_000).toFixed(2)} tỷ
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Filter Toolbar (Pill Controls) ── */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 font-mono text-xs py-1">
            {/* Investor Scale Filter */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px] overflow-x-auto">
              <span className="text-zinc-500 px-1.5 flex items-center gap-1 text-[10px] shrink-0">
                <Funnel className="w-3 h-3" />
                <span>Quy mô:</span>
              </span>
              <button
                onClick={() => setFilterInvestor('shark')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  filterInvestor === 'shark'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>🦈 Chỉ Cá Mập (≥ 1 Tỷ)</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[9px] text-zinc-300">
                  {sharkCount}
                </span>
              </button>
              <button
                onClick={() => setFilterInvestor('wolf_shark')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                  filterInvestor === 'wolf_shark'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>🐺 Cá Mập & Sói (≥ 500Tr)</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[9px] text-zinc-300">
                  {wolfSharkCount}
                </span>
              </button>
              <button
                onClick={() => setFilterInvestor('all')}
                className={`px-2 py-1 rounded-lg font-medium transition-all shrink-0 ${
                  filterInvestor === 'all'
                    ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>Tất cả ({orders.length})</span>
              </button>
            </div>

            {/* Execution Side Filter */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px]">
              <button
                onClick={() => setFilterSide('all')}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  filterSide === 'all'
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Tất cả chiều
              </button>
              <button
                onClick={() => setFilterSide('buy')}
                className={`px-2 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  filterSide === 'buy'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-emerald-500/70 hover:text-emerald-400'
                }`}
              >
                <span>🟢 Mua C.Động</span>
              </button>
              <button
                onClick={() => setFilterSide('sell')}
                className={`px-2 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  filterSide === 'sell'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'text-rose-500/70 hover:text-rose-400'
                }`}
              >
                <span>🔴 Bán C.Động</span>
              </button>
            </div>
          </div>

          {/* ── Orders Table ── */}
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-none rounded-xl border border-zinc-800/80 bg-zinc-900/40">
            <table className="w-full text-left font-mono text-xs">
              <thead className="sticky top-0 bg-zinc-900 z-10 text-[10px] text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-2.5 pl-3">Thời gian</th>
                  <th className="py-2.5">Phân khúc</th>
                  <th className="py-2.5 text-right">Giá (k)</th>
                  <th className="py-2.5 text-right">Khối lượng</th>
                  <th className="py-2.5 text-right">Giá trị (VNĐ)</th>
                  <th className="py-2.5 pr-3 text-center">Chiều lệnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-[11px]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-zinc-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                          <Fish className="w-5 h-5 text-zinc-500" />
                        </div>
                        <div className="font-bold text-zinc-300 text-xs">
                          {filterInvestor === 'shark'
                            ? `Chưa ghi nhận lệnh Cá Mập (≥ 1 Tỷ) trong ${orders.length} ticks gần nhất của ${selectedSymbol}`
                            : 'Không tìm thấy lệnh khớp phù hợp với bộ lọc'}
                        </div>
                        <p className="text-[10px] text-zinc-500 max-w-sm">
                          Hệ thống đang tự động cập nhật thời gian thực mỗi 15 giây từ sàn giao dịch.
                        </p>
                        {filterInvestor === 'shark' && (
                          <button
                            onClick={() => setFilterInvestor('wolf_shark')}
                            className="mt-1 px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold transition-colors"
                          >
                            Xem thêm phân khúc Sói Già (≥ 500Tr)
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, idx) => {
                    const isBuy = order.type === 'M';
                    const isMegaWhale = order.value >= 3_000_000_000;
                    const isShark = order.investorType === 'Cá mập';
                    const isWolf = order.investorType === 'Sói già';

                    const formattedVal =
                      order.value >= 1_000_000_000
                        ? `${(order.value / 1_000_000_000).toFixed(2)} tỷ`
                        : order.value >= 1_000_000
                        ? `${(order.value / 1_000_000).toFixed(1)} tr`
                        : `${order.value.toLocaleString('vi-VN')} đ`;

                    return (
                      <tr
                        key={order.id || idx}
                        className={`hover:bg-zinc-800/40 transition-colors ${
                          isMegaWhale
                            ? 'bg-amber-500/5 border-l-2 border-amber-500'
                            : isShark
                            ? 'bg-emerald-500/5'
                            : ''
                        }`}
                      >
                        <td className="py-2 pl-3 text-zinc-400 font-mono text-[11px]">{order.time}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isShark ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <span>🦈</span>
                                <span>Cá mập</span>
                              </span>
                            ) : isWolf ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                                <span>🐺</span>
                                <span>Sói già</span>
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-[10px]">Cừu non</span>
                            )}
                            {isMegaWhale && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5 animate-pulse">
                                <Fire className="w-3 h-3 text-amber-400" />
                                <span>MEGA</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-right font-bold text-zinc-100 text-xs font-mono">
                          {order.price.toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-zinc-200 font-mono font-bold">
                          {order.volume.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2 text-right font-mono font-black text-xs">
                          <span
                            className={
                              isMegaWhale
                                ? 'text-amber-300 font-bold'
                                : isShark
                                ? isBuy
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-rose-400 font-bold'
                                : 'text-zinc-300'
                            }
                          >
                            {formattedVal}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isBuy
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isBuy ? (
                              <>
                                <ArrowUpRight className="w-3 h-3" />
                                <span>MUA CHỦ ĐỘNG</span>
                              </>
                            ) : (
                              <>
                                <ArrowDownRight className="w-3 h-3" />
                                <span>BÁN CHỦ ĐỘNG</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
