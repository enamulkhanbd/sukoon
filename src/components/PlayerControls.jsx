import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { usePlayer } from '../context/PlayerContext';

export default function PlayerControls() {
  const { state } = usePlayer();
  const { togglePlay, playNext, playPrev } = useAudioPlayer();
  const { isPlaying } = state;

  return (
    <div className="flex justify-center items-center gap-10 text-sepia-dark">
      <button
        className="text-2xl opacity-40 hover:opacity-100 hover:text-gold transition-colors duration-300 cursor-pointer"
        onClick={playPrev}
        aria-label="Previous verse"
      >
        <i className="fa-solid fa-backward-step" />
      </button>
      <button
        className="text-5xl text-gold hover:scale-105 transition-transform duration-300 cursor-pointer"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <i className={`fa-solid ${isPlaying ? 'fa-circle-pause' : 'fa-circle-play'}`} />
      </button>
      <button
        className="text-2xl opacity-40 hover:opacity-100 hover:text-gold transition-colors duration-300 cursor-pointer"
        onClick={playNext}
        aria-label="Next verse"
      >
        <i className="fa-solid fa-forward-step" />
      </button>
    </div>
  );
}
