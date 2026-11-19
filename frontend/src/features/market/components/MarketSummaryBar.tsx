'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { TrendUp, TrendDown, Lightning, Globe, Sparkle, Fire } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
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
  const { ticks, setSelectedSymbol, selectedSymbol, setViewMode } = useMarketStore();
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers' | 'volume' | 'foreign'>('gainers');

  // Toàn bộ dữ liệu từ nguồn sống (/api/market/heatmap, ~700 mã) + tick realtime trong store.
  // Không dùng bảng giá cũ hay số giả; chưa có dữ liệu thì danh sách rỗng.
  const [board, setBoard] = useState<
    {
      symbol: string;
      name: string;
      exchange: string;
      price: number;
      refPrice: number;
      volume: number;
      rsRating?: number;
      foreignBuyValue?: number;
      foreignSellValue?: number;
    }[]
  >([]);
  const [boardStale, setBoardStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/market/heatmap');
        const json = await res.json();
        if (alive && json.success && Array.isArray(json.data)) {
          setBoard(json.data);
          setBoardStale(Boolean(json.stale));
        }
      } catch {
        // giữ dữ liệu đang có
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const stockList = useMemo(() => {
    return board.map((b) => {
      const liveTick = ticks[b.symbol];
      const price = liveTick?.price ?? b.price;
      const ref = liveTick?.referencePrice ?? b.refPrice;
      const change = liveTick?.change ?? price - ref;
      const changePct = liveTick?.changePercent ?? (ref > 0 ? ((price - ref) / ref) * 100 : 0);
      const volume = liveTick?.totalVolume ?? b.volume;
      const meta = STOCK_LOOKUP.get(b.symbol);
      return {
        symbol: b.symbol,
        name: meta?.name || b.name || b.symbol,
        exchange: meta?.exchange || b.exchange,
        sector: meta?.sector || '',
        price,
        ref,
        change,
        changePct,
        volume,
        rsRating: b.rsRating,
        foreignBuyValue: b.foreignBuyValue,
        foreignSellValue: b.foreignSellValue,
      };
    });
  }, [board, ticks]);

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

  // Tổng giá trị ròng của khối ngoại trên toàn bộ các mã có dữ liệu (tỷ đồng)
  const { foreignTotalNet, foreignCount } = useMemo(() => {
    let net = 0;
    let n = 0;
    for (const s of stockList) {
      if (typeof s.foreignBuyValue === 'number' && typeof s.foreignSellValue === 'number') {
        net += s.foreignBuyValue - s.foreignSellValue;
        n++;
      }
    }
    return { foreignTotalNet: Math.round((net / 1e9) * 10) / 10, foreignCount: n };
  }, [stockList]);

  // Khối ngoại: giá trị mua/bán thật trong phiên (VND → tỷ đồng), top theo giá trị ròng tuyệt đối
  const foreignFlow = useMemo(() => {
    const toB = (v: number) => Math.round((v / 1e9) * 10) / 10;
    return stockList
      .filter((s) => typeof s.foreignBuyValue === 'number' && typeof s.foreignSellValue === 'number')
      .map((s) => ({
        symbol: s.symbol,
        buyVal: toB(s.foreignBuyValue as number),
        sellVal: toB(s.foreignSellValue as number),
        netVal: toB((s.foreignBuyValue as number) - (s.foreignSellValue as number)),
        price: s.price,
        changePct: Number(s.changePct.toFixed(2)),
      }))
      .filter((f) => f.buyVal + f.sellVal > 0)
      .sort((a, b) => Math.abs(b.netVal) - Math.abs(a.netVal))
      .slice(0, 6);
  }, [stockList]);

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
        {board.length === 0 && (
          <p className="text-[11px] font-mono text-zinc-500 py-6 text-center">Đang tải dữ liệu bảng giá…</p>
        )}
        {boardStale && board.length > 0 && (
          <p className="text-[10px] font-mono text-amber-300/90">⚠ Nguồn giá đang lỗi — hiển thị bản chốt gần nhất</p>
        )}
        {activeTab === 'foreign' && board.length > 0 && foreignFlow.length === 0 && (
          <p className="text-[11px] font-mono text-zinc-500 py-6 text-center">Nguồn hiện tại không có dữ liệu khối ngoại</p>
        )}
        {/* TAB 1: TOP GAINERS */}
        {activeTab === 'gainers' && (
          <div className="space-y-1.5">
            {topGainers.map((item, idx) => {
              const isSelected = selectedSymbol === item.symbol;
              const formattedPrice = (item.price / 1000).toFixed(2);
              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    setSelectedSymbol(item.symbol);
                    setViewMode('detail');
                  }}
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
                        {typeof item.rsRating === 'number' && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            RS {item.rsRating}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate max-w-[140px] font-sans">
                        {item.name}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-black text-zinc-100">{formattedPrice}</div>
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
                  onClick={() => {
                    setSelectedSymbol(item.symbol);
                    setViewMode('detail');
                  }}
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
                        {typeof item.rsRating === 'number' && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            RS {item.rsRating}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate max-w-[140px] font-sans">
                        {item.name}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-black text-zinc-100">{formattedPrice}</div>
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
                  onClick={() => {
                    setSelectedSymbol(item.symbol);
                    setViewMode('detail');
                  }}
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
                    <div className="font-mono text-xs font-black text-zinc-100">{formattedPrice}</div>
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
              <span className={`font-bold ${foreignTotalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {foreignCount > 0
                  ? `${foreignTotalNet >= 0 ? '+' : ''}${foreignTotalNet} Tỷ (${foreignTotalNet >= 0 ? 'Mua ròng' : 'Bán ròng'}, ${foreignCount} mã)`
                  : '—'}
              </span>
            </div>
            {foreignFlow.map((item, idx) => {
              const isSelected = selectedSymbol === item.symbol;
              const formattedPrice = (item.price / 1000).toFixed(2);
              const isNetBuy = item.netVal >= 0;
              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    setSelectedSymbol(item.symbol);
                    setViewMode('detail');
                  }}
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
                          {formattedPrice}
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
