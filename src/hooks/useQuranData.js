import { useEffect, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { fetchChapters, fetchVerses } from '../services/api';

/**
 * Hook to fetch and manage Quran data (chapters, reciters, verses).
 * Handles loading states, error handling, and verse duration calculation.
 */
export function useQuranData() {
  const { state, dispatch } = usePlayer();

  // Fetch chapters and reciters on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const chapters = await fetchChapters();
        dispatch({ type: 'SET_CHAPTERS', payload: chapters });
      } catch (err) {
        console.error('Failed to load initial data:', err);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load Quran data.' });
      }
    }
    loadInitialData();
  }, [dispatch]);

  // Fetch verses whenever mode, chapter/juz, or reciter changes
  const loadVerses = useCallback(async () => {
    const id = state.mode === 'chapter' ? state.currentChapter : state.currentJuz;
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const verses = await fetchVerses(state.mode, id);

      // Calculate cumulative timeline
      const verseCumulativeMs = [];
      let totalDurationMs = 0;

      verses.forEach((verse) => {
        verseCumulativeMs.push(totalDurationMs);
        let verseDurationMs = 0;
        if (verse.audio?.segments?.length > 0) {
          const lastSegment = verse.audio.segments[verse.audio.segments.length - 1];
          verseDurationMs = lastSegment[3]; // [word_start, word_end, start_ms, end_ms]
        } else {
            // Fallback if no timing data: assume average 5s per verse for calculation
            verseDurationMs = 5000;
        }
        totalDurationMs += verseDurationMs;
      });

      dispatch({
        type: 'SET_VERSES',
        payload: { verses, verseCumulativeMs, totalDurationMs },
      });

      // Background pre-fetch all audio files for this Surah/Juz to avoid network gaps
      // This ensures "whole surah/juz at once" sync
      if (verses.length > 0) {
        const cacheKey = `prefetch-${state.mode}-${id}`;
        // We don't await this so it happens in the background
        import('../services/downloadService').then(({ downloadService }) => {
            downloadService.downloadVerses(cacheKey, verses, null, true); // Added true for skipStorage
        });
      }

    } catch (err) {
      console.error('Failed to load verses:', err);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load verses.' });
    }
  }, [state.mode, state.currentChapter, state.currentJuz, dispatch]);

  useEffect(() => {
    if (state.chapters.length > 0) {
      loadVerses();
    }
  }, [loadVerses, state.chapters.length]);

  return { loadVerses };
}
