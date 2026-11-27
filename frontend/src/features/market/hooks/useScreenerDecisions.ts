'use client';

import { useEffect, useMemo, useState } from 'react';
import { FetchedDecision, pickDecision } from '../utils/screenerDecision';

/**
 * Lấy quyết định hợp nhất (giống trang chi tiết mã) cho một danh sách mã.
 * Gọi đúng endpoint trang chi tiết dùng, tối đa 3 yêu cầu cùng lúc, nhớ kết quả 5 phút.
 */
const TTL_MS = 5 * 60_000;
const CONCURRENCY = 3;

type Entry = { at: number; value: FetchedDecision | 'error' };
const cache = new Map<string, Entry>();
const inFlight = new Set<string>();

async function load(symbol: string): Promise<void> {
  inFlight.add(symbol);
  try {
    const res = await fetch(`/api/market/minervini/analysis?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' });
    const json = await res.json();
    const picked = json?.success ? pickDecision(json.data) : null;
    cache.set(symbol, { at: Date.now(), value: picked ?? 'error' });
  } catch {
    cache.set(symbol, { at: Date.now(), value: 'error' });
  } finally {
    inFlight.delete(symbol);
  }
}

const isStale = (s: string) => {
  const e = cache.get(s);
  return !e || Date.now() - e.at > TTL_MS;
};

export function useScreenerDecisions(symbols: string[]): {
  decisions: Record<string, FetchedDecision | 'error' | undefined>;
  pending: number;
} {
  const key = [...symbols].sort().join(',');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!key) return;
    const list = key.split(',');
    let cancelled = false;

    const run = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      // Mã chưa có kết quả chạy trước, mã cần làm mới chạy sau
      const queue = list.filter((s) => isStale(s) && !inFlight.has(s)).sort((a, b) => Number(cache.has(a)) - Number(cache.has(b)));
      const worker = async () => {
        while (!cancelled && queue.length) {
          const s = queue.shift()!;
          await load(s);
          if (!cancelled) setVersion((v) => v + 1);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    };

    run();
    const timer = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key]);

  return useMemo(() => {
    const decisions: Record<string, FetchedDecision | 'error' | undefined> = {};
    let pending = 0;
    for (const s of key ? key.split(',') : []) {
      decisions[s] = cache.get(s)?.value;
      if (decisions[s] === undefined) pending++;
    }
    return { decisions, pending };
    // version: render lại mỗi khi có thêm kết quả
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
}
