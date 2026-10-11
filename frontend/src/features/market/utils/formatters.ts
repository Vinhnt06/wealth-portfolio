/**
 * Format trading volume in a clean, professional, compact financial style:
 * - >= 1,000,000: Display with 'M' suffix (e.g., 73.10M, 9.40M, 20.16M)
 * - >= 1,000: Display with 'K' suffix (e.g., 850.2K, 52.1K)
 * - < 1,000: Display as plain integer (e.g., 500)
 */
export const formatCompactVolume = (volume?: number | null): string => {
  if (volume === undefined || volume === null || isNaN(volume)) return '--';
  const abs = Math.abs(volume);
  if (abs >= 1_000_000) {
    const val = volume / 1_000_000;
    return `${val.toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    const val = volume / 1_000;
    return `${val.toFixed(1)}K`;
  }
  return volume.toLocaleString('vi-VN');
};
