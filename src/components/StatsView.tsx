import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Target,
} from 'lucide-react';
import { DUA_MAP } from '../data/duas';
import { db, type Routine, type Settings } from '../db/database';
import { useIslamicClock } from '../hooks/useIslamicClock';
import { toBanglaDigits } from '../utils/formatters';
import { formatReadingDurationBn } from '../utils/islamicTime';
import {
  buildDayMetrics,
  buildHistoryMap,
  buildMonthlyStats,
  buildWeeklyStats,
  buildYearlyStats,
  computeIntensityLevel,
  computeStreaks,
  computeTopBreakdowns,
  formatDayDateBn,
  getMetricValue,
  WEEK_DAYS_SAT_SHORT_BN,
  type DayMetrics,
  type StatsMetric,
  type StatsPeriod,
  type YearMonthBucket,
} from '../utils/stats';
import { DailyGoalSheet } from './DailyGoalSheet';
import { TopBar, UnderlineTabs } from './NavigationChrome';
import { useToast } from './ToastProvider';

interface StatsViewProps {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void>;
  onBack: () => void;
}

const PERIOD_TABS: Array<{ id: StatsPeriod; label: string }> = [
  { id: 'weekly', label: 'সাপ্তাহিক' },
  { id: 'monthly', label: 'মাসিক' },
  { id: 'yearly', label: 'বাৎসরিক' },
];

const METRIC_META: Record<StatsMetric, { label: string; unit: string }> = {
  all: { label: 'সব আমল', unit: '' },
  dhikir: { label: 'জিকির', unit: 'বার' },
  duas: { label: 'দুআ', unit: 'টি' },
  routines: { label: 'রুটিন', unit: 'টি' },
  ayahs: { label: 'আয়াত', unit: 'আয়াত' },
};

function getHeatmapCellColors(level: 0 | 1 | 2 | 3 | 4): {
  bg: string;
  text: string;
} {
  switch (level) {
    case 0:
      return {
        bg: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
        text: 'var(--text-muted)',
      };
    case 1:
      return {
        bg: 'color-mix(in srgb, var(--accent) 20%, transparent)',
        text: 'var(--text-primary)',
      };
    case 2:
      return {
        bg: 'color-mix(in srgb, var(--accent) 42%, transparent)',
        text: 'var(--text-primary)',
      };
    case 3:
      return {
        bg: 'color-mix(in srgb, var(--accent) 70%, transparent)',
        text: 'var(--accent-text)',
      };
    case 4:
      return {
        bg: 'var(--accent)',
        text: 'var(--accent-text)',
      };
  }
}

export function StatsView({
  settings,
  onUpdateSettings,
  onBack,
}: StatsViewProps) {
  const toast = useToast();
  const clock = useIslamicClock(settings);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [period, setPeriod] = useState<StatsPeriod>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [metric, setMetric] = useState<StatsMetric>('all');

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);
  const yearlyGridScrollRef = useRef<HTMLDivElement | null>(null);
  const focusWeekColRef = useRef<HTMLDivElement | null>(null);

  const historyRows = useLiveQuery(() => db.readingHistory.toArray(), []);
  const routines = useLiveQuery(() => db.routines.toArray(), []);

  const historyMap = useMemo(
    () => buildHistoryMap(historyRows ?? []),
    [historyRows]
  );

  const routinesMap = useMemo(
    () => new Map<string, Routine>((routines ?? []).map((r) => [r.id, r])),
    [routines]
  );

  const streaks = useMemo(
    () => computeStreaks(historyMap, clock.islamicDate),
    [historyMap, clock.islamicDate]
  );

  const weekly = useMemo(
    () => buildWeeklyStats(historyMap, weekOffset, clock.islamicDate),
    [historyMap, weekOffset, clock.islamicDate]
  );
  const monthly = useMemo(
    () => buildMonthlyStats(historyMap, monthOffset, clock.islamicDate),
    [historyMap, monthOffset, clock.islamicDate]
  );
  const yearly = useMemo(
    () => buildYearlyStats(historyMap, yearOffset, clock.islamicDate),
    [historyMap, yearOffset, clock.islamicDate]
  );

  useEffect(() => {
    if (period === 'weekly') {
      const todayCell = weekly.days.find((d) => d.isToday);
      const latestActive = [...weekly.days].reverse().find((d) => d.isActive);
      setSelectedDayKey((todayCell ?? latestActive ?? weekly.days[0])?.dateKey ?? null);
    } else if (period === 'monthly') {
      const todayCell = monthly.daysInMonth.find((d) => d.isToday);
      const latestActive = [...monthly.daysInMonth].reverse().find((d) => d.isActive);
      setSelectedDayKey(
        (todayCell ?? latestActive ?? monthly.daysInMonth[0])?.dateKey ?? null
      );
    } else {
      const currentMonth = yearly.months.find((m) => m.isCurrentMonth);
      const latestActiveMonth = [...yearly.months].reverse().find((m) => m.activeDays > 0);
      setSelectedMonthIdx(
        (currentMonth ?? latestActiveMonth ?? yearly.months[0])?.monthIndex ?? 0
      );
      setSelectedDayKey(null);
    }
  }, [period, weekOffset, monthOffset, yearOffset]);

  const activeTotals =
    period === 'weekly'
      ? weekly.totals
      : period === 'monthly'
        ? monthly.totals
        : yearly.totals;

  const activeRecords =
    period === 'weekly'
      ? weekly.records
      : period === 'monthly'
        ? monthly.records
        : yearly.records;

  const activeLabel =
    period === 'weekly'
      ? weekly.label
      : period === 'monthly'
        ? monthly.label
        : yearly.label;

  const activeSublabel =
    period === 'weekly'
      ? weekly.sublabel
      : period === 'monthly'
        ? monthly.sublabel
        : yearly.sublabel;

  const isCurrentPeriod =
    period === 'weekly'
      ? weekOffset === 0
      : period === 'monthly'
        ? monthOffset === 0
        : yearOffset === 0;

  const handlePrevPeriod = () => {
    if (period === 'weekly') setWeekOffset((v) => v - 1);
    else if (period === 'monthly') setMonthOffset((v) => v - 1);
    else setYearOffset((v) => v - 1);
  };

  const handleNextPeriod = () => {
    if (period === 'weekly') setWeekOffset((v) => Math.min(0, v + 1));
    else if (period === 'monthly') setMonthOffset((v) => Math.min(0, v + 1));
    else setYearOffset((v) => Math.min(0, v + 1));
  };

  const handleJumpCurrent = () => {
    if (period === 'weekly') setWeekOffset(0);
    else if (period === 'monthly') setMonthOffset(0);
    else setYearOffset(0);
  };

  const toggleMetric = (target: Exclude<StatsMetric, 'all'>) => {
    setMetric((prev) => (prev === target ? 'all' : target));
  };

  const topBreakdowns = useMemo(
    () => computeTopBreakdowns(activeRecords, routinesMap),
    [activeRecords, routinesMap]
  );

  const selectedDay: DayMetrics | null = useMemo(() => {
    if (!selectedDayKey) return null;
    if (period === 'weekly') {
      return weekly.days.find((d) => d.dateKey === selectedDayKey) ?? null;
    }
    if (period === 'monthly') {
      return monthly.daysInMonth.find((d) => d.dateKey === selectedDayKey) ?? null;
    }
    for (const w of yearly.weeks) {
      const found = w.days.find((d) => d.inTargetYear && d.dateKey === selectedDayKey);
      if (found) return found;
    }
    return null;
  }, [period, selectedDayKey, weekly.days, monthly.daysInMonth, yearly.weeks]);

  const selectedMonth: YearMonthBucket | null = useMemo(() => {
    if (period !== 'yearly' || selectedMonthIdx === null) return null;
    return yearly.months[selectedMonthIdx] ?? null;
  }, [period, selectedMonthIdx, yearly.months]);

  const weeklyMax = useMemo(
    () => Math.max(1, ...weekly.days.map((d) => getMetricValue(d, metric))),
    [weekly.days, metric]
  );

  const monthlyMax = useMemo(
    () => Math.max(0, ...monthly.daysInMonth.map((d) => getMetricValue(d, metric))),
    [monthly.daysInMonth, metric]
  );

  const yearlyMonthMax = useMemo(
    () => Math.max(1, ...yearly.months.map((m) => getMetricValue(m, metric))),
    [yearly.months, metric]
  );

  const yearlyDayMax = useMemo(() => {
    let max = 0;
    for (const w of yearly.weeks) {
      for (const d of w.days) {
        if (!d.inTargetYear) continue;
        const val = getMetricValue(d, metric);
        if (val > max) max = val;
      }
    }
    return max;
  }, [yearly.weeks, metric]);

  const yearlyFocusWeekIndex = useMemo(() => {
    if (yearly.isCurrent) {
      const todayWeek = yearly.weeks.find((w) => w.days.some((d) => d.isToday));
      if (todayWeek) return todayWeek.weekIndex;
    }
    const latestActiveWeek = [...yearly.weeks]
      .reverse()
      .find((w) => w.days.some((d) => d.inTargetYear && d.isActive));
    return latestActiveWeek?.weekIndex ?? 0;
  }, [yearly.isCurrent, yearly.weeks]);

  useEffect(() => {
    if (period !== 'yearly') return;
    const raf = requestAnimationFrame(() => {
      const container = yearlyGridScrollRef.current;
      const targetCol = focusWeekColRef.current;
      if (!container || !targetCol) return;
      const colRect = targetCol.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const colLeftInsideScroll =
        colRect.left - containerRect.left + container.scrollLeft;
      const targetLeft =
        colLeftInsideScroll - container.clientWidth * 0.68 + colRect.width / 2;
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      container.scrollLeft = Math.min(maxScroll, Math.max(0, targetLeft));
    });
    return () => cancelAnimationFrame(raf);
  }, [period, yearOffset, yearlyFocusWeekIndex]);

  const metricLedger: Array<{
    id: Exclude<StatsMetric, 'all'>;
    label: string;
    value: number;
  }> = [
      { id: 'dhikir', label: 'জিকির', value: activeTotals.dhikir },
      { id: 'duas', label: 'দুআ', value: activeTotals.duas },
      { id: 'routines', label: 'রুটিন', value: activeTotals.routines },
      { id: 'ayahs', label: 'আয়াত', value: activeTotals.ayahs },
    ];

  const renderDayNote = (day: DayMetrics) => {
    const completedRoutines = day.record?.routinesCompleted ?? [];
    const duaIds = Object.keys(day.record?.duaCounts ?? {});
    const fallbackDuaIds =
      duaIds.length > 0 ? duaIds : day.record?.duasCompleted ?? [];

    return (
      <div
        className="mt-5 pl-3.5 border-l-2 space-y-2.5"
        style={{
          borderColor: day.isActive ? 'var(--accent)' : 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">
              {formatDayDateBn(day.date)}
            </span>
            {day.isToday && (
              <span
                className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                আজ
              </span>
            )}
          </div>
          {!day.isActive && (
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              কোনো আমল রেকর্ড হয়নি
            </span>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {[
            { label: 'জিকির', val: day.dhikir },
            { label: 'দুআ', val: day.duas },
            { label: 'রুটিন', val: day.routines },
            { label: 'আয়াত', val: day.ayahs },
          ].map((item) => (
            <div key={item.label} className="inline-flex items-baseline gap-1.5">
              <span
                className="font-semibold tabular-nums text-sm"
                style={{
                  color: item.val > 0 ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {toBanglaDigits(item.val)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            </div>
          ))}
          {day.readingSeconds > 0 && (
            <div className="inline-flex items-baseline gap-1.5">
              <span
                className="font-semibold tabular-nums text-sm"
                style={{ color: 'var(--gold)' }}
              >
                {formatReadingDurationBn(day.readingSeconds)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>তিলাওয়াত</span>
            </div>
          )}
        </div>

        {(completedRoutines.length > 0 || fallbackDuaIds.length > 0) && (
          <div
            className="text-[11px] leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {completedRoutines.length > 0 && (
              <span>
                <span style={{ color: 'var(--accent)' }}>রুটিন:</span>{' '}
                {completedRoutines
                  .map((rid) => routinesMap.get(rid)?.title ?? 'রুটিন')
                  .join(' • ')}
              </span>
            )}
            {completedRoutines.length > 0 && fallbackDuaIds.length > 0 && (
              <span className="mx-2 opacity-40">|</span>
            )}
            {fallbackDuaIds.length > 0 && (
              <span>
                <span style={{ color: 'var(--gold)' }}>দুআ:</span>{' '}
                {fallbackDuaIds
                  .slice(0, 5)
                  .map((did) => {
                    const cnt = day.record?.duaCounts?.[did] ?? 1;
                    const title = DUA_MAP[did]?.titleBangla ?? 'দুআ';
                    return cnt > 1 ? `${title} (×${toBanglaDigits(cnt)})` : title;
                  })
                  .join(' • ')}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderIntensityLegend = () => (
    <div
      className="flex items-center justify-end gap-1.5 text-[11px]"
      style={{ color: 'var(--text-muted)' }}
    >
      <span>কম</span>
      {([0, 1, 2, 3, 4] as const).map((lvl) => (
        <span
          key={lvl}
          className="w-2.5 h-2.5 rounded-[3px]"
          style={{ backgroundColor: getHeatmapCellColors(lvl).bg }}
        />
      ))}
      <span>বেশি</span>
    </div>
  );

  const dailyGoalMinutes = Math.max(
    0,
    Math.floor(settings.dailyGoalMinutes ?? 0)
  );
  const todayStats = useMemo(
    () =>
      buildDayMetrics(
        clock.islamicDate,
        historyMap.get(clock.islamicDayKey),
        clock.islamicDayKey
      ),
    [historyMap, clock.islamicDate, clock.islamicDayKey]
  );
  const todayReadingMinutes = Math.floor(todayStats.readingSeconds / 60);
  const goalTargetSeconds = dailyGoalMinutes * 60;
  const goalPercent =
    goalTargetSeconds > 0
      ? Math.min(
          100,
          Math.round((todayStats.readingSeconds / goalTargetSeconds) * 100)
        )
      : 0;
  const goalCompleted =
    dailyGoalMinutes > 0 && todayStats.readingSeconds >= goalTargetSeconds;

  const hasAnyPeriodActivity = activeTotals.activeDays > 0;
  const maxTopDuaScore = topBreakdowns.topDuas[0]?.score ?? 1;
  const maxTopRoutineCount = topBreakdowns.topRoutines[0]?.count ?? 1;

  return (
    <div className="min-h-dvh paper-frame pb-16">
      <TopBar
        mode="sticky"
        surface="tinted"
        onBack={onBack}
        backLabel="ফিরে যান"
        title="আমল পরিসংখ্যান"
        subtitle="সাপ্তাহিক, মাসিক ও বাৎসরিক ধারাবাহিকতা"
      />

      <main className="max-w-2xl mx-auto px-5 pt-5 space-y-6">
        {/* Elevated Daily Recitation Goal Card (matches Surah suggestion & FastingCard) */}
        <section
          className="rounded-2xl px-4 py-3.5 border space-y-2.5"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Target
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap text-xs font-medium">
                  <span>দৈনিক কুরআন তিলাওয়াত লক্ষ্য</span>
                  {goalCompleted && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                      }}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      সম্পন্ন
                    </span>
                  )}
                </div>
                <p
                  className="text-[11px] mt-0.5 tabular-nums"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {dailyGoalMinutes > 0
                    ? `আজ ${toBanglaDigits(todayReadingMinutes)} / ${toBanglaDigits(dailyGoalMinutes)} মিনিট (${toBanglaDigits(goalPercent)}%)`
                    : todayStats.readingSeconds > 0
                      ? `আজ ${formatReadingDurationBn(todayStats.readingSeconds)} পড়া হয়েছে • কোনো লক্ষ্য সেট করা নেই`
                      : 'প্রতিদিনের তিলাওয়াতের সময়-লক্ষ্য নির্ধারণ করুন'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGoalSheetOpen(true)}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-opacity active:opacity-75"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              {dailyGoalMinutes > 0 ? 'পরিবর্তন' : 'লক্ষ্য সেট'}
            </button>
          </div>
          {dailyGoalMinutes > 0 && (
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
          )}
        </section>

        {/* Shared Underline Period Tabs + Clean Date Navigator */}
        <section className="space-y-4">
          <UnderlineTabs
            value={period}
            onChange={setPeriod}
            ariaLabel="সময়কাল নির্বাচন"
            tabs={PERIOD_TABS}
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrevPeriod}
              aria-label="পূর্ববর্তী সময়কাল"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center min-w-0 flex-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-base font-semibold truncate">
                  {activeLabel}
                </span>
                {!isCurrentPeriod && (
                  <button
                    type="button"
                    onClick={handleJumpCurrent}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent)',
                    }}
                  >
                    চলতি
                  </button>
                )}
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {activeSublabel}
              </p>
            </div>

            <button
              type="button"
              onClick={handleNextPeriod}
              disabled={isCurrentPeriod}
              aria-label="পরবর্তী সময়কাল"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer disabled:opacity-25 disabled:cursor-default"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Open Typographic Metric Ledger + Quiet Streak Line (Zero Cards) */}
        <section className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {metricLedger.map((item) => {
              const active = metric === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleMetric(item.id)}
                  aria-pressed={active}
                  className="group py-2 px-1 rounded-xl text-center transition-colors cursor-pointer relative"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <div
                    className="text-2xl sm:text-3xl font-semibold tabular-nums leading-none"
                    style={{
                      color: active
                        ? 'var(--accent)'
                        : item.value > 0
                          ? 'var(--text-primary)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {toBanglaDigits(item.value)}
                  </div>
                  <div
                    className="text-[11px] mt-1.5 font-medium"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {item.label}
                  </div>
                  <span
                    className="block mx-auto mt-1.5 h-[2px] w-5 rounded-full transition-opacity"
                    style={{
                      backgroundColor: 'var(--accent)',
                      opacity: active ? 1 : 0,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Quiet Prose-Style Streak & Consistency Bar */}
          <div
            className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 py-2.5 border-y text-[11px]"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
              চলমান ধারা{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {toBanglaDigits(streaks.currentStreak)} দিন
              </strong>
            </span>
            <span className="opacity-30">•</span>
            <span>
              সেরা{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {toBanglaDigits(streaks.bestStreak)} দিন
              </strong>
            </span>
            <span className="opacity-30">•</span>
            <span>
              সক্রিয়{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {toBanglaDigits(activeTotals.activeDays)} দিন
              </strong>
            </span>
            {activeTotals.readingSeconds > 0 && (
              <>
                <span className="opacity-30">•</span>
                <span>
                  তিলাওয়াত{' '}
                  <strong style={{ color: 'var(--accent)' }}>
                    {formatReadingDurationBn(activeTotals.readingSeconds)}
                  </strong>
                </span>
              </>
            )}
          </div>
        </section>

        {/* WEEKLY VISUALIZATION (Open Editorial Canvas) */}
        {period === 'weekly' && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2
                className="text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                দৈনিক অগ্রগতি — {METRIC_META[metric].label}
              </h2>
              {metric !== 'all' && (
                <button
                  type="button"
                  onClick={() => setMetric('all')}
                  className="text-[11px] font-medium cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  সব দেখুন
                </button>
              )}
            </div>

            <div className="grid grid-cols-7 gap-2 pt-4">
              {weekly.days.map((day) => {
                const value = getMetricValue(day, metric);
                const heightPct =
                  value > 0 ? Math.max(8, Math.round((value / weeklyMax) * 100)) : 3;
                const isSelected = selectedDayKey === day.dateKey;

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => setSelectedDayKey(day.dateKey)}
                    className="flex flex-col items-center gap-2 py-1 cursor-pointer group"
                  >
                    <span
                      className="text-[11px] font-medium tabular-nums h-3.5 flex items-center"
                      style={{
                        color:
                          value > 0
                            ? isSelected
                              ? 'var(--accent)'
                              : 'var(--text-muted)'
                            : 'transparent',
                      }}
                    >
                      {metric === 'all'
                        ? day.isActive
                          ? '•'
                          : ''
                        : toBanglaDigits(value)}
                    </span>

                    <div className="w-full h-32 flex items-end justify-center">
                      <div
                        className="w-3 sm:w-4 rounded-full transition-all duration-300"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor:
                            value > 0
                              ? isSelected || day.isToday
                                ? 'var(--accent)'
                                : 'color-mix(in srgb, var(--accent) 48%, transparent)'
                              : 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
                          opacity: day.isFuture ? 0.4 : 1,
                        }}
                      />
                    </div>

                    <div
                      className="px-2 py-1 rounded-full text-center leading-tight transition-colors"
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--accent-soft)'
                          : 'transparent',
                      }}
                    >
                      <div
                        className="text-[11px] font-medium"
                        style={{
                          color:
                            isSelected || day.isToday
                              ? 'var(--accent)'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {WEEK_DAYS_SAT_SHORT_BN[day.satWeekIndex]}
                      </div>
                      <div
                        className="text-[11px] tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {toBanglaDigits(day.dayOfMonth)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDay && renderDayNote(selectedDay)}
          </section>
        )}

        {/* MONTHLY CALENDAR HEATMAP (Open Editorial Canvas) */}
        {period === 'monthly' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2
                className="text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                মাসিক ক্যালেন্ডার — {METRIC_META[metric].label}
              </h2>
              {metric !== 'all' && (
                <button
                  type="button"
                  onClick={() => setMetric('all')}
                  className="text-[11px] font-medium cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  সব দেখুন
                </button>
              )}
            </div>

            <div className="grid grid-cols-7 gap-2 text-center">
              {WEEK_DAYS_SAT_SHORT_BN.map((d) => (
                <div
                  key={d}
                  className="text-[11px] font-medium py-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {monthly.cells.map((cell) => {
                if (!cell.inCurrentMonth) {
                  return (
                    <div
                      key={cell.dateKey}
                      className="aspect-square flex items-center justify-center text-[11px] opacity-20 select-none"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {toBanglaDigits(cell.dayOfMonth)}
                    </div>
                  );
                }

                const val = getMetricValue(cell, metric);
                const level = computeIntensityLevel(val, monthlyMax, metric);
                const colors = getHeatmapCellColors(level);
                const isSelected = selectedDayKey === cell.dateKey;

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => setSelectedDayKey(cell.dateKey)}
                    aria-label={formatDayDateBn(cell.date)}
                    className="aspect-square rounded-2xl flex items-center justify-center text-xs font-medium tabular-nums transition-transform active:scale-95 cursor-pointer"
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                      opacity: cell.isFuture ? 0.4 : 1,
                      boxShadow: isSelected
                        ? '0 0 0 2px var(--bg-page), 0 0 0 3.5px var(--accent)'
                        : cell.isToday
                          ? 'inset 0 0 0 1.5px var(--accent)'
                          : undefined,
                    }}
                  >
                    {toBanglaDigits(cell.dayOfMonth)}
                  </button>
                );
              })}
            </div>

            {renderIntensityLegend()}

            {selectedDay && renderDayNote(selectedDay)}
          </section>
        )}

        {/* YEARLY 12-MONTH BARS + 365-DAY GRID (Open Editorial Sections) */}
        {period === 'yearly' && (
          <div className="space-y-8">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  ১২ মাসের অগ্রগতি — {METRIC_META[metric].label}
                </h2>
                {metric !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setMetric('all')}
                    className="text-[11px] font-medium cursor-pointer"
                    style={{ color: 'var(--accent)' }}
                  >
                    সব দেখুন
                  </button>
                )}
              </div>

              <div className="grid grid-cols-12 gap-1 sm:gap-1.5 pt-2">
                {yearly.months.map((m) => {
                  const val = getMetricValue(m, metric);
                  const heightPct =
                    val > 0
                      ? Math.max(8, Math.round((val / yearlyMonthMax) * 100))
                      : 3;
                  const isSelected = selectedMonthIdx === m.monthIndex;

                  return (
                    <button
                      key={m.monthIndex}
                      type="button"
                      onClick={() => setSelectedMonthIdx(m.monthIndex)}
                      aria-label={m.labelFull}
                      className="flex flex-col items-center gap-2 py-1 cursor-pointer"
                    >
                      <div className="w-full h-28 flex items-end justify-center">
                        <div
                          className="w-2.5 sm:w-3.5 rounded-full transition-all duration-300"
                          style={{
                            height: `${heightPct}%`,
                            backgroundColor:
                              val > 0
                                ? isSelected || m.isCurrentMonth
                                  ? 'var(--accent)'
                                  : 'color-mix(in srgb, var(--accent) 48%, transparent)'
                                : 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
                            opacity: m.isFuture ? 0.4 : 1,
                          }}
                        />
                      </div>
                      <span
                        className="text-[9px] sm:text-[10px] font-medium leading-none px-1 py-0.5 rounded"
                        style={{
                          backgroundColor: isSelected
                            ? 'var(--accent-soft)'
                            : 'transparent',
                          color:
                            isSelected || m.isCurrentMonth
                              ? 'var(--accent)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {m.labelShort}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedMonth && (
                <div
                  className="mt-4 pl-3.5 border-l-2 space-y-2"
                  style={{
                    borderColor:
                      selectedMonth.activeDays > 0
                        ? 'var(--accent)'
                        : 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">
                      {selectedMonth.labelFull}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {toBanglaDigits(selectedMonth.activeDays)} সক্রিয় দিন
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 text-xs">
                    {[
                      { label: 'জিকির', val: selectedMonth.dhikir },
                      { label: 'দুআ', val: selectedMonth.duas },
                      { label: 'রুটিন', val: selectedMonth.routines },
                      { label: 'আয়াত', val: selectedMonth.ayahs },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="inline-flex items-baseline gap-1.5"
                      >
                        <span
                          className="font-semibold tabular-nums text-sm"
                          style={{
                            color:
                              item.val > 0
                                ? 'var(--accent)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {toBanglaDigits(item.val)}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 365-Day Contribution Grid (Separated by hairline, zero card box) */}
            <section
              className="pt-6 border-t space-y-3.5"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div>
                <h2
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  বার্ষিক অ্যাক্টিভিটি গ্রিড ({toBanglaDigits(yearly.year)})
                </h2>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  যেকোনো ঘরে ট্যাপ করে ওই দিনের বিস্তারিত দেখুন
                </p>
              </div>

              <div className="flex items-start gap-2">
                <div
                  className="grid grid-rows-7 gap-[3px] text-[9px] leading-[11px] w-6 shrink-0 pt-[15px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span>শনি</span>
                  <span className="opacity-0">রবি</span>
                  <span>সোম</span>
                  <span className="opacity-0">মঙ্গল</span>
                  <span>বুধ</span>
                  <span className="opacity-0">বৃহঃ</span>
                  <span>শুক্র</span>
                </div>

                <div
                  ref={yearlyGridScrollRef}
                  className="overflow-x-auto pb-1.5 flex-1 min-w-0"
                >
                  <div className="inline-flex flex-col gap-1 min-w-max">
                    <div className="flex items-center gap-[3px] h-[11px]">
                      {yearly.weeks.map((week) => (
                        <div
                          key={`ml-${week.weekIndex}`}
                          className="w-[11px] text-[9px] leading-none overflow-visible whitespace-nowrap"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {week.monthLabel ?? ''}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-[3px]">
                      {yearly.weeks.map((week) => (
                        <div
                          key={`w-${week.weekIndex}`}
                          ref={
                            week.weekIndex === yearlyFocusWeekIndex
                              ? focusWeekColRef
                              : undefined
                          }
                          className="grid grid-rows-7 gap-[3px]"
                        >
                          {week.days.map((cell) => {
                            if (!cell.inTargetYear) {
                              return (
                                <span
                                  key={cell.dateKey}
                                  className="w-[11px] h-[11px]"
                                  aria-hidden="true"
                                />
                              );
                            }

                            const val = getMetricValue(cell, metric);
                            const level = computeIntensityLevel(
                              val,
                              yearlyDayMax,
                              metric
                            );
                            const colors = getHeatmapCellColors(level);
                            const isSelected = selectedDayKey === cell.dateKey;

                            return (
                              <button
                                key={cell.dateKey}
                                type="button"
                                onClick={() => setSelectedDayKey(cell.dateKey)}
                                title={formatDayDateBn(cell.date)}
                                aria-label={formatDayDateBn(cell.date)}
                                className="w-[11px] h-[11px] rounded-[2.5px] cursor-pointer transition-transform hover:scale-125"
                                style={{
                                  backgroundColor: colors.bg,
                                  opacity: cell.isFuture ? 0.35 : 1,
                                  boxShadow: isSelected
                                    ? '0 0 0 1.5px var(--text-primary)'
                                    : cell.isToday
                                      ? '0 0 0 1px var(--accent)'
                                      : undefined,
                                }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {renderIntensityLegend()}

              {selectedDay && renderDayNote(selectedDay)}
            </section>
          </div>
        )}

        {/* Top Breakdown Section (Open Journal List with Hairline Divider) */}
        <section
          className="pt-6 border-t space-y-5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              className="text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              শীর্ষ আমল — {activeLabel}
            </h2>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {toBanglaDigits(activeTotals.activeDays)} সক্রিয় দিন
            </span>
          </div>

          {!hasAnyPeriodActivity ||
            (topBreakdowns.topDuas.length === 0 &&
              topBreakdowns.topRoutines.length === 0) ? (
            <div className="py-6 text-center space-y-1">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {hasAnyPeriodActivity
                  ? 'এই সময়ে কুরআন তিলাওয়াত রেকর্ড হয়েছে'
                  : 'এই সময়ে এখনো কোনো আমল রেকর্ড হয়নি'}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                জিকির, দুআ পড়া বা রুটিন সম্পন্ন করলে এখানে স্বয়ংক্রিয়ভাবে যুক্ত হবে।
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {topBreakdowns.topDuas.length > 0 && (
                <div className="space-y-3">
                  <div
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    জিকির ও দুআ
                  </div>
                  <div className="space-y-3">
                    {topBreakdowns.topDuas.map((item) => {
                      const pct = Math.max(
                        6,
                        Math.round((item.score / maxTopDuaScore) * 100)
                      );
                      return (
                        <div key={item.duaId} className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-3 text-xs">
                            <span className="font-medium truncate">
                              {item.titleBangla}
                            </span>
                            <span
                              className="text-[11px] shrink-0 tabular-nums"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {item.dhikirCount > 0 &&
                                `${toBanglaDigits(item.dhikirCount)} জিকির`}
                              {item.dhikirCount > 0 &&
                                item.completedCount > 0 &&
                                ' • '}
                              {item.completedCount > 0 &&
                                `${toBanglaDigits(item.completedCount)} বার`}
                            </span>
                          </div>
                          <div
                            className="h-[3px] rounded-full overflow-hidden"
                            style={{
                              backgroundColor:
                                'color-mix(in srgb, var(--text-primary) 10%, transparent)',
                            }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: 'var(--accent)',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {topBreakdowns.topRoutines.length > 0 && (
                <div className="space-y-3">
                  <div
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    সম্পন্ন রুটিন
                  </div>
                  <div className="space-y-3">
                    {topBreakdowns.topRoutines.map((item) => {
                      const pct = Math.max(
                        10,
                        Math.round((item.count / maxTopRoutineCount) * 100)
                      );
                      return (
                        <div key={item.routineId} className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-3 text-xs">
                            <span className="font-medium truncate">
                              {item.title}
                            </span>
                            <span
                              className="text-[11px] font-medium shrink-0 tabular-nums"
                              style={{ color: 'var(--accent)' }}
                            >
                              {toBanglaDigits(item.count)} দিন
                            </span>
                          </div>
                          <div
                            className="h-[3px] rounded-full overflow-hidden"
                            style={{
                              backgroundColor:
                                'color-mix(in srgb, var(--text-primary) 10%, transparent)',
                            }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: 'var(--accent)',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <DailyGoalSheet
        open={goalSheetOpen}
        onClose={() => setGoalSheetOpen(false)}
        currentGoalMinutes={dailyGoalMinutes}
        onSave={async (minutes) => {
          await onUpdateSettings({ dailyGoalMinutes: minutes });
          toast.success(
            minutes > 0
              ? `দৈনিক তিলাওয়াত লক্ষ্য ${toBanglaDigits(minutes)} মিনিট নির্ধারিত হয়েছে`
              : 'দৈনিক তিলাওয়াত লক্ষ্য বন্ধ করা হয়েছে'
          );
        }}
      />
    </div>
  );
}
