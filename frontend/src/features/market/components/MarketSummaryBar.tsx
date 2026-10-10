'use client';

import React, { useState, useMemo } from 'react';
import { TrendUp, TrendDown, Lightning, Globe, Sparkle, Fire } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import realTicksData from '../data/realTicks.json';
import stockDatabase from '../data/stockDatabase.json';

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

export const MarketSummaryBar: React.FC = () => {
  const { ticks, setSelectedSymbol, selectedSymbol } = useMarketStore();
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers' | 'volume' | 'foreign'>('gainers');

  // Compute all stocks dynamically
  const stockList = useMemo(() => {
    const rawList = Object.entries(realTicksData).map(([sym, baseData]) => {
      const liveTick = ticks[sym];
      const price = liveTick?.price ?? baseData.price;
      const ref = liveTick?.referencePrice ?? baseData.ref;
      const change = liveTick?.change ?? (price - ref);
      const changePct = liveTick?.changePercent ?? (ref > 0 ? ((price - ref) / ref) * 100 : 0);
      const volume = liveTick?.totalVolume ?? baseData.volume;
      const meta = STOCK_LOOKUP.get(sym) || {
        symbol: sym,
        name: sym,
        exchange: 'HOSE',
        sector: 'Cổ phiếu',
      };

      // Pseudo-RS based on performance and liquidity
      const rawRs = Math.min(99, Math.max(35, Math.round(50 + changePct * 6 + (volume > 10000000 ? 15 : 5))));

      return {
        symbol: sym,
        name: meta.name,
        exchange: meta.exchange,
        sector: meta.sector,
        price,
        ref,
        change,
        changePct,
        volume,
        rsRating: rawRs,
      };
    });

    return rawList;
  }, [ticks]);

  // Top Gainers
  const topGainers = useMemo(() => {
    return [...stockList]
      .filter((s) => s.changePct > 0)
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 6);
  }, [stockList]);

  // Top Losers
  const topLosers = useMemo(() => {
    return [...stockList]
      .filter((s) => s.changePct < 0)
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, 6);
  }, [stockList]);

  // Top Volume
  const topVolume = useMemo(() => {
    return [...stockList]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 6);
  }, [stockList]);

  // Foreign Trade summary
  const foreignFlow = useMemo(() => {
    return [
      { symbol: 'HPG', buyVal: 285.4, sellVal: 95.2, netVal: 190.2, price: 20100, changePct: -0.25 },
      { symbol: 'SSI', buyVal: 210.8, sellVal: 68.4, netVal: 142.4, price: 19000, changePct: -0.26 },
      { symbol: 'TCB', buyVal: 175.0, sellVal: 82.5, netVal: 92.5, price: 32350, changePct: 1.41 },
      { symbol: 'VCB', buyVal: 145.2, sellVal: 72.0, netVal: 73.2, price: 56700, changePct: 0.18 },
      { symbol: 'VHM', buyVal: 64.0, sellVal: 182.5, netVal: -118.5, price: 41500, changePct: -1.19 },
      { symbol: 'MWG', buyVal: 45.0, sellVal: 128.0, netVal: -83.0, price: 64200, changePct: -1.23 },
    ];
  }, []);

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl flex flex-col h-full">
      {/* Terminal Title & Tab Ribbon */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3.5 gap-2">
        <div className="flex items-center gap-2">
          <Fire className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-mono font-bold text-zinc-100 tracking-wider uppercase">
            Top Biến Động Thị Trường
          </h4>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/80 text-[11px] font-mono">
          <button
            onClick={() => setActiveTab('gainers')}
            className={`px-2.5 py-1 rounded-lg transition-all font-bold ${
              activeTab === 'gainers'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tăng Giá
          </button>
          <button
            onClick={() => setActiveTab('losers')}
            className={`px-2.5 py-1 rounded-lg transition-all font-bold ${
              activeTab === 'losers'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Giảm Giá
          </button>
          <button
            onClick={() => setActiveTab('volume')}
            className={`px-2.5 py-1 rounded-lg transition-all font-bold ${
              activeTab === 'volume'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Khối Lượng
          </button>
          <button
            onClick={() => setActiveTab('foreign')}
            className={`px-2.5 py-1 rounded-lg transition-all font-bold ${
              activeTab === 'foreign'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Khối Ngoại
          </button>
        </div>
      </div>

      {/* Tab Content Display */}
      <div className="space-y-2 flex-1">
        {/* TAB 1: TOP GAINERS */}
        {activeTab === 'gainers' && (
          <div className="space-y-1.5">
            {topGainers.map((item, idx) => {
              const isSelected = selectedSymbol === item.symbol;
              const formattedPrice = (item.price / 1000).toFixed(2);
              return (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                      : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/80 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 text-center text-xs font-mono font-black ${
                        idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs text-zinc-100">{item.symbol}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                          {item.exchange}
                        </span>
                        {/* Prominent RS indicator */}
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          RS {item.rsRating}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate max-w-[140px] font-sans">
                        {item.name}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-black text-zinc-100">{formattedPrice}k</div>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <span className="text-[11px] font-mono font-black px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        +{item.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: TOP LOSERS */}
        {activeTab === 'losers' && (
          <div className="space-y-1.5">
            {topLosers.map((item, idx) => {
              const isSelected = selectedSymbol === item.symbol;
              const formattedPrice = (item.price / 1000).toFixed(2);
              return (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-rose-500/10 border-rose-500/40 shadow-sm'
                      : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/80 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 text-center text-xs font-mono font-black ${
                        idx === 0 ? 'text-rose-400' : 'text-zinc-500'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs text-zinc-100">{item.symbol}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                          {item.exchange}
                        </span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          RS {item.rsRating}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate max-w-[140px] font-sans">
                        {item.name}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-black text-zinc-100">{formattedPrice}k</div>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <span className="text-[11px] font-mono font-black px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">
                        {item.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: TOP VOLUME */}
        {activeTab === 'volume' && (
          <div className="space-y-1.5">
            {topVolume.map((item, idx) => {
              const isSelected = selectedSymbol === item.symbol;
              const formattedPrice = (item.price / 1000).toFixed(2);
              const volFormatted = (item.volume / 1000000).toFixed(1) + 'M';
              const isUp = item.changePct >= 0;
              return (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm'
                      : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/80 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 text-center text-xs font-mono font-black ${
                        idx === 0 ? 'text-cyan-400' : 'text-zinc-500'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs text-zinc-100">{item.symbol}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                          {item.exchange}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate max-w-[140px] font-sans">
                        KL: <span className="font-mono font-bold text-cyan-400">{volFormatted} cp</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-black text-zinc-100">{formattedPrice}k</div>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <span
                        className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          isUp
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isUp ? '+' : ''}{item.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 4: FOREIGN FLOW */}
        {activeTab === 'foreign' && (
          <div className="space-y-1.5">
            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 mb-2 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">Toàn thị trường:</span>
              <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                +428.5 Tỷ (Mua Ròng)
              </span>
            </div>
            {foreignFlow.map((item, idx) => {
              const isSelected = selectedSymbol === item.symbol;
              const formattedPrice = (item.price / 1000).toFixed(2);
              const isNetBuy = item.netVal >= 0;
              return (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-400/40 shadow-sm'
                      : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/80 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 text-center text-xs font-mono font-black ${
                        isNetBuy ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs text-zinc-100">{item.symbol}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                          {formattedPrice}k
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 font-sans">
                        Mua: <span className="font-mono text-emerald-400">{item.buyVal}B</span> &bull; Bán: <span className="font-mono text-rose-400">{item.sellVal}B</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono text-xs font-black ${
                        isNetBuy ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isNetBuy ? '+' : ''}{item.netVal} Tỷ
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {isNetBuy ? 'Mua ròng' : 'Bán ròng'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer helper */}
      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-2">
        <span className="flex items-center gap-1">
          <Lightning className="w-3 h-3 text-emerald-400" />
          <span>Cập nhật liên tục</span>
        </span>
        <span>Bấm vào mã để xem K-Line</span>
      </div>
    </div>
  );
};
