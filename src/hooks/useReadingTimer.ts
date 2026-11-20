import { useEffect, useRef } from 'react';
import { addReadingSeconds } from '../db/database';
import { toBanglaDigits } from '../utils/formatters';

const IDLE_TIMEOUT_MS = 120_000; // Pause if no interaction for 2 minutes
const FLUSH_INTERVAL_SECONDS = 15;

interface UseReadingTimerOptions {
  enabled: boolean;
  autoScrollActive: boolean;
  dailyGoalMinutes: number;
  onGoalReached?: (goalMinutes: number) => void;
}

/**
 * Tracks active Quran recitation time inside ReaderView.
 * Counts seconds only while the tab is visible and the user is actively reading
 * (recent interaction or active auto-scroll), flushing periodically and on exit.
 */
export function useReadingTimer({
  enabled,
  autoScrollActive,
  dailyGoalMinutes,
  onGoalReached,
}: UseReadingTimerOptions): void {
  const autoScrollRef = useRef(autoScrollActive);
  autoScrollRef.current = autoScrollActive;

  const goalMinutesRef = useRef(dailyGoalMinutes);
  goalMinutesRef.current = dailyGoalMinutes;

  const onGoalReachedRef = useRef(onGoalReached);
  onGoalReachedRef.current = onGoalReached;

  useEffect(() => {
    if (!enabled) return;

    let pendingSeconds = 0;
    let lastInteractionAt = Date.now();
    let flushing = false;

    const markActive = () => {
      lastInteractionAt = Date.now();
    };

    const flush = () => {
      if (pendingSeconds <= 0 || flushing) return;
      const delta = pendingSeconds;
      pendingSeconds = 0;
      flushing = true;

      const goalMins = Math.max(0, Math.floor(goalMinutesRef.current));
      addReadingSeconds({ deltaSeconds: delta, dailyGoalMinutes: goalMins })
        .then((result) => {
          if (result?.justReachedGoal && goalMins > 0) {
            onGoalReachedRef.current?.(goalMins);
          }
        })
        .catch(() => {
          // Restore unsaved seconds on transient failure
          pendingSeconds += delta;
        })
        .finally(() => {
          flushing = false;
        });
    };

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      const isActive =
        autoScrollRef.current || now - lastInteractionAt <= IDLE_TIMEOUT_MS;
      if (!isActive) return;

      pendingSeconds += 1;
      if (pendingSeconds >= FLUSH_INTERVAL_SECONDS) {
        flush();
      }
    };

    const intervalId = window.setInterval(tick, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      } else {
        markActive();
      }
    };

    const handlePageHide = () => {
      flush();
    };

    window.addEventListener('scroll', markActive, { passive: true });
    window.addEventListener('pointerdown', markActive, { passive: true });
    window.addEventListener('touchstart', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('scroll', markActive);
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('touchstart', markActive);
      window.removeEventListener('keydown', markActive);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      flush();
    };
  }, [enabled]);
}

export function formatGoalReachedToast(goalMinutes: number): string {
  return `মাশাআল্লাহ! আজকের ${toBanglaDigits(goalMinutes)} মিনিট তিলাওয়াতের লক্ষ্য পূর্ণ হয়েছে`;
}
