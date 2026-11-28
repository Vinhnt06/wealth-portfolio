import { NextResponse } from 'next/server';
import bondDb from '../../../../features/market/data/bondYield10Y.json';
import { mergeYield, YieldPoint } from '../../../../features/market/utils/buyTiming';
import { readFinancialsDatabase } from '../../../../features/market/services/financialsSyncService';
import {
  answerCapital,
  answerEarnings,
  contextOf,
  CONTEXT_ALLOCATION,
  QuarterRow,
} from '../../../../features/market/utils/capitalContext';

/**
 * Bối cảnh "Lợi nhuận × Vốn" — xem utils/capitalContext.ts.
 *  - Lợi nhuận: báo cáo tài chính thật trong financialsDatabase.json.
 *  - Vốn: lịch sử lợi suất TPCP 10 năm (bondYield10Y.json) + số sống hôm nay.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const fin = readFinancialsDatabase();
  const companies: QuarterRow[][] = fin
    ? Object.values(fin.data).map((r) =>
        (((r as unknown as { quarterlyHistory?: QuarterRow[] }).quarterlyHistory) || []).map((q) => ({
          periodLabel: q.periodLabel,
          netProfit: Number(q.netProfit),
        }))
      )
    : [];
  const earnings = answerEarnings(companies);

  // Lịch sử lợi suất đã lưu + số sống hôm nay (không lưu) để mốc hiện tại luôn mới nhất
  let live: YieldPoint | null = null;
  try {
    const vn = await fetch(`${new URL(req.url).origin}/api/macro/vn`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).then((r) => r.json());
    const b = vn?.data?.bond10Y;
    if (b && Number.isFinite(b.value) && b.updatedAt) {
      live = [new Date(Date.parse(b.updatedAt) + 7 * 3600_000).toISOString().slice(0, 10), Number(b.value)];
    }
  } catch {
    // chỉ dùng lịch sử đã lưu
  }
  const capital = answerCapital(mergeYield(bondDb.points as YieldPoint[], live));

  const key = contextOf(earnings.direction, capital.direction);
  return NextResponse.json({
    success: true,
    data: {
      context: key,
      allocation: CONTEXT_ALLOCATION[key],
      earnings,
      capital,
      source: 'Khung Lợi nhuận × Vốn (Dragon Capital, DNSE 11/2026). Tỷ trọng minh hoạ, chưa kiểm định ngoài mẫu.',
    },
  });
}
