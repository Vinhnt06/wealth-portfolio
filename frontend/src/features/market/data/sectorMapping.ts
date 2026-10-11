/**
 * Chuẩn phân ngành ngành nghề thị trường chứng khoán Việt Nam (ICB)
 * Dành cho Screener Minervini, Heatmap, và Market Analysis.
 */
export const SECTOR_MAPPING: Record<string, string> = {
  // 1. Ngân hàng
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
  BAB: 'Ngân hàng',
  BVB: 'Ngân hàng',

  // 2. Chứng khoán
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

  // 3. Bất động sản Dân dụng
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

  // 4. Bất động sản Khu công nghiệp
  KBC: 'BĐS Khu công nghiệp',
  IDC: 'BĐS Khu công nghiệp',
  VGC: 'BĐS Khu công nghiệp',
  SZC: 'BĐS Khu công nghiệp',
  BCM: 'BĐS Khu công nghiệp',

  // 5. Thép & Kim loại
  HPG: 'Thép & Kim loại',
  HSG: 'Thép & Kim loại',
  NKG: 'Thép & Kim loại',
  VGS: 'Thép & Kim loại',
  SMC: 'Thép & Kim loại',
  TLH: 'Thép & Kim loại',

  // 6. Công nghệ Thông tin
  FPT: 'Công nghệ Thông tin',
  CMG: 'Công nghệ Thông tin',
  ELC: 'Công nghệ Thông tin',
  FOX: 'Công nghệ Thông tin',
  VGI: 'Công nghệ Thông tin',
  CTR: 'Công nghệ Thông tin',
  VNZ: 'Công nghệ Thông tin',
  ITD: 'Công nghệ Thông tin',

  // 7. Dầu khí
  GAS: 'Dầu khí',
  PLX: 'Dầu khí',
  BSR: 'Dầu khí',
  PVD: 'Dầu khí',
  PVS: 'Dầu khí',
  PVT: 'Dầu khí',
  PVP: 'Dầu khí',

  // 8. Điện & Tiện ích
  POW: 'Điện & Tiện ích',
  REE: 'Điện & Tiện ích',
  PC1: 'Điện & Tiện ích',
  GEG: 'Điện & Tiện ích',
  GEE: 'Điện & Tiện ích',
  NT2: 'Điện & Tiện ích',

  // 9. Hóa chất, Phân bón & Cao su
  DGC: 'Hóa chất & Phân bón',
  DCM: 'Hóa chất & Phân bón',
  DPM: 'Hóa chất & Phân bón',
  CSV: 'Hóa chất & Phân bón',
  BFC: 'Hóa chất & Phân bón',
  LAS: 'Hóa chất & Phân bón',
  GVR: 'Hóa chất & Cao su',
  PHR: 'Hóa chất & Cao su',
  DPR: 'Hóa chất & Cao su',

  // 10. Bán lẻ & Hàng tiêu dùng
  MWG: 'Bán lẻ & Tiêu dùng',
  FRT: 'Bán lẻ & Tiêu dùng',
  DGW: 'Bán lẻ & Tiêu dùng',
  PNJ: 'Bán lẻ & Tiêu dùng',
  MSN: 'Bán lẻ & Tiêu dùng',
  VNM: 'Bán lẻ & Tiêu dùng',
  SAB: 'Bán lẻ & Tiêu dùng',
  KDC: 'Bán lẻ & Tiêu dùng',
  MCH: 'Bán lẻ & Tiêu dùng',

  // 11. Thủy sản & Nông nghiệp thực phẩm
  VHC: 'Thủy sản & Nông nghiệp',
  ANV: 'Thủy sản & Nông nghiệp',
  DBC: 'Thực phẩm & Chăn nuôi',
  HAG: 'Thực phẩm & Chăn nuôi',
  BAF: 'Thực phẩm & Chăn nuôi',

  // 12. Cảng biển & Logistics
  GMD: 'Cảng biển & Logistics',
  HAH: 'Cảng biển & Logistics',
  VSC: 'Cảng biển & Logistics',
  VTP: 'Cảng biển & Logistics',
  PHP: 'Cảng biển & Logistics',
  PET: 'Cảng biển & Logistics',
  VJC: 'Hàng không & Vận tải',
  HVN: 'Hàng không & Vận tải',

  // 13. Xây dựng, Hạ tầng & Vật liệu
  VCG: 'Xây dựng & Hạ tầng',
  HHV: 'Xây dựng & Hạ tầng',
  CII: 'Xây dựng & Hạ tầng',
  CTD: 'Xây dựng & Hạ tầng',
  FCN: 'Xây dựng & Hạ tầng',
  HT1: 'Vật liệu Xây dựng',
  BCC: 'Vật liệu Xây dựng',
  BMP: 'Vật liệu Xây dựng',
  NTP: 'Vật liệu Xây dựng',

  // 14. Dệt may
  TNG: 'Dệt may',
  MSH: 'Dệt may',
  GIL: 'Dệt may',
  STK: 'Dệt may',
};
