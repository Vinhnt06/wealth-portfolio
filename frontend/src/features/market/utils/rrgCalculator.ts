/**
 * RRG (Relative Rotation Graph) Calculation Engine
 * Chuẩn thuật toán Julius de Kempenaer (Bloomberg / StockCharts / RRGPy)
 * 
 * Tính toán JdK RS-Ratio (Trục X) và JdK RS-Momentum (Trục Y) 
 * cho 16 Nhóm Ngành của TTCK Việt Nam so với VN-INDEX
 */

export type RRGQuadrant = 'leading' | 'weakening' | 'lagging' | 'improving';

export interface RRGPoint {
  date: string;
  rsRatio: number;      // Trục X (quanh mốc 100)
  rsMomentum: number;   // Trục Y (quanh mốc 100)
  rawRs: number;
}

export interface RRGSectorConfig {
  id: string;
  name: string;
  shortName: string;
  color: string;
  symbols: string[];
}

export interface RRGSectorData {
  id: string;
  name: string;
  shortName: string;
  color: string;
  symbols: string[];
  points: RRGPoint[];          // Đuôi lịch sử (Tail)
  currentPoint: RRGPoint;      // Tọa độ hiện tại
  quadrant: RRGQuadrant;
  distanceFromCenter: number; // Khoảng cách từ tâm (100, 100)
  angle: number;              // Góc quay theo độ (0 - 360)
  velocity: number;           // Vận tốc luân chuyển
  changePercent: number;      // % thay đổi phiên gần nhất
}

export interface RRGDataset {
  sectors: RRGSectorData[];
  benchmark: string;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    leading: number;
    weakening: number;
    lagging: number;
    improving: number;
    total: number;
  };
}

// 16 Nhóm Ngành chuẩn mực của Thị Trường Chứng Khoán Việt Nam
export const RRG_SECTOR_CONFIGS: RRGSectorConfig[] = [
  {
    id: 'banking',
    name: 'Ngân hàng',
    shortName: 'Ngân hàng',
    color: '#10b981', // Emerald
    symbols: ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB'],
  },
  {
    id: 'securities',
    name: 'Chứng khoán',
    shortName: 'Chứng khoán',
    color: '#38bdf8', // Sky
    symbols: ['SSI', 'VND', 'VCI', 'HCM', 'MBS', 'SHS', 'FTS', 'BSI'],
  },
  {
    id: 'real_estate',
    name: 'Bất động sản',
    shortName: 'BĐS',
    color: '#60a5fa', // Blue
    symbols: ['VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'PDR', 'DXG', 'DIG', 'NVL'],
  },
  {
    id: 'industrial_park',
    name: 'Khu công nghiệp',
    shortName: 'KCN',
    color: '#2dd4bf', // Teal
    symbols: ['BCM', 'KBC', 'IDC', 'SZC', 'VGC', 'SIP', 'LHG'],
  },
  {
    id: 'steel',
    name: 'Thép & Kim loại',
    shortName: 'Thép',
    color: '#f97316', // Orange
    symbols: ['HPG', 'HSG', 'NKG', 'VGS', 'TLH'],
  },
  {
    id: 'oil_gas',
    name: 'Dầu khí',
    shortName: 'Dầu khí',
    color: '#fbbf24', // Amber
    symbols: ['GAS', 'PVD', 'PVS', 'BSR', 'PLX', 'PVT'],
  },
  {
    id: 'retail',
    name: 'Bán lẻ',
    shortName: 'Bán lẻ',
    color: '#4ade80', // Green
    symbols: ['MWG', 'PNJ', 'FRT', 'DGW', 'PET'],
  },
  {
    id: 'food_beverage',
    name: 'Thực phẩm & Đồ uống',
    shortName: 'Thực phẩm',
    color: '#a3e635', // Lime
    symbols: ['MSN', 'VNM', 'SAB', 'KDC', 'MCH'],
  },
  {
    id: 'tech',
    name: 'Công nghệ thông tin',
    shortName: 'Công nghệ',
    color: '#ec4899', // Pink / Rose
    symbols: ['FPT', 'CMG', 'CTR', 'ELC', 'VGI'],
  },
  {
    id: 'construction',
    name: 'Xây dựng & Hạ tầng',
    shortName: 'Xây dựng',
    color: '#22d3ee', // Cyan
    symbols: ['VCG', 'HHV', 'CII', 'FCN', 'CTD', 'LCG'],
  },
  {
    id: 'seafood',
    name: 'Thủy sản',
    shortName: 'Thủy sản',
    color: '#06b6d4', // Cyan dark
    symbols: ['VHC', 'ANV', 'IDI', 'FMC'],
  },
  {
    id: 'agriculture',
    name: 'Nông nghiệp & Chăn nuôi',
    shortName: 'Nông nghiệp',
    color: '#84cc16', // Light Green
    symbols: ['DBC', 'BAF', 'HAG', 'PAN'],
  },
  {
    id: 'energy',
    name: 'Năng lượng & Điện',
    shortName: 'Năng lượng',
    color: '#14b8a6', // Teal light
    symbols: ['POW', 'REE', 'PC1', 'GEG', 'HDG', 'NT2'],
  },
  {
    id: 'chemicals',
    name: 'Hóa chất & Phân bón',
    shortName: 'Phân bón',
    color: '#f59e0b', // Amber dark
    symbols: ['DGC', 'DPM', 'DCM', 'BFC', 'CSV'],
  },
  {
    id: 'logistics',
    name: 'Cảng biển & Logistics',
    shortName: 'Cảng biển',
    color: '#0284c7', // Sky dark
    symbols: ['GMD', 'HAH', 'VSC', 'PVT', 'VOS'],
  },
  {
    id: 'rubber_plastic',
    name: 'Cao su & Nhựa',
    shortName: 'Cao su',
    color: '#eab308', // Yellow
    symbols: ['GVR', 'DRC', 'DPR', 'PHR', 'BMP'],
  },
];

/**
 * Xác định góc phần tư dựa vào RS-Ratio và RS-Momentum
 */
export function getQuadrant(rsRatio: number, rsMomentum: number): RRGQuadrant {
  if (rsRatio >= 100 && rsMomentum >= 100) return 'leading';   // Dẫn dắt
  if (rsRatio >= 100 && rsMomentum < 100) return 'weakening'; // Suy yếu
  if (rsRatio < 100 && rsMomentum < 100) return 'lagging';   // Tụt hậu
  return 'improving';                                         // Cải thiện
}

/**
 * Lấy nhãn tiếng Việt và màu sắc đại diện cho từng góc phần tư
 */
export function getQuadrantInfo(quadrant: RRGQuadrant): {
  name: string;
  enName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
} {
  switch (quadrant) {
    case 'leading':
      return {
        name: 'DẪN DẮT',
        enName: 'Leading',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.08)',
        borderColor: 'rgba(16, 185, 129, 0.25)',
        description: 'Mạnh hơn VN-INDEX & Xung lực tiếp tục gia tăng (Outperforming & Accelerating)',
      };
    case 'weakening':
      return {
        name: 'SUY YẾU',
        enName: 'Weakening',
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: 'rgba(245, 158, 11, 0.25)',
        description: 'Vẫn mạnh hơn VN-INDEX nhưng đà tăng đang giảm tốc (Outperforming but Decelerating)',
      };
    case 'lagging':
      return {
        name: 'TỤT HẬU',
        enName: 'Lagging',
        color: '#f43f5e',
        bgColor: 'rgba(244, 63, 94, 0.08)',
        borderColor: 'rgba(244, 63, 94, 0.25)',
        description: 'Yếu hơn VN-INDEX & Xung lực suy giảm (Underperforming & Decelerating)',
      };
    case 'improving':
      return {
        name: 'CẢI THIỆN',
        enName: 'Improving',
        color: '#38bdf8',
        bgColor: 'rgba(56, 189, 248, 0.08)',
        borderColor: 'rgba(56, 189, 248, 0.25)',
        description: 'Yếu hơn VN-INDEX nhưng xung lực đang phục hồi mạnh (Underperforming but Accelerating)',
      };
  }
}

/**
 * Tính toán JdK RS-Ratio và JdK RS-Momentum theo thuật toán chuẩn Julius de Kempenaer:
 * 
 * 1. Relative Strength (RS):
 *    RS(t) = [Price_Sector(t) / Price_Benchmark(t)] * 100
 * 
 * 2. JdK RS-Ratio (Rolling Z-score normalization):
 *    RS-Ratio(t) = 100 + [(RS(t) - SMA(RS, window)) / StdDev(RS, window)] * scaleFactor
 * 
 * 3. JdK RS-Momentum (Rate of change of RS-Ratio normalized):
 *    ROC(t) = [(RS-Ratio(t) / RS-Ratio(t-1)) - 1] * 100
 *    RS-Momentum(t) = 100 + [(ROC(t) - SMA(ROC, window)) / StdDev(ROC, window)] * scaleFactor
 */
export function calculateRRGSeries(
  sectorPrices: { date: string; close: number }[],
  benchmarkPrices: { date: string; close: number }[],
  window: number = 14,
  scaleFactor: number = 1.8,
  tailLength: number = 4
): RRGPoint[] {
  // Đồng bộ ngày giữa sector và benchmark
  const bMap = new Map<string, number>();
  benchmarkPrices.forEach((b) => bMap.set(b.date, b.close));

  const validPairs: { date: string; sectorClose: number; benchClose: number }[] = [];
  sectorPrices.forEach((s) => {
    const bClose = bMap.get(s.date);
    if (bClose && bClose > 0 && s.close > 0) {
      validPairs.push({ date: s.date, sectorClose: s.close, benchClose: bClose });
    }
  });

  if (validPairs.length < window * 2) {
    return [];
  }

  // 1. Tính Relative Strength (RS)
  const rawRs = validPairs.map((p) => (p.sectorClose / p.benchClose) * 100);

  // 2. Rolling Z-Score để tính JdK RS-Ratio chuẩn hóa quanh 100
  const rsRatio: number[] = [];
  for (let i = 0; i < rawRs.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = rawRs.slice(start, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const std = Math.sqrt(variance) || 1e-4;

    const zScore = (rawRs[i] - mean) / std;
    rsRatio.push(100 + zScore * scaleFactor);
  }

  // 3. Rate of Change (ROC) của RS-Ratio
  const roc: number[] = [0];
  for (let i = 1; i < rsRatio.length; i++) {
    const prev = rsRatio[i - 1] || 100;
    roc.push(((rsRatio[i] / prev) - 1) * 100);
  }

  // 4. JdK RS-Momentum = Normalized ROC quanh 100
  const rsMomentum: number[] = [];
  for (let i = 0; i < roc.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = roc.slice(start, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const std = Math.sqrt(variance) || 1e-4;

    const zScore = (roc[i] - mean) / std;
    rsMomentum.push(100 + zScore * scaleFactor);
  }

  const fullRRGPoints: RRGPoint[] = [];
  for (let i = 0; i < validPairs.length; i++) {
    fullRRGPoints.push({
      date: validPairs[i].date,
      rsRatio: Number(rsRatio[i].toFixed(2)),
      rsMomentum: Number(rsMomentum[i].toFixed(2)),
      rawRs: Number(rawRs[i].toFixed(4)),
    });
  }

  // Trả về số điểm đuôi tương ứng (ví dụ 4 kỳ gần nhất)
  return fullRRGPoints.slice(-tailLength);
}
