#!/usr/bin/env node
/**
 * Kiểm chứng bộ xét Stage (frontend/src/features/market/utils/stageEngine.ts) trên lịch sử thật.
 *
 * Dùng CHÍNH module TypeScript của ứng dụng (biên dịch tạm bằng `typescript`), không phải bản chép lại.
 * Cần thư mục nến đã tải bởi scripts/backtest_setups.py (--cache).
 *
 *   node scripts/validate_stage_engine.mjs <thư-mục-nến> [--json out.json]
 *
 * Các phép đo (điểm-theo-thời-điểm, không nhìn trước):
 *   • Lợi suất tương lai 20 / 60 phiên theo từng Stage (trung bình, trung vị, % dương)
 *   • Độ ổn định: độ dài trung bình một "đợt" Stage liên tục, số lần đổi Stage / mã / năm
 *   • Thứ tự chu kỳ: tỷ lệ chuyển tiếp 1→2→3→4→1 so với nhảy cóc / quay ngược
 *   • So sánh với cách xét Stage cũ
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require(path.resolve('frontend/node_modules/typescript'));

const cacheDir = process.argv[2];
if (!cacheDir) {
  console.error('Thiếu thư mục nến');
  process.exit(1);
}
const jsonOutIdx = process.argv.indexOf('--json');
const jsonOut = jsonOutIdx > 0 ? process.argv[jsonOutIdx + 1] : null;

// ── Biên dịch module TS thành JS tạm ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-'));
const src = fs.readFileSync('frontend/src/features/market/utils/stageEngine.ts', 'utf8');
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
fs.writeFileSync(path.join(tmp, 'stageEngine.mjs'), out.outputText);
const { classifyStage, isCycleStep, DEFAULT_STAGE_OPTIONS } = await import(pathToFileURL(path.join(tmp, 'stageEngine.mjs')).href);

// ── Nạp nến ──
const data = {};
for (const f of fs.readdirSync(cacheDir)) {
  if (!f.endsWith('.json')) continue;
  const sym = f.slice(0, -5);
  const rows = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf8'));
  if (rows.length < 320) continue;
  data[sym] = {
    dates: rows.map((r) => r[0]),
    o: rows.map((r) => r[1]),
    h: rows.map((r) => r[2]),
    l: rows.map((r) => r[3]),
    c: rows.map((r) => r[4]),
  };
}
const vnindex = data.VNINDEX;
delete data.VNINDEX;
const syms = Object.keys(data);
console.error(`Nạp ${syms.length} mã`);

// ── RS Rating & số tiêu chí Trend Template theo thời điểm (khớp scripts/backtest_setups.py) ──
const sma = (arr, n, i) => {
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
const ttCount = (d, i, rs) => {
  const c = d.c;
  const p = c[i];
  const m50 = sma(c, 50, i), m150 = sma(c, 150, i), m200 = sma(c, 200, i);
  const m200p = sma(c, 200, i - 22), m200m = sma(c, 200, i - 11);
  if ([m50, m150, m200, m200p].some((x) => x === null) || i < 252) return null;
  const slope = m200 > m200p && (m200m === null || m200 >= m200m * 0.999);
  let hi = -Infinity, lo = Infinity;
  for (let k = i - 251; k <= i; k++) { hi = Math.max(hi, d.h[k]); lo = Math.min(lo, d.l[k]); }
  hi = Math.max(hi, p); lo = Math.min(lo, p);
  const flags = [p > m150 && p > m200, m150 > m200, slope, m50 > m150 && m150 > m200, p > m50, ((p - lo) / lo) * 100 >= 30, ((p - hi) / hi) * 100 >= -25, rs >= 70];
  return flags.filter(Boolean).length;
};

// ── Cách xét Stage CŨ (để so sánh) ──
const oldStage = (d, i, passed) => {
  const p = d.c[i];
  const m50 = sma(d.c, 50, i), m150 = sma(d.c, 150, i), m200 = sma(d.c, 200, i);
  let hi = -Infinity;
  for (let k = Math.max(0, i - 251); k <= i; k++) hi = Math.max(hi, d.h[k]);
  const dist = ((p - hi) / hi) * 100;
  const m200p = sma(d.c, 200, i - 22);
  const slopeUp = m200p !== null && m200 > m200p;
  const intact = p > m150 && p > m200 && m150 > m200 && slopeUp;
  if (passed === 8) return 2;
  if (p < m200 && m50 < m200) return 4;
  if (intact && passed >= 6) return 2;
  if (dist < -20 && m50 < m150) return 3;
  return 1;
};

const FWD = [20, 60];
const START = 300; // đủ dữ liệu cho MA150 + xu hướng trước đó
const variants = {
  'mặc định (slope30/flat1.5/band3/smooth10)': {},
  'không làm mượt': { smoothWindow: 1 },
};

const summarize = (name, pick) => {
  const stageStats = {};
  const trans = {};
  let runs = [];
  let changes = 0, days = 0;
  const stageTT = {};
  for (const s of syms) {
    const d = data[s];
    let prev = null, runLen = 0;
    for (let i = START; i < d.c.length; i++) {
      const rs = rsAt.get(`${s}|${d.dates[i]}`);
      const tt = rs === undefined ? null : ttCount(d, i, rs);
      const st = pick(d, i, tt);
      days++;
      const k = String(st);
      const rec = (stageStats[k] ||= { n: 0, f20: [], f60: [] });
      rec.n++;
      for (const f of FWD) {
        if (i + f < d.c.length) rec['f' + f].push((d.c[i + f] / d.c[i] - 1) * 100);
      }
      if (tt !== null) {
        const t = (stageTT[k] ||= { n: 0, s: [0, 0, 0, 0, 0, 0, 0, 0, 0] });
        t.n++;
        t.s[tt]++;
      }
      if (prev !== null) {
        const step = isCycleStep(prev, st);
        trans[step] = (trans[step] || 0) + 1;
        const key = `${prev}>${st}`;
        trans[key] = (trans[key] || 0) + 1;
        if (step !== 'same') { changes++; runs.push(runLen); runLen = 1; } else runLen++;
      } else runLen = 1;
      prev = st;
    }
  }
  const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const res = { name, days, stages: {}, changesPerStockYear: +(changes / (days / 252)).toFixed(2), medianRun: med(runs), meanRun: +mean(runs).toFixed(1), transitions: trans, stageTT };
  for (const [k, v] of Object.entries(stageStats)) {
    res.stages[k] = {
      share: +((v.n / days) * 100).toFixed(1),
      f20: { mean: +mean(v.f20).toFixed(2), median: +med(v.f20).toFixed(2), pos: +((v.f20.filter((x) => x > 0).length / v.f20.length) * 100).toFixed(1) },
      f60: { mean: +mean(v.f60).toFixed(2), median: +med(v.f60).toFixed(2), pos: +((v.f60.filter((x) => x > 0).length / v.f60.length) * 100).toFixed(1) },
    };
  }
  return res;
};

const results = [];
results.push(summarize('CŨ', (d, i, tt) => oldStage(d, i, tt ?? 0)));
for (const [name, opt] of Object.entries(variants)) {
  results.push(
    summarize(`MỚI (${name})`, (d, i, tt) => classifyStage({ closes: d.c, highs: d.h, lows: d.l, idx: i, passedCount: tt ?? undefined, options: opt }).stage)
  );
}

for (const r of results) {
  console.log(`\n=== ${r.name} — ${r.days.toLocaleString()} mã-phiên ===`);
  console.log(`Đổi Stage: ${r.changesPerStockYear} lần/mã/năm · độ dài đợt trung vị ${r.medianRun} phiên (TB ${r.meanRun})`);
  const t = r.transitions;
  const tot = (t.forward || 0) + (t.back || 0) + (t.jump || 0);
  console.log(`Chuyển tiếp: tiến đúng chu kỳ ${(((t.forward || 0) / tot) * 100).toFixed(0)}% · quay ngược ${(((t.back || 0) / tot) * 100).toFixed(0)}% · nhảy cóc ${(((t.jump || 0) / tot) * 100).toFixed(0)}% (n=${tot})`);
  const pairs = Object.entries(t).filter(([k]) => k.includes('>')).filter(([k]) => k[0] !== k[2]).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join('  ');
  console.log('Top chuyển tiếp: ' + pairs);
  console.log('Stage | tỷ trọng | 20 phiên: TB / trung vị / %dương | 60 phiên: TB / trung vị / %dương');
  for (const k of Object.keys(r.stages).sort()) {
    const s = r.stages[k];
    console.log(`  ${k}    | ${String(s.share).padStart(5)}%  | ${String(s.f20.mean).padStart(6)} / ${String(s.f20.median).padStart(6)} / ${String(s.f20.pos).padStart(5)}%  | ${String(s.f60.mean).padStart(6)} / ${String(s.f60.median).padStart(6)} / ${String(s.f60.pos).padStart(5)}%`);
  }
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ options: DEFAULT_STAGE_OPTIONS, results }, null, 1));
