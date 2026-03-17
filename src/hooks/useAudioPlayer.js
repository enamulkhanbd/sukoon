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
  const {
    verses,
    currentVerseIndex,
    verseCumulativeMs,
    totalDurationMs,
    isPlaying,
    mode,
    currentChapter,
    currentJuz,
  } = state;

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
        if (e.name !== 'AbortError') {
          console.error('Playback failed:', e);
          dispatch({ type: 'SET_PLAYING', payload: false });
        }
      });
    }

    // Update OS system media controls
    if ('mediaSession' in navigator) {
      const modeText = mode === 'chapter' ? `Surah ${currentChapter}` : `Juz ${currentJuz}`;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Verse ${currentVerseIndex + 1}`,
        artist: 'Mishari Rashid al-`Afasy',
        album: `Sukoon - ${modeText}`,
        artwork: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
    }
  }, [currentVerseIndex, verses, isPlaying, mode, currentChapter, currentJuz, dispatch, audio]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleError = (e) => {
      console.error('[Audio Error]', e, audio.error);
      // Don't auto-pause if it's just a network stall, only if it's a fatal decode/src error
      if (audio.error && audio.error.code !== 3) {
        dispatch({ type: 'SET_PLAYING', payload: false });
      }
    };
    audio.addEventListener('error', handleError);

    const handleStalled = () => {
      console.warn('[Audio Stalled] Waiting for data...');
      // Browser is waiting for data to download. Don't pause, let it buffer.
    };

    const handleNativePause = () => {
      // Sync React state if the OS suddenly pauses the audio (e.g., headphones unplugged)
      if (audio.paused) {
        dispatch({ type: 'SET_PLAYING', payload: false });
      }
    };

    const handleNativePlay = () => {
      // Sync React state if the OS suddenly resumes the audio
      if (!audio.paused) {
        dispatch({ type: 'SET_PLAYING', payload: true });
      }
    };

    audio.addEventListener('error', handleError);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('waiting', handleStalled);
    audio.addEventListener('pause', handleNativePause);
    audio.addEventListener('play', handleNativePlay);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('waiting', handleStalled);
      audio.removeEventListener('pause', handleNativePause);
      audio.removeEventListener('play', handleNativePlay);
    };
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
      audio.play().catch((e) => {
        if (e.name !== 'AbortError') console.error('Play error:', e);
      });
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
          audio.play().catch((e) => {
            if (e.name !== 'AbortError') console.error('Play error:', e);
          });
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

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
  }, [togglePlay, playPrev, playNext]);

  return {
    togglePlay,
    playNext,
    playPrev,
    seekTo,
    getCurrentTimeMs,
    audio,
  };
}
