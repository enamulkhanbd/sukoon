import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  PolarCircleResolution,
  PrayerTimes,
} from 'adhan';
import { DAY_SHORT_BN, toBanglaDigits } from './formatters';
import {
  clampHijriOffsetDays,
  getHijriDate,
  getHijriMonthGregorianDates,
  isMonthlySunnahFastDay,
  isWeeklySunnahFastDay,
  type HijriDateInfo,
  type HijriMonthAnchor,
} from './hijri';
import { addDays, formatDateKey } from './stats';

export type FastingCalculationMethod =
  | 'karachi'
  | 'mwl'
  | 'umm_al_qura'
  | 'isna'
  | 'egyptian';

export type HijriOffsetMode = 'auto' | 'manual';
export type HijriCalendarRegion = 'bd' | 'sa' | 'default';

const SOUTH_ASIA_TIMEZONES = new Set([
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Calcutta',
  'Asia/Karachi',
  'Asia/Kathmandu',
  'Asia/Colombo',
]);

export interface FastingLocation {
  id: string;
  nameBn: string;
  latitude: number;
  longitude: number;
  timeZone?: string;
}

export type FastingPhase = 'before_sehri' | 'fasting' | 'after_iftar';

export interface DailyFastingTimes {
  sehri: Date;
  iftar: Date;
  sehriFormatted: string;
  iftarFormatted: string;
  durationMinutes: number;
}

export interface FastingProgress {
  phase: FastingPhase;
  percent: number;
  percentTextBn: string;
  statusTextBn: string;
}

export interface FastingCountdown {
  target: 'sehri' | 'iftar' | 'none';
  labelBn: string;
  remainingMs: number;
  formattedBn: string;
  isActive: boolean;
}

export interface MonthlyScheduleDay {
  gregorianDate: Date;
  dateKey: string;
  hijri: HijriDateInfo;
  weekdayIndex: number;
  weekdayShortBn: string;
  sehri: Date;
  iftar: Date;
  sehriFormatted: string;
  iftarFormatted: string;
  isWeeklySunnah: boolean;
  weeklySunnahType: 'monday' | 'thursday' | null;
  isMonthlySunnah: boolean;
  isToday: boolean;
}

export const DEBUG_NOW_STORAGE_KEY = 'sukoon_debug_now';

export const DEFAULT_FASTING_LOCATION: FastingLocation = {
  id: 'dhaka',
  nameBn: 'ঢাকা',
  latitude: 23.8103,
  longitude: 90.4125,
  timeZone: 'Asia/Dhaka',
};

export const PRESET_FASTING_LOCATIONS: FastingLocation[] = [
  DEFAULT_FASTING_LOCATION,
  {
    id: 'chattogram',
    nameBn: 'চট্টগ্রাম',
    latitude: 22.3569,
    longitude: 91.7832,
    timeZone: 'Asia/Dhaka',
  },
  {
    id: 'sylhet',
    nameBn: 'সিলেট',
    latitude: 24.8949,
    longitude: 91.8687,
    timeZone: 'Asia/Dhaka',
  },
  {
    id: 'rajshahi',
    nameBn: 'রাজশাহী',
    latitude: 24.3745,
    longitude: 88.6042,
    timeZone: 'Asia/Dhaka',
  },
  {
    id: 'khulna',
    nameBn: 'খুলনা',
    latitude: 22.8456,
    longitude: 89.5403,
    timeZone: 'Asia/Dhaka',
  },
  {
    id: 'barishal',
    nameBn: 'বরিশাল',
    latitude: 22.701,
    longitude: 90.3535,
    timeZone: 'Asia/Dhaka',
  },
  {
    id: 'rangpur',
    nameBn: 'রংপুর',
    latitude: 25.7439,
    longitude: 89.2752,
    timeZone: 'Asia/Dhaka',
  },
  {
    id: 'mymensingh',
    nameBn: 'ময়মনসিংহ',
    latitude: 24.7471,
    longitude: 90.4203,
    timeZone: 'Asia/Dhaka',
  },
  {
    id: 'makkah',
    nameBn: 'মক্কা',
    latitude: 21.3891,
    longitude: 39.8579,
    timeZone: 'Asia/Riyadh',
  },
  {
    id: 'madinah',
    nameBn: 'মদিনা',
    latitude: 24.5247,
    longitude: 39.5692,
    timeZone: 'Asia/Riyadh',
  },
  {
    id: 'london',
    nameBn: 'লন্ডন',
    latitude: 51.5072,
    longitude: -0.1276,
    timeZone: 'Europe/London',
  },
];

export const FASTING_CALCULATION_METHODS: ReadonlyArray<{
  id: FastingCalculationMethod;
  labelBn: string;
  hintBn: string;
}> = [
  { id: 'karachi', labelBn: 'করাচি', hintBn: 'বাংলাদেশ ও দক্ষিণ এশিয়া (১৮°/১৮°)' },
  { id: 'mwl', labelBn: 'মুসলিম ওয়ার্ল্ড লিগ', hintBn: '১৮°/১৭°' },
  { id: 'umm_al_qura', labelBn: 'উম্মুল কুরা', hintBn: 'মক্কা' },
  { id: 'isna', labelBn: 'ইসনা', hintBn: 'উত্তর আমেরিকা (১৫°/১৫°)' },
  { id: 'egyptian', labelBn: 'মিশরীয়', hintBn: '১৯.৫°/১৭.৫°' },
];

/**
 * Maps a location to a regional moon-sighting calendar bucket.
 */
export function getHijriCalendarRegion(
  location: FastingLocation = DEFAULT_FASTING_LOCATION
): HijriCalendarRegion {
  if (location.timeZone) {
    if (SOUTH_ASIA_TIMEZONES.has(location.timeZone)) return 'bd';
    if (location.timeZone === 'Asia/Riyadh') return 'sa';
    return 'default';
  }
  if (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= 5 &&
    location.latitude <= 37 &&
    location.longitude >= 60 &&
    location.longitude <= 98
  ) {
    return 'bd';
  }
  return 'default';
}

/**
 * Returns the regional default Hijri offset relative to Umm al-Qura:
 * -1 for Bangladesh & South Asia (local moon sighting), 0 for Saudi Arabia & other regions.
 */
export function getDefaultHijriOffsetDays(
  location: FastingLocation = DEFAULT_FASTING_LOCATION
): number {
  return getHijriCalendarRegion(location) === 'bd' ? -1 : 0;
}

/**
 * Resolves effective Hijri offset & mode for both modern and legacy settings records.
 */
export function resolveHijriOffsetSettings(
  location: FastingLocation = DEFAULT_FASTING_LOCATION,
  hijriOffsetDays?: number,
  hijriOffsetMode?: HijriOffsetMode
): { hijriOffsetDays: number; hijriOffsetMode: HijriOffsetMode } {
  const defaultOffset = getDefaultHijriOffsetDays(location);

  if (hijriOffsetMode === 'manual') {
    return {
      hijriOffsetMode: 'manual',
      hijriOffsetDays: clampHijriOffsetDays(hijriOffsetDays ?? defaultOffset),
    };
  }

  if (hijriOffsetMode === 'auto') {
    return {
      hijriOffsetMode: 'auto',
      hijriOffsetDays: defaultOffset,
    };
  }

  // Legacy settings (hijriOffsetMode === undefined):
  // Migrate untouched legacy default (0 / undefined) to regional auto; preserve non-zero manual offsets.
  if (
    hijriOffsetDays === undefined ||
    !Number.isFinite(hijriOffsetDays) ||
    Math.trunc(hijriOffsetDays) === 0
  ) {
    return {
      hijriOffsetMode: 'auto',
      hijriOffsetDays: defaultOffset,
    };
  }

  return {
    hijriOffsetMode: 'manual',
    hijriOffsetDays: clampHijriOffsetDays(hijriOffsetDays),
  };
}

export function getCurrentNow(): Date {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined'
    ) {
      const override = window.localStorage.getItem(DEBUG_NOW_STORAGE_KEY);
      if (override && override.trim().length > 0) {
        const parsed = new Date(override.trim());
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return new Date();
}

function padTwoBn(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  return safe < 10 ? `০${toBanglaDigits(safe)}` : toBanglaDigits(safe);
}

function getBanglaPeriodLabel(hour24: number): string {
  if (hour24 >= 4 && hour24 < 6) return 'ভোর';
  if (hour24 >= 6 && hour24 < 12) return 'সকাল';
  if (hour24 >= 12 && hour24 < 15) return 'দুপুর';
  if (hour24 >= 15 && hour24 < 18) return 'বিকাল';
  if (hour24 >= 18 && hour24 < 20) return 'সন্ধ্যা';
  return 'রাত';
}

export function toZonedCalendarDate(instant: Date, timeZone?: string): Date {
  if (!Number.isFinite(instant.getTime())) {
    return new Date(Number.NaN);
  }
  if (!timeZone) {
    return new Date(
      instant.getFullYear(),
      instant.getMonth(),
      instant.getDate(),
      12,
      0,
      0,
      0
    );
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(instant);
    let year = Number.NaN;
    let month = Number.NaN;
    let day = Number.NaN;
    for (const part of parts) {
      if (part.type === 'year') {
        year = Number.parseInt(part.value, 10);
      } else if (part.type === 'month') {
        month = Number.parseInt(part.value, 10);
      } else if (part.type === 'day') {
        day = Number.parseInt(part.value, 10);
      }
    }
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  } catch {
    // Fall back to host local calendar date if timeZone is invalid
  }
  return new Date(
    instant.getFullYear(),
    instant.getMonth(),
    instant.getDate(),
    12,
    0,
    0,
    0
  );
}

export function formatPrayerTimeBn(
  date: Date,
  timeFormat: '12h' | '24h' = '12h',
  timeZone?: string
): string {
  if (!Number.isFinite(date.getTime())) {
    return '--:--';
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  }

  const parts = formatter.formatToParts(date);
  let hour24 = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === 'hour') {
      const parsed = Number.parseInt(part.value, 10);
      if (Number.isFinite(parsed)) hour24 = parsed % 24;
    } else if (part.type === 'minute') {
      const parsed = Number.parseInt(part.value, 10);
      if (Number.isFinite(parsed)) minute = parsed;
    }
  }

  if (timeFormat === '24h') {
    return `${padTwoBn(hour24)}:${padTwoBn(minute)}`;
  }

  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const period = getBanglaPeriodLabel(hour24);
  return `${period} ${toBanglaDigits(hour12)}:${padTwoBn(minute)}`;
}

function resolveCalculationParameters(
  method: FastingCalculationMethod,
  coordinates: Coordinates
) {
  let params;
  switch (method) {
    case 'mwl':
      params = CalculationMethod.MuslimWorldLeague();
      break;
    case 'umm_al_qura':
      params = CalculationMethod.UmmAlQura();
      break;
    case 'isna':
      params = CalculationMethod.NorthAmerica();
      break;
    case 'egyptian':
      params = CalculationMethod.Egyptian();
      break;
    case 'karachi':
    default:
      params = CalculationMethod.Karachi();
      break;
  }
  params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;
  return params;
}

function computePrayerTimesForCalendarDate(
  calendarDate: Date,
  location: FastingLocation,
  method: FastingCalculationMethod,
  timeFormat: '12h' | '24h',
  effectiveTimeZone?: string
): DailyFastingTimes {
  if (
    !Number.isFinite(calendarDate.getTime()) ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return {
      sehri: new Date(Number.NaN),
      iftar: new Date(Number.NaN),
      sehriFormatted: '--:--',
      iftarFormatted: '--:--',
      durationMinutes: 0,
    };
  }

  const coordinates = new Coordinates(location.latitude, location.longitude);
  const params = resolveCalculationParameters(method, coordinates);
  const prayerTimes = new PrayerTimes(coordinates, calendarDate, params);

  const sehri = prayerTimes.fajr;
  const iftar = prayerTimes.maghrib;
  const sehriMs = sehri.getTime();
  const iftarMs = iftar.getTime();
  const durationMinutes =
    Number.isFinite(sehriMs) && Number.isFinite(iftarMs)
      ? Math.max(0, Math.round((iftarMs - sehriMs) / 60000))
      : 0;

  return {
    sehri,
    iftar,
    sehriFormatted: formatPrayerTimeBn(sehri, timeFormat, effectiveTimeZone),
    iftarFormatted: formatPrayerTimeBn(iftar, timeFormat, effectiveTimeZone),
    durationMinutes,
  };
}

export function computeDailyFastingTimes(
  date: Date,
  location: FastingLocation = DEFAULT_FASTING_LOCATION,
  method: FastingCalculationMethod = 'karachi',
  timeFormat: '12h' | '24h' = '12h',
  timeZone?: string
): DailyFastingTimes {
  const effectiveTimeZone = timeZone ?? location.timeZone;
  const zonedDate = toZonedCalendarDate(date, effectiveTimeZone);
  return computePrayerTimesForCalendarDate(
    zonedDate,
    location,
    method,
    timeFormat,
    effectiveTimeZone
  );
}

export function computeFastingProgress(
  now: Date,
  sehri: Date,
  iftar: Date
): FastingProgress {
  const nowMs = now.getTime();
  const sehriMs = sehri.getTime();
  const iftarMs = iftar.getTime();

  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(sehriMs) ||
    !Number.isFinite(iftarMs)
  ) {
    return {
      phase: 'before_sehri',
      percent: 0,
      percentTextBn: '০%',
      statusTextBn: 'সময় নির্ণয় করা যায়নি',
    };
  }

  if (iftarMs <= sehriMs) {
    const done = nowMs >= iftarMs;
    const percent = done ? 100 : 0;
    return {
      phase: done ? 'after_iftar' : 'before_sehri',
      percent,
      percentTextBn: `${toBanglaDigits(percent)}%`,
      statusTextBn: done ? 'ইফতার সম্পন্ন' : 'সাহরির সময় (ফজরের আগে)',
    };
  }

  if (nowMs <= sehriMs) {
    return {
      phase: 'before_sehri',
      percent: 0,
      percentTextBn: '০%',
      statusTextBn: 'সাহরির সময় (ফজরের আগে)',
    };
  }

  if (nowMs >= iftarMs) {
    return {
      phase: 'after_iftar',
      percent: 100,
      percentTextBn: '১০০%',
      statusTextBn: 'ইফতার সম্পন্ন',
    };
  }

  const ratio = (nowMs - sehriMs) / (iftarMs - sehriMs);
  const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));

  return {
    phase: 'fasting',
    percent,
    percentTextBn: `${toBanglaDigits(percent)}%`,
    statusTextBn: 'রোজা চলমান',
  };
}

/**
 * Formats a remaining duration in milliseconds as Bangla HH:MM:SS.
 * Uses Math.ceil on seconds so countdowns never reach ০০:০০:০০ before the exact boundary.
 */
export function formatCountdownBn(remainingMs: number): string {
  if (!Number.isFinite(remainingMs)) {
    return '--:--:--';
  }
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${padTwoBn(hours)}:${padTwoBn(minutes)}:${padTwoBn(seconds)}`;
}

export function computeFastingCountdown(
  now: Date,
  sehri: Date,
  iftar: Date
): FastingCountdown {
  const nowMs = now.getTime();
  const sehriMs = sehri.getTime();
  const iftarMs = iftar.getTime();

  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(sehriMs) ||
    !Number.isFinite(iftarMs)
  ) {
    return {
      target: 'none',
      labelBn: 'সময় নির্ণয় করা যায়নি',
      remainingMs: 0,
      formattedBn: '--:--:--',
      isActive: false,
    };
  }

  if (nowMs < sehriMs) {
    const remainingMs = sehriMs - nowMs;
    return {
      target: 'sehri',
      labelBn: 'সাহরি শেষ হতে বাকি',
      remainingMs,
      formattedBn: formatCountdownBn(remainingMs),
      isActive: true,
    };
  }

  if (nowMs < iftarMs) {
    const remainingMs = iftarMs - nowMs;
    return {
      target: 'iftar',
      labelBn: 'ইফতারের বাকি',
      remainingMs,
      formattedBn: formatCountdownBn(remainingMs),
      isActive: true,
    };
  }

  return {
    target: 'none',
    labelBn: 'ইফতার সম্পন্ন',
    remainingMs: 0,
    formattedBn: '০০:০০:০০',
    isActive: false,
  };
}

export interface ActiveFastingContext {
  gregorianDate: Date;
  islamicDate: Date;
  isAfterMaghrib: boolean;
  hijri: HijriDateInfo;
  dailyTimes: DailyFastingTimes;
  progress: FastingProgress;
  countdown: FastingCountdown;
  weeklySunnah: {
    isWeeklySunnah: boolean;
    weekday: 'monday' | 'thursday' | null;
  };
}

/**
 * In the Islamic (Hijri) calendar, each day ends at Maghrib (sunset / Iftar)
 * and the next Hijri day begins immediately at Maghrib.
 */
export function resolveIslamicCalendarDate(
  instant: Date,
  location: FastingLocation = DEFAULT_FASTING_LOCATION,
  method: FastingCalculationMethod = 'karachi',
  timeZone?: string
): {
  gregorianDate: Date;
  islamicDate: Date;
  isAfterMaghrib: boolean;
} {
  const effectiveTimeZone = timeZone ?? location.timeZone;
  const zoned = toZonedCalendarDate(instant, effectiveTimeZone);
  const gregorianDate = Number.isFinite(zoned.getTime())
    ? zoned
    : toZonedCalendarDate(new Date(), effectiveTimeZone);

  const gregorianTodayTimes = computePrayerTimesForCalendarDate(
    gregorianDate,
    location,
    method,
    '24h',
    effectiveTimeZone
  );

  const isAfterMaghrib =
    Number.isFinite(instant.getTime()) &&
    Number.isFinite(gregorianTodayTimes.iftar.getTime()) &&
    instant.getTime() >= gregorianTodayTimes.iftar.getTime();

  const islamicDate = isAfterMaghrib ? addDays(gregorianDate, 1) : gregorianDate;

  return {
    gregorianDate,
    islamicDate,
    isAfterMaghrib,
  };
}

export function resolveActiveFastingContext(
  now: Date,
  location: FastingLocation = DEFAULT_FASTING_LOCATION,
  method: FastingCalculationMethod = 'karachi',
  timeFormat: '12h' | '24h' = '12h',
  hijriOffsetDays = 0,
  timeZone?: string,
  monthAnchors?: readonly HijriMonthAnchor[]
): ActiveFastingContext {
  const effectiveTimeZone = timeZone ?? location.timeZone;
  const { gregorianDate, islamicDate, isAfterMaghrib } =
    resolveIslamicCalendarDate(now, location, method, effectiveTimeZone);

  const hijri = getHijriDate(islamicDate, hijriOffsetDays, monthAnchors);
  const dailyTimes = computePrayerTimesForCalendarDate(
    islamicDate,
    location,
    method,
    timeFormat,
    effectiveTimeZone
  );
  const progress = computeFastingProgress(now, dailyTimes.sehri, dailyTimes.iftar);
  const countdown = computeFastingCountdown(now, dailyTimes.sehri, dailyTimes.iftar);
  const weeklySunnah = isWeeklySunnahFastDay(islamicDate);

  return {
    gregorianDate,
    islamicDate,
    isAfterMaghrib,
    hijri,
    dailyTimes,
    progress,
    countdown,
    weeklySunnah,
  };
}

export function buildHijriMonthSchedule(
  referenceDate: Date,
  options?: {
    location?: FastingLocation;
    method?: FastingCalculationMethod;
    timeFormat?: '12h' | '24h';
    hijriOffsetDays?: number;
    timeZone?: string;
    monthAnchors?: readonly HijriMonthAnchor[];
  }
): {
  hijriYear: number;
  hijriMonth: number;
  hijriMonthNameBn: string;
  isRamadan: boolean;
  days: MonthlyScheduleDay[];
} {
  const location = options?.location ?? DEFAULT_FASTING_LOCATION;
  const method = options?.method ?? 'karachi';
  const timeFormat = options?.timeFormat ?? '12h';
  const hijriOffsetDays = clampHijriOffsetDays(options?.hijriOffsetDays ?? 0);
  const effectiveTimeZone = options?.timeZone ?? location.timeZone;
  const monthAnchors = options?.monthAnchors;

  const { islamicDate } = resolveIslamicCalendarDate(
    referenceDate,
    location,
    method,
    effectiveTimeZone
  );

  const monthDates = getHijriMonthGregorianDates(
    islamicDate,
    hijriOffsetDays,
    monthAnchors
  );
  const todayKey = formatDateKey(islamicDate);

  const days: MonthlyScheduleDay[] = monthDates.map(({ gregorianDate, hijri }) => {
    const times = computePrayerTimesForCalendarDate(
      gregorianDate,
      location,
      method,
      timeFormat,
      effectiveTimeZone
    );
    const weekly = isWeeklySunnahFastDay(gregorianDate);
    const weekdayIndex = gregorianDate.getDay();

    return {
      gregorianDate,
      dateKey: formatDateKey(gregorianDate),
      hijri,
      weekdayIndex,
      weekdayShortBn: DAY_SHORT_BN[weekdayIndex],
      sehri: times.sehri,
      iftar: times.iftar,
      sehriFormatted: times.sehriFormatted,
      iftarFormatted: times.iftarFormatted,
      isWeeklySunnah: weekly.isWeeklySunnah,
      weeklySunnahType: weekly.weekday,
      isMonthlySunnah: isMonthlySunnahFastDay(hijri.day),
      isToday: formatDateKey(gregorianDate) === todayKey,
    };
  });

  const firstHijri =
    days[0]?.hijri ?? getHijriDate(islamicDate, hijriOffsetDays, monthAnchors);

  return {
    hijriYear: firstHijri.year,
    hijriMonth: firstHijri.month,
    hijriMonthNameBn: firstHijri.monthNameBn,
    isRamadan: firstHijri.isRamadan,
    days,
  };
}
