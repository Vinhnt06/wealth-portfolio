'use client';

import React, { useState } from 'react';
import { ListNumbers, Info, ShieldCheck, CaretUp, CaretDown, ArrowsOutSimple } from '@phosphor-icons/react';
import { OrderBook } from './OrderBook';
import { SymbolInfoPanel } from './SymbolInfoPanel';
import { useMarketStore } from '../store/marketStore';

type TabType = 'orderbook' | 'info' | 'foreign';

export const MarketTabbedSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('orderbook');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { selectedSymbol } = useMarketStore();

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/60 rounded-2xl p-4 backdrop-blur-xl flex flex-col h-full transition-all">
      {/* Header Bar with Tabs & Collapse Toggle */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-3 mb-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80">
          <button
            onClick={() => setActiveTab('orderbook')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'orderbook'
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <ListNumbers className="w-3.5 h-3.5" />
            <span>Sổ Lệnh</span>
          </button>

          <button
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'info'
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Thông Tin</span>
          </button>

          <button
            onClick={() => setActiveTab('foreign')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'foreign'
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Khối Ngoại</span>
          </button>
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
          title={isCollapsed ? 'Mở rộng panel' : 'Thu nhỏ panel'}
        >
          {isCollapsed ? <CaretDown className="w-4 h-4" /> : <CaretUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Tab Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'orderbook' && <OrderBook />}

          {activeTab === 'info' && <SymbolInfoPanel />}

          {activeTab === 'foreign' && (
            <div className="space-y-4 text-xs font-mono p-2">
              <div className="flex justify-between items-center p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/60">
                <span className="text-zinc-400">Mã Chứng Khoán:</span>
                <span className="font-bold text-zinc-100">{selectedSymbol}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/60">
                <span className="text-zinc-400">Khối Ngoại Mua:</span>
                <span className="font-bold text-emerald-400">1,450,000 CP (41.2 Tỷ)</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/60">
                <span className="text-zinc-400">Khối Ngoại Bán:</span>
                <span className="font-bold text-rose-400">820,000 CP (23.3 Tỷ)</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30">
                <span className="text-emerald-400 font-bold">Mua Ròng Ròng Rã:</span>
                <span className="font-extrabold text-emerald-300 text-sm">+17.9 Tỷ VNĐ</span>
              </div>

              {/* Progress visual */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Tỉ lệ sở hữu nước ngoài:</span>
                  <span className="font-bold text-zinc-200">34.8% / 49.0%</span>
                </div>
                <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div style={{ width: '71%' }} className="h-full bg-emerald-500 rounded-full" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
