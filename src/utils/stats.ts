import { resolveDuaById } from '../services/customDuaSnapshot';
import type { ReadingHistory, Routine } from '../db/database';
import { toBanglaDigits } from './formatters';

export type StatsPeriod = 'weekly' | 'monthly' | 'yearly';
export type StatsMetric = 'all' | 'dhikir' | 'duas' | 'routines' | 'ayahs';

export const WEEK_DAYS_SAT_SHORT_BN = [
  'শনি',
  'রবি',
  'সোম',
  'মঙ্গল',
  'বুধ',
  'বৃহঃ',
  'শুক্র',
] as const;

export const WEEK_DAYS_SAT_FULL_BN = [
  'শনিবার',
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
  'শুক্রবার',
] as const;

export const MONTH_NAMES_BN = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
] as const;

export const MONTH_SHORT_BN = [
  'জানু',
  'ফেব্রু',
  'মার্চ',
  'এপ্রি',
  'মে',
  'জুন',
  'জুলা',
  'আগ',
  'সেপ্টে',
  'অক্টো',
  'নভে',
  'ডিসে',
] as const;

export interface PeriodTotals {
  dhikir: number;
  duas: number;
  routines: number;
  ayahs: number;
  readingSeconds: number;
  activeDays: number;
}

export interface DayMetrics {
  dateKey: string;
  date: Date;
  dayOfMonth: number;
  satWeekIndex: number; // 0 = Sat ... 6 = Fri
  dhikir: number;
  duas: number;
  routines: number;
  ayahs: number;
  readingSeconds: number;
  activeScore: number;
  isActive: boolean;
  isToday: boolean;
  isFuture: boolean;
  record?: ReadingHistory;
}

export interface MonthCalendarCell extends DayMetrics {
  inCurrentMonth: boolean;
}

export interface YearMonthBucket {
  year: number;
  monthIndex: number; // 0..11
  labelShort: string;
  labelFull: string;
  dhikir: number;
  duas: number;
  routines: number;
  ayahs: number;
  readingSeconds: number;
  activeScore: number;
  activeDays: number;
  isCurrentMonth: boolean;
  isFuture: boolean;
  records: ReadingHistory[];
}

export interface YearContributionCell extends DayMetrics {
  inTargetYear: boolean;
}

export interface YearContributionWeek {
  weekIndex: number;
  monthLabel?: string;
  days: YearContributionCell[]; // Always length 7 (Sat..Fri)
}

export interface WeeklyStats {
  label: string;
  sublabel: string;
  isCurrent: boolean;
  days: DayMetrics[]; // Length 7 (Sat..Fri)
  totals: PeriodTotals;
  records: ReadingHistory[];
}

export interface MonthlyStats {
  year: number;
  monthIndex: number;
  label: string;
  sublabel: string;
  isCurrent: boolean;
  cells: MonthCalendarCell[]; // Multiples of 7 (Sat..Fri columns)
  daysInMonth: DayMetrics[];
  totals: PeriodTotals;
  records: ReadingHistory[];
}

export interface YearlyStats {
  year: number;
  label: string;
  sublabel: string;
  isCurrent: boolean;
  months: YearMonthBucket[]; // Length 12
  weeks: YearContributionWeek[]; // 52..54 Sat..Fri columns
  totals: PeriodTotals;
  records: ReadingHistory[];
}

export interface StreakStats {
  currentStreak: number;
  bestStreak: number;
  totalActiveDays: number;
  activeToday: boolean;
}

export interface TopDuaEntry {
  duaId: string;
  titleBangla: string;
  dhikirCount: number;
  completedCount: number;
  score: number;
}

export interface TopRoutineEntry {
  routineId: string;
  title: string;
  count: number;
}

export interface TopBreakdown {
  topDuas: TopDuaEntry[];
  topRoutines: TopRoutineEntry[];
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local-noon Date constructor so DST transitions never shift calendar dates. */
export function makeLocalDate(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return makeLocalDate(y || 2000, (m || 1) - 1, d || 1);
}

export function addDays(date: Date, deltaDays: number): Date {
  return makeLocalDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + deltaDays
  );
}

/** Saturday = 0, Sunday = 1, ..., Friday = 6 */
export function getSatWeekIndex(date: Date): number {
  return (date.getDay() + 1) % 7;
}

/** Returns Saturday 12:00 local time of the Saturday–Friday week containing `date`. */
export function getSatWeekStart(date: Date): Date {
  const base = makeLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(base, -getSatWeekIndex(base));
}

export function formatDayDateBn(date: Date): string {
  const dayName = WEEK_DAYS_SAT_FULL_BN[getSatWeekIndex(date)];
  return `${dayName}, ${toBanglaDigits(date.getDate())} ${MONTH_NAMES_BN[date.getMonth()]} ${toBanglaDigits(date.getFullYear())}`;
}

export function getRecordDuaTotal(record?: ReadingHistory): number {
  if (!record) return 0;
  if (record.duaCounts && typeof record.duaCounts === 'object') {
    const sum = Object.values(record.duaCounts).reduce(
      (acc, v) => acc + (typeof v === 'number' && v > 0 ? Math.floor(v) : 0),
      0
    );
    if (sum > 0) return sum;
  }
  return Array.isArray(record.duasCompleted) ? record.duasCompleted.length : 0;
}

export function computeActiveScore(counts: {
  dhikir: number;
  duas: number;
  routines: number;
  ayahs: number;
  readingSeconds?: number;
}): number {
  return (
    counts.dhikir +
    counts.duas * 8 +
    counts.routines * 20 +
    counts.ayahs * 2 +
    Math.floor((counts.readingSeconds ?? 0) / 60) * 3
  );
}

export function buildDayMetrics(
  date: Date,
  record: ReadingHistory | undefined,
  todayKey: string
): DayMetrics {
  const dateKey = formatDateKey(date);
  const dhikir = Math.max(0, Math.floor(record?.dhikirCount ?? 0));
  const duas = getRecordDuaTotal(record);
  const routines = Array.isArray(record?.routinesCompleted)
    ? record.routinesCompleted.length
    : 0;
  const ayahs = Math.max(0, Math.floor(record?.ayahsCount ?? 0));
  const readingSeconds = Math.max(0, Math.floor(record?.readingSeconds ?? 0));
  const activeScore = computeActiveScore({
    dhikir,
    duas,
    routines,
    ayahs,
    readingSeconds,
  });

  return {
    dateKey,
    date,
    dayOfMonth: date.getDate(),
    satWeekIndex: getSatWeekIndex(date),
    dhikir,
    duas,
    routines,
    ayahs,
    readingSeconds,
    activeScore,
    isActive:
      dhikir > 0 ||
      duas > 0 ||
      routines > 0 ||
      ayahs > 0 ||
      readingSeconds >= 60,
    isToday: dateKey === todayKey,
    isFuture: dateKey > todayKey,
    record,
  };
}

export function getMetricValue(
  item: Pick<DayMetrics, 'dhikir' | 'duas' | 'routines' | 'ayahs' | 'activeScore'>,
  metric: StatsMetric
): number {
  switch (metric) {
    case 'dhikir':
      return item.dhikir;
    case 'duas':
      return item.duas;
    case 'routines':
      return item.routines;
    case 'ayahs':
      return item.ayahs;
    case 'all':
      return item.activeScore;
  }
}

const INTENSITY_FLOORS: Record<StatsMetric, number> = {
  all: 40,
  dhikir: 33,
  duas: 3,
  routines: 2,
  ayahs: 15,
};

export function computeIntensityLevel(
  value: number,
  maxInPeriod: number,
  metric: StatsMetric
): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  const scaleMax = Math.max(maxInPeriod, INTENSITY_FLOORS[metric]);
  const ratio = value / scaleMax;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export function buildHistoryMap(
  rows: ReadingHistory[]
): Map<string, ReadingHistory> {
  const map = new Map<string, ReadingHistory>();
  for (const row of rows) {
    if (row && typeof row.date === 'string' && row.date) {
      map.set(row.date, row);
    }
  }
  return map;
}

export function buildWeeklyStats(
  historyMap: Map<string, ReadingHistory>,
  weekOffset = 0,
  referenceDate = new Date()
): WeeklyStats {
  const today = makeLocalDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const todayKey = formatDateKey(today);
  const currentWeekStart = getSatWeekStart(today);
  const weekStart = addDays(currentWeekStart, weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);

  const days: DayMetrics[] = [];
  const records: ReadingHistory[] = [];
  const totals: PeriodTotals = {
    dhikir: 0,
    duas: 0,
    routines: 0,
    ayahs: 0,
    readingSeconds: 0,
    activeDays: 0,
  };

  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const key = formatDateKey(d);
    const rec = historyMap.get(key);
    const metrics = buildDayMetrics(d, rec, todayKey);
    days.push(metrics);
    if (rec) records.push(rec);
    totals.dhikir += metrics.dhikir;
    totals.duas += metrics.duas;
    totals.routines += metrics.routines;
    totals.ayahs += metrics.ayahs;
    totals.readingSeconds += metrics.readingSeconds;
    if (metrics.isActive) totals.activeDays += 1;
  }

  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const rangeText = sameMonth
    ? `${toBanglaDigits(weekStart.getDate())}–${toBanglaDigits(weekEnd.getDate())} ${MONTH_NAMES_BN[weekEnd.getMonth()]} ${toBanglaDigits(weekEnd.getFullYear())}`
    : sameYear
      ? `${toBanglaDigits(weekStart.getDate())} ${MONTH_SHORT_BN[weekStart.getMonth()]} – ${toBanglaDigits(weekEnd.getDate())} ${MONTH_SHORT_BN[weekEnd.getMonth()]} ${toBanglaDigits(weekEnd.getFullYear())}`
      : `${toBanglaDigits(weekStart.getDate())} ${MONTH_SHORT_BN[weekStart.getMonth()]} ${toBanglaDigits(weekStart.getFullYear())} – ${toBanglaDigits(weekEnd.getDate())} ${MONTH_SHORT_BN[weekEnd.getMonth()]} ${toBanglaDigits(weekEnd.getFullYear())}`;

  const label =
    weekOffset === 0
      ? 'চলতি সপ্তাহ'
      : weekOffset === -1
        ? 'গত সপ্তাহ'
        : rangeText;

  return {
    label,
    sublabel: rangeText,
    isCurrent: weekOffset === 0,
    days,
    totals,
    records,
  };
}

export function buildMonthlyStats(
  historyMap: Map<string, ReadingHistory>,
  monthOffset = 0,
  referenceDate = new Date()
): MonthlyStats {
  const today = makeLocalDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const todayKey = formatDateKey(today);

  const firstOfTarget = makeLocalDate(
    today.getFullYear(),
    today.getMonth() + monthOffset,
    1
  );
  const year = firstOfTarget.getFullYear();
  const monthIndex = firstOfTarget.getMonth();
  const lastOfTarget = makeLocalDate(year, monthIndex + 1, 0);
  const totalDays = lastOfTarget.getDate();

  const daysInMonth: DayMetrics[] = [];
  const records: ReadingHistory[] = [];
  const totals: PeriodTotals = {
    dhikir: 0,
    duas: 0,
    routines: 0,
    ayahs: 0,
    readingSeconds: 0,
    activeDays: 0,
  };

  for (let day = 1; day <= totalDays; day++) {
    const d = makeLocalDate(year, monthIndex, day);
    const key = formatDateKey(d);
    const rec = historyMap.get(key);
    const metrics = buildDayMetrics(d, rec, todayKey);
    daysInMonth.push(metrics);
    if (rec) records.push(rec);
    totals.dhikir += metrics.dhikir;
    totals.duas += metrics.duas;
    totals.routines += metrics.routines;
    totals.ayahs += metrics.ayahs;
    totals.readingSeconds += metrics.readingSeconds;
    if (metrics.isActive) totals.activeDays += 1;
  }

  // Build Saturday–Friday aligned calendar grid
  const leadingPad = getSatWeekIndex(firstOfTarget);
  const trailingPad = (6 - getSatWeekIndex(lastOfTarget)) % 7;
  const cells: MonthCalendarCell[] = [];

  for (let i = leadingPad; i > 0; i--) {
    const d = addDays(firstOfTarget, -i);
    cells.push({
      ...buildDayMetrics(d, historyMap.get(formatDateKey(d)), todayKey),
      inCurrentMonth: false,
    });
  }
  for (const m of daysInMonth) {
    cells.push({ ...m, inCurrentMonth: true });
  }
  for (let i = 1; i <= trailingPad; i++) {
    const d = addDays(lastOfTarget, i);
    cells.push({
      ...buildDayMetrics(d, historyMap.get(formatDateKey(d)), todayKey),
      inCurrentMonth: false,
    });
  }

  const label = `${MONTH_NAMES_BN[monthIndex]} ${toBanglaDigits(year)}`;
  const sublabel = `${toBanglaDigits(totals.activeDays)}/${toBanglaDigits(totalDays)} সক্রিয় দিন`;

  return {
    year,
    monthIndex,
    label,
    sublabel,
    isCurrent: monthOffset === 0,
    cells,
    daysInMonth,
    totals,
    records,
  };
}

export function buildYearlyStats(
  historyMap: Map<string, ReadingHistory>,
  yearOffset = 0,
  referenceDate = new Date()
): YearlyStats {
  const today = makeLocalDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const todayKey = formatDateKey(today);
  const targetYear = today.getFullYear() + yearOffset;

  const months: YearMonthBucket[] = [];
  const records: ReadingHistory[] = [];
  const totals: PeriodTotals = {
    dhikir: 0,
    duas: 0,
    routines: 0,
    ayahs: 0,
    readingSeconds: 0,
    activeDays: 0,
  };

  for (let m = 0; m < 12; m++) {
    const daysCount = makeLocalDate(targetYear, m + 1, 0).getDate();
    let dhikir = 0;
    let duas = 0;
    let routines = 0;
    let ayahs = 0;
    let readingSeconds = 0;
    let activeDays = 0;
    const monthRecords: ReadingHistory[] = [];

    for (let d = 1; d <= daysCount; d++) {
      const date = makeLocalDate(targetYear, m, d);
      const key = formatDateKey(date);
      const rec = historyMap.get(key);
      const dm = buildDayMetrics(date, rec, todayKey);
      if (rec) {
        monthRecords.push(rec);
        records.push(rec);
      }
      dhikir += dm.dhikir;
      duas += dm.duas;
      routines += dm.routines;
      ayahs += dm.ayahs;
      readingSeconds += dm.readingSeconds;
      if (dm.isActive) activeDays += 1;
    }

    const activeScore = computeActiveScore({
      dhikir,
      duas,
      routines,
      ayahs,
      readingSeconds,
    });
    const isCurrentMonth =
      targetYear === today.getFullYear() && m === today.getMonth();
    const isFuture =
      targetYear > today.getFullYear() ||
      (targetYear === today.getFullYear() && m > today.getMonth());

    months.push({
      year: targetYear,
      monthIndex: m,
      labelShort: MONTH_SHORT_BN[m],
      labelFull: `${MONTH_NAMES_BN[m]} ${toBanglaDigits(targetYear)}`,
      dhikir,
      duas,
      routines,
      ayahs,
      readingSeconds,
      activeScore,
      activeDays,
      isCurrentMonth,
      isFuture,
      records: monthRecords,
    });

    totals.dhikir += dhikir;
    totals.duas += duas;
    totals.routines += routines;
    totals.ayahs += ayahs;
    totals.readingSeconds += readingSeconds;
    totals.activeDays += activeDays;
  }

  // Build 365/366-day GitHub-style contribution grid aligned to Sat..Fri rows
  const jan1 = makeLocalDate(targetYear, 0, 1);
  const dec31 = makeLocalDate(targetYear, 11, 31);
  const gridStart = getSatWeekStart(jan1);
  const gridEnd = addDays(dec31, (6 - getSatWeekIndex(dec31)) % 7);

  const weeks: YearContributionWeek[] = [];
  let cursor = gridStart;
  let weekIdx = 0;
  let lastLabeledMonth = -1;

  while (cursor <= gridEnd) {
    const weekDays: YearContributionCell[] = [];
    let labelForWeek: string | undefined;

    for (let r = 0; r < 7; r++) {
      const d = addDays(cursor, r);
      const inTargetYear = d.getFullYear() === targetYear;
      const rec = historyMap.get(formatDateKey(d));
      const dm = buildDayMetrics(d, rec, todayKey);
      weekDays.push({ ...dm, inTargetYear });

      if (inTargetYear && d.getDate() === 1 && d.getMonth() !== lastLabeledMonth) {
        labelForWeek = MONTH_SHORT_BN[d.getMonth()];
        lastLabeledMonth = d.getMonth();
      }
    }

    // Ensure January label appears on first week if Jan 1 was already labeled or first column
    if (weekIdx === 0 && !labelForWeek) {
      labelForWeek = MONTH_SHORT_BN[0];
      lastLabeledMonth = 0;
    }

    weeks.push({
      weekIndex: weekIdx,
      monthLabel: labelForWeek,
      days: weekDays,
    });

    cursor = addDays(cursor, 7);
    weekIdx += 1;
  }

  const totalDaysInYear =
    Math.round((dec31.getTime() - jan1.getTime()) / 86400000) + 1;

  return {
    year: targetYear,
    label: `${toBanglaDigits(targetYear)} সাল`,
    sublabel: `${toBanglaDigits(totals.activeDays)}/${toBanglaDigits(totalDaysInYear)} সক্রিয় দিন`,
    isCurrent: yearOffset === 0,
    months,
    weeks,
    totals,
    records,
  };
}

export function computeStreaks(
  historyMap: Map<string, ReadingHistory>,
  referenceDate = new Date()
): StreakStats {
  const today = makeLocalDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const todayKey = formatDateKey(today);

  const activeKeys: string[] = [];
  for (const [key, rec] of historyMap.entries()) {
    if (key > todayKey) continue;
    const dm = buildDayMetrics(parseDateKey(key), rec, todayKey);
    if (dm.isActive) {
      activeKeys.push(key);
    }
  }

  if (activeKeys.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalActiveDays: 0,
      activeToday: false,
    };
  }

  activeKeys.sort();
  const activeSet = new Set(activeKeys);
  const activeToday = activeSet.has(todayKey);

  // Current streak: start from today if active, otherwise yesterday (ongoing grace window)
  let currentStreak = 0;
  let probe = activeToday ? today : addDays(today, -1);
  while (activeSet.has(formatDateKey(probe))) {
    currentStreak += 1;
    probe = addDays(probe, -1);
  }

  // Best streak across all sorted active keys
  let bestStreak = 1;
  let running = 1;
  for (let i = 1; i < activeKeys.length; i++) {
    const prevDate = parseDateKey(activeKeys[i - 1]);
    const expectedNext = formatDateKey(addDays(prevDate, 1));
    if (activeKeys[i] === expectedNext) {
      running += 1;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 1;
    }
  }

  return {
    currentStreak,
    bestStreak,
    totalActiveDays: activeKeys.length,
    activeToday,
  };
}

export function computeTopBreakdowns(
  records: ReadingHistory[],
  routinesMap: Map<string, Routine>,
  limit = 6
): TopBreakdown {
  const duaStats = new Map<
    string,
    { dhikirCount: number; completedCount: number }
  >();
  const routineCounts = new Map<string, number>();

  for (const rec of records) {
    if (rec.dhikirByDua) {
      for (const [duaId, count] of Object.entries(rec.dhikirByDua)) {
        if (!count || count <= 0) continue;
        const curr = duaStats.get(duaId) ?? { dhikirCount: 0, completedCount: 0 };
        curr.dhikirCount += count;
        duaStats.set(duaId, curr);
      }
    }

    if (rec.duaCounts && Object.keys(rec.duaCounts).length > 0) {
      for (const [duaId, count] of Object.entries(rec.duaCounts)) {
        if (!count || count <= 0) continue;
        const curr = duaStats.get(duaId) ?? { dhikirCount: 0, completedCount: 0 };
        curr.completedCount += count;
        duaStats.set(duaId, curr);
      }
    } else if (Array.isArray(rec.duasCompleted)) {
      for (const duaId of rec.duasCompleted) {
        if (!duaId) continue;
        const curr = duaStats.get(duaId) ?? { dhikirCount: 0, completedCount: 0 };
        curr.completedCount += 1;
        duaStats.set(duaId, curr);
      }
    }

    if (Array.isArray(rec.routinesCompleted)) {
      for (const routineId of rec.routinesCompleted) {
        if (!routineId) continue;
        routineCounts.set(routineId, (routineCounts.get(routineId) ?? 0) + 1);
      }
    }
  }

  const topDuas: TopDuaEntry[] = Array.from(duaStats.entries())
    .map(([duaId, val]) => {
      const dua = resolveDuaById(duaId);
      return {
        duaId,
        titleBangla: dua?.titleBangla ?? 'দুআ ও জিকির',
        dhikirCount: val.dhikirCount,
        completedCount: val.completedCount,
        score: val.dhikirCount + val.completedCount * 10,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const topRoutines: TopRoutineEntry[] = Array.from(routineCounts.entries())
    .map(([routineId, count]) => ({
      routineId,
      title: routinesMap.get(routineId)?.title ?? 'রুটিন',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { topDuas, topRoutines };
}
