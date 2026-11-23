import { describe, expect, it } from 'vitest';
import {
  buildHijriMonthSchedule,
  computeDailyFastingTimes,
  computeFastingProgress,
  DEFAULT_FASTING_LOCATION,
  formatPrayerTimeBn,
  getDefaultHijriOffsetDays,
  PRESET_FASTING_LOCATIONS,
  resolveActiveFastingContext,
  resolveHijriOffsetSettings,
  resolveIslamicCalendarDate,
  toZonedCalendarDate,
} from '../fasting';

describe('fasting utilities', () => {
  it('formats prayer times in 12h and 24h Bangla formats deterministically', () => {
    // 2026-02-18T22:55:00Z = 2026-02-19 04:55 in Asia/Dhaka (+06:00)
    const sehriInstant = new Date('2026-02-18T22:55:00Z');
    expect(formatPrayerTimeBn(sehriInstant, '24h', 'Asia/Dhaka')).toBe('০৪:৫৫');
    expect(formatPrayerTimeBn(sehriInstant, '12h', 'Asia/Dhaka')).toBe('ভোর ৪:৫৫');

    // 2026-02-19T11:58:00Z = 2026-02-19 17:58 in Asia/Dhaka (+06:00)
    const iftarInstant = new Date('2026-02-19T11:58:00Z');
    expect(formatPrayerTimeBn(iftarInstant, '24h', 'Asia/Dhaka')).toBe('১৭:৫৮');
    expect(formatPrayerTimeBn(iftarInstant, '12h', 'Asia/Dhaka')).toBe('বিকাল ৫:৫৮');

    // Midnight & noon boundaries
    expect(
      formatPrayerTimeBn(new Date('2026-02-18T18:05:00Z'), '12h', 'Asia/Dhaka')
    ).toBe('রাত ১২:০৫');
    expect(
      formatPrayerTimeBn(new Date('2026-02-19T06:00:00Z'), '12h', 'Asia/Dhaka')
    ).toBe('দুপুর ১২:০০');
  });

  it('computes daily Sehri and Iftar times via adhan for Dhaka and high-latitude cities', () => {
    const date = new Date(2026, 1, 18, 12, 0, 0);
    const dhaka12h = computeDailyFastingTimes(
      date,
      DEFAULT_FASTING_LOCATION,
      'karachi',
      '12h',
      'Asia/Dhaka'
    );
    const dhaka24h = computeDailyFastingTimes(
      date,
      DEFAULT_FASTING_LOCATION,
      'karachi',
      '24h',
      'Asia/Dhaka'
    );

    expect(dhaka12h.sehri.getTime()).toBeLessThan(dhaka12h.iftar.getTime());
    expect(dhaka12h.durationMinutes).toBeGreaterThan(600);
    expect(dhaka12h.durationMinutes).toBeLessThan(900);
    expect(dhaka12h.sehriFormatted).toMatch(/[০-৯]+:[০-৯]{2}/);
    expect(dhaka24h.sehriFormatted).toMatch(/^[০-৯]{2}:[০-৯]{2}$/);
    expect(dhaka24h.iftarFormatted).toMatch(/^[০-৯]{2}:[০-৯]{2}$/);

    // High-latitude summer safeguard (London in June)
    const londonJune = computeDailyFastingTimes(
      new Date(2026, 5, 21, 12, 0, 0),
      {
        id: 'london',
        nameBn: 'লন্ডন',
        latitude: 51.5072,
        longitude: -0.1276,
        timeZone: 'Europe/London',
      },
      'mwl',
      '24h'
    );
    expect(Number.isNaN(londonJune.sehri.getTime())).toBe(false);
    expect(Number.isNaN(londonJune.iftar.getTime())).toBe(false);
    expect(londonJune.sehri.getTime()).toBeLessThan(londonJune.iftar.getTime());
  });

  it('computes fasting progress bounded strictly 0%-100% across all phases', () => {
    const sehri = new Date('2026-02-18T23:00:00Z');
    const iftar = new Date('2026-02-19T11:00:00Z'); // 12-hour fast

    // Before Sehri
    const farBefore = computeFastingProgress(
      new Date('2026-02-18T18:00:00Z'),
      sehri,
      iftar
    );
    expect(farBefore.phase).toBe('before_sehri');
    expect(farBefore.percent).toBe(0);
    expect(farBefore.percentTextBn).toBe('০%');

    // Exact Sehri boundary
    const atSehri = computeFastingProgress(sehri, sehri, iftar);
    expect(atSehri.phase).toBe('before_sehri');
    expect(atSehri.percent).toBe(0);

    // Quarter, midpoint, three-quarters
    const midpoint = new Date((sehri.getTime() + iftar.getTime()) / 2);
    const midProgress = computeFastingProgress(midpoint, sehri, iftar);
    expect(midProgress.phase).toBe('fasting');
    expect(midProgress.percent).toBe(50);
    expect(midProgress.percentTextBn).toBe('৫০%');

    const quarter = new Date(
      sehri.getTime() + (iftar.getTime() - sehri.getTime()) * 0.25
    );
    expect(computeFastingProgress(quarter, sehri, iftar).percent).toBe(25);

    const threeQuarter = new Date(
      sehri.getTime() + (iftar.getTime() - sehri.getTime()) * 0.75
    );
    expect(computeFastingProgress(threeQuarter, sehri, iftar).percent).toBe(75);

    // Exact Iftar boundary & after Iftar
    const atIftar = computeFastingProgress(iftar, sehri, iftar);
    expect(atIftar.phase).toBe('after_iftar');
    expect(atIftar.percent).toBe(100);
    expect(atIftar.percentTextBn).toBe('১০০%');

    const farAfter = computeFastingProgress(
      new Date('2026-02-19T16:00:00Z'),
      sehri,
      iftar
    );
    expect(farAfter.phase).toBe('after_iftar');
    expect(farAfter.percent).toBe(100);

    // Bounds check over range
    for (let offsetHours = -5; offsetHours <= 18; offsetHours++) {
      const sample = new Date(sehri.getTime() + offsetHours * 3600_000);
      const res = computeFastingProgress(sample, sehri, iftar);
      expect(res.percent).toBeGreaterThanOrEqual(0);
      expect(res.percent).toBeLessThanOrEqual(100);
    }
  });

  it('builds complete Hijri month schedule for 30-day Ramadan and 29-day Shaban', () => {
    // 2026-03-02 is Monday, 13 Ramadan 1447
    const ramadanRef = new Date(2026, 2, 2, 12, 0, 0);
    const ramadanSchedule = buildHijriMonthSchedule(ramadanRef, {
      location: DEFAULT_FASTING_LOCATION,
      method: 'karachi',
      timeFormat: '12h',
      hijriOffsetDays: 0,
      timeZone: 'Asia/Dhaka',
    });

    expect(ramadanSchedule.isRamadan).toBe(true);
    expect(ramadanSchedule.hijriMonth).toBe(9);
    expect(ramadanSchedule.hijriMonthNameBn).toBe('রমজান');
    expect(ramadanSchedule.days).toHaveLength(30);

    const todayRows = ramadanSchedule.days.filter((d) => d.isToday);
    expect(todayRows).toHaveLength(1);
    expect(todayRows[0].dateKey).toBe('2026-03-02');
    expect(todayRows[0].hijri.day).toBe(13);
    expect(todayRows[0].isWeeklySunnah).toBe(true);
    expect(todayRows[0].weeklySunnahType).toBe('monday');
    expect(todayRows[0].isMonthlySunnah).toBe(true);

    const monthlySunnahDays = ramadanSchedule.days.filter((d) => d.isMonthlySunnah);
    expect(monthlySunnahDays.map((d) => d.hijri.day)).toEqual([13, 14, 15]);

    const weeklySunnahDays = ramadanSchedule.days.filter((d) => d.isWeeklySunnah);
    expect(weeklySunnahDays.length).toBeGreaterThanOrEqual(8);
    expect(
      weeklySunnahDays.every(
        (d) => d.weekdayIndex === 1 || d.weekdayIndex === 4
      )
    ).toBe(true);

    for (let i = 0; i < ramadanSchedule.days.length; i++) {
      const day = ramadanSchedule.days[i];
      expect(day.hijri.day).toBe(i + 1);
      expect(day.sehri.getTime()).toBeLessThan(day.iftar.getTime());
      expect(day.sehriFormatted.length).toBeGreaterThan(0);
      expect(day.iftarFormatted.length).toBeGreaterThan(0);
    }

    // 29-day non-Ramadan month (Shaban 1447)
    const shabanRef = new Date(2026, 1, 10, 12, 0, 0);
    const shabanSchedule = buildHijriMonthSchedule(shabanRef, {
      location: DEFAULT_FASTING_LOCATION,
      method: 'karachi',
      timeFormat: '24h',
      hijriOffsetDays: 0,
      timeZone: 'Asia/Dhaka',
    });

    expect(shabanSchedule.isRamadan).toBe(false);
    expect(shabanSchedule.hijriMonth).toBe(8);
    expect(shabanSchedule.days).toHaveLength(29);
    expect(shabanSchedule.days.map((d) => d.hijri.day)).toEqual(
      Array.from({ length: 29 }, (_, idx) => idx + 1)
    );
  });

  it('resolves calendar dates, progress, and schedule in target location timeZone across midnight', () => {
    // 2026-03-02T00:30:00Z = 06:30 AM on March 2 in Dhaka (13 Ramadan 1447, Monday — active fasting)
    const dhakaMorningInstant = new Date('2026-03-02T00:30:00Z');
    const zonedDhaka = toZonedCalendarDate(dhakaMorningInstant, 'Asia/Dhaka');
    expect(zonedDhaka.getFullYear()).toBe(2026);
    expect(zonedDhaka.getMonth()).toBe(2);
    expect(zonedDhaka.getDate()).toBe(2);
    expect(zonedDhaka.getDay()).toBe(1);

    const dhakaTimes = computeDailyFastingTimes(
      dhakaMorningInstant,
      DEFAULT_FASTING_LOCATION,
      'karachi',
      '12h'
    );
    expect(dhakaTimes.sehri.getTime()).toBeLessThan(dhakaMorningInstant.getTime());
    expect(dhakaMorningInstant.getTime()).toBeLessThan(dhakaTimes.iftar.getTime());

    const dhakaProgress = computeFastingProgress(
      dhakaMorningInstant,
      dhakaTimes.sehri,
      dhakaTimes.iftar
    );
    expect(dhakaProgress.phase).toBe('fasting');
    expect(dhakaProgress.percent).toBeGreaterThan(0);
    expect(dhakaProgress.percent).toBeLessThan(100);

    const dhakaSchedule = buildHijriMonthSchedule(dhakaMorningInstant, {
      location: DEFAULT_FASTING_LOCATION,
      method: 'karachi',
      timeFormat: '12h',
    });
    const dhakaToday = dhakaSchedule.days.filter((d) => d.isToday);
    expect(dhakaToday).toHaveLength(1);
    expect(dhakaToday[0].dateKey).toBe('2026-03-02');
    expect(dhakaToday[0].hijri.day).toBe(13);
    expect(dhakaToday[0].isWeeklySunnah).toBe(true);
    expect(dhakaToday[0].isMonthlySunnah).toBe(true);

    // 2026-03-02T20:00:00Z = 20:00 on March 2 in London (after Iftar), though March 3 in Dhaka
    const londonLocation = PRESET_FASTING_LOCATIONS.find((l) => l.id === 'london')!;
    const londonEveningInstant = new Date('2026-03-02T20:00:00Z');
    const zonedLondon = toZonedCalendarDate(londonEveningInstant, 'Europe/London');
    expect(zonedLondon.getFullYear()).toBe(2026);
    expect(zonedLondon.getMonth()).toBe(2);
    expect(zonedLondon.getDate()).toBe(2);
    expect(zonedLondon.getDay()).toBe(1);

    const londonTimes = computeDailyFastingTimes(
      londonEveningInstant,
      londonLocation,
      'mwl',
      '24h'
    );
    expect(londonTimes.iftar.getUTCDate()).toBe(2);
    expect(londonTimes.iftar.getTime()).toBeLessThan(londonEveningInstant.getTime());

    const londonProgress = computeFastingProgress(
      londonEveningInstant,
      londonTimes.sehri,
      londonTimes.iftar
    );
    expect(londonProgress.phase).toBe('after_iftar');
    expect(londonProgress.percent).toBe(100);

    const londonSchedule = buildHijriMonthSchedule(londonEveningInstant, {
      location: londonLocation,
      method: 'mwl',
      timeFormat: '24h',
    });
    // After Maghrib on 2026-03-02 (13 Ramadan), the Hijri day has rolled over to 14 Ramadan (2026-03-03)
    const londonToday = londonSchedule.days.filter((d) => d.isToday);
    expect(londonToday).toHaveLength(1);
    expect(londonToday[0].dateKey).toBe('2026-03-03');
    expect(londonToday[0].hijri.day).toBe(14);
    expect(londonToday[0].isWeeklySunnah).toBe(false);
    expect(londonToday[0].isMonthlySunnah).toBe(true);

    // Fallback safety for invalid timeZone or invalid instant
    const fallbackZoned = toZonedCalendarDate(dhakaMorningInstant, 'Invalid/Timezone');
    expect(Number.isFinite(fallbackZoned.getTime())).toBe(true);
    expect(Number.isNaN(toZonedCalendarDate(new Date('invalid'), 'Asia/Dhaka').getTime())).toBe(
      true
    );
  });

  it('guards polar latitudes and Invalid Date inputs without RangeError or NaN%', () => {
    const tromso = {
      id: 'tromso',
      nameBn: 'ট্রমসো',
      latitude: 69.6492,
      longitude: 18.9553,
      timeZone: 'Europe/Oslo',
    };

    const summerSolstice = computeDailyFastingTimes(
      new Date('2026-06-21T12:00:00Z'),
      tromso,
      'mwl',
      '24h'
    );
    expect(Number.isFinite(summerSolstice.sehri.getTime())).toBe(true);
    expect(Number.isFinite(summerSolstice.iftar.getTime())).toBe(true);
    expect(summerSolstice.sehriFormatted).not.toContain('NaN');
    expect(summerSolstice.iftarFormatted).not.toContain('NaN');

    const winterSolstice = computeDailyFastingTimes(
      new Date('2026-12-21T12:00:00Z'),
      tromso,
      'mwl',
      '24h'
    );
    expect(Number.isFinite(winterSolstice.sehri.getTime())).toBe(true);
    expect(Number.isFinite(winterSolstice.iftar.getTime())).toBe(true);
    expect(winterSolstice.sehriFormatted).not.toContain('NaN');
    expect(winterSolstice.iftarFormatted).not.toContain('NaN');

    const invalidDate = new Date('invalid');
    expect(formatPrayerTimeBn(invalidDate, '12h', 'Asia/Dhaka')).toBe('--:--');
    expect(
      formatPrayerTimeBn(new Date('2026-03-02T06:00:00Z'), '24h', 'Invalid/Zone')
    ).toMatch(/^[০-৯]{2}:[০-৯]{2}$/);

    const validSehri = new Date('2026-03-01T23:05:00Z');
    const validIftar = new Date('2026-03-02T12:02:00Z');
    const badNowProgress = computeFastingProgress(invalidDate, validSehri, validIftar);
    expect(Number.isFinite(badNowProgress.percent)).toBe(true);
    expect(badNowProgress.percent).toBe(0);
    expect(badNowProgress.percentTextBn).toBe('০%');

    const badTimesProgress = computeFastingProgress(
      new Date('2026-03-02T06:00:00Z'),
      invalidDate,
      validIftar
    );
    expect(Number.isFinite(badTimesProgress.percent)).toBe(true);
    expect(badTimesProgress.percent).toBe(0);
    expect(badTimesProgress.percentTextBn).not.toContain('NaN');
  });

  it('ends the Hijri day at Maghrib and advances to the next Hijri day/month at sunset', () => {
    // 2026-02-17 in Dhaka is 29 Shaban 1447; 2026-02-18 is 1 Ramadan 1447
    const shaban29Times = computeDailyFastingTimes(
      new Date('2026-02-17T06:00:00Z'),
      DEFAULT_FASTING_LOCATION,
      'karachi',
      '12h',
      'Asia/Dhaka'
    );
    const oneMinBeforeMaghrib = new Date(shaban29Times.iftar.getTime() - 60_000);
    const atMaghrib = new Date(shaban29Times.iftar.getTime());

    // 1 minute before Maghrib: still 29 Shaban (not Ramadan yet)
    const beforeCtx = resolveActiveFastingContext(
      oneMinBeforeMaghrib,
      DEFAULT_FASTING_LOCATION,
      'karachi',
      '12h',
      0,
      'Asia/Dhaka'
    );
    expect(beforeCtx.isAfterMaghrib).toBe(false);
    expect(beforeCtx.hijri.month).toBe(8);
    expect(beforeCtx.hijri.day).toBe(29);
    expect(beforeCtx.hijri.isRamadan).toBe(false);
    expect(beforeCtx.progress.phase).toBe('fasting');

    const beforeSchedule = buildHijriMonthSchedule(oneMinBeforeMaghrib, {
      location: DEFAULT_FASTING_LOCATION,
      method: 'karachi',
      timeZone: 'Asia/Dhaka',
    });
    expect(beforeSchedule.hijriMonth).toBe(8);
    expect(beforeSchedule.isRamadan).toBe(false);
    expect(beforeSchedule.days.find((d) => d.isToday)?.hijri.day).toBe(29);

    // At exact Maghrib: 29 Shaban ended -> 1 Ramadan begins immediately!
    const atMaghribCtx = resolveActiveFastingContext(
      atMaghrib,
      DEFAULT_FASTING_LOCATION,
      'karachi',
      '12h',
      0,
      'Asia/Dhaka'
    );
    expect(atMaghribCtx.isAfterMaghrib).toBe(true);
    expect(atMaghribCtx.hijri.month).toBe(9);
    expect(atMaghribCtx.hijri.day).toBe(1);
    expect(atMaghribCtx.hijri.isRamadan).toBe(true);
    expect(atMaghribCtx.progress.phase).toBe('before_sehri');
    expect(atMaghribCtx.progress.percent).toBe(0);

    const afterSchedule = buildHijriMonthSchedule(atMaghrib, {
      location: DEFAULT_FASTING_LOCATION,
      method: 'karachi',
      timeZone: 'Asia/Dhaka',
    });
    expect(afterSchedule.hijriMonth).toBe(9);
    expect(afterSchedule.isRamadan).toBe(true);
    expect(afterSchedule.days.find((d) => d.isToday)?.hijri.day).toBe(1);

    // 2026-03-19 is 30 Ramadan 1447; after Maghrib it rolls over to 1 Shawwal 1447
    const ramadan30Times = computeDailyFastingTimes(
      new Date('2026-03-19T06:00:00Z'),
      DEFAULT_FASTING_LOCATION,
      'karachi',
      '12h',
      'Asia/Dhaka'
    );
    const afterRamadanMaghrib = new Date(ramadan30Times.iftar.getTime() + 60_000);
    const { isAfterMaghrib } = resolveIslamicCalendarDate(
      afterRamadanMaghrib,
      DEFAULT_FASTING_LOCATION,
      'karachi',
      'Asia/Dhaka'
    );
    expect(isAfterMaghrib).toBe(true);
    const shawwalCtx = resolveActiveFastingContext(
      afterRamadanMaghrib,
      DEFAULT_FASTING_LOCATION,
      'karachi',
      '12h',
      0,
      'Asia/Dhaka'
    );
    expect(shawwalCtx.hijri.month).toBe(10);
    expect(shawwalCtx.hijri.day).toBe(1);
    expect(shawwalCtx.hijri.isRamadan).toBe(false);
  });

  it('resolves location-aware Hijri defaults, legacy migration, and manual overrides', () => {
    const dhaka = DEFAULT_FASTING_LOCATION;
    const chattogram = PRESET_FASTING_LOCATIONS.find((l) => l.id === 'chattogram')!;
    const makkah = PRESET_FASTING_LOCATIONS.find((l) => l.id === 'makkah')!;
    const madinah = PRESET_FASTING_LOCATIONS.find((l) => l.id === 'madinah')!;
    const london = PRESET_FASTING_LOCATIONS.find((l) => l.id === 'london')!;

    // Regional defaults
    expect(getDefaultHijriOffsetDays(dhaka)).toBe(-1);
    expect(getDefaultHijriOffsetDays(chattogram)).toBe(-1);
    expect(getDefaultHijriOffsetDays(makkah)).toBe(0);
    expect(getDefaultHijriOffsetDays(madinah)).toBe(0);
    expect(getDefaultHijriOffsetDays(london)).toBe(0);

    // Custom GPS coordinates without timeZone
    expect(
      getDefaultHijriOffsetDays({
        id: 'custom',
        nameBn: 'বর্তমান অবস্থান',
        latitude: 23.8103,
        longitude: 90.4125,
      })
    ).toBe(-1);
    expect(
      getDefaultHijriOffsetDays({
        id: 'custom',
        nameBn: 'বর্তমান অবস্থান',
        latitude: 21.3891,
        longitude: 39.8579,
      })
    ).toBe(0);

    // Legacy migration: untouched default (0 / undefined) migrates to regional auto
    expect(resolveHijriOffsetSettings(dhaka, 0, undefined)).toEqual({
      hijriOffsetMode: 'auto',
      hijriOffsetDays: -1,
    });
    expect(resolveHijriOffsetSettings(makkah, 0, undefined)).toEqual({
      hijriOffsetMode: 'auto',
      hijriOffsetDays: 0,
    });

    // Legacy non-zero manual offset is preserved as manual
    expect(resolveHijriOffsetSettings(dhaka, 1, undefined)).toEqual({
      hijriOffsetMode: 'manual',
      hijriOffsetDays: 1,
    });
    expect(resolveHijriOffsetSettings(makkah, -1, undefined)).toEqual({
      hijriOffsetMode: 'manual',
      hijriOffsetDays: -1,
    });

    // Explicit manual 0 in Dhaka is respected (never overwritten back to -1)
    expect(resolveHijriOffsetSettings(dhaka, 0, 'manual')).toEqual({
      hijriOffsetMode: 'manual',
      hijriOffsetDays: 0,
    });

    // Auto mode dynamically tracks location changes (Dhaka <-> Makkah)
    expect(resolveHijriOffsetSettings(dhaka, 0, 'auto')).toEqual({
      hijriOffsetMode: 'auto',
      hijriOffsetDays: -1,
    });
    expect(resolveHijriOffsetSettings(makkah, -1, 'auto')).toEqual({
      hijriOffsetMode: 'auto',
      hijriOffsetDays: 0,
    });

    // Concrete Bangladesh date verification: 2026-11-23 in Dhaka
    const dhakaOffset = resolveHijriOffsetSettings(dhaka, undefined, 'auto').hijriOffsetDays;
    const beforeMaghrib = new Date('2026-11-23T12:00:00+06:00');
    const afterMaghrib = new Date('2026-11-23T22:14:00+06:00');

    const dayCtx = resolveActiveFastingContext(
      beforeMaghrib,
      dhaka,
      'karachi',
      '12h',
      dhakaOffset,
      'Asia/Dhaka'
    );
    expect(dayCtx.isAfterMaghrib).toBe(false);
    expect(dayCtx.hijri.year).toBe(1448);
    expect(dayCtx.hijri.month).toBe(6);
    expect(dayCtx.hijri.day).toBe(12);

    const nightCtx = resolveActiveFastingContext(
      afterMaghrib,
      dhaka,
      'karachi',
      '12h',
      dhakaOffset,
      'Asia/Dhaka'
    );
    expect(nightCtx.isAfterMaghrib).toBe(true);
    expect(nightCtx.hijri.year).toBe(1448);
    expect(nightCtx.hijri.month).toBe(6);
    expect(nightCtx.hijri.day).toBe(13);
  });
});
