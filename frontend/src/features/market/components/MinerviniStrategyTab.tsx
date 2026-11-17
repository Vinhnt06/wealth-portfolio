'use client';

import React, { useState } from 'react';
import { Check, X, CaretDown, Lock, Crosshair, ShieldCheck } from '@phosphor-icons/react';
import type { MinerviniAnalysisResult, MinerviniCriterion } from '../types/minervini.types';

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{23F3}️]/gu;
const stripEmoji = (s?: string) => (s || '').replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();

/** Tách "TIÊU ĐỀ: phần mô tả" thành 2 phần để trình bày thành 2 tầng chữ. */
const splitTitle = (s?: string): [string, string] => {
  const clean = stripEmoji(s);
  const i = clean.indexOf(':');
  return i > 0 ? [clean.slice(0, i).trim(), clean.slice(i + 1).trim()] : [clean, ''];
};

const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

/** Mô tả cách hiển thị số liệu của từng tiêu chí Trend Template. */
const CRITERIA_VIEW: Record<number, { sep?: string; parts?: string[]; req?: string }> = {
  1: { sep: ' / ', parts: ['Giá', 'MA150', 'MA200'] },
  2: { sep: ' > ', parts: ['MA150', 'MA200'] },
  3: { sep: ' vs ', parts: ['MA200 nay', '1 tháng trước'] },
  4: { sep: ' / ', parts: ['MA50', 'MA150', 'MA200'] },
  5: { sep: ' / ', parts: ['Giá', 'MA50'] },
  6: { req: 'Cần ≥ +30%' },
  7: { req: 'Cần ≥ −25%' },
  8: { req: 'Cần ≥ 70' },
};

const GROUPS: { title: string; ids: number[] }[] = [
  { title: 'Cấu trúc đường trung bình', ids: [1, 2, 3, 4, 5] },
  { title: 'Vị thế trong biên độ 52 tuần', ids: [6, 7] },
  { title: 'Sức mạnh tương đối', ids: [8] },
];

const PHASES = [
  { key: 'A', tag: 'Hãm rơi' },
  { key: 'B', tag: 'Gom hàng' },
  { key: 'C', tag: 'Rũ bỏ' },
  { key: 'D', tag: 'SOS / LPS' },
  { key: 'E', tag: 'Bứt phá' },
];

const ALLOCATION = [
  { phase: 2, name: 'Thăm dò', pct: '20–30%', at: 'Phase C' },
  { phase: 3, name: 'Chủ lực', pct: '40–50%', at: 'Phase D' },
  { phase: 4, name: 'Gia tăng', pct: '20–30%', at: 'Đầu Phase E' },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Atoms
 * ──────────────────────────────────────────────────────────────────────────── */

const Mark: React.FC<{ passed: boolean }> = ({ passed }) => (
  <span
    className={cx(
      'mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ring-1 ring-inset',
      passed
        ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-400/30'
        : 'bg-rose-500/10 text-rose-400/80 ring-rose-400/20'
    )}
  >
    {passed ? <Check size={10} weight="bold" /> : <X size={9} weight="bold" />}
  </span>
);

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={cx('text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500', className)}>
    {children}
  </span>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <section
    className={cx(
      'overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.012]',
      'shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_12px_32px_-18px_rgba(0,0,0,0.7)]',
      className
    )}
  >
    {children}
  </section>
);

const CardHeader: React.FC<{
  title: string;
  right?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}> = ({ title, right, open, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    className="flex w-full items-center justify-between gap-3 px-4 pt-3.5 pb-2.5 text-left cursor-pointer"
  >
    <Eyebrow className="text-zinc-400">{title}</Eyebrow>
    <span className="flex items-center gap-2">
      {right}
      <CaretDown
        size={12}
        weight="bold"
        className={cx('text-zinc-600 transition-transform duration-200', open && 'rotate-180')}
      />
    </span>
  </button>
);

/* ────────────────────────────────────────────────────────────────────────────
 * Trend Template
 * ──────────────────────────────────────────────────────────────────────────── */

const CriterionRow: React.FC<{ c: MinerviniCriterion }> = ({ c }) => {
  const view = CRITERIA_VIEW[c.id] || {};
  const raw = c.comparisonValue && c.comparisonValue !== 'N/A' ? c.comparisonValue : '';
  const parts = view.parts && view.sep && raw ? raw.split(view.sep) : null;

  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <Mark passed={c.passed} />
      <div className="min-w-0 flex-1">
        <div className={cx('text-[12px] leading-snug', c.passed ? 'text-zinc-100' : 'text-zinc-300')}>{c.label}</div>
        {parts && (
          <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-0.5 text-[10.5px] text-zinc-500">
            {parts.map((v, i) => (
              <span key={i}>
                {view.parts![i]} <span className="tabular-nums text-zinc-300">{v}</span>
              </span>
            ))}
          </div>
        )}
        {!parts && !view.req && (
          <div className="mt-1 text-[10.5px] text-zinc-600">{raw || 'Chưa đủ dữ liệu'}</div>
        )}
      </div>
      {view.req && (
        <div className="shrink-0 text-right">
          <div
            className={cx(
              'text-[13px] font-semibold tabular-nums',
              c.passed ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {raw || '—'}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-600">{view.req}</div>
        </div>
      )}
    </div>
  );
};

const STAGE_TONE: Record<number, { pill: string; dot: string }> = {
  1: { pill: 'text-zinc-300 bg-zinc-500/10 ring-zinc-400/20', dot: 'bg-zinc-400' },
  2: { pill: 'text-emerald-300 bg-emerald-500/10 ring-emerald-400/30', dot: 'bg-emerald-400' },
  3: { pill: 'text-amber-300 bg-amber-500/10 ring-amber-400/25', dot: 'bg-amber-400' },
  4: { pill: 'text-rose-300 bg-rose-500/10 ring-rose-400/25', dot: 'bg-rose-400' },
};

const TrendTemplateCard: React.FC<{ data: MinerviniAnalysisResult }> = ({ data }) => {
  const [open, setOpen] = useState(true);
  const passed = data.passedCount;
  const stage = data.stage;
  const tone = STAGE_TONE[stage] || STAGE_TONE[1];
  const barTone = passed === 8 ? 'bg-emerald-400' : passed >= 5 ? 'bg-amber-400' : 'bg-rose-400/90';
  const stageShort = (data.stageName || '').split('(')[0].trim() || `Stage ${stage}`;
  const stageNote = (data.stageName || '').match(/\(([^)]+)\)/)?.[1];

  return (
    <Card>
      <CardHeader title="Trend Template · Minervini" open={open} onToggle={() => setOpen((v) => !v)} />

      <div className="flex items-end justify-between gap-4 px-4 pb-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums text-zinc-50">
              {passed}
            </span>
            <span className="text-[15px] text-zinc-600 tabular-nums">/ 8</span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {passed === 8 ? 'Đủ điều kiện xét mua' : `Thiếu ${8 - passed} tiêu chí để vào Stage 2`}
          </div>
        </div>
        <div className="text-right">
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset',
              tone.pill
            )}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', tone.dot)} />
            {stageShort}
          </span>
          {stageNote && <div className="mt-1.5 text-[10.5px] text-zinc-500">{stageNote}</div>}
        </div>
      </div>

      {/* 8 đoạn tiến độ — mỗi đoạn tương ứng một tiêu chí */}
      <div className="grid grid-cols-8 gap-1 px-4 pb-4" aria-hidden>
        {data.criteria.map((c) => (
          <span key={c.id} className={cx('h-[3px] rounded-full', c.passed ? barTone : 'bg-white/[0.07]')} />
        ))}
      </div>

      {open && (
        <div className="border-t border-white/[0.05]">
          {GROUPS.map((g) => {
            const rows = data.criteria.filter((c) => g.ids.includes(c.id));
            if (!rows.length) return null;
            return (
              <div key={g.title} className="border-b border-white/[0.04] last:border-b-0">
                <div className="px-4 pt-3 pb-0.5">
                  <Eyebrow className="text-[9.5px] text-zinc-600">{g.title}</Eyebrow>
                </div>
                <div className="divide-y divide-white/[0.03]">
                  {rows.map((c) => (
                    <CriterionRow key={c.id} c={c} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
 * Wyckoff
 * ──────────────────────────────────────────────────────────────────────────── */

const WyckoffCard: React.FC<{ data: MinerviniAnalysisResult }> = ({ data }) => {
  const [open, setOpen] = useState(true);
  const [showCriteria, setShowCriteria] = useState(false);
  const w = data.wyckoff;
  if (!w) return null;

  const idx = typeof w.phaseIndex === 'number' ? w.phaseIndex : 1;
  const progress = typeof w.phaseProgressPct === 'number' && w.phaseProgressPct > 0 ? w.phaseProgressPct : (idx + 1) * 20;
  const [phaseEyebrow, phaseTitleRaw] = stripEmoji(w.phaseName).split(/\s[—–-]\s/);
  const phaseTitle = (phaseTitleRaw || phaseEyebrow).replace(/\s*\(.*?\)\s*$/, '');

  const [sigTitle, sigDesc] = splitTitle(w.buyPointLabel);
  const blocked = Boolean(w.buyBlocked);
  const code = w.buyPointCode;
  const sigTone = blocked
    ? { box: 'border-amber-400/20 bg-amber-400/[0.05]', head: 'text-amber-200', icon: 'text-amber-300/80' }
    : code === 'BUY_2_LPS'
    ? { box: 'border-emerald-400/25 bg-emerald-400/[0.06]', head: 'text-emerald-200', icon: 'text-emerald-300' }
    : code === 'BUY_1_SPRING' || code === 'BUY_3_BREAKOUT_BU'
    ? { box: 'border-cyan-400/25 bg-cyan-400/[0.05]', head: 'text-cyan-200', icon: 'text-cyan-300' }
    : code === 'HOLD_MARKUP'
    ? { box: 'border-amber-400/20 bg-amber-400/[0.05]', head: 'text-amber-200', icon: 'text-amber-300' }
    : { box: 'border-white/[0.07] bg-white/[0.02]', head: 'text-zinc-300', icon: 'text-zinc-500' };

  const hasZone = Boolean(w.buyZonePrice) && !/^Đứng ngoài$/i.test(w.buyZonePrice || '');

  return (
    <Card>
      <CardHeader
        title="Chẩn đoán Wyckoff"
        open={open}
        onToggle={() => setOpen((v) => !v)}
        right={
          <span className="text-[10.5px] tabular-nums text-zinc-500">
            {w.passedCount}/{w.totalCount || 8} tiêu chí
          </span>
        }
      />

      {/* Pha hiện tại */}
      <div className="px-4 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10.5px] text-emerald-400/90">{phaseEyebrow}</div>
            <div className="mt-0.5 text-[16px] font-semibold leading-tight text-zinc-50">{phaseTitle}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[18px] font-semibold leading-none tabular-nums text-zinc-100">{progress}%</div>
            <div className="mt-1 text-[10px] text-zinc-600">chu kỳ tích lũy</div>
          </div>
        </div>

        {/* Timeline 5 pha */}
        <div className="relative mt-5">
          <div className="absolute left-[10%] right-[10%] top-[9px] h-px bg-white/[0.08]" />
          <div
            className="absolute left-[10%] top-[9px] h-px bg-emerald-400/70 transition-all duration-500"
            style={{ width: `${(Math.min(idx, 4) / 4) * 80}%` }}
          />
          <ol className="relative grid grid-cols-5">
            {PHASES.map((p, i) => {
              const done = i < idx;
              const cur = i === idx;
              return (
                <li key={p.key} className="flex flex-col items-center">
                  <span
                    className={cx(
                      'grid h-[19px] w-[19px] place-items-center rounded-full text-[9px] font-semibold transition-all',
                      done && 'bg-emerald-500/90 text-zinc-950',
                      cur && 'bg-zinc-950 text-emerald-300 ring-2 ring-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.45)]',
                      !done && !cur && 'bg-zinc-950 text-zinc-600 ring-1 ring-white/10'
                    )}
                  >
                    {done ? <Check size={9} weight="bold" /> : p.key}
                  </span>
                  <span
                    className={cx(
                      'mt-1.5 text-[10px] leading-tight',
                      cur ? 'font-medium text-zinc-100' : done ? 'text-zinc-400' : 'text-zinc-600'
                    )}
                  >
                    {p.tag}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Tín hiệu */}
        {w.buyPointLabel && (
          <div className={cx('mt-5 rounded-xl border p-3', sigTone.box)}>
            <div className="flex items-start gap-2">
              {blocked ? (
                <Lock size={14} weight="duotone" className={cx('mt-px shrink-0', sigTone.icon)} />
              ) : (
                <Crosshair size={14} weight="duotone" className={cx('mt-px shrink-0', sigTone.icon)} />
              )}
              <div className="min-w-0">
                <div className={cx('text-[11px] font-semibold uppercase tracking-wide', sigTone.head)}>
                  {blocked ? `Tín hiệu theo dõi · ${w.phase}` : sigTitle}
                </div>
                {sigDesc && <div className="mt-0.5 text-[11.5px] leading-snug text-zinc-300">{sigDesc}</div>}
                {blocked && w.buyBlockedReason && (
                  <div className="mt-1.5 text-[10.5px] leading-snug text-amber-200/70">{w.buyBlockedReason}</div>
                )}
              </div>
            </div>

            {(hasZone || w.stopLossPrice) && (
              <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/[0.06]">
                <div className="bg-zinc-950/70 px-3 py-2">
                  <dt className="text-[9.5px] uppercase tracking-wider text-zinc-500">
                    {blocked ? 'Vùng theo dõi' : 'Vùng mua'}
                  </dt>
                  <dd className="mt-0.5 text-[12px] font-medium tabular-nums text-zinc-100">
                    {hasZone ? w.buyZonePrice : '—'}
                  </dd>
                </div>
                <div className="bg-zinc-950/70 px-3 py-2">
                  <dt className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-zinc-500">
                    <ShieldCheck size={10} /> {blocked ? 'Mốc vô hiệu' : 'Cắt lỗ'}
                  </dt>
                  <dd className="mt-0.5 text-[12px] font-medium tabular-nums text-rose-300">
                    {w.stopLossPrice || '—'}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        )}

        {/* Phân bổ vốn theo pha */}
        <div className="mt-4">
          <Eyebrow className="text-[9.5px] text-zinc-600">Giải ngân theo pha</Eyebrow>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {ALLOCATION.map((a) => {
              const active = !blocked && idx === a.phase;
              return (
                <div
                  key={a.phase}
                  className={cx(
                    'rounded-lg border px-2.5 py-2 transition-colors',
                    active ? 'border-emerald-400/30 bg-emerald-400/[0.07]' : 'border-white/[0.06] bg-white/[0.015]'
                  )}
                >
                  <div className={cx('text-[13px] font-semibold tabular-nums', active ? 'text-emerald-300' : 'text-zinc-300')}>
                    {a.pct}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-zinc-400">{a.name}</div>
                  <div className="text-[9.5px] text-zinc-600">{a.at}</div>
                </div>
              );
            })}
          </div>
        </div>

        {w.nextMilestone && (
          <p className="mt-4 border-l border-white/10 pl-3 text-[11px] leading-relaxed text-zinc-400">
            <span className="text-zinc-300">Cột mốc kế tiếp · </span>
            {w.nextMilestone}
          </p>
        )}
      </div>

      {/* 8 tiêu chí Wyckoff & VSA */}
      {open && w.criteria && (
        <div className="border-t border-white/[0.05]">
          <button
            type="button"
            onClick={() => setShowCriteria((v) => !v)}
            aria-expanded={showCriteria}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <Eyebrow className="text-[9.5px] text-zinc-500">Chi tiết 8 tiêu chí Wyckoff &amp; VSA</Eyebrow>
            <CaretDown
              size={11}
              weight="bold"
              className={cx('text-zinc-600 transition-transform duration-200', showCriteria && 'rotate-180')}
            />
          </button>
          {showCriteria && (
            <div className="divide-y divide-white/[0.03] border-t border-white/[0.04]">
              {w.criteria.map((c) => (
                <div key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                  <Mark passed={c.passed} />
                  <div className="min-w-0">
                    <div className={cx('text-[12px] leading-snug', c.passed ? 'text-zinc-100' : 'text-zinc-300')}>
                      {c.label}
                    </div>
                    <div className="mt-0.5 text-[10.5px] tabular-nums text-zinc-500">{c.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
 * RS Rating
 * ──────────────────────────────────────────────────────────────────────────── */

const RsCard: React.FC<{ data: MinerviniAnalysisResult }> = ({ data }) => {
  const rs = Math.min(99, Math.max(1, data.rsRating));
  const leading = rs >= 70;
  const tone = leading ? 'text-emerald-300' : rs >= 50 ? 'text-amber-300' : 'text-rose-300';
  const fill = leading ? 'from-emerald-500/70 to-emerald-300' : rs >= 50 ? 'from-amber-500/70 to-amber-300' : 'from-rose-500/70 to-rose-300';
  const label = leading ? 'Dẫn dắt' : rs >= 50 ? 'Trung bình khá' : 'Yếu';

  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow className="text-zinc-400">Sức mạnh giá RS</Eyebrow>
          <div className="mt-0.5 text-[10.5px] text-zinc-600">Percentile 1–99 so với toàn thị trường</div>
        </div>
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1">
            <span className={cx('text-[26px] font-semibold leading-none tabular-nums', tone)}>{rs}</span>
            <span className="text-[11px] text-zinc-600">/99</span>
          </div>
          <div className="mt-1 text-[10.5px] text-zinc-400">
            {label}
            {data.rsRank && data.rsUniverseTotal ? ` · Top ${data.rsRank}/${data.rsUniverseTotal}` : ''}
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-1.5 rounded-full bg-white/[0.07]">
        <div
          className={cx('h-full rounded-full bg-gradient-to-r transition-all duration-700', fill)}
          style={{ width: `${rs}%` }}
        />
        {/* Mốc 70 */}
        <span className="absolute -top-1 bottom-[-4px] w-px bg-white/30" style={{ left: '70%' }} />
        <span
          className="absolute top-3 -translate-x-1/2 text-[9.5px] tabular-nums text-zinc-500"
          style={{ left: '70%' }}
        >
          70
        </span>
      </div>
      <div className="h-3" />
    </Card>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
 * Tab
 * ──────────────────────────────────────────────────────────────────────────── */

export const MinerviniStrategyTab: React.FC<{ data: MinerviniAnalysisResult | null; loading?: boolean }> = ({
  data,
  loading,
}) => {
  if (!data) {
    return (
      <div className="space-y-3" aria-busy={loading}>
        {[140, 220, 90].map((h, i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-white/[0.03]" style={{ height: h }} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <TrendTemplateCard data={data} />
      <WyckoffCard data={data} />
      <RsCard data={data} />
    </div>
  );
};
