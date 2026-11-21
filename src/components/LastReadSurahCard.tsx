import { ChevronRight } from 'lucide-react';
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
  const progressPercent = Math.min(
    100,
    Math.round((clampedAyah / surah.versesCount) * 100)
  );

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
      className="rounded-2xl px-5 py-4 space-y-3.5 transition-opacity active:opacity-85 cursor-pointer group"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Top row: Calligraphic Surah glyph left + Ayah resume cue right (Quran.com editorial layout) */}
      <div className="flex items-start justify-between gap-4">
        <div
          className="font-surah-names text-[2.75rem] leading-none select-none"
          style={{ color: 'var(--text-primary)' }}
          aria-hidden="true"
        >
          {String(surah.id).padStart(3, '0')}
        </div>

        <span
          className="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums pt-1 shrink-0"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span>
            {isCompleted
              ? 'সম্পন্ন'
              : `আয়াত ${toBanglaDigits(clampedAyah)}`}
          </span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>

      {/* Bottom row: Bold Surah title + muted meaning + slim progress bar */}
      <div className="space-y-2.5">
        <div>
          <h2 className="text-base font-semibold leading-snug">
            সূরা {toBanglaDigits(surah.id)} • {surah.nameBangla}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {surah.meaningBangla} • {surah.revelationPlace === 'makkah' ? 'মাক্কী' : 'মাদানী'} ({toBanglaDigits(surah.versesCount)} আয়াত)
          </p>
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
              width: `${progressPercent}%`,
              backgroundColor: 'var(--accent)',
            }}
          />
        </div>
      </div>
    </section>
  );
}
