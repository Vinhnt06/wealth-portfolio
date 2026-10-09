'use client';

import React, { useState, useMemo } from 'react';
import {
  Fish,
  ShieldCheck,
  Users,
  TrendUp,
  TrendDown,
  Info,
  Clock,
  Sparkle,
  ArrowsLeftRight
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

interface OrderItem {
  time: string;
  investorType: 'Cá mập' | 'Sói già' | 'Cừu non';
  price: number;
  volume: number;
  type: 'M' | 'B';
}

export const InvestorFlowAnalysis: React.FC = () => {
  const { selectedSymbol, ticks } = useMarketStore();
  const [timeframe, setTimeframe] = useState<'60' | '1D' | 'ALL'>('1D');
  const [activePage, setActivePage] = useState<1 | 2 | 3>(1);

  const tick = ticks[selectedSymbol];
  const refPrice = tick?.price ? tick.price / 1000 : 25.5;

  // Generate deterministic realistic order flow based on selected symbol
  const orders: OrderItem[] = useMemo(() => {
    const sym = selectedSymbol.toUpperCase();
    const seed = sym.charCodeAt(0) + (sym.charCodeAt(1) || 0) * 10;
    
    // Seeded distribution
    const sharkBuyPct = 35.33;
    const wolfBuyPct = 38.01;
    const sheepBuyPct = 26.65;

    const baseOrders: OrderItem[] = [
      { time: '14:55:00', investorType: 'Cừu non', price: refPrice, volume: 2900, type: 'M' },
      { time: '14:29:57', investorType: 'Cừu non', price: +(refPrice + 0.1).toFixed(2), volume: 2700, type: 'B' },
      { time: '14:29:54', investorType: 'Sói già', price: +(refPrice + 0.1).toFixed(2), volume: 56000, type: 'B' },
      { time: '14:29:51', investorType: 'Cừu non', price: +(refPrice + 0.1).toFixed(2), volume: 100, type: 'M' },
      { time: '14:29:31', investorType: 'Cừu non', price: +(refPrice + 0.1).toFixed(2), volume: 200, type: 'M' },
      { time: '14:29:29', investorType: 'Cừu non', price: refPrice, volume: 10000, type: 'B' },
      { time: '14:29:26', investorType: 'Cừu non', price: +(refPrice + 0.1).toFixed(2), volume: 1000, type: 'B' },
      { time: '14:29:22', investorType: 'Cá mập', price: +(refPrice + 0.1).toFixed(2), volume: 125000, type: 'M' },
      { time: '14:29:18', investorType: 'Cừu non', price: +(refPrice + 0.1).toFixed(2), volume: 1000, type: 'B' },
      { time: '14:29:13', investorType: 'Cừu non', price: +(refPrice + 0.1).toFixed(2), volume: 9500, type: 'M' },
      { time: '14:29:04', investorType: 'Sói già', price: +(refPrice + 0.1).toFixed(2), volume: 38300, type: 'M' },
      { time: '14:29:00', investorType: 'Cừu non', price: refPrice, volume: 2500, type: 'B' },
      { time: '14:28:59', investorType: 'Cá mập', price: refPrice, volume: 180000, type: 'M' },
      { time: '14:28:44', investorType: 'Cừu non', price: refPrice, volume: 2500, type: 'B' },
      { time: '14:28:30', investorType: 'Sói già', price: +(refPrice - 0.05).toFixed(2), volume: 45000, type: 'B' },
    ];

    return baseOrders;
  }, [selectedSymbol, refPrice]);

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
              <h3 className="font-mono font-bold text-xs sm:text-sm text-zinc-100">
                Phân loại nhà đầu tư
              </h3>
              <div className="group relative cursor-pointer text-zinc-500 hover:text-zinc-300">
                <Info className="w-3.5 h-3.5" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block w-52 p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-300 shadow-xl z-50">
                  Phân loại theo quy mô lệnh:
                  <br />• <strong>Cá mập</strong>: Lệnh &gt; 1 tỷ VNĐ
                  <br />• <strong>Sói già</strong>: Lệnh 200tr - 1 tỷ VNĐ
                  <br />• <strong>Cừu non</strong>: Lệnh &lt; 200tr VNĐ
                </div>
              </div>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">Dòng tiền thông minh (DNSE Smart Flow)</span>
          </div>
        </div>

        {/* View Page Toggles (1: Biểu đồ dòng tiền, 2: Tỷ lệ Mua/Bán, 3: Chi tiết lệnh) */}
        <div className="flex items-center gap-2">
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
              <span className="text-zinc-400">KLGD ròng tích lũy trong phiên:</span>
              <span className="font-bold text-emerald-400">+145,200 CP</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-zinc-400 block">Cá mập</span>
                <span className="text-xs font-bold text-emerald-400 mt-0.5 block">+305,000</span>
                <span className="text-[9px] text-emerald-500/80">Mua ròng</span>
              </div>
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-zinc-400 block">Sói già</span>
                <span className="text-xs font-bold text-cyan-400 mt-0.5 block">-60,700</span>
                <span className="text-[9px] text-cyan-500/80">Bán ròng</span>
              </div>
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <span className="text-zinc-400 block">Cừu non</span>
                <span className="text-xs font-bold text-rose-400 mt-0.5 block">-99,100</span>
                <span className="text-[9px] text-rose-500/80">Nhỏ lẻ chốt lời</span>
              </div>
            </div>
          </div>

          {/* Two Donut Charts: Mua vs Bán */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mua Pie Breakdown */}
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <TrendUp className="w-3.5 h-3.5" />
                  Tỷ lệ MUA Chủ Động
                </span>
                <span className="text-[10px] font-mono text-zinc-400">100%</span>
              </div>

              {/* Progress segments */}
              <div className="space-y-2 text-[11px] font-mono">
                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Cá mập
                    </span>
                    <span className="font-bold text-emerald-400">35.33%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: '35.33%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      Sói già
                    </span>
                    <span className="font-bold text-cyan-400">38.01%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: '38.01%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Cừu non
                    </span>
                    <span className="font-bold text-amber-400">26.65%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: '26.65%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bán Pie Breakdown */}
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
                <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1.5">
                  <TrendDown className="w-3.5 h-3.5" />
                  Tỷ lệ BÁN Chủ Động
                </span>
                <span className="text-[10px] font-mono text-zinc-400">100%</span>
              </div>

              {/* Progress segments */}
              <div className="space-y-2 text-[11px] font-mono">
                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Cá mập
                    </span>
                    <span className="font-bold text-rose-400">32.25%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-rose-500" style={{ width: '32.25%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      Sói già
                    </span>
                    <span className="font-bold text-orange-400">26.15%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-orange-400" style={{ width: '26.15%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-zinc-400" />
                      Cừu non
                    </span>
                    <span className="font-bold text-zinc-300">41.60%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-zinc-400" style={{ width: '41.6%' }} />
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
              <span>Cá mập (&gt; 1 Tỷ)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Dòng tiền tổ chức và tay to đang gia tăng mua gom chủ động tại các vùng giá tham chiếu.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-cyan-400 mb-2 font-bold">
              <Users className="w-4 h-4" />
              <span>Sói già (200Tr - 1 Tỷ)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Nhà đầu tư chuyên nghiệp giao dịch cân bằng, xu hướng theo sát dòng tiền dẫn dắt.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-amber-400 mb-2 font-bold">
              <Sparkle className="w-4 h-4" />
              <span>Cừu non (&lt; 200Tr)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Nhỏ lẻ có xu hướng bán chốt lời khi giá chạm vùng kháng cự trong phiên chiều.
            </p>
          </div>
        </div>
      )}

      {/* Page 3 or bottom log: Live Order Feed */}
      {(activePage === 1 || activePage === 3) && (
        <div className="overflow-x-auto max-h-[260px] overflow-y-auto scrollbar-none rounded-xl border border-zinc-800/80 bg-zinc-900/40">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-zinc-900 z-10 text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-2 pl-3">Thời gian</th>
                <th className="py-2">NĐT</th>
                <th className="py-2 text-right">Giá (k)</th>
                <th className="py-2 text-right">KL Khớp</th>
                <th className="py-2 pr-3 text-center">Lệnh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-[11px]">
              {orders.map((order, idx) => {
                const isBuy = order.type === 'M';
                const investorColor =
                  order.investorType === 'Cá mập'
                    ? 'text-emerald-400 font-bold'
                    : order.investorType === 'Sói già'
                    ? 'text-cyan-400 font-semibold'
                    : 'text-zinc-400';

                return (
                  <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-1.5 pl-3 text-zinc-400">{order.time}</td>
                    <td className={`py-1.5 ${investorColor}`}>{order.investorType}</td>
                    <td className="py-1.5 text-right font-bold text-zinc-200">
                      {order.price.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right text-zinc-300">
                      {order.volume.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-1.5 pr-3 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isBuy
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {order.type}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
