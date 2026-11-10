'use client';

import React, { useState, useEffect } from 'react';
import { Lightning, ArrowUpRight, Fire, CaretRight, Sparkle, ArrowsClockwise } from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

interface SurgingStock {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  changePct: number;
  liveVol: number;
  avgVol20: number;
  rVol: number;
  projectedRVol: number;
  effectiveRVol: number;
  totalValBillion: number;
  rsRating: number;
  surgeCategory: 'BUY_BREAKOUT' | 'SELL_SURGE' | 'ACCUMULATION';
  isMonster: boolean;
  signalTag: string;
}

interface VolumeSurgeLiveTickerProps {
  onOpenRadar?: () => void;
}

export const VolumeSurgeLiveTicker: React.FC<VolumeSurgeLiveTickerProps> = ({ onOpenRadar }) => {
  const { setSelectedSymbol, setViewMode } = useMarketStore();
  const [surges, setSurges] = useState<SurgingStock[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchSurges = async () => {
    try {
      const res = await fetch('/api/market/volume-surge-radar?minRVol=1.25&limit=25');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSurges(json.data);
          setUpdatedAt(json.updatedAt || '');
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchSurges();
    const interval = setInterval(fetchSurges, 15000);
    return () => clearInterval(interval);
  }, []);

  if (surges.length === 0) return null;

  const handleSelectStock = (sym: string) => {
    setSelectedSymbol(sym);
    setViewMode('detail');
    setTimeout(() => {
      document.getElementById('stock-orderbook-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  return (
    <div className="w-full bg-zinc-950/95 border border-amber-500/30 rounded-2xl p-2.5 sm:px-4 shadow-xl backdrop-blur-xl relative overflow-hidden group">
      {/* Subtle background glow */}
      <div className="absolute -left-12 -top-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Badge: Live Radar status */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>RADAR NỔ VOL</span>
          </div>
          <span className="hidden md:inline text-[11px] font-mono text-zinc-500">
            {surges.length} mã bùng nổ thanh khoản
          </span>
        </div>

        {/* Center: Horizontally scrollable list of surging stocks */}
        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar py-0.5 flex items-center gap-2">
          {surges.slice(0, 8).map((s) => {
            const isBuy = s.changePct > 0;
            const isSell = s.changePct < 0;
            return (
              <button
                key={s.symbol}
                onClick={() => handleSelectStock(s.symbol)}
                className="shrink-0 flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all font-mono text-xs cursor-pointer active:scale-95 group/item"
                title={`${s.name} • Khớp ${(s.liveVol / 1e6).toFixed(2)}M CP (${s.effectiveRVol}x SMA20) • Bấm để soi đường nổ vol`}
              >
                <span className="font-bold text-zinc-100 group-hover/item:text-zinc-300 transition-colors">
                  {s.symbol}
                </span>

                <span
                  className={`text-[11px] font-semibold ${
                    isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-zinc-400'
                  }`}
                >
                  {isBuy ? `+${s.changePct}%` : `${s.changePct}%`}
                </span>

                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {s.effectiveRVol}x
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Action: Open Full Radar Drawer/Modal */}
        {onOpenRadar && (
          <button
            onClick={onOpenRadar}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 text-xs font-mono font-bold transition-all"
          >
            <span>Bảng Radar</span>
            <CaretRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}
      </div>
    </div>
  );
};
