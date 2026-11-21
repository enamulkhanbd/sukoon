import { useEffect, useMemo, useRef, useState } from 'react';
import { Moon } from 'lucide-react';
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
import { TopBar, UnderlineTabs } from './NavigationChrome';

interface FastingScheduleViewProps {
  settings: Settings;
  onBack: () => void;
}

type NonRamadanFilter = 'all' | 'sunnah';
type RamadanAshraFilter = 'all' | 'rahmat' | 'magfirat' | 'najat';

export function FastingScheduleView({
  settings,
  onBack,
}: FastingScheduleViewProps) {
  const [now, setNow] = useState<Date>(() => getCurrentNow());
  const [nonRamadanFilter, setNonRamadanFilter] =
    useState<NonRamadanFilter>('all');
  const [ashraFilter, setAshraFilter] = useState<RamadanAshraFilter>('all');
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

  const todayEntry = useMemo(
    () => schedule.days.find((d) => d.isToday) ?? schedule.days[0],
    [schedule.days]
  );

  const sunnahDaysCount = useMemo(
    () =>
      schedule.days.filter((d) => d.isWeeklySunnah || d.isMonthlySunnah).length,
    [schedule.days]
  );

  const visibleDays = useMemo(() => {
    if (schedule.isRamadan) {
      if (ashraFilter === 'rahmat') {
        return schedule.days.filter((d) => d.hijri.day <= 10);
      }
      if (ashraFilter === 'magfirat') {
        return schedule.days.filter(
          (d) => d.hijri.day >= 11 && d.hijri.day <= 20
        );
      }
      if (ashraFilter === 'najat') {
        return schedule.days.filter((d) => d.hijri.day >= 21);
      }
      return schedule.days;
    }

    if (nonRamadanFilter === 'sunnah') {
      return schedule.days.filter((d) => d.isWeeklySunnah || d.isMonthlySunnah);
    }
    return schedule.days;
  }, [schedule.days, schedule.isRamadan, ashraFilter, nonRamadanFilter]);

  useEffect(() => {
    const isAllSelected = schedule.isRamadan
      ? ashraFilter === 'all'
      : nonRamadanFilter === 'all';
    if (!isAllSelected) return;

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
  }, [islamicDateKey, schedule.isRamadan, ashraFilter, nonRamadanFilter]);

  const accentColor = schedule.isRamadan ? 'var(--gold)' : 'var(--accent)';
  const accentSoft = schedule.isRamadan ? 'var(--gold-soft)' : 'var(--accent-soft)';

  return (
    <div className="min-h-dvh paper-frame pb-16">
      <TopBar
        mode="sticky"
        surface="tinted"
        onBack={onBack}
        backLabel="ফিরে যান"
        title={`${schedule.hijriMonthNameBn} ${toBanglaDigits(schedule.hijriYear)} হি.`}
        titleBadge={
          schedule.isRamadan ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
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
        subtitle={`${location.nameBn} • ${toBanglaDigits(schedule.days.length)} দিনের সময়সূচি`}
      />

      <main className="max-w-2xl mx-auto px-5 pt-5 space-y-5">
        {/* Elevated Today's At-a-Glance Card (matches Surah suggestion & FastingCard) */}
        {todayEntry && (
          <section
            className="rounded-2xl px-4 py-3.5 border space-y-3"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <span
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: accentColor }}
                >
                  {toBanglaDigits(todayEntry.hijri.day)} {schedule.hijriMonthNameBn}
                </span>
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  আজ • {toBanglaDigits(todayEntry.gregorianDate.getDate())}{' '}
                  {MONTH_SHORT_BN[todayEntry.gregorianDate.getMonth()]} (
                  {todayEntry.weekdayShortBn})
                </span>
              </div>
            </div>

            <div
              className="h-px w-full"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
              }}
              aria-hidden="true"
            />

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div>
                <div
                  className="text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  আজকের সাহরি শেষ
                </div>
                <div className="text-base font-semibold tabular-nums mt-0.5">
                  {todayEntry.sehriFormatted}
                </div>
              </div>

              <span
                className="h-7 w-px"
                style={{
                  backgroundColor:
                    'color-mix(in srgb, var(--text-primary) 12%, transparent)',
                }}
                aria-hidden="true"
              />

              <div>
                <div
                  className="text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  আজকের ইফতার
                </div>
                <div
                  className="text-base font-semibold tabular-nums mt-0.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {todayEntry.iftarFormatted}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Shared Underline Filter Tabs */}
        <section className="space-y-2.5">
          {schedule.isRamadan ? (
            <UnderlineTabs<RamadanAshraFilter>
              value={ashraFilter}
              onChange={setAshraFilter}
              ariaLabel="আশরা নির্বাচন"
              accentColor={accentColor}
              tabs={[
                { id: 'all', label: 'সব দিন' },
                { id: 'rahmat', label: 'রহমত' },
                { id: 'magfirat', label: 'মাগফিরাত' },
                { id: 'najat', label: 'নাজাত' },
              ]}
            />
          ) : (
            <UnderlineTabs<NonRamadanFilter>
              value={nonRamadanFilter}
              onChange={setNonRamadanFilter}
              ariaLabel="দিন ফিল্টার"
              accentColor={accentColor}
              tabs={[
                {
                  id: 'all',
                  label: 'সব দিন',
                  count: toBanglaDigits(schedule.days.length),
                },
                {
                  id: 'sunnah',
                  label: 'সুন্নাহ রোজা',
                  count: toBanglaDigits(sunnahDaysCount),
                },
              ]}
            />
          )}

          {/* Quiet Legend */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--accent)' }}
              />
              সোম ও বৃহঃ সুন্নাহ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--gold)' }}
              />
              আইয়ামে বীজ (১৩–১৫)
            </span>
          </div>
        </section>

        {/* Clean Tabular Schedule */}
        <section>
          <div
            className="grid grid-cols-[2.25rem_1fr_auto_auto] gap-x-3 pb-2 border-b text-[11px] font-medium"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            <div className="text-center">দিন</div>
            <div>তারিখ</div>
            <div className="text-right w-[4.75rem]">সাহরি শেষ</div>
            <div className="text-right w-[4.75rem]">ইফতার</div>
          </div>

          <div className="pt-1.5 space-y-1">
            {visibleDays.map((day, index) => {
              const isPast = day.dateKey < islamicDateKey;
              const nextDay = visibleDays[index + 1];
              const showDivider =
                index < visibleDays.length - 1 && !day.isToday && !nextDay?.isToday;
              const gregorianText = `${toBanglaDigits(day.gregorianDate.getDate())} ${
                MONTH_SHORT_BN[day.gregorianDate.getMonth()]
              }`;
              const sunnahNote = day.isMonthlySunnah
                ? day.isWeeklySunnah
                  ? 'আইয়ামে বীজ • সুন্নাহ'
                  : 'আইয়ামে বীজ'
                : day.isWeeklySunnah
                  ? 'সুন্নাহ রোজা'
                  : null;

              const dotColor = day.isMonthlySunnah
                ? 'var(--gold)'
                : day.isWeeklySunnah
                  ? 'var(--accent)'
                  : null;

              return (
                <div key={day.dateKey} ref={day.isToday ? todayRowRef : undefined} className="scroll-mt-28">
                  <div
                    className={`grid grid-cols-[2.25rem_1fr_auto_auto] gap-x-3 items-center py-3 transition-colors ${
                      day.isToday ? 'px-3 -mx-3 rounded-2xl' : 'px-0.5'
                    }`}
                    style={{
                      backgroundColor: day.isToday ? accentSoft : undefined,
                      opacity: isPast ? 0.52 : 1,
                    }}
                  >
                    {/* Hijri Day Number */}
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className="text-sm font-semibold tabular-nums leading-none"
                        style={{
                          color: day.isToday
                            ? accentColor
                            : dotColor ?? 'var(--text-primary)',
                        }}
                      >
                        {day.hijri.day < 10
                          ? `০${toBanglaDigits(day.hijri.day)}`
                          : toBanglaDigits(day.hijri.day)}
                      </span>
                      {dotColor && (
                        <span
                          className="w-1 h-1 rounded-full mt-1"
                          style={{ backgroundColor: dotColor }}
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {/* Gregorian Date + Weekday + Quiet Sunnah Note */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium tabular-nums truncate">
                          {gregorianText} • {day.weekdayShortBn}
                        </span>
                        {day.isToday && (
                          <span
                            className="text-[11px] font-medium px-1.5 py-[1px] rounded-full shrink-0"
                            style={{
                              backgroundColor: accentColor,
                              color: 'var(--accent-text)',
                            }}
                          >
                            আজ
                          </span>
                        )}
                      </div>
                      {sunnahNote && (
                        <div
                          className="text-[11px] mt-0.5 truncate"
                          style={{
                            color: day.isMonthlySunnah
                              ? 'var(--gold)'
                              : 'var(--accent)',
                          }}
                        >
                          {sunnahNote}
                        </div>
                      )}
                    </div>

                    {/* Sehri */}
                    <div
                      className="text-right text-xs font-medium tabular-nums w-[4.75rem]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {day.sehriFormatted}
                    </div>

                    {/* Iftar */}
                    <div
                      className="text-right text-xs font-medium tabular-nums w-[4.75rem]"
                      style={{ color: accentColor }}
                    >
                      {day.iftarFormatted}
                    </div>
                  </div>

                  {showDivider && (
                    <div
                      className="h-px w-full"
                      style={{
                        backgroundColor:
                          'color-mix(in srgb, var(--border-subtle) 65%, transparent)',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
