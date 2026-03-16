import './style.css'

console.log('Sukoon Audio Player Initialized');

const CONFIG = {
  apiBase: 'https://api.quran.com/api/v4',
  audioBase: 'https://verses.quran.com/',
  defaultReciter: 7, // Mishary Rashid Alafasy
  defaultChapter: 1, // Al-Fatihah
};

const state = {
  currentMode: 'chapter', // 'chapter' or 'juz'
  currentChapter: CONFIG.defaultChapter,
  currentJuz: 1,
  currentVerseIndex: 0,
  currentReciter: CONFIG.defaultReciter,
  verses: [],
  verseCumulativeMs: [],
  totalDurationMs: 0,
  chapters: [],
  reciters: [],
  isPlaying: false,
};

let elements = {};
let audio = new Audio();

document.addEventListener('DOMContentLoaded', () => {
  // Initialize DOM elements
  elements = {
    verseText: document.querySelector('p.font-amiri'),
    verseInfo: document.getElementById('verse-info'),
    
    // Custom Dropdown Elements
    modeBtn: document.getElementById('mode-dropdown-btn'),
    modeLabel: document.getElementById('mode-dropdown-label'),
    modeMenu: document.getElementById('mode-dropdown-menu'),
    modeOptions: document.querySelectorAll('#mode-dropdown-menu button'),
    
    itemBtn: document.getElementById('item-dropdown-btn'),
    itemLabel: document.getElementById('item-dropdown-label'),
    itemMenu: document.getElementById('item-dropdown-menu'),

    reciterBtn: document.getElementById('reciter-dropdown-btn'),
    reciterLabel: document.getElementById('reciter-dropdown-label'),
    reciterMenu: document.getElementById('reciter-dropdown-menu'),

    playBtn: document.querySelector('.fa-circle-play, .fa-circle-pause').parentElement,
    playIcon: document.querySelector('.fa-circle-play, .fa-circle-pause'),
    nextBtn: document.querySelector('.fa-forward-step').parentElement,
    prevBtn: document.querySelector('.fa-backward-step').parentElement,
    progressContainer: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar-fill'),
    currentTimeDisp: document.getElementById('current-time-disp'),
    endTimeDisp: document.getElementById('end-time-disp'),
  };

  // Event Listeners
  elements.playBtn.addEventListener('click', togglePlay);
  elements.nextBtn.addEventListener('click', playNext);
  elements.prevBtn.addEventListener('click', playPrev);

  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('ended', playNext);
  audio.addEventListener('play', () => updatePlayIcon(true));
  audio.addEventListener('pause', () => updatePlayIcon(false));

  // Timeline Seeking
  elements.progressContainer.addEventListener('click', (e) => {
      if (!state.totalDurationMs || state.totalDurationMs === 0) return;
      const rect = elements.progressContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const ratio = clickX / width;
      const targetTimeMs = ratio * state.totalDurationMs;
      seekToTime(targetTimeMs);
  });

  // Dropdown UI logic
  elements.modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.modeMenu.classList.toggle('hidden');
      elements.itemMenu.classList.add('hidden');
      elements.reciterMenu.classList.add('hidden');
  });

  elements.itemBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.itemMenu.classList.toggle('hidden');
      elements.modeMenu.classList.add('hidden');
      elements.reciterMenu.classList.add('hidden');
  });

  elements.reciterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.reciterMenu.classList.toggle('hidden');
      elements.itemMenu.classList.add('hidden');
      elements.modeMenu.classList.add('hidden');
  });

  document.addEventListener('click', () => {
      elements.modeMenu.classList.add('hidden');
      elements.itemMenu.classList.add('hidden');
      elements.reciterMenu.classList.add('hidden');
  });

  // Mode Selection
  elements.modeOptions.forEach(btn => {
      btn.addEventListener('click', (e) => {
          const newMode = e.target.getAttribute('data-value');
          state.currentMode = newMode;
          elements.modeLabel.textContent = newMode === 'chapter' ? 'Surah Mode' : 'Juz Mode';
          elements.modeMenu.classList.add('hidden');
          
          populateItemSelect();
          loadDataForCurrentSelection();
      });
  });

  // Load initial data
  Promise.all([fetchChapters(), fetchReciters()]).then(() => {
      populateItemSelect();
      populateReciterSelect();
      loadDataForCurrentSelection();
  });
});

function loadDataForCurrentSelection() {
    state.isPlaying = false;
    updatePlayIcon(false);
    audio.pause();
    const idToFetch = state.currentMode === 'chapter' ? state.currentChapter : state.currentJuz;
    fetchData(state.currentMode, idToFetch);
}

function populateItemSelect() {
    elements.itemMenu.innerHTML = '';
    
    let labelUpdated = false;

    const createOption = (value, text, isSelected) => {
        const btn = document.createElement('button');
        btn.className = `text-left px-4 py-2.5 text-sm transition-colors font-medium w-full border-b border-[#e8dcb8] last:border-0 ${isSelected ? 'text-gold bg-gold/5' : 'text-sepia-dark/80 hover:bg-[#f0e6d2] hover:text-gold'}`;
        btn.textContent = text;
        btn.setAttribute('data-value', value);
        
        btn.addEventListener('click', (e) => {
            const newId = Number(e.target.getAttribute('data-value'));
            if (state.currentMode === 'chapter') {
                state.currentChapter = newId;
            } else {
                state.currentJuz = newId;
            }
            elements.itemLabel.textContent = text;
            elements.itemMenu.classList.add('hidden');
            loadDataForCurrentSelection();
        });
        
        elements.itemMenu.appendChild(btn);

        if (isSelected) {
            elements.itemLabel.textContent = text;
            labelUpdated = true;
        }
    };

    if (state.currentMode === 'chapter') {
        state.chapters.forEach(chapter => {
            const text = `${chapter.id}. ${chapter.name_simple} (${chapter.translated_name.name})`;
            createOption(chapter.id, text, chapter.id === state.currentChapter);
        });
    } else {
        // Juz
        for (let i = 1; i <= 30; i++) {
            createOption(i, `Juz ${i}`, i === state.currentJuz);
        }
    }
    
    if (!labelUpdated) {
        elements.itemLabel.textContent = "Select...";
    }
}

async function fetchChapters() {
    try {
        const res = await fetch(`${CONFIG.apiBase}/chapters?language=en`);
        const data = await res.json();
        state.chapters = data.chapters;
    } catch (err) {
        console.error('Failed to load chapters list', err);
    }
}

async function fetchReciters() {
    try {
        const res = await fetch(`${CONFIG.apiBase}/resources/recitations?language=en`);
        const data = await res.json();
        // Sort or filter if needed, just use raw for now
        state.reciters = data.recitations;
    } catch (err) {
        console.error('Failed to load reciters list', err);
    }
}

function populateReciterSelect() {
    elements.reciterMenu.innerHTML = '';
    
    state.reciters.forEach(reciter => {
        const btn = document.createElement('button');
        const isSelected = reciter.id === state.currentReciter;
        btn.className = `text-left px-4 py-2 text-xs transition-colors font-medium w-full border-b border-[#e8dcb8] last:border-0 ${isSelected ? 'text-gold bg-gold/5' : 'text-sepia-dark/80 hover:bg-[#f0e6d2] hover:text-gold'}`;
        
        const styleText = reciter.style ? ` (${reciter.style})` : '';
        btn.textContent = `${reciter.translated_name.name}${styleText}`;
        btn.setAttribute('data-value', reciter.id);
        
        btn.addEventListener('click', (e) => {
            state.currentReciter = Number(e.target.getAttribute('data-value'));
            elements.reciterLabel.textContent = e.target.textContent;
            elements.reciterMenu.classList.add('hidden');
            
            // Re-render menu to show selected active state
            populateReciterSelect();
            
            // Refetch current block of data
            loadDataForCurrentSelection();
        });
        
        elements.reciterMenu.appendChild(btn);

        if (isSelected) {
            elements.reciterLabel.textContent = btn.textContent;
        }
    });
}

async function fetchData(mode, id) {
  try {
    elements.verseText.textContent = "Loading...";
    elements.verseInfo.textContent = "";

    const endpointText = mode === 'chapter' ? `by_chapter/${id}` : `by_juz/${id}`;
    
    // We use per_page=1000 to cleanly fetch even large chapters/juz lengths without additional async pagination.
    const versesRes = await fetch(`${CONFIG.apiBase}/verses/${endpointText}?language=en&fields=text_uthmani_tajweed&audio=${state.currentReciter}&per_page=1000`);
    
    if(!versesRes.ok) throw new Error('Failed to fetch data');

    const versesData = await versesRes.json();
    state.verses = versesData.verses;

    // Calculate total duration and cumulative times
    state.verseCumulativeMs = [];
    state.totalDurationMs = 0;
    
    state.verses.forEach(verse => {
        state.verseCumulativeMs.push(state.totalDurationMs);
        let verseDurationMs = 0;
        if (verse.audio && verse.audio.segments && verse.audio.segments.length > 0) {
            const lastSegment = verse.audio.segments[verse.audio.segments.length - 1];
            verseDurationMs = lastSegment[3]; // format: [word_start, word_end, start_ms, end_ms]
        }
        state.totalDurationMs += verseDurationMs;
    });

    elements.endTimeDisp.textContent = formatTime(state.totalDurationMs / 1000);
    
    loadVerse(0); // Load first verse
  } catch (err) {
    console.error(`Error loading ${mode}:`, err);
    elements.verseText.textContent = "Error loading verses. Please check your connection.";
  }
}

function loadVerse(index) {
  if (index < 0 || index >= state.verses.length) return;
  state.currentVerseIndex = index;
  
  const verse = state.verses[index];
  const audioObj = verse.audio;
  
  // Update Text
  elements.verseText.style.opacity = 0;
  
  setTimeout(() => {
      elements.verseText.innerHTML = verse.text_uthmani_tajweed;
      elements.verseText.style.opacity = 1;

      // Extract chapter from verse_key (e.g. "2:255" -> "2")
      const chapterId = Number(verse.verse_key.split(':')[0]);
      const currentChapterData = state.chapters.find(c => c.id === chapterId);
      const chapterName = currentChapterData ? currentChapterData.name_simple : `Surah ${chapterId}`;
      elements.verseInfo.textContent = `${chapterName}, Verse ${verse.verse_number}`;
  }, 300);
  
  // Update Audio
  if (audioObj && audioObj.url) {
    const audioUrl = audioObj.url.startsWith('http') ? audioObj.url : `${CONFIG.audioBase}${audioObj.url}`;
    audio.src = audioUrl;
    audio.load();
  }
  
  if (state.isPlaying) {
    audio.play().catch(e => {
        console.error("Playback failed (possibly due to autoplay rules)", e);
        state.isPlaying = false;
        updatePlayIcon(false);
    });
  }
}

function togglePlay() {
  if (audio.paused) {
    state.isPlaying = true;
    audio.play().catch(e => console.error(e));
  } else {
    state.isPlaying = false;
    audio.pause();
  }
}

function updatePlayIcon(isPlaying) {
  elements.playIcon.className = isPlaying ? 'fa-solid fa-circle-pause' : 'fa-solid fa-circle-play';
}

function seekToTime(targetTimeMs) {
    // Find the verse that covers this timestamp
    let targetVerseIndex = 0;
    for (let i = 0; i < state.verseCumulativeMs.length; i++) {
        const verseStartTimeMs = state.verseCumulativeMs[i];
        if (targetTimeMs >= verseStartTimeMs) {
            targetVerseIndex = i;
        } else {
            break;
        }
    }
    
    const verseStartTimeMs = state.verseCumulativeMs[targetVerseIndex];
    if (state.currentVerseIndex !== targetVerseIndex) {
        // Load the new verse
        loadVerse(targetVerseIndex);
    }
    
    // Calculate off-set to seek inside that verse
    const offsetMs = targetTimeMs - verseStartTimeMs;
    audio.currentTime = offsetMs / 1000;
    if (state.isPlaying) {
        audio.play().catch(e => console.error("Seek play failed", e));
    }
    
    updateProgress();
}

function playNext() {
  if (state.currentVerseIndex < state.verses.length - 1) {
    loadVerse(state.currentVerseIndex + 1);
    if (!state.isPlaying) {
        state.isPlaying = true; // Auto-play next verse if triggered manually
        audio.play().catch(console.error);
    }
  } else {
    // End of Chapter
    state.isPlaying = false;
    updatePlayIcon(false);
    loadVerse(0); // Reset to beginning
  }
}

function playPrev() {
  if (state.currentVerseIndex > 0) {
    loadVerse(state.currentVerseIndex - 1);
    // If we go back, we might want to auto-play if it was already playing
    if (state.isPlaying) {
        audio.play().catch(console.error);
    }
  } else {
      // If at start, restart verse
      audio.currentTime = 0;
  }
}

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateProgress() {
  if (!state.totalDurationMs) return;
  
  const currentVerseStartTimeMs = state.verseCumulativeMs[state.currentVerseIndex] || 0;
  // If the verse audio doesn't have metadata yet, fallback to currentTime playing
  let currAudioMs = 0;
  if (!isNaN(audio.currentTime)) {
    currAudioMs = audio.currentTime * 1000;
  }
  
  const currentTotalMs = currentVerseStartTimeMs + currAudioMs;
  
  // Guard against float overshooting
  const progressRatio = Math.min((currentTotalMs / state.totalDurationMs), 1);
  const progressPercent = progressRatio * 100;
  
  elements.progressBar.style.width = `${progressPercent}%`;
  elements.currentTimeDisp.textContent = formatTime(currentTotalMs / 1000);
}

// ===================================================================
// LAYER 1: Background Metadata Pre-caching
// Pre-fetches verse text for all 114 surahs in the background so 
// switching surahs is instant even when offline.
// ===================================================================

const METADATA_CACHE_NAME = 'sukoon-metadata-v1';
const METADATA_CACHE_KEY = 'metadata-precached';

async function precacheAllMetadata() {
  // Only run once — check localStorage flag
  if (localStorage.getItem(METADATA_CACHE_KEY)) return;

  console.log('[Sukoon] Starting background metadata pre-cache...');
  const cache = await caches.open(METADATA_CACHE_NAME);

  // Pre-cache chapter list  
  const chaptersUrl = `${CONFIG.apiBase}/chapters?language=en`;
  await cache.add(chaptersUrl).catch(() => {});

  // Pre-cache reciters list
  const recitersUrl = `${CONFIG.apiBase}/resources/recitations?language=en`;
  await cache.add(recitersUrl).catch(() => {});

  // Pre-cache verse text for all 114 surahs in small batches to avoid flooding
  const BATCH_SIZE = 6;
  for (let batch = 0; batch < 114; batch += BATCH_SIZE) {
    const promises = [];
    for (let i = batch; i < Math.min(batch + BATCH_SIZE, 114); i++) {
      const chapterId = i + 1;
      const url = `${CONFIG.apiBase}/verses/by_chapter/${chapterId}?language=en&fields=text_uthmani_tajweed&audio=${CONFIG.defaultReciter}&per_page=1000`;
      promises.push(cache.add(url).catch(() => {}));
    }
    await Promise.all(promises);

    // Yield to main thread between batches
    await new Promise(r => setTimeout(r, 200));
  }

  // Pre-cache 30 juz metadata
  for (let juz = 1; juz <= 30; juz++) {
    const url = `${CONFIG.apiBase}/verses/by_juz/${juz}?language=en&fields=text_uthmani_tajweed&audio=${CONFIG.defaultReciter}&per_page=1000`;
    await cache.add(url).catch(() => {});
    await new Promise(r => setTimeout(r, 100));
  }

  localStorage.setItem(METADATA_CACHE_KEY, 'true');
  console.log('[Sukoon] ✓ All metadata pre-cached for offline use.');
}

// ===================================================================
// LAYER 3: Smart Audio Prefetching
// When user is playing a surah, prefetch audio for the next 2 surahs
// in the background so transitions are seamless.
// ===================================================================

const AUDIO_CACHE_NAME = 'sukoon-audio-prefetch-v1';
let prefetchAbortController = null;

async function prefetchUpcomingAudio() {
  // Cancel any previous prefetch operation
  if (prefetchAbortController) {
    prefetchAbortController.abort();
  }
  prefetchAbortController = new AbortController();
  const signal = prefetchAbortController.signal;

  const currentId = state.currentMode === 'chapter' ? state.currentChapter : state.currentJuz;
  const maxId = state.currentMode === 'chapter' ? 114 : 30;
  const endpoint = state.currentMode === 'chapter' ? 'by_chapter' : 'by_juz';

  // Prefetch next 2 surahs/juzs
  for (let offset = 1; offset <= 2; offset++) {
    const nextId = currentId + offset;
    if (nextId > maxId) break;
    if (signal.aborted) return;

    try {
      // First fetch the verse metadata (which includes audio URLs)
      const metaUrl = `${CONFIG.apiBase}/verses/${endpoint}/${nextId}?language=en&fields=text_uthmani_tajweed&audio=${state.currentReciter}&per_page=1000`;
      const res = await fetch(metaUrl, { signal });
      if (!res.ok || signal.aborted) continue;

      const data = await res.json();
      const audioUrls = data.verses
        .filter(v => v.audio && v.audio.url)
        .map(v => v.audio.url.startsWith('http') ? v.audio.url : `${CONFIG.audioBase}${v.audio.url}`);

      // Open audio cache and prefetch audio files in small batches
      const audioCache = await caches.open(AUDIO_CACHE_NAME);
      const AUDIO_BATCH = 5;
      for (let b = 0; b < audioUrls.length; b += AUDIO_BATCH) {
        if (signal.aborted) return;
        const batch = audioUrls.slice(b, b + AUDIO_BATCH);
        await Promise.all(
          batch.map(url =>
            audioCache.match(url).then(cached => {
              if (!cached && !signal.aborted) {
                return audioCache.add(url).catch(() => {});
              }
            })
          )
        );
        // Yield to prevent blocking
        await new Promise(r => setTimeout(r, 300));
      }

      console.log(`[Sukoon] ✓ Prefetched audio for ${state.currentMode} ${nextId}`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn(`[Sukoon] Prefetch skipped for ${endpoint}/${nextId}`, err.message);
      }
    }
  }
}

// ===================================================================
// Kick off background tasks
// ===================================================================

// Start metadata pre-cache after the app is idle (doesn't block first paint)
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => precacheAllMetadata());
} else {
  setTimeout(() => precacheAllMetadata(), 3000);
}

// Trigger audio prefetch whenever a new surah/juz starts playing
audio.addEventListener('play', () => {
  // Small delay so the current playback stabilizes first
  setTimeout(() => prefetchUpcomingAudio(), 2000);
});
