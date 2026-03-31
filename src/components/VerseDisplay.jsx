import { useMemo, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function VerseDisplay() {
  const { state } = usePlayer();
  const { verses, currentVerseIndex, isLoading, error } = state;
  const verseRefs = useRef([]);

  // Auto-scroll to current verse
  useEffect(() => {
    if (verseRefs.current[currentVerseIndex]) {
      verseRefs.current[currentVerseIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentVerseIndex]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="font-amiri text-2xl text-center text-red-400">{error}</p>
      </div>
    );
  }

  if (isLoading && verses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-12 py-20 animate-pulse opacity-50">
          <div className="h-10 w-3/4 bg-gold/10 rounded-full" />
          <div className="h-10 w-1/2 bg-gold/10 rounded-full" />
          <div className="h-10 w-2/3 bg-gold/10 rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 md:gap-24 w-full">
      {verses.map((verse, vIdx) => {
        const isActiveVerse = currentVerseIndex === vIdx;
        
        return (
          <div 
            key={verse.id} 
            ref={el => verseRefs.current[vIdx] = el}
            className={`flex flex-col items-center gap-6 md:gap-8 transition-all duration-700 ${
                isActiveVerse ? 'opacity-100 scale-100' : 'opacity-20 scale-95 grayscale pointer-events-none'
            }`}
          >
            {/* Arabic Text */}
            <div
              className={`relative flex flex-wrap flex-row-reverse justify-center gap-x-2 gap-y-4 font-alhabsyi text-[32px] md:text-[56px] text-center leading-[1.8] text-sepia-dark transition-colors duration-500`}
            >
              {verse.words?.map((word, wIdx) => {
                const isActiveWord = isActiveVerse && state.activeWordIndex === (word.position - 1);
                return (
                  <span
                    key={`${verse.id}-word-${wIdx}`}
                    className={`px-1.5 rounded-xl transition-all duration-300 ${
                      isActiveWord ? 'text-gold-dark scale-110' : ''
                    }`}
                    dangerouslySetInnerHTML={{ __html: word.text_uthmani_tajweed }}
                  />
                );
              })}
              <div className="flex flex-col items-center justify-center min-w-[5rem] gap-2">
                 <span className="end font-amiri text-2xl md:text-3xl text-gold/40">
                  ({verse.verse_number.toLocaleString('ar-EG')})
                 </span>
                 {isActiveVerse && state.isPlaying && (
                   <div className="waveform h-4 mb-2 opacity-50 shrink-0">
                      <div className="waveform-bar" /><div className="waveform-bar" /><div className="waveform-bar" /><div className="waveform-bar" />
                   </div>
                 )}
              </div>
            </div>

            {/* Translation */}
            {verse.translations?.[0] && (
              <div 
                className={`font-anek text-lg md:text-2xl text-center max-w-2xl leading-relaxed transition-colors duration-500 ${
                  isActiveVerse ? 'text-sepia-dark/90' : 'text-sepia-dark/40'
                }`}
                dangerouslySetInnerHTML={{ __html: verse.translations[0].text }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
