import type { DuaItem } from '../data/duas';
import { getMergedDua } from './catalogSnapshot';

export const CUSTOM_DUA_ID_PREFIX = 'custom-dua-';
export const CUSTOM_DUA_CHAPTER_ID = 0;
const VALID_CUSTOM_DUA_ID_RE = /^custom-dua-[a-zA-Z0-9_-]{1,108}$/;

export function isCustomDuaId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(CUSTOM_DUA_ID_PREFIX);
}

export function isValidCustomDuaId(id: string | null | undefined): boolean {
  return typeof id === 'string' && VALID_CUSTOM_DUA_ID_RE.test(id);
}

export interface CustomDua {
  id: string;
  titleBangla: string;
  arabic: string;
  transliteration?: string;
  translationBangla: string;
  repeatCount: number;
  reference?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CustomDuaInput {
  titleBangla: string;
  arabic?: string;
  transliteration?: string;
  translationBangla?: string;
  repeatCount?: number;
  reference?: string;
}

export interface CustomDuaSnapshot {
  version: number;
  hydrated: boolean;
  rawList: CustomDua[];
  rawMap: Record<string, CustomDua>;
  duas: DuaItem[];
  duaMap: Record<string, DuaItem>;
}

export function generateCustomDuaId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${CUSTOM_DUA_ID_PREFIX}${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${CUSTOM_DUA_ID_PREFIX}${Date.now().toString(36)}-${rand}`;
}

export function validateCustomDuaInput(
  input: CustomDuaInput
): { ok: true; cleaned: Required<Pick<CustomDua, 'titleBangla' | 'arabic' | 'translationBangla' | 'repeatCount'>> & Pick<CustomDua, 'transliteration' | 'reference'> } | { ok: false; error: string } {
  const titleBangla = (input.titleBangla ?? '').trim();
  if (!titleBangla) {
    return { ok: false, error: 'দুআর একটি শিরোনাম লিখুন।' };
  }
  if (titleBangla.length > 300) {
    return { ok: false, error: 'শিরোনাম ৩০০ অক্ষরের মধ্যে রাখুন।' };
  }

  const arabic = (input.arabic ?? '').trim();
  const transliterationRaw = (input.transliteration ?? '').trim();
  const translationBangla = (input.translationBangla ?? '').trim();
  const referenceRaw = (input.reference ?? '').trim();

  if (!arabic && !transliterationRaw && !translationBangla) {
    return {
      ok: false,
      error:
        'আরবি পাঠ, বাংলা উচ্চারণ অথবা বাংলা অর্থ/মোনাজাতের অন্তত যেকোনো একটি লিখুন।',
    };
  }

  if (
    arabic.length > 25000 ||
    transliterationRaw.length > 25000 ||
    translationBangla.length > 25000
  ) {
    return {
      ok: false,
      error: 'দুআর লেখা নির্ধারিত সীমার (২৫,০০০ অক্ষর) বেশি হয়েছে।',
    };
  }

  if (referenceRaw.length > 500) {
    return {
      ok: false,
      error: 'নোট বা রেফারেন্স ৫০০ অক্ষরের মধ্যে রাখুন।',
    };
  }

  const rawRepeat = input.repeatCount ?? 1;
  if (
    typeof rawRepeat !== 'number' ||
    !Number.isFinite(rawRepeat) ||
    Math.floor(rawRepeat) < 1 ||
    Math.floor(rawRepeat) > 10000
  ) {
    return {
      ok: false,
      error: 'তাসবিহ সংখ্যা ১ থেকে ১০,০০০ এর মধ্যে দিন।',
    };
  }

  return {
    ok: true,
    cleaned: {
      titleBangla,
      arabic,
      translationBangla,
      repeatCount: Math.floor(rawRepeat),
      ...(transliterationRaw ? { transliteration: transliterationRaw } : {}),
      ...(referenceRaw ? { reference: referenceRaw } : {}),
    },
  };
}

export function normalizeStoredCustomDua(raw: unknown): CustomDua | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  if (!isValidCustomDuaId(id)) return null;

  const validated = validateCustomDuaInput({
    titleBangla: typeof obj.titleBangla === 'string' ? obj.titleBangla : '',
    arabic: typeof obj.arabic === 'string' ? obj.arabic : '',
    transliteration:
      typeof obj.transliteration === 'string' ? obj.transliteration : undefined,
    translationBangla:
      typeof obj.translationBangla === 'string' ? obj.translationBangla : '',
    repeatCount:
      typeof obj.repeatCount === 'number' && Number.isFinite(obj.repeatCount)
        ? Math.max(1, Math.min(10000, Math.floor(obj.repeatCount)))
        : 1,
    reference: typeof obj.reference === 'string' ? obj.reference : undefined,
  });

  if (!validated.ok) return null;

  const now = Date.now();
  const createdAt =
    typeof obj.createdAt === 'number' &&
    Number.isFinite(obj.createdAt) &&
    obj.createdAt > 0
      ? Math.floor(obj.createdAt)
      : now;
  const updatedAt =
    typeof obj.updatedAt === 'number' &&
    Number.isFinite(obj.updatedAt) &&
    obj.updatedAt > 0
      ? Math.floor(obj.updatedAt)
      : createdAt;

  return {
    id,
    ...validated.cleaned,
    createdAt,
    updatedAt,
  };
}

export function customDuaToDuaItem(doc: CustomDua, order: number): DuaItem {
  return {
    id: doc.id,
    chapterId: CUSTOM_DUA_CHAPTER_ID,
    order,
    titleBangla: doc.titleBangla,
    repeatCount: doc.repeatCount,
    arabic: doc.arabic,
    transliteration: doc.transliteration,
    translationBangla: doc.translationBangla,
    reference: doc.reference,
  };
}

function buildSnapshot(
  version: number,
  hydrated: boolean,
  docs: CustomDua[]
): CustomDuaSnapshot {
  const sorted = [...docs].sort((a, b) =>
    a.createdAt !== b.createdAt
      ? a.createdAt - b.createdAt
      : a.id.localeCompare(b.id)
  );
  const rawMap: Record<string, CustomDua> = {};
  const duas: DuaItem[] = [];
  const duaMap: Record<string, DuaItem> = {};

  sorted.forEach((doc, idx) => {
    rawMap[doc.id] = doc;
    const item = customDuaToDuaItem(doc, idx + 1);
    duas.push(item);
    duaMap[item.id] = item;
  });

  return {
    version,
    hydrated,
    rawList: sorted,
    rawMap,
    duas,
    duaMap,
  };
}

let snapshotVersion = 0;
let currentSnapshot: CustomDuaSnapshot = buildSnapshot(0, false, []);
const listeners = new Set<() => void>();

export function subscribeCustomDuasSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCustomDuasSnapshot(): CustomDuaSnapshot {
  return currentSnapshot;
}

export function setCustomDuasSnapshot(docs: CustomDua[]): CustomDuaSnapshot {
  snapshotVersion += 1;
  currentSnapshot = buildSnapshot(snapshotVersion, true, docs);
  for (const listener of listeners) {
    listener();
  }
  return currentSnapshot;
}

export function getCustomDua(duaId: string): DuaItem | undefined {
  return currentSnapshot.duaMap[duaId];
}

export function getRawCustomDua(duaId: string): CustomDua | undefined {
  return currentSnapshot.rawMap[duaId];
}

/**
 * Resolves either a user's personal Custom Dua (`custom-dua-*`) OR a system/CMS Dua.
 * Used ONLY in Routines, DuaReader, and Stats — NEVER in system Dua tabs or Global Search.
 */
export function resolveDuaById(duaId: string): DuaItem | undefined {
  if (isCustomDuaId(duaId)) {
    return currentSnapshot.duaMap[duaId];
  }
  return getMergedDua(duaId);
}

const SEARCH_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

function foldSearchText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[০-৯٠-٩]/g, (ch) => SEARCH_DIGIT_MAP[ch] ?? ch)
    .normalize('NFC')
    .replace(/য\u09bc/g, 'য়')
    .replace(/ড\u09bc/g, 'ড়')
    .replace(/ঢ\u09bc/g, 'ঢ়')
    .replace(
      /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u06DF\u06E1\u0640\u200B-\u200F\uFEFF\uF500-\uF61E]/g,
      ''
    )
    .replace(/[أإآٱٲٳٵ]/g, 'ا')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/[ىیئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ک/g, 'ك')
    .toLowerCase()
    .replace(/দোয়া|দুয়া|দূআ/g, 'দুআ')
    .replace(/ী/g, 'ি')
    .replace(/ূ/g, 'ু')
    .replace(/ণ/g, 'ন')
    .replace(/[ষশ]/g, 'স')
    .replace(/[-_.,:;!?'"’‘“”()[\]{}/\\|।۞•·–—،؛؟]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches strictly within the user's Custom Duas (`আমার দুআ`).
 * Never inspects or returns system duas.
 */
export function searchCustomDuas(
  query: string,
  sourceDuas: readonly DuaItem[] = currentSnapshot.duas
): DuaItem[] {
  const foldedQuery = foldSearchText(query);
  if (!foldedQuery) return [...sourceDuas];
  const tokens = foldedQuery.split(' ').filter(Boolean);
  if (tokens.length === 0) return [...sourceDuas];

  const scored: Array<{ dua: DuaItem; score: number }> = [];

  for (const dua of sourceDuas) {
    if (!isCustomDuaId(dua.id)) continue;
    const titleFolded = foldSearchText(dua.titleBangla);
    const translitFolded = foldSearchText(dua.transliteration ?? '');
    const meaningFolded = foldSearchText(dua.translationBangla);
    const refFolded = foldSearchText(dua.reference ?? '');
    const arabicFolded = foldSearchText(dua.arabic);
    const combined = `${titleFolded} ${translitFolded} ${meaningFolded} ${refFolded} ${arabicFolded}`;

    if (!tokens.every((tok) => combined.includes(tok))) continue;

    let score = 0;
    if (titleFolded === foldedQuery) score += 120;
    else if (titleFolded.startsWith(foldedQuery)) score += 90;
    else if (titleFolded.includes(foldedQuery)) score += 70;
    if (arabicFolded && arabicFolded.includes(foldedQuery)) score += 50;
    if (translitFolded && translitFolded.includes(foldedQuery)) score += 40;
    if (meaningFolded && meaningFolded.includes(foldedQuery)) score += 35;
    if (refFolded && refFolded.includes(foldedQuery)) score += 25;

    scored.push({ dua, score });
  }

  return scored
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.dua.order - b.dua.order))
    .map((s) => s.dua);
}
