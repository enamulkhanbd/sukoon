import { useEffect, useRef, useState } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
}

export function useWakeLock(enabled: boolean): {
  supported: boolean;
  active: boolean;
} {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!supported || !enabled) {
      if (sentinelRef.current && !sentinelRef.current.released) {
        sentinelRef.current.release().catch(() => {});
      }
      sentinelRef.current = null;
      setActive(false);
      return;
    }

    let cancelled = false;

    const requestLock = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        const nav = navigator as unknown as {
          wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
        };
        const lock = await nav.wakeLock.request('screen');
        if (cancelled) {
          await lock.release().catch(() => {});
          return;
        }
        sentinelRef.current = lock;
        setActive(true);
        lock.addEventListener('release', () => {
          if (!cancelled) setActive(false);
        });
      } catch {
        if (!cancelled) setActive(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };

    requestLock();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinelRef.current && !sentinelRef.current.released) {
        sentinelRef.current.release().catch(() => {});
      }
      sentinelRef.current = null;
      setActive(false);
    };
  }, [enabled, supported]);

  return { supported, active };
}
