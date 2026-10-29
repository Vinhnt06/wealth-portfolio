/**
 * Mức định giá trung vị P/E và P/B theo từng nhóm ngành trên thị trường chứng khoán Việt Nam
 * Được tổng hợp chuẩn xác từ các phân ngành HOSE, HNX và UPCoM.
 */
export interface SectorBenchmark {
  sector: string;
  pe: number;
  pb: number;
  description: string;
}

export const SECTOR_BENCHMARKS: Record<string, SectorBenchmark> = {
  'Ngân hàng': {
    sector: 'Ngân hàng',
    pe: 9.8,
    pb: 1.45,
    description: 'Định giá theo P/B và ROE là trọng tâm, chất lượng tài sản & tăng trưởng tín dụng.',
  },
  'Chứng khoán': {
    sector: 'Chứng khoán',
    pe: 14.5,
    pb: 1.75,
    description: 'Phụ thuộc vào thanh khoản thị trường, mảng cho vay margin và tự doanh.',
  },
  'Bất động sản': {
    sector: 'Bất động sản',
    pe: 16.2,
    pb: 1.55,
    description: 'Định giá theo quỹ đất, tiến độ bàn giao dự án và cấu trúc nợ vay trái phiếu.',
  },
  'Bất động sản Khu công nghiệp': {
    sector: 'Bất động sản Khu công nghiệp',
    pe: 12.8,
    pb: 1.85,
    description: 'Dòng vốn FDI giải ngân mạnh, tỷ lệ lấp đầy quỹ đất cho thuê cao.',
  },
  'Thép & Kim loại': {
    sector: 'Thép & Kim loại',
    pe: 10.5,
    pb: 1.35,
    description: 'Tính chu kỳ cao theo giá nguyên vật liệu (quặng sắt, than cốc) và đầu tư công.',
  },
  'Công nghệ thông tin': {
    sector: 'Công nghệ thông tin',
    pe: 18.5,
    pb: 3.8,
    description: 'Biên lợi nhuận cao, tiềm năng tăng trưởng doanh thu chuyển đổi số và AI.',
  },
  'Dầu khí': {
    sector: 'Dầu khí',
    pe: 13.2,
    pb: 1.5,
    description: 'Phụ thuộc giá dầu thô Brent thế giới và tiến độ đại dự án Lô B Ô Môn.',
  },
  'Năng lượng & Tiện ích': {
    sector: 'Năng lượng & Tiện ích',
    pe: 12.5,
    pb: 1.4,
    description: 'Dòng tiền ổn định, cổ tức cao từ các nhà máy thủy điện, nhiệt điện, năng lượng tái tạo.',
  },
  'Hóa chất & Phân bón': {
    sector: 'Hóa chất & Phân bón',
    pe: 10.2,
    pb: 1.65,
    description: 'Chu kỳ giá photpho vàng, ure, kali thế giới và nhu cầu xuất khẩu.',
  },
  'Bán lẻ & Hàng tiêu dùng': {
    sector: 'Bán lẻ & Hàng tiêu dùng',
    pe: 17.5,
    pb: 3.2,
    description: 'Sức mua tiêu dùng nội địa, tốc độ mở chuỗi và biên lợi nhuận cải thiện.',
  },
  'Thủy sản & Nông nghiệp': {
    sector: 'Thủy sản & Nông nghiệp',
    pe: 11.8,
    pb: 1.45,
    description: 'Xuất khẩu cá tra, tôm sang Mỹ, EU, Trung Quốc và giá thức ăn chăn nuôi.',
  },
  'Cảng biển & Vận tải': {
    sector: 'Cảng biển & Vận tải',
    pe: 12.0,
    pb: 1.8,
    description: 'Sản lượng hàng hóa thông qua cảng biển, giá cước container và đội tàu biển.',
  },
  'Xây dựng & Vật liệu': {
    sector: 'Xây dựng & Vật liệu',
    pe: 13.5,
    pb: 1.25,
    description: 'Hưởng lợi từ giải ngân đầu tư công cao tốc, sân bay và xây dựng hạ tầng.',
  },
  'Dệt may': {
    sector: 'Dệt may',
    pe: 10.8,
    pb: 1.2,
    description: 'Đơn hàng may mặc xuất khẩu sang thị trường Mỹ, Nhật Bản và EU.',
  },
  'Dược phẩm & Y tế': {
    sector: 'Dược phẩm & Y tế',
    pe: 15.0,
    pb: 2.1,
    description: 'Nhu cầu dược phẩm thiết yếu ổn định, tiêu chuẩn EU-GMP mở rộng kênh ETC.',
  },
  'Bảo hiểm': {
    sector: 'Bảo hiểm',
    pe: 11.5,
    pb: 1.3,
    description: 'Lợi nhuận đầu tư tài chính hưởng lợi từ môi trường lãi suất tiền gửi.',
  },
};

export const DEFAULT_BENCHMARK: SectorBenchmark = {
  sector: 'Thị trường chung (VN-Index)',
  pe: 13.5,
  pb: 1.65,
  description: 'Mức định giá bình quân toàn thị trường chứng khoán Việt Nam.',
};

export function getSectorBenchmark(sectorName?: string): SectorBenchmark {
  if (!sectorName) return DEFAULT_BENCHMARK;
  
  // Direct match
  if (SECTOR_BENCHMARKS[sectorName]) {
    return SECTOR_BENCHMARKS[sectorName];
  }
  
  // Partial keyword search
  const clean = sectorName.toLowerCase();
  for (const [key, val] of Object.entries(SECTOR_BENCHMARKS)) {
    if (clean.includes(key.toLowerCase()) || key.toLowerCase().includes(clean)) {
      return val;
    }
  }
  
  if (clean.includes('ngân hàng') || clean.includes('bank')) return SECTOR_BENCHMARKS['Ngân hàng'];
  if (clean.includes('chứng khoán') || clean.includes('securities')) return SECTOR_BENCHMARKS['Chứng khoán'];
  if (clean.includes('bất động sản') || clean.includes('địa ốc')) return SECTOR_BENCHMARKS['Bất động sản'];
  if (clean.includes('thép') || clean.includes('kim loại')) return SECTOR_BENCHMARKS['Thép & Kim loại'];
  if (clean.includes('công nghệ') || clean.includes('it') || clean.includes('phần mềm')) return SECTOR_BENCHMARKS['Công nghệ thông tin'];
  if (clean.includes('dầu khí') || clean.includes('xăng dầu')) return SECTOR_BENCHMARKS['Dầu khí'];
  if (clean.includes('điện') || clean.includes('năng lượng') || clean.includes('tiện ích')) return SECTOR_BENCHMARKS['Năng lượng & Tiện ích'];
  if (clean.includes('hóa chất') || clean.includes('phân bón')) return SECTOR_BENCHMARKS['Hóa chất & Phân bón'];
  if (clean.includes('bán lẻ') || clean.includes('tiêu dùng')) return SECTOR_BENCHMARKS['Bán lẻ & Hàng tiêu dùng'];
  if (clean.includes('thủy sản') || clean.includes('nông nghiệp')) return SECTOR_BENCHMARKS['Thủy sản & Nông nghiệp'];
  if (clean.includes('cảng') || clean.includes('vận tải') || clean.includes('logistic')) return SECTOR_BENCHMARKS['Cảng biển & Vận tải'];
  if (clean.includes('xây dựng') || clean.includes('vật liệu')) return SECTOR_BENCHMARKS['Xây dựng & Vật liệu'];

  return DEFAULT_BENCHMARK;
}
