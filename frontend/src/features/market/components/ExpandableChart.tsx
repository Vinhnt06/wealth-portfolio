'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartLine, ArrowsOutSimple, X, CaretDown, CaretUp } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import { MarketCandleChart } from './MarketCandleChart';

export const ExpandableChart: React.FC = () => {
  const { isChartExpanded, toggleChartExpanded, selectedSymbol } = useMarketStore();
  const [isFullscreenModal, setIsFullscreenModal] = useState(false);

  return (
    <>
      {/* Expand/Collapse Header Bar */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-md transition-all">
        <button
          onClick={toggleChartExpanded}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
              <ChartLine className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-zinc-100">Biểu Đồ Kỹ Thuật {selectedSymbol}</span>
              </div>
              <p className="text-xs text-zinc-400 font-sans">
                {isChartExpanded ? 'Nhấn để thu nhỏ biểu đồ' : 'Nhấn để phóng to & phân tích xu hướng kỹ thuật'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isChartExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreenModal(true);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 transition-colors border border-zinc-700/60"
                title="Mở toàn màn hình"
              >
                <ArrowsOutSimple className="w-3.5 h-3.5" />
                <span>Toàn Màn Hình</span>
              </button>
            )}

            <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-400 group-hover:text-zinc-200">
              {isChartExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {/* Inline Expanded Chart */}
        <AnimatePresence>
          {isChartExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-zinc-800/80 p-4 bg-zinc-950/80"
            >
              <MarketCandleChart />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fullscreen Modal View */}
      {isFullscreenModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl p-4 sm:p-8 flex flex-col justify-between animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold text-zinc-100">PHÂN TÍCH KỸ THUẬT CHUYÊN SÂU — {selectedSymbol}</span>
              <span className="text-xs font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                LIVE STREAM
              </span>
            </div>

            <button
              onClick={() => setIsFullscreenModal(false)}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 w-full h-full min-h-[500px]">
            <MarketCandleChart />
          </div>
        </div>
      )}
    </>
  );
};
