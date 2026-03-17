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
      <div
        className="relative flex flex-wrap flex-row-reverse justify-center gap-x-1 gap-y-2 font-alhabsyi text-[40px] text-center leading-relaxed transition-opacity duration-300 py-4"
        style={{ opacity: isLoading ? 0.3 : 1 }}
      >
        {isLoading ? (
          <div className="h-10 w-48 bg-gold/5 animate-pulse rounded-full" />
        ) : verse?.words ? (
          verse.words.map((word, idx) => {
            const isActive = state.activeWordIndex === (word.position - 1);
            return (
              <span
                key={`${verse.id}-${idx}`}
                className={`px-1 rounded-md transition-colors duration-200 cursor-default ${
                  isActive
                    ? 'text-gold-dark'
                    : 'opacity-80'
                }`}
                dangerouslySetInnerHTML={{ __html: word.text_uthmani_tajweed }}
              />
            );
          })
        ) : (
          <span dangerouslySetInnerHTML={{ __html: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ' }} />
        )}
      </div>
      <p className="font-montserrat text-xs opacity-50 mt-2">{verseInfo}</p>
    </div>
  );
}
