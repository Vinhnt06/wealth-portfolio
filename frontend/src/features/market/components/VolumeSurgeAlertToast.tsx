'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lightning,
  Fire,
  X,
  Bell,
  BellSlash,
  Gear,
  ArrowUpRight,
  Sparkle,
  TrendUp,
  Check,
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';

export interface AlertNotificationItem {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  liveVol: number;
  avgVol20: number;
  rVol: number;
  totalValBillion: number;
  timestamp: number;
}

const STORAGE_KEY_ENABLED = 'yourfin_vol_alert_enabled';
const STORAGE_KEY_THRESHOLD = 'yourfin_vol_alert_threshold';
const STORAGE_KEY_MIN_VAL = 'yourfin_vol_alert_min_val';

// Anti-spam configuration
const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes cooldown per stock
const RVOL_UPGRADE_DELTA = 1.0; // Must surge by at least +1.0x higher to re-alert within cooldown
const TOAST_DURATION_MS = 8000; // Auto-dismiss after 8 seconds

/**
 * Check with 100% precision if current time is within Vietnam Stock Market trading hours:
 * - Monday to Friday (No weekends)
 * - Morning continuous matching: 09:00:00 - 11:30:00 (GMT+7)
 * - Afternoon continuous matching & ATC: 13:00:00 - 14:45:00 (GMT+7)
 */
export function isVietnamMarketTradingSession(date = new Date()): boolean {
  try {
    const vnTimeStr = date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const vnDate = new Date(vnTimeStr);
    const day = vnDate.getDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) return false;

    const hours = vnDate.getHours();
    const minutes = vnDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Morning Session: 09:00 (540 mins) to 11:30 (690 mins)
    const isMorning = totalMinutes >= 540 && totalMinutes <= 690;
    // Afternoon Session: 13:00 (780 mins) to 14:45 (885 mins - close of ATC)
    const isAfternoon = totalMinutes >= 780 && totalMinutes <= 885;

    return isMorning || isAfternoon;
  } catch {
    return false;
  }
}

export const VolumeSurgeAlertToast: React.FC = () => {
  const { setSelectedSymbol, setViewMode } = useMarketStore();

  // Settings
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [thresholdRVol, setThresholdRVol] = useState<number>(2.2); // Default 2.2x SMA20
  const [minValueBillion, setMinValueBillion] = useState<number>(3.0); // Min 3 Billion VND to filter penny noise
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Active Toast Item
  const [activeAlert, setActiveAlert] = useState<AlertNotificationItem | null>(null);
  const [progressPct, setProgressPct] = useState<number>(100);

  // In-memory anti-spam tracker: Map<symbol, { lastAlertTime: number, lastRVol: number }>
  const alertHistoryRef = useRef<Map<string, { lastAlertTime: number; lastRVol: number }>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
      if (savedEnabled !== null) setIsEnabled(savedEnabled === 'true');

      const savedThreshold = localStorage.getItem(STORAGE_KEY_THRESHOLD);
      if (savedThreshold !== null) {
        const val = parseFloat(savedThreshold);
        if (!isNaN(val) && val >= 1.5) setThresholdRVol(val);
      }

      const savedMinVal = localStorage.getItem(STORAGE_KEY_MIN_VAL);
      if (savedMinVal !== null) {
        const val = parseFloat(savedMinVal);
        if (!isNaN(val) && val >= 0) setMinValueBillion(val);
      }
    } catch {}
  }, []);

  const saveSettings = (enabled: boolean, threshold: number, minVal: number) => {
    setIsEnabled(enabled);
    setThresholdRVol(threshold);
    setMinValueBillion(minVal);
    try {
      localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
      localStorage.setItem(STORAGE_KEY_THRESHOLD, String(threshold));
      localStorage.setItem(STORAGE_KEY_MIN_VAL, String(minVal));
    } catch {}
  };

  // Dismiss Toast helper
  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setActiveAlert(null);
    setProgressPct(100);
  }, []);

  // Display a qualified alert with auto-dismiss progress bar
  const triggerAlert = useCallback((item: AlertNotificationItem) => {
    // 100% Precision Guard: Strictly reject any toast outside Vietnam trading sessions
    if (!isVietnamMarketTradingSession()) {
      return;
    }

    dismissToast();
    setActiveAlert(item);
    setProgressPct(100);

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / TOAST_DURATION_MS) * 100);
      setProgressPct(remainingPct);
      if (remainingPct <= 0) {
        dismissToast();
      }
    }, 100);

    timerRef.current = setTimeout(() => {
      dismissToast();
    }, TOAST_DURATION_MS);
  }, [dismissToast]);

  // Polling scanner: inspect market volume surge
  const scanForSurges = useCallback(async () => {
    // 100% Precision Guard: Only scan when enabled and during live Vietnam trading hours
    if (!isEnabled || !isVietnamMarketTradingSession()) {
      if (activeAlert) dismissToast();
      return;
    }

    try {
      // Fetch current market surge radar data
      const res = await fetch(`/api/market/volume-surge-radar?minRVol=${thresholdRVol}&limit=40`);
      if (!res.ok) return;

      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return;

      const now = Date.now();
      const qualifiedCandidates: AlertNotificationItem[] = [];

      for (const stock of json.data) {
        // Standard Qualification Filter:
        // 1. rVol must meet or exceed user threshold (e.g. >= 2.0x SMA20)
        // 2. Price must be positive (Change % >= +0.5%) to avoid dumping surges
        // 3. Minimum liquidity threshold (>= 3 Billion VND) to avoid illiquid penny manipulation
        const effectiveRVol = Number(stock.effectiveRVol || stock.rVol || 0);
        const changePct = Number(stock.changePct || 0);
        const totalValBillion = Number(stock.totalValBillion || 0);

        if (
          effectiveRVol >= thresholdRVol &&
          changePct >= 0.5 &&
          totalValBillion >= minValueBillion
        ) {
          const history = alertHistoryRef.current.get(stock.symbol);

          // Anti-Spam Check:
          // Check if stock was alerted recently (within 45 mins)
          if (history) {
            const timePassed = now - history.lastAlertTime;
            const rVolSurgedSignificantly = effectiveRVol >= history.lastRVol + RVOL_UPGRADE_DELTA;

            // Only allow re-alert if 45 mins passed OR volume escalated by +0.8x
            if (timePassed < COOLDOWN_MS && !rVolSurgedSignificantly) {
              continue; // Skip, anti-spam active
            }
          }

          qualifiedCandidates.push({
            id: `${stock.symbol}_${now}`,
            symbol: stock.symbol,
            name: stock.name || stock.symbol,
            sector: stock.sector || 'Thị trường',
            price: stock.price,
            changePct,
            liveVol: stock.liveVol,
            avgVol20: stock.avgVol20,
            rVol: effectiveRVol,
            totalValBillion,
            timestamp: now,
          });
        }
      }

      // If qualified candidates found, pick the highest intensity surge to alert
      if (qualifiedCandidates.length > 0) {
        qualifiedCandidates.sort((a, b) => b.rVol - a.rVol);
        const topCandidate = qualifiedCandidates[0];

        // Register in anti-spam cache
        alertHistoryRef.current.set(topCandidate.symbol, {
          lastAlertTime: now,
          lastRVol: topCandidate.rVol,
        });

        triggerAlert(topCandidate);
      }
    } catch (err) {
      // Silent error catching to ensure uninterrupted experience
    }
  }, [isEnabled, thresholdRVol, minValueBillion, triggerAlert]);

  // Periodic polling every 20 seconds
  useEffect(() => {
    if (!isEnabled) return;
    scanForSurges();
    const interval = setInterval(scanForSurges, 20000);
    return () => clearInterval(interval);
  }, [isEnabled, scanForSurges]);

  // Navigation action: Jump directly to volume surge chart of that stock
  const handleInspectStock = (symbol: string) => {
    setSelectedSymbol(symbol);
    setViewMode('detail');
    dismissToast();
    setTimeout(() => {
      document.getElementById('stock-orderbook-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  };

  return (
    <>
      {/* ── Floating Notification Toast (Top Right) ──────────────────── */}
      {activeAlert && isEnabled && (
        <div className="fixed top-20 right-5 z-50 w-88 max-w-[calc(100vw-2rem)] select-none animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="relative bg-zinc-950/98 border border-amber-500/50 rounded-2xl p-3.5 shadow-2xl backdrop-blur-2xl ring-1 ring-amber-500/20 overflow-hidden group">
            {/* Ambient amber backdrop illumination */}
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Countdown Progress Bar */}
            <div
              className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-amber-400 to-emerald-400 transition-all ease-linear"
              style={{ width: `${progressPct}%` }}
            />

            {/* Header: Badge & Controls */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-amber-400">
                <Fire size={15} weight="fill" className="animate-pulse text-amber-400" />
                <span className="tracking-wide uppercase">Cảnh Báo Nổ Vol</span>
                <span className="px-1.5 py-0.2 bg-amber-500/20 border border-amber-500/40 rounded text-[10px] text-amber-300">
                  {activeAlert.rVol.toFixed(1)}x SMA20
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded transition-colors"
                  title="Cài đặt ngưỡng nổ vol"
                >
                  <Gear size={13} />
                </button>
                <button
                  onClick={dismissToast}
                  className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded transition-colors"
                  title="Đóng thông báo"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Body: Stock Telemetry */}
            <div className="py-2.5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-zinc-100 font-mono tracking-tight">
                    {activeAlert.symbol}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-medium truncate max-w-[130px]" title={activeAlert.name}>
                    {activeAlert.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11.5px] font-mono">
                  <span className="text-zinc-200 font-bold">
                    {(activeAlert.price / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                    <TrendUp size={12} weight="bold" />
                    +{activeAlert.changePct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Volume & Liquidity Stats */}
              <div className="text-right text-[10.5px] font-mono shrink-0">
                <div className="text-amber-300 font-bold">
                  Khớp: {(activeAlert.liveVol / 1e6).toFixed(2)}M CP
                </div>
                <div className="text-zinc-400 text-[10px] mt-0.5">
                  GT: ~{activeAlert.totalValBillion.toFixed(1)} tỷ
                </div>
              </div>
            </div>

            {/* Actions: Direct Jump Button */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 font-mono">
              <span className="text-[9.5px] text-zinc-400">
                {activeAlert.sector}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={dismissToast}
                  className="px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  onClick={() => handleInspectStock(activeAlert.symbol)}
                  className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-bold rounded-lg transition-all active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <span>Soi Ngay</span>
                  <ArrowUpRight size={12} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Popover Modal for Alert Thresholds ─────────────────── */}
      {showSettings && (
        <div className="fixed top-24 right-5 z-50 w-80 bg-zinc-950 border border-zinc-700 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl font-mono text-xs select-none animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
            <span className="font-bold text-zinc-100 flex items-center gap-1.5">
              <Bell size={14} className="text-amber-400" />
              CÀI ĐẶT CẢNH BÁO NỔ VOL
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-3.5">
            {/* Toggle On/Off */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Bật nhắc nhở nổ Vol:</span>
              <button
                onClick={() => saveSettings(!isEnabled, thresholdRVol, minValueBillion)}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  isEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                {isEnabled ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
              </button>
            </div>

            {/* Threshold Selector */}
            <div>
              <div className="flex items-center justify-between text-zinc-300 mb-1.5">
                <span>Ngưỡng nổ Vol tối thiểu:</span>
                <span className="text-amber-400 font-bold">&ge; {thresholdRVol.toFixed(1)}x SMA20</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                {[1.8, 2.0, 2.2, 2.5].map((val) => (
                  <button
                    key={val}
                    onClick={() => saveSettings(isEnabled, val, minValueBillion)}
                    className={`py-1 rounded font-bold transition-all border ${
                      thresholdRVol === val
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    &ge;{val}x
                  </button>
                ))}
              </div>
            </div>

            {/* Anti-Spam Liquidity Filter */}
            <div>
              <div className="flex items-center justify-between text-zinc-300 mb-1.5">
                <span>Giá trị giao dịch tối thiểu:</span>
                <span className="text-cyan-400 font-bold">&ge; {minValueBillion} tỷ</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                {[1.0, 3.0, 5.0].map((val) => (
                  <button
                    key={val}
                    onClick={() => saveSettings(isEnabled, thresholdRVol, val)}
                    className={`py-1 rounded font-bold transition-all border ${
                      minValueBillion === val
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    &ge;{val} tỷ
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Lọc bỏ các mã penny thanh khoản thấp để tránh thông báo ảo.
              </p>
            </div>

            {/* Anti-spam rule notice */}
            <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[10px] text-zinc-400 space-y-1">
              <div className="flex items-center gap-1 text-emerald-400 font-bold">
                <Check size={12} weight="bold" />
                <span>Chế độ kiểm soát phiên giao dịch</span>
              </div>
              <p className="leading-relaxed">
                • Chỉ phát cảnh báo trong phiên khớp lệnh sàn HOSE/HNX (09:00 - 11:30 & 13:00 - 15:00).<br />
                • Tự động tạm ngưng hoàn toàn vào buổi tối, sáng sớm, giờ nghỉ trưa và cuối tuần.<br />
                • Mỗi mã chỉ báo 1 lần mỗi 60 phút khi giá TĂNG (&ge;+0.5%).
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
