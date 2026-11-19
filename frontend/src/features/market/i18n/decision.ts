/**
 * Văn bản song ngữ cho quyết định hợp nhất Stage × Wyckoff.
 * API chỉ trả MÃ (code) và số liệu; câu chữ nằm ở đây để hai ngôn ngữ luôn khớp nhau.
 */
import type { Alignment, EntryAction, HolderAction, Trigger } from '../utils/decisionEngine';
import type { CyclePhase } from '../utils/wyckoffContext';
import type { StageSub } from '../utils/stageEngine';

type Lang = 'vi' | 'en';
type T = { vi: string; en: string };
const pick = (t: T, lang: Lang) => t[lang];

export const ALIGNMENT_TEXT: Record<Alignment, { title: T; desc: T }> = {
  ALIGNED_BULLISH: {
    title: { vi: 'Hai khung đồng thuận: tích cực', en: 'Both frameworks agree: bullish' },
    desc: { vi: 'Stage 2 đủ 8/8 và Wyckoff đang ở điểm vào (Phase D/E).', en: 'Stage 2 with 8/8 and Wyckoff at an entry point (Phase D/E).' },
  },
  ALIGNED_BEARISH: {
    title: { vi: 'Hai khung đồng thuận: tiêu cực', en: 'Both frameworks agree: bearish' },
    desc: { vi: 'Cả Stage lẫn Wyckoff đều không ủng hộ vị thế mua.', en: 'Neither Stage nor Wyckoff supports a long position.' },
  },
  TIMING_PENDING: {
    title: { vi: 'Xu hướng tốt, chưa tới điểm vào', en: 'Trend is good, entry not here yet' },
    desc: {
      vi: 'Stage 2 đã đủ chuẩn nhưng Wyckoff chưa cho điểm vào. Đây là chuyện thời điểm, không phải mâu thuẫn: chờ pivot hoặc LPS.',
      en: 'Stage 2 qualifies but Wyckoff has not given an entry yet. This is a timing matter, not a contradiction: wait for a pivot or an LPS.',
    },
  },
  WYCKOFF_LEADS: {
    title: { vi: 'Wyckoff báo sớm, Stage chưa xác nhận', en: 'Wyckoff leads, Stage not confirmed yet' },
    desc: {
      vi: 'Cấu trúc giá đang cải thiện trước khi các đường MA kịp xác nhận. Hai khung không nói ngược nhau, chỉ lệch thời điểm: chờ Stage xác nhận rồi mới mua.',
      en: 'Price structure is improving before the moving averages confirm. The frameworks do not contradict each other — they differ in timing: wait for Stage to confirm before buying.',
    },
  },
  WYCKOFF_WARNS: {
    title: { vi: 'Wyckoff cảnh báo trước khi Stage đổi', en: 'Wyckoff warns before Stage turns' },
    desc: {
      vi: 'Đường MA còn tốt nhưng giá và khối lượng đã lộ dấu hiệu phân phối. Wyckoff thường báo trước MA: không mua mới, siết cắt lỗ cho vị thế đang giữ.',
      en: 'The moving averages still look fine but price and volume already show distribution. Wyckoff usually speaks before the MAs do: no new buys, tighten stops on open positions.',
    },
  },
  NEUTRAL_WAIT: {
    title: { vi: 'Cả hai khung chưa rõ', en: 'Neither framework is clear' },
    desc: { vi: 'Chưa có xác nhận từ Stage lẫn Wyckoff.', en: 'No confirmation from either Stage or Wyckoff yet.' },
  },
};

export const HEADLINE_TEXT: Record<string, T> = {
  BUY_ALIGNED: { vi: 'Có thể mua: Stage 2 đủ chuẩn và Wyckoff tới điểm vào', en: 'Can buy: Stage 2 qualifies and Wyckoff is at an entry' },
  WAIT_PIVOT: { vi: 'Chờ điểm vào: xu hướng đạt chuẩn nhưng chưa tới pivot', en: 'Wait for the entry: trend qualifies but price has not reached the pivot' },
  WAIT_NO_CHASE: { vi: 'Đã chạy xa, không mua đuổi: chờ nhịp chỉnh', en: 'Extended — do not chase: wait for a pullback' },
  WAIT_STAGE_CONFIRM: { vi: 'Chờ Stage xác nhận: Wyckoff đã sẵn sàng sớm', en: 'Wait for Stage to confirm: Wyckoff is ready early' },
  WAIT_BASE_FORMING: { vi: 'Chờ nền hình thành: chưa có xác nhận từ cả hai khung', en: 'Wait for the base to form: neither framework confirms yet' },
  AVOID_WYCKOFF_WARNS: { vi: 'Không mua: Wyckoff cảnh báo phân phối', en: 'Do not buy: Wyckoff warns of distribution' },
  AVOID_DISTRIBUTION: { vi: 'Không mua: Stage 3 — vùng đỉnh / phân phối', en: 'Do not buy: Stage 3 — topping / distribution' },
  AVOID_MARKDOWN: { vi: 'Không mua: Stage 4 — đang giảm giá', en: 'Do not buy: Stage 4 — declining' },
};

export const ENTRY_TEXT: Record<EntryAction, T> = {
  BUY: { vi: 'MUA', en: 'BUY' },
  WAIT: { vi: 'CHỜ', en: 'WAIT' },
  AVOID: { vi: 'TRÁNH', en: 'AVOID' },
};
export const SIZE_TEXT: Record<'FULL' | 'HALF' | 'NONE', T> = {
  FULL: { vi: 'tỷ trọng chuẩn', en: 'full size' },
  HALF: { vi: 'nửa tỷ trọng', en: 'half size' },
  NONE: { vi: '', en: '' },
};
export const HOLDER_TEXT: Record<HolderAction, T> = {
  HOLD: { vi: 'GIỮ', en: 'HOLD' },
  HOLD_TIGHTEN: { vi: 'GIỮ & SIẾT CẮT LỖ', en: 'HOLD & TIGHTEN STOP' },
  HOLD_NO_ADD: { vi: 'GIỮ, KHÔNG MUA THÊM', en: 'HOLD, DO NOT ADD' },
  REDUCE: { vi: 'GIẢM TỶ TRỌNG', en: 'REDUCE' },
  EXIT: { vi: 'THOÁT', en: 'EXIT' },
};

export const REASON_TEXT: Record<string, T> = {
  STAGE4_BLOCK: { vi: 'Stage 4: giá dưới MA150 đang dốc xuống — không bắt đáy.', en: 'Stage 4: price below a falling MA150 — do not catch the bottom.' },
  STAGE3_BLOCK: { vi: 'Stage 3: vùng đỉnh / phân phối — không mua mới.', en: 'Stage 3: topping / distribution — no new buys.' },
  WYCKOFF_EARLY_BASE: { vi: 'Wyckoff thấy cấu trúc nền đang hình thành — theo dõi để chuyển sang Stage 1, chưa phải điểm mua.', en: 'Wyckoff sees a base forming — watch for a move to Stage 1; it is not a buy point yet.' },
  WYCKOFF_RESUMPTION_ATTEMPT: { vi: 'Giá đang nỗ lực thoát nền trở lại, chưa được Stage xác nhận.', en: 'Price is trying to break out of the range again; Stage has not confirmed it.' },
  STAGE_NOT_CONFIRMED: { vi: 'Stage chưa xác nhận (chưa Stage 2 đủ 8/8).', en: 'Stage is not confirmed (not Stage 2 with 8/8).' },
  WYCKOFF_DISTRIBUTION: { vi: 'Wyckoff có dấu hiệu phân phối (Upthrust / SOW / cung lấn át cầu).', en: 'Wyckoff shows distribution (upthrust / SOW / supply dominating demand).' },
  STAGE1_BASING: { vi: 'Stage 1: đang tạo đáy nền, chưa có xu hướng tăng.', en: 'Stage 1: building a base, no uptrend yet.' },
  STAGE2_NOT_CONFIRMED: { vi: 'Stage 2 nhưng chưa đủ 8/8 Trend Template.', en: 'Stage 2 but not yet 8/8 on the Trend Template.' },
  WYCKOFF_READY_EARLY: { vi: 'Wyckoff đã sẵn sàng (Phase D/E) trước khi Stage xác nhận.', en: 'Wyckoff is ready (Phase D/E) before Stage confirms.' },
  STAGE_OK: { vi: 'Stage 2 đủ 8/8 Trend Template: được phép có vị thế mua.', en: 'Stage 2 with 8/8: a long position is permitted.' },
  EXTENDED_NO_CHASE: { vi: 'Giá đã chạy xa khỏi nền: mua đuổi có sụt giảm tối đa lớn hơn.', en: 'Price has run far from the base: chasing carries a deeper maximum drawdown.' },
  WYCKOFF_TIMING_OK: { vi: 'Wyckoff ở Phase D/E, không có dấu hiệu phân phối: đúng thời điểm.', en: 'Wyckoff is in Phase D/E with no distribution: timing is right.' },
  WYCKOFF_TIMING_PENDING: { vi: 'Wyckoff chưa tới Phase D/E (đang xây nền hoặc chờ SOS).', en: 'Wyckoff has not reached Phase D/E (still building or waiting for an SOS).' },
  STAGE4_EXIT: { vi: 'Stage 4: cấu trúc xu hướng đã gãy — thoát.', en: 'Stage 4: the trend structure is broken — exit.' },
  STAGE3_WITH_DISTRIBUTION: { vi: 'Stage 3 kèm dấu hiệu phân phối rõ — thoát.', en: 'Stage 3 with clear distribution — exit.' },
  STAGE3_REDUCE: { vi: 'Stage 3: xu hướng chững lại — giảm tỷ trọng.', en: 'Stage 3: the trend is stalling — reduce.' },
  BASE_WITH_DISTRIBUTION: { vi: 'Nền có dấu hiệu phân phối — giảm tỷ trọng.', en: 'The base shows distribution — reduce.' },
  STAGE1_NO_ADD: { vi: 'Stage 1: giữ theo cắt lỗ đã đặt, không mua thêm.', en: 'Stage 1: hold within the planned stop, do not add.' },
  WYCKOFF_WARNS_TRIM: { vi: 'Wyckoff cảnh báo phân phối: giảm bớt dù Stage còn tốt (chỉ cần một khung báo xấu là đủ).', en: 'Wyckoff warns of distribution: trim even though Stage is fine (one bearish framework is enough).' },
  STAGE2_NOT_CONFIRMED_TIGHTEN: { vi: 'Stage 2 chưa đủ 8/8: giữ nhưng siết cắt lỗ.', en: 'Stage 2 below 8/8: hold but tighten the stop.' },
  DISTRIBUTION_CAUTION_TIGHTEN: { vi: 'Có ≥ 2 dấu hiệu phân phối nhẹ: giữ nhưng siết cắt lỗ.', en: '2+ mild distribution signs: hold but tighten the stop.' },
  TREND_INTACT_HOLD: { vi: 'Xu hướng nguyên vẹn, không có cảnh báo: tiếp tục giữ.', en: 'Trend intact and no warnings: keep holding.' },
  MARKET_WEAK_HALF: { vi: 'VN-Index đang dưới MA50/MA200: giảm còn nửa tỷ trọng.', en: 'VN-Index is below its MA50/MA200: halve the position size.' },
  DISTRIBUTION_CAUTION_HALF: { vi: 'Có ≥ 2 dấu hiệu phân phối nhẹ: giảm còn nửa tỷ trọng.', en: '2+ mild distribution signs: halve the position size.' },
};

export const CYCLE_PHASE_TEXT: Record<CyclePhase, { eyebrow: T; title: T }> = {
  MARKDOWN: { eyebrow: { vi: 'Markdown', en: 'Markdown' }, title: { vi: 'Giai đoạn giảm giá', en: 'Declining phase' } },
  ACCUM_A: { eyebrow: { vi: 'Tích lũy · Phase A', en: 'Accumulation · Phase A' }, title: { vi: 'Hãm đà giảm (SC / AR)', en: 'Stopping the decline (SC / AR)' } },
  ACCUM_B: { eyebrow: { vi: 'Tích lũy · Phase B', en: 'Accumulation · Phase B' }, title: { vi: 'Xây dựng nguyên nhân (đi ngang)', en: 'Building the cause (sideways)' } },
  ACCUM_C: { eyebrow: { vi: 'Tích lũy · Phase C', en: 'Accumulation · Phase C' }, title: { vi: 'Spring / thử cung', en: 'Spring / supply test' } },
  ACCUM_D: { eyebrow: { vi: 'Tích lũy · Phase D', en: 'Accumulation · Phase D' }, title: { vi: 'SOS / LPS', en: 'SOS / LPS' } },
  ACCUM_E: { eyebrow: { vi: 'Tích lũy · Phase E', en: 'Accumulation · Phase E' }, title: { vi: 'Vượt nền, chờ Stage 2 xác nhận', en: 'Breaking out, awaiting Stage 2' } },
  REACCUM_B: { eyebrow: { vi: 'Tái tích lũy · Phase B', en: 'Re-accumulation · Phase B' }, title: { vi: 'Nền nghỉ giữa xu hướng tăng', en: 'Pause inside an uptrend' } },
  REACCUM_C: { eyebrow: { vi: 'Tái tích lũy · Phase C', en: 'Re-accumulation · Phase C' }, title: { vi: 'Spring trong xu hướng tăng', en: 'Spring inside an uptrend' } },
  REACCUM_D: { eyebrow: { vi: 'Tái tích lũy · Phase D', en: 'Re-accumulation · Phase D' }, title: { vi: 'SOS / LPS trong xu hướng tăng', en: 'SOS / LPS inside an uptrend' } },
  MARKUP: { eyebrow: { vi: 'Markup', en: 'Markup' }, title: { vi: 'Xu hướng tăng', en: 'Uptrend' } },
  MARKUP_EXTENDED: { eyebrow: { vi: 'Markup', en: 'Markup' }, title: { vi: 'Đã chạy xa khỏi nền', en: 'Extended from the base' } },
  MARKUP_FAILING: { eyebrow: { vi: 'Markup', en: 'Markup' }, title: { vi: 'Đang suy yếu (dấu hiệu phân phối)', en: 'Weakening (signs of distribution)' } },
  DIST_B: { eyebrow: { vi: 'Phân phối · Phase B', en: 'Distribution · Phase B' }, title: { vi: 'Đi ngang ở vùng đỉnh', en: 'Sideways near the top' } },
  DIST_C: { eyebrow: { vi: 'Phân phối · Phase C', en: 'Distribution · Phase C' }, title: { vi: 'UTAD / thử đỉnh thất bại', en: 'UTAD / failed test of the top' } },
  DIST_D: { eyebrow: { vi: 'Phân phối · Phase D', en: 'Distribution · Phase D' }, title: { vi: 'SOW / LPSY — sắp giảm', en: 'SOW / LPSY — decline imminent' } },
};

export const SUB_STAGE_TEXT: Record<StageSub, T> = {
  CONFIRMED: { vi: 'Đã xác nhận 8/8 Trend Template', en: 'Confirmed: 8/8 Trend Template' },
  QUALIFYING: { vi: 'Đang trong xu hướng tăng, chưa đủ 8/8', en: 'In an uptrend, not yet 8/8' },
  EARLY: { vi: 'Sớm: đã vượt MA150, chưa vượt MA200', en: 'Early: above MA150, not yet above MA200' },
  PULLBACK: { vi: 'Nhịp chỉnh nông trong xu hướng tăng', en: 'Shallow pullback inside an uptrend' },
  BASING: { vi: 'Đáy nền: MA150 đi ngang sau nhịp giảm', en: 'Base: MA150 flat after a decline' },
  LATE_BASE: { vi: 'Nền cuối: MA150 vừa quay lên', en: 'Late base: MA150 just turned up' },
  TOPPING: { vi: 'Vùng đỉnh: MA150 đi ngang / quay xuống sau nhịp tăng', en: 'Topping: MA150 flat / turning down after an advance' },
  BREAKDOWN: { vi: 'Gãy: giá thủng MA150 đang dốc lên', en: 'Breakdown: price lost a rising MA150' },
  DECLINING: { vi: 'Giảm giá: giá dưới MA150 đang dốc xuống', en: 'Declining: price below a falling MA150' },
  BEAR_RALLY: { vi: 'Nhịp hồi trong xu hướng giảm', en: 'Bear-market rally' },
  INSUFFICIENT: { vi: 'Chưa đủ dữ liệu (< 200 phiên)', en: 'Not enough data (< 200 sessions)' },
};

const fmtK = (v: number | undefined) => (v === undefined ? '' : v >= 100 ? v.toFixed(1) : v.toFixed(2));
const pctS = (v: number | undefined) => (v === undefined ? '' : `${v > 0 ? '+' : ''}${v}%`);

/** Câu mô tả một điều kiện kích hoạt; `labelOf` trả tên tiêu chí Trend Template theo mã */
export function triggerText(tr: Trigger, lang: Lang, labelOf: (id: number) => string): string {
  const vi = lang === 'vi';
  switch (tr.code) {
    case 'CLOSE_ABOVE_MA150': return vi ? `Đóng cửa trên MA150 (${fmtK(tr.value)}, ${pctS(tr.pct)} so với giá)` : `Close above the MA150 (${fmtK(tr.value)}, ${pctS(tr.pct)} from price)`;
    case 'CLOSE_ABOVE_MA200': return vi ? `Đóng cửa trên MA200 (${fmtK(tr.value)}, ${pctS(tr.pct)} so với giá)` : `Close above the MA200 (${fmtK(tr.value)}, ${pctS(tr.pct)} from price)`;
    case 'MA150_TURNS_UP': return vi ? `MA150 chuyển từ đi ngang/dốc xuống sang dốc lên (hiện ${pctS(tr.value)} trong 30 phiên)` : `MA150 turns from flat/falling to rising (now ${pctS(tr.value)} over 30 sessions)`;
    case 'TT_CRITERIA_MISSING': {
      const names = (tr.ids || []).map(labelOf).join('; ');
      return vi ? `Đạt đủ 8/8 Trend Template (hiện ${tr.extra}/8) — còn thiếu: ${names}` : `Reach 8/8 on the Trend Template (now ${tr.extra}/8) — missing: ${names}`;
    }
    case 'RS_ABOVE_70': return vi ? `RS Rating lên ≥ 70 (hiện ${tr.value})` : `RS Rating rises to ≥ 70 (now ${tr.value})`;
    case 'PULLBACK_TO_MA20_50': return vi ? `Chờ nhịp chỉnh về vùng MA20–MA50 (MA50 ≈ ${fmtK(tr.value)}) rồi mới xét lại` : `Wait for a pullback toward the MA20–MA50 zone (MA50 ≈ ${fmtK(tr.value)}) before reconsidering`;
    case 'BREAK_PIVOT_WITH_VOLUME': return vi ? `Vượt pivot ${fmtK(tr.value)} (${pctS(tr.pct)}) với khối lượng ≥ ${tr.extra}× trung bình, hoặc LPS giữ vững MA20/MA50` : `Break the pivot ${fmtK(tr.value)} (${pctS(tr.pct)}) on volume ≥ ${tr.extra}× average, or an LPS that holds the MA20/MA50`;
    case 'DISTRIBUTION_CLEARS': return vi ? `${tr.extra} phiên liên tiếp không có thêm nến SOW / Upthrust` : `${tr.extra} sessions in a row without new SOW / upthrust bars`;
    case 'MARKET_RECOVERS': return vi ? 'VN-Index lấy lại MA50 và MA200 (khi đó dùng quy mô đầy đủ)' : 'VN-Index regains its MA50 and MA200 (then use full size)';
    case 'CLOSE_BELOW_MA20': return vi ? `Đóng cửa dưới MA20 (${fmtK(tr.value)}, ${pctS(tr.pct)}) — mức chặn lãi gần nhất` : `Close below the MA20 (${fmtK(tr.value)}, ${pctS(tr.pct)}) — nearest trailing level`;
    case 'CLOSE_BELOW_MA50': return vi ? `Đóng cửa dưới MA50 (${fmtK(tr.value)}, ${pctS(tr.pct)})` : `Close below the MA50 (${fmtK(tr.value)}, ${pctS(tr.pct)})`;
    case 'CLOSE_BELOW_MA150': return vi ? `Đóng cửa dưới MA150 (${fmtK(tr.value)}, ${pctS(tr.pct)})` : `Close below the MA150 (${fmtK(tr.value)}, ${pctS(tr.pct)})`;
    case 'BREAK_BASE_LOW': return vi ? `Thủng đáy nền ${fmtK(tr.value)} (${pctS(tr.pct)})` : `Break the base low ${fmtK(tr.value)} (${pctS(tr.pct)})`;
    case 'SOW_APPEARS': return vi ? 'Xuất hiện nến SOW (giảm ≥ 2%, khối lượng lớn, đóng cửa nửa dưới)' : 'An SOW bar appears (down ≥ 2%, heavy volume, closes in the lower half)';
    case 'UPTHRUST_APPEARS': return vi ? 'Xuất hiện Upthrust (vượt đỉnh nền rồi bị đẩy xuống)' : 'An upthrust appears (pokes above the range top, then is rejected)';
    default: return tr.code;
  }
}

export const t2 = pick;

/* ───────────── Bản NGẮN cho giao diện thân thiện (tab Chiến lược) ───────────── */

export const SHORT_HEADLINE: Record<string, T> = {
  BUY_ALIGNED: { vi: 'Có thể mua', en: 'OK to buy' },
  WAIT_PIVOT: { vi: 'Chờ điểm vào', en: 'Wait for the entry' },
  WAIT_NO_CHASE: { vi: 'Đã chạy xa, đợi nhịp chỉnh', en: 'Extended — wait for a pullback' },
  WAIT_STAGE_CONFIRM: { vi: 'Chờ xu hướng xác nhận', en: 'Wait for the trend to confirm' },
  WAIT_BASE_FORMING: { vi: 'Chờ nền hình thành', en: 'Wait for a base to form' },
  AVOID_WYCKOFF_WARNS: { vi: 'Không mua — có dấu hiệu xả hàng', en: 'Do not buy — distribution signs' },
  AVOID_DISTRIBUTION: { vi: 'Không mua — vùng đỉnh', en: 'Do not buy — near a top' },
  AVOID_MARKDOWN: { vi: 'Không mua — đang giảm giá', en: 'Do not buy — in a downtrend' },
};

export const SHORT_ALIGN: Record<Alignment, T> = {
  ALIGNED_BULLISH: { vi: 'Hai khung đồng thuận', en: 'Both agree' },
  ALIGNED_BEARISH: { vi: 'Hai khung đồng thuận (xấu)', en: 'Both agree (bearish)' },
  TIMING_PENDING: { vi: 'Xu hướng tốt, chưa tới điểm vào', en: 'Trend good, entry not yet' },
  WYCKOFF_LEADS: { vi: 'Lệch: Wyckoff báo sớm hơn', en: 'Mismatch: Wyckoff is early' },
  WYCKOFF_WARNS: { vi: 'Lệch: Wyckoff cảnh báo trước', en: 'Mismatch: Wyckoff warns first' },
  NEUTRAL_WAIT: { vi: 'Chưa rõ', en: 'Unclear' },
};

export const SHORT_PHASE: Record<CyclePhase, T> = {
  MARKDOWN: { vi: 'Đang giảm giá, chưa có nền', en: 'Falling, no base yet' },
  ACCUM_A: { vi: 'Vừa hãm đà giảm', en: 'Decline just stopped' },
  ACCUM_B: { vi: 'Đang xây nền', en: 'Building a base' },
  ACCUM_C: { vi: 'Thử cung (Spring) — chưa phải điểm mua', en: 'Spring test — not a buy point' },
  ACCUM_D: { vi: 'Lực cầu quay lại (SOS/LPS)', en: 'Demand returning (SOS/LPS)' },
  ACCUM_E: { vi: 'Vừa vượt nền', en: 'Just broke out of the base' },
  REACCUM_B: { vi: 'Nghỉ giữa xu hướng tăng', en: 'Resting inside an uptrend' },
  REACCUM_C: { vi: 'Thử cung trong xu hướng tăng', en: 'Supply test in an uptrend' },
  REACCUM_D: { vi: 'Nhịp chỉnh có lực cầu (LPS)', en: 'Pullback with demand (LPS)' },
  MARKUP: { vi: 'Đang tăng', en: 'Trending up' },
  MARKUP_EXTENDED: { vi: 'Đã chạy xa khỏi nền', en: 'Extended from the base' },
  MARKUP_FAILING: { vi: 'Còn tăng nhưng yếu dần', en: 'Still up but weakening' },
  DIST_B: { vi: 'Đi ngang ở vùng đỉnh', en: 'Sideways near a top' },
  DIST_C: { vi: 'Vùng đỉnh, thử đỉnh thất bại', en: 'Near a top, failed test' },
  DIST_D: { vi: 'Vùng đỉnh, bán mạnh', en: 'Near a top, heavy selling' },
};

export const SHORT_TT_NAME: Record<number, T> = {
  1: { vi: 'giá trên MA150 & MA200', en: 'price above MA150 & MA200' },
  2: { vi: 'MA150 trên MA200', en: 'MA150 above MA200' },
  3: { vi: 'MA200 dốc lên', en: 'MA200 rising' },
  4: { vi: 'MA50 trên MA150 & MA200', en: 'MA50 above MA150 & MA200' },
  5: { vi: 'giá trên MA50', en: 'price above MA50' },
  6: { vi: 'cao hơn đáy 52 tuần ≥ 30%', en: '≥ 30% above 52-week low' },
  7: { vi: 'gần đỉnh 52 tuần', en: 'near the 52-week high' },
  8: { vi: 'RS ≥ 70', en: 'RS ≥ 70' },
};

export function shortTrigger(tr: Trigger, lang: Lang): string {
  const vi = lang === 'vi';
  switch (tr.code) {
    case 'CLOSE_ABOVE_MA150': return vi ? `Giá vượt MA150 (${fmtK(tr.value)})` : `Price closes above MA150 (${fmtK(tr.value)})`;
    case 'CLOSE_ABOVE_MA200': return vi ? `Giá vượt MA200 (${fmtK(tr.value)})` : `Price closes above MA200 (${fmtK(tr.value)})`;
    case 'MA150_TURNS_UP': return vi ? 'MA150 quay lên' : 'MA150 turns up';
    case 'TT_CRITERIA_MISSING': return vi ? `Đủ 8/8 tiêu chí (đang ${tr.extra}/8)` : `Reach 8/8 criteria (now ${tr.extra}/8)`;
    case 'RS_ABOVE_70': return vi ? `RS lên ≥ 70 (đang ${tr.value})` : `RS rises to ≥ 70 (now ${tr.value})`;
    case 'PULLBACK_TO_MA20_50': return vi ? 'Đợi nhịp chỉnh về MA20–MA50' : 'Wait for a pullback to MA20–MA50';
    case 'BREAK_PIVOT_WITH_VOLUME': return vi ? `Vượt ${fmtK(tr.value)} kèm khối lượng lớn` : `Break ${fmtK(tr.value)} on heavy volume`;
    case 'DISTRIBUTION_CLEARS': return vi ? 'Hết dấu hiệu xả hàng' : 'Distribution signs fade';
    case 'MARKET_RECOVERS': return vi ? 'VN-Index trên MA50 & MA200' : 'VN-Index above MA50 & MA200';
    case 'CLOSE_BELOW_MA20': return vi ? `Đóng cửa dưới MA20 (${fmtK(tr.value)})` : `Close below MA20 (${fmtK(tr.value)})`;
    case 'CLOSE_BELOW_MA50': return vi ? `Đóng cửa dưới MA50 (${fmtK(tr.value)})` : `Close below MA50 (${fmtK(tr.value)})`;
    case 'CLOSE_BELOW_MA150': return vi ? `Đóng cửa dưới MA150 (${fmtK(tr.value)})` : `Close below MA150 (${fmtK(tr.value)})`;
    case 'BREAK_BASE_LOW': return vi ? `Thủng đáy nền (${fmtK(tr.value)})` : `Break the base low (${fmtK(tr.value)})`;
    case 'SOW_APPEARS': return vi ? 'Xuất hiện nến bán mạnh (SOW)' : 'A heavy-selling bar (SOW) appears';
    case 'UPTHRUST_APPEARS': return vi ? 'Xuất hiện Upthrust' : 'An upthrust appears';
    default: return tr.code;
  }
}

/* ───────────── Yếu tố chất lượng: doanh nghiệp & ngành ───────────── */
import type { FundState } from '../utils/fundamentalsEngine';
import type { SectorTone } from '../utils/sectorStrength';

export const FUND_STATE_TEXT: Record<FundState, T> = {
  STRONG: { vi: 'Tăng trưởng mạnh', en: 'Strong growth' },
  OK: { vi: 'Ổn định', en: 'Stable' },
  WEAK: { vi: 'Yếu', en: 'Weak' },
  NO_DATA: { vi: 'Chưa có dữ liệu', en: 'No data' },
};

export const SECTOR_TONE_TEXT: Record<SectorTone, T> = {
  TAILWIND: { vi: 'Thuận gió', en: 'Tailwind' },
  NEUTRAL: { vi: 'Trung tính', en: 'Neutral' },
  HEADWIND: { vi: 'Ngược gió', en: 'Headwind' },
  UNKNOWN: { vi: 'Chưa xác định', en: 'Unknown' },
};

export const QUALITY_FLAG_TEXT: Record<string, T> = {
  FUND_LOSS_MAKING: { vi: 'Doanh nghiệp đang lỗ — kiểm tra kỹ trước khi mua.', en: 'The company is loss-making — check carefully before buying.' },
  FUND_PROFIT_FALLING: { vi: 'Lợi nhuận đang giảm so cùng kỳ — kiểm tra kỹ trước khi mua.', en: 'Profit is falling year over year — check carefully before buying.' },
  SECTOR_HEADWIND: { vi: 'Ngành đang yếu hơn thị trường (ngược gió).', en: 'The sector is lagging the market (headwind).' },
};

/** Tăng trưởng quá lớn do nền thấp thì hiển thị ">300%" thay vì con số vô nghĩa */
export const fmtGrowth = (v: number | null | undefined, lang: Lang): string => {
  if (v === null || v === undefined) return '—';
  if (v > 300) return lang === 'vi' ? '>300% (nền thấp)' : '>300% (low base)';
  return `${v > 0 ? '+' : ''}${v}%`;
};
