import { useEffect, useState } from 'react';
import { DEBUG_NOW_STORAGE_KEY, getCurrentNow } from '../utils/fasting';

/**
 * Lightweight 1-second clock hook for active countdown displays.
 * Only ticks while `enabled` is true and the page is visible, pausing in
 * background tabs to preserve battery.
 */
export function useLiveSecondNow(enabled: boolean, fallbackNow: Date): Date {
  const [liveNow, setLiveNow] = useState<Date>(() =>
    enabled ? getCurrentNow() : fallbackNow
  );

  useEffect(() => {
    if (!enabled) {
      setLiveNow(fallbackNow);
      return;
    }

    const syncNow = () => setLiveNow(getCurrentNow());
    let intervalId: number | null = null;

    const stopTicker = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startTicker = () => {
      if (
        intervalId !== null ||
        (typeof document !== 'undefined' &&
          document.visibilityState === 'hidden')
      ) {
        return;
      }
      intervalId = window.setInterval(syncNow, 1000);
    };

    syncNow();
    startTicker();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
        startTicker();
      } else {
        stopTicker();
      }
    };

    const handleFocus = () => {
      syncNow();
      startTicker();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === DEBUG_NOW_STORAGE_KEY) {
        syncNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);

    return () => {
      stopTicker();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
    };
  }, [enabled, fallbackNow]);

  return enabled ? liveNow : fallbackNow;
}
