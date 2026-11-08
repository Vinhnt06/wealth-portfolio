/**
 * Cronjob Script: Tự động quét Bộ lọc Mark Minervini Trend Template (100% Real Data)
 * Nguồn: DNSE Entrade API (730 ngày = ~500 phiên giao dịch thực tế)
 * Chuẩn hóa:
 * - 8/8 tiêu chí Trend Template Stage 2 nghiêm ngặt của Mark Minervini (SEPA)
 * - RS Rating (1-99 Percentile) xếp hạng chéo toàn thị trường theo trọng số William O'Neil (40% Q1 + 20% Q2 + 20% Q3 + 20% Q4)
 */

const fs = require('fs');
const path = require('path');

const sectorMappingPath = path.resolve(__dirname, '../frontend/src/features/market/data/sectorFullMapping.json');
const sectorFullMapping = JSON.parse(fs.readFileSync(sectorMappingPath, 'utf8'));

const stockDbPath = path.resolve(__dirname, '../frontend/src/features/market/data/stockDatabase.json');
const stockDatabase = JSON.parse(fs.readFileSync(stockDbPath, 'utf8'));

const finDbPath = path.resolve(__dirname, '../frontend/src/features/market/data/financialsDatabase.json');
const financialsData = fs.existsSync(finDbPath) ? JSON.parse(fs.readFileSync(finDbPath, 'utf8')) : { data: {} };
const finMap = financialsData.data || {};

const stockMap = new Map();
stockDatabase.forEach((s) => stockMap.set(s.symbol.toUpperCase(), s));

// Danh sách 188 mã cổ phiếu thanh khoản hàng đầu đại diện đầy đủ 20 ngành ICB
const SECTOR_LEADER_UNIVERSE = [
  // 1. Ngân hàng
  'VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB', 'SHB', 'TPB', 'VIB', 'MSB', 'OCB', 'SSB', 'EIB', 'NAB', 'ABB', 'BAB', 'BVB',
  // 2. Dịch vụ tài chính (Chứng khoán)
  'SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'VIX', 'AGR', 'ORS', 'TVS', 'PHS', 'DSC',
  // 3. Bất động sản & KCN
  'VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'PDR', 'DIG', 'DXG', 'CEO', 'NVL', 'TCH', 'KBC', 'IDC', 'SZC', 'BCM', 'SIP', 'HDG', 'NTL', 'VGC', 'VPI', 'DXS', 'LHG', 'TIP', 'D2D', 'PHR',
  // 4. Nguyên vật liệu (Thép, Hóa chất, Phân bón, Cao su, Xi măng, Khoáng sản)
  'HPG', 'HSG', 'NKG', 'VGS', 'DGC', 'DCM', 'DPM', 'GVR', 'CSV', 'LAS', 'BMP', 'NTP', 'HT1', 'BCC', 'MSR', 'DDV', 'BFC', 'DPR', 'SMC', 'TLH', 'TVN',
  // 5. Năng lượng (Dầu khí)
  'GAS', 'PLX', 'BSR', 'PVD', 'PVS', 'PVT', 'PVP', 'PVC', 'PVB', 'OIL',
  // 6. Tiện ích (Điện, Nước, Khí)
  'POW', 'REE', 'PC1', 'GEG', 'GEE', 'NT2', 'QTP', 'VSH', 'BWE', 'TDM', 'PGV', 'TV2', 'BCG',
  // 7. Thực phẩm, đồ uống (Tiêu dùng, Chăn nuôi, Thủy sản)
  'VNM', 'MSN', 'SAB', 'MCH', 'KDC', 'QNS', 'DBC', 'BAF', 'HAG', 'PAN', 'VHC', 'ANV', 'ASM', 'IDI', 'FMC', 'HNG',
  // 8. Phân phối, bán lẻ
  'MWG', 'FRT', 'DGW', 'PET', 'PNJ', 'AST', 'CLX',
  // 9. Vận tải (Cảng biển, Hàng không, Logistics)
  'GMD', 'HAH', 'VSC', 'VJC', 'HVN', 'VTP', 'PHP', 'SGP', 'VOS', 'VIP', 'VTO',
  // 10. Hàng hóa công nghiệp (Xây dựng, Hạ tầng, Thiết bị)
  'VCG', 'HHV', 'CII', 'CTD', 'FCN', 'LCG', 'C4G', 'GEX', 'SAM',
  // 11. Phần mềm (CNTT)
  'FPT', 'CMG', 'ELC', 'ITD', 'SGT', 'HPT',
  // 12. Viễn thông
  'FOX', 'VGI', 'CTR', 'TTN', 'MFS',
  // 13. Hàng tiêu dùng (Dệt may, Gia dụng)
  'TNG', 'MSH', 'GIL', 'STK', 'TCM', 'VGT', 'GDT', 'SAV',
  // 14. Dược phẩm
  'DHG', 'IMP', 'TRA', 'DVN', 'DBD', 'DMC', 'OPC', 'DCL',
  // 15. Dịch vụ chăm sóc sức khỏe
  'JVC', 'TNH', 'AMV', 'DKP',
  // 16. Ô tô, linh kiện
  'HAX', 'DRC', 'CSM', 'TMT', 'HHS', 'VEA', 'SRC', 'CTF',
  // 17. Bảo hiểm
  'BVH', 'PVI', 'MIG', 'BIC', 'BMI', 'PTI', 'PRE', 'ABI',
  // 18. Truyền thông, giải trí
  'VNZ', 'YEG', 'EID', 'ADC', 'DAE',
  // 19. Dịch vụ thương mại
  'SFI', 'MHC', 'CLC', 'MEC',
  // 20. Dịch vụ tiêu dùng (Du lịch, Khách sạn)
  'DAH', 'TCT', 'WCS', 'OCH', 'DXL',
];

const OUTSTANDING_SHARES_M = {
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

const CRITERIA_LABELS = [
  '1. Giá > MA150 & MA200',
  '2. MA150 > MA200',
  '3. MA200 dốc lên (≥1 tháng)',
  '4. MA50 > MA150 > MA200',
  '5. Giá > MA50',
  '6. Giá ≥ +30% từ đáy 52T',
  '7. Cách đỉnh 52T ≤ 25%',
  '8. RS Rating ≥ 70',
];

async function runMinerviniScan() {
  const t0 = Date.now();
  const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const hours = vnDate.getHours();
  const isMorning = hours < 13;
  const sessionType = isMorning ? 'MORNING' : 'AFTERNOON';
  const sessionLabel = isMorning ? 'Phiên Sáng (11:30)' : 'Phiên Chiều (15:00)';

  // Quét TOÀN BỘ THỊ TRƯỜNG (tất cả ~1.522 mã trên HOSE, HNX, UPCOM trong stockDatabase.json + danh sách dẫn dắt)
  const allDbSymbols = stockDatabase
    .map((s) => (s.symbol || '').trim().toUpperCase())
    .filter((sym) => /^[A-Z0-9]{3}$/.test(sym));
  const uniqueUniverse = Array.from(new Set([...SECTOR_LEADER_UNIVERSE, ...allDbSymbols]));
  console.log(`🚀 [MINERVINI CRON] Bắt đầu quét TOÀN BỘ THỊ TRƯỜNG ${uniqueUniverse.length} mã (HOSE/HNX/UPCOM - ${sessionLabel}) lúc ${vnTime}...`);

  const nowSec = Math.floor(Date.now() / 1000);
  // Tải 730 ngày (2 năm = ~500 phiên giao dịch) để đủ dữ liệu tính chính xác MA200 + độ dốc MA200 + 52W High/Low (252 phiên)
  const fromSec = nowSec - 730 * 24 * 3600;
  // Bỏ qua các mã bị đình chỉ giao dịch lâu ngày (không có giao dịch nào trong 45 ngày gần nhất)
  const activeCutoffSec = nowSec - 45 * 24 * 3600;

  const rawResults = [];

  const batchSize = 60;
  for (let i = 0; i < uniqueUniverse.length; i += batchSize) {
    const batch = uniqueUniverse.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (sym) => {
        try {
          const info = stockMap.get(sym) || { name: sym, exchange: 'HOSE' };
          const sector = sectorFullMapping[sym] || info.sector || 'Khác';
          const fin = finMap[sym];

          const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&symbol=${encodeURIComponent(sym)}&resolution=1D`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          });

          if (!res.ok) return;
          const d = await res.json();
          if (!d.c || d.c.length < 50) return;

          const len = d.c.length;
          // Kiểm tra mã còn đang giao dịch thực tế (tránh mã hủy niêm yết / đình chỉ)
          if (Array.isArray(d.t) && d.t[len - 1] && d.t[len - 1] < activeCutoffSec) return;

          const priceK = d.c[len - 1];
          if (!priceK || priceK <= 0) return;

          const prevK = len > 1 ? d.c[len - 2] : priceK;
          const chgPct = prevK > 0 ? Math.round(((priceK - prevK) / prevK) * 10000) / 100 : 0;
          const vol = d.v[len - 1] || 0;

          // Tính SMA nghiêm ngặt (không rút ngắn chu kỳ nếu thiếu nến)
          const calcSMA = (period, endIdx = len - 1) => {
            if (endIdx < period - 1 || len < period) return 0;
            let sum = 0;
            for (let k = endIdx - period + 1; k <= endIdx; k++) {
              sum += d.c[k];
            }
            return sum / period;
          };

          const rawSma50 = len >= 50 ? calcSMA(50, len - 1) : 0;
          const rawSma150 = len >= 150 ? calcSMA(150, len - 1) : 0;
          const rawSma200 = len >= 200 ? calcSMA(200, len - 1) : 0;

          const rawSma200Past = len >= 222 ? calcSMA(200, len - 1 - 22) : 0;
          const rawSma200Mid = len >= 211 ? calcSMA(200, len - 1 - 11) : 0;
          const sma200SlopeUp =
            rawSma200 > 0 &&
            rawSma200Past > 0 &&
            rawSma200 > rawSma200Past &&
            (rawSma200Mid === 0 || rawSma200 >= rawSma200Mid * 0.999);

          const sma50 = Math.round(rawSma50 * 100) / 100;
          const sma150 = Math.round(rawSma150 * 100) / 100;
          const sma200 = Math.round(rawSma200 * 100) / 100;
          const sma200Past = Math.round(rawSma200Past * 100) / 100;

          // Đỉnh / Đáy 52 tuần (252 phiên giao dịch)
          const lookback = Math.min(252, len);
          const high52W = Math.round(Math.max(...d.h.slice(len - lookback)) * 100) / 100;
          const low52W = Math.round(Math.min(...d.l.slice(len - lookback)) * 100) / 100;

          const distHigh = high52W > 0 ? Math.round(((priceK - high52W) / high52W) * 1000) / 10 : -100;
          const distLow = low52W > 0 ? Math.round(((priceK - low52W) / low52W) * 1000) / 10 : 0;

          // Công thức RS thô chuẩn IBD (40% Q1 + 20% Q2 + 20% Q3 + 20% Q4)
          const getRoc = (barsAgo) => {
            const idx = Math.max(0, len - 1 - barsAgo);
            const past = d.c[idx];
            return past > 0 ? (priceK - past) / past : 0;
          };
          const q1 = getRoc(63);
          const q2 = len > 126 ? getRoc(126) : q1;
          const q3 = len > 189 ? getRoc(189) : q2;
          const q4 = len > 220 ? getRoc(Math.min(252, len - 1)) : q3;
          const rawRsScore = 0.4 * q1 + 0.2 * q2 + 0.2 * q3 + 0.2 * q4;

          // Relative Volume 20 phiên & các chỉ báo Dòng tiền / Thanh khoản TTCK Việt Nam
          const start20 = Math.max(0, len - 20);
          const volSlice = d.v.slice(start20);
          const avgVol20 = volSlice.reduce((a, b) => a + b, 0) / Math.max(1, volSlice.length);
          const relVol = avgVol20 > 0 ? Math.round((vol / avgVol20) * 100) / 100 : 1;
          const avgVal20B = Math.round(((avgVol20 * priceK) / 1000000) * 100) / 100;

          let upVolSum = 0;
          let downVolSum = 0;
          let maxDownVol10 = 0;
          const start10 = Math.max(1, len - 10);
          let noZeroVol10D = true;

          for (let idx = Math.max(1, start20); idx < len; idx++) {
            const v = d.v[idx] || 0;
            const diff = d.c[idx] - d.c[idx - 1];
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

          const volSignal =
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
          // Vốn hóa thị trường thực tế (Tỷ VNĐ): sharesM (triệu CP từ Vietcap IQ) * priceK (nghìn đồng) = Tỷ đồng
          // Tuyệt đối không dùng fallback 100 triệu CP cho mã nhỏ chưa xác thực để tránh vốn hóa ảo!
          const sharesM = OUTSTANDING_SHARES_M[sym] || 15;
          const mktCapT = Math.round(sharesM * priceK);

          // BẮT BUỘC KIỂM TRA KHỐI LƯỢNG DUY TRÌ NHIỀU PHIÊN & VỐN HÓA LỚN CHỐNG THAO TÚNG:
          // 1. KL TB 20 phiên >= 100.000 CP VÀ KL TB 10 phiên >= 100.000 CP
          // 2. Trung vị KL 10 phiên >= 60.000 CP & Phiên thấp nhất trong 5 phiên gần nhất >= 20.000 CP (Loại bỏ mã quay tay 1 phiên rồi tắt vol như SPV, HIO)
          // 3. Vốn hóa thị trường thực tế >= 1.000 Tỷ VNĐ (Loại bỏ triệt để cổ phiếu bé/bo cung dễ thao túng như SPV 237 Tỷ, HDA 307 Tỷ, HIO 483 Tỷ, CTP 113 Tỷ)
          const volSlice10 = d.v.slice(Math.max(0, len - 10));
          const avgVol10 = volSlice10.reduce((a, b) => a + b, 0) / Math.max(1, volSlice10.length);
          const sortedVol10 = [...volSlice10].sort((a, b) => a - b);
          const medianVol10 = sortedVol10[Math.floor(sortedVol10.length / 2)] || 0;
          const volSlice5 = d.v.slice(Math.max(0, len - 5));
          const minVol5 = volSlice5.length > 0 ? Math.min(...volSlice5) : 0;

          const isVnLiquidStandard =
            noZeroVol10D &&
            avgVol20 >= 100000 &&
            avgVol10 >= 100000 &&
            medianVol10 >= 60000 &&
            minVol5 >= 20000 &&
            mktCapT >= 1000;

          if (!isVnLiquidStandard) return;

          const p1W = len > 5 ? Math.round(((priceK - d.c[len - 1 - 5]) / d.c[len - 1 - 5]) * 10000) / 100 : chgPct;
          const p1M = len > 22 ? Math.round(((priceK - d.c[len - 1 - 22]) / d.c[len - 1 - 22]) * 10000) / 100 : 0;
          const p1Y =
            len > 220
              ? Math.round(((priceK - d.c[Math.max(0, len - 1 - 252)]) / d.c[Math.max(0, len - 1 - 252)]) * 10000) / 100
              : 0;

          rawResults.push({
            symbol: sym,
            name: info.name,
            sector,
            exchange: info.exchange || 'HOSE',
            price: priceVnd,
            priceK,
            changePct: chgPct,
            volume: vol,
            avgVol20: Math.round(avgVol20),
            avgVal20B,
            upDownVolRatio,
            volSignal,
            isVnLiquidStandard,
            relVol,
            mktCapT,
            pe: fin?.pe ?? null,
            epsDilTTM: null,
            epsGrowthYoY: fin?.earningsGrowthYoY ?? null,
            divYieldPct: null,
            analystRating: 'No rating',
            rawRsScore: Math.round(rawRsScore * 10000) / 10000,
            q1Perf: Math.round(q1 * 1000) / 10,
            q2Perf: Math.round(q2 * 1000) / 10,
            q3Perf: Math.round(q3 * 1000) / 10,
            q4Perf: Math.round(q4 * 1000) / 10,
            sma50,
            sma150,
            sma200,
            sma200Past,
            sma200SlopeUp,
            high52W,
            low52W,
            distHigh,
            distLow,
            pctFrom52WHigh: Math.round((100 + distHigh) * 10) / 10,
            pctAbove52WLow: Math.round((100 + distLow) * 10) / 10,
            perf1W: p1W,
            perf1M: p1M,
            perf1Y: p1Y,
            epsDiluted: null,
            epsDilutedGrowthYoY: null,
            dividendYield: null,
          });
        } catch (err) {
          // ignore single stock fetch error
        }
      })
    );
  }

  // Bước 2: Xếp hạng chéo toàn thị trường (Cross-Sectional Percentile Rank 1 - 99) theo chuẩn William O'Neil / IBD
  // Dùng rổ cổ phiếu có thanh khoản thật (KL TB 20N >= 30,000 CP hoặc GTGD >= 0.5 Tỷ/phiên & Giá >= 5,000đ)
  // làm Rổ Chuẩn (Benchmark Universe) để chống nhiễu từ các mã bo cung 100 CP trên UPCoM
  rawResults.sort((a, b) => b.rawRsScore - a.rawRsScore);
  const benchmarkScores = rawResults
    .filter((it) => it.price >= 5000 && (it.avgVol20 >= 30000 || it.avgVal20B >= 0.5))
    .map((it) => it.rawRsScore);
  const refScores = benchmarkScores.length >= 50 ? benchmarkScores : rawResults.map((it) => it.rawRsScore);
  const refTotal = refScores.length;
  const total = rawResults.length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const rsRatingsMapObj = {};

  const results = rawResults.map((item, idx) => {
    const rank = idx + 1;
    let betterCount = 0;
    for (const s of refScores) {
      if (s > item.rawRsScore + 1e-9) betterCount++;
    }
    const refRank = Math.min(refTotal, betterCount + 1);
    const rsRating =
      refTotal <= 1
        ? 50
        : Math.max(1, Math.min(99, Math.round(99.0 - ((refRank - 1) / (refTotal - 1)) * 98.0)));

    const { priceK, sma50, sma150, sma200, sma200SlopeUp, distLow, distHigh } = item;

    // Bước 3: Kiểm tra nghiêm ngặt 8/8 tiêu chí Trend Template của Mark Minervini
    const c1 = sma150 > 0 && sma200 > 0 && priceK > sma150 && priceK > sma200;
    const c2 = sma150 > 0 && sma200 > 0 && sma150 > sma200;
    const c3 = Boolean(sma200SlopeUp);
    const c4 = sma50 > 0 && sma150 > 0 && sma200 > 0 && sma50 > sma150 && sma50 > sma200;
    const c5 = sma50 > 0 && priceK > sma50;
    const c6 = distLow >= 30;
    const c7 = distHigh >= -25;
    const c8 = rsRating >= 70;

    const flags = [c1, c2, c3, c4, c5, c6, c7, c8];
    const failedCriteria = [];
    flags.forEach((passed, fIdx) => {
      if (!passed) failedCriteria.push(CRITERIA_LABELS[fIdx]);
    });

    const score = flags.filter(Boolean).length;
    const isStage2 = score === 8;
    const isStage2Eligible = score === 8;

    rsRatingsMapObj[item.symbol] = {
      symbol: item.symbol,
      rsRating,
      rank,
      totalStocks: total,
      rawScore: Math.round(item.rawRsScore * 1000) / 1000,
      q1Perf: item.q1Perf,
      q2Perf: item.q2Perf,
      q3Perf: item.q3Perf,
      q4Perf: item.q4Perf,
      currentPrice: item.priceK,
      calculatedDate: todayStr,
    };

    const { priceK: _omit, ...cleanItem } = item;
    return {
      ...cleanItem,
      rsRating,
      rsRank: rank,
      rsUniverseTotal: total,
      score,
      isStage2,
      isStage2Eligible,
      criteriaPassed: score,
      failedCriteria,
    };
  });

  const stage2Count = results.filter((s) => s.isStage2).length;
  const nearStage2Count = results.filter((s) => s.score === 7).length;
  const leadersCount = results.filter((s) => s.rsRating >= 90).length;

  const outputPayload = {
    success: true,
    scannedAt: Date.now(),
    scannedAtText: vnTime,
    session: sessionType,
    sessionLabel,
    totalScanned: results.length,
    stage2Count,
    nearStage2Count,
    leadersCount,
    source: '100% REAL DNSE ENTRADE API (730D IBD PERCENTILE)',
    data: results,
  };

  const outputPath = path.resolve(__dirname, '../frontend/src/features/market/data/lastMinerviniScan.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputPayload, null, 2), 'utf8');

  // Đồng bộ file stock_rs_ratings.json cho Backend & Leaderboard
  const rsDataDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(rsDataDir)) {
    fs.mkdirSync(rsDataDir, { recursive: true });
  }
  fs.writeFileSync(path.resolve(rsDataDir, 'stock_rs_ratings.json'), JSON.stringify(rsRatingsMapObj, null, 2), 'utf8');

  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`✅ [MINERVINI CRON] Hoàn tất quét ${results.length} mã trong ${elapsedSec}s!`);
  console.log(`   - Đạt chuẩn Trend Template Stage 2 (8/8): ${stage2Count} mã`);
  console.log(`   - Tiệm cận Stage 2 (7/8): ${nearStage2Count} mã`);
  console.log(`   - Top Leaders (RS >= 90): ${leadersCount} mã`);
  console.log(`   - Đã lưu file kết quả: ${outputPath}`);
}

runMinerviniScan().catch((err) => {
  console.error('[CRON ERROR]', err);
  process.exit(1);
});
