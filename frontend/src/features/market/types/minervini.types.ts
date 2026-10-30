export interface MinerviniCriterion {
  id: number;
  label: string;
  description: string;
  passed: boolean;
  value: string;
  comparisonValue?: string;
}

export interface WyckoffCriterion {
  id: number;
  label: string;
  passed: boolean;
  value: string;
}

export interface WyckoffDiagnosis {
  phase: 'Phase A' | 'Phase B' | 'Phase C' | 'Phase D' | 'Phase E';
  phaseName: string;
  passedCount: number;
  totalCount: number;
  actionAdvice: string;
  criteria: WyckoffCriterion[];
}

export interface MinerviniStrategySignal {
  id: string;
  name: string;
  school: string;
  status: 'MUA' | 'BÁN' | 'ĐANG GIỮ';
  sessionsAgo: number;
  winRate: number;
  profitPct: number;
}

export interface MinerviniAnalysisResult {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  sectorRank?: string;
  sectorRS?: number;
  sectorStatus?: 'Dẫn dắt (Leading)' | 'Cải thiện (Improving)' | 'Suy yếu (Lagging)';
  price: number;
  change: number;
  changePct: number;
  volume: number;
  sma50: number;
  sma150: number;
  sma200: number;
  sma200SlopeUp: boolean;
  high52W: number;
  low52W: number;
  distFrom52WHighPct: number;
  distFrom52WLowPct: number;
  rsRating: number;
  stage: 1 | 2 | 3 | 4;
  stageName: string;
  passedCount: number;
  totalCount: number;
  isStage2Eligible: boolean;
  sma20?: number;
  rsi14?: number;
  distFromSMA20Pct?: number;
  criteria: MinerviniCriterion[];
  signals: MinerviniStrategySignal[];
  wyckoff?: WyckoffDiagnosis;
  aiRecommendation?: AIRecommendation;
}

export interface HeatCriterion {
  id: string;
  label: string;
  currentValue: string;
  threshold: string;
  status: 'SAFE' | 'WARNING' | 'DANGER';
  note: string;
}

export interface HeatAnalysis {
  isOverextended: boolean;
  heatLevel: 'COOL' | 'WARM' | 'HOT' | 'OVERHEATED';
  heatScore: number; // 0 - 100
  heatLabel: string;
  distFromSMA20Pct: number;
  distFromSMA50Pct: number;
  rsi14: number;
  macdStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  macdHist: number;
  climaxWarning: boolean;
  criteria: HeatCriterion[];
}

export interface CapitalTranche {
  step: number;
  name: string;
  pct: number;
  targetPrice: string;
  priceRange?: string;
  condition: string;
  status: 'ACTIVE' | 'PENDING' | 'LOCKED' | 'BLOCKED';
  statusLabel?: string;
}

export interface CapitalAllocationPlan {
  totalBudgetPct: number;
  tranches: CapitalTranche[];
  maxLossBudgetPct: number;
  stopLossPrice: number;
  stopLossPct: number;
  targetPrice1: number;
  targetPrice2: number;
  riskRewardRatio: number;
  atr14?: number;
  atrPct?: number;
  pivotResistance?: number;
  swingLowSupport?: number;
  goldenRules: string[];
}

export interface AIRecommendation {
  action:
    | 'MUA THĂM DÒ (LẦN 1)'
    | 'MUA GIA TĂNG (LẦN 2)'
    | 'CHỜ KÉO NGƯỢC (PULLBACK)'
    | 'CẤM MUA ĐUỔI (QUÁ NÓNG)'
    | 'THEO DÕI NỀN GIÁ'
    | 'HẠ TỶ TRỌNG / QUẢN TRỊ RỦI RO'
    | 'VI PHẠM TREND TEMPLATE (CẤM MUA)';
  actionType: 'BUY_PILOT' | 'BUY_ADD' | 'WAIT_PULLBACK' | 'NO_BUY_EXTENDED' | 'WATCH' | 'SELL_TRIM' | 'NO_BUY_TREND_FAIL';
  actionColor: 'emerald' | 'amber' | 'rose' | 'cyan';
  headline: string;
  summary: string;
  shouldBuyNow: boolean;
  buySuitabilityScore: number; // 0 - 100
  trendGatePassed: boolean;
  trendGateMessage: string;
  failedCriteria?: string[];
  decisionVerdict?: 'BUY_NOW' | 'WAIT' | 'DO_NOT_BUY';
  decisionVerdictText?: string;
  heat: HeatAnalysis;
  allocation: CapitalAllocationPlan;
}

export interface MinerviniScreenerItem {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  changePct: number;
  volume: number;
  relVol: number;
  mktCapT: number;
  pe: number | null;
  epsDilTTM: number | null;
  epsGrowthYoY: number | null;
  divYieldPct: number | null;
  analystRating?: 'Strong buy' | 'Buy' | 'Hold' | 'Sell' | 'No rating';
  rsRating: number;
  score: number; // 0 to 8
  isStage2: boolean;
  isStage2Eligible?: boolean;
  criteriaPassed?: number;
  sma50?: number;
  sma150?: number;
  sma200?: number;
  distHigh?: number;
  distLow?: number;
  pctFrom52WHigh?: number;
  pctAbove52WLow?: number;
  perf1W?: number;
  perf1M?: number;
  perf1Y?: number;
  epsDiluted?: number | null;
  epsDilutedGrowthYoY?: number | null;
  dividendYield?: number | null;
}
