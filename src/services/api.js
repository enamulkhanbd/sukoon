import { API_BASE, DEFAULT_RECITER, VERSES_PER_PAGE } from '../constants/config';

/**
 * Fetches the list of all 114 chapters.
 * @returns {Promise<Array>} Array of chapter objects.
 */
export async function fetchChapters() {
  const res = await fetch(`${API_BASE}/chapters?language=en`);
  if (!res.ok) throw new Error('Failed to fetch chapters');
  const data = await res.json();
  return data.chapters;
}


/**
 * Fetches verses for a given chapter or juz, including tajweed text and audio segments.
 * @param {'chapter'|'juz'} mode
 * @param {number} id - Chapter or Juz number
 * @param {number} reciterId
 * @returns {Promise<Array>} Array of verse objects.
 */
export async function fetchVerses(mode, id) {
  const endpoint = mode === 'chapter' ? `by_chapter/${id}` : `by_juz/${id}`;
  const res = await fetch(
    `${API_BASE}/verses/${endpoint}?language=en&fields=text_uthmani_tajweed&audio=${DEFAULT_RECITER}&per_page=${VERSES_PER_PAGE}`
  );
  if (!res.ok) throw new Error(`Failed to fetch verses for ${mode} ${id}`);
  const data = await res.json();
  return data.verses;
}
