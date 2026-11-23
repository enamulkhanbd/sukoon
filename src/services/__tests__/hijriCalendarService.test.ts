import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FASTING_LOCATION,
  PRESET_FASTING_LOCATIONS,
} from '../../utils/fasting';
import {
  getActiveAnchorsForSettings,
  normalizeHijriCalendarUrl,
  parseHijriCalendarConfig,
} from '../hijriCalendarService';

describe('hijriCalendarService', () => {
  it('validates, deduplicates, and sorts Hijri calendar JSON payloads', () => {
    const parsed = parseHijriCalendarConfig({
      version: 1,
      updatedAt: '2026-11-23',
      regions: {
        bd: {
          defaultOffsetDays: -1,
          months: [
            { year: 1448, month: 10, startDate: '2027-03-10' },
            { year: 1448, month: 9, startDate: '2027-02-07' },
            // Duplicate month should keep latest entry
            { year: 1448, month: 9, startDate: '2027-02-08' },
            // Malformed entries should be safely ignored
            { year: 1448, month: 13, startDate: '2027-05-01' },
            { year: 1448, month: 7, startDate: '2027-02-30' },
            { year: 1448, month: 8, startDate: 'not-a-date' },
          ],
        },
        sa: {
          defaultOffsetDays: 0,
          months: [{ year: 1448, month: 9, startDate: '2027-02-07' }],
        },
        unknownRegion: {
          months: [{ year: 1448, month: 9, startDate: '2027-02-08' }],
        },
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.regions.bd?.months).toEqual([
      { year: 1448, month: 9, startDate: '2027-02-08' },
      { year: 1448, month: 10, startDate: '2027-03-10' },
    ]);
    expect(parsed?.regions.sa?.months).toEqual([
      { year: 1448, month: 9, startDate: '2027-02-07' },
    ]);
    expect(
      (parsed?.regions as Record<string, unknown>)?.unknownRegion
    ).toBeUndefined();

    // Invalid top-level payloads return null
    expect(parseHijriCalendarConfig(null)).toBeNull();
    expect(parseHijriCalendarConfig({ version: 2, regions: {} })).toBeNull();
    expect(parseHijriCalendarConfig({ version: 1 })).toBeNull();
  });

  it('returns regional anchors only in auto mode and respects manual overrides', () => {
    const config = parseHijriCalendarConfig({
      version: 1,
      updatedAt: '2026-11-23',
      regions: {
        bd: {
          defaultOffsetDays: -1,
          months: [{ year: 1448, month: 6, startDate: '2026-11-12' }],
        },
        sa: {
          defaultOffsetDays: 0,
          months: [{ year: 1448, month: 6, startDate: '2026-11-11' }],
        },
      },
    });

    const dhaka = DEFAULT_FASTING_LOCATION;
    const makkah = PRESET_FASTING_LOCATIONS.find((l) => l.id === 'makkah')!;
    const london = PRESET_FASTING_LOCATIONS.find((l) => l.id === 'london')!;

    expect(getActiveAnchorsForSettings(config, dhaka, 'auto')).toEqual([
      { year: 1448, month: 6, startDate: '2026-11-12' },
    ]);
    expect(getActiveAnchorsForSettings(config, makkah, 'auto')).toEqual([
      { year: 1448, month: 6, startDate: '2026-11-11' },
    ]);
    expect(getActiveAnchorsForSettings(config, london, 'auto')).toBeUndefined();

    // Manual mode always disables remote anchors so manual offset wins
    expect(
      getActiveAnchorsForSettings(config, dhaka, 'manual')
    ).toBeUndefined();
    expect(getActiveAnchorsForSettings(null, dhaka, 'auto')).toBeUndefined();
  });

  it('normalizes GitHub Gist raw URLs by stripping pinned commit hashes', () => {
    expect(normalizeHijriCalendarUrl('')).toBe('/hijri-calendar.json');
    expect(normalizeHijriCalendarUrl(undefined)).toBe('/hijri-calendar.json');

    const pinnedGistUrl =
      'https://gist.githubusercontent.com/enamulkhanbd/1234567890abcdef/raw/0123456789abcdef0123456789abcdef01234567/hijri-calendar.json';
    expect(normalizeHijriCalendarUrl(pinnedGistUrl)).toBe(
      'https://gist.githubusercontent.com/enamulkhanbd/1234567890abcdef/raw/hijri-calendar.json'
    );

    const unpinnedGistUrl =
      'https://gist.githubusercontent.com/enamulkhanbd/1234567890abcdef/raw/hijri-calendar.json';
    expect(normalizeHijriCalendarUrl(unpinnedGistUrl)).toBe(unpinnedGistUrl);

    const customUrl = 'https://cdn.example.com/hijri-calendar.json';
    expect(normalizeHijriCalendarUrl(customUrl)).toBe(customUrl);
  });
});
