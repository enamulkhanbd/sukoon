import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import VerseDisplay from './VerseDisplay';

export default function ReadingView() {
  const { state, dispatch } = usePlayer();
  const { verses, currentVerseIndex, isLoading, chapters } = state;
  const scrollRef = useRef(null);

  // Auto-scroll to active verse
  useEffect(() => {
    const activeElement = document.getElementById(`verse-${currentVerseIndex}`);
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentVerseIndex]);

  const handleVerseClick = (index) => {
    dispatch({ type: 'SET_VERSE_INDEX', payload: index });
    dispatch({ type: 'SET_PLAYING', payload: true });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-12">
        <div className="w-16 h-16 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
        <span className="font-montserrat text-gold-dark/50 animate-pulse">Loading Surah...</span>
      </div>
    );
  }

  const currentChapterInfo = chapters.find(c => c.id === state.currentChapter);

  return (
    <main className="flex-1 overflow-y-auto pt-16 md:pt-20 pb-40 px-4 md:px-12 scroll-smooth bg-gradient-to-b from-white/20 to-transparent" ref={scrollRef}>
      <div className="max-w-4xl mx-auto flex flex-col gap-8 md:gap-12">
        {/* Hero Section */}
        {currentChapterInfo && (
          <div className="flex flex-col items-center justify-center py-12 md:py-20 border-b border-gold/10 mb-6 md:mb-10 text-center relative overflow-hidden group">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-cinzel text-[100px] md:text-[160px] opacity-[0.03] select-none pointer-events-none group-hover:scale-110 transition-transform duration-1000">
              {currentChapterInfo.name_simple}
            </div>
            <h1 className="font-vibes text-4xl md:text-6xl text-gold mb-2 drop-shadow-sm">{currentChapterInfo.name_simple}</h1>
            <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4 text-sepia-dark/40 font-montserrat uppercase tracking-[0.2em] md:tracking-[0.3em] text-[8px] md:text-[10px] font-bold">
              <span>{currentChapterInfo.translated_name.name}</span>
              <span className="hidden md:block w-1 h-1 rounded-full bg-gold/50" />
              <span>{currentChapterInfo.verses_count} Verses</span>
              <span className="hidden md:block w-1 h-1 rounded-full bg-gold/50" />
              <span>Surah {currentChapterInfo.id}</span>
            </div>
            <div className="mt-6 md:mt-8 font-alhabsyi text-2xl md:text-4xl text-sepia-dark/80">
              بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6 md:gap-10">
          {verses.map((v, idx) => {
            const isActive = currentVerseIndex === idx;
            return (
              <div 
                key={v.id} 
                id={`verse-${idx}`}
                onClick={() => handleVerseClick(idx)}
                className={`group relative p-4 md:p-8 rounded-2xl md:rounded-3xl transition-all duration-500 cursor-pointer ${
                  isActive 
                    ? 'bg-cream/40 shadow-xl md:shadow-2xl shadow-gold/10 ring-1 ring-gold/20 scale-[1.01] md:scale-[1.02]' 
                    : 'hover:bg-cream/20 opacity-60 hover:opacity-100'
                }`}
              >
                {/* Verse Meta */}
                <div className="hidden md:flex absolute -left-4 top-8 flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold text-gold-dark/40 transform -rotate-90 origin-center whitespace-nowrap uppercase tracking-widest">
                    Verse {v.verse_number}
                  </span>
                </div>

                {/* Arabic Content */}
                <div className="flex flex-wrap flex-row-reverse justify-center gap-x-1 gap-y-2 md:gap-y-3 font-alhabsyi text-3xl md:text-[40px] text-center leading-relaxed text-sepia-dark">
                  {v.words.map((word, wIdx) => {
                    const isWordActive = isActive && state.activeWordIndex === (word.position - 1);
                    return (
                      <span
                        key={`${v.id}-${wIdx}`}
                        className={`px-1 rounded transition-all duration-150 ${
                          isWordActive ? 'bg-gold/20 text-gold-dark scale-105' : ''
                        }`}
                        dangerouslySetInnerHTML={{ __html: word.text_uthmani_tajweed }}
                      />
                    );
                  })}
                  <span className="end font-amiri text-2xl flex items-center justify-center min-w-[3rem] opacity-40">
                    ({v.verse_number.toLocaleString('ar-EG')})
                  </span>
                </div>

                {/* Translation */}
                {v.translations?.[0] && (
                  <div className={`mt-8 font-anek text-lg md:text-xl text-center max-w-2xl mx-auto leading-relaxed transition-colors ${
                    isActive ? 'text-sepia-dark' : 'text-sepia-dark/40'
                  }`}>
                    <div dangerouslySetInnerHTML={{ __html: v.translations[0].text }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
