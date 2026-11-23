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

  it('resolves confirmed moon-sighting anchors for exact 29/30-day months and boundaries', () => {
    // 1) Bounded 29-day Ramadan followed by 30-day Shawwal (even if Umm al-Qura differs)
    const anchors = [
      { year: 1448, month: 9, startDate: '2027-02-08' },
      { year: 1448, month: 10, startDate: '2027-03-09' }, // 29-day Ramadan
      { year: 1448, month: 11, startDate: '2027-04-08' }, // 30-day Shawwal
    ];

    const ramadanDays = getHijriMonthGregorianDates(
      new Date(2027, 1, 15, 12, 0, 0),
      -1,
      anchors
    );
    expect(ramadanDays).toHaveLength(29);
    expect(ramadanDays[0].hijri.day).toBe(1);
    expect(ramadanDays[0].hijri.source).toBe('confirmed');
    expect(ramadanDays[28].hijri.day).toBe(29);
    expect(ramadanDays[28].hijri.month).toBe(9);

    const eidDay = getHijriDate(new Date(2027, 2, 9, 12, 0, 0), -1, anchors);
    expect(eidDay.year).toBe(1448);
    expect(eidDay.month).toBe(10);
    expect(eidDay.day).toBe(1);
    expect(eidDay.source).toBe('confirmed');

    const shawwalDays = getHijriMonthGregorianDates(
      new Date(2027, 2, 20, 12, 0, 0),
      -1,
      anchors
    );
    expect(shawwalDays).toHaveLength(30);
    expect(shawwalDays[0].hijri.day).toBe(1);
    expect(shawwalDays[29].hijri.day).toBe(30);

    // 2) Open-ended confirmed month (Bangladesh Jumada al-Thani 1448 starting 2026-11-12)
    const bdAnchor = [{ year: 1448, month: 6, startDate: '2026-11-12' }];
    const nov24 = getHijriDate(new Date(2026, 10, 24, 12, 0, 0), -1, bdAnchor);
    expect(nov24.year).toBe(1448);
    expect(nov24.month).toBe(6);
    expect(nov24.day).toBe(13);
    expect(nov24.source).toBe('confirmed');

    // 3) Extending previous unannounced month to Day 30 when confirmed next month starts 1 day later
    // Umm al-Qura with offset 0 says 2026-02-17 = 29 Shaban 1447, 2026-02-18 = 1 Ramadan 1447.
    // If confirmed anchor sets Ramadan to 2026-02-19, 2026-02-18 must become 30 Shaban 1447.
    const delayedRamadan = [{ year: 1447, month: 9, startDate: '2026-02-19' }];
    const feb18 = getHijriDate(new Date(2026, 1, 18, 12, 0, 0), 0, delayedRamadan);
    expect(feb18.year).toBe(1447);
    expect(feb18.month).toBe(8);
    expect(feb18.day).toBe(30);
    expect(feb18.source).toBe('confirmed');
    const feb19 = getHijriDate(new Date(2026, 1, 19, 12, 0, 0), 0, delayedRamadan);
    expect(feb19.year).toBe(1447);
    expect(feb19.month).toBe(9);
    expect(feb19.day).toBe(1);
    expect(feb19.source).toBe('confirmed');

    // 4) Shortening previous unannounced month when confirmed next month starts 1 day earlier
    // Umm al-Qura with offset 0 says 2026-03-19 = 30 Ramadan 1447, 2026-03-20 = 1 Shawwal 1447.
    // If confirmed anchor sets Shawwal to 2026-03-19, Ramadan ends at Day 29 (2026-03-18).
    const earlyShawwal = [{ year: 1447, month: 10, startDate: '2026-03-19' }];
    const mar18 = getHijriDate(new Date(2026, 2, 18, 12, 0, 0), 0, earlyShawwal);
    expect(mar18.month).toBe(9);
    expect(mar18.day).toBe(29);
    const mar19 = getHijriDate(new Date(2026, 2, 19, 12, 0, 0), 0, earlyShawwal);
    expect(mar19.month).toBe(10);
    expect(mar19.day).toBe(1);
    expect(mar19.source).toBe('confirmed');

    // 5) Far outside anchored range falls back to calculated Umm al-Qura
    const farFuture = getHijriDate(new Date(2028, 5, 1, 12, 0, 0), -1, bdAnchor);
    expect(farFuture.source).toBe('calculated');
  });
});
