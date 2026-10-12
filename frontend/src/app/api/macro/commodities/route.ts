import { NextResponse } from 'next/server';

interface CommodityItem {
  id: string;
  name: string;
  category: 'oil' | 'gold_world' | 'gold_vn' | 'metal';
  price: number | string;
  unit: string;
  change: number;
  changePercent?: number;
  buyPrice?: number;
  sellPrice?: number;
  spread?: number;
  brand?: string;
  updatedAt: string;
  isRealtime: boolean;
}

// In-memory cache for 10 seconds
let cacheData: { timestamp: number; data: CommodityItem[] } | null = null;
const CACHE_TTL_MS = 10 * 1000;

export async function GET() {
  const now = Date.now();
  if (cacheData && now - cacheData.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      cached: true,
      data: cacheData.data,
      timestamp: new Date(cacheData.timestamp).toISOString(),
    });
  }

  const timeStr = new Date().toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  });

  // 1. Fetch Realtime Global Commodities from Yahoo Finance
  const symbols = [
    { id: 'brent', sym: 'BZ=F', name: 'Dầu Brent (Thế giới)', cat: 'oil' as const, unit: 'USD/thùng' },
    { id: 'wti', sym: 'CL=F', name: 'Dầu WTI (Mỹ)', cat: 'oil' as const, unit: 'USD/thùng' },
    { id: 'gold_world', sym: 'GC=F', name: 'Vàng Thế Giới (XAU)', cat: 'gold_world' as const, unit: 'USD/oz' },
    { id: 'silver', sym: 'SI=F', name: 'Bạc Thế Giới (XAG)', cat: 'metal' as const, unit: 'USD/oz' },
  ];

  await Promise.all(
    symbols.map(async (s) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.sym)}?interval=1d&range=1d`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
            next: { revalidate: 30 },
          }
        );
        if (res.ok) {
          const json = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (meta) {
            const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
            const change = meta.fulldayChange ?? 0;
            const changePercent = meta.regularMarketChangePercent ?? 0;

            items.push({
              id: s.id,
              name: s.name,
              category: s.cat,
              price: Number(price.toFixed(2)),
              unit: s.unit,
              change: Number(change.toFixed(2)),
              changePercent: Number(changePercent.toFixed(2)),
              updatedAt: timeStr,
              isRealtime: true,
            });
          }
        }
      } catch (e) {
        console.error(`Lỗi fetch ${s.sym}:`, e);
      }
    })
  );

  // 2. Fetch Vietnam Domestic Gold Prices from 24HMoney
  try {
    const res24h = await fetch('https://24hmoney.vn/gia-vang', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    });

    if (res24h.ok) {
      const html = await res24h.text();
      const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

      for (const tr of trMatches) {
        const tdMatches = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
        if (tdMatches.length >= 4) {
          const colNameRaw = tdMatches[0]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';
          const colBuyRaw = tdMatches[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';
          const colSellRaw = tdMatches[2]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';

          const buyMatch = colBuyRaw.match(/([0-9]{1,3}(?:,[0-9]{3})+)/);
          const sellMatch = colSellRaw.match(/([0-9]{1,3}(?:,[0-9]{3})+)/);

          if (colNameRaw && buyMatch && sellMatch) {
            const buy = parseInt(buyMatch[1].replace(/,/g, ''), 10);
            const sell = parseInt(sellMatch[1].replace(/,/g, ''), 10);

            if (buy > 1000000 && sell > 1000000) {
              let brand = 'Khác';
              if (/SJC/i.test(colNameRaw)) brand = 'SJC';
              else if (/DOJI/i.test(colNameRaw)) brand = 'DOJI';
              else if (/PNJ/i.test(colNameRaw)) brand = 'PNJ';
              else if (/Bảo Tín Minh Châu/i.test(colNameRaw)) brand = 'BTMC';
              else if (/Bảo Tín Mạnh Hải/i.test(colNameRaw)) brand = 'BTMH';
              else if (/Mi Hồng/i.test(colNameRaw)) brand = 'Mi Hồng';
              else if (/Ngọc Hải/i.test(colNameRaw)) brand = 'Ngọc Hải';

              // Clean display name
              let cleanName = colNameRaw
                .replace(/^(SJC|DOJI|PNJ|KHÁC)\s+/i, '')
                .replace(/\s+(vàng miếng|vàng nhẫn|vàng nữ trang|vàng trang sức)/gi, ' ($1)');

              items.push({
                id: `vn_gold_${items.length}`,
                name: cleanName,
                brand,
                category: 'gold_vn',
                price: sell,
                buyPrice: buy,
                sellPrice: sell,
                spread: sell - buy,
                unit: 'VNĐ/Lượng',
                change: 0,
                updatedAt: 'Hôm nay (24HMoney)',
                isRealtime: false,
              });
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Lỗi fetch giá vàng 24HMoney:', e);
  }

  // Update memory cache
  cacheData = { timestamp: now, data: items };

  return NextResponse.json({
    success: true,
    data: items,
    timestamp: new Date().toISOString(),
  });
}
