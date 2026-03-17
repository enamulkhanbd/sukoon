import { PlayerProvider } from './context/PlayerContext';
import { useQuranData } from './hooks/useQuranData';
import { useOfflineCache } from './hooks/useOfflineCache';
import Header from './components/Header';
import Player from './components/Player';

function AppContent() {
  useQuranData();
  useOfflineCache();

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="max-w-2xl w-full flex flex-col items-center gap-8 md:gap-12">
        <Header />
        <Player />
      </div>
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
