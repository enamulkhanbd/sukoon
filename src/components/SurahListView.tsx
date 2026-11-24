import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, BookOpen, Clock, Sparkles } from 'lucide-react';
import { SURAH_MAP, SURAHS, type SurahMeta } from '../data/surahs';
import { db, type GlobalLastRead, type Settings } from '../db/database';
import { useIslamicClock } from '../hooks/useIslamicClock';
import { useAllSurahOverrides } from '../services/contentCatalog';
import { isSurahFullyCached } from '../services/quranApi';
import { toBanglaDigits } from '../utils/formatters';
import { JUMMAH_SURAH_ID } from '../utils/islamicTime';
import {
  JUZ_START_MAP,
  parseSmartJumps,
  searchSurahs,
  toAsciiDigits,
} from '../utils/searchEngine';
import {
  SoftSearchInput,
  TabHeader,
  UnderlineTabs,
} from './NavigationChrome';

interface SurahListViewProps {
  settings: Settings;
  onOpenSurah: (
    surahId: number,
    initialAyah?: number,
    initialPage?: number
  ) => void;
}

type BrowseTab = 'surah' | 'juz' | 'page';

const TOTAL_SURAHS_COUNT = SURAHS.length;
const TOTAL_JUZ_COUNT = 30;
const TOTAL_PAGES_COUNT = 604;
const PAGE_BATCH_SIZE = 60;

interface JuzEntry {
  juz: number;
  startSurah: SurahMeta;
  startAyah: number;
  endSurah: SurahMeta;
  endAyah: number;
  surahIds: Set<number>;
  rangeLabel: string;
}

interface PageEntry {
  page: number;
  surahs: SurahMeta[];
  surahIds: Set<number>;
  surahsLabel: string;
}

const JUZ_LIST: JuzEntry[] = Array.from({ length: TOTAL_JUZ_COUNT }, (_, idx) => {
  const juz = idx + 1;
  const start = JUZ_START_MAP[juz];
  const startSurah = SURAH_MAP[start.surahId];

  let endSurahId = 114;
  let endAyah = SURAH_MAP[114].versesCount;
  if (juz < TOTAL_JUZ_COUNT) {
    const next = JUZ_START_MAP[juz + 1];
    if (next.ayah > 1) {
      endSurahId = next.surahId;
      endAyah = next.ayah - 1;
    } else {
      endSurahId = next.surahId - 1;
      endAyah = SURAH_MAP[endSurahId].versesCount;
    }
  }
  const endSurah = SURAH_MAP[endSurahId];
  const surahIds = new Set<number>();
  for (let s = startSurah.id; s <= endSurah.id; s++) {
    surahIds.add(s);
  }

  const rangeLabel =
    startSurah.id === endSurah.id
      ? `সূরা ${startSurah.nameBangla} ${toBanglaDigits(start.ayah)}–${toBanglaDigits(endAyah)}`
      : `সূরা ${startSurah.nameBangla} ${toBanglaDigits(start.ayah)} – ${endSurah.nameBangla} ${toBanglaDigits(endAyah)}`;

  return {
    juz,
    startSurah,
    startAyah: start.ayah,
    endSurah,
    endAyah,
    surahIds,
    rangeLabel,
  };
});

const PAGE_LIST: PageEntry[] = Array.from(
  { length: TOTAL_PAGES_COUNT },
  (_, idx) => {
    const page = idx + 1;
    const surahs = SURAHS.filter(
      (s) => page >= s.pages[0] && page <= s.pages[1]
    );
    const surahIds = new Set(surahs.map((s) => s.id));
    const surahsLabel = surahs.map((s) => `সূরা ${s.nameBangla}`).join(' • ');
    return { page, surahs, surahIds, surahsLabel };
  }
);

export function SurahListView({
  settings,
  onOpenSurah,
}: SurahListViewProps) {
  const [query, setQuery] = useState('');
  const [browseTab, setBrowseTab] = useState<BrowseTab>('surah');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [visiblePageCount, setVisiblePageCount] = useState(PAGE_BATCH_SIZE);
  const pageSentinelRef = useRef<HTMLDivElement | null>(null);
  const clock = useIslamicClock(settings);
  const { surahInfoMap, allSurahTags } = useAllSurahOverrides();

  const cachedRows = useLiveQuery(() => db.cachedSurahs.toArray(), []);
  const lastReadRows = useLiveQuery(() => db.globalLastRead.toArray(), []);

  const cachedSet = useMemo(
    () =>
      new Set<number>(
        (cachedRows ?? [])
          .filter((c) => isSurahFullyCached(c, c.surahId))
          .map((c) => c.surahId)
      ),
    [cachedRows]
  );

  const surahLastReadMap = useMemo(() => {
    const map = new Map<number, GlobalLastRead>();
    for (const row of lastReadRows ?? []) {
      if (row.id !== 'current' && !row.id.startsWith('surah-')) continue;
      const existing = map.get(row.surahId);
      if (!existing || row.timestamp >= existing.timestamp) {
        map.set(row.surahId, row);
      }
    }
    return map;
  }, [lastReadRows]);

  const smartJumps = useMemo(() => {
    const trimmed = query.trim();
    return trimmed ? parseSmartJumps(trimmed) : [];
  }, [query]);

  const resolvePageAyah = (surahId: number, page: number): number => {
    const cached = (cachedRows ?? []).find((c) => c.surahId === surahId);
    const match = cached?.verses.find((v) => v.page_number === page);
    return match?.verse_number ?? 1;
  };

  const resolveJumpAyah = (jump: (typeof smartJumps)[number]): number => {
    if (jump.kind !== 'page' || !jump.page) return jump.ayah;
    return resolvePageAyah(jump.surah.id, jump.page);
  };

  const filteredSurahs = useMemo(() => {
    const trimmed = query.trim();
    const base = trimmed ? searchSurahs(trimmed).map((r) => r.surah) : SURAHS;
    if (!selectedTag) return base;
    return base.filter((s) =>
      surahInfoMap[s.id]?.occasionTags.includes(selectedTag)
    );
  }, [query, selectedTag, surahInfoMap]);

  const filteredJuz = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return JUZ_LIST;
    const ascii = toAsciiDigits(trimmed).toLowerCase();
    if (ascii.includes('আম্মাপারা') || ascii.includes('amma')) {
      return JUZ_LIST.filter((j) => j.juz === 30);
    }
    const numMatch =
      /^(?:(?:পারা|জুজ|juz|para|sipara)\s*[:#-]?\s*)?(\d{1,2})$/i.exec(ascii) ??
      /^(\d{1,2})\s*(?:নং|তম)?\s*(?:পারা|জুজ|juz|para)$/i.exec(ascii);
    if (numMatch) {
      const n = Number.parseInt(numMatch[1], 10);
      return JUZ_LIST.filter((j) => j.juz === n);
    }
    const matchedSurahIds = new Set(searchSurahs(trimmed).map((r) => r.surah.id));
    if (matchedSurahIds.size === 0) return [];
    return JUZ_LIST.filter((j) =>
      Array.from(matchedSurahIds).some((id) => j.surahIds.has(id))
    );
  }, [query]);

  const filteredPages = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return PAGE_LIST;
    const ascii = toAsciiDigits(trimmed);
    const numMatch =
      /^(?:(?:পৃষ্ঠা|পৃঃ|পৃ|পেজ|page|pg|p)\s*[:#-]?\s*)?(\d{1,3})$/i.exec(ascii) ??
      /^(\d{1,3})\s*(?:নং)?\s*(?:পৃষ্ঠা|পেজ|page)$/i.exec(ascii);
    if (numMatch) {
      const targetStr = String(Number.parseInt(numMatch[1], 10));
      const exact = PAGE_LIST.filter((p) => String(p.page) === targetStr);
      const prefix = PAGE_LIST.filter(
        (p) => String(p.page) !== targetStr && String(p.page).startsWith(targetStr)
      );
      return [...exact, ...prefix];
    }
    const matchedSurahIds = new Set(searchSurahs(trimmed).map((r) => r.surah.id));
    if (matchedSurahIds.size === 0) return [];
    return PAGE_LIST.filter((p) =>
      Array.from(matchedSurahIds).some((id) => p.surahIds.has(id))
    );
  }, [query]);

  useEffect(() => {
    setVisiblePageCount(PAGE_BATCH_SIZE);
  }, [browseTab, query]);

  useEffect(() => {
    if (browseTab !== 'page') return;
    if (visiblePageCount >= filteredPages.length) return;
    const el = pageSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisiblePageCount((prev) =>
            Math.min(filteredPages.length, prev + PAGE_BATCH_SIZE)
          );
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [browseTab, visiblePageCount, filteredPages.length]);

  const kahfSurah = SURAH_MAP[JUMMAH_SURAH_ID];
  const waqtSurah = SURAH_MAP[clock.waqtSuggestion.surahId];

  const getResumeAyahFor = (surahId: number, versesCount: number): number => {
    const lr = surahLastReadMap.get(surahId);
    if (!lr) return 1;
    const clamped = Math.min(Math.max(lr.ayahNumber, 1), versesCount);
    return clamped > 1 && clamped < versesCount ? clamped : 1;
  };

  return (
    <div className="pb-28">
      {/* Full-Bleed Tinted Top Band (100% matched with DuasView) */}
      <section
        className="w-full safe-top"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-6 space-y-4">
          <TabHeader
            title="আল-কুরআন"
            subtitle={`১১৪ সূরা • ৩০ পারা • ৬০৪ পৃষ্ঠা • ${toBanglaDigits(cachedSet.size)}টি অফলাইনে`}
          />

          <SoftSearchInput
            elevated
            value={query}
            onChange={setQuery}
            placeholder="সূরা, ২:২৫৫, বাকারা ২৫৫, পারা ৩০ বা পৃষ্ঠা খুঁজুন..."
          />
        </div>
      </section>

      {/* Open Editorial Canvas Below */}
      <div className="max-w-2xl mx-auto px-5 pt-5 space-y-6">
        {/* Smart Direct Jump Cards (Ayah, Surah+Ayah, Juz, Page, Famous Ayahs) */}
        {smartJumps.length > 0 && (
          <section className="space-y-2" aria-label="সরাসরি যান">
            {smartJumps.map((jump) => (
              <button
                key={jump.id}
                type="button"
                onClick={() =>
                  onOpenSurah(
                    jump.surah.id,
                    resolveJumpAyah(jump),
                    jump.kind === 'page' ? jump.page : undefined
                  )
                }
                className="w-full rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-opacity active:opacity-80 cursor-pointer"
                style={{ backgroundColor: 'var(--bg-surface)' }}
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
            ))}
          </section>
        )}

        {/* Contextual Time-based Surah Suggestion Card Outside Header */}
        {query.trim().length === 0 && ((clock.isJummah && kahfSurah) || waqtSurah) && (
          <section
            aria-label="সময়োপযোগী সূরা সাজেশন"
            className="rounded-2xl px-4 py-3.5 border space-y-3"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {clock.isJummah && kahfSurah && (
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  onOpenSurah(
                    kahfSurah.id,
                    getResumeAyahFor(kahfSurah.id, kahfSurah.versesCount)
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenSurah(
                      kahfSurah.id,
                      getResumeAyahFor(kahfSurah.id, kahfSurah.versesCount)
                    );
                  }
                }}
                className="flex items-center justify-between gap-3 transition-opacity active:opacity-75 cursor-pointer group"
              >
                <div className="min-w-0 space-y-0.5">
                  <div
                    className="inline-flex items-center gap-1 text-[11px] font-medium"
                    style={{ color: 'var(--gold)' }}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>জুমুআর আমল • বৃহঃ মাগরিব – শুক্র মাগরিব</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <h2 className="text-base font-semibold">
                      সূরা {kahfSurah.nameBangla}
                    </h2>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ({kahfSurah.meaningBangla})
                    </span>
                  </div>
                  <p
                    className="text-[11px]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {(() => {
                      const resume = getResumeAyahFor(
                        kahfSurah.id,
                        kahfSurah.versesCount
                      );
                      return resume > 1
                        ? `সর্বশেষ: আয়াত ${toBanglaDigits(resume)}/${toBanglaDigits(kahfSurah.versesCount)} • চালিয়ে যান`
                        : `${toBanglaDigits(kahfSurah.versesCount)} আয়াত • জুমুআর দিনে বিশেষ ফযিলতপূর্ণ সূরা`;
                    })()}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span
                    className="font-surah-names font-surah-names-end text-[2.25rem] leading-none select-none"
                    style={{ color: 'var(--gold)' }}
                    aria-hidden="true"
                  >
                    {String(kahfSurah.id).padStart(3, '0')}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium"
                    style={{ color: 'var(--gold)' }}
                  >
                    পাঠ করুন
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            )}

            {clock.isJummah && kahfSurah && waqtSurah && (
              <div
                className="h-px w-full"
                style={{
                  backgroundColor:
                    'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
                }}
                aria-hidden="true"
              />
            )}

            {waqtSurah &&
              (clock.isJummah ? (
                <button
                  type="button"
                  onClick={() =>
                    onOpenSurah(
                      waqtSurah.id,
                      getResumeAyahFor(waqtSurah.id, waqtSurah.versesCount)
                    )
                  }
                  className="w-full pt-0.5 flex items-center justify-between gap-2.5 text-left transition-opacity active:opacity-75 cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                    <span
                      className="text-[11px] font-medium shrink-0"
                      style={{ color: 'var(--accent)' }}
                    >
                      {clock.waqtSuggestion.contextLabelBn}
                    </span>
                    <span className="text-xs font-medium truncate">
                      সূরা {waqtSurah.nameBangla}
                    </span>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium shrink-0"
                    style={{ color: 'var(--accent)' }}
                  >
                    পাঠ করুন
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    onOpenSurah(
                      waqtSurah.id,
                      getResumeAyahFor(waqtSurah.id, waqtSurah.versesCount)
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenSurah(
                        waqtSurah.id,
                        getResumeAyahFor(waqtSurah.id, waqtSurah.versesCount)
                      );
                    }
                  }}
                  className="flex items-center justify-between gap-3 transition-opacity active:opacity-75 cursor-pointer group"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        <Clock className="w-3 h-3" />
                        {clock.waqtSuggestion.contextLabelBn}
                      </span>
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {clock.waqtWindow.startFormatted} –{' '}
                        {clock.waqtWindow.endFormatted}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <h2 className="text-sm font-semibold">
                        সূরা {waqtSurah.nameBangla}
                      </h2>
                      <span
                        className="text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        ({waqtSurah.meaningBangla})
                      </span>
                    </div>
                    <p
                      className="text-[11px] truncate"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {(() => {
                        const resume = getResumeAyahFor(
                          waqtSurah.id,
                          waqtSurah.versesCount
                        );
                        return resume > 1
                          ? `সর্বশেষ: আয়াত ${toBanglaDigits(resume)}/${toBanglaDigits(waqtSurah.versesCount)} • চালিয়ে যান`
                          : clock.waqtSuggestion.hintBn;
                      })()}
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span
                      className="font-surah-names font-surah-names-end text-[2.25rem] leading-none select-none"
                      style={{ color: 'var(--accent)' }}
                      aria-hidden="true"
                    >
                      {String(waqtSurah.id).padStart(3, '0')}
                    </span>
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium"
                      style={{ color: 'var(--accent)' }}
                    >
                      পাঠ করুন
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              ))}
          </section>
        )}

        <section className="space-y-3">
          <UnderlineTabs
            value={browseTab}
            onChange={setBrowseTab}
            ariaLabel="কুরআন বিভাগ"
            tabs={[
              { id: 'surah', label: 'সূরা', count: toBanglaDigits(TOTAL_SURAHS_COUNT) },
              { id: 'juz', label: 'পারা', count: toBanglaDigits(TOTAL_JUZ_COUNT) },
              { id: 'page', label: 'পৃষ্ঠা', count: toBanglaDigits(TOTAL_PAGES_COUNT) },
            ]}
          />

          {browseTab === 'surah' && allSurahTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="px-3 py-1 rounded-full text-[11px] font-medium shrink-0 border transition-colors cursor-pointer"
                style={{
                  backgroundColor:
                    selectedTag === null ? 'var(--accent)' : 'var(--bg-elevated)',
                  borderColor:
                    selectedTag === null ? 'var(--accent)' : 'var(--border-subtle)',
                  color:
                    selectedTag === null
                      ? 'var(--accent-text)'
                      : 'var(--text-secondary)',
                }}
              >
                সব সূরা
              </button>
              {allSurahTags.map((tag) => {
                const active = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(active ? null : tag)}
                    className="px-3 py-1 rounded-full text-[11px] font-medium shrink-0 border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: active
                        ? 'var(--accent)'
                        : 'var(--bg-elevated)',
                      borderColor: active
                        ? 'var(--accent)'
                        : 'var(--border-subtle)',
                      color: active
                        ? 'var(--accent-text)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          {browseTab === 'surah' &&
            (filteredSurahs.length === 0 ? (
              smartJumps.length > 0 ? null : (
                <div
                  className="py-12 text-center text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  কোনো সূরা পাওয়া যায়নি।
                </div>
              )
            ) : (
              <div>
                {filteredSurahs.map((surah) => {
                  const lastRead = surahLastReadMap.get(surah.id);
                  const lastAyah = lastRead
                    ? Math.min(Math.max(lastRead.ayahNumber, 1), surah.versesCount)
                    : 0;
                  const showProgress = lastAyah > 0 && lastAyah < surah.versesCount;
                  const percent = showProgress
                    ? Math.min(99, Math.round((lastAyah / surah.versesCount) * 100))
                    : 0;
                  const resumeAyah = showProgress ? lastAyah : 1;

                  return (
                    <div
                      key={surah.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenSurah(surah.id, resumeAyah)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenSurah(surah.id, resumeAyah);
                        }
                      }}
                      className="py-3.5 border-b last:border-b-0 transition-opacity active:opacity-70 cursor-pointer"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span
                            className="w-7 text-xs font-medium tabular-nums shrink-0"
                            style={{ color: 'var(--accent)' }}
                          >
                            {toBanglaDigits(surah.id)}.
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              <span className="font-semibold text-sm truncate">
                                {surah.nameBangla}
                              </span>
                              <span
                                className="text-[11px] truncate"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                ({surah.meaningBangla})
                              </span>
                            </div>
                            <div
                              className="text-[11px] flex items-center gap-1.5 mt-0.5 tabular-nums"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              <span>{toBanglaDigits(surah.versesCount)} আয়াত</span>
                              <span className="opacity-40">•</span>
                              <span>
                                {surah.revelationPlace === 'makkah' ? 'মাক্কী' : 'মাদানী'}
                              </span>
                              <span className="opacity-40">•</span>
                              <span>পৃষ্ঠা {toBanglaDigits(surah.pages[0])}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          className="font-surah-names font-surah-names-end text-[2rem] leading-none shrink-0 select-none"
                          style={{ color: 'var(--text-primary)' }}
                          aria-hidden="true"
                        >
                          {String(surah.id).padStart(3, '0')}
                        </span>
                      </div>

                      {showProgress && (
                        <div className="mt-2 pl-10.5 space-y-1">
                          <div className="text-[11px]">
                            <span
                              className="font-medium tabular-nums"
                              style={{ color: 'var(--accent)' }}
                            >
                              সর্বশেষ: আয়াত {toBanglaDigits(lastAyah)}/{toBanglaDigits(surah.versesCount)}
                            </span>
                          </div>
                          <div
                            className="h-[3px] w-full rounded-full overflow-hidden"
                            style={{
                              backgroundColor:
                                'color-mix(in srgb, var(--text-primary) 10%, transparent)',
                            }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${percent}%`,
                                backgroundColor: 'var(--accent)',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          {browseTab === 'juz' &&
            (filteredJuz.length === 0 ? (
              smartJumps.length > 0 ? null : (
                <div
                  className="py-12 text-center text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  কোনো পারা পাওয়া যায়নি।
                </div>
              )
            ) : (
              <div>
                {filteredJuz.map((item) => (
                  <button
                    key={item.juz}
                    type="button"
                    onClick={() => onOpenSurah(item.startSurah.id, item.startAyah)}
                    className="w-full py-3.5 border-b last:border-b-0 flex items-center justify-between gap-3 text-left transition-opacity active:opacity-70 cursor-pointer"
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
                    }}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className="w-7 text-xs font-medium tabular-nums shrink-0"
                        style={{ color: 'var(--accent)' }}
                      >
                        {toBanglaDigits(item.juz)}.
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="font-semibold text-sm truncate">
                            পারা {toBanglaDigits(item.juz)}
                          </span>
                          <span
                            className="text-[11px] tabular-nums shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            • {toBanglaDigits(item.surahIds.size)}টি সূরা
                          </span>
                        </div>
                        <div
                          className="text-[11px] truncate mt-0.5 tabular-nums"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {item.rangeLabel}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {toBanglaDigits(item.startSurah.id)}:
                        {toBanglaDigits(item.startAyah)}
                      </span>
                      <ArrowRight
                        className="w-3.5 h-3.5"
                        style={{ color: 'var(--text-muted)' }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            ))}

          {browseTab === 'page' &&
            (filteredPages.length === 0 ? (
              smartJumps.length > 0 ? null : (
                <div
                  className="py-12 text-center text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  কোনো পৃষ্ঠা পাওয়া যায়নি।
                </div>
              )
            ) : (
              <div>
                {filteredPages.slice(0, visiblePageCount).map((item) => {
                  const primarySurah = item.surahs[0];
                  if (!primarySurah) return null;
                  return (
                    <button
                      key={item.page}
                      type="button"
                      onClick={() =>
                        onOpenSurah(
                          primarySurah.id,
                          resolvePageAyah(primarySurah.id, item.page),
                          item.page
                        )
                      }
                      className="w-full py-3.5 border-b last:border-b-0 flex items-center justify-between gap-3 text-left transition-opacity active:opacity-70 cursor-pointer"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
                      }}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className="w-8 text-xs font-medium tabular-nums shrink-0"
                          style={{ color: 'var(--accent)' }}
                        >
                          {toBanglaDigits(item.page)}.
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            পৃষ্ঠা {toBanglaDigits(item.page)}
                          </div>
                          <div
                            className="text-[11px] truncate mt-0.5"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {item.surahsLabel}
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

                {visiblePageCount < filteredPages.length && (
                  <div
                    ref={pageSentinelRef}
                    className="pt-4 pb-2 flex justify-center"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setVisiblePageCount((prev) =>
                          Math.min(filteredPages.length, prev + PAGE_BATCH_SIZE)
                        )
                      }
                      className="px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-80"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--accent)',
                      }}
                    >
                      আরও পৃষ্ঠা দেখুন ({toBanglaDigits(visiblePageCount)}/
                      {toBanglaDigits(filteredPages.length)})
                    </button>
                  </div>
                )}
              </div>
            ))}
        </section>
      </div>
    </div>
  );
}
