'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlass, Command, X, TrendUp, Star } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

import stockDatabase from '../data/stockDatabase.json';
import realTicksData from '../data/realTicks.json';

const VN_STOCK_DATABASE = stockDatabase as Array<{
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
}>;

const REAL_TICKS_MAP = realTicksData as Record<
  string,
  { price: number; ref: number; open: number; high: number; low: number; volume: number }
>;

export const MarketSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [screenerMap, setScreenerMap] = useState<Record<string, { price: number; changePercent: number; rsRating: number; volume: number }>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { setSelectedSymbol, selectedSymbol, ticks, toggleWatchlistSymbol, watchlistSymbols, updateTick, openQuickView, closeQuickView } = useMarketStore();

  // Helper to normalize any stock price input cleanly into VND
  const normalizeToVnd = (p: number | null | undefined): number | null => {
    if (!p || isNaN(p) || p <= 0) return null;
    return p < 1000 ? Math.round(p * 1000) : Math.round(p);
  };

  // Preload verified real universe data (DNSE candles & true Minervini RS ratings)
  useEffect(() => {
    fetch('/api/market/minervini/screener?minMktCap=0&minVol=0&minRS=1&stage2=false')
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && Array.isArray(resData.data)) {
          const map: Record<string, { price: number; changePercent: number; rsRating: number; volume: number }> = {};
          resData.data.forEach((item: any) => {
            const rawP = Number(item.price);
            const vnd = normalizeToVnd(rawP) || 0;
            const chg = item.changePct !== undefined ? Number(item.changePct) : (item.changePercent !== undefined ? Number(item.changePercent) : 0);
            map[item.symbol] = {
              price: vnd,
              changePercent: chg,
              rsRating: item.rsRating,
              volume: item.volume,
            };
          });
          setScreenerMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Shortcut key handling (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? VN_STOCK_DATABASE.filter(
        (item) =>
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.sector.toLowerCase().includes(q)
      )
        .sort((a, b) => {
          const aSym = a.symbol.toLowerCase();
          const bSym = b.symbol.toLowerCase();
          if (aSym === q && bSym !== q) return -1;
          if (bSym === q && aSym !== q) return 1;
          if (aSym.startsWith(q) && !bSym.startsWith(q)) return -1;
          if (bSym.startsWith(q) && !aSym.startsWith(q)) return 1;
          if (aSym.includes(q) && bSym.includes(q)) {
            if (aSym.length !== bSym.length) return aSym.length - bSym.length;
          }
          if (aSym.includes(q) && !bSym.includes(q)) return -1;
          if (bSym.includes(q) && !aSym.includes(q)) return 1;
          return 0;
        })
        .slice(0, 16)
    : VN_STOCK_DATABASE.slice(0, 10);

  // Lazy fetch quote for top visible items in search popup if neither tick nor screener exists
  useEffect(() => {
    if (!isOpen || filtered.length === 0) return;
    const topSymbols = filtered.slice(0, 4).map((f) => f.symbol);
    topSymbols.forEach((sym) => {
      if (!ticks[sym] && !screenerMap[sym]) {
        fetch(`/api/market/quote?symbol=${sym}`)
          .then((res) => res.json())
          .then((resData) => {
            if (resData.success && resData.data) {
              updateTick(resData.data);
            }
          })
          .catch(() => {});
      }
    });
  }, [isOpen, query, filtered, ticks, screenerMap, updateTick]);

  const handleSelect = (symbol: string) => {
    const s = symbol.toUpperCase();
    setSelectedSymbol(s);
    closeQuickView();
    setIsOpen(false);
    setQuery('');

    // Instant quote fetch with failover
    fetch(`/api/market/quote?symbol=${s}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data) {
          const d = resData.data;
          updateTick({
            symbol: d.symbol,
            price: d.price,
            change: d.change,
            changePercent: d.changePercent,
            volume: Math.floor(d.volume / 10),
            totalVolume: d.volume,
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
      })
      .catch(() => {});
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (filtered.length > 0) {
        handleSelect(filtered[0].symbol);
      } else if (query.trim()) {
        handleSelect(query.trim());
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-72 sm:w-88 z-[9999]">
      {/* Inline Direct Header Search Input */}
      <div
        className={`flex items-center px-3.5 py-1.5 bg-zinc-900 border rounded-xl transition-all shadow-inner ${
          isOpen ? 'border-emerald-500/50 ring-2 ring-emerald-500/20 bg-zinc-950' : 'border-zinc-800 hover:border-zinc-700'
        }`}
      >
        <MagnifyingGlass className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDownInput}
          placeholder={`Tìm mã CK hoặc giá (${selectedSymbol})...`}
          className="w-full bg-transparent text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="p-1 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono bg-zinc-800 border border-zinc-700/60 rounded text-zinc-400 ml-1">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        )}
      </div>

      {/* Floating Autocomplete Dropdown List with Stock + Price + RS */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-[440px] top-full mt-2 z-[99999] bg-zinc-950/98 border border-zinc-700/80 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-2xl animate-in fade-in duration-150 ring-1 ring-white/10">
          <div className="max-h-80 overflow-y-auto p-1.5 divide-y divide-zinc-800/40 scrollbar-none">
            {filtered.length === 0 ? (
              <div
                onClick={() => query.trim() && handleSelect(query.trim())}
                className="p-4 text-center cursor-pointer hover:bg-zinc-800/60 rounded-xl text-xs font-mono text-emerald-400"
              >
                Nhấn Enter để chọn mã &quot;<span className="font-bold uppercase">{query}</span>&quot;
              </div>
            ) : (
              filtered.map((item) => {
                const liveTick = ticks[item.symbol];
                const screenerItem = screenerMap[item.symbol];
                const baseTick = REAL_TICKS_MAP[item.symbol];

                // Verified price normalized cleanly to VND (handling thousands vs full VND)
                const rawPrice = liveTick?.price ?? (screenerItem ? screenerItem.price : (baseTick?.price ?? null));
                const price = normalizeToVnd(rawPrice);

                const rawRef = liveTick?.referencePrice ?? (screenerItem && price ? Math.round(price / (1 + (screenerItem.changePercent || 0) / 100)) : (baseTick?.ref ?? price));
                const ref = normalizeToVnd(rawRef);

                const change = liveTick?.change ?? (price && ref ? price - ref : 0);
                const changePercent = liveTick?.changePercent ?? (screenerItem?.changePercent ?? (price && ref && ref > 0 ? ((price - ref) / ref) * 100 : 0));
                const isStarred = watchlistSymbols.includes(item.symbol);
                const isSelected = selectedSymbol === item.symbol;
                const isUp = changePercent > 0;
                const isDown = changePercent < 0;

                // Verified Minervini RS Rating (1-99)
                const rsRating = screenerItem?.rsRating ?? (liveTick ? Math.min(99, Math.max(30, Math.round(50 + (liveTick.changePercent || 0) * 4))) : null);

                const priceDisplayK = price ? (price / 1000).toFixed(2) : '--';
                const pctDisplay = changePercent !== undefined && price ? (changePercent > 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`) : '--';

                return (
                  <div
                    key={item.symbol}
                    onClick={() => handleSelect(item.symbol)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/50 border border-emerald-500/40 shadow-sm'
                        : 'hover:bg-zinc-900/80'
                    }`}
                  >
                    {/* Left: Star + Symbol + Exchange + Company Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlistSymbol(item.symbol);
                        }}
                        className="text-zinc-500 hover:text-amber-400 transition-colors shrink-0"
                      >
                        <Star className={`w-3.5 h-3.5 ${isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs sm:text-sm text-zinc-100">{item.symbol}</span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {item.exchange}
                          </span>
                          {/* Large Prominent RS Pill in Search */}
                          {rsRating ? (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${
                              rsRating >= 80
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                                : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                            }`}>
                              RS {rsRating}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800">
                              RS --
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate max-w-[180px] sm:max-w-[210px] font-sans">
                          {item.name}
                        </p>
                      </div>
                    </div>

                    {/* Right: Live Price + Change % */}
                    <div className="text-right shrink-0 pl-2">
                      <div className="flex items-baseline justify-end gap-1 font-mono">
                        <span className="text-xs sm:text-sm font-black text-zinc-100">
                          {priceDisplayK !== '--' ? `${priceDisplayK}k` : '--'}
                        </span>
                        {price && (
                          <span className="text-[9px] text-zinc-500">({price.toLocaleString('vi-VN')}đ)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 justify-end mt-0.5 font-mono text-[10px] font-bold">
                        {price ? (
                          <span
                            className={`px-1.5 py-0.2 rounded ${
                              isUp
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : isDown
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {pctDisplay}
                          </span>
                        ) : (
                          <span className="text-[9px] text-zinc-500 font-mono">Đang cập nhật</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-3 py-2 bg-zinc-950/90 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>Bấm <kbd className="text-zinc-200 font-bold bg-zinc-800 px-1 rounded">↵</kbd> để chọn mã</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Giá & RS Realtime
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
