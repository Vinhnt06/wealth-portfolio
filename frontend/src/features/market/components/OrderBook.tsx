'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useMarketStore } from '../store/marketStore';
import { Stack, ChartBar, ArrowsClockwise } from '@phosphor-icons/react';
import { getStockPriceColor } from '../utils/priceColors';

export function OrderBook() {
  const { selectedSymbol, quotes, ticks, updateQuotes, updateTick } = useMarketStore();
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const currentQuotes = quotes[selectedSymbol];
  const currentTick = ticks[selectedSymbol];

  const fetchRealOrderBook = useCallback(async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/market/orderbook?symbol=${selectedSymbol}`);
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        updateQuotes({
          symbol: d.symbol,
          bids: d.bids,
          asks: d.asks,
          totalBidVol: d.totalBidVol,
          totalAskVol: d.totalAskVol,
          timestamp: d.timestamp,
        });

        // Also update tick with real prices
        if (d.price) {
          updateTick({
            symbol: d.symbol,
            price: d.price,
            change: d.change,
            changePercent: d.changePercent,
            volume: d.totalVolume,
            totalVolume: d.totalVolume,
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
        setLastUpdated(new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }));
      }
    } catch (err) {
      console.error('Lỗi tải sổ lệnh thật:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, updateQuotes, updateTick]);

  useEffect(() => {
    fetchRealOrderBook();
    const timer = setInterval(fetchRealOrderBook, 12000); // Tự động làm mới mỗi 12s
    return () => clearInterval(timer);
  }, [fetchRealOrderBook]);

  const bids = currentQuotes?.bids || [];
  const asks = currentQuotes?.asks || [];

  const maxVolume = Math.max(
    ...bids.map((b) => b.volume),
    ...asks.map((a) => a.volume),
    10000
  );

  const formatPrice = (price: number) => {
    return (price / 1000).toFixed(2);
  };

  const formatVol = (vol: number) => {
    if (!vol) return '0';
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
    return vol.toLocaleString('vi-VN');
  };

  return (
    <div suppressHydrationWarning className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400">
            <Stack size={16} weight="bold" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100 text-sm tracking-tight flex items-center gap-2">
              Sổ Lệnh (Order Book)
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-zinc-800 font-bold">
                {selectedSymbol}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                DỮ LIỆU THẬT 100%
              </span>
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-zinc-400">Độ sâu 3 mức giá mua/bán tốt nhất</p>
              {lastUpdated && (
                <span className="text-[9px] text-zinc-500 font-mono">({lastUpdated})</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchRealOrderBook()}
            disabled={loading}
            title="Làm mới sổ lệnh thật"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {currentTick && (() => {
            const tickColor = getStockPriceColor({
              price: currentTick.price,
              refPrice: currentTick.referencePrice,
              ceilPrice: currentTick.ceilingPrice,
              floorPrice: currentTick.floorPrice,
              change: currentTick.change,
              changePercent: currentTick.changePercent,
            });
            return (
              <div className="text-right">
                <div className={`text-sm font-mono font-bold ${tickColor.colorClass}`}>
                  {formatPrice(currentTick.price)}
                </div>
                <div className={`text-[11px] font-mono font-semibold ${tickColor.colorClass}`}>
                  {currentTick.change >= 0 ? '+' : ''}{(currentTick.change / 1000).toFixed(2)} ({currentTick.changePercent.toFixed(2)}%)
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Center Market Snapshot & Bid/Ask Ratio Badge */}
      <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 mb-3 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 uppercase font-bold">Lực Cầu Mua:</span>
          <span className="text-xs font-bold text-emerald-400">
            {formatVol(currentQuotes?.totalBidVol || 0)} CP
          </span>
        </div>
        <div className="h-3 w-px bg-zinc-800" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 uppercase font-bold">Lực Cung Bán:</span>
          <span className="text-xs font-bold text-rose-400">
            {formatVol(currentQuotes?.totalAskVol || 0)} CP
          </span>
        </div>
      </div>

      {/* Table Headers */}
      <div className="grid grid-cols-12 gap-1 text-[11px] font-mono text-zinc-400 border-b border-zinc-800/80 pb-2 mb-2 px-1">
        <div className="col-span-5 flex justify-between pr-2 border-r border-zinc-800/60">
          <span>KL Mua</span>
          <span className="font-bold text-emerald-400">Giá Mua</span>
        </div>
        <div className="col-span-2 text-center text-zinc-500 font-bold">
          Bước
        </div>
        <div className="col-span-5 flex justify-between pl-2 border-l border-zinc-800/60">
          <span className="font-bold text-rose-400">Giá Bán</span>
          <span>KL Bán</span>
        </div>
      </div>

      {/* 3 Depth Rows (3 Mức Giá Tốt Nhất) */}
      <div className="flex-1 flex flex-col justify-center space-y-2">
        {[0, 1, 2].map((idx) => {
          const bid = bids[idx];
          const ask = asks[idx];
          const bidPct = bid && bid.volume > 0 ? Math.min(100, (bid.volume / maxVolume) * 100) : 0;
          const askPct = ask && ask.volume > 0 ? Math.min(100, (ask.volume / maxVolume) * 100) : 0;

          const bidPriceColor = bid && bid.price > 0 ? getStockPriceColor({
            price: bid.price,
            refPrice: currentTick?.referencePrice,
            ceilPrice: currentTick?.ceilingPrice,
            floorPrice: currentTick?.floorPrice,
          }).colorClass : 'text-emerald-400';

          const askPriceColor = ask && ask.price > 0 ? getStockPriceColor({
            price: ask.price,
            refPrice: currentTick?.referencePrice,
            ceilPrice: currentTick?.ceilingPrice,
            floorPrice: currentTick?.floorPrice,
          }).colorClass : 'text-rose-400';

          return (
            <div 
              key={idx} 
              className="grid grid-cols-12 gap-1 text-xs font-mono py-1.5 px-1.5 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/40 transition-all items-center relative overflow-hidden"
            >
              {/* Bên Dư Mua (5 Cột) */}
              <div className="col-span-5 relative flex items-center justify-between pr-2 overflow-hidden rounded">
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 border-r-2 border-emerald-500/50 transition-all duration-500 pointer-events-none rounded-l"
                  style={{ width: `${bidPct}%` }}
                />
                <span className="text-zinc-300 z-10 font-mono text-[11px] font-medium">
                  {bid && bid.volume > 0 ? formatVol(bid.volume) : '-'}
                </span>
                <span className={`font-black z-10 font-mono text-sm ${bidPriceColor}`}>
                  {bid && bid.price > 0 ? formatPrice(bid.price) : '-'}
                </span>
              </div>

              {/* Nhãn Mức Giá (Giá 1, 2, 3) (2 Cột ở Giữa) */}
              <div className="col-span-2 flex items-center justify-center">
                <span className="w-5 h-5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-mono text-zinc-400 font-bold flex items-center justify-center">
                  #{idx + 1}
                </span>
              </div>

              {/* Bên Dư Bán (5 Cột) */}
              <div className="col-span-5 relative flex items-center justify-between pl-2 overflow-hidden rounded">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-rose-500/15 border-l-2 border-rose-500/50 transition-all duration-500 pointer-events-none rounded-r"
                  style={{ width: `${askPct}%` }}
                />
                <span className={`font-black z-10 font-mono text-sm ${askPriceColor}`}>
                  {ask && ask.price > 0 ? formatPrice(ask.price) : '-'}
                </span>
                <span className="text-zinc-300 z-10 font-mono text-[11px] font-medium">
                  {ask && ask.volume > 0 ? formatVol(ask.volume) : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Realtime Order Book Imbalance Meter */}
      <div className="mt-4 pt-3.5 border-t border-zinc-800/80 space-y-2">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Bên Mua: {Math.round(((currentQuotes?.totalBidVol || 1) / ((currentQuotes?.totalBidVol || 1) + (currentQuotes?.totalAskVol || 1))) * 100)}%
          </span>
          <span className="text-zinc-400 text-[10px]">TƯƠNG QUAN CUNG - CẦU</span>
          <span className="text-rose-400 font-bold flex items-center gap-1.5">
            Bên Bán: {Math.round(((currentQuotes?.totalAskVol || 1) / ((currentQuotes?.totalBidVol || 1) + (currentQuotes?.totalAskVol || 1))) * 100)}%
            <span className="w-2 h-2 rounded-full bg-rose-400" />
          </span>
        </div>
        <div className="h-2.5 w-full bg-zinc-900 rounded-full overflow-hidden flex border border-zinc-800 p-0.5 gap-0.5">
          <motion.div
            className="h-full bg-emerald-500 rounded-sm"
            initial={{ width: '50%' }}
            animate={{
              width: `${
                ((currentQuotes?.totalBidVol || 1) /
                  ((currentQuotes?.totalBidVol || 1) + (currentQuotes?.totalAskVol || 1))) *
                100
              }%`,
            }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
          <div className="h-full flex-1 bg-rose-500 rounded-sm" />
        </div>
      </div>

      {/* Thông số kỹ thuật phiên khớp lệnh thật (Cân bằng chiều cao với bảng Dòng tiền) */}
      {currentTick && (
        <div className="mt-4 pt-3.5 border-t border-zinc-800/80 space-y-2.5 font-mono">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-bold uppercase tracking-wider text-zinc-300">Biên Độ & Giá Khớp {selectedSymbol}</span>
            <span className="text-[10px] text-zinc-500">HOSE / HNX REAL DATA</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
              <span className="text-[10px] text-purple-400 font-bold block uppercase">Giá Trần</span>
              <span className="font-black text-purple-400">
                {currentTick.ceilingPrice ? formatPrice(currentTick.ceilingPrice) : '-'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
              <span className="text-[10px] text-yellow-400 font-bold block uppercase">Tham Chiếu</span>
              <span className="font-black text-yellow-400">
                {currentTick.referencePrice ? formatPrice(currentTick.referencePrice) : '-'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
              <span className="text-[10px] text-cyan-400 font-bold block uppercase">Giá Sàn</span>
              <span className="font-black text-cyan-400">
                {currentTick.floorPrice ? formatPrice(currentTick.floorPrice) : '-'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
              <span className="text-[10px] text-zinc-500 block uppercase">Cao Nhất</span>
              <span className="font-bold text-zinc-200">
                {currentTick.high ? formatPrice(currentTick.high) : '-'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
              <span className="text-[10px] text-zinc-500 block uppercase">Thấp Nhất</span>
              <span className="font-bold text-zinc-200">
                {currentTick.low ? formatPrice(currentTick.low) : '-'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
              <span className="text-[10px] text-zinc-500 block uppercase">Mở Cửa</span>
              <span className="font-bold text-zinc-200">
                {currentTick.open ? formatPrice(currentTick.open) : '-'}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Tổng Khối Lượng Khớp:</span>
            <span className="font-black text-emerald-400">
              {formatVol(currentTick.totalVolume || 0)} CP
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
