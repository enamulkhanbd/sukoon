import { ChevronRight, Moon, Sparkles, Sunrise } from 'lucide-react';
import { toBanglaDigits } from '../utils/formatters';
import {
  computeDailyFastingTimes,
  computeFastingProgress,
  toZonedCalendarDate,
  type FastingCalculationMethod,
  type FastingLocation,
} from '../utils/fasting';
import {
  formatHijriDateBn,
  getHijriDate,
  isWeeklySunnahFastDay,
} from '../utils/hijri';

interface FastingCardProps {
  now: Date;
  location: FastingLocation;
  method: FastingCalculationMethod;
  timeFormat: '12h' | '24h';
  hijriOffsetDays: number;
  onOpenSchedule: () => void;
}

export function FastingCard({
  now,
  location,
  method,
  timeFormat,
  hijriOffsetDays,
  onOpenSchedule,
}: FastingCardProps) {
  const zonedNow = toZonedCalendarDate(now, location.timeZone);
  const hijri = getHijriDate(zonedNow, hijriOffsetDays);
  const dailyTimes = computeDailyFastingTimes(now, location, method, timeFormat);
  const progress = computeFastingProgress(now, dailyTimes.sehri, dailyTimes.iftar);
  const weeklySunnah = isWeeklySunnahFastDay(zonedNow);

  const isRamadan = hijri.isRamadan;
  const isWeeklyToday = weeklySunnah.isWeeklySunnah;
  const isMonthlyToday = hijri.isAyyamAlBid;
  const weeklyTodayLabel =
    weeklySunnah.weekday === 'monday'
      ? 'সোমবার'
      : weeklySunnah.weekday === 'thursday'
        ? 'বৃহস্পতিবার'
        : null;

  const cardStyle = isRamadan
    ? {
        backgroundColor:
          'color-mix(in srgb, var(--gold-soft) 55%, var(--bg-elevated))',
        borderColor: 'color-mix(in srgb, var(--gold) 45%, var(--border-subtle))',
      }
    : {
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      };

  const highlightAccent = isRamadan ? 'var(--gold)' : 'var(--accent)';
  const highlightSoft = isRamadan ? 'var(--gold-soft)' : 'var(--accent-soft)';

  return (
    <section
      role="button"
      tabIndex={0}
      aria-label="সাহরি, ইফতার ও পূর্ণ মাসিক রোজার সময়সূচি দেখুন"
      onClick={onOpenSchedule}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenSchedule();
        }
      }}
      className="rounded-3xl border p-4 sm:p-5 space-y-3.5 transition-colors cursor-pointer active:scale-[0.995]"
      style={cardStyle}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: highlightSoft,
              color: highlightAccent,
            }}
          >
            {isRamadan ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sunrise className="w-4 h-4" />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="text-xs font-semibold truncate">
              {isRamadan ? 'মাহে রমজান' : 'সাহরি ও ইফতার'}
            </h2>
            <p
              className="text-[11px] mt-0.5 truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {formatHijriDateBn(hijri)} • {location.nameBn}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isRamadan ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--gold-soft)',
                color: 'var(--gold)',
              }}
            >
              <Sparkles className="w-3 h-3" />
              রমজান {toBanglaDigits(hijri.day)}
            </span>
          ) : (isWeeklyToday || isMonthlyToday) ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              সুন্নাহ রোজা
            </span>
          ) : null}
          <ChevronRight
            className="w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
      </div>

      {/* Unboxed Sehri & Iftar Readout */}
      <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)] py-0.5">
        <div className="pr-3 text-center">
          <div
            className="text-[11px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            সাহরি শেষ
          </div>
          <div
            className="text-base sm:text-lg font-bold tabular-nums leading-tight mt-0.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {dailyTimes.sehriFormatted}
          </div>
        </div>

        <div className="pl-3 text-center">
          <div
            className="text-[11px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            ইফতার
          </div>
          <div
            className="text-base sm:text-lg font-bold tabular-nums leading-tight mt-0.5"
            style={{ color: highlightAccent }}
          >
            {dailyTimes.iftarFormatted}
          </div>
        </div>
      </div>

      {/* Daily Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: 'var(--text-secondary)' }}>
            {progress.statusTextBn}
          </span>
          <span
            className="font-semibold tabular-nums"
            style={{ color: highlightAccent }}
          >
            {progress.percentTextBn}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={progress.statusTextBn}
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full rounded-full overflow-hidden"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--text-primary) 7%, transparent)',
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress.percent}%`,
              backgroundColor: highlightAccent,
            }}
          />
        </div>
      </div>

      {/* Weekly & Monthly Sunnah Fast Indicators */}
      <div
        className="pt-3 border-t flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[11px]"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span
            className={
              isWeeklyToday
                ? 'inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full'
                : 'inline-flex items-center gap-1'
            }
            style={
              isWeeklyToday
                ? {
                    backgroundColor: highlightSoft,
                    color: highlightAccent,
                  }
                : { color: 'var(--text-secondary)' }
            }
          >
            {isWeeklyToday && weeklyTodayLabel
              ? `আজ সাপ্তাহিক সুন্নাহ (${weeklyTodayLabel})`
              : 'সাপ্তাহিক সুন্নাহ: সোম ও বৃহঃ'}
          </span>

          <span style={{ color: 'var(--text-muted)' }} aria-hidden="true">
            •
          </span>

          <span
            className={
              isMonthlyToday
                ? 'inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full'
                : 'inline-flex items-center gap-1'
            }
            style={
              isMonthlyToday
                ? {
                    backgroundColor: highlightSoft,
                    color: highlightAccent,
                  }
                : { color: 'var(--text-secondary)' }
            }
          >
            {isMonthlyToday
              ? `আজ আইয়ামে বীজ (${toBanglaDigits(hijri.day)} তারিখ)`
              : 'মাসিক: ১৩–১৫ হিজরি'}
          </span>
        </div>

        <span
          className="font-medium shrink-0"
          style={{ color: highlightAccent }}
        >
          মাসিক সূচি
        </span>
      </div>
    </section>
  );
}
