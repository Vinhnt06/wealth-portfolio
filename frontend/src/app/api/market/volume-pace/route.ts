import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface IntradayCandles {
  t: number[];
  c: number[];
  o: number[];
  h: number[];
  l: number[];
  v: number[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbol = searchParams.get('symbol') || 'HPG';
    const symbol = rawSymbol.trim().toUpperCase();
    const baselineDays = Math.min(20, Math.max(3, parseInt(searchParams.get('days') || '20', 10)));
    const clientLiveVol = parseInt(searchParams.get('liveVol') || '0', 10);

    const nowSec = Math.floor(Date.now() / 1000);
    // Fetch last 45 calendar days of 5-minute candles to guarantee 20+ trading sessions
    const fromIntraSec = nowSec - 45 * 86400;
    // Fetch last 65 calendar days of daily candles for SMA20 Vol and 20-day historical volume
    const fromDailySec = nowSec - 65 * 86400;

    const [intraRes, dailyRes] = await Promise.all([
      fetch(
        `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromIntraSec}&to=${nowSec}&symbol=${encodeURIComponent(
          symbol
        )}&resolution=5`,
        { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' }
      ),
      fetch(
        `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromDailySec}&to=${nowSec}&symbol=${encodeURIComponent(
          symbol
        )}&resolution=1D`,
        { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' }
      ),
    ]);

    if (!intraRes.ok || !dailyRes.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch candle data from data feed' },
        { status: 502 }
      );
    }

    const intraData: IntradayCandles = await intraRes.json();
    const dailyData: IntradayCandles = await dailyRes.json();

    if (!intraData.t || intraData.t.length === 0) {
      return NextResponse.json(
        { success: false, error: `No intraday data found for symbol ${symbol}` },
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

    // Vietnam current time & date
    const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const todayStr = vnNow.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const nowTimeStr = vnNow.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Check if today is an active live trading session
    const isTodaySession = allSessionDates.includes(todayStr) || clientLiveVol > 0;
    const activeDate = isTodaySession ? todayStr : allSessionDates[allSessionDates.length - 1];
    const isTodayLive = activeDate === todayStr;

    // Previous dates excluding active date
    const prevDates = allSessionDates.filter((d) => d < activeDate);
    const baselineDates20 = prevDates.slice(-20);
    const baselineDates5 = prevDates.slice(-5);
    const selectedBaselineDates = prevDates.slice(-baselineDays);

    // Standard list of intraday time slots (09:15 -> 14:45)
    const allTimesSet = new Set<string>();
    allSessionDates.forEach((d) => Object.keys(sessions[d]).forEach((tm) => allTimesSet.add(tm)));
    const sortedTimes = Array.from(allTimesSet).sort();

    // 2. Compute 20-Day Daily SMA Volume
    const dailyVols = dailyData.v || [];
    const dailyCloses = dailyData.c || [];
    const dailyOpens = dailyData.o || [];
    const dailyTimes = dailyData.t || [];

    const last20Vols = dailyVols.slice(-20);
    const sma20Vol = Math.round(last20Vols.reduce((a, b) => a + b, 0) / (last20Vols.length || 1));

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

    // Active baseline map according to user baselineDays setting (default 20)
    const activeBaselineDates = baselineDays === 5 ? baselineDates5 : baselineDates20;
    const activeAvgCumulativeMap = baselineDays === 5 ? avgCum5Map : avgCum20Map;
    const avgTotalVol = activeBaselineDates.map((dKey) => {
      return Object.values(sessions[dKey] || {}).reduce((sum, v) => sum + v, 0);
    }).reduce((sum, v) => sum + v, 0) / (activeBaselineDates.length || 1);

    // 4. Build Real-time Cumulative Progression for Active Session ("Thanh khoản đến đâu tăng đến đó")
    let todayRunning = 0;
    let breakoutTime: string | null = null;
    let firstCrossFound = false;

    // Timeline array for AreaChart
    const timeline = [];
    let latestTodayCum = 0;
    let latestAvgCum = 0;

    // In live sessions, find latest slot before or at current time
    let lastPastSlotIndex = sortedTimes.length - 1;
    if (isTodayLive) {
      lastPastSlotIndex = -1;
      sortedTimes.forEach((tm, idx) => {
        if (tm <= nowTimeStr) lastPastSlotIndex = idx;
      });
      if (lastPastSlotIndex === -1 && sortedTimes.length > 0) lastPastSlotIndex = 0;
    }

    const activeSlots = sessions[activeDate] || {};

    for (let i = 0; i < sortedTimes.length; i++) {
      const tm = sortedTimes[i];
      const avgCum = activeAvgCumulativeMap[tm] || 0;
      const avgCum20 = avgCum20Map[tm] || 0;
      const avgCum5 = avgCum5Map[tm] || 0;

      const isPastOrCurrent = !isTodayLive || i <= lastPastSlotIndex;
      const slotVol = activeSlots[tm] || 0;

      if (isPastOrCurrent) {
        todayRunning += slotVol;
        // If at the latest active time slot and clientLiveVol is provided, reflect exact live volume
        if (isTodayLive && i === lastPastSlotIndex && clientLiveVol > todayRunning) {
          todayRunning = clientLiveVol;
        }

        latestTodayCum = todayRunning;
        latestAvgCum = avgCum;

        const diffPct = avgCum > 0 ? Number((((todayRunning - avgCum) / avgCum) * 100).toFixed(1)) : 0;
        const isAbove = todayRunning >= avgCum;

        if (isAbove && !firstCrossFound && todayRunning > 0) {
          breakoutTime = tm;
          firstCrossFound = true;
        }

        timeline.push({
          time: tm,
          todayCum: todayRunning,
          avgCum,
          avgCum20,
          avgCum5,
          projectedCum: null,
          diffPct,
          isAbove,
          isRecorded: true,
        });
      } else {
        // Future time slot (strictly todayCum: null so line doesn't jump forward)
        // Project forward based on completion ratio
        const avgRatio = avgTotalVol > 0 ? avgCum / avgTotalVol : 1;
        const latestRatio = avgTotalVol > 0 && latestAvgCum > 0 ? latestAvgCum / avgTotalVol : 0.5;
        const projectedTotal = latestRatio > 0 ? Math.round(latestTodayCum / latestRatio) : latestTodayCum;
        const projectedAtSlot = Math.round(projectedTotal * avgRatio);

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

    // 5. Compute Volume Surge & Relative Volume (rVol) Metrics
    const todayTotalVol = latestTodayCum;
    const avgCompletionAtNow = avgTotalVol > 0 && latestAvgCum > 0 ? latestAvgCum / avgTotalVol : 1;
    const projectedTotalVol =
      isTodayLive && avgCompletionAtNow > 0 && avgCompletionAtNow < 1
        ? Math.round(todayTotalVol / avgCompletionAtNow)
        : todayTotalVol;

    const rVol = Number((todayTotalVol / (sma20Vol || 1)).toFixed(2));
    const projectedRVol = Number((projectedTotalVol / (sma20Vol || 1)).toFixed(2));
    const paceDeltaPct = latestAvgCum > 0 ? Number((((todayTotalVol - latestAvgCum) / latestAvgCum) * 100).toFixed(1)) : 0;

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
        status,
        statusLabel,
        statusBadge,
        statusDesc,
        breakoutTime,
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
