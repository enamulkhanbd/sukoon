import { useSyncExternalStore } from 'react';
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type {
  CmsCollectionName,
  CmsSyncMeta,
  FeaturedCardAction,
  RemoteDuaChapterDoc,
  RemoteDuaDoc,
  RemoteFeaturedCardDoc,
  RemoteRoutineTemplateDoc,
  RemoteSurahOverrideDoc,
  RoutineItemRef,
} from '../data/cmsTypes';
import type { DuaPart, QuranRef } from '../data/duas/types';
import { db } from '../db/database';
import { toBanglaDigits } from '../utils/formatters';
import { isBuiltInChapterId, isBuiltInDuaId } from './catalogSnapshot';
import { hydrateCatalogFromDb } from './contentCatalog';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';

const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between silent background checks

export interface CmsSyncState {
  syncing: boolean;
  configured: boolean;
  lastCheckedAt: number | null;
  lastError: string | null;
}

export interface CmsSyncResult {
  synced: boolean;
  skipped?: 'unconfigured' | 'offline' | 'cooldown' | 'in-progress';
  counts: {
    duas: number;
    chapters: number;
    routineTemplates: number;
    surahOverrides: number;
    featuredCards: number;
  };
  totalChanged: number;
  error?: string;
}

type ToastNotifier = {
  success: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
  error: (msg: string) => void;
};

let syncState: CmsSyncState = {
  syncing: false,
  configured: isFirebaseConfigured(),
  lastCheckedAt: null,
  lastError: null,
};

const syncListeners = new Set<() => void>();

function emitSyncState(patch: Partial<CmsSyncState>) {
  syncState = { ...syncState, ...patch };
  for (const listener of syncListeners) {
    listener();
  }
}

export function subscribeCmsSync(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

export function getCmsSyncSnapshot(): CmsSyncState {
  return syncState;
}

export function useCmsSyncStatus(): CmsSyncState {
  return useSyncExternalStore(subscribeCmsSync, getCmsSyncSnapshot);
}

function toEpochMs(raw: unknown): number {
  if (raw instanceof Timestamp) return raw.toMillis();
  if (
    raw &&
    typeof raw === 'object' &&
    'toMillis' in raw &&
    typeof (raw as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (raw as { toMillis: () => number }).toMillis();
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return Date.now();
}

/** Strips undefined properties recursively before sending to Firestore. */
function cleanUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? cleanUndefined(item as Record<string, unknown>)
          : item
      );
    } else if (
      v !== null &&
      typeof v === 'object' &&
      !(v instanceof Timestamp) &&
      Object.getPrototypeOf(v) === Object.prototype
    ) {
      out[k] = cleanUndefined(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const ALL_COLLECTIONS: readonly CmsCollectionName[] = [
  'duas',
  'duaChapters',
  'routineTemplates',
  'surahOverrides',
  'featuredCards',
];

/**
 * Loads lastCheckedAt from Dexie so SettingsSheet shows the last sync time offline too.
 */
export async function hydrateSyncMetaState(): Promise<void> {
  const metas = await db.cmsSyncMeta.toArray();
  const maxChecked = metas.reduce(
    (max, m) => Math.max(max, m.lastCheckedAt || 0),
    0
  );
  if (maxChecked > 0) {
    emitSyncState({ lastCheckedAt: maxChecked });
  }
}

/**
 * Performs an incremental delta sync from Firestore into IndexedDB (Dexie).
 * Only fetches documents with `updatedAt > lastSyncedAt`.
 */
export async function syncCmsFromFirestore(options?: {
  force?: boolean;
  toast?: ToastNotifier;
  showNoChangeToast?: boolean;
}): Promise<CmsSyncResult> {
  const force = Boolean(options?.force);
  const emptyCounts = {
    duas: 0,
    chapters: 0,
    routineTemplates: 0,
    surahOverrides: 0,
    featuredCards: 0,
  };

  if (!isFirebaseConfigured()) {
    emitSyncState({ configured: false });
    return { synced: false, skipped: 'unconfigured', counts: emptyCounts, totalChanged: 0 };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (force) {
      options?.toast?.warning('ইন্টারনেট সংযোগ নেই। অফলাইন কন্টেন্ট দেখানো হচ্ছে।');
    }
    return { synced: false, skipped: 'offline', counts: emptyCounts, totalChanged: 0 };
  }

  if (syncState.syncing) {
    return { synced: false, skipped: 'in-progress', counts: emptyCounts, totalChanged: 0 };
  }

  const fs = getFirestoreDb();
  if (!fs) {
    return { synced: false, skipped: 'unconfigured', counts: emptyCounts, totalChanged: 0 };
  }

  const now = Date.now();
  const existingMetas = await db.cmsSyncMeta.toArray();
  const metaMap = new Map<CmsCollectionName, CmsSyncMeta>(
    existingMetas.map((m) => [m.collection, m])
  );

  if (!force) {
    const latestCheck = existingMetas.reduce(
      (max, m) => Math.max(max, m.lastCheckedAt || 0),
      0
    );
    if (latestCheck > 0 && now - latestCheck < AUTO_SYNC_COOLDOWN_MS) {
      return { synced: false, skipped: 'cooldown', counts: emptyCounts, totalChanged: 0 };
    }
  }

  emitSyncState({ syncing: true, lastError: null, configured: true });

  try {
    const fetchCollectionDelta = async (colName: CmsCollectionName) => {
      const lastSyncedAt = metaMap.get(colName)?.lastSyncedAt ?? 0;
      const colRef = collection(fs, colName);
      const q =
        lastSyncedAt > 0
          ? query(colRef, where('updatedAt', '>', Timestamp.fromMillis(lastSyncedAt)))
          : colRef;
      const snap = await getDocs(q);
      let maxTs = lastSyncedAt;
      const docs = snap.docs.map((d) => {
        const data = d.data();
        const updatedAt = toEpochMs(data.updatedAt);
        if (updatedAt > maxTs) maxTs = updatedAt;
        return { docId: d.id, data, updatedAt };
      });
      return { docs, maxTs };
    };

    const [
      duasDelta,
      chaptersDelta,
      templatesDelta,
      surahsDelta,
      featuredDelta,
    ] = await Promise.all([
      fetchCollectionDelta('duas'),
      fetchCollectionDelta('duaChapters'),
      fetchCollectionDelta('routineTemplates'),
      fetchCollectionDelta('surahOverrides'),
      fetchCollectionDelta('featuredCards'),
    ]);

    const counts = {
      duas: 0,
      chapters: 0,
      routineTemplates: 0,
      surahOverrides: 0,
      featuredCards: 0,
    };

    await db.transaction(
      'rw',
      [
        db.remoteDuas,
        db.remoteDuaChapters,
        db.remoteRoutineTemplates,
        db.remoteSurahOverrides,
        db.remoteFeaturedCards,
        db.cmsSyncMeta,
      ],
      async () => {
        // 1. Duas
        for (const { docId, data, updatedAt } of duasDelta.docs) {
          const id = typeof data.id === 'string' ? data.id : docId;
          const isDeleted = Boolean(data.deleted);
          const isReverted = Boolean(data.reverted);
          const isBuiltIn = isBuiltInDuaId(id);

          if (isReverted) {
            await db.remoteDuas.delete(id);
            counts.duas += 1;
          } else if (isDeleted && !isBuiltIn) {
            await db.remoteDuas.delete(id);
            counts.duas += 1;
          } else {
            const record: RemoteDuaDoc = {
              id,
              chapterId: typeof data.chapterId === 'number' ? data.chapterId : undefined,
              order: typeof data.order === 'number' ? data.order : undefined,
              titleBangla: typeof data.titleBangla === 'string' ? data.titleBangla : undefined,
              repeatCount: typeof data.repeatCount === 'number' ? data.repeatCount : undefined,
              occasionNote: typeof data.occasionNote === 'string' ? data.occasionNote : undefined,
              arabic: typeof data.arabic === 'string' ? data.arabic : undefined,
              transliteration:
                typeof data.transliteration === 'string' ? data.transliteration : undefined,
              translationBangla:
                typeof data.translationBangla === 'string'
                  ? data.translationBangla
                  : undefined,
              reference: typeof data.reference === 'string' ? data.reference : undefined,
              quranRef: data.quranRef as QuranRef | undefined,
              parts: Array.isArray(data.parts) ? (data.parts as DuaPart[]) : undefined,
              isBuiltInOverride: isBuiltIn || Boolean(data.isBuiltInOverride),
              deleted: isDeleted || undefined,
              updatedAt,
            };
            await db.remoteDuas.put(record);
            counts.duas += 1;
          }
        }

        // 2. Chapters
        for (const { docId, data, updatedAt } of chaptersDelta.docs) {
          const id =
            typeof data.id === 'number' ? data.id : Number.parseInt(docId, 10);
          if (!Number.isSafeInteger(id) || id <= 0) continue;
          const isDeleted = Boolean(data.deleted);
          const isReverted = Boolean(data.reverted);
          const isBuiltIn = isBuiltInChapterId(id);

          if (isReverted || (isDeleted && !isBuiltIn)) {
            await db.remoteDuaChapters.delete(id);
            counts.chapters += 1;
          } else {
            const record: RemoteDuaChapterDoc = {
              id,
              titleBangla: typeof data.titleBangla === 'string' ? data.titleBangla : undefined,
              subtitleBangla:
                typeof data.subtitleBangla === 'string' ? data.subtitleBangla : undefined,
              searchAliases: Array.isArray(data.searchAliases)
                ? (data.searchAliases as string[])
                : undefined,
              deleted: isDeleted || undefined,
              updatedAt,
            };
            await db.remoteDuaChapters.put(record);
            counts.chapters += 1;
          }
        }

        // 3. Routine Templates
        for (const { docId, data, updatedAt } of templatesDelta.docs) {
          const id = typeof data.id === 'string' ? data.id : docId;
          if (data.deleted) {
            await db.remoteRoutineTemplates.delete(id);
            counts.routineTemplates += 1;
          } else {
            const record: RemoteRoutineTemplateDoc = {
              id,
              title: typeof data.title === 'string' ? data.title : undefined,
              description: typeof data.description === 'string' ? data.description : undefined,
              assignedDays: Array.isArray(data.assignedDays)
                ? (data.assignedDays as number[])
                : [],
              items: Array.isArray(data.items)
                ? (data.items as RoutineItemRef[])
                : [],
              featured: Boolean(data.featured),
              seasonTag: typeof data.seasonTag === 'string' ? data.seasonTag : undefined,
              order: typeof data.order === 'number' ? data.order : 0,
              version: typeof data.version === 'number' ? data.version : 1,
              updatedAt,
            };
            await db.remoteRoutineTemplates.put(record);
            counts.routineTemplates += 1;
          }
        }

        // 4. Surah Overrides
        for (const { docId, data, updatedAt } of surahsDelta.docs) {
          const surahId =
            typeof data.surahId === 'number'
              ? data.surahId
              : Number.parseInt(docId, 10);
          if (!Number.isSafeInteger(surahId) || surahId < 1 || surahId > 114) continue;
          if (data.deleted || data.reverted) {
            await db.remoteSurahOverrides.delete(surahId);
            counts.surahOverrides += 1;
          } else {
            const record: RemoteSurahOverrideDoc = {
              surahId,
              descriptionBangla:
                typeof data.descriptionBangla === 'string'
                  ? data.descriptionBangla
                  : undefined,
              fazilatBangla:
                typeof data.fazilatBangla === 'string' ? data.fazilatBangla : undefined,
              fazilatRef:
                typeof data.fazilatRef === 'string' ? data.fazilatRef : undefined,
              occasionTags: Array.isArray(data.occasionTags)
                ? (data.occasionTags as string[])
                : undefined,
              updatedAt,
            };
            await db.remoteSurahOverrides.put(record);
            counts.surahOverrides += 1;
          }
        }

        // 5. Featured Cards
        for (const { docId, data, updatedAt } of featuredDelta.docs) {
          const id = typeof data.id === 'string' ? data.id : docId;
          if (data.deleted) {
            await db.remoteFeaturedCards.delete(id);
            counts.featuredCards += 1;
          } else {
            const record: RemoteFeaturedCardDoc = {
              id,
              titleBangla: typeof data.titleBangla === 'string' ? data.titleBangla : undefined,
              bodyBangla: typeof data.bodyBangla === 'string' ? data.bodyBangla : undefined,
              arabicSnippet:
                typeof data.arabicSnippet === 'string' ? data.arabicSnippet : undefined,
              badgeLabel: typeof data.badgeLabel === 'string' ? data.badgeLabel : undefined,
              action: data.action as FeaturedCardAction | undefined,
              active: Boolean(data.active),
              startDate: typeof data.startDate === 'string' ? data.startDate : undefined,
              endDate: typeof data.endDate === 'string' ? data.endDate : undefined,
              priority: typeof data.priority === 'number' ? data.priority : 0,
              updatedAt,
            };
            await db.remoteFeaturedCards.put(record);
            counts.featuredCards += 1;
          }
        }

        // Update cursors
        const cursorEntries: Array<[CmsCollectionName, number]> = [
          ['duas', duasDelta.maxTs],
          ['duaChapters', chaptersDelta.maxTs],
          ['routineTemplates', templatesDelta.maxTs],
          ['surahOverrides', surahsDelta.maxTs],
          ['featuredCards', featuredDelta.maxTs],
        ];
        for (const [col, maxTs] of cursorEntries) {
          await db.cmsSyncMeta.put({
            collection: col,
            lastSyncedAt: maxTs,
            lastCheckedAt: now,
          });
        }
      }
    );

    const totalChanged =
      counts.duas +
      counts.chapters +
      counts.routineTemplates +
      counts.surahOverrides +
      counts.featuredCards;

    if (totalChanged > 0) {
      await hydrateCatalogFromDb();
    }

    emitSyncState({ syncing: false, lastCheckedAt: now, lastError: null });

    if (options?.toast) {
      if (totalChanged > 0) {
        const parts: string[] = [];
        if (counts.duas > 0) parts.push(`${toBanglaDigits(counts.duas)}টি দুআ`);
        if (counts.chapters > 0) parts.push(`${toBanglaDigits(counts.chapters)}টি অধ্যায়`);
        if (counts.routineTemplates > 0)
          parts.push(`${toBanglaDigits(counts.routineTemplates)}টি রুটিন`);
        if (counts.surahOverrides > 0)
          parts.push(`${toBanglaDigits(counts.surahOverrides)}টি সূরা তথ্য`);
        if (counts.featuredCards > 0) parts.push('হোম আপডেট');
        options.toast.info(`নতুন কন্টেন্ট যুক্ত হয়েছে: ${parts.join(', ')}`);
      } else if (options.showNoChangeToast) {
        options.toast.success('সব দুআ ও রুটিন ইতিমধ্যেই হালনাগাদ আছে।');
      }
    }

    return { synced: true, counts, totalChanged };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'কন্টেন্ট সিংক করা যায়নি।';
    emitSyncState({ syncing: false, lastError: message });
    if (force) {
      options?.toast?.error('আপডেট চেক করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।');
    }
    return {
      synced: false,
      counts: emptyCounts,
      totalChanged: 0,
      error: message,
    };
  }
}

export async function resetCmsSyncCursorsAndResync(toast?: ToastNotifier) {
  await db.cmsSyncMeta.bulkDelete([...ALL_COLLECTIONS]);
  return syncCmsFromFirestore({ force: true, toast, showNoChangeToast: true });
}

/* ============================================================================
 * Admin Write-Through Helpers (Firestore + immediate local Dexie mirror)
 * ========================================================================== */

function requireFirestore() {
  const fs = getFirestoreDb();
  if (!fs) {
    throw new Error('সার্ভার সংযোগ প্রস্তুত নয়। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।');
  }
  return fs;
}

export async function adminPublishDua(input: {
  id: string;
  chapterId: number;
  order: number;
  titleBangla: string;
  arabic: string;
  translationBangla: string;
  transliteration?: string;
  repeatCount?: number;
  occasionNote?: string;
  reference?: string;
  quranRef?: QuranRef;
  parts?: DuaPart[];
}): Promise<void> {
  const fs = requireFirestore();
  const isBuiltIn = isBuiltInDuaId(input.id);
  const payload = cleanUndefined({
    id: input.id,
    chapterId: Math.trunc(input.chapterId),
    order: Math.max(0, Math.trunc(input.order)),
    titleBangla: input.titleBangla.trim(),
    arabic: input.arabic.trim(),
    translationBangla: input.translationBangla.trim(),
    transliteration: input.transliteration?.trim() || undefined,
    repeatCount:
      input.repeatCount && input.repeatCount >= 1
        ? Math.trunc(input.repeatCount)
        : undefined,
    occasionNote: input.occasionNote?.trim() || undefined,
    reference: input.reference?.trim() || undefined,
    quranRef: input.quranRef,
    parts: input.parts && input.parts.length > 0 ? input.parts : undefined,
    isBuiltInOverride: isBuiltIn ? true : undefined,
    deleted: false,
    reverted: false,
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(fs, 'duas', input.id), payload);

  const localDoc: RemoteDuaDoc = {
    id: input.id,
    chapterId: Math.trunc(input.chapterId),
    order: Math.max(0, Math.trunc(input.order)),
    titleBangla: input.titleBangla.trim(),
    arabic: input.arabic.trim(),
    translationBangla: input.translationBangla.trim(),
    transliteration: input.transliteration?.trim() || undefined,
    repeatCount:
      input.repeatCount && input.repeatCount >= 1
        ? Math.trunc(input.repeatCount)
        : undefined,
    occasionNote: input.occasionNote?.trim() || undefined,
    reference: input.reference?.trim() || undefined,
    quranRef: input.quranRef,
    parts: input.parts && input.parts.length > 0 ? input.parts : undefined,
    isBuiltInOverride: isBuiltIn,
    updatedAt: Date.now(),
  };
  await db.remoteDuas.put(localDoc);
  await hydrateCatalogFromDb();
}

export async function adminDeleteOrHideDua(duaId: string, chapterId?: number): Promise<void> {
  const fs = requireFirestore();
  const isBuiltIn = isBuiltInDuaId(duaId);
  const payload = cleanUndefined({
    id: duaId,
    chapterId: chapterId ? Math.trunc(chapterId) : undefined,
    isBuiltInOverride: isBuiltIn ? true : undefined,
    deleted: true,
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(fs, 'duas', duaId), payload);

  if (isBuiltIn) {
    await db.remoteDuas.put({
      id: duaId,
      chapterId,
      isBuiltInOverride: true,
      deleted: true,
      updatedAt: Date.now(),
    });
  } else {
    await db.remoteDuas.delete(duaId);
  }
  await hydrateCatalogFromDb();
}

export async function adminRevertBuiltInDua(duaId: string): Promise<void> {
  const fs = requireFirestore();
  await setDoc(doc(fs, 'duas', duaId), {
    id: duaId,
    isBuiltInOverride: true,
    reverted: true,
    updatedAt: serverTimestamp(),
  });
  await db.remoteDuas.delete(duaId);
  await hydrateCatalogFromDb();
}

export async function adminPublishChapter(input: {
  id: number;
  titleBangla: string;
  subtitleBangla: string;
  searchAliases?: string[];
}): Promise<void> {
  const fs = requireFirestore();
  const id = Math.trunc(input.id);
  const aliases = (input.searchAliases ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const payload = cleanUndefined({
    id,
    titleBangla: input.titleBangla.trim(),
    subtitleBangla: input.subtitleBangla.trim(),
    searchAliases: aliases.length > 0 ? aliases : undefined,
    deleted: false,
    reverted: false,
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(fs, 'duaChapters', String(id)), payload);

  await db.remoteDuaChapters.put({
    id,
    titleBangla: input.titleBangla.trim(),
    subtitleBangla: input.subtitleBangla.trim(),
    searchAliases: aliases.length > 0 ? aliases : undefined,
    updatedAt: Date.now(),
  });
  await hydrateCatalogFromDb();
}

export async function adminDeleteOrHideChapter(chapterId: number): Promise<void> {
  const fs = requireFirestore();
  const id = Math.trunc(chapterId);
  await setDoc(doc(fs, 'duaChapters', String(id)), {
    id,
    deleted: true,
    updatedAt: serverTimestamp(),
  });
  if (isBuiltInChapterId(id)) {
    await db.remoteDuaChapters.put({ id, deleted: true, updatedAt: Date.now() });
  } else {
    await db.remoteDuaChapters.delete(id);
  }
  await hydrateCatalogFromDb();
}

export async function adminRevertBuiltInChapter(chapterId: number): Promise<void> {
  const fs = requireFirestore();
  const id = Math.trunc(chapterId);
  await setDoc(doc(fs, 'duaChapters', String(id)), {
    id,
    reverted: true,
    updatedAt: serverTimestamp(),
  });
  await db.remoteDuaChapters.delete(id);
  await hydrateCatalogFromDb();
}

export async function adminPublishRoutineTemplate(input: {
  id: string;
  title: string;
  description?: string;
  assignedDays: number[];
  items: RoutineItemRef[];
  featured?: boolean;
  seasonTag?: string;
  order: number;
  version: number;
}): Promise<void> {
  const fs = requireFirestore();
  const payload = cleanUndefined({
    id: input.id,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    assignedDays: input.assignedDays,
    items: input.items,
    featured: Boolean(input.featured),
    seasonTag: input.seasonTag?.trim() || undefined,
    order: Math.max(0, Math.trunc(input.order)),
    version: Math.max(1, Math.trunc(input.version)),
    deleted: false,
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(fs, 'routineTemplates', input.id), payload);

  await db.remoteRoutineTemplates.put({
    id: input.id,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    assignedDays: input.assignedDays,
    items: input.items,
    featured: Boolean(input.featured),
    seasonTag: input.seasonTag?.trim() || undefined,
    order: Math.max(0, Math.trunc(input.order)),
    version: Math.max(1, Math.trunc(input.version)),
    updatedAt: Date.now(),
  });
  await hydrateCatalogFromDb();
}

export async function adminDeleteRoutineTemplate(templateId: string): Promise<void> {
  const fs = requireFirestore();
  await setDoc(doc(fs, 'routineTemplates', templateId), {
    id: templateId,
    deleted: true,
    updatedAt: serverTimestamp(),
  });
  await db.remoteRoutineTemplates.delete(templateId);
  await hydrateCatalogFromDb();
}

export async function adminPublishSurahOverride(input: {
  surahId: number;
  descriptionBangla?: string;
  fazilatBangla?: string;
  fazilatRef?: string;
  occasionTags?: string[];
}): Promise<void> {
  const fs = requireFirestore();
  const surahId = Math.trunc(input.surahId);
  const tags = (input.occasionTags ?? []).map((t) => t.trim()).filter(Boolean);
  const payload = cleanUndefined({
    surahId,
    descriptionBangla: input.descriptionBangla?.trim() || undefined,
    fazilatBangla: input.fazilatBangla?.trim() || undefined,
    fazilatRef: input.fazilatRef?.trim() || undefined,
    occasionTags: tags.length > 0 ? tags : undefined,
    deleted: false,
    reverted: false,
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(fs, 'surahOverrides', String(surahId)), payload);

  await db.remoteSurahOverrides.put({
    surahId,
    descriptionBangla: input.descriptionBangla?.trim() || undefined,
    fazilatBangla: input.fazilatBangla?.trim() || undefined,
    fazilatRef: input.fazilatRef?.trim() || undefined,
    occasionTags: tags.length > 0 ? tags : undefined,
    updatedAt: Date.now(),
  });
  await hydrateCatalogFromDb();
}

export async function adminRevertSurahOverride(surahId: number): Promise<void> {
  const fs = requireFirestore();
  const id = Math.trunc(surahId);
  await setDoc(doc(fs, 'surahOverrides', String(id)), {
    surahId: id,
    reverted: true,
    updatedAt: serverTimestamp(),
  });
  await db.remoteSurahOverrides.delete(id);
  await hydrateCatalogFromDb();
}

export async function adminPublishFeaturedCard(input: {
  id: string;
  titleBangla: string;
  bodyBangla: string;
  arabicSnippet?: string;
  badgeLabel?: string;
  action?: FeaturedCardAction;
  active: boolean;
  startDate?: string;
  endDate?: string;
  priority: number;
}): Promise<void> {
  const fs = requireFirestore();
  const payload = cleanUndefined({
    id: input.id,
    titleBangla: input.titleBangla.trim(),
    bodyBangla: input.bodyBangla.trim(),
    arabicSnippet: input.arabicSnippet?.trim() || undefined,
    badgeLabel: input.badgeLabel?.trim() || undefined,
    action: input.action,
    active: Boolean(input.active),
    startDate: input.startDate?.trim() || undefined,
    endDate: input.endDate?.trim() || undefined,
    priority: Math.max(0, Math.trunc(input.priority)),
    deleted: false,
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(fs, 'featuredCards', input.id), payload);

  await db.remoteFeaturedCards.put({
    id: input.id,
    titleBangla: input.titleBangla.trim(),
    bodyBangla: input.bodyBangla.trim(),
    arabicSnippet: input.arabicSnippet?.trim() || undefined,
    badgeLabel: input.badgeLabel?.trim() || undefined,
    action: input.action,
    active: Boolean(input.active),
    startDate: input.startDate?.trim() || undefined,
    endDate: input.endDate?.trim() || undefined,
    priority: Math.max(0, Math.trunc(input.priority)),
    updatedAt: Date.now(),
  });
  await hydrateCatalogFromDb();
}

export async function adminDeleteFeaturedCard(cardId: string): Promise<void> {
  const fs = requireFirestore();
  await setDoc(doc(fs, 'featuredCards', cardId), {
    id: cardId,
    deleted: true,
    updatedAt: serverTimestamp(),
  });
  await db.remoteFeaturedCards.delete(cardId);
  await hydrateCatalogFromDb();
}
