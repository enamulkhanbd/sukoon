import { useMemo, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function Sidebar() {
  const { state, dispatch } = usePlayer();
  const { chapters, mode, currentChapter, currentJuz, sidebarOpen } = state;
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(mode); // 'chapter' or 'juz'

  const filteredChapters = useMemo(() => {
    return chapters.filter(ch => 
      ch.name_simple.toLowerCase().includes(search.toLowerCase()) ||
      ch.id.toString().includes(search)
    );
  }, [chapters, search]);

  const handleSelect = (type, id) => {
    if (type === 'chapter') {
      dispatch({ type: 'SET_MODE', payload: 'chapter' });
      dispatch({ type: 'SET_CHAPTER', payload: id });
    } else {
      dispatch({ type: 'SET_MODE', payload: 'juz' });
      dispatch({ type: 'SET_JUZ', payload: id });
    }
    
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      dispatch({ type: 'SET_SIDEBAR_OPEN', payload: false });
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => dispatch({ type: 'SET_SIDEBAR_OPEN', payload: false })}
        />
      )}

      <aside className={`
        fixed md:relative z-50 w-full md:w-[400px] h-full bg-[#fdfaf3] border-r border-[#ece3d1] flex flex-col 
        transition-transform duration-500 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Top Branding Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#ece3d1]">
          <h1 className="font-vibes text-3xl font-bold text-sepia-dark">Sukoon</h1>
          <div className="flex items-center gap-4 text-sepia-dark">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <button onClick={() => dispatch({ type: 'SET_SIDEBAR_OPEN', payload: false })} className="md:hidden">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
          </div>
        </div>

        {/* Search Section */}
        <div className="p-4 bg-[#ede2cf]/30 border-b border-[#ece3d1]">
          <div className="relative group">
            <input 
              type="text" 
              placeholder="Search the Quran..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-[#ece3d1] rounded-full pl-12 pr-12 py-3 text-sm focus:outline-none shadow-sm font-montserrat"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-sepia-dark/40" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="8" cy="8" r="6"/><path d="m13 13 4 4"/></svg>
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 text-sepia-dark" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 21h8"/></svg>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 border-b border-[#ece3d1] bg-white">
          <div className="flex gap-6 overflow-x-auto no-scrollbar">
            {['Surah', 'Juz', 'Revelation Order'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase().includes('juz') ? 'juz' : 'chapter')}
                className={`py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
                  (tab === 'Surah' && activeTab === 'chapter') || (tab === 'Juz' && activeTab === 'juz') 
                  ? 'border-sepia-dark text-sepia-dark' 
                  : 'border-transparent text-sepia-dark/40 hover:text-sepia-dark'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Sort By Dropdown */}
        <div className="px-4 py-2 flex justify-end bg-white">
          <button className="flex items-center gap-1 text-[10px] font-bold text-sepia-dark/60 uppercase tracking-widest">
            Sort by: <span className="text-sepia-dark">Ascending</span>
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 4 3 3 3-3"/></svg>
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
          {activeTab === 'chapter' ? (
            filteredChapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleSelect('chapter', ch.id)}
                className={`flex items-center p-4 bg-[#fbf8f0] border border-[#ece3d1] rounded-lg text-left group transition-all hover:border-[#d9c9ae] hover:shadow-sm ${currentChapter === ch.id && mode === 'chapter' ? 'border-[#d9c9ae] bg-[#f7f0e0]' : ''}`}
              >
                {/* Rhombus Container */}
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0 mr-4">
                  <div className="absolute inset-0 bg-[#ede2cf] transform rotate-45 rounded-sm" />
                  <span className="relative z-10 font-montserrat font-bold text-sepia-dark text-sm">{ch.id}</span>
                </div>

                <div className="flex-1">
                  <div className="font-montserrat font-bold text-sepia-dark text-sm">{ch.name_simple}</div>
                  <div className="font-montserrat text-[11px] text-sepia-dark/50 mt-0.5">{ch.translated_name.name}</div>
                </div>

                <div className="text-right">
                  <div className="font-amiri text-lg text-sepia-dark leading-none">{ch.name_arabic}</div>
                  <div className="font-montserrat text-[10px] text-sepia-dark/40 mt-1 uppercase font-bold tracking-tighter">{ch.verses_count} Ayahs</div>
                </div>
              </button>
            ))
          ) : (
            Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
              <button
                key={j}
                onClick={() => handleSelect('juz', j)}
                className="flex items-center p-4 bg-[#fbf8f0] border border-[#ece3d1] rounded-lg text-left hover:border-[#d9c9ae] shadow-sm"
              >
                <div className="relative w-10 h-10 flex items-center justify-center shrink-0 mr-4">
                  <div className="absolute inset-0 bg-[#ede2cf] transform rotate-45 rounded-sm" />
                  <span className="relative z-10 font-montserrat font-bold text-sepia-dark text-sm">{j}</span>
                </div>
                <div className="text-sm font-bold text-sepia-dark">Juz {j}</div>
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
