'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Star,
  TrendUp,
  TrendDown,
  ChartLine,
  Lightning,
  Buildings,
  Database,
  ArrowSquareOut,
  Sparkle
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import stockDatabase from '../data/stockDatabase.json';
import { getStockPriceColor } from '../utils/priceColors';

interface StockMetadata {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
}

const STOCK_LOOKUP = new Map<string, StockMetadata>();
(stockDatabase as StockMetadata[]).forEach((item) => {
  STOCK_LOOKUP.set(item.symbol.toUpperCase(), item);
});

export const StockQuickViewModal: React.FC = () => {
  const {
    isQuickViewOpen,
    closeQuickView,
    selectedSymbol,
    ticks,
    watchlistSymbols,
    toggleWatchlistSymbol,
    updateTick
  } = useMarketStore();

  const [isLoading, setIsLoading] = useState(false);

  const tick = ticks[selectedSymbol];
  const meta = STOCK_LOOKUP.get(selectedSymbol) || {
    symbol: selectedSymbol,
    name: `${selectedSymbol} Corporation`,
    exchange: 'HOSE',
    sector: 'Doanh nghiệp niêm yết'
  };

  const isStarred = watchlistSymbols.includes(selectedSymbol);

  const [realRsRating, setRealRsRating] = useState<number | null>(null);

  // Auto-fetch fresh quote from dual-failover pipeline when modal opens
  useEffect(() => {
    if (!isQuickViewOpen || !selectedSymbol) return;

    setIsLoading(true);
    fetch(`/api/market/quote?symbol=${selectedSymbol}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data) {
          const d = resData.data;
          updateTick({
            symbol: d.symbol,
            price: d.price,
            change: d.change,
            changePercent: d.changePercent,
            volume: Math.floor(d.volume / 10),
            totalVolume: d.volume,
            high: d.high,
            low: d.low,
            open: d.open,
            referencePrice: d.referencePrice,
            ceilingPrice: d.ceilingPrice,
            floorPrice: d.floorPrice,
            timestamp: d.timestamp,
            matchType: 'B',
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    fetch(`/api/market/minervini/analysis?symbol=${selectedSymbol}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data?.rsRating) {
          setRealRsRating(resData.data.rsRating);
        }
      })
      .catch(() => {});
  }, [isQuickViewOpen, selectedSymbol, updateTick]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isQuickViewOpen) {
        closeQuickView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickViewOpen, closeQuickView]);

  if (!isQuickViewOpen) return null;

  const rawPrice = tick?.price || 0;
  const price = rawPrice > 0 && rawPrice < 1000 ? Math.round(rawPrice * 1000) : Math.round(rawPrice);
  const change = tick?.change || 0;
  const changePercent = tick?.changePercent || 0;
  const isUp = change > 0;
  const isDown = change < 0;

  const ceilPrice = tick?.ceilingPrice ? (tick.ceilingPrice < 1000 ? Math.round(tick.ceilingPrice * 1000) : tick.ceilingPrice) : 0;
  const floorPrice = tick?.floorPrice ? (tick.floorPrice < 1000 ? Math.round(tick.floorPrice * 1000) : tick.floorPrice) : 0;
  const refPrice = tick?.referencePrice ? (tick.referencePrice < 1000 ? Math.round(tick.referencePrice * 1000) : tick.referencePrice) : 0;

  const priceColor = getStockPriceColor({
    price,
    refPrice,
    ceilPrice,
    floorPrice,
    change,
    changePercent,
    exchange: meta?.exchange,
  });

  const colorClass = priceColor.colorClass;
  const badgeBgClass = priceColor.badgeBgClass;

  const rsRating = realRsRating ?? Math.min(
    99,
    Math.max(35, Math.round(50 + (changePercent || 0) * 4))
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeQuickView}
          className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="relative w-full max-w-xl bg-zinc-950/95 border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-[0_25px_80px_rgba(0,0,0,0.95)] backdrop-blur-2xl z-10 overflow-hidden ring-1 ring-white/10"
        >
          {/* Ambient Glow Gradient */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-5">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-emerald-400 font-mono font-black text-xl shadow-inner shrink-0">
                {selectedSymbol.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-mono font-black text-zinc-100 tracking-tight">
                    {selectedSymbol}
                  </h2>
                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                    {meta.exchange}
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-mono rounded-lg bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    DNSE Realtime
                  </span>
                </div>
                <p className="text-sm text-zinc-300 font-medium mt-1 leading-snug">
                  {meta.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                  <Buildings className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{meta.sector}</span>
                </div>
              </div>
            </div>

            {/* Action buttons top right */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleWatchlistSymbol(selectedSymbol)}
                title={isStarred ? 'Xóa khỏi danh mục theo dõi' : 'Thêm vào danh mục theo dõi'}
                className={`p-2 rounded-xl border transition-all ${
                  isStarred
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-amber-400'
                }`}
              >
                <Star className={`w-5 h-5 ${isStarred ? 'fill-amber-400' : ''}`} />
              </button>
              <button
                onClick={closeQuickView}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Price & Performance Section */}
          <div className="py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4.5">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Giá Khớp Lệnh Thời Gian Thực
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-3xl sm:text-4xl font-mono font-black tracking-tight ${colorClass}`}>
                    {price > 0 ? price.toLocaleString('vi-VN') : '--'}
                  </span>
                  <span className="text-xs font-mono text-zinc-500 font-bold">VNĐ</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Big Prominent RS Rating Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Sparkle weight="fill" className="w-4 h-4 text-amber-400 animate-pulse" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-amber-300">RS:</span>
                    <span className="text-base font-mono font-black text-amber-300 leading-none">
                      {rsRating}
                    </span>
                    <span className="text-[10px] text-amber-400/70 font-semibold font-mono">/99</span>
                    {rsRating >= 80 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400 text-zinc-950">
                        LEADER
                      </span>
                    )}
                  </div>
                </div>

                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-mono font-bold ${badgeBgClass}`}>
                  {isUp ? (
                    <TrendUp className="w-4 h-4" />
                  ) : isDown ? (
                    <TrendDown className="w-4 h-4" />
                  ) : null}
                  <span>
                    {change > 0 ? `+${change}` : change} ({changePercent > 0 ? `+${changePercent.toFixed(2)}` : changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Trading Corridor Grid (Trần / Sàn / Tham chiếu / Khối lượng) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
                <span className="text-[10px] font-mono text-fuchsia-400 block font-semibold">GIÁ TRẦN (CE)</span>
                <span className="text-sm font-mono font-bold text-fuchsia-400 mt-1 block">
                  {ceilPrice > 0 ? ceilPrice.toLocaleString('vi-VN') : '--'}
                </span>
              </div>
              <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
                <span className="text-[10px] font-mono text-cyan-400 block font-semibold">GIÁ SÀN (FL)</span>
                <span className="text-sm font-mono font-bold text-cyan-400 mt-1 block">
                  {floorPrice > 0 ? floorPrice.toLocaleString('vi-VN') : '--'}
                </span>
              </div>
              <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
                <span className="text-[10px] font-mono text-amber-400 block font-semibold">THAM CHIẾU (TC)</span>
                <span className="text-sm font-mono font-bold text-amber-400 mt-1 block">
                  {refPrice > 0 ? refPrice.toLocaleString('vi-VN') : '--'}
                </span>
              </div>
              <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
                <span className="text-[10px] font-mono text-zinc-400 block font-semibold">TỔNG KHỐI LƯỢNG</span>
                <span className="text-sm font-mono font-bold text-zinc-200 mt-1 block">
                  {tick?.totalVolume ? tick.totalVolume.toLocaleString('vi-VN') : '--'}
                </span>
              </div>
            </div>

            {/* High / Low / Open metrics */}
            <div className="grid grid-cols-3 gap-3 mt-3 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 bg-zinc-900/20 border border-zinc-800/40 rounded-xl">
                <span className="text-zinc-500">Mở cửa</span>
                <span className="text-zinc-200 font-bold">{tick?.open ? tick.open.toLocaleString('vi-VN') : '--'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-zinc-900/20 border border-zinc-800/40 rounded-xl">
                <span className="text-emerald-500/80">Cao nhất</span>
                <span className="text-emerald-400 font-bold">{tick?.high ? tick.high.toLocaleString('vi-VN') : '--'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-zinc-900/20 border border-zinc-800/40 rounded-xl">
                <span className="text-rose-500/80">Thấp nhất</span>
                <span className="text-rose-400 font-bold">{tick?.low ? tick.low.toLocaleString('vi-VN') : '--'}</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between gap-3 border-t border-zinc-800/80 pt-4 mt-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
              <Lightning className="w-3.5 h-3.5 text-emerald-400" />
              <span>DNSE Lightspeed &bull; Realtime</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  closeQuickView();
                  // Smooth scroll to main chart
                  window.scrollTo({ top: 120, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                <ChartLine className="w-4 h-4" />
                <span>Xem Biểu Đồ K-Line</span>
                <ArrowSquareOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
