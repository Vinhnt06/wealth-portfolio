/**
 * Máy chẩn đoán Wyckoff & VSA — module thuần (tách nguyên văn từ API phân tích để kiểm thử được trên dữ liệu lịch sử).
 *
 * LƯU Ý QUAN TRỌNG VỀ PHẠM VI: máy này chỉ nhìn 40 phiên gần nhất và chỉ có các pha TÍCH LŨY (A→E).
 * Nó KHÔNG biết cổ phiếu đang ở giai đoạn nào của chu kỳ lớn, nên kết quả phải được đặt vào bối cảnh Stage
 * (xem wyckoffContext.ts) trước khi dùng để ra quyết định.
 */
export interface WyckoffInput {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
  isIndex: boolean;
  sma20: number;
  sma50: number;
  sma150: number;
  sma200: number;
  distFrom52WHighPct: number;
}

export type WyckoffPhaseLetter = 'Phase A' | 'Phase B' | 'Phase C' | 'Phase D' | 'Phase E';
export type BuyPointCode = 'NONE' | 'BUY_1_SPRING' | 'BUY_2_LPS' | 'BUY_3_BREAKOUT_BU' | 'HOLD_MARKUP';

export function analyzeWyckoff(input: WyckoffInput) {
  const { opens, highs, lows, closes, volumes, isIndex, sma20, sma50, sma150, sma200, distFrom52WHighPct } = input;
  const count = closes.length;
  const currentPrice = closes[count - 1];
  const prevPrice = count > 1 ? closes[count - 2] : currentPrice;
  const currentChangePct = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
  const currentVol = volumes[count - 1] || 0;
  const distFromSMA20Pct = sma20 > 0 ? Math.round(((currentPrice - sma20) / sma20) * 1000) / 10 : 0;
  // Wyckoff & VSA (Volume Spread Analysis) Diagnosis (Phase A - E)
  const formatPrice = (val: number) =>
    !isIndex && val > 2000 ? (val / 1000).toFixed(1) : Number(val.toFixed(2)).toString();

  const baseWindow = Math.min(40, count);
  const halfWindow = Math.max(5, Math.floor(baseWindow / 2));
  const baseStartIdx = count - baseWindow;
  const midBaseIdx = count - halfWindow;

  const last40High = Math.max(...highs.slice(baseStartIdx));
  const last40Low = Math.min(...lows.slice(baseStartIdx));
  const baseRangePct = last40Low > 0 ? Math.round(((last40High - last40Low) / last40Low) * 1000) / 10 : 25;
  const baseHeight = last40High - last40Low;
  const posInBasePct = baseHeight > 0 ? Math.round(((currentPrice - last40Low) / baseHeight) * 100) : 50;

  // 1. Cấu trúc Swing nửa đầu vs nửa sau nền 40 phiên (HH-HL & Độ co hẹp VCP)
  const firstHalfHighs = highs.slice(baseStartIdx, midBaseIdx);
  const firstHalfLows = lows.slice(baseStartIdx, midBaseIdx);
  const secondHalfHighs = highs.slice(midBaseIdx);
  const secondHalfLows = lows.slice(midBaseIdx);

  const first20High = firstHalfHighs.length > 0 ? Math.max(...firstHalfHighs) : last40High;
  const first20Low = firstHalfLows.length > 0 ? Math.min(...firstHalfLows) : last40Low;
  const last20High = secondHalfHighs.length > 0 ? Math.max(...secondHalfHighs) : last40High;
  const last20Low = secondHalfLows.length > 0 ? Math.min(...secondHalfLows) : last40Low;

  const firstHalfRangePct = first20Low > 0 ? ((first20High - first20Low) / first20Low) * 100 : baseRangePct;
  const secondHalfRangePct = last20Low > 0 ? ((last20High - last20Low) / last20Low) * 100 : baseRangePct;

  // Đáy sau cao hơn đáy trước (HL) & Đỉnh sau cao hơn (HH) hoặc thu hẹp VCP giữ trên MA20/MA50
  const isHigherLow = last20Low >= first20Low * 0.99;
  const isHigherHighOrTightVcp =
    last20High >= first20High * 0.985 ||
    (secondHalfRangePct < firstHalfRangePct && currentPrice >= sma20 && posInBasePct >= 55);
  const hhHlPassed =
    isHigherLow && isHigherHighOrTightVcp && currentPrice >= last20Low * 1.015 && currentPrice > sma50;

  // 2. Phân tích VSA (Volume & Spread) trên chuỗi 20 phiên gần nhất
  const sma50Vol = Math.round(
    volumes.slice(Math.max(0, count - 50)).reduce((a, b) => a + b, 0) / Math.min(50, count)
  );
  const volRatio = sma50Vol > 0 ? Math.round((currentVol / sma50Vol) * 10) / 10 : 1;

  const vsaLookback = Math.min(20, count - 1);
  const vsaStartIdx = count - vsaLookback;

  let demandDays = 0;
  let supplyDays = 0;
  let demandVolSum = 0;
  let supplyVolSum = 0;
  let demandSpreadSum = 0;
  let supplySpreadSum = 0;
  let totalSpreadSum = 0;
  let vduCount = 0; // Số phiên cạn cung (Volume Dry-Up < 0.78x SMA50 Vol)
  let recent15DownVolSum = 0;
  let recent15DownDays = 0;
  let sosCount = 0;
  let sowCount = 0;
  let lastSosIdx = -1;
  let lastSosLow = 0;
  let lastSowIdx = -1;
  let recentUpthrust = false;

  for (let i = vsaStartIdx; i < count; i++) {
    const o = opens[i];
    const c = closes[i];
    const prevC = i > 0 ? closes[i - 1] : c;
    const h = highs[i];
    const l = lows[i];
    const v = volumes[i] || 0;
    const spread = Math.max(0, h - l);
    const spreadPct = prevC > 0 ? (spread / prevC) * 100 : 0;
    const closePos = spread > 0 ? (c - l) / spread : 0.5;
    const barChgPct = prevC > 0 ? ((c - prevC) / prevC) * 100 : 0;

    totalSpreadSum += spreadPct;

    // Phân loại Nến Cầu (Demand) vs Nến Cung (Supply) theo chuẩn VSA:
    // - Nến Upthrust (tăng nhẹ nhưng bị xả ngược đóng cửa <= 35% biên độ nến kèm Vol lớn) là Nến Cung ẩn
    // - Nến Shakeout rút chân (đóng cửa >= 65% biên độ nến và c > o) là Nến Cầu hấp thụ
    const isUpthrustBar = sma50Vol > 0 && v >= sma50Vol * 1.25 && closePos <= 0.35 && barChgPct < 1.0;
    const isBullishShakeout = barChgPct >= -0.5 && closePos >= 0.65 && c > o;

    if ((c > prevC && !isUpthrustBar) || isBullishShakeout) {
      demandDays++;
      demandVolSum += v;
      demandSpreadSum += spreadPct;
    } else if (c < prevC || isUpthrustBar) {
      supplyDays++;
      supplyVolSum += v;
      supplySpreadSum += spreadPct;
    }

    // Thống kê 15 phiên gần nhất cho VDU (Cạn cung) & SOS (Sign of Strength)
    if (i >= count - Math.min(15, vsaLookback)) {
      if (c < prevC || (c === prevC && closePos < 0.45)) {
        recent15DownDays++;
        recent15DownVolSum += v;
      }
      // Phiên cạn cung VDU / No Supply: Volume <= 78% TB 50 phiên và không bán tháo
      if (sma50Vol > 0 && v <= sma50Vol * 0.78 && barChgPct > -1.8) {
        vduCount++;
      }

      // Kiểm tra Pocket Pivot (Volume lớn hơn mọi phiên giảm trong 10 phiên trước đó)
      let maxPrior10DownVol = 0;
      for (let j = Math.max(1, i - 10); j < i; j++) {
        if (closes[j] < closes[j - 1] && volumes[j] > maxPrior10DownVol) {
          maxPrior10DownVol = volumes[j];
        }
      }
      const isPocketPivotVol = maxPrior10DownVol > 0 && v > maxPrior10DownVol;

      // Nến SOS / Pocket Pivot: Tăng >= 1.8%, đóng cửa nửa trên nến (>= 55%), thân nến xanh, kèm Vol >= 1.15x TB50 hoặc Pocket Pivot
      if (
        barChgPct >= 1.8 &&
        closePos >= 0.55 &&
        c >= o &&
        ((sma50Vol > 0 && v >= sma50Vol * 1.15) || isPocketPivotVol)
      ) {
        sosCount++;
        lastSosIdx = i;
        lastSosLow = l;
      }

      // Nến SOW (Sign of Weakness): Giảm <= -2.0%, đóng cửa nửa dưới (<= 45%), kèm Vol >= 1.2x TB50
      if (barChgPct <= -2.0 && closePos <= 0.45 && sma50Vol > 0 && v >= sma50Vol * 1.2) {
        sowCount++;
        lastSowIdx = i;
      }
    }

    // Kiểm tra Upthrust (bán cụt đầu khối lượng lớn) trong 3 phiên cuối
    if (i >= count - 3 && sma50Vol > 0 && v >= sma50Vol * 1.3 && closePos <= 0.35 && barChgPct < 1.0) {
      recentUpthrust = true;
    }
  }

  const avgSpread20Pct = vsaLookback > 0 ? totalSpreadSum / vsaLookback : 2.0;
  const avgDemandSpreadPct = demandDays > 0 ? demandSpreadSum / demandDays : avgSpread20Pct;
  const avgSupplySpreadPct = supplyDays > 0 ? supplySpreadSum / supplyDays : avgSpread20Pct;
  const spreadRatio = avgSupplySpreadPct > 0 ? avgDemandSpreadPct / avgSupplySpreadPct : 1.0;

  const avgDemandVol = demandDays > 0 ? demandVolSum / demandDays : sma50Vol;
  const avgSupplyVol = supplyDays > 0 ? supplyVolSum / supplyDays : sma50Vol;
  const upDownVolRatio = avgSupplyVol > 0 ? avgDemandVol / avgSupplyVol : 1.0;

  const avgRecentDownVol = recent15DownDays > 0 ? recent15DownVolSum / recent15DownDays : currentVol * 0.8;
  const downVolAvgRatio = sma50Vol > 0 ? avgRecentDownVol / sma50Vol : 1.0;

  // Đặc tính cây nến hiện tại (Current Bar VSA)
  const currentOpen = opens[count - 1];
  const currentSpread = Math.max(0, highs[count - 1] - lows[count - 1]);
  const currentSpreadPct = prevPrice > 0 ? (currentSpread / prevPrice) * 100 : 0;
  const currentClosePos = currentSpread > 0 ? (currentPrice - lows[count - 1]) / currentSpread : 0.5;
  const lastSosBarsAgo = lastSosIdx >= 0 ? count - 1 - lastSosIdx : null;

  // 3. Hỗ trợ đáy nền & phát hiện hành vi Spring / Shakeout
  const priorLows = lows.slice(baseStartIdx, Math.max(baseStartIdx + 1, count - 10));
  const priorBaseLow = priorLows.length > 0 ? Math.min(...priorLows) : null;
  const recent10Closes = closes.slice(Math.max(0, count - 10));
  const recent10Lows = lows.slice(Math.max(0, count - 10));
  const minCloseLast10 = Math.min(...recent10Closes);
  const minLowLast10 = Math.min(...recent10Lows);

  // Không vi phạm đáy nền: Đóng cửa 10 phiên gần nhất giữ trên vùng hỗ trợ đáy nền (cho phép sai số rũ bỏ rút chân 1%)
  const supportHeldPassed =
    priorBaseLow !== null &&
    minCloseLast10 >= priorBaseLow * 0.99 &&
    currentPrice >= priorBaseLow;

  // Phát hiện Spring / Test thành công trong 10 phiên qua: Giá thấp nhất chạm sát hoặc nhúng nhẹ dưới priorBaseLow rồi rút chân lên
  const hasSpringAction =
    priorBaseLow !== null &&
    minLowLast10 <= priorBaseLow * 1.02 &&
    minLowLast10 >= priorBaseLow * 0.95 &&
    currentPrice >= priorBaseLow * 1.01 &&
    currentClosePos >= 0.45;

  // 4. Đánh giá 8 tiêu chí Wyckoff & VSA chuẩn xác
  const vcpBasePassed = baseRangePct < 30 && secondHalfRangePct <= Math.max(18, firstHalfRangePct * 1.15);
  const upperHalfPassed = posInBasePct >= 50;
  // Cạn cung nhịp chỉnh: Khối lượng TB các phiên giảm KHÔNG ĐƯỢC lớn hơn TB50 (<= 1.0x), kèm < 0.92x hoặc >= 3 phiên VDU
  const vduPassed = downVolAvgRatio <= 1.0 && (downVolAvgRatio <= 0.92 || vduCount >= 3);
  // Tín hiệu SOS hợp lệ: Có SOS, số SOS > SOW (hoặc SOS gần nhất xuất hiện sau SOW cuối cùng), và giá hiện tại không thủng đáy cây nến SOS
  const sosStructureIntact =
    lastSosIdx >= 0 &&
    currentPrice >= lastSosLow * 0.99 &&
    (sosCount > sowCount || lastSosIdx > lastSowIdx);
  const sosPassed = sosCount >= 1 && sosStructureIntact;

  // Spread VSA mở rộng chiều tăng:
  // - Biên độ TB nến Cầu >= nến Cung (spreadRatio >= 0.95)
  // - Phiên hiện tại: Nếu tăng thì đóng cửa >= 48% nến; nếu giảm/đi ngang LPS thì hoặc rút chân (closePos >= 45% hoặc c >= o), hoặc chỉnh nhẹ biên độ hẹp kèm Vol thấp
  const isHealthyCurrentBar =
    (currentChangePct > 0 && currentClosePos >= 0.48) ||
    (currentChangePct <= 0 &&
      currentChangePct >= -1.5 &&
      (currentClosePos >= 0.45 ||
        currentPrice >= currentOpen ||
        (currentChangePct >= -1.2 && currentSpreadPct <= avgSpread20Pct && volRatio <= 0.95)));
  const spreadVsaPassed = spreadRatio >= 0.95 && isHealthyCurrentBar;

  // Hấp thụ nguồn cung tại kháng cự: Khối lượng Cầu > Cung (>= 1.05x), giữ nửa trên nền, không xuất hiện Upthrust xả hàng
  const absorptionPassed =
    upDownVolRatio >= 1.05 && posInBasePct >= 55 && distFrom52WHighPct >= -22 && !recentUpthrust;

  const wyckoffCriteria = [
    {
      id: 1,
      label: 'Cấu trúc đỉnh & đáy sau cao hơn (HH-HL)',
      passed: hhHlPassed,
      value: `Đáy ${formatPrice(first20Low)}→${formatPrice(last20Low)} · Đỉnh ${formatPrice(first20High)}→${formatPrice(last20High)}`,
    },
    {
      id: 2,
      label: 'Nền 40 phiên thu hẹp (biên độ < 30%)',
      passed: vcpBasePassed,
      value: `${baseRangePct}% (Nửa sau ${secondHalfRangePct.toFixed(1)}%)`,
    },
    {
      id: 3,
      label: 'Giá nằm nửa trên của nền (Trading Range)',
      passed: upperHalfPassed,
      value: `${posInBasePct}% chiều cao nền`,
    },
    {
      id: 4,
      label: 'Cạn kiệt cung nhịp chỉnh (No Supply / VDU)',
      passed: vduPassed,
      value: `Vol giảm ${Math.round(downVolAvgRatio * 100)}% TB50 · ${vduCount} phiên VDU`,
    },
    {
      id: 5,
      label: 'Cây nến SOS / Pocket Pivot dòng tiền vào',
      passed: sosPassed,
      value:
        lastSosBarsAgo === 0
          ? `Hôm nay SOS (Vol x${volRatio} TB)`
          : sosCount > 0
          ? `${sosCount} nến SOS / 15p (${lastSosBarsAgo}p trước)`
          : `Chưa có SOS (Vol x${volRatio} TB)`,
    },
    {
      id: 6,
      label: 'Không vi phạm đáy nền (10 phiên gần nhất)',
      passed: supportHeldPassed,
      value:
        priorBaseLow !== null
          ? `Đáy nền ${formatPrice(priorBaseLow)} (Min 10p: ${formatPrice(minCloseLast10)})`
          : 'Chưa đủ dữ liệu',
    },
    {
      id: 7,
      label: 'Spread nến mở rộng chiều tăng (VSA)',
      passed: spreadVsaPassed,
      value: `Spread T/G ${spreadRatio.toFixed(2)}x · Đóng nến ${Math.round(currentClosePos * 100)}%`,
    },
    {
      id: 8,
      label: 'Hấp thụ nguồn cung tại kháng cự',
      passed: absorptionPassed,
      value: `Vol T/G ${upDownVolRatio.toFixed(2)}x · ${distFrom52WHighPct}% đỉnh`,
    },
  ];

  const wyckoffPassedCount = wyckoffCriteria.filter((c) => c.passed).length;

  // 5. CỖ MÁY CHUYỂN TRẠNG THÁI TUẦN TỰ THEO CHU KỲ WYCKOFF (SEQUENTIAL WYCKOFF STATE MACHINE)
  // Nguyên tắc học thuật Wyckoff: Chu kỳ tích lũy diễn ra tuần tự bắt buộc:
  // Phase A (Hãm rơi) ➔ Phase B (Tích lũy gom hàng) ➔ Phase C (Rũ bỏ Spring / Test) ➔ Phase D (SOS / LPS trong nền) ➔ Phase E (Bứt phá Markup)
  // TUYỆT ĐỐI KHÔNG NHẢY CÓC, VÀ KHÔNG BỊ TỤT LÙI BỪA BÃI KHI CHỈ CÓ RUNG LẮC NGẮN HẠN.

  let wyckoffPhase: 'Phase A' | 'Phase B' | 'Phase C' | 'Phase D' | 'Phase E' = 'Phase B';
  let phaseIndex = 1;
  let wyckoffPhaseName = 'Phase B — Tích lũy xây dựng nguyên nhân';
  let actionAdvice = 'Chờ quá trình thắt chặt biên độ nền giá VCP và cạn kiệt nguồn cung';
  let isBuyPhase = false;
  let buyPointCode: 'NONE' | 'BUY_1_SPRING' | 'BUY_2_LPS' | 'BUY_3_BREAKOUT_BU' | 'HOLD_MARKUP' = 'NONE';
  let buyPointLabel = '⏳ CHƯA CÓ ĐIỂM MUA CHUẨN (ĐỨNG NGOÀI / QUAN SÁT)';
  let buyPointDetail =
    'Cổ phiếu đang trong giai đoạn gom hàng đi ngang (Phase B). Tuyệt đối không mua sớm tránh chôn vốn.';
  const supportBaseRef = priorBaseLow !== null ? priorBaseLow : last20Low;
  let wyckoffBuyZone = `Chờ tín hiệu quanh ${formatPrice(sma20)} - ${formatPrice(last20High)}`;
  let wyckoffStopLoss = `${formatPrice(supportBaseRef * 0.97)} (-3% dưới đáy nền)`;
  let completedPhases: string[] = ['Phase A'];
  let nextMilestone =
    'Cạn kiệt nguồn cung và xuất hiện nhịp rũ bỏ Spring (Phase C) hoặc nổ Vol SOS vượt nửa trên nền (Phase D)';
  let phaseProgressPct = 35;

  // A. Kiểm tra vi phạm gãy xu hướng / hoảng loạn thực sự (Active Severe Breakdown)
  // Chỉ xem là Phase A khi giá THỰC SỰ bị bán tháo thủng đáy hỗ trợ hoặc đang trong downtrend rơi tự do
  const isSevereDowntrendOrBreakdown =
    (priorBaseLow !== null && currentPrice < priorBaseLow * 0.96 && minCloseLast10 < priorBaseLow * 0.97) ||
    (distFrom52WHighPct < -32 && currentPrice < sma50 && sma50 < sma200 && posInBasePct < 25 && downVolAvgRatio > 1.15) ||
    (wyckoffPassedCount <= 1 && posInBasePct < 20 && currentPrice < sma20 && currentPrice < sma50);

  // B. Kiểm tra ĐIỀU KIỆN TIÊN QUYẾT ĐỂ ĐẠT PHASE E (Markup ngoài nền):
  // Phải hoàn tất Phase D (đã có SOS tích lũy nâng đáy), giá bứt phá vượt hoặc áp sát trần nền kháng cự,
  // nằm trên các đường MA chủ chốt (MA20, MA50, MA150, MA200) và tiệm cận đỉnh 52 tuần.
  const isPhaseEEligible =
    !isSevereDowntrendOrBreakdown &&
    wyckoffPassedCount >= 6 &&
    posInBasePct >= 75 &&
    distFrom52WHighPct >= -12 &&
    currentPrice > sma50 &&
    sma50 > sma150 &&
    currentPrice > sma200 &&
    (currentPrice >= last20High * 0.985 || distFrom52WHighPct >= -6);

  // C. Kiểm tra ĐIỀU KIỆN TIÊN QUYẾT ĐỂ ĐẠT PHASE D (Xu hướng bên trong nền - SOS & LPS):
  // Phải có sự xuất hiện của CÂY NẾN SOS / Pocket Pivot xác nhận dòng tiền lớn đẩy giá lên nửa trên nền (posInBasePct >= 48),
  // giá giữ vững trên MA20 hoặc MA50, và cấu trúc đáy sau cao hơn (Higher Low).
  // ĐẶC BIỆT: Nếu cổ phiếu đang có SOS và giữ trên MA20/MA50, dù có vài phiên đỏ rung lắc với Vol thấp thì ĐÓ LÀ LPS CỦA PHASE D,
  // chứ không được tụt về Phase B hay Phase C!
  const isPhaseDEligible =
    !isSevereDowntrendOrBreakdown &&
    !isPhaseEEligible &&
    wyckoffPassedCount >= 5 &&
    posInBasePct >= 48 &&
    (sosPassed || absorptionPassed || (hhHlPassed && upDownVolRatio >= 1.05)) &&
    currentPrice >= Math.min(sma20, sma50) * 0.985;

  // D. Kiểm tra ĐIỀU KIỆN TIÊN QUYẾT ĐỂ ĐẠT PHASE C (Rũ bỏ Spring / Test đáy cạn cung):
  // Chỉ kích hoạt khi giá thực sự có hành vi nhúng sát/thủng nhẹ đáy nền rồi rút chân lên (hasSpringAction),
  // HOẶC đang kiểm tra lại đáy hỗ trợ nền với thanh khoản cạn kiệt (Volume Dry Up), chưa có cây nến SOS bứt phá.
  const isPhaseCEligible =
    !isSevereDowntrendOrBreakdown &&
    !isPhaseEEligible &&
    !isPhaseDEligible &&
    (hasSpringAction ||
      (supportHeldPassed && vduPassed && posInBasePct <= 35 && minLowLast10 <= supportBaseRef * 1.03 && upDownVolRatio >= 0.95));

  // THỰC HIỆN GÁN TRẠNG THÁI TUẦN TỰ THEO THỨ TỰ LOGIC CHU KỲ
  if (isSevereDowntrendOrBreakdown) {
    wyckoffPhase = 'Phase A';
    phaseIndex = 0;
    wyckoffPhaseName = 'Phase A — Hãm đà giảm (SC / AR)';
    actionAdvice = 'Đứng ngoài quan sát, chưa tạo đáy xong';
    isBuyPhase = false;
    buyPointCode = 'NONE';
    buyPointLabel = '🚫 KHÔNG MUA (Phase A — Đang rơi)';
    buyPointDetail =
      'Cổ phiếu đang chịu áp lực bán tháo hoặc chưa tạo đáy cân bằng. Đứng ngoài chờ thiết lập Trading Range.';
    wyckoffBuyZone = 'Đứng ngoài';
    wyckoffStopLoss = `${formatPrice(last40Low * 0.96)}`;
    completedPhases = [];
    nextMilestone = 'Tạo đáy Selling Climax (SC) và hồi phục Automatic Rally (AR) để xác lập biên độ tích lũy';
    phaseProgressPct = 15;
  } else if (isPhaseEEligible) {
    wyckoffPhase = 'Phase E';
    phaseIndex = 4;
    wyckoffPhaseName = 'Phase E — Đẩy giá thoát nền (Markup)';
    completedPhases = ['Phase A', 'Phase B', 'Phase C', 'Phase D'];
    nextMilestone = 'Duy trì xu hướng tăng giá Markup, giữ tới khi có tín hiệu bán';
    phaseProgressPct = 95;

    const isEarlyBreakoutOrBu = distFromSMA20Pct <= 6.0 && posInBasePct <= 98;
    if (isEarlyBreakoutOrBu) {
      isBuyPhase = true;
      buyPointCode = 'BUY_3_BREAKOUT_BU';
      buyPointLabel = '🚀 ĐIỂM MUA #3: Vượt đỉnh nền JAC / BU (Gia tăng 20-30%)';
      buyPointDetail = 'Cổ phiếu bứt phá dứt khoát khỏi nền giá tích lũy (JAC) và đang kiểm định trần nền (BU).';
      actionAdvice = 'Mua gia tăng 20–30% quanh đỉnh nền vừa vượt (BU)';
      wyckoffBuyZone = `${formatPrice(Math.min(currentPrice, last20High * 0.985))} – ${formatPrice(currentPrice * 1.01)}`;
      wyckoffStopLoss = `${formatPrice(Math.max(sma20 * 0.97, last20Low))}`;
    } else {
      isBuyPhase = false;
      buyPointCode = 'HOLD_MARKUP';
      buyPointLabel = '🔒 NẮM GIỮ GỒNG LÃI (Phase E đã chạy xa nền — Cấm mua đuổi)';
      buyPointDetail = 'Cổ phiếu đã tăng quá +5% so với điểm pivot bứt phá. Tuyệt đối không mua đuổi, chỉ nắm giữ gồng lãi.';
      actionAdvice = 'Giữ hàng gồng lãi, chặn lãi theo MA20';
      wyckoffBuyZone = `Chờ chỉnh về MA20 (${formatPrice(sma20)})`;
      wyckoffStopLoss = `${formatPrice(sma20 * 0.97)} (MA20)`;
    }
  } else if (isPhaseDEligible) {
    wyckoffPhase = 'Phase D';
    phaseIndex = 3;
    wyckoffPhaseName = 'Phase D — SOS / LPS (Quan trọng nhất ⭐)';
    completedPhases = ['Phase A', 'Phase B', 'Phase C'];
    nextMilestone = 'Bứt phá dứt khoát vượt trần kháng cự của Trading Range (JAC / Breakout) để bước vào Phase E';
    phaseProgressPct = 75;
    isBuyPhase = true;
    buyPointCode = 'BUY_2_LPS';
    buyPointLabel = '⭐ ĐIỂM MUA CHUẨN #2: Phase D — SOS / LPS (Mua chủ lực 40-50%)';
    buyPointDetail =
      'Đã hoàn tất rũ bỏ cạn cung. Xuất hiện nến SOS dòng tiền lớn và đang kiểm định hỗ trợ nâng đáy LPS trên MA20/MA50.';
    actionAdvice = 'Giải ngân chủ lực 40–50% ở nhịp chỉnh cạn cung LPS trên MA20/MA50';
    const lpsLow = Math.min(currentPrice, sma20 > 0 ? sma20 : currentPrice);
    const lpsHigh = Math.max(currentPrice, sma20 > 0 ? sma20 * 1.02 : currentPrice * 1.01);
    wyckoffBuyZone = `${formatPrice(lpsLow * 0.99)} – ${formatPrice(lpsHigh)}`;
    wyckoffStopLoss = `${formatPrice(Math.max(last20Low * 0.98, currentPrice * 0.93))}`;
  } else if (isPhaseCEligible) {
    wyckoffPhase = 'Phase C';
    phaseIndex = 2;
    wyckoffPhaseName = 'Phase C — Spring / Test cạn cung';
    completedPhases = ['Phase A', 'Phase B'];
    nextMilestone = 'Xuất hiện cây nến SOS bứt phá vượt qua nửa trên nền kèm Volume lớn để chuyển sang Phase D';
    phaseProgressPct = 55;
    isBuyPhase = true;
    buyPointCode = 'BUY_1_SPRING';
    buyPointLabel = '🎯 ĐIỂM MUA #1: Phase C — Test Spring cạn cung (Thăm dò 20-30%)';
    buyPointDetail = 'Nhịp rũ bỏ Spring bẫy phe bán dưới đáy nền hoặc kiểm định đáy với thanh khoản cạn kiệt thành công.';
    actionAdvice = 'Mua thăm dò 20–30% khi nến rút chân và Test lại đáy nền Vol thấp';
    wyckoffBuyZone = `${formatPrice(supportBaseRef)} – ${formatPrice(supportBaseRef * 1.03)}`;
    wyckoffStopLoss = `${formatPrice(minLowLast10 * 0.975)}`;
  } else {
    // Mặc định Phase B: Nền tảng tích lũy xây dựng nguyên nhân
    wyckoffPhase = 'Phase B';
    phaseIndex = 1;
    wyckoffPhaseName = 'Phase B — Gom hàng đi ngang';
    completedPhases = ['Phase A'];
    nextMilestone =
      'Xuất hiện nhịp rũ bỏ Spring cạn cung (Phase C) hoặc nổ Vol SOS vượt nửa trên nền (Phase D)';
    phaseProgressPct = 35;
    isBuyPhase = false;
    buyPointCode = 'NONE';
    buyPointLabel = '⏳ CHƯA MUA (Phase B — Đi ngang gom hàng, chờ sang Phase C/D)';
    buyPointDetail =
      'Cổ phiếu đang tích lũy đi ngang hấp thụ nguồn cung trong Trading Range. Kiên nhẫn chờ điểm rũ bỏ hoặc bứt phá.';
    actionAdvice = 'Chờ rũ bỏ Spring (Phase C) hoặc nổ Vol SOS (Phase D)';
    wyckoffBuyZone = `Chờ quanh ${formatPrice(supportBaseRef)}`;
    wyckoffStopLoss = `${formatPrice(supportBaseRef * 0.96)}`;
  }

  return {
    wyckoffCriteria,
    wyckoffPassedCount,
    wyckoffPhase,
    phaseIndex,
    wyckoffPhaseName,
    actionAdvice,
    isBuyPhase,
    buyPointCode,
    buyPointLabel,
    buyPointDetail,
    wyckoffBuyZone,
    wyckoffStopLoss,
    completedPhases,
    nextMilestone,
    phaseProgressPct,
    // Chẩn đoán phụ — dùng cho phần đặt Wyckoff vào bối cảnh Stage và cho quy tắc quyết định
    diagnostics: {
      sosCount,
      sowCount,
      lastSosIdx,
      lastSowIdx,
      recentUpthrust,
      posInBasePct,
      baseRangePct,
      upDownVolRatio,
      downVolAvgRatio,
      vduCount,
      priorBaseLow,
      last40High,
      last40Low,
      last20High,
      last20Low,
      hasSpringAction,
      isSevereDowntrendOrBreakdown,
      supportBaseRef,
      sma50Vol,
      volRatio,
    },
  };
}

export type WyckoffAnalysis = ReturnType<typeof analyzeWyckoff>;
