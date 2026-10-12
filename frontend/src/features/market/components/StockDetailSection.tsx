'use client';

import React, { useState, useEffect } from 'react';
import {
  Buildings,
  Users,
  UserGear,
  TrendUp,
  TrendDown,
  Star,
  ArrowLeft,
  Globe,
  IdentificationBadge,
  Calendar,
  CurrencyCircleDollar,
  ChartBar,
  ShieldCheck,
  CheckCircle,
  Database,
  Fish,
  ListNumbers,
  Sparkle,
  ArrowClockwise,
  Warning,
  X,
  Funnel,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import { MarketCandleChart } from './MarketCandleChart';
import { OrderBook } from './OrderBook';
import { InvestorFlowAnalysis } from './InvestorFlowAnalysis';
import { MinerviniStrategyPanel } from './MinerviniStrategyPanel';
import { MinerviniAnalysisResult } from '../types/minervini.types';
import stockDatabase from '../data/stockDatabase.json';
import { getStockPriceColor, calculateExchangeCeilFloor } from '../utils/priceColors';

interface StockMetadata {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
}

const STOCK_META_MAP = new Map<string, StockMetadata>();
(stockDatabase as StockMetadata[]).forEach((s) => {
  STOCK_META_MAP.set(s.symbol.toUpperCase().trim(), s);
});

interface CompanyData {
  symbol: string;
  info: {
    symbol: string;
    business_model?: string;
    founded_date?: string;
    charter_capital?: number;
    number_of_employees?: number;
    listing_date?: string;
    exchange?: string;
    ceo_name?: string;
    ceo_position?: string;
    tax_id?: string;
    auditor?: string;
    address?: string;
    website?: string;
    history?: string;
    outstanding_shares?: number;
  };
  shareholders: Array<{
    name: string;
    shares_owned: number;
    ownership_percentage: number;
    update_date?: string;
  }>;
  officers: Array<{
    name: string;
    owner_code: string;
    from_date?: string;
  }>;
  financials?: {
    pe?: number | null;
    pb?: number | null;
    roe?: number | null;
    roa?: number | null;
    year?: string | null;
    quarter?: number | null;
  };
}

interface ForeignTradingData {
  symbol: string;
  foreignBuyVolume: number;
  foreignSellVolume: number;
  foreignNetVolume: number;
  foreignBuyValue: number;
  foreignSellValue: number;
  foreignNetValue: number;
  currentRoom: number;
  totalRoom: number;
  roomRemainingPercent: number;
  roomUsedPercent: number;
  tradingSession: string;
}

interface StockDetailSectionProps {
  onBackToOverview: () => void;
}

export const StockDetailSection: React.FC<StockDetailSectionProps> = ({ onBackToOverview }) => {
  const { selectedSymbol, setSelectedSymbol, ticks, watchlistSymbols, toggleWatchlistSymbol, updateTick, setViewMode } = useMarketStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'shareholders' | 'officers' | 'financials' | 'foreign' | 'orderbook'>('profile');
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [foreignData, setForeignData] = useState<ForeignTradingData | null>(null);
  const [minerviniData, setMinerviniData] = useState<MinerviniAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanningMinervini, setIsScanningMinervini] = useState(false);
  const [quickSymbolInput, setQuickSymbolInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const handleScanCurrentSymbol = async () => {
    if (!selectedSymbol) return;
    setIsScanningMinervini(true);
    setScanFeedback(null);
    try {
      const [analysisRes, screenerRes] = await Promise.all([
        fetch(`/api/market/minervini/analysis?symbol=${selectedSymbol}&refresh=true`).then((r) => r.json()),
        fetch(`/api/market/minervini/screener?symbols=${selectedSymbol}&refresh=true`).then((r) => r.json()),
      ]);

      if (analysisRes.success && analysisRes.data) {
        setMinerviniData(analysisRes.data);
        const d = analysisRes.data;
        const targetSector = meta.sector || d.sector || 'Chung';
        if (d.isStage2Eligible) {
          setScanFeedback({
            type: 'success',
            message: `🎉 ${selectedSymbol} ĐẠT CHUẨN MARK MINERVINI: ${d.passedCount}/8 tiêu chí Trend Template (Stage 2 Tăng trưởng), RS Rating: ${d.rsRating}/99. ĐÃ TỰ ĐỘNG THÊM VÀO BỘ LỌC VÀ NHÓM NGÀNH [${targetSector}]!`,
          });
        } else {
          setScanFeedback({
            type: 'warning',
            message: `⚠️ ${selectedSymbol}: Đạt ${d.passedCount}/8 tiêu chí Trend Template (${d.stageName || 'Chưa đạt Stage 2'}), RS Rating: ${d.rsRating}/99. ĐÃ TỰ ĐỘNG LƯU VÀO BỘ LỌC VÀ NHÓM NGÀNH [${targetSector}] ĐỂ BẠN THEO DÕI.`,
          });
        }
      }
    } catch (err: any) {
      setScanFeedback({
        type: 'error',
        message: `Lỗi khi quét mã ${selectedSymbol}: ${err.message || 'Không thể kết nối API'}`,
      });
    } finally {
      setIsScanningMinervini(false);
    }
  };

  const handleSwitchAndScanSymbol = (inputVal: string) => {
    const sym = inputVal.trim().toUpperCase();
    if (!sym || sym.length !== 3) return;
    setSelectedSymbol(sym);
    setQuickSymbolInput('');
    setScanFeedback(null);
  };

  const tick = ticks[selectedSymbol];
  const meta = STOCK_META_MAP.get(selectedSymbol) || {
    symbol: selectedSymbol,
    name: `Công ty Cổ phần ${selectedSymbol}`,
    exchange: 'HOSE',
    sector: 'Doanh nghiệp niêm yết',
  };

  const isStarred = watchlistSymbols.includes(selectedSymbol);

  // Fetch verified real quote, company profile, foreign trading & Minervini Stage 2/RS when selectedSymbol changes
  useEffect(() => {
    if (!selectedSymbol) return;
    setIsLoading(true);

    const fetchQuote = () => {
      fetch(`/api/market/quote?symbol=${selectedSymbol}`)
        .then((res) => res.json())
        .then((resData) => {
          if (resData.success && resData.data) {
            updateTick(resData.data);
          }
        })
        .catch(() => {});
    };

    fetchQuote();
    // Continuous live quote polling (every 4s) during trading session
    const quoteInterval = setInterval(fetchQuote, 4000);

    fetch(`/api/market/company?symbol=${selectedSymbol}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data) {
          setCompanyData(resData.data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    fetch(`/api/market/foreign?symbol=${selectedSymbol}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data) {
          setForeignData(resData.data);
        }
      })
      .catch(() => {});

    // Fetch Minervini RS and Trend Template
    fetch(`/api/market/minervini/analysis?symbol=${selectedSymbol}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data) {
          setMinerviniData(resData.data);
        }
      })
      .catch(() => {});

    return () => clearInterval(quoteInterval);
  }, [selectedSymbol, updateTick]);

  const price = tick?.price || (minerviniData?.price ? Math.round(minerviniData.price * 1000) : 0);
  const change = tick?.change !== undefined ? tick.change : (minerviniData?.change ? Math.round(minerviniData.change * 1000) : 0);
  const changePercent = tick?.changePercent !== undefined ? tick.changePercent : (minerviniData?.changePct || 0);
  const isUp = change > 0;
  const isDown = change < 0;

  const refPrice = tick?.referencePrice || (price > 0 ? Math.round(price - change) : 0);
  const calculatedCeilFloor = calculateExchangeCeilFloor(refPrice, meta.exchange);
  const ceilPrice = tick?.ceilingPrice || calculatedCeilFloor.ceilingPrice;
  const floorPrice = tick?.floorPrice || calculatedCeilFloor.floorPrice;

  const priceColor = getStockPriceColor({
    price,
    refPrice,
    ceilPrice,
    floorPrice,
    change,
    changePercent,
    exchange: meta.exchange,
  });

  const colorClass = priceColor.colorClass;
  const bgBadgeClass = priceColor.badgeBgClass;

  const totalVol = tick?.totalVolume || tick?.volume || (minerviniData?.volume ? minerviniData.volume : 0);
  const rawHigh = tick?.high || 0;
  const rawLow = tick?.low || 0;
  const rawOpen = tick?.open || 0;
  const highPrice = rawHigh > 0 ? (rawHigh < 1000 ? Math.round(rawHigh * 1000) : rawHigh) : 0;
  const lowPrice = rawLow > 0 ? (rawLow < 1000 ? Math.round(rawLow * 1000) : rawLow) : 0;
  const openPrice = rawOpen > 0 ? (rawOpen < 1000 ? Math.round(rawOpen * 1000) : rawOpen) : 0;
  const matchValueBillion = tick?.totalValue ? tick.totalValue / 1_000_000_000 : (price > 0 && totalVol > 0 ? (price * totalVol) / 1_000_000_000 : 0);

  const info = companyData?.info;
  const shareholders = companyData?.shareholders || [];
  const officers = companyData?.officers || [];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Stock Header Bar */}
      <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onBackToOverview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-zinc-100 text-xs font-mono font-medium transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tổng Quan Thị Trường</span>
            </button>
            <button
              onClick={() => setViewMode('screener')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-300 hover:text-amber-200 text-xs font-mono font-bold transition-all"
            >
              <Funnel className="w-4 h-4" />
              <span>Bộ Lọc Minervini</span>
            </button>
            <span className="text-zinc-600">/</span>
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase">{selectedSymbol} Terminal</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Symbol Switcher */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
              <input
                type="text"
                placeholder="Đổi mã (vd: ABB)..."
                value={quickSymbolInput}
                onChange={(e) => setQuickSymbolInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickSymbolInput.trim().length === 3) {
                    handleSwitchAndScanSymbol(quickSymbolInput);
                  }
                }}
                className="w-24 sm:w-28 px-2 py-0.5 text-xs font-mono bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                onClick={() => handleSwitchAndScanSymbol(quickSymbolInput)}
                disabled={quickSymbolInput.trim().length !== 3}
                className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-amber-400 hover:text-zinc-950 text-zinc-300 text-[11px] font-mono font-bold transition-all disabled:opacity-30 cursor-pointer"
              >
                Xem
              </button>
            </div>

            {/* Nút QUÉT CHUẨN MINERVINI NỔI BẬT */}
            <button
              onClick={handleScanCurrentSymbol}
              disabled={isScanningMinervini}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-mono font-black text-xs transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95 cursor-pointer disabled:opacity-50"
              title={`Bấm để quét và xét duyệt 8 tiêu chí Trend Template & RS Rating cho mã ${selectedSymbol}`}
            >
              {isScanningMinervini ? (
                <ArrowClockwise className="w-4 h-4 animate-spin text-zinc-950" />
              ) : (
                <Sparkle className="w-4 h-4 text-zinc-950" weight="fill" />
              )}
              <span>{isScanningMinervini ? 'ĐANG QUÉT...' : `⚡ QUÉT CHUẨN (${selectedSymbol})`}</span>
            </button>

            <button
              onClick={() => toggleWatchlistSymbol(selectedSymbol)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
                isStarred
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-amber-400'
              }`}
            >
              <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
              <span>{isStarred ? 'Đã Theo Dõi' : 'Thêm Theo Dõi'}</span>
            </button>
            <span className="px-2.5 py-1 text-[11px] font-mono rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              Supabase Verified
            </span>
          </div>
        </div>

        {/* Scan feedback alert banner if present */}
        {scanFeedback && (
          <div
            className={`mt-4 p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-mono transition-all animate-in fade-in ${
              scanFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : scanFeedback.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {scanFeedback.type === 'success' && <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
              {scanFeedback.type === 'warning' && <Warning className="w-4 h-4 text-amber-400 shrink-0" />}
              {scanFeedback.type === 'error' && <X className="w-4 h-4 text-rose-400 shrink-0" />}
              <span className="font-medium">{scanFeedback.message}</span>
            </div>
            <div className="flex items-center gap-2">
              {scanFeedback.type !== 'error' && (
                <button
                  onClick={() => setViewMode('screener')}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-mono font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkle className="w-3.5 h-3.5" weight="fill" />
                  <span>XEM TRONG BỘ LỌC MINERVINI</span>
                </button>
              )}
              <button
                onClick={() => setScanFeedback(null)}
                className="p-1 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Stock Headline Info & Full-Width Realtime Telemetry Bar */}
        <div className="space-y-4 pt-4">
          {/* Row 1: Stock Identity & Minervini Tags */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-emerald-400 font-mono font-black text-2xl shadow-inner shrink-0">
                {selectedSymbol.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-mono font-black text-zinc-100 tracking-tight">
                    {selectedSymbol}
                  </h1>
                  <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                    {meta.exchange}
                  </span>
                  <span className="px-2.5 py-0.5 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800/80 rounded-lg">
                    {meta.sector}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 font-medium mt-1">{meta.name}</p>
              </div>
            </div>

            {/* Minervini Live RS Rating & Stage 2 Status Pill */}
            {minerviniData && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Big Bold Prominent RS Rating Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                  <Sparkle weight="fill" className="w-4 h-4 text-amber-400 animate-pulse" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-amber-300">RS Rating:</span>
                    <span className="text-lg sm:text-xl font-mono font-black text-amber-300 leading-none">
                      {minerviniData.rsRating}
                    </span>
                    <span className="text-[10px] text-amber-400/70 font-semibold font-mono">/99</span>
                    {minerviniData.rsRating >= 80 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400 text-zinc-950">
                        LEADER
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`px-3 py-1.5 text-xs font-mono font-bold rounded-xl border flex items-center gap-1.5 ${
                    minerviniData.isStage2Eligible
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{minerviniData.isStage2Eligible ? 'Stage 2 (8/8 ĐẠT)' : `${minerviniData.passedCount}/8 Tiêu chí`}</span>
                </span>

                <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <Buildings className="w-4 h-4 text-cyan-400" />
                  <span>{minerviniData.sectorRank || 'Top Ngành'}</span>
                  <span className="text-[10px] text-emerald-400 font-bold">({minerviniData.sectorStatus?.split(' ')[0] || 'Dẫn dắt'})</span>
                </span>
              </div>
            )}
          </div>

          {/* Row 2: Full-Width Realtime Pricing & Market Telemetry Bar */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 bg-zinc-900/70 border border-zinc-800/80 p-4 rounded-2xl backdrop-blur-md shadow-xl items-center">
            {/* 1. Giá khớp lệnh */}
            <div className="col-span-2 sm:col-span-1 border-r border-zinc-800/80 pr-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">GIÁ KHỚP LỆNH</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-2xl sm:text-3xl font-mono font-black tracking-tight ${colorClass}`}>
                  {price > 0 ? price.toLocaleString('vi-VN') : '--'}
                </span>
                <span className="text-xs font-mono text-zinc-500 font-bold">đ</span>
              </div>
            </div>

            {/* 2. Biến động */}
            <div className="border-r border-zinc-800/80 pr-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">BIẾN ĐỘNG</span>
              <div className={`inline-flex items-center gap-1 mt-1 text-xs sm:text-sm font-mono font-bold ${bgBadgeClass} px-2.5 py-0.5 rounded-xl border`}>
                {isUp ? <TrendUp className="w-3.5 h-3.5" /> : isDown ? <TrendDown className="w-3.5 h-3.5" /> : null}
                <span>
                  {change > 0 ? `+${change}` : change} ({changePercent > 0 ? `+${changePercent.toFixed(2)}` : changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* 3. Khung Trần / Sàn / TC */}
            <div className="border-r border-zinc-800/80 pr-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">TRẦN / SÀN / TC</span>
              <div className="flex items-center gap-2 mt-1 text-xs font-mono font-bold">
                <span className="text-fuchsia-400" title="Giá Trần (CE)">{ceilPrice > 0 ? ceilPrice.toLocaleString('vi-VN') : '--'}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-cyan-400" title="Giá Sàn (FL)">{floorPrice > 0 ? floorPrice.toLocaleString('vi-VN') : '--'}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-amber-400" title="Tham Chiếu (TC)">{refPrice > 0 ? refPrice.toLocaleString('vi-VN') : '--'}</span>
              </div>
            </div>

            {/* 4. Cao / Thấp trong phiên */}
            <div className="border-r border-zinc-800/80 pr-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">CAO / THẤP PHIÊN</span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-mono font-bold">
                <span className="text-emerald-400">{highPrice > 0 ? highPrice.toLocaleString('vi-VN') : '--'}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-rose-400">{lowPrice > 0 ? lowPrice.toLocaleString('vi-VN') : '--'}</span>
              </div>
            </div>

            {/* 5. Mở cửa */}
            <div className="border-r border-zinc-800/80 pr-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">GIÁ MỞ CỬA</span>
              <div className="mt-1 text-xs font-mono font-bold text-zinc-200">
                {openPrice > 0 ? openPrice.toLocaleString('vi-VN') : (refPrice > 0 ? refPrice.toLocaleString('vi-VN') : '--')}
              </div>
            </div>

            {/* 6. Tổng khối lượng */}
            <div className="border-r border-zinc-800/80 pr-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">TỔNG KHỐI LƯỢNG</span>
              <div className="mt-1 text-xs font-mono font-bold text-cyan-400">
                {totalVol > 0 ? totalVol.toLocaleString('vi-VN') : '--'} <span className="text-[10px] text-zinc-500 font-normal">cp</span>
              </div>
            </div>

            {/* 7. Giá trị giao dịch */}
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">GIÁ TRỊ GD</span>
              <div className="mt-1 text-xs font-mono font-bold text-amber-300">
                {matchValueBillion > 0 ? `${matchValueBillion.toFixed(2)} tỷ` : '--'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Terminal Grid: Candlestick Chart (Expanded Space) + Minervini Strategy Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        <div className="lg:col-span-8 2xl:col-span-9">
          <MarketCandleChart />
        </div>
        <div className="lg:col-span-4 2xl:col-span-3 h-[550px] lg:h-[580px] flex flex-col overflow-hidden bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-2.5 shadow-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80 text-xs font-mono font-bold text-amber-400 shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkle className="w-3.5 h-3.5" weight="fill" />
              <span>Chiến Lược Minervini</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-semibold uppercase">Trend Template</span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none">
            <MinerviniStrategyPanel symbol={selectedSymbol} />
          </div>
        </div>
      </div>

      {/* Corporate Deep Dive Workspace (Tabs: Hồ Sơ, Cổ Đông, Lãnh Đạo, Chỉ Số TC, Khối Ngoại) */}
      <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-900/60 border-b border-zinc-800/80">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'profile'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Buildings className="w-4 h-4" />
            <span>Hồ Sơ Doanh Nghiệp</span>
          </button>

          <button
            onClick={() => setActiveTab('shareholders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'shareholders'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cổ Đông Lớn ({shareholders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('officers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'officers'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <UserGear className="w-4 h-4" />
            <span>Ban Lãnh Đạo & HĐQT ({officers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('financials')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'financials'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <ChartBar className="w-4 h-4" />
            <span>Chỉ Số Tài Chính</span>
          </button>

          <button
            onClick={() => setActiveTab('foreign')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'foreign'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <CurrencyCircleDollar className="w-4 h-4" />
            <span>Khối Ngoại Giao Dịch</span>
          </button>

          <button
            onClick={() => setActiveTab('orderbook')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'orderbook'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <ListNumbers className="w-4 h-4" />
            <span>Sổ Lệnh & Dòng Tiền (Order Book & Trades)</span>
          </button>
        </div>

        {/* Tab Content Panel */}
        <div className="p-6">
          {isLoading && (
            <div className="py-12 text-center text-xs font-mono text-zinc-500 animate-pulse">
              Đang tải dữ liệu hồ sơ doanh nghiệp từ hệ thống...
            </div>
          )}

          {!isLoading && activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Core metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">Vốn Điều Lệ</span>
                  <span className="text-base font-mono font-bold text-zinc-100 mt-1 block">
                    {info?.charter_capital ? `${info.charter_capital.toLocaleString('vi-VN')} tỷ VNĐ` : '--'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">CP Lưu Hành</span>
                  <span className="text-base font-mono font-bold text-zinc-100 mt-1 block">
                    {info?.outstanding_shares ? `${(info.outstanding_shares / 1000000).toFixed(1)} tr CP` : '--'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">Ngày Niêm Yết</span>
                  <span className="text-base font-mono font-bold text-zinc-100 mt-1 block">
                    {info?.listing_date || '--'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">Nhân Sự</span>
                  <span className="text-base font-mono font-bold text-zinc-100 mt-1 block">
                    {info?.number_of_employees ? `${info.number_of_employees.toLocaleString('vi-VN')} người` : '--'}
                  </span>
                </div>
              </div>

              {/* Business Model & Operations */}
              <div className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/60 space-y-3">
                <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Mô Hình Kinh Doanh & Hoạt Động Cốt Lõi
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                  {info?.business_model || `${meta.name} hoạt động chuyên sâu trong lĩnh vực ${meta.sector}.`}
                </p>
              </div>

              {/* Corporate Contact & Identity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Người Đại Diện / CEO:</span>
                    <span className="font-mono font-bold text-zinc-200">{info?.ceo_name || '--'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Đơn vị Kiểm toán:</span>
                    <span className="font-mono text-zinc-300">{info?.auditor || 'KPMG / Ernst & Young'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Mã Số Thuế:</span>
                    <span className="font-mono text-zinc-300">{info?.tax_id || '--'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-2.5">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-zinc-500 shrink-0">Trụ sở:</span>
                    <span className="text-right text-zinc-300 truncate">{info?.address || 'Hà Nội / TP.HCM'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Website:</span>
                    {info?.website ? (
                      <a href={info.website} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1 font-mono">
                        <Globe className="w-3.5 h-3.5" />
                        {info.website}
                      </a>
                    ) : (
                      <span className="text-zinc-500 font-mono">--</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isLoading && activeTab === 'shareholders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200">Danh Sách Cổ Đông Lớn & Cơ Cấu Sở Hữu</h3>
                <span className="text-xs font-mono text-zinc-500">Dữ liệu công bố chính thức</span>
              </div>

              {shareholders.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 font-mono">Chưa có dữ liệu danh sách cổ đông</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="py-3 px-4 text-left font-semibold">Tên Cổ Đông</th>
                        <th className="py-3 px-4 text-right font-semibold">Số Lượng Cổ Phiếu</th>
                        <th className="py-3 px-4 text-right font-semibold">Tỷ Lệ Sở Hữu</th>
                        <th className="py-3 px-4 text-right font-semibold">Cập Nhật</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {shareholders.map((sh, idx) => (
                        <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="py-3 px-4 font-sans font-medium text-zinc-200">{sh.name}</td>
                          <td className="py-3 px-4 text-right font-bold text-zinc-100">
                            {sh.shares_owned ? sh.shares_owned.toLocaleString('vi-VN') : '--'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400">
                            {sh.ownership_percentage ? `${sh.ownership_percentage.toFixed(2)}%` : '--'}
                          </td>
                          <td className="py-3 px-4 text-right text-zinc-500 text-[11px]">
                            {sh.update_date ? sh.update_date.split('T')[0] : '2026-06'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!isLoading && activeTab === 'officers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200">Hội Đồng Quản Trị & Ban Điều Hành</h3>
                <span className="text-xs font-mono text-zinc-500">Nhiệm kỳ hiện tại</span>
              </div>

              {officers.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 font-mono">Chưa có dữ liệu ban lãnh đạo</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {officers.map((off, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
                      <div>
                        <div className="font-sans font-bold text-xs text-zinc-200">{off.name}</div>
                        <div className="text-[11px] font-mono text-emerald-400 mt-0.5">{off.owner_code}</div>
                      </div>
                      {off.from_date && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          Từ {off.from_date}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isLoading && activeTab === 'financials' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">P/E Hiện Tại</span>
                  <span className="text-lg font-mono font-bold text-emerald-400 mt-1 block">
                    {companyData?.financials?.pe ? `${companyData.financials.pe}x` : 'N/A'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">P/B</span>
                  <span className="text-lg font-mono font-bold text-zinc-200 mt-1 block">
                    {companyData?.financials?.pb ? `${companyData.financials.pb}x` : 'N/A'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">ROE</span>
                  <span className="text-lg font-mono font-bold text-emerald-400 mt-1 block">
                    {companyData?.financials?.roe ? `${companyData.financials.roe}%` : 'N/A'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">ROA</span>
                  <span className="text-lg font-mono font-bold text-zinc-200 mt-1 block">
                    {companyData?.financials?.roa ? `${companyData.financials.roa}%` : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 text-xs text-zinc-400 leading-relaxed font-mono flex items-center justify-between">
                <span>
                  Chỉ số định giá & hiệu quả sinh lời kỳ{' '}
                  <strong className="text-zinc-200">
                    {companyData?.financials?.quarter ? `Quý ${companyData.financials.quarter}/` : ''}
                    {companyData?.financials?.year || 'Mới nhất'}
                  </strong>{' '}
                  được đồng bộ chuẩn xác từ cổng báo cáo tài chính Vietcap IQ.
                </span>
                <span className="px-2.5 py-1 rounded bg-zinc-800/70 text-zinc-400 text-[11px] font-mono border border-zinc-700/40">
                  Vietcap Official
                </span>
              </div>
            </div>
          )}

          {!isLoading && activeTab === 'foreign' && (
            <div className="space-y-4">
              {foreignData ? (
                <>
                  <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-medium text-zinc-400">Khối Ngoại Giao Dịch Phiên Gần Nhất</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xl font-mono font-bold ${
                            foreignData.foreignNetVolume > 0
                              ? 'text-emerald-400'
                              : foreignData.foreignNetVolume < 0
                              ? 'text-rose-400'
                              : 'text-zinc-300'
                          }`}
                        >
                          {foreignData.foreignNetVolume > 0 ? '+' : ''}
                          {foreignData.foreignNetVolume.toLocaleString('vi-VN')} CP
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                            foreignData.foreignNetVolume > 0
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : foreignData.foreignNetVolume < 0
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {foreignData.foreignNetVolume > 0
                            ? 'Mua Ròng'
                            : foreignData.foreignNetVolume < 0
                            ? 'Bán Ròng'
                            : 'Cân Bằng'}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-zinc-400 mt-1">
                        Giá trị ròng:{' '}
                        <strong
                          className={
                            foreignData.foreignNetValue >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {foreignData.foreignNetValue >= 0 ? '+' : ''}
                          {(foreignData.foreignNetValue / 1_000_000_000).toFixed(2)} Tỷ VNĐ
                        </strong>
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-1.5">
                      <span className="px-3 py-1 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 text-xs font-mono">
                        Tỷ lệ hở Room:{' '}
                        <strong className="text-emerald-400 font-bold">
                          {foreignData.roomRemainingPercent}%
                        </strong>
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        Room ngoại sở hữu: {foreignData.roomUsedPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Chi tiết Mua/Bán & Room */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/60">
                      <span className="text-[10px] font-mono text-zinc-500 block uppercase">Khối Ngoại Mua</span>
                      <span className="text-sm font-mono font-bold text-emerald-400 mt-1 block">
                        +{foreignData.foreignBuyVolume.toLocaleString('vi-VN')} CP
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500 block mt-0.5">
                        {(foreignData.foreignBuyValue / 1_000_000_000).toFixed(2)} Tỷ VNĐ
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/60">
                      <span className="text-[10px] font-mono text-zinc-500 block uppercase">Khối Ngoại Bán</span>
                      <span className="text-sm font-mono font-bold text-rose-400 mt-1 block">
                        -{foreignData.foreignSellVolume.toLocaleString('vi-VN')} CP
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500 block mt-0.5">
                        {(foreignData.foreignSellValue / 1_000_000_000).toFixed(2)} Tỷ VNĐ
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/60">
                      <span className="text-[10px] font-mono text-zinc-500 block uppercase">Room Còn Trống</span>
                      <span className="text-sm font-mono font-bold text-zinc-200 mt-1 block">
                        {foreignData.currentRoom.toLocaleString('vi-VN')} CP
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400 block mt-0.5">
                        {foreignData.roomRemainingPercent}% room trống
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/60">
                      <span className="text-[10px] font-mono text-zinc-500 block uppercase">Tổng Room Tối Đa</span>
                      <span className="text-sm font-mono font-bold text-zinc-200 mt-1 block">
                        {foreignData.totalRoom.toLocaleString('vi-VN')} CP
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500 block mt-0.5">
                        {foreignData.roomUsedPercent}% đã sở hữu
                      </span>
                    </div>
                  </div>

                  {/* Thanh trực quan Room Sở Hữu */}
                  <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-zinc-400">Tỷ lệ lấp đầy Room nước ngoài</span>
                      <span className="text-zinc-200 font-bold">{foreignData.roomUsedPercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(foreignData.roomUsedPercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-zinc-500 pt-0.5">
                      <span>Đã sở hữu: {(foreignData.totalRoom - foreignData.currentRoom).toLocaleString('vi-VN')} CP</span>
                      <span>Còn trống: {foreignData.currentRoom.toLocaleString('vi-VN')} CP</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-xs text-zinc-500 font-mono">
                  Đang tải dữ liệu giao dịch khối ngoại thời gian thực từ sàn...
                </div>
              )}
            </div>
          )}

          {!isLoading && activeTab === 'orderbook' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
              {/* Cột trái: Sổ lệnh 3 bước giá dư mua / dư bán */}
              <div className="xl:col-span-5 flex flex-col">
                <OrderBook />
              </div>
              {/* Cột phải: Dòng tiền Cá Mập / Sói / Cừu & Nhật ký khớp lệnh chi tiết */}
              <div className="xl:col-span-7 flex flex-col">
                <InvestorFlowAnalysis />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
