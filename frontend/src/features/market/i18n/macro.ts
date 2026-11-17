/** Tên hàng hóa / chỉ số vĩ mô do API trả về bằng tiếng Việt → tiếng Anh khi hiển thị */
const TOKENS: [RegExp, string][] = [
  [/\s*\((?:vàng miếng|vàng nhẫn|vàng nữ trang|vàng trang sức)\)/gi, ''],
  [/Vàng Thế Giới/gi, 'World Gold'],
  [/Bạc Thế Giới/gi, 'World Silver'],
  [/Dầu Brent \(Thế giới\)/gi, 'Brent Crude'],
  [/Dầu Brent/gi, 'Brent Crude'],
  [/Dầu WTI \(Thế giới\)/gi, 'WTI Crude'],
  [/Dầu WTI/gi, 'WTI Crude'],
  [/Vàng Miếng/gi, 'Gold Bar'],
  [/Vàng Nhẫn/gi, 'Gold Ring'],
  [/Vàng Nữ trang/gi, 'Jewelry Gold'],
  [/Vàng Trang sức/gi, 'Jewelry Gold'],
  [/Tỷ giá/gi, 'Exchange rate'],
  [/Thế giới/gi, 'World'],
  [/Vàng/g, 'Gold'],
  [/Bạc/g, 'Silver'],
  [/Dầu/g, 'Oil'],
];

export const macroName = (name: string | undefined, lang: 'vi' | 'en'): string => {
  if (!name || lang !== 'en') return name || '';
  return TOKENS.reduce((acc, [rx, rep]) => acc.replace(rx, rep), name).replace(/\s{2,}/g, ' ').trim();
};

export const macroSource = (src: string | undefined, lang: 'vi' | 'en'): string => {
  if (!src || lang !== 'en') return src || '';
  return src
    .replace(/Tổng cục Thống kê/g, 'General Statistics Office')
    .replace(/Ngân hàng Nhà nước/g, 'State Bank of Vietnam');
};
