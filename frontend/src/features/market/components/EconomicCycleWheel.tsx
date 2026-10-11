'use client';

import React, { useState, useMemo } from 'react';
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
  angleRange: [number, number]; // degrees for wheel representation
  macroStatus: string;
  primarySectors: string[];
  description: string;
  keyDrivers: string[];
  minerviniStrategy: string;
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
    angleRange: [0, 90],
    macroStatus: 'Lãi suất chạm đáy, nới lỏng tiền tệ, tín dụng hồi phục',
    primarySectors: ['Ngân hàng', 'Dịch vụ tài chính', 'Bất động sản', 'Phân phối, bán lẻ', 'Ô tô, linh kiện'],
    description: 'Chính sách tiền tệ hỗ trợ dòng vốn rẻ, định giá P/E & P/B bắt đầu hồi phục từ đáy sâu. Nhóm tài chính & bất động sản dẫn dắt nhịp hồi đầu tiên.',
    keyDrivers: ['Hạ lãi suất điều hành', 'Tín dụng mở rộng', 'Tâm lý thị trường đảo chiều tích cực'],
    minerviniStrategy: 'Tìm các mã tạo đáy đôi (Double Bottom) hoặc thoát đáy sâu với khối lượng mua đột biến (Pocket Pivot).',
  },
  expansion: {
    key: 'expansion',
    title: 'TĂNG TRƯỞNG MỞ RỘNG',
    subTitle: 'Mid-Cycle Boom (Pha Hiện Tại)',
    color: '#10b981', // Emerald
    glowColor: 'rgba(16, 185, 129, 0.45)',
    bgLight: 'bg-emerald-500/10',
    borderLight: 'border-emerald-500/30',
    angleRange: [90, 180],
    macroStatus: 'GDP tăng tốc, FDI & xuất khẩu bùng nổ, doanh thu DN lập kỷ lục',
    primarySectors: ['Phần mềm', 'Hàng hóa công nghiệp', 'Nguyên vật liệu', 'Vận tải', 'Viễn thông'],
    description: 'Pha mạnh nhất và kéo dài nhất của chu kỳ kinh tế. Các doanh nghiệp đầu ngành tăng trưởng EPS & doanh thu vượt trội, liên tục bứt phá đỉnh 52 tuần.',
    keyDrivers: ['Tăng trưởng GDP vượt kỳ vọng', 'Xuất nhập khẩu thặng dư cao', 'Đầu tư công & FDI giải ngân mạnh mẽ'],
    minerviniStrategy: 'Tập trung 100% tỷ trọng vào các Siêu Cổ Phiếu Giai Đoạn 2 (Stage 2) có RS Rating >= 80, mô hình nền giá VCP (Volatility Contraction Pattern) siết chặt.',
  },
  late: {
    key: 'late',
    title: 'CUỐI CHU KỲ / ĐẠT ĐỈNH',
    subTitle: 'Late-Cycle Peak',
    color: '#f59e0b', // Amber
    glowColor: 'rgba(245, 158, 11, 0.4)',
    bgLight: 'bg-amber-500/10',
    borderLight: 'border-amber-500/30',
    angleRange: [180, 270],
    macroStatus: 'Lạm phát tăng, công suất tối đa, áp lực thắt chặt tiền tệ',
    primarySectors: ['Năng lượng', 'Nguyên vật liệu', 'Hóa chất'],
    description: 'Chi phí đầu vào và lạm phát tăng cao. Dòng tiền dịch chuyển sang các tài sản vật chất và năng lượng để phòng ngừa mất giá tiền tệ.',
    keyDrivers: ['Giá dầu & hàng hóa lập đỉnh', 'Lạm phát chạm ngưỡng cảnh báo', 'Tăng trưởng kinh tế bắt đầu hạ nhiệt'],
    minerviniStrategy: 'Thắt chặt lệnh dừng lỗ (Stop-loss), chốt lời từng phần khi cổ phiếu xuất hiện Climax Top (đỉnh cao trào).',
  },
  recession: {
    key: 'recession',
    title: 'SUY THOÁI / PHÒNG THỦ',
    subTitle: 'Contraction & Downturn',
    color: '#f43f5e', // Rose
    glowColor: 'rgba(244, 63, 94, 0.4)',
    bgLight: 'bg-rose-500/10',
    borderLight: 'border-rose-500/30',
    angleRange: [270, 360],
    macroStatus: 'Kinh tế suy giảm, lợi nhuận DN suy yếu, dòng tiền phòng thủ',
    primarySectors: ['Tiện ích', 'Dược phẩm', 'Thực phẩm, đồ uống', 'Bảo hiểm'],
    description: 'Tăng trưởng chậm lại, dòng tiền tìm đến các doanh nghiệp trả cổ tức tiền mặt cao, dòng tiền kinh doanh ổn định không phụ thuộc chu kỳ.',
    keyDrivers: ['Lợi nhuận DN toàn thị trường sụt giảm', 'Thắt chặt chi tiêu tiêu dùng', 'Ưu tiên dòng tiền mặt an toàn'],
    minerviniStrategy: 'Nâng tỷ trọng tiền mặt, kiên nhẫn đứng ngoài quan sát hoặc chỉ giao dịch phòng thủ, kiên quyết cắt lỗ nhanh nếu vi phạm 7-8%.',
  },
};

// Current calibrated phase for Vietnam Stock Market (Mid-Cycle Expansion)
export const CURRENT_PHASE_KEY: CyclePhaseKey = 'expansion';

interface EconomicCycleWheelProps {
  items: MinerviniScreenerItem[];
  onSelectSector?: (sector: string) => void;
}

export const EconomicCycleWheel: React.FC<EconomicCycleWheelProps> = ({
  items,
  onSelectSector,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<CyclePhaseKey>(CURRENT_PHASE_KEY);

  // Compute live RS stats per sector based on scanned items
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

    items.forEach((item) => {
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

  // Phase-specific summary
  const currentPhaseCfg = CYCLE_PHASES[CURRENT_PHASE_KEY];
  const activeCfg = CYCLE_PHASES[selectedPhase];

  // Top 5 Leading Sectors by RS Rating
  const topLeadingSectors = sectorLiveStats.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Current Position Overview */}
      <div className="p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">
                Mô Hình Luân Chuyển Ngành & Chu Kỳ Kinh Tế (Sector Rotation Clock)
              </span>
            </div>
            <h2 className="text-2xl font-mono font-bold text-zinc-100 tracking-tight">
              Vòng Tròn Chu Kỳ Kinh Tế & Phân Tích Sức Mạnh Ngành (RS)
            </h2>
            <p className="text-xs text-zinc-400 max-w-2xl mt-1">
              Định vị pha tăng trưởng của nền kinh tế dựa trên lý thuyết Merrill Lynch Investment Clock kết hợp phương pháp Trend Template của Mark Minervini để tìm nhóm ngành dẫn dắt dòng tiền.
            </p>
          </div>

          {/* Current Cycle Pill Badge */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900/90 border border-emerald-500/30 shadow-lg shrink-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400 block font-semibold">
                ĐỊNH VỊ CHU KỲ HIỆN TẠI
              </span>
              <span className="text-sm font-mono font-black text-emerald-400 block">
                {currentPhaseCfg.title}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 block">
                {currentPhaseCfg.subTitle}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Interactive SVG Cycle Wheel & Phase Dial */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-center">
          {/* Wheel Graphic Container (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-[320px] h-[320px] sm:w-[360px] sm:h-[360px] flex items-center justify-center">
              {/* Outer decorative ring */}
              <div className="absolute inset-0 rounded-full border border-dashed border-zinc-800 animate-[spin_60s_linear_infinite]" />
              <div className="absolute inset-4 rounded-full border border-zinc-800/80" />

              {/* Central Clock SVG */}
              <svg viewBox="0 0 400 400" className="w-full h-full transform -rotate-90">
                {/* 4 Quadrants (Arcs) */}
                {/* Quadrant 1: Recovery (Top-Right / 0 to 90 deg) */}
                <path
                  d="M 200 200 L 360 200 A 160 160 0 0 1 200 360 Z"
                  className={`cursor-pointer transition-all duration-300 ${
                    selectedPhase === 'recovery'
                      ? 'fill-cyan-500/30 stroke-cyan-400 stroke-2'
                      : 'fill-cyan-500/10 hover:fill-cyan-500/20 stroke-cyan-500/20'
                  }`}
                  onClick={() => setSelectedPhase('recovery')}
                />

                {/* Quadrant 2: Expansion (Bottom-Right / 90 to 180 deg) -> CURRENT */}
                <path
                  d="M 200 200 L 200 360 A 160 160 0 0 1 40 200 Z"
                  className={`cursor-pointer transition-all duration-300 ${
                    selectedPhase === 'expansion'
                      ? 'fill-emerald-500/35 stroke-emerald-400 stroke-2 filter drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : 'fill-emerald-500/15 hover:fill-emerald-500/25 stroke-emerald-500/30'
                  }`}
                  onClick={() => setSelectedPhase('expansion')}
                />

                {/* Quadrant 3: Late Cycle (Bottom-Left / 180 to 270 deg) */}
                <path
                  d="M 200 200 L 40 200 A 160 160 0 0 1 200 40 Z"
                  className={`cursor-pointer transition-all duration-300 ${
                    selectedPhase === 'late'
                      ? 'fill-amber-500/30 stroke-amber-400 stroke-2'
                      : 'fill-amber-500/10 hover:fill-amber-500/20 stroke-amber-500/20'
                  }`}
                  onClick={() => setSelectedPhase('late')}
                />

                {/* Quadrant 4: Recession (Top-Left / 270 to 360 deg) */}
                <path
                  d="M 200 200 L 200 40 A 160 160 0 0 1 360 200 Z"
                  className={`cursor-pointer transition-all duration-300 ${
                    selectedPhase === 'recession'
                      ? 'fill-rose-500/30 stroke-rose-400 stroke-2'
                      : 'fill-rose-500/10 hover:fill-rose-500/20 stroke-rose-500/20'
                  }`}
                  onClick={() => setSelectedPhase('recession')}
                />

                {/* Center Core Circle */}
                <circle cx="200" cy="200" r="75" fill="#09090b" stroke="#27272a" strokeWidth="3" />

                {/* Current Needle pointer aimed at Mid-Cycle Expansion (approx 135 deg) */}
                <g className="transition-transform duration-700 ease-out" style={{ transformOrigin: '200px 200px', transform: 'rotate(135deg)' }}>
                  <line x1="200" y1="200" x2="330" y2="200" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="330" cy="200" r="8" fill="#10b981" className="animate-pulse" />
                  <circle cx="200" cy="200" r="14" fill="#10b981" />
                  <circle cx="200" cy="200" r="6" fill="#09090b" />
                </g>
              </svg>

              {/* Center Hub Overlay Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
                <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase">CHU KỲ KINH TẾ</span>
                <span className="text-xs font-mono font-black text-emerald-400 uppercase mt-0.5">
                  TĂNG TRƯỞNG
                </span>
                <span className="text-[9px] font-mono text-zinc-500 mt-1">Mid-Cycle</span>
              </div>
            </div>

            {/* Quick interactive phase switchers */}
            <div className="grid grid-cols-2 gap-2 w-full mt-4">
              {(Object.keys(CYCLE_PHASES) as CyclePhaseKey[]).map((phaseKey) => {
                const p = CYCLE_PHASES[phaseKey];
                const isSelected = selectedPhase === phaseKey;
                const isCurrent = phaseKey === CURRENT_PHASE_KEY;

                return (
                  <button
                    key={phaseKey}
                    onClick={() => setSelectedPhase(phaseKey)}
                    className={`px-3 py-2 rounded-xl text-left font-mono transition-all border ${
                      isSelected
                        ? `${p.bgLight} ${p.borderLight} text-zinc-100 shadow-md`
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold block" style={{ color: isSelected ? p.color : undefined }}>
                        {p.title}
                      </span>
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" title="Vị trí hiện tại" />
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-500 block truncate">{p.subTitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Phase Analysis & Sector Rotation Breakdown (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedPhase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`p-5 rounded-2xl border ${activeCfg.bgLight} ${activeCfg.borderLight} backdrop-blur-md`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                      CHI TIẾT PHA ĐANG XEM {selectedPhase === CURRENT_PHASE_KEY ? '(HIỆN TẠI)' : ''}
                    </span>
                    <h3 className="text-lg font-mono font-bold" style={{ color: activeCfg.color }}>
                      {activeCfg.title} — {activeCfg.subTitle}
                    </h3>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border bg-zinc-900/80" style={{ borderColor: activeCfg.color, color: activeCfg.color }}>
                    {activeCfg.macroStatus}
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                  {activeCfg.description}
                </p>

                {/* Primary Sectors in this Phase */}
                <div className="mb-4">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block mb-2">
                    CÁC NHÓM NGÀNH HƯỞNG LỢI TRỌNG TÂM:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeCfg.primarySectors.map((sec) => {
                      const matchStat = sectorLiveStats.find((s) => s.sector.toLowerCase().includes(sec.toLowerCase()) || sec.toLowerCase().includes(s.sector.toLowerCase()));
                      const rsScore = matchStat?.avgRs || 75;
                      const stage2Count = matchStat?.stage2Count || 0;

                      return (
                        <button
                          key={sec}
                          onClick={() => onSelectSector && onSelectSector(sec)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-700/60 hover:border-emerald-500/60 hover:bg-zinc-800 transition-all text-xs font-mono group"
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

                {/* Minervini Strategy Playbook */}
                <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs font-mono">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                    <Flame className="w-4 h-4" />
                    <span>CHIẾN LƯỢC MARK MINERVINI KHUYẾN NGHỊ:</span>
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    {activeCfg.minerviniStrategy}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Top RS Leading Sectors Today */}
            <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
                <div className="flex items-center gap-2">
                  <ChartLineUp className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-mono font-bold text-zinc-200 uppercase">
                    BẢNG XẾP HẠNG SỨC MẠNH NGÀNH THỰC TẾ (LIVE RS RANKING)
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
                        <div className="flex items-center gap-1">
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
