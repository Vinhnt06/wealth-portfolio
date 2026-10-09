import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';

export const runtime = 'nodejs';

/**
 * GET /api/market/stocks?query=hpg&exchange=HOSE&limit=20
 * Searches stock symbols from Supabase with fallback to local JSON database.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('query') || '').trim();
  const exchange = (searchParams.get('exchange') || '').trim().toUpperCase();
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  // 1. Try querying Supabase
  try {
    let sbQuery = supabase.from('stocks').select('symbol, name, exchange, sector').limit(limit);

    if (exchange) {
      sbQuery = sbQuery.eq('exchange', exchange);
    }

    if (query) {
      sbQuery = sbQuery.or(`symbol.ilike.%${query}%,name.ilike.%${query}%`);
    }

    const { data, error } = await sbQuery;

    if (!error && data && data.length > 0) {
      return NextResponse.json({
        success: true,
        source: 'supabase',
        total: data.length,
        data,
      });
    }
  } catch {
    // Silently proceed to local fallback
  }

  // 2. Fallback to in-memory JSON database
  let localData = stockDatabase as Array<{
    symbol: string;
    name: string;
    exchange: string;
    sector: string;
  }>;

  if (exchange) {
    localData = localData.filter((s) => s.exchange === exchange);
  }

  if (query) {
    const q = query.toLowerCase();
    localData = localData.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q)
    );
  }

  const results = localData.slice(0, limit);

  return NextResponse.json({
    success: true,
    source: 'local_cache',
    total: results.length,
    data: results,
  });
}
