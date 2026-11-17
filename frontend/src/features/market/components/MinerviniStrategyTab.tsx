'use client';

import React, { useState } from 'react';
import { Check, X, CaretDown, Lock, Crosshair, ShieldCheck } from '@phosphor-icons/react';
import type { MinerviniAnalysisResult, MinerviniCriterion } from '../types/minervini.types';
import { useLanguage } from '../../../app/components/LanguageContext';
import {
  ALIGNMENT_TEXT,
  HEADLINE_TEXT,
  ENTRY_TEXT,
  SIZE_TEXT,
  HOLDER_TEXT,
  REASON_TEXT,
  CYCLE_PHASE_TEXT,
  SUB_STAGE_TEXT,
  SHORT_HEADLINE,
  SHORT_ALIGN,
  SHORT_PHASE,
  SHORT_TT_NAME,
  shortTrigger,
} from '../i18n/decision';
import {
  TREND_LABEL_EN,
  WYCKOFF_LABEL_EN,
  PHASE_NAME_EN,
  PHASE_TAG_EN,
  MILESTONE_EN,
  SIGNAL_EN,
  translateValue,
} from '../i18n/minervini';

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
const CRITERIA_VIEW: Record<number, { sep?: string; parts?: string[]; partsEn?: string[]; req?: string; reqEn?: string }> = {
  1: { sep: ' / ', parts: ['Giá', 'MA150', 'MA200'], partsEn: ['Price', 'MA150', 'MA200'] },
  2: { sep: ' > ', parts: ['MA150', 'MA200'], partsEn: ['MA150', 'MA200'] },
  3: { sep: ' vs ', parts: ['MA200 nay', '1 tháng trước'], partsEn: ['MA200 now', '1 month ago'] },
  4: { sep: ' / ', parts: ['MA50', 'MA150', 'MA200'], partsEn: ['MA50', 'MA150', 'MA200'] },
  5: { sep: ' / ', parts: ['Giá', 'MA50'], partsEn: ['Price', 'MA50'] },
  6: { req: 'Cần ≥ +30%', reqEn: 'Need ≥ +30%' },
  7: { req: 'Cần ≥ −25%', reqEn: 'Need ≥ −25%' },
  8: { req: 'Cần ≥ 70', reqEn: 'Need ≥ 70' },
};

const GROUPS: { title: string; en: string; ids: number[] }[] = [
  { title: 'Cấu trúc đường trung bình', en: 'Moving-average structure', ids: [1, 2, 3, 4, 5] },
  { title: 'Vị thế trong biên độ 52 tuần', en: 'Position in the 52-week range', ids: [6, 7] },
  { title: 'Sức mạnh tương đối', en: 'Relative strength', ids: [8] },
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
  const { tr, language } = useLanguage();
  const view = CRITERIA_VIEW[c.id] || {};
  const raw = c.comparisonValue && c.comparisonValue !== 'N/A' ? c.comparisonValue : '';
  const parts = view.parts && view.sep && raw ? raw.split(view.sep) : null;

  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <Mark passed={c.passed} />
      <div className="min-w-0 flex-1">
        <div className={cx('text-[12px] leading-snug', c.passed ? 'text-zinc-100' : 'text-zinc-300')}>
          {language === 'en' ? TREND_LABEL_EN[c.id] || c.label : c.label}
        </div>
        {parts && (
          <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-0.5 text-[10.5px] text-zinc-500">
            {parts.map((v, i) => (
              <span key={i}>
                {(language === 'en' ? view.partsEn! : view.parts!)[i]} <span className="tabular-nums text-zinc-300">{v}</span>
              </span>
            ))}
          </div>
        )}
        {!parts && !view.req && (
          <div className="mt-1 text-[10.5px] text-zinc-600">{raw || tr('Chưa đủ dữ liệu', 'Not enough data')}</div>
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
          <div className="mt-0.5 text-[10px] text-zinc-600">{language === 'en' ? view.reqEn : view.req}</div>
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


/* ────────────────────────────────────────────────────────────────────────────
 * Ba thẻ ngắn gọn: Minervini · Wyckoff · Tổng kết
 * ──────────────────────────────────────────────────────────────────────────── */

const Collapse: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-white/[0.05]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
      >
        {label}
        <CaretDown size={11} weight="bold" className={cx('transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-white/[0.04]">{children}</div>}
    </div>
  );
};

const CardTitle: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-1">
    <span className="text-[12px] font-semibold tracking-wide text-zinc-200">{title}</span>
    {right}
  </div>
);

/* 1) MINERVINI */
const MinerviniCard: React.FC<{ data: MinerviniAnalysisResult }> = ({ data }) => {
  const { tr, language } = useLanguage();
  const passed = data.passedCount;
  const failed = data.criteria.filter((c) => !c.passed);
  const stage = data.stage;
  const stagePill = STAGE_TONE[stage] || STAGE_TONE[1];
  const barTone = passed === 8 ? 'bg-emerald-400' : passed >= 5 ? 'bg-amber-400' : 'bg-rose-400/90';

  const sentence =
    stage === 2 && passed === 8
      ? tr('Xu hướng tăng, đạt đủ chuẩn.', 'Uptrend, fully qualified.')
      : stage === 2
        ? tr(
            `Xu hướng tăng nhưng thiếu ${8 - passed} tiêu chí: ${failed.slice(0, 2).map((c) => SHORT_TT_NAME[c.id]?.vi ?? '').join(', ')}.`,
            `Uptrend but missing ${8 - passed} criteria: ${failed.slice(0, 2).map((c) => SHORT_TT_NAME[c.id]?.en ?? '').join(', ')}.`
          )
        : stage === 1
          ? tr('Đang tạo đáy, chưa phải lúc mua.', 'Building a base — not time to buy.')
          : stage === 3
            ? tr('Vùng đỉnh, rủi ro cao.', 'Near a top — higher risk.')
            : tr('Đang giảm giá, đứng ngoài.', 'In a downtrend — stay out.');

  return (
    <Card>
      <CardTitle
        title="Minervini"
        right={
          <span className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', stagePill.pill)}>
            Stage {stage}
          </span>
        }
      />
      <div className="px-4 pb-3.5 pt-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[26px] font-semibold leading-none tabular-nums text-zinc-50">{passed}</span>
          <span className="text-[13px] text-zinc-600 tabular-nums">/ 8 {tr('tiêu chí', 'criteria')}</span>
          <span className="ml-auto text-[11px] tabular-nums text-zinc-500">RS {data.rsRating}</span>
        </div>
        <div className="mt-2.5 grid grid-cols-8 gap-1" aria-hidden>
          {data.criteria.map((c) => (
            <span key={c.id} className={cx('h-[3px] rounded-full', c.passed ? barTone : 'bg-white/[0.07]')} />
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-snug text-zinc-300">{sentence}</p>
      </div>
      <Collapse label={tr('Xem 8 tiêu chí', 'See the 8 criteria')}>
        {GROUPS.map((g) => {
          const rows = data.criteria.filter((c) => g.ids.includes(c.id));
          return rows.length ? (
            <div key={g.title} className="divide-y divide-white/[0.03]">
              {rows.map((c) => (
                <CriterionRow key={c.id} c={c} />
              ))}
            </div>
          ) : null;
        })}
      </Collapse>
    </Card>
  );
};

/* 2) WYCKOFF */
const WyckoffShortCard: React.FC<{ data: MinerviniAnalysisResult }> = ({ data }) => {
  const { tr, language } = useLanguage();
  const w = data.wyckoff;
  const ctx = data.cycle;
  if (!w || !ctx) return null;
  const phaseTag = CYCLE_PHASE_TEXT[ctx.phase].eyebrow[language];
  const warn = ctx.distribution.score >= 2;
  const bias =
    ctx.bias === 'BULLISH_TIMING'
      ? { t: tr('Đúng thời điểm', 'Good timing'), c: 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/30' }
      : ctx.bias === 'BEARISH'
        ? { t: tr('Cảnh báo', 'Warning'), c: 'bg-rose-500/10 text-rose-300 ring-rose-400/25' }
        : { t: tr('Chưa tới điểm vào', 'Not at an entry'), c: 'bg-amber-500/10 text-amber-300 ring-amber-400/25' };

  return (
    <Card>
      <CardTitle title="Wyckoff" right={<span className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', bias.c)}>{bias.t}</span>} />
      <div className="px-4 pb-3.5 pt-2">
        <div className="text-[11px] text-zinc-500">{phaseTag}</div>
        <p className="mt-1 text-[12px] leading-snug text-zinc-300">{SHORT_PHASE[ctx.phase][language]}.</p>
        {warn && (
          <p className="mt-2 text-[11px] text-rose-300/80">
            {tr(`Dấu hiệu xả hàng: ${ctx.distribution.score}/5`, `Distribution signs: ${ctx.distribution.score}/5`)}
          </p>
        )}
      </div>
      {w.criteria && (
        <Collapse label={tr('Xem 8 tín hiệu', 'See the 8 signals')}>
          <div className="divide-y divide-white/[0.03]">
            {w.criteria.map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                <Mark passed={c.passed} />
                <div className="min-w-0">
                  <div className={cx('text-[12px] leading-snug', c.passed ? 'text-zinc-100' : 'text-zinc-300')}>
                    {language === 'en' ? WYCKOFF_LABEL_EN[c.id] || c.label : c.label}
                  </div>
                  <div className="mt-0.5 text-[10.5px] tabular-nums text-zinc-500">{translateValue(c.value, language)}</div>
                </div>
              </div>
            ))}
          </div>
        </Collapse>
      )}
    </Card>
  );
};

/* 3) TỔNG KẾT */
const SummaryCard: React.FC<{ data: MinerviniAnalysisResult }> = ({ data }) => {
  const { tr, language } = useLanguage();
  const d = data.decision;
  if (!d) return null;
  const lang = language;
  const need = d.triggersUp.filter((t) => t.code !== 'MARKET_RECOVERS' && t.code !== 'TT_CRITERIA_MISSING' || d.triggersUp.length <= 2).slice(0, 3);
  const reasons = [...d.newBuyer.reasons, ...d.holder.reasons, ...d.sizeNotes].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <Card>
      <CardTitle
        title={tr('Tổng kết', 'Summary')}
        right={<span className={cx('text-[11px]', ALIGN_TONE[d.alignment])}>{SHORT_ALIGN[d.alignment][lang]}</span>}
      />
      <div className="px-4 pb-3.5 pt-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-zinc-500">{tr('Chưa có vị thế', 'No position')}</div>
            <div className={cx('mt-1 inline-flex rounded-md px-2.5 py-1 text-[14px] font-bold ring-1 ring-inset', ENTRY_TONE[d.newBuyer.action])}>
              {ENTRY_TEXT[d.newBuyer.action][lang]}
            </div>
            {d.newBuyer.size === 'HALF' && <div className="mt-1 text-[10.5px] text-zinc-500">{tr('nửa tỷ trọng', 'half size')}</div>}
          </div>
          <div>
            <div className="text-[10px] text-zinc-500">{tr('Đang giữ', 'Holding')}</div>
            <div className={cx('mt-1 inline-flex rounded-md px-2.5 py-1 text-[12px] font-bold ring-1 ring-inset', HOLDER_TONE[d.holder.action])}>
              {HOLDER_TEXT[d.holder.action][lang]}
            </div>
          </div>
        </div>

        <p className="mt-3 text-[12px] font-medium leading-snug text-zinc-100">{SHORT_HEADLINE[d.headline]?.[lang] ?? d.headline}</p>

        {d.newBuyer.action !== 'BUY' && need.length > 0 && (
          <div className="mt-2.5">
            <div className="text-[10px] text-zinc-500">{tr('Cần để mua', 'Needed to buy')}</div>
            <ul className="mt-1 space-y-0.5 text-[11.5px] text-zinc-300">
              {need.map((t, i) => (
                <li key={i} className="flex gap-1.5"><span className="text-emerald-400/70">↑</span>{shortTrigger(t, lang)}</li>
              ))}
            </ul>
          </div>
        )}
        {d.newBuyer.action === 'BUY' && d.triggersDown[0] && (
          <p className="mt-2.5 text-[11.5px] text-zinc-400">
            <span className="text-rose-400/70">↓ </span>
            {tr('Thoát nếu', 'Exit if')}: {shortTrigger(d.triggersDown[0], lang)}
          </p>
        )}
      </div>
      <Collapse label={tr('Vì sao & khi nào đổi', 'Why & what changes it')}>
        <div className="space-y-2.5 px-4 py-3 text-[11px] leading-relaxed text-zinc-400">
          <ul className="space-y-1">
            {reasons.map((r) => (
              <li key={r} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600" /><span>{REASON_TEXT[r]?.[lang] ?? r}</span></li>
            ))}
          </ul>
          {d.triggersDown.length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-500">{tr('Hạ xuống / thoát khi', 'Downgrade / exit when')}</div>
              <ul className="mt-1 space-y-0.5 text-zinc-300">
                {d.triggersDown.map((t, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-rose-400/70">↓</span>{shortTrigger(t, lang)}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-zinc-500">
            {tr('Mua cần cả hai khung đồng ý; giảm/thoát chỉ cần một khung báo xấu.', 'Buying needs both frameworks to agree; reducing/exiting needs only one to turn bad.')}
          </p>
        </div>
      </Collapse>
    </Card>
  );
};

const ENTRY_TONE = {
  BUY: 'text-emerald-300 bg-emerald-500/10 ring-emerald-400/30',
  WAIT: 'text-amber-300 bg-amber-500/10 ring-amber-400/25',
  AVOID: 'text-rose-300 bg-rose-500/10 ring-rose-400/25',
} as const;
const HOLDER_TONE = {
  HOLD: ENTRY_TONE.BUY,
  HOLD_TIGHTEN: ENTRY_TONE.WAIT,
  HOLD_NO_ADD: ENTRY_TONE.WAIT,
  REDUCE: ENTRY_TONE.AVOID,
  EXIT: ENTRY_TONE.AVOID,
} as const;
const ALIGN_TONE: Record<string, string> = {
  ALIGNED_BULLISH: 'text-emerald-300',
  ALIGNED_BEARISH: 'text-rose-300',
  TIMING_PENDING: 'text-amber-300',
  WYCKOFF_LEADS: 'text-cyan-300',
  WYCKOFF_WARNS: 'text-rose-300',
  NEUTRAL_WAIT: 'text-zinc-300',
};

export const MinerviniStrategyTab: React.FC<{ data: MinerviniAnalysisResult | null; loading?: boolean }> = ({
  data,
  loading,
}) => {
  if (!data) {
    return (
      <div className="space-y-3" aria-busy={loading}>
        {[110, 110, 140].map((h, i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-white/[0.03]" style={{ height: h }} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <MinerviniCard data={data} />
      <WyckoffShortCard data={data} />
      <SummaryCard data={data} />
    </div>
  );
};
