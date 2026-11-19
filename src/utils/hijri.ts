import { toBanglaDigits } from './formatters';
import { addDays, makeLocalDate } from './stats';

export interface HijriDateInfo {
  year: number;
  month: number;
  day: number;
  monthNameBn: string;
  isRamadan: boolean;
  isAyyamAlBid: boolean;
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

export function getHijriDate(date: Date, offsetDays = 0): HijriDateInfo {
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const safeOffset = clampHijriOffsetDays(offsetDays);
  // Use UTC noon of the shifted local calendar date so timezone/DST never shifts Hijri day boundaries
  const utcNoon = new Date(
    Date.UTC(
      safeDate.getFullYear(),
      safeDate.getMonth(),
      safeDate.getDate() + safeOffset,
      12,
      0,
      0,
      0
    )
  );

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

  const monthNameBn =
    HIJRI_MONTH_NAMES_BN[month - 1] ?? HIJRI_MONTH_NAMES_BN[0];

  return {
    year,
    month,
    day,
    monthNameBn,
    isRamadan: isRamadanMonth(month),
    isAyyamAlBid: isMonthlySunnahFastDay(day),
  };
}

export function formatHijriDateBn(hijri: HijriDateInfo): string {
  return `${toBanglaDigits(hijri.day)} ${hijri.monthNameBn}, ${toBanglaDigits(hijri.year)} হি.`;
}

export function getHijriMonthGregorianDates(
  referenceDate: Date,
  offsetDays = 0
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
  const target = getHijriDate(anchor, safeOffset);

  let firstDay = anchor;
  for (let i = 0; i < 32; i++) {
    const prev = addDays(firstDay, -1);
    const prevHijri = getHijriDate(prev, safeOffset);
    if (prevHijri.year !== target.year || prevHijri.month !== target.month) {
      break;
    }
    firstDay = prev;
  }

  const result: Array<{ gregorianDate: Date; hijri: HijriDateInfo }> = [];
  let cursor = firstDay;
  for (let i = 0; i < 32; i++) {
    const hijri = getHijriDate(cursor, safeOffset);
    if (hijri.year !== target.year || hijri.month !== target.month) {
      break;
    }
    result.push({ gregorianDate: cursor, hijri });
    cursor = addDays(cursor, 1);
  }

  return result;
}
