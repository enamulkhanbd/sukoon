import {
  collection,
  doc,
  getCountFromServer,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { ThemeMode } from '../db/database';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';

export type TelemetryPlatform = 'ios' | 'android' | 'desktop';

export interface UserTelemetrySummary {
  totalUsers: number;
  activeToday: number;
  activeLast7Days: number;
  pwaInstalls: number;
  platforms: {
    android: number;
    ios: number;
    desktop: number;
  };
  fetchedAt: number;
}

const INSTALL_ID_KEY = 'sukoon-install-id';
const TELEMETRY_DAY_KEY = 'sukoon-telemetry-day';
const TELEMETRY_REGISTERED_KEY = 'sukoon-telemetry-registered';
const APP_VERSION = '1.0.0';
const APP_USERS_COLLECTION = 'appUsers';

/** Formats a Date into local YYYY-MM-DD for daily active user buckets. */
export function formatLocalDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns the YYYY-MM-DD key N days prior to `date` (e.g. daysBack=6 gives a 7-day inclusive window). */
export function formatPastDayKey(daysBack: number, date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysBack);
  return formatLocalDayKey(d);
}

/** Detects broad non-PII platform category from userAgent string. */
export function detectTelemetryPlatform(
  userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): TelemetryPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

/** Detects whether the app is running as an installed standalone PWA. */
export function detectIsStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaMatch =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches);
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(mediaMatch || iosStandalone);
}

/** Generates a random non-PII install ID matching ^[a-zA-Z0-9_-]{16,64}$. */
export function generateInstallId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const partA = Date.now().toString(36);
  const partB = Math.random().toString(36).slice(2, 12);
  const partC = Math.random().toString(36).slice(2, 12);
  return `skn-${partA}-${partB}-${partC}`.slice(0, 40);
}

function getOrCreateInstallId(): string | null {
  try {
    const existing = window.localStorage.getItem(INSTALL_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{16,64}$/.test(existing)) {
      return existing;
    }
    const created = generateInstallId();
    window.localStorage.setItem(INSTALL_ID_KEY, created);
    return created;
  } catch {
    return null;
  }
}

export function shouldSendHeartbeatForDay(
  lastRecordedDay: string | null,
  todayKey: string
): boolean {
  return lastRecordedDay !== todayKey;
}

/**
 * Records a silent, anonymous, non-PII daily heartbeat to `/appUsers/{installId}`.
 * Throttled to at most once per local calendar day per device. Never throws.
 */
export async function recordDailyUserHeartbeat(theme: ThemeMode = 'paper'): Promise<void> {
  if (!isFirebaseConfigured()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const todayKey = formatLocalDayKey();
  try {
    const lastDay = window.localStorage.getItem(TELEMETRY_DAY_KEY);
    if (!shouldSendHeartbeatForDay(lastDay, todayKey)) return;
  } catch {
    return;
  }

  const installId = getOrCreateInstallId();
  if (!installId) return;

  const db = getFirestoreDb();
  if (!db) return;

  const safeTheme: ThemeMode =
    theme === 'olive' || theme === 'sky' ? theme : 'paper';
  const mutablePayload = {
    lastSeenAt: serverTimestamp(),
    lastActiveDay: todayKey,
    platform: detectTelemetryPlatform(),
    isPwa: detectIsStandalonePwa(),
    theme: safeTheme,
    appVersion: APP_VERSION,
  };

  const ref = doc(db, APP_USERS_COLLECTION, installId);
  let alreadyRegistered = false;
  try {
    alreadyRegistered = window.localStorage.getItem(TELEMETRY_REGISTERED_KEY) === '1';
  } catch {
    alreadyRegistered = false;
  }

  const createPayload = {
    installId,
    firstSeenAt: serverTimestamp(),
    ...mutablePayload,
  };

  try {
    if (alreadyRegistered) {
      try {
        await updateDoc(ref, mutablePayload);
      } catch (err: unknown) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        if (code === 'not-found') {
          await setDoc(ref, createPayload);
        } else {
          throw err;
        }
      }
    } else {
      try {
        await setDoc(ref, createPayload);
      } catch (err: unknown) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        if (code === 'permission-denied') {
          // Document may already exist with an immutable firstSeenAt; try update
          await updateDoc(ref, mutablePayload);
        } else {
          throw err;
        }
      }
    }

    try {
      window.localStorage.setItem(TELEMETRY_REGISTERED_KEY, '1');
      window.localStorage.setItem(TELEMETRY_DAY_KEY, todayKey);
    } catch {
      // Ignore storage write failure
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[UserTelemetry] Heartbeat skipped:', err);
    }
  }
}

/**
 * Admin-only aggregation reader using Firestore `getCountFromServer()`.
 * Uses automatic single-field indexes and costs only 1 read per 1,000 matched docs.
 */
export async function fetchUserTelemetrySummary(): Promise<UserTelemetrySummary> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase is not configured.');
  }

  const colRef = collection(db, APP_USERS_COLLECTION);
  const todayKey = formatLocalDayKey();
  const sevenDaysAgoKey = formatPastDayKey(6);

  const [
    totalSnap,
    todaySnap,
    last7Snap,
    pwaSnap,
    androidSnap,
    iosSnap,
    desktopSnap,
  ] = await Promise.all([
    getCountFromServer(colRef),
    getCountFromServer(query(colRef, where('lastActiveDay', '==', todayKey))),
    getCountFromServer(query(colRef, where('lastActiveDay', '>=', sevenDaysAgoKey))),
    getCountFromServer(query(colRef, where('isPwa', '==', true))),
    getCountFromServer(query(colRef, where('platform', '==', 'android'))),
    getCountFromServer(query(colRef, where('platform', '==', 'ios'))),
    getCountFromServer(query(colRef, where('platform', '==', 'desktop'))),
  ]);

  return {
    totalUsers: totalSnap.data().count,
    activeToday: todaySnap.data().count,
    activeLast7Days: last7Snap.data().count,
    pwaInstalls: pwaSnap.data().count,
    platforms: {
      android: androidSnap.data().count,
      ios: iosSnap.data().count,
      desktop: desktopSnap.data().count,
    },
    fetchedAt: Date.now(),
  };
}
