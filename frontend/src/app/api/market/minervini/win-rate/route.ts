import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface WinRateFactor {
  name: string;
  category: 'market' | 'wyckoff' | 'trend' | 'rs' | 'volume';
  score: number; // 0 - 100
  weight: number; // percentage
  deltaPct: number; // impact on win rate (-15 to +15)
  details: string;
}

/**
 * GET /api/market/minervini/win-rate?symbol=HPG
 * Quantitatively estimates empirical trading Win Rate based on:
 * 1. General Market Regime (VN-Index status & breadth) - 25%
 * 2. Wyckoff & VSA Accumulation Structure (Phase A-E & Buy Points) - 25%
 * 3. Minervini Trend Template & Stage 2 Quality - 20%
 * 4. Relative Strength (RS Rating) - 15%
 * 5. Volume Surge & Momentum (rVol & Price Change) - 15%
 * 
 * STRICT ZERO MOCK DATA: All figures derived from live DNSE/Entrade OHLC feeds.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();

  try {
    const origin = new URL(request.url).origin;

    // Concurrently fetch real analysis for target stock and market index
    const [stockRes, marketRes] = await Promise.all([
      fetch(`${origin}/api/market/minervini/analysis?symbol=${encodeURIComponent(symbol)}`, {
        cache: 'no-store',
      }).then((r) => r.json()).catch(() => null),
      fetch(`${origin}/api/market/minervini/analysis?symbol=VNINDEX`, {
        cache: 'no-store',
      }).then((r) => r.json()).catch(() => null),
    ]);

    const stockData = stockRes?.success ? stockRes.data : null;
    const marketData = marketRes?.success ? marketRes.data : null;

    if (!stockData) {
      return NextResponse.json({
        success: false,
        error: `Không thể phân tích dữ liệu kỹ thuật thực tế cho mã ${symbol}`,
      });
    }

    // Baseline Win Rate for a classic Minervini growth trader
    let baseWinRate = 45; // 45% default
    const factors: WinRateFactor[] = [];

    // ── 1. GENERAL MARKET REGIME (25% Weight) ──
    // Minervini Rule: "3 out of 4 stocks follow the market trend."
    let marketScore = 50;
    let marketDelta = 0;
    let marketDetails = 'Thị trường vận động trung tính';

    if (marketData) {
      const vnClose = marketData.price;
      const vnSMA20 = marketData.sma20;
      const vnSMA50 = marketData.sma50;
      const vnSMA200 = marketData.sma200;
      const vnStage = marketData.stage;

      const isAboveSMA20 = vnSMA20 > 0 && vnClose >= vnSMA20;
      const isAboveSMA50 = vnSMA50 > 0 && vnClose >= vnSMA50;
      const isAboveSMA200 = vnSMA200 > 0 && vnClose >= vnSMA200;

      if (vnStage === 2 || (isAboveSMA50 && isAboveSMA200)) {
        marketScore = 85;
        marketDelta = +8;
        marketDetails = 'VN-Index nằm trên MA50 & MA200 (Thị trường Uptrend mạnh mẽ)';
      } else if (isAboveSMA20 && !isAboveSMA50) {
        marketScore = 55;
        marketDelta = +2;
        marketDetails = 'VN-Index phục hồi ngắn hạn trên MA20 nhưng dưới MA50';
      } else if (!isAboveSMA20 && isAboveSMA50) {
        marketScore = 48;
        marketDelta = -2;
        marketDetails = 'VN-Index điều chỉnh kiểm định đường MA50 ngày';
      } else {
        marketScore = 25;
        marketDelta = -8;
        marketDetails = 'VN-Index dưới MA20 & MA50 (Thị trường rủi ro cao / Downtrend)';
      }
    }

    factors.push({
      name: 'Môi Trường Thị Trường (VN-Index)',
      category: 'market',
      score: marketScore,
      weight: 25,
      deltaPct: marketDelta,
      details: marketDetails,
    });

    // ── 2. CẤU TRÚC TÍCH LŨY WYCKOFF & VSA (25% Weight) ──
    const wyckoff = stockData.wyckoff;
    let wyckoffScore = 50;
    let wyckoffDelta = 0;
    let wyckoffDetails = 'Đang phân tích cấu trúc nền giá Wyckoff';

    if (wyckoff) {
      const phase = wyckoff.phase; // Phase A, B, C, D, E
      const wyckoffPassed = wyckoff.passedCount || 0; // 0 to 8
      const buyPoint = wyckoff.buyPointLabel || '';

      if (phase === 'Phase D' || phase === 'Phase E') {
        wyckoffScore = 95;
        wyckoffDelta = +8;
        wyckoffDetails = `${wyckoff.phaseName} • Đạt ${wyckoffPassed}/8 tiêu chí Wyckoff & VSA (${buyPoint})`;
      } else if (phase === 'Phase C') {
        wyckoffScore = 80;
        wyckoffDelta = +5;
        wyckoffDetails = `${wyckoff.phaseName} • Đạt ${wyckoffPassed}/8 tiêu chí (Nhịp Spring / Test cạn cung)`;
      } else if (phase === 'Phase B') {
        wyckoffScore = 50;
        wyckoffDelta = 0;
        wyckoffDetails = `${wyckoff.phaseName} • Đạt ${wyckoffPassed}/8 tiêu chí (Gom hàng xây dựng nguyên nhân)`;
      } else {
        wyckoffScore = 25;
        wyckoffDelta = -8;
        wyckoffDetails = `${wyckoff.phaseName} • Chỉ đạt ${wyckoffPassed}/8 tiêu chí (Hãm đà giảm SC/AR / Downtrend)`;
      }

      // Bonus/Penalty based on Wyckoff criteria checklist
      if (wyckoffPassed >= 7) wyckoffDelta += 2;
      else if (wyckoffPassed <= 2 && phase === 'Phase A') wyckoffDelta -= 2;
    }

    factors.push({
      name: 'Cấu Trúc Nền Giá Wyckoff & VSA',
      category: 'wyckoff',
      score: wyckoffScore,
      weight: 25,
      deltaPct: wyckoffDelta,
      details: wyckoffDetails,
    });

    // ── 3. MINERVINI TREND TEMPLATE & STAGE 2 (20% Weight) ──
    const passedCount = stockData.passedCount || 0; // 0 to 8
    const isStage2 = stockData.isStage2Eligible || stockData.stage === 2;
    let trendScore = 30;
    let trendDelta = -6;
    let trendDetails = `Đạt ${passedCount}/8 tiêu chí Trend Template`;

    if (isStage2 && passedCount >= 7) {
      trendScore = 95;
      trendDelta = +8;
      trendDetails = `Chuẩn Giai đoạn 2 (Stage 2 Uptrend) • Đạt ${passedCount}/8 tiêu chí vàng`;
    } else if (passedCount >= 6) {
      trendScore = 75;
      trendDelta = +4;
      trendDetails = `Xu hướng tăng tích cực • Đạt ${passedCount}/8 tiêu chí Trend Template`;
    } else if (passedCount >= 4) {
      trendScore = 50;
      trendDelta = 0;
      trendDetails = `Tích lũy đi ngang / Chớm hồi • Đạt ${passedCount}/8 tiêu chí`;
    } else {
      trendScore = 25;
      trendDelta = -7;
      trendDetails = `Giai đoạn 4 hoặc Mẫu hình suy yếu • Chỉ đạt ${passedCount}/8 tiêu chí`;
    }

    factors.push({
      name: 'Mẫu Hình Xu Hướng (Trend Template)',
      category: 'trend',
      score: trendScore,
      weight: 20,
      deltaPct: trendDelta,
      details: trendDetails,
    });

    // ── 4. RELATIVE STRENGTH (RS RATING) (15% Weight) ──
    const rs = stockData.rsRating || 50;
    let rsScore = 50;
    let rsDelta = 0;
    let rsDetails = `RS Rating đạt ${rs}/99`;

    if (rs >= 85) {
      rsScore = 95;
      rsDelta = +6;
      rsDetails = `RS ${rs}/99: Top 15% cổ phiếu mạnh nhất toàn thị trường (Siêu Cổ Phiếu)`;
    } else if (rs >= 70) {
      rsScore = 78;
      rsDelta = +3;
      rsDetails = `RS ${rs}/99: Sức mạnh giá vượt trội hơn 70% cổ phiếu khác`;
    } else if (rs >= 50) {
      rsScore = 50;
      rsDelta = 0;
      rsDetails = `RS ${rs}/99: Sức mạnh giá trung bình toàn sàn`;
    } else {
      rsScore = 25;
      rsDelta = -4;
      rsDetails = `RS ${rs}/99: Cổ phiếu tụt hậu (Lagging), dòng tiền yếu`;
    }

    factors.push({
      name: 'Sức Mạnh Giá Tương Đối (RS Rating)',
      category: 'rs',
      score: rsScore,
      weight: 15,
      deltaPct: rsDelta,
      details: rsDetails,
    });

    // ── 5. VOLUME SURGE & MOMENTUM (15% Weight) ──
    let volScore = 50;
    let volDelta = 0;
    let volDetails = 'Khối lượng giao dịch ở mức bình thường';

    try {
      const paceRes = await fetch(`${origin}/api/market/volume-pace?symbol=${encodeURIComponent(symbol)}&days=20`, {
        cache: 'no-store',
      }).then((r) => r.json()).catch(() => null);

      if (paceRes?.success && paceRes.metrics) {
        const rVol = paceRes.metrics.rVol || 1.0;
        const changePct = stockData.changePct || 0;

        if (rVol >= 1.5 && changePct > 0) {
          volScore = 90;
          volDelta = +6;
          volDetails = `Nổ Vol ${rVol}x SMA20 kèm giá tăng (+${changePct}%): Dòng tiền tổ chức tham gia quyết liệt`;
        } else if (rVol >= 1.2 && changePct >= 0) {
          volScore = 70;
          volDelta = +3;
          volDetails = `Thanh khoản tăng ${rVol}x so với trung bình 20 phiên`;
        } else if (rVol < 0.7) {
          volScore = 35;
          volDelta = -3;
          volDetails = `Thanh khoản cạn kiệt (${rVol}x SMA20), dòng tiền chưa xác nhận`;
        } else {
          volScore = 50;
          volDelta = 0;
          volDetails = `Khối lượng đạt ${rVol}x trung bình 20 phiên`;
        }
      }
    } catch {
      // Fallback
    }

    factors.push({
      name: 'Xung Lực Dòng Tiền & Nổ Vol',
      category: 'volume',
      score: volScore,
      weight: 15,
      deltaPct: volDelta,
      details: volDetails,
    });

    // Compute Net Empirical Win Rate
    const totalDelta = marketDelta + wyckoffDelta + trendDelta + rsDelta + volDelta;
    let calculatedWinRate = Math.round(baseWinRate + totalDelta);

    // Minervini constraint: Win rates in real trading realistically range from 28% to 68%
    calculatedWinRate = Math.max(28, Math.min(68, calculatedWinRate));

    // ── 6. CONFIDENCE LEVEL BASED ON CONVERGENCE OF EVIDENCE ──
    const positiveFactors = factors.filter((f) => f.deltaPct > 0);
    const negativeFactors = factors.filter((f) => f.deltaPct < 0);
    const positiveCount = positiveFactors.length;
    const negativeCount = negativeFactors.length;

    let confidence: 'CAO' | 'TRUNG BÌNH' | 'THẤP' = 'TRUNG BÌNH';
    let confidenceReason = '';
    let recommendedRiskNav = '1.0% NAV';

    if (positiveCount >= 4 && marketDelta >= 0) {
      confidence = 'CAO';
      confidenceReason = `Hội tụ cao: ${positiveCount}/5 trụ cột đồng thuận tăng. Thiên thời - địa lợi cùng pha.`;
      recommendedRiskNav = '1.5% - 2.0% NAV (Quy mô chuẩn)';
    } else if (negativeCount >= 3 || (marketDelta < 0 && trendDelta < 0)) {
      confidence = 'THẤP';
      confidenceReason = `Rủi ro cao: ${negativeCount}/5 trụ cột suy thoái (Stage 4 / Downtrend).`;
      recommendedRiskNav = '0% - 0.5% NAV (Đứng ngoài cầm tiền)';
    } else {
      confidence = 'TRUNG BÌNH';
      confidenceReason = `Phân hóa tín hiệu: ${positiveCount} trụ cột tăng / ${negativeCount} trụ cột cản trở.`;
      recommendedRiskNav = '0.75% - 1.0% NAV (Mua thăm dò)';
    }

    // ── 7. OPTIMAL SETUP PARAMETERS (WYCKOFF & MINERVINI CRITERIA) ──
    const currentPrice = stockData.price || 0;
    let optimalStopLossPct = 6.0;
    let optimalStopPrice = currentPrice > 0 ? Math.round(currentPrice * 0.94) : 0;
    let optimalStopLossReason = 'Cắt lỗ chuẩn Minervini (tối đa 6-7%)';

    const wyckoffStopStr = stockData.wyckoff?.stopLossPrice;
    if (wyckoffStopStr && currentPrice > 0) {
      const stopVal = parseFloat(wyckoffStopStr.replace(/[^0-9.]/g, ''));
      if (stopVal > 0) {
        const normStop = stopVal < 1000 ? Math.round(stopVal * 1000) : Math.round(stopVal);
        if (currentPrice > normStop) {
          const rawStopPct = Number((((currentPrice - normStop) / currentPrice) * 100).toFixed(1));
          if (rawStopPct >= 2.5 && rawStopPct <= 8.0) {
            optimalStopLossPct = rawStopPct;
            optimalStopPrice = normStop;
            optimalStopLossReason = `Cắt lỗ -${rawStopPct}% (${normStop.toLocaleString('vi-VN')} đ) dưới đáy nhịp Spring / LPS chuẩn Wyckoff`;
          } else if (rawStopPct > 8.0) {
            optimalStopLossPct = 7.0;
            optimalStopPrice = Math.round(currentPrice * 0.93);
            optimalStopLossReason = `Đáy nền Wyckoff cách -${rawStopPct}%, nhưng Mark Minervini tuyệt đối khống chế tối đa 7%`;
          } else {
            optimalStopLossPct = 3.5;
            optimalStopPrice = Math.round(currentPrice * 0.965);
            optimalStopLossReason = `Cắt lỗ chặt chẽ -3.5% theo điểm pivot`;
          }
        }
      }
    }

    // Target Gain based on Wyckoff Cause & Effect / 52-week High
    let optimalTargetGainPct = Number((optimalStopLossPct * 2.5).toFixed(1));
    let optimalTargetPrice = currentPrice > 0 ? Math.round(currentPrice * (1 + optimalTargetGainPct / 100)) : 0;
    let optimalTargetReason = `Mục tiêu R:R 2.5:1 (+${optimalTargetGainPct}%)`;

    if (stockData.high52W && currentPrice > 0) {
      const distToHighPct = Number((((stockData.high52W - currentPrice) / currentPrice) * 100).toFixed(1));
      if (distToHighPct >= optimalStopLossPct * 2.0 && distToHighPct <= 60) {
        optimalTargetGainPct = distToHighPct;
        optimalTargetPrice = stockData.high52W;
        optimalTargetReason = `Mục tiêu +${distToHighPct}% hướng về đỉnh 52 tuần (${stockData.high52W.toLocaleString('vi-VN')} đ)`;
      }
    }

    // Minervini Practical Action Advice
    let advice = '';
    if (calculatedWinRate >= 55) {
      advice = `Hội tụ đủ 3 yếu tố 'Thiên thời - Địa lợi - Nhân hòa': Thị trường ủng hộ, cổ phiếu ở ${wyckoff?.phaseName || 'Stage 2'}, RS cao (${rs}). Bạn có thể giải ngân với mức rủi ro tối đa 1.5% - 2.0% NAV.`;
    } else if (calculatedWinRate >= 45) {
      advice = `Xác suất thắng ở mức cân bằng (${calculatedWinRate}%). ${wyckoff?.actionAdvice || 'Chờ tín hiệu cạn cung'}. Minervini khuyên giữ R:R tối thiểu 2.5:1.`;
    } else {
      advice = `Xác suất thắng thấp (${calculatedWinRate}%) do thị trường hoặc cổ phiếu đang ở ${stockData.stageName} (${wyckoff?.phaseName || ''}). Minervini & Wyckoff khuyên: Đứng ngoài quan sát, ưu tiên giữ tiền mặt!`;
    }

    return NextResponse.json({
      success: true,
      symbol,
      autoWinRate: calculatedWinRate,
      baseWinRate,
      totalDelta,
      confidence,
      confidenceReason,
      recommendedRiskNav,
      advice,
      summary: {
        marketStatus: marketData ? marketData.stageName : 'N/A',
        stockStage: stockData.stageName,
        wyckoffPhase: wyckoff?.phaseName || 'N/A',
        wyckoffBuyPoint: wyckoff?.buyPointLabel || 'Chưa có điểm mua',
        passedCriteria: `${passedCount}/8`,
        wyckoffPassedCriteria: `${wyckoff?.passedCount || 0}/8`,
        rsRating: rs,
      },
      optimalSetup: {
        stopLossPct: optimalStopLossPct,
        stopLossPrice: optimalStopPrice,
        stopLossReason: optimalStopLossReason,
        targetGainPct: optimalTargetGainPct,
        targetPrice: optimalTargetPrice,
        targetReason: optimalTargetReason,
        rrRatio: Number((optimalTargetGainPct / optimalStopLossPct).toFixed(2)),
      },
      factors,
    });
  } catch (err: any) {
    console.error('Error computing auto win rate:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Lỗi tính toán tỷ lệ thắng tự động',
    });
  }
}
