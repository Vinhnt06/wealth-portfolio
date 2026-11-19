/**
 * Ngành dẫn dắt hay tụt hậu — module thuần.
 * Minervini chọn cổ phiếu mạnh nằm trong nhóm ngành mạnh. Xếp hạng ngành theo trung vị lợi suất 3 tháng:
 * top 1/3 VÀ mạnh hơn VN-Index = TAILWIND (thuận gió); bottom 1/3 VÀ yếu hơn VN-Index = HEADWIND (ngược gió).
 */
export type SectorTone = 'TAILWIND' | 'NEUTRAL' | 'HEADWIND' | 'UNKNOWN';

export function sectorTone(rank: number | null | undefined, total: number | null | undefined): SectorTone {
  if (!rank || !total || total < 3 || rank < 1) return 'UNKNOWN';
  const pos = (rank - 1) / (total - 1); // 0 = mạnh nhất, 1 = yếu nhất
  return pos <= 1 / 3 ? 'TAILWIND' : pos >= 2 / 3 ? 'HEADWIND' : 'NEUTRAL';
}

/**
 * Sức mạnh ngành theo 20 ngành ICB của app, đo trên TOÀN BỘ cổ phiếu có thanh khoản tối thiểu
 * (không chỉ 5 mã đại diện): trung vị lợi suất 3 tháng của các mã trong ngành, so với VN-Index.
 * Trung vị để một mã vốn hoá lớn (VIC, VHM…) không kéo cả ngành.
 */
export interface SectorReturnRow {
  symbol: string;
  sector: string;
  /** Lợi suất 63 phiên (%) */
  ret3M: number;
}

export interface SectorStrengthRow {
  sector: string;
  count: number;
  medianRet3M: number;
  /** Trung vị ngành − VN-Index (điểm %) */
  relVsIndex: number | null;
  rank: number | null;
  total: number;
  tone: SectorTone;
}

/** Ngành có ít hơn số mã này thì không xếp hạng (mẫu quá nhỏ để nói "thuận gió") */
export const SECTOR_MIN_MEMBERS = 3;

const median = (arr: number[]) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Thứ hạng chỉ là tương đối giữa các ngành: khi cả thị trường giảm, ngành "top 1/3" vẫn có thể thua VN-Index.
 * Thuận gió phải vừa ở top 1/3 VỪA mạnh hơn VN-Index; ngược gió phải vừa ở bottom 1/3 VỪA yếu hơn VN-Index.
 */
function toneWithIndex(byRank: SectorTone, medianRet3M: number, indexRet3M: number | null): SectorTone {
  if (indexRet3M === null) return byRank;
  if (byRank === 'TAILWIND' && medianRet3M <= indexRet3M) return 'NEUTRAL';
  if (byRank === 'HEADWIND' && medianRet3M >= indexRet3M) return 'NEUTRAL';
  return byRank;
}

export function computeSectorStrength(rows: SectorReturnRow[], indexRet3M: number | null): SectorStrengthRow[] {
  const bySector = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.sector || r.sector === 'Khác' || !Number.isFinite(r.ret3M)) continue;
    const list = bySector.get(r.sector) ?? [];
    list.push(r.ret3M);
    bySector.set(r.sector, list);
  }
  const all = [...bySector.entries()].map(([sector, rets]) => ({ sector, count: rets.length, medianRet3M: median(rets) }));
  const ranked = all.filter((s) => s.count >= SECTOR_MIN_MEMBERS).sort((a, b) => b.medianRet3M - a.medianRet3M);
  const total = ranked.length;
  const rankOf = new Map(ranked.map((s, i) => [s.sector, i + 1]));
  return all
    .map((s) => {
      const rank = rankOf.get(s.sector) ?? null;
      return {
        sector: s.sector,
        count: s.count,
        medianRet3M: Math.round(s.medianRet3M * 100) / 100,
        relVsIndex: indexRet3M === null ? null : Math.round((s.medianRet3M - indexRet3M) * 100) / 100,
        rank,
        total,
        tone: rank ? toneWithIndex(sectorTone(rank, total), s.medianRet3M, indexRet3M) : ('UNKNOWN' as SectorTone),
      };
    })
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
}
