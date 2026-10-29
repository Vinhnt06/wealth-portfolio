import { NextRequest, NextResponse } from 'next/server';

export interface BankRateItem {
  bank: string;
  type: 'counter' | 'online';
  rate1M: string;
  rate3M: string;
  rate6M: string;
  rate12M: string;
  rate18M?: string;
  rate24M: string;
  rate36M?: string;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let cacheBankRates: {
  timestamp: number;
  counter: BankRateItem[];
  online: BankRateItem[];
  updateTime: string;
} | null = null;

const CACHE_TTL_MS = 15 * 1000; // 15 seconds cache for high-frequency realtime

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isForceRefresh = searchParams.get('refresh') === 'true' || searchParams.has('t');
  const now = Date.now();

  if (!isForceRefresh && cacheBankRates && now - cacheBankRates.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      cached: true,
      timestamp: cacheBankRates.timestamp,
      data: {
        counter: cacheBankRates.counter,
        online: cacheBankRates.online,
        updateTime: cacheBankRates.updateTime,
      },
    });
  }

  try {
    // 100% Real Live Crawl directly from 24HMoney Official Bank Rates
    const res = await fetch('https://24hmoney.vn/lai-suat-gui-ngan-hang', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`24HMoney responded with status ${res.status}`);
    }

    const html = await res.text();

    // Extract exact update time string from 24HMoney
    const timeMatch = html.match(/Cập nhật lúc:\s*([^<]+)/i);
    const updateTime = timeMatch ? timeMatch[1].trim() : new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Extract tables (Table 0: Tại quầy, Table 1: Online)
    const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
    const counterList: BankRateItem[] = [];
    const onlineList: BankRateItem[] = [];

    const parseTable = (tableHtml: string, type: 'counter' | 'online'): BankRateItem[] => {
      const rows: BankRateItem[] = [];
      const trMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

      for (const tr of trMatches) {
        // Skip header row
        if (tr.includes('<th')) continue;

        const tdMatches = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
        if (tdMatches.length >= 7) {
          const cleanCells = tdMatches.map((td) =>
            td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          );

          const bank = cleanCells[0];
          // Pure 100% crawl without artificial modifications
          if (bank && bank !== 'Ngân hàng') {
            rows.push({
              bank,
              type,
              rate1M: cleanCells[1] || '-',
              rate3M: cleanCells[2] || '-',
              rate6M: cleanCells[3] || '-',
              rate12M: cleanCells[4] || '-',
              rate18M: cleanCells[5] || '-',
              rate24M: cleanCells[6] || '-',
              rate36M: cleanCells[7] || '-',
            });
          }
        }
      }
      return rows;
    };

    if (tableMatches[0]) {
      counterList.push(...parseTable(tableMatches[0], 'counter'));
    }
    if (tableMatches[1]) {
      onlineList.push(...parseTable(tableMatches[1], 'online'));
    }

    if (counterList.length === 0 && cacheBankRates) {
      return NextResponse.json({
        success: true,
        cached: true,
        data: {
          counter: cacheBankRates.counter,
          online: cacheBankRates.online,
          updateTime: cacheBankRates.updateTime,
        },
      });
    }

    cacheBankRates = {
      timestamp: now,
      counter: counterList,
      online: onlineList,
      updateTime,
    };

    return NextResponse.json({
      success: true,
      data: {
        counter: counterList,
        online: onlineList,
        updateTime,
      },
    });
  } catch (error) {
    console.error('Lỗi fetch lãi suất ngân hàng 24HMoney:', error);
    if (cacheBankRates) {
      return NextResponse.json({
        success: true,
        cached: true,
        data: {
          counter: cacheBankRates.counter,
          online: cacheBankRates.online,
          updateTime: cacheBankRates.updateTime,
        },
      });
    }
    return NextResponse.json(
      { success: false, error: 'Không thể lấy dữ liệu lãi suất ngân hàng' },
      { status: 500 }
    );
  }
}
