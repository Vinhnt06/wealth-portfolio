/**
 * Ngành dẫn dắt hay tụt hậu — module thuần.
 * Minervini chọn cổ phiếu mạnh nằm trong nhóm ngành mạnh. Dùng thứ hạng sức mạnh tương đối 3 tháng của ngành so với VN-Index:
 * top 1/3 = TAILWIND (thuận gió), bottom 1/3 = HEADWIND (ngược gió).
 */
export type SectorTone = 'TAILWIND' | 'NEUTRAL' | 'HEADWIND' | 'UNKNOWN';

export function sectorTone(rank: number | null | undefined, total: number | null | undefined): SectorTone {
  if (!rank || !total || total < 3 || rank < 1) return 'UNKNOWN';
  const pos = (rank - 1) / (total - 1); // 0 = mạnh nhất, 1 = yếu nhất
  return pos <= 1 / 3 ? 'TAILWIND' : pos >= 2 / 3 ? 'HEADWIND' : 'NEUTRAL';
}
