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

// Supabase là TUỲ CHỌN: không có khoá thì vẫn cập nhật macroDatabase.json (nguồn dữ liệu của app),
// chỉ bỏ qua bước đẩy lên Supabase.
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
if (!supabase) console.log('[INFO] Không có khoá Supabase: chỉ cập nhật macroDatabase.json, bỏ qua Supabase.');

async function fetchCommodities() {
  console.log('[1/2] Đang cào dữ liệu Dầu thô & Giá Vàng...');
  const items = [];

  // A. Yahoo Finance - Năng lượng & Kim loại quốc tế
  const symbols = [
    { id: 'gold_world', sym: 'GC=F', name: 'Vàng Thế Giới (XAU)', cat: 'gold_world', unit: 'USD/oz' },
    { id: 'brent', sym: 'BZ=F', name: 'Dầu Brent (Thế giới)', cat: 'oil', unit: 'USD/thùng' },
    { id: 'silver', sym: 'SI=F', name: 'Bạc Thế Giới (XAG)', cat: 'metal', unit: 'USD/oz' },
    { id: 'wti', sym: 'CL=F', name: 'Dầu WTI (Mỹ)', cat: 'oil', unit: 'USD/thùng' },
    { id: 'dxy', sym: 'DX-Y.NYB', name: 'Chỉ Số DXY (USD Index)', cat: 'currency', unit: 'điểm' },
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
  if (supabase && items.length > 0) {
    const { error } = await supabase.from('macro_commodities').upsert(items, { onConflict: 'id' });
    if (error) {
      console.error('  [ERROR] Lỗi lưu macro_commodities vào Supabase:', error);
    } else {
      console.log(`  ✓ Đã cập nhật thành công ${items.length} mặt hàng (Dầu & Vàng) vào Supabase!`);
    }
  }
  return items.length;
}

// Bảng lãi suất tiết kiệm lấy được ở bước fetchBankRates — dùng tính trung vị lãi suất huy động 12T
let lastBankRates = [];

// TradingView (dữ liệu kinh tế GSO/NHNN): close = số mới nhất, change_abs = chênh lệch so với kỳ công bố trước
async function fetchTvIndicator(symbol) {
  try {
    const res = await fetch(
      `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(symbol)}&fields=close,change_abs,last_bar_update_time,update_time`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const value = Number(j && j.close);
    if (!Number.isFinite(value)) return null;
    const change = Number(j.change_abs);
    return { value: Number(value.toFixed(4)), change: Number.isFinite(change) ? Number(change.toFixed(2)) : null };
  } catch (e) {
    console.log(`  - Lỗi TradingView ${symbol}:`, e.message);
    return null;
  }
}

// Kỳ số liệu mới nhất đã công bố: GSO công bố CPI tháng & GDP quý vào khoảng ngày 6 tháng sau
function latestReleasedPeriods(now = new Date()) {
  const vn = new Date(now.getTime() + 7 * 3600000 - 6 * 86400000); // lùi 6 ngày công bố
  let y = vn.getUTCFullYear();
  let m = vn.getUTCMonth(); // 0-11, tức tháng trước của tháng (đã lùi) hiện tại
  if (m === 0) { m = 12; y -= 1; }
  const cpiPeriod = `T${m}/${y}`;
  const q = Math.floor((vn.getUTCMonth()) / 3); // quý đã kết thúc gần nhất (0 = Q4 năm trước)
  const gdpPeriod = q === 0 ? `Q4/${vn.getUTCFullYear() - 1}` : `Q${q}/${vn.getUTCFullYear()}`;
  return { cpiPeriod, gdpPeriod };
}

// Ghi số GDP/CPI mới vào lịch sử: chỉ tạo kỳ mới khi số liệu đổi (tránh gán nhầm kỳ khi nguồn chưa cập nhật)
function previousPeriod(period) {
  let m = /^T(\d{1,2})\/(\d{4})$/.exec(period);
  if (m) return Number(m[1]) === 1 ? `T12/${Number(m[2]) - 1}` : `T${Number(m[1]) - 1}/${m[2]}`;
  m = /^Q([1-4])\/(\d{4})$/.exec(period);
  if (m) return Number(m[1]) === 1 ? `Q4/${Number(m[2]) - 1}` : `Q${Number(m[1]) - 1}/${m[2]}`;
  return null;
}

function upsertSeries(list, period, valueKey, live, target) {
  const arr = Array.isArray(list) ? [...list] : [];
  const head = arr[0];
  if (head && head[valueKey] === live.value && (head.change ?? null) === live.change) {
    return arr; // nguồn chưa có số mới
  }
  if (head && head.period === period) {
    arr[0] = { ...head, [valueKey]: live.value, change: live.change, source: 'TradingView (tự động)' };
  } else {
    arr.unshift({ period, [valueKey]: live.value, change: live.change, target, source: 'TradingView (tự động)' });
  }
  // Kỳ liền trước = số mới − chênh lệch mà nguồn công bố (sửa số nhập tay cũ nếu lệch)
  const prev = previousPeriod(period);
  if (live.change !== null && prev) {
    const prevValue = Number((live.value - live.change).toFixed(2));
    const idx = arr.findIndex((r) => r.period === prev);
    if (idx >= 0) {
      if (arr[idx][valueKey] !== prevValue) {
        const { mom: _staleMom, ...rest } = arr[idx]; // số tháng/tháng cũ đi kèm số nhập tay sai → bỏ
        void _staleMom;
        arr[idx] = { ...rest, [valueKey]: prevValue, source: 'Suy ra từ TradingView (số mới − chênh lệch)' };
      }
    } else {
      arr.splice(1, 0, { period: prev, [valueKey]: prevValue, target, source: 'Suy ra từ TradingView (số mới − chênh lệch)' });
    }
  }
  return arr.slice(0, 12);
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

  lastBankRates = rates;
  // Lưu vào Supabase
  if (supabase && rates.length > 0) {
    const { error } = await supabase.from('macro_bank_rates').upsert(rates, { onConflict: 'id' });
    if (error) {
      console.error('  [ERROR] Lỗi lưu macro_bank_rates vào Supabase:', error);
    } else {
      console.log(`  ✓ Đã cập nhật thành công ${rates.length} biểu lãi suất ngân hàng vào Supabase!`);
    }
  }
  return rates.length;
}

// ─── Lãi suất huy động 12T (trung vị) ───
const UA_HDR = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)' };
const medianOf = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
async function fetchCafef12M() {
  try {
    const res = await fetch('https://cafef.vn/du-lieu/lai-suat-ngan-hang.chn', { headers: UA_HDR, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const html = await res.text();
    const out = {};
    const re = /"name":"([^"]+)","symbol":"([^"]*)","icon":"[^"]*","interestRates":\[(.*?)\]\}/g;
    for (const m of html.matchAll(re)) {
      const v = /"time":"12T","deposit":12,"value":([0-9.]+)/.exec(m[3]);
      const rate = v ? Number(v[1]) : NaN;
      if (Number.isFinite(rate) && rate > 0 && rate < 20) out[m[2] || m[1]] = rate;
    }
    return Object.keys(out).length >= 15 ? out : null;
  } catch {
    return null;
  }
}
async function fetchVcb12M() {
  try {
    const res = await fetch('https://www.vietcombank.com.vn/vi-VN/api/interestrates?accountType=Personal', {
      headers: { ...UA_HDR, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const row = (j.Data || []).find((r) => r.tenor === '12-months' && r.currencyCode === 'VND');
    const value = row ? Number((row.rates * 100).toFixed(2)) : NaN;
    return Number.isFinite(value) && value > 0 ? { value, updatedAt: j.UpdatedDate } : null;
  } catch {
    return null;
  }
}
async function fetchDeposit12MMedian() {
  const [cafef, vcb] = await Promise.all([fetchCafef12M(), fetchVcb12M()]);
  if (cafef) {
    const stale = vcb && typeof cafef.VCB === 'number' && Math.abs(cafef.VCB - vcb.value) > 0.3;
    if (!stale) {
      const rates = Object.values(cafef);
      return { value: Number(medianOf(rates).toFixed(2)), source: `CafeF, trung vị ${rates.length} ngân hàng${vcb ? ` (khớp Vietcombank ${vcb.value}%)` : ''}` };
    }
    console.log('  - CafeF lệch Vietcombank chính thức > 0,3 điểm: bỏ qua bảng CafeF');
  }
  // Dự phòng: bảng 24hMoney vừa cào ở bước trước
  const dep12 = lastBankRates
    .filter((r) => r.type === 'counter')
    .map((r) => Number(String(r.rate_12m).replace(',', '.')))
    .filter((v) => Number.isFinite(v) && v > 0 && v < 20);
  if (dep12.length >= 5) return { value: Number(medianOf(dep12).toFixed(2)), source: `24hMoney (dự phòng), trung vị ${dep12.length} ngân hàng` };
  return null;
}

async function crawlSbvInterestRates() {
  console.log(`\n[3/4] Đang cào dữ liệu Lãi Suất Liên Ngân Hàng & Điều Hành NHNN...`);
  const macroJsonPath = path.resolve(__dirname, '../frontend/src/features/market/data/macroDatabase.json');
  
  // Bắt đầu từ số đã lưu (KHÔNG gán cứng số liệu); chỉ ghi đè bằng số thật lấy được ở dưới
  let stored = [];
  try {
    stored = JSON.parse(fs.readFileSync(macroJsonPath, 'utf8')).interestRate || [];
  } catch {}
  const pick = (pred, fallback) => ({ ...(stored.find(pred) || fallback) });
  let rates = [
    pick((r) => r.term === '12M', { bank: 'Huy động 12T (Trung vị)', rate: '-', term: '12M', type: 'deposit' }),
    pick((r) => r.term === 'ON', { bank: 'Liên ngân hàng', rate: '-', term: 'ON', type: 'interbank' }),
    pick((r) => r.bank && r.bank.includes('Tái cấp vốn'), { bank: 'Lãi suất Tái cấp vốn NHNN', rate: '-', term: 'Chính sách' }),
    pick((r) => r.bank && r.bank.includes('Tái chiết khấu'), { bank: 'Lãi suất Tái chiết khấu NHNN', rate: '-', term: 'Chính sách' }),
    pick((r) => r.term === '3M', { bank: 'Lãi suất Liên ngân hàng (VNIBOR)', rate: '-', term: '3M', type: 'interbank' }),
  ].map((r) => ({ ...r, isCrawled: false }));
  const nowIso = new Date().toISOString();
  const setRate = (pred, value, source) => {
    const item = rates.find(pred);
    if (item && Number.isFinite(value)) {
      item.rate = `${Number(value).toFixed(2)}%`;
      item.isCrawled = true;
      item.source = source;
      item.updatedAt = nowIso;
    }
  };

  // 0. Số chính thức qua TradingView: lãi suất điều hành (tái cấp vốn) & liên ngân hàng
  const tvPolicy = await fetchTvIndicator('ECONOMICS:VNINTR');
  if (tvPolicy) setRate((r) => r.bank.includes('Tái cấp vốn'), tvPolicy.value, 'NHNN qua TradingView');
  const tvInterbank = await fetchTvIndicator('ECONOMICS:VNINBR');
  if (tvInterbank) {
    setRate((r) => r.term === 'ON', tvInterbank.value, 'Liên ngân hàng qua TradingView');
    const on = rates.find((r) => r.term === 'ON');
    if (on) on.bank = 'Liên ngân hàng';
  }
  // Huy động 12T: trung vị CafeF (đối chiếu Vietcombank chính thức), dự phòng 24hMoney
  // (cùng cách tính với frontend/src/features/market/services/depositRates.ts)
  const dep = await fetchDeposit12MMedian();
  if (dep) {
    setRate((r) => r.term === '12M', dep.value, dep.source);
    const item = rates.find((r) => r.term === '12M');
    if (item) item.bank = 'Huy động 12T (Trung vị)';
    console.log(`  ✓ Huy động 12T: ${dep.value}% — ${dep.source}`);
  }

  // 1. Cào Lãi suất liên ngân hàng VNIBOR từ Simplize Macro (__NEXT_DATA__)
  try {
    const res = await fetch('https://simplize.vn/vi-mo/lai-suat-lien-ngan-hang', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/);
      if (match) {
        const json = JSON.parse(match[1]);
        const interbankData = json?.props?.pageProps?.data;
        const vniborItem = rates.find((r) => r.bank.includes('VNIBOR'));
        // Trang này là chuỗi "Lãi suất liên ngân hàng" (cùng chuỗi ECONOMICS:VNINBR), KHÔNG phải VNIBOR 3 tháng.
        // Chỉ dùng làm dự phòng cho dòng liên ngân hàng khi TradingView lỗi.
        const onItem = rates.find((r) => r.term === 'ON');
        if (onItem && !onItem.isCrawled && interbankData && interbankData.current) {
          onItem.rate = `${interbankData.current}%`;
          onItem.isCrawled = true;
          onItem.updatedAt = nowIso;
          onItem.source = 'Liên ngân hàng qua Simplize';
          console.log(`  ✓ Lãi suất liên ngân hàng (dự phòng Simplize): ${interbankData.current}%`);
        }
        void vniborItem;
      }
    }
  } catch (e) {
    console.log('  - Lỗi cào liên ngân hàng Simplize:', e.message);
  }

  // 2. Cào Lãi suất Điều hành NHNN (Tái cấp vốn / Tái chiết khấu)
  try {
    const res = await fetch('https://24hmoney.vn/lai-suat-ngan-hang', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });
    if (res.ok) {
      const html = await res.text();
      const refMatch = html.match(/tái cấp vốn[^\d]{1,30}(\d+[.,]\d+)\s*%/i);
      const discMatch = html.match(/tái chiết khấu[^\d]{1,30}(\d+[.,]\d+)\s*%/i);

      const refItem = rates.find((r) => r.bank.includes('Tái cấp vốn'));
      const discItem = rates.find((r) => r.bank.includes('Tái chiết khấu'));

      // Chỉ dùng 24hMoney khi TradingView không có số điều hành
      if (refItem && refMatch && refMatch[1] && !refItem.isCrawled) {
        refItem.rate = `${refMatch[1].replace(',', '.')}%`;
        refItem.isCrawled = true;
        refItem.updatedAt = nowIso;
      }
      if (discItem && discMatch && discMatch[1]) {
        discItem.rate = `${discMatch[1].replace(',', '.')}%`;
        discItem.isCrawled = true;
        discItem.updatedAt = nowIso;
      }
    }
  } catch (e) {
    console.log('  - Giữ nguyên lãi suất điều hành NHNN (Fallback):', e.message);
  }

  const nowTimeStr = new Date().toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + new Date().toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (fs.existsSync(macroJsonPath)) {
    try {
      const macroData = JSON.parse(fs.readFileSync(macroJsonPath, 'utf8'));
      // Chỉ lưu số thật lấy được; không giữ dòng chưa có nguồn
      macroData.interestRate = rates.filter((r) => r.isCrawled);
      macroData.interestRateLastCrawled = nowTimeStr;

      // Lịch sử điều kiện vốn theo ngày (cho câu hỏi "Vốn nới hay chặt" ở vòng tròn vĩ mô)
      const vnToday = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
      const rateOf = (pred) => {
        const r = rates.find(pred);
        const v = r && r.isCrawled ? parseFloat(String(r.rate).replace('%', '')) : NaN;
        return Number.isFinite(v) ? v : null;
      };
      const point = {
        date: vnToday,
        interbank: rateOf((r) => r.term === 'ON'),
        deposit12M: rateOf((r) => r.term === '12M'),
        policy: rateOf((r) => r.bank && r.bank.includes('Tái cấp vốn')),
      };
      if (point.interbank !== null || point.deposit12M !== null) {
        const hist = Array.isArray(macroData.capitalHistory) ? macroData.capitalHistory.filter((h) => h.date !== vnToday) : [];
        hist.push(point);
        hist.sort((a, b) => a.date.localeCompare(b.date));
        macroData.capitalHistory = hist.slice(-500);
        console.log(`  ✓ Lịch sử vốn: ${macroData.capitalHistory.length} ngày (liên NH ${point.interbank}%, gửi 12T ${point.deposit12M}%)`);
      }

      // GDP & CPI tự động (không nhập tay)
      const { cpiPeriod, gdpPeriod } = latestReleasedPeriods();
      const tvCpi = await fetchTvIndicator('ECONOMICS:VNIRYY');
      if (tvCpi) {
        macroData.cpi = upsertSeries(macroData.cpi, cpiPeriod, 'yoy', tvCpi, (macroData.cpi && macroData.cpi[0] && macroData.cpi[0].target) || 4.5);
        console.log(`  ✓ CPI: ${tvCpi.value}% (Δ ${tvCpi.change}) — kỳ ${macroData.cpi[0].period}`);
      }
      const tvGdp = await fetchTvIndicator('ECONOMICS:VNGDPYY');
      if (tvGdp) {
        macroData.gdp = upsertSeries(macroData.gdp, gdpPeriod, 'growthRate', tvGdp, (macroData.gdp && macroData.gdp[0] && macroData.gdp[0].target) || 6.5);
        console.log(`  ✓ GDP: ${tvGdp.value}% (Δ ${tvGdp.change}) — kỳ ${macroData.gdp[0].period}`);
      }
      macroData.interestRateSource = 'Ngân hàng Nhà nước & Thị trường liên ngân hàng';
      fs.writeFileSync(macroJsonPath, JSON.stringify(macroData, null, 2), 'utf8');
      console.log(`  ✓ Đã cào & cập nhật Lãi suất liên ngân hàng & điều hành vào macroDatabase.json (${nowTimeStr})!`);
    } catch (err) {
      console.error('  [ERROR] Lỗi ghi macroDatabase.json:', err.message);
    }
  }
  return rates;
}

async function syncMacroIndicators() {
  console.log(`\n[4/4] Đang đồng bộ chỉ số vĩ mô vào Supabase...`);
  if (!supabase) {
    console.log('  - Bỏ qua (không có khoá Supabase).');
    return;
  }
  try {
    const macroJsonPath = path.resolve(__dirname, '../frontend/src/features/market/data/macroDatabase.json');
    if (fs.existsSync(macroJsonPath)) {
      const macroData = JSON.parse(fs.readFileSync(macroJsonPath, 'utf8'));
      const nowStr = new Date().toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const { error } = await supabase.from('macro_indicators').upsert([
        { id: 'gdp', type: 'gdp', data: macroData.gdp, cycle_assessment: 'Mở Rộng Kinh Tế Mạnh', updated_at: `Kỳ ${macroData.gdp[0]?.period} (GSO & SBV)` },
        { id: 'cpi', type: 'cpi', data: macroData.cpi, updated_at: `Kỳ ${macroData.cpi[0]?.period} (GSO)` },
        { id: 'interest_rate', type: 'interest_rate', data: macroData.interestRate, updated_at: nowStr },
      ], { onConflict: 'id' });

      if (error) {
        console.log('  - Lưu ý Supabase macro_indicators:', error.message);
      } else {
        console.log(`  ✓ Đã đồng bộ thành công chỉ số GDP, CPI và Lãi suất điều hành vào Supabase!`);
      }
    }
  } catch (e) {
    console.error('  [ERROR] Lỗi đồng bộ macro_indicators:', e.message);
  }
}

async function run() {
  console.log(`\n=============================================================`);
  console.log(`🚀 [CRONJOB] BẮT ĐẦU CẬP NHẬT DỮ LIỆU VĨ MÔ (${new Date().toLocaleString('vi-VN')})`);
  console.log(`=============================================================`);

  const startTime = Date.now();
  await fetchCommodities();
  await fetchBankRates();
  await crawlSbvInterestRates();
  await syncMacroIndicators();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`=============================================================`);
  console.log(`✅ [CRONJOB] HOÀN TẤT THÀNH CÔNG trong ${elapsed}s!`);
  console.log(`=============================================================\n`);
}

run().catch((err) => {
  console.error('[CRON ERROR]', err);
  process.exit(1);
});
