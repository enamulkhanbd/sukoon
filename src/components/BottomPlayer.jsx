import { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import ProgressBar from './ProgressBar';
import PlayerControls from './PlayerControls';

export default function BottomPlayer({ onOpenSelection }) {
  const { state, dispatch } = usePlayer();
  const { mode, currentChapter, currentJuz, chapters, verses, currentVerseIndex } = state;
  const [slideDirection, setSlideDirection] = useState(''); // 'left' | 'right'
  const touchStartX = useRef(0);

  const currentItem = mode === 'chapter' 
    ? chapters.find(ch => ch.id === currentChapter)
    : { name_simple: `Juz ${currentJuz}`, translated_name: { name: 'Part' } };

  const handleNext = () => {
    if (mode === 'chapter' && currentChapter < 114) {
      setSlideDirection('left');
      dispatch({ type: 'SET_CHAPTER', payload: currentChapter + 1 });
      dispatch({ type: 'SET_VERSES', payload: { verses: [], verseCumulativeMs: [], totalDurationMs: 0 } });
    } else if (mode === 'juz' && currentJuz < 30) {
      setSlideDirection('left');
      dispatch({ type: 'SET_JUZ', payload: currentJuz + 1 });
      dispatch({ type: 'SET_VERSES', payload: { verses: [], verseCumulativeMs: [], totalDurationMs: 0 } });
    }
  };

  const handlePrev = () => {
    if (mode === 'chapter' && currentChapter > 1) {
      setSlideDirection('right');
      dispatch({ type: 'SET_CHAPTER', payload: currentChapter - 1 });
      dispatch({ type: 'SET_VERSES', payload: { verses: [], verseCumulativeMs: [], totalDurationMs: 0 } });
    } else if (mode === 'juz' && currentJuz > 1) {
      setSlideDirection('right');
      dispatch({ type: 'SET_JUZ', payload: currentJuz - 1 });
      dispatch({ type: 'SET_VERSES', payload: { verses: [], verseCumulativeMs: [], totalDurationMs: 0 } });
    }
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    const dX = e.changedTouches[0].clientX - touchStartX.current;
    if (dX > 100) handlePrev();
    if (dX < -100) handleNext();
  };

  // Reset animation direction after component re-renders with new choice
  useEffect(() => {
    const timer = setTimeout(() => setSlideDirection(''), 500);
    return () => clearTimeout(timer);
  }, [currentChapter, currentJuz]);

  if (!currentItem && mode === 'chapter') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] pointer-events-none">
      <div className="w-full bg-[#FCFAF5]/95 backdrop-blur-2xl border-t border-gold/10 shadow-[0_-8px_30px_rgba(195,155,86,0.05)] rounded-t-[2rem] md:rounded-t-[2.5rem] p-6 md:p-10 pb-8 md:pb-12 flex flex-col gap-6 md:gap-8 pointer-events-auto transform animate-slide-up-sm transition-all duration-500">
        
        {/* Info & Metadata (Swipeable area) */}
        <div 
          className="flex items-center justify-between gap-4 cursor-grab touch-none"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className={`flex flex-col select-none transition-all ${
              slideDirection === 'left' ? 'title-enter-right' : 
              slideDirection === 'right' ? 'title-enter-left' : ''
          }`}>
            <span className="text-[10px] font-bold text-gold/60 uppercase tracking-widest mb-0.5">
              Playing Now
            </span>
            <h4 className="text-xs md:text-base font-bold text-sepia-dark flex items-center gap-2">
              {mode === 'chapter' ? currentItem.name_simple : `Juz ${currentJuz}`}
              <span className="w-1.5 h-1.5 rounded-full bg-gold/30" />
              <span className="text-[9px] md:text-[10px] font-medium text-sepia-dark/40 font-montserrat tracking-tight">
                {verses.length > 0 ? `Verse ${currentVerseIndex + 1} of ${verses.length}` : 'Loading...'}
              </span>
            </h4>
          </div>
          
          <div className="flex items-center gap-2">
             {/* Hidden "Swipe Hint" for Desktop */}
             <div className="hidden sm:flex items-center gap-1.5 opacity-20 mr-2 text-[9px] font-bold text-sepia-dark uppercase tracking-widest">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                Swipe
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
             </div>
             
             <button 
                className="flex p-3 rounded-2xl bg-gold/5 text-gold hover:bg-gold/10 transition-colors active:scale-90"
                onClick={onOpenSelection}
                aria-label="Switch playback"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 13H4V3h5zM9 21H4v-4h5zM15 21h-5v-10h5zM20 21h-5v-4h5zM20 13h-5V3h5z" />
                </svg>
             </button>
          </div>
        </div>

        {/* Playback Controls & Progress */}
        <div className="flex flex-col gap-5">
           <ProgressBar />
           <PlayerControls />
        </div>
      </div>
    </div>
  );
}
