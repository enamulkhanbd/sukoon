import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  ChevronRight,
  HeartHandshake,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type { DuaItem } from '../data/duas';
import type { Settings } from '../db/database';
import { useDuasCatalog } from '../services/contentCatalog';
import { searchCustomDuas, useCustomDuas } from '../services/customDuas';
import { normalizeIndoPakText, toBanglaDigits } from '../utils/formatters';
import { searchDuas } from '../utils/searchEngine';
import { CustomDuaFormSheet } from './CustomDuaFormSheet';
import {
  SoftSearchInput,
  TabHeader,
  TopBar,
  TopBarIconButton,
  TwoLineMenuButton,
  UnderlineTabs,
} from './NavigationChrome';

interface DuasViewProps {
  settings: Settings;
  selectedChapterId?: number | null;
  activeSubTab?: 'custom' | null;
  onChangeSubTab?: (subTab: 'custom' | null) => void;
  savedFilterNonce?: number;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onSelectChapter?: (chapterId: number | null) => void;
  onOpenDua: (dua: DuaItem) => void;
  onToggleBookmark: (duaId: string) => void;
}

type ViewFilter = 'chapters' | 'all' | 'saved' | 'custom';

export function DuasView({
  settings,
  selectedChapterId: controlledChapterId,
  activeSubTab = null,
  onChangeSubTab,
  savedFilterNonce = 0,
  menuOpen,
  onOpenMenu,
  onSelectChapter,
  onOpenDua,
  onToggleBookmark,
}: DuasViewProps) {
  const {
    version: catalogVersion,
    chapters: DUA_CHAPTERS,
    chapterMap: DUA_CHAPTER_MAP,
    duas: DUAS,
    duasByChapter: DUAS_BY_CHAPTER,
  } = useDuasCatalog();
  const { customDuaItems, version: customVersion } = useCustomDuas();

  const [query, setQuery] = useState('');
  const [chapterSearchOpen, setChapterSearchOpen] = useState(false);
  const [chapterQuery, setChapterQuery] = useState('');
  const [filter, setFilter] = useState<ViewFilter>(() =>
    activeSubTab === 'custom' ? 'custom' : 'chapters'
  );
  const [uncontrolledChapterId, setUncontrolledChapterId] = useState<
    number | null
  >(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  const selectedChapterId =
    controlledChapterId !== undefined
      ? controlledChapterId
      : uncontrolledChapterId;

  useEffect(() => {
    if (activeSubTab === 'custom') {
      setFilter('custom');
    } else if (filter === 'custom') {
      setFilter('chapters');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  useEffect(() => {
    if (savedFilterNonce > 0) {
      setFilter('saved');
      onChangeSubTab?.(null);
      setQuery('');
    }
  }, [savedFilterNonce, onChangeSubTab]);

  useEffect(() => {
    setChapterSearchOpen(false);
    setChapterQuery('');
  }, [selectedChapterId]);

  const setSelectedChapterId = (chapterId: number | null) => {
    if (onSelectChapter) {
      onSelectChapter(chapterId);
    } else {
      setUncontrolledChapterId(chapterId);
    }
  };

  const handleSelectTab = (next: ViewFilter) => {
    setSelectedChapterId(null);
    setFilter(next);
    onChangeSubTab?.(next === 'custom' ? 'custom' : null);
  };

  const bookmarkedSet = useMemo(
    () => new Set(settings.bookmarkedDuaIds ?? []),
    [settings.bookmarkedDuaIds]
  );

  const savedSystemDuasCount = useMemo(
    () => DUAS.filter((d) => bookmarkedSet.has(d.id)).length,
    [DUAS, bookmarkedSet]
  );

  const normalizedQuery = query.trim();
  const normalizedChapterQuery = chapterQuery.trim();
  const isCustomTab = selectedChapterId === null && filter === 'custom';

  const matchingSystemDuas = useMemo(() => {
    if (isCustomTab) return [];
    if (selectedChapterId !== null) {
      const chapterList = DUAS_BY_CHAPTER[selectedChapterId] ?? [];
      if (!normalizedChapterQuery) return chapterList;
      return searchDuas(normalizedChapterQuery, {
        chapterId: selectedChapterId,
        bookmarkedIds: bookmarkedSet,
      }).map((r) => r.dua);
    }

    if (!normalizedQuery) {
      return filter === 'saved'
        ? DUAS.filter((d) => bookmarkedSet.has(d.id))
        : DUAS;
    }

    return searchDuas(normalizedQuery, {
      bookmarkedIds: bookmarkedSet,
    }).map((r) => r.dua);
  }, [
    isCustomTab,
    catalogVersion,
    DUAS,
    DUAS_BY_CHAPTER,
    normalizedQuery,
    normalizedChapterQuery,
    selectedChapterId,
    filter,
    bookmarkedSet,
  ]);

  const matchingCustomDuas = useMemo(() => {
    if (!isCustomTab) return [];
    if (!normalizedQuery) return customDuaItems;
    return searchCustomDuas(normalizedQuery, customDuaItems);
  }, [isCustomTab, normalizedQuery, customDuaItems, customVersion]);

  const activeChapter =
    selectedChapterId !== null ? DUA_CHAPTER_MAP[selectedChapterId] : null;

  const showSystemDuaList =
    !isCustomTab &&
    (Boolean(normalizedQuery) ||
      selectedChapterId !== null ||
      filter === 'all' ||
      filter === 'saved');

  const renderSystemDuaRow = (dua: DuaItem, showChapterTag: boolean) => {
    const isBookmarked = bookmarkedSet.has(dua.id);
    const ch = DUA_CHAPTER_MAP[dua.chapterId];

    return (
      <div
        key={dua.id}
        role="button"
        tabIndex={0}
        onClick={() => onOpenDua(dua)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenDua(dua);
          }
        }}
        className="w-full py-4 border-b last:border-b-0 space-y-2 transition-opacity active:opacity-70 cursor-pointer group"
        style={{
          borderColor:
            'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span
              className="w-6 text-xs font-medium tabular-nums shrink-0 pt-0.5"
              style={{ color: 'var(--accent)' }}
            >
              {toBanglaDigits(dua.order)}.
            </span>
            <div className="min-w-0 space-y-1">
              <h3 className="font-semibold text-sm leading-snug">
                {dua.titleBangla}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                {dua.repeatCount && dua.repeatCount > 1 && (
                  <span
                    className="px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent)',
                    }}
                  >
                    {toBanglaDigits(dua.repeatCount)} বার
                  </span>
                )}
                {showChapterTag && ch && (
                  <span style={{ color: 'var(--gold)' }}>{ch.titleBangla}</span>
                )}
                {!showChapterTag && dua.occasionNote && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {dua.occasionNote}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark(dua.id);
              }}
              aria-label="সংরক্ষণ করুন"
              className="p-1.5 rounded-full cursor-pointer transition-opacity active:opacity-70"
              style={{
                color: isBookmarked ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              <Bookmark
                className="w-4 h-4"
                fill={isBookmarked ? 'currentColor' : 'none'}
              />
            </button>
            <ChevronRight
              className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>
        </div>

        <p
          dir="rtl"
          lang="ar"
          className="font-indopak text-right text-[1.15rem] leading-[1.8] line-clamp-1 opacity-85 pl-8"
          style={{ color: 'var(--text-primary)' }}
        >
          {normalizeIndoPakText(dua.arabic)}
        </p>
      </div>
    );
  };

  const renderCustomDuaRow = (dua: DuaItem) => {
    const hasArabic = dua.arabic.trim().length > 0;
    const banglaPreview =
      dua.translationBangla.trim() || (dua.transliteration ?? '').trim();

    return (
      <div
        key={dua.id}
        role="button"
        tabIndex={0}
        onClick={() => onOpenDua(dua)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenDua(dua);
          }
        }}
        className="w-full py-4 border-b last:border-b-0 space-y-2 transition-opacity active:opacity-70 cursor-pointer group"
        style={{
          borderColor:
            'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span
              className="w-6 text-xs font-medium tabular-nums shrink-0 pt-0.5"
              style={{ color: 'var(--accent)' }}
            >
              {toBanglaDigits(dua.order)}.
            </span>
            <div className="min-w-0 space-y-1">
              <h3 className="font-semibold text-sm leading-snug">
                {dua.titleBangla}
              </h3>
              {(Boolean(dua.repeatCount && dua.repeatCount > 1) ||
                Boolean(dua.reference)) && (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  {dua.repeatCount && dua.repeatCount > 1 && (
                    <span
                      className="px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                      }}
                    >
                      {toBanglaDigits(dua.repeatCount)} বার
                    </span>
                  )}
                  {dua.reference && (
                    <span
                      className="truncate max-w-[220px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {dua.reference}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <ChevronRight
            className="w-4 h-4 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
            style={{ color: 'var(--text-muted)' }}
          />
        </div>

        {hasArabic ? (
          <p
            dir="rtl"
            lang="ar"
            className="font-indopak text-right text-[1.15rem] leading-[1.8] line-clamp-1 opacity-85 pl-8"
            style={{ color: 'var(--text-primary)' }}
          >
            {normalizeIndoPakText(dua.arabic)}
          </p>
        ) : banglaPreview ? (
          <p
            className="text-xs leading-relaxed line-clamp-2 pl-8"
            style={{ color: 'var(--text-secondary)' }}
          >
            {banglaPreview}
          </p>
        ) : null}
      </div>
    );
  };

  if (activeChapter) {
    return (
      <div className="min-h-dvh paper-frame pb-20">
        <TopBar
          mode="sticky"
          surface="tinted"
          onBack={() => setSelectedChapterId(null)}
          backLabel="অধ্যায় সমূহে ফিরুন"
          title={activeChapter.titleBangla}
          subtitle={`অধ্যায় ${toBanglaDigits(activeChapter.id)} • ${toBanglaDigits(matchingSystemDuas.length)}টি দুআ ও জিকির`}
          rightActions={
            <TopBarIconButton
              onClick={() => {
                setChapterSearchOpen((prev) => {
                  if (prev) setChapterQuery('');
                  return !prev;
                });
              }}
              label="অধ্যায়ে খুঁজুন"
              active={chapterSearchOpen}
            >
              {chapterSearchOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </TopBarIconButton>
          }
          subRow={
            chapterSearchOpen ? (
              <SoftSearchInput
                autoFocus
                compact
                elevated
                value={chapterQuery}
                onChange={setChapterQuery}
                placeholder="এই অধ্যায়ে খুঁজুন..."
              />
            ) : undefined
          }
        />

        <div className="max-w-2xl mx-auto px-5 pt-4">
          {matchingSystemDuas.length === 0 ? (
            <div
              className="py-12 text-center text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              এই অধ্যায়ে কোনো দুআ পাওয়া যায়নি।
            </div>
          ) : (
            <div>
              {matchingSystemDuas.map((dua) => renderSystemDuaRow(dua, false))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* Full-Bleed Tinted Top Band */}
      <section
        className="w-full safe-top"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-6 space-y-4">
          <TabHeader
            title="দুআ ও জিকির"
            subtitle={`${toBanglaDigits(DUA_CHAPTERS.length)}টি অধ্যায় • মোট ${toBanglaDigits(DUAS.length)}টি দুআ, দরুদ ও রুকইয়া`}
            rightAction={
              <TwoLineMenuButton open={menuOpen} onClick={onOpenMenu} />
            }
          />

          <SoftSearchInput
            elevated
            value={query}
            onChange={setQuery}
            placeholder={
              isCustomTab
                ? 'আমার দুআয় খুঁজুন (শিরোনাম, আরবি বা বাংলা মোনাজাত)...'
                : 'দুআ বা অধ্যায় খুঁজুন (যেমন: সাইয়েদুল, ঘুম, সফর, রুকইয়া, দরুদ)...'
            }
          />
        </div>
      </section>

      {/* Open Editorial Canvas Below */}
      <div className="max-w-2xl mx-auto px-5 pt-5 space-y-4">
        {(!normalizedQuery || isCustomTab) && (
          <UnderlineTabs
            value={filter}
            onChange={handleSelectTab}
            ariaLabel="দুআ বিভাগ নির্বাচন"
            tabs={[
              {
                id: 'chapters',
                label: 'অধ্যায় সমূহ',
                count: toBanglaDigits(DUA_CHAPTERS.length),
              },
              {
                id: 'all',
                label: 'সব দুআ',
                count: toBanglaDigits(DUAS.length),
              },
              {
                id: 'saved',
                label: 'সংরক্ষিত',
                count: toBanglaDigits(savedSystemDuasCount),
              },
              {
                id: 'custom',
                label: 'আমার দুআ',
                count: toBanglaDigits(customDuaItems.length),
              },
            ]}
          />
        )}

        {isCustomTab ? (
          <div className="space-y-3">
            {customDuaItems.length > 0 && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <p
                  className="text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  ব্যক্তিগত দুআ ও মোনাজাত ({toBanglaDigits(customDuaItems.length)}টি)
                </p>
                <button
                  type="button"
                  onClick={() => setCreateSheetOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-85 shrink-0"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন দুআ</span>
                </button>
              </div>
            )}

            {customDuaItems.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-4">
                <span
                  className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  <HeartHandshake className="w-5 h-5" />
                </span>
                <div className="space-y-1.5 max-w-xs mx-auto">
                  <h2 className="text-sm font-semibold">
                    এখনো কোনো ব্যক্তিগত দুআ যুক্ত করা হয়নি
                  </h2>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    আপনার নিজস্ব দুআ বা বাংলা মোনাজাত এখানে আলাদাভাবে সংরক্ষণ করুন। এগুলো কখনোই সিস্টেম দুআর সাথে মিশবে না।
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setCreateSheetOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-opacity active:opacity-85"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>নতুন দুআ যুক্ত করুন</span>
                  </button>
                </div>
              </div>
            ) : matchingCustomDuas.length === 0 ? (
              <div
                className="py-12 text-center text-xs space-y-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                <p
                  className="font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  আপনার “আমার দুআ”-তে কোনো মিল পাওয়া যায়নি।
                </p>
              </div>
            ) : (
              <div>
                {matchingCustomDuas.map((dua) => renderCustomDuaRow(dua))}
              </div>
            )}
          </div>
        ) : !showSystemDuaList ? (
          <div>
            {DUA_CHAPTERS.map((ch) => {
              const count = DUAS_BY_CHAPTER[ch.id]?.length ?? 0;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChapterId(ch.id)}
                  className="w-full py-3.5 border-b last:border-b-0 flex items-center justify-between gap-3 text-left transition-opacity active:opacity-70 cursor-pointer group"
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
                  }}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span
                      className="w-6 text-xs font-medium tabular-nums shrink-0 pt-0.5"
                      style={{ color: 'var(--accent)' }}
                    >
                      {ch.id < 10
                        ? `০${toBanglaDigits(ch.id)}`
                        : toBanglaDigits(ch.id)}
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-sm leading-snug">
                        {ch.titleBangla}
                      </h2>
                      <p
                        className="text-[11px] mt-0.5 line-clamp-1"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {ch.subtitleBangla}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className="text-[11px] font-medium tabular-nums"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {toBanglaDigits(count)}টি
                    </span>
                    <ChevronRight
                      className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ) : matchingSystemDuas.length === 0 ? (
          <div
            className="py-12 text-center text-xs space-y-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              {filter === 'saved' && !normalizedQuery
                ? 'এখনো কোনো দুআ সংরক্ষণ করা হয়নি।'
                : 'কোনো দুআ পাওয়া যায়নি।'}
            </p>
            {filter === 'saved' && !normalizedQuery && (
              <p className="text-[11px]">
                যেকোনো দুআর পাশে থাকা বুকমার্ক আইকনে ট্যাপ করে এখানে সংরক্ষণ করুন।
              </p>
            )}
          </div>
        ) : (
          <div>
            {matchingSystemDuas.map((dua) =>
              renderSystemDuaRow(
                dua,
                Boolean(normalizedQuery) || selectedChapterId === null
              )
            )}
          </div>
        )}
      </div>

      <CustomDuaFormSheet
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
      />
    </div>
  );
}
