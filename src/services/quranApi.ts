import { SURAH_MAP, SURAHS } from '../data/surahs';
import {
  DEFAULT_SETTINGS,
  db,
  type CachedSurah,
  type CachedVerse,
} from '../db/database';

const QURAN_API_BASE = 'https://api.quran.com/api/v4';
const REQUEST_TIMEOUT_MS = 20000;
const INDOPAK_SCRIPT_VERSION = 2;

interface ApiVerseResponse {
  verses: Array<{
    id: number;
    verse_number: number;
    text_indopak_nastaleeq?: string;
    text_indopak?: string;
    page_number: number;
    juz_number: number;
  }>;
  pagination: {
    current_page: number;
    next_page: number | null;
    total_pages: number;
    total_records: number;
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function fetchWithTimeout(
  url: string,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export function isSurahFullyCached(
  cached: CachedSurah | undefined,
  surahId: number
): boolean {
  if (!cached) return false;
  const expected = SURAH_MAP[surahId]?.versesCount ?? 1;
  return Array.isArray(cached.verses) && cached.verses.length >= expected;
}

async function fetchSurahFromNetwork(
  surahId: number,
  signal?: AbortSignal
): Promise<CachedSurah> {
  const meta = SURAH_MAP[surahId];
  if (!meta) {
    throw new Error(`সূরা #${surahId} পাওয়া যায়নি।`);
  }

  const allVerses: CachedVerse[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${QURAN_API_BASE}/verses/by_chapter/${surahId}?fields=text_indopak_nastaleeq,text_indopak,page_number,juz_number&per_page=300&page=${page}`;
    const res = await fetchWithTimeout(url, signal);
    if (!res.ok) {
      throw new Error(`কুরআন এপিআই ত্রুটি (${res.status})`);
    }
    const data = (await res.json()) as ApiVerseResponse;
    if (!Array.isArray(data.verses)) {
      throw new Error('অবৈধ এপিআই উত্তর পাওয়া গেছে।');
    }
    for (const v of data.verses) {
      allVerses.push({
        id: v.id,
        verse_number: v.verse_number,
        text_indopak: v.text_indopak_nastaleeq ?? v.text_indopak ?? '',
        page_number: v.page_number,
        juz_number: v.juz_number,
      });
    }
    if (data.pagination?.next_page) {
      page = data.pagination.next_page;
    } else {
      hasMore = false;
    }
  }

  if (allVerses.length < meta.versesCount) {
    throw new Error(`সূরা ${meta.nameBangla}-এর সব আয়াত পাওয়া যায়নি।`);
  }

  const cached: CachedSurah = {
    surahId,
    nameArabic: meta.nameArabic,
    nameBangla: meta.nameBangla,
    totalVerses: meta.versesCount,
    verses: allVerses,
    scriptVersion: INDOPAK_SCRIPT_VERSION,
  };

  await db.cachedSurahs.put(cached);
  return cached;
}

export async function getSurahOfflineFirst(
  surahId: number,
  signal?: AbortSignal
): Promise<CachedSurah> {
  const cached = await db.cachedSurahs.get(surahId);
  if (isSurahFullyCached(cached, surahId)) {
    if (
      cached!.scriptVersion !== INDOPAK_SCRIPT_VERSION &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      fetchSurahFromNetwork(surahId, signal).catch(() => {});
    }
    return cached!;
  }
  return fetchSurahFromNetwork(surahId, signal);
}

export interface OfflineDownloadProgress {
  completed: number;
  total: number;
  currentSurahId: number;
  currentSurahName: string;
}

export async function countCompleteCachedSurahs(): Promise<number> {
  const all = await db.cachedSurahs.toArray();
  return all.filter((c) => isSurahFullyCached(c, c.surahId)).length;
}

export async function countOutdatedCachedSurahs(): Promise<number> {
  const all = await db.cachedSurahs.toArray();
  return all.filter(
    (c) =>
      isSurahFullyCached(c, c.surahId) &&
      c.scriptVersion !== INDOPAK_SCRIPT_VERSION
  ).length;
}

export async function downloadAllSurahsForOffline(
  onProgress: (progress: OfflineDownloadProgress) => void,
  signal?: AbortSignal
): Promise<{ totalCached: number; failedIds: number[] }> {
  const existingRows = await db.cachedSurahs.toArray();
  const upToDateIds = new Set(
    existingRows
      .filter(
        (c) =>
          isSurahFullyCached(c, c.surahId) &&
          c.scriptVersion === INDOPAK_SCRIPT_VERSION
      )
      .map((c) => c.surahId)
  );
  const missing = SURAHS.filter((s) => !upToDateIds.has(s.id));

  let completed = upToDateIds.size;
  const total = SURAHS.length;
  const failedIds: number[] = [];

  onProgress({
    completed,
    total,
    currentSurahId: missing[0]?.id ?? 114,
    currentSurahName: missing[0]?.nameBangla ?? 'সম্পন্ন',
  });

  if (missing.length === 0) {
    const cur = (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
    await db.settings.put({ ...cur, key: 'app', offlineDownloaded: true });
    return { totalCached: total, failedIds: [] };
  }

  // Request persistent storage so mobile OS does not evict offline Quran cache
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  const CONCURRENCY = 2;
  const MAX_ATTEMPTS = 3;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < missing.length) {
      if (signal?.aborted) return;
      const idx = cursor++;
      const surah = missing[idx];

      let success = false;
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !success; attempt++) {
        if (signal?.aborted) return;
        if (attempt > 0) {
          try {
            await sleep(attempt === 1 ? 600 : 1600, signal);
          } catch {
            return;
          }
        }
        try {
          await fetchSurahFromNetwork(surah.id, signal);
          success = true;
        } catch {
          if (signal?.aborted) return;
          if (attempt === MAX_ATTEMPTS - 1) {
            failedIds.push(surah.id);
          }
        }
      }

      if (success) {
        completed++;
      }

      onProgress({
        completed,
        total,
        currentSurahId: surah.id,
        currentSurahName: surah.nameBangla,
      });
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, missing.length) },
    () => worker()
  );
  await Promise.all(workers);

  const totalCached = await countCompleteCachedSurahs();
  const cur = (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
  await db.settings.put({
    ...cur,
    key: 'app',
    offlineDownloaded: totalCached >= 114,
  });

  return { totalCached, failedIds };
}
