export interface QuarterlyFinancialRecord {
  quarter: number;
  year: number;
  periodLabel: string; // e.g. "Q2/2026"
  revenue: number; // Doanh thu thuần (VND)
  grossProfit: number; // Lợi nhuận gộp (VND)
  netProfit: number; // Lợi nhuận sau thuế cổ đông mẹ (VND)
  grossMargin: number; // Biên LNG (%)
  netMargin: number; // Biên LNST (%)
  eps: number; // EPS (VND)
  totalAssets?: number; // Tổng tài sản (VND)
  ownersEquity?: number; // Vốn chủ sở hữu (VND)
  totalDebt?: number; // Nợ phải trả (VND)
}

export type ValuationStatus = 'UNDERVALUED' | 'FAIR' | 'OVERVALUED' | 'LOSS_MAKING';

export interface StockValuationData {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  reportPeriod: string; // e.g. "Q2/2026"
  
  // Core Valuation Multiples
  pe: number | null;
  pb: number | null;
  ps: number | null;
  evToEbitda: number | null;
  roe: number | null; // %
  roa: number | null; // %
  debtToEquity: number | null;
  currentRatio: number | null;
  
  // PEG & Growth (Option A + Method 1: TTM YoY)
  ttmNetProfitCurrent: number; // VND
  ttmNetProfitPrior: number; // VND
  earningsGrowthYoY: number | null; // % (g)
  peg: number | null; // PE / g
  
  // Industry Benchmark Comparison
  sectorPe: number;
  sectorPb: number;
  peVsSectorPercent: number | null; // % difference from industry PE
  pbVsSectorPercent: number | null; // % difference from industry PB
  
  // Final Evaluation
  valuationStatus: ValuationStatus;
  valuationLabel: string;
  valuationScore: number; // 0 - 100
  marginOfSafety: number; // %
  summaryThesis: string;
  analysisPoints: string[];
  
  // Quarterly Financial Highlights (Option A)
  quarterlyHistory: QuarterlyFinancialRecord[];
}
