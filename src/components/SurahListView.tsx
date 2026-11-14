import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, X } from 'lucide-react';
import { SURAHS } from '../data/surahs';
import { db } from '../db/database';
import { isSurahFullyCached } from '../services/quranApi';
import { toBanglaDigits } from '../utils/formatters';

interface SurahListViewProps {
  onOpenSurah: (surahId: number) => void;
}

type FilterMode = 'all' | 'offline' | 'makkah' | 'madinah';

export function SurahListView({ onOpenSurah }: SurahListViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  const cachedRows = useLiveQuery(() => db.cachedSurahs.toArray(), []);
  const cachedSet = useMemo(
    () =>
      new Set<number>(
        (cachedRows ?? [])
          .filter((c) => isSurahFullyCached(c, c.surahId))
          .map((c) => c.surahId)
      ),
    [cachedRows]
  );

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
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">সূরা সমূহ</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            মোট ১১৪টি সূরা • {toBanglaDigits(cachedSet.size)}টি অফলাইনে সংরক্ষিত
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
          filtered.map((surah) => (
            <div
              key={surah.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenSurah(surah.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenSurah(surah.id);
                }
              }}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl border transition-colors cursor-pointer active:scale-[0.995]"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
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
                className="font-indopak text-xl leading-normal shrink-0"
                style={{ color: 'var(--text-primary)' }}
              >
                {surah.nameArabic}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
