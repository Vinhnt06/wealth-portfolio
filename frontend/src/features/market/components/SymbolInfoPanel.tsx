'use client';

import React from 'react';
import { Star, ChartLine, ShieldCheck, Coins, ArrowsLeftRight, Lightning } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

export const SymbolInfoPanel: React.FC = () => {
  const { selectedSymbol, ticks, quotes, watchlistSymbols, toggleWatchlistSymbol, toggleChartExpanded, isChartExpanded } = useMarketStore();

  const tick = ticks[selectedSymbol];
  const quote = quotes[selectedSymbol];

  const currentPrice = tick?.price ? tick.price / 1000 : 28.5;
  const refPrice = tick?.referencePrice ? tick.referencePrice / 1000 : 28.0;
  const ceilPrice = tick?.ceilingPrice ? tick.ceilingPrice / 1000 : 30.0;
  const floorPrice = tick?.floorPrice ? tick.floorPrice / 1000 : 26.0;

  const change = currentPrice - refPrice;
  const changePct = (change / refPrice) * 100;
  const isUp = change >= 0;

  const isStarred = watchlistSymbols.includes(selectedSymbol);

  // Calculate mock or real bid vs ask ratio
  const totalBidVol = quote?.totalBidVol || 450000;
  const totalAskVol = quote?.totalAskVol || 320000;
  const totalVol = totalBidVol + totalAskVol;
  const bidPct = Math.round((totalBidVol / totalVol) * 100);
  const askPct = 100 - bidPct;

  return (
    <div className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex flex-col justify-between backdrop-blur-sm relative overflow-hidden">
      {/* Top Header Row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-mono font-black text-lg text-emerald-400">
              {selectedSymbol.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-extrabold text-xl text-zinc-100">{selectedSymbol}</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">HOSE</span>
              </div>
              <p className="text-xs text-zinc-400">Tập đoàn Hòa Phát • Thép & Kim loại</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleWatchlistSymbol(selectedSymbol)}
              className={`p-2 rounded-xl border transition-all ${
                isStarred
                  ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                  : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Thêm vào danh sách theo dõi"
            >
              <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
            </button>

            <button
              onClick={toggleChartExpanded}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
                isChartExpanded
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-lg shadow-emerald-500/20'
                  : 'bg-zinc-800/80 border border-zinc-700/80 text-emerald-400 hover:bg-zinc-800'
              }`}
            >
              <ChartLine className="w-4 h-4" />
              <span>{isChartExpanded ? 'Thu Nhỏ Chart' : 'Phóng To Chart'}</span>
            </button>
          </div>
        </div>

        {/* Live Price Display */}
        <div className="flex items-baseline gap-3 my-4 p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/60">
          <span className={`font-mono text-3xl font-black ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {currentPrice.toFixed(2)}
          </span>
          <span className="text-xs font-mono text-zinc-400">x 1.000 VNĐ</span>

          <div
            className={`ml-auto px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
              isUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {isUp ? '+' : ''}
            {change.toFixed(2)} ({isUp ? '+' : ''}
            {changePct.toFixed(2)}%)
          </div>
        </div>

        {/* Price Boundaries Bar (Floor - Ref - Ceiling) */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs font-mono">
          <div className="p-2 bg-zinc-950/40 rounded-lg border border-zinc-800/40">
            <div className="text-[10px] text-cyan-400 mb-0.5 font-semibold">SÀN</div>
            <div className="font-bold text-cyan-300">{floorPrice.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-zinc-950/40 rounded-lg border border-zinc-800/40">
            <div className="text-[10px] text-amber-400 mb-0.5 font-semibold">THAM CHIẾU</div>
            <div className="font-bold text-amber-300">{refPrice.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-zinc-950/40 rounded-lg border border-zinc-800/40">
            <div className="text-[10px] text-purple-400 mb-0.5 font-semibold font-sans">TRẦN</div>
            <div className="font-bold text-purple-300">{ceilPrice.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Market Statistics & Foreign Flow */}
      <div className="space-y-3 pt-3 border-t border-zinc-800/60 text-xs font-mono">
        <div className="flex justify-between items-center text-zinc-400">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <Lightning className="w-3.5 h-3.5 text-emerald-400" />
            Khối lượng khớp:
          </span>
          <span className="text-zinc-100 font-bold">14,850,200</span>
        </div>

        <div className="flex justify-between items-center text-zinc-400">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            Giá trị giao dịch:
          </span>
          <span className="text-zinc-100 font-bold">423.8 Tỷ VNĐ</span>
        </div>

        <div className="flex justify-between items-center text-zinc-400">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            Khối ngoại Mua ròng:
          </span>
          <span className="text-emerald-400 font-bold">+28.4 Tỷ</span>
        </div>

        {/* Bid vs Ask Volume Ratio Visual Bar */}
        <div className="pt-2">
          <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
            <span className="text-emerald-400 font-semibold">Mua Dư: {bidPct}%</span>
            <span className="text-rose-400 font-semibold">Bán Dư: {askPct}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
            <div style={{ width: `${bidPct}%` }} className="bg-emerald-500 transition-all duration-300" />
            <div style={{ width: `${askPct}%` }} className="bg-rose-500 transition-all duration-300" />
          </div>
        </div>
      </div>
    </div>
  );
};
