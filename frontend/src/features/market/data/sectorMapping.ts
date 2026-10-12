import sectorFullMapping from './sectorFullMapping.json';

/**
 * Danh sách 20 nhóm ngành chuẩn ICB Cấp 2 của thị trường chứng khoán Việt Nam
 */
export const ICB_20_SECTORS = [
  'Vận tải',
  'Phân phối, bán lẻ',
  'Nguyên vật liệu',
  'Hàng tiêu dùng',
  'Năng lượng',
  'Tiện ích',
  'Thực phẩm, đồ uống',
  'Ngân hàng',
  'Hàng hóa công nghiệp',
  'Bất động sản',
  'Dịch vụ tài chính',
  'Dịch vụ thương mại',
  'Bảo hiểm',
  'Dược phẩm',
  'Truyền thông, giải trí',
  'Ô tô, linh kiện',
  'Dịch vụ tiêu dùng',
  'Viễn thông',
  'Phần mềm',
  'Dịch vụ chăm sóc sức khỏe',
] as const;

export type ICB20Sector = typeof ICB_20_SECTORS[number];

/**
 * Toàn bộ bản đồ phân loại ngành ICB cho 2.060+ mã cổ phiếu Việt Nam
 */
export const SECTOR_MAPPING: Record<string, string> = sectorFullMapping as Record<string, string>;

/**
 * Top 180+ Cổ phiếu Tiêu biểu (Leaders & Thanh khoản cao) bao phủ toàn diện 20 nhóm ngành
 * Được tối ưu để quét siêu tốc qua Entrade/DNSE mà không bị timeout hay nghẽn mạng.
 */
export const SECTOR_LEADER_UNIVERSE: string[] = [
  // 1. Ngân hàng (21 mã thanh khoản cao nhất)
  'VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB', 'SHB', 'TPB', 'VIB', 'MSB', 'OCB', 'SSB', 'EIB', 'NAB', 'ABB', 'BAB', 'BVB',

  // 2. Dịch vụ tài chính (14 mã chứng khoán tiêu biểu)
  'SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'VIX', 'AGR', 'ORS', 'TVS', 'PHS',

  // 3. Bất động sản (18 mã dân dụng & KCN)
  'VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'PDR', 'DIG', 'DXG', 'CEO', 'NVL', 'TCH', 'KBC', 'IDC', 'SZC', 'BCM', 'SIP', 'HDG', 'NTL',

  // 4. Nguyên vật liệu (Thép, Hóa chất, Cao su, Xi măng, Khoáng sản)
  'HPG', 'HSG', 'NKG', 'VGS', 'DGC', 'DCM', 'DPM', 'GVR', 'CSV', 'LAS', 'BMP', 'NTP', 'HT1', 'BCC', 'MSR', 'DDV', 'BFC', 'DPR',

  // 5. Năng lượng (Dầu khí, Khai thác dầu khí)
  'GAS', 'PLX', 'BSR', 'PVD', 'PVS', 'PVT', 'PVP', 'PVC', 'PVB', 'OIL',

  // 6. Tiện ích (Điện, Nước, Phân phối khí)
  'POW', 'REE', 'PC1', 'GEG', 'GEE', 'NT2', 'QTP', 'VSH', 'BWE', 'TDM', 'PGV',

  // 7. Thực phẩm, đồ uống (Thực phẩm, Chăn nuôi, Thủy sản)
  'VNM', 'MSN', 'SAB', 'MCH', 'KDC', 'QNS', 'DBC', 'BAF', 'HAG', 'PAN', 'VHC', 'ANV', 'ASM', 'IDI', 'FMC',

  // 8. Phân phối, bán lẻ
  'MWG', 'FRT', 'DGW', 'PET', 'PNJ', 'AST', 'CLX',

  // 9. Vận tải (Cảng biển, Hàng không, Logistics)
  'GMD', 'HAH', 'VSC', 'VJC', 'HVN', 'VTP', 'PHP', 'SGP', 'VOS', 'VIP', 'VTO',

  // 10. Hàng hóa công nghiệp (Xây dựng, Hạ tầng, Cơ điện)
  'VCG', 'HHV', 'CII', 'CTD', 'FCN', 'LCG', 'C4G', 'GEX', 'SAM',

  // 11. Phần mềm (CNTT & Dịch vụ máy tính)
  'FPT', 'CMG', 'ELC', 'ITD', 'SGT', 'HPT',

  // 12. Viễn thông
  'FOX', 'VGI', 'CTR', 'TTN', 'MFS',

  // 13. Hàng tiêu dùng (Dệt may, Đồ gia dụng)
  'TNG', 'MSH', 'GIL', 'STK', 'TCM', 'VGT', 'GDT', 'SAV',

  // 14. Dược phẩm
  'DHG', 'IMP', 'TRA', 'DVN', 'DBD', 'DMC', 'OPC', 'DCL',

  // 15. Dịch vụ chăm sóc sức khỏe
  'JVC', 'TNH', 'AMV', 'DKP',

  // 16. Ô tô, linh kiện
  'HAX', 'DRC', 'CSM', 'TMT', 'HHS', 'VEA', 'SRC',

  // 17. Bảo hiểm
  'BVH', 'PVI', 'MIG', 'BIC', 'BMI', 'PTI', 'PRE', 'ABI',

  // 18. Truyền thông, giải trí
  'VNZ', 'YEG', 'EID', 'ADC', 'DAE',

  // 19. Dịch vụ thương mại
  'SFI', 'MHC', 'CLC', 'MEC',

  // 20. Dịch vụ tiêu dùng (Du lịch, Khách sạn)
  'DAH', 'TCT', 'WCS', 'OCH', 'DXL',
];

/**
 * Lấy toàn bộ danh sách mã theo một ngành cụ thể trong 20 ngành ICB
 */
export function getSymbolsBySector(sector: string): string[] {
  const norm = sector.trim().toLowerCase();
  const results: string[] = [];
  for (const [sym, sec] of Object.entries(SECTOR_MAPPING)) {
    if (sec.toLowerCase().includes(norm)) {
      results.push(sym);
    }
  }
  return results;
}
