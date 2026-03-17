import { useEffect, useCallback, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { AUDIO_BASE } from '../constants/config';

/**
 * Hook to manage HTML5 Audio playback.
 * Handles play/pause, next/prev, seek, and progress updates.
 */
export function useAudioPlayer() {
  const { state, dispatch, audioRef } = usePlayer();
  const animFrameRef = useRef(null);

  const audio = audioRef.current;
  const { verses, currentVerseIndex, verseCumulativeMs, totalDurationMs, isPlaying } = state;

  // Load audio source when verse changes
  useEffect(() => {
    if (verses.length === 0) return;
    const verse = verses[currentVerseIndex];
    if (!verse?.audio?.url) return;

    const url = verse.audio.url.startsWith('http')
      ? verse.audio.url
      : `${AUDIO_BASE}${verse.audio.url}`;

    audio.src = url;
    audio.load();

    if (isPlaying) {
      audio.play().catch((e) => {
        console.error('Playback failed:', e);
        dispatch({ type: 'SET_PLAYING', payload: false });
      });
    }
  }, [currentVerseIndex, verses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Audio event listeners
  useEffect(() => {
    const handleEnded = () => {
      if (currentVerseIndex < verses.length - 1) {
        dispatch({ type: 'SET_VERSE_INDEX', payload: currentVerseIndex + 1 });
      } else {
        dispatch({ type: 'SET_PLAYING', payload: false });
        dispatch({ type: 'SET_VERSE_INDEX', payload: 0 });
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [audio, currentVerseIndex, verses.length, dispatch]);

  // Progress tracking via requestAnimationFrame for smooth updates
  useEffect(() => {
    function tick() {
      // This dispatches nothing — progress is computed in the component from audio.currentTime
      animFrameRef.current = requestAnimationFrame(tick);
    }

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    if (audio.paused) {
      dispatch({ type: 'SET_PLAYING', payload: true });
      audio.play().catch(console.error);
    } else {
      dispatch({ type: 'SET_PLAYING', payload: false });
      audio.pause();
    }
  }, [audio, dispatch]);

  const playNext = useCallback(() => {
    if (currentVerseIndex < verses.length - 1) {
      dispatch({ type: 'SET_VERSE_INDEX', payload: currentVerseIndex + 1 });
      if (!isPlaying) {
        dispatch({ type: 'SET_PLAYING', payload: true });
      }
    } else {
      dispatch({ type: 'SET_PLAYING', payload: false });
      dispatch({ type: 'SET_VERSE_INDEX', payload: 0 });
    }
  }, [currentVerseIndex, verses.length, isPlaying, dispatch]);

  const playPrev = useCallback(() => {
    if (currentVerseIndex > 0) {
      dispatch({ type: 'SET_VERSE_INDEX', payload: currentVerseIndex - 1 });
    } else {
      audio.currentTime = 0;
    }
  }, [currentVerseIndex, audio]);

  const seekTo = useCallback(
    (ratio) => {
      if (!totalDurationMs) return;
      const targetMs = ratio * totalDurationMs;

      // Find which verse this timestamp falls in
      let targetIndex = 0;
      for (let i = 0; i < verseCumulativeMs.length; i++) {
        if (targetMs >= verseCumulativeMs[i]) {
          targetIndex = i;
        } else {
          break;
        }
      }

      if (currentVerseIndex !== targetIndex) {
        dispatch({ type: 'SET_VERSE_INDEX', payload: targetIndex });
      }

      const offsetMs = targetMs - verseCumulativeMs[targetIndex];
      // Use a small timeout for when verse changes (audio needs to load first)
      setTimeout(() => {
        audio.currentTime = offsetMs / 1000;
        if (isPlaying) {
          audio.play().catch(console.error);
        }
      }, currentVerseIndex !== targetIndex ? 150 : 0);
    },
    [totalDurationMs, verseCumulativeMs, currentVerseIndex, isPlaying, audio, dispatch]
  );

  const getCurrentTimeMs = useCallback(() => {
    const verseStartMs = verseCumulativeMs[currentVerseIndex] || 0;
    const audioMs = isNaN(audio.currentTime) ? 0 : audio.currentTime * 1000;
    return verseStartMs + audioMs;
  }, [verseCumulativeMs, currentVerseIndex, audio]);

  return {
    togglePlay,
    playNext,
    playPrev,
    seekTo,
    getCurrentTimeMs,
    audio,
  };
}
