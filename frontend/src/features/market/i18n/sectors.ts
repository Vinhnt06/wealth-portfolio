/**
 * Tên ngành (nguồn tiếng Việt) → tiếng Anh. Dùng chung cho mọi màn hình hiển thị tên ngành.
 * Ngành chưa có trong bảng sẽ hiển thị nguyên văn tiếng Việt.
 */
export const SECTOR_EN: Record<string, string> = {
  'Tiện ích': 'Utilities',
  'Nguyên vật liệu': 'Basic Materials',
  'Phân phối, bán lẻ': 'Retail & Distribution',
  'Bất động sản': 'Real Estate',
  'Ngân hàng': 'Banking',
  'Dịch vụ tài chính': 'Financial Services',
  'Dịch vụ tiêu dùng': 'Consumer Services',
  'Hàng hóa công nghiệp': 'Industrial Goods',
  'Vận tải': 'Transportation',
  'Ô tô, linh kiện': 'Automotive & Parts',
  'Thực phẩm, đồ uống': 'Food & Beverage',
  'Năng lượng': 'Energy',
  'Dược phẩm': 'Pharmaceuticals',
  'Hàng tiêu dùng': 'Consumer Goods',
  'Thương mại & Dịch vụ': 'Trade & Services',
  'Bảo hiểm': 'Insurance',
  'Dịch vụ thương mại': 'Commercial Services',
  'Viễn thông': 'Telecommunications',
  'Truyền thông, giải trí': 'Media & Entertainment',
  'Phần mềm': 'Software',
  'Dịch vụ chăm sóc sức khỏe': 'Healthcare Services',
  Thép: 'Steel',
  'Công nghệ': 'Technology',
  'Bán lẻ': 'Retail',
};

export const sectorLabel = (vi: string | undefined, lang: 'vi' | 'en'): string => {
  if (!vi) return '';
  return lang === 'en' ? SECTOR_EN[vi] || vi : vi;
};

/** Nhãn trạng thái định giá của danh sách PEG */
export const VALUATION_STATUS_EN: Record<string, string> = {
  Rẻ: 'Cheap',
  'Hấp dẫn': 'Attractive',
  'Tăng trưởng': 'Growth',
  'Chiết khấu': 'Discount',
};
