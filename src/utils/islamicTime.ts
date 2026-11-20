import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
} from 'adhan';
import {
  DEFAULT_FASTING_LOCATION,
  formatPrayerTimeBn,
  getCurrentNow,
  resolveIslamicCalendarDate,
  toZonedCalendarDate,
  type FastingCalculationMethod,
  type FastingLocation,
} from './fasting';
import { toBanglaDigits } from './formatters';
import { addDays, formatDateKey } from './stats';

export type WaqtId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface DailyWaqtTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

export interface WaqtSurahSuggestion {
  waqt: WaqtId;
  surahId: number;
  waqtNameBn: string;
  contextLabelBn: string;
  hintBn: string;
}

export const JUMMAH_SURAH_ID = 18; // সূরা আল-কাহফ

export const WAQT_SURAH_SUGGESTIONS: Record<WaqtId, WaqtSurahSuggestion> = {
  fajr: {
    waqt: 'fajr',
    surahId: 36,
    waqtNameBn: 'ফজর',
    contextLabelBn: 'ফজরের পর',
    hintBn: 'দিনের শুরুতে বরকত ও প্রশান্তির আমল',
  },
  dhuhr: {
    waqt: 'dhuhr',
    surahId: 48,
    waqtNameBn: 'যোহর',
    contextLabelBn: 'যোহরের পর',
    hintBn: 'যোহরের পরের বিশেষ তিলাওয়াত',
  },
  asr: {
    waqt: 'asr',
    surahId: 78,
    waqtNameBn: 'আসর',
    contextLabelBn: 'আসরের পর',
    hintBn: 'আসরের পরের নিয়মিত সূরা তিলাওয়াত',
  },
  maghrib: {
    waqt: 'maghrib',
    surahId: 56,
    waqtNameBn: 'মাগরিব',
    contextLabelBn: 'মাগরিবের পর',
    hintBn: 'মাগরিবের পর রিযিকে বরকতের আমল',
  },
  isha: {
    waqt: 'isha',
    surahId: 67,
    waqtNameBn: 'এশা',
    contextLabelBn: 'এশার পর / রাতে',
    hintBn: 'ঘুমানোর আগে রাতের সুরক্ষার আমল',
  },
};

export interface WaqtWindow {
  start: Date;
  end: Date;
  startFormatted: string;
  endFormatted: string;
}

export interface IslamicDayContext {
  now: Date;
  gregorianDate: Date;
  islamicDate: Date;
  islamicDayKey: string;
  islamicWeekday: number; // 0 = Sun ... 5 = Fri ... 6 = Sat
  isAfterMaghrib: boolean;
  isJummah: boolean; // Thu Maghrib -> Fri Maghrib
  nextResetAt: Date;
  todayWaqts: DailyWaqtTimes;
  currentWaqt: WaqtId;
  waqtSuggestion: WaqtSurahSuggestion;
  waqtWindow: WaqtWindow;
  nextTransitionAt: Date;
}

function buildAdhanParams(
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
  // Bangladesh & South Asia follow Hanafi Asr by default for Karachi method
  params.madhab = method === 'karachi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;
  return params;
}

export function computeDailyWaqtTimes(
  calendarDate: Date,
  location: FastingLocation = DEFAULT_FASTING_LOCATION,
  method: FastingCalculationMethod = 'karachi'
): DailyWaqtTimes {
  const coordinates = new Coordinates(location.latitude, location.longitude);
  const params = buildAdhanParams(method, coordinates);
  const pt = new PrayerTimes(coordinates, calendarDate, params);

  return {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
}

export function getIslamicDayKeyForInstant(
  instant: Date,
  location: FastingLocation = DEFAULT_FASTING_LOCATION,
  method: FastingCalculationMethod = 'karachi'
): string {
  const { islamicDate } = resolveIslamicCalendarDate(
    instant,
    location,
    method,
    location.timeZone
  );
  return formatDateKey(islamicDate);
}

export function resolveIslamicDayContext(
  now: Date = getCurrentNow(),
  location: FastingLocation = DEFAULT_FASTING_LOCATION,
  method: FastingCalculationMethod = 'karachi',
  timeFormat: '12h' | '24h' = '12h'
): IslamicDayContext {
  const effectiveTimeZone = location.timeZone;
  const { gregorianDate, islamicDate, isAfterMaghrib } =
    resolveIslamicCalendarDate(now, location, method, effectiveTimeZone);

  const safeGregorian = Number.isFinite(gregorianDate.getTime())
    ? gregorianDate
    : toZonedCalendarDate(new Date(), effectiveTimeZone);

  const todayWaqts = computeDailyWaqtTimes(safeGregorian, location, method);
  const yesterdayWaqts = computeDailyWaqtTimes(
    addDays(safeGregorian, -1),
    location,
    method
  );
  const tomorrowWaqts = computeDailyWaqtTimes(
    addDays(safeGregorian, 1),
    location,
    method
  );

  const nowMs = now.getTime();
  let currentWaqt: WaqtId;
  let windowStart: Date;
  let windowEnd: Date;

  if (nowMs < todayWaqts.fajr.getTime()) {
    currentWaqt = 'isha';
    windowStart = yesterdayWaqts.isha;
    windowEnd = todayWaqts.fajr;
  } else if (nowMs < todayWaqts.dhuhr.getTime()) {
    currentWaqt = 'fajr';
    windowStart = todayWaqts.fajr;
    windowEnd = todayWaqts.dhuhr;
  } else if (nowMs < todayWaqts.asr.getTime()) {
    currentWaqt = 'dhuhr';
    windowStart = todayWaqts.dhuhr;
    windowEnd = todayWaqts.asr;
  } else if (nowMs < todayWaqts.maghrib.getTime()) {
    currentWaqt = 'asr';
    windowStart = todayWaqts.asr;
    windowEnd = todayWaqts.maghrib;
  } else if (nowMs < todayWaqts.isha.getTime()) {
    currentWaqt = 'maghrib';
    windowStart = todayWaqts.maghrib;
    windowEnd = todayWaqts.isha;
  } else {
    currentWaqt = 'isha';
    windowStart = todayWaqts.isha;
    windowEnd = tomorrowWaqts.fajr;
  }

  const nextResetAt = isAfterMaghrib
    ? tomorrowWaqts.maghrib
    : todayWaqts.maghrib;

  const islamicWeekday = islamicDate.getDay();
  const isJummah = islamicWeekday === 5;
  const islamicDayKey = formatDateKey(islamicDate);

  const nextTransitionAt =
    windowEnd.getTime() <= nextResetAt.getTime() ? windowEnd : nextResetAt;

  return {
    now,
    gregorianDate: safeGregorian,
    islamicDate,
    islamicDayKey,
    islamicWeekday,
    isAfterMaghrib,
    isJummah,
    nextResetAt,
    todayWaqts,
    currentWaqt,
    waqtSuggestion: WAQT_SURAH_SUGGESTIONS[currentWaqt],
    waqtWindow: {
      start: windowStart,
      end: windowEnd,
      startFormatted: formatPrayerTimeBn(windowStart, timeFormat, effectiveTimeZone),
      endFormatted: formatPrayerTimeBn(windowEnd, timeFormat, effectiveTimeZone),
    },
    nextTransitionAt,
  };
}

/** Formats duration in seconds into concise Bangla reading time (e.g. "১৫ মি.", "১ ঘ. ১০ মি.") */
export function formatReadingDurationBn(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  if (safe === 0) return '০ মি.';
  if (safe < 60) return '<১ মি.';
  const totalMinutes = Math.floor(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) {
    return `${toBanglaDigits(mins)} মি.`;
  }
  if (mins === 0) {
    return `${toBanglaDigits(hours)} ঘ.`;
  }
  return `${toBanglaDigits(hours)} ঘ. ${toBanglaDigits(mins)} মি.`;
}

/** Formats countdown until Maghrib reset (e.g. "৩ ঘ. ২০ মি.") */
export function formatTimeRemainingBn(from: Date, to: Date): string {
  const diffMs = Math.max(0, to.getTime() - from.getTime());
  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${toBanglaDigits(mins)} মিনিট`;
  if (mins === 0) return `${toBanglaDigits(hours)} ঘণ্টা`;
  return `${toBanglaDigits(hours)} ঘণ্টা ${toBanglaDigits(mins)} মি.`;
}
