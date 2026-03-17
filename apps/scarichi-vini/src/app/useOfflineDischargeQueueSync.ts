import { useEffect } from 'react';
import { dischargeQueueChangedEvent, flushPendingDischargeQueue } from '@/data/offlineDischargeQueue';

type FlushReason =
  | 'startup'
  | 'online'
  | 'focus'
  | 'pageshow'
  | 'visibility'
  | 'queue_changed';

export function useOfflineDischargeQueueSync() {
  useEffect(() => {
    const flush = (reason: FlushReason) => {
      void flushPendingDischargeQueue({ reason }).catch((error) => {
        console.error('[offlineDischargeQueue] flush failed', error);
      });
    };

    const onOnline = () => flush('online');
    const onFocus = () => flush('focus');
    const onPageShow = () => flush('pageshow');
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      flush('visibility');
    };
    const onQueueChanged = () => flush('queue_changed');

    flush('startup');

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener(dischargeQueueChangedEvent, onQueueChanged);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener(dischargeQueueChangedEvent, onQueueChanged);
    };
  }, []);
}
