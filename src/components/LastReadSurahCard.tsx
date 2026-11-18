import { ArrowRight, BookOpenCheck } from 'lucide-react';
import { SURAH_MAP } from '../data/surahs';
import type { GlobalLastRead } from '../db/database';
import { formatRelativeTimeBn, toBanglaDigits } from '../utils/formatters';

interface LastReadSurahCardProps {
  lastRead: GlobalLastRead;
  onOpenSurah: (surahId: number, targetAyah?: number) => void;
}

export function LastReadSurahCard({
  lastRead,
  onOpenSurah,
}: LastReadSurahCardProps) {
  const surah = SURAH_MAP[lastRead.surahId];
  if (!surah) return null;

  const clampedAyah = Math.min(Math.max(lastRead.ayahNumber, 1), surah.versesCount);
  const isCompleted = clampedAyah >= surah.versesCount;
  const resumeAyah = isCompleted ? 1 : clampedAyah;
  const percent = isCompleted
    ? 100
    : Math.min(99, Math.max(1, Math.round((clampedAyah / surah.versesCount) * 100)));

  const handleOpen = () => {
    onOpenSurah(surah.id, resumeAyah);
  };

  return (
    <section
      onClick={handleOpen}
      className="rounded-3xl border p-5 relative overflow-hidden transition-transform active:scale-[0.995] cursor-pointer"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div
            className="inline-flex items-center gap-1.5 text-xs font-medium flex-wrap"
            style={{ color: 'var(--accent)' }}
          >
            <BookOpenCheck className="w-4 h-4 shrink-0" />
            <span>সর্বশেষ তিলাওয়াত</span>
            <span style={{ color: 'var(--text-muted)' }}>
              • {formatRelativeTimeBn(lastRead.timestamp)}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              {surah.nameBangla}
            </h2>
            <span
              className="text-xs font-normal"
              style={{ color: 'var(--text-muted)' }}
            >
              ({surah.meaningBangla})
            </span>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            আয়াত {toBanglaDigits(clampedAyah)} / {toBanglaDigits(surah.versesCount)}
            {' • '}পৃষ্ঠা {toBanglaDigits(lastRead.pageNumber)}
            {' • '}
            {surah.revelationPlace === 'makkah' ? 'মাক্কী' : 'মাদানী'}
          </p>
        </div>

        <div className="text-right shrink-0">
          <div
            className="font-surah-names text-4xl sm:text-5xl leading-none select-none"
            style={{ color: 'var(--gold)' }}
            aria-hidden="true"
          >
            {String(surah.id).padStart(3, '0')}
          </div>
          <div
            className="text-[11px] mt-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            সূরা {toBanglaDigits(surah.id)}
          </div>
        </div>
      </div>

      <div className="mt-3.5 space-y-3">
        <div className="space-y-1">
          <div
            className="flex items-center justify-between text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{isCompleted ? 'সম্পূর্ণ পঠিত' : 'তিলাওয়াত অগ্রগতি'}</span>
            <span
              className="font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              {toBanglaDigits(percent)}%
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--accent-soft)' }}
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpen();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold shadow-sm transition-transform active:scale-95 cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            {isCompleted ? 'আবার পড়ুন' : 'তিলাওয়াত চালিয়ে যান'}
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
