import { SURAH_MAP, type SurahMeta } from '../data/surahs';
import type { CachedSurah } from '../db/database';
import { normalizeIndoPakText } from '../utils/formatters';
import {
  hasArabicChars,
  normalizeArabicForSearch,
  type HighlightSegment,
} from '../utils/searchEngine';

const QURAN_API_BASE = 'https://api.quran.com/api/v4';
const ONLINE_SEARCH_TIMEOUT_MS = 10000;
const ONLINE_CACHE_MAX = 30;

export interface VerseSearchResult {
  verseKey: string; // e.g. "2:255"
  surah: SurahMeta;
  ayahNumber: number;
  arabicText: string;
  translationSegments?: HighlightSegment[];
  arabicHighlightedSegments?: HighlightSegment[];
  translationName?: string;
  pageNumber?: number;
  juzNumber?: number;
  source: 'offline' | 'online' | 'both';
}

/* ============================================================================
 * 1. Offline Cached Quran Verse Search (IndexedDB cachedSurahs)
 * ========================================================================== */

/**
 * Searches all offline-downloaded Surahs in IndexedDB by harakat-stripped Arabic.
 * Instant (0ms network) and works 100% offline.
 */
export function searchCachedVerses(
  rawQuery: string,
  cachedSurahs: CachedSurah[],
  limit = 25
): VerseSearchResult[] {
  const trimmed = rawQuery.trim();
  if (!trimmed || cachedSurahs.length === 0) return [];
  if (!hasArabicChars(trimmed)) return [];

  const normQuery = normalizeArabicForSearch(trimmed);
  if (normQuery.length < 2) return [];
  const queryTokens = normQuery.split(' ').filter((t) => t.length >= 2);

  const results: VerseSearchResult[] = [];

  for (const surahCache of cachedSurahs) {
    const meta = SURAH_MAP[surahCache.surahId];
    if (!meta || !Array.isArray(surahCache.verses)) continue;

    for (const verse of surahCache.verses) {
      const normVerse = normalizeArabicForSearch(verse.text_indopak);
      if (!normVerse) continue;

      const phraseMatch = normVerse.includes(normQuery);
      const tokenMatch =
        !phraseMatch &&
        queryTokens.length > 1 &&
        queryTokens.every((tok) => normVerse.includes(tok));

      if (phraseMatch || tokenMatch) {
        results.push({
          verseKey: `${meta.id}:${verse.verse_number}`,
          surah: meta,
          ayahNumber: verse.verse_number,
          arabicText: normalizeIndoPakText(verse.text_indopak),
          pageNumber: verse.page_number,
          juzNumber: verse.juz_number,
          source: 'offline',
        });

        if (results.length >= limit) return results;
      }
    }
  }

  return results;
}

/* ============================================================================
 * 2. Online Full-Quran Search (Quran.com v4 /search — 6,236 ayahs BN/AR/EN)
 * ========================================================================== */

interface QuranApiSearchResponse {
  search?: {
    query?: string;
    total_results?: number;
    current_page?: number;
    total_pages?: number;
    results?: Array<{
      verse_key?: string;
      verse_id?: number;
      text?: string;
      highlighted?: string | null;
      translations?: Array<{
        text?: string;
        resource_id?: number;
        name?: string;
      }>;
    }>;
  };
}

export interface OnlineVerseSearchPage {
  results: VerseSearchResult[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Safely converts Quran.com search HTML (with `<em>...</em>` highlights and
 * optional `<sup ...>1</sup>` footnote markers) into safe React segments.
 */
export function parseQuranHighlightHtml(html: string): HighlightSegment[] {
  if (!html) return [];
  // Remove footnote superscript tags completely
  const withoutFootnotes = html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '');
  const segments: HighlightSegment[] = [];
  const emRegex = /<em\b[^>]*>([\s\S]*?)<\/em>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = emRegex.exec(withoutFootnotes)) !== null) {
    if (match.index > lastIndex) {
      const plain = decodeHtmlEntities(
        withoutFootnotes.slice(lastIndex, match.index).replace(/<[^>]+>/g, '')
      );
      if (plain) segments.push({ text: plain, highlight: false });
    }
    const inner = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ''));
    if (inner) segments.push({ text: inner, highlight: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < withoutFootnotes.length) {
    const tail = decodeHtmlEntities(
      withoutFootnotes.slice(lastIndex).replace(/<[^>]+>/g, '')
    );
    if (tail) segments.push({ text: tail, highlight: false });
  }

  return segments;
}

const onlineCache = new Map<string, OnlineVerseSearchPage>();
const singleVerseCache = new Map<string, string>();
const SINGLE_VERSE_CACHE_MAX = 60;

interface QuranApiSingleVerseResponse {
  verse?: {
    text_indopak_nastaleeq?: string;
    text_indopak?: string;
  };
}

/**
 * Fetches a single IndoPak verse text by surah:ayah key (used to enrich Ayah Smart Jumps
 * like "2:23" when the Surah isn't cached offline in IndexedDB yet).
 */
export async function fetchSingleVerseByKey(
  surahId: number,
  ayahNumber: number,
  signal?: AbortSignal
): Promise<string | null> {
  const verseKey = `${surahId}:${ayahNumber}`;
  const cached = singleVerseCache.get(verseKey);
  if (cached) return cached;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    ONLINE_SEARCH_TIMEOUT_MS
  );
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const url = `${QURAN_API_BASE}/verses/by_key/${encodeURIComponent(
      verseKey
    )}?fields=text_indopak_nastaleeq,text_indopak`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const data = (await res.json()) as QuranApiSingleVerseResponse;
    const raw =
      data.verse?.text_indopak_nastaleeq ?? data.verse?.text_indopak ?? '';
    const text = raw ? normalizeIndoPakText(raw) : '';
    if (!text) return null;

    if (singleVerseCache.size >= SINGLE_VERSE_CACHE_MAX) {
      const oldestKey = singleVerseCache.keys().next().value;
      if (oldestKey !== undefined) singleVerseCache.delete(oldestKey);
    }
    singleVerseCache.set(verseKey, text);
    return text;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    return null;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

function cacheOnlineResult(key: string, value: OnlineVerseSearchPage) {
  if (onlineCache.size >= ONLINE_CACHE_MAX) {
    const oldestKey = onlineCache.keys().next().value;
    if (oldestKey !== undefined) onlineCache.delete(oldestKey);
  }
  onlineCache.set(key, value);
}

const EMPTY_ONLINE_PAGE: OnlineVerseSearchPage = {
  results: [],
  totalResults: 0,
  currentPage: 1,
  totalPages: 0,
  hasMore: false,
};

/**
 * Queries Quran.com v4 search API across all 6,236 ayahs (Bangla translation,
 * English & Arabic) with pagination support. Returns cached page immediately if available.
 */
export async function searchQuranOnline(
  rawQuery: string,
  options?: {
    page?: number;
    size?: number;
    signal?: AbortSignal;
  }
): Promise<OnlineVerseSearchPage> {
  const q = rawQuery.trim();
  const page = Math.max(1, options?.page ?? 1);
  const size = Math.min(50, Math.max(5, options?.size ?? 20));
  const signal = options?.signal;

  if (q.length < 2) return EMPTY_ONLINE_PAGE;

  const cacheKey = `${q.toLowerCase()}::p${page}::s${size}`;
  const cached = onlineCache.get(cacheKey);
  if (cached) return cached;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return EMPTY_ONLINE_PAGE;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    ONLINE_SEARCH_TIMEOUT_MS
  );
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const url = `${QURAN_API_BASE}/search?q=${encodeURIComponent(q)}&size=${size}&page=${page}&language=bn`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return EMPTY_ONLINE_PAGE;

    const data = (await res.json()) as QuranApiSearchResponse;
    const rawResults = data.search?.results;
    if (!Array.isArray(rawResults)) return EMPTY_ONLINE_PAGE;

    const parsed: VerseSearchResult[] = [];
    const seenKeys = new Set<string>();

    for (const item of rawResults) {
      if (!item.verse_key || seenKeys.has(item.verse_key)) continue;
      const [sStr, aStr] = item.verse_key.split(':');
      const surahId = Number.parseInt(sStr ?? '', 10);
      const ayahNumber = Number.parseInt(aStr ?? '', 10);
      const meta = SURAH_MAP[surahId];
      if (!meta || !Number.isFinite(ayahNumber) || ayahNumber < 1) continue;

      seenKeys.add(item.verse_key);

      const firstTranslation = item.translations?.[0];
      const translationSegments = firstTranslation?.text
        ? parseQuranHighlightHtml(firstTranslation.text)
        : undefined;
      const arabicHighlightedSegments = item.highlighted
        ? parseQuranHighlightHtml(item.highlighted)
        : undefined;

      parsed.push({
        verseKey: item.verse_key,
        surah: meta,
        ayahNumber,
        arabicText: item.text ? normalizeIndoPakText(item.text) : '',
        translationSegments,
        arabicHighlightedSegments,
        translationName: firstTranslation?.name,
        source: 'online',
      });
    }

    const totalResults =
      typeof data.search?.total_results === 'number'
        ? data.search.total_results
        : parsed.length;
    const totalPages =
      typeof data.search?.total_pages === 'number'
        ? data.search.total_pages
        : Math.ceil(totalResults / size);
    const currentPage =
      typeof data.search?.current_page === 'number'
        ? data.search.current_page
        : page;

    const pageResult: OnlineVerseSearchPage = {
      results: parsed,
      totalResults,
      currentPage,
      totalPages,
      hasMore: currentPage < totalPages && parsed.length > 0,
    };

    cacheOnlineResult(cacheKey, pageResult);
    return pageResult;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    return EMPTY_ONLINE_PAGE;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Merges offline Arabic matches & online Quran.com matches without duplicates. */
export function mergeVerseSearchResults(
  offline: VerseSearchResult[],
  online: VerseSearchResult[]
): VerseSearchResult[] {
  const byKey = new Map<string, VerseSearchResult>();

  for (const item of offline) {
    byKey.set(item.verseKey, item);
  }

  for (const item of online) {
    const existing = byKey.get(item.verseKey);
    if (existing) {
      byKey.set(item.verseKey, {
        ...existing,
        translationSegments:
          item.translationSegments ?? existing.translationSegments,
        translationName: item.translationName ?? existing.translationName,
        source: 'both',
      });
    } else {
      byKey.set(item.verseKey, item);
    }
  }

  return Array.from(byKey.values());
}
