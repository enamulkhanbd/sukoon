import { useSyncExternalStore } from 'react';
import { db } from '../db/database';
import {
  getCatalogSnapshot,
  selectActiveFeaturedCard,
  setCatalogRemoteData,
  subscribeCatalogSnapshot,
  type CatalogSnapshot,
} from './catalogSnapshot';
import type {
  ActiveFeaturedCard,
  ActiveRoutineTemplate,
  MergedSurahInfo,
} from '../data/cmsTypes';

/**
 * Loads all locally cached remote CMS tables from IndexedDB (Dexie)
 * and updates the live merged catalog snapshot.
 * Runs synchronously-fast on startup so the app works 100% offline.
 */
export async function hydrateCatalogFromDb(): Promise<CatalogSnapshot> {
  const [
    remoteDuas,
    remoteChapters,
    remoteSurahOverrides,
    remoteTemplates,
    remoteFeaturedCards,
  ] = await Promise.all([
    db.remoteDuas.toArray(),
    db.remoteDuaChapters.toArray(),
    db.remoteSurahOverrides.toArray(),
    db.remoteRoutineTemplates.toArray(),
    db.remoteFeaturedCards.toArray(),
  ]);

  return setCatalogRemoteData({
    remoteDuas,
    remoteChapters,
    remoteSurahOverrides,
    remoteTemplates,
    remoteFeaturedCards,
  });
}

export function useCatalog(): CatalogSnapshot {
  return useSyncExternalStore(subscribeCatalogSnapshot, getCatalogSnapshot);
}

export function useDuasCatalog() {
  const catalog = useCatalog();
  return {
    version: catalog.version,
    hydrated: catalog.hydrated,
    chapters: catalog.chapters,
    chapterMap: catalog.chapterMap,
    duas: catalog.duas,
    duaMap: catalog.duaMap,
    duasByChapter: catalog.duasByChapter,
  };
}

export function useSurahInfo(surahId: number): MergedSurahInfo {
  const catalog = useCatalog();
  return catalog.surahInfoMap[surahId];
}

export function useAllSurahOverrides() {
  const catalog = useCatalog();
  return {
    surahInfoMap: catalog.surahInfoMap,
    allSurahTags: catalog.allSurahTags,
  };
}

export function useRoutineTemplates(): {
  templates: ActiveRoutineTemplate[];
  templateMap: Record<string, ActiveRoutineTemplate>;
} {
  const catalog = useCatalog();
  return {
    templates: catalog.routineTemplates,
    templateMap: catalog.routineTemplateMap,
  };
}

export function useActiveFeaturedCard(
  todayIso: string,
  dismissedIds: readonly string[] = []
): ActiveFeaturedCard | null {
  const catalog = useCatalog();
  return selectActiveFeaturedCard(catalog.featuredCards, todayIso, dismissedIds);
}
