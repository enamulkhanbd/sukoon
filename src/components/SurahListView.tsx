import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, X } from 'lucide-react';
import { SURAHS } from '../data/surahs';
import { db, type GlobalLastRead } from '../db/database';
import { isSurahFullyCached } from '../services/quranApi';
import { toBanglaDigits } from '../utils/formatters';
import { TabHeader } from './NavigationChrome';

interface SurahListViewProps {
  onOpenSurah: (surahId: number, initialAyah?: number) => void;
}

type FilterMode = 'all' | 'offline' | 'makkah' | 'madinah';

export function SurahListView({ onOpenSurah }: SurahListViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

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

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-4">
      <TabHeader
        title="সূরা সমূহ"
        subtitle={`মোট ১১৪টি সূরা • ${toBanglaDigits(cachedSet.size)}টি অফলাইনে সংরক্ষিত`}
      />

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
          placeholder="সূরার নাম বা নম্বর লিখুন (যেমন: কাহফ, ১৮, Yasin)..."
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

      {/* Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            ['all', 'সব (১১৪)'],
            ['offline', `অফলাইন (${toBanglaDigits(cachedSet.size)})`],
            ['makkah', 'মাক্কী'],
            ['madinah', 'মাদানী'],
          ] as const
        ).map(([id, label]) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer"
              style={{
                backgroundColor: active ? 'var(--accent)' : 'var(--bg-elevated)',
                borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Surah List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl border p-8 text-center text-sm"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            কোনো সূরা পাওয়া যায়নি।
          </div>
        ) : (
          filtered.map((surah) => {
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
                className="w-full px-3.5 py-3 rounded-2xl border transition-colors cursor-pointer active:scale-[0.995]"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--accent)',
                      }}
                    >
                      {toBanglaDigits(surah.id)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
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
                        className="text-[11px] flex items-center gap-1.5 mt-0.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span>{toBanglaDigits(surah.versesCount)} আয়াত</span>
                        <span>•</span>
                        <span>
                          {surah.revelationPlace === 'makkah' ? 'মাক্কী' : 'মাদানী'}
                        </span>
                        <span>•</span>
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
                  <div className="mt-2.5 pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span
                        className="font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        সর্বশেষ: আয়াত {toBanglaDigits(lastAyah)}/{toBanglaDigits(surah.versesCount)}
                      </span>
                      <span
                        className="font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {toBanglaDigits(percent)}%
                      </span>
                    </div>
                    <div
                      className="h-1 w-full rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--bg-surface)' }}
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
          })
        )}
      </div>
    </div>
  );
}
