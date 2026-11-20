import { useEffect, useMemo, useState } from 'react';
import type { Settings } from '../db/database';
import {
  DEBUG_NOW_STORAGE_KEY,
  DEFAULT_FASTING_LOCATION,
  getCurrentNow,
} from '../utils/fasting';
import {
  resolveIslamicDayContext,
  type IslamicDayContext,
} from '../utils/islamicTime';

/**
 * Reactive Islamic clock (Maghrib-to-Maghrib day + 5 waqt transitions).
 * Automatically re-evaluates on exact waqt/Maghrib transitions, every minute,
 * on tab visibility resume, and on debug clock storage overrides.
 */
export function useIslamicClock(
  settings: Pick<
    Settings,
    'fastingLocation' | 'fastingMethod' | 'fastingTimeFormat'
  >
): IslamicDayContext {
  const [now, setNow] = useState<Date>(() => getCurrentNow());

  const location = settings.fastingLocation ?? DEFAULT_FASTING_LOCATION;
  const method = settings.fastingMethod ?? 'karachi';
  const timeFormat = settings.fastingTimeFormat ?? '12h';

  const context = useMemo(
    () => resolveIslamicDayContext(now, location, method, timeFormat),
    [now, location, method, timeFormat]
  );

  useEffect(() => {
    const refresh = () => setNow(getCurrentNow());

    // Schedule exact wake-up at next waqt / Maghrib boundary (clamped to 15 min max)
    const msUntilTransition = context.nextTransitionAt.getTime() - now.getTime();
    const delay =
      Number.isFinite(msUntilTransition) && msUntilTransition > 0
        ? Math.min(msUntilTransition + 750, 15 * 60 * 1000)
        : 60_000;

    const boundaryTimer = window.setTimeout(refresh, delay);
    const minuteInterval = window.setInterval(refresh, 60_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === DEBUG_NOW_STORAGE_KEY) {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.clearTimeout(boundaryTimer);
      window.clearInterval(minuteInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, [context.nextTransitionAt, now]);

  return context;
}
