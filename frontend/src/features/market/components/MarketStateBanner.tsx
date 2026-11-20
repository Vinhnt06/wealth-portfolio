'use client';

import React, { useEffect, useState } from 'react';
import { MARKET_STATE_EVIDENCE, MARKET_STATE_TEXT, MarketStateKey } from '../utils/marketState';

interface StateData {
  current: { state: MarketStateKey; provisional: boolean };
}

const TONE: Record<MarketStateKey, string> = {
  FAVORABLE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  NEUTRAL: 'border-zinc-700 bg-zinc-900/70 text-zinc-200',
  UNFAVORABLE: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};
const DOT: Record<MarketStateKey, string> = { FAVORABLE: 'bg-emerald-400', NEUTRAL: 'bg-zinc-400', UNFAVORABLE: 'bg-rose-400' };

/** Kết luận trạng thái thị trường → tỷ trọng mua. Thuật toán nằm ở utils/marketState.ts, ở đây chỉ hiện kết quả. */
export const MarketStateBanner: React.FC = () => {
  const [data, setData] = useState<StateData | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/market/state')
      .then((r) => r.json())
      .then((j) => alive && j.success && j.data?.current && setData(j.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;
  const s = data.current.state;
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 font-mono text-[11px] ${TONE[s]}`}>
      <span className="flex items-center gap-2 font-bold">
        <span className={`h-2 w-2 rounded-full ${DOT[s]}`} />
        Thị trường {MARKET_STATE_TEXT[s].vi.toLowerCase()}
        {data.current.provisional && <span className="font-normal text-zinc-500">(tạm tính)</span>}
      </span>
      <span className="font-bold">Mua {Math.round(MARKET_STATE_EVIDENCE[s].buySize * 100)}%</span>
    </div>
  );
};
