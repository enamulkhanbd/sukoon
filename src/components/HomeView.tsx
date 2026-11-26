import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Flame,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { DuaItem } from '../data/duas';
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
import {
  useActiveFeaturedCard,
  useDuasCatalog,
} from '../services/contentCatalog';
import { countCompleteCachedSurahs } from '../services/quranApi';
import {
  getActiveAnchorsForSettings,
  useHijriCalendarConfig,
} from '../services/hijriCalendarService';
import {
  DEFAULT_FASTING_LOCATION,
  resolveHijriOffsetSettings,
} from '../utils/fasting';
import {
  DAY_NAMES_BN,
  DAY_SHORT_BN,
  normalizeIndoPakText,
  toBanglaDigits,
} from '../utils/formatters';
import {
  buildDayMetrics,
  buildHistoryMap,
  computeStreaks,
} from '../utils/stats';
import { FastingCard } from './FastingCard';
import { HeroCalligraphy } from './HeroCalligraphy';
import { LastReadSurahCard } from './LastReadSurahCard';
import { TwoLineMenuButton } from './NavigationChrome';
import { SukoonLogo } from './SukoonLogo';

interface HomeViewProps {
  settings: Settings;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenSurah: (surahId: number, targetAyah?: number) => void;
  onOpenDua: (dua: DuaItem) => void;
  onOpenRoutineTemplate: (templateId: string) => void;
  onDismissFeaturedCard: (cardId: string) => Promise<void>;
  onOpenRoutineDetails: (routine: Routine) => void;
  onOpenStats: () => void;
  onOpenFastingSchedule: () => void;
  onGoToRoutines: () => void;
  onGoToSurahs: () => void;
}

export function HomeView({
  settings,
  menuOpen,
  onOpenMenu,
  onOpenSearch,
  onOpenSettings,
  onOpenSurah,
  onOpenDua,
  onOpenRoutineTemplate,
  onDismissFeaturedCard,
  onOpenRoutineDetails,
  onOpenStats,
  onOpenFastingSchedule,
  onGoToRoutines,
  onGoToSurahs,
}: HomeViewProps) {

  const clock = useIslamicClock(settings);
  const { duaMap } = useDuasCatalog();
  const todayIso = `${clock.gregorianDate.getFullYear()}-${String(
    clock.gregorianDate.getMonth() + 1
  ).padStart(2, '0')}-${String(clock.gregorianDate.getDate()).padStart(2, '0')}`;
  const featuredCard = useActiveFeaturedCard(
    todayIso,
    settings.dismissedFeaturedCardIds ?? []
  );
  const now = clock.now;
  const todayIndex = clock.islamicWeekday;
  const fastingLocation = settings.fastingLocation ?? DEFAULT_FASTING_LOCATION;
  const fastingMethod = settings.fastingMethod ?? 'karachi';
  const fastingTimeFormat = settings.fastingTimeFormat ?? '12h';
  const { hijriOffsetDays, hijriOffsetMode } = resolveHijriOffsetSettings(
    fastingLocation,
    settings.hijriOffsetDays,
    settings.hijriOffsetMode
  );
  const hijriConfig = useHijriCalendarConfig();
  const hijriMonthAnchors = getActiveAnchorsForSettings(
    hijriConfig,
    fastingLocation,
    hijriOffsetMode
  );
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

  /** Clean minimal routine row with Apple-style circular progress ring (no dead bars or boxes). */
  const renderRoutineRow = (routine: Routine, isToday: boolean) => {
    const prog = progressMap.get(routine.id);
    const items = getRoutineItems(routine);
    const completedItemsCount = getCompletedItemIndexes(routine, prog).length;
    const percentage = prog?.percentage ?? 0;
    const isCompleted = percentage >= 100;

    const ringRadius = 11;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference * (1 - Math.min(100, Math.max(0, percentage)) / 100);

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
        className="py-2.5 flex items-center justify-between gap-3 transition-opacity active:opacity-70 cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Compact 28px circular progress ring */}
          <div className="w-7 h-7 shrink-0 flex items-center justify-center relative">
            {isCompleted ? (
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
              </span>
            ) : (
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                className="-rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="14"
                  cy="14"
                  r={ringRadius}
                  fill="none"
                  stroke="color-mix(in srgb, var(--text-primary) 12%, transparent)"
                  strokeWidth="2.5"
                />
                {percentage > 0 && (
                  <circle
                    cx="14"
                    cy="14"
                    r={ringRadius}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                  />
                )}
              </svg>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-snug truncate">
              {routine.title}
            </h3>
            <p
              className="text-xs mt-0.5 truncate tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              {toBanglaDigits(completedItemsCount)}/{toBanglaDigits(items.length)}টি অংশ সম্পন্ন
              {!isToday && ` • ${scheduleLabel}`}
            </p>
          </div>
        </div>

        <ChevronRight
          className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          style={{ color: 'var(--text-muted)' }}
        />
      </div>
    );
  };

  const lastReadMeta = lastRead ? SURAH_MAP[lastRead.surahId] : undefined;

  return (
    <div className="pb-28">
      {/* Full-Bleed Warm Tinted Top Hero Band */}
      <section
        className="w-full safe-top"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-5 space-y-6">
          {/* Minimal Top Brand Bar */}
          <div className="flex items-center justify-between gap-3">
            <SukoonLogo />
            <TwoLineMenuButton open={menuOpen} onClick={onOpenMenu} />
          </div>

          {/* Serene Thuluth Calligraphic Centerpiece */}
          <HeroCalligraphy />

          {/* Full-Width Global Search Bar Trigger */}
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="সূরা, আয়াত, দুআ, পারা বা রুটিন খুঁজুন"
            className="w-full relative flex items-center justify-between gap-2 pl-11 pr-3.5 py-2.5 rounded-full text-left transition-all active:scale-[0.99] cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-muted)',
            }}
          >
            <Search
              className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <span className="text-sm truncate">
              সূরা, আয়াত, দুআ, পারা বা রুটিন খুঁজুন...
            </span>
            <kbd
              className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-muted)',
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>
      </section>

      {/* Clean Editorial Canvas Below Hero */}
      <div className="max-w-2xl mx-auto px-5 pt-5 space-y-6">
        {/* Date, Sehri & Iftar Card Outside Header */}
        <FastingCard
          now={now}
          gregorianDateLabel={`${DAY_NAMES_BN[todayIndex]}, ${todayFormatted}`}
          location={fastingLocation}
          method={fastingMethod}
          timeFormat={fastingTimeFormat}
          hijriOffsetDays={hijriOffsetDays}
          monthAnchors={hijriMonthAnchors}
          onOpenSchedule={onOpenFastingSchedule}
        />

        {/* Admin-Published Home Spotlight Card */}
        {featuredCard && (
          <section
            aria-label="বিশেষ আমল"
            className="rounded-2xl p-4 sm:p-5 border space-y-3 relative"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{featuredCard.badgeLabel || 'বিশেষ আমল'}</span>
                </div>
                <h2 className="text-base font-semibold leading-snug">
                  {featuredCard.titleBangla}
                </h2>
              </div>
              <button
                type="button"
                aria-label="কার্ডটি বন্ধ করুন"
                onClick={() => void onDismissFeaturedCard(featuredCard.id)}
                className="p-1.5 rounded-full transition-opacity active:opacity-60 cursor-pointer shrink-0 -mr-1 -mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {featuredCard.arabicSnippet && (
              <p
                dir="rtl"
                className="font-indopak text-xl sm:text-2xl leading-[2.1] text-right px-3 py-2 rounded-xl"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                }}
              >
                {normalizeIndoPakText(featuredCard.arabicSnippet)}
              </p>
            )}

            <p
              className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-line"
              style={{ color: 'var(--text-secondary)' }}
            >
              {featuredCard.bodyBangla}
            </p>

            {featuredCard.action && featuredCard.action.type !== 'none' && (
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const act = featuredCard.action;
                    if (!act) return;
                    if (act.type === 'surah' && act.surahId) {
                      onOpenSurah(act.surahId, act.startAyah ?? 1);
                    } else if (act.type === 'dua' && act.duaId) {
                      const d = duaMap[act.duaId];
                      if (d) onOpenDua(d);
                    } else if (act.type === 'routineTemplate' && act.templateId) {
                      onOpenRoutineTemplate(act.templateId);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-85"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <span>
                    {featuredCard.action.ctaLabel ||
                      (featuredCard.action.type === 'routineTemplate'
                        ? 'রুটিন দেখুন'
                        : 'পাঠ করুন')}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </section>
        )}

        {/* Continue Reading — Single Focal Surface */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">সর্বশেষ তিলাওয়াত</h2>
            <button
              type="button"
              onClick={onGoToSurahs}
              className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer transition-opacity active:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              <span>সব সূরা</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {lastRead && lastReadMeta ? (
            <LastReadSurahCard lastRead={lastRead} onOpenSurah={onOpenSurah} />
          ) : lastRead !== undefined ? (
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="space-y-1">
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>বিসমিল্লাহ দিয়ে শুরু করুন</span>
                </div>
                <h3 className="text-base font-semibold">
                  প্রথম তিলাওয়াত শুরু করুন
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  আপনি যে আয়াতে থামবেন, সুকূন তা স্বয়ংক্রিয়ভাবে মনে রাখবে।
                </p>
              </div>
              <div className="flex items-center gap-2.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => onOpenSurah(1, 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-85"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-text)',
                  }}
                >
                  সূরা ফাতিহা
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Today's Ibadah + Daily Goal (Unified, Tight & Proportional) */}
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
          className="space-y-3.5 transition-opacity active:opacity-75 cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">আজকের আমল</h2>
              {streaks.currentStreak > 0 && (
                <span
                  className="inline-flex items-center justify-center gap-1 text-[11px] leading-none font-medium px-2.5 py-1 rounded-full tabular-nums"
                  style={{
                    backgroundColor: 'var(--gold-soft)',
                    color: 'var(--gold)',
                  }}
                >
                  <Flame className="w-3 h-3 shrink-0" />
                  <span className="translate-y-[1px]">
                    {toBanglaDigits(streaks.currentStreak)} দিন
                  </span>
                </span>
              )}
            </div>

            <span
              className="inline-flex items-center gap-0.5 text-xs font-medium shrink-0"
              style={{ color: 'var(--accent)' }}
            >
              <span>পরিসংখ্যান</span>
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
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
              <div key={stat.label} className="text-center py-1">
                <div
                  className="text-xl font-semibold tabular-nums leading-none"
                  style={{
                    color: stat.active ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-[11px] mt-1 font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {dailyGoalMinutes > 0 && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    দৈনিক তিলাওয়াত লক্ষ্য:{' '}
                    <strong
                      className="tabular-nums"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {toBanglaDigits(todayReadingMinutes)}/{toBanglaDigits(dailyGoalMinutes)} মি.
                    </strong>
                  </span>
                  {goalCompleted && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                      }}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      পূর্ণ
                    </span>
                  )}
                </span>
              </div>
              <div
                className="h-[3px] w-full rounded-full overflow-hidden"
                style={{
                  backgroundColor:
                    'color-mix(in srgb, var(--text-primary) 10%, transparent)',
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${goalPercent}%`,
                    backgroundColor: 'var(--accent)',
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Today's Routines */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">আজকের রুটিন</h2>
            <button
              type="button"
              onClick={onGoToRoutines}
              className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer transition-opacity active:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              <span>পরিচালনা</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todaysRoutines.length > 0 ? (
            <div>{todaysRoutines.map((r) => renderRoutineRow(r, true))}</div>
          ) : (
            <div className="py-4 text-center space-y-1">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                আজকের জন্য নির্ধারিত কোনো রুটিন নেই
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                আপনার সুবিধামতো দৈনিক বা সাপ্তাহিক রুটিন তৈরি করে নিতে পারেন।
              </p>
            </div>
          )}
        </section>

        {/* Other / Manual Routines */}
        {otherRoutines.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">অন্যান্য রুটিন</h2>
            <div>{otherRoutines.map((r) => renderRoutineRow(r, false))}</div>
          </section>
        )}

        {/* Quiet Offline Footnote */}
        {typeof cachedCount === 'number' && cachedCount < 114 && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] cursor-pointer transition-opacity active:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              অফলাইনে সংরক্ষিত সূরা: {toBanglaDigits(cachedCount)} / ১১৪ •{' '}
              <span style={{ color: 'var(--accent)' }}>সেটিংস থেকে ডাউনলোড করুন</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
