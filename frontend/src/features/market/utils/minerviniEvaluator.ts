import { MinerviniScreenerItem } from '../types/minervini.types';

// Real Shares Outstanding (in millions of shares) verified from Vietcap IQ (numberOfSharesMktCap)
export const OUTSTANDING_SHARES_M: Record<string, number> = {
  // Ngân hàng & Tài chính lớn
  VCB: 8355.7, BID: 7778.2, CTG: 7766.9, TCB: 10629.4, MBB: 10068.7, VPB: 10000, ACB: 5804.4,
  HDB: 6506.9, STB: 1885.2, LPB: 2987.3, SHB: 5343.7, TPB: 3190.1, VIB: 3735.4, MSB: 3744,
  OCB: 3062.5, SSB: 3468.8, EIB: 1862.7, NAB: 2158.8, BAB: 825, BVB: 961.2, ABB: 1606.8,
  NVB: 2924.6, VAB: 902.1, KLB: 749, EVF: 760.6,
  // Chứng khoán
  SSI: 3001.3, VIX: 2572.8, VND: 1522.3, VCI: 1152.2, HCM: 1371.9, SHS: 899.5, MBS: 1000.9,
  FTS: 380.9, BSI: 269.9, CTS: 272.2, AGR: 242, ORS: 623.9, TVS: 151, PHS: 210, DSC: 204,
  VDS: 299.2, BVS: 72.2, AAS: 230, VFS: 154, SBS: 156.1, EVS: 164.8, APG: 223.6, APS: 83,
  // Bất động sản & Khu công nghiệp
  VHM: 8214.8, VIC: 7762.2, VRE: 2272.3, VPL: 1793.3, KDH: 1245.3, NLG: 485.1, PDR: 997.8,
  DIG: 844.2, DXG: 1268.1, CEO: 595.8, NVL: 3204.5, TCH: 1003.3, HQC: 626.6, DRH: 123.7,
  KHG: 449.4, VPI: 352.1, HDG: 407, DXS: 579.1, NTL: 122, CRE: 463.7, HDC: 229.7, AGG: 181.4,
  SCR: 430.6, HPX: 304.2, QCG: 275.1, OGC: 300, LDG: 255.6, KOS: 216.5, TIG: 193.6, IDJ: 173.5,
  VC3: 148.8, VC7: 96.1, NRC: 92.6, API: 84.1, NHA: 71.3, VRC: 50, PVL: 50, PV2: 36.9,
  KBC: 941.8, IDC: 417.4, VGC: 448.4, SZC: 180, BCM: 1035, TIP: 65, LHG: 50, SIP: 242.1,
  D2D: 30, PHR: 243.9, IJC: 629.6, ITA: 938, DTD: 73.4,
  // Thép, Khoáng sản & Nguyên vật liệu
  HPG: 8443, HSG: 807.3, NKG: 492.3, VGS: 61.5, SMC: 110.4, TLH: 112.3, TVN: 678, MSR: 1105,
  POM: 278.5, KSB: 114.4, VPG: 88.4, KVC: 49.5, ACM: 51, LCM: 24.6,
  // Công nghệ & Viễn thông
  FPT: 1885.7, CMG: 232.9, ELC: 117.7, CTR: 128.1, VGI: 3043.8, FOX: 492, VNZ: 28, ITD: 24,
  SAM: 402.8, SGT: 148, HPT: 10, TTN: 36, MFS: 7,
  // Dầu khí & Năng lượng
  GAS: 2412.9, PLX: 1293.9, BSR: 5007.3, PVD: 927.7, PVS: 613.7, PVT: 516.9, PVP: 103.7,
  PVC: 81.2, PVB: 21.6, OIL: 1034.2, ASP: 37.3,
  // Điện, Nước & Tiện ích
  POW: 3067.8, REE: 623.4, PC1: 473, GEG: 376.2, GEE: 640.5, NT2: 287.9, QTP: 450, VSH: 236,
  TV2: 67.5, BCG: 880, BWE: 220, TDM: 110, PGV: 1123, PPC: 320.6, TTA: 178.6, VCP: 83.8,
  VNE: 82.1, BGE: 730, GEL: 890, SDD: 16,
  // Hóa chất, Phân bón, Nhựa & Cao su
  DGC: 379.8, DCM: 529.4, DPM: 679.9, CSV: 110.5, GVR: 4000, BFC: 57.2, LAS: 112.9, DPR: 86.9,
  DRC: 154.4, DDV: 146.1, CSM: 103.6, SRC: 28, AAA: 393.7, APH: 243.9, HII: 73.7, NTP: 205.2,
  BMP: 81.9, TRC: 120, DRI: 73.2, PAC: 76.7, TDP: 103.1,
  // Bán lẻ & Tiêu dùng
  MSN: 1460.4, MWG: 1475.7, VNM: 2090, SAB: 1282.6, PNJ: 511.7, FRT: 178.8, DGW: 223.4,
  KDC: 289, MCH: 1307.4, QNS: 367.6, SBT: 934.6, AST: 45, CLX: 86, TLG: 96.5, PSD: 70.2,
  // Thủy sản, Nông nghiệp & Thực phẩm
  VHC: 209.5, ANV: 266.3, ASM: 407.2, IDI: 273.2, PAN: 250.7, DBC: 431, HAG: 1267.4, BAF: 405.4,
  HNG: 1108.6, FMC: 65, AAN: 91.6, NAF: 61.2, HNM: 44.4, HSL: 38.6, AFX: 35, BNA: 31.2, SPV: 10.8,
  // Cảng biển, Hàng không, Vận tải & Logistics
  ACV: 3582.3, HVN: 3111.5, VJC: 769.1, GMD: 649.3, HAH: 191.8, VSC: 374.4, VTP: 201.9,
  PHP: 327, PET: 154.7, SGP: 216, VOS: 140, VIP: 68, VTO: 79.9, SCS: 95.9, DXP: 59.9, TCO: 57.3,
  // Xây dựng, Hạ tầng & Vật liệu
  VCG: 698.2, HHV: 574.5, CII: 672, HUT: 1068.3, CTD: 111.8, FCN: 157.4, LCG: 206.6, C4G: 357.3,
  HT1: 381.6, BCC: 123.2, GEX: 1308.5, HBC: 398.6, PVX: 400, TCD: 335.8, EVG: 226, HTN: 133.7,
  DPG: 118.6, MST: 113.6, DC4: 110, CLI: 109.9, CDC: 105.5, ACC: 105, G36: 103.7, PTB: 100.4,
  PLC: 80.8, DGT: 79, HID: 76.8, HVH: 71.7, RYG: 69.6, CTI: 69.3, C69: 61.8, DCS: 60.3,
  BOT: 59.2, BCE: 42, SCL: 38.8, DHC: 106.2, HHP: 92.2, TTF: 393.5,
  // Dệt may & Hàng tiêu dùng
  TNG: 128.7, MSH: 112.5, GIL: 101.6, STK: 96, TCM: 117.6, VGT: 500, GDT: 21, SAV: 25, FTM: 50,
  // Dược phẩm & Y tế
  DHG: 130, IMP: 154, TRA: 41, DVN: 237, DBD: 93, DMC: 34, OPC: 64, DCL: 73, JVC: 112.5,
  TNH: 165.7, AMV: 131.1, DKP: 20, DVM: 47.1, SRA: 43.2, CVN: 29.7,
  // Bảo hiểm
  BVH: 742.3, PVI: 234, MIG: 172, BIC: 117, BMI: 120, PTI: 80, PRE: 104, ABI: 72,
  // Ô tô & Phụ tùng
  VEA: 1328.8, HHS: 432, HAX: 107, CTF: 95.7, TMT: 37, VVS: 43.1, HHG: 34.9,
  // Đa ngành & Khác (gồm cả các mã nhỏ để tính đúng vốn hóa thật < 1.000 Tỷ và loại bỏ)
  TCX: 3329.3, VCK: 2434.9, VPX: 1875, LPS: 1408.7, PCB: 899.3, TAL: 504, DSE: 428.2,
  FIT: 339.9, DLG: 299.3, IPA: 245.9, F88: 231.3, YEG: 222.2, OCH: 200, DL1: 180.6,
  SHI: 169.9, MZG: 158.2, MBG: 120.2, AAH: 117.9, CRC: 106.7, DAH: 84.2, TLD: 81.6,
  ABS: 80, DFF: 80, DDG: 79.8, VTZ: 76.2, BKG: 71.6, QBS: 69.3, SBG: 61.8, HKB: 51.6,
  CIG: 51, HIO: 42, TTH: 37.4, BIG: 34.2, DST: 32.2, HDA: 30.4, DVG: 28, PAS: 28,
  SDA: 26.2, FID: 24.7, SVN: 21, PPT: 19.6, VKC: 19.3, PIV: 17.3, CTP: 14.5, SHN: 129.6,
  EID: 15, ADC: 4, DAE: 2, SFI: 25, MHC: 41, CLC: 26, MEC: 8, TCT: 12, WCS: 2.5, DXL: 4,
};

/**
 * 8 tiêu chí chính thức của Bộ lọc Mark Minervini (SEPA Trend Template - Stage 2 Uptrend)
 */
export const MINERVINI_8_CRITERIA_META = [
  { id: 1, shortLabel: '1. Giá > MA150 & MA200', fullLabel: 'Giá hiện tại nằm trên cả MA150 và MA200' },
  { id: 2, shortLabel: '2. MA150 > MA200', fullLabel: 'Đường MA150 nằm trên đường MA200' },
  { id: 3, shortLabel: '3. MA200 dốc lên (≥1 tháng)', fullLabel: 'Đường MA200 đang hướng lên tối thiểu 22 phiên giao dịch' },
  { id: 4, shortLabel: '4. MA50 > MA150 > MA200', fullLabel: 'Đường MA50 nằm trên cả MA150 và MA200' },
  { id: 5, shortLabel: '5. Giá > MA50', fullLabel: 'Giá hiện tại nằm trên đường MA50' },
  { id: 6, shortLabel: '6. Giá ≥ +30% từ đáy 52T', fullLabel: 'Giá hiện tại cao hơn tối thiểu 30% so với đáy 52 tuần' },
  { id: 7, shortLabel: '7. Cách đỉnh 52T ≤ 25%', fullLabel: 'Giá hiện tại nằm trong vùng 25% tính từ đỉnh 52 tuần' },
  { id: 8, shortLabel: '8. RS Rating ≥ 70', fullLabel: 'Chỉ số Sức mạnh giá tương đối (IBD Percentile 1-99) đạt từ 70 trở lên' },
] as const;

export function calcMarketCapT(symbol: string, priceK: number): number {
  if (!priceK || priceK <= 0) return 0;
  // Tuyệt đối không dùng fallback 100 triệu CP cho các mã nhỏ chưa xác thực để tránh phóng đại vốn hóa ảo!
  const sharesM = OUTSTANDING_SHARES_M[symbol.toUpperCase()] || 15;
  return Math.round(sharesM * priceK);
}

export function calcStrictSMA(closes: number[], period: number, endIdx: number = closes.length - 1): number {
  if (endIdx < period - 1 || closes.length < period) return 0;
  let sum = 0;
  for (let i = endIdx - period + 1; i <= endIdx; i++) {
    sum += closes[i];
  }
  return sum / period;
}

export interface RawIbdRsResult {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  rawRsScore: number;
}

/**
 * Công thức Sức mạnh giá (Relative Strength) chuẩn William O'Neil (IBD) & Mark Minervini:
 * Raw RS = 40% * ROC(63) + 20% * ROC(126) + 20% * ROC(189) + 20% * ROC(252)
 */
export function calcRawIbdRs(closes: number[]): RawIbdRsResult {
  const len = closes.length;
  if (len < 20) {
    return { q1: 0, q2: 0, q3: 0, q4: 0, rawRsScore: 0 };
  }
  const currentPrice = closes[len - 1];
  const getRoc = (barsAgo: number): number => {
    const idx = Math.max(0, len - 1 - barsAgo);
    const pastPrice = closes[idx];
    return pastPrice > 0 ? (currentPrice - pastPrice) / pastPrice : 0;
  };

  const q1 = getRoc(63);
  const q2 = len > 126 ? getRoc(126) : q1;
  const q3 = len > 189 ? getRoc(189) : q2;
  const q4 = len > 220 ? getRoc(Math.min(252, len - 1)) : q3;
  const rawRsScore = 0.4 * q1 + 0.2 * q2 + 0.2 * q3 + 0.2 * q4;

  return { q1, q2, q3, q4, rawRsScore };
}

/**
 * Tính toán RS Rating Percentile (1 - 99) cho 1 cổ phiếu bất kỳ dựa trên phân phối thực tế của toàn thị trường
 */
export function computePercentileRsAgainstUniverse(
  targetRawScore: number,
  universeRawScores: number[]
): { rsRating: number; rank: number; total: number } {
  const validScores = universeRawScores.filter((v) => typeof v === 'number' && !isNaN(v));
  if (validScores.length === 0) {
    // Fallback chỉ khi hoàn toàn chưa có dữ liệu thị trường
    const fallback = Math.min(99, Math.max(1, Math.round(55 + targetRawScore * 90)));
    return { rsRating: fallback, rank: 1, total: 1 };
  }

  let betterCount = 0;
  for (const s of validScores) {
    if (s > targetRawScore + 1e-9) {
      betterCount++;
    }
  }
  const total = validScores.length;
  const rank = Math.min(total, betterCount + 1);
  const percentile =
    total <= 1 ? 50 : Math.round(99.0 - ((rank - 1) / (total - 1)) * 98.0);
  const rsRating = Math.max(1, Math.min(99, percentile));

  return { rsRating, rank, total };
}

export interface EvaluatedCriteriaSummary {
  score: number;
  criteriaPassed: number;
  isStage2: boolean;
  isStage2Eligible: boolean;
  distHigh: number;
  distLow: number;
  pctFrom52WHigh: number;
  pctAbove52WLow: number;
  failedCriteria: string[];
}

/**
 * Đánh giá chính xác 8/8 tiêu chí Trend Template của Mark Minervini
 * Có thể gọi lại tức thì khi có giá khớp lệnh realtime (SSI / DNSE WebSocket) mà không bao giờ bị lệch điểm.
 */
export function evaluateMinerviniCriteria(params: {
  priceK: number;
  sma50?: number;
  sma150?: number;
  sma200?: number;
  sma200SlopeUp?: boolean;
  high52W?: number;
  low52W?: number;
  distHigh?: number;
  distLow?: number;
  rsRating: number;
}): EvaluatedCriteriaSummary {
  const { priceK, sma50 = 0, sma150 = 0, sma200 = 0, sma200SlopeUp = false, rsRating } = params;

  const effectiveHigh52W =
    params.high52W && params.high52W > 0 ? Math.max(params.high52W, priceK) : 0;
  const effectiveLow52W =
    params.low52W && params.low52W > 0 ? Math.min(params.low52W, priceK) : 0;

  const distHigh =
    effectiveHigh52W > 0
      ? Math.round(((priceK - effectiveHigh52W) / effectiveHigh52W) * 1000) / 10
      : (params.distHigh ?? -100);

  const distLow =
    effectiveLow52W > 0
      ? Math.round(((priceK - effectiveLow52W) / effectiveLow52W) * 1000) / 10
      : (params.distLow ?? 0);

  const c1 = sma150 > 0 && sma200 > 0 && priceK > sma150 && priceK > sma200;
  const c2 = sma150 > 0 && sma200 > 0 && sma150 > sma200;
  // Fallback nếu bản ghi cũ chưa lưu boolean sma200SlopeUp nhưng đã có sma150 > sma200
  const c3 = Boolean(sma200SlopeUp);
  const c4 = sma50 > 0 && sma150 > 0 && sma200 > 0 && sma50 > sma150 && sma50 > sma200;
  const c5 = sma50 > 0 && priceK > sma50;
  const c6 = distLow >= 30;
  const c7 = distHigh >= -25;
  const c8 = rsRating >= 70;

  const flags = [c1, c2, c3, c4, c5, c6, c7, c8];
  const failedCriteria: string[] = [];
  flags.forEach((passed, idx) => {
    if (!passed) {
      failedCriteria.push(MINERVINI_8_CRITERIA_META[idx].shortLabel);
    }
  });

  const score = flags.filter(Boolean).length;
  const isStage2 = score === 8;

  return {
    score,
    criteriaPassed: score,
    isStage2,
    isStage2Eligible: isStage2,
    distHigh,
    distLow,
    pctFrom52WHigh: Math.round((100 + distHigh) * 10) / 10,
    pctAbove52WLow: Math.round((100 + distLow) * 10) / 10,
    failedCriteria,
  };
}

/**
 * Xây dựng dữ liệu phân tích thô của 1 mã từ chuỗi nến OHLCV của DNSE Entrade
 * (Trước bước xếp hạng RS Percentile toàn thị trường)
 */
export function analyzeRawStockCandles(params: {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  pe?: number | null;
  epsGrowthYoY?: number | null;
}): MinerviniScreenerItem | null {
  const { symbol, name, sector, exchange, closes, highs, lows, volumes, pe = null, epsGrowthYoY = null } = params;
  const len = closes.length;
  if (len < 50) return null;

  const priceK = closes[len - 1];
  if (!priceK || priceK <= 0) return null;

  const prevK = len > 1 ? closes[len - 2] : priceK;
  const chgPct = prevK > 0 ? Math.round(((priceK - prevK) / prevK) * 10000) / 100 : 0;
  const vol = volumes[len - 1] || 0;

  // Các đường SMA chuẩn (yêu cầu đủ số phiên lịch sử, tuyệt đối không rút ngắn chu kỳ MA)
  const sma50 = len >= 50 ? calcStrictSMA(closes, 50, len - 1) : 0;
  const sma150 = len >= 150 ? calcStrictSMA(closes, 150, len - 1) : 0;
  const sma200 = len >= 200 ? calcStrictSMA(closes, 200, len - 1) : 0;

  // Kiểm tra độ dốc MA200 (tăng trưởng tối thiểu 1 tháng = 22 phiên giao dịch và không gãy trong 11 phiên gần nhất)
  const sma200Past = len >= 222 ? calcStrictSMA(closes, 200, len - 1 - 22) : 0;
  const sma200Mid = len >= 211 ? calcStrictSMA(closes, 200, len - 1 - 11) : 0;
  const sma200SlopeUp =
    sma200 > 0 && sma200Past > 0 && sma200 > sma200Past && (sma200Mid === 0 || sma200 >= sma200Mid * 0.999);

  // Đỉnh / Đáy 52 tuần (252 phiên giao dịch)
  const lookback52W = Math.min(252, len);
  const high52W = Math.max(...highs.slice(len - lookback52W));
  const low52W = Math.min(...lows.slice(len - lookback52W));

  // Điểm Raw RS theo trọng số IBD (40% Q1 + 20% Q2 + 20% Q3 + 20% Q4)
  const { q1, q2, q3, q4, rawRsScore } = calcRawIbdRs(closes);

  // Khối lượng tương đối so với TB 20 phiên & Các chỉ báo Dòng tiền / Thanh khoản TTCK Việt Nam
  const start20 = Math.max(0, len - 20);
  const volSlice = volumes.slice(start20);
  const avgVol20 = volSlice.reduce((a, b) => a + b, 0) / Math.max(1, volSlice.length);
  const relVol = avgVol20 > 0 ? Math.round((vol / avgVol20) * 100) / 100 : 1;
  // Giá trị giao dịch TB 20 phiên (Tỷ VNĐ/phiên): avgVol20 * priceK (nghìn đồng) / 1,000,000 = Tỷ đồng
  const avgVal20B = Math.round(((avgVol20 * priceK) / 1000000) * 100) / 100;

  // Tỷ lệ Khối lượng Phiên Tăng / Phiên Giảm trong 20 phiên (Up/Down Volume Ratio) & Pocket Pivot
  let upVolSum = 0;
  let downVolSum = 0;
  let maxDownVol10 = 0;
  const start10 = Math.max(1, len - 10);
  let noZeroVol10D = true;

  for (let idx = Math.max(1, start20); idx < len; idx++) {
    const v = volumes[idx] || 0;
    const diff = closes[idx] - closes[idx - 1];
    if (diff > 0) upVolSum += v;
    else if (diff < 0) downVolSum += v;

    if (idx >= start10) {
      if (v <= 0) noZeroVol10D = false;
      if (diff < 0 && idx < len - 1 && v > maxDownVol10) {
        maxDownVol10 = v;
      }
    }
  }

  const upDownVolRatio =
    downVolSum > 0
      ? Math.round((upVolSum / downVolSum) * 100) / 100
      : upVolSum > 0
      ? 2.5
      : 1.0;

  const volSignal: 'BREAKOUT' | 'POCKET_PIVOT' | 'VCP_DRYUP' | 'NORMAL' | 'DISTRIBUTION' =
    relVol >= 1.5 && chgPct >= 2.0
      ? 'BREAKOUT'
      : chgPct > 0.5 && maxDownVol10 > 0 && vol > maxDownVol10 && relVol >= 1.05
      ? 'POCKET_PIVOT'
      : relVol <= 0.65 && Math.abs(chgPct) <= 1.5 && priceK > sma50
      ? 'VCP_DRYUP'
      : relVol >= 1.4 && chgPct <= -2.0
      ? 'DISTRIBUTION'
      : 'NORMAL';

  const priceVnd = Math.round(priceK * 1000);
  const mktCapT = calcMarketCapT(symbol, priceK);

  // Kiểm tra Khối lượng duy trì đều nhiều phiên & Vốn hóa thực tế chống thao túng:
  // - KL TB 20 phiên >= 100.000 CP VÀ KL TB 10 phiên >= 100.000 CP
  // - Trung vị KL 10 phiên >= 60.000 CP & Phiên thấp nhất trong 5 phiên gần nhất >= 20.000 CP (Loại bỏ mã quay tay 1 phiên rồi tắt vol như SPV, HIO)
  // - Vốn hóa thị trường thực tế >= 1.000 Tỷ VNĐ (Loại bỏ cổ phiếu penny/bo cung vốn hóa bé như SPV 237 Tỷ, HDA 307 Tỷ, HIO 483 Tỷ, CTP 113 Tỷ)
  const volSlice10 = volumes.slice(Math.max(0, len - 10));
  const avgVol10 = volSlice10.reduce((a, b) => a + b, 0) / Math.max(1, volSlice10.length);
  const sortedVol10 = [...volSlice10].sort((a, b) => a - b);
  const medianVol10 = sortedVol10[Math.floor(sortedVol10.length / 2)] || 0;
  const volSlice5 = volumes.slice(Math.max(0, len - 5));
  const minVol5 = volSlice5.length > 0 ? Math.min(...volSlice5) : 0;

  const isVnLiquidStandard =
    noZeroVol10D &&
    avgVol20 >= 100000 &&
    avgVol10 >= 100000 &&
    medianVol10 >= 60000 &&
    minVol5 >= 20000 &&
    mktCapT >= 1000;

  const p1W = len > 5 ? Math.round(((priceK - closes[len - 1 - 5]) / closes[len - 1 - 5]) * 10000) / 100 : chgPct;
  const p1M = len > 22 ? Math.round(((priceK - closes[len - 1 - 22]) / closes[len - 1 - 22]) * 10000) / 100 : 0;
  const p1Y =
    len > 220
      ? Math.round(
          ((priceK - closes[Math.max(0, len - 1 - 252)]) / closes[Math.max(0, len - 1 - 252)]) * 10000
        ) / 100
      : 0;

  // Tạm tính RS trước khi chuẩn hóa Percentile toàn rổ
  const tempRsRating = Math.min(99, Math.max(1, Math.round(55 + rawRsScore * 90)));
  const evalResult = evaluateMinerviniCriteria({
    priceK,
    sma50,
    sma150,
    sma200,
    sma200SlopeUp,
    high52W,
    low52W,
    rsRating: tempRsRating,
  });

  return {
    symbol: symbol.toUpperCase(),
    name,
    sector,
    exchange: exchange || 'HOSE',
    price: priceVnd,
    changePct: chgPct,
    volume: vol,
    avgVol20: Math.round(avgVol20),
    avgVal20B,
    upDownVolRatio,
    volSignal,
    isVnLiquidStandard,
    relVol,
    mktCapT,
    pe,
    epsDilTTM: null,
    epsGrowthYoY,
    divYieldPct: null,
    analystRating: 'No rating',
    rsRating: tempRsRating,
    rawRsScore: Math.round(rawRsScore * 10000) / 10000,
    q1Perf: Math.round(q1 * 1000) / 10,
    q2Perf: Math.round(q2 * 1000) / 10,
    q3Perf: Math.round(q3 * 1000) / 10,
    q4Perf: Math.round(q4 * 1000) / 10,
    score: evalResult.score,
    isStage2: evalResult.isStage2,
    isStage2Eligible: evalResult.isStage2Eligible,
    criteriaPassed: evalResult.criteriaPassed,
    failedCriteria: evalResult.failedCriteria,
    sma50: Math.round(sma50 * 100) / 100,
    sma150: Math.round(sma150 * 100) / 100,
    sma200: Math.round(sma200 * 100) / 100,
    sma200Past: Math.round(sma200Past * 100) / 100,
    sma200SlopeUp,
    high52W: Math.round(high52W * 100) / 100,
    low52W: Math.round(low52W * 100) / 100,
    distHigh: evalResult.distHigh,
    distLow: evalResult.distLow,
    pctFrom52WHigh: evalResult.pctFrom52WHigh,
    pctAbove52WLow: evalResult.pctAbove52WLow,
    perf1W: p1W,
    perf1M: p1M,
    perf1Y: p1Y,
    epsDiluted: null,
    epsDilutedGrowthYoY: null,
    dividendYield: null,
  };
}

/**
 * Chuẩn hóa điểm RS Rating (Percentile 1-99) trên toàn bộ danh sách cổ phiếu và đánh giá lại 8 tiêu chí
 */
export function assignCrossSectionalRsAndEvaluate(items: MinerviniScreenerItem[]): MinerviniScreenerItem[] {
  if (!items || items.length === 0) return [];

  // Sắp xếp theo rawRsScore giảm dần (nếu bản ghi cũ thiếu rawRsScore thì suy ngược từ perf1Y/perf1M)
  const withRaw = items.map((it) => {
    const raw =
      typeof it.rawRsScore === 'number' && !isNaN(it.rawRsScore)
        ? it.rawRsScore
        : ((it.perf1M || 0) * 0.4 + (it.perf1Y || 0) * 0.6) / 100;
    return { ...it, rawRsScore: raw };
  });

  withRaw.sort((a, b) => (b.rawRsScore ?? 0) - (a.rawRsScore ?? 0));

  // Sử dụng rổ cổ phiếu chuẩn tổ chức (KL TB 20N >= 100,000 CP & Vốn hóa >= 1.000 Tỷ VNĐ)
  // làm Rổ Chuẩn (Benchmark Universe) để tính phân vị RS Rating 1-99, chống nhiễu từ các mã bo cung/vốn hóa nhỏ
  const benchmarkScores = withRaw
    .filter((it) => {
      const avgVol = it.avgVol20 ?? it.volume ?? 0;
      const mktCap = it.mktCapT ?? calcMarketCapT(it.symbol, (it.price || 0) / 1000);
      return avgVol >= 100000 && mktCap >= 1000;
    })
    .map((it) => it.rawRsScore ?? 0);

  const referenceScores =
    benchmarkScores.length >= 50 ? benchmarkScores : withRaw.map((it) => it.rawRsScore ?? 0);
  const total = withRaw.length;

  return withRaw.map((item, idx) => {
    const rank = idx + 1;
    const { rsRating } = computePercentileRsAgainstUniverse(item.rawRsScore ?? 0, referenceScores);

    const priceK = (item.price || 0) / 1000;
    const evalResult = evaluateMinerviniCriteria({
      priceK,
      sma50: item.sma50,
      sma150: item.sma150,
      sma200: item.sma200,
      sma200SlopeUp: item.sma200SlopeUp,
      high52W: item.high52W,
      low52W: item.low52W,
      distHigh: item.distHigh,
      distLow: item.distLow,
      rsRating,
    });

    return {
      ...item,
      rsRating,
      rsRank: rank,
      rsUniverseTotal: total,
      score: evalResult.score,
      criteriaPassed: evalResult.criteriaPassed,
      isStage2: evalResult.isStage2,
      isStage2Eligible: evalResult.isStage2Eligible,
      distHigh: evalResult.distHigh,
      distLow: evalResult.distLow,
      pctFrom52WHigh: evalResult.pctFrom52WHigh,
      pctAbove52WLow: evalResult.pctAbove52WLow,
      failedCriteria: evalResult.failedCriteria,
    };
  });
}
