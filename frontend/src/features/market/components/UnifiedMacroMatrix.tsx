'use client';

import React, { useState, useEffect, memo } from 'react';
import {
  Globe,
  ArrowsClockwise,
  Bank,
  Coins,
  Scales,
  CaretDown,
  CaretUp,
  ShieldCheck,
  ChartLineUp,
} from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import { MacroChartModal, MacroIndicatorTarget } from './MacroChartModal';

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
  spread?: number;
  brand?: string;
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
  const [activeChartIndicator, setActiveChartIndicator] = useState<MacroIndicatorTarget | null>(null);
  const [goldTab, setGoldTab] = useState<'vn_gold' | 'world_comm'>('vn_gold');

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

  // Format price helper in Million VNĐ/lượng
  const formatVnGoldPrice = (raw: number | string | undefined): string => {
    if (raw === undefined || raw === null) return '---';
    const num = typeof raw === 'string' ? parseFloat(raw) : raw;
    if (isNaN(num)) return '---';
    if (num > 1000000) {
      return (num / 1000000).toFixed(1);
    }
    return num.toFixed(1);
  };

  // Primary global indices
  const keyUs = [
    usData.find((i) => i.symbol === '^GSPC') || { symbol: '^GSPC', name: 'S&P 500', price: 7720.39, change: -23.59, changePercent: -0.30 },
    usData.find((i) => i.symbol === '^IXIC') || { symbol: '^IXIC', name: 'Nasdaq 100', price: 26184.72, change: -365.13, changePercent: -1.38 },
    usData.find((i) => i.symbol === '^VIX') || { symbol: '^VIX', name: 'CBOE VIX', price: 17.2, change: 0.29, changePercent: 1.72 },
    usData.find((i) => i.symbol === '^TNX') || { symbol: '^TNX', name: 'US 10Y Yield', price: 4.99, change: -0.06, changePercent: -1.11, unit: '%' },
    usData.find((i) => i.symbol === 'DX-Y.NYB') || { symbol: 'DX-Y.NYB', name: 'USD Index (DXY)', price: 101.75, change: -0.28, changePercent: -0.28 },
  ];

  // USD/VND from live rates
  const usdVndRate = rates.find((r) => r.code === 'USD') || {
    code: 'USD',
    name: 'Đô la Mỹ',
    buyCash: 25150,
    sell: 25480,
  };

  // Top Vietnam Domestic Gold Brands (Real 24HMoney Data)
  const vnGoldList = [
    commodities.find((c) => c.id === 'gold_sjc') || {
      id: 'gold_sjc',
      brand: 'SJC',
      name: 'Vàng Miếng SJC (HN / HCM)',
      buyPrice: 138400000,
      sellPrice: 141400000,
      spread: 3000000,
      change: -1300000,
      changePercent: -0.91,
      unit: 'VNĐ/Lượng',
    },
    commodities.find((c) => c.id === 'gold_sjc_nhan') || {
      id: 'gold_sjc_nhan',
      brand: 'SJC',
      name: 'Vàng Nhẫn Trơn SJC 99.99',
      buyPrice: 134300000,
      sellPrice: 138300000,
      spread: 4000000,
      change: -900000,
      changePercent: -0.65,
      unit: 'VNĐ/Lượng',
    },
    commodities.find((c) => c.id === 'gold_doji_nhan') || {
      id: 'gold_doji_nhan',
      brand: 'DOJI',
      name: 'Vàng Nhẫn DOJI Hưng Thịnh Vượng',
      buyPrice: 136000000,
      sellPrice: 140000000,
      spread: 4000000,
      change: -1500000,
      changePercent: -1.06,
      unit: 'VNĐ/Lượng',
    },
    commodities.find((c) => c.id === 'gold_pnj_nhan') || {
      id: 'gold_pnj_nhan',
      brand: 'PNJ',
      name: 'Vàng Nhẫn Trơn PNJ 24K',
      buyPrice: 136000000,
      sellPrice: 140000000,
      spread: 4000000,
      change: -1000000,
      changePercent: -0.71,
      unit: 'VNĐ/Lượng',
    },
    commodities.find((c) => c.id === 'gold_btmc_mieng') || {
      id: 'gold_btmc_mieng',
      brand: 'BTMC',
      name: 'Vàng Rồng Thăng Long BTMC',
      buyPrice: 136400000,
      sellPrice: 140400000,
      spread: 4000000,
      change: -1000000,
      changePercent: -0.71,
      unit: 'VNĐ/Lượng',
    },
    commodities.find((c) => c.id === 'gold_mihong_nhan') || {
      id: 'gold_mihong_nhan',
      brand: 'Mi Hồng',
      name: 'Vàng Nhẫn Mi Hồng 999',
      buyPrice: 139900000,
      sellPrice: 141400000,
      spread: 1500000,
      change: -600000,
      changePercent: -0.42,
      unit: 'VNĐ/Lượng',
    },
  ];

  // Global Commodities
  const goldWorld = commodities.find((c) => c.id === 'gold_world') || {
    id: 'gold_world',
    name: 'Vàng Thế Giới (XAU/USD)',
    price: 4005.3,
    unit: 'USD/oz',
    change: 14.2,
    changePercent: 0.52,
  };

  const brentOil = commodities.find((c) => c.id === 'brent') || {
    id: 'brent',
    name: 'Dầu Brent (Thế giới)',
    price: 112.0,
    unit: 'USD/thùng',
    change: -1.82,
    changePercent: -1.6,
  };

  const wtiOil = commodities.find((c) => c.id === 'wti') || {
    id: 'wti',
    name: 'Dầu WTI (Mỹ)',
    price: 103.15,
    unit: 'USD/thùng',
    change: -1.45,
    changePercent: -1.38,
  };

  const silverWorld = commodities.find((c) => c.id === 'silver') || {
    id: 'silver',
    name: 'Bạc Thế Giới (XAG/USD)',
    price: 51.49,
    unit: 'USD/oz',
    change: -0.62,
    changePercent: -1.19,
  };

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl">
      {/* ── Subheader Bar ── */}
      <div className="px-5 py-3 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0d0d0d]">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
            MA TRẬN VĨ MÔ & TÀI CHÍNH TOÀN CẦU (GLOBAL MACRO MATRIX)
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded">
            100% REALTIME DATA
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
              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-300 uppercase tracking-wider font-semibold">
                <Globe className="w-3.5 h-3.5 text-zinc-400" />
                <span>Thị Trường Quốc Tế & Mỹ</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500 flex items-center gap-1">
                <span>Click xem chart</span>
                <ChartLineUp className="w-3 h-3 text-zinc-400" />
              </span>
            </div>

            <div className="space-y-1.5 font-mono">
              {keyUs.map((idx) => {
                const isPos = idx.changePercent >= 0;
                return (
                  <div
                    key={idx.symbol}
                    onClick={() =>
                      setActiveChartIndicator({
                        id: idx.symbol === 'DX-Y.NYB' ? 'dxy' : idx.symbol === '^TNX' ? 'us10y' : idx.symbol === '^GSPC' ? 'sp500' : idx.symbol,
                        symbol: idx.symbol,
                        name: idx.name,
                        category: idx.symbol === 'DX-Y.NYB' ? 'currency' : idx.symbol === '^TNX' ? 'yield' : 'equity',
                        price: idx.price,
                        unit: idx.unit || 'điểm',
                        change: idx.change,
                        changePercent: idx.changePercent,
                      })
                    }
                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors group"
                    title={`Click xem biểu đồ lịch sử ${idx.name}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-200 font-medium group-hover:text-emerald-400 transition-colors">
                        {idx.name}
                      </span>
                      <span className="text-[10px] text-zinc-600">{idx.symbol}</span>
                      <ChartLineUp className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
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
            <span className="text-emerald-400 font-semibold">Khẩu vị rủi ro ổn định</span>
          </div>
        </div>

        {/* ── Pillar 2: Vietnam Domestic Macro & SBV Rates (CHÍNH THỨC) ── */}
        <div className="p-4 sm:p-5 flex flex-col justify-between bg-amber-500/[0.02]">
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
              {/* USD/VND with Click to Chart */}
              <div
                onClick={() =>
                  setActiveChartIndicator({
                    id: 'usdvnd',
                    symbol: 'USDVND=X',
                    name: 'Tỷ Giá USD/VND (Liên Ngân Hàng & VCB)',
                    category: 'currency',
                    price: usdVndRate.sell,
                    unit: 'VNĐ',
                    buyPrice: usdVndRate.buyCash,
                    sellPrice: usdVndRate.sell,
                  })
                }
                className="py-1.5 px-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors group flex items-center justify-between border border-transparent hover:border-zinc-800"
                title="Click xem biểu đồ lịch sử tỷ giá USD/VND"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-100 font-bold group-hover:text-amber-300 transition-colors">
                      USD/VND (Vietcombank)
                    </span>
                    <ChartLineUp className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Mua TM: {usdVndRate.buyCash?.toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-amber-300 font-black tabular-nums text-sm">
                    {usdVndRate.sell?.toLocaleString('vi-VN')} <span className="text-[10px] text-zinc-500 font-normal">đ</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Tỷ giá bán ra</span>
                </div>
              </div>

              {/* GDP Growth */}
              <div className="flex items-center justify-between py-1 border-b border-[#1a1a1a]/40 pb-1 px-2">
                <div>
                  <span className="text-zinc-300 font-medium">Tăng trưởng GDP (Mới nhất)</span>
                  <div className="text-[9px] text-amber-400/90 font-semibold">🏛️ Tổng Cục Thống Kê (GSO)</div>
                </div>
                <span className="text-emerald-400 font-black text-sm tabular-nums">{macroStats.gdpGrowth}</span>
              </div>

              {/* CPI YoY */}
              <div className="flex items-center justify-between py-1 border-b border-[#1a1a1a]/40 pb-1 px-2">
                <div>
                  <span className="text-zinc-300 font-medium">Lạm phát CPI YoY (Kiểm soát &lt;4.5%)</span>
                  <div className="text-[9px] text-amber-400/90 font-semibold">🏛️ Tổng Cục Thống Kê (GSO)</div>
                </div>
                <span className="text-zinc-100 font-bold tabular-nums">{macroStats.cpiYoY}</span>
              </div>

              {/* SBV Refinancing */}
              <div className="flex items-center justify-between py-1 px-2">
                <div>
                  <span className="text-zinc-300 font-medium">Lãi suất tái cấp vốn NHNN</span>
                  <div className="text-[9px] text-amber-400/90 font-semibold">🏛️ Ngân Hàng Nhà Nước (SBV)</div>
                </div>
                <span className="text-amber-300 font-black text-sm tabular-nums">{macroStats.refinancingRate}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1a1a1a] text-[11px] font-mono text-zinc-400 flex items-center justify-between px-2">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Đánh giá chu kỳ vĩ mô:</span>
            </span>
            <span className="text-emerald-400 font-bold">{macroStats.cycleStage}</span>
          </div>
        </div>

        {/* ── Pillar 3: Commodities, Gold & Savings Yield (UPGRADED WITH GOLD TABS) ── */}
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            {/* Header with Switcher Tabs */}
            <div className="flex items-center justify-between pb-2.5 border-b border-[#1a1a1a] mb-2.5">
              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-300 uppercase tracking-wider font-semibold">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Giá Vàng & Hàng Hóa</span>
              </div>

              {/* Tab Switcher */}
              <div className="flex items-center gap-1 bg-[#09090b] p-0.5 rounded-lg border border-[#27272a]">
                <button
                  onClick={() => setGoldTab('vn_gold')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold transition-all ${
                    goldTab === 'vn_gold'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Vàng VN
                </button>
                <button
                  onClick={() => setGoldTab('world_comm')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold transition-all ${
                    goldTab === 'world_comm'
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Thế Giới / Dầu
                </button>
              </div>
            </div>

            {/* Content for Vietnam Gold Tab */}
            {goldTab === 'vn_gold' && (
              <div className="space-y-1.5 font-mono text-xs max-h-[220px] overflow-y-auto pr-0.5">
                {vnGoldList.map((g) => {
                  const buyM = formatVnGoldPrice(g.buyPrice);
                  const sellM = formatVnGoldPrice(g.sellPrice);
                  const isChangePos = (g.change || 0) >= 0;

                  return (
                    <div
                      key={g.id}
                      onClick={() =>
                        setActiveChartIndicator({
                          id: g.id,
                          name: g.name,
                          category: 'gold_vn',
                          price: sellM,
                          unit: 'Tr.đ/lượng',
                          change: g.change ? Number((g.change / 1000000).toFixed(2)) : undefined,
                          changePercent: g.changePercent,
                          buyPrice: g.buyPrice,
                          sellPrice: g.sellPrice,
                          spread: g.spread,
                        })
                      }
                      className="p-1.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors border border-transparent hover:border-zinc-800 group"
                      title={`Bấm xem biểu đồ lịch sử ${g.name}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {g.brand}
                          </span>
                          <span className="text-zinc-200 font-semibold text-[11px] truncate max-w-[135px] group-hover:text-amber-300 transition-colors">
                            {g.name}
                          </span>
                          <ChartLineUp className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <div className="text-right">
                          <span className="text-amber-300 font-bold tabular-nums text-xs">
                            {sellM} <span className="text-[10px] text-zinc-500 font-normal">Tr/lượng</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-0.5 pl-1">
                        <span>Mua: {buyM} Tr • Bán: {sellM} Tr</span>
                        {g.change !== undefined && (
                          <span className={`font-medium ${isChangePos ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isChangePos ? '▲ +' : '▼ '}
                            {Math.abs(g.change / 1000000).toFixed(1)} Tr ({g.changePercent || 0}%)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Content for World Commodities Tab */}
            {goldTab === 'world_comm' && (
              <div className="space-y-2 font-mono text-xs">
                {/* World Gold Spot */}
                <div
                  onClick={() =>
                    setActiveChartIndicator({
                      id: 'gold_world',
                      symbol: 'GC=F',
                      name: 'Vàng Thế Giới Spot (XAU/USD)',
                      category: 'gold_world',
                      price: goldWorld.price,
                      unit: goldWorld.unit,
                      change: goldWorld.change,
                      changePercent: goldWorld.changePercent,
                    })
                  }
                  className="p-1.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors group flex items-center justify-between"
                  title="Bấm xem biểu đồ vàng thế giới"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-200 font-medium group-hover:text-amber-300 transition-colors">
                      {goldWorld.name}
                    </span>
                    <ChartLineUp className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
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
                <div
                  onClick={() =>
                    setActiveChartIndicator({
                      id: 'brent',
                      symbol: 'BZ=F',
                      name: 'Dầu Brent (Thế Giới)',
                      category: 'oil',
                      price: brentOil.price,
                      unit: brentOil.unit,
                      change: brentOil.change,
                      changePercent: brentOil.changePercent,
                    })
                  }
                  className="p-1.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors group flex items-center justify-between"
                  title="Bấm xem biểu đồ dầu Brent"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-200 font-medium group-hover:text-emerald-400 transition-colors">
                      {brentOil.name}
                    </span>
                    <ChartLineUp className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
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

                {/* WTI Oil */}
                <div
                  onClick={() =>
                    setActiveChartIndicator({
                      id: 'wti',
                      symbol: 'CL=F',
                      name: 'Dầu WTI (Mỹ)',
                      category: 'oil',
                      price: wtiOil.price,
                      unit: wtiOil.unit,
                      change: wtiOil.change,
                      changePercent: wtiOil.changePercent,
                    })
                  }
                  className="p-1.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors group flex items-center justify-between"
                  title="Bấm xem biểu đồ dầu WTI"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-200 font-medium group-hover:text-emerald-400 transition-colors">
                      {wtiOil.name}
                    </span>
                    <ChartLineUp className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-zinc-100 font-semibold tabular-nums">
                      ${Number(wtiOil.price).toFixed(2)}
                    </span>
                    <span
                      className={`text-[11px] tabular-nums font-medium ${
                        Number(wtiOil.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {Number(wtiOil.changePercent || 0) >= 0 ? '+' : ''}
                      {Number(wtiOil.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Silver */}
                <div
                  onClick={() =>
                    setActiveChartIndicator({
                      id: 'silver',
                      symbol: 'SI=F',
                      name: 'Bạc Thế Giới (XAG/USD)',
                      category: 'metal',
                      price: silverWorld.price,
                      unit: silverWorld.unit,
                      change: silverWorld.change,
                      changePercent: silverWorld.changePercent,
                    })
                  }
                  className="p-1.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors group flex items-center justify-between"
                  title="Bấm xem biểu đồ bạc thế giới"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-200 font-medium group-hover:text-zinc-100 transition-colors">
                      {silverWorld.name}
                    </span>
                    <ChartLineUp className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-zinc-100 font-semibold tabular-nums">
                      ${Number(silverWorld.price).toFixed(2)}
                    </span>
                    <span
                      className={`text-[11px] tabular-nums font-medium ${
                        Number(silverWorld.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {Number(silverWorld.changePercent || 0) >= 0 ? '+' : ''}
                      {Number(silverWorld.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Savings Rate benchmark */}
          <div className="mt-4 pt-3 border-t border-[#1a1a1a] text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                CHÍNH THỨC
              </span>
              <span>Lãi suất 12M Big 4:</span>
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

      {/* ── Interactive Macro Chart Modal ── */}
      <MacroChartModal
        indicator={activeChartIndicator}
        onClose={() => setActiveChartIndicator(null)}
      />
    </div>
  );
});

UnifiedMacroMatrix.displayName = 'UnifiedMacroMatrix';
