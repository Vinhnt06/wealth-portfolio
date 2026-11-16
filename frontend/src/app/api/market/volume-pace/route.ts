import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const preferredRegion = 'sin1';

interface IntradayCandles {
  t: number[];
  c: number[];
  o: number[];
  h: number[];
  l: number[];
  v: number[];
}

/**
 * Fetch 5-minute candles with primary Entrade feed and automatic Vietcap fallback
 */
async function fetch5mCandles(symbol: string): Promise<IntradayCandles | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const fromIntraSec = nowSec - 45 * 86400; // 45 calendar days

  // 1. Try Entrade primary feed
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromIntraSec}&to=${nowSec}&symbol=${encodeURIComponent(
        symbol
      )}&resolution=5`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data: IntradayCandles = await res.json();
      if (data.t && data.t.length > 0 && data.v && data.v.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn(`[VolumePace] Entrade 5m fetch failed for ${symbol}, falling back to Vietcap:`, err);
  }

  // 2. Fallback to Vietcap gap-chart (FIVE_MINUTES)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://trading.vietcap.com.vn/api/chart/OHLCChart/gap-chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://trading.vietcap.com.vn/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({
        timeFrame: 'FIVE_MINUTES',
        symbols: [symbol],
        to: nowSec + 86400,
        countBack: 1200, // ~1200 5m candles = ~30 trading days
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0 && json[0].t && json[0].t.length > 0) {
        const item = json[0];
        return {
          t: item.t.map(Number),
          o: item.o || [],
          h: item.h || [],
          l: item.l || [],
          c: item.c || [],
          v: item.v || [],
        };
      }
    }
  } catch (err) {
    console.error(`[VolumePace] Vietcap 5m fallback also failed for ${symbol}:`, err);
  }

  return null;
}

/**
 * Fetch daily candles with primary Entrade feed and automatic Vietcap fallback
 */
async function fetchDailyCandles(symbol: string): Promise<IntradayCandles | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const fromDailySec = nowSec - 65 * 86400; // 65 calendar days

  // 1. Try Entrade primary feed
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromDailySec}&to=${nowSec}&symbol=${encodeURIComponent(
        symbol
      )}&resolution=1D`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data: IntradayCandles = await res.json();
      if (data.t && data.t.length > 0 && data.v && data.v.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn(`[VolumePace] Entrade 1D fetch failed for ${symbol}, falling back to Vietcap:`, err);
  }

  // 2. Fallback to Vietcap gap-chart (ONE_DAY)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://trading.vietcap.com.vn/api/chart/OHLCChart/gap-chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://trading.vietcap.com.vn/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({
        timeFrame: 'ONE_DAY',
        symbols: [symbol],
        to: nowSec + 86400,
        countBack: 65,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0 && json[0].t && json[0].t.length > 0) {
        const item = json[0];
        return {
          t: item.t.map(Number),
          o: item.o || [],
          h: item.h || [],
          l: item.l || [],
          c: item.c || [],
          v: item.v || [],
        };
      }
    }
  } catch (err) {
    console.error(`[VolumePace] Vietcap 1D fallback also failed for ${symbol}:`, err);
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbol = searchParams.get('symbol') || 'HPG';
    const symbol = rawSymbol.trim().toUpperCase();
    const baselineDays = Math.min(20, Math.max(3, parseInt(searchParams.get('days') || '20', 10)));
    const clientLiveVol = parseInt(searchParams.get('liveVol') || '0', 10);

    const [intraData, dailyData] = await Promise.all([
      fetch5mCandles(symbol),
      fetchDailyCandles(symbol),
    ]);

    if (!intraData || !intraData.t || intraData.t.length === 0) {
      return NextResponse.json(
        { success: false, error: `No intraday data found for symbol ${symbol}` },
        { status: 404 }
      );
    }

    if (!dailyData || !dailyData.t || dailyData.t.length === 0) {
      return NextResponse.json(
        { success: false, error: `No daily volume history found for symbol ${symbol}` },
        { status: 404 }
      );
    }

    // 1. Group 5-minute candles by session date (YYYY-MM-DD in VN timezone)
    const sessions: Record<string, Record<string, number>> = {};
    const sessionSlotMax: Record<string, { time: string; vol: number }> = {};

    intraData.t.forEach((t, i) => {
      const dt = new Date(t * 1000);
      const dateStr = dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      const timeStr = dt.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
      });
      const vol = intraData.v[i] || 0;

      if (!sessions[dateStr]) sessions[dateStr] = {};
      sessions[dateStr][timeStr] = (sessions[dateStr][timeStr] || 0) + vol;

      if (!sessionSlotMax[dateStr] || vol > sessionSlotMax[dateStr].vol) {
        sessionSlotMax[dateStr] = { time: timeStr, vol };
      }
    });

    const allSessionDates = Object.keys(sessions).sort();
    if (allSessionDates.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid sessions found' }, { status: 404 });
    }

    // Accurate Vietnam date & time using Intl.DateTimeFormat (avoids double-shift bugs on UTC servers)
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const nowTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
    }).format(now);
    const isWeekend = weekday === 'Sat' || weekday === 'Sun';

    // Market session state
    const isTradingHours = !isWeekend && nowTimeStr >= '09:15' && nowTimeStr < '15:00';
    const isAfterClose = !isWeekend && nowTimeStr >= '15:00';

    let activeDate: string;
    let isTodayLive: boolean;

    if (isTradingHours && (allSessionDates.includes(todayStr) || clientLiveVol > 0)) {
      activeDate = todayStr;
      isTodayLive = true;
    } else if (isAfterClose && allSessionDates.includes(todayStr)) {
      // Today session has ended, full day data is final
      activeDate = todayStr;
      isTodayLive = false;
    } else {
      // Weekend, early morning before open, or holiday: use the most recent closed trading day
      const pastDates = allSessionDates.filter((d) => d <= todayStr);
      activeDate = pastDates.length > 0 ? pastDates[pastDates.length - 1] : allSessionDates[allSessionDates.length - 1];
      isTodayLive = false;
    }

    // Previous dates excluding active date
    const prevDates = allSessionDates.filter((d) => d < activeDate);
    const baselineDates20 = prevDates.slice(-20);
    const baselineDates5 = prevDates.slice(-5);

    // Standard list of intraday time slots (09:15 -> 14:45)
    const allTimesSet = new Set<string>();
    allSessionDates.forEach((d) => Object.keys(sessions[d]).forEach((tm) => allTimesSet.add(tm)));
    const sortedTimes = Array.from(allTimesSet).sort();

    // 2. Compute 20-Day Daily SMA Volume
    const dailyVols = dailyData.v || [];
    const dailyCloses = dailyData.c || [];
    const dailyOpens = dailyData.o || [];
    const dailyTimes = dailyData.t || [];

    // Filter past daily candles excluding activeDate if it's currently live
    const closedDailyIndices: number[] = [];
    for (let i = 0; i < dailyTimes.length; i++) {
      const dt = new Date(dailyTimes[i] * 1000);
      const dStr = dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      if (dStr < activeDate || (!isTodayLive && dStr === activeDate)) {
        closedDailyIndices.push(i);
      }
    }

    const last20Indices = closedDailyIndices.slice(-20);
    const last20Vols = last20Indices.map((idx) => dailyVols[idx] || 0);
    const sma20Vol = Math.round(
      last20Vols.reduce((a, b) => a + b, 0) / (last20Vols.length || 1)
    );

    // Daily 20 history bars
    const dailyHistory = [];
    const historyLen = Math.min(20, dailyTimes.length);
    const startIdx = dailyTimes.length - historyLen;
    for (let i = startIdx; i < dailyTimes.length; i++) {
      const dt = new Date(dailyTimes[i] * 1000);
      const dateStr = dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      const [year, month, day] = dateStr.split('-');
      const vol = dailyVols[i] || 0;
      const close = dailyCloses[i] || 0;
      const open = dailyOpens[i] || 0;
      const changePct = open > 0 ? Number((((close - open) / open) * 100).toFixed(2)) : 0;

      dailyHistory.push({
        date: dateStr,
        displayDate: `${day}/${month}`,
        vol,
        close,
        changePct,
        sma20Vol,
        isAboveSma20: vol >= sma20Vol,
        isToday: dateStr === activeDate,
      });
    }

    // 3. Compute Cumulative Curves for 20-Day Average and 5-Day Average
    const avgCum20Map: Record<string, number> = {};
    let runAvg20 = 0;
    for (const tm of sortedTimes) {
      const slotSum = baselineDates20.reduce((sum, dKey) => sum + (sessions[dKey]?.[tm] || 0), 0);
      const slotAvg = slotSum / (baselineDates20.length || 1);
      runAvg20 += slotAvg;
      avgCum20Map[tm] = Math.round(runAvg20);
    }

    const avgCum5Map: Record<string, number> = {};
    let runAvg5 = 0;
    for (const tm of sortedTimes) {
      const slotSum = baselineDates5.reduce((sum, dKey) => sum + (sessions[dKey]?.[tm] || 0), 0);
      const slotAvg = slotSum / (baselineDates5.length || 1);
      runAvg5 += slotAvg;
      avgCum5Map[tm] = Math.round(runAvg5);
    }

    // Active baseline map according to user baselineDays setting
    const activeBaselineDates = baselineDays === 5 ? baselineDates5 : baselineDates20;
    const activeAvgCumulativeMap = baselineDays === 5 ? avgCum5Map : avgCum20Map;
    const avgTotalVol =
      activeBaselineDates
        .map((dKey) => Object.values(sessions[dKey] || {}).reduce((sum, v) => sum + v, 0))
        .reduce((sum, v) => sum + v, 0) / (activeBaselineDates.length || 1);

    // 4. Build Real-time Cumulative Progression for Active Session
    let todayRunning = 0;
    let sma20CrossTime: string | null = null;
    let paceSurgeTime: string | null = null;

    // Timeline array for AreaChart
    const timeline = [];
    let latestTodayCum = 0;
    let latestAvgCum = 0;

    // Slot boundary: if not live, all slots (up to 14:45) have occurred
    let lastPastSlotIndex = sortedTimes.length - 1;
    if (isTodayLive) {
      lastPastSlotIndex = -1;
      sortedTimes.forEach((tm, idx) => {
        if (tm <= nowTimeStr) lastPastSlotIndex = idx;
      });
      if (lastPastSlotIndex === -1 && sortedTimes.length > 0) {
        lastPastSlotIndex = 0;
      }
    }

    const activeSlots = sessions[activeDate] || {};

    // First pass: compute actual cumulative volume up to current time
    for (let i = 0; i <= lastPastSlotIndex; i++) {
      const tm = sortedTimes[i];
      const slotVol = activeSlots[tm] || 0;
      todayRunning += slotVol;

      if (isTodayLive && i === lastPastSlotIndex && clientLiveVol > todayRunning) {
        todayRunning = clientLiveVol;
      }
    }

    latestTodayCum = todayRunning;
    latestAvgCum = activeAvgCumulativeMap[sortedTimes[lastPastSlotIndex]] || 0;

    // Bounded & realistic projection algorithm (prevents early morning explosive projections)
    const latestRatio = avgTotalVol > 0 && latestAvgCum > 0 ? latestAvgCum / avgTotalVol : 0.5;
    let projectedTotal = latestTodayCum;

    if (isTodayLive && latestRatio > 0 && latestRatio < 0.98) {
      const rawPace = latestTodayCum / latestRatio;
      // Cap multiplier at realistic 3.5x SMA20 (or actual volume if already surpassed)
      const maxReasonableCap = Math.max(latestTodayCum, avgTotalVol * 3.5);
      const cappedPace = Math.min(rawPace, maxReasonableCap);

      // Adaptive shrinkage: blend linear pace with additive delta in the morning, full pace in afternoon
      const confidenceWeight = Math.min(1.0, Math.max(0.2, latestRatio * 2.5));
      const additiveProjected = latestTodayCum + Math.max(0, avgTotalVol - latestAvgCum);
      projectedTotal = Math.round(confidenceWeight * cappedPace + (1 - confidenceWeight) * additiveProjected);
    }

    // Reset todayRunning for building the timeline entries
    todayRunning = 0;
    for (let i = 0; i < sortedTimes.length; i++) {
      const tm = sortedTimes[i];
      const avgCum = activeAvgCumulativeMap[tm] || 0;
      const avgCum20 = avgCum20Map[tm] || 0;
      const avgCum5 = avgCum5Map[tm] || 0;

      const isPastOrCurrent = !isTodayLive || i <= lastPastSlotIndex;
      const slotVol = activeSlots[tm] || 0;

      if (isPastOrCurrent) {
        todayRunning += slotVol;
        if (isTodayLive && i === lastPastSlotIndex && clientLiveVol > todayRunning) {
          todayRunning = clientLiveVol;
        }

        const diffPct = avgCum > 0 ? Number((((todayRunning - avgCum) / avgCum) * 100).toFixed(1)) : 0;
        const isAbove = todayRunning >= avgCum;

        if (!sma20CrossTime && todayRunning >= sma20Vol && sma20Vol > 0) {
          sma20CrossTime = tm;
        }

        if (!paceSurgeTime && tm >= '09:30' && diffPct >= 25 && todayRunning >= 50000) {
          paceSurgeTime = tm;
        }

        timeline.push({
          time: tm,
          todayCum: todayRunning,
          avgCum,
          avgCum20,
          avgCum5,
          // In the current live slot, anchor projectedCum to todayCum so the projected line connects smoothly
          projectedCum: isTodayLive && i === lastPastSlotIndex ? todayRunning : null,
          diffPct,
          isAbove,
          isRecorded: true,
        });
      } else {
        // Future slot during live trading
        const remainingAvg = Math.max(1, avgTotalVol - latestAvgCum);
        const progressFromCurrent = Math.max(0, avgCum - latestAvgCum);
        const projectedAtSlot = Math.round(
          latestTodayCum + (projectedTotal - latestTodayCum) * (progressFromCurrent / remainingAvg)
        );

        timeline.push({
          time: tm,
          todayCum: null,
          avgCum,
          avgCum20,
          avgCum5,
          projectedCum: projectedAtSlot,
          diffPct: avgCum > 0 ? Number((((projectedAtSlot - avgCum) / avgCum) * 100).toFixed(1)) : 0,
          isAbove: projectedAtSlot >= avgCum,
          isRecorded: false,
        });
      }
    }

    // 5. Volume Surge & Relative Volume (rVol) Metrics
    const todayTotalVol = latestTodayCum;
    const projectedTotalVol = isTodayLive ? projectedTotal : todayTotalVol;

    const rVol = Number((todayTotalVol / (sma20Vol || 1)).toFixed(2));
    const projectedRVol = Number((projectedTotalVol / (sma20Vol || 1)).toFixed(2));
    const paceDeltaPct =
      latestAvgCum > 0 ? Number((((todayTotalVol - latestAvgCum) / latestAvgCum) * 100).toFixed(1)) : 0;

    let status: 'BURST' | 'SURGE' | 'NORMAL' | 'DRYUP' = 'NORMAL';
    let statusLabel = 'Thanh Khoản Bình Thường';
    let statusBadge = `BÌNH THƯỜNG (${rVol}x SMA20)`;
    let statusDesc = 'Khối lượng giao dịch bám sát mức bình quân 20 phiên, thị trường trong vùng cân bằng cung cầu.';

    if (rVol >= 2.0 || (isTodayLive && projectedRVol >= 2.0)) {
      status = 'BURST';
      statusLabel = 'Nổ Vol Cực Đại';
      statusBadge = `NỔ VOL ĐỘT BIẾN (${projectedRVol > rVol ? `${projectedRVol}x dự phóng` : `${rVol}x`} SMA20)`;
      statusDesc = 'Dòng tiền bùng nổ vượt trội gấp đôi mức trung bình 20 phiên! Tín hiệu xác nhận bứt phá nền giá.';
    } else if (rVol >= 1.3 || (isTodayLive && projectedRVol >= 1.3)) {
      status = 'SURGE';
      statusLabel = 'Dòng Tiền Gia Tăng';
      statusBadge = `DÒNG TIỀN GIA TĂNG (${projectedRVol > rVol ? `${projectedRVol}x dự phóng` : `${rVol}x`} SMA20)`;
      statusDesc = 'Thanh khoản tăng tốc vượt trội so với trung bình 20 phiên, lực cầu chủ động gia tăng mạnh mẽ.';
    } else if (rVol <= 0.75 && (!isTodayLive || projectedRVol <= 0.8)) {
      status = 'DRYUP';
      statusLabel = 'Thanh Khoản Cạn Kiệt';
      statusBadge = `CẠN KIỆT THANH KHOẢN (${rVol}x SMA20)`;
      statusDesc = 'Khối lượng sụt giảm sâu dưới trung bình (VCP Dry-up), áp lực bán suy yếu, chuẩn bị cho nhịp biến động mới.';
    }

    const [aY, aM, aD] = activeDate.split('-');
    const displayDate = `${aD}/${aM}/${aY}`;

    return NextResponse.json({
      success: true,
      symbol,
      activeDate,
      displayDate,
      isTodayLive,
      latestActiveTime: isTodayLive ? nowTimeStr : sortedTimes[sortedTimes.length - 1],
      baselineDays,
      baselineDates: activeBaselineDates,
      metrics: {
        todayTotalVol,
        avgTotalVol: Math.round(avgTotalVol),
        sma20Vol,
        rVol,
        projectedTotalVol,
        projectedRVol,
        paceDeltaPct,
        isAboveAvg: todayTotalVol >= latestAvgCum,
        isAboveSma20: todayTotalVol >= sma20Vol,
        sma20ProgressPct: Math.round((todayTotalVol / (sma20Vol || 1)) * 100),
        status,
        statusLabel,
        statusBadge,
        statusDesc,
        breakoutTime: sma20CrossTime,
        sma20CrossTime,
        paceSurgeTime,
        peakSlot: sessionSlotMax[activeDate] || { time: '14:15', vol: 0 },
      },
      timeline,
      dailyHistory,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error while processing volume pace',
      },
      { status: 500 }
    );
  }
}
