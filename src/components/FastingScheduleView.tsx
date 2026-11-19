import { useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sparkles } from 'lucide-react';
import type { Settings } from '../db/database';
import { toBanglaDigits } from '../utils/formatters';
import {
  buildHijriMonthSchedule,
  DEBUG_NOW_STORAGE_KEY,
  DEFAULT_FASTING_LOCATION,
  getCurrentNow,
  resolveIslamicCalendarDate,
} from '../utils/fasting';
import { clampHijriOffsetDays } from '../utils/hijri';
import { formatDateKey, MONTH_SHORT_BN } from '../utils/stats';
import { TopBar } from './NavigationChrome';

interface FastingScheduleViewProps {
  settings: Settings;
  onBack: () => void;
}

export function FastingScheduleView({
  settings,
  onBack,
}: FastingScheduleViewProps) {
  const [now, setNow] = useState<Date>(() => getCurrentNow());
  const todayRowRef = useRef<HTMLDivElement | null>(null);
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    const refreshNow = () => setNow(getCurrentNow());
    const intervalId = window.setInterval(refreshNow, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshNow();
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === DEBUG_NOW_STORAGE_KEY) {
        refreshNow();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const location = settings.fastingLocation ?? DEFAULT_FASTING_LOCATION;
  const method = settings.fastingMethod ?? 'karachi';
  const timeFormat = settings.fastingTimeFormat ?? '12h';
  const hijriOffsetDays = clampHijriOffsetDays(settings.hijriOffsetDays ?? 0);

  const { islamicDate } = resolveIslamicCalendarDate(now, location, method);
  const islamicDateKey = formatDateKey(islamicDate);

  const schedule = useMemo(
    () =>
      buildHijriMonthSchedule(nowRef.current, {
        location,
        method,
        timeFormat,
        hijriOffsetDays,
      }),
    [islamicDateKey, location, method, timeFormat, hijriOffsetDays]
  );

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      todayRowRef.current?.scrollIntoView({
        block: 'center',
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [islamicDateKey]);

  const accentColor = schedule.isRamadan ? 'var(--gold)' : 'var(--accent)';
  const accentSoft = schedule.isRamadan ? 'var(--gold-soft)' : 'var(--accent-soft)';

  return (
    <div className="min-h-dvh paper-frame pb-16">
      <TopBar
        mode="sticky"
        onBack={onBack}
        backLabel="ফিরে যান"
        title={`${schedule.hijriMonthNameBn} ${toBanglaDigits(schedule.hijriYear)} হি.`}
        titleBadge={
          schedule.isRamadan ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: 'var(--gold-soft)',
                color: 'var(--gold)',
              }}
            >
              <Moon className="w-3 h-3" />
              মাহে রমজান
            </span>
          ) : undefined
        }
        subtitle={`${location.nameBn} • ${toBanglaDigits(schedule.days.length)} দিনের সাহরি ও ইফতার`}
      />

      <main className="max-w-2xl mx-auto px-5 pt-4">
        {/* Legend Strip */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-4 text-[11px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--accent)' }}
            />
            সাপ্তাহিক সুন্নাহ (সোম ও বৃহঃ)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--gold)' }}
            />
            আইয়ামে বীজ (১৩–১৫ হিজরি)
          </span>
        </div>

        {/* Column Header */}
        <div
          className="grid grid-cols-[1.45fr_1fr_1fr] gap-2 py-2.5 border-y text-[11px] font-semibold uppercase tracking-wide"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <div>তারিখ</div>
          <div className="text-right">সাহরি শেষ</div>
          <div className="text-right">ইফতার</div>
        </div>

        {/* Full-Month Hairline Schedule List */}
        <div className="divide-y divide-[var(--border-subtle)]">
          {schedule.days.map((day) => {
            const gregorianText = `${toBanglaDigits(day.gregorianDate.getDate())} ${
              MONTH_SHORT_BN[day.gregorianDate.getMonth()]
            }`;

            return (
              <div
                key={day.dateKey}
                ref={day.isToday ? todayRowRef : undefined}
                className="py-3.5 px-2 -mx-2 rounded-xl grid grid-cols-[1.45fr_1fr_1fr] gap-2 items-center scroll-mt-28"
                style={
                  day.isToday
                    ? { backgroundColor: accentSoft }
                    : undefined
                }
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-semibold tabular-nums">
                      {toBanglaDigits(day.hijri.day)} {schedule.hijriMonthNameBn}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ({day.weekdayShortBn})
                    </span>
                    {day.isToday && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{
                          backgroundColor: accentColor,
                          color: 'var(--accent-text)',
                        }}
                      >
                        আজ
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-[11px] tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {gregorianText}
                    </span>
                    {day.isWeeklySunnah && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent)',
                        }}
                      >
                        {day.weeklySunnahType === 'monday'
                          ? 'সোম সুন্নাহ'
                          : 'বৃহঃ সুন্নাহ'}
                      </span>
                    )}
                    {day.isMonthlySunnah && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--gold-soft)',
                          color: 'var(--gold)',
                        }}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        আইয়ামে বীজ
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="text-right text-xs sm:text-sm font-medium tabular-nums"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {day.sehriFormatted}
                </div>

                <div
                  className="text-right text-xs sm:text-sm font-semibold tabular-nums"
                  style={{ color: accentColor }}
                >
                  {day.iftarFormatted}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
