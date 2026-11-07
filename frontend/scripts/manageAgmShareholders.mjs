#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../src/features/market/data/totalShareholdersHistory.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    console.error('Lỗi đọc file JSON:', e.message);
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Đã lưu dữ liệu thành công vào ${DATA_FILE}`);
}

function recalculateMetrics(list) {
  list.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
  return list.map((item, idx) => {
    const prev = idx > 0 ? list[idx - 1] : null;
    const changeFromPrev = prev ? item.totalShareholders - prev.totalShareholders : 0;
    const changePercent = prev && prev.totalShareholders > 0
      ? Number(((changeFromPrev / prev.totalShareholders) * 100).toFixed(2))
      : 0;

    return {
      year: item.year.toString(),
      period: item.period || `ĐHĐCĐ ${item.year}`,
      totalShareholders: Number(item.totalShareholders),
      changeFromPrev,
      changePercent,
      recordDate: item.recordDate || undefined,
      sourceDoc: item.sourceDoc || 'Biên bản họp ĐHĐCĐ thường niên'
    };
  });
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  console.log(`
Công Cụ Quản Lý Dữ Liệu Biến Động Cổ Đông ĐHĐCĐ (YourFin AGM Manager)
Cách dùng:
  node scripts/manageAgmShareholders.mjs list [symbol]
  node scripts/manageAgmShareholders.mjs add <symbol> <year> <count> <recordDate> "<sourceDoc>"
  node scripts/manageAgmShareholders.mjs remove <symbol> <year>

Ví dụ:
  node scripts/manageAgmShareholders.mjs list SSI
  node scripts/manageAgmShareholders.mjs add HPG 2025 194000 2025-03-25 "Biên bản kiểm tra tư cách cổ đông ĐHĐCĐ HPG 2025"
`);
  process.exit(0);
}

const db = loadData();

if (command === 'list') {
  const symbol = args[1]?.toUpperCase();
  if (symbol) {
    const records = db[symbol];
    if (!records || records.length === 0) {
      console.log(`Mã [${symbol}] chưa có dữ liệu ĐHĐCĐ.`);
    } else {
      console.log(`\n=== DANH SÁCH ĐHĐCĐ MÃ ${symbol} (${records.length} kỳ) ===`);
      console.table(records);
    }
  } else {
    console.log(`\n=== TẤT CẢ CÁC MÃ ĐÃ CÓ DỮ LIỆU ĐHĐCĐ (${Object.keys(db).length} mã) ===`);
    Object.keys(db).forEach((sym) => {
      const list = db[sym];
      const latest = list[list.length - 1];
      console.log(`- ${sym}: ${list.length} mốc, gần nhất ĐHĐCĐ ${latest?.year} (${latest?.totalShareholders.toLocaleString('vi-VN')} CĐ) | Nguồn: ${latest?.sourceDoc}`);
    });
  }
} else if (command === 'add') {
  const symbol = args[1]?.toUpperCase();
  const year = args[2];
  const count = parseInt(args[3], 10);
  const recordDate = args[4];
  const sourceDoc = args[5];

  if (!symbol || !year || isNaN(count) || !sourceDoc) {
    console.error('❌ Thiếu tham số! Cú pháp: add <symbol> <year> <count> <recordDate> "<sourceDoc>"');
    process.exit(1);
  }

  if (!db[symbol]) db[symbol] = [];
  const existingIdx = db[symbol].findIndex((r) => r.year.toString() === year.toString());
  const newRecord = {
    year: year.toString(),
    period: `ĐHĐCĐ ${year}`,
    totalShareholders: count,
    changeFromPrev: 0,
    changePercent: 0,
    recordDate: recordDate || undefined,
    sourceDoc,
  };

  if (existingIdx >= 0) {
    db[symbol][existingIdx] = newRecord;
    console.log(`Cập nhật mốc ${year} cho ${symbol}.`);
  } else {
    db[symbol].push(newRecord);
    console.log(`Thêm mới mốc ${year} cho ${symbol}.`);
  }

  db[symbol] = recalculateMetrics(db[symbol]);
  saveData(db);
} else if (command === 'remove') {
  const symbol = args[1]?.toUpperCase();
  const year = args[2];
  if (!symbol || !year || !db[symbol]) {
    console.error('❌ Không tìm thấy mã hoặc năm cần xóa.');
    process.exit(1);
  }
  db[symbol] = db[symbol].filter((r) => r.year.toString() !== year.toString());
  if (db[symbol].length === 0) {
    delete db[symbol];
  } else {
    db[symbol] = recalculateMetrics(db[symbol]);
  }
  saveData(db);
}
