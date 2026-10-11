'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  TrendUp,
  ShieldCheck,
  Flame,
  Lightning,
  Coins,
  ArrowRight,
  CheckCircle,
  WarningCircle,
  ChartLineUp,
  Cpu,
  Buildings,
  GasPump,
  FirstAid,
  Car,
  TreeEvergreen,
  BookOpen,
  Info,
  Scales,
  Sparkle,
} from '@phosphor-icons/react';
import { MinerviniScreenerItem } from '../types/minervini.types';
import { SECTOR_MAPPING } from '../data/sectorMapping';

export type CyclePhaseKey = 'recovery' | 'expansion' | 'late' | 'recession';

export interface CyclePhaseConfig {
  key: CyclePhaseKey;
  title: string;
  subTitle: string;
  color: string;
  glowColor: string;
  bgLight: string;
  borderLight: string;
  needleAngle: number; // góc kim chỉ (độ)
  macroStatus: string;
  growthStatus: string;
  inflationStatus: string;
  interestRateStatus: string;
  primarySectors: string[];
  description: string;
  keyDrivers: string[];
  minerviniStrategy: string;
  fidelityAssetAlloc: string;
}

export const CYCLE_PHASES: Record<CyclePhaseKey, CyclePhaseConfig> = {
  recovery: {
    key: 'recovery',
    title: 'PHỤC HỒI SỚM',
    subTitle: 'Early-Cycle Recovery',
    color: '#06b6d4', // Cyan
    glowColor: 'rgba(6, 182, 212, 0.4)',
    bgLight: 'bg-cyan-500/10',
    borderLight: 'border-cyan-500/30',
    needleAngle: 45,
    macroStatus: 'Lãi suất chạm đáy, nới lỏng tiền tệ, tín dụng bắt đầu tăng tốc',
    growthStatus: 'Phục hồi từ đáy (Đang tăng tốc)',
    inflationStatus: 'Thấp hoặc đang hạ nhiệt',
    interestRateStatus: 'Thấp / Nới lỏng định lượng',
    primarySectors: ['Ngân hàng', 'Dịch vụ tài chính', 'Bất động sản', 'Phân phối, bán lẻ', 'Ô tô, linh kiện'],
    description: 'Chính sách tiền tệ mở rộng kích hoạt dòng tiền rẻ, định giá P/E & P/B hồi phục mạnh mẽ từ đáy sâu. Nhóm Tài chính (Bank/Chứng khoán) và Tiêu dùng nhạy cảm lãi suất dẫn dắt nhịp sóng đầu tiên.',
    keyDrivers: ['Hạ lãi suất điều hành & kích cầu tín dụng', 'Thị trường chứng khoán phục hồi thanh khoản', 'Niềm tin tiêu dùng & đơn hàng phục hồi'],
    minerviniStrategy: 'Tìm kiếm cổ phiếu tạo đáy kép (Double Bottom) hoặc thoát nền tích luỹ đầu tiên với điểm mua Pocket Pivot và khối lượng đột biến.',
    fidelityAssetAlloc: 'Cổ phiếu (Equities) vượt trội hoàn toàn so với Tiền mặt & Trái phiếu.',
  },
  expansion: {
    key: 'expansion',
    title: 'TĂNG TRƯỞNG MỞ RỘNG',
    subTitle: 'Mid-Cycle Boom (Pha Dẫn Dắt)',
    color: '#10b981', // Emerald
    glowColor: 'rgba(16, 185, 129, 0.45)',
    bgLight: 'bg-emerald-500/10',
    borderLight: 'border-emerald-500/30',
    needleAngle: 135,
    macroStatus: 'GDP tăng tốc cao, thặng dư xuất khẩu, giải ngân FDI & đầu tư công bùng nổ',
    growthStatus: 'Tăng trưởng mạnh mẽ (Trên xu hướng dài hạn)',
    inflationStatus: 'Ổn định / Tăng nhẹ trong tầm kiểm soát',
    interestRateStatus: 'Trung tính / Duy trì hỗ trợ tăng trưởng',
    primarySectors: ['Phần mềm', 'Hàng hóa công nghiệp', 'Nguyên vật liệu', 'Vận tải', 'Viễn thông'],
    description: 'Pha mạnh nhất và kéo dài nhất của chu kỳ kinh tế theo mô hình Merrill Lynch & Fidelity. Lợi nhuận EPS và doanh thu doanh nghiệp bứt phá ngoạn mục. Dòng tiền cuộn sóng vào các ngành công nghệ, sản xuất, xuất khẩu và logistic.',
    keyDrivers: ['GDP tăng trưởng 7-8% vượt kế hoạch', 'Xuất siêu kỷ lục, chuỗi cung ứng mở rộng', 'Đầu tư công và dòng vốn FDI giải ngân tăng tốc'],
    minerviniStrategy: 'Tập trung 100% danh mục vào Siêu Cổ Phiếu Giai Đoạn 2 (Stage 2 Uptrend) có RS Rating >= 80, bứt phá mô hình VCP (Thu hẹp độ biến động) và Pivot Point.',
    fidelityAssetAlloc: 'Tập trung cổ phiếu tăng trưởng (Growth Stocks), tỷ trọng cổ phiếu tối đa.',
  },
  late: {
    key: 'late',
    title: 'CUỐI CHU KỲ / ĐẠT ĐỈNH',
    subTitle: 'Late-Cycle Peak & Overheat',
    color: '#f59e0b', // Amber
    glowColor: 'rgba(245, 158, 11, 0.4)',
    bgLight: 'bg-amber-500/10',
    borderLight: 'border-amber-500/30',
    needleAngle: 225,
    macroStatus: 'Lạm phát tăng nhanh, công suất chạm trần, áp lực thắt chặt tiền tệ gia tăng',
    growthStatus: 'Bắt đầu chậm lại (Tăng trưởng hạ nhiệt)',
    inflationStatus: 'Tăng cao / Chạm trần mục tiêu',
    interestRateStatus: 'Bắt đầu nâng lãi suất / Thắt chặt',
    primarySectors: ['Năng lượng', 'Nguyên vật liệu', 'Hóa chất'],
    description: 'Nền kinh tế có dấu hiệu quá nhiệt, chi phí nguyên liệu và nhân công tăng đẩy lạm phát lên cao. Lợi nhuận doanh nghiệp bắt đầu bị bào mòn bởi chi phí vốn. Dòng tiền xoay tua tìm đến hàng hóa cơ bản, năng lượng và dầu khí.',
    keyDrivers: ['Giá dầu thô & hàng hóa neo cao', 'Lạm phát tiệm cận ngưỡng cảnh báo', 'Chính sách tiền tệ chuyển sang kiểm soát rủi ro'],
    minerviniStrategy: 'Thắt chặt chặn lãi (Trailing stop), chốt lời từng phần khi xuất hiện Climax Top (đỉnh cao trào khối lượng lớn mà giá không tăng thêm), không mua mới nến mở rộng.',
    fidelityAssetAlloc: 'Hàng hóa (Commodities) & Nhóm Năng lượng; hạ tỷ trọng cổ phiếu nói chung.',
  },
  recession: {
    key: 'recession',
    title: 'SUY THOÁI / PHÒNG THỦ',
    subTitle: 'Contraction & Downturn',
    color: '#f43f5e', // Rose
    glowColor: 'rgba(244, 63, 94, 0.4)',
    bgLight: 'bg-rose-500/10',
    borderLight: 'border-rose-500/30',
    needleAngle: 315,
    macroStatus: 'Kinh tế suy giảm, tín dụng thắt nghẹt, lợi nhuận DN toàn thị trường sụt giảm',
    growthStatus: 'Thu hẹp / Suy thoái (Dưới xu hướng)',
    inflationStatus: 'Hạ nhiệt nhanh / Nguy cơ thiểu phát',
    interestRateStatus: 'Bắt đầu chu kỳ nới lỏng cứu trợ',
    primarySectors: ['Tiện ích', 'Dược phẩm', 'Thực phẩm, đồ uống', 'Bảo hiểm'],
    description: 'Doanh nghiệp gặp khó khăn dòng tiền, người tiêu dùng thắt chặt hầu bao. Nhà đầu tư tìm kiếm sự an toàn tại các doanh nghiệp có dòng tiền đều đặn, cổ tức tiền mặt cao, không phụ thuộc chu kỳ kinh tế.',
    keyDrivers: ['Doanh thu bán lẻ & xuất khẩu sụt giảm', 'Tỷ lệ nợ xấu ngân hàng gia tăng', 'Dòng tiền rút về tài sản phòng thủ'],
    minerviniStrategy: 'Quy tắc vàng số 1: Giữ 70-100% tiền mặt, tuyệt đối kiên nhẫn đứng ngoài thị trường giá xuống (Bear Market), kiên quyết cắt lỗ 7-8% không nhân nhượng.',
    fidelityAssetAlloc: 'Trái phiếu (Bonds) & Tiền mặt (Cash); chỉ giữ cổ phiếu phòng thủ thiết yếu.',
  },
};

interface EconomicCycleWheelProps {
  items?: MinerviniScreenerItem[];
  onSelectSector?: (sector: string) => void;
}

export const EconomicCycleWheel: React.FC<EconomicCycleWheelProps> = ({
  items,
  onSelectSector,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<CyclePhaseKey>('expansion');
  const [activeResearchTab, setActiveResearchTab] = useState<'matrix' | 'macro' | 'methodology'>('matrix');
  const [internalItems, setInternalItems] = useState<MinerviniScreenerItem[]>(items || []);

  useEffect(() => {
    if (items && items.length > 0) {
      setInternalItems(items);
      return;
    }
    let isMounted = true;
    fetch('/api/market/minervini/screener?stage2=false&minRS=1')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.data)) {
          setInternalItems(data.data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [items]);

  // 1. Live Quantitative Sector RS & Stage 2 Computation
  const sectorLiveStats = useMemo(() => {
    const statsMap: Record<
      string,
      {
        sector: string;
        count: number;
        stage2Count: number;
        avgRs: number;
        avgChange: number;
        topLeaders: string[];
      }
    > = {};

    internalItems.forEach((item) => {
      const sec = SECTOR_MAPPING[item.symbol] || item.sector || 'Khác';
      if (!statsMap[sec]) {
        statsMap[sec] = {
          sector: sec,
          count: 0,
          stage2Count: 0,
          avgRs: 0,
          avgChange: 0,
          topLeaders: [],
        };
      }
      statsMap[sec].count++;
      if (item.isStage2Eligible) statsMap[sec].stage2Count++;
      statsMap[sec].avgRs += item.rsRating || 0;
      statsMap[sec].avgChange += item.changePct || 0;
      if (statsMap[sec].topLeaders.length < 3) {
        statsMap[sec].topLeaders.push(item.symbol);
      }
    });

    return Object.values(statsMap)
      .map((s) => ({
        ...s,
        avgRs: s.count > 0 ? Math.round(s.avgRs / s.count) : 0,
        avgChange: s.count > 0 ? Math.round((s.avgChange / s.count) * 100) / 100 : 0,
        stage2Pct: s.count > 0 ? Math.round((s.stage2Count / s.count) * 100) : 0,
      }))
      .sort((a, b) => b.avgRs - a.avgRs);
  }, [items]);

  // 2. Quantitative Cycle Phase Momentum Scoring
  // Evaluates which phase has the highest actual RS & Stage 2 concentration
  const phaseScores = useMemo(() => {
    const scores: Record<CyclePhaseKey, { totalRs: number; totalStage2: number; count: number; score: number }> = {
      recovery: { totalRs: 0, totalStage2: 0, count: 0, score: 0 },
      expansion: { totalRs: 0, totalStage2: 0, count: 0, score: 0 },
      late: { totalRs: 0, totalStage2: 0, count: 0, score: 0 },
      recession: { totalRs: 0, totalStage2: 0, count: 0, score: 0 },
    };

    (Object.keys(CYCLE_PHASES) as CyclePhaseKey[]).forEach((pKey) => {
      const cfg = CYCLE_PHASES[pKey];
      cfg.primarySectors.forEach((secName) => {
        const found = sectorLiveStats.find(
          (s) => s.sector.toLowerCase().includes(secName.toLowerCase()) || secName.toLowerCase().includes(s.sector.toLowerCase())
        );
        if (found) {
          scores[pKey].totalRs += found.avgRs * found.count;
          scores[pKey].totalStage2 += found.stage2Count;
          scores[pKey].count += found.count;
        }
      });

      const avgRs = scores[pKey].count > 0 ? scores[pKey].totalRs / scores[pKey].count : 50;
      const stage2Ratio = scores[pKey].count > 0 ? (scores[pKey].totalStage2 / scores[pKey].count) * 100 : 0;
      // Combined Momentum Score: 60% RS Rating + 40% Stage 2 Breadth Ratio
      scores[pKey].score = Math.round((avgRs * 0.6 + stage2Ratio * 0.4) * 10) / 10;
    });

    return scores;
  }, [sectorLiveStats]);

  // Dynamically detected active phase (highest score)
  const detectedActivePhaseKey = useMemo(() => {
    let topKey: CyclePhaseKey = 'expansion';
    let maxScore = -1;
    (Object.keys(phaseScores) as CyclePhaseKey[]).forEach((k) => {
      if (phaseScores[k].score > maxScore) {
        maxScore = phaseScores[k].score;
        topKey = k;
      }
    });
    return topKey;
  }, [phaseScores]);

  const activeCfg = CYCLE_PHASES[selectedPhase];
  const detectedCfg = CYCLE_PHASES[detectedActivePhaseKey];
  const topLeadingSectors = sectorLiveStats.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* ── 1. Hero Header & Macro Research Synthesis ─────────────────────── */}
      <div className="p-6 rounded-2xl bg-zinc-950/95 border border-zinc-800/80 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">
                Nghiên Cứu Định Lượng Vĩ Mô & Luân Chuyển Ngành (Sector Rotation Model)
              </span>
            </div>
            <h2 className="text-2xl font-mono font-bold text-zinc-100 tracking-tight">
              Đồng Hồ Chu Kỳ Kinh Tế & Bản Đồ Sức Mạnh RS 20 Nhóm Ngành
            </h2>
            <p className="text-xs text-zinc-400 max-w-3xl mt-1 leading-relaxed">
              Tổng hợp lý thuyết định chế tài chính quốc tế (<strong>Merrill Lynch Investment Clock</strong> &amp; <strong>Fidelity Business Cycle Framework</strong>) kết hợp mô hình lọc cổ phiếu <strong>Mark Minervini SEPA Trend Template</strong> từ dữ liệu 180+ mã niêm yết chuẩn xác.
            </p>
          </div>

          {/* Dynamic Macro Phase Detection Badge */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl bg-zinc-900/90 border border-emerald-500/30 shadow-lg shrink-0">
            <div className="w-11 h-11 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Compass className="w-6 h-6 animate-[spin_12s_linear_infinite]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">
                  KẾT QUẢ ĐỊNH LƯỢNG THỰC TẾ
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  Điểm: {phaseScores[detectedActivePhaseKey].score}
                </span>
              </div>
              <span className="text-sm font-mono font-black text-emerald-400 block mt-0.5">
                {detectedCfg.title}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 block">
                {detectedCfg.subTitle}
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. Interactive SVG Cycle Dial Clock (360 degrees) ───────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-center">
          {/* Wheel SVG & Sector Dial (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-[320px] h-[320px] sm:w-[360px] sm:h-[360px] flex items-center justify-center">
              {/* Outer decorative orbit ring with degrees markings */}
              <div className="absolute inset-0 rounded-full border border-dashed border-zinc-800 animate-[spin_80s_linear_infinite]" />
              <div className="absolute inset-3 rounded-full border border-zinc-800/80" />

              {/* Main SVG Dial */}
              <svg viewBox="0 0 400 400" className="w-full h-full transform -rotate-90">
                {/* 1. Quadrant Recovery (0° -> 90°) */}
                <path
                  d="M 200 200 L 360 200 A 160 160 0 0 1 200 360 Z"
                  className={`cursor-pointer transition-all duration-300 ${
                    selectedPhase === 'recovery'
                      ? 'fill-cyan-500/35 stroke-cyan-400 stroke-2 filter drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'fill-cyan-500/10 hover:fill-cyan-500/20 stroke-cyan-500/20'
                  }`}
                  onClick={() => setSelectedPhase('recovery')}
                />

                {/* 2. Quadrant Expansion (90° -> 180°) -> DETECTED ACTIVE */}
                <path
                  d="M 200 200 L 200 360 A 160 160 0 0 1 40 200 Z"
                  className={`cursor-pointer transition-all duration-300 ${
                    selectedPhase === 'expansion'
                      ? 'fill-emerald-500/40 stroke-emerald-400 stroke-2 filter drop-shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                      : 'fill-emerald-500/15 hover:fill-emerald-500/25 stroke-emerald-500/30'
                  }`}
                  onClick={() => setSelectedPhase('expansion')}
                />

                {/* 3. Quadrant Late-Cycle (180° -> 270°) */}
                <path
                  d="M 200 200 L 40 200 A 160 160 0 0 1 200 40 Z"
                  className={`cursor-pointer transition-all duration-300 ${
                    selectedPhase === 'late'
                      ? 'fill-amber-500/35 stroke-amber-400 stroke-2 filter drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                      : 'fill-amber-500/10 hover:fill-amber-500/20 stroke-amber-500/20'
                  }`}
                  onClick={() => setSelectedPhase('late')}
                />

                {/* 4. Quadrant Recession (270° -> 360°) */}
                <path
                  d="M 200 200 L 200 40 A 160 160 0 0 1 360 200 Z"
                  className={`cursor-pointer transition-all duration-300 ${
                    selectedPhase === 'recession'
                      ? 'fill-rose-500/35 stroke-rose-400 stroke-2 filter drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                      : 'fill-rose-500/10 hover:fill-rose-500/20 stroke-rose-500/20'
                  }`}
                  onClick={() => setSelectedPhase('recession')}
                />

                {/* Inner Core Center */}
                <circle cx="200" cy="200" r="76" fill="#09090b" stroke="#27272a" strokeWidth="3" />

                {/* Dynamic Indicator Needle aimed at active phase (135° for Expansion) */}
                <g
                  className="transition-transform duration-1000 ease-out"
                  style={{
                    transformOrigin: '200px 200px',
                    transform: `rotate(${CYCLE_PHASES[detectedActivePhaseKey].needleAngle}deg)`,
                  }}
                >
                  <line x1="200" y1="200" x2="330" y2="200" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="330" cy="200" r="8" fill="#10b981" className="animate-pulse" />
                  <circle cx="200" cy="200" r="14" fill="#10b981" />
                  <circle cx="200" cy="200" r="6" fill="#09090b" />
                </g>
              </svg>

              {/* Center Core HUD Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
                <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase">CHU KỲ KINH TẾ</span>
                <span className="text-xs font-mono font-black text-emerald-400 uppercase mt-0.5">
                  {detectedCfg.title}
                </span>
                <span className="text-[9px] font-mono text-zinc-500 mt-0.5">Score: {phaseScores[detectedActivePhaseKey].score}</span>
              </div>
            </div>

            {/* Phase Selector Tabs with Quantitative Scores */}
            <div className="grid grid-cols-2 gap-2 w-full mt-4">
              {(Object.keys(CYCLE_PHASES) as CyclePhaseKey[]).map((phaseKey) => {
                const p = CYCLE_PHASES[phaseKey];
                const isSelected = selectedPhase === phaseKey;
                const isDetected = phaseKey === detectedActivePhaseKey;
                const pScore = phaseScores[phaseKey].score;

                return (
                  <button
                    key={phaseKey}
                    onClick={() => setSelectedPhase(phaseKey)}
                    className={`px-3 py-2.5 rounded-xl text-left font-mono transition-all border ${
                      isSelected
                        ? `${p.bgLight} ${p.borderLight} text-zinc-100 shadow-lg`
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold block" style={{ color: isSelected ? p.color : undefined }}>
                        {p.title}
                      </span>
                      {isDetected && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Pha dẫn dắt theo dữ liệu thật" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-zinc-500 block truncate">{p.subTitle}</span>
                      <span className="text-[9px] font-mono font-bold text-zinc-400">{pScore} pts</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Detailed Research Card & Phase Strategy (7 Cols) ──────────── */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedPhase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`p-5 rounded-2xl border ${activeCfg.bgLight} ${activeCfg.borderLight} backdrop-blur-md shadow-xl`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-zinc-800/80 mb-3.5 gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                      PHÂN TÍCH CHUYÊN SÂU PHA {selectedPhase === detectedActivePhaseKey ? '(HIỆN TẠI DẪN DẮT)' : ''}
                    </span>
                    <h3 className="text-lg font-mono font-bold" style={{ color: activeCfg.color }}>
                      {activeCfg.title} — {activeCfg.subTitle}
                    </h3>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border bg-zinc-900/90 shrink-0 self-start sm:self-auto" style={{ borderColor: activeCfg.color, color: activeCfg.color }}>
                    {activeCfg.macroStatus}
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                  {activeCfg.description}
                </p>

                {/* 3 Macro Pillars Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 mb-4 text-[11px] font-mono">
                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold">1. Tăng Trưởng GDP:</span>
                    <span className="text-zinc-200 font-bold">{activeCfg.growthStatus}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold">2. Lạm Phát (CPI):</span>
                    <span className="text-zinc-200 font-bold">{activeCfg.inflationStatus}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold">3. Lãi Suất Điều Hành:</span>
                    <span className="text-zinc-200 font-bold">{activeCfg.interestRateStatus}</span>
                  </div>
                </div>

                {/* Sector Rotation Targets in this Phase */}
                <div className="mb-4">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block mb-2">
                    CÁC NHÓM NGÀNH HƯỞNG LỢI TRỌNG TÂM (CLICK ĐỂ LỌC TRÊN SCREENER):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeCfg.primarySectors.map((sec) => {
                      const matchStat = sectorLiveStats.find(
                        (s) => s.sector.toLowerCase().includes(sec.toLowerCase()) || sec.toLowerCase().includes(s.sector.toLowerCase())
                      );
                      const rsScore = matchStat?.avgRs || 75;
                      const stage2Count = matchStat?.stage2Count || 0;

                      return (
                        <button
                          key={sec}
                          onClick={() => onSelectSector && onSelectSector(sec)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-700/60 hover:border-emerald-500/60 hover:bg-zinc-800 transition-all text-xs font-mono group cursor-pointer"
                          title="Bấm để lọc mã ngành này trên bảng Screener"
                        >
                          <span className="text-zinc-200 group-hover:text-emerald-400 font-semibold">{sec}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-cyan-400">
                            RS {rsScore}
                          </span>
                          {stage2Count > 0 && (
                            <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400">
                              {stage2Count} Stage 2
                            </span>
                          )}
                          <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Minervini & Fidelity Playbook */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span>MARK MINERVINI PLAYBOOK:</span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      {activeCfg.minerviniStrategy}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1">
                      <Scales className="w-3.5 h-3.5" />
                      <span>PHÂN BỔ TÀI SẢN (FIDELITY):</span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      {activeCfg.fidelityAssetAlloc}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Top 5 RS Leader Sectors Ranking */}
            <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
                <div className="flex items-center gap-2">
                  <ChartLineUp className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-mono font-bold text-zinc-200 uppercase">
                    BẢNG XẾP HẠNG SỨC MẠNH NGÀNH THỰC TẾ (LIVE RS RANKING TỪ SCREENER)
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  Top 5 Ngành Dẫn Sóng
                </span>
              </div>

              <div className="space-y-2.5">
                {topLeadingSectors.map((sec, idx) => {
                  const isTop1 = idx === 0;
                  return (
                    <div
                      key={sec.sector}
                      onClick={() => onSelectSector && onSelectSector(sec.sector)}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] ${
                          isTop1 ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-xs font-mono font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                            {sec.sector}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                            {sec.count} mã theo dõi • {sec.stage2Count} mã Stage 2 ({sec.stage2Pct}%)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 font-mono">
                        <div className="text-right">
                          <span className="text-xs font-bold text-cyan-400 block">
                            RS {sec.avgRs}
                          </span>
                          <span className={`text-[10px] ${sec.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {sec.avgChange >= 0 ? '+' : ''}{sec.avgChange}%
                          </span>
                        </div>
                        <div className="hidden sm:flex items-center gap-1">
                          {sec.topLeaders.map((lead) => (
                            <span key={lead} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold border border-zinc-700/50">
                              {lead}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
