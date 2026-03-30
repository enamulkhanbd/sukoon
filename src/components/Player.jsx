import { useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useDownload } from '../hooks/useDownload';
import Dropdown from './Dropdown';
import VerseDisplay from './VerseDisplay';
import ProgressBar from './ProgressBar';
import PlayerControls from './PlayerControls';

export default function Player() {
  const { state, dispatch } = usePlayer();
  const { mode, currentChapter, currentJuz, chapters, favoriteChapters } = state;

  const title = useMemo(() => {
    if (mode === 'chapter') {
        const ch = chapters.find(c => c.id === currentChapter);
        return ch ? ch.name_simple : `Surah ${currentChapter}`;
    }
    return `Juz ${currentJuz}`;
  }, [mode, currentChapter, currentJuz, chapters]);

  const isFavorite = mode === 'chapter' && favoriteChapters.includes(currentChapter);

  const toggleFavorite = () => {
    if (mode === 'chapter') {
        dispatch({ type: 'TOGGLE_FAVORITE_CHAPTER', payload: currentChapter });
    }
  };

  return (
    <div className="w-full flex flex-col gap-10 md:gap-14 px-4 sm:px-0">
      {/* Static Selection Title (Focused) */}
      <div className="w-full flex flex-col items-center gap-4 text-center mb-2">
        <span className="text-1rem text-gold/56 uppercase tracking-[0.2em] mb-2 font-montserrat">
            {mode === 'chapter' ? 'Surah' : 'Juz'}
        </span>
        <h2 className="font-alhabsyi text-3xl md:text-6xl text-sepia-dark cursor-default leading-tight">
            {title}
        </h2>
      </div>

      {/* Verse Display Area (No Wrapper) */}
      <div className="w-full py-10">
        <VerseDisplay />
      </div>
    </div>
  );
}
