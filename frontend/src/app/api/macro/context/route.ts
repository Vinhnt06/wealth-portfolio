import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { readFinancialsDatabase } from '../../../../features/market/services/financialsSyncService';
import {
  answerCapital,
  answerEarnings,
  CapitalPoint,
  contextOf,
  CONTEXT_ALLOCATION,
  QuarterRow,
} from '../../../../features/market/utils/capitalContext';

/**
 * Bối cảnh "Lợi nhuận × Vốn" — xem utils/capitalContext.ts.
 *  - Lợi nhuận: báo cáo tài chính thật trong financialsDatabase.json.
 *  - Vốn: lịch sử lãi suất ghi hằng ngày (macroDatabase.json → capitalHistory) + số sống hôm nay.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readCapitalHistory(): CapitalPoint[] {
  for (const p of [
    path.resolve(process.cwd(), 'src/features/market/data/macroDatabase.json'),
    path.resolve(process.cwd(), 'frontend/src/features/market/data/macroDatabase.json'),
  ]) {
    if (fs.existsSync(p)) {
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        return Array.isArray(j.capitalHistory) ? j.capitalHistory : [];
      } catch {
        return [];
      }
    }
  }
  return [];
}

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

  const points = readCapitalHistory();
  // Thêm số sống hôm nay (không lưu) để mốc hiện tại luôn mới nhất
  try {
    const live = await fetch(`${new URL(req.url).origin}/api/macro/vn`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).then((r) => r.json());
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const ib = live?.data?.interbankRate?.value;
    const dep = live?.data?.deposit12M?.value;
    if (Number.isFinite(ib) || Number.isFinite(dep)) {
      points.push({ date: today, interbank: Number.isFinite(ib) ? ib : null, deposit12M: Number.isFinite(dep) ? dep : null });
    }
  } catch {
    // chỉ dùng lịch sử đã lưu
  }
  const capital = answerCapital(points);

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
