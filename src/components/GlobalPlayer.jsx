import { usePlayer } from '../context/PlayerContext';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import ProgressBar from './ProgressBar';
import PlayerControls from './PlayerControls';
import { useMemo } from 'react';

export default function GlobalPlayer() {
  const { state } = usePlayer();
  const { verses, currentVerseIndex, chapters, isLoading } = state;
  const verse = verses[currentVerseIndex];

  const verseInfo = useMemo(() => {
    if (!verse) return { name: 'Select Surah', location: '...' };
    const chapterId = Number(verse.verse_key.split(':')[0]);
    const chapter = chapters.find((c) => c.id === chapterId);
    const name = chapter ? chapter.name_simple : `Surah ${chapterId}`;
    return { name, location: `Verse ${verse.verse_number}` };
  }, [verse, chapters]);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-cream/95 md:bg-cream/80 backdrop-blur-xl border-t border-gold/10 px-4 md:px-8 flex items-center justify-center z-50">
      {/* Center: Controls & Progress */}
      <div className="flex flex-col items-center gap-2 flex-1 max-w-2xl px-2 md:px-12">
        <PlayerControls />
        <div className="w-full">
          <ProgressBar />
        </div>
      </div>
    </div>
  );
}
