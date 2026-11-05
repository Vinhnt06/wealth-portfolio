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
  relativePerf3M?: number;    // % hiệu suất tương đối 3 tháng (13 tuần) so với Benchmark
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

export interface RRGGroupOption {
  id: string;
  name: string;
  shortName: string;
  category: 'sector' | 'industry' | 'index';
  symbols?: string[];
}

export const RRG_GROUP_OPTIONS: RRGGroupOption[] = [
  { id: 'all', name: 'Toàn bộ 16 Nhóm Ngành', shortName: '16 Ngành', category: 'sector' },
  {
    id: 'banking',
    name: 'Ngân hàng',
    shortName: 'Ngân hàng',
    category: 'industry',
    // 22 mã ngân hàng niêm yết chuẩn trên HOSE/HNX/UPCOM
    symbols: [
      'VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'STB', 'HDB', 'LPB',
      'SHB', 'TPB', 'VIB', 'OCB', 'MSB', 'EIB', 'BAB', 'BVB', 'NVB', 'NAB',
      'SSB', 'ABB'
    ],
  },
  {
    id: 'securities',
    name: 'Chứng khoán',
    shortName: 'Chứng khoán',
    category: 'industry',
    symbols: [
      'SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'AGR',
      'VDS', 'ORS', 'BVS', 'TVS', 'VIX', 'APG'
    ],
  },
  {
    id: 'real_estate',
    name: 'Bất động sản',
    shortName: 'BĐS',
    category: 'industry',
    symbols: [
      'VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'PDR', 'DXG', 'DIG', 'NVL', 'CEO',
      'HDC', 'DXS', 'TCH', 'KHG', 'SCR', 'CRE', 'HQC', 'IJC'
    ],
  },
  {
    id: 'industrial_park',
    name: 'Khu công nghiệp',
    shortName: 'KCN',
    category: 'industry',
    symbols: ['BCM', 'KBC', 'IDC', 'SZC', 'VGC', 'SIP', 'LHG', 'NTL', 'TIP'],
  },
  {
    id: 'steel',
    name: 'Thép & Kim loại',
    shortName: 'Thép',
    category: 'industry',
    symbols: ['HPG', 'HSG', 'NKG', 'VGS', 'TLH', 'TVN', 'SMC', 'POM'],
  },
  {
    id: 'oil_gas',
    name: 'Dầu khí',
    shortName: 'Dầu khí',
    category: 'industry',
    symbols: ['GAS', 'PVD', 'PVS', 'BSR', 'PLX', 'PVT', 'PVC', 'PVB'],
  },
  {
    id: 'retail',
    name: 'Bán lẻ & Tiêu dùng',
    shortName: 'Bán lẻ',
    category: 'industry',
    symbols: ['MWG', 'PNJ', 'FRT', 'DGW', 'PET', 'MSN', 'VNM', 'SAB'],
  },
  {
    id: 'tech',
    name: 'Công nghệ thông tin',
    shortName: 'Công nghệ',
    category: 'industry',
    symbols: ['FPT', 'CMG', 'CTR', 'ELC', 'FOX', 'VGI'],
  },
  {
    id: 'chemicals',
    name: 'Hóa chất & Phân bón',
    shortName: 'Hóa chất',
    category: 'industry',
    symbols: ['DGC', 'DPM', 'DCM', 'BFC', 'CSV', 'LAS', 'DDV'],
  },
  {
    id: 'construction',
    name: 'Xây dựng & Hạ tầng',
    shortName: 'Xây dựng',
    category: 'industry',
    symbols: ['VCG', 'HHV', 'CII', 'FCN', 'CTD', 'LCG', 'HUT', 'C4G'],
  },
  {
    id: 'logistics',
    name: 'Cảng biển & Logistics',
    shortName: 'Cảng biển',
    category: 'industry',
    symbols: ['GMD', 'HAH', 'VSC', 'PVT', 'VOS', 'VIP', 'DXP'],
  },
  {
    id: 'energy',
    name: 'Năng lượng & Điện',
    shortName: 'Năng lượng',
    category: 'industry',
    symbols: ['POW', 'REE', 'PC1', 'GEG', 'HDG', 'NT2', 'VSH'],
  },
  {
    id: 'seafood_agri',
    name: 'Thủy sản & Nông nghiệp',
    shortName: 'Thủy sản & NN',
    category: 'industry',
    symbols: ['VHC', 'ANV', 'IDI', 'FMC', 'DBC', 'BAF', 'HAG', 'PAN'],
  },
  {
    id: 'rubber_plastic',
    name: 'Cao su & Nhựa',
    shortName: 'Cao su',
    category: 'industry',
    symbols: ['GVR', 'DRC', 'DPR', 'PHR', 'BMP', 'NTP'],
  },
  {
    id: 'vn30',
    name: 'VN30 Index (Top 30 Vốn Hóa)',
    shortName: 'VN30',
    category: 'index',
    symbols: [
      'ACB', 'BCM', 'BID', 'BVH', 'CTG', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG',
      'MBB', 'MSN', 'MWG', 'PLX', 'POW', 'SAB', 'SHB', 'SSB', 'SSI', 'STB',
      'TCB', 'TPB', 'VCB', 'VHM', 'VIB', 'VIC', 'VJC', 'VNM', 'VPB', 'VRE'
    ],
  },
];

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

function calcEMA(arr: number[], span: number): number[] {
  const k = 2 / (span + 1);
  const res: number[] = [];
  let ema = arr[0] || 0;
  res.push(ema);
  for (let i = 1; i < arr.length; i++) {
    ema = arr[i] * k + ema * (1 - k);
    res.push(ema);
  }
  return res;
}

function calcSMA(arr: number[], period: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - period + 1);
    const slice = arr.slice(start, i + 1);
    res.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return res;
}

/**
 * Tính toán JdK RS-Ratio và JdK RS-Momentum theo thuật toán chuẩn Julius de Kempenaer (JdK RRG):
 * 
 * 1. Relative Strength (RS):
 *    RS(t) = [Price_Stock(t) / Price_Benchmark(t)] * 100
 * 
 * 2. JdK RS-Ratio (Làm mượt kép EMA + SMA khử nhiễu, chuẩn hóa quanh baseline 100):
 *    EMA_RS = EMA(RS, window)
 *    SMA_EMA = SMA(EMA_RS, window)
 *    RS-Ratio(t) = 100 * [EMA_RS(t) / SMA_EMA(t)]
 * 
 * 3. JdK RS-Momentum (Tốc độ thay đổi đà tăng/giảm của RS-Ratio qua EMA):
 *    ROC(t) = [RS-Ratio(t) - RS-Ratio(t - k)] / RS-Ratio(t - k)
 *    EMA_ROC = EMA(ROC, window)
 *    RS-Momentum(t) = 100 + 100 * EMA_ROC(t)
 */
export function calculateRRGSeries(
  sectorPrices: { date: string; close: number }[],
  benchmarkPrices: { date: string; close: number }[],
  window: number = 14,
  scaleFactor: number = 1.0,
  tailLength: number = 4
): RRGPoint[] {
  // Đồng bộ ngày giữa mã cổ phiếu/ngành và benchmark (VNINDEX)
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

  // 1. Relative Strength (RS)
  const rawRs = validPairs.map((p) => (p.sectorClose / p.benchClose) * 100);

  // 2. JdK RS-Ratio (Làm mượt kép EMA + SMA theo chuẩn Julius de Kempenaer)
  const emaRs = calcEMA(rawRs, window);
  const emaRsMean = calcSMA(emaRs, window);
  const rsRatio = emaRs.map((v, i) => (emaRsMean[i] > 0 ? (100 * v) / emaRsMean[i] : 100));

  // 3. JdK RS-Momentum (Rate of change of RS-Ratio smoothed via EMA)
  const roc: number[] = [];
  const k = 10; // Chu kỳ quán tính 10 phiên
  for (let i = 0; i < rsRatio.length; i++) {
    const prev = rsRatio[Math.max(0, i - k)] || 100;
    roc.push((rsRatio[i] - prev) / prev);
  }
  const emaRoc = calcEMA(roc, window);
  const rsMomentum = emaRoc.map((v) => 100 + 100 * v);

  const fullRRGPoints: RRGPoint[] = [];
  for (let i = 0; i < validPairs.length; i++) {
    fullRRGPoints.push({
      date: validPairs[i].date,
      rsRatio: Number(rsRatio[i].toFixed(2)),
      rsMomentum: Number(rsMomentum[i].toFixed(2)),
      rawRs: Number(rawRs[i].toFixed(4)),
    });
  }

  // Đuôi N kỳ tương ứng N+1 điểm liên kết (ví dụ đuôi 4 kỳ = 5 điểm: t-4, t-3, t-2, t-1, t)
  return fullRRGPoints.slice(-(tailLength + 1));
}
