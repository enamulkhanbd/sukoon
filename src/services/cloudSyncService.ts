import { useSyncExternalStore } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_SETTINGS,
  db,
  getTodayDateKey,
  normalizeHistoryRecord,
  runWithoutPersonalSyncHooks,
  subscribePersonalDataChanges,
  type GlobalLastRead,
  type RoutineProgress,
} from '../db/database';
import { hydrateCustomDuasFromDb } from './customDuas';
import {
  isCustomDuaId,
  normalizeStoredCustomDua,
  type CustomDua,
} from './customDuaSnapshot';
import {
  buildSafeLocalSettings,
  determineSignInSyncDecision,
  hasMeaningfulLocalPersonalData,
  mergeCustomDuas,
  mergeGlobalLastRead,
  mergeReadingHistory,
  mergeRoutineProgress,
  mergeRoutines,
  mergeSettings,
  stripUndefinedDeep,
  toCloudSettingsPayload,
  type CloudCustomDuaDoc,
  type CloudHistoryDoc,
  type CloudRootDoc,
  type CloudRoutineDoc,
} from './cloudSyncMerge';
import {
  getFirestoreDb,
  isFirebaseConfigured,
  loadFirebaseAuth,
} from './firebase';

const SYNC_META_STORAGE_KEY = 'sukoon-cloud-sync-meta-v1';
const AUTH_HINT_STORAGE_KEY = 'sukoon-cloud-auth-hint';
const REDIRECT_PENDING_KEY = 'sukoon-cloud-redirect-pending';
const AUTO_SYNC_DEBOUNCE_MS = 2200;
const VISIBILITY_PULL_COOLDOWN_MS = 120_000;
const FIRESTORE_BATCH_LIMIT = 400;

export interface CloudAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface PendingAccountConflict {
  previousUid: string;
  previousEmail: string | null;
  newUid: string;
  newEmail: string | null;
  newDisplayName: string | null;
}

export interface CloudSyncState {
  configured: boolean;
  authReady: boolean;
  signingIn: boolean;
  syncing: boolean;
  user: CloudAuthUser | null;
  lastSyncedAt: number | null;
  lastSyncedEmail: string | null;
  error: string | null;
  pendingAccountConflict: PendingAccountConflict | null;
}

interface StoredSyncMeta {
  lastSyncedUid: string | null;
  lastSyncedEmail: string | null;
  lastSyncedAt: number | null;
  deletedCustomDuas: Record<string, number>;
  deletedRoutines: Record<string, number>;
}

function loadSyncMeta(): StoredSyncMeta {
  try {
    const raw = window.localStorage.getItem(SYNC_META_STORAGE_KEY);
    if (!raw) {
      return {
        lastSyncedUid: null,
        lastSyncedEmail: null,
        lastSyncedAt: null,
        deletedCustomDuas: {},
        deletedRoutines: {},
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredSyncMeta>;
    return {
      lastSyncedUid:
        typeof parsed.lastSyncedUid === 'string' ? parsed.lastSyncedUid : null,
      lastSyncedEmail:
        typeof parsed.lastSyncedEmail === 'string'
          ? parsed.lastSyncedEmail
          : null,
      lastSyncedAt:
        typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
      deletedCustomDuas:
        parsed.deletedCustomDuas && typeof parsed.deletedCustomDuas === 'object'
          ? parsed.deletedCustomDuas
          : {},
      deletedRoutines:
        parsed.deletedRoutines && typeof parsed.deletedRoutines === 'object'
          ? parsed.deletedRoutines
          : {},
    };
  } catch {
    return {
      lastSyncedUid: null,
      lastSyncedEmail: null,
      lastSyncedAt: null,
      deletedCustomDuas: {},
      deletedRoutines: {},
    };
  }
}

function saveSyncMeta(meta: StoredSyncMeta): void {
  try {
    window.localStorage.setItem(SYNC_META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage quota / private browsing errors
  }
}

let syncMeta: StoredSyncMeta =
  typeof window !== 'undefined'
    ? loadSyncMeta()
    : {
        lastSyncedUid: null,
        lastSyncedEmail: null,
        lastSyncedAt: null,
        deletedCustomDuas: {},
        deletedRoutines: {},
      };

let state: CloudSyncState = {
  configured: isFirebaseConfigured(),
  authReady: !isFirebaseConfigured(),
  signingIn: false,
  syncing: false,
  user: null,
  lastSyncedAt: syncMeta.lastSyncedAt,
  lastSyncedEmail: syncMeta.lastSyncedEmail,
  error: null,
  pendingAccountConflict: null,
};

const listeners = new Set<() => void>();

function updateState(patch: Partial<CloudSyncState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeCloudSyncState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCloudSyncState(): CloudSyncState {
  return state;
}

export function useCloudSyncState(): CloudSyncState {
  return useSyncExternalStore(subscribeCloudSyncState, getCloudSyncState);
}

let authInitPromise: Promise<void> | null = null;
let authUnsubscribe: (() => void) | null = null;
let personalHooksAttached = false;
let autoSyncTimer: number | null = null;
let syncInFlight = false;
let queuedSyncAfterFlight = false;

// Track live mutations made while actively synced with the current account
const dirtyHistoryDatesWhileSynced = new Set<string>();
let dirtySettingsListsWhileSynced = false;

function clearAutoSyncTimer(): void {
  if (autoSyncTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
}

function scheduleDebouncedAutoSync(): void {
  if (typeof window === 'undefined') return;
  if (!state.user || state.pendingAccountConflict) return;
  clearAutoSyncTimer();
  autoSyncTimer = window.setTimeout(() => {
    autoSyncTimer = null;
    if (state.user && !state.pendingAccountConflict) {
      void performCloudSync('merge');
    }
  }, AUTO_SYNC_DEBOUNCE_MS);
}

function ensurePersonalMutationObserver(): void {
  if (personalHooksAttached) return;
  personalHooksAttached = true;

  subscribePersonalDataChanges((event) => {
    const now = Date.now();
    const isActivelySyncedUser =
      Boolean(state.user) &&
      !state.pendingAccountConflict &&
      syncMeta.lastSyncedUid === state.user?.uid;

    if (event.op === 'delete') {
      if (event.table === 'customDuas' && isCustomDuaId(event.key)) {
        syncMeta = {
          ...syncMeta,
          deletedCustomDuas: { ...syncMeta.deletedCustomDuas, [event.key]: now },
        };
        saveSyncMeta(syncMeta);
      } else if (event.table === 'routines' && event.key) {
        syncMeta = {
          ...syncMeta,
          deletedRoutines: { ...syncMeta.deletedRoutines, [event.key]: now },
        };
        saveSyncMeta(syncMeta);
      }
    } else if (event.op === 'write') {
      if (event.table === 'customDuas' && event.key in syncMeta.deletedCustomDuas) {
        const nextDel = { ...syncMeta.deletedCustomDuas };
        delete nextDel[event.key];
        syncMeta = { ...syncMeta, deletedCustomDuas: nextDel };
        saveSyncMeta(syncMeta);
      } else if (event.table === 'routines' && event.key in syncMeta.deletedRoutines) {
        const nextDel = { ...syncMeta.deletedRoutines };
        delete nextDel[event.key];
        syncMeta = { ...syncMeta, deletedRoutines: nextDel };
        saveSyncMeta(syncMeta);
      }

      if (isActivelySyncedUser) {
        if (event.table === 'readingHistory' && event.key) {
          dirtyHistoryDatesWhileSynced.add(event.key);
        } else if (event.table === 'settings') {
          dirtySettingsListsWhileSynced = true;
        }
      }
    }

    if (state.user && !state.pendingAccountConflict) {
      scheduleDebouncedAutoSync();
    }
  });
}

async function fetchCloudSnapshot(uid: string): Promise<{
  rootDoc: CloudRootDoc | null;
  customDuas: CloudCustomDuaDoc[];
  routines: CloudRoutineDoc[];
  readingHistory: CloudHistoryDoc[];
}> {
  const firestore = getFirestoreDb();
  if (!firestore) {
    throw new Error('ক্লাউড সংযোগ প্রস্তুত নয়।');
  }

  const rootRef = doc(firestore, 'userSync', uid);
  const customDuasCol = collection(firestore, 'userSync', uid, 'customDuas');
  const routinesCol = collection(firestore, 'userSync', uid, 'routines');
  const historyCol = collection(firestore, 'userSync', uid, 'readingHistory');

  const [rootSnap, customDuasSnap, routinesSnap, historySnap] =
    await Promise.all([
      getDoc(rootRef),
      getDocs(customDuasCol),
      getDocs(routinesCol),
      getDocs(historyCol),
    ]);

  const rootDoc = rootSnap.exists()
    ? (rootSnap.data() as CloudRootDoc)
    : null;

  const customDuas: CloudCustomDuaDoc[] = [];
  customDuasSnap.forEach((snap) => {
    const data = snap.data() as Partial<CloudCustomDuaDoc>;
    customDuas.push({
      ...data,
      id: typeof data.id === 'string' ? data.id : snap.id,
      updatedAtMs:
        typeof data.updatedAtMs === 'number' ? data.updatedAtMs : 0,
    });
  });

  const routines: CloudRoutineDoc[] = [];
  routinesSnap.forEach((snap) => {
    const data = snap.data() as Partial<CloudRoutineDoc>;
    routines.push({
      ...data,
      id: typeof data.id === 'string' ? data.id : snap.id,
      updatedAtMs:
        typeof data.updatedAtMs === 'number' ? data.updatedAtMs : 0,
    });
  });

  const readingHistory: CloudHistoryDoc[] = [];
  historySnap.forEach((snap) => {
    const data = snap.data() as Partial<CloudHistoryDoc>;
    const date = typeof data.date === 'string' ? data.date : snap.id;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      readingHistory.push({
        ...(normalizeHistoryRecord(date, data) as CloudHistoryDoc),
        updatedAtMs:
          typeof data.updatedAtMs === 'number' ? data.updatedAtMs : 0,
      });
    }
  });

  return { rootDoc, customDuas, routines, readingHistory };
}

type QueuedWriteOp = {
  pathSegments: [string, string, string, string];
  payload: Record<string, unknown>;
};

async function commitBatchedWrites(ops: QueuedWriteOp[]): Promise<void> {
  if (ops.length === 0) return;
  const firestore = getFirestoreDb();
  if (!firestore) return;

  for (let i = 0; i < ops.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = ops.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(firestore);
    for (const op of chunk) {
      const [c1, d1, c2, d2] = op.pathSegments;
      batch.set(doc(firestore, c1, d1, c2, d2), op.payload);
    }
    await batch.commit();
  }
}

function sanitizeRoutineProgressForCloud(
  progressList: readonly RoutineProgress[]
): RoutineProgress[] {
  return progressList.slice(0, 200).map((p) =>
    stripUndefinedDeep({
      routineId: String(p.routineId).slice(0, 120),
      dayKey:
        typeof p.dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dayKey)
          ? p.dayKey
          : getTodayDateKey(),
      lastReadSurah: Math.max(0, Math.min(114, Math.floor(p.lastReadSurah || 0))),
      lastReadAyah: Math.max(0, Math.min(286, Math.floor(p.lastReadAyah || 0))),
      lastReadDuaId:
        typeof p.lastReadDuaId === 'string' && p.lastReadDuaId
          ? p.lastReadDuaId.slice(0, 120)
          : undefined,
      lastReadItemIndex:
        typeof p.lastReadItemIndex === 'number' &&
        Number.isInteger(p.lastReadItemIndex) &&
        p.lastReadItemIndex >= 0 &&
        p.lastReadItemIndex <= 500
          ? p.lastReadItemIndex
          : undefined,
      lastItemCompleted:
        typeof p.lastItemCompleted === 'boolean'
          ? p.lastItemCompleted
          : undefined,
      completedItemIndexes: Array.isArray(p.completedItemIndexes)
        ? p.completedItemIndexes
            .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx <= 500)
            .slice(0, 500)
        : undefined,
      completedAyahsCount: Math.max(
        0,
        Math.min(100000, Math.floor(p.completedAyahsCount || 0))
      ),
      totalAyahsCount: Math.max(
        0,
        Math.min(100000, Math.floor(p.totalAyahsCount || 0))
      ),
      percentage: Math.max(0, Math.min(100, Math.round(p.percentage || 0))),
      lastUpdated: Math.max(0, Math.floor(p.lastUpdated || Date.now())),
    })
  );
}

async function performCloudSync(
  mode: 'merge' | 'replace-from-cloud'
): Promise<boolean> {
  const activeUser = state.user;
  if (!activeUser || !isFirebaseConfigured()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    updateState({ error: 'ইন্টারনেট সংযোগ নেই। অনলাইনে এলে স্বয়ংক্রিয়ভাবে সিংক হবে।' });
    return false;
  }

  if (syncInFlight) {
    queuedSyncAfterFlight = true;
    return false;
  }

  syncInFlight = true;
  updateState({ syncing: true, error: null });

  const preferDatesSnapshot = new Set(dirtyHistoryDatesWhileSynced);
  const preferListsSnapshot = dirtySettingsListsWhileSynced;

  try {
    const firestore = getFirestoreDb();
    if (!firestore) throw new Error('Firestore প্রস্তুত নয়।');

    const cloud = await fetchCloudSnapshot(activeUser.uid);
    const cachedSurahCount = await db.cachedSurahs.count();
    const localOfflineDownloaded = cachedSurahCount >= 114;
    const todayKey = getTodayDateKey();

    if (mode === 'replace-from-cloud') {
      // Clean switch to the new Gmail account's cloud data without mixing previous account's local data
      const nextCustomDuas = cloud.customDuas
        .filter((c) => !c.deleted)
        .map((c) => normalizeStoredCustomDua({ ...c, updatedAt: c.updatedAtMs }))
        .filter((d): d is CustomDua => d !== null)
        .sort((a, b) => a.createdAt - b.createdAt);

      const { mergedLocal: nextRoutines } = mergeRoutines([], cloud.routines, {});
      const routineIdSet = new Set(nextRoutines.map((r) => r.id));

      const nextProgress = mergeRoutineProgress(
        [],
        cloud.rootDoc?.routineProgress ?? [],
        routineIdSet,
        todayKey
      );
      const nextLastRead = mergeGlobalLastRead(
        [],
        cloud.rootDoc?.globalLastRead ?? []
      );
      const { mergedLocal: nextHistory } = mergeReadingHistory(
        [],
        cloud.readingHistory
      );
      const nextSettings = cloud.rootDoc?.settings
        ? buildSafeLocalSettings(
            { ...DEFAULT_SETTINGS, ...cloud.rootDoc.settings },
            localOfflineDownloaded
          )
        : buildSafeLocalSettings(DEFAULT_SETTINGS, localOfflineDownloaded);

      await runWithoutPersonalSyncHooks(async () => {
        await db.transaction(
          'rw',
          [
            db.customDuas,
            db.routines,
            db.routineProgress,
            db.globalLastRead,
            db.readingHistory,
            db.settings,
          ],
          async () => {
            await db.customDuas.clear();
            await db.routines.clear();
            await db.routineProgress.clear();
            await db.globalLastRead.clear();
            await db.readingHistory.clear();

            if (nextCustomDuas.length > 0) {
              await db.customDuas.bulkPut(nextCustomDuas);
            }
            if (nextRoutines.length > 0) {
              await db.routines.bulkPut(nextRoutines);
            }
            if (nextProgress.length > 0) {
              await db.routineProgress.bulkPut(nextProgress);
            }
            if (nextLastRead.length > 0) {
              await db.globalLastRead.bulkPut(nextLastRead);
            }
            if (nextHistory.length > 0) {
              await db.readingHistory.bulkPut(nextHistory);
            }
            await db.settings.put(nextSettings);
          }
        );
      });

      await hydrateCustomDuasFromDb();

      // Ensure root doc exists for brand-new account
      if (!cloud.rootDoc) {
        await setDoc(doc(firestore, 'userSync', activeUser.uid), {
          uid: activeUser.uid,
          schemaVersion: 1,
          settings: toCloudSettingsPayload(nextSettings),
          globalLastRead: [],
          routineProgress: [],
          updatedAt: serverTimestamp(),
        });
      }

      const syncedAt = Date.now();
      dirtyHistoryDatesWhileSynced.clear();
      dirtySettingsListsWhileSynced = false;
      syncMeta = {
        lastSyncedUid: activeUser.uid,
        lastSyncedEmail: activeUser.email,
        lastSyncedAt: syncedAt,
        deletedCustomDuas: {},
        deletedRoutines: {},
      };
      saveSyncMeta(syncMeta);
      updateState({
        syncing: false,
        lastSyncedAt: syncedAt,
        lastSyncedEmail: activeUser.email,
        pendingAccountConflict: null,
        error: null,
      });
      return true;
    }

    // Smart-Merge Mode
    const [
      localCustomDuas,
      localRoutines,
      localProgress,
      localLastRead,
      localHistory,
      localSettings,
    ] = await Promise.all([
      db.customDuas.toArray(),
      db.routines.toArray(),
      db.routineProgress.toArray(),
      db.globalLastRead.toArray(),
      db.readingHistory.toArray(),
      db.settings.get('app'),
    ]);

    const customMerge = mergeCustomDuas(
      localCustomDuas,
      cloud.customDuas,
      syncMeta.deletedCustomDuas
    );
    const routineMerge = mergeRoutines(
      localRoutines,
      cloud.routines,
      syncMeta.deletedRoutines
    );
    const validRoutineIds = new Set(routineMerge.mergedLocal.map((r) => r.id));

    const mergedProgress = mergeRoutineProgress(
      localProgress,
      cloud.rootDoc?.routineProgress ?? [],
      validRoutineIds,
      todayKey
    );
    const mergedLastRead: GlobalLastRead[] = mergeGlobalLastRead(
      localLastRead,
      cloud.rootDoc?.globalLastRead ?? []
    );
    const historyMerge = mergeReadingHistory(
      localHistory,
      cloud.readingHistory,
      { preferLocalForDates: preferDatesSnapshot }
    );
    const mergedSettings = mergeSettings({
      localSettings,
      cloudSettings: cloud.rootDoc?.settings,
      localOfflineDownloaded,
      preferLocalLists: preferListsSnapshot,
    });

    // Apply merged state locally without firing sync loop hooks
    await runWithoutPersonalSyncHooks(async () => {
      await db.transaction(
        'rw',
        [
          db.customDuas,
          db.routines,
          db.routineProgress,
          db.globalLastRead,
          db.readingHistory,
          db.settings,
        ],
        async () => {
          await db.customDuas.clear();
          if (customMerge.mergedLocal.length > 0) {
            await db.customDuas.bulkPut(customMerge.mergedLocal);
          }

          await db.routines.clear();
          if (routineMerge.mergedLocal.length > 0) {
            await db.routines.bulkPut(routineMerge.mergedLocal);
          }

          await db.routineProgress.clear();
          if (mergedProgress.length > 0) {
            await db.routineProgress.bulkPut(mergedProgress);
          }

          await db.globalLastRead.clear();
          if (mergedLastRead.length > 0) {
            await db.globalLastRead.bulkPut(mergedLastRead);
          }

          await db.readingHistory.clear();
          if (historyMerge.mergedLocal.length > 0) {
            await db.readingHistory.bulkPut(historyMerge.mergedLocal);
          }

          await db.settings.put(mergedSettings);
        }
      );
    });

    await hydrateCustomDuasFromDb();

    // 1. Write root `/userSync/{uid}` first so parent document always exists
    const rootPayload = stripUndefinedDeep({
      uid: activeUser.uid,
      schemaVersion: 1,
      settings: toCloudSettingsPayload(mergedSettings),
      globalLastRead: mergedLastRead.slice(0, 120),
      routineProgress: sanitizeRoutineProgressForCloud(mergedProgress),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(firestore, 'userSync', activeUser.uid), rootPayload);

    // 2. Queue subcollection delta writes
    const nowMs = Date.now();
    const writeOps: QueuedWriteOp[] = [];

    for (const d of customMerge.toUploadActive) {
      writeOps.push({
        pathSegments: ['userSync', activeUser.uid, 'customDuas', d.id],
        payload: stripUndefinedDeep({
          id: d.id,
          titleBangla: d.titleBangla.slice(0, 300),
          arabic: d.arabic.slice(0, 25000),
          translationBangla: d.translationBangla.slice(0, 25000),
          transliteration: d.transliteration
            ? d.transliteration.slice(0, 25000)
            : undefined,
          repeatCount: Math.max(1, Math.min(10000, Math.floor(d.repeatCount || 1))),
          reference: d.reference ? d.reference.slice(0, 500) : undefined,
          createdAt: Math.max(1, Math.floor(d.createdAt || nowMs)),
          updatedAtMs: Math.max(1, Math.floor(d.updatedAt || nowMs)),
          updatedAt: serverTimestamp(),
        }),
      });
    }

    for (const tomb of customMerge.toUploadTombstones) {
      writeOps.push({
        pathSegments: ['userSync', activeUser.uid, 'customDuas', tomb.id],
        payload: {
          id: tomb.id,
          deleted: true,
          updatedAtMs: Math.max(1, Math.floor(tomb.updatedAtMs || nowMs)),
          updatedAt: serverTimestamp(),
        },
      });
    }

    for (const r of routineMerge.toUploadActive) {
      writeOps.push({
        pathSegments: ['userSync', activeUser.uid, 'routines', r.id],
        payload: stripUndefinedDeep({
          id: r.id,
          title: r.title.slice(0, 200),
          assignedDays: r.assignedDays.filter(
            (day) => Number.isInteger(day) && day >= 0 && day <= 6
          ),
          surahIds: r.surahIds
            .filter((s) => Number.isInteger(s) && s >= 1 && s <= 114)
            .slice(0, 200),
          items: (r.items ?? []).slice(0, 200),
          sourceTemplateId: r.sourceTemplateId
            ? r.sourceTemplateId.slice(0, 120)
            : undefined,
          sourceTemplateVersion:
            typeof r.sourceTemplateVersion === 'number' &&
            Number.isInteger(r.sourceTemplateVersion) &&
            r.sourceTemplateVersion >= 1
              ? r.sourceTemplateVersion
              : undefined,
          createdAt: Math.max(1, Math.floor(r.createdAt || nowMs)),
          updatedAtMs: Math.max(
            1,
            Math.floor(r.updatedAt ?? r.createdAt ?? nowMs)
          ),
          updatedAt: serverTimestamp(),
        }),
      });
    }

    for (const tomb of routineMerge.toUploadTombstones) {
      writeOps.push({
        pathSegments: ['userSync', activeUser.uid, 'routines', tomb.id],
        payload: {
          id: tomb.id,
          deleted: true,
          updatedAtMs: Math.max(1, Math.floor(tomb.updatedAtMs || nowMs)),
          updatedAt: serverTimestamp(),
        },
      });
    }

    for (const h of historyMerge.toUpload) {
      const normalized = normalizeHistoryRecord(h.date, h);
      writeOps.push({
        pathSegments: ['userSync', activeUser.uid, 'readingHistory', normalized.date],
        payload: stripUndefinedDeep({
          date: normalized.date,
          ayahsCount: Math.max(0, Math.min(1000000, normalized.ayahsCount)),
          routinesCompleted: normalized.routinesCompleted.slice(0, 200),
          dhikirCount: Math.max(
            0,
            Math.min(10000000, normalized.dhikirCount ?? 0)
          ),
          dhikirByDua: limitNumberMap(normalized.dhikirByDua ?? {}, 500),
          duasCompleted: (normalized.duasCompleted ?? []).slice(0, 500),
          duaCounts: limitNumberMap(normalized.duaCounts ?? {}, 500),
          readingSeconds: Math.max(
            0,
            Math.min(172800, normalized.readingSeconds ?? 0)
          ),
          goalMinutesTarget:
            typeof normalized.goalMinutesTarget === 'number' &&
            normalized.goalMinutesTarget >= 1 &&
            normalized.goalMinutesTarget <= 1440
              ? Math.floor(normalized.goalMinutesTarget)
              : undefined,
          updatedAtMs: nowMs,
          updatedAt: serverTimestamp(),
        }),
      });
    }

    await commitBatchedWrites(writeOps);

    for (const d of preferDatesSnapshot) {
      dirtyHistoryDatesWhileSynced.delete(d);
    }
    if (preferListsSnapshot) {
      dirtySettingsListsWhileSynced = false;
    }

    const syncedAt = Date.now();
    syncMeta = {
      lastSyncedUid: activeUser.uid,
      lastSyncedEmail: activeUser.email,
      lastSyncedAt: syncedAt,
      deletedCustomDuas: {},
      deletedRoutines: {},
    };
    saveSyncMeta(syncMeta);

    updateState({
      syncing: false,
      lastSyncedAt: syncedAt,
      lastSyncedEmail: activeUser.email,
      pendingAccountConflict: null,
      error: null,
    });
    return true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[CloudSync]', err);
    }
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code ?? '')
        : '';
    let message = 'সিংক সম্পন্ন হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
    if (code === 'permission-denied') {
      message = 'ক্লাউড সিংক অনুমোদন পাওয়া যায়নি। অনুগ্রহ করে পুনরায় লগইন করে চেষ্টা করুন।';
    } else if (code === 'unauthenticated') {
      message = 'আপনার সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে পুনরায় Gmail দিয়ে লগইন করুন।';
    }
    updateState({
      syncing: false,
      error: message,
    });
    return false;
  } finally {
    syncInFlight = false;
    if (queuedSyncAfterFlight && state.user && !state.pendingAccountConflict) {
      queuedSyncAfterFlight = false;
      scheduleDebouncedAutoSync();
    } else {
      queuedSyncAfterFlight = false;
    }
  }
}

function limitNumberMap(
  map: Readonly<Record<string, number>>,
  maxEntries: number
): Record<string, number> {
  const out: Record<string, number> = {};
  let count = 0;
  for (const [k, v] of Object.entries(map)) {
    if (!k || k.length > 120) continue;
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[k] = Math.floor(v);
      count += 1;
      if (count >= maxEntries) break;
    }
  }
  return out;
}

async function handleAuthenticatedUser(fbUser: CloudAuthUser): Promise<void> {
  const [customDuas, routines, readingHistory, globalLastRead, settings] =
    await Promise.all([
      db.customDuas.toArray(),
      db.routines.toArray(),
      db.readingHistory.toArray(),
      db.globalLastRead.toArray(),
      db.settings.get('app'),
    ]);

  const hasLocalData = hasMeaningfulLocalPersonalData({
    customDuas,
    routines,
    readingHistory,
    globalLastRead,
    settings,
  });

  const decision = determineSignInSyncDecision({
    newUid: fbUser.uid,
    lastSyncedUid: syncMeta.lastSyncedUid,
    lastSyncedEmail: syncMeta.lastSyncedEmail,
    hasLocalData,
  });

  if (decision.action === 'prompt-account-switch') {
    updateState({
      user: fbUser,
      authReady: true,
      pendingAccountConflict: {
        previousUid: decision.previousUid,
        previousEmail: decision.previousEmail,
        newUid: fbUser.uid,
        newEmail: fbUser.email,
        newDisplayName: fbUser.displayName,
      },
      error: null,
    });
    return;
  }

  updateState({
    user: fbUser,
    authReady: true,
    pendingAccountConflict: null,
    error: null,
  });

  await performCloudSync(decision.action);
}

export async function ensureCloudAuthReady(): Promise<void> {
  if (!isFirebaseConfigured()) {
    updateState({ configured: false, authReady: true });
    return;
  }
  ensurePersonalMutationObserver();

  if (authInitPromise) return authInitPromise;

  authInitPromise = (async () => {
    try {
      const loaded = await loadFirebaseAuth();
      if (!loaded) {
        updateState({ configured: false, authReady: true });
        return;
      }
      const { auth, authModule } = loaded;

      try {
        if (window.sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1') {
          window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
          await authModule.getRedirectResult(auth);
        }
      } catch {
        // Ignore redirect resolution errors
      }

      authUnsubscribe?.();
      authUnsubscribe = authModule.onAuthStateChanged(auth, (fbUser) => {
        if (!fbUser) {
          clearAutoSyncTimer();
          dirtyHistoryDatesWhileSynced.clear();
          dirtySettingsListsWhileSynced = false;
          updateState({
            user: null,
            authReady: true,
            syncing: false,
            pendingAccountConflict: null,
          });
          return;
        }

        try {
          window.localStorage.setItem(AUTH_HINT_STORAGE_KEY, '1');
        } catch {
          // Ignore storage error
        }

        void handleAuthenticatedUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
        });
      });
    } catch {
      updateState({ authReady: true });
    }
  })();

  return authInitPromise;
}

/**
 * Initializes background Cloud Sync listeners after local DB hydration.
 * Avoids downloading `firebase/auth` immediately on cold start for offline-only users
 * who have never signed in, deferring check to idle time or drawer open.
 */
export function initCloudSyncLifecycle(): () => void {
  if (!isFirebaseConfigured() || typeof window === 'undefined') {
    return () => {};
  }

  ensurePersonalMutationObserver();

  const hasHint =
    window.localStorage.getItem(AUTH_HINT_STORAGE_KEY) === '1' ||
    window.sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1';

  let idleTimer: number | null = null;
  if (hasHint) {
    void ensureCloudAuthReady();
  } else {
    idleTimer = window.setTimeout(() => {
      void ensureCloudAuthReady();
    }, 1800);
  }

  const handleOnline = () => {
    if (state.user && !state.pendingAccountConflict) {
      void performCloudSync('merge');
    }
  };

  const handleVisibility = () => {
    if (
      document.visibilityState === 'visible' &&
      state.user &&
      !state.pendingAccountConflict
    ) {
      const elapsed = Date.now() - (state.lastSyncedAt ?? 0);
      if (elapsed >= VISIBILITY_PULL_COOLDOWN_MS) {
        void performCloudSync('merge');
      }
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

export async function signInWithGoogleForSync(): Promise<{
  ok: boolean;
  cancelled?: boolean;
  error?: string;
}> {
  if (!isFirebaseConfigured()) {
    return {
      ok: false,
      error: 'এই পরিবেশে ক্লাউড সিংক কনফিগার করা নেই।',
    };
  }

  updateState({ signingIn: true, error: null });
  try {
    await ensureCloudAuthReady();
    const loaded = await loadFirebaseAuth();
    if (!loaded) {
      updateState({ signingIn: false });
      return { ok: false, error: 'ক্লাউড লগইন প্রস্তুত করা যায়নি।' };
    }

    const { auth, authModule } = loaded;
    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await authModule.signInWithPopup(auth, provider);
      try {
        window.localStorage.setItem(AUTH_HINT_STORAGE_KEY, '1');
      } catch {
        // Ignore
      }
      return { ok: true };
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          window.sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
          window.localStorage.setItem(AUTH_HINT_STORAGE_KEY, '1');
        } catch {
          // Ignore
        }
        await authModule.signInWithRedirect(auth, provider);
        return { ok: true };
      }
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return { ok: false, cancelled: true };
      }
      if (code === 'auth/unauthorized-domain') {
        const msg =
          'এই ডোমেইনটি এখনো Firebase Authorized Domains-এ যুক্ত করা হয়নি।';
        updateState({ error: msg });
        return { ok: false, error: msg };
      }
      throw err;
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[CloudSyncSignIn]', err);
    }
    const msg = 'Gmail লগইন সম্পন্ন হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';
    updateState({ error: msg });
    return { ok: false, error: msg };
  } finally {
    updateState({ signingIn: false });
  }
}

export async function signOutCloudSync(): Promise<void> {
  clearAutoSyncTimer();
  dirtyHistoryDatesWhileSynced.clear();
  dirtySettingsListsWhileSynced = false;
  try {
    window.localStorage.removeItem(AUTH_HINT_STORAGE_KEY);
  } catch {
    // Ignore
  }
  const loaded = await loadFirebaseAuth();
  if (loaded) {
    await loaded.authModule.signOut(loaded.auth);
  }
  updateState({
    user: null,
    syncing: false,
    pendingAccountConflict: null,
    error: null,
  });
}

export async function triggerManualCloudSync(): Promise<boolean> {
  if (!state.user || state.pendingAccountConflict) return false;
  clearAutoSyncTimer();
  return performCloudSync('merge');
}

export async function resolveAccountConflict(
  choice: 'replace' | 'merge' | 'cancel'
): Promise<boolean> {
  if (!state.pendingAccountConflict || !state.user) return false;

  if (choice === 'cancel') {
    await signOutCloudSync();
    return true;
  }

  updateState({ pendingAccountConflict: null });
  if (choice === 'replace') {
    return performCloudSync('replace-from-cloud');
  }
  // Reset previous account's deletion tombstones before merging local records into the new account
  syncMeta = {
    ...syncMeta,
    deletedCustomDuas: {},
    deletedRoutines: {},
  };
  saveSyncMeta(syncMeta);
  return performCloudSync('merge');
}
