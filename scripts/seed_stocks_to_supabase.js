/**
 * Script to seed 1,522 Vietnam stock profiles into Supabase
 * Usage:
 *   node scripts/seed_stocks_to_supabase.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse environment variables from frontend/.env.local if available
function loadEnv() {
  const envPath = path.resolve(__dirname, '../frontend/.env.local');
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

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rtuqzohnkknjaquxsupj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey || supabaseKey.includes('your-supabase-anon-key')) {
  console.error('\x1b[31m[ERROR] Chưa cấu hình Supabase API Key hợp lệ trong frontend/.env.local!\x1b[0m');
  console.error('Vui lòng cập nhật NEXT_PUBLIC_SUPABASE_ANON_KEY hoặc SUPABASE_SERVICE_ROLE_KEY vào frontend/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedStocks() {
  const dataPath = path.resolve(__dirname, '../frontend/src/features/market/data/stockDatabase.json');
  if (!fs.existsSync(dataPath)) {
    console.error('[ERROR] Không tìm thấy file stockDatabase.json');
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const stocks = JSON.parse(rawData);

  console.log(`\x1b[34m[INFO] Bắt đầu đồng bộ ${stocks.length} mã cổ phiếu vào Supabase (${supabaseUrl})...\x1b[0m`);

  const BATCH_SIZE = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE).map((item) => ({
      symbol: item.symbol.toUpperCase().trim(),
      name: item.name,
      exchange: item.exchange,
      sector: item.sector || '',
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('stocks').upsert(batch, {
      onConflict: 'symbol',
    });

    if (error) {
      console.error(`\x1b[31m[ERROR] Lỗi khi nạp batch ${i / BATCH_SIZE + 1}: ${error.message}\x1b[0m`);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
      process.stdout.write(`\r\x1b[32m[PROGRESS] Đã đồng bộ: ${successCount}/${stocks.length} mã...\x1b[0m`);
    }
  }

  console.log('\n\x1b[32m====================================================\x1b[0m');
  console.log(`\x1b[32m[HOÀN TẤT] Đồng bộ thành công: ${successCount} mã cổ phiếu vào Supabase!\x1b[0m`);
  if (errorCount > 0) {
    console.log(`\x1b[33m[CẢNH BÁO] Có ${errorCount} mã gặp lỗi.\x1b[0m`);
  }
}

seedStocks().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
