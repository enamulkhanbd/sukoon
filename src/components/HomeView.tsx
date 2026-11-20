import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Flame,
  Plus,
  Sparkles,
} from 'lucide-react';
import { SURAH_MAP } from '../data/surahs';
import {
  db,
  getCompletedItemIndexes,
  getRoutineItems,
  isRoutineProgressCurrent,
  type Routine,
  type RoutineProgress,
  type Settings,
} from '../db/database';
import { useIslamicClock } from '../hooks/useIslamicClock';
import { countCompleteCachedSurahs } from '../services/quranApi';
import { DEFAULT_FASTING_LOCATION } from '../utils/fasting';
import { clampHijriOffsetDays } from '../utils/hijri';
import {
  DAY_NAMES_BN,
  DAY_SHORT_BN,
  toBanglaDigits,
} from '../utils/formatters';
import {
  buildDayMetrics,
  buildHistoryMap,
  computeStreaks,
} from '../utils/stats';
import { FastingCard } from './FastingCard';
import { LastReadSurahCard } from './LastReadSurahCard';
import { TabHeader } from './NavigationChrome';
import { SukoonLogo } from './SukoonLogo';

interface HomeViewProps {
  settings: Settings;
  onOpenSurah: (surahId: number, targetAyah?: number) => void;
  onOpenRoutineDetails: (routine: Routine) => void;
  onOpenStats: () => void;
  onOpenFastingSchedule: () => void;
  onGoToRoutines: () => void;
  onGoToSurahs: () => void;
}

export function HomeView({
  settings,
  onOpenSurah,
  onOpenRoutineDetails,
  onOpenStats,
  onOpenFastingSchedule,
  onGoToRoutines,
  onGoToSurahs,
}: HomeViewProps) {
  const clock = useIslamicClock(settings);
  const now = clock.now;
  const todayIndex = clock.islamicWeekday;
  const fastingLocation = settings.fastingLocation ?? DEFAULT_FASTING_LOCATION;
  const fastingMethod = settings.fastingMethod ?? 'karachi';
  const fastingTimeFormat = settings.fastingTimeFormat ?? '12h';
  const hijriOffsetDays = clampHijriOffsetDays(settings.hijriOffsetDays ?? 0);
  const dailyGoalMinutes = Math.max(0, Math.floor(settings.dailyGoalMinutes ?? 0));

  const lastRead = useLiveQuery(
    async () => (await db.globalLastRead.get('current')) ?? null,
    []
  );
  const routines = useLiveQuery(
    () => db.routines.orderBy('createdAt').toArray(),
    []
  );
  const progressList = useLiveQuery(() => db.routineProgress.toArray(), []);
  const cachedCount = useLiveQuery(() => countCompleteCachedSurahs(), []);
  const historyRows = useLiveQuery(() => db.readingHistory.toArray(), []);

  const { todayMetrics, streaks } = useMemo(() => {
    const map = buildHistoryMap(historyRows ?? []);
    const todayKey = clock.islamicDayKey;
    return {
      todayMetrics: buildDayMetrics(
        clock.islamicDate,
        map.get(todayKey),
        todayKey
      ),
      streaks: computeStreaks(map, clock.islamicDate),
    };
  }, [historyRows, clock.islamicDate, clock.islamicDayKey]);

  // Only include progress records belonging to the active Islamic day (Maghrib-to-Maghrib)
  const progressMap = useMemo(() => {
    const map = new Map<string, RoutineProgress>();
    for (const p of progressList ?? []) {
      if (
        isRoutineProgressCurrent(
          p,
          clock.islamicDayKey,
          fastingLocation,
          fastingMethod
        )
      ) {
        map.set(p.routineId, p);
      }
    }
    return map;
  }, [progressList, clock.islamicDayKey, fastingLocation, fastingMethod]);

  const todaysRoutines = (routines ?? []).filter((r) =>
    r.assignedDays.includes(todayIndex)
  );
  const otherRoutines = (routines ?? []).filter(
    (r) => !r.assignedDays.includes(todayIndex)
  );

  const todayCompletedRoutinesCount = todaysRoutines.filter(
    (r) => (progressMap.get(r.id)?.percentage ?? 0) >= 100
  ).length;

  const todayReadingSeconds = todayMetrics.readingSeconds;
  const todayReadingMinutes = Math.floor(todayReadingSeconds / 60);
  const goalTargetSeconds = dailyGoalMinutes * 60;
  const goalPercent =
    goalTargetSeconds > 0
      ? Math.min(100, Math.round((todayReadingSeconds / goalTargetSeconds) * 100))
      : 0;
  const goalCompleted =
    dailyGoalMinutes > 0 && todayReadingSeconds >= goalTargetSeconds;

  const todayFormatted = new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(clock.gregorianDate);

  /** Compact fixed-height routine card for Home page (full details live on RoutineDetailView). */
  const renderRoutineCard = (routine: Routine, isToday: boolean) => {
    const prog = progressMap.get(routine.id);
    const items = getRoutineItems(routine);
    const completedItemsCount = getCompletedItemIndexes(routine, prog).length;
    const percentage = prog?.percentage ?? 0;
    const isCompleted = percentage >= 100;

    const scheduleLabel =
      routine.assignedDays.length === 7
        ? 'প্রতিদিন'
        : routine.assignedDays.length === 0
          ? 'ম্যানুয়াল'
          : routine.assignedDays.map((d) => DAY_SHORT_BN[d]).join(', ');

    return (
      <div
        key={routine.id}
        role="button"
        tabIndex={0}
        onClick={() => onOpenRoutineDetails(routine)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenRoutineDetails(routine);
          }
        }}
        className="min-h-[84px] rounded-2xl border px-4 py-3 flex flex-col justify-between gap-2.5 transition-colors active:scale-[0.995] cursor-pointer"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: isToday
            ? 'color-mix(in srgb, var(--accent) 28%, var(--border-subtle))'
            : 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-semibold text-sm tracking-tight truncate">
                {routine.title}
              </h3>
              {isCompleted && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  সম্পন্ন
                </span>
              )}
            </div>
            <p
              className="text-[11px] mt-0.5 truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {toBanglaDigits(completedItemsCount)}/{toBanglaDigits(items.length)}টি অংশ সম্পন্ন
              {!isToday && ` • ${scheduleLabel}`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="text-xs font-semibold tabular-nums"
              style={{
                color: percentage > 0 ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {toBanglaDigits(percentage)}%
            </span>
            <ChevronRight
              className="w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>
        </div>

        {/* Sleek single-line progress bar */}
        <div
          className="h-1.5 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              backgroundColor: 'var(--accent)',
            }}
          />
        </div>
      </div>
    );
  };

  const lastReadMeta = lastRead ? SURAH_MAP[lastRead.surahId] : undefined;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-6">
      <TabHeader
        title={<SukoonLogo />}
        subtitle="হৃদয়ের প্রশান্তিতে কুরআন ও দুআর নিত্যসঙ্গী"
        badge={
          <div
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
            }}
          >
            <CalendarDays className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            <span>
              {DAY_NAMES_BN[todayIndex]} • {todayFormatted}
            </span>
          </div>
        }
      />

      {/* Minimal Last-Read Surah Card (Top Section) */}
      {lastRead && lastReadMeta ? (
        <LastReadSurahCard lastRead={lastRead} onOpenSurah={onOpenSurah} />
      ) : lastRead !== undefined ? (
        <section
          className="rounded-3xl border p-5 relative overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                <Sparkles className="w-4 h-4" />
                <span>বিসমিল্লাহ দিয়ে শুরু করুন</span>
              </div>
              <h2 className="text-lg font-bold">প্রথম তিলাওয়াত শুরু করুন</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                আপনি যে আয়াতে থামবেন, সুকূন তা স্বয়ংক্রিয়ভাবে মনে রাখবে।
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenSurah(1, 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                }}
              >
                সূরা ফাতিহা
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onGoToSurahs}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <Compass className="w-3.5 h-3.5" />
                সব সূরা
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Ramadan & Fasting Card */}
      <FastingCard
        now={now}
        location={fastingLocation}
        method={fastingMethod}
        timeFormat={fastingTimeFormat}
        hijriOffsetDays={hijriOffsetDays}
        onOpenSchedule={onOpenFastingSchedule}
      />

      {/* Today's Ibadah Stats & Daily Quran Goal Card (Quran.com-inspired) */}
      <section
        role="button"
        tabIndex={0}
        onClick={onOpenStats}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenStats();
          }
        }}
        className="rounded-3xl border p-4 space-y-3.5 transition-colors cursor-pointer active:scale-[0.995]"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <BarChart3 className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs font-semibold truncate">
                আজকের আমল ও পরিসংখ্যান
              </h2>
            </div>
          </div>

          {streaks.currentStreak > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: 'var(--gold-soft)',
                color: 'var(--gold)',
              }}
            >
              <Flame className="w-3 h-3" />
              {toBanglaDigits(streaks.currentStreak)} দিন
            </span>
          )}
        </div>

        {/* Minimal unboxed Daily Quran Goal progress bar (only visible when goal is configured) */}
        {dailyGoalMinutes > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="font-medium truncate"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  দৈনিক তিলাওয়াত •{' '}
                  <strong
                    className="tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {toBanglaDigits(todayReadingMinutes)} /{' '}
                    {toBanglaDigits(dailyGoalMinutes)} মি.
                  </strong>
                </span>
                {goalCompleted && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                    লক্ষ্য পূর্ণ
                  </span>
                )}
              </div>
              <span
                className="font-semibold tabular-nums shrink-0"
                style={{
                  color: goalCompleted ? 'var(--accent)' : 'var(--gold)',
                }}
              >
                {toBanglaDigits(goalPercent)}%
              </span>
            </div>
            <div
              className="h-1.5 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${goalPercent}%`,
                  backgroundColor: goalCompleted
                    ? 'var(--accent)'
                    : 'var(--gold)',
                }}
              />
            </div>
          </div>
        )}

        {/* 4 Core Ibadah Metrics */}
        <div
          className="grid grid-cols-4 divide-x"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {[
            { label: 'জিকির', value: toBanglaDigits(todayMetrics.dhikir), active: todayMetrics.dhikir > 0 },
            { label: 'দুআ', value: toBanglaDigits(todayMetrics.duas), active: todayMetrics.duas > 0 },
            {
              label: 'রুটিন',
              value:
                todaysRoutines.length > 0
                  ? `${toBanglaDigits(todayCompletedRoutinesCount)}/${toBanglaDigits(todaysRoutines.length)}`
                  : toBanglaDigits(todayMetrics.routines),
              active:
                todayCompletedRoutinesCount > 0 || todayMetrics.routines > 0,
            },
            { label: 'আয়াত', value: toBanglaDigits(todayMetrics.ayahs), active: todayMetrics.ayahs > 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="px-1 py-1 text-center"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div
                className="text-base font-bold tabular-nums leading-tight"
                style={{
                  color: stat.active ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {stat.value}
              </div>
              <div
                className="text-[10px] mt-0.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Today's Routines */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            আজকের রুটিন ({DAY_NAMES_BN[todayIndex]})
          </h2>
          <button
            type="button"
            onClick={onGoToRoutines}
            className="inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
            style={{ color: 'var(--accent)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            রুটিন পরিচালনা
          </button>
        </div>

        {todaysRoutines.length > 0 ? (
          <div className="space-y-3">
            {todaysRoutines.map((r) => renderRoutineCard(r, true))}
          </div>
        ) : (
          <div
            className="rounded-2xl border p-5 text-center space-y-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <p className="text-sm font-medium">আজকের জন্য নির্ধারিত কোনো রুটিন নেই</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              আপনার সুবিধামতো দৈনিক বা সাপ্তাহিক রুটিন তৈরি করে নিতে পারেন।
            </p>
          </div>
        )}
      </section>

      {/* Other / Manual Routines */}
      {otherRoutines.length > 0 && (
        <section className="space-y-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            অন্যান্য রুটিন
          </h2>
          <div className="space-y-3">
            {otherRoutines.map((r) => renderRoutineCard(r, false))}
          </div>
        </section>
      )}

      {/* Subtle Offline Status Hint */}
      {typeof cachedCount === 'number' && cachedCount < 114 && (
        <div
          className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            অফলাইনে সংরক্ষিত সূরা: <strong>{toBanglaDigits(cachedCount)} / ১১৪</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            সেটিংস থেকে সম্পূর্ণ কুরআন ডাউনলোড করুন
          </span>
        </div>
      )}
    </div>
  );
}
