import { NextResponse } from 'next/server';
import sectorMapping from '../../../../features/market/data/sectorFullMapping.json';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';
import { getSectorBenchmark } from '../../../../features/market/constants/sectorBenchmarks';
import { isMarketIndex } from '../../../../features/market/constants/marketIndexes';
import {
  QuarterlyFinancialRecord,
  StockValuationData,
  ValuationStatus,
} from '../../../../features/market/types/financials.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

const sectorMap = sectorMapping as Record<string, string>;
const stockMap = new Map<string, any>();
(stockDatabase as any[]).forEach((s) => {
  stockMap.set(s.symbol.toUpperCase().trim(), s);
});

// Cache for live fetched financial valuation data (15 minutes)
const financialsCache = new Map<string, { data: StockValuationData; expiry: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();

  if (isMarketIndex(symbol)) {
    return NextResponse.json({
      success: false,
      error: `Ký hiệu ${symbol} là chỉ số thị trường, không có báo cáo tài chính doanh nghiệp riêng lẻ.`,
    }, { status: 400 });
  }

  const refresh = searchParams.get('refresh') === 'true';

  // Check cache
  const cached = financialsCache.get(symbol);
  if (!refresh && cached && cached.expiry > Date.now()) {
    return NextResponse.json({
      success: true,
      source: 'cache',
      data: cached.data,
    });
  }

  try {
    const meta = stockMap.get(symbol) || {
      symbol,
      name: `Công ty CP ${symbol}`,
      exchange: 'HOSE',
      sector: sectorMap[symbol] || 'Doanh nghiệp niêm yết',
    };
    const sectorName = sectorMap[symbol] || meta.sector || 'Chung';
    const benchmark = getSectorBenchmark(sectorName);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Origin': 'https://iq.vietcap.com.vn',
      'Referer': 'https://iq.vietcap.com.vn/',
    };

    // Parallel fetch from official Vietcap IQ endpoints
    const [statRes, incRes, bsRes] = await Promise.allSettled([
      fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${symbol}/statistics-financial`, {
        headers,
        next: { revalidate: 900 },
      }),
      fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${symbol}/financial-statement?section=INCOME_STATEMENT`, {
        headers,
        next: { revalidate: 900 },
      }),
      fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${symbol}/financial-statement?section=BALANCE_SHEET`, {
        headers,
        next: { revalidate: 900 },
      }),
    ]);

    let statList: any[] = [];
    if (statRes.status === 'fulfilled' && statRes.value.ok) {
      const json = await statRes.value.json();
      if (json.successful && Array.isArray(json.data)) {
        statList = json.data;
      }
    }

    let incQuarters: any[] = [];
    if (incRes.status === 'fulfilled' && incRes.value.ok) {
      const json = await incRes.value.json();
      if (json.successful && json.data && Array.isArray(json.data.quarters)) {
        incQuarters = json.data.quarters;
      }
    }

    let bsQuarters: any[] = [];
    if (bsRes.status === 'fulfilled' && bsRes.value.ok) {
      const json = await bsRes.value.json();
      if (json.successful && json.data && Array.isArray(json.data.quarters)) {
        bsQuarters = json.data.quarters;
      }
    }

    // 1. Parse latest statistics (P/E, P/B, ROE, ROA, Margins, Leverage)
    const validStats = statList.filter((d: any) => typeof d.pe === 'number' || typeof d.pb === 'number');
    const latestStat = validStats.length > 0 ? validStats[validStats.length - 1] : (statList[statList.length - 1] || {});

    const pe = typeof latestStat.pe === 'number' ? Number(latestStat.pe.toFixed(2)) : null;
    const pb = typeof latestStat.pb === 'number' ? Number(latestStat.pb.toFixed(2)) : null;
    const ps = typeof latestStat.ps === 'number' ? Number(latestStat.ps.toFixed(2)) : null;
    const evToEbitda = typeof latestStat.evToEbitda === 'number' ? Number(latestStat.evToEbitda.toFixed(2)) : null;
    const roe = typeof latestStat.roe === 'number' ? Number((latestStat.roe * 100).toFixed(2)) : null;
    const roa = typeof latestStat.roa === 'number' ? Number((latestStat.roa * 100).toFixed(2)) : null;
    const debtToEquity = typeof latestStat.debtToEquity === 'number' ? Number(latestStat.debtToEquity.toFixed(2)) : null;
    const currentRatio = typeof latestStat.currentRatio === 'number' ? Number(latestStat.currentRatio.toFixed(2)) : null;

    const reportQuarter = latestStat.quarter || incQuarters[incQuarters.length - 1]?.lengthReport || 2;
    const reportYear = latestStat.year || incQuarters[incQuarters.length - 1]?.yearReport || 2026;
    const reportPeriod = `Q${reportQuarter}/${reportYear}`;

    // 2. Map Balance Sheet by Quarter Key (e.g. "2026_2")
    const bsMap = new Map<string, { totalAssets: number; totalDebt: number; ownersEquity: number }>();
    bsQuarters.forEach((b: any) => {
      if (b.yearReport && b.lengthReport) {
        const key = `${b.yearReport}_${b.lengthReport}`;
        bsMap.set(key, {
          totalAssets: b.bsa1 ?? b.bsa53 ?? 0,
          totalDebt: b.bsa54 ?? 0,
          ownersEquity: b.bsa78 ?? b.bsa79 ?? 0,
        });
      }
    });

    // 3. Process Quarterly Income Statement Records
    const sortedIncQuarters = incQuarters
      .filter((q: any) => q.yearReport && q.lengthReport)
      .sort((a: any, b: any) => {
        if (a.yearReport !== b.yearReport) return a.yearReport - b.yearReport;
        return a.lengthReport - b.lengthReport;
      });

    const quarterlyHistory: QuarterlyFinancialRecord[] = sortedIncQuarters.slice(-8).map((q: any) => {
      const qKey = `${q.yearReport}_${q.lengthReport}`;
      const bsItem = bsMap.get(qKey);
      const revenue = q.isa3 ?? q.isa1 ?? 0;
      const grossProfit = q.isa5 ?? 0;
      const netProfit = q.isa22 ?? q.isa20 ?? 0;
      const grossMargin = revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(2)) : 0;
      const netMargin = revenue > 0 ? Number(((netProfit / revenue) * 100).toFixed(2)) : 0;
      const eps = q.isa23 ?? 0;

      return {
        quarter: q.lengthReport,
        year: q.yearReport,
        periodLabel: `Q${q.lengthReport}/${q.yearReport}`,
        revenue,
        grossProfit,
        netProfit,
        grossMargin,
        netMargin,
        eps,
        totalAssets: bsItem?.totalAssets,
        ownersEquity: bsItem?.ownersEquity,
        totalDebt: bsItem?.totalDebt,
      };
    });

    // 4. Calculate PEG (Option A + Method 1: TTM Profit Growth YoY)
    let ttmNetProfitCurrent = 0;
    let ttmNetProfitPrior = 0;
    let earningsGrowthYoY: number | null = null;
    let peg: number | null = null;

    if (quarterlyHistory.length >= 8) {
      const last4 = quarterlyHistory.slice(-4);
      const prior4 = quarterlyHistory.slice(-8, -4);
      ttmNetProfitCurrent = last4.reduce((sum, item) => sum + item.netProfit, 0);
      ttmNetProfitPrior = prior4.reduce((sum, item) => sum + item.netProfit, 0);

      if (ttmNetProfitPrior > 0) {
        earningsGrowthYoY = Number((((ttmNetProfitCurrent - ttmNetProfitPrior) / ttmNetProfitPrior) * 100).toFixed(2));
      } else if (ttmNetProfitPrior < 0 && ttmNetProfitCurrent > 0) {
        // Turned around from loss to profit
        earningsGrowthYoY = 100.0;
      }
    } else if (quarterlyHistory.length >= 5) {
      // Fallback with available quarters comparing latest Q vs Q same period last year
      const latestQ = quarterlyHistory[quarterlyHistory.length - 1];
      const sameQPrevYear = quarterlyHistory.find(
        (item) => item.quarter === latestQ.quarter && item.year === latestQ.year - 1
      );
      if (sameQPrevYear && sameQPrevYear.netProfit > 0) {
        earningsGrowthYoY = Number((((latestQ.netProfit - sameQPrevYear.netProfit) / sameQPrevYear.netProfit) * 100).toFixed(2));
      }
    }

    if (pe !== null && pe > 0 && earningsGrowthYoY !== null && earningsGrowthYoY > 0) {
      peg = Number((pe / earningsGrowthYoY).toFixed(2));
    }

    // 5. Industry Comparisons
    const sectorPe = benchmark.pe;
    const sectorPb = benchmark.pb;
    const peVsSectorPercent = pe !== null ? Number((((pe - sectorPe) / sectorPe) * 100).toFixed(1)) : null;
    const pbVsSectorPercent = pb !== null ? Number((((pb - sectorPb) / sectorPb) * 100).toFixed(1)) : null;

    // 6. Comprehensive Valuation Evaluation (Peter Lynch & Peer Multiple Matrix)
    let valuationStatus: ValuationStatus = 'FAIR';
    let valuationLabel = 'Định giá Hợp lý';
    let valuationScore = 50; // default middle
    let marginOfSafety = 0;
    const analysisPoints: string[] = [];

    if (pe !== null && pe < 0) {
      valuationStatus = 'LOSS_MAKING';
      valuationLabel = 'Doanh Nghiệp Thua Lỗ (P/E Âm)';
      valuationScore = 20;
      marginOfSafety = -30;
      analysisPoints.push(`⚠️ Doanh nghiệp ghi nhận lỗ trong 4 quý gần nhất khiến P/E bị âm, không thể áp dụng mô hình định giá P/E thông thường.`);
      analysisPoints.push(`🔍 Nên tập trung đánh giá P/B (${pb ? `${pb}x` : 'N/A'}) và khả năng phục hồi dòng tiền kinh doanh.`);
    } else {
      // Calculate composite valuation score (0 - 100)
      let score = 50;

      // Component 1: PE vs Industry (Weight 35%)
      if (peVsSectorPercent !== null) {
        if (peVsSectorPercent <= -30) {
          score += 20;
          analysisPoints.push(`🟢 P/E hiện tại (${pe}x) thấp hơn đáng kể mức trung bình ngành ${sectorName} (${sectorPe}x) tới ${Math.abs(peVsSectorPercent)}%.`);
        } else if (peVsSectorPercent <= -10) {
          score += 10;
          analysisPoints.push(`🟢 P/E hiện tại (${pe}x) đang chiết khấu ${Math.abs(peVsSectorPercent)}% so với định giá trung bình ngành.`);
        } else if (peVsSectorPercent >= 30) {
          score -= 20;
          analysisPoints.push(`🔴 P/E hiện tại (${pe}x) cao hơn trung bình ngành (${sectorPe}x) đến +${peVsSectorPercent}%, phản ánh kỳ vọng rất cao.`);
        } else {
          analysisPoints.push(`🟡 P/E hiện tại (${pe}x) nằm trong vùng dao động hợp lý so với ngành (${sectorPe}x).`);
        }
      }

      // Component 2: PB vs Industry (Weight 25%)
      if (pbVsSectorPercent !== null) {
        if (pbVsSectorPercent <= -25) {
          score += 15;
          analysisPoints.push(`🟢 Định giá tài sản P/B (${pb}x) rẻ hơn đáng kể so với mặt bằng ngành (${sectorPb}x).`);
        } else if (pbVsSectorPercent >= 35) {
          score -= 15;
          analysisPoints.push(`🔴 P/B (${pb}x) đang ở mức cao hơn ngành (${sectorPb}x) +${pbVsSectorPercent}%.`);
        } else {
          analysisPoints.push(`🟡 P/B (${pb}x) bám sát trung bình ngành (${sectorPb}x).`);
        }
      }

      // Component 3: PEG Peter Lynch & Growth (Weight 40%)
      if (peg !== null) {
        if (peg < 0.7) {
          score += 25;
          analysisPoints.push(`💎 Chỉ số PEG đạt ${peg} (< 0.7) - Chuẩn Peter Lynch: Tốc độ tăng trưởng LNST (+${earningsGrowthYoY}%) vượt trội so với mức định giá P/E.`);
        } else if (peg <= 1.1) {
          score += 15;
          analysisPoints.push(`🟢 Chỉ số PEG đạt ${peg} (khoảng 1.0) - Tăng trưởng LNST (+${earningsGrowthYoY}%) tương xứng với định giá P/E.`);
        } else if (peg > 2.0) {
          score -= 20;
          analysisPoints.push(`⚠️ Chỉ số PEG đạt ${peg} (> 2.0) - Tốc độ tăng trưởng LNST (+${earningsGrowthYoY}%) chưa theo kịp mức P/E hiện tại.`);
        } else {
          score += 5;
          analysisPoints.push(`🟡 Chỉ số PEG đạt ${peg} - Mức định giá ở trạng thái cân bằng.`);
        }
      } else if (earningsGrowthYoY !== null && earningsGrowthYoY <= 0) {
        score -= 20;
        analysisPoints.push(`⚠️ Tốc độ tăng trưởng LNST TTM YoY suy giảm (${earningsGrowthYoY}%), do đó chỉ số PEG không áp dụng được.`);
      }

      // Special Insight: Divergence between high P/E and deep discount P/B (e.g. HHS, turnaround or asset-play stocks)
      if (pe !== null && pe > 60 && pb !== null && pb < 0.8) {
        analysisPoints.push(`🔍 Hiện tượng lệch pha P/E & P/B: P/E ở mức rất cao (${pe}x) do LNST 4 quý gần nhất suy giảm, nhưng P/B chỉ ${pb}x (thị giá đang chiết khấu sâu ${pbVsSectorPercent ? Math.abs(pbVsSectorPercent) : ''}% so với giá trị tài sản sổ sách BVPS). Doanh nghiệp sở hữu tài sản lớn nhưng tăng trưởng lợi nhuận ngắn hạn đang yếu.`);
      }

      // Clamp score
      valuationScore = Math.min(95, Math.max(10, score));

      // Classify status based on score
      if (valuationScore >= 65) {
        valuationStatus = 'UNDERVALUED';
        valuationLabel = 'Định Giá Hấp Dẫn (Rẻ)';
        marginOfSafety = Number(((valuationScore - 50) * 0.8).toFixed(1));
      } else if (valuationScore <= 40) {
        valuationStatus = 'OVERVALUED';
        valuationLabel = 'Định Giá Cao (Đắt)';
        marginOfSafety = Number(((valuationScore - 50) * 0.6).toFixed(1));
      } else {
        valuationStatus = 'FAIR';
        valuationLabel = 'Định Giá Hợp Lý';
        marginOfSafety = Number(((valuationScore - 50) * 0.4).toFixed(1));
      }
    }

    const summaryThesis = valuationStatus === 'UNDERVALUED'
      ? `${symbol} đang có mức định giá rẻ hơn tương đối so với tiềm năng tăng trưởng (PEG = ${peg ?? 'N/A'}) và mặt bằng ngành ${sectorName}. Biên an toàn ước tính +${marginOfSafety}%.`
      : valuationStatus === 'OVERVALUED'
      ? `${symbol} đang được thị trường định giá cao hơn trung bình ngành, cần tăng trưởng lợi nhuận bứt phá hơn để củng cố mức P/E hiện tại.`
      : `${symbol} đang giao dịch ở vùng định giá hợp lý, phản ánh đúng triển vọng tăng trưởng và nền tảng tài chính hiện tại.`;

    const result: StockValuationData = {
      symbol,
      name: meta.name || symbol,
      sector: sectorName,
      currentPrice: 0, // Frontend will inject live quote price
      reportPeriod,
      pe,
      pb,
      ps,
      evToEbitda,
      roe,
      roa,
      debtToEquity,
      currentRatio,
      ttmNetProfitCurrent,
      ttmNetProfitPrior,
      earningsGrowthYoY,
      peg,
      sectorPe,
      sectorPb,
      peVsSectorPercent,
      pbVsSectorPercent,
      valuationStatus,
      valuationLabel,
      valuationScore,
      marginOfSafety,
      summaryThesis,
      analysisPoints,
      quarterlyHistory,
    };

    // Save to cache
    financialsCache.set(symbol, { data: result, expiry: Date.now() + CACHE_TTL_MS });

    return NextResponse.json({
      success: true,
      source: 'live',
      data: result,
    });
  } catch (err: any) {
    console.error(`[API /api/market/financials] Error processing ${symbol}:`, err);
    return NextResponse.json({
      success: false,
      error: `Không thể tải báo cáo tài chính cho mã ${symbol}: ${err.message || 'Lỗi hệ thống'}`,
    }, { status: 500 });
  }
}
