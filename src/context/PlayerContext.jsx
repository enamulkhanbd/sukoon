import { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { DEFAULT_CHAPTER } from '../constants/config';

const PlayerContext = createContext(null);

const initialState = {
  mode: 'chapter',           // 'chapter' | 'juz'
  currentChapter: DEFAULT_CHAPTER,
  currentJuz: 1,
  verses: [],
  currentVerseIndex: 0,
  verseCumulativeMs: [],
  totalDurationMs: 0,
  isPlaying: false,
  isLoading: false,
  activeWordIndex: -1,
  error: null,
  chapters: [],
  favoriteChapters: JSON.parse(localStorage.getItem('sukoon_favorites') || '[]'),
  favoriteJuz: JSON.parse(localStorage.getItem('sukoon_fav_juz') || '[]'),
  downloaded: JSON.parse(localStorage.getItem('sukoon_downloaded') || '{}'), // { "chapter-1": true, "juz-30": true, etc. }
};

function playerReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_CHAPTER':
      return { ...state, currentChapter: action.payload };
    case 'SET_JUZ':
      return { ...state, currentJuz: action.payload };

    case 'SET_VERSES':
      return {
        ...state,
        verses: action.payload.verses,
        verseCumulativeMs: action.payload.verseCumulativeMs,
        totalDurationMs: action.payload.totalDurationMs,
        currentVerseIndex: 0,
        isLoading: false,
        error: null,
      };
    case 'SET_VERSE_INDEX':
      return { ...state, currentVerseIndex: action.payload };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ACTIVE_WORD':
      return { ...state, activeWordIndex: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_CHAPTERS':
      return { ...state, chapters: action.payload };
    case 'TOGGLE_FAVORITE_CHAPTER': {
      const isFavorite = state.favoriteChapters.includes(action.payload);
      const newFavorites = isFavorite
        ? state.favoriteChapters.filter(id => id !== action.payload)
        : [...state.favoriteChapters, action.payload];
      
      localStorage.setItem('sukoon_favorites', JSON.stringify(newFavorites));
      return { ...state, favoriteChapters: newFavorites };
    }
    case 'TOGGLE_FAVORITE_JUZ': {
      const isFavorite = state.favoriteJuz.includes(action.payload);
      const newFavorites = isFavorite
        ? state.favoriteJuz.filter(id => id !== action.payload)
        : [...state.favoriteJuz, action.payload];
      
      localStorage.setItem('sukoon_fav_juz', JSON.stringify(newFavorites));
      return { ...state, favoriteJuz: newFavorites };
    }
    case 'UPDATE_DOWNLOADED': {
      const newDownloaded = { ...state.downloaded, ...action.payload };
      localStorage.setItem('sukoon_downloaded', JSON.stringify(newDownloaded));
      return { ...state, downloaded: newDownloaded };
    }
    case 'REMOVE_DOWNLOADED': {
      const newDownloaded = { ...state.downloaded };
      delete newDownloaded[action.payload];
      localStorage.setItem('sukoon_downloaded', JSON.stringify(newDownloaded));
      return { ...state, downloaded: newDownloaded };
    }

    default:
      return state;
  }
}

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const audioRef = useRef(new Audio());

  const getActiveId = useCallback(() => {
    return state.mode === 'chapter' ? state.currentChapter : state.currentJuz;
  }, [state.mode, state.currentChapter, state.currentJuz]);

  return (
    <PlayerContext.Provider value={{ state, dispatch, audioRef, getActiveId }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
