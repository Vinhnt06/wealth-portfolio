#!/usr/bin/env node
/**
 * Backtest cắt lỗ / R:R trên ĐÚNG tín hiệu MUA của ứng dụng (quyết định hợp nhất: Stage 2 đủ 8/8 + Wyckoff Phase D/E).
 *
 *   node scripts/backtest_decision_signals.mjs <thư-mục-nến> <đầu-ra.json>
 *
 * Giống scripts/backtest_setups.py về cách mô phỏng (không nhìn trước, T+2, chi phí 0.4%, 60 phiên, mỗi mã một lệnh một lúc),
 * khác ở TÍN HIỆU VÀO LỆNH: lấy từ chính module quyết định của ứng dụng thay vì quy tắc "phá đỉnh 20 phiên".
 */
import fs from 'node:fs';
import { loadAppModules, loadCandles, buildRsAt, ttCount, sma } from './lib/pointInTime.mjs';

const [cacheDir, outPath] = [process.argv[2], process.argv[3]];
if (!cacheDir || !outPath) { console.error('Dùng: node scripts/backtest_decision_signals.mjs <thư-mục-nến> <đầu-ra.json>'); process.exit(1); }

const STOPS = [3, 4, 5, 6, 7, 8], RRS = [1.5, 2.0, 2.5, 3.0], MAX_HOLD = 60, COST = 0.4;
const M = await loadAppModules(['stageEngine', 'wyckoffEngine', 'wyckoffContext', 'decisionEngine']);
const { data, vnindex, syms } = loadCandles(cacheDir);
const rsAt = buildRsAt(data, syms);
const marketUpAt = new Map();
for (let i = 200; i < vnindex.c.length; i++) marketUpAt.set(vnindex.dates[i], vnindex.c[i] > sma(vnindex.c, 50, i) && vnindex.c[i] > sma(vnindex.c, 200, i));
const r2 = (v) => Math.round(v * 100) / 100;

// ── Thu thập tín hiệu MUA ──
const signals = []; // {s, i, date, regime}
for (const s of syms) {
  const d = data[s];
  for (let i = 300; i < d.c.length - 2; i++) {
    const date = d.dates[i];
    const rs = rsAt.get(`${s}|${date}`);
    const tt = ttCount(d, i, rs);
    const st = M.stageEngine.classifyStage({ closes: d.c, highs: d.h, lows: d.l, idx: i, passedCount: tt ?? undefined });
    if (!(st.stage === 2 && st.confirmed)) continue; // BUY luôn cần Stage 2 đủ 8/8
    const sl = (a) => a.slice(Math.max(0, i - 129), i + 1);
    const closes = sl(d.c), highs = sl(d.h), lows = sl(d.l), opens = sl(d.o), volumes = sl(d.v);
    const hi52 = Math.max(...d.h.slice(Math.max(0, i - 251), i + 1));
    const wy = M.wyckoffEngine.analyzeWyckoff({ opens, highs, lows, closes, volumes, isIndex: false, sma20: r2(sma(d.c, 20, i)), sma50: r2(sma(d.c, 50, i)), sma150: r2(sma(d.c, 150, i)), sma200: r2(sma(d.c, 200, i)), distFrom52WHighPct: Math.round(((d.c[i] - hi52) / hi52) * 1000) / 10 });
    const dist = M.wyckoffContext.detectDistribution({ opens, highs, lows, closes, volumes });
    const ctx = M.wyckoffContext.buildCycleContext({ stage: st, wy, dist });
    const mu = marketUpAt.has(date) ? marketUpAt.get(date) : null;
    const dec = M.decisionEngine.buildDecision({ stage: st, ttPassed: tt ?? 0, ttFailedIds: [], ctx, rsRating: rs ?? 0, price: d.c[i], ma20: sma(d.c, 20, i), ma50: sma(d.c, 50, i), ma150: sma(d.c, 150, i), ma200: sma(d.c, 200, i), pivot: wy.diagnostics.last20High, baseLow: wy.diagnostics.priorBaseLow, distFromSMA20Pct: 0, marketUp: mu });
    if (dec.newBuyer.action === 'BUY') signals.push({ s, i, date, regime: mu === null ? 'all' : mu ? 'up' : 'down' });
  }
}
console.error(`Tín hiệu MUA thô: ${signals.length}`);

// ── Mô phỏng ──
function simulate(d, e, stopPct, rr) {
  const entry = d.o[e], stop = entry * (1 - stopPct / 100), target = entry * (1 + stopPct * rr / 100);
  const last = Math.min(e + MAX_HOLD, d.c.length - 1);
  for (let k = e; k <= last; k++) {
    const age = k - e;
    if (age < 2) continue;
    if (age === 2) { if (d.c[k] <= stop) return [k, d.c[k], 'stop']; if (d.c[k] >= target) return [k, d.c[k], 'target']; continue; }
    if (d.o[k] <= stop) return [k, d.o[k], 'stop'];
    if (d.l[k] <= stop) return [k, stop, 'stop'];
    if (d.o[k] >= target) return [k, d.o[k], 'target'];
    if (d.h[k] >= target) return [k, target, 'target'];
  }
  return e + MAX_HOLD <= d.c.length - 1 ? [last, d.c[last], 'time'] : null;
}
const block = (rets) => {
  const n = rets.length, wins = rets.filter((r) => r > 0), loss = rets.filter((r) => r <= 0).map((r) => -r);
  const w = wins.length / n, mean = rets.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)), se = sd / Math.sqrt(n), z = 1.96;
  const centre = (w + z * z / (2 * n)) / (1 + z * z / n), half = z * Math.sqrt(w * (1 - w) / n + z * z / (4 * n * n)) / (1 + z * z / n);
  return {
    winRate: +(w * 100).toFixed(1), winRateCI: [+((centre - half) * 100).toFixed(1), +((centre + half) * 100).toFixed(1)],
    avgWinPct: wins.length ? r2(wins.reduce((a, b) => a + b, 0) / wins.length) : 0,
    avgLossPct: loss.length ? r2(loss.reduce((a, b) => a + b, 0) / loss.length) : 0,
    expectancyPct: r2(mean), expectancyCI: [r2(mean - z * se), r2(mean + z * se)],
  };
};
const results = { BUY: { all: {}, up: {}, down: {} } };
for (const stop of STOPS) for (const rr of RRS) {
  const buckets = { all: [], up: [], down: [] };
  const busy = {};
  for (const sg of signals.sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.i - b.i))) {
    const d = data[sg.s], e = sg.i + 1;
    if ((busy[sg.s] ?? -1) >= e) continue;
    const sim = simulate(d, e, stop, rr);
    if (!sim) continue;
    busy[sg.s] = sim[0];
    const gross = (sim[1] / d.o[e] - 1) * 100;
    const rec = { net: gross - COST, gross, reason: sim[2], hold: sim[0] - e };
    buckets.all.push(rec);
    if (sg.regime !== 'all') buckets[sg.regime].push(rec);
  }
  for (const [reg, arr] of Object.entries(buckets)) {
    if (arr.length < 30) continue;
    const n = arr.length;
    results.BUY[reg][`${stop}|${rr}`] = {
      n, net: block(arr.map((x) => x.net)), gross: block(arr.map((x) => x.gross)),
      hitTargetPct: +((100 * arr.filter((x) => x.reason === 'target').length) / n).toFixed(1),
      hitStopPct: +((100 * arr.filter((x) => x.reason === 'stop').length) / n).toFixed(1),
      timeExitPct: +((100 * arr.filter((x) => x.reason === 'time').length) / n).toFixed(1),
      avgHoldBars: +(arr.reduce((a, x) => a + x.hold, 0) / n).toFixed(1),
    };
  }
}
const dates = signals.map((x) => x.date).sort();
fs.writeFileSync(outPath, JSON.stringify({
  meta: {
    generatedAt: new Date().toISOString().slice(0, 19) + 'Z', universe: syms.length, signals: signals.length,
    periodStart: dates[0], periodEnd: dates[dates.length - 1], costRoundTripPct: COST, maxHoldBars: MAX_HOLD,
    rule: 'Tín hiệu = quyết định MUA của ứng dụng (Stage 2 đủ 8/8 + Wyckoff Phase D/E, không phân phối). Vào ở giá mở cửa phiên kế tiếp; cắt lỗ −B%, chốt lời +B×R:R%, hết hạn 60 phiên; T+2; cùng phiên chạm cả hai tính cắt lỗ; chi phí khứ hồi 0.4%.',
  },
  results,
}));
const x = results.BUY.all['7|2.5'], y = results.BUY.all['5|2.5'];
console.log('BUY all 5|2.5', y && { n: y.n, ...y.net }); console.log('BUY all 7|2.5', x && { n: x.n, ...x.net });
for (const st of STOPS) console.log(st, RRS.map((rr) => { const c = results.BUY.all[`${st}|${rr}`]; return c ? `${rr}:n${c.n} E${c.net.expectancyPct}` : `${rr}:-`; }).join('  '));
