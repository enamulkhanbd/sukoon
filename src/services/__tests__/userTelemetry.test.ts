import { describe, expect, it } from 'vitest';
import {
  detectTelemetryPlatform,
  formatLocalDayKey,
  formatPastDayKey,
  generateInstallId,
  shouldSendHeartbeatForDay,
} from '../userTelemetry';

describe('userTelemetry helpers', () => {
  it('formats local date keys as YYYY-MM-DD', () => {
    const sample = new Date(2026, 2, 5); // March 5, 2026
    expect(formatLocalDayKey(sample)).toBe('2026-03-05');
    expect(formatPastDayKey(6, sample)).toBe('2026-02-27');
  });

  it('throttles heartbeats to once per local calendar day', () => {
    expect(shouldSendHeartbeatForDay(null, '2026-11-24')).toBe(true);
    expect(shouldSendHeartbeatForDay('2026-11-23', '2026-11-24')).toBe(true);
    expect(shouldSendHeartbeatForDay('2026-11-24', '2026-11-24')).toBe(false);
  });

  it('detects platform categories from user agent strings', () => {
    expect(
      detectTelemetryPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
      )
    ).toBe('ios');
    expect(
      detectTelemetryPlatform(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'
      )
    ).toBe('android');
    expect(
      detectTelemetryPlatform(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0'
      )
    ).toBe('desktop');
  });

  it('generates valid install IDs conforming to Firestore rule regex', () => {
    const id = generateInstallId();
    expect(id).toMatch(/^[a-zA-Z0-9_-]{16,64}$/);
  });
});
