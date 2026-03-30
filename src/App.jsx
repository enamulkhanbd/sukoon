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
    <div className="fixed inset-0 bg-[#f4ecd8] flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-gold/5 px-6 py-5 flex items-center justify-center z-50 shadow-sm">
        <Header className="scale-75" />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-10 pb-[220px]">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 md:gap-12">
          <Suspense fallback={<div className="w-full bg-[#FCFAF5]/70 backdrop-blur-md rounded-3xl h-[400px] border border-gold/20 animate-pulse"></div>}>
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
