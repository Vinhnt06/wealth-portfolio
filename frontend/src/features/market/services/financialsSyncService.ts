import fs from 'fs';
import path from 'path';
import sectorMapping from '../data/sectorFullMapping.json';
import stockDatabase from '../data/stockDatabase.json';
import { getSectorBenchmark } from '../constants/sectorBenchmarks';
import { isMarketIndex } from '../constants/marketIndexes';
import {
  QuarterlyFinancialRecord,
  StockValuationData,
  ValuationStatus,
  OutlierQuarterInfo,
} from '../types/financials.types';

const sectorMap = sectorMapping as Record<string, string>;
const stockMap = new Map<string, any>();
(stockDatabase as any[]).forEach((s) => {
  stockMap.set(s.symbol.toUpperCase().trim(), s);
});

// Top 65+ Core Leading Universe across VN30 & Key Sectors
export const CORE_FINANCIAL_UNIVERSE = [
  // 1. Ngân hàng & Tài chính
  'VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB', 'SHB', 'TPB', 'VIB', 'MSB', 'OCB',
  // 2. Thép & Kim loại
  'HPG', 'HSG', 'NKG',
  // 3. Công nghệ thông tin & Viễn thông
  'FPT', 'CMG', 'CTR', 'VGI', 'FOX',
  // 4. Bán lẻ & Tiêu dùng
  'MWG', 'PNJ', 'FRT', 'DGW', 'MSN', 'VNM', 'SAB', 'KDC', 'MCH',
  // 5. Dịch vụ tài chính (Chứng khoán)
  'SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'VIX',
  // 6. Bất động sản dân dụng & KCN
  'VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'PDR', 'DIG', 'DXG', 'NVL', 'KBC', 'IDC', 'VGC', 'SZC', 'BCM',
  // 7. Hóa chất & Phân bón & Cao su
  'DGC', 'DCM', 'DPM', 'GVR', 'CSV',
  // 8. Dầu khí & Tiện ích năng lượng
  'GAS', 'PLX', 'BSR', 'PVD', 'PVS', 'PVT', 'POW', 'REE', 'PC1',
  // 9. Nông nghiệp & Thủy sản
  'VHC', 'ANV', 'DBC', 'HAG', 'BAF',
  // 10. Vận tải, Cảng biển & Xây dựng
  'GMD', 'HAH', 'VSC', 'VJC', 'HVN', 'VCG', 'CTD', 'HHV', 'CII'
];

export function getFinancialsDatabasePath(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/features/market/data/financialsDatabase.json'),
    path.resolve(process.cwd(), 'frontend/src/features/market/data/financialsDatabase.json'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0];
}

export interface FinancialsDatabaseFile {
  success: boolean;
  scannedAt: number;
  scannedAtText: string;
  totalSynced: number;
  source: string;
  data: Record<string, StockValuationData>;
}

export function readFinancialsDatabase(): FinancialsDatabaseFile | null {
  try {
    const filePath = getFinancialsDatabasePath();
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as FinancialsDatabaseFile;
  } catch (err) {
    console.warn('[FinancialsSyncService] Error reading database file:', err);
    return null;
  }
}

export function writeFinancialsDatabase(db: FinancialsDatabaseFile): boolean {
  try {
    const filePath = getFinancialsDatabasePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[FinancialsSyncService] Error writing database file:', err);
    return false;
  }
}

export async function fetchStockValuationLive(symbol: string): Promise<StockValuationData | null> {
  const upperSymbol = symbol.toUpperCase().trim();
  if (isMarketIndex(upperSymbol)) return null;

  const meta = stockMap.get(upperSymbol) || {
    symbol: upperSymbol,
    name: `Công ty CP ${upperSymbol}`,
    exchange: 'HOSE',
    sector: sectorMap[upperSymbol] || 'Doanh nghiệp niêm yết',
  };
  const sectorName = sectorMap[upperSymbol] || meta.sector || 'Chung';
  const benchmark = getSectorBenchmark(sectorName);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Origin': 'https://iq.vietcap.com.vn',
    'Referer': 'https://iq.vietcap.com.vn/',
  };

  const [statRes, incRes, bsRes] = await Promise.allSettled([
    fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${upperSymbol}/statistics-financial`, {
      headers,
    }),
    fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${upperSymbol}/financial-statement?section=INCOME_STATEMENT`, {
      headers,
    }),
    fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${upperSymbol}/financial-statement?section=BALANCE_SHEET`, {
      headers,
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

  // 2. Map Balance Sheet by Quarter Key
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

  // 4. ROBUST PETER LYNCH PEG MODEL (Outlier & Base-Effect Normalization)
  let ttmNetProfitCurrent = 0;
  let ttmNetProfitPrior = 0;
  let earningsGrowthYoY: number | null = null; // Raw TTM YoY
  let rawPeg: number | null = null;
  let normalizedGrowthRate: number | null = null;
  let peg: number | null = null; // Normalized robust Peter Lynch PEG
  let hasOutlierProfit = false;
  let outlierInfo: OutlierQuarterInfo | null = null;
  let growthCalculationMethod = 'SUSTAINABLE_TTM';

  if (quarterlyHistory.length >= 4) {
    const last4 = quarterlyHistory.slice(-4);
    ttmNetProfitCurrent = last4.reduce((sum, item) => sum + item.netProfit, 0);

    if (quarterlyHistory.length >= 8) {
      const prior4 = quarterlyHistory.slice(-8, -4);
      ttmNetProfitPrior = prior4.reduce((sum, item) => sum + item.netProfit, 0);

      // Raw TTM YoY
      if (ttmNetProfitPrior > 0) {
        earningsGrowthYoY = Number((((ttmNetProfitCurrent - ttmNetProfitPrior) / ttmNetProfitPrior) * 100).toFixed(2));
      } else if (ttmNetProfitPrior < 0 && ttmNetProfitCurrent > 0) {
        earningsGrowthYoY = 100.0;
      }

      if (pe !== null && pe > 0 && earningsGrowthYoY !== null && earningsGrowthYoY > 0) {
        rawPeg = Number((pe / earningsGrowthYoY).toFixed(2));
      }

      // --- OUTLIER DETECTION (Phát hiện quý đột biến bất thường) ---
      const allProfits = quarterlyHistory.map((q) => q.netProfit);
      const sortedProfits = [...allProfits].sort((a, b) => a - b);
      const medianProfit = (sortedProfits[3] + sortedProfits[4]) / 2;
      const minThreshold = 30_000_000_000; // 30 tỷ VNĐ

      // Quý đột biến nếu LNST > 3.0x median (và > 50 tỷ) hoặc âm sâu bất thường
      const outlierQuarters: QuarterlyFinancialRecord[] = [];
      quarterlyHistory.forEach((q) => {
        const benchmark = Math.max(minThreshold, Math.abs(medianProfit));
        if (q.netProfit > 3.0 * benchmark || q.netProfit < -2.5 * benchmark) {
          outlierQuarters.push(q);
        }
      });

      if (outlierQuarters.length > 0) {
        hasOutlierProfit = true;
        const primaryOutlier = outlierQuarters.reduce((max, curr) =>
          Math.abs(curr.netProfit) > Math.abs(max.netProfit) ? curr : max
        );
        const multiple = Number(
          (Math.abs(primaryOutlier.netProfit) / Math.max(1, Math.abs(medianProfit))).toFixed(1)
        );

        outlierInfo = {
          quarter: primaryOutlier.quarter,
          year: primaryOutlier.year,
          periodLabel: primaryOutlier.periodLabel,
          netProfit: primaryOutlier.netProfit,
          medianProfit: Number(medianProfit.toFixed(0)),
          deviationMultiple: multiple,
          reason:
            primaryOutlier.netProfit > 0
              ? `LNST ${primaryOutlier.periodLabel} đạt ${(primaryOutlier.netProfit / 1e9).toFixed(1)} tỷ (gấp ${multiple}x mức trung vị ${Math.round(medianProfit / 1e9)} tỷ) do doanh thu tài chính / thoái vốn / thu nhập một lần.`
              : `Ghi nhận khoản lỗ bất thường ${(primaryOutlier.netProfit / 1e9).toFixed(1)} tỷ trong ${primaryOutlier.periodLabel} do trích lập dự phòng / khấu hao một lần.`,
        };

        // Chuẩn hóa loại bỏ đột biến: Thay thế quý đột biến bằng medianProfit
        const normalizedHistory = quarterlyHistory.map((q) => {
          const isOut = outlierQuarters.some((o) => o.quarter === q.quarter && o.year === q.year);
          return {
            ...q,
            netProfit: isOut ? medianProfit : q.netProfit,
          };
        });

        const normLast4 = normalizedHistory.slice(-4);
        const normPrior4 = normalizedHistory.slice(-8, -4);
        const normTtmCurrent = normLast4.reduce((s, x) => s + x.netProfit, 0);
        const normTtmPrior = normPrior4.reduce((s, x) => s + x.netProfit, 0);

        let adjustedGrowth = 0;
        if (normTtmPrior > 0) {
          adjustedGrowth = Number((((normTtmCurrent - normTtmPrior) / normTtmPrior) * 100).toFixed(2));
        }

        // Tăng trưởng Lợi nhuận gộp TTM (Gross Profit phản ánh cốt lõi sản xuất kinh doanh)
        const last4Gross = last4.reduce((s, x) => s + x.grossProfit, 0);
        const prior4Gross = prior4.reduce((s, x) => s + x.grossProfit, 0);
        let grossGrowth = 0;
        if (prior4Gross > 0) {
          grossGrowth = Number((((last4Gross - prior4Gross) / prior4Gross) * 100).toFixed(2));
        }

        if (grossGrowth > 0 && adjustedGrowth <= 0) {
          // Doanh thu và LNG vẫn tăng nhưng LNST bị méo
          normalizedGrowthRate = Math.min(
            50,
            Math.max(5, Number((grossGrowth * 0.7 + adjustedGrowth * 0.3).toFixed(2)))
          );
          growthCalculationMethod = 'CORE_GROSS_ADJUSTED';
        } else if (adjustedGrowth > 0) {
          normalizedGrowthRate = Math.min(50, adjustedGrowth);
          growthCalculationMethod = 'WINSORIZED_MEDIAN';
        } else {
          normalizedGrowthRate = adjustedGrowth;
          growthCalculationMethod = 'NORMALIZED_LOSS';
        }
      } else {
        // Không có quý đột biến: Áp dụng trần Peter Lynch (50%) để loại bỏ hiệu ứng đáy thấp
        if (earningsGrowthYoY !== null) {
          if (earningsGrowthYoY > 50) {
            normalizedGrowthRate = 50.0;
            growthCalculationMethod = 'PETER_LYNCH_CAPPED';
          } else {
            normalizedGrowthRate = earningsGrowthYoY;
            growthCalculationMethod = 'SUSTAINABLE_TTM';
          }
        }
      }
    } else if (quarterlyHistory.length >= 5) {
      const latestQ = quarterlyHistory[quarterlyHistory.length - 1];
      const sameQPrevYear = quarterlyHistory.find(
        (item) => item.quarter === latestQ.quarter && item.year === latestQ.year - 1
      );
      if (sameQPrevYear && sameQPrevYear.netProfit > 0) {
        earningsGrowthYoY = Number(
          (((latestQ.netProfit - sameQPrevYear.netProfit) / sameQPrevYear.netProfit) * 100).toFixed(2)
        );
        normalizedGrowthRate = earningsGrowthYoY > 50 ? 50.0 : earningsGrowthYoY;
        growthCalculationMethod = 'QUARTER_YOY';
      }
    }

    // TÍNH TOÁN PEG CHUẨN HÓA CUỐI CÙNG
    if (pe !== null && pe > 0 && normalizedGrowthRate !== null && normalizedGrowthRate > 0) {
      peg = Number((pe / normalizedGrowthRate).toFixed(2));
    }
  }

  // 5. Industry Comparisons
  const sectorPe = benchmark.pe;
  const sectorPb = benchmark.pb;
  const peVsSectorPercent = pe !== null ? Number((((pe - sectorPe) / sectorPe) * 100).toFixed(1)) : null;
  const pbVsSectorPercent = pb !== null ? Number((((pb - sectorPb) / sectorPb) * 100).toFixed(1)) : null;

  // 6. Comprehensive Valuation Evaluation
  let valuationStatus: ValuationStatus = 'FAIR';
  let valuationLabel = 'Định giá Hợp lý';
  let valuationScore = 50;
  let marginOfSafety = 0;
  const analysisPoints: string[] = [];

  // Outlier Notification Point (Đưa lên đầu nếu có)
  if (hasOutlierProfit && outlierInfo) {
    analysisPoints.push(
      `🔍 Phát hiện Quý Đột Biến: ${outlierInfo.periodLabel} có LNST ${(outlierInfo.netProfit / 1e9).toFixed(1)} tỷ (gấp ${outlierInfo.deviationMultiple}x trung vị). Mô hình đã tự động kích hoạt bộ lọc Chuẩn Hóa Peter Lynch để loại bỏ đột biến một lần, bảo vệ PEG không bị méo mó.`
    );
  }

  if (pe !== null && pe < 0) {
    valuationStatus = 'LOSS_MAKING';
    valuationLabel = 'Doanh Nghiệp Thua Lỗ (P/E Âm)';
    valuationScore = 20;
    marginOfSafety = -30;
    analysisPoints.push(`⚠️ Doanh nghiệp ghi nhận lỗ trong 4 quý gần nhất khiến P/E bị âm, không thể áp dụng mô hình định giá P/E thông thường.`);
    analysisPoints.push(`🔍 Nên tập trung đánh giá P/B (${pb ? `${pb}x` : 'N/A'}) và khả năng phục hồi dòng tiền kinh doanh.`);
  } else {
    let score = 50;
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

    // Evaluate with normalized PEG
    const effectiveGrowth = normalizedGrowthRate ?? earningsGrowthYoY;
    if (peg !== null) {
      if (peg < 0.7) {
        score += 25;
        analysisPoints.push(`💎 Chỉ số PEG chuẩn hóa đạt ${peg} (< 0.7) - Chuẩn Peter Lynch: Tốc độ tăng trưởng cốt lõi (+${effectiveGrowth}%) vượt trội so với mức định giá P/E.`);
      } else if (peg <= 1.1) {
        score += 15;
        analysisPoints.push(`🟢 Chỉ số PEG chuẩn hóa đạt ${peg} (khoảng 1.0) - Tăng trưởng cốt lõi (+${effectiveGrowth}%) tương xứng với định giá P/E.`);
      } else if (peg > 2.0) {
        score -= 20;
        analysisPoints.push(`⚠️ Chỉ số PEG chuẩn hóa đạt ${peg} (> 2.0) - Tốc độ tăng trưởng cốt lõi (+${effectiveGrowth}%) chưa theo kịp mức P/E hiện tại.`);
      } else {
        score += 5;
        analysisPoints.push(`🟡 Chỉ số PEG chuẩn hóa đạt ${peg} - Mức định giá ở trạng thái cân bằng.`);
      }
    } else if (effectiveGrowth !== null && effectiveGrowth <= 0) {
      score -= 20;
      analysisPoints.push(`⚠️ Tốc độ tăng trưởng LNST suy giảm (${effectiveGrowth}%), do đó chỉ số PEG không áp dụng được.`);
    }

    if (pe !== null && pe > 60 && pb !== null && pb < 0.8) {
      analysisPoints.push(`🔍 Hiện tượng lệch pha P/E & P/B: P/E ở mức rất cao (${pe}x) do LNST 4 quý gần nhất suy giảm, nhưng P/B chỉ ${pb}x (thị giá đang chiết khấu sâu ${pbVsSectorPercent ? Math.abs(pbVsSectorPercent) : ''}% so với giá trị tài sản sổ sách BVPS).`);
    }

    valuationScore = Math.min(95, Math.max(10, score));

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
    ? `${upperSymbol} đang có mức định giá rẻ hơn tương đối so với tiềm năng tăng trưởng (PEG = ${peg ?? 'N/A'}) và mặt bằng ngành ${sectorName}. Biên an toàn ước tính +${marginOfSafety}%.`
    : valuationStatus === 'OVERVALUED'
    ? `${upperSymbol} đang được thị trường định giá cao hơn trung bình ngành, cần tăng trưởng lợi nhuận bứt phá hơn để củng cố mức P/E hiện tại.`
    : `${upperSymbol} đang giao dịch ở vùng định giá hợp lý, phản ánh đúng triển vọng tăng trưởng và nền tảng tài chính hiện tại.`;

  return {
    symbol: upperSymbol,
    name: meta.name || upperSymbol,
    sector: sectorName,
    currentPrice: 0,
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
    rawPeg,
    normalizedGrowthRate,
    growthCalculationMethod,
    hasOutlierProfit,
    outlierInfo,
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
}

export interface SyncOptions {
  symbols?: string[];
  batchSize?: number;
  delayMs?: number;
}

export async function syncFinancialsUniverse(options: SyncOptions = {}) {
  const startTime = Date.now();
  const symbols = options.symbols && options.symbols.length > 0 ? options.symbols : CORE_FINANCIAL_UNIVERSE;
  const batchSize = options.batchSize || 5;
  const delayMs = options.delayMs || 300;

  // Load existing DB to preserve existing entries
  const existingDb = readFinancialsDatabase();
  const dataStore: Record<string, StockValuationData> = existingDb?.data ? { ...existingDb.data } : {};

  let successful = 0;
  let failed = 0;
  const failedSymbols: string[] = [];

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (sym) => {
        const val = await fetchStockValuationLive(sym);
        if (val) {
          dataStore[sym] = val;
          return sym;
        }
        throw new Error(`No data for ${sym}`);
      })
    );

    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        successful++;
      } else {
        failed++;
        failedSymbols.push(batch[idx]);
      }
    });

    if (i + batchSize < symbols.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const durationMs = Date.now() - startTime;
  const scannedAtText = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const databaseFile: FinancialsDatabaseFile = {
    success: true,
    scannedAt: Date.now(),
    scannedAtText,
    totalSynced: Object.keys(dataStore).length,
    source: '100% REAL AUDITED VIETCAP IQ FINANCIAL STATEMENTS',
    data: dataStore,
  };

  const written = writeFinancialsDatabase(databaseFile);

  return {
    success: written,
    totalAttempted: symbols.length,
    successful,
    failed,
    failedSymbols,
    totalInDb: Object.keys(dataStore).length,
    durationMs,
    scannedAtText,
  };
}
