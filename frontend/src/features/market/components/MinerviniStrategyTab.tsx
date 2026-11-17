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
  triggerText,
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

/** Chu kỳ 4 Stage theo Weinstein / Minervini — luôn đi theo thứ tự 1 → 2 → 3 → 4. */
const STAGES = [
  {
    n: 1,
    name: 'Tích lũy',
    nameEn: 'Basing',
    note: 'Tích lũy / Base',
    noteEn: 'Basing phase',
    def: 'Đáy nền sau nhịp giảm: giá đi ngang quanh MA200 đã phẳng. Chờ, chưa mua.',
    defEn: 'A base after a decline: price drifts sideways around a flat MA200. Wait — do not buy yet.',
  },
  {
    n: 2,
    name: 'Tăng trưởng',
    nameEn: 'Advancing',
    note: 'Tăng trưởng',
    noteEn: 'Uptrend',
    def: 'Giá trên MA150 & MA200, MA200 dốc lên. Chỉ khi đủ 8/8 tiêu chí mới được xét mua.',
    defEn: 'Price above MA150 & MA200 with MA200 rising. Only buyable when all 8 criteria pass.',
  },
  {
    n: 3,
    name: 'Phân phối',
    nameEn: 'Topping',
    note: 'Phân phối / Rủi ro',
    noteEn: 'Distribution / Risk',
    def: 'Đà tăng chững lại, MA50 cắt xuống MA150, giá cách đỉnh xa dần. Không mua mới, giảm tỷ trọng.',
    defEn: 'Momentum stalls, MA50 crosses below MA150 and price drifts from its high. No new buys; trim exposure.',
  },
  {
    n: 4,
    name: 'Giảm giá',
    nameEn: 'Declining',
    note: 'Giảm giá / Không tham gia',
    noteEn: 'Downtrend / Stay out',
    def: 'Giá dưới MA200 đang dốc xuống. Đứng ngoài, không bắt đáy.',
    defEn: 'Price below a falling MA200. Stay out — do not try to catch the bottom.',
  },
];

const STAGE_ACTIVE: Record<number, string> = {
  1: 'bg-zinc-500/15 text-zinc-100 ring-zinc-300/40',
  2: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/50',
  3: 'bg-amber-500/15 text-amber-200 ring-amber-400/45',
  4: 'bg-rose-500/15 text-rose-200 ring-rose-400/45',
};

const PHASES = [
  { key: 'A', tag: 'Hãm rơi' },
  { key: 'B', tag: 'Gom hàng' },
  { key: 'C', tag: 'Rũ bỏ' },
  { key: 'D', tag: 'SOS / LPS' },
  { key: 'E', tag: 'Bứt phá' },
];

const ALLOCATION = [
  { phase: 2, name: 'Thăm dò', nameEn: 'Probe', pct: '20–30%', at: 'Phase C', atEn: 'Phase C' },
  { phase: 3, name: 'Chủ lực', nameEn: 'Core', pct: '40–50%', at: 'Phase D', atEn: 'Phase D' },
  { phase: 4, name: 'Gia tăng', nameEn: 'Add', pct: '20–30%', at: 'Đầu Phase E', atEn: 'Early Phase E' },
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

const TrendTemplateCard: React.FC<{ data: MinerviniAnalysisResult }> = ({ data }) => {
  const { tr, language } = useLanguage();
  const [open, setOpen] = useState(true);
  const passed = data.passedCount;
  const stage = data.stage;
  const tone = STAGE_TONE[stage] || STAGE_TONE[1];
  const barTone = passed === 8 ? 'bg-emerald-400' : passed >= 5 ? 'bg-amber-400' : 'bg-rose-400/90';
  const stageShort = `Stage ${stage}`;
  const stageInfo = STAGES[stage - 1];
  const stageNote = data.stageInfo ? SUB_STAGE_TEXT[data.stageInfo.sub][language] : language === 'en' ? stageInfo?.noteEn : stageInfo?.note;
  const ev = data.stageInfo?.evidence;

  return (
    <Card>
      <CardHeader title={tr('Mẫu hình xu hướng · Minervini', 'Trend Template · Minervini')} open={open} onToggle={() => setOpen((v) => !v)} />

      <div className="flex items-end justify-between gap-4 px-4 pb-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums text-zinc-50">
              {passed}
            </span>
            <span className="text-[15px] text-zinc-600 tabular-nums">/ 8</span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {passed === 8
              ? tr('Đủ điều kiện xét mua', 'Eligible to buy')
              : tr(`Thiếu ${8 - passed} tiêu chí để vào Stage 2`, `${8 - passed} more criteria needed for Stage 2`)}
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

      {/* Chu kỳ 4 Stage theo thứ tự */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between">
          <Eyebrow className="text-[9.5px] text-zinc-600">{tr('Chu kỳ 4 Stage', 'The 4 Stages')}</Eyebrow>
          <span className="text-[10px] text-zinc-600">{tr('Chỉ mua ở Stage 2', 'Buy only in Stage 2')}</span>
        </div>
        <ol className="mt-2 grid grid-cols-4 gap-1.5" aria-label={tr('Thứ tự các Stage', 'Order of the Stages')}>
          {STAGES.map((st) => {
            const cur = st.n === stage;
            return (
              <li
                key={st.n}
                aria-current={cur ? 'step' : undefined}
                className={cx(
                  'rounded-lg px-2 py-2 text-center ring-1 ring-inset transition-colors',
                  cur ? STAGE_ACTIVE[st.n] : 'bg-white/[0.015] text-zinc-600 ring-white/[0.06]'
                )}
              >
                <div className="text-[9.5px] font-medium uppercase tracking-wider opacity-80">Stage {st.n}</div>
                <div className={cx('mt-0.5 text-[11px] leading-tight', cur ? 'font-semibold' : 'text-zinc-500')}>
                  {language === 'en' ? st.nameEn : st.name}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-400">
          <span className="text-zinc-300">{language === 'en' ? stageInfo?.nameEn : stageInfo?.name} · </span>
          {language === 'en' ? stageInfo?.defEn : stageInfo?.def}
        </p>
        {ev && (
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-zinc-500 tabular-nums">
            {tr('Cơ sở xét Stage', 'Why this Stage')}: MA150 {ev.slope150Pct > 0 ? '+' : ''}{ev.slope150Pct}% / 30 {tr('phiên', 'sessions')}
            {ev.priorTrendPct !== null ? ` · ${tr('xu hướng trước đó', 'prior trend')} ${ev.priorTrendPct > 0 ? '+' : ''}${ev.priorTrendPct}%` : ''}
            {' · '}{tr('giá so MA150', 'price vs MA150')} {ev.distFromMa150Pct > 0 ? '+' : ''}{ev.distFromMa150Pct}%
          </p>
        )}
      </div>

      {open && (
        <div className="border-t border-white/[0.05]">
          {GROUPS.map((g) => {
            const rows = data.criteria.filter((c) => g.ids.includes(c.id));
            if (!rows.length) return null;
            return (
              <div key={g.title} className="border-b border-white/[0.04] last:border-b-0">
                <div className="px-4 pt-3 pb-0.5">
                  <Eyebrow className="text-[9.5px] text-zinc-600">{language === 'en' ? g.en : g.title}</Eyebrow>
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
  const { tr, language } = useLanguage();
  const en = language === 'en';
  const [open, setOpen] = useState(true);
  const [showCriteria, setShowCriteria] = useState(false);
  const w = data.wyckoff;
  if (!w) return null;

  const idx = typeof w.phaseIndex === 'number' ? w.phaseIndex : 1;
  const progress = typeof w.phaseProgressPct === 'number' && w.phaseProgressPct > 0 ? w.phaseProgressPct : (idx + 1) * 20;
  const [phaseEyebrow, phaseTitleRaw] = stripEmoji(w.phaseName).split(/\s[—–-]\s/);
  const phaseTitle = (phaseTitleRaw || phaseEyebrow).replace(/\s*\(.*?\)\s*$/, '');
  const phaseEn = PHASE_NAME_EN[w.phase];
  const ctx = data.cycle;
  const ctxText = ctx ? CYCLE_PHASE_TEXT[ctx.phase] : null;

  const [sigTitleVi, sigDescVi] = splitTitle(w.buyPointLabel);
  const sigEn = SIGNAL_EN[w.buyPointCode === 'NONE' || !w.buyPointCode ? `NONE_${w.phase.slice(-1)}` : w.buyPointCode];
  const sigTitle = en && sigEn ? sigEn[0] : sigTitleVi;
  const sigDesc = en && sigEn ? sigEn[1] : sigDescVi;
  const buyBlockedReason = en
    ? `Trend Template not met (${data.passedCount}/8 · Stage ${data.stage}). Watch only — do not deploy capital yet.`
    : w.buyBlockedReason;
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
        title={tr('Chẩn đoán Wyckoff', 'Wyckoff diagnosis')}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        right={
          <span className="text-[10.5px] tabular-nums text-zinc-500">
            {w.passedCount}/{w.totalCount || 8} {tr('tiêu chí', 'criteria')}
          </span>
        }
      />

      {/* Pha hiện tại */}
      <div className="px-4 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className={cx('text-[10.5px]', ctx && ctx.cycle === 'DISTRIBUTION' ? 'text-rose-300/90' : ctx && ctx.cycle === 'MARKDOWN' ? 'text-rose-300/90' : 'text-emerald-400/90')}>
              {ctxText ? ctxText.eyebrow[language] : en && phaseEn ? phaseEn.eyebrow : phaseEyebrow}
            </div>
            <div className="mt-0.5 text-[16px] font-semibold leading-tight text-zinc-50">
              {ctxText ? ctxText.title[language] : en && phaseEn ? phaseEn.title : phaseTitle}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[18px] font-semibold leading-none tabular-nums text-zinc-100">{progress}%</div>
            <div className="mt-1 text-[10px] text-zinc-600">{tr('chu kỳ tích lũy', 'accumulation cycle')}</div>
          </div>
        </div>

        {/* Vị trí trong chu kỳ lớn: Wyckoff và Stage cùng nhìn một chu kỳ */}
        {ctx && (
          <div className="mt-3">
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ['ACCUMULATION', tr('Tích lũy', 'Accumulation'), 'Stage 1'],
                  ['MARKUP', 'Markup', 'Stage 2'],
                  ['DISTRIBUTION', tr('Phân phối', 'Distribution'), 'Stage 3'],
                  ['MARKDOWN', 'Markdown', 'Stage 4'],
                ] as const
              ).map(([k, label, st]) => (
                <div
                  key={k}
                  className={cx(
                    'rounded-md px-1.5 py-1 text-center text-[10px] ring-1 ring-inset',
                    ctx.cycle === k ? 'bg-white/[0.07] text-zinc-100 ring-white/20' : 'text-zinc-600 ring-white/[0.05]'
                  )}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-[9px] opacity-70">{st}</div>
                </div>
              ))}
            </div>
            {!ctx.coherent && (
              <p className="mt-2 text-[10.5px] leading-relaxed text-amber-200/75">
                {tr(
                  `Máy Wyckoff chỉ biết các pha tích lũy nên đọc thô là "${w.phase}". Với cổ phiếu đang ở Stage ${data.stage}, cách đọc đó không áp dụng — bối cảnh chu kỳ ở trên mới là kết luận.`,
                  `The Wyckoff engine only knows accumulation phases, so its raw reading is "${w.phase}". For a Stage ${data.stage} stock that reading does not apply — the cycle context above is the conclusion.`
                )}
              </p>
            )}
            {ctx.earlyBasing && (
              <p className="mt-2 text-[10.5px] leading-relaxed text-cyan-200/80">
                {tr('Cấu trúc nền đang hình thành: theo dõi để chuyển sang Stage 1.', 'A base is forming: watch for a move to Stage 1.')}
              </p>
            )}
            {ctx.distribution.score >= 2 && (
              <p className="mt-2 text-[10.5px] leading-relaxed text-rose-200/75">
                {tr(`Dấu hiệu phân phối: ${ctx.distribution.score}/5`, `Distribution signs: ${ctx.distribution.score}/5`)}
                {' — '}
                {[
                  ctx.distribution.flags.upthrust && 'Upthrust',
                  ctx.distribution.flags.sow && 'SOW',
                  ctx.distribution.flags.supplyDominant && tr('cung lấn át cầu', 'supply > demand'),
                  ctx.distribution.flags.belowMa50Falling && tr('dưới MA50 đang dốc xuống', 'below a falling MA50'),
                  ctx.distribution.flags.lowerHighs && tr('đỉnh sau thấp hơn', 'lower highs'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* Timeline 5 pha */}
        <div className={cx('relative mt-5 transition-opacity', ctx && !ctx.coherent && 'opacity-35')}>
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
                    {en ? PHASE_TAG_EN[PHASES.indexOf(p)] : p.tag}
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
                  {blocked ? `${tr('Tín hiệu theo dõi', 'Watch signal')} · ${w.phase}` : sigTitle}
                </div>
                {sigDesc && <div className="mt-0.5 text-[11.5px] leading-snug text-zinc-300">{sigDesc}</div>}
                {blocked && w.buyBlockedReason && (
                  <div className="mt-1.5 text-[10.5px] leading-snug text-amber-200/70">{buyBlockedReason}</div>
                )}
              </div>
            </div>

            {(hasZone || w.stopLossPrice) && (
              <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/[0.06]">
                <div className="bg-zinc-950/70 px-3 py-2">
                  <dt className="text-[9.5px] uppercase tracking-wider text-zinc-500">
                    {blocked ? tr('Vùng theo dõi', 'Watch zone') : tr('Vùng mua', 'Buy zone')}
                  </dt>
                  <dd className="mt-0.5 text-[12px] font-medium tabular-nums text-zinc-100">
                    {hasZone ? translateValue(w.buyZonePrice, language) : '—'}
                  </dd>
                </div>
                <div className="bg-zinc-950/70 px-3 py-2">
                  <dt className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-zinc-500">
                    <ShieldCheck size={10} /> {blocked ? tr('Mốc vô hiệu', 'Invalidation') : tr('Cắt lỗ', 'Stop loss')}
                  </dt>
                  <dd className="mt-0.5 text-[12px] font-medium tabular-nums text-rose-300">
                    {translateValue(w.stopLossPrice, language) || '—'}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        )}

        {/* Phân bổ vốn theo pha */}
        <div className="mt-4">
          <Eyebrow className="text-[9.5px] text-zinc-600">{tr('Giải ngân theo pha', 'Position sizing by phase')}</Eyebrow>
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
                  <div className="mt-0.5 text-[10.5px] text-zinc-400">{en ? a.nameEn : a.name}</div>
                  <div className="text-[9.5px] text-zinc-600">{en ? a.atEn : a.at}</div>
                </div>
              );
            })}
          </div>
        </div>

        {w.nextMilestone && (
          <p className="mt-4 border-l border-white/10 pl-3 text-[11px] leading-relaxed text-zinc-400">
            <span className="text-zinc-300">{tr('Cột mốc kế tiếp', 'Next milestone')} · </span>
            {en ? MILESTONE_EN[w.phase] || w.nextMilestone : w.nextMilestone}
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
            <Eyebrow className="text-[9.5px] text-zinc-500">{tr('Chi tiết 8 tiêu chí Wyckoff & VSA', 'All 8 Wyckoff & VSA criteria')}</Eyebrow>
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
                      {en ? WYCKOFF_LABEL_EN[c.id] || c.label : c.label}
                    </div>
                    <div className="mt-0.5 text-[10.5px] tabular-nums text-zinc-500">{translateValue(c.value, language)}</div>
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
  const { tr } = useLanguage();
  const rs = Math.min(99, Math.max(1, data.rsRating));
  const leading = rs >= 70;
  const tone = leading ? 'text-emerald-300' : rs >= 50 ? 'text-amber-300' : 'text-rose-300';
  const fill = leading ? 'from-emerald-500/70 to-emerald-300' : rs >= 50 ? 'from-amber-500/70 to-amber-300' : 'from-rose-500/70 to-rose-300';
  const label = leading ? tr('Dẫn dắt', 'Leading') : rs >= 50 ? tr('Trung bình khá', 'Above average') : tr('Yếu', 'Weak');

  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow className="text-zinc-400">{tr('Sức mạnh giá RS', 'Relative Strength (RS)')}</Eyebrow>
          <div className="mt-0.5 text-[10.5px] text-zinc-600">{tr('Percentile 1–99 so với toàn thị trường', 'Percentile 1–99 vs. the whole market')}</div>
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


/* ────────────────────────────────────────────────────────────────────────────
 * Quyết định hợp nhất Stage × Wyckoff
 * ──────────────────────────────────────────────────────────────────────────── */

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

const DriverChip: React.FC<{ label: string; value: string; state: 'OK' | 'NOT_YET' | 'BAD' | 'WARN' }> = ({ label, value, state }) => {
  const tone =
    state === 'OK' ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30' : state === 'NOT_YET' ? 'bg-amber-500/10 text-amber-300 ring-amber-400/25' : 'bg-rose-500/10 text-rose-300 ring-rose-400/25';
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-white/[0.02] p-2.5 ring-1 ring-inset ring-white/[0.06]">
      <div className="text-[9.5px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 flex items-start gap-1.5">
        <span className={cx('mt-px grid h-[16px] w-[16px] shrink-0 place-items-center rounded-full ring-1 ring-inset', tone)}>
          {state === 'OK' ? <Check size={9} weight="bold" /> : state === 'NOT_YET' ? <span className="h-1 w-1 rounded-full bg-current" /> : <X size={9} weight="bold" />}
        </span>
        <span className="text-[11.5px] leading-snug text-zinc-200">{value}</span>
      </div>
    </div>
  );
};

const DecisionCard: React.FC<{ data: MinerviniAnalysisResult }> = ({ data }) => {
  const { tr, language } = useLanguage();
  const [showRule, setShowRule] = useState(false);
  const d = data.decision;
  if (!d) return null;
  const lang = language;
  const labelOf = (id: number) => {
    const c = data.criteria.find((x) => x.id === id);
    return lang === 'en' ? TREND_LABEL_EN[id] || c?.label || String(id) : c?.label || TREND_LABEL_EN[id] || String(id);
  };
  const align = ALIGNMENT_TEXT[d.alignment];
  const ctx = data.cycle;
  const ev = d.evidence;
  const stageValue = `Stage ${data.stage}${data.stageInfo ? ' · ' + SUB_STAGE_TEXT[data.stageInfo.sub][lang] : ''}`;
  const wyValue = ctx ? `${CYCLE_PHASE_TEXT[ctx.phase].eyebrow[lang]} · ${CYCLE_PHASE_TEXT[ctx.phase].title[lang]}` : '';
  const stageState = d.drivers.stage;
  const wyState = d.drivers.wyckoff === 'WARN' ? 'BAD' : d.drivers.wyckoff;
  const rr = (r: string) => REASON_TEXT[r]?.[lang] ?? r;
  const fmtN = (v: number | undefined) => (v === undefined ? '—' : `${v > 0 ? '+' : ''}${v}%`);

  return (
    <Card>
      <div className="px-4 pt-3.5 pb-2.5">
        <Eyebrow className="text-zinc-400">{tr('Quyết định hợp nhất · Minervini × Wyckoff', 'Unified decision · Minervini × Wyckoff')}</Eyebrow>
      </div>

      <div className="px-4 pb-4 space-y-4">
        {/* Hai khung đồng thuận hay lệch nhau? */}
        <div>
          <div className={cx('text-[13px] font-semibold', ALIGN_TONE[d.alignment])}>{align.title[lang]}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{align.desc[lang]}</p>
        </div>

        <div className="flex gap-2">
          <DriverChip label={tr('Khung Minervini (Stage)', 'Minervini frame (Stage)')} value={stageValue} state={stageState} />
          <DriverChip label={tr('Khung Wyckoff (chu kỳ)', 'Wyckoff frame (cycle)')} value={wyValue} state={wyState} />
        </div>

        {/* Hai quyết định tách biệt: người chưa có vị thế / người đang giữ */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.06]">
            <div className="text-[9.5px] uppercase tracking-wider text-zinc-500">{tr('Chưa có vị thế', 'No position yet')}</div>
            <div className={cx('mt-1.5 inline-flex rounded-md px-2 py-1 text-[13px] font-bold ring-1 ring-inset', ENTRY_TONE[d.newBuyer.action])}>
              {ENTRY_TEXT[d.newBuyer.action][lang]}
            </div>
            {d.newBuyer.size !== 'NONE' && <span className="ml-2 text-[10.5px] text-zinc-400">{SIZE_TEXT[d.newBuyer.size][lang]}</span>}
          </div>
          <div className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.06]">
            <div className="text-[9.5px] uppercase tracking-wider text-zinc-500">{tr('Đang giữ vị thế', 'Holding a position')}</div>
            <div className={cx('mt-1.5 inline-flex rounded-md px-2 py-1 text-[12px] font-bold ring-1 ring-inset', HOLDER_TONE[d.holder.action])}>
              {HOLDER_TEXT[d.holder.action][lang]}
            </div>
          </div>
        </div>

        <p className="text-[12px] font-medium leading-snug text-zinc-100">{HEADLINE_TEXT[d.headline]?.[lang] ?? d.headline}</p>

        <ul className="space-y-1.5 text-[11px] leading-relaxed text-zinc-400">
          {[...d.newBuyer.reasons, ...d.holder.reasons, ...d.sizeNotes].filter((v, i, a) => a.indexOf(v) === i).map((r) => (
            <li key={r} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
              <span>{rr(r)}</span>
            </li>
          ))}
        </ul>

        {/* Khi nào đổi quyết định */}
        {(d.triggersUp.length > 0 || d.triggersDown.length > 0) && (
          <div className="space-y-3 border-t border-white/[0.05] pt-3">
            {d.triggersUp.length > 0 && (
              <div>
                <Eyebrow className="text-[9.5px] text-emerald-400/80">
                  {d.newBuyer.action === 'BUY' ? tr('Điều kiện để giữ quyết định mua', 'To keep the buy valid') : tr('Khi nào nâng lên MUA', 'What upgrades this to BUY')}
                </Eyebrow>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-zinc-300">
                  {d.triggersUp.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-400/70">↑</span>
                      <span>{triggerText(t, lang, labelOf)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.triggersDown.length > 0 && (
              <div>
                <Eyebrow className="text-[9.5px] text-rose-400/80">{tr('Khi nào hạ xuống / thoát', 'What downgrades this / forces an exit')}</Eyebrow>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-zinc-300">
                  {d.triggersDown.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-rose-400/70">↓</span>
                      <span>{triggerText(t, lang, labelOf)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Bằng chứng lịch sử */}
        {ev?.current && (
          <div className="rounded-lg bg-white/[0.02] p-3 text-[10.5px] leading-relaxed text-zinc-400 ring-1 ring-inset ring-white/[0.05]">
            <div className="text-zinc-300">
              {tr('Lịch sử của trạng thái này', 'History of this state')} ({ev.current.n.toLocaleString()} {tr('mã-phiên', 'stock-sessions')}, {ev.meta.periodStart} → {ev.meta.periodEnd}):
            </div>
            <div className="mt-1 tabular-nums">
              {tr('60 phiên sau: trung bình', '60 sessions later: mean')} {fmtN(ev.current.f60.mean)} · {tr('trung vị', 'median')} {fmtN(ev.current.f60.median)} · {ev.current.f60.pos}% {tr('có lãi', 'positive')} · {tr('sụt tối đa 20 phiên (trung vị)', 'max 20-session drawdown (median)')} {ev.current.dd20.median}%
            </div>
            {ev.controls.unifiedBuy && ev.controls.stageOnly && ev.controls.wyckoffOnly && (
              <div className="mt-1 tabular-nums">
                {tr('So sánh điểm MUA (60 phiên, trung vị / % có lãi)', 'Comparing BUY signals (60 sessions, median / % positive)')}: {tr('hợp nhất', 'unified')} {fmtN(ev.controls.unifiedBuy.f60.median)} / {ev.controls.unifiedBuy.f60.pos}% · {tr('chỉ Stage 2', 'Stage 2 only')} {fmtN(ev.controls.stageOnly.f60.median)} / {ev.controls.stageOnly.f60.pos}% · {tr('chỉ Wyckoff D/E', 'Wyckoff D/E only')} {fmtN(ev.controls.wyckoffOnly.f60.median)} / {ev.controls.wyckoffOnly.f60.pos}%
              </div>
            )}
            <div className="mt-1.5 text-zinc-500">
              {tr(
                'Chênh lệch giữa các nhóm nhỏ so với sai số (~3 năm, một chu kỳ thị trường, có thiên lệch sống sót). Hãy coi đây là kỷ luật quản trị rủi ro, không phải lợi thế lợi nhuận đã được chứng minh.',
                'Differences between groups are small relative to the error (~3 years, one market cycle, survivorship bias). Treat this as risk discipline, not a proven profit edge.'
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowRule((v) => !v)}
          aria-expanded={showRule}
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
        >
          <CaretDown size={11} weight="bold" className={cx('transition-transform duration-200', showRule && 'rotate-180')} />
          {tr('Khi hai khung lệch nhau thì nghe khung nào?', 'When the two frameworks disagree, which one wins?')}
        </button>
        {showRule && (
          <div className="space-y-2 text-[11px] leading-relaxed text-zinc-400">
            <p>
              <span className="text-zinc-200">{tr('MUA cần cả hai (phép VÀ). ', 'BUYING needs both (AND). ')}</span>
              {tr(
                'Stage 2 đủ 8/8 cho biết được phép có vị thế mua; Wyckoff ở Phase D/E không kèm dấu hiệu phân phối cho biết đúng thời điểm. Thiếu một trong hai thì chờ.',
                'Stage 2 with 8/8 says a long position is allowed; Wyckoff in Phase D/E with no distribution says the timing is right. If either is missing, wait.'
              )}
            </p>
            <p>
              <span className="text-zinc-200">{tr('GIẢM / THOÁT chỉ cần một (phép HOẶC). ', 'REDUCING / EXITING needs only one (OR). ')}</span>
              {tr(
                'Wyckoff thường lộ phân phối trước khi các đường MA kịp quay đầu; còn nếu Stage hỏng thì cấu trúc xu hướng đã gãy dù Wyckoff còn đẹp. Bảo toàn vốn quan trọng hơn bắt trọn sóng.',
                'Wyckoff often reveals distribution before the moving averages turn; and if Stage breaks, the trend structure is gone even if Wyckoff still looks good. Protecting capital matters more than catching the whole move.'
              )}
            </p>
            <p>
              <span className="text-zinc-200">{tr('Vì sao lệch? ', 'Why do they differ? ')}</span>
              {tr(
                'Hai khung nhìn cùng một chu kỳ ở hai độ phân giải: Stage dựa trên đường MA (trễ nhưng bền), Wyckoff dựa trên giá và khối lượng (sớm nhưng nhiễu hơn). Phần lớn lần lệch là chuyện ai đi trước, không phải hai khung nói ngược nhau.',
                'They view the same cycle at two resolutions: Stage uses moving averages (late but durable), Wyckoff uses price and volume (early but noisier). Most disagreements are about who moves first, not about opposite conclusions.'
              )}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

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
      <DecisionCard data={data} />
      <TrendTemplateCard data={data} />
      <WyckoffCard data={data} />
      <RsCard data={data} />
    </div>
  );
};
