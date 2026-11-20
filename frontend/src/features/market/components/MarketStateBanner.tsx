'use client';

import React, { useEffect, useState } from 'react';
import { MARKET_STATE_EVIDENCE, MARKET_STATE_TEXT, MarketStateKey } from '../utils/marketState';

interface StateData {
  current: { date: string; state: MarketStateKey; vniClose: number; ma200: number; breadth: number | null; vol20: number; vol20Median: number; provisional: boolean };
  history: { date: string; state: MarketStateKey }[];
}

const TONE: Record<MarketStateKey, string> = {
  FAVORABLE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  NEUTRAL: 'border-zinc-700 bg-zinc-900/70 text-zinc-200',
  UNFAVORABLE: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};
const DOT: Record<MarketStateKey, string> = { FAVORABLE: 'bg-emerald-400', NEUTRAL: 'bg-zinc-400', UNFAVORABLE: 'bg-rose-400' };

/** Dải trạng thái thị trường (MA200 · độ rộng · biến động) — dùng chung cho bộ lọc và vòng tròn vĩ mô */
export const MarketStateBanner: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [data, setData] = useState<StateData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/market/state')
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.success && j.data?.current) setData(j.data);
        else setError(true);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="rounded-xl border border-zinc-800 px-4 py-2.5 text-[11px] font-mono text-zinc-500">Chưa xác định được trạng thái thị trường (nguồn dữ liệu lỗi).</div>;
  if (!data) return <div className="rounded-xl border border-zinc-800 px-4 py-2.5 text-[11px] font-mono text-zinc-500">Đang tính trạng thái thị trường…</div>;

  const c = data.current;
  const ev = MARKET_STATE_EVIDENCE[c.state];
  const txt = MARKET_STATE_TEXT[c.state];
  return (
    <div className={`rounded-xl border px-4 py-3 font-mono text-[11px] ${TONE[c.state]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${DOT[c.state]}`} />
          <span className="font-bold uppercase tracking-wider">Trạng thái thị trường: {txt.vi}</span>
          {c.provisional && <span className="text-zinc-400">(tuần đang diễn ra, tạm tính)</span>}
        </div>
        <span className="font-bold">{txt.action} · tỷ trọng mua {Math.round(ev.buySize * 100)}%</span>
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-zinc-400">
          <span>VN-Index {c.vniClose.toLocaleString('vi-VN')} {c.vniClose > c.ma200 ? '>' : '<'} MA200 {c.ma200.toLocaleString('vi-VN')}</span>
          <span>Mã lớn trên MA50: {c.breadth !== null ? `${Math.round(c.breadth * 100)}%` : '—'}</span>
          <span>Biến động 20 phiên {c.vol20}% (trung vị 1 năm {c.vol20Median}%)</span>
          <span>Lịch sử: tuần sau giảm &gt;3% ở {ev.drop3Pct}% số tuần</span>
          <span className="flex items-center gap-1">
            12 tuần:
            {data.history.map((h) => (
              <span key={h.date} title={`${h.date}: ${MARKET_STATE_TEXT[h.state].vi}`} className={`inline-block h-2 w-2 rounded-sm ${DOT[h.state]}`} />
            ))}
          </span>
        </div>
      )}
    </div>
  );
};
