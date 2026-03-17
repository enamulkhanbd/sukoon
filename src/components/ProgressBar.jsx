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
    <div className="flex items-center gap-4 text-xs font-montserrat opacity-60">
      <span>{formatTime(currentMs / 1000)}</span>
      <div
        className="flex-1 h-1.5 bg-[#e8dcb8] rounded-full overflow-hidden cursor-pointer"
        onClick={handleClick}
      >
        <div
          className="h-full bg-gold transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <span>{formatTime(totalDurationMs / 1000)}</span>
    </div>
  );
}
