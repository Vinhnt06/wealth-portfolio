'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Fish,
  ShieldCheck,
  Users,
  TrendUp,
  TrendDown,
  Info,
  Clock,
  Sparkle,
  ArrowsClockwise
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
    description: string;
  };
  summary: {
    netVolume: number;
    sharkNetVol: number;
    wolfNetVol: number;
    sheepNetVol: number;
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
  const [loading, setLoading] = useState<boolean>(false);
  const [tradesData, setTradesData] = useState<TradesData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchRealTrades = useCallback(async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/market/trades?symbol=${selectedSymbol}&limit=200`);
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        setTradesData(resJson.data);
        setLastUpdated(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
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
        <div className="overflow-x-auto max-h-[260px] overflow-y-auto scrollbar-none rounded-xl border border-zinc-800/80 bg-zinc-900/40">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-zinc-900 z-10 text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-2 pl-3">Thời gian</th>
                <th className="py-2">NĐT</th>
                <th className="py-2 text-right">Giá (k)</th>
                <th className="py-2 text-right">KL Khớp</th>
                <th className="py-2 text-right">Giá trị</th>
                <th className="py-2 pr-3 text-center">Lệnh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-[11px]">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500">
                    {loading ? 'Đang tải dữ liệu khớp lệnh thật...' : 'Chưa có dữ liệu khớp lệnh.'}
                  </td>
                </tr>
              ) : (
                orders.map((order, idx) => {
                  const isBuy = order.type === 'M';
                  const investorColor =
                    order.investorType === 'Cá mập'
                      ? 'text-emerald-400 font-bold'
                      : order.investorType === 'Sói già'
                      ? 'text-cyan-400 font-semibold'
                      : 'text-zinc-400';

                  const formattedVal =
                    order.value >= 1_000_000_000
                      ? `${(order.value / 1_000_000_000).toFixed(2)} tỷ`
                      : order.value >= 1_000_000
                      ? `${(order.value / 1_000_000).toFixed(1)} tr`
                      : `${order.value.toLocaleString('vi-VN')} đ`;

                  return (
                    <tr key={order.id || idx} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-1.5 pl-3 text-zinc-400">{order.time}</td>
                      <td className={`py-1.5 ${investorColor}`}>{order.investorType}</td>
                      <td className="py-1.5 text-right font-bold text-zinc-200">
                        {order.price.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right text-zinc-300">
                        {order.volume.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-1.5 text-right font-mono text-[10px] text-zinc-400">
                        {formattedVal}
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
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
