import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Clock, Sparkles } from 'lucide-react';
import { SURAH_MAP, SURAHS } from '../data/surahs';
import { db, type GlobalLastRead, type Settings } from '../db/database';
import { useIslamicClock } from '../hooks/useIslamicClock';
import { isSurahFullyCached } from '../services/quranApi';
import { toBanglaDigits } from '../utils/formatters';
import { JUMMAH_SURAH_ID } from '../utils/islamicTime';
import { LastReadSurahCard } from './LastReadSurahCard';
import { SoftSearchInput, TabHeader, UnderlineTabs } from './NavigationChrome';

interface SurahListViewProps {
  settings: Settings;
  onOpenSurah: (surahId: number, initialAyah?: number) => void;
}

type FilterMode = 'all' | 'offline' | 'makkah' | 'madinah';

const TOTAL_SURAHS_COUNT = SURAHS.length;
const MAKKAH_SURAHS_COUNT = SURAHS.filter(
  (s) => s.revelationPlace === 'makkah'
).length;
const MADINAH_SURAHS_COUNT = SURAHS.filter(
  (s) => s.revelationPlace === 'madinah'
).length;

export function SurahListView({ settings, onOpenSurah }: SurahListViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const clock = useIslamicClock(settings);

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

  const currentLastRead = useMemo(
    () => (lastReadRows ?? []).find((row) => row.id === 'current'),
    [lastReadRows]
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SURAHS.filter((s) => {
      if (filter === 'offline' && !cachedSet.has(s.id)) return false;
      if (filter === 'makkah' && s.revelationPlace !== 'makkah') return false;
      if (filter === 'madinah' && s.revelationPlace !== 'madinah') return false;

      if (!q) return true;
      return (
        String(s.id).includes(q) ||
        toBanglaDigits(s.id).includes(q) ||
        s.nameBangla.toLowerCase().includes(q) ||
        s.meaningBangla.toLowerCase().includes(q) ||
        s.nameSimple.toLowerCase().includes(q) ||
        s.nameArabic.includes(q)
      );
    });
  }, [query, filter, cachedSet]);

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
      {/* Full-Bleed Tinted Top Band (Title + Pill Search + Contextual Suggestion) */}
      <section
        className="w-full safe-top"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-6 space-y-5">
          <TabHeader
            title="সূরা সমূহ"
            subtitle={`মোট ১১৪টি সূরা • ${toBanglaDigits(cachedSet.size)}টি অফলাইনে সংরক্ষিত`}
          />

          <SoftSearchInput
            elevated
            value={query}
            onChange={setQuery}
            placeholder="সূরার নাম বা নম্বর লিখুন (যেমন: কাহফ, ১৮, Yasin)..."
          />

          {/* Contextual Time-based Surah Suggestion directly inside top band (unboxed) */}
          {query.trim().length === 0 && (
            <div className="space-y-4" aria-label="সময়োপযোগী সূরা সাজেশন">
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
                      className="inline-flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: 'var(--gold)' }}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>জুমুআর আমল • বৃহঃ মাগরিব – শুক্র মাগরিব</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <h2 className="text-base font-bold tracking-tight">
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
                      className="font-surah-names text-[2.25rem] leading-none select-none"
                      style={{ color: 'var(--gold)' }}
                      aria-hidden="true"
                    >
                      {String(kahfSurah.id).padStart(3, '0')}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: 'var(--gold)' }}
                    >
                      পাঠ করুন
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
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
                    className="w-full pt-1 flex items-center justify-between gap-2.5 text-left transition-opacity active:opacity-75 cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                      <span
                        className="text-[11px] font-semibold shrink-0"
                        style={{ color: 'var(--accent)' }}
                      >
                        {clock.waqtSuggestion.contextLabelBn}
                      </span>
                      <span className="text-xs font-semibold truncate">
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
                          className="inline-flex items-center gap-1 text-[11px] font-semibold"
                          style={{ color: 'var(--accent)' }}
                        >
                          <Clock className="w-3 h-3" />
                          {clock.waqtSuggestion.contextLabelBn}
                        </span>
                        <span
                          className="text-[10px] tabular-nums"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {clock.waqtWindow.startFormatted} –{' '}
                          {clock.waqtWindow.endFormatted}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <h2 className="text-sm font-bold tracking-tight">
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
                        className="font-surah-names text-[2.25rem] leading-none select-none"
                        style={{ color: 'var(--accent)' }}
                        aria-hidden="true"
                      >
                        {String(waqtSurah.id).padStart(3, '0')}
                      </span>
                      <span
                        className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
                        style={{ color: 'var(--accent)' }}
                      >
                        পাঠ করুন
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* Open Editorial Canvas Below (Zero Boxes for 114 Surahs) */}
      <div className="max-w-2xl mx-auto px-5 pt-5 space-y-6">
        {currentLastRead && SURAH_MAP[currentLastRead.surahId] && !query.trim() && (
          <div className="space-y-2.5">
            <h2 className="text-sm font-semibold">সর্বশেষ তিলাওয়াত</h2>
            <LastReadSurahCard
              lastRead={currentLastRead}
              onOpenSurah={onOpenSurah}
            />
          </div>
        )}

        <section className="space-y-3">
          <UnderlineTabs
            value={filter}
            onChange={setFilter}
            ariaLabel="সূরা ফিল্টার"
            tabs={[
              { id: 'all', label: 'সব', count: toBanglaDigits(TOTAL_SURAHS_COUNT) },
              { id: 'offline', label: 'অফলাইন', count: toBanglaDigits(cachedSet.size) },
              { id: 'makkah', label: 'মাক্কী', count: toBanglaDigits(MAKKAH_SURAHS_COUNT) },
              { id: 'madinah', label: 'মাদানী', count: toBanglaDigits(MADINAH_SURAHS_COUNT) },
            ]}
          />

          {filtered.length === 0 ? (
            <div
              className="py-12 text-center text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              কোনো সূরা পাওয়া যায়নি।
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((surah) => {
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
                    className="py-3 transition-opacity active:opacity-70 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className="w-7 text-xs font-semibold tabular-nums shrink-0"
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
                        className="font-surah-names text-[2rem] leading-none shrink-0 select-none"
                        style={{ color: 'var(--text-primary)' }}
                        aria-hidden="true"
                      >
                        {String(surah.id).padStart(3, '0')}
                      </span>
                    </div>

                    {showProgress && (
                      <div className="mt-2 pl-10.5 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span
                            className="font-medium tabular-nums"
                            style={{ color: 'var(--accent)' }}
                          >
                            সর্বশেষ: আয়াত {toBanglaDigits(lastAyah)}/{toBanglaDigits(surah.versesCount)}
                          </span>
                          <span
                            className="font-semibold tabular-nums"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {toBanglaDigits(percent)}%
                          </span>
                        </div>
                        <div
                          className="h-[2.5px] w-full rounded-full overflow-hidden"
                          style={{
                            backgroundColor:
                              'color-mix(in srgb, var(--text-primary) 7%, transparent)',
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
          )}
        </section>
      </div>
    </div>
  );
}
