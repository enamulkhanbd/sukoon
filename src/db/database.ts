import Dexie, { type Table } from 'dexie';
import { SURAH_MAP } from '../data/surahs';

export interface RoutineItem {
  surahId: number;
  startAyah?: number;
  endAyah?: number;
}

export interface NormalizedRoutineItem {
  surahId: number;
  startAyah: number;
  endAyah: number;
}

export interface Routine {
  id: string;
  title: string; // e.g., "জুমুআ রুটিন", "দৈনিক মাগরিব"
  assignedDays: number[]; // 0 = Sun, 5 = Fri, empty = manual
  surahIds: number[]; // e.g., [18, 32, 67]
  items?: RoutineItem[]; // Optional ayah-range items; falls back to full surahIds
  createdAt: number;
}

export interface RoutineProgress {
  routineId: string;
  lastReadSurah: number;
  lastReadAyah: number;
  lastReadItemIndex?: number;
  completedAyahsCount: number;
  totalAyahsCount: number;
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
}

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  theme: 'paper',
  fontSize: 32,
  keepScreenAwake: true,
  autoScrollSpeed: 0,
  offlineDownloaded: false,
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

export function getRoutineItems(routine: Pick<Routine, 'surahIds' | 'items'>): NormalizedRoutineItem[] {
  const source: RoutineItem[] =
    routine.items && routine.items.length > 0
      ? routine.items
      : routine.surahIds.map((id) => ({ surahId: id }));

  return source
    .map((item) => {
      const total = SURAH_MAP[item.surahId]?.versesCount ?? 1;
      const start = Math.min(Math.max(item.startAyah ?? 1, 1), total);
      const end = Math.min(Math.max(item.endAyah ?? total, start), total);
      return {
        surahId: item.surahId,
        startAyah: start,
        endAyah: end,
      };
    })
    .filter((item) => Boolean(SURAH_MAP[item.surahId]));
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
      (sum, item) => sum + (item.endAyah - item.startAyah + 1),
      0
    );
  }
  return getRoutineItems(input).reduce(
    (sum, item) => sum + (item.endAyah - item.startAyah + 1),
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
}): Promise<void> {
  const {
    surahId,
    ayahNumber,
    pageNumber,
    routineId,
    routineItemIndex,
    incrementTodayAyahs = 0,
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

      let completedRoutineNow = false;
      if (routineId) {
        const routine = await db.routines.get(routineId);
        const items = routine ? getRoutineItems(routine) : [];
        const resolvedIdx =
          routineItemIndex !== undefined &&
          items[routineItemIndex]?.surahId === surahId
            ? routineItemIndex
            : items.findIndex((it) => it.surahId === surahId);

        if (routine && resolvedIdx !== -1) {
          const totalAyahsCount = computeRoutineTotalAyahs(routine);
          const completedAyahsCount = computeRoutineCompletedAyahs(
            routine,
            surahId,
            ayahNumber,
            resolvedIdx
          );
          const percentage =
            totalAyahsCount > 0
              ? Math.min(100, Math.round((completedAyahsCount / totalAyahsCount) * 100))
              : 0;

          await db.routineProgress.put({
            routineId,
            lastReadSurah: surahId,
            lastReadAyah: ayahNumber,
            lastReadItemIndex: resolvedIdx,
            completedAyahsCount,
            totalAyahsCount,
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
