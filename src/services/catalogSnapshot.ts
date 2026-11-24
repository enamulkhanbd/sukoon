import type {
  ActiveFeaturedCard,
  ActiveRoutineTemplate,
  MergedDuaChapter,
  MergedDuaItem,
  MergedSurahInfo,
  RemoteDuaChapterDoc,
  RemoteDuaDoc,
  RemoteFeaturedCardDoc,
  RemoteRoutineTemplateDoc,
  RemoteSurahOverrideDoc,
} from '../data/cmsTypes';
import {
  DUA_CHAPTER_MAP as STATIC_DUA_CHAPTER_MAP,
  DUA_CHAPTERS as STATIC_DUA_CHAPTERS,
  DUA_MAP as STATIC_DUA_MAP,
  DUAS as STATIC_DUAS,
} from '../data/duas';
import { SURAH_DESCRIPTIONS as STATIC_SURAH_DESCRIPTIONS } from '../data/surahDescriptions';

export interface CatalogSnapshot {
  version: number;
  hydrated: boolean;
  chapters: MergedDuaChapter[];
  chapterMap: Record<number, MergedDuaChapter>;
  duas: MergedDuaItem[];
  duaMap: Record<string, MergedDuaItem>;
  duasByChapter: Record<number, MergedDuaItem[]>;
  surahInfoMap: Record<number, MergedSurahInfo>;
  allSurahTags: string[];
  routineTemplates: ActiveRoutineTemplate[];
  routineTemplateMap: Record<string, ActiveRoutineTemplate>;
  featuredCards: ActiveFeaturedCard[];
  // Raw remote maps (useful for Admin Panel to show hidden/overridden states)
  remoteDuasMap: Record<string, RemoteDuaDoc>;
  remoteChaptersMap: Record<number, RemoteDuaChapterDoc>;
  remoteSurahOverridesMap: Record<number, RemoteSurahOverrideDoc>;
  remoteTemplatesRaw: RemoteRoutineTemplateDoc[];
  remoteFeaturedCardsRaw: RemoteFeaturedCardDoc[];
}

export function mergeChapters(
  remoteDocs: RemoteDuaChapterDoc[]
): MergedDuaChapter[] {
  const remoteById = new Map<number, RemoteDuaChapterDoc>();
  for (const doc of remoteDocs) {
    remoteById.set(doc.id, doc);
  }

  const merged: MergedDuaChapter[] = [];
  const seenIds = new Set<number>();

  for (const builtIn of STATIC_DUA_CHAPTERS) {
    seenIds.add(builtIn.id);
    const remote = remoteById.get(builtIn.id);
    if (!remote || remote.reverted) {
      merged.push({ ...builtIn, source: 'builtin' });
      continue;
    }
    if (remote.deleted) {
      continue;
    }
    merged.push({
      id: builtIn.id,
      titleBangla: remote.titleBangla?.trim() || builtIn.titleBangla,
      subtitleBangla: remote.subtitleBangla ?? builtIn.subtitleBangla,
      searchAliases: remote.searchAliases,
      source: 'override',
    });
  }

  for (const remote of remoteDocs) {
    if (seenIds.has(remote.id)) continue;
    if (remote.deleted || remote.reverted) continue;
    if (!remote.titleBangla?.trim()) continue;
    merged.push({
      id: remote.id,
      titleBangla: remote.titleBangla.trim(),
      subtitleBangla: remote.subtitleBangla ?? '',
      searchAliases: remote.searchAliases,
      source: 'remote',
    });
  }

  return merged.sort((a, b) => a.id - b.id);
}

export function mergeDuas(
  remoteDocs: RemoteDuaDoc[],
  visibleChapterIds?: Set<number>
): MergedDuaItem[] {
  const remoteById = new Map<string, RemoteDuaDoc>();
  for (const doc of remoteDocs) {
    remoteById.set(doc.id, doc);
  }

  const merged: MergedDuaItem[] = [];
  const seenIds = new Set<string>();

  for (const builtIn of STATIC_DUAS) {
    seenIds.add(builtIn.id);
    const remote = remoteById.get(builtIn.id);
    if (!remote || remote.reverted) {
      if (!visibleChapterIds || visibleChapterIds.has(builtIn.chapterId)) {
        merged.push({ ...builtIn, source: 'builtin' });
      }
      continue;
    }
    if (remote.deleted) {
      continue;
    }
    const chapterId = remote.chapterId ?? builtIn.chapterId;
    if (visibleChapterIds && !visibleChapterIds.has(chapterId)) {
      continue;
    }
    merged.push({
      id: builtIn.id,
      chapterId,
      order: remote.order ?? builtIn.order,
      titleBangla: remote.titleBangla?.trim() || builtIn.titleBangla,
      repeatCount: remote.repeatCount ?? builtIn.repeatCount,
      occasionNote:
        remote.occasionNote !== undefined
          ? remote.occasionNote || undefined
          : builtIn.occasionNote,
      arabic: remote.arabic?.trim() || builtIn.arabic,
      transliteration:
        remote.transliteration !== undefined
          ? remote.transliteration || undefined
          : builtIn.transliteration,
      translationBangla:
        remote.translationBangla !== undefined
          ? remote.translationBangla
          : builtIn.translationBangla,
      reference:
        remote.reference !== undefined
          ? remote.reference || undefined
          : builtIn.reference,
      quranRef:
        remote.quranRef !== undefined ? remote.quranRef : builtIn.quranRef,
      parts: remote.parts !== undefined ? remote.parts : builtIn.parts,
      source: 'override',
    });
  }

  for (const remote of remoteDocs) {
    if (seenIds.has(remote.id)) continue;
    if (remote.deleted || remote.reverted) continue;
    if (
      typeof remote.chapterId !== 'number' ||
      !remote.titleBangla?.trim() ||
      !remote.arabic?.trim()
    ) {
      continue;
    }
    if (visibleChapterIds && !visibleChapterIds.has(remote.chapterId)) {
      continue;
    }
    merged.push({
      id: remote.id,
      chapterId: remote.chapterId,
      order: remote.order ?? 999,
      titleBangla: remote.titleBangla.trim(),
      repeatCount: remote.repeatCount,
      occasionNote: remote.occasionNote || undefined,
      arabic: remote.arabic,
      transliteration: remote.transliteration || undefined,
      translationBangla: remote.translationBangla ?? '',
      reference: remote.reference || undefined,
      quranRef: remote.quranRef,
      parts: remote.parts,
      source: 'remote',
    });
  }

  return merged.sort((a, b) =>
    a.chapterId !== b.chapterId ? a.chapterId - b.chapterId : a.order - b.order
  );
}

export function mergeSurahOverrides(
  remoteDocs: RemoteSurahOverrideDoc[]
): { map: Record<number, MergedSurahInfo>; allTags: string[] } {
  const remoteById = new Map<number, RemoteSurahOverrideDoc>();
  for (const doc of remoteDocs) {
    remoteById.set(doc.surahId, doc);
  }

  const map: Record<number, MergedSurahInfo> = {};
  const tagSet = new Set<string>();

  for (let surahId = 1; surahId <= 114; surahId++) {
    const baseDesc = STATIC_SURAH_DESCRIPTIONS[surahId] ?? '';
    const remote = remoteById.get(surahId);
    if (!remote || remote.deleted || remote.reverted) {
      map[surahId] = {
        surahId,
        descriptionBangla: baseDesc,
        occasionTags: [],
        isOverridden: false,
      };
      continue;
    }
    const tags = (remote.occasionTags ?? [])
      .map((t) => t.trim())
      .filter(Boolean);
    for (const tag of tags) tagSet.add(tag);

    map[surahId] = {
      surahId,
      descriptionBangla: remote.descriptionBangla?.trim() || baseDesc,
      fazilatBangla: remote.fazilatBangla?.trim() || undefined,
      fazilatRef: remote.fazilatRef?.trim() || undefined,
      occasionTags: tags,
      isOverridden: true,
    };
  }

  return { map, allTags: Array.from(tagSet) };
}

export function mergeRoutineTemplates(
  remoteDocs: RemoteRoutineTemplateDoc[]
): ActiveRoutineTemplate[] {
  return remoteDocs
    .filter(
      (doc) =>
        !doc.deleted &&
        Boolean(doc.title?.trim()) &&
        Array.isArray(doc.items) &&
        doc.items.length > 0
    )
    .map((doc) => ({
      id: doc.id,
      title: doc.title!.trim(),
      description: doc.description?.trim() || undefined,
      assignedDays: Array.isArray(doc.assignedDays)
        ? doc.assignedDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [],
      items: doc.items!,
      featured: Boolean(doc.featured),
      seasonTag: doc.seasonTag?.trim() || undefined,
      order: typeof doc.order === 'number' ? doc.order : 0,
      version: typeof doc.version === 'number' && doc.version >= 1 ? doc.version : 1,
      updatedAt: doc.updatedAt,
    }))
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return b.updatedAt - a.updatedAt;
    });
}

export function mergeFeaturedCards(
  remoteDocs: RemoteFeaturedCardDoc[]
): ActiveFeaturedCard[] {
  return remoteDocs
    .filter(
      (doc) =>
        !doc.deleted &&
        Boolean(doc.titleBangla?.trim()) &&
        Boolean(doc.bodyBangla?.trim())
    )
    .map((doc) => ({
      id: doc.id,
      titleBangla: doc.titleBangla!.trim(),
      bodyBangla: doc.bodyBangla!.trim(),
      arabicSnippet: doc.arabicSnippet?.trim() || undefined,
      badgeLabel: doc.badgeLabel?.trim() || undefined,
      action: doc.action,
      active: Boolean(doc.active),
      startDate: doc.startDate?.trim() || undefined,
      endDate: doc.endDate?.trim() || undefined,
      priority: typeof doc.priority === 'number' ? doc.priority : 0,
      updatedAt: doc.updatedAt,
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.updatedAt - a.updatedAt;
    });
}

/**
 * Selects the highest-priority visible Home Featured Card for a given local date (YYYY-MM-DD),
 * excluding inactive, out-of-window, or user-dismissed cards.
 */
export function selectActiveFeaturedCard(
  cards: ActiveFeaturedCard[],
  todayIso: string,
  dismissedIds: readonly string[] = []
): ActiveFeaturedCard | null {
  const dismissed = new Set(dismissedIds);
  for (const card of cards) {
    if (!card.active) continue;
    if (dismissed.has(card.id)) continue;
    if (card.startDate && todayIso < card.startDate) continue;
    if (card.endDate && todayIso > card.endDate) continue;
    return card;
  }
  return null;
}

export function buildCatalogSnapshot(params: {
  version: number;
  hydrated: boolean;
  remoteDuas: RemoteDuaDoc[];
  remoteChapters: RemoteDuaChapterDoc[];
  remoteSurahOverrides: RemoteSurahOverrideDoc[];
  remoteTemplates: RemoteRoutineTemplateDoc[];
  remoteFeaturedCards: RemoteFeaturedCardDoc[];
}): CatalogSnapshot {
  const chapters = mergeChapters(params.remoteChapters);
  const visibleChapterIds = new Set(chapters.map((c) => c.id));
  const duas = mergeDuas(params.remoteDuas, visibleChapterIds);

  const chapterMap: Record<number, MergedDuaChapter> = {};
  const duasByChapter: Record<number, MergedDuaItem[]> = {};
  for (const ch of chapters) {
    chapterMap[ch.id] = ch;
    duasByChapter[ch.id] = [];
  }

  const duaMap: Record<string, MergedDuaItem> = {};
  for (const dua of duas) {
    duaMap[dua.id] = dua;
    if (!duasByChapter[dua.chapterId]) {
      duasByChapter[dua.chapterId] = [];
    }
    duasByChapter[dua.chapterId].push(dua);
  }

  const { map: surahInfoMap, allTags: allSurahTags } = mergeSurahOverrides(
    params.remoteSurahOverrides
  );
  const routineTemplates = mergeRoutineTemplates(params.remoteTemplates);
  const routineTemplateMap: Record<string, ActiveRoutineTemplate> = {};
  for (const tpl of routineTemplates) {
    routineTemplateMap[tpl.id] = tpl;
  }

  const featuredCards = mergeFeaturedCards(params.remoteFeaturedCards);

  const remoteDuasMap: Record<string, RemoteDuaDoc> = {};
  for (const d of params.remoteDuas) remoteDuasMap[d.id] = d;

  const remoteChaptersMap: Record<number, RemoteDuaChapterDoc> = {};
  for (const c of params.remoteChapters) remoteChaptersMap[c.id] = c;

  const remoteSurahOverridesMap: Record<number, RemoteSurahOverrideDoc> = {};
  for (const s of params.remoteSurahOverrides) remoteSurahOverridesMap[s.surahId] = s;

  return {
    version: params.version,
    hydrated: params.hydrated,
    chapters,
    chapterMap,
    duas,
    duaMap,
    duasByChapter,
    surahInfoMap,
    allSurahTags,
    routineTemplates,
    routineTemplateMap,
    featuredCards,
    remoteDuasMap,
    remoteChaptersMap,
    remoteSurahOverridesMap,
    remoteTemplatesRaw: params.remoteTemplates,
    remoteFeaturedCardsRaw: params.remoteFeaturedCards,
  };
}

let snapshotVersion = 0;
let currentSnapshot: CatalogSnapshot = buildCatalogSnapshot({
  version: snapshotVersion,
  hydrated: false,
  remoteDuas: [],
  remoteChapters: [],
  remoteSurahOverrides: [],
  remoteTemplates: [],
  remoteFeaturedCards: [],
});

const listeners = new Set<() => void>();

export function subscribeCatalogSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCatalogSnapshot(): CatalogSnapshot {
  return currentSnapshot;
}

export function setCatalogRemoteData(data: {
  remoteDuas: RemoteDuaDoc[];
  remoteChapters: RemoteDuaChapterDoc[];
  remoteSurahOverrides: RemoteSurahOverrideDoc[];
  remoteTemplates: RemoteRoutineTemplateDoc[];
  remoteFeaturedCards: RemoteFeaturedCardDoc[];
}): CatalogSnapshot {
  snapshotVersion += 1;
  currentSnapshot = buildCatalogSnapshot({
    version: snapshotVersion,
    hydrated: true,
    ...data,
  });
  for (const listener of listeners) {
    listener();
  }
  return currentSnapshot;
}

// Synchronous convenience getters used across searchEngine, formatters, database, stats, router
export function getMergedDua(duaId: string): MergedDuaItem | undefined {
  return currentSnapshot.duaMap[duaId];
}

export function getMergedChapter(chapterId: number): MergedDuaChapter | undefined {
  return currentSnapshot.chapterMap[chapterId];
}

export function getMergedSurahInfo(surahId: number): MergedSurahInfo {
  return (
    currentSnapshot.surahInfoMap[surahId] ?? {
      surahId,
      descriptionBangla: STATIC_SURAH_DESCRIPTIONS[surahId] ?? '',
      occasionTags: [],
      isOverridden: false,
    }
  );
}

export function isBuiltInDuaId(duaId: string): boolean {
  return Boolean(STATIC_DUA_MAP[duaId]);
}

export function isBuiltInChapterId(chapterId: number): boolean {
  return Boolean(STATIC_DUA_CHAPTER_MAP[chapterId]);
}
