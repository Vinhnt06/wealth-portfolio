'use client';

import React, { useState } from 'react';
import { Star, ArrowsDownUp, TrendUp, TrendDown, Lightning } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import { getStockPriceColor } from '../utils/priceColors';
import { formatCompactVolume } from '../utils/formatters';

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

// Danh sách mã theo dõi (chỉ nhãn). Giá, thay đổi, khối lượng luôn lấy từ tick sống trong store.
const WATCH_SYMBOLS: { symbol: string; name: string; exchange: string }[] = [
  { symbol: 'NVL', name: 'Novaland', exchange: 'HOSE' },
  { symbol: 'PDR', name: 'Phát Đạt', exchange: 'HOSE' },
  { symbol: 'VPB', name: 'Ngân hàng VPBank', exchange: 'HOSE' },
  { symbol: 'TCB', name: 'Techcombank', exchange: 'HOSE' },
  { symbol: 'DIG', name: 'DIC Corp', exchange: 'HOSE' },
  { symbol: 'MBB', name: 'Ngân hàng Quân đội', exchange: 'HOSE' },
  { symbol: 'VHM', name: 'Vinhomes', exchange: 'HOSE' },
  { symbol: 'VCB', name: 'Vietcombank', exchange: 'HOSE' },
  { symbol: 'HPG', name: 'Thép Hòa Phát', exchange: 'HOSE' },
  { symbol: 'SSI', name: 'Chứng khoán SSI', exchange: 'HOSE' },
  { symbol: 'FPT', name: 'Tập đoàn FPT', exchange: 'HOSE' },
  { symbol: 'MWG', name: 'Thế Giới Di Động', exchange: 'HOSE' },
  { symbol: 'VNM', name: 'Vinamilk', exchange: 'HOSE' },
  { symbol: 'VIC', name: 'Vingroup', exchange: 'HOSE' },
  { symbol: 'STB', name: 'Ngân hàng Sacombank', exchange: 'HOSE' },
  { symbol: 'BID', name: 'Ngân hàng BIDV', exchange: 'HOSE' },
  { symbol: 'SHB', name: 'Ngân hàng SHB', exchange: 'HOSE' },
  { symbol: 'ACB', name: 'Ngân hàng ACB', exchange: 'HOSE' },
  { symbol: 'EIB', name: 'Eximbank', exchange: 'HOSE' },
  { symbol: 'LPB', name: 'LPBank', exchange: 'HOSE' },
];

type SortField = 'symbol' | 'matchPrice' | 'changePct' | 'volume';
type SortDir = 'asc' | 'desc';

export const WatchlistTable: React.FC = () => {
  const { selectedSymbol, setSelectedSymbol, ticks, watchlistSymbols, toggleWatchlistSymbol, openQuickView, setViewMode } = useMarketStore();
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

  // Chỉ hiện mã đã có giá sống (không dùng giá ghi sẵn)
  const processedRows: StockRow[] = WATCH_SYMBOLS.flatMap((stock) => {
    const tick = ticks[stock.symbol];
    if (!tick || !(tick.price > 0) || !(tick.referencePrice > 0)) return [];
    const matchP = tick.price > 1000 ? tick.price / 1000 : tick.price;
    const refP = tick.referencePrice > 1000 ? tick.referencePrice / 1000 : tick.referencePrice;
    const ceilP = tick.ceilingPrice ? (tick.ceilingPrice > 1000 ? tick.ceilingPrice / 1000 : tick.ceilingPrice) : NaN;
    const floorP = tick.floorPrice ? (tick.floorPrice > 1000 ? tick.floorPrice / 1000 : tick.floorPrice) : NaN;
    const chg = matchP - refP;
    return [
      {
        ...stock,
        matchPrice: matchP,
        refPrice: refP,
        ceilPrice: ceilP,
        floorPrice: floorP,
        change: chg,
        changePct: (chg / refP) * 100,
        volume: tick.totalVolume || 0,
      },
    ];
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
            Bảng Giá Thị Trường Thời gian thực
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

              const priceColor = getStockPriceColor({
                price: stock.matchPrice,
                refPrice: stock.refPrice,
                ceilPrice: stock.ceilPrice,
                floorPrice: stock.floorPrice,
                change: stock.change,
                changePercent: stock.changePct,
                exchange: stock.exchange,
              });

              return (
                <tr
                  key={stock.symbol}
                  onClick={() => {
                    setSelectedSymbol(stock.symbol);
                    setViewMode('detail');
                  }}
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

                  <td className={`py-2.5 text-right font-bold text-sm ${priceColor.colorClass}`}>
                    {stock.matchPrice.toFixed(2)}
                  </td>

                  <td className="py-2.5 text-right">
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold border ${priceColor.badgeBgClass}`}
                    >
                      {isUp ? <TrendUp className="w-3 h-3" /> : <TrendDown className="w-3 h-3" />}
                      {isUp ? '+' : ''}
                      {stock.changePct.toFixed(2)}%
                    </span>
                  </td>

                  <td className="py-2.5 text-right pr-2 text-zinc-400 font-mono">
                    {formatCompactVolume(stock.volume)}
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
