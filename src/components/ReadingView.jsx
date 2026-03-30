import { useEffect, useRef, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import Dropdown from './Dropdown';

export default function ReadingView() {
  const { state, dispatch } = usePlayer();
  const { verses, currentVerseIndex, isLoading, chapters, currentChapter, mode } = state;
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

  const currentChapterInfo = useMemo(() => 
    chapters.find(c => c.id === currentChapter),
    [chapters, currentChapter]
  );

  const surahOptions = useMemo(() => 
    chapters.map(c => ({ value: c.id, label: `${c.id}. ${c.name_simple}`, isSelected: c.id === currentChapter })),
    [chapters, currentChapter]
  );

  if (isLoading && verses.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-12 bg-cream/30">
        <div className="w-16 h-16 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
        <span className="font-montserrat text-gold-dark/50 animate-pulse uppercase tracking-widest text-xs font-bold">Loading Surah...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FCFAF5]">
      {/* 1. Secondary Surah Header (Desktop Style) */}
      <div className="h-14 border-b border-[#ece3d1] bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Dropdown 
            label={currentChapterInfo ? `${currentChapterInfo.id}. ${currentChapterInfo.name_simple}` : 'Select Surah'}
            options={surahOptions}
            onSelect={(id) => dispatch({ type: 'SET_CHAPTER', payload: id })}
            btnClassName="font-bold text-sepia-dark text-sm hover:bg-gold/5 px-2 py-1 rounded"
            menuClassName="w-64"
          />
        </div>

        <div className="hidden md:flex flex-col items-center">
          <div className="text-[10px] font-bold text-sepia-dark/40 uppercase tracking-widest">
            {currentChapterInfo?.revelation_place === 'makkah' ? 'Meccan' : 'Medinan'} • Juz {verses[0]?.juz_number || 1}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-[#ede2cf]/30 p-1 rounded-lg">
            <button className="px-3 py-1 text-[10px] font-bold uppercase rounded bg-white shadow-sm text-sepia-dark">Verse By Verse</button>
            <button className="px-3 py-1 text-[10px] font-bold uppercase text-sepia-dark/40 hover:text-sepia-dark">Reading</button>
          </div>
          <button className="p-2 text-sepia-dark/60 hover:text-gold transition-colors">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pt-8 pb-32 px-4 md:px-8 custom-scrollbar" ref={scrollRef}>
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          
          {/* 2. Surah Hero Area */}
          {currentChapterInfo && (
            <div className="flex flex-col items-center text-center mb-16 w-full max-w-4xl">
              <img 
                src={`https://static.quran.com/images/chapters/${currentChapterInfo.id}.svg`} 
                alt="Surah Calligraphy" 
                className="h-24 md:h-32 opacity-80 mb-6 brightness-50"
              />
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold font-montserrat text-sepia-dark">{currentChapterInfo.id}. {currentChapterInfo.name_simple}</h1>
                <button className="bg-sepia-dark/10 text-sepia-dark text-[10px] font-bold px-2 py-0.5 rounded tracking-tighter uppercase">Info</button>
              </div>
              <p className="text-xl md:text-2xl text-sepia-dark/50 font-montserrat font-medium mb-8 italic">{currentChapterInfo.translated_name.name}</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => handleVerseClick(0)}
                  className="flex items-center gap-2 bg-white border border-[#ece3d1] px-5 py-2.5 rounded-full text-xs font-bold uppercase text-sepia-dark hover:bg-gold/5 hover:border-gold/30 transition-all shadow-sm"
                >
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.75a16,16,0,0,1-16.2.3,15.86,15.86,0,0,1-8.12-13.81V40a15.89,15.89,0,0,1,8.15-13.84,16.13,16.13,0,0,1,16.27.32L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg>
                  Listen
                </button>
                <div className="flex items-center gap-2 bg-white border border-[#ece3d1] px-5 py-2.5 rounded-full text-xs font-bold uppercase text-sepia-dark shadow-sm">
                  Translation: Dr. Mus...
                  <svg width="10" height="10" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/></svg>
                </div>
              </div>
            </div>
          )}

          {/* 3. Verse List */}
          <div className="w-full flex flex-col gap-16 md:gap-24 pb-20">
            {verses.map((v, idx) => {
              const isActive = currentVerseIndex === idx;
              // Group translations by ID
              const transEnglish = v.translations?.find(t => t.resource_id === 20)?.text;
              const transBengali = v.translations?.find(t => t.resource_id === 161)?.text;
              const translit = v.translations?.find(t => t.resource_id === 57)?.text;

              return (
                <div 
                  key={v.id} 
                  id={`verse-${idx}`}
                  className={`flex flex-col transition-all duration-700 ${isActive ? 'scale-[1.005]' : ''}`}
                >
                  {/* Top Control Bar for Verse */}
                  <div className="flex items-center justify-between py-4 border-b border-[#ece3d1]/30 mb-8 opacity-80">
                    <div className="flex items-center gap-6">
                      <span className="text-xl font-bold font-montserrat text-sepia-dark/30 tracking-tighter">{v.verse_key}</span>
                      <button 
                         onClick={() => handleVerseClick(idx)}
                         className="p-2 text-sepia-dark/60 hover:text-gold transition-colors"
                      >
                        <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.75a16,16,0,0,1-16.2.3,15.86,15.86,0,0,1-8.12-13.81V40a15.89,15.89,0,0,1,8.15-13.84,16.13,16.13,0,0,1,16.27.32L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg>
                      </button>
                      <button className="p-2 text-sepia-dark/30 hover:text-gold transition-colors">
                        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-6 text-sepia-dark/30">
                       <button className="hover:text-gold transition-colors"><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12V4a2 2 0 0 1 2-2h10l4 4v5"/><path d="M14 2v4h4"/><path d="M16 13h4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"/><path d="M9 13H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/></svg></button>
                       <button className="hover:text-gold transition-colors"><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98m-.01-10.98l-6.82 3.98"/></svg></button>
                       <button className="hover:text-gold transition-colors font-bold text-xl leading-none pt-1">...</button>
                    </div>
                  </div>

                  <div className="w-full flex flex-col gap-10">
                    {/* Arabic Section */}
                    <div className="flex flex-wrap flex-row-reverse justify-start gap-x-2 gap-y-4 font-alhabsyi text-3xl md:text-5xl text-right leading-[1.8] text-[#1E1E1E]">
                      {v.words.map((word, wIdx) => {
                        const isWordActive = isActive && state.activeWordIndex === (word.position - 1);
                        return (
                          <span
                            key={`${v.id}-${wIdx}`}
                            className={`px-1 group relative transition-all duration-300 ${
                              isWordActive ? 'text-gold-dark scale-105' : 'hover:text-gold hover:scale-[1.01]'
                            }`}
                            dangerouslySetInnerHTML={{ __html: word.text_uthmani_tajweed }}
                          />
                        );
                      })}
                      <span className="end font-amiri text-2xl flex items-center justify-center min-w-[3rem] opacity-30 select-none pb-2">
                        {v.verse_number.toLocaleString('ar-EG')}
                      </span>
                    </div>

                    {/* Translations Section */}
                    <div className="flex flex-col gap-5 text-left max-w-5xl">
                       {/* English */}
                       {transEnglish && (
                         <div className="flex flex-col gap-1">
                           <div className="font-montserrat text-lg md:text-xl text-[#333] leading-relaxed" dangerouslySetInnerHTML={{ __html: transEnglish }} />
                           <span className="text-[10px] font-bold text-sepia-dark/30 uppercase tracking-widest">— Saheeh International</span>
                         </div>
                       )}

                       {/* Transliteration */}
                       {translit && (
                         <div className="flex flex-col gap-1">
                           <div className="font-montserrat text-lg md:text-xl text-sepia-dark/40 italic leading-relaxed" dangerouslySetInnerHTML={{ __html: translit }} />
                           <span className="text-[10px] font-bold text-sepia-dark/20 uppercase tracking-widest">— Transliteration</span>
                         </div>
                       )}
                       
                       {/* Bengali */}
                       {transBengali && (
                         <div className="flex flex-col gap-1">
                           <div className="font-anek text-lg md:text-xl text-sepia-dark/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: transBengali }} />
                           <span className="text-[10px] font-bold text-sepia-dark/30 uppercase tracking-widest">— Dr. Abu Bakr Muhammad Zakaria</span>
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Bottom Utilities placeholder */}
                  <div className="mt-12 flex flex-wrap gap-8 text-[11px] font-bold uppercase tracking-[0.2em] text-sepia-dark/30 border-t border-[#ece3d1]/10 pt-6">
                     {['Tafsirs', 'Lessons', 'Reflections', 'Answers', 'Hadith'].map(util => (
                       <button key={util} className="flex items-center gap-2 hover:text-gold transition-colors">
                         <div className="w-3.5 h-3.5 border border-current rounded-sm opacity-50" />
                         {util}
                       </button>
                     ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
