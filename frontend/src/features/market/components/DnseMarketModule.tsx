'use client';

import { motion } from 'framer-motion';
import { useDnseWebSocket } from '../hooks/useDnseWebSocket';
import { MarketIndexBar } from './MarketIndexBar';
import { MarketTicker } from './MarketTicker';
import { MarketCandleChart } from './MarketCandleChart';
import { OrderBook } from './OrderBook';
import { CurrencyCircleDollar, Lightning, Globe, ShieldCheck } from '@phosphor-icons/react';

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 },
  },
};

export function DnseMarketModule() {
  // Initialize connection & live data stream
  useDnseWebSocket();

  return (
    <div className="w-full space-y-6">
      {/* Top Index Banner Ribbon */}
      <div className="rounded-2xl overflow-hidden border border-zinc-800/80 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
        <MarketIndexBar />
      </div>

      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Lightning size={18} weight="fill" />
            </span>
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
              Thị Trường Chứng Khoán DNSE Live
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Dữ liệu thời gian thực được kết nối trực tiếp qua DNSE WebSocket API (In-Memory Streaming).
          </p>
        </div>

        {/* Security & Tech Specs Badge */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Zero DB Latency</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
            <Globe size={14} className="text-emerald-400" />
            <span>JSON Protocol</span>
          </div>
        </div>
      </div>

      {/* Asymmetric Bento 2.0 Layout Grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Left Column: Watchlist Market Ticker (3 Cols) */}
        <motion.div variants={itemVariant} className="lg:col-span-3 min-h-[460px]">
          <MarketTicker />
        </motion.div>

        {/* Middle Column: Lightweight Candlestick Chart (6 Cols) */}
        <motion.div variants={itemVariant} className="lg:col-span-6 min-h-[460px]">
          <MarketCandleChart />
        </motion.div>

        {/* Right Column: Order Book Depth (3 Cols) */}
        <motion.div variants={itemVariant} className="lg:col-span-3 min-h-[460px]">
          <OrderBook />
        </motion.div>
      </motion.div>

      {/* Foreign Investor & Market Activity Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CurrencyCircleDollar size={20} weight="bold" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-medium">Khối Ngoại Mua Ròng</div>
              <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">+248.5 tỷ VNĐ</div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
            HOSE Today
          </span>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Lightning size={20} weight="bold" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-medium">Tổng Giá Trị Giao Dịch</div>
              <div className="text-sm font-mono font-bold text-zinc-100 mt-0.5">18,450 tỷ VNĐ</div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-zinc-800">
            +12.4% vs T-1
          </span>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Globe size={20} weight="bold" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-medium">Tỷ Giá USD/VND Live</div>
              <div className="text-sm font-mono font-bold text-zinc-100 mt-0.5">25,420 VND</div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-rose-400 border border-zinc-800">
            +0.15%
          </span>
        </div>
      </div>
    </div>
  );
}
