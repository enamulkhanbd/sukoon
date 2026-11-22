import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import {
  DUA_CHAPTER_MAP,
  DUA_CHAPTERS,
  DUAS,
  DUAS_BY_CHAPTER,
  type DuaItem,
} from '../data/duas';
import type { Settings } from '../db/database';
import { normalizeIndoPakText, toBanglaDigits } from '../utils/formatters';
import { searchDuas } from '../utils/searchEngine';
import {
  SoftSearchInput,
  TabHeader,
  TopBar,
  TopBarIconButton,
  UnderlineTabs,
} from './NavigationChrome';

interface DuasViewProps {
  settings: Settings;
  selectedChapterId?: number | null;
  savedFilterNonce?: number;
  onSelectChapter?: (chapterId: number | null) => void;
  onOpenDua: (dua: DuaItem) => void;
  onToggleBookmark: (duaId: string) => void;
}

type ViewFilter = 'chapters' | 'all' | 'saved';

export function DuasView({
  settings,
  selectedChapterId: controlledChapterId,
  savedFilterNonce = 0,
  onSelectChapter,
  onOpenDua,
  onToggleBookmark,
}: DuasViewProps) {
  const [query, setQuery] = useState('');
  const [chapterSearchOpen, setChapterSearchOpen] = useState(false);
  const [chapterQuery, setChapterQuery] = useState('');
  const [filter, setFilter] = useState<ViewFilter>('chapters');
  const [uncontrolledChapterId, setUncontrolledChapterId] = useState<
    number | null
  >(null);

  const selectedChapterId =
    controlledChapterId !== undefined
      ? controlledChapterId
      : uncontrolledChapterId;

  useEffect(() => {
    if (savedFilterNonce > 0) {
      setFilter('saved');
      setQuery('');
    }
  }, [savedFilterNonce]);

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

  const bookmarkedSet = useMemo(
    () => new Set(settings.bookmarkedDuaIds ?? []),
    [settings.bookmarkedDuaIds]
  );

  const normalizedQuery = query.trim();
  const normalizedChapterQuery = chapterQuery.trim();

  const matchingDuas = useMemo(() => {
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
    normalizedQuery,
    normalizedChapterQuery,
    selectedChapterId,
    filter,
    bookmarkedSet,
  ]);

  const activeChapter =
    selectedChapterId !== null ? DUA_CHAPTER_MAP[selectedChapterId] : null;

  const showDuaList =
    Boolean(normalizedQuery) ||
    selectedChapterId !== null ||
    filter === 'all' ||
    filter === 'saved';

  const renderDuaRow = (dua: DuaItem, showChapterTag: boolean) => {
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

  if (activeChapter) {
    return (
      <div className="min-h-dvh paper-frame pb-20">
        <TopBar
          mode="sticky"
          surface="tinted"
          onBack={() => setSelectedChapterId(null)}
          backLabel="অধ্যায় সমূহে ফিরুন"
          title={activeChapter.titleBangla}
          subtitle={`অধ্যায় ${toBanglaDigits(activeChapter.id)} • ${toBanglaDigits(matchingDuas.length)}টি দুআ ও জিকির`}
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
          {matchingDuas.length === 0 ? (
            <div
              className="py-12 text-center text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              এই অধ্যায়ে কোনো দুআ পাওয়া যায়নি।
            </div>
          ) : (
            <div>
              {matchingDuas.map((dua) => renderDuaRow(dua, false))}
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
          />

          <SoftSearchInput
            elevated
            value={query}
            onChange={setQuery}
            placeholder="দুআ বা অধ্যায় খুঁজুন (যেমন: সাইয়েদুল, ঘুম, সফর, রুকইয়া, দরুদ)..."
          />
        </div>
      </section>

      {/* Open Editorial Canvas Below (Zero Boxes) */}
      <div className="max-w-2xl mx-auto px-5 pt-5 space-y-4">
        {!normalizedQuery && (
          <UnderlineTabs
            value={filter}
            onChange={(next) => {
              setSelectedChapterId(null);
              setFilter(next);
            }}
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
                count: toBanglaDigits(bookmarkedSet.size),
              },
            ]}
          />
        )}

        {/* Plain Editorial Chapter Directory vs Dua List */}
        {!showDuaList ? (
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
                      {ch.id < 10 ? `০${toBanglaDigits(ch.id)}` : toBanglaDigits(ch.id)}
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
        ) : matchingDuas.length === 0 ? (
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
            {matchingDuas.map((dua) =>
              renderDuaRow(
                dua,
                Boolean(normalizedQuery) || selectedChapterId === null
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
