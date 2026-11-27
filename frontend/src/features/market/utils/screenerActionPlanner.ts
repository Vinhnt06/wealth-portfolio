import { MinerviniScreenerItem } from '../types/minervini.types';
import { MARKET_STATE_EVIDENCE, MarketStateKey } from './marketState';

export type ScreenerPositionSignal =
  | 'SCALE_UP'
  | 'BUY_NEW'
  | 'HOLD_WAIT'
  | 'EXTENDED'
  | 'CAUTION_DIST'
  | 'WATCH_NEAR'
  | 'AVOID';

export interface ScreenerActionPlan {
  signal: ScreenerPositionSignal;
  badgeLabel: string;
  shortBadge: string;
  basePct: number;
  effectivePct: number;
  targetTotalPct: number;
  actionZoneLabel: string;
  nextScaleUpLabel: string;
  isReadyToScaleUpSoon: boolean;
  distFromSma20Pct: number | null;
  distFromSma50Pct: number | null;
  distToPivotPct: number | null;
  pivotVnd: number | null;
  stopLossVnd: number | null;
  stopLossPct: number | null;
  target1Vnd: number | null;
  riskReward: number | null;
  minScaleUpVol: number | null;
  reason: string;
  priorityScore: number;
}

/** Làm tròn mức giá VND theo bước giá hợp lý trên bảng điện VN */
export function roundVnPrice(priceK: number): number {
  if (!priceK || priceK <= 0) return 0;
  const rawVnd = priceK * 1000;
  if (rawVnd >= 50_000) return Math.round(rawVnd / 100) * 100;
  if (rawVnd >= 10_000) return Math.round(rawVnd / 50) * 50;
  return Math.round(rawVnd / 10) * 10;
}

export function formatCompactVol(vol: number | null | undefined): string {
  if (!vol || vol <= 0) return '--';
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (vol >= 1_000) return `${Math.round(vol / 1_000)}K`;
  return String(Math.round(vol));
}

/** Tính tỷ lệ tiến độ thời gian phiên giao dịch VN (0.15 -> 1.0) để không báo nhầm "Cạn cung" giữa phiên */
function getVnSessionProgress(nowMs = Date.now()): { isTradingHours: boolean; elapsedRatio: number } {
  const vnDate = new Date(nowMs + 7 * 3600_000);
  const day = vnDate.getUTCDay();
  if (day === 0 || day === 6) return { isTradingHours: false, elapsedRatio: 1 };
  const mins = vnDate.getUTCHours() * 60 + vnDate.getUTCMinutes();
  // Trước 9:00 hoặc sau 14:45 -> phiên đã chốt hoặc dùng dữ liệu phiên trước
  if (mins < 9 * 60 || mins >= 14 * 60 + 45) {
    return { isTradingHours: false, elapsedRatio: 1 };
  }
  // Tổng thời gian khớp lệnh liên tục + định kỳ: Sáng 150p (9:00-11:30) + Chiều 105p (13:00-14:45) = 255p
  let elapsed = 0;
  if (mins <= 11 * 60 + 30) {
    elapsed = mins - 9 * 60;
  } else if (mins < 13 * 60) {
    elapsed = 150;
  } else {
    elapsed = 150 + (mins - 13 * 60);
  }
  return {
    isTradingHours: true,
    elapsedRatio: Math.max(0.15, Math.min(1, elapsed / 255)),
  };
}

/**
 * Tái tính tín hiệu khối lượng trực tiếp khi có tick khớp lệnh mới trong phiên
 */
export function recomputeLiveVolMetrics(params: {
  priceK: number;
  changePct: number;
  volume: number;
  avgVol20?: number;
  maxDownVol10?: number;
  sma50?: number;
  fallbackRelVol?: number;
  fallbackSignal?: MinerviniScreenerItem['volSignal'];
}): { relVol: number; volSignal: NonNullable<MinerviniScreenerItem['volSignal']> } {
  const {
    priceK,
    changePct,
    volume,
    avgVol20 = 0,
    maxDownVol10 = 0,
    sma50 = 0,
    fallbackRelVol = 1,
    fallbackSignal = 'NORMAL',
  } = params;

  const relVol = avgVol20 > 0 && volume > 0 ? Math.round((volume / avgVol20) * 100) / 100 : fallbackRelVol;

  if (avgVol20 <= 0) {
    return { relVol, volSignal: fallbackSignal };
  }

  const { isTradingHours, elapsedRatio } = getVnSessionProgress();
  // Chuẩn hóa relVol theo tiến độ phiên chỉ để kiểm tra VCP_DRYUP (tránh 10h sáng mới khớp 0.2x đã báo Cạn cung)
  const paceAdjustedRelVol = isTradingHours ? relVol / elapsedRatio : relVol;
  const canConfirmDryUp = !isTradingHours || elapsedRatio >= 0.75;

  const volSignal: NonNullable<MinerviniScreenerItem['volSignal']> =
    relVol >= 1.5 && changePct >= 2.0
      ? 'BREAKOUT'
      : changePct > 0.5 && maxDownVol10 > 0 && volume > maxDownVol10 && relVol >= 1.05
      ? 'POCKET_PIVOT'
      : canConfirmDryUp && paceAdjustedRelVol <= 0.65 && Math.abs(changePct) <= 1.5 && sma50 > 0 && priceK > sma50
      ? 'VCP_DRYUP'
      : relVol >= 1.4 && changePct <= -2.0
      ? 'DISTRIBUTION'
      : 'NORMAL';

  return { relVol, volSignal };
}

/**
 * Bộ phân loại vị thế chuẩn Kim Tự Tháp Mark Minervini (SEPA) cho toàn bộ cổ phiếu trong Bộ lọc:
 * - BUY_NEW (Lần 1 - 30%): Đạt 8/8 Stage 2, tích lũy chặt / kéo ngược an toàn quanh MA20 [-3.0%, +4.0%], chưa quá nóng, không phân phối.
 * - SCALE_UP (Lần 2 - +40% -> 70%): Đạt 8/8 Stage 2, bùng nổ vượt kháng cự Pivot 20P kèm Vol lớn hoặc kích hoạt Pocket Pivot / tiếp diễn đà tăng trên nền.
 * - Đồng bộ hệ số giải ngân theo Trạng thái thị trường (FAVORABLE / NEUTRAL / UNFAVORABLE).
 */
export function evaluateScreenerActionPlan(
  item: MinerviniScreenerItem,
  marketState: MarketStateKey = 'NEUTRAL'
): ScreenerActionPlan {
  const priceK = (item.price || 0) / 1000;
  const passed = item.criteriaPassed ?? item.score ?? 0;
  const isStage2 = passed === 8 && priceK > 0;
  const sma20 = item.sma20 && item.sma20 > 0 ? item.sma20 : 0;
  const sma50 = item.sma50 && item.sma50 > 0 ? item.sma50 : 0;
  const pivotK = item.pivot20 && item.pivot20 > 0 ? item.pivot20 : item.high52W && item.high52W > 0 ? item.high52W : 0;
  const swingLowK = item.swingLow15 && item.swingLow15 > 0 ? item.swingLow15 : sma50 > 0 ? sma50 : 0;

  const marketMultiplier = MARKET_STATE_EVIDENCE[marketState]?.buySize ?? 1;

  const distFromSma20Pct =
    sma20 > 0 ? Math.round(((priceK - sma20) / sma20) * 1000) / 10 : null;
  const distFromSma50Pct =
    sma50 > 0 ? Math.round(((priceK - sma50) / sma50) * 1000) / 10 : null;
  const distToPivotPct =
    pivotK > 0 ? Math.round(((priceK - pivotK) / pivotK) * 1000) / 10 : null;

  const pivotVnd = pivotK > 0 ? roundVnPrice(pivotK) : null;
  const minScaleUpVol = item.avgVol20 && item.avgVol20 > 0 ? Math.round(item.avgVol20 * 1.3) : null;
  const udRatio = item.upDownVolRatio ?? 1;

  // Chưa đạt 8/8 Trend Template -> Cấm mở vị thế mua mới / bồi lệnh theo kỷ luật Minervini
  if (!isStage2) {
    const isNearLeader =
      passed === 7 &&
      item.rsRating >= 80 &&
      item.volSignal !== 'DISTRIBUTION' &&
      !(item.changePct <= -2.0 && item.relVol >= 1.3);

    return {
      signal: isNearLeader ? 'WATCH_NEAR' : 'AVOID',
      badgeLabel: isNearLeader ? 'THEO DÕI (7/8)' : 'CHƯA ĐẠT CHUẨN',
      shortBadge: isNearLeader ? '7/8 Chờ xác nhận' : `${passed}/8 Đứng ngoài`,
      basePct: 0,
      effectivePct: 0,
      targetTotalPct: 0,
      actionZoneLabel: isNearLeader
        ? `Chờ đủ 8/8${pivotVnd ? ` · Kháng cự ${pivotVnd.toLocaleString('vi-VN')}` : ''}`
        : 'Đứng ngoài quan sát',
      nextScaleUpLabel: 'Khóa — Chỉ mở khi đạt 8/8 Stage 2',
      isReadyToScaleUpSoon: false,
      distFromSma20Pct,
      distFromSma50Pct,
      distToPivotPct,
      pivotVnd,
      stopLossVnd: null,
      stopLossPct: null,
      target1Vnd: null,
      riskReward: null,
      minScaleUpVol,
      reason: isNearLeader
        ? `Thiếu ${item.failedCriteria?.[0]?.replace(/^\d+\.\s*/, '') || '1 tiêu chí'} · RS ${item.rsRating}`
        : `Chưa vào Stage 2 (${passed}/8 tiêu chí)`,
      priorityScore: isNearLeader ? 300 + item.rsRating : passed * 20 + item.rsRating * 0.5,
    };
  }

  // ── Từ đây trở xuống: ĐẠT TUYỆT ĐỐI 8/8 STAGE 2 UPTREND ──
  // Tính mức cắt lỗ động chuẩn Minervini (tối đa -7% hoặc sát dưới hỗ trợ nền / MA20)
  const maxStopK = priceK * 0.93; // Trần cắt lỗ tối đa -7%
  const structuralStopK =
    swingLowK > 0 && swingLowK < priceK && swingLowK >= maxStopK
      ? swingLowK * 0.99
      : sma20 > 0 && sma20 < priceK && sma20 * 0.975 >= maxStopK
      ? sma20 * 0.975
      : maxStopK;

  const stopLossVnd = roundVnPrice(Math.max(maxStopK, structuralStopK));
  const stopLossPct = Math.round(((stopLossVnd - item.price) / item.price) * 1000) / 10;

  const rawTarget1K = Math.max(priceK * 1.15, pivotK > priceK ? pivotK * 1.1 : priceK * 1.15);
  const target1Vnd = roundVnPrice(rawTarget1K);
  const riskVnd = Math.max(50, item.price - stopLossVnd);
  const riskReward = Math.round(((target1Vnd - item.price) / riskVnd) * 10) / 10;

  const nextScaleTriggerStr = pivotVnd
    ? `Vượt ${pivotVnd.toLocaleString('vi-VN')}${minScaleUpVol ? ` + KL ≥ ${formatCompactVol(minScaleUpVol)}` : ''}`
    : `Nổ Vol ≥ 1.3x TB20`;

  // 1. Kiểm tra dấu hiệu Phân phối ngắn hạn (Bán khối lượng lớn)
  const isDistribution =
    item.volSignal === 'DISTRIBUTION' || (item.changePct <= -2.2 && item.relVol >= 1.35);

  if (isDistribution) {
    return {
      signal: 'CAUTION_DIST',
      badgeLabel: 'CẢNH BÁO BÁN RÁT',
      shortBadge: 'Cảnh báo Vol bán',
      basePct: 0,
      effectivePct: 0,
      targetTotalPct: 0,
      actionZoneLabel: `Không mua · Giữ chặt SL ${stopLossVnd.toLocaleString('vi-VN')}`,
      nextScaleUpLabel: 'Tạm khóa bồi lệnh do áp lực cung lớn',
      isReadyToScaleUpSoon: false,
      distFromSma20Pct,
      distFromSma50Pct,
      distToPivotPct,
      pivotVnd,
      stopLossVnd,
      stopLossPct,
      target1Vnd,
      riskReward,
      minScaleUpVol,
      reason: `Giảm ${item.changePct.toFixed(2)}% kèm KL ${item.relVol.toFixed(2)}x TB20 — Chờ hấp thụ cung`,
      priorityScore: 450 + item.rsRating,
    };
  }

  // 2. Kiểm tra Quá nóng / Extended (Tăng quá xa MA20 / MA50 -> Cấm mua đuổi, chỉ gồng lãi)
  const refDist20 = distFromSma20Pct ?? (distFromSma50Pct !== null ? distFromSma50Pct * 0.55 : 0);
  const isOverextended =
    refDist20 > 8.5 || (distFromSma50Pct !== null && distFromSma50Pct > 18.0);

  if (isOverextended) {
    const trailingStopK = sma20 > 0 && sma20 < priceK ? Math.max(maxStopK, sma20 * 0.985) : maxStopK;
    const trailingStopVnd = roundVnPrice(trailingStopK);
    const trailingPct = Math.round(((trailingStopVnd - item.price) / item.price) * 1000) / 10;

    return {
      signal: 'EXTENDED',
      badgeLabel: 'QUÁ NÓNG (CẤM ĐUỔI)',
      shortBadge: 'Quá nóng · Chỉ giữ',
      basePct: 0,
      effectivePct: 0,
      targetTotalPct: 0,
      actionZoneLabel: `Chờ chỉnh về MA20${sma20 > 0 ? ` (${roundVnPrice(sma20).toLocaleString('vi-VN')})` : ''}`,
      nextScaleUpLabel: `Chỉ gồng lãi · Nâng chặn lãi ${trailingStopVnd.toLocaleString('vi-VN')}`,
      isReadyToScaleUpSoon: false,
      distFromSma20Pct,
      distFromSma50Pct,
      distToPivotPct,
      pivotVnd,
      stopLossVnd: trailingStopVnd,
      stopLossPct: trailingPct,
      target1Vnd,
      riskReward,
      minScaleUpVol,
      reason: `Cách MA20 +${refDist20.toFixed(1)}%${distFromSma50Pct !== null ? ` · MA50 +${distFromSma50Pct.toFixed(1)}%` : ''} — Rủi ro rung lắc ngắn hạn`,
      priorityScore: 520 + item.rsRating,
    };
  }

  // 3. Kiểm tra GIA TĂNG VỊ THẾ / BỒI LỆNH (Lần 2: +40% -> 70% vị thế)
  // Kích hoạt khi cổ phiếu Stage 2 bứt phá kháng cự Pivot 20P kèm Vol lớn, hoặc nổ Pocket Pivot / Follow-through dòng tiền mạnh
  const brokePivotWithVol =
    pivotK > 0 &&
    distToPivotPct !== null &&
    distToPivotPct >= -0.4 &&
    distToPivotPct <= 5.5 &&
    item.changePct >= 1.2 &&
    (item.relVol >= 1.2 || item.volSignal === 'BREAKOUT' || item.volSignal === 'POCKET_PIVOT');

  const pocketPivotOrFollowThrough =
    item.changePct >= 1.5 &&
    refDist20 >= 0 &&
    refDist20 <= 8.5 &&
    udRatio >= 1.15 &&
    (item.volSignal === 'BREAKOUT' ||
      item.volSignal === 'POCKET_PIVOT' ||
      (item.relVol >= 1.3 && item.changePct >= 2.0));

  if (brokePivotWithVol || pocketPivotOrFollowThrough) {
    const scaleBasePct = 40;
    const effectiveScalePct = Math.round(scaleBasePct * marketMultiplier);
    // Khi bồi lệnh, nâng stoploss lên sát MA20 hoặc đáy ngắn hạn để bảo vệ phần lãi đệm Lần 1
    const scaleStopK =
      sma20 > 0 && sma20 < priceK
        ? Math.max(priceK * 0.94, sma20 * 0.985)
        : Math.max(priceK * 0.94, structuralStopK);
    const scaleStopVnd = roundVnPrice(scaleStopK);
    const scaleStopPct = Math.round(((scaleStopVnd - item.price) / item.price) * 1000) / 10;
    const addHighVnd = roundVnPrice((pivotK > 0 ? Math.max(priceK, pivotK) : priceK) * 1.015);
    const addLowVnd = pivotVnd && pivotVnd <= item.price ? pivotVnd : roundVnPrice(priceK * 0.99);

    const scaleReason = brokePivotWithVol
      ? `Vượt Pivot 20P (${pivotVnd?.toLocaleString('vi-VN')}) · +${item.changePct.toFixed(2)}% · KL ${item.relVol.toFixed(2)}x TB20`
      : item.volSignal === 'POCKET_PIVOT'
      ? `Pocket Pivot trên MA20 (+${refDist20.toFixed(1)}%) · KL ${item.relVol.toFixed(2)}x · U/D ${udRatio}x`
      : `Bùng nổ dòng tiền +${item.changePct.toFixed(2)}% · KL ${item.relVol.toFixed(2)}x · U/D ${udRatio}x`;

    return {
      signal: 'SCALE_UP',
      badgeLabel: 'GIA TĂNG (+40%)',
      shortBadge: effectiveScalePct > 0 ? `Bồi +${effectiveScalePct}% (Lên 70%)` : ' Tạm khóa bồi (TT xấu)',
      basePct: scaleBasePct,
      effectivePct: effectiveScalePct,
      targetTotalPct: 70,
      actionZoneLabel: `Vùng bồi ${addLowVnd.toLocaleString('vi-VN')} – ${addHighVnd.toLocaleString('vi-VN')}`,
      nextScaleUpLabel: `Đủ 100% khi retest giữ trên ${(pivotVnd || addLowVnd).toLocaleString('vi-VN')} (khi Lần 1 đã lãi ≥ +2~4%)`,
      isReadyToScaleUpSoon: false,
      distFromSma20Pct,
      distFromSma50Pct,
      distToPivotPct,
      pivotVnd,
      stopLossVnd: scaleStopVnd,
      stopLossPct: scaleStopPct,
      target1Vnd,
      riskReward: Math.round(((target1Vnd - item.price) / Math.max(50, item.price - scaleStopVnd)) * 10) / 10,
      minScaleUpVol,
      reason: scaleReason,
      priorityScore: 900 + item.rsRating + Math.min(30, item.relVol * 10),
    };
  }

  // 4. Kiểm tra MUA MỚI / VỊ THẾ THĂM DÒ (Lần 1: 30% vị thế)
  // Giá nằm trong vùng an toàn quanh MA20 [-3.0%, +4.2%], không bị bán tháo
  const inSafePilotZone =
    refDist20 >= -3.0 &&
    refDist20 <= 4.2 &&
    !(item.changePct <= -1.5 && item.relVol >= 1.15);

  // Cờ "Sắp chạm điểm bồi lệnh" cho nhà đầu tư đã có sẵn vị thế thăm dò Lần 1:
  // Cổ phiếu giữ trên MA20, tích lũy cạn cung hoặc gom hàng (U/D >= 1.1), cách Pivot 20P không quá 4.5%
  const isReadyToScaleUpSoon =
    pivotK > 0 &&
    distToPivotPct !== null &&
    distToPivotPct >= -4.5 &&
    distToPivotPct < 0.5 &&
    refDist20 >= -1.5 &&
    udRatio >= 1.05;

  if (inSafePilotZone) {
    const pilotBasePct = 30;
    const effectivePilotPct = Math.round(pilotBasePct * marketMultiplier);
    const zoneBaseK = sma20 > 0 ? Math.min(priceK, sma20 * 1.005) : priceK * 0.99;
    const zoneLowVnd = roundVnPrice(zoneBaseK * 0.99);
    const zoneHighVnd = roundVnPrice(Math.max(priceK, sma20 > 0 ? sma20 * 1.025 : priceK * 1.015));

    const volNote =
      item.volSignal === 'VCP_DRYUP'
        ? `Cạn cung VCP (${item.relVol.toFixed(2)}x)`
        : udRatio >= 1.2
        ? `Gom hàng U/D ${udRatio}x`
        : `KL ${item.relVol.toFixed(2)}x TB20`;

    return {
      signal: 'BUY_NEW',
      badgeLabel: 'MUA THĂM DÒ (30%)',
      shortBadge: effectivePilotPct > 0 ? `Mua mới ${effectivePilotPct}%` : 'Quan sát (TT xấu)',
      basePct: pilotBasePct,
      effectivePct: effectivePilotPct,
      targetTotalPct: 30,
      actionZoneLabel: `Vùng mua ${zoneLowVnd.toLocaleString('vi-VN')} – ${zoneHighVnd.toLocaleString('vi-VN')}`,
      nextScaleUpLabel: `Bồi +40% khi ${nextScaleTriggerStr}`,
      isReadyToScaleUpSoon,
      distFromSma20Pct,
      distFromSma50Pct,
      distToPivotPct,
      pivotVnd,
      stopLossVnd,
      stopLossPct,
      target1Vnd,
      riskReward,
      minScaleUpVol,
      reason: `Nền chặt quanh MA20 (${refDist20 >= 0 ? '+' : ''}${refDist20.toFixed(1)}%) · ${volNote} · RS ${item.rsRating}`,
      priorityScore: 750 + item.rsRating + (item.volSignal === 'VCP_DRYUP' ? 8 : 0) + Math.min(10, udRatio * 4),
    };
  }

  // 5. Còn lại trong Stage 2 (ví dụ đang cách MA20 từ +4.3% đến +8.5% nhưng chưa nổ Vol vượt Pivot, hoặc chỉnh nhẹ dưới MA20 > 3% nhưng vẫn trên MA50):
  // -> Đã có hàng thì NẮM GIỮ, chưa có hàng thì CHỜ TEST MA20 / NỀN
  const waitZoneVnd = sma20 > 0 ? roundVnPrice(sma20 * 1.01) : roundVnPrice(sma50 * 1.02);

  return {
    signal: 'HOLD_WAIT',
    badgeLabel: 'CHỜ TEST MA20 / NỀN',
    shortBadge: 'Giữ hàng · Chờ nền',
    basePct: 0,
    effectivePct: 0,
    targetTotalPct: 0,
    actionZoneLabel: `Canh mua mới quanh ${waitZoneVnd.toLocaleString('vi-VN')} (MA20)`,
    nextScaleUpLabel: `Có sẵn hàng: Bồi +40% khi ${nextScaleTriggerStr}`,
    isReadyToScaleUpSoon,
    distFromSma20Pct,
    distFromSma50Pct,
    distToPivotPct,
    pivotVnd,
    stopLossVnd,
    stopLossPct,
    target1Vnd,
    riskReward,
    minScaleUpVol,
    reason:
      refDist20 > 4.2
        ? `Trên MA20 +${refDist20.toFixed(1)}% (chưa nổ Vol vượt Pivot) — Giữ vị thế, chờ nền hoặc nổ Vol`
        : `Đang lùi kiểm định hỗ trợ trên MA50 (${roundVnPrice(sma50).toLocaleString('vi-VN')}) — Chờ nến rút chân`,
    priorityScore: 600 + item.rsRating,
  };
}
