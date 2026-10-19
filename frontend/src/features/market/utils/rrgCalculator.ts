/**
 * RRG (Relative Rotation Graph) Calculation Engine
 * Chuẩn thuật toán Julius de Kempenaer (Bloomberg / StockCharts)
 * 
 * Tính toán RS-Ratio (X) và RS-Momentum (Y) của 16 Nhóm Ngành so với VN-INDEX
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
  points: RRGPoint[];      // Đuôi lịch sử (Tail)
  currentPoint: RRGPoint;  // Tọa độ hiện tại
  quadrant: RRGQuadrant;
  distanceFromCenter: number; // Khoảng cách từ (100, 100)
  angle: number;              // Góc quay theo độ (0 - 360)
  velocity: number;           // Vận tốc xoay
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

// Danh sách 16 nhóm ngành chuẩn của thị trường chứng khoán Việt Nam
export const RRG_SECTOR_CONFIGS: RRGSectorConfig[] = [
  {
    id: 'banking',
    name: 'Ngân hàng',
    shortName: 'Ngân hàng',
    color: '#34d399', // Emerald
    symbols: ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB'],
  },
  {
    id: 'securities',
    name: 'Chứng khoán & Bảo hiểm',
    shortName: 'Chứng khoán',
    color: '#38bdf8', // Sky
    symbols: ['SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'BVH', 'MIG'],
  },
  {
    id: 'real_estate',
    name: 'Bất động sản',
    shortName: 'BĐS',
    color: '#60a5fa', // Blue
    symbols: ['VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'PDR', 'DIG', 'DXG', 'CEO', 'NVL'],
  },
  {
    id: 'industrial_park',
    name: 'Khu công nghiệp',
    shortName: 'KCN',
    color: '#2dd4bf', // Teal
    symbols: ['KBC', 'GVR', 'BCM', 'IDC', 'SZC', 'VGC', 'LHG', 'SIP', 'D2D'],
  },
  {
    id: 'steel',
    name: 'Thép & Kim loại',
    shortName: 'Thép',
    color: '#f97316', // Orange
    symbols: ['HPG', 'HSG', 'NKG', 'VGS', 'SMC', 'TLH'],
  },
  {
    id: 'oil_gas',
    name: 'Dầu khí',
    shortName: 'Dầu khí',
    color: '#fbbf24', // Amber
    symbols: ['GAS', 'PVD', 'PVS', 'BSR', 'PLX', 'PVT', 'PVP', 'PVC'],
  },
  {
    id: 'retail',
    name: 'Bán lẻ & Tiêu dùng',
    shortName: 'Bán lẻ',
    color: '#4ade80', // Green
    symbols: ['MWG', 'PNJ', 'FRT', 'DGW', 'MSN', 'VNM', 'SAB', 'KDC'],
  },
  {
    id: 'tech_telecom',
    name: 'Công nghệ & Viễn thông',
    shortName: 'Công nghệ',
    color: '#f43f5e', // Rose
    symbols: ['FPT', 'CMG', 'CTR', 'VGI', 'ELC', 'FOX'],
  },
  {
    id: 'construction',
    name: 'Xây dựng & Hạ tầng',
    shortName: 'Xây dựng',
    color: '#22d3ee', // Cyan
    symbols: ['VCG', 'HHV', 'C4G', 'CII', 'FCN', 'LCG', 'PC1', 'CTD'],
  },
  {
    id: 'agriculture',
    name: 'Thủy sản & Nông nghiệp',
    shortName: 'Thủy sản',
    color: '#10b981', // Emerald
    symbols: ['VHC', 'ANV', 'IDI', 'BAF', 'DBC', 'HAG', 'PAN'],
  },
  {
    id: 'energy',
    name: 'Điện & Năng lượng',
    shortName: 'Năng lượng',
    color: '#14b8a6', // Teal
    symbols: ['POW', 'REE', 'GEG', 'HDG', 'NT2', 'VSH'],
  },
  {
    id: 'chemicals',
    name: 'Hóa chất & Phân bón',
    shortName: 'Phân bón',
    color: '#fb923c', // Orange
    symbols: ['DGC', 'DPM', 'DCM', 'BFC', 'CSV', 'LAS'],
  },
  {
    id: 'transport',
    name: 'Vận tải & Cảng biển',
    shortName: 'Cảng biển',
    color: '#06b6d4', // Cyan
    symbols: ['GMD', 'HAH', 'VSC', 'PVT', 'VOS', 'VJC', 'HVN'],
  },
  {
    id: 'rubber',
    name: 'Cao su & Săm lốp',
    shortName: 'Cao su',
    color: '#eab308', // Yellow
    symbols: ['DRC', 'CSM', 'BRC', 'GVR', 'PHR', 'DPR'],
  },
  {
    id: 'pharma',
    name: 'Dược phẩm & Y tế',
    shortName: 'Dược phẩm',
    color: '#a3e635', // Lime
    symbols: ['DHG', 'TRA', 'IMP', 'DBD', 'DMC'],
  },
  {
    id: 'other',
    name: 'Khác & Tiện ích',
    shortName: 'Khác',
    color: '#5eead4', // Light Teal
    symbols: ['TDM', 'BWE', 'SCS', 'VCS'],
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
        description: 'Mạnh hơn VN-INDEX & Xung lực tiếp tục gia tăng (Outperforming & Gaining Momentum)',
      };
    case 'weakening':
      return {
        name: 'SUY YẾU',
        enName: 'Weakening',
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: 'rgba(245, 158, 11, 0.25)',
        description: 'Vẫn mạnh hơn VN-INDEX nhưng xung lực đang giảm dần (Outperforming but Losing Momentum)',
      };
    case 'lagging':
      return {
        name: 'TỤT HẬU',
        enName: 'Lagging',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.25)',
        description: 'Yếu hơn VN-INDEX & Xung lực suy giảm (Underperforming & Losing Momentum)',
      };
    case 'improving':
      return {
        name: 'CẢI THIỆN',
        enName: 'Improving',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.08)',
        borderColor: 'rgba(59, 130, 246, 0.25)',
        description: 'Yếu hơn VN-INDEX nhưng xung lực đang phục hồi mạnh (Underperforming but Gaining Momentum)',
      };
  }
}

/**
 * Weighted Moving Average (WMA)
 */
function calculateWMA(series: number[], period: number): number[] {
  const weights = Array.from({ length: period }, (_, i) => i + 1);
  const wSum = (period * (period + 1)) / 2;
  const result: number[] = [];

  for (let i = 0; i < series.length; i++) {
    if (i < period - 1) {
      // Khởi tạo cho các phiên đầu chưa đủ period
      const count = i + 1;
      const subWeights = weights.slice(period - count);
      const subSum = subWeights.reduce((a, b) => a + b, 0);
      let acc = 0;
      for (let j = 0; j < count; j++) {
        acc += series[j] * subWeights[j];
      }
      result.push(acc / subSum);
    } else {
      let acc = 0;
      for (let j = 0; j < period; j++) {
        acc += series[i - period + 1 + j] * weights[j];
      }
      result.push(acc / wSum);
    }
  }
  return result;
}

/**
 * Tính toán RS-Ratio và RS-Momentum theo thuật toán chuẩn Julius de Kempenaer (Bloomberg / StockCharts)
 * 1. RS = (Price / Benchmark) * 100
 * 2. RS1 = WMA(RS, period)
 * 3. RS2 = WMA(RS1, period)
 * 4. RS-Ratio = (RS1 / RS2) * 100
 * 5. RS-Momentum = (RS-Ratio / WMA(RS-Ratio, momentumPeriod)) * 100
 */
export function calculateRRGSeries(
  sectorPrices: { date: string; close: number }[],
  benchmarkPrices: { date: string; close: number }[],
  period: number = 10,
  momentumPeriod: number = 4,
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

  if (validPairs.length < period * 2 + momentumPeriod) {
    return [];
  }

  // 1. Tính Relative Strength (RS)
  const rawRs = validPairs.map((p) => (p.sectorClose / p.benchClose) * 100);

  // 2. Double-Smoothing WMA để tính JdK RS-Ratio (chuẩn hóa dao động quanh 100)
  const rsSmooth1 = calculateWMA(rawRs, period);
  const rsSmooth2 = calculateWMA(rsSmooth1, period);

  const rsRatio: number[] = [];
  for (let i = 0; i < rawRs.length; i++) {
    const s2 = rsSmooth2[i] || 0.0001;
    rsRatio.push((rsSmooth1[i] / s2) * 100);
  }

  // 3. JdK RS-Momentum = (RS-Ratio / WMA(RS-Ratio, momentumPeriod)) * 100
  const rsRatioWMA = calculateWMA(rsRatio, momentumPeriod);
  const fullRRGPoints: RRGPoint[] = [];

  for (let i = 0; i < rawRs.length; i++) {
    const rw = rsRatioWMA[i] || 0.0001;
    const mom = (rsRatio[i] / rw) * 100;

    fullRRGPoints.push({
      date: validPairs[i].date,
      rsRatio: Number(rsRatio[i].toFixed(2)),
      rsMomentum: Number(mom.toFixed(2)),
      rawRs: Number(rawRs[i].toFixed(4)),
    });
  }

  // Trả về số điểm đuôi tương ứng (ví dụ 4 kỳ gần nhất)
  return fullRRGPoints.slice(-tailLength);
}
