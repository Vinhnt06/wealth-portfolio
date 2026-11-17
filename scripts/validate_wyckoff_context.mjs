#!/usr/bin/env node
/**
 * Kiểm chứng việc đặt Wyckoff vào bối cảnh Stage (và dấu hiệu phân phối) trên lịch sử thật.
 *
 *   node scripts/validate_wyckoff_context.mjs <thư-mục-nến> [--json out.json]
 *
 * Với mỗi mã-phiên (điểm-theo-thời-điểm) tính: Stage (stageEngine), pha Wyckoff thô (wyckoffEngine),
 * dấu hiệu phân phối + bối cảnh (wyckoffContext). Sau đó đo lợi suất 20/60 phiên tới và mức sụt giảm tối đa 20 phiên tới
 * cho từng nhóm, để xem các quy tắc ra quyết định có cơ sở dữ liệu hay không.
 */
import fs from 'node:fs';
import { loadAppModules, loadCandles, buildRsAt, ttCount, sma, mean, median } from './lib/pointInTime.mjs';

const cacheDir = process.argv[2];
if (!cacheDir) { console.error('Thiếu thư mục nến'); process.exit(1); }
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;

const { stageEngine, wyckoffEngine, wyckoffContext, decisionEngine } = await loadAppModules(['stageEngine', 'wyckoffEngine', 'wyckoffContext', 'decisionEngine']);
const { data, vnindex, syms } = loadCandles(cacheDir);
// Chế độ thị trường theo ngày: VN-Index trên cả MA50 và MA200
const marketUpAt = new Map();
for (let i = 200; i < vnindex.c.length; i++) marketUpAt.set(vnindex.dates[i], vnindex.c[i] > sma(vnindex.c, 50, i) && vnindex.c[i] > sma(vnindex.c, 200, i));
const rsAt = buildRsAt(data, syms);
console.error(`Nạp ${syms.length} mã`);

const START = 300, TAIL = 130;
const groups = {}; // key → {n, f20[], f60[], dd20[]}
const add = (key, f20, f60, dd) => {
  const g = (groups[key] ||= { n: 0, f20: [], f60: [], dd20: [] });
  g.n++;
  if (f20 !== null) g.f20.push(f20);
  if (f60 !== null) g.f60.push(f60);
  if (dd !== null) g.dd20.push(dd);
};
const round2 = (v) => Math.round(v * 100) / 100;

for (const s of syms) {
  const d = data[s];
  for (let i = START; i < d.c.length; i++) {
    const rs = rsAt.get(`${s}|${d.dates[i]}`);
    const tt = ttCount(d, i, rs);
    const st = stageEngine.classifyStage({ closes: d.c, highs: d.h, lows: d.l, idx: i, passedCount: tt ?? undefined });
    if (st.sub === 'INSUFFICIENT') continue;

    const sl = (a) => a.slice(Math.max(0, i + 1 - TAIL), i + 1);
    const closes = sl(d.c), highs = sl(d.h), lows = sl(d.l), opens = sl(d.o), volumes = sl(d.v);
    const m = (n) => round2(sma(d.c, n, i));
    const hi52 = Math.max(...d.h.slice(Math.max(0, i - 251), i + 1));
    const distHigh = Math.round(((d.c[i] - hi52) / hi52) * 1000) / 10;
    const wy = wyckoffEngine.analyzeWyckoff({ opens, highs, lows, closes, volumes, isIndex: false, sma20: m(20), sma50: m(50), sma150: m(150), sma200: m(200), distFrom52WHighPct: distHigh });
    const dist = wyckoffContext.detectDistribution({ opens, highs, lows, closes, volumes });
    const ctx = wyckoffContext.buildCycleContext({ stage: st, wy, dist });

    const f = (n) => (i + n < d.c.length ? (d.c[i + n] / d.c[i] - 1) * 100 : null);
    let dd = null;
    if (i + 20 < d.c.length) dd = (Math.min(...d.l.slice(i + 1, i + 21)) / d.c[i] - 1) * 100;
    const f20 = f(20), f60 = f(60);

    add('ALL', f20, f60, dd);
    add(`S${st.stage}`, f20, f60, dd);
    // Wyckoff thô theo Stage (cách đọc CŨ: bỏ qua bối cảnh)
    add(`S${st.stage}|raw:${wy.wyckoffPhase.slice(-1)}`, f20, f60, dd);
    if (wy.buyPointCode !== 'NONE' && wy.buyPointCode !== 'HOLD_MARKUP') add(`S${st.stage}|rawBuyPoint`, f20, f60, dd);
    // Dấu hiệu phân phối theo Stage
    add(`S${st.stage}|dist:${dist.level}`, f20, f60, dd);
    // Bối cảnh hợp nhất
    add(`phase:${ctx.phase}`, f20, f60, dd);
    add(`bias:${ctx.bias}|S${st.stage}`, f20, f60, dd);
    if (st.stage === 2) add(`S2${st.confirmed ? '·8/8' : '·chưa 8/8'}|${ctx.bias}`, f20, f60, dd);
    if (st.stage === 4 && ctx.earlyBasing) add('S4|earlyBasing', f20, f60, dd);

    // Quyết định hợp nhất
    const m50 = sma(d.c, 50, i), m150 = sma(d.c, 150, i), m200 = sma(d.c, 200, i);
    const dec = decisionEngine.buildDecision({
      stage: st, ttPassed: tt ?? 0, ttFailedIds: [], ctx, rsRating: rs ?? 0, price: d.c[i], ma20: sma(d.c, 20, i), ma50: m50, ma150: m150, ma200: m200,
      pivot: wy.diagnostics.last20High, baseLow: wy.diagnostics.priorBaseLow, distFromSMA20Pct: 0,
      marketUp: marketUpAt.has(d.dates[i]) ? marketUpAt.get(d.dates[i]) : null,
    });
    add(`dec:${dec.headline}`, f20, f60, dd);
    add(`entry:${dec.newBuyer.action}`, f20, f60, dd);
    add(`holder:${dec.holder.action}`, f20, f60, dd);
    add(`align:${dec.alignment}`, f20, f60, dd);
    if (dec.newBuyer.action === 'BUY') add(`buy:${dec.newBuyer.size}`, f20, f60, dd);
    // Đối chứng: người chỉ dùng Stage 2 (8/8) KHÔNG xét Wyckoff, và người chỉ dùng Wyckoff thô bỏ qua Stage
    if (st.stage === 2 && st.confirmed) add('ctrl:chỉ-Stage2-8/8', f20, f60, dd);
    if (wy.buyPointCode === 'BUY_2_LPS' || wy.buyPointCode === 'BUY_3_BREAKOUT_BU') add('ctrl:chỉ-Wyckoff-D/E-thô', f20, f60, dd);
    if (dec.newBuyer.action === 'BUY') add('ctrl:HỢP-NHẤT-BUY', f20, f60, dd);
  }
}

const fmt = (g) => {
  const pos = (a) => (a.length ? Math.round((a.filter((x) => x > 0).length / a.length) * 100) : null);
  return {
    n: g.n,
    f20: { mean: round2(mean(g.f20)), median: round2(median(g.f20)), pos: pos(g.f20) },
    f60: { mean: round2(mean(g.f60)), median: round2(median(g.f60)), pos: pos(g.f60) },
    dd20: { median: round2(median(g.dd20)), p10: round2([...g.dd20].sort((a, b) => a - b)[Math.floor(g.dd20.length * 0.1)]) },
  };
};
const out = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, fmt(v)]));

const show = (title, keys) => {
  console.log(`\n── ${title} ──`);
  console.log('nhóm'.padEnd(28) + 'n'.padStart(8) + '  20p TB/trung vị/%dương'.padEnd(28) + '60p TB/trung vị/%dương'.padEnd(28) + 'sụt tối đa 20p: trung vị / P10');
  for (const k of keys) {
    const r = out[k];
    if (!r || r.n < 200) continue;
    console.log(k.padEnd(28) + String(r.n).padStart(8) + `  ${r.f20.mean} / ${r.f20.median} / ${r.f20.pos}%`.padEnd(28) + `${r.f60.mean} / ${r.f60.median} / ${r.f60.pos}%`.padEnd(28) + `${r.dd20.median}% / ${r.dd20.p10}%`);
  }
};
show('Theo Stage', ['ALL', 'S1', 'S2', 'S3', 'S4']);
show('Wyckoff THÔ (bỏ qua bối cảnh) theo Stage', ['S4|raw:A','S4|raw:B','S4|raw:C','S4|raw:D','S4|raw:E','S4|rawBuyPoint','S1|raw:B','S1|raw:C','S1|raw:D','S1|raw:E','S1|rawBuyPoint','S2|raw:B','S2|raw:C','S2|raw:D','S2|raw:E','S2|rawBuyPoint','S3|raw:B','S3|raw:C','S3|raw:D','S3|rawBuyPoint']);
show('Dấu hiệu phân phối theo Stage', ['S2|dist:NONE','S2|dist:WATCH','S2|dist:WARNING','S2|dist:CONFIRMED','S1|dist:NONE','S1|dist:WATCH','S1|dist:WARNING','S1|dist:CONFIRMED','S3|dist:NONE','S3|dist:WATCH','S3|dist:WARNING','S3|dist:CONFIRMED','S4|dist:NONE','S4|dist:WATCH','S4|dist:WARNING']);
show('Stage 2 × độ nghiêng Wyckoff (sau bối cảnh)', ['S2·8/8|BULLISH_TIMING','S2·8/8|NEUTRAL','S2·8/8|BEARISH','S2·chưa 8/8|BULLISH_TIMING','S2·chưa 8/8|NEUTRAL','S2·chưa 8/8|BEARISH']);
show('Độ nghiêng Wyckoff × Stage', ['bias:BULLISH_TIMING|S1','bias:NEUTRAL|S1','bias:BEARISH|S1','S4|earlyBasing','bias:BEARISH|S4','bias:NEUTRAL|S4','bias:BEARISH|S3','bias:NEUTRAL|S3']);
show('QUYẾT ĐỊNH hợp nhất — người chưa có vị thế', Object.keys(out).filter((k) => k.startsWith('entry:') || k.startsWith('dec:') || k.startsWith('buy:')).sort());
show('QUYẾT ĐỊNH hợp nhất — người đang có vị thế', Object.keys(out).filter((k) => k.startsWith('holder:')).sort());
show('Mức đồng thuận hai khung', Object.keys(out).filter((k) => k.startsWith('align:')).sort());
show('Đối chứng: dùng một khung vs hợp nhất', Object.keys(out).filter((k) => k.startsWith('ctrl:')).sort());
show('Pha chu kỳ hợp nhất', Object.keys(out).filter((k) => k.startsWith('phase:')).sort());
if (jsonOut) {
  const allDates = Object.values(data).flatMap((d) => d.dates.slice(START));
  const wrapped = {
    meta: {
      generatedAt: new Date().toISOString().slice(0, 19) + 'Z',
      universe: syms.length,
      periodStart: allDates.reduce((m, x) => (x < m ? x : m), allDates[0]),
      periodEnd: allDates.reduce((m, x) => (x > m ? x : m), allDates[0]),
      method: 'Điểm-theo-thời-điểm trên từng mã-phiên: Stage (stageEngine) + Wyckoff (wyckoffEngine) + bối cảnh/phân phối (wyckoffContext) + quyết định (decisionEngine). Lợi suất tương lai tính từ giá đóng cửa phiên xét; sụt giảm tối đa 20 phiên tính theo giá thấp nhất.',
      caveats: [
        'Chỉ ~3 năm dữ liệu, một chu kỳ thị trường; các nhóm có thể trùng lặp theo thời gian (nhiều mã cùng tăng/giảm một lúc) nên số lượng mẫu độc lập thấp hơn n.',
        'Rổ là các mã thanh khoản hiện tại → thiên lệch sống sót.',
        'Đây là thống kê mô tả trạng thái, không phải chiến lược giao dịch có chi phí/trượt giá; chênh lệch giữa các nhóm thường nhỏ so với sai số.',
      ],
    },
    groups: out,
  };
  fs.writeFileSync(jsonOut, JSON.stringify(wrapped, null, 1));
}
