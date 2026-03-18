import { Suspense, lazy } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { useQuranData } from './hooks/useQuranData';

const Sidebar = lazy(() => import('./components/Sidebar'));
const ReadingView = lazy(() => import('./components/ReadingView'));
const GlobalPlayer = lazy(() => import('./components/GlobalPlayer'));

function AppContent() {
  const { state, dispatch } = usePlayer();
  useQuranData();

  return (
    <div className="h-screen bg-cream overflow-hidden flex flex-col font-montserrat text-sepia-dark relative">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => dispatch({ type: 'SET_SIDEBAR_OPEN', payload: true })}
        className="md:hidden absolute top-4 left-4 z-30 p-3 bg-white/80 backdrop-blur-md rounded-2xl border border-gold/20 shadow-lg text-gold-dark"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>

      <div className="flex flex-1 h-full overflow-hidden">
        <Suspense fallback={<div className="w-80 h-full bg-gold/5 animate-pulse border-r border-gold/10" />}>
          <Sidebar />
        </Suspense>

        <Suspense fallback={<div className="flex-1 flex items-center justify-center font-cinzel text-gold-dark/20 text-3xl animate-pulse uppercase tracking-[1em]">Sukoon</div>}>
          <ReadingView />
        </Suspense>
      </div>

      <Suspense fallback={<div className="h-24 bg-cream/80 border-t border-gold/10 animate-pulse" />}>
        <GlobalPlayer />
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}
