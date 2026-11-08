import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';
import { SECTOR_LEADER_UNIVERSE } from '../../../../features/market/data/sectorMapping';
import sectorFullMapping from '../../../../features/market/data/sectorFullMapping.json';
import financialsData from '../../../../features/market/data/financialsDatabase.json';
import {
  analyzeRawStockCandles,
  assignCrossSectionalRsAndEvaluate,
} from '../../../../features/market/utils/minerviniEvaluator';
import { MinerviniScreenerItem } from '../../../../features/market/types/minervini.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getScanFilePath() {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/features/market/data/lastMinerviniScan.json'),
    path.resolve(process.cwd(), 'frontend/src/features/market/data/lastMinerviniScan.json'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0];
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const hours = vnDate.getHours();
  const isMorning = hours < 13;
  const sessionType = isMorning ? 'MORNING' : 'AFTERNOON';
  const sessionLabel = isMorning ? 'Phiên Sáng (11:30)' : 'Phiên Chiều (15:00)';

  const stockMap = new Map<string, any>();
  (stockDatabase as any[]).forEach((s) => stockMap.set(s.symbol.toUpperCase(), s));
  const sectorMapping = sectorFullMapping as Record<string, string>;
  const finMap = (financialsData as any)?.data || {};

  const nowSec = Math.floor(Date.now() / 1000);
  // Tải đủ 730 ngày (~500 phiên giao dịch) để tính chuẩn MA200 + độ dốc MA200 (222 phiên) + 52W High/Low (252 phiên)
  const fromSec = nowSec - 730 * 24 * 3600;
  const activeCutoffSec = nowSec - 45 * 24 * 3600;

  const allDbSymbols = (stockDatabase as any[])
    .map((s) => (s.symbol || '').trim().toUpperCase())
    .filter((sym) => /^[A-Z0-9]{3}$/.test(sym));
  const uniqueUniverse = Array.from(new Set([...SECTOR_LEADER_UNIVERSE, ...allDbSymbols]));
  const rawItems: MinerviniScreenerItem[] = [];
  const batchSize = 60;

  for (let i = 0; i < uniqueUniverse.length; i += batchSize) {
    const batch = uniqueUniverse.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (sym) => {
        try {
          const info = stockMap.get(sym) || { name: sym, exchange: 'HOSE' };
          const sector = sectorMapping[sym] || info.sector || 'Khác';
          const fin = finMap[sym];

          const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&symbol=${encodeURIComponent(
            sym
          )}&resolution=1D`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
            cache: 'no-store',
            signal: AbortSignal.timeout(6000),
          });

          if (!res.ok) return;
          const d = await res.json();
          if (!d.c || d.c.length < 50) return;
          if (Array.isArray(d.t) && d.t[d.c.length - 1] && d.t[d.c.length - 1] < activeCutoffSec) return;

          const item = analyzeRawStockCandles({
            symbol: sym,
            name: info.name,
            sector,
            exchange: info.exchange || 'HOSE',
            closes: d.c,
            highs: d.h,
            lows: d.l,
            volumes: d.v,
            pe: fin?.pe ?? null,
            epsGrowthYoY: fin?.earningsGrowthYoY ?? null,
          });
          if (item && item.isVnLiquidStandard) {
            // Bắt buộc KL TB 20N & 10N >= 100.000 CP đều nhiều phiên VÀ Vốn hóa thực tế >= 1.000 Tỷ VNĐ
            // Loại bỏ triệt để cổ phiếu bo cung/thanh khoản kém/vốn hóa nhỏ (SPV, HDA, HIO, CTP...) ngay cả khi RS 99
            rawItems.push(item);
          }
        } catch {
          // ignore single stock fetch error
        }
      })
    );
  }

  // Chuẩn hóa RS Rating theo Percentile (1 - 99) trên toàn thị trường & chấm điểm 8/8 tiêu chí
  const results = assignCrossSectionalRsAndEvaluate(rawItems);
  const stage2Count = results.filter((s) => s.isStage2).length;
  const nearStage2Count = results.filter((s) => s.score === 7).length;
  const leadersCount = results.filter((s) => s.rsRating >= 90).length;

  const outputPayload = {
    success: true,
    scannedAt: Date.now(),
    scannedAtText: vnTime,
    session: sessionType,
    sessionLabel,
    totalScanned: results.length,
    stage2Count,
    nearStage2Count,
    leadersCount,
    source: '100% REAL DNSE ENTRADE API (730D IBD PERCENTILE)',
    data: results,
  };

  // Lưu đa tầng cho cả Cloud Serverless (Global Memory + /tmp) và Local/GitHub Actions (Project File)
  (globalThis as any).__YOURFIN_MINERVINI_SCAN__ = outputPayload;
  try {
    fs.writeFileSync('/tmp/lastMinerviniScan.json', JSON.stringify(outputPayload), 'utf8');
  } catch {}
  try {
    const filePath = getScanFilePath();
    fs.writeFileSync(filePath, JSON.stringify(outputPayload, null, 2), 'utf8');
  } catch {
    // Trên Vercel Serverless (/var/task read-only), dữ liệu đã được lưu an toàn vào /tmp/lastMinerviniScan.json & globalThis
  }

  const durationMs = Date.now() - t0;
  return NextResponse.json({
    success: true,
    session: sessionType,
    sessionLabel,
    scannedAtText: vnTime,
    totalScanned: results.length,
    stage2Count,
    nearStage2Count,
    leadersCount,
    durationMs,
  });
}
