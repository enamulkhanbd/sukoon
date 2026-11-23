import { useSyncExternalStore } from 'react';
import {
  getHijriCalendarRegion,
  type FastingLocation,
  type HijriCalendarRegion,
  type HijriOffsetMode,
} from '../utils/fasting';
import {
  clampHijriOffsetDays,
  parseIsoDateToDayNumber,
  type HijriMonthAnchor,
} from '../utils/hijri';

export interface HijriRegionCalendarConfig {
  defaultOffsetDays?: number;
  months: HijriMonthAnchor[];
}

export interface HijriCalendarConfig {
  version: 1;
  updatedAt: string;
  regions: Partial<Record<HijriCalendarRegion, HijriRegionCalendarConfig>>;
}

export const HIJRI_CALENDAR_STORAGE_KEY = 'sukoon_hijri_calendar_v1';
export const HIJRI_CALENDAR_FETCHED_AT_KEY = 'sukoon_hijri_calendar_fetched_at';
const SYNC_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const VALID_REGIONS = new Set<HijriCalendarRegion>(['bd', 'sa', 'default']);

const DEFAULT_HIJRI_CALENDAR_URL = '/hijri-calendar.json';

/**
 * Normalizes a configured calendar URL.
 * For GitHub Gist raw URLs, strips any pinned 40-char commit SHA after `/raw/`
 * so editing the Gist always serves the latest revision without redeploying.
 */
export function normalizeHijriCalendarUrl(rawUrl?: string): string {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (trimmed.length === 0) return DEFAULT_HIJRI_CALENDAR_URL;
  return trimmed.replace(
    /^(https:\/\/gist\.githubusercontent\.com\/[^/]+\/[^/]+\/raw)\/[0-9a-f]{40}(\/.+)$/i,
    '$1$2'
  );
}

function getHijriCalendarUrl(): string {
  const configured =
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env?.VITE_HIJRI_CALENDAR_URL === 'string'
      ? import.meta.env.VITE_HIJRI_CALENDAR_URL
      : '';
  return normalizeHijriCalendarUrl(configured);
}

function withCacheBuster(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_t=${Date.now()}`;
}

/**
 * Validates and normalizes a raw JSON payload into a safe HijriCalendarConfig.
 * Returns null if the payload is malformed so valid cached data is never overwritten.
 */
export function parseHijriCalendarConfig(
  raw: unknown
): HijriCalendarConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;
  if (!obj.regions || typeof obj.regions !== 'object') return null;

  const updatedAt =
    typeof obj.updatedAt === 'string' && obj.updatedAt.trim().length > 0
      ? obj.updatedAt.trim()
      : '';

  const regionsInput = obj.regions as Record<string, unknown>;
  const regions: Partial<Record<HijriCalendarRegion, HijriRegionCalendarConfig>> =
    {};

  for (const [key, value] of Object.entries(regionsInput)) {
    if (!VALID_REGIONS.has(key as HijriCalendarRegion)) continue;
    if (!value || typeof value !== 'object') continue;
    const regionObj = value as Record<string, unknown>;
    if (!Array.isArray(regionObj.months)) continue;

    const deduped = new Map<string, HijriMonthAnchor & { _dayNum: number }>();
    for (const item of regionObj.months) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const year = entry.year;
      const month = entry.month;
      const startDate = entry.startDate;
      if (
        typeof year !== 'number' ||
        !Number.isInteger(year) ||
        year < 1300 ||
        year > 1700 ||
        typeof month !== 'number' ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12 ||
        typeof startDate !== 'string'
      ) {
        continue;
      }
      const dayNum = parseIsoDateToDayNumber(startDate);
      if (dayNum === null) continue;
      deduped.set(`${year}-${month}`, {
        year,
        month,
        startDate: startDate.trim(),
        _dayNum: dayNum,
      });
    }

    const sortedMonths: HijriMonthAnchor[] = Array.from(deduped.values())
      .sort((a, b) => a._dayNum - b._dayNum)
      .map(({ year, month, startDate }) => ({ year, month, startDate }));

    const defaultOffsetDays =
      typeof regionObj.defaultOffsetDays === 'number' &&
      Number.isFinite(regionObj.defaultOffsetDays)
        ? clampHijriOffsetDays(regionObj.defaultOffsetDays)
        : undefined;

    regions[key as HijriCalendarRegion] = {
      ...(defaultOffsetDays !== undefined ? { defaultOffsetDays } : {}),
      months: sortedMonths,
    };
  }

  return {
    version: 1,
    updatedAt,
    regions,
  };
}

function readCachedConfig(): HijriCalendarConfig | null {
  try {
    if (
      typeof window === 'undefined' ||
      typeof window.localStorage === 'undefined'
    ) {
      return null;
    }
    const raw = window.localStorage.getItem(HIJRI_CALENDAR_STORAGE_KEY);
    if (!raw) return null;
    return parseHijriCalendarConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeCachedConfig(config: HijriCalendarConfig): void {
  try {
    if (
      typeof window === 'undefined' ||
      typeof window.localStorage === 'undefined'
    ) {
      return;
    }
    window.localStorage.setItem(
      HIJRI_CALENDAR_STORAGE_KEY,
      JSON.stringify(config)
    );
    window.localStorage.setItem(
      HIJRI_CALENDAR_FETCHED_AT_KEY,
      String(Date.now())
    );
  } catch {
    // Ignore quota/storage errors
  }
}

function getLastFetchedAt(): number {
  try {
    if (
      typeof window === 'undefined' ||
      typeof window.localStorage === 'undefined'
    ) {
      return 0;
    }
    const raw = window.localStorage.getItem(HIJRI_CALENDAR_FETCHED_AT_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

let currentConfig: HijriCalendarConfig | null = readCachedConfig();
let inFlightSync: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

function emit(next: HijriCalendarConfig | null) {
  currentConfig = next;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeHijriCalendarConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHijriCalendarConfigSnapshot(): HijriCalendarConfig | null {
  return currentConfig;
}

export function useHijriCalendarConfig(): HijriCalendarConfig | null {
  return useSyncExternalStore(
    subscribeHijriCalendarConfig,
    getHijriCalendarConfigSnapshot
  );
}

/**
 * Returns active confirmed Hijri month anchors for the user's region in auto mode,
 * or undefined when manual offset mode is selected (so manual overrides always win).
 */
export function getActiveAnchorsForSettings(
  config: HijriCalendarConfig | null | undefined,
  location: FastingLocation | undefined,
  hijriOffsetMode: HijriOffsetMode
): readonly HijriMonthAnchor[] | undefined {
  if (hijriOffsetMode === 'manual' || !config) {
    return undefined;
  }
  const region = getHijriCalendarRegion(location);
  const months = config.regions[region]?.months;
  return months && months.length > 0 ? months : undefined;
}

/**
 * Fetches the remote/static Hijri calendar JSON and caches it locally.
 * Returns true if a valid config was fetched and stored, false otherwise.
 */
export async function syncHijriCalendarConfig(options?: {
  force?: boolean;
}): Promise<boolean> {
  const force = options?.force === true;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  if (!force && currentConfig !== null) {
    const elapsed = Date.now() - getLastFetchedAt();
    if (elapsed >= 0 && elapsed < SYNC_COOLDOWN_MS) {
      return false;
    }
  }

  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = (async () => {
    try {
      if (typeof fetch !== 'function') return false;
      const primaryUrl = getHijriCalendarUrl();
      const candidateUrls =
        primaryUrl !== DEFAULT_HIJRI_CALENDAR_URL
          ? [primaryUrl, DEFAULT_HIJRI_CALENDAR_URL]
          : [DEFAULT_HIJRI_CALENDAR_URL];

      for (const baseUrl of candidateUrls) {
        try {
          const requestUrl = force ? withCacheBuster(baseUrl) : baseUrl;
          const response = await fetch(requestUrl, {
            cache: 'no-cache',
          });
          if (!response.ok) continue;
          const json: unknown = await response.json();
          const parsed = parseHijriCalendarConfig(json);
          if (!parsed) continue;

          const prevSerialized = currentConfig
            ? JSON.stringify(currentConfig)
            : '';
          const nextSerialized = JSON.stringify(parsed);
          writeCachedConfig(parsed);
          if (prevSerialized !== nextSerialized) {
            emit(parsed);
          }
          return true;
        } catch {
          // Try next fallback URL
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      inFlightSync = null;
    }
  })();

  return inFlightSync;
}
