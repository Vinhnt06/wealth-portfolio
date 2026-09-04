'use client';

import { motion } from 'framer-motion';
import { useMarketStore } from '../store/marketStore';
import { TrendUp, TrendDown, Star, ArrowRight } from '@phosphor-icons/react';

export function MarketTicker() {
  const { ticks, selectedSymbol, setSelectedSymbol } = useMarketStore();
  const tickList = Object.values(ticks);

  const formatPrice = (p: number) => (p / 1000).toFixed(2);
  const formatVol = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return v.toString();
  };

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400">
            <Star size={16} weight="fill" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100 text-sm tracking-tight">Bảng Giá Thị Trường Live</h3>
            <p className="text-[11px] text-zinc-400">Chọn mã để xem sổ lệnh & biểu đồ kỹ thuật</p>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 text-[11px] font-mono text-zinc-400 border-b border-zinc-800/60 pb-2 mb-1 px-2 font-medium">
        <div className="col-span-3 text-left">Mã CK</div>
        <div className="col-span-3 text-right">Giá Khớp</div>
        <div className="col-span-3 text-right">+/- %</div>
        <div className="col-span-3 text-right">Tổng KL</div>
      </div>

      {/* Ticker Rows */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-none">
        {tickList.map((tick) => {
          const isSelected = tick.symbol === selectedSymbol;
          const isPositive = tick.change > 0;
          const isNegative = tick.change < 0;

          const textColor = isPositive
            ? 'text-emerald-400'
            : isNegative
            ? 'text-rose-400'
            : 'text-amber-400';

          const bgHighlight = isSelected
            ? 'bg-zinc-800/80 border-zinc-700/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
            : 'bg-zinc-900/30 hover:bg-zinc-900/80 border-transparent';

          return (
            <motion.div
              key={tick.symbol}
              layout
              onClick={() => setSelectedSymbol(tick.symbol)}
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              className={`grid grid-cols-12 items-center py-2.5 px-2 rounded-xl text-xs font-mono border transition-all cursor-pointer ${bgHighlight}`}
            >
              {/* Symbol Name */}
              <div className="col-span-3 flex items-center gap-1.5 font-bold text-zinc-100">
                <span className="tracking-wider">{tick.symbol}</span>
                {isSelected && <ArrowRight size={12} className="text-emerald-400 shrink-0" />}
              </div>

              {/* Match Price */}
              <div className={`col-span-3 text-right font-bold font-mono text-sm ${textColor}`}>
                {formatPrice(tick.price)}
              </div>

              {/* Change % */}
              <div className={`col-span-3 text-right font-mono font-medium flex items-center justify-end gap-0.5 ${textColor}`}>
                {isPositive ? (
                  <TrendUp size={12} weight="bold" />
                ) : isNegative ? (
                  <TrendDown size={12} weight="bold" />
                ) : null}
                <span>
                  {isPositive ? '+' : ''}
                  {tick.changePercent.toFixed(2)}%
                </span>
              </div>

              {/* Total Volume */}
              <div className="col-span-3 text-right text-zinc-400 font-mono text-[11px]">
                {formatVol(tick.totalVolume)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
