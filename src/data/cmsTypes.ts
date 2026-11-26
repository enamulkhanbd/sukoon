import type { DuaChapter, DuaItem } from './duas/types';

export interface RoutineItemRef {
  kind?: 'surah' | 'dua';
  surahId?: number;
  startAyah?: number;
  endAyah?: number;
  duaId?: string;
  targetCount?: number;
}

export interface RemoteDuaDoc {
  id: string;
  chapterId?: number;
  order?: number;
  titleBangla?: string;
  repeatCount?: number;
  occasionNote?: string;
  arabic?: string;
  transliteration?: string;
  translationBangla?: string;
  reference?: string;
  quranRef?: DuaItem['quranRef'];
  parts?: DuaItem['parts'];
  isBuiltInOverride?: boolean;
  deleted?: boolean;
  reverted?: boolean;
  updatedAt: number; // Epoch ms stored in IndexedDB (converted from Firestore Timestamp)
}

export interface RemoteDuaChapterDoc {
  id: number;
  titleBangla?: string;
  subtitleBangla?: string;
  searchAliases?: string[];
  deleted?: boolean;
  reverted?: boolean;
  updatedAt: number;
}

export interface RemoteRoutineTemplateDoc {
  id: string;
  title?: string;
  description?: string;
  assignedDays?: number[];
  items?: RoutineItemRef[];
  featured?: boolean;
  seasonTag?: string;
  order?: number;
  version?: number;
  deleted?: boolean;
  updatedAt: number;
}

export interface ActiveRoutineTemplate {
  id: string;
  title: string;
  description?: string;
  assignedDays: number[];
  items: RoutineItemRef[];
  featured: boolean;
  seasonTag?: string;
  order: number;
  version: number;
  updatedAt: number;
}

export interface RemoteSurahOverrideDoc {
  surahId: number;
  descriptionBangla?: string;
  fazilatBangla?: string;
  fazilatRef?: string;
  occasionTags?: string[];
  deleted?: boolean;
  reverted?: boolean;
  updatedAt: number;
}

export interface MergedSurahInfo {
  surahId: number;
  descriptionBangla: string;
  fazilatBangla?: string;
  fazilatRef?: string;
  occasionTags: string[];
  isOverridden: boolean;
}

export type FeaturedCardActionType = 'surah' | 'dua' | 'routineTemplate' | 'none';

export interface FeaturedCardAction {
  type: FeaturedCardActionType;
  surahId?: number;
  startAyah?: number;
  duaId?: string;
  templateId?: string;
  ctaLabel?: string;
}

export interface RemoteFeaturedCardDoc {
  id: string;
  titleBangla?: string;
  bodyBangla?: string;
  arabicSnippet?: string;
  badgeLabel?: string;
  action?: FeaturedCardAction;
  active?: boolean;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  priority?: number;
  deleted?: boolean;
  updatedAt: number;
}

export interface ActiveFeaturedCard {
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
  updatedAt: number;
}

export type CmsCollectionName =
  | 'duas'
  | 'duaChapters'
  | 'routineTemplates'
  | 'surahOverrides'
  | 'featuredCards';

export interface CmsSyncMeta {
  collection: CmsCollectionName;
  lastSyncedAt: number; // Highest updatedAt epoch ms received
  lastCheckedAt: number; // Last successful network check epoch ms
}

export interface MergedDuaChapter extends DuaChapter {
  searchAliases?: string[];
  source: 'builtin' | 'override' | 'remote';
}

export interface MergedDuaItem extends DuaItem {
  source: 'builtin' | 'override' | 'remote';
}
