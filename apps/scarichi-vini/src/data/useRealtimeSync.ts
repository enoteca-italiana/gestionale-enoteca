import { useEffect, useRef } from 'react';
import type { AppDomain } from '@/app/appDomainContext';
import { supabase } from '@/lib/supabase';

const REALTIME_DEBOUNCE_MS = 2000;

let wineRepoPromise: Promise<typeof import('@/data/wineRepository')> | null = null;
let spiritsRepoPromise: Promise<typeof import('@/data/spiritsRepository')> | null = null;

async function invalidateCacheForDomain(domain: AppDomain): Promise<void> {
  if (domain === 'wine') {
    wineRepoPromise ??= import('@/data/wineRepository');
    const mod = await wineRepoPromise;
    mod.invalidateWinesCache();
  } else {
    spiritsRepoPromise ??= import('@/data/spiritsRepository');
    const mod = await spiritsRepoPromise;
    mod.invalidateSpiritsCacheAndSync();
  }
}

export function useRealtimeSync(domain: AppDomain, onRemoteChange: () => void): void {
  const callbackRef = useRef(onRemoteChange);
  callbackRef.current = onRemoteChange;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const table = domain === 'wine' ? 'wines' : 'spirits_products';

    const channel = client
      .channel(`home_realtime_${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        void invalidateCacheForDomain(domain);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          callbackRef.current();
        }, REALTIME_DEBOUNCE_MS);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] ${table} → status: ${status}`);
        }
      });

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [domain]);
}
