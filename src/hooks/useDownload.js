import { useState, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { downloadService } from '../services/downloadService';
import { fetchVerses } from '../services/api';

/**
 * Hook to manage downloading Surahs or Juz for offline use.
 */
export function useDownload() {
  const { state, dispatch } = usePlayer();
  const [downloadProgress, setDownloadProgress] = useState({}); // { 'chapter-1': 0.5 }
  const [isDownloading, setIsDownloading] = useState({}); // { 'chapter-1': true }

  const downloadItem = useCallback(async (mode, id) => {
    const key = `${mode}-${id}`;
    if (state.downloaded[key] || isDownloading[key]) return;

    setIsDownloading(prev => ({ ...prev, [key]: true }));
    setDownloadProgress(prev => ({ ...prev, [key]: 0 }));

    try {
      // First, we need the verses for this item if they aren't already loaded
      let versesToDownload = [];
      if (state.mode === mode && (mode === 'chapter' ? state.currentChapter : state.currentJuz) === id && state.verses.length > 0) {
        versesToDownload = state.verses;
      } else {
        versesToDownload = await fetchVerses(mode, id);
      }

      await downloadService.downloadVerses(key, versesToDownload, (progress) => {
        setDownloadProgress(prev => ({ ...prev, [key]: progress }));
      });

      dispatch({ type: 'UPDATE_DOWNLOADED', payload: { [key]: true } });
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(prev => ({ ...prev, [key]: false }));
    }
  }, [state.downloaded, state.mode, state.currentChapter, state.currentJuz, state.verses, isDownloading, dispatch]);

  const deleteItem = useCallback(async (mode, id) => {
    const key = `${mode}-${id}`;
    try {
      // We need verses to know which URLs to delete, or we could just clear the cache if we used different caches per surah
      // For now, we'll fetch them once to delete
      const versesToDelete = await fetchVerses(mode, id);
      await downloadService.deleteDownloaded(key, versesToDelete);
      dispatch({ type: 'REMOVE_DOWNLOADED', payload: key });
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [dispatch]);

  return {
    downloadItem,
    deleteItem,
    isDownloaded: (mode, id) => !!state.downloaded[`${mode}-${id}`],
    getDownloadProgress: (mode, id) => downloadProgress[`${mode}-${id}`] || 0,
    isDownloadingItem: (mode, id) => !!isDownloading[`${mode}-${id}`],
  };
}
