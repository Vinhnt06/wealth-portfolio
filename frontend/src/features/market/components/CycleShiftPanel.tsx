'use client';

import React, { useMemo } from 'react';
import { analyzeShifts, nextReleaseDate, type CycleInputs, type CyclePhaseKey, type Shift, type ShiftCondition, type ShiftContext } from '../utils/cyclePhase';

const n = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

function range(c: ShiftCondition, unit: string): string {
  if (c.min === null && c.max !== null) return `từ ${n(c.max)}${unit} trở xuống`;
  if (c.max === null && c.min !== null) return `từ ${n(c.min)}${unit} trở lên`;
  if (c.min !== null && c.max !== null) return c.min === c.max ? `đúng ${n(c.min)}${unit}` : `trong khoảng ${n(c.min)}–${n(c.max)}${unit}`;
  return 'đổi';
}

/** Câu điều kiện kèm số hiện tại và lúc nào biết */
function describe(c: ShiftCondition, i: CycleInputs): { text: string; when: string } {
  const daily = 'theo dõi hằng ngày';
  switch (c.factor) {
    case 'gdp':
      return { text: `GDP quý tới ${range(c, '%')} (hiện ${n(i.gdp)}%)`, when: `công bố khoảng ${nextReleaseDate('gdp')}` };
    case 'cpi':
      return { text: `CPI tháng tới ${range(c, '%')} (hiện ${n(i.cpi)}%)`, when: `công bố khoảng ${nextReleaseDate('cpi')}` };
    case 'bond':
      return { text: `Lợi suất TPCP 10 năm ${range(c, '%')} (hiện ${n(i.longRate)}%)`, when: daily };
    case 'short':
      return { text: `Lãi liên ngân hàng ngắn hạn ${range(c, '%')} (hiện ${n(i.shortRate)}%)`, when: daily };
    case 'fx':
      return { text: `USD/VND đổi trong 1 tháng ${range(c, '%')} (hiện ${n(i.usdVnd1MPct ?? 0)}%)`, when: daily };
    case 'dxy':
      return { text: `Chỉ số USD (DXY) ${range(c, '')} (hiện ${n(i.dxy)})`, when: daily };
    case 'fed':
      return { text: `Fed chuyển sang ${c.stance === 'tightening' ? 'thắt chặt' : c.stance === 'easing' ? 'nới lỏng' : 'giữ nguyên'}`, when: 'sau kỳ họp Fed' };
  }
}

/** "Khi nào chuyển pha". Thuật toán nằm ở utils/cyclePhase.ts, ở đây chỉ hiện điều kiện. */
export const CycleShiftPanel: React.FC<{ inputs: CycleInputs; context: ShiftContext; names: Record<CyclePhaseKey, string> }> = ({ inputs, context, names }) => {
  const a = useMemo(() => analyzeShifts(inputs, context), [inputs, context]);
  const gap = a.currentScore - a.runnerUpScore;
  const list: Shift[] = a.singles.length ? a.singles : a.pairs;

  return (
    <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 text-xs space-y-2.5 shadow-md">
      <div className="pb-1.5 border-b border-zinc-800/80">
        <div className="text-zinc-200 font-bold text-[11px] font-mono uppercase">Khi nào chuyển pha</div>
        <div className="mt-1 text-[11px] text-zinc-400">
          Đang ở <b className="text-emerald-300">{names[a.current]}</b> {a.currentScore} điểm · pha sát nhất {names[a.runnerUp]} {a.runnerUpScore} điểm (cách {gap})
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-[11px] text-zinc-400">Một hoặc hai số liệu đổi chưa đủ làm chuyển pha.</p>
      ) : (
        <>
          <p className="text-[11px] text-zinc-400">
            {a.singles.length ? 'Chỉ cần một trong các điều sau (số khác giữ nguyên):' : 'Chưa số liệu nào đổi một mình là đủ. Cần hai điều cùng xảy ra:'}
          </p>
          <ul className="space-y-1.5">
            {list.map((s, k) => (
              <li key={k} className="rounded-lg bg-zinc-950/70 border border-zinc-800/60 p-2 space-y-1">
                {s.conditions.map((c, j) => {
                  const d = describe(c, inputs);
                  return (
                    <div key={j} className="text-[11px] text-zinc-200">
                      {j > 0 && <span className="text-zinc-500">và </span>}
                      {d.text}
                      <span className="text-zinc-500"> · {d.when}</span>
                    </div>
                  );
                })}
                <div className="text-[11px] font-semibold text-amber-300">→ chuyển sang {names[s.to]}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-[10px] text-zinc-500">Đây là cách vòng tròn chấm điểm, chưa được kiểm chứng là dự báo và không phải tín hiệu mua.</p>
    </div>
  );
};
