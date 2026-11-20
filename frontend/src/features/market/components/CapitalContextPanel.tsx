'use client';

import React, { useEffect, useState } from 'react';
import type { Allocation, CapitalAnswer, ContextKey, Direction, EarningsAnswer } from '../utils/capitalContext';

interface ContextData {
  context: ContextKey;
  allocation: Allocation;
  earnings: EarningsAnswer;
  capital: CapitalAnswer;
  source: string;
}

const EARN_TEXT: Record<Direction, string> = { UP: 'Cải thiện', DOWN: 'Suy yếu', UNCLEAR: 'Chưa rõ' };
const CAP_TEXT: Record<Direction, string> = { UP: 'Nới lỏng', DOWN: 'Thắt chặt', UNCLEAR: 'Chưa rõ' };
const tone = (d: Direction, goodUp = true) =>
  d === 'UNCLEAR' ? 'bg-zinc-800 text-zinc-300' : (d === 'UP') === goodUp ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300';
const sign = (v: number | null, unit = 'điểm') => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v} ${unit}`);

/** "Lợi nhuận × Vốn": hai câu hỏi quyết định định giá → bối cảnh & tỷ trọng (khung Dragon Capital) */
export const CapitalContextPanel: React.FC = () => {
  const [data, setData] = useState<ContextData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/macro/context')
      .then((r) => r.json())
      .then((j) => alive && (j.success ? setData(j.data) : setError(true)))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="rounded-xl border border-zinc-800 px-4 py-3 text-[11px] font-mono text-zinc-500">Không tính được bối cảnh Lợi nhuận × Vốn.</div>;
  if (!data) return <div className="rounded-xl border border-zinc-800 px-4 py-3 text-[11px] font-mono text-zinc-500">Đang tính bối cảnh Lợi nhuận × Vốn…</div>;

  const { earnings: e, capital: c, allocation: a } = data;
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/90 p-4 font-mono text-[11px] space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Giá cổ phiếu = lợi nhuận × định giá · định giá đi theo điều kiện vốn</div>
          <div className="mt-0.5 text-sm font-bold text-zinc-100">Bối cảnh: {a.label}</div>
        </div>
        <div className="flex h-5 w-56 overflow-hidden rounded text-[10px] font-bold text-zinc-950">
          <div className="flex items-center justify-center bg-emerald-400" style={{ width: `${a.equity}%` }}>CP {a.equity}</div>
          <div className="flex items-center justify-center bg-cyan-400" style={{ width: `${a.bonds}%` }}>TP {a.bonds}</div>
          <div className="flex items-center justify-center bg-amber-400" style={{ width: `${a.cash}%` }}>Tiền {a.cash}</div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-200">1 · Lợi nhuận</span>
            <span className={`rounded px-2 py-0.5 font-bold ${tone(e.direction)}`}>{EARN_TEXT[e.direction]}</span>
          </div>
          {e.ttmChanges.map((t) => (
            <div key={t.period} className="flex justify-between text-zinc-400">
              <span>LNST 12 tháng tới {t.period} so với quý trước</span>
              <span className="text-zinc-200">{sign(t.pct, '%')}</span>
            </div>
          ))}
          <div className="flex justify-between text-zinc-400">
            <span>Doanh nghiệp có LNST 12 tháng tăng</span>
            <span className="text-zinc-200">{e.breadthUp !== null ? `${e.breadthUp}% / ${e.companies} DN` : '—'}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-200">2 · Điều kiện vốn</span>
            <span className={`rounded px-2 py-0.5 font-bold ${tone(c.direction)}`}>{CAP_TEXT[c.direction]}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Lãi gửi 12T, ~30 phiên</span>
            <span className="text-zinc-200">{sign(c.depositChange)}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Lãi suất liên ngân hàng, ~20 phiên</span>
            <span className="text-zinc-200">{sign(c.interbankChange)}</span>
          </div>
          <div className="text-zinc-500">{c.note}</div>
        </div>
      </div>

      <div className="text-zinc-400">
        <span className="text-zinc-300">Cách triển khai:</span> {a.how}
      </div>
      <div className="text-[10px] text-zinc-500">{data.source} · {e.note}</div>
    </div>
  );
};
