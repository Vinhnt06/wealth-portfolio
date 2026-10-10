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
  criteria: MinerviniCriterion[];
  signals: MinerviniStrategySignal[];
  wyckoff?: WyckoffDiagnosis;
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
  pe: number;
  epsDilTTM: number;
  epsGrowthYoY: number;
  divYieldPct: number;
  analystRating: 'Strong buy' | 'Buy' | 'Hold' | 'Sell' | 'No rating';
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
  epsDiluted?: number;
  epsDilutedGrowthYoY?: number;
  dividendYield?: number;
}
