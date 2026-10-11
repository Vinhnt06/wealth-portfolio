/**
 * Chuẩn phân ngành ngành nghề thị trường chứng khoán Việt Nam (ICB)
 * Dành cho Screener Minervini, Heatmap, và Market Analysis.
 * Tập hợp các cổ phiếu hàng đầu (Leaders & Top thanh khoản) cho từng ngành.
 */
export const SECTOR_MAPPING: Record<string, string> = {
  // 1. Ngân hàng (18 mã thanh khoản cao nhất)
  VCB: 'Ngân hàng',
  BID: 'Ngân hàng',
  CTG: 'Ngân hàng',
  TCB: 'Ngân hàng',
  MBB: 'Ngân hàng',
  ACB: 'Ngân hàng',
  VPB: 'Ngân hàng',
  HDB: 'Ngân hàng',
  STB: 'Ngân hàng',
  LPB: 'Ngân hàng',
  SHB: 'Ngân hàng',
  TPB: 'Ngân hàng',
  VIB: 'Ngân hàng',
  MSB: 'Ngân hàng',
  OCB: 'Ngân hàng',
  SSB: 'Ngân hàng',
  EIB: 'Ngân hàng',
  NAB: 'Ngân hàng',

  // 2. Chứng khoán (14 mã tiêu biểu)
  SSI: 'Chứng khoán',
  VND: 'Chứng khoán',
  VCI: 'Chứng khoán',
  HCM: 'Chứng khoán',
  SHS: 'Chứng khoán',
  MBS: 'Chứng khoán',
  FTS: 'Chứng khoán',
  BSI: 'Chứng khoán',
  CTS: 'Chứng khoán',
  VIX: 'Chứng khoán',
  AGR: 'Chứng khoán',
  ORS: 'Chứng khoán',
  TVS: 'Chứng khoán',
  PHS: 'Chứng khoán',

  // 3. Bất động sản Dân dụng (17 mã tiêu biểu)
  VHM: 'Bất động sản',
  VIC: 'Bất động sản',
  VRE: 'Bất động sản',
  KDH: 'Bất động sản',
  NLG: 'Bất động sản',
  PDR: 'Bất động sản',
  DIG: 'Bất động sản',
  DXG: 'Bất động sản',
  CEO: 'Bất động sản',
  NVL: 'Bất động sản',
  TCH: 'Bất động sản',
  HQC: 'Bất động sản',
  DRH: 'Bất động sản',
  KHG: 'Bất động sản',
  VPI: 'Bất động sản',
  HDG: 'Bất động sản',
  DXS: 'Bất động sản',
  NTL: 'Bất động sản',

  // 4. Bất động sản Khu công nghiệp (10 mã tiêu biểu)
  KBC: 'BĐS Khu công nghiệp',
  IDC: 'BĐS Khu công nghiệp',
  VGC: 'BĐS Khu công nghiệp',
  SZC: 'BĐS Khu công nghiệp',
  BCM: 'BĐS Khu công nghiệp',
  TIP: 'BĐS Khu công nghiệp',
  LHG: 'BĐS Khu công nghiệp',
  SIP: 'BĐS Khu công nghiệp',
  D2D: 'BĐS Khu công nghiệp',
  PHR: 'BĐS Khu công nghiệp',

  // 5. Thép & Kim loại (7 mã tiêu biểu)
  HPG: 'Thép & Kim loại',
  HSG: 'Thép & Kim loại',
  NKG: 'Thép & Kim loại',
  VGS: 'Thép & Kim loại',
  SMC: 'Thép & Kim loại',
  TLH: 'Thép & Kim loại',
  TVN: 'Thép & Kim loại',

  // 6. Công nghệ & Viễn thông (8 mã tiêu biểu)
  FPT: 'Công nghệ & Viễn thông',
  CMG: 'Công nghệ & Viễn thông',
  ELC: 'Công nghệ & Viễn thông',
  FOX: 'Công nghệ & Viễn thông',
  VGI: 'Công nghệ & Viễn thông',
  CTR: 'Công nghệ & Viễn thông',
  VNZ: 'Công nghệ & Viễn thông',
  ITD: 'Công nghệ & Viễn thông',

  // 7. Dầu khí (9 mã tiêu biểu)
  GAS: 'Dầu khí',
  PLX: 'Dầu khí',
  BSR: 'Dầu khí',
  PVD: 'Dầu khí',
  PVS: 'Dầu khí',
  PVT: 'Dầu khí',
  PVP: 'Dầu khí',
  PVC: 'Dầu khí',
  PVB: 'Dầu khí',

  // 8. Điện & Tiện ích (10 mã tiêu biểu)
  POW: 'Điện & Tiện ích',
  REE: 'Điện & Tiện ích',
  PC1: 'Điện & Tiện ích',
  GEG: 'Điện & Tiện ích',
  GEE: 'Điện & Tiện ích',
  NT2: 'Điện & Tiện ích',
  QTP: 'Điện & Tiện ích',
  VSH: 'Điện & Tiện ích',
  TV2: 'Điện & Tiện ích',
  BCG: 'Điện & Tiện ích',

  // 9. Hóa chất & Phân bón (11 mã tiêu biểu)
  DGC: 'Hóa chất & Phân bón',
  DCM: 'Hóa chất & Phân bón',
  DPM: 'Hóa chất & Phân bón',
  CSV: 'Hóa chất & Phân bón',
  BFC: 'Hóa chất & Phân bón',
  LAS: 'Hóa chất & Phân bón',
  GVR: 'Hóa chất & Phân bón',
  DPR: 'Hóa chất & Phân bón',
  DRC: 'Hóa chất & Phân bón',
  DDV: 'Hóa chất & Phân bón',

  // 10. Bán lẻ & Hàng tiêu dùng (9 mã tiêu biểu)
  MWG: 'Bán lẻ & Tiêu dùng',
  FRT: 'Bán lẻ & Tiêu dùng',
  DGW: 'Bán lẻ & Tiêu dùng',
  PNJ: 'Bán lẻ & Tiêu dùng',
  MSN: 'Bán lẻ & Tiêu dùng',
  VNM: 'Bán lẻ & Tiêu dùng',
  SAB: 'Bán lẻ & Tiêu dùng',
  KDC: 'Bán lẻ & Tiêu dùng',
  MCH: 'Bán lẻ & Tiêu dùng',

  // 11. Thủy sản & Nông nghiệp (9 mã tiêu biểu)
  VHC: 'Thủy sản & Nông nghiệp',
  ANV: 'Thủy sản & Nông nghiệp',
  ASM: 'Thủy sản & Nông nghiệp',
  IDI: 'Thủy sản & Nông nghiệp',
  PAN: 'Thủy sản & Nông nghiệp',
  DBC: 'Thủy sản & Nông nghiệp',
  HAG: 'Thủy sản & Nông nghiệp',
  BAF: 'Thủy sản & Nông nghiệp',
  HNG: 'Thủy sản & Nông nghiệp',

  // 12. Cảng biển & Logistics (9 mã tiêu biểu)
  GMD: 'Cảng biển & Logistics',
  HAH: 'Cảng biển & Logistics',
  VSC: 'Cảng biển & Logistics',
  VTP: 'Cảng biển & Logistics',
  PHP: 'Cảng biển & Logistics',
  PET: 'Cảng biển & Logistics',
  SGP: 'Cảng biển & Logistics',
  VJC: 'Cảng biển & Logistics',
  HVN: 'Cảng biển & Logistics',

  // 13. Xây dựng & Vật liệu (11 mã tiêu biểu)
  VCG: 'Xây dựng & Vật liệu',
  HHV: 'Xây dựng & Vật liệu',
  CII: 'Xây dựng & Vật liệu',
  CTD: 'Xây dựng & Vật liệu',
  FCN: 'Xây dựng & Vật liệu',
  LCG: 'Xây dựng & Vật liệu',
  C4G: 'Xây dựng & Vật liệu',
  HT1: 'Xây dựng & Vật liệu',
  BCC: 'Xây dựng & Vật liệu',
  BMP: 'Xây dựng & Vật liệu',
  NTP: 'Xây dựng & Vật liệu',

  // 14. Dệt may (6 mã tiêu biểu)
  TNG: 'Dệt may',
  MSH: 'Dệt may',
  GIL: 'Dệt may',
  STK: 'Dệt may',
  TCM: 'Dệt may',
  VGT: 'Dệt may',
};

/**
 * Toàn bộ danh sách cổ phiếu tiêu biểu của 14 nhóm ngành (Universe mở rộng 140+ mã)
 */
export const SECTOR_LEADER_UNIVERSE = Object.keys(SECTOR_MAPPING);
