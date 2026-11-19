/**
 * Bản tiếng Anh cho dữ liệu phân tích Minervini / Wyckoff do API trả về bằng tiếng Việt.
 * Khoá theo mã tiêu chí / mã pha / mã điểm mua để không phụ thuộc vào câu chữ tiếng Việt.
 */
export type Lang = 'vi' | 'en';

export const TREND_LABEL_EN: Record<number, string> = {
  1: 'Price > MA150 and > MA200',
  2: 'MA150 > MA200',
  3: 'MA200 rising (≥ 1 month)',
  4: 'MA50 above MA150 and MA200',
  5: 'Price > MA50',
  6: 'Price ≥ 30% above 52-week low',
  7: 'Price within 25% of 52-week high',
  8: 'Relative Strength (RS) Rating ≥ 70',
};

export const WYCKOFF_LABEL_EN: Record<number, string> = {
  1: 'Higher highs & higher lows (HH-HL)',
  2: '40-session base tightening (range < 30%)',
  3: 'Price in upper half of the base (trading range)',
  4: 'Supply dries up on pullbacks (No Supply / VDU)',
  5: 'SOS / Pocket Pivot candle — money flowing in',
  6: 'Base low not violated (last 10 sessions)',
  7: 'Spread widening on up moves (VSA)',
  8: 'Supply absorbed at resistance',
};

export const PHASE_NAME_EN: Record<string, { eyebrow: string; title: string }> = {
  'Phase A': { eyebrow: 'Phase A', title: 'Stopping the decline (SC / AR)' },
  'Phase B': { eyebrow: 'Phase B', title: 'Sideways accumulation' },
  'Phase C': { eyebrow: 'Phase C', title: 'Spring / supply test' },
  'Phase D': { eyebrow: 'Phase D', title: 'SOS / LPS' },
  'Phase E': { eyebrow: 'Phase E', title: 'Markup — leaving the base' },
};

export const PHASE_TAG_EN = ['Decline stops', 'Accumulation', 'Shakeout', 'SOS / LPS', 'Breakout'];

export const MILESTONE_EN: Record<string, string> = {
  'Phase A': 'Form a Selling Climax (SC) and an Automatic Rally (AR) to define the accumulation range.',
  'Phase B': 'A Spring shakeout on dried-up supply (Phase C) or a high-volume SOS above the base midpoint (Phase D).',
  'Phase C': 'A high-volume SOS candle through the upper half of the base to move into Phase D.',
  'Phase D': 'A decisive breakout above the range resistance (JAC) to enter Phase E.',
  'Phase E': 'Stay with the markup trend, take profits at targets and trail the stop under the MA20.',
};

/** Tiêu đề + mô tả tín hiệu theo mã điểm mua (và theo pha khi chưa có điểm mua) */
export const SIGNAL_EN: Record<string, [string, string]> = {
  BUY_1_SPRING: ['BUY POINT #1', 'Phase C — Spring test on dried-up supply (probe 20–30%)'],
  BUY_2_LPS: ['STANDARD BUY POINT #2', 'Phase D — SOS / LPS (core position 40–50%)'],
  BUY_3_BREAKOUT_BU: ['BUY POINT #3', 'Breakout above the base / BU (add 20–30%)'],
  HOLD_MARKUP: ['HOLD', 'Phase E has run far from the base — do not chase, hold winners'],
  NONE_A: ['DO NOT BUY', 'Phase A — still falling; wait for a trading range to form'],
  NONE_B: ['NOT YET', 'Phase B — sideways accumulation; wait for Phase C / D'],
};

/** Thay các cụm tiếng Việt trong chuỗi giá trị (vùng mua, cắt lỗ, chi tiết tiêu chí) */
const VALUE_TOKENS: [RegExp, string][] = [
  [/Chờ tín hiệu quanh/g, 'Watch around'],
  [/Chờ chỉnh về/g, 'Wait for pullback to'],
  [/Chờ quanh/g, 'Wait near'],
  [/Đứng ngoài/g, 'Stay out'],
  [/dưới đáy nền/g, 'below base low'],
  [/Chưa đủ dữ liệu/g, 'Not enough data'],
  [/Hôm nay SOS/g, 'SOS today'],
  [/Chưa có SOS/g, 'No SOS'],
  [/nến SOS/g, 'SOS candles'],
  [/phiên VDU/g, 'VDU sessions'],
  [/phiên trước/g, 'sessions ago'],
  [/p trước/g, ' bars ago'],
  [/Nửa sau/g, '2nd half'],
  [/chiều cao nền/g, 'of base height'],
  [/Vol giảm/g, 'Vol down'],
  [/Đóng nến/g, 'Close at'],
  [/Đáy nền/g, 'Base low'],
  [/Đáy/g, 'Low'],
  [/Đỉnh/g, 'High'],
  [/đỉnh/g, 'high'],
  [/ TB50/g, ' 50D avg'],
  [/ TB/g, ' avg'],
  [/Vol T\/G/g, 'Up/Down Vol'],
  [/Spread T\/G/g, 'Up/Down spread'],
];

export const translateValue = (v: string | undefined, lang: Lang): string => {
  if (!v || lang !== 'en') return v || '';
  return VALUE_TOKENS.reduce((acc, [rx, rep]) => acc.replace(rx, rep), v);
};
