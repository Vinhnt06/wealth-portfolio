'use client';

import React, { useEffect, useState } from 'react';
import type { Allocation, CapitalAnswer, ContextKey, Direction, EarningsAnswer } from '../utils/capitalContext';

interface ContextData {
  context: ContextKey;
  allocation: Allocation;
  earnings: EarningsAnswer;
  capital: CapitalAnswer;
}

const EARN_TEXT: Record<Direction, string> = { UP: 'cải thiện', DOWN: 'suy yếu', UNCLEAR: 'chưa rõ' };
const CAP_TEXT: Record<Direction, string> = { UP: 'nới lỏng', DOWN: 'thắt chặt', UNCLEAR: 'đi ngang' };
const tone = (d: Direction) => (d === 'UP' ? 'text-emerald-300' : d === 'DOWN' ? 'text-rose-300' : 'text-zinc-400');

/** Kết luận "Lợi nhuận × Vốn" → tỷ trọng. Thuật toán nằm ở utils/capitalContext.ts, ở đây chỉ hiện kết quả. */
export const CapitalContextPanel: React.FC = () => {
  const [data, setData] = useState<ContextData | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/macro/context')
      .then((r) => r.json())
      .then((j) => alive && j.success && setData(j.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;
  const { earnings: e, capital: c, allocation: a } = data;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-2.5 font-mono text-[11px]">
      <div className="text-zinc-300">
        Lợi nhuận <b className={tone(e.direction)}>{EARN_TEXT[e.direction]}</b> · Vốn <b className={tone(c.direction)}>{CAP_TEXT[c.direction]}</b>
      </div>
      <div className="flex h-5 w-52 overflow-hidden rounded text-[10px] font-bold text-zinc-950" title={a.how}>
        <div className="flex items-center justify-center bg-emerald-400" style={{ width: `${a.equity}%` }}>CP {a.equity}</div>
        <div className="flex items-center justify-center bg-cyan-400" style={{ width: `${a.bonds}%` }}>TP {a.bonds}</div>
        <div className="flex items-center justify-center bg-amber-400" style={{ width: `${a.cash}%` }}>Tiền {a.cash}</div>
      </div>
    </div>
  );
};
