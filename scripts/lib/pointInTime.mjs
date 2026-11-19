/**
 * Thư viện dùng chung cho các script kiểm chứng: nạp nến, biên dịch module TS của ứng dụng,
 * tính RS Rating và số tiêu chí Trend Template THEO THỜI ĐIỂM (không nhìn trước).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require(path.resolve('frontend/node_modules/typescript'));

/** Biên dịch tạm các module TS thuần của ứng dụng và import chúng */
export async function loadAppModules(names) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yf-mod-'));
  const out = {};
  for (const n of names) {
    const src = fs.readFileSync(`frontend/src/features/market/utils/${n}.ts`, 'utf8');
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
    fs.writeFileSync(path.join(tmp, `${n}.mjs`), js);
  }
  for (const n of names) out[n] = await import(pathToFileURL(path.join(tmp, `${n}.mjs`)).href);
  return out;
}

export function loadCandles(cacheDir, minBars = 320) {
  const data = {};
  for (const f of fs.readdirSync(cacheDir)) {
    if (!f.endsWith('.json')) continue;
    const rows = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf8'));
    if (rows.length < minBars) continue;
    data[f.slice(0, -5)] = {
      dates: rows.map((r) => r[0]),
      o: rows.map((r) => r[1]),
      h: rows.map((r) => r[2]),
      l: rows.map((r) => r[3]),
      c: rows.map((r) => r[4]),
      v: rows.map((r) => r[5]),
    };
  }
  const vnindex = data.VNINDEX;
  delete data.VNINDEX;
  return { data, vnindex, syms: Object.keys(data) };
}

export const sma = (arr, n, i) => {
  if (i < n - 1) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += arr[k];
  return s / n;
};
const roc = (c, i, n) => (i - n >= 0 && c[i - n] > 0 ? (c[i] - c[i - n]) / c[i - n] : null);
const rawRs = (c, i) => {
  const r = [63, 126, 189, 252].map((n) => roc(c, i, n));
  return r.some((x) => x === null) ? null : 0.4 * r[0] + 0.2 * r[1] + 0.2 * r[2] + 0.2 * r[3];
};

/** Map "SYM|date" → RS Rating (1–99) tính bằng phân vị trong rổ tại đúng ngày đó */
export function buildRsAt(data, syms) {
  const byDate = new Map();
  for (const s of syms) {
    const d = data[s];
    for (let i = 0; i < d.c.length; i++) {
      const r = rawRs(d.c, i);
      if (r !== null) {
        if (!byDate.has(d.dates[i])) byDate.set(d.dates[i], []);
        byDate.get(d.dates[i]).push([r, s]);
      }
    }
  }
  const rsAt = new Map();
  for (const [date, lst] of byDate) {
    if (lst.length < 50) continue;
    lst.sort((a, b) => b[0] - a[0]);
    lst.forEach(([, s], k) => rsAt.set(`${s}|${date}`, Math.round(99 - (k / (lst.length - 1)) * 98)));
  }
  return rsAt;
}

/** Số tiêu chí Trend Template (0–8) tại phiên i; null nếu thiếu dữ liệu */
export function ttCount(d, i, rs) {
  const c = d.c;
  const p = c[i];
  const m50 = sma(c, 50, i), m150 = sma(c, 150, i), m200 = sma(c, 200, i);
  const m200p = sma(c, 200, i - 22), m200m = sma(c, 200, i - 11);
  if ([m50, m150, m200, m200p].some((x) => x === null) || i < 252 || rs === undefined) return null;
  const slope = m200 > m200p && (m200m === null || m200 >= m200m * 0.999);
  let hi = -Infinity, lo = Infinity;
  for (let k = i - 251; k <= i; k++) { hi = Math.max(hi, d.h[k]); lo = Math.min(lo, d.l[k]); }
  hi = Math.max(hi, p); lo = Math.min(lo, p);
  const flags = [p > m150 && p > m200, m150 > m200, slope, m50 > m150 && m50 > m200, p > m50, ((p - lo) / lo) * 100 >= 30, ((p - hi) / hi) * 100 >= -25, rs >= 70];
  return flags.filter(Boolean).length;
}

export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const median = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
