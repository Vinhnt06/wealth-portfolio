'use client';

import React, { useState } from 'react';
import { Star, ArrowsDownUp, TrendUp, TrendDown, Lightning } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

interface StockRow {
  symbol: string;
  name: string;
  exchange: string;
  refPrice: number;
  ceilPrice: number;
  floorPrice: number;
  matchPrice: number;
  change: number;
  changePct: number;
  volume: number;
}

const INITIAL_STOCKS: StockRow[] = [
  { symbol: 'HPG', name: 'Thép Hòa Phát', exchange: 'HOSE', refPrice: 28.0, ceilPrice: 29.95, floorPrice: 26.05, matchPrice: 28.5, change: +0.5, changePct: +1.78, volume: 14850000 },
  { symbol: 'VCB', name: 'Vietcombank', exchange: 'HOSE', refPrice: 92.0, ceilPrice: 98.4, floorPrice: 85.6, matchPrice: 92.5, change: +0.5, changePct: +0.54, volume: 3200000 },
  { symbol: 'SSI', name: 'Chứng khoán SSI', exchange: 'HOSE', refPrice: 35.2, ceilPrice: 37.6, floorPrice: 32.8, matchPrice: 36.0, change: +0.8, changePct: +2.27, volume: 11400000 },
  { symbol: 'VHM', name: 'Vinhomes', exchange: 'HOSE', refPrice: 42.0, ceilPrice: 44.9, floorPrice: 39.1, matchPrice: 41.5, change: -0.5, changePct: -1.19, volume: 6500000 },
  { symbol: 'TCB', name: 'Techcombank', exchange: 'HOSE', refPrice: 23.2, ceilPrice: 24.8, floorPrice: 21.6, matchPrice: 23.8, change: +0.6, changePct: +2.59, volume: 9800000 },
  { symbol: 'FPT', name: 'Tập đoàn FPT', exchange: 'HOSE', refPrice: 128.0, ceilPrice: 136.9, floorPrice: 119.1, matchPrice: 130.5, change: +2.5, changePct: +1.95, volume: 4100000 },
  { symbol: 'MBB', name: 'Ngân hàng Quân đội', exchange: 'HOSE', refPrice: 22.0, ceilPrice: 23.5, floorPrice: 20.5, matchPrice: 22.4, change: +0.4, changePct: +1.82, volume: 8900000 },
  { symbol: 'MWG', name: 'Thế Giới Di Động', exchange: 'HOSE', refPrice: 65.0, ceilPrice: 69.5, floorPrice: 60.5, matchPrice: 64.2, change: -0.8, changePct: -1.23, volume: 5300000 },
  { symbol: 'VNM', name: 'Vinamilk', exchange: 'HOSE', refPrice: 67.5, ceilPrice: 72.2, floorPrice: 62.8, matchPrice: 67.8, change: +0.3, changePct: +0.44, volume: 2900000 },
  { symbol: 'VIC', name: 'Vingroup', exchange: 'HOSE', refPrice: 45.0, ceilPrice: 48.1, floorPrice: 41.9, matchPrice: 44.6, change: -0.4, changePct: -0.88, volume: 4800000 },
  { symbol: 'STB', name: 'Ngân hàng Sacombank', exchange: 'HOSE', refPrice: 29.2, ceilPrice: 31.2, floorPrice: 27.2, matchPrice: 29.8, change: +0.6, changePct: +2.05, volume: 12500000 },
  { symbol: 'VPB', name: 'Ngân hàng VPBank', exchange: 'HOSE', refPrice: 18.9, ceilPrice: 20.2, floorPrice: 17.6, matchPrice: 19.2, change: +0.3, changePct: +1.59, volume: 16800000 },
  { symbol: 'BID', name: 'Ngân hàng BIDV', exchange: 'HOSE', refPrice: 49.0, ceilPrice: 52.4, floorPrice: 45.6, matchPrice: 49.5, change: +0.5, changePct: +1.02, volume: 2100000 },
  { symbol: 'NVL', name: 'Novaland', exchange: 'HOSE', refPrice: 14.5, ceilPrice: 15.5, floorPrice: 13.5, matchPrice: 14.2, change: -0.3, changePct: -2.07, volume: 18900000 },
  { symbol: 'DIG', name: 'DIC Corp', exchange: 'HOSE', refPrice: 26.0, ceilPrice: 27.8, floorPrice: 24.2, matchPrice: 26.5, change: +0.5, changePct: +1.92, volume: 9400000 },
  { symbol: 'PDR', name: 'Phát Đạt', exchange: 'HOSE', refPrice: 22.5, ceilPrice: 24.0, floorPrice: 21.0, matchPrice: 22.1, change: -0.4, changePct: -1.78, volume: 6200000 },
  { symbol: 'SHB', name: 'Ngân hàng SHB', exchange: 'HOSE', refPrice: 11.4, ceilPrice: 12.1, floorPrice: 10.7, matchPrice: 11.5, change: +0.1, changePct: +0.88, volume: 22000000 },
  { symbol: 'ACB', name: 'Ngân hàng ACB', exchange: 'HOSE', refPrice: 24.5, ceilPrice: 26.2, floorPrice: 22.8, matchPrice: 24.8, change: +0.3, changePct: +1.22, volume: 7500000 },
  { symbol: 'EIB', name: 'Eximbank', exchange: 'HOSE', refPrice: 18.2, ceilPrice: 19.4, floorPrice: 17.0, matchPrice: 18.5, change: +0.3, changePct: +1.65, volume: 8300000 },
  { symbol: 'LPB', name: 'LPBank', exchange: 'HOSE', refPrice: 30.8, ceilPrice: 32.9, floorPrice: 28.7, matchPrice: 31.2, change: +0.4, changePct: +1.30, volume: 4900000 },
];

type SortField = 'symbol' | 'matchPrice' | 'changePct' | 'volume';
type SortDir = 'asc' | 'desc';

export const WatchlistTable: React.FC = () => {
  const { selectedSymbol, setSelectedSymbol, ticks, watchlistSymbols, toggleWatchlistSymbol } = useMarketStore();
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<SortField>('changePct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [onlyStarred, setOnlyStarred] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const processedRows = INITIAL_STOCKS.map((stock) => {
    const tick = ticks[stock.symbol];
    if (tick) {
      const matchP = tick.price ? tick.price / 1000 : stock.matchPrice;
      const refP = tick.referencePrice ? tick.referencePrice / 1000 : stock.refPrice;
      const chg = matchP - refP;
      const pct = (chg / refP) * 100;
      return {
        ...stock,
        matchPrice: matchP,
        refPrice: refP,
        change: chg,
        changePct: pct,
        volume: tick.totalVolume || stock.volume,
      };
    }
    return stock;
  });

  const filteredRows = processedRows.filter((stock) => {
    const matchesText = stock.symbol.toLowerCase().includes(filterText.toLowerCase()) || stock.name.toLowerCase().includes(filterText.toLowerCase());
    const matchesStar = onlyStarred ? watchlistSymbols.includes(stock.symbol) : true;
    return matchesText && matchesStar;
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    let multiplier = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'symbol') return a.symbol.localeCompare(b.symbol) * multiplier;
    if (sortField === 'matchPrice') return (a.matchPrice - b.matchPrice) * multiplier;
    if (sortField === 'changePct') return (a.changePct - b.changePct) * multiplier;
    if (sortField === 'volume') return (a.volume - b.volume) * multiplier;
    return 0;
  });

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 backdrop-blur-sm flex flex-col h-full">
      {/* Table Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <h3 className="font-mono font-bold text-sm text-zinc-100 flex items-center gap-2">
            <Lightning className="w-4 h-4 text-emerald-400" />
            Bảng Giá Thị Trường Realtime
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
            {sortedRows.length} Mã Giao Dịch
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Filter Input */}
          <div className="relative">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Lọc mã..."
              className="px-2.5 py-1 bg-zinc-950/80 border border-zinc-800 text-xs font-mono text-zinc-200 placeholder-zinc-500 rounded-lg focus:outline-none focus:border-zinc-700 w-28 sm:w-36"
            />
          </div>

          {/* Star Filter Toggle */}
          <button
            onClick={() => setOnlyStarred((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-colors ${
              onlyStarred
                ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Chỉ hiện mã đã lưu"
          >
            <Star className={`w-3.5 h-3.5 ${onlyStarred ? 'fill-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* High-density Watchlist Table */}
      <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto scrollbar-none">
        <table className="w-full text-left font-mono text-xs">
          <thead className="sticky top-0 bg-zinc-900 z-10">
            <tr className="border-b border-zinc-800 text-[11px] text-zinc-500 uppercase tracking-wider">
              <th className="pb-2 pl-2 w-8">#</th>
              <th className="pb-2 cursor-pointer hover:text-zinc-300" onClick={() => handleSort('symbol')}>
                <div className="flex items-center gap-1">
                  Mã <ArrowsDownUp className="w-3 h-3" />
                </div>
              </th>
              <th className="pb-2 text-right cursor-pointer hover:text-zinc-300" onClick={() => handleSort('matchPrice')}>
                <div className="flex items-center justify-end gap-1">
                  Giá Khớp <ArrowsDownUp className="w-3 h-3" />
                </div>
              </th>
              <th className="pb-2 text-right cursor-pointer hover:text-zinc-300" onClick={() => handleSort('changePct')}>
                <div className="flex items-center justify-end gap-1">
                  +/- (%) <ArrowsDownUp className="w-3 h-3" />
                </div>
              </th>
              <th className="pb-2 text-right pr-2 cursor-pointer hover:text-zinc-300" onClick={() => handleSort('volume')}>
                <div className="flex items-center justify-end gap-1">
                  Khối Lượng <ArrowsDownUp className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {sortedRows.map((stock) => {
              const isSelected = selectedSymbol === stock.symbol;
              const isStarred = watchlistSymbols.includes(stock.symbol);
              const isUp = stock.change >= 0;

              return (
                <tr
                  key={stock.symbol}
                  onClick={() => setSelectedSymbol(stock.symbol)}
                  className={`cursor-pointer transition-colors duration-150 group ${
                    isSelected ? 'bg-emerald-950/30 font-semibold' : 'hover:bg-zinc-800/40'
                  }`}
                >
                  <td className="py-2.5 pl-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatchlistSymbol(stock.symbol);
                      }}
                      className="text-zinc-600 hover:text-amber-400 transition-colors"
                    >
                      <Star className={`w-3.5 h-3.5 ${isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                    </button>
                  </td>

                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isSelected ? 'text-emerald-400' : 'text-zinc-100'}`}>
                        {stock.symbol}
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase px-1 rounded bg-zinc-800/60 hidden sm:inline">
                        {stock.exchange}
                      </span>
                    </div>
                  </td>

                  <td className={`py-2.5 text-right font-bold text-sm ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stock.matchPrice.toFixed(2)}
                  </td>

                  <td className="py-2.5 text-right">
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {isUp ? <TrendUp className="w-3 h-3" /> : <TrendDown className="w-3 h-3" />}
                      {isUp ? '+' : ''}
                      {stock.changePct.toFixed(2)}%
                    </span>
                  </td>

                  <td className="py-2.5 text-right pr-2 text-zinc-400">
                    {(stock.volume / 1000).toLocaleString('vi-VN')}k
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
