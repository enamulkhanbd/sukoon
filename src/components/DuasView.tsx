import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Search,
  Sparkles,
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
import { toBanglaDigits } from '../utils/formatters';

interface DuasViewProps {
  settings: Settings;
  selectedChapterId?: number | null;
  onSelectChapter?: (chapterId: number | null) => void;
  onOpenDua: (dua: DuaItem) => void;
  onToggleBookmark: (duaId: string) => void;
}

type ViewFilter = 'chapters' | 'all' | 'saved';

export function DuasView({
  settings,
  selectedChapterId: controlledChapterId,
  onSelectChapter,
  onOpenDua,
  onToggleBookmark,
}: DuasViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ViewFilter>('chapters');
  const [uncontrolledChapterId, setUncontrolledChapterId] = useState<
    number | null
  >(null);

  const selectedChapterId =
    controlledChapterId !== undefined
      ? controlledChapterId
      : uncontrolledChapterId;

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

  const normalizedQuery = query.trim().toLowerCase();

  const matchingDuas = useMemo(() => {
    let base: DuaItem[] = DUAS;
    if (selectedChapterId !== null && !normalizedQuery) {
      base = DUAS_BY_CHAPTER[selectedChapterId] ?? [];
    } else if (filter === 'saved' && !normalizedQuery) {
      base = DUAS.filter((d) => bookmarkedSet.has(d.id));
    }

    if (!normalizedQuery) return base;
    return DUAS.filter((d) => {
      const ch = DUA_CHAPTER_MAP[d.chapterId];
      return (
        d.titleBangla.toLowerCase().includes(normalizedQuery) ||
        d.translationBangla.toLowerCase().includes(normalizedQuery) ||
        (d.occasionNote ?? '').toLowerCase().includes(normalizedQuery) ||
        (d.reference ?? '').toLowerCase().includes(normalizedQuery) ||
        d.arabic.includes(query.trim()) ||
        (ch?.titleBangla.toLowerCase().includes(normalizedQuery) ?? false)
      );
    });
  }, [normalizedQuery, selectedChapterId, filter, bookmarkedSet, query]);

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
        className="w-full rounded-2xl border p-3.5 sm:p-4 space-y-2.5 transition-colors cursor-pointer active:scale-[0.995]"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span
              className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--accent)',
              }}
            >
              {toBanglaDigits(dua.order)}
            </span>
            <div className="min-w-0 space-y-1">
              <h3 className="font-semibold text-sm leading-snug">
                {dua.titleBangla}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                {dua.repeatCount && dua.repeatCount > 1 && (
                  <span
                    className="px-2 py-0.5 rounded-full font-semibold"
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

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark(dua.id);
              }}
              aria-label="সংরক্ষণ করুন"
              className="p-1.5 rounded-lg cursor-pointer"
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
              className="w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>
        </div>

        <p
          dir="rtl"
          lang="ar"
          className="font-indopak text-right text-lg leading-loose line-clamp-1 opacity-90"
          style={{ color: 'var(--text-primary)' }}
        >
          {dua.arabic}
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">দুআ ও জিকির</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {toBanglaDigits(DUA_CHAPTERS.length)}টি অধ্যায় • মোট{' '}
            {toBanglaDigits(DUAS.length)}টি দুআ, দরুদ ও রুকইয়া
          </p>
        </div>
      </header>

      {/* Search bar */}
      <div className="relative">
        <Search
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="দুআ বা অধ্যায় খুঁজুন (যেমন: সাইয়েদুল, ঘুম, সফর, রুকইয়া, দরুদ)..."
          className="w-full pl-10 pr-9 py-2.5 rounded-2xl border text-sm outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="অনুসন্ধান মুছুন"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Mode / Filter Pills */}
      {!normalizedQuery && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(
            [
              ['chapters', `অধ্যায় সমূহ (${toBanglaDigits(DUA_CHAPTERS.length)})`],
              ['all', `সব দুআ (${toBanglaDigits(DUAS.length)})`],
              ['saved', `সংরক্ষিত (${toBanglaDigits(bookmarkedSet.size)})`],
            ] as const
          ).map(([id, label]) => {
            const active = selectedChapterId === null && filter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSelectedChapterId(null);
                  setFilter(id);
                }}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer"
                style={{
                  backgroundColor: active
                    ? 'var(--accent)'
                    : 'var(--bg-elevated)',
                  borderColor: active
                    ? 'var(--accent)'
                    : 'var(--border-subtle)',
                  color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Chapter Breadcrumb Header */}
      {!normalizedQuery && activeChapter && (
        <div
          className="rounded-2xl border p-3.5 flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedChapterId(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium shrink-0 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              অধ্যায়
            </button>
            <div className="min-w-0">
              <h2 className="font-bold text-sm truncate">
                {activeChapter.titleBangla}
              </h2>
              <p
                className="text-[11px] truncate"
                style={{ color: 'var(--text-secondary)' }}
              >
                {toBanglaDigits(matchingDuas.length)}টি দুআ ও জিকির
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chapter Directory Grid vs Dua List */}
      {!showDuaList ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DUA_CHAPTERS.map((ch) => {
            const count = DUAS_BY_CHAPTER[ch.id]?.length ?? 0;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChapterId(ch.id)}
                className="text-left rounded-2xl border p-4 space-y-2 transition-colors cursor-pointer active:scale-[0.995]"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    অধ্যায় {toBanglaDigits(ch.id)}
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {toBanglaDigits(count)}টি
                  </span>
                </div>
                <div>
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
              </button>
            );
          })}
        </div>
      ) : matchingDuas.length === 0 ? (
        <div
          className="rounded-2xl border p-8 text-center text-sm space-y-1"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <p>
            {filter === 'saved' && !normalizedQuery
              ? 'এখনো কোনো দুআ সংরক্ষণ করা হয়নি।'
              : 'কোনো দুআ পাওয়া যায়নি।'}
          </p>
          {filter === 'saved' && !normalizedQuery && (
            <p className="text-xs">
              যেকোনো দুআর পাশে থাকা বুকমার্ক আইকনে ট্যাপ করে এখানে সংরক্ষণ করুন।
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {matchingDuas.map((dua) =>
            renderDuaRow(
              dua,
              Boolean(normalizedQuery) || selectedChapterId === null
            )
          )}
        </div>
      )}
    </div>
  );
}
