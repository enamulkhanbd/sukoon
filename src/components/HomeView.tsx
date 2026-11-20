import { useMemo, useState } from 'react';
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
  Target,
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
import { formatReadingDurationBn } from '../utils/islamicTime';
import {
  addDays,
  buildDayMetrics,
  buildHistoryMap,
  computeStreaks,
  formatDateKey,
} from '../utils/stats';
import { DailyGoalSheet } from './DailyGoalSheet';
import { FastingCard } from './FastingCard';
import { LastReadSurahCard } from './LastReadSurahCard';
import { TabHeader } from './NavigationChrome';
import { SukoonLogo } from './SukoonLogo';
import { useToast } from './ToastProvider';

interface HomeViewProps {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void>;
  onOpenSurah: (surahId: number, targetAyah?: number) => void;
  onOpenRoutineDetails: (routine: Routine) => void;
  onOpenStats: () => void;
  onOpenFastingSchedule: () => void;
  onGoToRoutines: () => void;
  onGoToSurahs: () => void;
}

export function HomeView({
  settings,
  onUpdateSettings,
  onOpenSurah,
  onOpenRoutineDetails,
  onOpenStats,
  onOpenFastingSchedule,
  onGoToRoutines,
  onGoToSurahs,
}: HomeViewProps) {
  const toast = useToast();
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);

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

  const { todayMetrics, streaks, recentSevenDays } = useMemo(() => {
    const map = buildHistoryMap(historyRows ?? []);
    const todayKey = clock.islamicDayKey;
    const recent = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(clock.islamicDate, i - 6);
      const key = formatDateKey(d);
      const metrics = buildDayMetrics(d, map.get(key), todayKey);
      return {
        key,
        weekdayShort: DAY_SHORT_BN[d.getDay()],
        metrics,
      };
    });
    return {
      todayMetrics: buildDayMetrics(
        clock.islamicDate,
        map.get(todayKey),
        todayKey
      ),
      streaks: computeStreaks(map, clock.islamicDate),
      recentSevenDays: recent,
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
  const goalCompleted = dailyGoalMinutes > 0 && todayReadingSeconds >= goalTargetSeconds;
  const remainingGoalMinutes =
    dailyGoalMinutes > 0
      ? Math.max(0, Math.ceil((goalTargetSeconds - todayReadingSeconds) / 60))
      : 0;

  const ringRadius = 18;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset =
    ringCircumference * (1 - (dailyGoalMinutes > 0 ? goalPercent / 100 : 0));

  const todayFormatted = new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(clock.gregorianDate);

  const handleSaveDailyGoal = async (minutes: number) => {
    await onUpdateSettings({ dailyGoalMinutes: minutes });
    toast.success(
      minutes > 0
        ? `দৈনিক তিলাওয়াত লক্ষ্য ${toBanglaDigits(minutes)} মিনিট নির্ধারিত হয়েছে`
        : 'দৈনিক তিলাওয়াত লক্ষ্য বন্ধ করা হয়েছে'
    );
  };

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
            {clock.isAfterMaghrib && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                মাগরিবের পর
              </span>
            )}
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

          <div className="flex items-center gap-1.5 shrink-0">
            {streaks.currentStreak > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--gold-soft)',
                  color: 'var(--gold)',
                }}
              >
                <Flame className="w-3 h-3" />
                {toBanglaDigits(streaks.currentStreak)} দিন
              </span>
            )}
            <ChevronRight
              className="w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>
        </div>

        {/* Daily Quran Recitation Goal Row (Ring + Status + Edit CTA) */}
        <div
          className="rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: goalCompleted
              ? 'color-mix(in srgb, var(--accent) 36%, var(--border-subtle))'
              : 'var(--border-subtle)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setGoalSheetOpen(true);
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Circular Progress Ring */}
            <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
              <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                <circle
                  cx="22"
                  cy="22"
                  r={ringRadius}
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth="3.5"
                />
                {dailyGoalMinutes > 0 && (
                  <circle
                    cx="22"
                    cy="22"
                    r={ringRadius}
                    fill="none"
                    stroke={goalCompleted ? 'var(--accent)' : 'var(--gold)'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringDashOffset}
                    className="transition-all duration-500"
                  />
                )}
              </svg>
              <span className="absolute inset-0 flex items-center justify-center">
                {dailyGoalMinutes <= 0 ? (
                  <Target className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                ) : goalCompleted ? (
                  <Check
                    className="w-4 h-4 stroke-[2.75]"
                    style={{ color: 'var(--accent)' }}
                  />
                ) : (
                  <span
                    className="text-[10px] font-bold tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {toBanglaDigits(goalPercent)}%
                  </span>
                )}
              </span>
            </div>

            {/* Goal Details */}
            <div className="min-w-0">
              {dailyGoalMinutes > 0 ? (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold tabular-nums">
                      তিলাওয়াত: {toBanglaDigits(todayReadingMinutes)} /{' '}
                      {toBanglaDigits(dailyGoalMinutes)} মি.
                    </span>
                    {goalCompleted && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent)',
                        }}
                      >
                        লক্ষ্য পূর্ণ
                      </span>
                    )}
                  </div>
                  <p
                    className="text-[11px] mt-0.5 truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {goalCompleted
                      ? `মাশাআল্লাহ! আজ ${formatReadingDurationBn(todayReadingSeconds)} তিলাওয়াত হয়েছে`
                      : `লক্ষ্য পূরণে আর ${toBanglaDigits(remainingGoalMinutes)} মিনিট বাকি`}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold">
                    দৈনিক কুরআন তিলাওয়াত লক্ষ্য
                  </div>
                  <p
                    className="text-[11px] mt-0.5 truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {todayReadingSeconds > 0
                      ? `আজ ${formatReadingDurationBn(todayReadingSeconds)} পড়া হয়েছে • লক্ষ্য নির্ধারণ করুন`
                      : 'প্রতিদিনের সময় লক্ষ্য সেট করুন'}
                  </p>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setGoalSheetOpen(true);
            }}
            className="shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer active:scale-95 transition-transform"
            style={{
              backgroundColor:
                dailyGoalMinutes > 0 ? 'var(--bg-elevated)' : 'var(--accent)',
              color:
                dailyGoalMinutes > 0 ? 'var(--accent)' : 'var(--accent-text)',
            }}
          >
            {dailyGoalMinutes > 0 ? 'পরিবর্তন' : 'সেট করুন'}
          </button>
        </div>

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

        {/* 7-Day Islamic-Day Consistency Strip */}
        <div
          className="pt-2.5 border-t flex items-center justify-between gap-2"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span
            className="text-[10px] font-medium shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            ৭ দিনের ধারা
          </span>
          <div className="flex items-center gap-1.5">
            {recentSevenDays.map(({ key, weekdayShort, metrics }) => {
              const goalTargetSec =
                (metrics.record?.goalMinutesTarget ?? dailyGoalMinutes) * 60;
              const metGoal =
                goalTargetSec > 0 && metrics.readingSeconds >= goalTargetSec;
              const hasRoutine = metrics.routines > 0;
              const strong = metGoal || hasRoutine;
              const partial = !strong && metrics.isActive;
              return (
                <div
                  key={key}
                  className="flex flex-col items-center gap-1"
                  title={`${weekdayShort}: ${toBanglaDigits(metrics.routines)} রুটিন, ${formatReadingDurationBn(metrics.readingSeconds)}`}
                >
                  <span
                    className="w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold"
                    style={{
                      backgroundColor: strong
                        ? 'var(--accent)'
                        : partial
                          ? 'var(--gold-soft)'
                          : 'transparent',
                      borderColor: metrics.isToday
                        ? 'var(--accent)'
                        : strong
                          ? 'var(--accent)'
                          : partial
                            ? 'var(--gold)'
                            : 'var(--border-subtle)',
                      color: strong
                        ? 'var(--accent-text)'
                        : partial
                          ? 'var(--gold)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {strong ? (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    ) : partial ? (
                      '•'
                    ) : (
                      ''
                    )}
                  </span>
                  <span
                    className="text-[9px] leading-none"
                    style={{
                      color: metrics.isToday
                        ? 'var(--accent)'
                        : 'var(--text-muted)',
                      fontWeight: metrics.isToday ? 600 : 400,
                    }}
                  >
                    {weekdayShort}
                  </span>
                </div>
              );
            })}
          </div>
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

      <DailyGoalSheet
        open={goalSheetOpen}
        onClose={() => setGoalSheetOpen(false)}
        currentGoalMinutes={dailyGoalMinutes}
        onSave={handleSaveDailyGoal}
      />
    </div>
  );
}
