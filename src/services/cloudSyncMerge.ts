import {
  DEFAULT_SETTINGS,
  GLASS_PRESET_OPACITY,
  clampGlassOpacity,
  isRoutineProgressCurrent,
  normalizeHistoryRecord,
  normalizeThemeSettings,
  type GlobalLastRead,
  type GlassMode,
  type ReadingHistory,
  type Routine,
  type RoutineProgress,
  type Settings,
} from '../db/database';
import {
  DEFAULT_FASTING_LOCATION,
  resolveHijriOffsetSettings,
  type FastingCalculationMethod,
} from '../utils/fasting';
import {
  normalizeStoredCustomDua,
  type CustomDua,
} from './customDuaSnapshot';

export interface CloudCustomDuaDoc {
  id: string;
  deleted?: boolean;
  titleBangla?: string;
  arabic?: string;
  transliteration?: string;
  translationBangla?: string;
  repeatCount?: number;
  reference?: string;
  createdAt?: number;
  updatedAtMs: number;
}

export interface CloudRoutineDoc {
  id: string;
  deleted?: boolean;
  title?: string;
  assignedDays?: number[];
  surahIds?: number[];
  items?: Routine['items'];
  sourceTemplateId?: string;
  sourceTemplateVersion?: number;
  createdAt?: number;
  updatedAtMs: number;
}

export interface CloudHistoryDoc extends ReadingHistory {
  updatedAtMs?: number;
}

export interface CloudRootSettingsPayload {
  theme: Settings['theme'];
  colorMode: NonNullable<Settings['colorMode']>;
  glassMode: GlassMode;
  glassOpacity: number;
  fontSize: number;
  keepScreenAwake: boolean;
  autoScrollSpeed: number;
  showDuaTransliteration: boolean;
  bookmarkedDuaIds: string[];
  fastingLocation: NonNullable<Settings['fastingLocation']>;
  fastingMethod: FastingCalculationMethod;
  fastingTimeFormat: '12h' | '24h';
  hijriOffsetDays: number;
  hijriOffsetMode: NonNullable<Settings['hijriOffsetMode']>;
  dailyGoalMinutes: number;
  dismissedFeaturedCardIds: string[];
  userModifiedAt?: number;
}

export interface CloudRootDoc {
  uid: string;
  schemaVersion: number;
  settings?: Partial<CloudRootSettingsPayload>;
  globalLastRead?: GlobalLastRead[];
  routineProgress?: RoutineProgress[];
}

export type SignInSyncDecision =
  | { action: 'merge' }
  | { action: 'replace-from-cloud' }
  | {
      action: 'prompt-account-switch';
      previousUid: string;
      previousEmail: string | null;
    };

const VALID_METHODS: ReadonlySet<FastingCalculationMethod> = new Set([
  'karachi',
  'mwl',
  'umm_al_qura',
  'isna',
  'egyptian',
]);

const VALID_GLASS: ReadonlySet<GlassMode> = new Set([
  'clear',
  'frosted',
  'solid',
]);

/**
 * Recursively strips `undefined` properties so Firestore SDK writes never throw
 * `Unsupported field value: undefined`.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function hasMeaningfulLocalPersonalData(params: {
  customDuas: readonly CustomDua[];
  routines: readonly Routine[];
  readingHistory: readonly ReadingHistory[];
  globalLastRead: readonly GlobalLastRead[];
  settings?: Settings;
}): boolean {
  if (params.customDuas.length > 0) return true;
  if (params.routines.length > 0) return true;
  if (params.globalLastRead.length > 0) return true;
  const hasActiveHistory = params.readingHistory.some(
    (h) =>
      h.ayahsCount > 0 ||
      (h.dhikirCount ?? 0) > 0 ||
      (h.readingSeconds ?? 0) > 0 ||
      (h.routinesCompleted?.length ?? 0) > 0 ||
      (h.duasCompleted?.length ?? 0) > 0
  );
  if (hasActiveHistory) return true;
  if ((params.settings?.bookmarkedDuaIds?.length ?? 0) > 0) return true;
  if (typeof params.settings?.userModifiedAt === 'number' && params.settings.userModifiedAt > 0) {
    return true;
  }
  return false;
}

/**
 * Decides whether a sign-in should auto-merge, auto-pull cleanly, or prompt the user
 * because a different Gmail account was previously synced on this device.
 */
export function determineSignInSyncDecision(params: {
  newUid: string;
  lastSyncedUid: string | null;
  lastSyncedEmail: string | null;
  hasLocalData: boolean;
}): SignInSyncDecision {
  const { newUid, lastSyncedUid, lastSyncedEmail, hasLocalData } = params;
  if (!lastSyncedUid || lastSyncedUid === newUid) {
    return { action: 'merge' };
  }
  if (!hasLocalData) {
    return { action: 'replace-from-cloud' };
  }
  return {
    action: 'prompt-account-switch',
    previousUid: lastSyncedUid,
    previousEmail: lastSyncedEmail,
  };
}

export function mergeCustomDuas(
  localList: readonly CustomDua[],
  cloudDocs: readonly CloudCustomDuaDoc[],
  localDeletedMap: Readonly<Record<string, number>> = {}
): {
  mergedLocal: CustomDua[];
  toUploadActive: CustomDua[];
  toUploadTombstones: Array<{ id: string; updatedAtMs: number }>;
  remainingLocalDeleted: Record<string, number>;
} {
  const localById = new Map<string, CustomDua>();
  for (const d of localList) {
    localById.set(d.id, d);
  }

  const cloudById = new Map<string, CloudCustomDuaDoc>();
  for (const c of cloudDocs) {
    if (c && typeof c.id === 'string') {
      cloudById.set(c.id, c);
    }
  }

  const allIds = new Set<string>([
    ...localById.keys(),
    ...cloudById.keys(),
    ...Object.keys(localDeletedMap),
  ]);

  const mergedLocal: CustomDua[] = [];
  const toUploadActive: CustomDua[] = [];
  const toUploadTombstones: Array<{ id: string; updatedAtMs: number }> = [];
  const remainingLocalDeleted: Record<string, number> = {};

  for (const id of allIds) {
    const local = localById.get(id);
    const cloud = cloudById.get(id);
    const localDelTs = localDeletedMap[id];

    if (localDelTs && !local) {
      // Deleted locally since last sync
      const cloudTs = cloud?.updatedAtMs ?? 0;
      if (!cloud) {
        // Never existed in cloud; drop tombstone cleanly
        continue;
      }
      if (cloud.deleted) {
        // Already tombstoned in cloud
        continue;
      }
      if (localDelTs >= cloudTs) {
        toUploadTombstones.push({ id, updatedAtMs: localDelTs });
        continue;
      }
      // Cloud was edited more recently than local delete -> restore cloud
      const restored = normalizeStoredCustomDua({
        ...cloud,
        updatedAt: cloud.updatedAtMs,
      });
      if (restored) mergedLocal.push(restored);
      continue;
    }

    if (local && !cloud) {
      mergedLocal.push(local);
      toUploadActive.push(local);
      continue;
    }

    if (!local && cloud) {
      if (cloud.deleted) continue;
      const normalized = normalizeStoredCustomDua({
        ...cloud,
        updatedAt: cloud.updatedAtMs,
      });
      if (normalized) {
        mergedLocal.push(normalized);
      }
      continue;
    }

    if (local && cloud) {
      if (cloud.deleted) {
        if ((cloud.updatedAtMs ?? 0) >= local.updatedAt) {
          // Deleted on another device more recently -> delete locally
          continue;
        }
        // Local was edited after cloud deletion -> resurrect in cloud
        mergedLocal.push(local);
        toUploadActive.push(local);
        continue;
      }

      const normalizedCloud = normalizeStoredCustomDua({
        ...cloud,
        updatedAt: cloud.updatedAtMs,
      });
      if (!normalizedCloud) {
        mergedLocal.push(local);
        toUploadActive.push(local);
        continue;
      }

      if (local.updatedAt > normalizedCloud.updatedAt) {
        mergedLocal.push(local);
        toUploadActive.push(local);
      } else if (normalizedCloud.updatedAt > local.updatedAt) {
        mergedLocal.push(normalizedCloud);
      } else {
        mergedLocal.push(local);
      }
    }
  }

  mergedLocal.sort((a, b) =>
    a.createdAt !== b.createdAt
      ? a.createdAt - b.createdAt
      : a.id.localeCompare(b.id)
  );

  return {
    mergedLocal,
    toUploadActive,
    toUploadTombstones,
    remainingLocalDeleted,
  };
}

function normalizeCloudRoutine(doc: CloudRoutineDoc): Routine | null {
  if (!doc || doc.deleted || typeof doc.id !== 'string' || !doc.id.trim()) {
    return null;
  }
  const title = typeof doc.title === 'string' ? doc.title.trim() : '';
  if (!title || title.length > 200) return null;
  const assignedDays = Array.isArray(doc.assignedDays)
    ? Array.from(
        new Set(
          doc.assignedDays.filter(
            (d): d is number => Number.isInteger(d) && d >= 0 && d <= 6
          )
        )
      ).sort((a, b) => a - b)
    : [];
  const surahIds = Array.isArray(doc.surahIds)
    ? doc.surahIds.filter(
        (s): s is number => Number.isInteger(s) && s >= 1 && s <= 114
      )
    : [];
  const createdAt =
    typeof doc.createdAt === 'number' && Number.isFinite(doc.createdAt) && doc.createdAt > 0
      ? Math.floor(doc.createdAt)
      : Math.floor(doc.updatedAtMs || Date.now());
  const updatedAt =
    typeof doc.updatedAtMs === 'number' && Number.isFinite(doc.updatedAtMs) && doc.updatedAtMs > 0
      ? Math.floor(doc.updatedAtMs)
      : createdAt;

  return stripUndefinedDeep({
    id: doc.id,
    title,
    assignedDays,
    surahIds,
    items: Array.isArray(doc.items) ? doc.items : undefined,
    sourceTemplateId:
      typeof doc.sourceTemplateId === 'string' && doc.sourceTemplateId
        ? doc.sourceTemplateId
        : undefined,
    sourceTemplateVersion:
      typeof doc.sourceTemplateVersion === 'number' &&
      Number.isInteger(doc.sourceTemplateVersion)
        ? doc.sourceTemplateVersion
        : undefined,
    createdAt,
    updatedAt,
  });
}

export function mergeRoutines(
  localList: readonly Routine[],
  cloudDocs: readonly CloudRoutineDoc[],
  localDeletedMap: Readonly<Record<string, number>> = {}
): {
  mergedLocal: Routine[];
  toUploadActive: Routine[];
  toUploadTombstones: Array<{ id: string; updatedAtMs: number }>;
} {
  const localById = new Map<string, Routine>();
  for (const r of localList) {
    localById.set(r.id, r);
  }
  const cloudById = new Map<string, CloudRoutineDoc>();
  for (const c of cloudDocs) {
    if (c && typeof c.id === 'string') {
      cloudById.set(c.id, c);
    }
  }

  const allIds = new Set<string>([
    ...localById.keys(),
    ...cloudById.keys(),
    ...Object.keys(localDeletedMap),
  ]);

  const candidates: Routine[] = [];
  const toUploadMap = new Map<string, Routine>();
  const toUploadTombstones: Array<{ id: string; updatedAtMs: number }> = [];

  for (const id of allIds) {
    const local = localById.get(id);
    const cloud = cloudById.get(id);
    const localDelTs = localDeletedMap[id];
    const localTs = local ? (local.updatedAt ?? local.createdAt) : 0;

    if (localDelTs && !local) {
      if (!cloud || cloud.deleted) continue;
      if (localDelTs >= (cloud.updatedAtMs ?? 0)) {
        toUploadTombstones.push({ id, updatedAtMs: localDelTs });
      } else {
        const restored = normalizeCloudRoutine(cloud);
        if (restored) candidates.push(restored);
      }
      continue;
    }

    if (local && !cloud) {
      candidates.push(local);
      toUploadMap.set(local.id, local);
      continue;
    }

    if (!local && cloud) {
      const normalized = normalizeCloudRoutine(cloud);
      if (normalized) candidates.push(normalized);
      continue;
    }

    if (local && cloud) {
      if (cloud.deleted) {
        if ((cloud.updatedAtMs ?? 0) >= localTs) {
          continue;
        }
        candidates.push(local);
        toUploadMap.set(local.id, local);
        continue;
      }

      const normalizedCloud = normalizeCloudRoutine(cloud);
      if (!normalizedCloud) {
        candidates.push(local);
        toUploadMap.set(local.id, local);
        continue;
      }

      const cloudTs = normalizedCloud.updatedAt ?? normalizedCloud.createdAt;
      if (localTs > cloudTs) {
        candidates.push(local);
        toUploadMap.set(local.id, local);
      } else if (cloudTs > localTs) {
        candidates.push(normalizedCloud);
      } else {
        candidates.push(local);
      }
    }
  }

  // Deduplicate routines adopted from the same Admin Routine Template on two devices offline
  const seenTemplateMap = new Map<string, Routine>();
  const mergedLocal: Routine[] = [];

  for (const r of candidates) {
    if (!r.sourceTemplateId) {
      mergedLocal.push(r);
      continue;
    }
    const prev = seenTemplateMap.get(r.sourceTemplateId);
    if (!prev) {
      seenTemplateMap.set(r.sourceTemplateId, r);
      mergedLocal.push(r);
      continue;
    }
    const prevTs = prev.updatedAt ?? prev.createdAt;
    const currTs = r.updatedAt ?? r.createdAt;
    if (currTs > prevTs) {
      // Replace older duplicate template routine and tombstone the duplicate ID if it was in cloud
      const idx = mergedLocal.indexOf(prev);
      if (idx !== -1) mergedLocal[idx] = r;
      seenTemplateMap.set(r.sourceTemplateId, r);
      toUploadMap.delete(prev.id);
      if (cloudById.has(prev.id)) {
        toUploadTombstones.push({ id: prev.id, updatedAtMs: currTs });
      }
    } else {
      toUploadMap.delete(r.id);
      if (cloudById.has(r.id)) {
        toUploadTombstones.push({ id: r.id, updatedAtMs: prevTs });
      }
    }
  }

  mergedLocal.sort((a, b) => a.createdAt - b.createdAt);

  return {
    mergedLocal,
    toUploadActive: Array.from(toUploadMap.values()),
    toUploadTombstones,
  };
}

function sortNumberRecord(
  rec: Readonly<Record<string, number>>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(rec).sort()) {
    out[key] = rec[key];
  }
  return out;
}

function canonicalizeHistoryRecord(rec: ReadingHistory): ReadingHistory {
  const norm = normalizeHistoryRecord(rec.date, rec);
  const sortedDuaCounts = sortNumberRecord(norm.duaCounts ?? {});
  const sortedDhikirByDua = sortNumberRecord(norm.dhikirByDua ?? {});
  return {
    ...norm,
    routinesCompleted: [...norm.routinesCompleted].sort(),
    duasCompleted: Object.keys(sortedDuaCounts),
    duaCounts: sortedDuaCounts,
    dhikirByDua: sortedDhikirByDua,
  };
}

/**
 * Commutative, idempotent smart-merge for daily ReadingHistory records.
 * Preserves every active day, routine, dua, dhikir, ayah, and reading second
 * without ever inflating counts across repeated syncs.
 */
export function mergeSingleHistoryRecord(
  date: string,
  a: Partial<ReadingHistory>,
  b: Partial<ReadingHistory>
): ReadingHistory {
  const normA = normalizeHistoryRecord(date, a);
  const normB = normalizeHistoryRecord(date, b);

  const rawDuaCounts: Record<string, number> = { ...(normA.duaCounts ?? {}) };
  for (const [duaId, count] of Object.entries(normB.duaCounts ?? {})) {
    rawDuaCounts[duaId] = Math.max(rawDuaCounts[duaId] ?? 0, count);
  }
  const mergedDuaCounts = sortNumberRecord(rawDuaCounts);

  const rawDhikirByDua: Record<string, number> = {
    ...(normA.dhikirByDua ?? {}),
  };
  for (const [duaId, count] of Object.entries(normB.dhikirByDua ?? {})) {
    rawDhikirByDua[duaId] = Math.max(rawDhikirByDua[duaId] ?? 0, count);
  }
  const mergedDhikirByDua = sortNumberRecord(rawDhikirByDua);

  const sumByDua = Object.values(mergedDhikirByDua).reduce((s, v) => s + v, 0);
  const mergedDhikirCount = Math.max(
    normA.dhikirCount ?? 0,
    normB.dhikirCount ?? 0,
    sumByDua
  );

  const routinesCompleted = Array.from(
    new Set([...normA.routinesCompleted, ...normB.routinesCompleted])
  ).sort();

  const goalTarget =
    normA.goalMinutesTarget !== undefined && normB.goalMinutesTarget !== undefined
      ? Math.max(normA.goalMinutesTarget, normB.goalMinutesTarget)
      : (normA.goalMinutesTarget ?? normB.goalMinutesTarget);

  return canonicalizeHistoryRecord({
    date,
    ayahsCount: Math.max(normA.ayahsCount, normB.ayahsCount),
    routinesCompleted,
    dhikirCount: mergedDhikirCount,
    dhikirByDua: mergedDhikirByDua,
    duasCompleted: Object.keys(mergedDuaCounts),
    duaCounts: mergedDuaCounts,
    readingSeconds: Math.max(
      normA.readingSeconds ?? 0,
      normB.readingSeconds ?? 0
    ),
    ...(goalTarget ? { goalMinutesTarget: goalTarget } : {}),
  });
}

function historyRecordsEqual(a: ReadingHistory, b: ReadingHistory): boolean {
  return (
    JSON.stringify(canonicalizeHistoryRecord(a)) ===
    JSON.stringify(canonicalizeHistoryRecord(b))
  );
}

export function mergeReadingHistory(
  localList: readonly ReadingHistory[],
  cloudDocs: readonly CloudHistoryDoc[],
  options?: { preferLocalForDates?: ReadonlySet<string> }
): {
  mergedLocal: ReadingHistory[];
  toUpload: ReadingHistory[];
} {
  const localMap = new Map<string, ReadingHistory>();
  for (const row of localList) {
    if (row?.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      localMap.set(row.date, normalizeHistoryRecord(row.date, row));
    }
  }

  const cloudMap = new Map<string, ReadingHistory>();
  for (const row of cloudDocs) {
    if (row?.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      cloudMap.set(row.date, normalizeHistoryRecord(row.date, row));
    }
  }

  const allDates = new Set<string>([...localMap.keys(), ...cloudMap.keys()]);
  const mergedLocal: ReadingHistory[] = [];
  const toUpload: ReadingHistory[] = [];

  for (const date of allDates) {
    const local = localMap.get(date);
    const cloud = cloudMap.get(date);

    if (local && !cloud) {
      mergedLocal.push(local);
      toUpload.push(local);
      continue;
    }
    if (!local && cloud) {
      mergedLocal.push(cloud);
      continue;
    }
    if (local && cloud) {
      if (options?.preferLocalForDates?.has(date)) {
        mergedLocal.push(local);
        if (!historyRecordsEqual(local, cloud)) {
          toUpload.push(local);
        }
      } else {
        const merged = mergeSingleHistoryRecord(date, local, cloud);
        mergedLocal.push(merged);
        if (!historyRecordsEqual(merged, cloud)) {
          toUpload.push(merged);
        }
      }
    }
  }

  mergedLocal.sort((a, b) => a.date.localeCompare(b.date));
  return { mergedLocal, toUpload };
}

export function mergeGlobalLastRead(
  localList: readonly GlobalLastRead[],
  cloudList: readonly GlobalLastRead[] = []
): GlobalLastRead[] {
  const byId = new Map<string, GlobalLastRead>();
  for (const item of [...cloudList, ...localList]) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      (item.id !== 'current' && !/^surah-\d{1,3}$/.test(item.id)) ||
      typeof item.surahId !== 'number' ||
      item.surahId < 1 ||
      item.surahId > 114
    ) {
      continue;
    }
    const existing = byId.get(item.id);
    if (!existing || (item.timestamp ?? 0) >= (existing.timestamp ?? 0)) {
      byId.set(item.id, {
        id: item.id,
        surahId: Math.floor(item.surahId),
        surahNameBangla: String(item.surahNameBangla ?? '').slice(0, 80) || 'সূরা',
        ayahNumber: Math.max(1, Math.min(286, Math.floor(item.ayahNumber || 1))),
        pageNumber: Math.max(1, Math.min(604, Math.floor(item.pageNumber || 1))),
        timestamp: Math.max(0, Math.floor(item.timestamp || 0)),
      });
    }
  }
  return Array.from(byId.values());
}

function mergeItemCountMaps(
  a?: Readonly<Record<string, number>>,
  b?: Readonly<Record<string, number>>
): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, number> = {};
  for (const src of [a, b]) {
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = Math.max(out[k] ?? 0, Math.floor(v));
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function mergeRoutineProgress(
  localList: readonly RoutineProgress[],
  cloudList: readonly RoutineProgress[] = [],
  validRoutineIds: ReadonlySet<string>,
  currentDayKey: string
): RoutineProgress[] {
  const byRoutine = new Map<string, RoutineProgress>();

  const consider = (p: RoutineProgress) => {
    if (!p || !validRoutineIds.has(p.routineId)) return;
    if (!isRoutineProgressCurrent(p, currentDayKey)) return;

    const existing = byRoutine.get(p.routineId);
    if (!existing) {
      byRoutine.set(p.routineId, {
        ...p,
        dayKey: currentDayKey,
      });
      return;
    }

    const mergedCompleted = Array.from(
      new Set([
        ...(existing.completedItemIndexes ?? []),
        ...(p.completedItemIndexes ?? []),
      ])
    )
      .filter((i) => Number.isInteger(i) && i >= 0)
      .sort((a, b) => a - b);

    const newer = (p.lastUpdated ?? 0) >= (existing.lastUpdated ?? 0) ? p : existing;
    const older = newer === p ? existing : p;
    const mergedManual = {
      ...(older.manualGrantedByItem ?? {}),
      ...(newer.manualGrantedByItem ?? {}),
    };

    byRoutine.set(p.routineId, {
      ...newer,
      dayKey: currentDayKey,
      completedItemIndexes: mergedCompleted,
      itemEarnedDhikir: mergeItemCountMaps(existing.itemEarnedDhikir, p.itemEarnedDhikir),
      itemEarnedDuas: mergeItemCountMaps(existing.itemEarnedDuas, p.itemEarnedDuas),
      itemEarnedAyahs: mergeItemCountMaps(existing.itemEarnedAyahs, p.itemEarnedAyahs),
      ...(Object.keys(mergedManual).length > 0
        ? { manualGrantedByItem: mergedManual }
        : {}),
      completedAyahsCount: Math.max(
        existing.completedAyahsCount ?? 0,
        p.completedAyahsCount ?? 0
      ),
      totalAyahsCount: Math.max(
        existing.totalAyahsCount ?? 0,
        p.totalAyahsCount ?? 0
      ),
      percentage: Math.min(
        100,
        Math.max(existing.percentage ?? 0, p.percentage ?? 0)
      ),
      lastUpdated: Math.max(existing.lastUpdated ?? 0, p.lastUpdated ?? 0),
    });
  };

  for (const c of cloudList) consider(c);
  for (const l of localList) consider(l);

  return Array.from(byRoutine.values());
}

/**
 * Smart-merges local Settings with Cloud Settings.
 * Ensures untouched fresh-install defaults NEVER overwrite existing Cloud settings/bookmarks,
 * while unioning bookmarks during merge mode.
 */
export function mergeSettings(params: {
  localSettings: Settings | undefined;
  cloudSettings: Partial<CloudRootSettingsPayload> | undefined;
  localOfflineDownloaded: boolean;
  preferLocalLists?: boolean;
}): Settings {
  const {
    localSettings,
    cloudSettings,
    localOfflineDownloaded,
    preferLocalLists = false,
  } = params;
  const local = localSettings ?? DEFAULT_SETTINGS;

  if (!cloudSettings) {
    return buildSafeLocalSettings(local, localOfflineDownloaded);
  }

  const localModifiedAt =
    typeof local.userModifiedAt === 'number' && local.userModifiedAt > 0
      ? local.userModifiedAt
      : 0;
  const cloudModifiedAt =
    typeof cloudSettings.userModifiedAt === 'number' &&
    cloudSettings.userModifiedAt > 0
      ? cloudSettings.userModifiedAt
      : 1; // Non-empty cloud settings always beat an untouched fresh install (0)

  const winnerSource =
    localModifiedAt >= cloudModifiedAt
      ? local
      : { ...DEFAULT_SETTINGS, ...cloudSettings };

  const bookmarkedDuaIds = preferLocalLists
    ? dedupeStringList(local.bookmarkedDuaIds ?? [], 1000)
    : dedupeStringList(
        [
          ...(cloudSettings.bookmarkedDuaIds ?? []),
          ...(local.bookmarkedDuaIds ?? []),
        ],
        1000
      );

  const dismissedFeaturedCardIds = preferLocalLists
    ? dedupeStringList(local.dismissedFeaturedCardIds ?? [], 500)
    : dedupeStringList(
        [
          ...(cloudSettings.dismissedFeaturedCardIds ?? []),
          ...(local.dismissedFeaturedCardIds ?? []),
        ],
        500
      );

  const mergedModifiedAt = Math.max(localModifiedAt, cloudModifiedAt);

  return buildSafeLocalSettings(
    {
      ...winnerSource,
      bookmarkedDuaIds,
      dismissedFeaturedCardIds,
      ...(mergedModifiedAt > 0 ? { userModifiedAt: mergedModifiedAt } : {}),
    },
    localOfflineDownloaded
  );
}

function dedupeStringList(items: readonly unknown[], maxItems: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 120 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function buildSafeLocalSettings(
  raw: Partial<Settings>,
  offlineDownloaded: boolean
): Settings {
  const { theme, colorMode } = normalizeThemeSettings(raw.theme, raw.colorMode);
  const glassMode: GlassMode =
    raw.glassMode && VALID_GLASS.has(raw.glassMode)
      ? raw.glassMode
      : 'frosted';
  const glassOpacity =
    typeof raw.glassOpacity === 'number' && Number.isFinite(raw.glassOpacity)
      ? clampGlassOpacity(raw.glassOpacity)
      : GLASS_PRESET_OPACITY[glassMode];

  const rawLoc = raw.fastingLocation;
  const safeLocation =
    rawLoc &&
    typeof rawLoc === 'object' &&
    typeof rawLoc.id === 'string' &&
    rawLoc.id.trim().length > 0 &&
    typeof rawLoc.nameBn === 'string' &&
    rawLoc.nameBn.trim().length > 0 &&
    typeof rawLoc.latitude === 'number' &&
    Number.isFinite(rawLoc.latitude) &&
    rawLoc.latitude >= -90 &&
    rawLoc.latitude <= 90 &&
    typeof rawLoc.longitude === 'number' &&
    Number.isFinite(rawLoc.longitude) &&
    rawLoc.longitude >= -180 &&
    rawLoc.longitude <= 180
      ? {
          id: rawLoc.id.trim().slice(0, 80),
          nameBn: rawLoc.nameBn.trim().slice(0, 120),
          latitude: rawLoc.latitude,
          longitude: rawLoc.longitude,
          ...(typeof rawLoc.timeZone === 'string' && rawLoc.timeZone.trim()
            ? { timeZone: rawLoc.timeZone.trim().slice(0, 80) }
            : {}),
        }
      : DEFAULT_FASTING_LOCATION;

  const fastingMethod: FastingCalculationMethod =
    raw.fastingMethod && VALID_METHODS.has(raw.fastingMethod)
      ? raw.fastingMethod
      : 'karachi';

  const fastingTimeFormat: '12h' | '24h' =
    raw.fastingTimeFormat === '24h' ? '24h' : '12h';

  const resolvedHijri = resolveHijriOffsetSettings(
    safeLocation,
    raw.hijriOffsetDays,
    raw.hijriOffsetMode
  );

  const fontSize =
    typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize)
      ? Math.min(80, Math.max(14, Math.round(raw.fontSize)))
      : DEFAULT_SETTINGS.fontSize;

  const autoScrollSpeed =
    typeof raw.autoScrollSpeed === 'number' && Number.isFinite(raw.autoScrollSpeed)
      ? Math.min(10, Math.max(0, Math.round(raw.autoScrollSpeed)))
      : 0;

  const dailyGoalMinutes =
    typeof raw.dailyGoalMinutes === 'number' && Number.isFinite(raw.dailyGoalMinutes)
      ? Math.min(1440, Math.max(0, Math.floor(raw.dailyGoalMinutes)))
      : 0;

  return stripUndefinedDeep({
    key: 'app',
    theme,
    colorMode,
    glassMode,
    glassOpacity,
    fontSize,
    keepScreenAwake:
      typeof raw.keepScreenAwake === 'boolean'
        ? raw.keepScreenAwake
        : DEFAULT_SETTINGS.keepScreenAwake,
    autoScrollSpeed,
    offlineDownloaded,
    showDuaTransliteration:
      typeof raw.showDuaTransliteration === 'boolean'
        ? raw.showDuaTransliteration
        : true,
    bookmarkedDuaIds: dedupeStringList(raw.bookmarkedDuaIds ?? [], 1000),
    fastingLocation: safeLocation,
    fastingMethod,
    fastingTimeFormat,
    hijriOffsetDays: resolvedHijri.hijriOffsetDays,
    hijriOffsetMode: resolvedHijri.hijriOffsetMode,
    dailyGoalMinutes,
    dismissedFeaturedCardIds: dedupeStringList(
      raw.dismissedFeaturedCardIds ?? [],
      500
    ),
    userModifiedAt:
      typeof raw.userModifiedAt === 'number' &&
      Number.isFinite(raw.userModifiedAt) &&
      raw.userModifiedAt > 0
        ? Math.floor(raw.userModifiedAt)
        : undefined,
  });
}

export function toCloudSettingsPayload(
  settings: Settings
): CloudRootSettingsPayload {
  const safe = buildSafeLocalSettings(settings, false);
  return stripUndefinedDeep({
    theme: safe.theme,
    colorMode: safe.colorMode ?? 'light',
    glassMode: safe.glassMode ?? 'frosted',
    glassOpacity: safe.glassOpacity ?? GLASS_PRESET_OPACITY.frosted,
    fontSize: safe.fontSize,
    keepScreenAwake: safe.keepScreenAwake,
    autoScrollSpeed: safe.autoScrollSpeed,
    showDuaTransliteration: safe.showDuaTransliteration ?? true,
    bookmarkedDuaIds: safe.bookmarkedDuaIds ?? [],
    fastingLocation: safe.fastingLocation ?? DEFAULT_FASTING_LOCATION,
    fastingMethod: safe.fastingMethod ?? 'karachi',
    fastingTimeFormat: safe.fastingTimeFormat ?? '12h',
    hijriOffsetDays: safe.hijriOffsetDays ?? 0,
    hijriOffsetMode: safe.hijriOffsetMode ?? 'auto',
    dailyGoalMinutes: safe.dailyGoalMinutes ?? 0,
    dismissedFeaturedCardIds: safe.dismissedFeaturedCardIds ?? [],
    userModifiedAt: safe.userModifiedAt,
  });
}
