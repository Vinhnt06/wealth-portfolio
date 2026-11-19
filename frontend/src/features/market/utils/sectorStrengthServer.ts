/**
 * Đọc bảng sức mạnh ngành từ kết quả quét (lastMinerviniScan.json → sectorUniverse, vnindexRet3M).
 * Chỉ dùng phía server. Cache theo thời điểm sửa file để không parse lại mỗi request.
 */
import fs from 'fs';
import path from 'path';
import { computeSectorStrength, SectorReturnRow, SectorStrengthRow } from './sectorStrength';

let cache: { key: string; table: SectorStrengthRow[] } | null = null;

function scanFilePath(): string | null {
  for (const p of [
    path.resolve(process.cwd(), 'src/features/market/data/lastMinerviniScan.json'),
    path.resolve(process.cwd(), 'frontend/src/features/market/data/lastMinerviniScan.json'),
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function getSectorStrengthTable(): SectorStrengthRow[] {
  const file = scanFilePath();
  if (!file) return [];
  try {
    const key = `${file}:${fs.statSync(file).mtimeMs}`;
    if (cache?.key === key) return cache.table;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rows: SectorReturnRow[] = Array.isArray(parsed.sectorUniverse) ? parsed.sectorUniverse : [];
    const indexRet = typeof parsed.vnindexRet3M === 'number' ? parsed.vnindexRet3M : null;
    const table = rows.length > 0 ? computeSectorStrength(rows, indexRet) : [];
    cache = { key, table };
    return table;
  } catch {
    return [];
  }
}
