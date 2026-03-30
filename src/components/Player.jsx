import { useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useDownload } from '../hooks/useDownload';
import Dropdown from './Dropdown';
import VerseDisplay from './VerseDisplay';
import ProgressBar from './ProgressBar';
import PlayerControls from './PlayerControls';

export default function Player() {
  const { state, dispatch } = usePlayer();
  const { mode, currentChapter, currentJuz, chapters } = state;
  const { downloadItem, deleteItem, isDownloaded, getDownloadProgress, isDownloadingItem } = useDownload();

  // Mode options
  const modeOptions = [
    { value: 'chapter', label: 'Surah Mode', isSelected: mode === 'chapter' },
    { value: 'juz', label: 'Juz Mode', isSelected: mode === 'juz' },
  ];

  const modeLabel = mode === 'chapter' ? 'Surah Mode' : 'Juz Mode';

  // Chapter/Juz item options
  const itemOptions = useMemo(() => {
    if (mode === 'chapter') {
      return chapters.map((ch) => ({
        value: ch.id,
        label: `${ch.id}. ${ch.name_simple} (${ch.translated_name.name})`,
        isSelected: ch.id === currentChapter,
        isFavorite: state.favoriteChapters.includes(ch.id),
        isDownloaded: isDownloaded('chapter', ch.id),
        isDownloading: isDownloadingItem('chapter', ch.id),
        downloadProgress: getDownloadProgress('chapter', ch.id),
      }));
    }
    return Array.from({ length: 30 }, (_, i) => ({
      value: i + 1,
      label: `Juz ${i + 1}`,
      isSelected: i + 1 === currentJuz,
      isFavorite: false,
      isDownloaded: isDownloaded('juz', i + 1),
      isDownloading: isDownloadingItem('juz', i + 1),
      downloadProgress: getDownloadProgress('juz', i + 1),
    }));
  }, [mode, chapters, currentChapter, currentJuz, state.favoriteChapters, state.downloaded, isDownloadingItem, getDownloadProgress]);

  const activeItem = itemOptions.find((o) => o.isSelected);
  const itemLabel = activeItem?.label || 'Select...';


  // Handlers
  const handleModeChange = (value) => {
    dispatch({ type: 'SET_MODE', payload: value });
  };

  const handleItemChange = (value) => {
    if (mode === 'chapter') {
      dispatch({ type: 'SET_CHAPTER', payload: value });
    } else {
      dispatch({ type: 'SET_JUZ', payload: value });
    }
  };

  const handleToggleFavorite = (id) => {
    dispatch({ type: 'TOGGLE_FAVORITE_CHAPTER', payload: id });
  };

  const handleDownload = (id) => {
    downloadItem(mode, id);
  };

  const handleDelete = (id) => {
    deleteItem(mode, id);
  };



  return (
    <div className="w-full bg-[#FCFAF5]/70 backdrop-blur-md rounded-3xl p-6 md:p-10 border border-gold/20 flex flex-col gap-8 md:gap-10">
      {/* Selection Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full border-b border-[#e8dcb8]/50 pb-5 mb-2 gap-4 overflow-visible z-10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
          {/* Mode Dropdown */}
          <Dropdown
            label={modeLabel}
            options={modeOptions}
            onSelect={handleModeChange}
            className="w-full sm:w-auto"
            btnClassName="w-full sm:w-auto justify-center sm:justify-start bg-sepia-dark/5 hover:bg-sepia-dark/8 font-montserrat text-xs text-sepia-dark/80 font-medium px-4 py-2 sm:py-1.5 rounded-full"
            menuClassName="w-full sm:w-36 left-0 rounded-md"
          />

          {/* Chapter/Juz Dropdown */}
          <Dropdown
            label={itemLabel}
            options={itemOptions}
            onSelect={handleItemChange}
            onToggleFavorite={mode === 'chapter' ? handleToggleFavorite : undefined}
            onDownload={handleDownload}
            onDelete={handleDelete}
            showFavorites={mode === 'chapter'}
            searchable={true}
            searchPlaceholder={mode === 'chapter' ? 'Search surah...' : 'Search juz...'}
            bottomSheetTitle={mode === 'chapter' ? 'Select Surah' : 'Select Juz'}
            className="w-full sm:w-auto"
            btnClassName="w-full justify-center sm:justify-start bg-transparent font-montserrat text-sm text-sepia-dark hover:text-gold sm:max-w-[220px] text-center sm:text-left"
            menuClassName="w-full sm:w-[280px] sm:right-auto sm:left-0 rounded-xl"
          />
        </div>
      </div>

      {/* Verse Display */}
      <VerseDisplay />

      {/* Player Controls */}
      <div className="flex flex-col gap-6 w-full">
        <ProgressBar />
        <PlayerControls />
      </div>
    </div>
  );
}
