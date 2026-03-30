import { CACHE_NAMES } from '../constants/config';

/**
 * Service to manage downloading and caching audio files for offline use.
 */
export const downloadService = {
  /**
   * Caches all audio files for a list of verses.
   * @param {string} cacheKey - Unique key for this collection (e.g., 'chapter-1')
   * @param {Array} verses - Array of verse objects with audio URLs
   * @param {Function} onProgress - Callback for download progress (0 to 1)
   */
  async downloadVerses(cacheKey, verses, onProgress) {
    const cache = await caches.open(CACHE_NAMES.audio);
    const total = verses.length;
    let completed = 0;

    for (const verse of verses) {
      if (!verse.audio?.url) {
        completed++;
        continue;
      }

      const url = verse.audio.url.startsWith('http')
        ? verse.audio.url
        : `https://verses.quran.com/${verse.audio.url}`;

      try {
        // Check if already in cache
        const cachedResponse = await cache.match(url);
        if (!cachedResponse) {
          await cache.add(url);
        }
      } catch (err) {
        console.error(`Failed to cache audio for verse: ${url}`, err);
      }

      completed++;
      if (onProgress) onProgress(completed / total);
    }

    // Mark as downloaded in indexedDB or localStorage
    const downloaded = JSON.parse(localStorage.getItem('sukoon_downloaded') || '{}');
    downloaded[cacheKey] = true;
    localStorage.setItem('sukoon_downloaded', JSON.stringify(downloaded));
  },

  /**
   * Checks if a chapter or juz is fully downloaded.
   * @param {string} cacheKey 
   * @returns {boolean}
   */
  isDownloaded(cacheKey) {
    const downloaded = JSON.parse(localStorage.getItem('sukoon_downloaded') || '{}');
    return !!downloaded[cacheKey];
  },

  /**
   * Removes cached audio for a specific key.
   * @param {string} cacheKey 
   * @param {Array} verses 
   */
  async deleteDownloaded(cacheKey, verses) {
    const cache = await caches.open(CACHE_NAMES.audio);
    for (const verse of verses) {
      if (verse.audio?.url) {
        const url = verse.audio.url.startsWith('http')
          ? verse.audio.url
          : `https://verses.quran.com/${verse.audio.url}`;
        await cache.delete(url);
      }
    }

    const downloaded = JSON.parse(localStorage.getItem('sukoon_downloaded') || '{}');
    delete downloaded[cacheKey];
    localStorage.setItem('sukoon_downloaded', JSON.stringify(downloaded));
  }
};
