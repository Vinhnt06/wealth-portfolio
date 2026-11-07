import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'src/features/market/data/totalShareholdersHistory.json');

interface AgmRecordInput {
  symbol: string;
  year: string;
  period?: string;
  totalShareholders: number;
  recordDate?: string;
  sourceDoc: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: AgmRecordInput = await req.json();
    const { symbol, year, period, totalShareholders, recordDate, sourceDoc } = body;

    if (!symbol || !year || !totalShareholders || !sourceDoc) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc (symbol, year, totalShareholders, sourceDoc)' },
        { status: 400 }
      );
    }

    const cleanSymbol = symbol.toUpperCase().trim();
    const cleanYear = year.toString().trim();
    const cleanCount = Math.round(Number(totalShareholders));

    if (isNaN(cleanCount) || cleanCount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Số lượng cổ đông không hợp lệ' },
        { status: 400 }
      );
    }

    // Load existing database
    let db: Record<string, any[]> = {};
    if (fs.existsSync(DATA_FILE)) {
      try {
        db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      } catch (e) {
        db = {};
      }
    }

    if (!db[cleanSymbol]) {
      db[cleanSymbol] = [];
    }

    const existingIndex = db[cleanSymbol].findIndex((r) => r.year.toString() === cleanYear);
    const newRecord = {
      year: cleanYear,
      period: period || `ĐHĐCĐ ${cleanYear}`,
      totalShareholders: cleanCount,
      changeFromPrev: 0,
      changePercent: 0,
      recordDate: recordDate || undefined,
      sourceDoc: sourceDoc.trim(),
    };

    if (existingIndex >= 0) {
      db[cleanSymbol][existingIndex] = newRecord;
    } else {
      db[cleanSymbol].push(newRecord);
    }

    // Sort chronologically and recalculate changes
    db[cleanSymbol].sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
    db[cleanSymbol] = db[cleanSymbol].map((item, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : null;
      const changeFromPrev = prev ? item.totalShareholders - prev.totalShareholders : 0;
      const changePercent = prev && prev.totalShareholders > 0
        ? Number(((changeFromPrev / prev.totalShareholders) * 100).toFixed(2))
        : 0;

      return {
        ...item,
        changeFromPrev,
        changePercent,
      };
    });

    // Save to disk
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: `Đã lưu thành công dữ liệu ĐHĐCĐ ${cleanYear} cho mã ${cleanSymbol}`,
      symbol: cleanSymbol,
      records: db[cleanSymbol],
    });
  } catch (error: any) {
    console.error('Save AGM Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi khi lưu dữ liệu ĐHĐCĐ.' }, { status: 500 });
  }
}
