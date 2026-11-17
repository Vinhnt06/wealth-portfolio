import evidence from '../data/decisionEvidence.json';

/**
 * Thống kê lịch sử cho từng trạng thái quyết định (xem scripts/validate_wyckoff_context.mjs).
 * Mục đích: cho người dùng biết mỗi trạng thái đã từng đi kèm kết quả thế nào, thay vì chỉ nghe "quy tắc nói vậy".
 */
export interface EvidenceRow {
  n: number;
  f20: { mean: number; median: number; pos: number };
  f60: { mean: number; median: number; pos: number };
  dd20: { median: number; p10: number };
}

const G = (evidence as unknown as { groups: Record<string, EvidenceRow> }).groups;
const META = (evidence as unknown as { meta: { periodStart: string; periodEnd: string; universe: number; caveats: string[] } }).meta;

export interface DecisionEvidence {
  current: EvidenceRow | null;
  holder: EvidenceRow | null;
  /** Đối chứng: chỉ dùng Stage 2 (8/8) hoặc chỉ dùng Wyckoff thô — để so với quyết định hợp nhất */
  controls: { stageOnly: EvidenceRow | null; wyckoffOnly: EvidenceRow | null; unifiedBuy: EvidenceRow | null };
  meta: typeof META;
}

export const lookupEvidence = (headline: string, holderAction: string): DecisionEvidence => ({
  current: G[`dec:${headline}`] ?? null,
  holder: G[`holder:${holderAction}`] ?? null,
  controls: {
    stageOnly: G['ctrl:chỉ-Stage2-8/8'] ?? null,
    wyckoffOnly: G['ctrl:chỉ-Wyckoff-D/E-thô'] ?? null,
    unifiedBuy: G['ctrl:HỢP-NHẤT-BUY'] ?? null,
  },
  meta: META,
});
