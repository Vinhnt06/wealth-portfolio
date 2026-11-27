#!/usr/bin/env node
/**
 * Ghi tín hiệu MUA của ứng dụng sau mỗi phiên để kiểm chứng về sau trên dữ liệu chưa ai thấy (forward test).
 *
 *   node scripts/log_buy_signals.mjs              # ghi phiên đã đóng gần nhất (nếu chưa ghi)
 *   node scripts/log_buy_signals.mjs --dry-run    # chỉ in ra, không ghi
 *   node scripts/log_buy_signals.mjs --dry-run --as-of=2026-11-27   # đối chiếu với app ở một phiên
 *
 * Nguyên tắc:
 *  • Mỗi phiên một dòng JSON trong data/forward_test/buy_signals.jsonl, KỂ CẢ khi không có tín hiệu.
 *  • Chỉ nối thêm, không bao giờ sửa dòng cũ và không ghi bù quá khứ.
 *  • Chỉ dùng nến đến hết phiên được ghi. Ghi sau khi phiên kế tiếp đã mở cửa thì đánh dấu late = true.
 *  • Quyết định lấy từ đúng các module của ứng dụng; cách tính chỉ tiêu theo api/market/minervini/analysis,
 *    cách xếp hạng RS theo scripts/cron_scan_minervini.js.
 *
 * Cần frontend/node_modules (typescript).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const { loadAppModules } = await import('./lib/pointInTime.mjs');

const DRY_RUN = process.argv.includes('--dry-run');
const AS_OF = process.argv.find((a) => a.startsWith('--as-of='))?.slice('--as-of='.length);
const LOG_PATH = 'data/forward_test/buy_signals.jsonl';
const SCAN_PATH = 'frontend/src/features/market/data/lastMinerviniScan.json';
const CLOSE_READY_MIN = 15 * 60 + 15; // 15:15 giờ VN mới coi nến ngày hôm nay là đã chốt
const MIN_FETCHED = 0.95; // tỷ lệ mã tải được nến
const MIN_TRADED = 0.85; // tỷ lệ mã đã có nến của phiên cần ghi

const vnClock = (ms) => {
  const iso = new Date(ms + 7 * 3600_000).toISOString();
  return { date: iso.slice(0, 10), minutes: Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)), day: new Date(ms + 7 * 3600_000).getUTCDay() };
};
const NOW = Date.now();
const now = vnClock(NOW);

async function candles(symbol, kind, days) {
  const to = Math.floor(NOW / 1000);
  const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/${kind}?from=${to - days * 86400}&to=${to}&symbol=${encodeURIComponent(symbol)}&resolution=1D`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j?.t) && j.t.length) return { dates: j.t.map((t) => vnClock(t * 1000).date), o: j.o, h: j.h, l: j.l, c: j.c, v: j.v };
      }
    } catch {
      // thử lại
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  return null;
}

/** Cắt chuỗi nến tại hết phiên `date` */
const upTo = (d, date) => {
  let n = d.dates.length;
  while (n > 0 && d.dates[n - 1] > date) n--;
  return Object.fromEntries(Object.entries(d).map(([k, a]) => [k, a.slice(0, n)]));
};

const sma = (a, n, i = a.length - 1) => {
  if (i < n - 1) return 0;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += a[k];
  return s / n;
};
const r2 = (v) => Math.round(v * 100) / 100;
const pct1 = (v, base) => (base > 0 ? Math.round(((v - base) / base) * 1000) / 10 : 0);

/** Giống cron_scan_minervini.js: 40% ROC(63) + 20% ROC(126, 189, 252) */
function rawRs(c) {
  const len = c.length;
  const roc = (ago) => {
    const past = c[Math.max(0, len - 1 - ago)];
    return past > 0 ? (c[len - 1] - past) / past : 0;
  };
  const q1 = roc(63);
  const q2 = len > 126 ? roc(126) : q1;
  const q3 = len > 189 ? roc(189) : q2;
  const q4 = len > 220 ? roc(Math.min(252, len - 1)) : q3;
  return 0.4 * q1 + 0.2 * q2 + 0.2 * q3 + 0.2 * q4;
}

function analyze(M, d, rsRating) {
  const { o, h, l, c, v } = d;
  const count = c.length;
  const price = c[count - 1];
  const sma20 = r2(sma(c, 20));
  const sma50 = r2(sma(c, 50));
  const sma150 = r2(sma(c, 150));
  const sma200 = r2(sma(c, 200));
  const past = count >= 222 ? sma(c, 200, count - 23) : 0;
  const mid = count >= 211 ? sma(c, 200, count - 12) : 0;
  const rawSma200 = sma(c, 200);
  const slopeUp = past > 0 && rawSma200 > past && (mid === 0 || rawSma200 >= mid * 0.999);
  const look = Math.min(252, count);
  const high52 = r2(Math.max(...h.slice(count - look)));
  const low52 = r2(Math.min(...l.slice(count - look)));
  const distHigh = pct1(price, high52);
  const distLow = pct1(price, low52);
  const flags = [
    sma150 > 0 && sma200 > 0 && price > sma150 && price > sma200,
    sma150 > 0 && sma200 > 0 && sma150 > sma200,
    slopeUp,
    sma50 > 0 && sma150 > 0 && sma200 > 0 && sma50 > sma150 && sma50 > sma200,
    sma50 > 0 && price > sma50,
    distLow >= 30,
    distHigh >= -25,
    rsRating >= 70,
  ];
  const passedCount = flags.filter(Boolean).length;
  const stage = M.stageEngine.classifyStage({ closes: c, highs: h, lows: l, passedCount });
  const bars = { opens: o, highs: h, lows: l, closes: c, volumes: v };
  const wy = M.wyckoffEngine.analyzeWyckoff({ ...bars, isIndex: false, sma20, sma50, sma150, sma200, distFrom52WHighPct: distHigh });
  const ctx = M.wyckoffContext.buildCycleContext({ stage, wy, dist: M.wyckoffContext.detectDistribution(bars) });
  // marketUp = null: lấy tín hiệu kỹ thuật thuần; cổng thị trường ghi riêng ở trường action
  const decision = M.decisionEngine.buildDecision({
    stage,
    ttPassed: passedCount,
    ttFailedIds: flags.flatMap((ok, i) => (ok ? [] : [i + 1])),
    ctx,
    rsRating,
    price,
    ma20: sma20,
    ma50: sma50,
    ma150: sma150,
    ma200: sma200,
    pivot: wy.diagnostics.last20High,
    baseLow: wy.diagnostics.priorBaseLow,
    distFromSMA20Pct: wy.diagnostics.posInBasePct,
    marketUp: null,
  });
  return { decision, wy, price, passedCount };
}

async function main() {
  const logged = fs.existsSync(LOG_PATH)
    ? new Set(fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line).date))
    : new Set();

  const vni = await candles('VNINDEX', 'index', 800);
  if (!vni) throw new Error('Không tải được VN-Index');
  // --as-of chỉ dùng để đối chiếu khi chạy thử; khi ghi thật luôn lấy phiên đã đóng gần nhất
  const date = (DRY_RUN && AS_OF) || vni.dates.filter((d) => d < now.date || (d === now.date && now.minutes >= CLOSE_READY_MIN)).pop();
  if (!date) throw new Error('Không xác định được phiên đã đóng');
  if (logged.has(date) && !DRY_RUN) return console.log(`Phiên ${date} đã ghi rồi, bỏ qua.`);

  const universe = JSON.parse(fs.readFileSync(SCAN_PATH, 'utf8')).data;
  if (!Array.isArray(universe) || universe.length < 50) throw new Error('Danh sách mã trong bản quét quá ít');

  const loaded = [];
  for (let i = 0; i < universe.length; i += 8) {
    const batch = await Promise.all(
      universe.slice(i, i + 8).map(async (s) => {
        const d = await candles(s.symbol, 'stock', 730);
        return d ? { ...s, d: upTo(d, date) } : null;
      })
    );
    loaded.push(...batch.filter((x) => x && x.d.c.length >= 50));
  }
  const traded = loaded.filter((s) => s.d.dates[s.d.dates.length - 1] === date);
  if (loaded.length < universe.length * MIN_FETCHED || traded.length < universe.length * MIN_TRADED) {
    // Nguồn chưa cập nhật đủ: không ghi, lần chạy sau thử lại
    return console.log(`Chưa đủ dữ liệu phiên ${date}: tải ${loaded.length}, có giao dịch ${traded.length}/${universe.length}. Không ghi.`);
  }

  const M = await loadAppModules(['stageEngine', 'wyckoffEngine', 'wyckoffContext', 'decisionEngine', 'marketState']);

  // RS 1–99 xếp hạng trong cả rổ
  const scored = loaded.map((s) => ({ ...s, raw: rawRs(s.d.c) }));
  const sorted = scored.map((s) => s.raw).sort((a, b) => b - a);
  const rsOf = (raw) => {
    const better = sorted.filter((x) => x > raw + 1e-9).length;
    return Math.max(1, Math.min(99, Math.round(99 - (better / (sorted.length - 1)) * 98)));
  };

  // Trạng thái thị trường như app: 100 mã vốn hoá lớn nhất HOSE (trong rổ quét)
  const breadthSet = scored.filter((s) => s.exchange === 'HOSE').sort((a, b) => b.mktCapT - a.mktCapT).slice(0, 100);
  const index = upTo(vni, date);
  const weeks = M.marketState.computeWeeklyStates(
    { dates: index.dates, closes: index.c },
    breadthSet.map((s) => ({ dates: s.d.dates, closes: s.d.c }))
  );
  const marketState = weeks.length ? weeks[weeks.length - 1].state : null;

  const tradedSymbols = new Set(traded.map((s) => s.symbol));
  const signals = [];
  for (const s of scored) {
    if (!tradedSymbols.has(s.symbol)) continue;
    const rsRating = rsOf(s.raw);
    const { decision, wy, price } = analyze(M, s.d, rsRating);
    if (decision.newBuyer.action !== 'BUY') continue;
    signals.push({
      symbol: s.symbol,
      exchange: s.exchange,
      action: marketState === 'UNFAVORABLE' ? 'WAIT_MARKET' : 'BUY',
      size: decision.newBuyer.size,
      close: price,
      rsRating,
      pivot: r2(wy.diagnostics.last20High),
      phase: wy.wyckoffPhase,
    });
  }
  signals.sort((a, b) => b.rsRating - a.rsRating || a.symbol.localeCompare(b.symbol));

  const nextSessionOpened = now.date > date && now.day >= 1 && now.day <= 5 && now.minutes >= 9 * 60;
  const record = {
    date,
    loggedAt: new Date(NOW).toISOString(),
    late: nextSessionOpened,
    appCommit: execSync('git rev-parse --short HEAD').toString().trim(),
    marketState,
    vnindexClose: index.c[index.c.length - 1],
    signals,
    // Rổ có giao dịch phiên này, để sau này so với chọn ngẫu nhiên cùng rổ
    universe: [...tradedSymbols].sort(),
  };

  console.log(`Phiên ${date} · thị trường ${marketState} · ${signals.length} tín hiệu / ${tradedSymbols.size} mã`);
  console.log(signals.map((x) => `${x.symbol}:${x.action}`).join(' ') || '(không có tín hiệu)');
  if (DRY_RUN) return console.log('(dry-run: không ghi file)');

  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, `${JSON.stringify(record)}\n`);
  console.log(`Đã ghi vào ${LOG_PATH}`);
}

await main();
