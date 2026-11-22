import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  Clock,
  FolderOpen,
  Globe,
  HardDrive,
  Loader2,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import type { DuaItem } from '../data/duas';
import { SURAH_MAP } from '../data/surahs';
import { db, type Routine } from '../db/database';
import {
  mergeVerseSearchResults,
  searchCachedVerses,
  searchQuranOnline,
  type VerseSearchResult,
} from '../services/quranSearch';
import { toBanglaDigits } from '../utils/formatters';
import { JUMMAH_SURAH_ID } from '../utils/islamicTime';
import {
  buildOnlineQuranQuery,
  getHighlightSegments,
  hasArabicChars,
  searchAllLocal,
  type AppActionId,
  type DuaMatchField,
  type HighlightSegment,
  type SmartJumpResult,
} from '../utils/searchEngine';

const RECENT_STORAGE_KEY = 'sukoon-recent-searches';
const MAX_RECENT_SEARCHES = 6;
const ONLINE_DEBOUNCE_MS = 320;

const QUICK_SUGGESTIONS = [
  'আয়াতুল কুরসি',
  'সকাল সন্ধ্যা',
  'ঘুমের দুআ',
  'রুকইয়া',
  'ইস্তেগফার',
  'দরুদ',
  'পারা ৩০',
  'সেহরি ইফতার',
] as const;

const DUA_FIELD_LABELS: Record<DuaMatchField, string> = {
  title: '',
  occasion: 'প্রসঙ্গ',
  chapter: 'অধ্যায়',
  transliteration: 'উচ্চারণ',
  translation: 'অনুবাদ',
  reference: 'রেফারেন্স',
  arabic: 'আরবি',
  parts: 'অংশ',
};

type SearchTab =
  | 'all'
  | 'surahs'
  | 'verses'
  | 'duas'
  | 'chapters'
  | 'routines'
  | 'actions';

function loadRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function saveRecentSearches(items: string[]): void {
  try {
    window.localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {
    // Ignore private mode / quota errors
  }
}

function HighlightedSegments({ segments }: { segments: HighlightSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="rounded px-0.5 font-medium"
            style={{
              backgroundColor: 'var(--ayah-highlight)',
              color: 'inherit',
            }}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = useMemo(
    () => getHighlightSegments(text, query),
    [text, query]
  );
  return <HighlightedSegments segments={segments} />;
}

export interface GlobalSearchOverlayProps {
  open: boolean;
  bookmarkedDuaIds: string[];
  isJummah: boolean;
  waqtSurahId?: number;
  waqtLabel?: string;
  onClose: () => void;
  onOpenSurah: (surahId: number, targetAyah?: number) => void;
  onOpenDua: (dua: DuaItem) => void;
  onOpenDuaChapter: (chapterId: number) => void;
  onOpenSavedDuas: () => void;
  onOpenRoutineDetails: (routine: Routine) => void;
  onOpenStats: () => void;
  onOpenFastingSchedule: () => void;
  onOpenSettings: () => void;
  onOpenRoutinesTab: () => void;
}

export function GlobalSearchOverlay({
  open,
  bookmarkedDuaIds,
  isJummah,
  waqtSurahId,
  waqtLabel,
  onClose,
  onOpenSurah,
  onOpenDua,
  onOpenDuaChapter,
  onOpenSavedDuas,
  onOpenRoutineDetails,
  onOpenStats,
  onOpenFastingSchedule,
  onOpenSettings,
  onOpenRoutinesTab,
}: GlobalSearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadRecentSearches()
  );
  const [onlineVerses, setOnlineVerses] = useState<VerseSearchResult[]>([]);
  const [onlineTotalResults, setOnlineTotalResults] = useState(0);
  const [onlinePage, setOnlinePage] = useState(1);
  const [onlineHasMore, setOnlineHasMore] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineLoadingMore, setOnlineLoadingMore] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map());
  const pushedHistoryRef = useRef(false);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  // Load live DB data ONLY while overlay is open
  const routines = useLiveQuery(
    async () => (open ? db.routines.orderBy('createdAt').toArray() : []),
    [open]
  );
  const lastRead = useLiveQuery(
    async () => (open ? (await db.globalLastRead.get('current')) ?? null : null),
    [open]
  );
  const cachedSurahs = useLiveQuery(
    async () => (open ? db.cachedSurahs.toArray() : []),
    [open]
  );

  const bookmarkedSet = useMemo(
    () => new Set(bookmarkedDuaIds),
    [bookmarkedDuaIds]
  );

  const recordRecent = useCallback((rawTerm: string) => {
    const clean = rawTerm.trim();
    if (clean.length < 2) return;
    setRecentSearches((prev) => {
      const next = [
        clean,
        ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(next);
      return next;
    });
  }, []);

  const removeRecent = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((item) => item !== term);
      saveRecentSearches(next);
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecentSearches([]);
    saveRecentSearches([]);
  }, []);

  // Dismiss without navigating: cleanly pop our overlay history entry if present
  const dismissOverlay = useCallback(() => {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    }
    onClose();
  }, [onClose]);

  // Dismiss because user picked a result that navigates elsewhere
  const closeForNavigation = useCallback(() => {
    pushedHistoryRef.current = false;
    onClose();
  }, [onClose]);

  // Reset state on open/close, lock body scroll, and support native mobile Back button
  useEffect(() => {
    if (!open) {
      loadMoreControllerRef.current?.abort();
      setQuery('');
      setActiveTab('all');
      setActiveIndex(-1);
      setOnlineVerses([]);
      setOnlineTotalResults(0);
      setOnlinePage(1);
      setOnlineHasMore(false);
      setOnlineLoading(false);
      setOnlineLoadingMore(false);
      return;
    }

    setRecentSearches(loadRecentSearches());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Push a lightweight history entry so Android/browser Back closes search instead of leaving the page
    try {
      window.history.pushState(
        { sukoonSearchOverlay: true },
        '',
        window.location.href
      );
      pushedHistoryRef.current = true;
    } catch {
      pushedHistoryRef.current = false;
    }

    const handlePopState = () => {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        onClose();
      }
    };
    window.addEventListener('popstate', handlePopState);

    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('popstate', handlePopState);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const trimmed = query.trim();
  const onlineQuery = useMemo(() => buildOnlineQuranQuery(trimmed), [trimmed]);
  const isOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  // Reset selected tab & keyboard cursor whenever query changes
  useEffect(() => {
    setActiveTab('all');
    setActiveIndex(-1);
  }, [trimmed]);

  // 1. Instant local search (Surahs, Duas, Chapters, Routines, Smart Jumps, App Actions)
  const localResults = useMemo(
    () =>
      searchAllLocal(trimmed, {
        routines: routines ?? [],
        bookmarkedDuaIds: bookmarkedSet,
        lastRead: lastRead ?? null,
      }),
    [trimmed, routines, bookmarkedSet, lastRead]
  );

  // 2. Instant offline Arabic verse search across IndexedDB cachedSurahs
  const offlineVerses = useMemo(
    () => searchCachedVerses(trimmed, cachedSurahs ?? [], 25),
    [trimmed, cachedSurahs]
  );

  // 3. Debounced online Quran.com v4 full-text verse search (6,236 ayahs BN/AR/EN)
  useEffect(() => {
    loadMoreControllerRef.current?.abort();
    setOnlineLoadingMore(false);

    if (!open || !onlineQuery || isOffline) {
      setOnlineVerses([]);
      setOnlineTotalResults(0);
      setOnlinePage(1);
      setOnlineHasMore(false);
      setOnlineLoading(false);
      return;
    }

    const controller = new AbortController();
    setOnlineLoading(true);

    const timer = window.setTimeout(() => {
      searchQuranOnline(onlineQuery, { page: 1, size: 20, signal: controller.signal })
        .then((pageRes) => {
          if (!controller.signal.aborted) {
            setOnlineVerses(pageRes.results);
            setOnlineTotalResults(pageRes.totalResults);
            setOnlinePage(pageRes.currentPage);
            setOnlineHasMore(pageRes.hasMore);
            setOnlineLoading(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setOnlineLoading(false);
          }
        });
    }, ONLINE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, onlineQuery, isOffline]);

  const handleLoadMoreOnlineVerses = useCallback(() => {
    if (!onlineQuery || !onlineHasMore || onlineLoadingMore || isOffline) return;
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setOnlineLoadingMore(true);

    searchQuranOnline(onlineQuery, {
      page: onlinePage + 1,
      size: 20,
      signal: controller.signal,
    })
      .then((pageRes) => {
        if (controller.signal.aborted) return;
        setOnlineVerses((prev) => {
          const seen = new Set(prev.map((v) => v.verseKey));
          const fresh = pageRes.results.filter((v) => !seen.has(v.verseKey));
          return [...prev, ...fresh];
        });
        setOnlineTotalResults(pageRes.totalResults);
        setOnlinePage(pageRes.currentPage);
        setOnlineHasMore(pageRes.hasMore);
        setOnlineLoadingMore(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setOnlineLoadingMore(false);
        }
      });
  }, [onlineQuery, onlineHasMore, onlineLoadingMore, isOffline, onlinePage]);

  const mergedVerses = useMemo(
    () => mergeVerseSearchResults(offlineVerses, onlineVerses),
    [offlineVerses, onlineVerses]
  );

  // Resolve exact first ayah on Mushaf page if cached locally
  const resolveJumpAyah = useCallback(
    (jump: SmartJumpResult): number => {
      if (jump.kind !== 'page' || !jump.page) return jump.ayah;
      const cached = (cachedSurahs ?? []).find(
        (c) => c.surahId === jump.surah.id
      );
      const match = cached?.verses.find((v) => v.page_number === jump.page);
      return match?.verse_number ?? jump.ayah;
    },
    [cachedSurahs]
  );

  const runAction = useCallback(
    (actionId: AppActionId) => {
      recordRecent(trimmed);
      closeForNavigation();
      switch (actionId) {
        case 'ramadan':
          onOpenFastingSchedule();
          break;
        case 'stats':
          onOpenStats();
          break;
        case 'settings':
          onOpenSettings();
          break;
        case 'savedDuas':
          onOpenSavedDuas();
          break;
        case 'routinesTab':
          onOpenRoutinesTab();
          break;
        case 'lastRead':
          if (lastRead) {
            onOpenSurah(lastRead.surahId, lastRead.ayahNumber);
          }
          break;
        default:
          break;
      }
    },
    [
      trimmed,
      recordRecent,
      closeForNavigation,
      onOpenFastingSchedule,
      onOpenStats,
      onOpenSettings,
      onOpenSavedDuas,
      onOpenRoutinesTab,
      onOpenSurah,
      lastRead,
    ]
  );

  // Build visible slices based on active category tab
  const visible = useMemo(() => {
    const isAll = activeTab === 'all';
    return {
      jumps: isAll ? localResults.jumps : [],
      actions:
        isAll
          ? localResults.actions.slice(0, 3)
          : activeTab === 'actions'
            ? localResults.actions
            : [],
      routines:
        isAll
          ? localResults.routines.slice(0, 4)
          : activeTab === 'routines'
            ? localResults.routines
            : [],
      surahs:
        isAll
          ? localResults.surahs.slice(0, 5)
          : activeTab === 'surahs'
            ? localResults.surahs
            : [],
      chapters:
        isAll
          ? localResults.chapters.slice(0, 4)
          : activeTab === 'chapters'
            ? localResults.chapters
            : [],
      duas:
        isAll
          ? localResults.duas.slice(0, 5)
          : activeTab === 'duas'
            ? localResults.duas
            : [],
      verses:
        isAll
          ? mergedVerses.slice(0, 5)
          : activeTab === 'verses'
            ? mergedVerses
            : [],
    };
  }, [activeTab, localResults, mergedVerses]);

  // Flat ordered executor list for ArrowUp / ArrowDown / Enter keyboard navigation
  const flatExecutors = useMemo(() => {
    const list: Array<() => void> = [];

    for (const j of visible.jumps) {
      list.push(() => {
        recordRecent(trimmed);
        closeForNavigation();
        onOpenSurah(j.surah.id, resolveJumpAyah(j));
      });
    }
    for (const act of visible.actions) {
      list.push(() => runAction(act.id));
    }
    for (const r of visible.routines) {
      list.push(() => {
        recordRecent(trimmed);
        closeForNavigation();
        onOpenRoutineDetails(r.routine);
      });
    }
    for (const s of visible.surahs) {
      list.push(() => {
        recordRecent(trimmed);
        closeForNavigation();
        onOpenSurah(s.surah.id, 1);
      });
    }
    for (const ch of visible.chapters) {
      list.push(() => {
        recordRecent(trimmed);
        closeForNavigation();
        onOpenDuaChapter(ch.chapter.id);
      });
    }
    for (const d of visible.duas) {
      list.push(() => {
        recordRecent(trimmed);
        closeForNavigation();
        onOpenDua(d.dua);
      });
    }
    for (const v of visible.verses) {
      list.push(() => {
        recordRecent(trimmed);
        closeForNavigation();
        onOpenSurah(v.surah.id, v.ayahNumber);
      });
    }

    return list;
  }, [
    visible,
    trimmed,
    recordRecent,
    closeForNavigation,
    onOpenSurah,
    resolveJumpAyah,
    runAction,
    onOpenRoutineDetails,
    onOpenDuaChapter,
    onOpenDua,
  ]);

  // Keyboard navigation: Escape, ArrowDown, ArrowUp, Enter
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissOverlay();
        return;
      }

      if (flatExecutors.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev < flatExecutors.length - 1 ? prev + 1 : 0;
          itemRefs.current.get(next)?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev > 0 ? prev - 1 : flatExecutors.length - 1;
          itemRefs.current.get(next)?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter') {
        const idx = activeIndex >= 0 ? activeIndex : 0;
        const exec = flatExecutors[idx];
        if (exec) {
          e.preventDefault();
          exec();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, dismissOverlay, flatExecutors, activeIndex]);

  if (!open) return null;

  const verseDisplayTotal = Math.max(mergedVerses.length, onlineTotalResults);
  const showOfflineVerseHint =
    isOffline && Boolean(onlineQuery) && !hasArabicChars(trimmed);

  const totalCount =
    localResults.jumps.length +
    localResults.actions.length +
    localResults.routines.length +
    localResults.surahs.length +
    localResults.chapters.length +
    localResults.duas.length +
    mergedVerses.length;

  const hasResults = totalCount > 0;

  const allTabs: Array<{
    id: SearchTab;
    label: string;
    count: number;
    loading?: boolean;
  }> = [
    { id: 'all', label: 'সব', count: totalCount },
    { id: 'surahs', label: 'সূরা', count: localResults.surahs.length },
    {
      id: 'verses',
      label: 'আয়াত',
      count: verseDisplayTotal,
      loading: onlineLoading,
    },
    { id: 'duas', label: 'দুআ', count: localResults.duas.length },
    { id: 'chapters', label: 'অধ্যায়', count: localResults.chapters.length },
    { id: 'routines', label: 'রুটিন', count: localResults.routines.length },
    { id: 'actions', label: 'অ্যাপ', count: localResults.actions.length },
  ];
  const tabs = allTabs.filter(
    (t) =>
      t.id === 'all' ||
      t.count > 0 ||
      t.loading ||
      (t.id === 'verses' && showOfflineVerseHint)
  );

  const renderActionIcon = (id: AppActionId) => {
    const cls = 'w-4 h-4 shrink-0';
    switch (id) {
      case 'ramadan':
        return <CalendarDays className={cls} style={{ color: 'var(--gold)' }} />;
      case 'stats':
        return <BarChart3 className={cls} style={{ color: 'var(--accent)' }} />;
      case 'settings':
        return (
          <SettingsIcon className={cls} style={{ color: 'var(--text-secondary)' }} />
        );
      case 'savedDuas':
        return <Bookmark className={cls} style={{ color: 'var(--accent)' }} />;
      case 'routinesTab':
        return (
          <CalendarCheck2 className={cls} style={{ color: 'var(--accent)' }} />
        );
      case 'lastRead':
      default:
        return <BookOpen className={cls} style={{ color: 'var(--accent)' }} />;
    }
  };

  // Running flat index counter during render so refs & active styling stay exact
  let flatCursor = 0;
  const registerRowProps = (onActivate: () => void) => {
    const idx = flatCursor++;
    const isActive = idx === activeIndex;
    return {
      ref: (el: HTMLButtonElement | null) => {
        itemRefs.current.set(idx, el);
      },
      onMouseEnter: () => setActiveIndex(idx),
      onClick: onActivate,
      isActive,
    };
  };

  const suggestedSurah = isJummah
    ? SURAH_MAP[JUMMAH_SURAH_ID]
    : waqtSurahId
      ? SURAH_MAP[waqtSurahId]
      : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="অনুসন্ধান"
      className="fixed inset-0 z-50 paper-frame flex flex-col safe-top safe-bottom"
    >
      {/* Full-Bleed Tinted Top Search Band */}
      <div
        className="shrink-0"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-3 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={dismissOverlay}
              aria-label="ফিরে যান"
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors active:scale-95"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--text-primary) 4.5%, transparent)',
                color: 'var(--text-secondary)',
              }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="relative flex-1 min-w-0">
              <Search
                className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="সূরা, আয়াত, দুআ, পারা, পৃষ্ঠা বা রুটিন খুঁজুন..."
                className="w-full pl-11 pr-9 py-2.5 rounded-full text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="মুছুন"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Chips */}
          {trimmed && (hasResults || onlineLoading) && tabs.length > 1 && (
            <div
              role="tablist"
              aria-label="অনুসন্ধান বিভাগ"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
            >
              {tabs.map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setActiveIndex(-1);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium shrink-0 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: selected
                        ? 'var(--accent)'
                        : 'var(--bg-elevated)',
                      color: selected
                        ? 'var(--accent-text)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    <span>{tab.label}</span>
                    {tab.loading && tab.count === 0 ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span
                        className="text-[10px] tabular-nums opacity-80"
                      >
                        {toBanglaDigits(tab.count)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Results / Empty State Canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 py-5 space-y-6">
          {!trimmed ? (
            /* ==================== SMART EMPTY STATE ==================== */
            <div className="space-y-6">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      সাম্প্রতিক অনুসন্ধান
                    </h2>
                    <button
                      type="button"
                      onClick={clearRecents}
                      className="text-[11px] font-medium cursor-pointer transition-opacity active:opacity-70"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      সব মুছুন
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        className="inline-flex items-center rounded-full text-xs overflow-hidden"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(term);
                            inputRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 cursor-pointer transition-opacity active:opacity-70"
                        >
                          <Clock
                            className="w-3 h-3 shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          />
                          <span>{term}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecent(term)}
                          aria-label={`${term} মুছুন`}
                          className="pr-2.5 pl-1 py-1.5 cursor-pointer transition-opacity active:opacity-70"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Contextual Quick Access */}
              {(lastRead || suggestedSurah) && (
                <section className="space-y-2">
                  <h2
                    className="text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    দ্রুত প্রবেশ
                  </h2>
                  <div className="space-y-2">
                    {lastRead && SURAH_MAP[lastRead.surahId] && (
                      <button
                        type="button"
                        onClick={() => {
                          closeForNavigation();
                          onOpenSurah(lastRead.surahId, lastRead.ayahNumber);
                        }}
                        className="w-full rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer transition-opacity active:opacity-80"
                        style={{ backgroundColor: 'var(--bg-surface)' }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BookOpen
                            className="w-4 h-4 shrink-0"
                            style={{ color: 'var(--accent)' }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              সর্বশেষ: সূরা {lastRead.surahNameBangla}
                            </div>
                            <div
                              className="text-[11px]"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              আয়াত {toBanglaDigits(lastRead.ayahNumber)} থেকে চালিয়ে যান
                            </div>
                          </div>
                        </div>
                        <ArrowRight
                          className="w-4 h-4 shrink-0"
                          style={{ color: 'var(--accent)' }}
                        />
                      </button>
                    )}

                    {suggestedSurah && (
                      <button
                        type="button"
                        onClick={() => {
                          closeForNavigation();
                          onOpenSurah(suggestedSurah.id, 1);
                        }}
                        className="w-full rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer transition-opacity active:opacity-80"
                        style={{ backgroundColor: 'var(--bg-surface)' }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Sparkles
                            className="w-4 h-4 shrink-0"
                            style={{ color: 'var(--gold)' }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              সূরা {suggestedSurah.nameBangla}
                            </div>
                            <div
                              className="text-[11px]"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {isJummah
                                ? 'জুমুআর দিনের বিশেষ আমল'
                                : waqtLabel || 'সময়োপযোগী তিলাওয়াত'}
                            </div>
                          </div>
                        </div>
                        <span
                          className="font-surah-names text-2xl leading-none shrink-0 select-none"
                          style={{ color: 'var(--text-primary)' }}
                          aria-hidden="true"
                        >
                          {String(suggestedSurah.id).padStart(3, '0')}
                        </span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* Popular Suggestions */}
              <section className="space-y-2.5">
                <h2
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  জনপ্রিয় অনুসন্ধান
                </h2>
                <div className="flex flex-wrap gap-2">
                  {QUICK_SUGGESTIONS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setQuery(chip);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-75"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </section>

              {/* Smart Search Tips */}
              <p
                className="text-[11px] leading-relaxed text-center pt-2"
                style={{ color: 'var(--text-muted)' }}
              >
                টিপস:{' '}
                <span style={{ color: 'var(--text-secondary)' }}>২:২৫৫</span>,{' '}
                <span style={{ color: 'var(--text-secondary)' }}>বাকারা ২৫৫</span>,{' '}
                <span style={{ color: 'var(--text-secondary)' }}>পারা ৩০</span>,{' '}
                <span style={{ color: 'var(--text-secondary)' }}>পৃষ্ঠা ৬০৪</span>,
                বাংলিশ (<span style={{ color: 'var(--text-secondary)' }}>yasin, ghumer dua</span>)
                অথবা হরকত ছাড়া আরবিতেও খুঁজতে পারবেন।
              </p>
            </div>
          ) : !hasResults && !onlineLoading ? (
            /* ==================== EMPTY RESULTS ==================== */
            <div className="text-center py-10 space-y-2.5">
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                “{trimmed}”-এর জন্য কোনো ফলাফল পাওয়া যায়নি।
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                অন্য বানান, সূরার নম্বর (যেমন ২:২৫৫), পারা বা সংক্ষিপ্ত শব্দ দিয়ে চেষ্টা করুন।
              </p>
              {showOfflineVerseHint && (
                <p
                  className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full mt-1"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <WifiOff className="w-3 h-3 shrink-0" />
                  <span>
                    অফলাইনে শুধু আরবি আয়াত সার্চ কাজ করে • বাংলা অনুবাদ সার্চের জন্য ইন্টারনেট প্রয়োজন
                  </span>
                </p>
              )}
            </div>
          ) : (
            /* ==================== SEARCH RESULTS ==================== */
            <>
              {/* 1. Smart Direct Jumps (Ayah, Surah+Ayah, Juz, Page, Famous Ayahs) */}
              {visible.jumps.length > 0 && (
                <section className="space-y-2">
                  {visible.jumps.map((jump) => {
                    const row = registerRowProps(() => {
                      recordRecent(trimmed);
                      closeForNavigation();
                      onOpenSurah(jump.surah.id, resolveJumpAyah(jump));
                    });
                    return (
                      <button
                        key={jump.id}
                        ref={row.ref}
                        type="button"
                        onMouseEnter={row.onMouseEnter}
                        onClick={row.onClick}
                        className="w-full rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-opacity active:opacity-80 cursor-pointer"
                        style={{
                          backgroundColor: row.isActive
                            ? 'var(--accent-soft)'
                            : 'var(--bg-surface)',
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BookOpen
                            className="w-4 h-4 shrink-0"
                            style={{ color: 'var(--accent)' }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {jump.titleBangla}
                            </div>
                            <div
                              className="text-[11px] truncate"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {jump.subtitleBangla}
                            </div>
                          </div>
                        </div>
                        <ArrowRight
                          className="w-4 h-4 shrink-0"
                          style={{ color: 'var(--accent)' }}
                        />
                      </button>
                    );
                  })}
                </section>
              )}

              {/* 2. App Quick Actions */}
              {visible.actions.length > 0 && (
                <section className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      অ্যাপ ও দ্রুত অ্যাকশন
                    </h2>
                  </div>
                  <div className="space-y-0.5">
                    {visible.actions.map((act) => {
                      const row = registerRowProps(() => runAction(act.id));
                      return (
                        <button
                          key={act.id}
                          ref={row.ref}
                          type="button"
                          onMouseEnter={row.onMouseEnter}
                          onClick={row.onClick}
                          className="w-full px-2.5 -mx-2.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left cursor-pointer transition-colors active:opacity-70"
                          style={{
                            backgroundColor: row.isActive
                              ? 'var(--bg-surface)'
                              : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {renderActionIcon(act.id)}
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                <HighlightedText
                                  text={act.titleBangla}
                                  query={trimmed}
                                />
                              </div>
                              <div
                                className="text-[11px] truncate"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {act.subtitleBangla}
                              </div>
                            </div>
                          </div>
                          <ArrowRight
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 3. Routines */}
              {visible.routines.length > 0 && (
                <section className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      রুটিন ({toBanglaDigits(localResults.routines.length)})
                    </h2>
                    {activeTab === 'all' &&
                      localResults.routines.length > visible.routines.length && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('routines')}
                          className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer"
                          style={{ color: 'var(--accent)' }}
                        >
                          <span>
                            আরও{' '}
                            {toBanglaDigits(
                              localResults.routines.length -
                                visible.routines.length
                            )}
                            টি
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                  <div className="space-y-0.5">
                    {visible.routines.map((item) => {
                      const row = registerRowProps(() => {
                        recordRecent(trimmed);
                        closeForNavigation();
                        onOpenRoutineDetails(item.routine);
                      });
                      return (
                        <button
                          key={item.routine.id}
                          ref={row.ref}
                          type="button"
                          onMouseEnter={row.onMouseEnter}
                          onClick={row.onClick}
                          className="w-full px-2.5 -mx-2.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left cursor-pointer transition-colors active:opacity-70"
                          style={{
                            backgroundColor: row.isActive
                              ? 'var(--bg-surface)'
                              : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CalendarCheck2
                              className="w-4 h-4 shrink-0"
                              style={{ color: 'var(--accent)' }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                <HighlightedText
                                  text={item.routine.title}
                                  query={trimmed}
                                />
                              </div>
                              {item.matchHint && (
                                <div
                                  className="text-[11px] truncate"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <HighlightedText
                                    text={item.matchHint}
                                    query={trimmed}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <ArrowRight
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 4. Surahs */}
              {visible.surahs.length > 0 && (
                <section className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      সূরা ({toBanglaDigits(localResults.surahs.length)})
                    </h2>
                    {activeTab === 'all' &&
                      localResults.surahs.length > visible.surahs.length && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('surahs')}
                          className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer"
                          style={{ color: 'var(--accent)' }}
                        >
                          <span>
                            আরও{' '}
                            {toBanglaDigits(
                              localResults.surahs.length - visible.surahs.length
                            )}
                            টি সূরা
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                  <div className="space-y-0.5">
                    {visible.surahs.map((item) => {
                      const surah = item.surah;
                      const row = registerRowProps(() => {
                        recordRecent(trimmed);
                        closeForNavigation();
                        onOpenSurah(surah.id, 1);
                      });
                      return (
                        <button
                          key={surah.id}
                          ref={row.ref}
                          type="button"
                          onMouseEnter={row.onMouseEnter}
                          onClick={row.onClick}
                          className="w-full px-2.5 -mx-2.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left cursor-pointer transition-colors active:opacity-70"
                          style={{
                            backgroundColor: row.isActive
                              ? 'var(--bg-surface)'
                              : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-7 text-xs font-medium tabular-nums shrink-0"
                              style={{ color: 'var(--accent)' }}
                            >
                              {toBanglaDigits(surah.id)}.
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                <HighlightedText
                                  text={surah.nameBangla}
                                  query={trimmed}
                                />{' '}
                                <span
                                  className="text-xs font-normal"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  (
                                  <HighlightedText
                                    text={surah.meaningBangla}
                                    query={trimmed}
                                  />
                                  )
                                </span>
                              </div>
                              <div
                                className="text-[11px] truncate"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {toBanglaDigits(surah.versesCount)} আয়াত •{' '}
                                {surah.revelationPlace === 'makkah'
                                  ? 'মক্কী'
                                  : 'মাদানী'}{' '}
                                • পৃষ্ঠা {toBanglaDigits(surah.pages[0])}
                                {surah.pages[1] !== surah.pages[0]
                                  ? `–${toBanglaDigits(surah.pages[1])}`
                                  : ''}
                              </div>
                            </div>
                          </div>
                          <span
                            className="font-surah-names text-2xl leading-none shrink-0 select-none"
                            style={{ color: 'var(--text-primary)' }}
                            aria-hidden="true"
                          >
                            {String(surah.id).padStart(3, '0')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 5. Dua Chapters */}
              {visible.chapters.length > 0 && (
                <section className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      দুআর অধ্যায় ({toBanglaDigits(localResults.chapters.length)})
                    </h2>
                    {activeTab === 'all' &&
                      localResults.chapters.length > visible.chapters.length && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('chapters')}
                          className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer"
                          style={{ color: 'var(--accent)' }}
                        >
                          <span>
                            আরও{' '}
                            {toBanglaDigits(
                              localResults.chapters.length -
                                visible.chapters.length
                            )}
                            টি
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                  <div className="space-y-0.5">
                    {visible.chapters.map((item) => {
                      const row = registerRowProps(() => {
                        recordRecent(trimmed);
                        closeForNavigation();
                        onOpenDuaChapter(item.chapter.id);
                      });
                      return (
                        <button
                          key={item.chapter.id}
                          ref={row.ref}
                          type="button"
                          onMouseEnter={row.onMouseEnter}
                          onClick={row.onClick}
                          className="w-full px-2.5 -mx-2.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left cursor-pointer transition-colors active:opacity-70"
                          style={{
                            backgroundColor: row.isActive
                              ? 'var(--bg-surface)'
                              : 'transparent',
                          }}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <FolderOpen
                              className="w-4 h-4 shrink-0 mt-0.5"
                              style={{ color: 'var(--accent)' }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                <HighlightedText
                                  text={item.chapter.titleBangla}
                                  query={trimmed}
                                />
                              </div>
                              <div
                                className="text-[11px] truncate"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <HighlightedText
                                  text={item.chapter.subtitleBangla}
                                  query={trimmed}
                                />
                              </div>
                            </div>
                          </div>
                          <span
                            className="text-[11px] font-medium tabular-nums shrink-0"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {toBanglaDigits(item.duaCount)}টি
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 6. Duas (with match field badge + highlighted context snippet) */}
              {visible.duas.length > 0 && (
                <section className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      দুআ ও জিকির ({toBanglaDigits(localResults.duas.length)})
                    </h2>
                    {activeTab === 'all' &&
                      localResults.duas.length > visible.duas.length && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('duas')}
                          className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer"
                          style={{ color: 'var(--accent)' }}
                        >
                          <span>
                            আরও{' '}
                            {toBanglaDigits(
                              localResults.duas.length - visible.duas.length
                            )}
                            টি দুআ
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                  <div className="space-y-0.5">
                    {visible.duas.map((item) => {
                      const { dua, chapter, matchField, snippet } = item;
                      const isBookmarked = bookmarkedSet.has(dua.id);
                      const fieldLabel = DUA_FIELD_LABELS[matchField];
                      const row = registerRowProps(() => {
                        recordRecent(trimmed);
                        closeForNavigation();
                        onOpenDua(dua);
                      });
                      return (
                        <button
                          key={dua.id}
                          ref={row.ref}
                          type="button"
                          onMouseEnter={row.onMouseEnter}
                          onClick={row.onClick}
                          className="w-full px-2.5 -mx-2.5 py-2.5 rounded-xl flex items-start justify-between gap-3 text-left cursor-pointer transition-colors active:opacity-70"
                          style={{
                            backgroundColor: row.isActive
                              ? 'var(--bg-surface)'
                              : 'transparent',
                          }}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <Sparkles
                              className="w-4 h-4 shrink-0 mt-0.5"
                              style={{ color: 'var(--gold)' }}
                            />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm font-medium truncate">
                                  <HighlightedText
                                    text={dua.titleBangla}
                                    query={trimmed}
                                  />
                                </span>
                                {isBookmarked && (
                                  <Bookmark
                                    className="w-3 h-3 shrink-0"
                                    style={{ color: 'var(--accent)' }}
                                    fill="currentColor"
                                  />
                                )}
                              </div>
                              {chapter && (
                                <div
                                  className="text-[11px] truncate"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  {chapter.titleBangla}
                                </div>
                              )}
                              {snippet && (
                                <div
                                  className={
                                    matchField === 'arabic'
                                      ? 'font-indopak text-right text-sm leading-relaxed line-clamp-1 pt-0.5'
                                      : 'text-xs leading-snug line-clamp-2 pt-0.5'
                                  }
                                  dir={matchField === 'arabic' ? 'rtl' : undefined}
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {fieldLabel && matchField !== 'arabic' && (
                                    <span
                                      className="inline-block text-[10px] font-medium px-1.5 py-0.2 rounded mr-1.5 align-middle"
                                      style={{
                                        backgroundColor: 'var(--accent-soft)',
                                        color: 'var(--accent)',
                                      }}
                                    >
                                      {fieldLabel}
                                    </span>
                                  )}
                                  {matchField === 'arabic' ? (
                                    snippet
                                  ) : (
                                    <HighlightedText
                                      text={snippet}
                                      query={trimmed}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <ArrowRight
                            className="w-3.5 h-3.5 shrink-0 mt-1"
                            style={{ color: 'var(--text-muted)' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 7. Quran Verses (Offline IndexedDB + Online Quran.com Full-Text) */}
              {(visible.verses.length > 0 ||
                ((onlineLoading || showOfflineVerseHint) &&
                  (activeTab === 'all' || activeTab === 'verses'))) && (
                <section className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h2
                        className="text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        কুরআনের আয়াত
                        {verseDisplayTotal > 0
                          ? ` (${toBanglaDigits(verseDisplayTotal)})`
                          : ''}
                      </h2>
                      {onlineLoading && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>খোঁজা হচ্ছে…</span>
                        </span>
                      )}
                    </div>
                    {activeTab === 'all' &&
                      (mergedVerses.length > visible.verses.length ||
                        onlineHasMore) && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('verses')}
                          className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer"
                          style={{ color: 'var(--accent)' }}
                        >
                          <span>
                            আরও{' '}
                            {toBanglaDigits(
                              Math.max(
                                mergedVerses.length - visible.verses.length,
                                verseDisplayTotal - visible.verses.length
                              )
                            )}
                            টি আয়াত
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>

                  {showOfflineVerseHint && visible.verses.length === 0 && (
                    <div
                      className="rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <WifiOff className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        অফলাইনে আরবি আয়াত সার্চ চালু আছে • বাংলা অনুবাদে আয়াত খুঁজতে ইন্টারনেট সংযোগ প্রয়োজন।
                      </span>
                    </div>
                  )}

                  {visible.verses.length > 0 && (
                    <div className="space-y-1">
                      {visible.verses.map((v) => {
                        const row = registerRowProps(() => {
                          recordRecent(trimmed);
                          closeForNavigation();
                          onOpenSurah(v.surah.id, v.ayahNumber);
                        });
                        return (
                          <button
                            key={v.verseKey}
                            ref={row.ref}
                            type="button"
                            onMouseEnter={row.onMouseEnter}
                            onClick={row.onClick}
                            className="w-full px-3 -mx-3 py-3 rounded-xl text-left cursor-pointer transition-colors active:opacity-75 space-y-1.5"
                            style={{
                              backgroundColor: row.isActive
                                ? 'var(--bg-surface)'
                                : 'transparent',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="text-xs font-semibold truncate"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  সূরা {v.surah.nameBangla} • আয়াত{' '}
                                  {toBanglaDigits(v.ayahNumber)}
                                </span>
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      v.source === 'offline' || v.source === 'both'
                                        ? 'var(--accent-soft)'
                                        : 'var(--gold-soft)',
                                    color:
                                      v.source === 'offline' || v.source === 'both'
                                        ? 'var(--accent)'
                                        : 'var(--gold)',
                                  }}
                                >
                                  {v.source === 'offline' || v.source === 'both' ? (
                                    <>
                                      <HardDrive className="w-2.5 h-2.5" />
                                      <span>অফলাইন</span>
                                    </>
                                  ) : (
                                    <>
                                      <Globe className="w-2.5 h-2.5" />
                                      <span>অনলাইন</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              <ArrowRight
                                className="w-3.5 h-3.5 shrink-0"
                                style={{ color: 'var(--text-muted)' }}
                              />
                            </div>

                            {v.arabicText && (
                              <p
                                dir="rtl"
                                lang="ar"
                                className="font-indopak text-right text-lg leading-[1.9] line-clamp-2"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {v.arabicHighlightedSegments ? (
                                  <HighlightedSegments
                                    segments={v.arabicHighlightedSegments}
                                  />
                                ) : (
                                  v.arabicText
                                )}
                              </p>
                            )}

                            {v.translationSegments &&
                              v.translationSegments.length > 0 && (
                                <p
                                  className="text-xs leading-relaxed line-clamp-2"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  <HighlightedSegments
                                    segments={v.translationSegments}
                                  />
                                </p>
                              )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === 'verses' && onlineHasMore && (
                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        onClick={handleLoadMoreOnlineVerses}
                        disabled={onlineLoadingMore}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-80 disabled:opacity-60"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--accent)',
                        }}
                      >
                        {onlineLoadingMore ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>আরও আয়াত লোড হচ্ছে…</span>
                          </>
                        ) : (
                          <span>
                            আরও আয়াত লোড করুন ({toBanglaDigits(mergedVerses.length)}/
                            {toBanglaDigits(verseDisplayTotal)})
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
