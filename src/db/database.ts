import Dexie, { type Table } from 'dexie';
import { DUA_MAP } from '../data/duas';
import { SURAH_MAP } from '../data/surahs';

export interface SurahRoutineItem {
  kind?: 'surah';
  surahId: number;
  startAyah?: number;
  endAyah?: number;
}

export interface DuaRoutineItem {
  kind: 'dua';
  duaId: string;
  targetCount?: number;
}

export type RoutineItem = SurahRoutineItem | DuaRoutineItem;

export interface NormalizedSurahRoutineItem {
  kind: 'surah';
  surahId: number;
  startAyah: number;
  endAyah: number;
}

export interface NormalizedDuaRoutineItem {
  kind: 'dua';
  duaId: string;
  targetCount: number;
}

export type NormalizedRoutineItem =
  | NormalizedSurahRoutineItem
  | NormalizedDuaRoutineItem;

export function isDuaRoutineItem(
  item: RoutineItem | NormalizedRoutineItem
): item is DuaRoutineItem | NormalizedDuaRoutineItem {
  return item.kind === 'dua' && 'duaId' in item;
}

export interface Routine {
  id: string;
  title: string; // e.g., "জুমুআ রুটিন", "দৈনিক মাগরিব"
  assignedDays: number[]; // 0 = Sun, 5 = Fri, empty = manual
  surahIds: number[]; // Backwards compatibility + surah filter lookup
  items?: RoutineItem[]; // Ordered mixed surah + dua items
  createdAt: number;
}

export interface RoutineProgress {
  routineId: string;
  lastReadSurah: number; // 0 when active item is a Dua
  lastReadAyah: number;
  lastReadDuaId?: string;
  lastReadItemIndex?: number;
  lastItemCompleted?: boolean;
  completedItemIndexes?: number[];
  completedAyahsCount: number; // Stored progress units completed (ayahs + completed duas)
  totalAyahsCount: number; // Stored total progress units (ayahs + duas)
  percentage: number;
  lastUpdated: number;
}

export interface GlobalLastRead {
  id: string; // 'current'
  surahId: number;
  surahNameBangla: string;
  ayahNumber: number;
  pageNumber: number;
  timestamp: number;
}

export interface ReadingHistory {
  date: string; // YYYY-MM-DD
  ayahsCount: number;
  routinesCompleted: string[];
}

export interface CachedVerse {
  id: number;
  verse_number: number;
  text_indopak: string;
  page_number: number;
  juz_number: number;
}

export interface CachedSurah {
  surahId: number;
  nameArabic: string;
  nameBangla: string;
  totalVerses: number;
  verses: CachedVerse[];
}

export type ThemeMode = 'paper' | 'olive' | 'black';

export interface Settings {
  key: string;
  theme: ThemeMode;
  fontSize: number; // 24px - 44px
  keepScreenAwake: boolean; // Screen Wake Lock API
  autoScrollSpeed: number; // 0 = off, 1 = 1x, 2 = 1.5x, etc.
  offlineDownloaded: boolean;
  showDuaTransliteration?: boolean;
  bookmarkedDuaIds?: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  theme: 'paper',
  fontSize: 32,
  keepScreenAwake: true,
  autoScrollSpeed: 0,
  offlineDownloaded: false,
  showDuaTransliteration: true,
  bookmarkedDuaIds: [],
};

export class SukoonDatabase extends Dexie {
  routines!: Table<Routine, string>;
  routineProgress!: Table<RoutineProgress, string>;
  globalLastRead!: Table<GlobalLastRead, string>;
  readingHistory!: Table<ReadingHistory, string>;
  cachedSurahs!: Table<CachedSurah, number>;
  settings!: Table<Settings, string>;

  constructor() {
    super('SukoonQuranDB');
    this.version(1).stores({
      routines: 'id, createdAt',
      routineProgress: 'routineId, lastUpdated',
      globalLastRead: 'id',
      readingHistory: 'date',
      cachedSurahs: 'surahId',
      settings: 'key',
    });
  }
}

export const db = new SukoonDatabase();

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getRoutineItems(
  routine: Pick<Routine, 'surahIds' | 'items'>
): NormalizedRoutineItem[] {
  const source: RoutineItem[] =
    routine.items && routine.items.length > 0
      ? routine.items
      : routine.surahIds.map((id) => ({ kind: 'surah', surahId: id }));

  const normalized: NormalizedRoutineItem[] = [];
  for (const item of source) {
    if (isDuaRoutineItem(item)) {
      const dua = DUA_MAP[item.duaId];
      if (!dua) continue;
      normalized.push({
        kind: 'dua',
        duaId: item.duaId,
        targetCount: Math.max(1, item.targetCount ?? dua.repeatCount ?? 1),
      });
    } else {
      const meta = SURAH_MAP[item.surahId];
      if (!meta) continue;
      const total = meta.versesCount;
      const start = Math.min(Math.max(item.startAyah ?? 1, 1), total);
      const end = Math.min(Math.max(item.endAyah ?? total, start), total);
      normalized.push({
        kind: 'surah',
        surahId: item.surahId,
        startAyah: start,
        endAyah: end,
      });
    }
  }
  return normalized;
}

export function getRoutineItemUnits(item: NormalizedRoutineItem): number {
  return item.kind === 'dua' ? 1 : item.endAyah - item.startAyah + 1;
}

export function getRoutineSummaryCounts(
  input: Pick<Routine, 'surahIds' | 'items'> | RoutineItem[]
): {
  totalUnits: number;
  totalAyahs: number;
  duaCount: number;
  surahCount: number;
} {
  const items = Array.isArray(input)
    ? getRoutineItems({ surahIds: [], items: input })
    : getRoutineItems(input);

  let totalAyahs = 0;
  let duaCount = 0;
  let surahCount = 0;
  for (const item of items) {
    if (item.kind === 'dua') {
      duaCount += 1;
    } else {
      surahCount += 1;
      totalAyahs += item.endAyah - item.startAyah + 1;
    }
  }
  return {
    totalUnits: totalAyahs + duaCount,
    totalAyahs,
    duaCount,
    surahCount,
  };
}

export function computeRoutineTotalAyahs(
  input: Pick<Routine, 'surahIds' | 'items'> | RoutineItem[] | number[]
): number {
  if (Array.isArray(input)) {
    if (input.length === 0) return 0;
    if (typeof input[0] === 'number') {
      return (input as number[]).reduce(
        (sum, id) => sum + (SURAH_MAP[id]?.versesCount ?? 0),
        0
      );
    }
    return getRoutineItems({ surahIds: [], items: input as RoutineItem[] }).reduce(
      (sum, item) => sum + getRoutineItemUnits(item),
      0
    );
  }
  return getRoutineItems(input).reduce(
    (sum, item) => sum + getRoutineItemUnits(item),
    0
  );
}

export function computeRoutineCompletedAyahs(
  routine: Pick<Routine, 'surahIds' | 'items'>,
  lastReadSurah: number,
  lastReadAyah: number,
  itemIndex?: number
): number {
  const items = getRoutineItems(routine);
  let completed = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'dua') {
      completed += 1;
      continue;
    }
    const span = item.endAyah - item.startAyah + 1;
    const matchesItem =
      itemIndex !== undefined
        ? i === itemIndex && item.surahId === lastReadSurah
        : item.surahId === lastReadSurah &&
          lastReadAyah >= item.startAyah &&
          lastReadAyah <= item.endAyah;

    if (matchesItem || (itemIndex === undefined && item.surahId === lastReadSurah)) {
      const within = Math.min(Math.max(lastReadAyah - item.startAyah + 1, 0), span);
      completed += within;
      break;
    }
    completed += span;
  }
  return completed;
}

export function computeRoutineCompletedUnitsForDua(
  routine: Pick<Routine, 'surahIds' | 'items'>,
  duaId: string,
  itemIndex: number | undefined,
  completed: boolean
): number {
  const items = getRoutineItems(routine);
  let units = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isMatch =
      item.kind === 'dua' &&
      (itemIndex !== undefined ? i === itemIndex && item.duaId === duaId : item.duaId === duaId);
    if (isMatch) {
      if (completed) units += 1;
      break;
    }
    units += getRoutineItemUnits(item);
  }
  return units;
}

export function getCompletedItemIndexes(
  routine: Pick<Routine, 'surahIds' | 'items'>,
  progress?: RoutineProgress
): number[] {
  if (!progress) return [];
  const items = getRoutineItems(routine);
  if (items.length === 0) return [];

  if (Array.isArray(progress.completedItemIndexes)) {
    return Array.from(
      new Set(
        progress.completedItemIndexes.filter(
          (idx) => Number.isInteger(idx) && idx >= 0 && idx < items.length
        )
      )
    ).sort((a, b) => a - b);
  }

  let lastIdx =
    progress.lastReadItemIndex !== undefined &&
    progress.lastReadItemIndex >= 0 &&
    progress.lastReadItemIndex < items.length
      ? progress.lastReadItemIndex
      : -1;

  if (lastIdx === -1) {
    if (progress.lastReadDuaId) {
      lastIdx = items.findIndex(
        (it) => it.kind === 'dua' && it.duaId === progress.lastReadDuaId
      );
    } else if (progress.lastReadSurah > 0) {
      lastIdx = items.findIndex(
        (it) =>
          it.kind === 'surah' &&
          it.surahId === progress.lastReadSurah &&
          progress.lastReadAyah >= it.startAyah &&
          progress.lastReadAyah <= it.endAyah
      );
      if (lastIdx === -1) {
        lastIdx = items.findIndex(
          (it) => it.kind === 'surah' && it.surahId === progress.lastReadSurah
        );
      }
    }
  }

  if (lastIdx === -1) {
    return (progress.percentage ?? 0) >= 100
      ? items.map((_, idx) => idx)
      : [];
  }

  const indexes: number[] = [];
  for (let i = 0; i < lastIdx; i++) {
    indexes.push(i);
  }
  const activeItem = items[lastIdx];
  const isActiveDone =
    Boolean(progress.lastItemCompleted) ||
    (progress.percentage ?? 0) >= 100 ||
    (activeItem.kind === 'surah' && progress.lastReadAyah >= activeItem.endAyah);
  if (isActiveDone) {
    indexes.push(lastIdx);
  }
  return indexes;
}

export function computeRoutineProgressMetrics(
  routine: Pick<Routine, 'surahIds' | 'items'>,
  completedIndexes: number[],
  partialSurah?: { itemIndex: number; ayahNumber: number }
): { completedUnits: number; totalUnits: number; percentage: number } {
  const items = getRoutineItems(routine);
  const completedSet = new Set(completedIndexes);
  let totalUnits = 0;
  let completedUnits = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const span = getRoutineItemUnits(item);
    totalUnits += span;
    if (completedSet.has(i)) {
      completedUnits += span;
    } else if (
      partialSurah &&
      partialSurah.itemIndex === i &&
      item.kind === 'surah'
    ) {
      const within = Math.min(
        Math.max(partialSurah.ayahNumber - item.startAyah + 1, 0),
        span
      );
      completedUnits += within;
    }
  }

  const percentage =
    totalUnits > 0
      ? Math.min(100, Math.round((completedUnits / totalUnits) * 100))
      : 0;

  return { completedUnits, totalUnits, percentage };
}

export async function toggleRoutineItemCompleted(params: {
  routineId: string;
  itemIndex: number;
  completed: boolean;
}): Promise<RoutineProgress | undefined> {
  const { routineId, itemIndex, completed } = params;
  const now = Date.now();
  const todayKey = getTodayDateKey();
  let updated: RoutineProgress | undefined;

  await db.transaction(
    'rw',
    [db.routineProgress, db.routines, db.readingHistory],
    async () => {
      const routine = await db.routines.get(routineId);
      if (!routine) return;

      const items = getRoutineItems(routine);
      if (itemIndex < 0 || itemIndex >= items.length) return;

      const existing = await db.routineProgress.get(routineId);
      const completedSet = new Set(getCompletedItemIndexes(routine, existing));
      if (completed) {
        completedSet.add(itemIndex);
      } else {
        completedSet.delete(itemIndex);
      }
      const nextCompletedIndexes = Array.from(completedSet).sort((a, b) => a - b);

      const clearedActive = !completed && existing?.lastReadItemIndex === itemIndex;
      const partialSurah =
        !clearedActive &&
        existing?.lastReadItemIndex !== undefined &&
        existing.lastReadItemIndex !== itemIndex &&
        !completedSet.has(existing.lastReadItemIndex) &&
        items[existing.lastReadItemIndex]?.kind === 'surah' &&
        existing.lastReadAyah > 0
          ? { itemIndex: existing.lastReadItemIndex, ayahNumber: existing.lastReadAyah }
          : undefined;

      const { completedUnits, totalUnits, percentage } =
        computeRoutineProgressMetrics(routine, nextCompletedIndexes, partialSurah);

      updated = {
        routineId,
        lastReadSurah: clearedActive ? 0 : existing?.lastReadSurah ?? 0,
        lastReadAyah: clearedActive ? 0 : existing?.lastReadAyah ?? 0,
        lastReadDuaId: clearedActive ? undefined : existing?.lastReadDuaId,
        lastReadItemIndex: clearedActive ? undefined : existing?.lastReadItemIndex,
        lastItemCompleted:
          clearedActive
            ? false
            : existing?.lastReadItemIndex !== undefined
              ? completedSet.has(existing.lastReadItemIndex)
              : completed,
        completedItemIndexes: nextCompletedIndexes,
        completedAyahsCount: completedUnits,
        totalAyahsCount: totalUnits,
        percentage,
        lastUpdated: now,
      };

      await db.routineProgress.put(updated);

      if (percentage >= 100) {
        const todayRecord = (await db.readingHistory.get(todayKey)) ?? {
          date: todayKey,
          ayahsCount: 0,
          routinesCompleted: [],
        };
        if (!todayRecord.routinesCompleted.includes(routineId)) {
          await db.readingHistory.put({
            date: todayKey,
            ayahsCount: todayRecord.ayahsCount,
            routinesCompleted: [...todayRecord.routinesCompleted, routineId],
          });
        }
      }
    }
  );

  return updated;
}

let initPromise: Promise<void> | null = null;

export function ensureDatabaseInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const existingSettings = await db.settings.get('app');
      if (!existingSettings) {
        await db.settings.put(DEFAULT_SETTINGS);
      }
    })();
  }
  return initPromise;
}

export async function updateReadingProgress(params: {
  surahId: number;
  ayahNumber: number;
  pageNumber: number;
  routineId?: string;
  routineItemIndex?: number;
  incrementTodayAyahs?: number;
  markItemCompleted?: boolean;
}): Promise<void> {
  const {
    surahId,
    ayahNumber,
    pageNumber,
    routineId,
    routineItemIndex,
    incrementTodayAyahs = 0,
    markItemCompleted = false,
  } = params;
  const surah = SURAH_MAP[surahId];
  if (!surah) return;

  const now = Date.now();
  const todayKey = getTodayDateKey();

  await db.transaction(
    'rw',
    [db.globalLastRead, db.routineProgress, db.routines, db.readingHistory],
    async () => {
      await db.globalLastRead.put({
        id: 'current',
        surahId,
        surahNameBangla: surah.nameBangla,
        ayahNumber,
        pageNumber,
        timestamp: now,
      });
      if (ayahNumber >= surah.versesCount) {
        await db.globalLastRead.delete(`surah-${surahId}`);
      } else {
        await db.globalLastRead.put({
          id: `surah-${surahId}`,
          surahId,
          surahNameBangla: surah.nameBangla,
          ayahNumber,
          pageNumber,
          timestamp: now,
        });
      }

      let completedRoutineNow = false;
      if (routineId) {
        const routine = await db.routines.get(routineId);
        const items = routine ? getRoutineItems(routine) : [];
        const indexedItem =
          routineItemIndex !== undefined ? items[routineItemIndex] : undefined;
        const resolvedIdx =
          indexedItem && !isDuaRoutineItem(indexedItem) && indexedItem.surahId === surahId
            ? routineItemIndex!
            : items.findIndex((it) => !isDuaRoutineItem(it) && it.surahId === surahId);

        if (routine && resolvedIdx !== -1) {
          const matchedItem = items[resolvedIdx];
          const existingProgress = await db.routineProgress.get(routineId);
          const completedSet = new Set(
            getCompletedItemIndexes(routine, existingProgress)
          );
          const itemDone =
            markItemCompleted ||
            (!isDuaRoutineItem(matchedItem) && ayahNumber >= matchedItem.endAyah);
          if (itemDone) {
            completedSet.add(resolvedIdx);
          }
          const nextCompletedIndexes = Array.from(completedSet).sort((a, b) => a - b);

          const { completedUnits, totalUnits, percentage } =
            computeRoutineProgressMetrics(routine, nextCompletedIndexes, {
              itemIndex: resolvedIdx,
              ayahNumber,
            });

          await db.routineProgress.put({
            routineId,
            lastReadSurah: surahId,
            lastReadAyah: ayahNumber,
            lastReadDuaId: undefined,
            lastReadItemIndex: resolvedIdx,
            lastItemCompleted: completedSet.has(resolvedIdx),
            completedItemIndexes: nextCompletedIndexes,
            completedAyahsCount: completedUnits,
            totalAyahsCount: totalUnits,
            percentage,
            lastUpdated: now,
          });

          if (percentage >= 100) {
            completedRoutineNow = true;
          }
        }
      }

      if (incrementTodayAyahs > 0 || completedRoutineNow) {
        const todayRecord = (await db.readingHistory.get(todayKey)) ?? {
          date: todayKey,
          ayahsCount: 0,
          routinesCompleted: [],
        };
        const updatedRoutines = [...todayRecord.routinesCompleted];
        if (
          completedRoutineNow &&
          routineId &&
          !updatedRoutines.includes(routineId)
        ) {
          updatedRoutines.push(routineId);
        }
        await db.readingHistory.put({
          date: todayKey,
          ayahsCount: todayRecord.ayahsCount + incrementTodayAyahs,
          routinesCompleted: updatedRoutines,
        });
      }
    }
  );
}

export async function getSurahResumeAyah(surahId: number): Promise<number> {
  const surah = SURAH_MAP[surahId];
  if (!surah) return 1;

  const [perSurah, current] = await Promise.all([
    db.globalLastRead.get(`surah-${surahId}`),
    db.globalLastRead.get('current'),
  ]);

  let latest: GlobalLastRead | undefined = perSurah;
  if (
    current &&
    current.surahId === surahId &&
    (!latest || current.timestamp >= latest.timestamp)
  ) {
    latest = current;
  }

  if (!latest) return 1;
  if (latest.ayahNumber <= 1 || latest.ayahNumber >= surah.versesCount) {
    return 1;
  }
  return latest.ayahNumber;
}

export async function updateDuaRoutineProgress(params: {
  routineId: string;
  routineItemIndex?: number;
  duaId: string;
  completed: boolean;
}): Promise<void> {
  const { routineId, routineItemIndex, duaId, completed } = params;
  if (!DUA_MAP[duaId]) return;

  const now = Date.now();
  const todayKey = getTodayDateKey();

  await db.transaction(
    'rw',
    [db.routineProgress, db.routines, db.readingHistory],
    async () => {
      const routine = await db.routines.get(routineId);
      if (!routine) return;

      const items = getRoutineItems(routine);
      const indexedItem =
        routineItemIndex !== undefined ? items[routineItemIndex] : undefined;
      const resolvedIdx =
        indexedItem && isDuaRoutineItem(indexedItem) && indexedItem.duaId === duaId
          ? routineItemIndex!
          : items.findIndex((it) => isDuaRoutineItem(it) && it.duaId === duaId);

      if (resolvedIdx === -1) return;

      const existingProgress = await db.routineProgress.get(routineId);
      const completedSet = new Set(
        getCompletedItemIndexes(routine, existingProgress)
      );
      if (completed) {
        completedSet.add(resolvedIdx);
      }
      const nextCompletedIndexes = Array.from(completedSet).sort((a, b) => a - b);

      const partialSurah =
        existingProgress?.lastReadItemIndex !== undefined &&
        existingProgress.lastReadItemIndex !== resolvedIdx &&
        !completedSet.has(existingProgress.lastReadItemIndex) &&
        items[existingProgress.lastReadItemIndex]?.kind === 'surah' &&
        existingProgress.lastReadAyah > 0
          ? {
              itemIndex: existingProgress.lastReadItemIndex,
              ayahNumber: existingProgress.lastReadAyah,
            }
          : undefined;

      const { completedUnits, totalUnits, percentage } =
        computeRoutineProgressMetrics(routine, nextCompletedIndexes, partialSurah);

      await db.routineProgress.put({
        routineId,
        lastReadSurah: 0,
        lastReadAyah: 0,
        lastReadDuaId: duaId,
        lastReadItemIndex: resolvedIdx,
        lastItemCompleted: completedSet.has(resolvedIdx),
        completedItemIndexes: nextCompletedIndexes,
        completedAyahsCount: completedUnits,
        totalAyahsCount: totalUnits,
        percentage,
        lastUpdated: now,
      });

      if (percentage >= 100) {
        const todayRecord = (await db.readingHistory.get(todayKey)) ?? {
          date: todayKey,
          ayahsCount: 0,
          routinesCompleted: [],
        };
        if (!todayRecord.routinesCompleted.includes(routineId)) {
          await db.readingHistory.put({
            date: todayKey,
            ayahsCount: todayRecord.ayahsCount,
            routinesCompleted: [...todayRecord.routinesCompleted, routineId],
          });
        }
      }
    }
  );
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  app: 'sukoon-quran';
  data: {
    routines: Routine[];
    routineProgress: RoutineProgress[];
    globalLastRead: GlobalLastRead[];
    readingHistory: ReadingHistory[];
    settings: Settings | undefined;
  };
}

export async function exportUserData(): Promise<BackupPayload> {
  const [routines, routineProgress, globalLastRead, readingHistory, settings] =
    await Promise.all([
      db.routines.toArray(),
      db.routineProgress.toArray(),
      db.globalLastRead.toArray(),
      db.readingHistory.toArray(),
      db.settings.get('app'),
    ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'sukoon-quran',
    data: {
      routines,
      routineProgress,
      globalLastRead,
      readingHistory,
      settings,
    },
  };
}

export async function importUserData(raw: unknown): Promise<{
  routinesCount: number;
  historyDays: number;
}> {
  if (!raw || typeof raw !== 'object') {
    throw new Error('অবৈধ ব্যাকআপ ফাইল।');
  }
  const payload = raw as Partial<BackupPayload>;
  if (payload.app !== 'sukoon-quran' || !payload.data) {
    throw new Error('এটি সুকূন অ্যাপের বৈধ JSON ব্যাকআপ নয়।');
  }

  const { routines = [], routineProgress = [], globalLastRead = [], readingHistory = [], settings } =
    payload.data;

  if (!Array.isArray(routines) || !Array.isArray(readingHistory)) {
    throw new Error('ব্যাকআপ ফাইলের কাঠামো সঠিক নয়।');
  }

  await db.transaction(
    'rw',
    [db.routines, db.routineProgress, db.globalLastRead, db.readingHistory, db.settings],
    async () => {
      await db.routines.clear();
      await db.routineProgress.clear();
      await db.globalLastRead.clear();
      await db.readingHistory.clear();

      if (routines.length > 0) await db.routines.bulkPut(routines);
      if (routineProgress.length > 0) await db.routineProgress.bulkPut(routineProgress);
      if (globalLastRead.length > 0) await db.globalLastRead.bulkPut(globalLastRead);
      if (readingHistory.length > 0) await db.readingHistory.bulkPut(readingHistory);

      if (settings && typeof settings === 'object') {
        const cachedCount = await db.cachedSurahs.count();
        await db.settings.put({
          ...DEFAULT_SETTINGS,
          ...settings,
          key: 'app',
          offlineDownloaded: cachedCount >= 114,
        });
      }
    }
  );

  return {
    routinesCount: routines.length,
    historyDays: readingHistory.length,
  };
}
