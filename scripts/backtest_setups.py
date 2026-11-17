#!/usr/bin/env python3
"""
Backtest thực nghiệm cho "Kỳ vọng & Cắt lỗ" (Minervini) trên rổ cổ phiếu Việt Nam.

Mục đích: thay các con số đoán bằng thống kê THẬT — tỷ lệ thắng, lãi trung bình, lỗ trung bình
(đã gồm gap giá, T+2 và chi phí giao dịch) cho từng cặp (mức cắt lỗ, R:R).

Chạy (cần frontend dev server đang chạy để lấy nến qua /api/market/history):
    python3 scripts/backtest_setups.py --base http://localhost:3000 \
        --cache /tmp/yourfin_candles \
        --out frontend/src/features/market/data/setupBacktest.json

Quy tắc mô phỏng (không nhìn trước tương lai — mọi chỉ báo chỉ dùng dữ liệu đến hết phiên tín hiệu):
  • Tín hiệu: giá đóng cửa vượt đỉnh 20 phiên trước, khối lượng >= 1.2x TB20.
  • Phân lớp theo số tiêu chí Trend Template đạt tại phiên tín hiệu (RS Rating tính điểm-theo-thời-điểm
    bằng xếp hạng phân vị trong rổ): S2 = 8/8, NEAR = 6-7/8, WEAK = <= 5/8, ANY = mọi tín hiệu (đối chứng).
  • Vào lệnh: giá MỞ CỬA phiên kế tiếp.
  • Cắt lỗ -B%, chốt lời +B*RR%, hết hạn sau 60 phiên (bán tại giá đóng cửa).
  • T+2: hai phiên đầu sau khi mua không bán được; phiên thứ 3 chỉ xét theo giá đóng cửa
    (bán được từ chiều T+2); từ phiên thứ 4 xét đầy đủ trong phiên. Gap xuống dưới mức cắt lỗ => bán tại giá mở cửa.
  • Nếu cùng một phiên chạm cả cắt lỗ và chốt lời => tính là chạm cắt lỗ (bảo thủ).
  • Chi phí khứ hồi 0.4% (phí 2 chiều ~0.3% + thuế bán 0.1%).
  • Mỗi mã chỉ giữ 1 lệnh tại một thời điểm (không chồng lệnh).
"""
import argparse, json, os, sys, datetime, urllib.request, time
from concurrent.futures import ThreadPoolExecutor

COST_PCT = 0.4
STOPS = [3, 4, 5, 6, 7, 8]
RRS = [1.5, 2.0, 2.5, 3.0]
MAX_HOLD = 60
LOCK_BARS = 2          # phiên e, e+1 không bán được; e+2 chỉ bán theo giá đóng cửa
VOL_MULT = 1.2
BREAKOUT_LOOKBACK = 20


def vn_date(ts):
    return (datetime.datetime.fromtimestamp(ts, datetime.timezone.utc) + datetime.timedelta(hours=7)).date().isoformat()


def fetch(base, sym, cache):
    path = os.path.join(cache, f"{sym}.json")
    if os.path.exists(path):
        return json.load(open(path))
    url = f"{base}/api/market/history?symbol={sym}&resolution=1D&days=1500"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                d = json.load(r)
            if d.get("success") and d.get("data"):
                rows = {}
                for c in d["data"]:
                    rows[vn_date(c["time"])] = [c["open"], c["high"], c["low"], c["close"], c.get("volume", 0)]
                out = [[k] + v for k, v in sorted(rows.items())]
                json.dump(out, open(path, "w"))
                return out
        except Exception as e:  # noqa: BLE001
            time.sleep(1 + attempt)
    return None


def sma_series(vals, n):
    out = [None] * len(vals)
    s = 0.0
    for i, v in enumerate(vals):
        s += v
        if i >= n:
            s -= vals[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def roc(closes, i, n):
    j = i - n
    return (closes[i] - closes[j]) / closes[j] if j >= 0 and closes[j] > 0 else None


def raw_rs(closes, i):
    r63, r126, r189, r252 = (roc(closes, i, n) for n in (63, 126, 189, 252))
    if None in (r63, r126, r189, r252):
        return None
    return 0.4 * r63 + 0.2 * r126 + 0.2 * r189 + 0.2 * r252


def simulate(entry_i, o, h, l, c, stop_pct, rr):
    """Trả về (exit_idx, exit_price, reason). entry_i = chỉ số phiên mua (giá mở cửa)."""
    entry = o[entry_i]
    stop = entry * (1 - stop_pct / 100)
    target = entry * (1 + stop_pct * rr / 100)
    last = min(entry_i + MAX_HOLD, len(c) - 1)
    for k in range(entry_i, last + 1):
        age = k - entry_i
        if age < LOCK_BARS:
            continue
        if age == LOCK_BARS:  # chiều T+2: chỉ có giá đóng cửa
            if c[k] <= stop:
                return k, c[k], "stop"
            if c[k] >= target:
                return k, c[k], "target"
            continue
        if o[k] <= stop:
            return k, o[k], "stop"
        hit_stop = l[k] <= stop
        hit_tgt = h[k] >= target
        if hit_stop:
            return k, stop, "stop"          # cùng phiên chạm cả hai => tính cắt lỗ
        if o[k] >= target:
            return k, o[k], "target"
        if hit_tgt:
            return k, target, "target"
    if entry_i + MAX_HOLD <= len(c) - 1:
        return last, c[last], "time"
    return None  # lệnh chưa đóng khi dữ liệu kết thúc → bỏ khỏi thống kê (tránh thiên lệch)


def summarize(rets_net, rets_gross, reasons, holds):
    n = len(rets_net)
    if n == 0:
        return None

    def block(rets):
        wins = [r for r in rets if r > 0]
        loss = [-r for r in rets if r <= 0]
        w = len(wins) / n
        a = sum(wins) / len(wins) if wins else 0.0
        b = sum(loss) / len(loss) if loss else 0.0
        mean = sum(rets) / n
        var = sum((r - mean) ** 2 for r in rets) / (n - 1) if n > 1 else 0.0
        se = (var ** 0.5) / (n ** 0.5)
        # Khoảng tin cậy Wilson 95% cho tỷ lệ thắng
        z = 1.96
        centre = (w + z * z / (2 * n)) / (1 + z * z / n)
        half = z * ((w * (1 - w) / n + z * z / (4 * n * n)) ** 0.5) / (1 + z * z / n)
        return {
            "winRate": round(w * 100, 1),
            "winRateCI": [round((centre - half) * 100, 1), round((centre + half) * 100, 1)],
            "avgWinPct": round(a, 2),
            "avgLossPct": round(b, 2),
            "expectancyPct": round(mean, 2),
            "expectancyCI": [round(mean - z * se, 2), round(mean + z * se, 2)],
        }

    return {
        "n": n,
        "net": block(rets_net),
        "gross": block(rets_gross),
        "hitTargetPct": round(100 * reasons.count("target") / n, 1),
        "hitStopPct": round(100 * reasons.count("stop") / n, 1),
        "timeExitPct": round(100 * reasons.count("time") / n, 1),
        "avgHoldBars": round(sum(holds) / n, 1),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3000")
    ap.add_argument("--cache", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--scan", default="frontend/src/features/market/data/lastMinerviniScan.json")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    symbols = [x["symbol"] for x in json.load(open(args.scan))["data"]]
    print(f"Rổ {len(symbols)} mã. Đang tải nến...", file=sys.stderr)
    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda s: (s, fetch(args.base, s, args.cache)), symbols + ["VNINDEX"]))
    data = {s: r for s, r in res if r and len(r) > 300}
    if "VNINDEX" not in data:
        sys.exit("Thiếu VNINDEX")
    vn = data.pop("VNINDEX")
    print(f"Đủ dữ liệu: {len(data)} mã", file=sys.stderr)

    # ── Chế độ thị trường theo ngày: VNINDEX trên MA50 & MA200 ──
    vn_c = [r[4] for r in vn]
    vn50, vn200 = sma_series(vn_c, 50), sma_series(vn_c, 200)
    regime = {}
    for i, r in enumerate(vn):
        if vn50[i] and vn200[i]:
            regime[r[0]] = "up" if vn_c[i] > vn50[i] and vn_c[i] > vn200[i] else "down"

    # ── Đặc trưng theo mã ──
    feat = {}
    for s, rows in data.items():
        o = [r[1] for r in rows]; h = [r[2] for r in rows]; l = [r[3] for r in rows]
        c = [r[4] for r in rows]; v = [r[5] for r in rows]
        feat[s] = dict(
            dates=[r[0] for r in rows], o=o, h=h, l=l, c=c, v=v,
            s50=sma_series(c, 50), s150=sma_series(c, 150), s200=sma_series(c, 200),
            raw=[raw_rs(c, i) for i in range(len(c))],
        )

    # ── RS Rating theo thời điểm: phân vị trong rổ từng ngày ──
    by_date = {}
    for s, f in feat.items():
        for i, d in enumerate(f["dates"]):
            if f["raw"][i] is not None:
                by_date.setdefault(d, []).append((f["raw"][i], s))
    rs_at = {}
    for d, lst in by_date.items():
        if len(lst) < 50:
            continue
        lst.sort(key=lambda x: -x[0])
        total = len(lst)
        for rank, (_, s) in enumerate(lst, start=1):
            rs_at[(s, d)] = round(99 - (rank - 1) / (total - 1) * 98)

    def criteria_count(f, i, rs):
        c = f["c"]; p = c[i]
        s50, s150, s200 = f["s50"][i], f["s150"][i], f["s200"][i]
        if None in (s50, s150, s200) or i < 252:
            return None
        s200p = f["s200"][i - 22]; s200m = f["s200"][i - 11]
        slope = s200p is not None and s200 > s200p and (s200m is None or s200 >= s200m * 0.999)
        hi = max(f["h"][i - 251:i + 1]); lo = min(f["l"][i - 251:i + 1])
        hi = max(hi, p); lo = min(lo, p)
        flags = [
            p > s150 and p > s200,
            s150 > s200,
            bool(slope),
            s50 > s150 > s200,
            p > s50,
            (p - lo) / lo * 100 >= 30,
            (p - hi) / hi * 100 >= -25,
            rs >= 70,
        ]
        return sum(flags)

    # ── Thu thập tín hiệu ──
    signals = []  # (sym, i, cls, regime)
    for s, f in feat.items():
        c, h, v = f["c"], f["h"], f["v"]
        for i in range(252, len(c) - 2):
            d = f["dates"][i]
            rs = rs_at.get((s, d))
            if rs is None or d not in regime:
                continue
            prior_hi = max(h[i - BREAKOUT_LOOKBACK:i])
            avg_v = sum(v[i - 20:i]) / 20
            if not (c[i] > prior_hi and avg_v > 0 and v[i] >= VOL_MULT * avg_v):
                continue
            n_ok = criteria_count(f, i, rs)
            if n_ok is None:
                continue
            cls = "S2" if n_ok == 8 else "NEAR" if n_ok >= 6 else "WEAK"
            signals.append((s, i, cls, regime[d], d))
    print(f"Tín hiệu thô: {len(signals)}", file=sys.stderr)
    all_dates = sorted({d for f in feat.values() for d in f["dates"]})
    mid_date = all_dates[len(all_dates) // 2 + 126]  # chia đôi giai đoạn có tín hiệu để kiểm tra độ ổn định

    # ── Mô phỏng ──
    results = {}
    stability = {}
    for stop in STOPS:
        for rr in RRS:
            buckets = {}
            half = {}
            busy = {}
            for (s, i, cls, rg, d) in sorted(signals, key=lambda x: (x[0], x[1])):
                f = feat[s]
                e = i + 1
                if e >= len(f["c"]) - 1:
                    continue
                if busy.get(s, -1) >= e:
                    continue
                sim = simulate(e, f["o"], f["h"], f["l"], f["c"], stop, rr)
                if sim is None:
                    continue
                k, px, reason = sim
                busy[s] = k
                gross = (px / f["o"][e] - 1) * 100
                net = gross - COST_PCT
                hold = k - e
                for key in {(cls, rg), (cls, "all"), ("ANY", rg), ("ANY", "all")}:
                    b = buckets.setdefault(key, ([], [], [], []))
                    b[0].append(net); b[1].append(gross); b[2].append(reason); b[3].append(hold)
                if cls == "S2":
                    hk = "H1" if d < mid_date else "H2"
                    hb = half.setdefault(hk, ([], [], [], []))
                    hb[0].append(net); hb[1].append(gross); hb[2].append(reason); hb[3].append(hold)
            for (cls, rg), (nn, gg, rs_, hh) in buckets.items():
                results.setdefault(cls, {}).setdefault(rg, {})[f"{stop}|{rr}"] = summarize(nn, gg, rs_, hh)
            if (stop, rr) == (5, 2.5) or (stop, rr) == (7, 2.5):
                stability[f"S2|{stop}|{rr}"] = {k: summarize(*v) for k, v in half.items()}

    first = min(all_dates[252:]) if len(all_dates) > 252 else all_dates[0]
    meta = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "universe": len(feat),
        "periodStart": first,
        "periodEnd": all_dates[-1],
        "midDate": mid_date,
        "signals": len(signals),
        "costRoundTripPct": COST_PCT,
        "maxHoldBars": MAX_HOLD,
        "stops": STOPS,
        "rrs": RRS,
        "rules": {
            "signal": "Giá đóng cửa vượt đỉnh 20 phiên trước, khối lượng ≥ 1.2x TB20",
            "classes": "S2 = 8/8 Trend Template; NEAR = 6–7/8; WEAK = ≤ 5/8; ANY = mọi tín hiệu (đối chứng). RS Rating tính theo thời điểm bằng phân vị trong rổ.",
            "entry": "Giá mở cửa phiên kế tiếp",
            "exit": "Cắt lỗ −B%, chốt lời +B×R:R%, hết hạn 60 phiên; bán tại giá thực tế nếu gap vượt mức",
            "settlement": "T+2: 2 phiên đầu không bán được; phiên thứ 3 chỉ xét giá đóng cửa; sau đó xét đầy đủ trong phiên",
            "sameBar": "Cùng phiên chạm cả cắt lỗ và chốt lời → tính cắt lỗ",
            "regime": "up = VN-Index trên MA50 và MA200 tại phiên tín hiệu; down = ngược lại",
        },
        "caveats": [
            "Rổ lấy từ danh sách cổ phiếu thanh khoản hiện tại nên có thiên lệch sống sót (mã đã hủy niêm yết / suy yếu không có trong rổ) → kết quả có xu hướng lạc quan.",
            "Chỉ khoảng 3 năm dữ liệu gần nhất, cùng một chu kỳ thị trường; chưa kiểm chứng ngoài mẫu qua nhiều chu kỳ.",
            "Mô phỏng dùng nến ngày: không biết thứ tự cao/thấp trong phiên và thanh khoản thực tế khi bán.",
        ],
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    json.dump({"meta": meta, "results": results, "stability": stability}, open(args.out, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"Ghi {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
