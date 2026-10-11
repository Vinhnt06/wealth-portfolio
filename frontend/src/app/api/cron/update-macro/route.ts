import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Optional security check if CRON_SECRET is configured
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    commoditiesCount: 0,
    bankRatesCount: 0,
  };

  try {
    // 1. Fetch Realtime Global Commodities from Yahoo Finance
    const commodities: any[] = [];
    const symbols = [
      { id: 'brent', sym: 'BZ=F', name: 'Dầu Brent (Thế giới)', cat: 'oil', unit: 'USD/thùng' },
      { id: 'wti', sym: 'CL=F', name: 'Dầu WTI (Mỹ)', cat: 'oil', unit: 'USD/thùng' },
      { id: 'gold_world', sym: 'GC=F', name: 'Vàng Thế Giới (XAU)', cat: 'gold_world', unit: 'USD/oz' },
      { id: 'silver', sym: 'SI=F', name: 'Bạc Thế Giới (XAG)', cat: 'metal', unit: 'USD/oz' },
    ];

    await Promise.all(
      symbols.map(async (s) => {
        try {
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.sym)}?interval=1d&range=1d`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
            cache: 'no-store',
          });
          if (res.ok) {
            const json = await res.json();
            const meta = json?.chart?.result?.[0]?.meta;
            if (meta) {
              const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
              const change = meta.fulldayChange ?? 0;
              const changePercent = meta.regularMarketChangePercent ?? 0;

              commodities.push({
                id: s.id,
                name: s.name,
                category: s.cat,
                price: Number(price.toFixed(2)),
                unit: s.unit,
                change: Number(change.toFixed(2)),
                change_percent: Number(changePercent.toFixed(2)),
                is_realtime: true,
                updated_at: new Date().toISOString(),
              });
            }
          }
        } catch (e) {
          console.error(`Lỗi fetch ${s.sym}:`, e);
        }
      })
    );

    // 2. Fetch Vietnam Gold from 24HMoney
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

        let index = 0;
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

                const cleanName = colNameRaw
                  .replace(/^(SJC|DOJI|PNJ|KHÁC)\s+/i, '')
                  .replace(/\s+(vàng miếng|vàng nhẫn|vàng nữ trang|vàng trang sức)/gi, ' ($1)');

                commodities.push({
                  id: `vn_gold_${brand.toLowerCase()}_${index++}`,
                  name: cleanName,
                  brand,
                  category: 'gold_vn',
                  price: sell,
                  buy_price: buy,
                  sell_price: sell,
                  spread: sell - buy,
                  unit: 'VNĐ/Lượng',
                  change: 0,
                  change_percent: 0,
                  is_realtime: false,
                  updated_at: new Date().toISOString(),
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Lỗi fetch vàng 24HMoney:', e);
    }

    if (commodities.length > 0) {
      await supabase.from('macro_commodities').upsert(commodities, { onConflict: 'id' });
      results.commoditiesCount = commodities.length;
    }

    // 3. Fetch Bank Interest Rates from 24HMoney
    const bankRates: any[] = [];
    try {
      const resBank = await fetch('https://24hmoney.vn/lai-suat-gui-ngan-hang', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
          Accept: 'text/html,application/xhtml+xml',
        },
        cache: 'no-store',
      });

      if (resBank.ok) {
        const html = await resBank.text();
        const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];

        const parseTable = (tableHtml: string, type: 'counter' | 'online') => {
          const rows: any[] = [];
          const trMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

          for (const tr of trMatches) {
            if (tr.includes('<th')) continue;
            const tdMatches = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
            if (tdMatches.length >= 7) {
              const cleanCells = tdMatches.map((td) =>
                td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
              );

              const bank = cleanCells[0];
              if (bank && bank !== 'Ngân hàng') {
                const bankSlug = bank
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9]/g, '_');

                rows.push({
                  id: `${bankSlug}_${type}`,
                  bank,
                  type,
                  rate_1m: cleanCells[1] || '-',
                  rate_3m: cleanCells[2] || '-',
                  rate_6m: cleanCells[3] || '-',
                  rate_12m: cleanCells[4] || '-',
                  rate_18m: cleanCells[5] || '-',
                  rate_24m: cleanCells[6] || '-',
                  rate_36m: cleanCells[7] || '-',
                  updated_at: new Date().toISOString(),
                });
              }
            }
          }
          return rows;
        };

        if (tableMatches[0]) bankRates.push(...parseTable(tableMatches[0], 'counter'));
        if (tableMatches[1]) bankRates.push(...parseTable(tableMatches[1], 'online'));
      }
    } catch (e) {
      console.error('Lỗi fetch lãi suất ngân hàng:', e);
    }

    if (bankRates.length > 0) {
      await supabase.from('macro_bank_rates').upsert(bankRates, { onConflict: 'id' });
      results.bankRatesCount = bankRates.length;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    return NextResponse.json({
      success: true,
      message: `Cập nhật thành công ${results.commoditiesCount} mặt hàng và ${results.bankRatesCount} biểu lãi suất ngân hàng!`,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('Lỗi chạy cron update macro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
