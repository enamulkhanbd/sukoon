import { useMemo, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useDownload } from '../hooks/useDownload';
import Dropdown from './Dropdown';

export default function SelectionModal({ isOpen, onClose }) {
  const { state, dispatch } = usePlayer();
  const { mode, currentChapter, currentJuz, chapters, favoriteChapters } = state;
  const { isDownloaded, isDownloadingItem, getDownloadProgress, downloadItem, deleteItem } = useDownload();
  const [activeTab, setActiveTab] = useState(mode);
  const [searchQuery, setSearchQuery] = useState('');
 
  const itemOptions = useMemo(() => {
    if (activeTab === 'chapter') {
      return chapters.map((ch) => ({
        value: ch.id,
        label: `${ch.id}. ${ch.name_simple} (${ch.translated_name.name})`,
        isSelected: ch.id === currentChapter && mode === 'chapter',
        isFavorite: favoriteChapters.includes(ch.id),
        isDownloaded: isDownloaded('chapter', ch.id),
        isDownloading: isDownloadingItem('chapter', ch.id),
        downloadProgress: getDownloadProgress('chapter', ch.id),
      }));
    }
    return Array.from({ length: 30 }, (_, i) => ({
      value: i + 1,
      label: `Juz ${i + 1}`,
      isSelected: i + 1 === currentJuz && mode === 'juz',
      isFavorite: false,
      isDownloaded: isDownloaded('juz', i + 1),
      isDownloading: isDownloadingItem('juz', i + 1),
      downloadProgress: getDownloadProgress('juz', i + 1),
    }));
  }, [activeTab, chapters, currentChapter, currentJuz, mode, favoriteChapters, isDownloaded, isDownloadingItem, getDownloadProgress]);

  const filteredOptions = useMemo(() => {
    return itemOptions.filter(opt => 
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [itemOptions, searchQuery]);

  const handleSelect = (value) => {
    dispatch({ type: 'SET_MODE', payload: activeTab });
    if (activeTab === 'chapter') {
      dispatch({ type: 'SET_CHAPTER', payload: value });
    } else {
      dispatch({ type: 'SET_JUZ', payload: value });
    }
    onClose();
  };

  const handleToggleFavorite = (id) => {
      dispatch({ type: 'TOGGLE_FAVORITE_CHAPTER', payload: id });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-sepia-dark/40 backdrop-blur-sm animate-fade-in" 
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-2xl bg-[#ffffff] rounded-t-[2rem] md:rounded-t-[3rem] shadow-2xl p-5 md:p-10 flex flex-col gap-6 animate-slide-up h-[85vh] overflow-hidden">
        {/* Drag Handle */}
        <div className="w-16 h-1 bg-gold/5 rounded-full mx-auto self-center -mt-1 mb-1" />

        <div className="flex flex-col gap-6 flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-bold text-sepia-dark tracking-tight">Select Recitation</h3>
                <button 
                  onClick={onClose}
                  className="p-2.5 rounded-full bg-sepia-dark/5 text-sepia-dark/40 hover:text-sepia-dark/80 transition-colors"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>

            {/* Tabs */}
            <div className="w-full p-1.5 bg-[#f9f5eb] rounded-[2rem] flex items-center shrink-0">
                <button
                    onClick={() => setActiveTab('chapter')}
                    className={`flex-1 py-3 px-6 rounded-[1.7rem] text-xs md:text-sm font-bold tracking-widest uppercase transition-all duration-300 ${
                        activeTab === 'chapter' ? 'bg-[#ffffff] text-gold shadow-sm' : 'text-sepia-dark/50'
                    }`}
                >
                    Surah
                </button>
                <button
                    onClick={() => setActiveTab('juz')}
                    className={`flex-1 py-3 px-6 rounded-[1.7rem] text-xs md:text-sm font-bold tracking-widest uppercase transition-all duration-300 ${
                        activeTab === 'juz' ? 'bg-[#ffffff] text-gold shadow-sm' : 'text-sepia-dark/50'
                    }`}
                >
                    Juz
                </button>
            </div>

            {/* Search (Subtle) */}
            <div className="relative shrink-0">
                <input 
                    type="text" 
                    placeholder={activeTab === 'chapter' ? "Search Surah..." : "Search Juz..."}
                    className="w-full h-11 pl-11 pr-4 rounded-2xl bg-sepia-dark/5 border-transparent focus:bg-[#f9f5eb] focus:border-gold/20 text-sm placeholder:text-sepia-dark/30 transition-all outline-none"
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-sepia-dark/20" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>

            {/* List Wrapper */}
            <div className="flex-1 overflow-y-auto custom-scrollbar -mx-5 px-5">
                <div className="flex flex-col">
                    {filteredOptions.map((opt) => (
                        <div 
                          key={opt.value}
                          className={`flex items-center justify-between py-3.5 border-b border-gold/5 transition-colors group cursor-pointer ${opt.isSelected ? 'text-gold' : 'text-sepia-dark'}`}
                          onClick={() => handleSelect(opt.value)}
                        >
                            <div className="flex-1">
                                <p className={`text-base md:text-lg transition-all ${opt.isSelected ? 'font-bold pl-2' : 'font-medium'}`}>
                                    {opt.label}
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                {activeTab === 'chapter' && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleToggleFavorite(opt.value); }}
                                      className={`p-2.5 rounded-full transition-all duration-300 ${
                                          opt.isFavorite 
                                          ? 'text-pink-500 scale-110 opacity-100' 
                                          : 'text-sepia-dark/10 group-hover:text-pink-400 group-hover:scale-110 group-hover:opacity-100'
                                      }`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={opt.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                    </button>
                                )}
                                {opt.isDownloaded ? (
                                     <svg className="w-5 h-5 text-green-500/50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                                ) : (
                                    <button onClick={(e) => { e.stopPropagation(); downloadItem(activeTab, opt.value); }} className="text-sepia-dark/10 group-hover:text-gold transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
