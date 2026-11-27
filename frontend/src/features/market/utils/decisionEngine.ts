/**
 * Quyết định hợp nhất Minervini (Stage / Trend Template) + Wyckoff — module thuần.
 *
 * NGUYÊN TẮC (đây là câu trả lời cho "hai khung lệch nhau thì nghe ai"):
 *
 *  1) Hai khung nhìn cùng một chu kỳ ở hai độ phân giải khác nhau. Stage (dựa trên MA) là chỉ báo TRỄ nhưng bền;
 *     Wyckoff (dựa trên giá & khối lượng) là chỉ báo SỚM nhưng nhiễu hơn. Khi lệch nhau, thường là một bên đi trước
 *     chứ không phải hai bên nói ngược hẳn.
 *
 *  2) MUA cần CẢ HAI đồng thuận (phép VÀ):
 *       • Stage 2 đủ 8/8 Trend Template  → "được phép" có vị thế mua (cổng xu hướng)
 *       • Wyckoff ở Phase D/E sau khi đã đặt vào bối cảnh, không có dấu hiệu phân phối → "đúng thời điểm"
 *     Thiếu một trong hai ⇒ CHỜ. Wyckoff báo sớm (Stage chưa xác nhận) ⇒ chờ Stage; Stage tốt nhưng Wyckoff chưa tới điểm ⇒ chờ pivot.
 *
 *  3) GIẢM / THOÁT chỉ cần MỘT trong hai cảnh báo (phép HOẶC): bảo toàn vốn quan trọng hơn bắt đủ sóng.
 *     Wyckoff thường lộ phân phối trước khi MA kịp quay đầu; Stage hỏng thì cấu trúc xu hướng đã gãy dù Wyckoff còn "đẹp".
 *
 *  4) Thị trường Bất lợi (utils/marketState.ts) chặn mở vị thế mới: điểm mua thành CHỜ THỊ TRƯỜNG.
 *     Dấu hiệu phân phối nhẹ không đổi hướng quyết định, chỉ giảm quy mô vị thế (HALF).
 *     Bộ lọc cổ phiếu hiển thị đúng quyết định này (utils/screenerDecision.ts), không có quy tắc mua riêng.
 */
import type { StageResult } from './stageEngine';
import type { CycleContext } from './wyckoffContext';

export type Alignment =
  | 'ALIGNED_BULLISH' // Stage 2 đủ chuẩn + Wyckoff tới điểm vào
  | 'ALIGNED_BEARISH' // Stage 3/4 (hoặc Stage 2 chưa đủ) + Wyckoff cũng xấu
  | 'TIMING_PENDING' // Stage 2 đủ chuẩn nhưng Wyckoff chưa tới điểm vào
  | 'WYCKOFF_LEADS' // Wyckoff báo tốt trước, Stage chưa xác nhận
  | 'WYCKOFF_WARNS' // Stage còn tốt nhưng Wyckoff đã báo phân phối
  | 'NEUTRAL_WAIT'; // cả hai chưa rõ

export type EntryAction = 'BUY' | 'WAIT' | 'AVOID';
export type HolderAction = 'HOLD' | 'HOLD_TIGHTEN' | 'HOLD_NO_ADD' | 'REDUCE' | 'EXIT';

export interface Trigger {
  code: string;
  value?: number;
  pct?: number;
  extra?: number;
  ids?: number[];
}

export interface Decision {
  alignment: Alignment;
  /** Mã tóm tắt dùng để chọn câu tiêu đề trên giao diện */
  headline: string;
  newBuyer: { action: EntryAction; size: 'FULL' | 'HALF' | 'NONE'; reasons: string[] };
  holder: { action: HolderAction; reasons: string[] };
  /** Mỗi khung đang ở trạng thái nào: OK = đồng ý mua · NOT_YET = chưa tới · BAD = chặn / cảnh báo */
  drivers: { stage: 'OK' | 'NOT_YET' | 'BAD'; wyckoff: 'OK' | 'NOT_YET' | 'WARN' };
  /** Mua cần thiếu gì: 'STAGE' | 'WYCKOFF' (rỗng nếu đủ) */
  missingForBuy: Array<'STAGE' | 'WYCKOFF'>;
  /** Cảnh báo giảm/thoát đang đến từ khung nào (phép HOẶC) */
  exitSignalFrom: Array<'STAGE' | 'WYCKOFF'>;
  triggersUp: Trigger[];
  triggersDown: Trigger[];
  /** Ghi chú bổ sung về quy mô vị thế */
  sizeNotes: string[];
}

export interface DecisionInput {
  stage: StageResult;
  ttPassed: number;
  ttFailedIds: number[];
  ctx: CycleContext;
  rsRating: number;
  price: number;
  ma20?: number;
  ma50: number;
  ma150: number;
  ma200: number;
  /** Kháng cự gần nhất (đỉnh nền 20 phiên) — dùng làm pivot */
  pivot: number;
  /** Đáy nền để đặt cắt lỗ (nếu có) */
  baseLow: number | null;
  distFromSMA20Pct: number;
  /** false = trạng thái thị trường Bất lợi → không mở vị thế mới; true/null = được mua (utils/marketState.ts) */
  marketUp: boolean | null;
}

export function buildDecision(inp: DecisionInput): Decision {
  const { stage, ctx, ttPassed, ttFailedIds, rsRating, price, ma20, ma50, ma150, ma200, pivot, baseLow, marketUp } = inp;
  const dist = ctx.distribution;
  const stageOk = stage.stage === 2 && stage.confirmed;

  const stageDriver: 'OK' | 'NOT_YET' | 'BAD' = stageOk ? 'OK' : stage.stage === 3 || stage.stage === 4 ? 'BAD' : 'NOT_YET';
  const wyDriver: 'OK' | 'NOT_YET' | 'WARN' = ctx.bias === 'BULLISH_TIMING' ? 'OK' : ctx.bias === 'BEARISH' ? 'WARN' : 'NOT_YET';
  const extended = ctx.phase === 'MARKUP_EXTENDED';
  const caution = dist.score >= 2; // dữ liệu: Stage 2 có ≥2 dấu hiệu phân phối có lợi suất tương lai thấp hơn rõ rệt

  /* ── Quyết định cho người CHƯA có vị thế ── */
  let entry: EntryAction;
  let size: 'FULL' | 'HALF' | 'NONE' = 'NONE';
  const entryReasons: string[] = [];
  let headline: string;

  if (stageDriver === 'BAD') {
    entry = 'AVOID';
    headline = stage.stage === 4 ? 'AVOID_MARKDOWN' : 'AVOID_DISTRIBUTION';
    entryReasons.push(stage.stage === 4 ? 'STAGE4_BLOCK' : 'STAGE3_BLOCK');
    if (ctx.earlyBasing) entryReasons.push('WYCKOFF_EARLY_BASE');
    if (ctx.resumptionAttempt) entryReasons.push('WYCKOFF_RESUMPTION_ATTEMPT');
  } else if (stageDriver === 'NOT_YET') {
    if (wyDriver === 'WARN') {
      entry = 'AVOID';
      headline = 'AVOID_WYCKOFF_WARNS';
      entryReasons.push('STAGE_NOT_CONFIRMED', 'WYCKOFF_DISTRIBUTION');
    } else {
      entry = 'WAIT';
      headline = wyDriver === 'OK' ? 'WAIT_STAGE_CONFIRM' : 'WAIT_BASE_FORMING';
      entryReasons.push(stage.stage === 1 ? 'STAGE1_BASING' : 'STAGE2_NOT_CONFIRMED');
      if (wyDriver === 'OK') entryReasons.push('WYCKOFF_READY_EARLY');
    }
  } else {
    // Stage 2 đủ chuẩn
    if (wyDriver === 'WARN') {
      entry = 'AVOID';
      headline = 'AVOID_WYCKOFF_WARNS';
      entryReasons.push('STAGE_OK', 'WYCKOFF_DISTRIBUTION');
    } else if (extended) {
      entry = 'WAIT';
      headline = 'WAIT_NO_CHASE';
      entryReasons.push('STAGE_OK', 'EXTENDED_NO_CHASE');
    } else if (wyDriver === 'OK') {
      entryReasons.push('STAGE_OK', 'WYCKOFF_TIMING_OK');
      if (marketUp === false) {
        // Thị trường Bất lợi: không mở vị thế mới (utils/marketState.ts)
        entry = 'WAIT';
        headline = 'WAIT_MARKET';
      } else {
        entry = 'BUY';
        headline = 'BUY_ALIGNED';
        size = caution ? 'HALF' : 'FULL';
      }
    } else {
      entry = 'WAIT';
      headline = 'WAIT_PIVOT';
      entryReasons.push('STAGE_OK', 'WYCKOFF_TIMING_PENDING');
    }
  }

  const sizeNotes: string[] = [];
  if (entry === 'BUY') {
    if (caution) sizeNotes.push('DISTRIBUTION_CAUTION_HALF');
  }

  /* ── Quyết định cho người ĐANG CÓ vị thế (phép HOẶC: một khung báo xấu là đủ) ── */
  const exitFrom: Array<'STAGE' | 'WYCKOFF'> = [];
  let holder: HolderAction;
  const holderReasons: string[] = [];
  if (stage.stage === 4) {
    holder = 'EXIT';
    exitFrom.push('STAGE');
    holderReasons.push('STAGE4_EXIT');
  } else if (stage.stage === 3) {
    exitFrom.push('STAGE');
    if (dist.score >= 3) {
      holder = 'EXIT';
      exitFrom.push('WYCKOFF');
      holderReasons.push('STAGE3_WITH_DISTRIBUTION');
    } else {
      holder = 'REDUCE';
      holderReasons.push('STAGE3_REDUCE');
    }
  } else if (stage.stage === 1) {
    holder = dist.score >= 3 ? 'REDUCE' : 'HOLD_NO_ADD';
    if (dist.score >= 3) exitFrom.push('WYCKOFF');
    holderReasons.push(dist.score >= 3 ? 'BASE_WITH_DISTRIBUTION' : 'STAGE1_NO_ADD');
  } else {
    // Stage 2
    if (wyDriver === 'WARN') {
      holder = 'REDUCE';
      exitFrom.push('WYCKOFF');
      holderReasons.push('WYCKOFF_WARNS_TRIM');
    } else if (!stageOk || caution) {
      holder = 'HOLD_TIGHTEN';
      holderReasons.push(!stageOk ? 'STAGE2_NOT_CONFIRMED_TIGHTEN' : 'DISTRIBUTION_CAUTION_TIGHTEN');
    } else {
      holder = 'HOLD';
      holderReasons.push('TREND_INTACT_HOLD');
    }
  }

  /* ── Alignment ── */
  let alignment: Alignment;
  if (stageDriver === 'OK' && wyDriver === 'OK') alignment = 'ALIGNED_BULLISH';
  else if (stageDriver === 'OK' && wyDriver === 'WARN') alignment = 'WYCKOFF_WARNS';
  else if (stageDriver === 'OK') alignment = 'TIMING_PENDING';
  // Stage 2 (kể cả chưa đủ 8/8) mà Wyckoff đã báo phân phối: Wyckoff cảnh báo trước khi MA kịp đổi
  else if (stage.stage === 2 && wyDriver === 'WARN') alignment = 'WYCKOFF_WARNS';
  else if (wyDriver === 'OK' || ctx.earlyBasing || ctx.resumptionAttempt) alignment = 'WYCKOFF_LEADS';
  else if (stageDriver === 'BAD' || wyDriver === 'WARN') alignment = 'ALIGNED_BEARISH';
  else alignment = 'NEUTRAL_WAIT';

  const missingForBuy: Array<'STAGE' | 'WYCKOFF'> = [];
  if (!stageOk) missingForBuy.push('STAGE');
  if (wyDriver !== 'OK' || extended) missingForBuy.push('WYCKOFF');

  /* ── Điều kiện để nâng cấp / hạ cấp ── */
  const up: Trigger[] = [];
  const down: Trigger[] = [];
  const pctTo = (lvl: number) => (price > 0 ? Number((((lvl - price) / price) * 100).toFixed(1)) : 0);

  if (!stageOk) {
    if (price <= ma150) up.push({ code: 'CLOSE_ABOVE_MA150', value: ma150, pct: pctTo(ma150) });
    if (price <= ma200) up.push({ code: 'CLOSE_ABOVE_MA200', value: ma200, pct: pctTo(ma200) });
    if (stage.evidence && stage.evidence.slope150Pct <= 1.5) up.push({ code: 'MA150_TURNS_UP', value: stage.evidence.slope150Pct });
    if (ttFailedIds.length) up.push({ code: 'TT_CRITERIA_MISSING', ids: ttFailedIds, extra: ttPassed });
    if (rsRating < 70 && !ttFailedIds.includes(8)) up.push({ code: 'RS_ABOVE_70', value: rsRating });
  }
  if (stageDriver !== 'BAD' && (wyDriver !== 'OK' || extended)) {
    if (extended) up.push({ code: 'PULLBACK_TO_MA20_50', value: ma50 });
    else if (pivot > 0) up.push({ code: 'BREAK_PIVOT_WITH_VOLUME', value: pivot, pct: pctTo(pivot), extra: 1.4 });
  }
  if (wyDriver === 'WARN' || caution) up.push({ code: 'DISTRIBUTION_CLEARS', extra: 10 });
  if (marketUp === false && entry !== 'AVOID') up.push({ code: 'MARKET_RECOVERS' });

  // Mức giá làm điểm hạ cấp / thoát: chỉ giữ các mức GẦN giá (trong 20%), vì một đường MA nằm cách giá 40% (cổ phiếu đã chạy xa)
  // không dùng được làm điểm cắt lỗ thực tế. Nếu tất cả đều xa thì giữ mức gần nhất (thường là MA20).
  const levels: Trigger[] = [];
  if (ma20 && ma20 > 0 && price > ma20) levels.push({ code: 'CLOSE_BELOW_MA20', value: ma20, pct: pctTo(ma20) });
  if (price > ma50 && ma50 > 0) levels.push({ code: 'CLOSE_BELOW_MA50', value: ma50, pct: pctTo(ma50) });
  if (price > ma150 && ma150 > 0) levels.push({ code: 'CLOSE_BELOW_MA150', value: ma150, pct: pctTo(ma150) });
  if (baseLow && baseLow > 0 && price > baseLow) levels.push({ code: 'BREAK_BASE_LOW', value: baseLow, pct: pctTo(baseLow) });
  levels.sort((x, y) => (y.pct ?? -999) - (x.pct ?? -999)); // gần giá nhất trước
  const near = levels.filter((l) => (l.pct ?? -999) >= -20);
  down.push(...(near.length ? near : levels.slice(0, 1)).slice(0, 3));
  if (!dist.flags.sow) down.push({ code: 'SOW_APPEARS' });
  if (!dist.flags.upthrust && stage.stage === 2) down.push({ code: 'UPTHRUST_APPEARS' });

  return {
    alignment,
    headline,
    newBuyer: { action: entry, size, reasons: entryReasons },
    holder: { action: holder, reasons: holderReasons },
    drivers: { stage: stageDriver, wyckoff: wyDriver },
    missingForBuy,
    exitSignalFrom: exitFrom,
    triggersUp: up,
    triggersDown: down,
    sizeNotes,
  };
}
