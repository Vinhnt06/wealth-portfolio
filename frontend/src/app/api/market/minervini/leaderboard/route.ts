import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(150, Math.max(5, parseInt(searchParams.get('limit') || '35', 10)));

  // 1. First priority: Read full 200+ universe from lastMinerviniScan.json or stock_rs_ratings.json
  const scanPaths = [
    path.resolve(process.cwd(), 'src/features/market/data/lastMinerviniScan.json'),
    path.resolve(process.cwd(), 'frontend/src/features/market/data/lastMinerviniScan.json'),
  ];

  for (const p of scanPaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(raw.data) && raw.data.length > 0) {
          const totalStocks = raw.data.length;
          const sorted = [...raw.data].sort(
            (a, b) => (b.rawRsScore ?? b.rsRating ?? 0) - (a.rawRsScore ?? a.rsRating ?? 0)
          );
          const calculatedDate = new Date(raw.scannedAt || Date.now()).toISOString().slice(0, 10);
          const list = sorted.slice(0, limit).map((item, idx) => ({
            symbol: item.symbol,
            rsRating: item.rsRating,
            rank: item.rsRank ?? idx + 1,
            totalStocks: item.rsUniverseTotal ?? totalStocks,
            rawScore: item.rawRsScore ?? 0,
            q1Perf: item.q1Perf ?? item.perf1M ?? 0,
            q2Perf: item.q2Perf ?? 0,
            q3Perf: item.q3Perf ?? 0,
            q4Perf: item.q4Perf ?? item.perf1Y ?? 0,
            currentPrice: (item.price || 0) / 1000,
            calculatedDate,
          }));
          return NextResponse.json({
            success: true,
            count: list.length,
            data: list,
          });
        }
      } catch {}
    }
  }

  // 2. Fallback: Fetch from Spring Boot RS Rating Backend Service
  try {
    const backendRes = await fetch(`http://localhost:8080/api/market/rs-rating/top?limit=${limit}`, {
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 60 },
    });

    if (backendRes.ok) {
      const json = await backendRes.json();
      return NextResponse.json(json);
    }
  } catch {}

  return NextResponse.json(
    {
      success: false,
      error: 'Chưa có dữ liệu xếp hạng RS Rating',
      data: [],
    },
    { status: 200 }
  );
}
