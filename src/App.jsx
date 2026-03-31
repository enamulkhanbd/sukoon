import { Suspense, lazy, useState } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { useQuranData } from './hooks/useQuranData';
import Header from './components/Header';

const Player = lazy(() => import('./components/Player'));
const BottomPlayer = lazy(() => import('./components/BottomPlayer'));
const SelectionModal = lazy(() => import('./components/SelectionModal'));

function AppContent() {
  useQuranData();
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-gold/5 px-6 py-4 flex items-center justify-center z-50 shadow-sm/5">
        <Header className="scale-[0.65] md:scale-75" />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 md:p-10 pb-[220px]">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 md:gap-12">
          <Suspense fallback={<div className="w-full bg-white/70 backdrop-blur-md rounded-3xl h-[400px] border border-gold/20 animate-pulse"></div>}>
            <Player />
          </Suspense>
        </div>
      </main>

      {/* Sticky Bottom Player */}
      <Suspense fallback={null}>
        <BottomPlayer onOpenSelection={() => setIsSelectionOpen(true)} />
      </Suspense>

      {/* Selection Bottom Sheet */}
      <Suspense fallback={null}>
        <SelectionModal 
           isOpen={isSelectionOpen} 
           onClose={() => setIsSelectionOpen(false)} 
        />
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
