import { NextRequest, NextResponse } from 'next/server';
import {
  syncFinancialsUniverse,
  CORE_FINANCIAL_UNIVERSE,
  readFinancialsDatabase,
} from '../../../../features/market/services/financialsSyncService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const maxDuration = 60; // 60s timeout for cron

export async function GET(request: NextRequest) {
  // Optional security check if CRON_SECRET is configured
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const customSymbolsParam = searchParams.get('symbols');

  let targetSymbols = CORE_FINANCIAL_UNIVERSE;
  if (customSymbolsParam) {
    targetSymbols = customSymbolsParam
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  } else if (limitParam) {
    const limit = parseInt(limitParam, 10);
    if (!isNaN(limit) && limit > 0) {
      targetSymbols = CORE_FINANCIAL_UNIVERSE.slice(0, limit);
    }
  }

  try {
    const result = await syncFinancialsUniverse({
      symbols: targetSymbols,
      batchSize: 5,
      delayMs: 250,
    });

    return NextResponse.json({
      success: true,
      message: `Đã hoàn tất đồng bộ BCTC cho ${result.successful}/${result.totalAttempted} mã cổ phiếu`,
      result,
    });
  } catch (err: any) {
    console.error('[CRON /api/cron/sync-financials] Error running sync:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Lỗi không xác định khi chạy cron sync BCTC',
      },
      { status: 500 }
    );
  }
}
