'use client';

import { motion } from 'framer-motion';
import { useMarketStore } from '../store/marketStore';
import { TrendUp, TrendDown, Minus, Broadcast, WifiHigh, WifiSlash } from '@phosphor-icons/react';

export function MarketIndexBar() {
  const { indexes, wsStatus } = useMarketStore();
  const indexList = Object.values(indexes);

  return (
    <div className="w-full bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between text-xs overflow-x-auto gap-6 scrollbar-none">
      {/* Live Stream Indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800">
          <Broadcast size={14} className={wsStatus === 'connected' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'} />
        </div>
        <span className="font-semibold tracking-wide text-zinc-300 uppercase text-[11px]">Trực Tuyến</span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
          wsStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          {wsStatus === 'connected' ? <WifiHigh size={10} className="mr-1 inline" /> : <WifiSlash size={10} className="mr-1 inline" />}
          {wsStatus.toUpperCase()}
        </span>
      </div>

      {/* Indices Bar */}
      <div className="flex items-center gap-6 overflow-x-auto scrollbar-none py-0.5">
        {indexList.map((idx) => {
          const isPositive = idx.change > 0;
          const isNegative = idx.change < 0;

          return (
            <motion.div
              key={idx.symbol}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              className="flex items-center gap-2.5 shrink-0 bg-zinc-900/60 border border-zinc-800/60 px-3 py-1.5 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <span className="font-semibold text-zinc-300 font-mono tracking-tight">{idx.symbol}</span>
              <span className="font-mono font-semibold text-zinc-100">{idx.value.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}</span>

              <div className={`flex items-center gap-1 font-mono font-medium text-[11px] ${
                isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-amber-400'
              }`}>
                {isPositive ? <TrendUp size={12} weight="bold" /> : isNegative ? <TrendDown size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
                <span>{isPositive ? '+' : ''}{idx.change.toFixed(2)}</span>
                <span>({isPositive ? '+' : ''}{idx.changePercent.toFixed(2)}%)</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Market Breadth Summary */}
      <div className="hidden lg:flex items-center gap-3 shrink-0 text-[11px] font-mono text-zinc-400 border-l border-zinc-800 pl-4">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-emerald-400 font-semibold">224</span> Tăng
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-amber-400 font-semibold">65</span> TC
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span className="text-rose-400 font-semibold">138</span> Giảm
        </span>
      </div>
    </div>
  );
}
