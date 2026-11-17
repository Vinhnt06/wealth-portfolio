#!/usr/bin/env node
/**
 * Kiểm chứng hai yếu tố bổ sung cho quyết định MUA: (1) sức khỏe doanh nghiệp, (2) ngành dẫn dắt.
 *
 *   node scripts/validate_quality_factors.mjs <thư-mục-nến> [--json out.json]
 *
 * Điểm-theo-thời-điểm (không nhìn trước):
 *   • Doanh nghiệp: chỉ dùng quý đã CÔNG BỐ (kết thúc quý + 45 ngày) tại đúng ngày xét. Dữ liệu chỉ có 8 quý cho ~82 mã
 *     nên chỉ phủ được ~1 năm gần nhất → mẫu nhỏ, kết quả mang tính tham khảo.
 *   • Ngành: thứ hạng sức mạnh tương đối 3 tháng của ngành (ICB, trung bình cộng các mã trong rổ) so với VN-Index tại ngày xét.
 *     Đây là PHÉP XẤP XỈ của xếp hạng ngành trong ứng dụng (ứng dụng dùng 16 nhóm tuỳ chỉnh), cùng ý tưởng nhưng không giống hệt.
 */
import fs from 'node:fs';
import { loadAppModules, loadCandles, buildRsAt, ttCount, sma, mean, median } from './lib/pointInTime.mjs';

const cacheDir = process.argv[2];
if (!cacheDir) { console.error('Thiếu thư mục nến'); process.exit(1); }
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;

const M = await loadAppModules(['stageEngine', 'wyckoffEngine', 'wyckoffContext', 'decisionEngine', 'fundamentalsEngine', 'sectorStrength']);
const { data, vnindex, syms } = loadCandles(cacheDir);
const rsAt = buildRsAt(data, syms);
const fin = JSON.parse(fs.readFileSync('frontend/src/features/market/data/financialsDatabase.json', 'utf8')).data;
const sectorOf = JSON.parse(fs.readFileSync('frontend/src/features/market/data/sectorFullMapping.json', 'utf8'));

const marketUpAt = new Map();
for (let i = 200; i < vnindex.c.length; i++) marketUpAt.set(vnindex.dates[i], vnindex.c[i] > sma(vnindex.c, 50, i) && vnindex.c[i] > sma(vnindex.c, 200, i));

// ── Xếp hạng ngành theo ngày: lợi suất 63 phiên của ngành so với VN-Index ──
const vnRet = new Map();
for (let i = 63; i < vnindex.c.length; i++) vnRet.set(vnindex.dates[i], vnindex.c[i] / vnindex.c[i - 63] - 1);
const bySectorDate = new Map(); // date → sector → [ret63...]
for (const s of syms) {
  const sec = sectorOf[s];
  if (!sec) continue;
  const d = data[s];
  for (let i = 63; i < d.c.length; i++) {
    const date = d.dates[i];
    if (!vnRet.has(date)) continue;
    if (!bySectorDate.has(date)) bySectorDate.set(date, new Map());
    const m = bySectorDate.get(date);
    if (!m.has(sec)) m.set(sec, []);
    m.get(sec).push(d.c[i] / d.c[i - 63] - 1);
  }
}
const sectorRankAt = new Map(); // date|sector → {rank,total}
for (const [date, m] of bySectorDate) {
  const rows = [];
  for (const [sec, arr] of m) if (arr.length >= 3) rows.push([sec, mean(arr) - vnRet.get(date)]);
  rows.sort((a, b) => b[1] - a[1]);
  rows.forEach(([sec], k) => sectorRankAt.set(`${date}|${sec}`, { rank: k + 1, total: rows.length }));
}

const START = 300, TAIL = 130;
const groups = {};
const add = (key, f20, f60, dd) => {
  const g = (groups[key] ||= { n: 0, f20: [], f60: [], dd: [] });
  g.n++;
  if (f20 !== null) g.f20.push(f20);
  if (f60 !== null) g.f60.push(f60);
  if (dd !== null) g.dd.push(dd);
};
const r2 = (v) => Math.round(v * 100) / 100;

for (const s of syms) {
  const d = data[s];
  const sec = sectorOf[s];
  const quarters = fin[s]?.quarterlyHistory;
  for (let i = START; i < d.c.length; i++) {
    const date = d.dates[i];
    const rs = rsAt.get(`${s}|${date}`);
    const tt = ttCount(d, i, rs);
    const st = M.stageEngine.classifyStage({ closes: d.c, highs: d.h, lows: d.l, idx: i, passedCount: tt ?? undefined });
    if (st.sub === 'INSUFFICIENT') continue;
    const sl = (a) => a.slice(Math.max(0, i + 1 - TAIL), i + 1);
    const closes = sl(d.c), highs = sl(d.h), lows = sl(d.l), opens = sl(d.o), volumes = sl(d.v);
    const m = (n) => r2(sma(d.c, n, i));
    const hi52 = Math.max(...d.h.slice(Math.max(0, i - 251), i + 1));
    const wy = M.wyckoffEngine.analyzeWyckoff({ opens, highs, lows, closes, volumes, isIndex: false, sma20: m(20), sma50: m(50), sma150: m(150), sma200: m(200), distFrom52WHighPct: Math.round(((d.c[i] - hi52) / hi52) * 1000) / 10 });
    const dist = M.wyckoffContext.detectDistribution({ opens, highs, lows, closes, volumes });
    const ctx = M.wyckoffContext.buildCycleContext({ stage: st, wy, dist });
    const dec = M.decisionEngine.buildDecision({
      stage: st, ttPassed: tt ?? 0, ttFailedIds: [], ctx, rsRating: rs ?? 0, price: d.c[i], ma20: sma(d.c, 20, i), ma50: sma(d.c, 50, i), ma150: sma(d.c, 150, i), ma200: sma(d.c, 200, i),
      pivot: wy.diagnostics.last20High, baseLow: wy.diagnostics.priorBaseLow, distFromSMA20Pct: 0, marketUp: marketUpAt.has(date) ? marketUpAt.get(date) : null,
    });
    // Chỉ xét các ngày mà khung Stage cho phép (Stage 2 đủ 8/8): đây là tập "ứng viên" Minervini
    const candidate = st.stage === 2 && st.confirmed;
    const isBuy = dec.newBuyer.action === 'BUY';
    if (!candidate && !isBuy) continue;

    const f = (n) => (i + n < d.c.length ? (d.c[i + n] / d.c[i] - 1) * 100 : null);
    const dd = i + 20 < d.c.length ? (Math.min(...d.l.slice(i + 1, i + 21)) / d.c[i] - 1) * 100 : null;
    const sr = sec ? sectorRankAt.get(`${date}|${sec}`) : null;
    const tone = sr ? M.sectorStrength.sectorTone(sr.rank, sr.total) : 'UNKNOWN';
    const fund = quarters ? M.fundamentalsEngine.assessFundamentals(quarters, date).state : 'NO_DATA';

    const tag = (prefix) => {
      add(`${prefix}|ALL`, f(20), f(60), dd);
      add(`${prefix}|sector:${tone}`, f(20), f(60), dd);
      add(`${prefix}|fund:${fund}`, f(20), f(60), dd);
      if (fund !== 'NO_DATA') add(`${prefix}|fund-known:${fund}`, f(20), f(60), dd);
      add(`${prefix}|sector:${tone}+fund:${fund}`, f(20), f(60), dd);
    };
    // Đối chứng cùng giai đoạn: chỉ xét các ngày từ khi dữ liệu tài chính bắt đầu có hiệu lực (cùng một thị trường)
    if (date >= '2025-11-15') {
      const lab = quarters ? 'CÓ-DỮ-LIỆU-TC' : 'KHÔNG-CÓ-DỮ-LIỆU-TC';
      if (candidate) { add(`S2·8/8|cùng-kỳ:${lab}`, f(20), f(60), dd); add(`S2·8/8|cùng-kỳ:ALL`, f(20), f(60), dd); }
      if (isBuy) { add(`BUY|cùng-kỳ:${lab}`, f(20), f(60), dd); add(`BUY|cùng-kỳ:ALL`, f(20), f(60), dd); }
    }
    if (candidate) tag('S2·8/8');
    if (isBuy) tag('BUY');
  }
}

const se = (a) => { if (a.length < 2) return null; const mu = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / (a.length - 1)) / Math.sqrt(a.length); };
const pos = (a) => (a.length ? Math.round((a.filter((x) => x > 0).length / a.length) * 100) : null);
const out = Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, {
  n: g.n,
  f20: { mean: r2(mean(g.f20)), median: r2(median(g.f20)), pos: pos(g.f20) },
  f60: { mean: r2(mean(g.f60)), median: r2(median(g.f60)), pos: pos(g.f60), se: g.f60.length ? r2(se(g.f60)) : null },
  dd20: { median: r2(median(g.dd)) },
}]));

const show = (title, prefix, kinds) => {
  console.log(`\n── ${title} ──`);
  console.log('nhóm'.padEnd(34) + 'n'.padStart(7) + '  60p TB (±SE) / trung vị / %dương'.padEnd(40) + '20p TB / %dương'.padEnd(18) + 'sụt20p');
  for (const k of kinds) {
    const r = out[`${prefix}|${k}`];
    if (!r || r.n < 100) continue;
    console.log(k.padEnd(34) + String(r.n).padStart(7) + `  ${r.f60.mean} (±${r.f60.se}) / ${r.f60.median} / ${r.f60.pos}%`.padEnd(40) + `${r.f20.mean} / ${r.f20.pos}%`.padEnd(18) + `${r.dd20.median}%`);
  }
};
for (const p of ['S2·8/8', 'BUY']) {
  console.log(`\n================ ${p} ================`);
  show('Theo ngành (xấp xỉ, 3 năm)', p, ['ALL', 'sector:TAILWIND', 'sector:NEUTRAL', 'sector:HEADWIND']);
  show('Theo doanh nghiệp (chỉ ~1 năm, ~82 mã)', p, ['fund-known:STRONG', 'fund-known:OK', 'fund-known:WEAK', 'fund:NO_DATA']);
  show('ĐỐI CHỨNG cùng giai đoạn (từ 15/11/2025)', p, ['cùng-kỳ:ALL', 'cùng-kỳ:CÓ-DỮ-LIỆU-TC', 'cùng-kỳ:KHÔNG-CÓ-DỮ-LIỆU-TC']);
  show('Kết hợp', p, ['sector:TAILWIND+fund:STRONG', 'sector:TAILWIND+fund:OK', 'sector:HEADWIND+fund:WEAK', 'sector:HEADWIND+fund:OK']);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
