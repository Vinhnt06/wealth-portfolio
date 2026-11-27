'use client';

import React from 'react';
import { MarketStateKey } from '../utils/marketState';
import { ScreenerDecision, ScreenerStatus } from '../utils/screenerDecision';

export type DecisionFilter = 'ALL' | 'BUY' | 'WAIT_MARKET' | 'WAIT_PIVOT' | 'NEAR';

export const STATUS_TONE: Record<ScreenerStatus, string> = {
  BUY: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  WAIT_MARKET: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  WAIT_PIVOT: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  NO_CHASE: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  NEAR: 'bg-zinc-800 text-zinc-200 border-zinc-700',
  AVOID: 'bg-zinc-900 text-zinc-500 border-zinc-800',
  NOT_YET: 'bg-zinc-900 text-zinc-500 border-zinc-800',
  CHECKING: 'bg-zinc-900 text-zinc-500 border-zinc-800',
  UNKNOWN: 'bg-zinc-900 text-zinc-400 border-zinc-800',
};

interface Row {
  symbol: string;
  decision: ScreenerDecision;
}

interface Props {
  rows: Row[];
  marketState: MarketStateKey | null;
  pending: number;
  activeFilter: DecisionFilter;
  onSelectFilter: (f: DecisionFilter) => void;
  onSelectStock: (symbol: string) => void;
}

const CARDS: { key: Exclude<DecisionFilter, 'ALL'>; title: string; hint: string; accent: string; ring: string }[] = [
  { key: 'BUY', title: 'Có thể mua', hint: 'Đạt chuẩn và đang ở điểm vào', accent: 'text-emerald-300', ring: 'border-emerald-500/50 bg-emerald-500/10' },
  { key: 'WAIT_PIVOT', title: 'Chờ điểm vào', hint: 'Đạt chuẩn, chờ giá vượt pivot', accent: 'text-sky-300', ring: 'border-sky-500/50 bg-sky-500/10' },
  { key: 'WAIT_MARKET', title: 'Chờ thị trường', hint: 'Đạt chuẩn, thị trường Bất lợi', accent: 'text-rose-300', ring: 'border-rose-500/50 bg-rose-500/10' },
  { key: 'NEAR', title: 'Gần đạt chuẩn', hint: 'Thiếu 1 tiêu chí hoặc chờ xác nhận', accent: 'text-zinc-200', ring: 'border-zinc-500/60 bg-zinc-800/60' },
];

const MAX_CHIPS = 6;

/** Câu kết luận một dòng ở đầu Bộ lọc */
function headline(counts: Record<string, number>, marketState: MarketStateKey | null): string {
  if (counts.BUY > 0) return `Có ${counts.BUY} mã đủ điều kiện mua theo hệ thống.`;
  if (marketState === 'UNFAVORABLE' && counts.WAIT_MARKET > 0)
    return `Chưa mở vị thế mới: ${counts.WAIT_MARKET} mã đạt chuẩn nhưng thị trường đang Bất lợi.`;
  if (counts.WAIT_PIVOT > 0) return `Chưa có mã nào ở điểm mua. ${counts.WAIT_PIVOT} mã đạt chuẩn đang chờ điểm vào.`;
  return 'Chưa có mã nào đạt chuẩn để mua. Tiếp tục theo dõi.';
}

export const ScreenerDecisionSummary: React.FC<Props> = ({
  rows,
  marketState,
  pending,
  activeFilter,
  onSelectFilter,
  onSelectStock,
}) => {
  const groups: Record<string, Row[]> = { BUY: [], WAIT_PIVOT: [], WAIT_MARKET: [], NEAR: [] };
  rows.forEach((r) => groups[r.decision.status]?.push(r));
  const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/90 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-zinc-100">
            {pending > 0 ? `Đang kiểm tra ${pending} mã…` : headline(counts, marketState)}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            Quyết định giống hệt trang chi tiết của từng mã. Bấm vào một nhóm để lọc bảng, bấm mã để xem chi tiết.
          </p>
        </div>
        {activeFilter !== 'ALL' && (
          <button
            onClick={() => onSelectFilter('ALL')}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100"
          >
            Bỏ lọc, xem tất cả
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => {
          const list = groups[c.key];
          const active = activeFilter === c.key;
          return (
            <div
              key={c.key}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => onSelectFilter(active ? 'ALL' : c.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFilter(active ? 'ALL' : c.key);
                }
              }}
              className={`cursor-pointer rounded-xl border p-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                active ? c.ring : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-sm font-semibold ${c.accent}`}>{c.title}</span>
                <span className={`font-mono text-2xl font-black ${list.length ? c.accent : 'text-zinc-600'}`}>{list.length}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">{c.hint}</p>
              {list.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {list.slice(0, MAX_CHIPS).map((r) => (
                    <button
                      key={r.symbol}
                      title={r.decision.detail}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStock(r.symbol);
                      }}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-100 hover:border-amber-400/60 hover:text-amber-300"
                    >
                      {r.symbol}
                    </button>
                  ))}
                  {list.length > MAX_CHIPS && <span className="px-1 py-0.5 text-[11px] text-zinc-500">+{list.length - MAX_CHIPS}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
