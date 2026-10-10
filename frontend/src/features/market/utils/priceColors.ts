export type PriceColorType = 'ceiling' | 'floor' | 'up' | 'down' | 'ref';

export interface PriceColorResult {
  type: PriceColorType;
  colorClass: string;
  badgeBgClass: string;
  label: string;
}

/**
 * Standard Vietnam Stock Exchange 5-Color Rule:
 * 1. TRẦN (Ceiling): Tím / Fuchsia (#d946ef)
 * 2. SÀN (Floor): Xanh Lơ / Cyan (#06b6d4)
 * 3. TĂNG (Increase): Xanh Lá / Emerald (#10b981)
 * 4. GIẢM (Decrease): Đỏ / Rose (#f43f5e)
 * 5. THAM CHIẾU (Reference): Vàng / Amber (#f59e0b)
 */
export function getStockPriceColor(params: {
  price?: number | null;
  refPrice?: number | null;
  ceilPrice?: number | null;
  floorPrice?: number | null;
  change?: number | null;
  changePercent?: number | null;
  exchange?: string | null;
}): PriceColorResult {
  const { price, refPrice, ceilPrice, floorPrice, change, changePercent, exchange } = params;

  const p = price != null ? price : 0;
  const ceil = ceilPrice != null ? ceilPrice : 0;
  const floor = floorPrice != null ? floorPrice : 0;
  const ref = refPrice != null ? refPrice : 0;
  const chg = change != null ? change : (p && ref ? p - ref : 0);
  const pct = changePercent != null ? changePercent : (ref && chg ? (chg / ref) * 100 : 0);

  const ex = (exchange || 'HOSE').toUpperCase();
  // Biên độ sàn: HOSE ~6.7-7.0%, HNX ~9.5-10.0%, UPCOM ~14.3-15.0%
  const limitPct = ex === 'UPCOM' ? 14.3 : ex === 'HNX' ? 9.5 : 6.7;

  // Chuẩn hóa đơn vị p, ceil, floor nếu có chênh lệch đơn vị (nghìn VNĐ vs đồng)
  let normP = p;
  let normCeil = ceil;
  let normFloor = floor;
  if (normP > 0 && normCeil > 0) {
    if (normP > 1000 && normCeil < 1000) normCeil *= 1000;
    else if (normP < 1000 && normCeil > 1000) normP *= 1000;
  }
  if (normP > 0 && normFloor > 0) {
    if (normP > 1000 && normFloor < 1000) normFloor *= 1000;
    else if (normP < 1000 && normFloor > 1000) normP *= 1000;
  }

  // 1. Ceiling (Trần - Tím)
  // BẮT BUỘC:
  // - Phải là phiên TĂNG GIÁ (pct > 0 và chg > 0)
  // - pct phải chạm ngưỡng trần (>= limitPct) HOẶC nếu giá chạm ceilingPrice thì pct cũng phải gần ngưỡng trần (>= limitPct - 1.0)
  const isCeilPriceMatch =
    normCeil > 0 &&
    normP > 0 &&
    (normP >= normCeil || Math.abs(normP - normCeil) <= (normCeil > 1000 ? 50 : 0.05));

  const isCeil =
    (chg > 0 || pct > 0) &&
    (pct >= limitPct || (isCeilPriceMatch && pct >= limitPct - 1.0));

  if (isCeil) {
    return {
      type: 'ceiling',
      colorClass: 'text-fuchsia-400',
      badgeBgClass: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
      label: 'Trần',
    };
  }

  // 2. Floor (Sàn - Xanh Lơ)
  // BẮT BUỘC:
  // - Phải là phiên GIẢM GIÁ (pct < 0 và chg < 0)
  // - pct phải chạm ngưỡng sàn (<= -limitPct) HOẶC nếu giá chạm floorPrice thì pct cũng phải gần ngưỡng sàn (<= -limitPct + 1.0)
  const isFloorPriceMatch =
    normFloor > 0 &&
    normP > 0 &&
    (normP <= normFloor || Math.abs(normP - normFloor) <= (normFloor > 1000 ? 50 : 0.05));

  const isFloor =
    (chg < 0 || pct < 0) &&
    (pct <= -limitPct || (isFloorPriceMatch && pct <= -limitPct + 1.0));

  if (isFloor) {
    return {
      type: 'floor',
      colorClass: 'text-cyan-400',
      badgeBgClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      label: 'Sàn',
    };
  }

  // 3. Up (Tăng - Xanh Lá)
  if (chg > 0 || pct > 0) {
    return {
      type: 'up',
      colorClass: 'text-emerald-400',
      badgeBgClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      label: 'Tăng',
    };
  }

  // 4. Down (Giảm - Đỏ)
  if (chg < 0 || pct < 0) {
    return {
      type: 'down',
      colorClass: 'text-rose-400',
      badgeBgClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      label: 'Giảm',
    };
  }

  // 5. Reference (Tham Chiếu - Vàng)
  return {
    type: 'ref',
    colorClass: 'text-amber-400',
    badgeBgClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    label: 'TC',
  };
}
