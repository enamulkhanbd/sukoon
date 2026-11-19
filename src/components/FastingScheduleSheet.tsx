import { useEffect, useMemo, useRef } from 'react';
import { Moon, Sparkles, X } from 'lucide-react';
import { toBanglaDigits } from '../utils/formatters';
import {
  buildHijriMonthSchedule,
  toZonedCalendarDate,
  type FastingCalculationMethod,
  type FastingLocation,
} from '../utils/fasting';
import { formatDateKey, MONTH_SHORT_BN } from '../utils/stats';
import { useBottomSheet } from './NavigationChrome';

interface FastingScheduleSheetProps {
  open: boolean;
  onClose: () => void;
  now: Date;
  location: FastingLocation;
  method: FastingCalculationMethod;
  timeFormat: '12h' | '24h';
  hijriOffsetDays: number;
}

export function FastingScheduleSheet({
  open,
  onClose,
  now,
  location,
  method,
  timeFormat,
  hijriOffsetDays,
}: FastingScheduleSheetProps) {
  const {
    mounted,
    visible,
    dragging,
    panelRef,
    backdropStyle,
    panelTransform,
    dragHandleProps,
  } = useBottomSheet(open, onClose);

  const todayRowRef = useRef<HTMLDivElement | null>(null);
  const nowRef = useRef(now);
  nowRef.current = now;

  const zonedNow = toZonedCalendarDate(now, location.timeZone);
  const safeZonedNow = Number.isFinite(zonedNow.getTime())
    ? zonedNow
    : toZonedCalendarDate(new Date(), location.timeZone);
  const zonedDateKey = formatDateKey(safeZonedNow);

  const schedule = useMemo(() => {
    if (!mounted) return null;
    return buildHijriMonthSchedule(nowRef.current, {
      location,
      method,
      timeFormat,
      hijriOffsetDays,
    });
  }, [mounted, zonedDateKey, location, method, timeFormat, hijriOffsetDays]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !visible) return;
    const timer = window.setTimeout(() => {
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      todayRowRef.current?.scrollIntoView({
        block: 'center',
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [open, visible]);

  if (!mounted || !schedule) return null;

  const accentColor = schedule.isRamadan ? 'var(--gold)' : 'var(--accent)';
  const accentSoft = schedule.isRamadan ? 'var(--gold-soft)' : 'var(--accent-soft)';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/40 pt-[72px] sm:px-4 sukoon-sheet-backdrop ${
        visible ? '' : 'pointer-events-none'
      }`}
      style={backdropStyle}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fasting-schedule-sheet-title"
        className={`w-full max-w-2xl h-full max-h-[calc(100dvh-72px)] rounded-t-[28px] border-t border-x shadow-2xl flex flex-col overflow-hidden sukoon-sheet-panel ${
          dragging ? 'sukoon-sheet-panel--dragging' : ''
        }`}
        style={{
          backgroundColor: 'var(--bg-page)',
          borderColor: 'var(--border-subtle)',
          transform: panelTransform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber & Header */}
        <div
          {...dragHandleProps}
          className="px-5 pt-2.5 pb-3 border-b shrink-0 select-none"
          style={{
            borderColor: 'var(--border-subtle)',
            touchAction: 'none',
          }}
        >
          <div
            className="w-9 h-1 rounded-full mx-auto mb-3 opacity-45"
            style={{ backgroundColor: 'var(--text-muted)' }}
          />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="fasting-schedule-sheet-title"
                  className="font-bold text-lg tracking-tight"
                >
                  {schedule.hijriMonthNameBn} {toBanglaDigits(schedule.hijriYear)} হি.
                </h2>
                {schedule.isRamadan && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--gold-soft)',
                      color: 'var(--gold)',
                    }}
                  >
                    <Moon className="w-3 h-3" />
                    মাহে রমজান
                  </span>
                )}
              </div>
              <p
                className="text-xs mt-0.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                {location.nameBn} • {toBanglaDigits(schedule.days.length)} দিনের সাহরি ও ইফতারের পূর্ণ সময়সূচি
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Legend Strip */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px]"
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
        </div>

        {/* Sticky Column Header */}
        <div
          className="grid grid-cols-[1.45fr_1fr_1fr] gap-2 px-4 sm:px-5 py-2.5 border-b text-[11px] font-semibold uppercase tracking-wide shrink-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <div>তারিখ</div>
          <div className="text-right">সাহরি শেষ</div>
          <div className="text-right">ইফতার</div>
        </div>

        {/* Consolidated Hairline List */}
        <div
          className="flex-1 min-h-0 overflow-y-auto safe-bottom"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <div className="divide-y divide-[var(--border-subtle)]">
            {schedule.days.map((day) => {
              const gregorianText = `${toBanglaDigits(day.gregorianDate.getDate())} ${
                MONTH_SHORT_BN[day.gregorianDate.getMonth()]
              }`;

              return (
                <div
                  key={day.dateKey}
                  ref={day.isToday ? todayRowRef : undefined}
                  className="px-4 sm:px-5 py-3 grid grid-cols-[1.45fr_1fr_1fr] gap-2 items-center"
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
        </div>
      </div>
    </div>
  );
}
