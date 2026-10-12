'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  TrendUp,
  TrendDown,
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
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { MinerviniScreenerItem } from '../types/minervini.types';
import { SECTOR_MAPPING } from '../data/sectorMapping';

export type CyclePhaseKey = 'recovery' | 'expansion' | 'late' | 'recession';

export interface AssetPriorityItem {
  asset: string;
  rank: number;
  weight: string;
  weightPct: number; // Tỷ trọng phần trăm đại diện cho biểu đồ (0-100)
  status: 'overweight' | 'neutral' | 'underweight';
  desc: string;
}

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
  primarySectors: string[]; // Các nhóm ngành hưởng lợi trọng tâm (Dẫn sóng)
  unfavorableSectors: string[]; // Các nhóm ngành bất lợi / nên tránh (Tụ hậu)
  unfavorableReason: string; // Lý do chịu áp lực / thoái trào
  description: string;
  keyDrivers: string[];
  minerviniStrategy: string;
  fidelityAssetAlloc: string;
  topPriorityAsset: string; // Tài sản ưu tiên hàng đầu nên nắm giữ
  priorityAssets: AssetPriorityItem[]; // Thứ tự ưu tiên & tỷ trọng phân bổ
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
    unfavorableSectors: ['Tiện ích', 'Năng lượng', 'Bảo hiểm'],
    unfavorableReason: 'Các ngành phòng thủ có cổ tức cố định bị rút ròng mạnh khi dòng tiền thông minh chuyển dịch sang nhóm beta cao và tăng trưởng nhạy cảm lãi suất rẻ.',
    description: 'Chính sách tiền tệ mở rộng kích hoạt dòng tiền rẻ, định giá P/E & P/B hồi phục mạnh mẽ từ đáy sâu. Nhóm Tài chính (Bank/Chứng khoán) và Tiêu dùng nhạy cảm lãi suất dẫn dắt nhịp sóng đầu tiên.',
    keyDrivers: ['Hạ lãi suất điều hành & kích cầu tín dụng', 'Thị trường chứng khoán phục hồi thanh khoản', 'Niềm tin tiêu dùng & đơn hàng phục hồi'],
    minerviniStrategy: 'Tìm kiếm cổ phiếu tạo đáy kép (Double Bottom) hoặc thoát nền tích luỹ đầu tiên với điểm mua Pocket Pivot và khối lượng đột biến.',
    fidelityAssetAlloc: 'Cổ phiếu (Equities) vượt trội hoàn toàn so với Tiền mặt & Trái phiếu.',
    topPriorityAsset: 'Cổ Phiếu (Equities) — Nhóm Tài Chính, Bất Động Sản & Bán Lẻ Tiêu Dùng',
    priorityAssets: [
      { asset: 'Cổ phiếu (Equities)', rank: 1, weight: '65% - 75%', weightPct: 70, status: 'overweight', desc: 'Vượt trội tuyệt đối khi định giá rẻ và lãi suất chạm đáy kích hoạt dòng tiền rẻ bùng nổ' },
      { asset: 'Bất động sản / REITs', rank: 2, weight: '15% - 20%', weightPct: 18, status: 'overweight', desc: 'Hưởng lợi tức thì từ chính sách hạ lãi suất vay và thanh khoản thị trường phục hồi' },
      { asset: 'Trái phiếu (Bonds)', rank: 3, weight: '10% - 15%', weightPct: 12, status: 'neutral', desc: 'Lợi suất giảm (giá trái phiếu tăng) nhưng hiệu suất sinh lời kém hấp dẫn hơn cổ phiếu' },
      { asset: 'Tiền mặt & Hàng hóa', rank: 4, weight: '5% - 10%', weightPct: 7, status: 'underweight', desc: 'Hạ tiền mặt tối thiểu; chi phí cơ hội rất cao khi giữ tiền mặt trong pha phục hồi' },
    ],
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
    unfavorableSectors: ['Tiện ích', 'Dược phẩm', 'Thực phẩm, đồ uống'],
    unfavorableReason: 'Tụ hậu sâu so với tốc độ bứt phá của thị trường; dòng tiền đầu cơ và dòng vốn tổ chức tập trung toàn lực vào nhóm sản xuất và công nghệ bứt phá.',
    description: 'Pha mạnh nhất và kéo dài nhất của chu kỳ kinh tế theo mô hình Merrill Lynch & Fidelity. Lợi nhuận EPS và doanh thu doanh nghiệp bứt phá ngoạn mục. Dòng tiền cuộn sóng vào các ngành công nghệ, sản xuất, xuất khẩu và logistic.',
    keyDrivers: ['GDP tăng trưởng 7-8% vượt kế hoạch', 'Xuất siêu kỷ lục, chuỗi cung ứng mở rộng', 'Đầu tư công và dòng vốn FDI giải ngân tăng tốc'],
    minerviniStrategy: 'Tập trung 100% danh mục vào Siêu Cổ Phiếu Giai Đoạn 2 (Stage 2 Uptrend) có RS Rating >= 80, bứt phá mô hình VCP (Thu hẹp độ biến động) và Pivot Point.',
    fidelityAssetAlloc: 'Tập trung cổ phiếu tăng trưởng (Growth Stocks), tỷ trọng cổ phiếu tối đa.',
    topPriorityAsset: 'Cổ Phiếu Tăng Trưởng (Growth Equities) — Công Nghệ, Bán Dẫn & Sản Xuất Công Nghiệp',
    priorityAssets: [
      { asset: 'Cổ phiếu Tăng trưởng', rank: 1, weight: '70% - 85%', weightPct: 75, status: 'overweight', desc: 'Tập trung tối đa vào siêu cổ phiếu Stage 2 có tốc độ tăng trưởng EPS và doanh thu bứt phá' },
      { asset: 'Hàng hóa / Nguyên liệu', rank: 2, weight: '10% - 15%', weightPct: 15, status: 'overweight', desc: 'Nhu cầu sản xuất và tiêu thụ toàn cầu bùng nổ kéo theo đà tăng giá nguyên vật liệu' },
      { asset: 'Tiền mặt (Cash)', rank: 3, weight: '5% - 10%', weightPct: 8, status: 'underweight', desc: 'Duy trì tiền mặt mức tối thiểu để sẵn sàng gia tăng tỷ trọng tại các điểm Pivot mới' },
      { asset: 'Trái phiếu (Bonds)', rank: 4, weight: '0% - 5%', weightPct: 2, status: 'underweight', desc: 'Hiệu suất sinh lời kém nhất chu kỳ; chịu áp lực khi nền kinh tế tăng trưởng nóng' },
    ],
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
    unfavorableSectors: ['Bất động sản', 'Dịch vụ tài chính', 'Phân phối, bán lẻ'],
    unfavorableReason: 'Lạm phát leo thang và lãi suất điều hành bị thắt chặt làm chi phí vốn tăng vọt, biên lợi nhuận bị ép nghẹt và sức mua của người tiêu dùng suy kiệt.',
    description: 'Nền kinh tế có dấu hiệu quá nhiệt, chi phí nguyên liệu và nhân công tăng đẩy lạm phát lên cao. Lợi nhuận doanh nghiệp bắt đầu bị bào mòn bởi chi phí vốn. Dòng tiền xoay tua tìm đến hàng hóa cơ bản, năng lượng và dầu khí.',
    keyDrivers: ['Giá dầu thô & hàng hóa neo cao', 'Lạm phát tiệm cận ngưỡng cảnh báo', 'Chính sách tiền tệ chuyển sang kiểm soát rủi ro'],
    minerviniStrategy: 'Thắt chặt chặn lãi (Trailing stop), chốt lời từng phần khi xuất hiện Climax Top (đỉnh cao trào khối lượng lớn mà giá không tăng thêm), không mua mới nến mở rộng.',
    fidelityAssetAlloc: 'Hàng hóa (Commodities) & Nhóm Năng lượng; hạ tỷ trọng cổ phiếu nói chung.',
    topPriorityAsset: 'Hàng Hóa (Commodities / Dầu Khí) & Tiền Mặt Phòng Thủ (Cash / USD)',
    priorityAssets: [
      { asset: 'Hàng hóa & Năng lượng', rank: 1, weight: '35% - 45%', weightPct: 40, status: 'overweight', desc: 'Hưởng lợi đỉnh cao từ lạm phát, khủng hoảng nguồn cung dầu thô và nguyên liệu cơ bản' },
      { asset: 'Tiền mặt & Tiết kiệm', rank: 2, weight: '30% - 40%', weightPct: 35, status: 'overweight', desc: 'Tăng mạnh tiền mặt hưởng lãi suất cao và chuẩn bị thanh khoản gom tài sản chiết khấu' },
      { asset: 'Vàng & Kim loại quý', rank: 3, weight: '15% - 20%', weightPct: 15, status: 'overweight', desc: 'Hàng rào phòng hộ hữu hiệu trước áp lực lạm phát và nguy cơ đảo chiều thị trường' },
      { asset: 'Cổ phiếu (Equities)', rank: 4, weight: '10% - 15%', weightPct: 10, status: 'underweight', desc: 'Hạ tỷ trọng mạnh mẽ; chỉ giữ nhóm năng lượng/vật liệu và chốt lời theo Climax Top' },
    ],
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
    unfavorableSectors: ['Bất động sản', 'Dịch vụ tài chính', 'Hàng hóa công nghiệp', 'Phần mềm'],
    unfavorableReason: 'Áp lực nợ xấu và khủng hoảng thanh khoản diện rộng; định giá P/E bị nén hạ (de-rating), doanh thu và lợi nhuận sụt giảm theo đà suy giảm của nền kinh tế.',
    description: 'Doanh nghiệp gặp khó khăn dòng tiền, người tiêu dùng thắt chặt hầu bao. Nhà đầu tư tìm kiếm sự an toàn tại các doanh nghiệp có dòng tiền đều đặn, cổ tức tiền mặt cao, không phụ thuộc chu kỳ kinh tế.',
    keyDrivers: ['Doanh thu bán lẻ & xuất khẩu sụt giảm', 'Tỷ lệ nợ xấu ngân hàng gia tăng', 'Dòng tiền rút về tài sản phòng thủ'],
    minerviniStrategy: 'Quy tắc vàng số 1: Giữ 70-100% tiền mặt, tuyệt đối kiên nhẫn đứng ngoài thị trường giá xuống (Bear Market), kiên quyết cắt lỗ 7-8% không nhân nhượng.',
    fidelityAssetAlloc: 'Trái phiếu (Bonds) & Tiền mặt (Cash); chỉ giữ cổ phiếu phòng thủ thiết yếu.',
    topPriorityAsset: 'Tiền Mặt (Cash is King) & Trái Phiếu Chính Phủ / Cổ Phiếu Cổ Tức Bền Vững',
    priorityAssets: [
      { asset: 'Tiền mặt (Cash / USD)', rank: 1, weight: '60% - 75%', weightPct: 65, status: 'overweight', desc: 'Bảo toàn vốn tuyệt đối; "Tiền mặt là vua" trong thị trường gấu (Bear market khốc liệt)' },
      { asset: 'Trái phiếu chính phủ', rank: 2, weight: '20% - 25%', weightPct: 20, status: 'overweight', desc: 'Hưởng lợi lớn khi ngân hàng trung ương cắt giảm lãi suất khẩn cấp để kích cầu' },
      { asset: 'Vàng trú ẩn an toàn', rank: 3, weight: '10% - 15%', weightPct: 10, status: 'neutral', desc: 'Kênh phòng thủ bảo toàn sức mua trước rủi ro nợ xấu gia tăng và biến động vĩ mô' },
      { asset: 'Cổ phiếu phòng thủ', rank: 4, weight: '0% - 10%', weightPct: 5, status: 'underweight', desc: 'Chỉ nắm giữ nhóm tiện ích/dược phẩm thiết yếu có cổ tức tiền mặt vững chắc và beta thấp' },
    ],
  },
};

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: Math.round((centerX + radius * Math.cos(angleInRadians)) * 10) / 10,
    y: Math.round((centerY + radius * Math.sin(angleInRadians)) * 10) / 10,
  };
}

function describeDonutSegment(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
) {
  const startOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return `M ${startOuter.x} ${startOuter.y} A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y} L ${startInner.x} ${startInner.y} A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${endInner.x} ${endInner.y} Z`;
}

interface QuadrantConfig {
  key: CyclePhaseKey;
  startAngle: number;
  endAngle: number;
  labelAngle: number;
  shortTitle: string;
  sub: string;
}

const QUADRANTS: QuadrantConfig[] = [
  { key: 'recovery', startAngle: 2, endAngle: 88, labelAngle: 45, shortTitle: 'PHỤC HỒI SỚM', sub: 'Early-Cycle' },
  { key: 'expansion', startAngle: 92, endAngle: 178, labelAngle: 135, shortTitle: 'TĂNG TRƯỞNG', sub: 'Mid-Cycle' },
  { key: 'late', startAngle: 182, endAngle: 268, labelAngle: 225, shortTitle: 'CUỐI CHU KỲ', sub: 'Late-Cycle' },
  { key: 'recession', startAngle: 272, endAngle: 358, labelAngle: 315, shortTitle: 'SUY THOÁI', sub: 'Contraction' },
];

interface EconomicCycleWheelProps {
  items?: MinerviniScreenerItem[];
  onSelectSector?: (sector: string) => void;
}

export const EconomicCycleWheel: React.FC<EconomicCycleWheelProps> = ({
  items,
  onSelectSector,
}) => {
  const [hoveredPhase, setHoveredPhase] = useState<CyclePhaseKey | null>(null);
  const [pinnedPhase, setPinnedPhase] = useState<CyclePhaseKey | null>(null);
  const [activeResearchTab, setActiveResearchTab] = useState<'matrix' | 'macro' | 'methodology'>('matrix');
  const [internalItems, setInternalItems] = useState<MinerviniScreenerItem[]>(items || []);
  const [isLoading, setIsLoading] = useState<boolean>(!items || items.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);

  const fetchScreenerData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const res = await fetch('/api/market/minervini/screener?stage2=false&minRS=1');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInternalItems(data.data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching screener items for cycle wheel:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    setLastUpdated(new Date());

    if (items && items.length > 0) {
      setInternalItems(items);
      setIsLoading(false);
    } else {
      fetchScreenerData(false);
    }

    // Auto-update polling interval (Realtime every 30 seconds)
    const interval = setInterval(() => {
      fetchScreenerData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [items, fetchScreenerData]);

  // 1. Live Quantitative Sector RS & Stage 2 Computation (from real screener data)
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
      const sec = item.sector || SECTOR_MAPPING[item.symbol] || 'Khác';
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
  }, [internalItems]);

  // 2. Quantitative Cycle Phase Momentum Scoring
  // Evaluates which phase has the highest actual RS & Stage 2 concentration
  const phaseScores = useMemo(() => {
    const scores: Record<
      CyclePhaseKey,
      {
        totalRs: number;
        totalStage2: number;
        count: number;
        avgRs: number;
        stage2Ratio: number;
        score: number;
      }
    > = {
      recovery: { totalRs: 0, totalStage2: 0, count: 0, avgRs: 0, stage2Ratio: 0, score: 0 },
      expansion: { totalRs: 0, totalStage2: 0, count: 0, avgRs: 0, stage2Ratio: 0, score: 0 },
      late: { totalRs: 0, totalStage2: 0, count: 0, avgRs: 0, stage2Ratio: 0, score: 0 },
      recession: { totalRs: 0, totalStage2: 0, count: 0, avgRs: 0, stage2Ratio: 0, score: 0 },
    };

    (Object.keys(CYCLE_PHASES) as CyclePhaseKey[]).forEach((pKey) => {
      const cfg = CYCLE_PHASES[pKey];
      cfg.primarySectors.forEach((secName) => {
        const found = sectorLiveStats.find(
          (s) =>
            s.sector.toLowerCase().includes(secName.toLowerCase()) ||
            secName.toLowerCase().includes(s.sector.toLowerCase())
        );
        if (found) {
          scores[pKey].totalRs += found.avgRs * found.count;
          scores[pKey].totalStage2 += found.stage2Count;
          scores[pKey].count += found.count;
        }
      });

      const avgRs = scores[pKey].count > 0 ? Math.round(scores[pKey].totalRs / scores[pKey].count) : 0;
      const stage2Ratio = scores[pKey].count > 0 ? Math.round((scores[pKey].totalStage2 / scores[pKey].count) * 100) : 0;
      scores[pKey].avgRs = avgRs;
      scores[pKey].stage2Ratio = stage2Ratio;
      // Combined Momentum Score: 60% RS Rating + 40% Stage 2 Breadth Ratio
      scores[pKey].score = Math.round((avgRs * 0.6 + stage2Ratio * 0.4) * 10) / 10;
    });

    return scores;
  }, [sectorLiveStats]);

  // Dynamically detected active phase (highest score)
  const detectedActivePhaseKey = useMemo(() => {
    let topKey: CyclePhaseKey = 'recession';
    let maxScore = -1;
    (Object.keys(phaseScores) as CyclePhaseKey[]).forEach((k) => {
      if (phaseScores[k].score > maxScore) {
        maxScore = phaseScores[k].score;
        topKey = k;
      }
    });
    return topKey;
  }, [phaseScores]);

  const activePhaseKey = hoveredPhase || pinnedPhase || detectedActivePhaseKey;
  const activeCfg = CYCLE_PHASES[activePhaseKey];
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
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              Chu Kỳ Kinh Tế & Sức Mạnh Nhóm Ngành
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Luân chuyển chu kỳ và sức mạnh RS thực tế 20 nhóm ngành
            </p>
          </div>

          {/* Dynamic Macro Phase Detection Badge */}
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs shrink-0">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-400 text-sm tracking-tight">
                  {detectedCfg.title}
                </span>
                <span className="text-zinc-600 font-light select-none">|</span>
                <span className="font-mono text-zinc-300 font-medium">
                  RS {phaseScores[detectedActivePhaseKey].avgRs}
                </span>
                <span className="text-zinc-600 font-light select-none">|</span>
                <span className="text-zinc-400">
                  Stage 2: {phaseScores[detectedActivePhaseKey].stage2Ratio}%
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">{detectedCfg.subTitle}</p>
            </div>

            {pinnedPhase && (
              <button
                onClick={() => setPinnedPhase(null)}
                className="ml-2 px-2 py-1 rounded-lg text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                title="Bỏ ghim và quay về pha thực tế"
              >
                Bỏ ghim
              </button>
            )}
          </div>
        </div>

        {/* ── 2. Interactive Precision Cycle Wheel & Analysis Hub ───────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 items-start">
          {/* Wheel Dial Pedestal (4 Cols - Compact, Fitted & Left-anchored) */}
          <div className="lg:col-span-4 flex flex-col gap-3.5 p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl backdrop-blur-xl lg:sticky lg:top-24">
            {/* Header Hint & Realtime Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800/80 mb-1 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-zinc-200">LA BÀN 4 PHA KINH TẾ</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Realtime (30s)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span suppressHydrationWarning className="text-[10px] font-mono text-zinc-400">
                  {isClient && lastUpdated ? lastUpdated.toLocaleTimeString('vi-VN') : '--:--:--'}
                </span>
                <button
                  onClick={() => fetchScreenerData(true)}
                  disabled={isRefreshing || isLoading}
                  className="p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all cursor-pointer disabled:opacity-50"
                  title="Cập nhật dữ liệu ngay lập tức"
                >
                  <ArrowsClockwise className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Circular Dial Interactive Graphic (Fit dimension, no vertical dead space) */}
            <div className="relative flex items-center justify-center py-1">
              <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] flex items-center justify-center">
                {/* Decorative orbit ring */}
                <div className="absolute inset-0 rounded-full border border-dashed border-zinc-800/80 animate-[spin_100s_linear_infinite] pointer-events-none" />
                <div className="absolute inset-2 rounded-full border border-zinc-800/50 pointer-events-none" />

                {/* SVG Precision Donut Dial */}
                <svg viewBox="0 0 400 400" className="w-full h-full overflow-visible">
                  <defs>
                    <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="rgba(6,182,212,0.6)" />
                    </filter>
                    <filter id="glowEmerald" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="rgba(16,185,129,0.6)" />
                    </filter>
                    <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="rgba(245,158,11,0.6)" />
                    </filter>
                    <filter id="glowRose" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="rgba(244,63,94,0.6)" />
                    </filter>
                  </defs>

                  {/* 4 Precision Donut Quadrants */}
                  {QUADRANTS.map((quad) => {
                    const p = CYCLE_PHASES[quad.key];
                    const isHovered = hoveredPhase === quad.key;
                    const isActive = activePhaseKey === quad.key;
                    const isDetected = detectedActivePhaseKey === quad.key;
                    const dPath = describeDonutSegment(200, 200, 80, 175, quad.startAngle, quad.endAngle);

                    const filterMap: Record<CyclePhaseKey, string> = {
                      recovery: 'url(#glowCyan)',
                      expansion: 'url(#glowEmerald)',
                      late: 'url(#glowAmber)',
                      recession: 'url(#glowRose)',
                    };

                    return (
                      <g
                        key={quad.key}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredPhase(quad.key)}
                        onMouseLeave={() => setHoveredPhase(null)}
                        onClick={() => setPinnedPhase(pinnedPhase === quad.key ? null : quad.key)}
                      >
                        <path
                          d={dPath}
                          fill={p.color}
                          fillOpacity={isActive ? (isHovered ? 0.45 : 0.32) : 0.12}
                          stroke={p.color}
                          strokeWidth={isActive ? (isHovered ? 3 : 2.5) : 1}
                          className="transition-all duration-200"
                          style={{
                            filter: isActive ? filterMap[quad.key] : undefined,
                          }}
                        />

                        {/* Quadrant short text arc preview */}
                        {(() => {
                          const labelPos = polarToCartesian(200, 200, 128, quad.labelAngle);
                          return (
                            <text
                              x={labelPos.x}
                              y={labelPos.y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill={isActive ? p.color : '#a1a1aa'}
                              fontSize={isActive ? '11' : '10'}
                              fontWeight="bold"
                              fontFamily="monospace"
                              className="pointer-events-none select-none transition-all duration-200"
                            >
                              {quad.shortTitle}
                            </text>
                          );
                        })()}
                      </g>
                    );
                  })}

                  {/* Inner Circular Boss Boundary */}
                  <circle cx="200" cy="200" r="78" fill="#09090b" stroke="#27272a" strokeWidth="2.5" />

                  {/* ── FIXED COMPASS NEEDLE (Permanently points to DETECTED MACRO PHASE) ── */}
                  <g
                    className="pointer-events-none transition-transform duration-1000 ease-out"
                    style={{
                      transformOrigin: '200px 200px',
                      transform: `rotate(${CYCLE_PHASES[detectedActivePhaseKey].needleAngle}deg)`,
                    }}
                  >
                    {/* Shadow underneath */}
                    <line x1="200" y1="200" x2="200" y2="40" stroke="rgba(0,0,0,0.7)" strokeWidth="6" strokeLinecap="round" />
                    {/* Main needle shaft */}
                    <line x1="200" y1="200" x2="200" y2="44" stroke={detectedCfg.color} strokeWidth="3.5" strokeLinecap="round" />
                    {/* Arrowhead polygon pointing outward */}
                    <polygon points="193,52 207,52 200,34" fill={detectedCfg.color} />
                    {/* Pulsing focal beacon at tip */}
                    <circle cx="200" cy="38" r="4" fill={detectedCfg.color} className="animate-pulse" />
                    {/* Center brass pivot */}
                    <circle cx="200" cy="200" r="10" fill={detectedCfg.color} />
                    <circle cx="200" cy="200" r="4" fill="#09090b" />
                  </g>
                </svg>

                {/* Center Core HUD Label (Opaque dark glass, zero overlapping lines) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[140px] h-[140px] rounded-full bg-zinc-950/95 border-2 border-zinc-800 shadow-2xl flex flex-col items-center justify-center p-2.5 text-center backdrop-blur-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-[8px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                        PHA THỰC TẾ
                      </span>
                    </div>
                    <span
                      className="text-[11px] font-mono font-black uppercase leading-tight px-1"
                      style={{ color: detectedCfg.color }}
                    >
                      {detectedCfg.title}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-zinc-300 mt-1">
                      RS {phaseScores[detectedActivePhaseKey].avgRs} • {phaseScores[detectedActivePhaseKey].score} pts
                    </span>
                    <span className="text-[8px] font-mono text-emerald-400/90 mt-0.5">
                      (Kim chỉ cố định)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Interactive Phase Pills with Quantitative Scores */}
            <div className="grid grid-cols-2 gap-2 w-full mt-1">
              {QUADRANTS.map((quad) => {
                const p = CYCLE_PHASES[quad.key];
                const isActive = activePhaseKey === quad.key;
                const isDetected = detectedActivePhaseKey === quad.key;
                const isPinned = pinnedPhase === quad.key;
                const pData = phaseScores[quad.key];

                return (
                  <button
                    key={quad.key}
                    onMouseEnter={() => setHoveredPhase(quad.key)}
                    onMouseLeave={() => setHoveredPhase(null)}
                    onClick={() => setPinnedPhase(pinnedPhase === quad.key ? null : quad.key)}
                    className={`px-3 py-2 rounded-xl text-left font-mono transition-all border cursor-pointer ${
                      isActive
                        ? `${p.bgLight} ${p.borderLight} text-zinc-100 shadow-md`
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/90'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold block" style={{ color: isActive ? p.color : undefined }}>
                        {p.title}
                      </span>
                      <div className="flex items-center gap-1">
                        {isPinned && (
                          <span className="text-[8px] px-1 rounded bg-zinc-800 text-zinc-300 font-bold">Ghim</span>
                        )}
                        {isDetected && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Kim chỉ thực tế" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-zinc-500 block truncate">{quad.sub}</span>
                      <span className="text-[9px] font-mono font-bold text-zinc-300">
                        RS {pData.avgRs} • {pData.score} pts
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Detailed Research Card & Phase Strategy (8 Cols - Expanded & Left-fitted) ──────────── */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePhaseKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`p-5 rounded-2xl border ${activeCfg.bgLight} ${activeCfg.borderLight} backdrop-blur-md shadow-xl`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800/80 mb-3 gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        Phân tích chu kỳ
                      </span>
                      <span className="text-zinc-600 font-light select-none">|</span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {hoveredPhase === activePhaseKey
                          ? 'Đang xem trước'
                          : pinnedPhase === activePhaseKey
                          ? 'Đang ghim'
                          : 'Pha dẫn dắt hiện tại'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight" style={{ color: activeCfg.color }}>
                      {activeCfg.title}
                      <span className="text-xs text-zinc-400 font-normal ml-2 tracking-normal">
                        ({activeCfg.subTitle})
                      </span>
                    </h3>
                  </div>
                </div>

                {/* 3 Macro Pillars - Minimal Row */}
                <div className="grid grid-cols-3 gap-3 py-2 px-3 rounded-xl bg-zinc-950/60 border border-zinc-800/70 mb-3.5 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-medium block">GDP</span>
                    <span className="text-zinc-200 font-medium block truncate mt-0.5">{activeCfg.growthStatus}</span>
                  </div>
                  <div className="border-l border-zinc-800/80 pl-3">
                    <span className="text-[10px] text-zinc-500 font-medium block">Lạm phát</span>
                    <span className="text-zinc-200 font-medium block truncate mt-0.5">{activeCfg.inflationStatus}</span>
                  </div>
                  <div className="border-l border-zinc-800/80 pl-3">
                    <span className="text-[10px] text-zinc-500 font-medium block">Lãi suất</span>
                    <span className="text-zinc-200 font-medium block truncate mt-0.5">{activeCfg.interestRateStatus}</span>
                  </div>
                </div>

                {/* ── Symmetrical 2-Column Sector Rotation Matrix (Minimalist Typography & Clean RS) ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3.5">
                  {/* Left Column: Benefited Sectors */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <TrendUp className="w-3.5 h-3.5" weight="bold" />
                        <span>Hưởng lợi (Dẫn sóng)</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-medium">
                        Ưu tiên
                      </span>
                    </div>

                    <div className="space-y-1">
                      {activeCfg.primarySectors.map((sec) => {
                        const matchStat = sectorLiveStats.find(
                          (s) =>
                            s.sector.toLowerCase().includes(sec.toLowerCase()) ||
                            sec.toLowerCase().includes(s.sector.toLowerCase())
                        );
                        const hasData = !!matchStat;
                        const rsScore = matchStat?.avgRs || 45;

                        return (
                          <button
                            key={sec}
                            onClick={() => onSelectSector && onSelectSector(sec)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-900/80 transition-colors text-xs group cursor-pointer"
                          >
                            <span className="text-zinc-300 group-hover:text-emerald-400 font-medium truncate">
                              {sec}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium text-emerald-400">
                                {hasData ? `RS ${rsScore}` : 'RS --'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Unfavorable Sectors */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold">
                        <TrendDown className="w-3.5 h-3.5" weight="bold" />
                        <span>Bất lợi (Tụ hậu)</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        Nên tránh
                      </span>
                    </div>

                    <div className="space-y-1">
                      {activeCfg.unfavorableSectors.map((sec) => {
                        const matchStat = sectorLiveStats.find(
                          (s) =>
                            s.sector.toLowerCase().includes(sec.toLowerCase()) ||
                            sec.toLowerCase().includes(s.sector.toLowerCase())
                        );
                        const hasData = !!matchStat;
                        const rsScore = matchStat?.avgRs || 32;

                        return (
                          <button
                            key={sec}
                            onClick={() => onSelectSector && onSelectSector(sec)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-900/80 transition-colors text-xs group cursor-pointer"
                          >
                            <span className="text-zinc-400 group-hover:text-zinc-200 font-medium truncate">
                              {sec}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium text-zinc-500">
                                {hasData ? `RS ${rsScore}` : 'RS --'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Asset Allocation Strategy & Top Priority Assets (Fidelity & Merrill Lynch Model) ── */}
                <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 text-xs font-mono mb-3 space-y-3.5 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800/80 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                        <Scales className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-100 text-xs block">
                          Phân bổ tài sản khuyến nghị
                        </span>
                        <span className="text-[11px] text-zinc-500 font-sans block">
                          Tối ưu hóa theo chu kỳ kinh tế
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Priority Asset Highlight Banner */}
                  <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 shrink-0 mt-0.5">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                          Tài sản dẫn đầu
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-zinc-100 leading-tight">
                        {activeCfg.topPriorityAsset}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 font-sans leading-relaxed">
                        {activeCfg.fidelityAssetAlloc}
                      </p>
                    </div>
                  </div>

                  {/* Stacked Percentage Visual Bar (Mini Allocation Chart) */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span className="font-bold flex items-center gap-1.5 text-zinc-300">
                        <ChartLineUp className="w-3.5 h-3.5 text-cyan-400" />
                        TỶ TRỌNG PHÂN BỔ MÔ PHỎNG (%)
                      </span>
                      <span>Tổng: 100%</span>
                    </div>
                    <div className="h-3 w-full bg-zinc-900 rounded-lg overflow-hidden flex gap-0.5 p-0.5 border border-zinc-800">
                      {activeCfg.priorityAssets.map((item, idx) => {
                        const colors = [
                          'bg-cyan-400',
                          'bg-emerald-400',
                          'bg-amber-400',
                          'bg-rose-400',
                        ];
                        return (
                          <div
                            key={idx}
                            style={{ width: `${item.weightPct}%` }}
                            className={`h-full ${colors[idx % colors.length]} rounded-sm transition-all duration-500`}
                            title={`${item.asset}: ${item.weight}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* 4 Asset Classes Cards Grid (Cân đối, không đè chữ, có mini-bar) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {activeCfg.priorityAssets.map((item) => {
                      const isTop1 = item.rank === 1;
                      const statusColor = 
                        item.status === 'overweight' 
                          ? { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', bar: 'bg-emerald-400', text: 'Tăng Tỷ Trọng' }
                          : item.status === 'neutral'
                          ? { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', bar: 'bg-amber-400', text: 'Trung Lập' }
                          : { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30', bar: 'bg-rose-400', text: 'Hạ Tỷ Trọng' };

                      return (
                        <div
                          key={item.asset}
                          className={`p-3 rounded-xl border flex flex-col justify-between transition-all relative overflow-hidden group ${
                            isTop1
                              ? 'bg-cyan-500/10 border-cyan-500/40 shadow-md shadow-cyan-500/5'
                              : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                          }`}
                        >
                          <div className="space-y-2">
                            {/* Card Top: Rank + Tỷ trọng (Tách riêng biệt) */}
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                  isTop1
                                    ? 'bg-cyan-400 text-zinc-950 shadow-sm shadow-cyan-400/30'
                                    : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                }`}
                              >
                                {item.rank}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 font-mono ${statusColor.badge}`}>
                                {item.weight}
                              </span>
                            </div>

                            {/* Asset Name */}
                            <h5 className="text-xs font-bold text-zinc-100 leading-snug line-clamp-1" title={item.asset}>
                              {item.asset}
                            </h5>

                            {/* Mini Allocation Progress Meter */}
                            <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800/80">
                              <div
                                className={`h-full ${isTop1 ? 'bg-cyan-400' : statusColor.bar} rounded-full transition-all duration-700`}
                                style={{ width: `${item.weightPct}%` }}
                              />
                            </div>

                            {/* Description text */}
                            <p className="text-[10px] text-zinc-400 leading-relaxed font-sans line-clamp-3">
                              {item.desc}
                            </p>
                          </div>

                          {/* Card Footer: Vị thế khuyến nghị */}
                          <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px]">
                            <span className="text-zinc-500">Khuyến nghị:</span>
                            <span className={`font-bold ${
                              item.status === 'overweight'
                                ? 'text-emerald-400'
                                : item.status === 'neutral'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}>
                              {statusColor.text}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mark Minervini Playbook */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                    <Flame className="w-4 h-4 shrink-0" weight="fill" />
                    <span>MARK MINERVINI PLAYBOOK (QUY TẮC GIAO DỊCH THEO XU HƯỚNG):</span>
                  </div>
                  <p className="text-zinc-300 text-[11px] font-sans leading-relaxed pl-5">
                    {activeCfg.minerviniStrategy}
                  </p>
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
