'use client';

import React, { useEffect, useState } from 'react';
import type { CapitalTrend, DepositInfo, TimingVerdict, Valuation, YieldTrend } from '../utils/buyTiming';

interface TimingData {
  verdict: TimingVerdict;
  market: {
    open: boolean;
    provisional: boolean;
    close: number;
    ma200: number;
    vol20: number;
    vol20Median: number;
  } | null;
  capital: YieldTrend | null;
  valuation: Valuation | null;
  deposit: DepositInfo | null;
}

const TREND_TEXT: Record<CapitalTrend, string> = { RISING: 'đang tăng', FALLING: 'đang giảm', FLAT: 'đi ngang' };

const HEAD: Record<TimingVerdict, { text: string; tone: string }> = {
  OK: { text: 'Được mua mới: chọn mã đạt chuẩn trong bộ lọc', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  WAIT_MARKET: { text: 'Chưa mua mới: chờ thị trường', tone: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
  WAIT_CAPITAL: { text: 'Chưa mua mới: chi phí vốn đang tăng', tone: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
  WAIT_BOTH: { text: 'Chưa mua mới: thị trường yếu và chi phí vốn đang tăng', tone: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
  UNKNOWN: { text: 'Chưa đủ số liệu để kết luận', tone: 'border-zinc-700 bg-zinc-900/70 text-zinc-300' },
};

const n = (v: number, d = 2) => v.toLocaleString('vi-VN', { maximumFractionDigits: d });
const signed = (v: number) => `${v >= 0 ? '+' : ''}${n(v)}`;
const day = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

const Row: React.FC<{ ok: boolean | null; title: string; now: string; next: string }> = ({ ok, title, now, next }) => (
  <div className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
    <span
      aria-label={ok === null ? 'Chưa rõ' : ok ? 'Đạt' : 'Chưa đạt'}
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        ok === null ? 'bg-zinc-800 text-zinc-400' : ok ? 'bg-emerald-400 text-zinc-950' : 'bg-rose-400 text-zinc-950'
      }`}
    >
      {ok === null ? '?' : ok ? '✓' : '✕'}
    </span>
    <div className="min-w-0 space-y-1">
      <div className="text-xs font-semibold text-zinc-100">{title}</div>
      <div className="text-[11px] text-zinc-400">{now}</div>
      <div className="text-[11px] text-amber-200/90">{next}</div>
    </div>
  </div>
);

/** Kết luận "Khi nào được mua mới" + chi phí vốn. Thuật toán nằm ở utils/buyTiming.ts, ở đây chỉ hiện kết quả. */
export const BuyTimingPanel: React.FC = () => {
  const [data, setData] = useState<TimingData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/macro/timing')
      .then((r) => r.json())
      .then((j) => alive && (j.success ? setData(j.data) : setFailed(true)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 text-xs text-zinc-400">Chưa tải được điều kiện mua. Thử tải lại trang.</div>;
  if (!data) return <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 text-xs text-zinc-500">Đang kiểm tra điều kiện mua…</div>;

  const { market: m, capital: c, valuation: v, deposit: dep } = data;
  const head = HEAD[data.verdict];

  let marketNow = 'Chưa lấy được trạng thái VN-Index.';
  let marketNext = '';
  if (m) {
    const above = m.close >= m.ma200;
    const calm = m.vol20 <= m.vol20Median;
    marketNow = `VN-Index ${n(m.close, 1)} ${above ? 'trên' : 'dưới'} MA200 (${n(m.ma200, 1)}) · biến động ${n(m.vol20)}%/phiên, ${calm ? 'không cao hơn' : 'cao hơn'} mức thường ${n(m.vol20Median)}%${m.provisional ? ' · tạm tính' : ''}`;
    marketNext = m.open
      ? `Chuyển đỏ khi VN-Index dưới MA200 và biến động trên ${n(m.vol20Median)}%.`
      : `Mở lại khi VN-Index đóng cửa trên ${n(m.ma200, 0)} (còn ${signed((m.ma200 / m.close - 1) * 100)}%) hoặc biến động về ${n(m.vol20Median)}% trở xuống.`;
  }

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Khi nào được mua mới</h3>
        <div className={`mt-2 rounded-lg border px-3 py-2 text-sm font-bold ${head.tone}`}>{head.text}</div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Row ok={m ? m.open : null} title="1. Thị trường" now={marketNow} next={marketNext} />
        <Row
          ok={c ? c.trend !== 'RISING' : null}
          title="2. Chi phí vốn (lợi suất TPCP 10 năm)"
          now={
            c
              ? `${n(c.value)}% ngày ${day(c.date)}, 6 tháng trước ${n(c.past)}% (${signed(c.change)} điểm): ${TREND_TEXT[c.trend]}`
              : 'Chưa có số lợi suất đủ mới.'
          }
          next={c ? (c.trend === 'RISING' ? `Xanh lại khi lợi suất xuống dưới ${n(c.tightFrom)}%.` : `Chuyển đỏ khi lợi suất từ ${n(c.tightFrom)}% trở lên.`) : ''}
        />
      </div>

      {(v || dep) && (
        <div className="grid gap-2 md:grid-cols-2">
          {v && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-[11px] text-zinc-400">
              <div className="text-xs font-semibold text-zinc-100">Cổ phiếu so với chi phí vốn (tham khảo)</div>
              <div className="mt-1">
                Lợi nhuận trên giá <b className="text-zinc-100">{n(v.earningsYield, 1)}%/năm</b> (P/E {n(v.pe, 1)})
                {v.overDeposit !== null && dep && (
                  <>
                    , hơn lãi gửi {n(dep.value)}% là <b className="text-zinc-100">{signed(v.overDeposit)} điểm</b>
                  </>
                )}
                .
              </div>
              {v.overBond !== null && v.typicalOverBond !== null && (
                <div className="mt-1">
                  So với TPCP: {signed(v.overBond)} điểm, {v.overBond >= v.typicalOverBond ? 'cao hơn' : 'thấp hơn'} mức thường {signed(v.typicalOverBond)} → cổ phiếu đang {v.overBond >= v.typicalOverBond ? 'rẻ' : 'đắt'} tương đối.
                </div>
              )}
            </div>
          )}
          {dep && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-[11px] text-zinc-400">
              <div className="text-xs font-semibold text-zinc-100">Lãi gửi tiết kiệm 12 tháng (để so sánh)</div>
              <div className="mt-1">
                <b className="text-sm text-zinc-100">{n(dep.value)}%/năm</b>
                {dep.banks ? ` · trung vị ${dep.banks} ngân hàng` : ''}
                {dep.updatedOn ? ` · cập nhật ${dep.updatedOn}` : ''}
              </div>
              <div className="mt-1">
                {dep.trend
                  ? `6 tháng trước ${n(dep.trend.past)}% (${signed(dep.trend.change)} điểm): ${TREND_TEXT[dep.trend.trend]}.`
                  : dep.since && dep.readyFrom
                    ? `Xu hướng 6 tháng: đang ghi từ ${day(dep.since)}, đủ số khoảng ${day(dep.readyFrom)}.`
                    : 'Chưa có xu hướng 6 tháng.'}
              </div>
              <div className="mt-1">
                Giữ một lệnh khoảng {dep.sessions} phiên bằng tiền của mình: mất cơ hội lãi gửi <b className="text-zinc-100">{n(dep.carryPct)}%</b> giá trị lệnh. Vay ký quỹ thì nhập lãi vay ở máy tính Kỳ vọng R:R.
              </div>
              <div className="mt-1 text-zinc-500">Không dùng làm đèn mua: lãi gửi đổi chậm hơn lợi suất trái phiếu.</div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-zinc-500">
        Không có ngày cố định: đèn đổi khi số liệu chạm mốc. Đây là bộ lọc rủi ro, không đảm bảo có lãi; giai đoạn 2023–2026 điều kiện chi phí vốn làm lãi ít hơn nắm giữ.
      </p>
    </section>
  );
};
