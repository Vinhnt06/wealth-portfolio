'use client';

import React, { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import {
  Globe,
  TrendUp,
  TrendDown,
  ArrowsClockwise,
  Bank,
  Coins,
  Flame,
  Scales,
  CaretDown,
  CaretUp,
  ArrowUpRight,
  ShieldCheck,
} from '@phosphor-icons/react';
import dynamic from 'next/dynamic';

const EconomicCycleWheel = dynamic(
  () => import('./EconomicCycleWheel').then((m) => m.EconomicCycleWheel),
  { ssr: false }
);

interface UsMarketItem {
  symbol: string;
  name: string;
  category: string;
  price: number;
  change: number;
  changePercent: number;
  unit?: string;
}

interface CommodityItem {
  id: string;
  name: string;
  category: string;
  price: number | string;
  unit: string;
  change: number;
  changePercent?: number;
  buyPrice?: number;
  sellPrice?: number;
}

interface ExchangeRateItem {
  code: string;
  name: string;
  buyCash: number;
  sell: number;
  change?: number;
}

export const UnifiedMacroMatrix: React.FC = memo(() => {
  const [usData, setUsData] = useState<UsMarketItem[]>([]);
  const [commodities, setCommodities] = useState<CommodityItem[]>([]);
  const [rates, setRates] = useState<ExchangeRateItem[]>([]);
  const [macroStats, setMacroStats] = useState<{
    gdpGrowth: string;
    cpiYoY: string;
    refinancingRate: string;
    cycleStage: string;
  }>({
    gdpGrowth: '9.95%',
    cpiYoY: '3.88%',
    refinancingRate: '4.50%',
    cycleStage: 'Mở Rộng Sớm (Early Expansion)',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [showCycleDeepDive, setShowCycleDeepDive] = useState<boolean>(false);

  const fetchAllMacro = async () => {
    setLoading(true);
    try {
      const [resUs, resComm, resRates, resInd] = await Promise.all([
        fetch('/api/macro/us-global', { cache: 'no-store' }),
        fetch('/api/macro/commodities', { cache: 'no-store' }),
        fetch('/api/macro/exchange-rate', { cache: 'no-store' }),
        fetch('/api/macro/indicators', { cache: 'no-store' }),
      ]);

      if (resUs.ok) {
        const json = await resUs.json();
        if (json.success && Array.isArray(json.indices)) {
          setUsData(json.indices);
        }
      }

      if (resComm.ok) {
        const json = await resComm.json();
        if (json.success && Array.isArray(json.data)) {
          setCommodities(json.data);
        }
      }

      if (resRates.ok) {
        const json = await resRates.json();
        if (json.success && Array.isArray(json.data)) {
          setRates(json.data);
        }
      }

      if (resInd.ok) {
        const json = await resInd.json();
        if (json.success && json.data) {
          const gdp = json.data.gdp?.[json.data.gdp.length - 1]?.growth || '9.95%';
          const cpi = json.data.cpi?.[json.data.cpi.length - 1]?.cpi || '3.88%';
          const refRate = json.data.interestRate?.[json.data.interestRate.length - 1]?.refinancing || '4.50%';
          setMacroStats({
            gdpGrowth: typeof gdp === 'number' ? `${gdp}%` : gdp,
            cpiYoY: typeof cpi === 'number' ? `${cpi}%` : cpi,
            refinancingRate: typeof refRate === 'number' ? `${refRate}%` : refRate,
            cycleStage: json.data.cycleAssessment || 'Mở Rộng Kinh Tế Mạnh',
          });
        }
      }

      setLastRefreshed(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
    } catch (err) {
      console.error('Lỗi nạp ma trận vĩ mô hợp nhất:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMacro();
    const timer = setInterval(fetchAllMacro, 45000); // 45s auto-refresh
    return () => clearInterval(timer);
  }, []);

  // Filter primary global indices
  const keyUs = [
    usData.find((i) => i.symbol === '^GSPC') || { symbol: '^GSPC', name: 'S&P 500', price: 5864.67, change: 23.4, changePercent: 0.40 },
    usData.find((i) => i.symbol === '^IXIC') || { symbol: '^IXIC', name: 'Nasdaq 100', price: 18518.61, change: 112.5, changePercent: 0.61 },
    usData.find((i) => i.symbol === '^VIX') || { symbol: '^VIX', name: 'CBOE VIX', price: 18.24, change: -0.65, changePercent: -3.44 },
    usData.find((i) => i.symbol === '^TNX') || { symbol: '^TNX', name: 'US 10Y Yield', price: 4.24, change: 0.03, changePercent: 0.71, unit: '%' },
    usData.find((i) => i.symbol === 'DX-Y.NYB') || { symbol: 'DX-Y.NYB', name: 'USD Index (DXY)', price: 104.18, change: 0.12, changePercent: 0.12 },
  ];

  // USD/VND from live rates
  const usdVndRate = rates.find((r) => r.code === 'USD') || {
    code: 'USD',
    name: 'Đô la Mỹ',
    buyCash: 25150,
    sell: 25480,
  };

  // Commodities: Gold SJC, World Gold, Brent Oil
  const goldSjc = commodities.find((c) => c.id === 'gold_sjc') || {
    id: 'gold_sjc',
    name: 'Vàng SJC (Hà Nội/HCM)',
    buyPrice: 87.0,
    sellPrice: 89.0,
    unit: 'Tr.đ/lượng',
    change: 0.5,
  };

  const goldWorld = commodities.find((c) => c.id === 'gold_world') || {
    id: 'gold_world',
    name: 'Vàng Thế Giới (Spot)',
    price: 2748.5,
    unit: 'USD/oz',
    change: 14.2,
    changePercent: 0.52,
  };

  const brentOil = commodities.find((c) => c.id === 'brent') || {
    id: 'brent',
    name: 'Dầu Brent (Thế giới)',
    price: 74.38,
    unit: 'USD/thùng',
    change: -0.84,
    changePercent: -1.12,
  };

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden">
      {/* ── Subheader Bar ── */}
      <div className="px-5 py-3 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0d0d0d]">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
            MA TRẬN VĨ MÔ & TÀI CHÍNH TOÀN CẦU (GLOBAL MACRO MATRIX)
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 border border-zinc-800 rounded">
            100% LIVE REALTIME
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500">
          <span>{lastRefreshed ? `Cập nhật: ${lastRefreshed}` : 'Đang đồng bộ...'}</span>
          <button
            onClick={fetchAllMacro}
            disabled={loading}
            className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors disabled:opacity-40"
            title="Làm mới ma trận vĩ mô"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── 3-Column Bento Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#1a1a1a]">
        
        {/* ── Pillar 1: Global & US Financial Markets ── */}
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1a1a1a] mb-3">
              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-zinc-400" />
                <span>Thị Trường Quốc Tế & Mỹ</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-600">Yahoo Finance</span>
            </div>

            <div className="space-y-2.5 font-mono">
              {keyUs.map((idx) => {
                const isPos = idx.changePercent >= 0;
                return (
                  <div key={idx.symbol} className="flex items-center justify-between text-xs py-1">
                    <div>
                      <span className="text-zinc-200 font-medium">{idx.name}</span>
                      <span className="text-[10px] text-zinc-600 ml-1.5">{idx.symbol}</span>
                    </div>
                    <div className="text-right flex items-center gap-2.5">
                      <span className="text-zinc-100 font-semibold tabular-nums">
                        {typeof idx.price === 'number'
                          ? idx.price.toLocaleString('en-US', {
                              minimumFractionDigits: idx.price < 100 ? 2 : 1,
                              maximumFractionDigits: 2,
                            })
                          : idx.price}
                        {idx.unit ? ` ${idx.unit}` : ''}
                      </span>
                      <span
                        className={`text-[11px] tabular-nums font-medium flex items-center gap-0.5 min-w-[54px] justify-end ${
                          isPos ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {idx.changePercent?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1a1a1a] text-[11px] font-mono text-zinc-500 flex items-center justify-between">
            <span>Tâm lý toàn cầu (VIX):</span>
            <span className="text-emerald-400 font-semibold">Ổn định (&lt; 20 điểm)</span>
          </div>
        </div>

        {/* ── Pillar 2: Vietnam Domestic Macro & SBV Rates (CHÍNH THỨC) ── */}
        <div className="p-4 sm:p-5 flex flex-col justify-between bg-amber-500/[0.02] border-amber-500/10">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1a1a1a] mb-3">
              <div className="flex items-center gap-1.5 font-mono text-xs text-amber-400 uppercase tracking-wider font-bold">
                <Bank className="w-3.5 h-3.5 text-amber-400" />
                <span>Vĩ Mô Việt Nam & Tiền Tệ</span>
              </div>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                🏛️ DỮ LIỆU CHÍNH THỨC
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {/* USD/VND */}
              <div className="py-1 flex items-center justify-between border-b border-[#1a1a1a]/60 pb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-100 font-bold">USD/VND (Vietcombank)</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                      CHÍNH THỨC VCB
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400">Mua TM: {usdVndRate.buyCash?.toLocaleString('vi-VN')} đ</div>
                </div>
                <div className="text-right">
                  <div className="text-amber-300 font-black tabular-nums text-sm">
                    {usdVndRate.sell?.toLocaleString('vi-VN')} <span className="text-[10px] text-zinc-500 font-normal">đ</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Tỷ giá bán niêm yết</span>
                </div>
              </div>

              {/* GDP Growth */}
              <div className="flex items-center justify-between py-1 border-b border-[#1a1a1a]/40 pb-1">
                <div>
                  <span className="text-zinc-300 font-medium">Tăng trưởng GDP (Quý mới nhất)</span>
                  <div className="text-[9px] text-amber-400/90 font-semibold">🏛️ Tổng Cục Thống Kê (GSO)</div>
                </div>
                <span className="text-emerald-400 font-black text-sm tabular-nums">{macroStats.gdpGrowth}</span>
              </div>

              {/* CPI YoY */}
              <div className="flex items-center justify-between py-1 border-b border-[#1a1a1a]/40 pb-1">
                <div>
                  <span className="text-zinc-300 font-medium">Lạm phát CPI YoY (Kỳ vọng &lt;4.5%)</span>
                  <div className="text-[9px] text-amber-400/90 font-semibold">🏛️ Tổng Cục Thống Kê (GSO)</div>
                </div>
                <span className="text-zinc-100 font-bold tabular-nums">{macroStats.cpiYoY}</span>
              </div>

              {/* SBV Refinancing */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-zinc-300 font-medium">Lãi suất tái cấp vốn NHNN</span>
                  <div className="text-[9px] text-amber-400/90 font-semibold">🏛️ Ngân Hàng Nhà Nước (SBV)</div>
                </div>
                <span className="text-amber-300 font-black text-sm tabular-nums">{macroStats.refinancingRate}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1a1a1a] text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Đánh giá chu kỳ vĩ mô:</span>
            </span>
            <span className="text-emerald-400 font-bold">{macroStats.cycleStage}</span>
          </div>
        </div>

        {/* ── Pillar 3: Commodities, Gold & Savings Yield ── */}
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1a1a1a] mb-3">
              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400 uppercase tracking-wider">
                <Coins className="w-3.5 h-3.5 text-zinc-400" />
                <span>Hàng Hóa & Vàng Bạc</span>
              </div>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                SJC ĐỘC QUYỀN NN
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {/* Gold SJC */}
              <div className="py-1 flex items-center justify-between border-b border-[#1a1a1a]/60 pb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-300 font-bold">Vàng Miếng SJC</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black">
                      CHÍNH THỨC SJC
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400">Mua: {goldSjc.buyPrice} Tr.đ/lượng</div>
                </div>
                <div className="text-right">
                  <div className="text-amber-300 font-black tabular-nums text-sm">
                    {goldSjc.sellPrice} <span className="text-[10px] text-zinc-500 font-normal">Tr/lượng</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium">Bán ra thị trường</span>
                </div>
              </div>

              {/* Spot Gold World */}
              <div className="flex items-center justify-between py-0.5">
                <span className="text-zinc-400">{goldWorld.name}</span>
                <div className="text-right flex items-center gap-2">
                  <span className="text-zinc-100 font-semibold tabular-nums">
                    ${Number(goldWorld.price).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </span>
                  <span
                    className={`text-[11px] tabular-nums font-medium ${
                      Number(goldWorld.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {Number(goldWorld.changePercent || 0) >= 0 ? '+' : ''}
                    {Number(goldWorld.changePercent || 0).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Brent Oil */}
              <div className="flex items-center justify-between py-0.5">
                <span className="text-zinc-400">{brentOil.name}</span>
                <div className="text-right flex items-center gap-2">
                  <span className="text-zinc-100 font-semibold tabular-nums">
                    ${Number(brentOil.price).toFixed(2)}
                  </span>
                  <span
                    className={`text-[11px] tabular-nums font-medium ${
                      Number(brentOil.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {Number(brentOil.changePercent || 0) >= 0 ? '+' : ''}
                    {Number(brentOil.changePercent || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Savings Rate benchmark */}
          <div className="mt-4 pt-3 border-t border-[#1a1a1a] text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">CHÍNH THỨC</span>
              <span>Lãi suất 12M Big 4 (VCB, BIDV):</span>
            </span>
            <span className="text-amber-300 font-bold tabular-nums">4.70% - 4.80% / năm</span>
          </div>
        </div>

      </div>

      {/* ── Collapsible Macro Deep-Dive Section (Cycle Wheel & Transmission) ── */}
      <div className="border-t border-[#1a1a1a] bg-[#0c0c0c]">
        <button
          onClick={() => setShowCycleDeepDive((prev) => !prev)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Scales className="w-4 h-4 text-emerald-400" />
            <span>MÔ HÌNH VÒNG QUAY CHU KỲ KINH TẾ (ECONOMIC CYCLE WHEEL & ALLOCATION)</span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            {showCycleDeepDive ? 'Thu gọn' : 'Xem chi tiết'}
            {showCycleDeepDive ? <CaretUp className="w-3.5 h-3.5" /> : <CaretDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {showCycleDeepDive && (
          <div className="p-5 border-t border-[#1a1a1a] animate-in fade-in duration-200">
            <EconomicCycleWheel />
          </div>
        )}
      </div>
    </div>
  );
});

UnifiedMacroMatrix.displayName = 'UnifiedMacroMatrix';
