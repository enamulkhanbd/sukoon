import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BottomNav, type AppTab } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { ReaderView } from './components/ReaderView';
import { RoutinesView } from './components/RoutinesView';
import { SettingsView } from './components/SettingsView';
import { SurahListView } from './components/SurahListView';
import {
  DEFAULT_SETTINGS,
  db,
  ensureDatabaseInitialized,
  getRoutineItems,
  type Routine,
  type RoutineProgress,
  type Settings,
} from './db/database';

interface ReaderSession {
  surahId: number;
  initialAyah?: number;
  routine?: Routine;
  routineItemIndex?: number;
}

const THEME_META_COLORS: Record<Settings['theme'], string> = {
  paper: '#FAF6EE',
  olive: '#EEF2EA',
  black: '#070807',
};

export function App() {
  const [dbReady, setDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [readerSession, setReaderSession] = useState<ReaderSession | null>(null);

  useEffect(() => {
    ensureDatabaseInitialized().then(() => setDbReady(true));
  }, []);

  const settings =
    useLiveQuery(() => db.settings.get('app'), []) ?? DEFAULT_SETTINGS;

  // Apply theme attribute & PWA status bar color
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', THEME_META_COLORS[settings.theme]);
    }
  }, [settings.theme]);

  // Support mobile browser back button to close ReaderView cleanly
  useEffect(() => {
    const handlePopState = () => {
      setReaderSession(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openReader = useCallback((session: ReaderSession) => {
    if (!readerSession) {
      window.history.pushState({ reader: true }, '');
    }
    setReaderSession(session);
  }, [readerSession]);

  const closeReader = useCallback(() => {
    setReaderSession(null);
    if (window.history.state && (window.history.state as { reader?: boolean }).reader) {
      window.history.back();
    }
  }, []);

  const handleOpenSurah = useCallback(
    (surahId: number, initialAyah = 1) => {
      openReader({ surahId, initialAyah });
    },
    [openReader]
  );

  const handleOpenRoutine = useCallback(
    (routine: Routine, progress?: RoutineProgress) => {
      const items = getRoutineItems(routine);
      if (items.length === 0) return;

      let targetIdx = 0;
      let initialAyah = items[0].startAyah;

      if (progress && progress.percentage < 100) {
        const idx =
          progress.lastReadItemIndex !== undefined &&
          items[progress.lastReadItemIndex]?.surahId === progress.lastReadSurah
            ? progress.lastReadItemIndex
            : items.findIndex((it) => it.surahId === progress.lastReadSurah);

        if (idx !== -1) {
          targetIdx = idx;
          initialAyah = Math.min(
            Math.max(progress.lastReadAyah, items[idx].startAyah),
            items[idx].endAyah
          );
        }
      }

      openReader({
        surahId: items[targetIdx].surahId,
        initialAyah,
        routine,
        routineItemIndex: targetIdx,
      });
    },
    [openReader]
  );

  const handleUpdateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
      await db.settings.put({
        ...current,
        ...patch,
        key: 'app',
      });
    },
    []
  );

  if (!dbReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center paper-frame">
        <div className="text-center space-y-2">
          <div
            className="font-indopak text-4xl"
            style={{ color: 'var(--accent)' }}
          >
            سُكُوْن
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            প্রস্তুত হচ্ছে...
          </p>
        </div>
      </div>
    );
  }

  if (readerSession) {
    return (
      <ReaderView
        key={`${readerSession.surahId}-${readerSession.routine?.id ?? 'free'}-${readerSession.routineItemIndex ?? 0}`}
        surahId={readerSession.surahId}
        initialAyah={readerSession.initialAyah}
        routine={readerSession.routine}
        routineItemIndex={readerSession.routineItemIndex}
        settings={settings}
        onClose={closeReader}
        onSelectSurah={(surahId, initialAyah = 1, routineItemIndex) =>
          setReaderSession({
            surahId,
            initialAyah,
            routine: readerSession.routine,
            routineItemIndex,
          })
        }
        onUpdateSettings={handleUpdateSettings}
      />
    );
  }

  return (
    <div className="min-h-dvh paper-frame">
      {activeTab === 'home' && (
        <HomeView
          onOpenSurah={handleOpenSurah}
          onOpenRoutine={handleOpenRoutine}
          onGoToRoutines={() => setActiveTab('routines')}
          onGoToSurahs={() => setActiveTab('surahs')}
        />
      )}
      {activeTab === 'surahs' && (
        <SurahListView onOpenSurah={(id) => handleOpenSurah(id, 1)} />
      )}
      {activeTab === 'routines' && (
        <RoutinesView onOpenRoutine={handleOpenRoutine} />
      )}
      {activeTab === 'settings' && (
        <SettingsView
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}

export default App;
