import { SURAH_MAP } from '../data/surahs';
import type { GlobalLastRead } from '../db/database';
import { toBanglaDigits } from '../utils/formatters';

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

  const handleOpen = () => {
    onOpenSurah(surah.id, resumeAyah);
  };

  return (
    <section
      role="button"
      tabIndex={0}
      aria-label={`${surah.nameBangla} তিলাওয়াত চালু করুন`}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
      className="rounded-3xl border px-5 py-4 flex items-center justify-between gap-4 transition-colors active:scale-[0.995] cursor-pointer"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <h2 className="text-lg font-bold tracking-tight truncate">
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
          আয়াত {toBanglaDigits(clampedAyah)}/{toBanglaDigits(surah.versesCount)}
          {' • '}
          {surah.revelationPlace === 'makkah' ? 'মাক্কী' : 'মাদানী'}
        </p>
      </div>

      <div className="text-right shrink-0">
        <div
          className="font-surah-names text-4xl leading-none select-none"
          style={{ color: 'var(--gold)' }}
          aria-hidden="true"
        >
          {String(surah.id).padStart(3, '0')}
        </div>
        <div
          className="text-[11px] mt-1"
          style={{ color: 'var(--text-muted)' }}
        >
          সূরা {toBanglaDigits(surah.id)}
        </div>
      </div>
    </section>
  );
}
