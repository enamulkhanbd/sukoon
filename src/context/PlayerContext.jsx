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
  sidebarOpen: false,
  playerVisible: false,
  favoriteChapters: JSON.parse(localStorage.getItem('sukoon_favorites') || '[]'),
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
      return { ...state, isPlaying: action.payload, playerVisible: action.payload || state.playerVisible };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ACTIVE_WORD':
      return { ...state, activeWordIndex: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_CHAPTERS':
      return { ...state, chapters: action.payload };
    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.payload };
    case 'SET_PLAYER_VISIBLE':
      return { ...state, playerVisible: action.payload };
    case 'TOGGLE_FAVORITE_CHAPTER': {
      const isFavorite = state.favoriteChapters.includes(action.payload);
      const newFavorites = isFavorite
        ? state.favoriteChapters.filter(id => id !== action.payload)
        : [...state.favoriteChapters, action.payload];
      
      localStorage.setItem('sukoon_favorites', JSON.stringify(newFavorites));
      return { ...state, favoriteChapters: newFavorites };
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
