import { SURAH_MAP, SURAHS } from '../data/surahs';
import { db, type CachedSurah, type CachedVerse } from '../db/database';

const QURAN_API_BASE = 'https://api.quran.com/api/v4';

interface ApiVerseResponse {
  verses: Array<{
    id: number;
    verse_number: number;
    text_indopak: string;
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
    const url = `${QURAN_API_BASE}/verses/by_chapter/${surahId}?fields=text_indopak,page_number,juz_number&per_page=300&page=${page}`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`কুরআন এপিআই ত্রুটি (${res.status})`);
    }
    const data = (await res.json()) as ApiVerseResponse;
    for (const v of data.verses) {
      allVerses.push({
        id: v.id,
        verse_number: v.verse_number,
        text_indopak: v.text_indopak,
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

  const cached: CachedSurah = {
    surahId,
    nameArabic: meta.nameArabic,
    nameBangla: meta.nameBangla,
    totalVerses: meta.versesCount,
    verses: allVerses,
  };

  await db.cachedSurahs.put(cached);
  return cached;
}

export async function getSurahOfflineFirst(
  surahId: number,
  signal?: AbortSignal
): Promise<CachedSurah> {
  const cached = await db.cachedSurahs.get(surahId);
  if (cached && cached.verses.length > 0) {
    return cached;
  }
  return fetchSurahFromNetwork(surahId, signal);
}

export interface OfflineDownloadProgress {
  completed: number;
  total: number;
  currentSurahId: number;
  currentSurahName: string;
}

export async function downloadAllSurahsForOffline(
  onProgress: (progress: OfflineDownloadProgress) => void,
  signal?: AbortSignal
): Promise<{ totalCached: number; failedIds: number[] }> {
  const existingIds = new Set(await db.cachedSurahs.toCollection().primaryKeys());
  const missing = SURAHS.filter((s) => !existingIds.has(s.id));

  let completed = existingIds.size;
  const total = SURAHS.length;
  const failedIds: number[] = [];

  onProgress({
    completed,
    total,
    currentSurahId: missing[0]?.id ?? 114,
    currentSurahName: missing[0]?.nameBangla ?? 'সম্পন্ন',
  });

  if (missing.length === 0) {
    await db.settings.update('app', { offlineDownloaded: true });
    return { totalCached: total, failedIds: [] };
  }

  const CONCURRENCY = 3;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < missing.length) {
      if (signal?.aborted) return;
      const idx = cursor++;
      const surah = missing[idx];

      let success = false;
      for (let attempt = 0; attempt < 2 && !success; attempt++) {
        if (signal?.aborted) return;
        try {
          await fetchSurahFromNetwork(surah.id, signal);
          success = true;
        } catch (err) {
          if (signal?.aborted) return;
          if (attempt === 1) {
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

  const workers = Array.from({ length: Math.min(CONCURRENCY, missing.length) }, () =>
    worker()
  );
  await Promise.all(workers);

  const totalCached = await db.cachedSurahs.count();
  await db.settings.update('app', { offlineDownloaded: totalCached >= 114 });

  return { totalCached, failedIds };
}
