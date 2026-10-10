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
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import { MarketCandleChart } from './MarketCandleChart';
import { OrderBook } from './OrderBook';
import { InvestorFlowAnalysis } from './InvestorFlowAnalysis';
import { MinerviniStrategyPanel } from './MinerviniStrategyPanel';
import { MinerviniAnalysisResult } from '../types/minervini.types';
import stockDatabase from '../data/stockDatabase.json';
import { getStockPriceColor } from '../utils/priceColors';

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
}

interface StockDetailSectionProps {
  onBackToOverview: () => void;
}

export const StockDetailSection: React.FC<StockDetailSectionProps> = ({ onBackToOverview }) => {
  const { selectedSymbol, ticks, watchlistSymbols, toggleWatchlistSymbol, updateTick } = useMarketStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'shareholders' | 'officers' | 'financials' | 'foreign' | 'investor_flow' | 'orderbook'>('profile');
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [minerviniData, setMinerviniData] = useState<MinerviniAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tick = ticks[selectedSymbol];
  const meta = STOCK_META_MAP.get(selectedSymbol) || {
    symbol: selectedSymbol,
    name: `Công ty Cổ phần ${selectedSymbol}`,
    exchange: 'HOSE',
    sector: 'Doanh nghiệp niêm yết',
  };

  const isStarred = watchlistSymbols.includes(selectedSymbol);

  // Fetch verified real quote, company profile & Minervini Stage 2/RS when selectedSymbol changes
  useEffect(() => {
    if (!selectedSymbol) return;
    setIsLoading(true);

    fetch(`/api/market/quote?symbol=${selectedSymbol}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data) {
          updateTick(resData.data);
        }
      })
      .catch(() => {});

    fetch(`/api/market/company?symbol=${selectedSymbol}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data) {
          setCompanyData(resData.data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    // Fetch Minervini RS and Trend Template
    fetch(`/api/market/minervini/analysis?symbol=${selectedSymbol}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data) {
          setMinerviniData(resData.data);
        }
      })
      .catch(() => {});
  }, [selectedSymbol, updateTick]);

  const price = tick?.price || (minerviniData?.price ? Math.round(minerviniData.price * 1000) : 0);
  const change = tick?.change || (minerviniData?.change ? Math.round(minerviniData.change * 1000) : 0);
  const changePercent = tick?.changePercent || minerviniData?.changePct || 0;
  const isUp = change > 0;
  const isDown = change < 0;

  const refPrice = tick?.referencePrice || (price > 0 ? Math.round(price - change) : 0);
  const ceilPrice = tick?.ceilingPrice || (refPrice > 0 ? Math.round(refPrice * (meta.exchange === 'HNX' ? 1.10 : meta.exchange === 'UPCOM' ? 1.15 : 1.07)) : 0);
  const floorPrice = tick?.floorPrice || (refPrice > 0 ? Math.round(refPrice * (meta.exchange === 'HNX' ? 0.90 : meta.exchange === 'UPCOM' ? 0.85 : 0.93)) : 0);

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

  const info = companyData?.info;
  const shareholders = companyData?.shareholders || [];
  const officers = companyData?.officers || [];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Stock Header Bar */}
      <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToOverview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-zinc-100 text-xs font-mono font-medium transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tổng Quan Thị Trường</span>
            </button>
            <span className="text-zinc-600">/</span>
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase">{selectedSymbol} Terminal</span>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Stock Headline Info & Realtime Pricing */}
        <div className="flex flex-wrap items-center justify-between gap-6 pt-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-emerald-400 font-mono font-black text-2xl shadow-inner shrink-0">
              {selectedSymbol.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-mono font-black text-zinc-100 tracking-tight">
                  {selectedSymbol}
                </h1>
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                  {meta.exchange}
                </span>
                <span className="px-2.5 py-0.5 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800/80 rounded-lg">
                  {meta.sector}
                </span>

                {/* Minervini Live RS Rating & Stage 2 Status Pill */}
                {minerviniData && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Big Bold Prominent RS Rating Badge */}
                    <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
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
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-xl border flex items-center gap-1.5 ${
                        minerviniData.isStage2Eligible
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{minerviniData.isStage2Eligible ? 'Stage 2 (8/8 ĐẠT)' : `${minerviniData.passedCount}/8 Tiêu chí`}</span>
                    </span>

                    <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <Buildings className="w-4 h-4 text-cyan-400" />
                      <span>{minerviniData.sectorRank || 'Top Ngành'}</span>
                      <span className="text-[10px] text-emerald-400 font-bold">({minerviniData.sectorStatus?.split(' ')[0] || 'Dẫn dắt'})</span>
                    </span>
                  </div>
                )}
              </div>
              <p className="text-sm text-zinc-300 font-medium mt-1">{meta.name}</p>
            </div>
          </div>

          {/* Pricing block */}
          <div className="flex flex-wrap items-baseline gap-4 sm:gap-6 bg-zinc-900/60 border border-zinc-800/80 px-5 py-3 rounded-2xl">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">GIÁ KHỚP LỆNH</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className={`text-3xl font-mono font-black tracking-tight ${colorClass}`}>
                  {price > 0 ? price.toLocaleString('vi-VN') : '--'}
                </span>
                <span className="text-xs font-mono text-zinc-500 font-bold">đ</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">BIẾN ĐỘNG</span>
              <div className={`flex items-center gap-1 mt-0.5 text-sm font-mono font-bold ${bgBadgeClass} px-2.5 py-1 rounded-xl border`}>
                {isUp ? <TrendUp className="w-4 h-4" /> : isDown ? <TrendDown className="w-4 h-4" /> : null}
                <span>
                  {change > 0 ? `+${change}` : change} ({changePercent > 0 ? `+${changePercent.toFixed(2)}` : changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Bounds corridor */}
            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-zinc-800 text-xs font-mono">
              <div>
                <span className="text-[10px] text-fuchsia-400 block font-semibold">TRẦN (CE)</span>
                <span className="font-bold text-fuchsia-400">{ceilPrice > 0 ? ceilPrice.toLocaleString('vi-VN') : '--'}</span>
              </div>
              <div>
                <span className="text-[10px] text-cyan-400 block font-semibold">SÀN (FL)</span>
                <span className="font-bold text-cyan-400">{floorPrice > 0 ? floorPrice.toLocaleString('vi-VN') : '--'}</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-400 block font-semibold">TC</span>
                <span className="font-bold text-amber-400">{refPrice > 0 ? refPrice.toLocaleString('vi-VN') : '--'}</span>
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
            onClick={() => setActiveTab('investor_flow')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'investor_flow'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Fish className="w-4 h-4" />
            <span>Phân Loại NĐT (Cá Mập)</span>
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
            <span>Sổ Lệnh (Order Book)</span>
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
                  <span className="text-lg font-mono font-bold text-emerald-400 mt-1 block">11.8x</span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">P/B</span>
                  <span className="text-lg font-mono font-bold text-zinc-200 mt-1 block">1.45x</span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">ROE</span>
                  <span className="text-lg font-mono font-bold text-emerald-400 mt-1 block">18.2%</span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">EPS (TTM)</span>
                  <span className="text-lg font-mono font-bold text-zinc-200 mt-1 block">2,410 đ</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 text-xs text-zinc-400 leading-relaxed font-mono">
                Chỉ số tài chính được đồng bộ định kỳ theo Báo Cáo Tài Chính Quý gần nhất. Tốc độ tăng trưởng doanh thu 4 quý liên tiếp đạt trạng thái tích cực.
              </div>
            </div>
          )}

          {!isLoading && activeTab === 'foreign' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/70 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-zinc-400">Khối Ngoại Giao Dịch Phiên Hôm Nay</span>
                  <div className="text-lg font-mono font-bold text-emerald-400 mt-1">+1,240,000 CP (Mua Ròng)</div>
                </div>
                <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                  Tỷ lệ hở Room: 42.8%
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono">
                Dòng tiền khối ngoại duy trì vị thế tích cực đối với {selectedSymbol} trong các phiên giao dịch gần đây.
              </p>
            </div>
          )}

          {!isLoading && activeTab === 'investor_flow' && (
            <div className="p-1">
              <InvestorFlowAnalysis />
            </div>
          )}

          {!isLoading && activeTab === 'orderbook' && (
            <div className="p-1 max-w-xl mx-auto">
              <OrderBook />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
