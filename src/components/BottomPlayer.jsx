import { usePlayer } from '../context/PlayerContext';
import ProgressBar from './ProgressBar';
import PlayerControls from './PlayerControls';

export default function BottomPlayer({ onOpenSelection }) {
  const { state } = usePlayer();
  const { mode, currentChapter, currentJuz, chapters, verses, currentVerseIndex } = state;

  const currentItem = mode === 'chapter' 
    ? chapters.find(ch => ch.id === currentChapter)
    : { name_simple: `Juz ${currentJuz}`, translated_name: { name: 'Part' } };

  if (!currentItem && mode === 'chapter') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] pointer-events-none">
      <div className="w-full bg-[#FCFAF5]/95 backdrop-blur-2xl border-t border-gold/20 shadow-[0_-8px_30px_rgba(195,155,86,0.1)] rounded-t-[2.5rem] p-7 md:p-10 pb-8 md:pb-12 flex flex-col gap-6 md:gap-8 pointer-events-auto transform animate-slide-up-sm transition-all duration-500">
        
        {/* Info & Metadata */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gold/60 uppercase tracking-widest mb-0.5">
              Playing Now
            </span>
            <h4 className="text-sm md:text-base font-bold text-sepia-dark flex items-center gap-2">
              {mode === 'chapter' ? currentItem.name_simple : `Juz ${currentJuz}`}
              <span className="w-1.5 h-1.5 rounded-full bg-gold/30 animate-pulse" />
              <span className="text-[10px] font-medium text-sepia-dark/40 font-montserrat tracking-tight">
                Verse {currentVerseIndex + 1} of {verses.length}
              </span>
            </h4>
          </div>
          
          <div className="hidden sm:flex text-right flex-col">
             <span className="text-[10px] font-medium text-sepia-dark/30 uppercase tracking-tight">
                Mishari Rashid al-`Afasy
             </span>
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

        {/* Playback Controls & Progress */}
        <div className="flex flex-col gap-5">
           <ProgressBar />
           <PlayerControls />
        </div>
      </div>
    </div>
  );
}
