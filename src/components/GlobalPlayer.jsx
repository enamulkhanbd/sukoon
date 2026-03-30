import { usePlayer } from '../context/PlayerContext';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import ProgressBar from './ProgressBar';
import PlayerControls from './PlayerControls';
import { useMemo } from 'react';

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GlobalPlayer() {
  const { state, dispatch } = usePlayer();
  const { playerVisible, isPlaying, totalDurationMs, currentVerseIndex, verseCumulativeMs } = state;

  if (!playerVisible) return null;

  // We need current time here to match the SS layout
  // But let's simplify for now: just use 0:00 if not easily available
  // Actually, we can just use the audio element directly
  const { getCurrentTimeMs } = useAudioPlayer();
  
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#fdfaf3] border-t border-[#ece3d1] flex flex-col z-50 shadow-2xl overflow-hidden">
      {/* Top: Progress Bar */}
      <div className="absolute top-0 left-0 right-0">
        <ProgressBar />
      </div>

      {/* Main Row: Time - [Gap] - Icons - Close - Time */}
      <div className="flex-1 flex items-center justify-between px-6 pt-1 text-sepia-dark">
        {/* Left: Current Time */}
        <div className="text-[10px] font-bold text-sepia-dark/40 font-montserrat w-12 shrink-0">
          {formatTime(getCurrentTimeMs() / 1000)}
        </div>

        {/* Right Section: All controls bunched on the right like the SS */}
        <div className="flex items-center gap-4 md:gap-7 ml-auto pr-6">
          <button className="text-sepia-dark/40 hover:text-gold transition-colors">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M144,128a16,16,0,1,1-16-16A16,16,0,0,1,144,128ZM60,112a16,16,0,1,0,16,16A16,16,0,0,0,60,112Zm136,0a16,16,0,1,0,16,16A16,16,0,0,0,196,112Z"/></svg>
          </button>
          
          <button className="text-sepia-dark/40 hover:text-gold transition-colors">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M156.44,40a12,12,0,0,0-12.8,1.21L85,88H56A20,20,0,0,0,36,108v40a20,20,0,0,0,20,20H85l58.64,46.79A12,12,0,0,0,164,205.21V50.79A12,12,0,0,0,156.44,40ZM140,193.57,92,155.24a12,12,0,0,0-7.44-2.57H60V103.33H84.56A12,12,0,0,0,92,100.76l48-38.33Z"/></svg>
          </button>

          <PlayerControls />
          
          <div className="w-px h-5 bg-gold/10 hidden md:block" />

          <button 
            onClick={() => {
              dispatch({ type: 'SET_PLAYER_VISIBLE', payload: false });
              dispatch({ type: 'SET_PLAYING', payload: false });
            }}
            className="text-sepia-dark/40 hover:text-gold transition-colors" 
            title="Close"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Far Right: Total Time */}
        <div className="text-[10px] font-bold text-sepia-dark/40 font-montserrat w-12 text-right shrink-0">
          {formatTime(totalDurationMs / 1000)}
        </div>
      </div>
    </div>
  );
}
