import { useCallback, useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ProgressBar() {
  const { state } = usePlayer();
  const { seekTo, getCurrentTimeMs, audio } = useAudioPlayer();
  const { totalDurationMs, isPlaying } = state;

  const [currentMs, setCurrentMs] = useState(0);

  // Update current time display smoothly
  useEffect(() => {
    let frameId;
    function tick() {
      setCurrentMs(getCurrentTimeMs());
      frameId = requestAnimationFrame(tick);
    }
    if (isPlaying) {
      frameId = requestAnimationFrame(tick);
    } else {
      setCurrentMs(getCurrentTimeMs());
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isPlaying, getCurrentTimeMs]);

  const progressPercent = totalDurationMs
    ? Math.min((currentMs / totalDurationMs) * 100, 100)
    : 0;

  const handleClick = useCallback(
    (e) => {
      if (!totalDurationMs) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      seekTo(ratio);
    },
    [totalDurationMs, seekTo]
  );

  return (
    <div className="w-full group pt-1">
      {/* Progress Line */}
      <div 
        className="w-full h-1 bg-[#ece3d1] relative cursor-pointer"
        onClick={handleClick}
      >
        <div 
          className="absolute h-full bg-sepia-dark transition-all duration-150 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
        {/* Handle dot on hover */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-sepia-dark rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progressPercent}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
    </div>
  );
}
