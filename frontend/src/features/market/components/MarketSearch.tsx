'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlass, Command, X, TrendUp, Star } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

import stockDatabase from '../data/stockDatabase.json';

const VN_STOCK_DATABASE = stockDatabase as Array<{
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
}>;

export const MarketSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { setSelectedSymbol, selectedSymbol, ticks, toggleWatchlistSymbol, watchlistSymbols } = useMarketStore();

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

  const filtered = query.trim()
    ? VN_STOCK_DATABASE.filter(
        (item) =>
          item.symbol.toLowerCase().includes(query.toLowerCase()) ||
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.sector.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12)
    : VN_STOCK_DATABASE.slice(0, 10);

  const handleSelect = (symbol: string) => {
    setSelectedSymbol(symbol.toUpperCase());
    setIsOpen(false);
    setQuery('');
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
    <div ref={containerRef} className="relative w-64 sm:w-80">
      {/* Inline Direct Header Search Input */}
      <div
        className={`flex items-center px-3 py-1.5 bg-zinc-900 border rounded-xl transition-all shadow-inner ${
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
          placeholder={`Tìm mã CK (${selectedSymbol})...`}
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

      {/* Floating Autocomplete Dropdown List */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in duration-150 ring-1 ring-white/10">
          <div className="max-h-72 overflow-y-auto p-1 divide-y divide-zinc-800/40 scrollbar-none">
            {filtered.length === 0 ? (
              <div
                onClick={() => query.trim() && handleSelect(query.trim())}
                className="p-3 text-center cursor-pointer hover:bg-zinc-800/60 rounded-xl text-xs font-mono text-emerald-400"
              >
                Nhấn Enter để chọn mã &quot;<span className="font-bold uppercase">{query}</span>&quot;
              </div>
            ) : (
              filtered.map((item) => {
                const tick = ticks[item.symbol];
                const price = tick?.price ? (tick.price / 1000).toFixed(2) : '--';
                const isStarred = watchlistSymbols.includes(item.symbol);

                return (
                  <div
                    key={item.symbol}
                    onClick={() => handleSelect(item.symbol)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      selectedSymbol === item.symbol
                        ? 'bg-emerald-950/40 border border-emerald-500/30'
                        : 'hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlistSymbol(item.symbol);
                        }}
                        className="text-zinc-500 hover:text-amber-400 transition-colors"
                      >
                        <Star className={`w-3.5 h-3.5 ${isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                      </button>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-zinc-100">{item.symbol}</span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {item.exchange}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate max-w-[160px]">{item.name}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-emerald-400">{price}k</div>
                      <div className="text-[9px] font-mono text-zinc-500 flex items-center gap-0.5 justify-end">
                        <TrendUp className="w-3 h-3 text-emerald-500" />
                        Live
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-3 py-1.5 bg-zinc-950/80 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Bấm <kbd className="text-zinc-300">↵</kbd> để chọn</span>
            <span>Live Autocomplete</span>
          </div>
        </div>
      )}
    </div>
  );
};
