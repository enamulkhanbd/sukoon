import { describe, expect, it } from 'vitest';
import {
  clampHijriOffsetDays,
  formatHijriDateBn,
  getHijriDate,
  getHijriMonthGregorianDates,
  isMonthlySunnahFastDay,
  isRamadanMonth,
  isWeeklySunnahFastDay,
} from '../hijri';

describe('hijri utilities', () => {
  it('converts Gregorian dates around Ramadan 1447 accurately', () => {
    const firstRamadan = getHijriDate(new Date(2026, 1, 18, 12, 0, 0));
    expect(firstRamadan.year).toBe(1447);
    expect(firstRamadan.month).toBe(9);
    expect(firstRamadan.day).toBe(1);
    expect(firstRamadan.monthNameBn).toBe('রমজান');
    expect(firstRamadan.isRamadan).toBe(true);
    expect(firstRamadan.isAyyamAlBid).toBe(false);

    const lastRamadan = getHijriDate(new Date(2026, 2, 19, 12, 0, 0));
    expect(lastRamadan.year).toBe(1447);
    expect(lastRamadan.month).toBe(9);
    expect(lastRamadan.day).toBe(30);
    expect(lastRamadan.isRamadan).toBe(true);

    const shawwalOne = getHijriDate(new Date(2026, 2, 20, 12, 0, 0));
    expect(shawwalOne.year).toBe(1447);
    expect(shawwalOne.month).toBe(10);
    expect(shawwalOne.day).toBe(1);
    expect(shawwalOne.monthNameBn).toBe('শাওয়াল');
    expect(shawwalOne.isRamadan).toBe(false);
  });

  it('applies hijriOffsetDays and clamps settings offset to -2..+2', () => {
    const feb18 = new Date(2026, 1, 18, 12, 0, 0);
    const shiftedBack = getHijriDate(feb18, -1);
    expect(shiftedBack.month).toBe(8);
    expect(shiftedBack.isRamadan).toBe(false);

    const feb17 = new Date(2026, 1, 17, 12, 0, 0);
    const shiftedForward = getHijriDate(feb17, 1);
    expect(shiftedForward.month).toBe(9);
    expect(shiftedForward.day).toBe(1);
    expect(shiftedForward.isRamadan).toBe(true);

    expect(clampHijriOffsetDays(-5)).toBe(-2);
    expect(clampHijriOffsetDays(5)).toBe(2);
    expect(clampHijriOffsetDays(1.9)).toBe(1);
    expect(clampHijriOffsetDays(Number.NaN)).toBe(0);

    // Direct enforcement inside getHijriDate and getHijriMonthGregorianDates
    expect(getHijriDate(feb18, 10)).toEqual(getHijriDate(feb18, 2));
    expect(getHijriDate(feb18, -10)).toEqual(getHijriDate(feb18, -2));

    const clampedForwardMonth = getHijriMonthGregorianDates(feb18, 10);
    const maxForwardMonth = getHijriMonthGregorianDates(feb18, 2);
    expect(clampedForwardMonth[0].hijri).toEqual(maxForwardMonth[0].hijri);

    const clampedBackwardMonth = getHijriMonthGregorianDates(feb18, -10);
    const maxBackwardMonth = getHijriMonthGregorianDates(feb18, -2);
    expect(clampedBackwardMonth[0].hijri).toEqual(maxBackwardMonth[0].hijri);
  });

  it('detects Ramadan month only for Hijri month 9', () => {
    expect(isRamadanMonth(9)).toBe(true);
    for (let m = 1; m <= 12; m++) {
      if (m !== 9) {
        expect(isRamadanMonth(m)).toBe(false);
      }
    }
  });

  it('detects weekly Sunnah fast days (Monday and Thursday only)', () => {
    // 2026-02-15 is Sunday through 2026-02-21 Saturday
    const results = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 1, 15 + i, 12, 0, 0);
      return { day: d.getDay(), ...isWeeklySunnahFastDay(d) };
    });

    expect(results[0]).toEqual({ day: 0, isWeeklySunnah: false, weekday: null }); // Sun
    expect(results[1]).toEqual({ day: 1, isWeeklySunnah: true, weekday: 'monday' }); // Mon
    expect(results[2]).toEqual({ day: 2, isWeeklySunnah: false, weekday: null }); // Tue
    expect(results[3]).toEqual({ day: 3, isWeeklySunnah: false, weekday: null }); // Wed
    expect(results[4]).toEqual({ day: 4, isWeeklySunnah: true, weekday: 'thursday' }); // Thu
    expect(results[5]).toEqual({ day: 5, isWeeklySunnah: false, weekday: null }); // Fri
    expect(results[6]).toEqual({ day: 6, isWeeklySunnah: false, weekday: null }); // Sat
  });

  it('detects monthly Sunnah fast days (13, 14, 15 Hijri)', () => {
    expect(isMonthlySunnahFastDay(12)).toBe(false);
    expect(isMonthlySunnahFastDay(13)).toBe(true);
    expect(isMonthlySunnahFastDay(14)).toBe(true);
    expect(isMonthlySunnahFastDay(15)).toBe(true);
    expect(isMonthlySunnahFastDay(16)).toBe(false);

    // 2026-03-02 is Monday AND 13 Ramadan 1447
    const overlapDate = new Date(2026, 2, 2, 12, 0, 0);
    const hijri = getHijriDate(overlapDate);
    expect(hijri.day).toBe(13);
    expect(hijri.isAyyamAlBid).toBe(true);
    expect(isWeeklySunnahFastDay(overlapDate)).toEqual({
      isWeeklySunnah: true,
      weekday: 'monday',
    });
  });

  it('formats Hijri date in Bangla', () => {
    const info = getHijriDate(new Date(2026, 1, 18, 12, 0, 0));
    expect(formatHijriDateBn(info)).toBe('১ রমজান, ১৪৪৭ হি.');
  });

  it('enumerates every day of both 30-day and 29-day Hijri months', () => {
    // Ramadan 1447 has 30 days (2026-02-18 .. 2026-03-19)
    const ramadanDays = getHijriMonthGregorianDates(new Date(2026, 2, 5, 12, 0, 0));
    expect(ramadanDays).toHaveLength(30);
    expect(ramadanDays[0].hijri.day).toBe(1);
    expect(ramadanDays[29].hijri.day).toBe(30);
    expect(ramadanDays.every((d, idx) => d.hijri.day === idx + 1 && d.hijri.month === 9)).toBe(
      true
    );

    // Shaban 1447 has 29 days (2026-01-20 .. 2026-02-17)
    const shabanDays = getHijriMonthGregorianDates(new Date(2026, 1, 10, 12, 0, 0));
    expect(shabanDays).toHaveLength(29);
    expect(shabanDays[0].hijri.day).toBe(1);
    expect(shabanDays[28].hijri.day).toBe(29);
    expect(shabanDays.every((d, idx) => d.hijri.day === idx + 1 && d.hijri.month === 8)).toBe(
      true
    );
  });
});
