import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import {
  API_BASE,
  AUDIO_BASE,
  DEFAULT_RECITER,
  TOTAL_CHAPTERS,
  TOTAL_JUZ,
  VERSES_PER_PAGE,
  CACHE_NAMES,
} from '../constants/config';

/**
 * Hook that manages background offline caching:
 * Prefetches audio for the next 2 surahs/juzs when playback starts.
 */
export function useOfflineCache() {
  const { state, audioRef } = usePlayer();
  const abortRef = useRef(null);

  // Smart audio prefetch on playback
  useEffect(() => {
    const audio = audioRef.current;

    const handlePlay = () => {
      setTimeout(() => prefetchAudio(), 2000);
    };

    audio.addEventListener('play', handlePlay);
    return () => audio.removeEventListener('play', handlePlay);
  }, [state.mode, state.currentChapter, state.currentJuz]); // eslint-disable-line react-hooks/exhaustive-deps

  async function prefetchAudio() {
    // Abort previous prefetch
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const currentId = state.mode === 'chapter' ? state.currentChapter : state.currentJuz;
    const maxId = state.mode === 'chapter' ? TOTAL_CHAPTERS : TOTAL_JUZ;
    const endpoint = state.mode === 'chapter' ? 'by_chapter' : 'by_juz';

    for (let offset = 1; offset <= 2; offset++) {
      const nextId = currentId + offset;
      if (nextId > maxId || signal.aborted) return;

      try {
        const metaUrl = `${API_BASE}/verses/${endpoint}/${nextId}?language=en&fields=text_uthmani_tajweed&audio=${DEFAULT_RECITER}&per_page=${VERSES_PER_PAGE}`;
        const res = await fetch(metaUrl, { signal });
        if (!res.ok || signal.aborted) continue;

        const data = await res.json();
        const audioUrls = data.verses
          .filter((v) => v.audio?.url)
          .map((v) => (v.audio.url.startsWith('http') ? v.audio.url : `${AUDIO_BASE}${v.audio.url}`));

        const audioCache = await caches.open(CACHE_NAMES.audio);
        const BATCH = 5;
        for (let b = 0; b < audioUrls.length; b += BATCH) {
          if (signal.aborted) return;
          const batch = audioUrls.slice(b, b + BATCH);
          await Promise.all(
            batch.map((url) =>
              audioCache.match(url).then((cached) => {
                if (!cached && !signal.aborted) return audioCache.add(url).catch(() => {});
              })
            )
          );
          await new Promise((r) => setTimeout(r, 300));
        }
        console.log(`[Sukoon] ✓ Prefetched audio for ${state.mode} ${nextId}`);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn(`[Sukoon] Prefetch skipped:`, err.message);
        }
      }
    }
  }
}
