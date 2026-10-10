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
        setLastUpdated(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
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
    return vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : vol.toString();
  };

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col h-full">
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

      {/* Table Headers */}
      <div className="grid grid-cols-2 gap-4 text-[11px] font-mono text-zinc-400 border-b border-zinc-800/60 pb-2 mb-2 px-1">
        <div className="grid grid-cols-2 text-left">
          <span>Khối lượng mua</span>
          <span className="text-right">Giá mua</span>
        </div>
        <div className="grid grid-cols-2 text-right">
          <span className="text-left">Giá bán</span>
          <span>Khối lượng bán</span>
        </div>
      </div>

      {/* Depth Rows */}
      <div className="flex-1 flex flex-col justify-center space-y-1">
        {[0, 1, 2].map((idx) => {
          const bid = bids[idx];
          const ask = asks[idx];
          const bidPct = bid && bid.volume > 0 ? (bid.volume / maxVolume) * 100 : 0;
          const askPct = ask && ask.volume > 0 ? (ask.volume / maxVolume) * 100 : 0;

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
            <div key={idx} className="grid grid-cols-2 gap-4 text-xs font-mono py-1 px-1 rounded hover:bg-zinc-900/40 transition-colors relative">
              {/* Bid Column (Buy side) */}
              <div className="relative grid grid-cols-2 items-center overflow-hidden rounded">
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 border-r border-emerald-500/30 transition-all duration-300 pointer-events-none"
                  style={{ width: `${bidPct}%` }}
                />
                <span className="text-zinc-400 text-left z-10 font-mono text-[11px]">
                  {bid && bid.volume > 0 ? formatVol(bid.volume) : '-'}
                </span>
                <span className={`font-bold text-right z-10 font-mono ${bidPriceColor}`}>
                  {bid && bid.price > 0 ? formatPrice(bid.price) : '-'}
                </span>
              </div>

              {/* Ask Column (Sell side) */}
              <div className="relative grid grid-cols-2 items-center overflow-hidden rounded">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-rose-500/10 border-l border-rose-500/30 transition-all duration-300 pointer-events-none"
                  style={{ width: `${askPct}%` }}
                />
                <span className={`font-bold text-left z-10 font-mono ${askPriceColor}`}>
                  {ask && ask.price > 0 ? formatPrice(ask.price) : '-'}
                </span>
                <span className="text-zinc-400 text-right z-10 font-mono text-[11px]">
                  {ask && ask.volume > 0 ? formatVol(ask.volume) : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Volume Summary Bar */}
      <div className="mt-4 pt-3 border-t border-zinc-800/80">
        <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 mb-1.5">
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <ChartBar size={12} /> Mua: {formatVol(currentQuotes?.totalBidVol || 0)}
          </span>
          <span className="text-rose-400 font-semibold flex items-center gap-1">
            Bán: {formatVol(currentQuotes?.totalAskVol || 0)} <ChartBar size={12} />
          </span>
        </div>
        <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex border border-zinc-800">
          <motion.div
            className="h-full bg-emerald-500/80"
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
          <div className="h-full flex-1 bg-rose-500/80" />
        </div>
      </div>
    </div>
  );
}
