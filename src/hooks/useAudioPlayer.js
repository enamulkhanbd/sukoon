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
  const lastWordIndexRef = useRef(-1);

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

  // Track the current index in a ref to use in the event listener without closures getting stale
  const currentIndexRef = useRef(currentVerseIndex);
  useEffect(() => {
    currentIndexRef.current = currentVerseIndex;
  }, [currentVerseIndex]);

  const versesRef = useRef(verses);
  useEffect(() => {
    versesRef.current = verses;
  }, [verses]);

  // Function to load a specific verse index directly to the audio element
  const loadVerseToAudio = useCallback((index, autoPlay = false) => {
    const verse = versesRef.current[index];
    if (!verse?.audio?.url) return;

    const url = verse.audio.url.startsWith('http')
      ? verse.audio.url
      : `${AUDIO_BASE}${verse.audio.url}`;

    // Only update if the source actually changed
    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }

    if (autoPlay) {
      audio.play().catch((e) => {
        if (e.name !== 'AbortError') {
          console.error('Playback failed:', e);
          dispatch({ type: 'SET_PLAYING', payload: false });
        }
      });
    }

    // Preload next verse
    const nextVerse = versesRef.current[index + 1];
    if (nextVerse?.audio?.url) {
      const nextUrl = nextVerse.audio.url.startsWith('http')
        ? nextVerse.audio.url
        : `${AUDIO_BASE}${nextVerse.audio.url}`;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = nextUrl;
      link.as = 'audio';
      // Use a unique ID to avoid clogging the head with too many links
      const existing = document.getElementById('audio-prefetch');
      if (existing) existing.remove();
      link.id = 'audio-prefetch';
      document.head.appendChild(link);
    }
  }, [audio, dispatch]);

  // Sync React state and handle OS Metadata - Separate from playback trigger
  useEffect(() => {
    if (verses.length === 0) return;
    
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

    // Reset word index when verse changes
    lastWordIndexRef.current = -1;
    dispatch({ type: 'SET_ACTIVE_WORD', payload: -1 });

    // Ensure audio element is in sync with React state (e.g. for manual seeking/init)
    // but don't force play() here if it's already handled by handleEnded
    const verse = verses[currentVerseIndex];
    const url = verse?.audio?.url?.startsWith('http')
      ? verse.audio.url
      : `${AUDIO_BASE}${verse?.audio?.url}`;
    
    if (audio.src !== url && verse?.audio?.url) {
        loadVerseToAudio(currentVerseIndex, isPlaying);
    }
  }, [currentVerseIndex, verses, mode, currentChapter, currentJuz, dispatch, audio, loadVerseToAudio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Audio event listeners
  useEffect(() => {
    const handleEnded = () => {
      const nextIndex = currentIndexRef.current + 1;
      if (nextIndex < versesRef.current.length) {
        // CRITICAL: Load and Play the NEXT track IMMEDIATELY in the same synchronous task
        // to maintain the "audio session" on mobile devices while screen is off.
        loadVerseToAudio(nextIndex, true);
        
        // Then update React state
        dispatch({ type: 'SET_VERSE_INDEX', payload: nextIndex });
      } else {
        dispatch({ type: 'SET_PLAYING', payload: false });
        dispatch({ type: 'SET_VERSE_INDEX', payload: 0 });
      }
    };

    audio.addEventListener('ended', handleEnded);

    const handleError = (e) => {
      console.error('[Audio Error]', e, audio.error);
      if (audio.error && audio.error.code !== 3) {
        dispatch({ type: 'SET_PLAYING', payload: false });
      }
    };
    audio.addEventListener('error', handleError);

    const handleStalled = () => {
      console.warn('[Audio Stalled] Waiting for data...');
    };

    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('waiting', handleStalled);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('waiting', handleStalled);
    };
  }, [audio, dispatch, loadVerseToAudio]);

  // Progress tracking via requestAnimationFrame for smooth updates
  useEffect(() => {
    function tick() {
      const verse = verses[currentVerseIndex];
      if (verse?.audio?.segments) {
        const currentTimeMs = audio.currentTime * 1000;
        // Find if we are currently within any segment
        const segment = verse.audio.segments.find(
          (s) => currentTimeMs >= s[2] && currentTimeMs <= s[3]
        );
        
        const newWordIndex = segment ? segment[0] : -1;
        if (newWordIndex !== lastWordIndexRef.current) {
          lastWordIndexRef.current = newWordIndex;
          dispatch({ type: 'SET_ACTIVE_WORD', payload: newWordIndex });
        }
      } else if (lastWordIndexRef.current !== -1) {
        lastWordIndexRef.current = -1;
        dispatch({ type: 'SET_ACTIVE_WORD', payload: -1 });
      }

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
