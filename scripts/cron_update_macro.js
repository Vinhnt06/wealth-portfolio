/**
 * Cronjob Script: Tự động cập nhật Giá Dầu, Giá Vàng & Lãi Suất Tiết Kiệm vào Supabase
 * Nguồn: Yahoo Finance (Realtime Oil/Gold) & 24HMoney (Vàng VN & Lãi suất ngân hàng)
 * 
 * Cách dùng:
 *   node scripts/cron_update_macro.js
 * Hoặc thiết lập crontab máy chủ:
 *   0 7 * * * cd /Users/vinhh/Documents/YourFin && node scripts/cron_update_macro.js >> /tmp/macro_cron.log 2>&1
 */

const fs = require('fs');
const path = require('path');

let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch {
  createClient = require(path.resolve(__dirname, '../frontend/node_modules/@supabase/supabase-js')).createClient;
}

// 1. Đọc cấu hình từ frontend/.env.local hoặc backend/.env
function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '../frontend/.env.local'),
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rtuqzohnkknjaquxsupj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('[ERROR] Chưa tìm thấy SUPABASE API KEY!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchCommodities() {
  console.log('[1/2] Đang cào dữ liệu Dầu thô & Giá Vàng...');
  const items = [];

  // A. Yahoo Finance - Năng lượng & Kim loại quốc tế
  const symbols = [
    { id: 'brent', sym: 'BZ=F', name: 'Dầu Brent (Thế giới)', cat: 'oil', unit: 'USD/thùng' },
    { id: 'wti', sym: 'CL=F', name: 'Dầu WTI (Mỹ)', cat: 'oil', unit: 'USD/thùng' },
    { id: 'gold_world', sym: 'GC=F', name: 'Vàng Thế Giới (XAU)', cat: 'gold_world', unit: 'USD/oz' },
    { id: 'silver', sym: 'SI=F', name: 'Bạc Thế Giới (XAG)', cat: 'metal', unit: 'USD/oz' },
  ];

  for (const s of symbols) {
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.sym)}?interval=1d&range=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      });
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
            change_percent: Number(changePercent.toFixed(2)),
            is_realtime: true,
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error(`  - Lỗi fetch ${s.name}:`, e.message);
    }
  }

  // B. 24HMoney - Giá Vàng Trong Nước (SJC, DOJI, PNJ...)
  try {
    const res = await fetch('https://24hmoney.vn/gia-vang', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (res.ok) {
      const html = await res.text();
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

              const id = `vn_gold_${brand.toLowerCase()}_${index++}`;

              items.push({
                id,
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
    console.error('  - Lỗi fetch giá vàng 24HMoney:', e.message);
  }

  // C. Lưu vào Supabase
  if (items.length > 0) {
    const { error } = await supabase.from('macro_commodities').upsert(items, { onConflict: 'id' });
    if (error) {
      console.error('  [ERROR] Lỗi lưu macro_commodities vào Supabase:', error);
    } else {
      console.log(`  ✓ Đã cập nhật thành công ${items.length} mặt hàng (Dầu & Vàng) vào Supabase!`);
    }
  }
  return items.length;
}

async function fetchBankRates() {
  console.log('[2/2] Đang cào bảng Lãi Suất Tiết Kiệm 38 Ngân Hàng...');
  const rates = [];

  try {
    const res = await fetch('https://24hmoney.vn/lai-suat-gui-ngan-hang', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];

      const parseTable = (tableHtml, type) => {
        const rows = [];
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
              // Create safe slug id
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

      if (tableMatches[0]) {
        rates.push(...parseTable(tableMatches[0], 'counter'));
      }
      if (tableMatches[1]) {
        rates.push(...parseTable(tableMatches[1], 'online'));
      }
    }
  } catch (e) {
    console.error('  - Lỗi fetch lãi suất ngân hàng:', e.message);
  }

  // Lưu vào Supabase
  if (rates.length > 0) {
    const { error } = await supabase.from('macro_bank_rates').upsert(rates, { onConflict: 'id' });
    if (error) {
      console.error('  [ERROR] Lỗi lưu macro_bank_rates vào Supabase:', error);
    } else {
      console.log(`  ✓ Đã cập nhật thành công ${rates.length} biểu lãi suất ngân hàng vào Supabase!`);
    }
  }
  return rates.length;
}

async function run() {
  console.log(`\n=============================================================`);
  console.log(`🚀 [CRONJOB] BẮT ĐẦU CẬP NHẬT DỮ LIỆU VĨ MÔ (${new Date().toLocaleString('vi-VN')})`);
  console.log(`=============================================================`);

  const startTime = Date.now();
  await fetchCommodities();
  await fetchBankRates();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`=============================================================`);
  console.log(`✅ [CRONJOB] HOÀN TẤT THÀNH CÔNG trong ${elapsed}s!`);
  console.log(`=============================================================\n`);
}

run().catch((err) => {
  console.error('[CRON ERROR]', err);
  process.exit(1);
});
