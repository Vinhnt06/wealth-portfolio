'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Target,
  ShieldCheck,
  TrendUp,
  TrendDown,
  Scales,
  ChartLineUp,
  WarningCircle,
  Info,
  Check,
  Calculator,
  ArrowsClockwise,
  MagnifyingGlass,
  CheckCircle,
  Lightning,
  SlidersHorizontal,
  Cpu,
  CaretDown,
  CaretUp,
  Sparkle,
  Lock,
  ArrowUpRight,
  ArrowsSplit,
  Stack,
} from '@phosphor-icons/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useMarketStore } from '../store/marketStore';

interface MinerviniExpectancyCalculatorProps {
  initialSymbol?: string;
  initialPrice?: number;
}

interface WinRateFactor {
  name: string;
  category: 'market' | 'trend' | 'rs' | 'volume';
  score: number;
  weight: number;
  deltaPct: number;
  details: string;
}

interface AutoWinRateData {
  success: boolean;
  symbol: string;
  autoWinRate: number;
  baseWinRate: number;
  totalDelta: number;
  confidence: 'CAO' | 'TRUNG BÌNH' | 'THẤP';
  confidenceReason?: string;
  recommendedRiskNav?: string;
  advice: string;
  summary: {
    marketStatus: string;
    stockStage: string;
    wyckoffPhase?: string;
    wyckoffBuyPoint?: string;
    passedCriteria: string;
    wyckoffPassedCriteria?: string;
    rsRating: number;
  };
  optimalSetup?: {
    stopLossPct: number;
    stopLossPrice: number;
    stopLossReason: string;
    targetGainPct: number;
    targetPrice: number;
    targetReason: string;
    rrRatio: number;
    setupQuality?: 'OK' | 'STOP_TOO_WIDE' | 'STRUCTURE_BROKEN';
    setupWarning?: string | null;
    high52W?: number;
    distToHigh52WPct?: number | null;
  };
  factors: WinRateFactor[];
}

const POPULAR_SYMBOLS = ['HPG', 'SSI', 'VND', 'TCB', 'MWG', 'FPT', 'VHM', 'MBB', 'DGC', 'VCI'];

const formatVND = (num: number): string => {
  if (isNaN(num)) return '0';
  return Math.round(num).toLocaleString('vi-VN');
};

export const MinerviniExpectancyCalculator: React.FC<MinerviniExpectancyCalculatorProps> = ({
  initialSymbol,
  initialPrice,
}) => {
  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
  const setSelectedSymbol = useMarketStore((state) => state.setSelectedSymbol);
  const ticks = useMarketStore((state) => state.ticks);

  // Active Symbol & Live Price
  const [activeSymbol, setActiveSymbol] = useState<string>(
    initialSymbol || selectedSymbol || 'HPG'
  );
  const [symbolInput, setSymbolInput] = useState<string>('');

  const liveTick = ticks[activeSymbol.toUpperCase()];
  const livePrice = liveTick?.price || (activeSymbol === selectedSymbol ? initialPrice : 0) || 0;

  // Form Inputs (entry stays 0 until a real price arrives — no mock fallback)
  const [entryPrice, setEntryPrice] = useState<number>(() => (livePrice > 0 ? livePrice : 0));
  const [targetGainPct, setTargetGainPctRaw] = useState<number>(15); // +15% until recommendation arrives
  const [stopLossPct, setStopLossPctRaw] = useState<number>(6); // -6% until recommendation arrives
  const [winRatePct, setWinRatePct] = useState<number>(45); // 45% default
  const [totalCapital, setTotalCapital] = useState<number>(100000000); // 100M VND
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(1.5); // 1.5% NAV risk

  // Track manual edits so auto-recommendations never overwrite what the user typed
  const stopTouchedRef = useRef(false);
  const targetTouchedRef = useRef(false);
  const setStopLossPct = (v: number) => {
    stopTouchedRef.current = true;
    setStopLossPctRaw(v);
  };
  const setTargetGainPct = (v: number) => {
    targetTouchedRef.current = true;
    setTargetGainPctRaw(v);
  };

  // Auto Win Rate Engine States
  const [isAutoWinRate, setIsAutoWinRate] = useState<boolean>(true);
  const isAutoWinRateRef = useRef(true);
  useEffect(() => {
    isAutoWinRateRef.current = isAutoWinRate;
  }, [isAutoWinRate]);
  const [autoWinRateLoading, setAutoWinRateLoading] = useState<boolean>(false);
  const [autoWinRateData, setAutoWinRateData] = useState<AutoWinRateData | null>(null);
  const [showFactorBreakdown, setShowFactorBreakdown] = useState<boolean>(true);

  // Position Plan Mode: 'pyramid' (Scale-in & Staged defense) or 'classic' (Single exit)
  const [positionPlanMode, setPositionPlanMode] = useState<'pyramid' | 'classic'>('pyramid');

  // Monte Carlo Simulation States
  const [simulationTradeCount, setSimulationTradeCount] = useState<number>(30); // 20, 30, 50
  const [simulationSeed, setSimulationSeed] = useState<number>(1);

  // Update entry price whenever active stock changes and has live price
  useEffect(() => {
    if (livePrice > 0) {
      setEntryPrice(livePrice);
    }
  }, [activeSymbol, livePrice]);

  // Fallback: fetch a real quote when no live tick/price is available for the active symbol
  useEffect(() => {
    if (livePrice > 0) return;
    let isCancelled = false;
    fetch(`/api/market/quote?symbol=${encodeURIComponent(activeSymbol)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!isCancelled && json.success && json.data?.price > 0) {
          setEntryPrice(json.data.price);
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [activeSymbol, livePrice]);

  // Fetch quantitative Win Rate dynamically based on Market + Stock Trend + RS + Volume
  useEffect(() => {
    let isCancelled = false;
    // New symbol → allow auto recommendations again
    stopTouchedRef.current = false;
    targetTouchedRef.current = false;
    setAutoWinRateData(null);
    setAutoWinRateLoading(true);

    fetch(`/api/market/minervini/win-rate?symbol=${encodeURIComponent(activeSymbol)}`)
      .then((res) => res.json())
      .then((json: AutoWinRateData) => {
        if (!isCancelled && json.success) {
          setAutoWinRateData(json);
          // Only overwrite win rate while in AUTO mode
          if (isAutoWinRateRef.current) setWinRatePct(json.autoWinRate);
          // Auto-fill stop / target unless the user already edited them
          if (json.optimalSetup) {
            if (!stopTouchedRef.current) setStopLossPctRaw(json.optimalSetup.stopLossPct);
            if (!targetTouchedRef.current) setTargetGainPctRaw(json.optimalSetup.targetGainPct);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch auto win rate:', err);
      })
      .finally(() => {
        if (!isCancelled) {
          setAutoWinRateLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeSymbol]);

  const handleToggleAutoWinRate = (enableAuto: boolean) => {
    setIsAutoWinRate(enableAuto);
    if (enableAuto && autoWinRateData) {
      setWinRatePct(autoWinRateData.autoWinRate);
    }
  };

  const handleManualWinRateChange = (val: number) => {
    setIsAutoWinRate(false);
    setWinRatePct(Math.min(95, Math.max(5, val)));
  };

  const applyOptimalSetup = () => {
    if (autoWinRateData?.optimalSetup) {
      stopTouchedRef.current = false;
      targetTouchedRef.current = false;
      setStopLossPctRaw(autoWinRateData.optimalSetup.stopLossPct);
      setTargetGainPctRaw(autoWinRateData.optimalSetup.targetGainPct);
      setWinRatePct(autoWinRateData.autoWinRate);
      setIsAutoWinRate(true);
    }
  };

  const handleSelectSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setActiveSymbol(s);
    setSelectedSymbol(s);
    setSymbolInput('');
    // Fetch live quote if not in ticks
    fetch(`/api/market/quote?symbol=${s}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.price) {
          setEntryPrice(json.data.price);
        }
      })
      .catch(() => {});
  };

  // ── MATHEMATICAL ENGINE (MARK MINERVINI FORMULAS) ──
  const math = useMemo(() => {
    const W = winRatePct / 100; // Tỷ lệ thắng
    const L = 1 - W; // Tỷ lệ thua
    const A = targetGainPct / 100; // Lãi trung bình
    const B = stopLossPct / 100; // Lỗ trung bình

    // 1. Tỷ lệ R:R (Reward-to-Risk)
    const rrRatio = B > 0 ? Number((targetGainPct / stopLossPct).toFixed(2)) : 0;

    // 2. Hàm kỳ vọng toán học trên mỗi lệnh (%)
    // Formula: E = (W * A) - (L * B)
    const expectancyPct = Number(((W * A - L * B) * 100).toFixed(2));

    // 3. Tỷ lệ thắng tối thiểu để hòa vốn (Breakeven Win Rate)
    // Formula: W_be = 1 / (1 + RR) = B / (A + B)
    const breakevenWinRatePct = Number(((B / (A + B)) * 100).toFixed(1));

    // 4. Mức cắt lỗ tối đa cho phép để hòa vốn với Win Rate này
    // Formula: B_max = (W / (1 - W)) * A
    const maxBreakevenStopLossPct = W < 1 ? Number((((W / L) * A) * 100).toFixed(1)) : 100;

    // 5. Mức cắt lỗ chuẩn Minervini: Lỗ = 1/2 Lãi (2:1) hoặc 1/3 Lãi (3:1)
    const minerviniOptimalStopPct2to1 = Number((targetGainPct / 2).toFixed(1));
    const minerviniOptimalStopPct3to1 = Number((targetGainPct / 3).toFixed(1));

    // 6. Tính giá cụ thể (VND)
    const targetPrice = Math.round(entryPrice * (1 + A));
    const stopLossPrice = Math.round(entryPrice * (1 - B));
    const optimalStopPrice2to1 = Math.round(entryPrice * (1 - minerviniOptimalStopPct2to1 / 100));
    const breakevenStopPrice = Math.round(entryPrice * (1 - maxBreakevenStopLossPct / 100));

    // 7. Quản trị quy mô vị thế (Position Sizing theo rủi ro % NAV)
    const maxRiskCapital = totalCapital * (riskPerTradePct / 100);
    const riskPerShare = entryPrice - stopLossPrice;
    const maxShares = riskPerShare > 0 ? Math.floor(maxRiskCapital / riskPerShare / 100) * 100 : 0;
    const positionValue = maxShares * entryPrice;
    const allocationPct = totalCapital > 0 ? Number(((positionValue / totalCapital) * 100).toFixed(1)) : 0;

    // Lợi nhuận kỳ vọng khi chạm Target (VND)
    const profitAtTarget = maxShares * (targetPrice - entryPrice);
    // Thua lỗ thực tế khi chạm Stop Loss (VND)
    const lossAtStop = maxShares * (entryPrice - stopLossPrice);

    // 8. Chiến Lược Giải Ngân Kim Tự Tháp (Pyramiding Scale-In: 40% - 35% - 25% theo Mark Minervini)
    // Đợt 1: Pilot Tranche (40%) - Mua thăm dò tại Entry
    const t1Shares = Math.floor((maxShares * 0.4) / 100) * 100;
    const t1EntryPrice = entryPrice;
    const t1Value = t1Shares * t1EntryPrice;
    const t1StopLossPrice = stopLossPrice;
    const t1RiskAmt = t1Shares * (t1EntryPrice - t1StopLossPrice);
    const t1RiskNavPct = totalCapital > 0 ? Number(((t1RiskAmt / totalCapital) * 100).toFixed(2)) : 0;

    // Đợt 2: Scale-Up Tranche 1 (35%) - Chỉ mua gia tăng khi Đợt 1 đã có đệm lãi +2.5%
    const t2TriggerPct = 2.5;
    const t2EntryPrice = Math.round(entryPrice * (1 + t2TriggerPct / 100));
    const t2Shares = Math.floor((maxShares * 0.35) / 100) * 100;
    const t2Value = t2Shares * t2EntryPrice;
    // Hành động bảo vệ vốn sống còn: Nâng Stop Loss của Đợt 1 lên Giá Vốn Hòa Vốn (Breakeven - Risk-Free)
    const t2StopLossPrice = entryPrice;

    // Đợt 3: Pyramid Complete (25%) - Hoàn tất vị thế khi giá bứt phá +5.0%
    const t3TriggerPct = 5.0;
    const t3EntryPrice = Math.round(entryPrice * (1 + t3TriggerPct / 100));
    const t3Shares = Math.max(0, maxShares - t1Shares - t2Shares);
    const t3Value = t3Shares * t3EntryPrice;
    // Hành động khóa lãi: Nâng Stop Loss toàn bộ lên +1.5% so với giá vốn gốc
    const t3StopLossPrice = Math.round(entryPrice * 1.015);

    const totalAllocatedShares = t1Shares + t2Shares + t3Shares;
    const totalInvestedValue = t1Value + t2Value + t3Value;
    const avgEntryPrice = totalAllocatedShares > 0 ? Math.round(totalInvestedValue / totalAllocatedShares) : entryPrice;
    const avgPricePremiumPct = entryPrice > 0 ? Number((((avgEntryPrice - entryPrice) / entryPrice) * 100).toFixed(2)) : 0;

    // 9. Kế Hoạch Cắt Lỗ Bậc Thang (Staged Stop-Loss / Phòng thủ 2 nấc)
    const halfStopLossPct = Number((stopLossPct / 2).toFixed(1));
    const stopPriceStage1 = Math.round(entryPrice * (1 - halfStopLossPct / 100));
    const stage1CutShares = Math.floor((maxShares * 0.5) / 100) * 100;
    const stage1Loss = stage1CutShares * (entryPrice - stopPriceStage1);

    const stage2CutShares = Math.max(0, maxShares - stage1CutShares);
    const stage2Loss = stage2CutShares * (entryPrice - stopLossPrice);

    const totalStagedLoss = stage1Loss + stage2Loss;
    const singleExitLoss = maxShares * (entryPrice - stopLossPrice);
    const lossSavedAmt = Math.max(0, singleExitLoss - totalStagedLoss);
    const lossSavedPct = singleExitLoss > 0 ? Number(((lossSavedAmt / singleExitLoss) * 100).toFixed(1)) : 25;

    // 10. Kế Hoạch Chốt Lời Bậc Thang (Staged Profit-Taking / Tấn công 3 nấc)
    const tp1Pct = Math.round(targetGainPct * 0.6 * 10) / 10; // ~60% target
    const tp1Price = Math.round(entryPrice * (1 + tp1Pct / 100));
    const tp1Shares = Math.floor((maxShares * 0.35) / 100) * 100;
    const tp1Profit = tp1Shares * (tp1Price - entryPrice);

    const tp2Price = targetPrice;
    const tp2Shares = Math.floor((maxShares * 0.40) / 100) * 100;
    const tp2Profit = tp2Shares * (tp2Price - entryPrice);

    const runnerShares = Math.max(0, maxShares - tp1Shares - tp2Shares);

    // 11. Đánh giá chất lượng thiết lập
    const isHardStopExceeded = stopLossPct > 8; // Cấm lỗ > 8%
    const isExpectancyPositive = expectancyPct > 0;
    const isRiskRewardOptimal = rrRatio >= 2.0;

    let verdict = 'ĐẠT CHUẨN MINERVINI';
    let verdictColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    let verdictNote = 'Kỳ vọng toán học dương mạnh mẽ, tỷ lệ R:R tối ưu theo nguyên tắc vàng của Mark Minervini.';

    if (isHardStopExceeded) {
      verdict = 'VI PHẠM NGUYÊN TẮC CẮT LỖ';
      verdictColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      verdictNote = 'Mark Minervini: Tuyệt đối không bao giờ để cắt lỗ vượt quá 7-8% trong bất kỳ hoàn cảnh nào!';
    } else if (!isExpectancyPositive) {
      verdict = 'KỲ VỌNG TOÁN HỌC ÂM';
      verdictColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      verdictNote = `Với Win Rate ${winRatePct}%, mức cắt lỗ ${stopLossPct}% đang vượt ngưỡng hòa vốn (${maxBreakevenStopLossPct}%). Vốn của bạn sẽ bị bào mòn dần!`;
    } else if (!isRiskRewardOptimal) {
      verdict = 'TỶ LỆ R:R THẤP (< 2.0)';
      verdictColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      verdictNote = `Tỷ lệ R:R hiện tại là ${rrRatio}:1. Bạn nên nâng mục tiêu hoặc thu hẹp cắt lỗ để đạt tối thiểu 2:1 tạo biên an toàn.`;
    }

    return {
      rrRatio,
      expectancyPct,
      breakevenWinRatePct,
      maxBreakevenStopLossPct,
      minerviniOptimalStopPct2to1,
      minerviniOptimalStopPct3to1,
      targetPrice,
      stopLossPrice,
      optimalStopPrice2to1,
      breakevenStopPrice,
      maxRiskCapital,
      riskPerShare,
      maxShares,
      positionValue,
      allocationPct,
      profitAtTarget,
      lossAtStop,
      isHardStopExceeded,
      isExpectancyPositive,
      isRiskRewardOptimal,
      verdict,
      verdictColor,
      verdictNote,
      // Pyramiding Scale-In Specs
      pyramid: {
        t1Shares,
        t1EntryPrice,
        t1Value,
        t1StopLossPrice,
        t1RiskAmt,
        t1RiskNavPct,
        t2TriggerPct,
        t2EntryPrice,
        t2Shares,
        t2Value,
        t2StopLossPrice,
        t3TriggerPct,
        t3EntryPrice,
        t3Shares,
        t3Value,
        t3StopLossPrice,
        totalShares: totalAllocatedShares,
        totalValue: totalInvestedValue,
        avgEntryPrice,
        avgPricePremiumPct,
      },
      // Staged Defense (Stop-Loss) & Offense (Take-Profit) Specs
      stagedExit: {
        halfStopPct: halfStopLossPct,
        stage1Price: stopPriceStage1,
        stage1Shares: stage1CutShares,
        stage1Loss,
        stage2Shares: stage2CutShares,
        stage2Loss,
        totalStagedLoss,
        singleExitLoss,
        lossSavedAmt,
        lossSavedPct,
        tp1Pct,
        tp1Price,
        tp1Shares,
        tp1Profit,
        tp2Price,
        tp2Shares,
        tp2Profit,
        runnerShares,
      },
    };
  }, [entryPrice, targetGainPct, stopLossPct, winRatePct, totalCapital, riskPerTradePct]);

  // ── SIMULATION: ACCURATE MONTE CARLO TRADING SEQUENCE ──
  const simulation = useMemo(() => {
    const initial = totalCapital;
    let capDisciplined = initial;
    let capUndisciplined = initial;
    let peakDisciplined = initial;
    let maxDrawdownDisciplined = 0;

    const dataPoints: Array<{
      trade: number;
      disciplined: number;
      undisciplined: number;
      expected: number;
      isWin: boolean;
      pnlDisciplined: number;
      pnlUndisciplined: number;
      drawdownPct: number;
    }> = [
      {
        trade: 0,
        disciplined: initial,
        undisciplined: initial,
        expected: initial,
        isWin: false,
        pnlDisciplined: 0,
        pnlUndisciplined: 0,
        drawdownPct: 0,
      },
    ];

    const totalTrades = simulationTradeCount;
    const W = winRatePct / 100;
    // Expected NAV return per trade based on risk per trade & R:R
    const expectedTradeGainPct = (W * (riskPerTradePct * math.rrRatio) - (1 - W) * riskPerTradePct) / 100;

    let winsCount = 0;
    let lossesCount = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    // Pseudo-random generator with repeatable seed for stability
    let seed = simulationSeed * 16807 + 7;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 1; i <= totalTrades; i++) {
      const rand = pseudoRandom();
      const isWin = rand < W;

      if (isWin) {
        winsCount++;
        currentLossStreak = 0;
      } else {
        lossesCount++;
        currentLossStreak++;
        if (currentLossStreak > maxLossStreak) {
          maxLossStreak = currentLossStreak;
        }
      }

      // 1. Kỷ Luật Minervini:
      // Rủi ro chính xác = capDisciplined * (riskPerTradePct / 100)
      const riskAmt = capDisciplined * (riskPerTradePct / 100);
      let pnlDisciplined = 0;
      if (isWin) {
        pnlDisciplined = riskAmt * math.rrRatio;
        capDisciplined += pnlDisciplined;
      } else {
        pnlDisciplined = -riskAmt;
        capDisciplined -= riskAmt;
      }

      // Theo dõi Đỉnh (Peak) & Mức Sụt Giảm (Drawdown)
      if (capDisciplined > peakDisciplined) {
        peakDisciplined = capDisciplined;
      }
      const curDrawdown = ((peakDisciplined - capDisciplined) / peakDisciplined) * 100;
      if (curDrawdown > maxDrawdownDisciplined) {
        maxDrawdownDisciplined = curDrawdown;
      }

      // 2. Không Kỷ Luật:
      // Trader cảm xúc thường gồng lỗ không cắt, lỗ trung bình -14% mỗi lệnh thua
      let pnlUndisciplined = 0;
      if (isWin) {
        pnlUndisciplined = capUndisciplined * 0.08; // Chốt lời non 8%
        capUndisciplined += pnlUndisciplined;
      } else {
        pnlUndisciplined = -capUndisciplined * 0.14; // Gồng lỗ trung bình 14%
        capUndisciplined -= capUndisciplined * 0.14;
      }
      capUndisciplined = Math.max(0, capUndisciplined);

      // 3. Đường Kỳ Vọng Lý Thuyết
      const expectedCap = Math.round(initial * Math.pow(1 + expectedTradeGainPct, i));

      dataPoints.push({
        trade: i,
        disciplined: Math.round(capDisciplined),
        undisciplined: Math.round(capUndisciplined),
        expected: expectedCap,
        isWin,
        pnlDisciplined: Math.round(pnlDisciplined),
        pnlUndisciplined: Math.round(pnlUndisciplined),
        drawdownPct: Number(curDrawdown.toFixed(1)),
      });
    }

    const netDisciplinedPct = Number((((capDisciplined - initial) / initial) * 100).toFixed(1));
    const netUndisciplinedPct = Number((((capUndisciplined - initial) / initial) * 100).toFixed(1));

    return {
      dataPoints,
      finalDisciplined: Math.round(capDisciplined),
      finalUndisciplined: Math.round(capUndisciplined),
      netDisciplinedPct,
      netUndisciplinedPct,
      winsCount,
      lossesCount,
      actualWinRate: Number(((winsCount / totalTrades) * 100).toFixed(1)),
      maxLossStreak,
      maxDrawdownDisciplined: Number(maxDrawdownDisciplined.toFixed(1)),
    };
  }, [totalCapital, winRatePct, riskPerTradePct, math.rrRatio, simulationTradeCount, simulationSeed]);

  // ── 2D EXPECTANCY HEATMAP MATRIX DATA ──
  const heatmapData = useMemo(() => {
    const winRates = [35, 40, 45, 50, 55, 60];
    const rrRatios = [1.5, 2.0, 2.5, 3.0, 4.0];

    return winRates.map((wr) => {
      const rowCells = rrRatios.map((rr) => {
        // E = (W * RR * B) - ((1-W) * B)
        // With stopLossPct B
        const W = wr / 100;
        const L = 1 - W;
        const A = stopLossPct * rr;
        const B = stopLossPct;
        const eVal = Number((W * A - L * B).toFixed(2));
        const isCurrentCell =
          Math.abs(winRatePct - wr) <= 2 && Math.abs(math.rrRatio - rr) < 0.35;

        return {
          rr,
          eVal,
          isPositive: eVal > 0,
          isHighEdge: eVal >= 3.0,
          isCurrentCell,
        };
      });

      return {
        winRate: wr,
        cells: rowCells,
      };
    });
  }, [stopLossPct, winRatePct, math.rrRatio]);

  return (
    <div className="w-full max-w-full space-y-6">
      {/* ── HEADER: TITLE + SYMBOL SELECTOR ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-zinc-100 tracking-tight">
            Kỳ Vọng &amp; Cắt Lỗ Tối Ưu
            <span className="ml-2 font-mono text-emerald-400">{activeSymbol}</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Mô hình Mark Minervini: lãi trung bình phải gấp 2–3 lần lỗ trung bình.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
            {POPULAR_SYMBOLS.slice(0, 6).map((sym) => (
              <button
                key={sym}
                onClick={() => handleSelectSymbol(sym)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors ${
                  activeSymbol === sym
                    ? 'bg-zinc-800 text-emerald-400'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSelectSymbol(symbolInput);
            }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              placeholder="Mã khác…"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              className="w-24 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              title="Đổi mã cổ phiếu"
            >
              <MagnifyingGlass className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* ── VERDICT: ONE ANSWER FIRST ── */}
      {(() => {
        const setup = autoWinRateData?.optimalSetup;
        const structureBroken = setup?.setupQuality === 'STRUCTURE_BROKEN';
        const hasPrice = entryPrice > 0;
        const tone = structureBroken || math.verdictColor.includes('rose')
          ? 'rose'
          : math.verdictColor.includes('amber')
            ? 'amber'
            : 'emerald';
        const toneText = { rose: 'text-rose-400', amber: 'text-amber-400', emerald: 'text-emerald-400' }[tone];
        const toneBar = { rose: 'bg-rose-500', amber: 'bg-amber-400', emerald: 'bg-emerald-400' }[tone];
        const verdictLabel = structureBroken ? 'KHÔNG NÊN MUA — CẤU TRÚC ĐÃ GÃY' : math.verdict;
        const verdictNote = structureBroken ? setup?.setupWarning : math.verdictNote;

        return (
          <section className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
            <div className="flex">
              <div className={`w-1 shrink-0 ${toneBar}`} />
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-6">
                {/* Answer */}
                <div className="lg:col-span-5">
                  <span className={`text-xs font-mono font-semibold tracking-wide ${toneText}`}>{verdictLabel}</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className={`text-5xl sm:text-6xl font-mono font-bold tabular-nums ${toneText}`}>
                      {math.expectancyPct > 0 ? '+' : ''}
                      {math.expectancyPct}%
                    </span>
                    <span className="text-sm text-zinc-500">kỳ vọng / lệnh</span>
                  </div>
                  <p className="text-sm text-zinc-400 mt-3 leading-relaxed max-w-md">{verdictNote}</p>
                </div>

                {/* Trade plan */}
                <div className="lg:col-span-7">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-zinc-500">Kế hoạch giao dịch đề xuất</span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      Tỷ lệ thắng {winRatePct}% · {isAutoWinRate ? 'ước lượng theo quy tắc' : 'nhập tay'}
                    </span>
                  </div>
                  {hasPrice ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-zinc-800 border border-zinc-800 rounded-lg">
                      <div className="p-3">
                        <div className="text-[11px] text-zinc-500">Giá vào</div>
                        <div className="text-lg font-mono font-semibold text-zinc-100 tabular-nums mt-1">
                          {formatVND(entryPrice)}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="text-[11px] text-zinc-500">Cắt lỗ −{stopLossPct}%</div>
                        <div className="text-lg font-mono font-semibold text-rose-400 tabular-nums mt-1">
                          {formatVND(math.stopLossPrice)}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="text-[11px] text-zinc-500">Mục tiêu +{targetGainPct}%</div>
                        <div className="text-lg font-mono font-semibold text-emerald-400 tabular-nums mt-1">
                          {formatVND(math.targetPrice)}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="text-[11px] text-zinc-500">Khối lượng tối đa</div>
                        <div className="text-lg font-mono font-semibold text-zinc-100 tabular-nums mt-1">
                          {formatVND(math.maxShares)}
                          <span className="text-xs text-zinc-500 ml-1">cp</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-zinc-700 rounded-lg p-4 text-sm text-zinc-400">
                      Chưa có giá thị trường của {activeSymbol} — nhập giá vào lệnh ở bảng bên dưới để tính toán.
                    </div>
                  )}

                  {setup && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 font-mono">
                      <span>Đề xuất: cắt lỗ −{setup.stopLossPct}% · mục tiêu +{setup.targetGainPct}% · R:R {setup.rrRatio}:1</span>
                      {typeof setup.distToHigh52WPct === 'number' && (
                        <span>Cách đỉnh 52 tuần: {setup.distToHigh52WPct}% (tham khảo)</span>
                      )}
                      <button
                        onClick={applyOptimalSetup}
                        className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                      >
                        Áp dụng đề xuất
                      </button>
                    </div>
                  )}

                  {setup?.setupWarning && !structureBroken && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
                      <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{setup.setupWarning}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── SUPPORTING METRICS: ONE CONTAINER, 1px DIVIDERS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 rounded-xl bg-zinc-950 border border-zinc-800">
        <div className="p-5">
          <div className="text-xs text-zinc-500">Tỷ lệ Lãi/Lỗ (R:R)</div>
          <div
            className={`text-3xl font-mono font-bold tabular-nums mt-1 ${
              math.rrRatio >= 2.0 ? 'text-emerald-400' : math.rrRatio >= 1.5 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {math.rrRatio}:1
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            +{targetGainPct}% so với −{stopLossPct}% · chuẩn ≥ 2:1
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs text-zinc-500">Tỷ lệ thắng hòa vốn</div>
          <div
            className={`text-3xl font-mono font-bold tabular-nums mt-1 ${
              winRatePct >= math.breakevenWinRatePct ? 'text-zinc-100' : 'text-rose-400'
            }`}
          >
            {math.breakevenWinRatePct}%
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Hiện tại {winRatePct}% — {winRatePct >= math.breakevenWinRatePct ? 'trên' : 'dưới'} ngưỡng hòa vốn
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs text-zinc-500">Cắt lỗ tối đa để còn hòa vốn</div>
          <div
            className={`text-3xl font-mono font-bold tabular-nums mt-1 ${
              stopLossPct <= math.maxBreakevenStopLossPct ? 'text-zinc-100' : 'text-rose-400'
            }`}
          >
            {math.maxBreakevenStopLossPct}%
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Cắt lỗ đang đặt −{stopLossPct}% — {stopLossPct <= math.maxBreakevenStopLossPct ? 'an toàn' : 'vượt giới hạn'}
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE WORKSPACE: INPUTS (LEFT) & REALTIME RISK/REWARD VISUAL LADDER (RIGHT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Interactive Parameters (5 cols) */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-200 font-bold flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>Thiết Lập Thông Số Giao Dịch</span>
              </h3>
              <span className="text-xs font-mono text-emerald-400 font-bold">{activeSymbol}</span>
            </div>

            <div className="space-y-4">
              {/* Recommendation lives in the verdict block above; stop/target auto-fill from it unless edited */}
              {autoWinRateData?.optimalSetup && !stopTouchedRef.current && !targetTouchedRef.current && (
                <p className="text-[11px] text-zinc-500">
                  Cắt lỗ &amp; mục tiêu đang tự điền theo đề xuất ({autoWinRateData.summary.wyckoffPhase || 'Wyckoff'}). Sửa tay để ghi đè.
                </p>
              )}

              {/* 1. Điểm mua dự kiến (Entry Price) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Giá Mua Dự Kiến (Entry):</span>
                  <span className="font-bold text-zinc-100">{entryPrice > 0 ? `${formatVND(entryPrice)} VNĐ` : 'Chưa có giá'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="50"
                    value={entryPrice > 0 ? entryPrice : ''}
                    placeholder="Nhập giá vào lệnh"
                    onChange={(e) => setEntryPrice(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/50"
                  />
                  {livePrice > 0 && (
                    <button
                      onClick={() => setEntryPrice(livePrice)}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 transition-colors shrink-0"
                      title="Đặt lại về giá khớp thị trường hiện tại"
                    >
                      Giá Live ({formatVND(livePrice)})
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Mục tiêu lợi nhuận (Target Gain %) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Mục Tiêu Chốt Lời (Target Gain):</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={targetGainPct}
                      onChange={(e) => setTargetGainPct(Math.max(1, Number(e.target.value)))}
                      className="w-16 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-xs font-mono text-emerald-400 font-bold text-right focus:outline-none"
                    />
                    <span className="font-bold text-emerald-400">
                      % ({formatVND(math.targetPrice)} đ)
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={Math.min(100, targetGainPct)}
                  onChange={(e) => setTargetGainPct(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {[10, 15, 20, 25, 30, 50, 100].map((val) => (
                    <button
                      key={val}
                      onClick={() => setTargetGainPct(val)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                        targetGainPct === val
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                    >
                      +{val}%
                    </button>
                  ))}
                </div>
                {autoWinRateData?.optimalSetup && targetGainPct !== autoWinRateData.optimalSetup.targetGainPct && (
                  <button
                    type="button"
                    onClick={() => setTargetGainPct(autoWinRateData.optimalSetup!.targetGainPct)}
                    className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1 pt-0.5"
                  >
                    <Sparkle className="w-2.5 h-2.5" />
                    <span>Gợi ý chuẩn: +{autoWinRateData.optimalSetup.targetGainPct}% ({autoWinRateData.optimalSetup.targetReason})</span>
                  </button>
                )}
              </div>

              {/* 3. Mức cắt lỗ dự kiến (Stop-Loss %) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Mức Cắt Lỗ Dự Kiến (Stop-Loss):</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      step="0.5"
                      value={stopLossPct}
                      onChange={(e) => setStopLossPct(Math.max(0.5, Number(e.target.value)))}
                      className={`w-16 px-1.5 py-0.5 rounded bg-zinc-900 border text-xs font-mono font-bold text-right focus:outline-none ${
                        math.isHardStopExceeded ? 'text-rose-400 border-rose-500/50' : 'text-zinc-100 border-zinc-700'
                      }`}
                    />
                    <span
                      className={`font-bold ${
                        math.isHardStopExceeded ? 'text-rose-400' : 'text-zinc-200'
                      }`}
                    >
                      % ({formatVND(math.stopLossPrice)} đ)
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="0.5"
                  value={Math.min(20, stopLossPct)}
                  onChange={(e) => setStopLossPct(Number(e.target.value))}
                  className="w-full accent-rose-400 cursor-pointer"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {[3, 4, 5, 6, 7, 8, 10, 15].map((val) => (
                    <button
                      key={val}
                      onClick={() => setStopLossPct(val)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                        stopLossPct === val
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                    >
                      -{val}%
                    </button>
                  ))}
                </div>
                {autoWinRateData?.optimalSetup && stopLossPct !== autoWinRateData.optimalSetup.stopLossPct && (
                  <button
                    type="button"
                    onClick={() => setStopLossPct(autoWinRateData.optimalSetup!.stopLossPct)}
                    className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1 pt-0.5"
                  >
                    <Sparkle className="w-2.5 h-2.5" />
                    <span>Gợi ý Wyckoff Stop: -{autoWinRateData.optimalSetup.stopLossPct}% ({autoWinRateData.optimalSetup.stopLossReason})</span>
                  </button>
                )}
                {math.isHardStopExceeded && (
                  <p className="text-[11px] font-mono text-rose-400 pt-1">
                    Cảnh báo: Mark Minervini tuyệt đối cấm stop-loss &gt; 8%!
                  </p>
                )}
              </div>

              {/* 4. TỶ LỆ LỆNH THẮNG (WIN RATE) - AUTO / THỦ CÔNG */}
              <div className="space-y-3 pt-3 border-t border-zinc-800/80">
                {/* Header with Mode Switch */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      Tỷ Lệ Thắng (Win Rate):
                    </span>
                    {autoWinRateLoading && (
                      <ArrowsClockwise className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    )}
                  </div>

                  {/* Mode Switcher */}
                  <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => handleToggleAutoWinRate(true)}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                        isAutoWinRate
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                      title="AI tự động tính tỷ lệ thắng dựa trên VN-Index, Trend Template, RS Rating và Nổ Vol"
                    >
                      <Lightning className="w-3 h-3 text-cyan-400" />
                      <span>AUTO</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAutoWinRate(false)}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                        !isAutoWinRate
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                      title="Tự điều chỉnh tỷ lệ thắng theo thống kê cá nhân"
                    >
                      <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                      <span>Thủ Công</span>
                    </button>
                  </div>
                </div>

                {/* Main Value Display Box */}
                <div className="flex items-center justify-between text-xs font-mono bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/70">
                  <div>
                    <div className="text-[10px] uppercase text-zinc-400">
                      {isAutoWinRate ? (
                        <span className="flex items-center gap-1 text-cyan-400 font-bold">
                          <Lightning className="w-3 h-3" />
                          Ước lượng theo quy tắc (không phải xác suất backtest)
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold">Tự điều chỉnh thủ công</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className={`text-xl font-bold font-mono ${isAutoWinRate ? 'text-cyan-300' : 'text-amber-300'}`}>
                        {winRatePct}%
                      </span>
                      <span className="text-zinc-400 text-[11px]">
                        ({winRatePct} đúng / {100 - winRatePct} sai)
                      </span>
                    </div>
                  </div>

                  {/* Confidence Badge or Manual Direct Input */}
                  <div className="flex flex-col items-end gap-1 text-right">
                    {isAutoWinRate && autoWinRateData ? (
                      <>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                            autoWinRateData.confidence === 'CAO'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : autoWinRateData.confidence === 'TRUNG BÌNH'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                          title={autoWinRateData.confidenceReason || 'Độ hội tụ của 4 trụ cột kỹ thuật'}
                        >
                          Độ tin cậy: {autoWinRateData.confidence}
                        </span>
                        {autoWinRateData.confidenceReason && (
                          <span className="text-[9px] font-mono text-zinc-400 max-w-[210px] leading-tight">
                            {autoWinRateData.confidenceReason}
                          </span>
                        )}
                        {autoWinRateData.recommendedRiskNav && (
                          <span className="text-[9px] font-mono text-cyan-400/90 font-medium">
                            Gợi ý rủi ro: {autoWinRateData.recommendedRiskNav}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="10"
                          max="90"
                          step="1"
                          value={winRatePct}
                          onChange={(e) => handleManualWinRateChange(Number(e.target.value))}
                          className="w-14 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-xs font-mono text-amber-300 font-bold text-right focus:outline-none"
                        />
                        <span className="text-xs text-zinc-400">%</span>
                      </div>
                    )}
                    {!isAutoWinRate && autoWinRateData && (
                      <button
                        type="button"
                        onClick={() => handleToggleAutoWinRate(true)}
                        className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-0.5"
                      >
                        <Lightning className="w-2.5 h-2.5" />
                        <span>Khôi phục AUTO ({autoWinRateData.autoWinRate}%)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="25"
                    max="75"
                    step="1"
                    value={winRatePct}
                    onChange={(e) => handleManualWinRateChange(Number(e.target.value))}
                    className={`w-full cursor-pointer ${isAutoWinRate ? 'accent-cyan-400' : 'accent-amber-400'}`}
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>25% (Thị trường yếu)</span>
                    <span>45% (Trung bình)</span>
                    <span>75% (Siêu cổ phiếu)</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[30, 35, 40, 45, 50, 55, 60].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleManualWinRateChange(val)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                        winRatePct === val && !isAutoWinRate
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>

                {/* Quantitative 4-Pillar Breakdown Card */}
                {autoWinRateData && autoWinRateData.factors && (
                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-zinc-200 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                        5 Trụ Cột Định Lượng (Wyckoff + Minervini + Vol) • {activeSymbol}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFactorBreakdown(!showFactorBreakdown)}
                        className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-0.5"
                      >
                        <span>{showFactorBreakdown ? 'Thu gọn' : 'Chi tiết'}</span>
                        {showFactorBreakdown ? (
                          <CaretUp className="w-3 h-3" />
                        ) : (
                          <CaretDown className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {showFactorBreakdown && (
                      <div className="space-y-2.5 pt-1.5 border-t border-zinc-800/70">
                        {autoWinRateData.factors.map((factor, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-zinc-300 font-medium">
                                {factor.name} ({factor.weight}%)
                              </span>
                              <span
                                className={`font-bold ${
                                  factor.deltaPct > 0
                                    ? 'text-emerald-400'
                                    : factor.deltaPct < 0
                                    ? 'text-rose-400'
                                    : 'text-zinc-400'
                                }`}
                              >
                                {factor.deltaPct > 0 ? `+${factor.deltaPct}%` : `${factor.deltaPct}%`}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden flex">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  factor.score >= 70
                                    ? 'bg-emerald-400'
                                    : factor.score >= 50
                                    ? 'bg-amber-400'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${factor.score}%` }}
                              />
                            </div>
                            <p className="text-[10px] font-mono text-zinc-400 leading-tight">
                              {factor.details}
                            </p>
                          </div>
                        ))}

                        {/* Tactical Minervini Advice */}
                        <div className="p-2.5 rounded-lg bg-zinc-950/90 border border-zinc-800 text-[11px] font-mono space-y-1">
                          <span className="text-cyan-400 font-bold block">
                            Chiến Lược Của Mark Minervini Cho {activeSymbol}:
                          </span>
                          <p className="text-zinc-300 leading-relaxed text-[11px]">
                            {autoWinRateData.advice}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Vốn & Rủi ro NAV mỗi lệnh */}
              <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase block">Quy Mô NAV (Vốn)</span>
                  <input
                    type="number"
                    step="10000000"
                    value={totalCapital}
                    onChange={(e) => setTotalCapital(Math.max(1000000, Number(e.target.value)))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase block">Rủi Ro Mỗi Lệnh (%)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5"
                    value={riskPerTradePct}
                    onChange={(e) => setRiskPerTradePct(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Verdict Box */}
          <div className={`p-3 rounded-xl border text-xs font-mono leading-relaxed mt-4 ${math.verdictColor}`}>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{math.verdictNote}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Minervini Pyramiding Scale-In & Staged Defense/Offense Plan (7 cols) */}
        <div className="lg:col-span-7 space-y-5 flex flex-col justify-between">
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl space-y-4">
            {/* Header with Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Stack className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-100 font-bold">
                  Kế Hoạch Giải Ngân & Cắt Lỗ Cho {activeSymbol}
                </h3>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setPositionPlanMode('pyramid')}
                  className={`px-3 py-1 rounded-md transition-all font-semibold flex items-center gap-1.5 ${
                    positionPlanMode === 'pyramid'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Sparkle className="w-3.5 h-3.5" />
                  <span>Kim Tự Tháp 40-35-25 (Khuyên dùng)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPositionPlanMode('classic')}
                  className={`px-3 py-1 rounded-md transition-all font-semibold flex items-center gap-1.5 ${
                    positionPlanMode === 'classic'
                      ? 'bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Vị Thế Đơn Lẻ</span>
                </button>
              </div>
            </div>

            {/* Content Based on Mode */}
            {positionPlanMode === 'pyramid' ? (
              <div className="space-y-4">
                {/* Overview Header Pill Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Tổng Vị Thế Cho Phép</span>
                    <span className="text-sm font-bold text-zinc-200 block mt-0.5">
                      {math.maxShares.toLocaleString('vi-VN')} CP
                    </span>
                    <span className="text-[10px] text-zinc-400">({formatVND(math.positionValue)} đ)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Tỷ Trọng Giải Ngân</span>
                    <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                      {math.allocationPct}% NAV
                    </span>
                    <span className="text-[10px] text-zinc-400">Rủi ro: {riskPerTradePct}% NAV</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Giá Vốn TB Sau 3 Đợt</span>
                    <span className="text-sm font-bold text-cyan-300 block mt-0.5">
                      {formatVND(math.pyramid.avgEntryPrice)} đ
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Chênh +{math.pyramid.avgPricePremiumPct}% so với Entry
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Bảo Vệ Vốn Sống Còn</span>
                    <span className="text-sm font-bold text-amber-300 block mt-0.5">Risk-Free</span>
                    <span className="text-[10px] text-zinc-400">Dời SL hòa vốn ở Đợt 2</span>
                  </div>
                </div>

                {/* 1. Kế Hoạch 3 Đợt Giải Ngân Kim Tự Tháp (Pyramid Scale-In) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <TrendUp className="w-3.5 h-3.5 text-emerald-400" />
                      1. Kế Hoạch Giải Ngân Kim Tự Tháp (Scale-In 3 Đợt)
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      "Chỉ mua gia tăng khi đang thắng - Tuyệt đối không bình quân giá xuống"
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Đợt 1: Pilot Tranche (40%) */}
                    <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          ĐỢT 1: 40% VỊ THẾ
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">Thăm Dò (Pilot)</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase block">Giá Mua & Khối Lượng</span>
                        <div className="text-base font-mono font-bold text-zinc-100 mt-0.5">
                          {formatVND(math.pyramid.t1EntryPrice)} đ
                        </div>
                        <span className="text-xs font-mono text-emerald-400 block font-semibold">
                          {math.pyramid.t1Shares.toLocaleString('vi-VN')} CP ({formatVND(math.pyramid.t1Value)} đ)
                        </span>
                      </div>
                      <div className="pt-2 border-t border-zinc-800/80 text-[11px] font-mono space-y-1">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Stop Loss Ban Đầu:</span>
                          <span className="text-rose-400 font-bold">
                            {formatVND(math.pyramid.t1StopLossPrice)} (-{stopLossPct}%)
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 leading-tight">
                          🛡️ Rủi ro ban đầu chỉ <span className="text-zinc-300 font-bold">{math.pyramid.t1RiskNavPct}% NAV</span> (tiết kiệm 60% rủi ro nếu sai).
                        </div>
                      </div>
                    </div>

                    {/* Đợt 2: Scale-Up 1 (35%) */}
                    <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          ĐỢT 2: 35% VỊ THẾ
                        </span>
                        <span className="text-[10px] font-mono text-cyan-300 font-bold">KHI LÃI +2.5%</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase block">Giá Mua & Khối Lượng</span>
                        <div className="text-base font-mono font-bold text-zinc-100 mt-0.5">
                          {formatVND(math.pyramid.t2EntryPrice)} đ
                        </div>
                        <span className="text-xs font-mono text-cyan-400 block font-semibold">
                          {math.pyramid.t2Shares.toLocaleString('vi-VN')} CP ({formatVND(math.pyramid.t2Value)} đ)
                        </span>
                      </div>
                      <div className="pt-2 border-t border-zinc-800/80 text-[11px] font-mono space-y-1">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Dời SL Đợt 1 về:</span>
                          <span className="text-emerald-400 font-bold">
                            {formatVND(math.pyramid.t2StopLossPrice)} (Hòa vốn)
                          </span>
                        </div>
                        <div className="text-[10px] text-cyan-300/90 leading-tight font-medium">
                          ⚡ Vị thế Đợt 1 trở thành <span className="font-bold">Risk-Free</span>. Rủi ro tổng giảm về gần 0.
                        </div>
                      </div>
                    </div>

                    {/* Đợt 3: Pyramid Complete (25%) */}
                    <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          ĐỢT 3: 25% VỊ THẾ
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 font-bold">KHI BỨT PHÁ +5.0%</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase block">Giá Mua & Khối Lượng</span>
                        <div className="text-base font-mono font-bold text-zinc-100 mt-0.5">
                          {formatVND(math.pyramid.t3EntryPrice)} đ
                        </div>
                        <span className="text-xs font-mono text-amber-400 block font-semibold">
                          {math.pyramid.t3Shares.toLocaleString('vi-VN')} CP ({formatVND(math.pyramid.t3Value)} đ)
                        </span>
                      </div>
                      <div className="pt-2 border-t border-zinc-800/80 text-[11px] font-mono space-y-1">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Khóa Lãi Toàn Vị Thế:</span>
                          <span className="text-amber-300 font-bold">
                            {formatVND(math.pyramid.t3StopLossPrice)} (+1.5%)
                          </span>
                        </div>
                        <div className="text-[10px] text-amber-300/90 leading-tight font-medium">
                          🔒 <span className="font-bold">Khóa lãi tuyệt đối</span>: Không thể thua lỗ dù thị trường đảo chiều!
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Kế Hoạch Cắt Lỗ Bậc Thang (Staged Stop-Loss - Phòng thủ) & Chốt Lời Bậc Thang (Staged Exits - Tấn công) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
                  {/* Cắt Lỗ Bậc Thang (2 Nấc Phòng Thủ) */}
                  <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-rose-300 uppercase flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-rose-400" />
                        Cắt Lỗ Bậc Thang (Phòng Thủ 2 Nấc)
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        Tiết kiệm {math.stagedExit.lossSavedPct}% rủi ro
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      {/* Nấc 1: Cắt 50% sớm */}
                      <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-rose-400 font-bold block">
                            NẤC 1: CẮT 50% VỊ THẾ (-{math.stagedExit.halfStopPct}%)
                          </span>
                          <span className="text-zinc-200 font-bold text-xs">
                            {formatVND(math.stagedExit.stage1Price)} đ
                          </span>
                          <span className="text-[10px] text-zinc-400 ml-1.5">
                            ({math.stagedExit.stage1Shares.toLocaleString('vi-VN')} CP)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-400 block">Lỗ Nấc 1:</span>
                          <span className="text-rose-400 font-bold">
                            -{formatVND(math.stagedExit.stage1Loss)} đ
                          </span>
                        </div>
                      </div>

                      {/* Nấc 2: Cắt 50% còn lại */}
                      <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-rose-400 font-bold block">
                            NẤC 2: CẮT 50% CÒN LẠI (-{stopLossPct}%)
                          </span>
                          <span className="text-zinc-200 font-bold text-xs">
                            {formatVND(math.stopLossPrice)} đ
                          </span>
                          <span className="text-[10px] text-zinc-400 ml-1.5">
                            ({math.stagedExit.stage2Shares.toLocaleString('vi-VN')} CP)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-400 block">Lỗ Nấc 2:</span>
                          <span className="text-rose-400 font-bold">
                            -{formatVND(math.stagedExit.stage2Loss)} đ
                          </span>
                        </div>
                      </div>

                      {/* So sánh tổn thất */}
                      <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Tổng lỗ nếu cắt bậc thang:</span>
                          <span className="text-rose-300 font-bold">
                            -{formatVND(math.stagedExit.totalStagedLoss)} đ
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Tổng lỗ nếu gồng cắt 1 lần:</span>
                          <span className="text-zinc-400 line-through">
                            -{formatVND(math.stagedExit.singleExitLoss)} đ
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-400 font-bold pt-1 border-t border-zinc-800">
                          <span>Số tiền bảo vệ được:</span>
                          <span>+{formatVND(math.stagedExit.lossSavedAmt)} đ</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chốt Lời Bậc Thang (3 Tầng Tấn Công) */}
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                        <TrendUp className="w-4 h-4 text-emerald-400" />
                        Chốt Lời Bậc Thang (Tấn Công 3 Tầng)
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">Tối ưu hóa đà tăng</span>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      {/* TP1: 35% */}
                      <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-400 font-bold block">
                            TP1: CHỐT 35% VỊ THẾ (+{math.stagedExit.tp1Pct}%)
                          </span>
                          <span className="text-zinc-200 font-bold text-xs">
                            {formatVND(math.stagedExit.tp1Price)} đ
                          </span>
                          <span className="text-[10px] text-zinc-400 ml-1.5">
                            ({math.stagedExit.tp1Shares.toLocaleString('vi-VN')} CP)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-400 block">Lợi Nhuận:</span>
                          <span className="text-emerald-400 font-bold">
                            +{formatVND(math.stagedExit.tp1Profit)} đ
                          </span>
                        </div>
                      </div>

                      {/* TP2: 40% */}
                      <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-400 font-bold block">
                            TP2: CHỐT 40% CHÍNH (+{targetGainPct}%)
                          </span>
                          <span className="text-zinc-200 font-bold text-xs">
                            {formatVND(math.stagedExit.tp2Price)} đ
                          </span>
                          <span className="text-[10px] text-zinc-400 ml-1.5">
                            ({math.stagedExit.tp2Shares.toLocaleString('vi-VN')} CP)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-400 block">Lợi Nhuận:</span>
                          <span className="text-emerald-400 font-bold">
                            +{formatVND(math.stagedExit.tp2Profit)} đ
                          </span>
                        </div>
                      </div>

                      {/* Runner: 25% */}
                      <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-cyan-400 font-bold block">
                            RUNNER: 25% CÒN LẠI (GỒNG SIÊU SÓNG)
                          </span>
                          <span className="text-zinc-300 font-bold text-xs">
                            {math.stagedExit.runnerShares.toLocaleString('vi-VN')} CP
                          </span>
                          <span className="text-[10px] text-zinc-500 ml-1.5">Trailing theo MA20 ngày</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-400 block">Tiềm Năng:</span>
                          <span className="text-cyan-400 font-bold">Không giới hạn</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Classic Single Entry / Exit Payoff Scale */
              <div className="space-y-4">
                {/* 3 Bento Level Cards */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Level 1: Target */}
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">
                      Giá Chốt Lời (+{targetGainPct}%)
                    </span>
                    <span className="text-xl sm:text-2xl font-mono font-black text-emerald-300 block mt-0.5">
                      {formatVND(math.targetPrice)}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 mt-1 block">
                      +{(math.targetPrice - entryPrice).toLocaleString('vi-VN')} đ/CP
                    </span>
                  </div>

                  {/* Level 2: Entry */}
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700/80">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Điểm Mua (Entry)
                    </span>
                    <span className="text-xl sm:text-2xl font-mono font-black text-zinc-100 block mt-0.5">
                      {formatVND(entryPrice)}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 mt-1 block">
                      Giá cơ sở vào lệnh
                    </span>
                  </div>

                  {/* Level 3: Stop-Loss */}
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                    <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider block">
                      Giá Cắt Lỗ (-{stopLossPct}%)
                    </span>
                    <span className="text-xl sm:text-2xl font-mono font-black text-rose-300 block mt-0.5">
                      {formatVND(math.stopLossPrice)}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 mt-1 block">
                      -{(entryPrice - math.stopLossPrice).toLocaleString('vi-VN')} đ/CP
                    </span>
                  </div>
                </div>

                {/* Visual Risk vs Reward Gauge Bar */}
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-rose-400 flex items-center gap-1.5 font-bold">
                      <span className="w-2.5 h-2.5 rounded bg-rose-500" />
                      Rủi Ro: -{stopLossPct}% ({formatVND(math.lossAtStop)} đ)
                    </span>
                    <span className="text-zinc-400 font-bold">Tỷ Lệ {math.rrRatio}:1</span>
                    <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                      Lợi Nhuận: +{targetGainPct}% (+{formatVND(math.profitAtTarget)} đ)
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                    </span>
                  </div>

                  <div className="w-full h-3 bg-zinc-800 rounded-full flex overflow-hidden">
                    <div
                      className="h-full bg-rose-500/80 transition-all duration-500"
                      style={{ width: `${(stopLossPct / (stopLossPct + targetGainPct)) * 100}%` }}
                      title={`Rủi ro: ${stopLossPct}%`}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${(targetGainPct / (stopLossPct + targetGainPct)) * 100}%` }}
                      title={`Mục tiêu: ${targetGainPct}%`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1">
                    <span>Cắt Lỗ: {formatVND(math.stopLossPrice)} đ</span>
                    <span className="text-zinc-300">Điểm Vào: {formatVND(entryPrice)} đ</span>
                    <span>Chốt Lời: {formatVND(math.targetPrice)} đ</span>
                  </div>
                </div>

                {/* Sizing Box */}
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2.5 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Khối lượng mua tối đa cho phép:</span>
                    <span className="font-bold text-emerald-300">
                      {math.maxShares.toLocaleString('vi-VN')} CP ({formatVND(math.positionValue)} đ)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Tỷ trọng giải ngân danh mục:</span>
                    <span className="font-bold text-zinc-200">{math.allocationPct}% Tổng Tài Khoản (NAV)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Tổn thất tối đa nếu dính Stop-Loss:</span>
                    <span className="font-bold text-rose-400">
                      -{formatVND(math.maxRiskCapital)} đ (Đúng {riskPerTradePct}% NAV)
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                    <span className="text-zinc-400">Mức cắt lỗ chuẩn 2:1 Minervini đề xuất:</span>
                    <span className="font-bold text-amber-300">
                      -{math.minerviniOptimalStopPct2to1}% ({formatVND(math.optimalStopPrice2to1)} đ)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── VISUAL SIMULATION: MONTE CARLO TRADING SEQUENCE & CAPITAL GROWTH CURVE ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-mono font-bold text-zinc-100 flex items-center gap-2">
                <ChartLineUp className="w-5 h-5 text-emerald-400" />
                <span>Mô Phỏng Monte Carlo: Tăng Trưởng Tài Khoản Qua Chuỗi {simulationTradeCount} Lệnh</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900 text-emerald-400 border border-emerald-500/30">
                PROBABILITY ENGINE
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Mô phỏng ngẫu nhiên kết quả chuỗi {simulationTradeCount} lệnh thực chiến dựa trên xác suất Win Rate {winRatePct}% và R:R {math.rrRatio}:1
            </p>
          </div>

          {/* Interactive Simulation Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Trade Count Selector */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
              {[20, 30, 50].map((count) => (
                <button
                  key={count}
                  onClick={() => setSimulationTradeCount(count)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    simulationTradeCount === count
                      ? 'bg-zinc-800 text-emerald-400 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {count} Lệnh
                </button>
              ))}
            </div>

            {/* Re-simulate Seed Button */}
            <button
              onClick={() => setSimulationSeed((prev) => prev + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-zinc-300 hover:text-emerald-400 transition-all active:scale-95"
              title="Chạy một kịch bản ngẫu nhiên mới"
            >
              <ArrowsClockwise className="w-3.5 h-3.5" />
              <span>Chạy Kịch Bản Mới</span>
            </button>
          </div>
        </div>

        {/* 4 Simulation Run Summary Bento KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[10px] font-mono text-zinc-400 uppercase block">Kết Quả Chuỗi Lệnh</span>
            <span className="text-base sm:text-lg font-mono font-bold text-zinc-100 block mt-0.5">
              <span className="text-emerald-400">{simulation.winsCount} Thắng</span> /{' '}
              <span className="text-rose-400">{simulation.lossesCount} Thua</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">Tỷ lệ thắng: {simulation.actualWinRate}%</span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[10px] font-mono text-zinc-400 uppercase block">Chuỗi Thua Liên Tiếp</span>
            <span className="text-base sm:text-lg font-mono font-bold text-amber-300 block mt-0.5">
              {simulation.maxLossStreak} Lệnh Thua
            </span>
            <span className="text-[10px] font-mono text-zinc-500">Thử thách tâm lý lớn nhất</span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[10px] font-mono text-zinc-400 uppercase block">Sụt Giảm Sâu Nhất (Drawdown)</span>
            <span className="text-base sm:text-lg font-mono font-bold text-zinc-100 block mt-0.5">
              <span className="text-emerald-400">-{simulation.maxDrawdownDisciplined}%</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">Không kỷ luật: -{Math.abs(simulation.netUndisciplinedPct)}%</span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[10px] font-mono text-zinc-400 uppercase block">Lợi Nhuận Ròng (ROI)</span>
            <span
              className={`text-base sm:text-lg font-mono font-bold block mt-0.5 ${
                simulation.netDisciplinedPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {simulation.netDisciplinedPct >= 0 ? `+${simulation.netDisciplinedPct}%` : `${simulation.netDisciplinedPct}%`}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              Vốn cuối: {formatVND(simulation.finalDisciplined)} đ
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pt-1">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-emerald-400 rounded-full" />
              <span className="text-emerald-300 font-bold">Kỷ Luật Minervini (Risk 1.5% NAV)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-400" />
              <span className="text-amber-300">Đường Kỳ Vọng Trung Bình</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-400" />
              <span className="text-rose-400">Trader Cảm Xúc (Gồng Lỗ)</span>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500">Vốn khởi điểm: {formatVND(totalCapital)} đ</span>
        </div>

        {/* Simulation Area Chart */}
        <div className="h-[280px] sm:h-[340px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={simulation.dataPoints} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="discGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="undiscGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />

              <XAxis
                dataKey="trade"
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                label={{
                  value: `Số Thứ Tự Lệnh Giao Dịch (Lệnh 1 → ${simulationTradeCount})`,
                  position: 'insideBottom',
                  offset: -5,
                  fill: '#71717a',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                }}
              />

              <YAxis
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                tickFormatter={(val) => `${(val / 1e6).toFixed(0)}Tr`}
                width={55}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    if (d.trade === 0) return null;

                    return (
                      <div className="p-3.5 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl text-xs font-mono space-y-2 min-w-[220px]">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-bold">
                          <span className="text-zinc-200">Lệnh Thứ #{d.trade}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] ${
                              d.isWin
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {d.isWin ? 'LỆNH THẮNG' : 'LỆNH THUA'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">Kết quả lệnh:</span>
                            <span className={d.pnlDisciplined >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {d.pnlDisciplined >= 0 ? `+${formatVND(d.pnlDisciplined)} đ` : `${formatVND(d.pnlDisciplined)} đ`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">NAV Kỷ luật:</span>
                            <span className="font-bold text-zinc-100">{formatVND(d.disciplined)} đ</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">Drawdown từ đỉnh:</span>
                            <span className="text-amber-400 font-bold">-{d.drawdownPct}%</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                            <span className="text-zinc-400">NAV Trader cảm xúc:</span>
                            <span className="text-rose-400 font-bold">{formatVND(d.undisciplined)} đ</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <ReferenceLine
                y={totalCapital}
                stroke="#71717a"
                strokeDasharray="4 4"
                label={{
                  value: `Vốn gốc: ${(totalCapital / 1e6).toFixed(0)}Tr`,
                  fill: '#71717a',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                  position: 'insideTopLeft',
                }}
              />

              {/* Theoretical Expected Value Path */}
              <Area
                type="monotone"
                dataKey="expected"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                name="Kỳ Vọng Lý Thuyết"
              />

              {/* Disciplined Curve */}
              <Area
                type="monotone"
                dataKey="disciplined"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#discGrad)"
                name="Kỷ Luật Minervini"
              />

              {/* Undisciplined Curve */}
              <Area
                type="monotone"
                dataKey="undisciplined"
                stroke="#f43f5e"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="url(#undiscGrad)"
                name="Không Kỷ Luật"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Deep Dive Note Box: What is Monte Carlo in Trading? */}
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-xs font-mono space-y-2">
          <span className="font-bold text-zinc-200 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400" />
            <span>Mô Phỏng Monte Carlo Là Gì & Tại Sao Cực Kỳ Quan Trọng Trong Thực Chiến?</span>
          </span>
          <p className="text-zinc-400 leading-relaxed text-[11px]">
            Trong thực tế, dù phương pháp của bạn có tỷ lệ thắng 50%, các lệnh thắng và thua <b>không bao giờ xuất hiện xen kẽ 1 thắng - 1 thua</b>. Sẽ có những giai đoạn thị trường khó khăn khiến bạn gặp phải chuỗi thua liên tiếp 3, 4 hoặc thậm chí 5 lệnh.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
            <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-300">
              <b>Kỷ luật Mark Minervini:</b> Giới hạn rủi ro mỗi lệnh ở mức 1.5% NAV (cắt lỗ $\le 6\%$). Khi gặp chuỗi 4 lệnh thua, tổng NAV chỉ giảm khoảng 6%. Tài khoản của bạn được bảo toàn nguyên vẹn và sẵn sàng bùng nổ khi các lệnh thắng theo tỷ lệ R:R $\ge 2:1$ xuất hiện.
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-rose-300">
              <b>Trader Cảm Xúc (Gồng Lỗ):</b> Thường dồn vốn tỷ trọng cao và gồng lỗ $-12\%$ đến $-20\%$ với hy vọng cổ phiếu hồi. Khi gặp chuỗi 4 lệnh thua, tài khoản bốc hơi &gt; 50% vốn và rơi vào bẫy bất đối xứng thua lỗ (phải lãi +100% chỉ để về bờ).
            </div>
          </div>
        </div>
      </div>

      {/* ── 2D INTERACTIVE EXPECTANCY HEATMAP MATRIX (MA TRẬN NHIỆT KỲ VỌNG TRỰC QUAN) ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div>
            <h3 className="text-sm font-mono font-bold text-zinc-100 flex items-center gap-2">
              <Scales className="w-5 h-5 text-emerald-400" />
              <span>Ma Trận Nhiệt Kỳ Vọng Minervini (Expectancy Heatmap Grid)</span>
            </h3>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Tỷ lệ thắng (Win Rate) vs Tỷ lệ R:R (Lợi nhuận / Rủi ro) • Với mức cắt lỗ cơ sở -{stopLossPct}%
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40">
              Lợi Thế Cao (&gt; +3%)
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Lợi Thế Dương
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Kỳ Vọng Âm
            </span>
          </div>
        </div>

        {/* 2D Heatmap Grid Table */}
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-xs font-mono text-center">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="py-2.5 px-3 text-left">Win Rate \ R:R</th>
                <th className="py-2.5 px-3">1.5 : 1</th>
                <th className="py-2.5 px-3">2.0 : 1 (Chuẩn)</th>
                <th className="py-2.5 px-3">2.5 : 1</th>
                <th className="py-2.5 px-3">3.0 : 1</th>
                <th className="py-2.5 px-3">4.0 : 1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {heatmapData.map((row) => (
                <tr key={row.winRate} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-3 text-left font-bold text-zinc-200">
                    {row.winRate}% Đúng
                  </td>
                  {row.cells.map((cell) => {
                    let cellBg = 'bg-zinc-900/60 text-zinc-400';
                    if (cell.isHighEdge) {
                      cellBg = 'bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40';
                    } else if (cell.isPositive) {
                      cellBg = 'bg-emerald-500/15 text-emerald-400 font-semibold';
                    } else {
                      cellBg = 'bg-rose-500/20 text-rose-300 font-semibold';
                    }

                    return (
                      <td key={cell.rr} className="py-2.5 px-2">
                        <div
                          className={`py-2 px-2.5 rounded-xl transition-all relative ${cellBg} ${
                            cell.isCurrentCell ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/20 scale-105' : ''
                          }`}
                        >
                          <span className="block">
                            {cell.eVal > 0 ? `+${cell.eVal}%` : `${cell.eVal}%`}
                          </span>
                          {cell.isCurrentCell && (
                            <span className="text-[9px] uppercase font-black text-amber-300 block tracking-tight">
                              BẠN Ở ĐÂY
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── BẢNG BẤT ĐỐI XỨNG THUA LỖ & 4 NGUYÊN TẮC VÀNG MINERVINI ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Asymmetry of Loss Visual Bar Chart */}
        <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <h4 className="text-xs font-mono font-bold uppercase text-zinc-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <span>Bất Đối Xứng Thua Lỗ (Quy Luật Sống Còn)</span>
            </h4>
            <span className="text-[10px] font-mono text-zinc-400">Toán học lãi kép</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {[
              { loss: 5, gainReq: 5.3, note: 'Rất dễ hoàn vốn' },
              { loss: 7, gainReq: 7.5, note: 'Chuẩn Minervini' },
              { loss: 10, gainReq: 11.1, note: 'Ngưỡng tối đa cho phép' },
              { loss: 15, gainReq: 17.6, note: 'Bắt đầu khó khăn' },
              { loss: 20, gainReq: 25.0, note: 'Cần nỗ lực gấp đôi' },
              { loss: 30, gainReq: 42.9, note: 'Nguy hiểm nghiêm trọng' },
              { loss: 50, gainReq: 100.0, note: 'Phải LÃI GẤP ĐÔI để hòa vốn!' },
            ].map((item) => (
              <div key={item.loss} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className={item.loss <= 8 ? 'text-emerald-400' : item.loss <= 15 ? 'text-amber-400' : 'text-rose-400 font-bold'}>
                    Lỗ -{item.loss}% &rarr; Cần +{item.gainReq}% để hòa vốn
                  </span>
                  <span className="text-zinc-400 text-[10px]">{item.note}</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-rose-500/70"
                    style={{ width: `${item.loss}%` }}
                  />
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.min(100 - item.loss, item.gainReq)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Intuitive Math Explanation Box: Tại sao Lỗ -50% phải Lãi +100% */}
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5 text-xs font-mono">
            <span className="font-bold text-amber-300 block flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              Vì sao Lỗ -50% lại cần LÃI +100% mới về bờ (chứ không phải +50%)?
            </span>
            <div className="text-[11px] text-zinc-300 space-y-1 leading-relaxed">
              <p>
                • Bạn có <b className="text-zinc-100">100 triệu</b>. Lỗ <b>-50%</b> &rarr; Tài khoản chỉ còn <b className="text-rose-400">50 triệu</b>.
              </p>
              <p>
                • Nếu từ 50 triệu bạn lãi lại <b>+50%</b> (lãi 25 triệu) &rarr; Bạn mới có <b className="text-amber-300">75 triệu</b> (Vẫn đang lỗ 25 triệu!).
              </p>
              <p>
                • Để từ 50 triệu gỡ lại đủ 100 triệu ban đầu (kiếm thêm 50 triệu), bạn lấy: 50Tr / 50Tr = <b className="text-emerald-400">+100% (Phải Lãi Gấp Đôi)</b>!
              </p>
            </div>
          </div>

          <p className="text-[11px] font-mono text-zinc-400 leading-relaxed pt-2 border-t border-zinc-800/80">
            Minervini: <i>"Cắt lỗ ở 7% chỉ cần lãi 7.5% để gỡ lại. Nhưng nếu để âm 50%, bạn cần một siêu cổ phiếu tăng 100% chỉ để quay lại điểm xuất phát!"</i>
          </p>
        </div>

        {/* 4 Golden Rules Checklist */}
        <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 mb-3">
              <h4 className="text-xs font-mono font-bold uppercase text-zinc-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>4 Nguyên Tắc Vàng Ghi Nhớ Suốt Đời</span>
              </h4>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">MINERVINI CREED</span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="font-bold text-zinc-100 block">1. Lỗ trung bình = 1/2 Lãi trung bình</span>
                <span className="text-[11px] text-zinc-400 mt-0.5 block">
                  Nếu mục tiêu lãi trung bình là 12%, mức cắt lỗ tối đa phải dừng ở 6% (tỷ lệ 2:1).
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="font-bold text-zinc-100 block">2. Giới hạn cứng: Tuyệt đối không quá 7-8%</span>
                <span className="text-[11px] text-zinc-400 mt-0.5 block">
                  Dù bạn tin tưởng doanh nghiệp đến đâu, không bao giờ để bất kỳ khoản lỗ nào vượt quá 8%.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="font-bold text-zinc-100 block">3. Khi chuỗi thua kéo dài: THU HẸP CẮT LỖ</span>
                <span className="text-[11px] text-zinc-400 mt-0.5 block">
                  Khi thị trường xấu, hạ mức cắt lỗ xuống 3% - 4% và giảm quy mô vị thế, không được gồng lỗ.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="font-bold text-zinc-100 block">4. Rủi ro tối đa 1.25% - 2% NAV</span>
                <span className="text-[11px] text-zinc-400 mt-0.5 block">
                  Nếu sai và dính stop loss, tổn thất của cả tài khoản chỉ được phép mất tối đa 1.5% NAV.
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-300">
            Kỷ luật là cầu nối giữa mục tiêu và thành tựu — Hãy luôn tính toán hàm kỳ vọng trước khi đặt bất kỳ lệnh mua nào!
          </div>
        </div>
      </div>
    </div>
  );
};
