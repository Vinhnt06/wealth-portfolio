import { MinerviniScreenerItem } from '../types/minervini.types';

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
