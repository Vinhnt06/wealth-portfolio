import { NextResponse } from 'next/server';
import { isMarketIndex } from '../../../../features/market/constants/marketIndexes';
import { StockValuationData } from '../../../../features/market/types/financials.types';
import {
  fetchStockValuationLive,
  readFinancialsDatabase,
} from '../../../../features/market/services/financialsSyncService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

// In-memory hot cache (15 minutes)
const financialsCache = new Map<string, { data: StockValuationData; expiry: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();

  if (isMarketIndex(symbol)) {
    return NextResponse.json({
      success: false,
      error: `Ký hiệu ${symbol} là chỉ số thị trường, không có báo cáo tài chính doanh nghiệp riêng lẻ.`,
    }, { status: 400 });
  }

  const refresh = searchParams.get('refresh') === 'true';

  // 1. Check in-memory hot cache
  const cached = financialsCache.get(symbol);
  if (!refresh && cached && cached.expiry > Date.now()) {
    return NextResponse.json({
      success: true,
      source: 'memory_cache',
      data: cached.data,
    });
  }

  // 2. Check persistent disk snapshot (maintained by Cron job)
  if (!refresh) {
    const db = readFinancialsDatabase();
    if (db && db.data && db.data[symbol]) {
      const dbItem = db.data[symbol];
      financialsCache.set(symbol, { data: dbItem, expiry: Date.now() + CACHE_TTL_MS });
      return NextResponse.json({
        success: true,
        source: 'database_snapshot',
        scannedAt: db.scannedAtText,
        data: dbItem,
      });
    }
  }

  // 3. Fallback to live Vietcap IQ API if not in DB or refresh requested
  try {
    const result = await fetchStockValuationLive(symbol);
    if (!result) {
      return NextResponse.json({
        success: false,
        error: `Không tìm thấy báo cáo tài chính cho mã ${symbol}.`,
      }, { status: 404 });
    }

    // Save to hot memory cache
    financialsCache.set(symbol, { data: result, expiry: Date.now() + CACHE_TTL_MS });

    return NextResponse.json({
      success: true,
      source: 'live',
      data: result,
    });
  } catch (err: any) {
    console.error(`[API /api/market/financials] Error processing ${symbol}:`, err);
    return NextResponse.json({
      success: false,
      error: `Không thể tải báo cáo tài chính cho mã ${symbol}: ${err.message || 'Lỗi hệ thống'}`,
    }, { status: 500 });
  }
}
