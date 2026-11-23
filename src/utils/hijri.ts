import { toBanglaDigits } from './formatters';
import { addDays, makeLocalDate } from './stats';

export interface HijriMonthAnchor {
  year: number;
  month: number; // 1..12
  startDate: string; // YYYY-MM-DD (Gregorian daytime date of Hijri day 1)
}

export interface HijriDateInfo {
  year: number;
  month: number;
  day: number;
  monthNameBn: string;
  isRamadan: boolean;
  isAyyamAlBid: boolean;
  source?: 'confirmed' | 'calculated';
}

export const HIJRI_MONTH_NAMES_BN = [
  'মুহাররম',
  'সফর',
  'রবিউল আউয়াল',
  'রবিউস সানি',
  'জুমাদাল উলা',
  'জুমাদাস সানি',
  'রজব',
  'শাবান',
  'রমজান',
  'শাওয়াল',
  'জিলকদ',
  'জিলহজ',
] as const;

const UMALQURA_FORMATTER = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function clampHijriOffsetDays(offsetDays: number): number {
  if (!Number.isFinite(offsetDays)) return 0;
  return Math.max(-2, Math.min(2, Math.trunc(offsetDays)));
}

export function isRamadanMonth(hijriMonth: number): boolean {
  return hijriMonth === 9;
}

export function isMonthlySunnahFastDay(hijriDay: number): boolean {
  return hijriDay === 13 || hijriDay === 14 || hijriDay === 15;
}

export function isWeeklySunnahFastDay(date: Date): {
  isWeeklySunnah: boolean;
  weekday: 'monday' | 'thursday' | null;
} {
  const day = date.getDay();
  if (day === 1) {
    return { isWeeklySunnah: true, weekday: 'monday' };
  }
  if (day === 4) {
    return { isWeeklySunnah: true, weekday: 'thursday' };
  }
  return { isWeeklySunnah: false, weekday: null };
}

const MS_PER_DAY = 86_400_000;

interface ParsedHijriMonthAnchor {
  year: number;
  month: number;
  startDate: string;
  startDayNum: number;
}

function toUtcDayNumber(year: number, monthIndex0: number, day: number): number {
  return Math.floor(Date.UTC(year, monthIndex0, day) / MS_PER_DAY);
}

export function parseIsoDateToDayNumber(isoDate: string): number | null {
  if (typeof isoDate !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const y = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  const d = Number.parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (
    utc.getUTCFullYear() !== y ||
    utc.getUTCMonth() !== m - 1 ||
    utc.getUTCDate() !== d
  ) {
    return null;
  }
  return Math.floor(utc.getTime() / MS_PER_DAY);
}

function hijriMonthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function prevHijriMonth(
  year: number,
  month: number
): { year: number; month: number } {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

function nextHijriMonth(
  year: number,
  month: number
): { year: number; month: number } {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

function normalizeAnchors(
  anchors?: readonly HijriMonthAnchor[]
): ParsedHijriMonthAnchor[] {
  if (!anchors || anchors.length === 0) return [];
  const byMonthKey = new Map<string, ParsedHijriMonthAnchor>();
  for (const anchor of anchors) {
    if (
      !anchor ||
      !Number.isInteger(anchor.year) ||
      anchor.year < 1300 ||
      anchor.year > 1700 ||
      !Number.isInteger(anchor.month) ||
      anchor.month < 1 ||
      anchor.month > 12
    ) {
      continue;
    }
    const startDayNum = parseIsoDateToDayNumber(anchor.startDate);
    if (startDayNum === null) continue;
    byMonthKey.set(`${anchor.year}-${anchor.month}`, {
      year: anchor.year,
      month: anchor.month,
      startDate: anchor.startDate.trim(),
      startDayNum,
    });
  }
  return Array.from(byMonthKey.values()).sort(
    (a, b) => a.startDayNum - b.startDayNum
  );
}

function buildHijriInfo(
  year: number,
  month: number,
  day: number,
  source: 'confirmed' | 'calculated'
): HijriDateInfo {
  const monthNameBn =
    HIJRI_MONTH_NAMES_BN[month - 1] ?? HIJRI_MONTH_NAMES_BN[0];
  return {
    year,
    month,
    day,
    monthNameBn,
    isRamadan: isRamadanMonth(month),
    isAyyamAlBid: isMonthlySunnahFastDay(day),
    source,
  };
}

function getUmmAlQuraRawByDayNumber(
  dayNum: number,
  offsetDays: number
): { year: number; month: number; day: number } {
  const utcNoon = new Date((dayNum + offsetDays) * MS_PER_DAY + 12 * 3600_000);
  const parts = UMALQURA_FORMATTER.formatToParts(utcNoon);
  let year = 1447;
  let month = 1;
  let day = 1;

  for (const part of parts) {
    if (part.type === 'year') {
      const parsed = Number.parseInt(part.value, 10);
      if (Number.isFinite(parsed)) year = parsed;
    } else if (part.type === 'month') {
      const parsed = Number.parseInt(part.value, 10);
      if (Number.isFinite(parsed)) month = parsed;
    } else if (part.type === 'day') {
      const parsed = Number.parseInt(part.value, 10);
      if (Number.isFinite(parsed)) day = parsed;
    }
  }

  return { year, month, day };
}

function findAlignedOffsetForAnchor(
  anchor: ParsedHijriMonthAnchor,
  fallbackOffset: number
): number {
  for (const candidate of [fallbackOffset, -1, 0, -2, 1, 2]) {
    const raw = getUmmAlQuraRawByDayNumber(anchor.startDayNum, candidate);
    if (raw.year === anchor.year && raw.month === anchor.month && raw.day === 1) {
      return candidate;
    }
  }
  return fallbackOffset;
}

function resolveOpenEndedAnchorEndDayNum(
  anchor: ParsedHijriMonthAnchor,
  safeOffset: number
): number {
  const next = nextHijriMonth(anchor.year, anchor.month);
  // If fallback with safeOffset naturally transitions to nextMonth at 29 or 30 days, align seamlessly
  for (const len of [29, 30]) {
    const rawAtBoundary = getUmmAlQuraRawByDayNumber(
      anchor.startDayNum + len,
      safeOffset
    );
    if (
      rawAtBoundary.year === next.year &&
      rawAtBoundary.month === next.month &&
      rawAtBoundary.day === 1
    ) {
      return anchor.startDayNum + len;
    }
  }
  // Otherwise use Umm al-Qura's aligned length for this specific lunar month (29 or 30)
  const alignedOffset = findAlignedOffsetForAnchor(anchor, safeOffset);
  const day30Candidate = getUmmAlQuraRawByDayNumber(
    anchor.startDayNum + 29,
    alignedOffset
  );
  const expectedLength =
    day30Candidate.year === anchor.year && day30Candidate.month === anchor.month
      ? 30
      : 29;
  return anchor.startDayNum + expectedLength;
}

export function getHijriDate(
  date: Date,
  offsetDays = 0,
  monthAnchors?: readonly HijriMonthAnchor[]
): HijriDateInfo {
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const safeOffset = clampHijriOffsetDays(offsetDays);
  // Use UTC day number of the local calendar date so timezone/DST never shifts Hijri day boundaries
  const targetDayNum = toUtcDayNumber(
    safeDate.getFullYear(),
    safeDate.getMonth(),
    safeDate.getDate()
  );

  const parsedAnchors = normalizeAnchors(monthAnchors);
  if (parsedAnchors.length > 0) {
    let anchorA: ParsedHijriMonthAnchor | null = null;
    let anchorB: ParsedHijriMonthAnchor | null = null;

    for (const anchor of parsedAnchors) {
      if (anchor.startDayNum <= targetDayNum) {
        anchorA = anchor;
      } else {
        anchorB = anchor;
        break;
      }
    }

    // Case 1: Strictly bounded between two consecutive confirmed months A and B (28..31 days)
    if (
      anchorA &&
      anchorB &&
      hijriMonthIndex(anchorB.year, anchorB.month) ===
        hijriMonthIndex(anchorA.year, anchorA.month) + 1
    ) {
      const span = anchorB.startDayNum - anchorA.startDayNum;
      if (span >= 28 && span <= 31) {
        return buildHijriInfo(
          anchorA.year,
          anchorA.month,
          targetDayNum - anchorA.startDayNum + 1,
          'confirmed'
        );
      }
    }

    // Case 2: Inside an open-ended confirmed month A (next month not announced yet)
    if (anchorA) {
      const diffFromA = targetDayNum - anchorA.startDayNum;
      if (diffFromA >= 0 && diffFromA < 30) {
        const endDayNum = resolveOpenEndedAnchorEndDayNum(anchorA, safeOffset);
        if (targetDayNum < endDayNum) {
          return buildHijriInfo(
            anchorA.year,
            anchorA.month,
            diffFromA + 1,
            'confirmed'
          );
        }
      }
    }

    // Case 3: 1-2 days before confirmed month B while fallback prematurely entered B
    if (anchorB) {
      const daysUntilB = anchorB.startDayNum - targetDayNum;
      if (daysUntilB >= 1 && daysUntilB <= 2) {
        const fallback = getUmmAlQuraRawByDayNumber(targetDayNum, safeOffset);
        if (
          hijriMonthIndex(fallback.year, fallback.month) >=
          hijriMonthIndex(anchorB.year, anchorB.month)
        ) {
          const prev = prevHijriMonth(anchorB.year, anchorB.month);
          const prevDayRaw = getUmmAlQuraRawByDayNumber(
            targetDayNum - 1,
            safeOffset
          );
          const extendedDay =
            prevDayRaw.year === prev.year && prevDayRaw.month === prev.month
              ? Math.min(30, prevDayRaw.day + 1)
              : 30;
          return buildHijriInfo(prev.year, prev.month, extendedDay, 'confirmed');
        }
      }
    }
  }

  const raw = getUmmAlQuraRawByDayNumber(targetDayNum, safeOffset);
  return buildHijriInfo(raw.year, raw.month, raw.day, 'calculated');
}

export function formatHijriDateBn(hijri: HijriDateInfo): string {
  return `${toBanglaDigits(hijri.day)} ${hijri.monthNameBn}, ${toBanglaDigits(hijri.year)} হি.`;
}

export function getHijriMonthGregorianDates(
  referenceDate: Date,
  offsetDays = 0,
  monthAnchors?: readonly HijriMonthAnchor[]
): Array<{ gregorianDate: Date; hijri: HijriDateInfo }> {
  const safeRef = Number.isFinite(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const safeOffset = clampHijriOffsetDays(offsetDays);
  const anchor = makeLocalDate(
    safeRef.getFullYear(),
    safeRef.getMonth(),
    safeRef.getDate()
  );
  const target = getHijriDate(anchor, safeOffset, monthAnchors);

  let firstDay = anchor;
  for (let i = 0; i < 32; i++) {
    const prev = addDays(firstDay, -1);
    const prevHijri = getHijriDate(prev, safeOffset, monthAnchors);
    if (prevHijri.year !== target.year || prevHijri.month !== target.month) {
      break;
    }
    firstDay = prev;
  }

  const result: Array<{ gregorianDate: Date; hijri: HijriDateInfo }> = [];
  let cursor = firstDay;
  for (let i = 0; i < 32; i++) {
    const hijri = getHijriDate(cursor, safeOffset, monthAnchors);
    if (hijri.year !== target.year || hijri.month !== target.month) {
      break;
    }
    result.push({ gregorianDate: cursor, hijri });
    cursor = addDays(cursor, 1);
  }

  return result;
}
