import { ChevronRight, Moon, Sparkles } from 'lucide-react';
import { toBanglaDigits } from '../utils/formatters';
import {
  resolveActiveFastingContext,
  type FastingCalculationMethod,
  type FastingLocation,
} from '../utils/fasting';
import { formatHijriDateBn } from '../utils/hijri';

interface FastingCardProps {
  now: Date;
  gregorianDateLabel: string;
  location: FastingLocation;
  method: FastingCalculationMethod;
  timeFormat: '12h' | '24h';
  hijriOffsetDays: number;
  onOpenSchedule: () => void;
}

/**
 * Editorial Date, Sehri & Iftar card displayed outside the Home top hero band.
 */
export function FastingCard({
  now,
  gregorianDateLabel,
  location,
  method,
  timeFormat,
  hijriOffsetDays,
  onOpenSchedule,
}: FastingCardProps) {
  const { hijri, dailyTimes, progress, weeklySunnah } =
    resolveActiveFastingContext(
      now,
      location,
      method,
      timeFormat,
      hijriOffsetDays
    );

  const isRamadan = hijri.isRamadan;
  const isWeeklyToday = weeklySunnah.isWeeklySunnah;
  const isMonthlyToday = hijri.isAyyamAlBid;
  const isFastingDay = isRamadan || isWeeklyToday || isMonthlyToday;

  const highlightAccent = isRamadan ? 'var(--gold)' : 'var(--accent)';

  return (
    <section
      role="button"
      tabIndex={0}
      aria-label="আজকের তারিখ, সাহরি, ইফতার ও পূর্ণ মাসিক রোজার সময়সূচি দেখুন"
      onClick={onOpenSchedule}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenSchedule();
        }
      }}
      className="rounded-2xl px-4 py-3.5 border space-y-3 transition-opacity active:opacity-80 cursor-pointer group"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Top Row: Gregorian Date, Hijri Date + Location & Optional Ramadan/Sunnah Pill */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div
            className="text-xs sm:text-[13px] font-medium leading-snug truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {gregorianDateLabel}
          </div>
          <div
            className="text-[11px] leading-snug truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            {formatHijriDateBn(hijri)} • {location.nameBn}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isRamadan ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--gold-soft)',
                color: 'var(--gold)',
              }}
            >
              <Moon className="w-2.5 h-2.5" />
              রমজান {toBanglaDigits(hijri.day)}
            </span>
          ) : isFastingDay ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <Sparkles className="w-2.5 h-2.5" />
              {isMonthlyToday ? 'আইয়ামে বীজ' : 'সুন্নাহ রোজা'}
            </span>
          ) : null}
          <ChevronRight
            className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
      </div>

      {/* Subtle Divider */}
      <div
        className="h-px w-full"
        style={{
          backgroundColor:
            'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
        }}
        aria-hidden="true"
      />

      {/* Sehri & Iftar Readout */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-center">
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            সাহরি শেষ
          </div>
          <div
            className="text-base sm:text-lg font-semibold tabular-nums leading-tight mt-0.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {dailyTimes.sehriFormatted}
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

        <div className="text-center">
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            ইফতার
          </div>
          <div
            className="text-base sm:text-lg font-semibold tabular-nums leading-tight mt-0.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {dailyTimes.iftarFormatted}
          </div>
        </div>
      </div>

      {/* Slim Fasting Progress Bar on Fasting Days */}
      {isFastingDay && (
        <div className="space-y-1.5 pt-0.5">
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
            className="h-[3px] w-full rounded-full overflow-hidden"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--text-primary) 10%, transparent)',
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
      )}
    </section>
  );
}
