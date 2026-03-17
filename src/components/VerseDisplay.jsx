import { useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function VerseDisplay() {
  const { state } = usePlayer();
  const { verses, currentVerseIndex, chapters, isLoading, error } = state;

  const verse = verses[currentVerseIndex];

  const verseInfo = useMemo(() => {
    if (!verse) return '';
    const chapterId = Number(verse.verse_key.split(':')[0]);
    const chapter = chapters.find((c) => c.id === chapterId);
    const name = chapter ? chapter.name_simple : `Surah ${chapterId}`;
    return `${name}, Verse ${verse.verse_number}`;
  }, [verse, chapters]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="font-amiri text-2xl text-center text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p
        className="font-amiri text-3xl md:text-5xl text-center leading-relaxed md:leading-relaxed text-sepia-dark transition-opacity duration-300"
        style={{ opacity: isLoading ? 0.3 : 1 }}
        dangerouslySetInnerHTML={{
          __html: isLoading
            ? 'Loading...'
            : verse?.text_uthmani_tajweed || 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        }}
      />
      <p className="font-montserrat text-sm opacity-50">{verseInfo}</p>
    </div>
  );
}
