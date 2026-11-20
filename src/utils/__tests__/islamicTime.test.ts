import { describe, expect, it } from 'vitest';
import { DEFAULT_FASTING_LOCATION } from '../fasting';
import {
  computeDailyWaqtTimes,
  formatReadingDurationBn,
  getIslamicDayKeyForInstant,
  JUMMAH_SURAH_ID,
  resolveIslamicDayContext,
} from '../islamicTime';

describe('islamicTime — Maghrib-to-Maghrib Islamic Day & Waqt Surah Suggestions', () => {
  // 2026-11-19 is a Thursday; 2026-11-20 is a Friday
  const thursdayNoon = new Date(2026, 10, 19, 12, 0, 0, 0);
  const fridayNoon = new Date(2026, 10, 20, 12, 0, 0, 0);

  it('computes ordered 5 waqt times for Dhaka', () => {
    const waqts = computeDailyWaqtTimes(
      thursdayNoon,
      DEFAULT_FASTING_LOCATION,
      'karachi'
    );
    expect(waqts.fajr.getTime()).toBeLessThan(waqts.sunrise.getTime());
    expect(waqts.sunrise.getTime()).toBeLessThan(waqts.dhuhr.getTime());
    expect(waqts.dhuhr.getTime()).toBeLessThan(waqts.asr.getTime());
    expect(waqts.asr.getTime()).toBeLessThan(waqts.maghrib.getTime());
    expect(waqts.maghrib.getTime()).toBeLessThan(waqts.isha.getTime());
  });

  it('activates Jummah (Surah Al-Kahf) strictly from Thursday Maghrib to Friday Maghrib', () => {
    const thuWaqts = computeDailyWaqtTimes(
      thursdayNoon,
      DEFAULT_FASTING_LOCATION,
      'karachi'
    );
    const friWaqts = computeDailyWaqtTimes(
      fridayNoon,
      DEFAULT_FASTING_LOCATION,
      'karachi'
    );

    expect(JUMMAH_SURAH_ID).toBe(18);

    // 1 minute before Thursday Maghrib -> still Thursday (not Jummah)
    const beforeThuMaghrib = new Date(thuWaqts.maghrib.getTime() - 60_000);
    const ctxBeforeThu = resolveIslamicDayContext(
      beforeThuMaghrib,
      DEFAULT_FASTING_LOCATION,
      'karachi'
    );
    expect(ctxBeforeThu.isJummah).toBe(false);
    expect(ctxBeforeThu.islamicWeekday).toBe(4);
    expect(ctxBeforeThu.islamicDayKey).toBe('2026-11-19');

    // 1 minute after Thursday Maghrib -> Islamic Friday starts (Jummah ON!)
    const afterThuMaghrib = new Date(thuWaqts.maghrib.getTime() + 60_000);
    const ctxAfterThu = resolveIslamicDayContext(
      afterThuMaghrib,
      DEFAULT_FASTING_LOCATION,
      'karachi'
    );
    expect(ctxAfterThu.isJummah).toBe(true);
    expect(ctxAfterThu.isAfterMaghrib).toBe(true);
    expect(ctxAfterThu.islamicWeekday).toBe(5);
    expect(ctxAfterThu.islamicDayKey).toBe('2026-11-20');

    // 1 minute before Friday Maghrib -> still Jummah
    const beforeFriMaghrib = new Date(friWaqts.maghrib.getTime() - 60_000);
    const ctxBeforeFri = resolveIslamicDayContext(
      beforeFriMaghrib,
      DEFAULT_FASTING_LOCATION,
      'karachi'
    );
    expect(ctxBeforeFri.isJummah).toBe(true);
    expect(ctxBeforeFri.islamicDayKey).toBe('2026-11-20');

    // 1 minute after Friday Maghrib -> Islamic Saturday starts (Jummah OFF + routine day key flips!)
    const afterFriMaghrib = new Date(friWaqts.maghrib.getTime() + 60_000);
    const ctxAfterFri = resolveIslamicDayContext(
      afterFriMaghrib,
      DEFAULT_FASTING_LOCATION,
      'karachi'
    );
    expect(ctxAfterFri.isJummah).toBe(false);
    expect(ctxAfterFri.islamicWeekday).toBe(6);
    expect(ctxAfterFri.islamicDayKey).toBe('2026-11-21');
  });

  it('suggests the right Surah across all 5 waqts and pre-Fajr night', () => {
    const waqts = computeDailyWaqtTimes(
      thursdayNoon,
      DEFAULT_FASTING_LOCATION,
      'karachi'
    );

    const preFajr = new Date(waqts.fajr.getTime() - 10 * 60_000);
    const afterFajr = new Date(waqts.fajr.getTime() + 10 * 60_000);
    const afterDhuhr = new Date(waqts.dhuhr.getTime() + 10 * 60_000);
    const afterAsr = new Date(waqts.asr.getTime() + 10 * 60_000);
    const afterMaghrib = new Date(waqts.maghrib.getTime() + 10 * 60_000);
    const afterIsha = new Date(waqts.isha.getTime() + 10 * 60_000);

    expect(
      resolveIslamicDayContext(preFajr, DEFAULT_FASTING_LOCATION).waqtSuggestion
        .surahId
    ).toBe(67); // Al-Mulk
    expect(
      resolveIslamicDayContext(afterFajr, DEFAULT_FASTING_LOCATION)
        .waqtSuggestion.surahId
    ).toBe(36); // Yasin
    expect(
      resolveIslamicDayContext(afterDhuhr, DEFAULT_FASTING_LOCATION)
        .waqtSuggestion.surahId
    ).toBe(48); // Al-Fath
    expect(
      resolveIslamicDayContext(afterAsr, DEFAULT_FASTING_LOCATION)
        .waqtSuggestion.surahId
    ).toBe(78); // An-Naba
    expect(
      resolveIslamicDayContext(afterMaghrib, DEFAULT_FASTING_LOCATION)
        .waqtSuggestion.surahId
    ).toBe(56); // Al-Waqiah
    expect(
      resolveIslamicDayContext(afterIsha, DEFAULT_FASTING_LOCATION)
        .waqtSuggestion.surahId
    ).toBe(67); // Al-Mulk
  });

  it('rolls Islamic day key at Maghrib for daily routine resets', () => {
    const waqts = computeDailyWaqtTimes(
      thursdayNoon,
      DEFAULT_FASTING_LOCATION,
      'karachi'
    );
    const keyBefore = getIslamicDayKeyForInstant(
      new Date(waqts.maghrib.getTime() - 1000),
      DEFAULT_FASTING_LOCATION
    );
    const keyAt = getIslamicDayKeyForInstant(
      new Date(waqts.maghrib.getTime() + 1000),
      DEFAULT_FASTING_LOCATION
    );
    expect(keyBefore).toBe('2026-11-19');
    expect(keyAt).toBe('2026-11-20');
  });

  it('formats Bangla reading durations cleanly', () => {
    expect(formatReadingDurationBn(0)).toBe('০ মি.');
    expect(formatReadingDurationBn(30)).toBe('<১ মি.');
    expect(formatReadingDurationBn(900)).toBe('১৫ মি.');
    expect(formatReadingDurationBn(3600)).toBe('১ ঘ.');
    expect(formatReadingDurationBn(4500)).toBe('১ ঘ. ১৫ মি.');
  });
});
