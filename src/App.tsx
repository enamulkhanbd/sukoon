import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BottomNav, type AppTab } from './components/BottomNav';
import { DuaReaderView } from './components/DuaReaderView';
import { DuasView } from './components/DuasView';
import { HomeView } from './components/HomeView';
import { ReaderView } from './components/ReaderView';
import { RoutineDetailView } from './components/RoutineDetailView';
import { RoutinesView } from './components/RoutinesView';
import { SettingsView } from './components/SettingsView';
import { SurahListView } from './components/SurahListView';
import { useToast } from './components/ToastProvider';
import { DUA_MAP, type DuaItem } from './data/duas';
import {
  DEFAULT_SETTINGS,
  db,
  ensureDatabaseInitialized,
  getCompletedItemIndexes,
  getRoutineItems,
  type Routine,
  type RoutineProgress,
  type Settings,
} from './db/database';

type ReaderSession =
  | {
      kind: 'surah';
      surahId: number;
      initialAyah?: number;
      routine?: Routine;
      routineItemIndex?: number;
    }
  | {
      kind: 'dua';
      duaId: string;
      routine?: Routine;
      routineItemIndex?: number;
      targetCount?: number;
    };

const THEME_META_COLORS: Record<Settings['theme'], string> = {
  paper: '#FAF6EE',
  olive: '#EEF2EA',
  black: '#070807',
};

export function App() {
  const toast = useToast();
  const [dbReady, setDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [routineDetailId, setRoutineDetailId] = useState<string | null>(null);
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

  // Support mobile browser back button to close ReaderView & RoutineDetailView cleanly
  useEffect(() => {
    const handlePopState = () => {
      const state = window.history.state as {
        view?: 'reader' | 'detail';
        detailId?: string;
      } | null;

      if (state?.view === 'detail' && state.detailId) {
        setReaderSession(null);
        setRoutineDetailId(state.detailId);
      } else if (state?.view !== 'reader') {
        setReaderSession(null);
        setRoutineDetailId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openRoutineDetails = useCallback(
    (routine: Routine) => {
      if (routineDetailId !== routine.id) {
        window.history.pushState(
          { view: 'detail', detailId: routine.id },
          ''
        );
      }
      setRoutineDetailId(routine.id);
    },
    [routineDetailId]
  );

  const closeRoutineDetails = useCallback(() => {
    setRoutineDetailId(null);
    const state = window.history.state as { view?: string } | null;
    if (state?.view === 'detail') {
      window.history.back();
    }
  }, []);

  const openReader = useCallback(
    (session: ReaderSession) => {
      if (!readerSession) {
        window.history.pushState(
          { view: 'reader', detailId: routineDetailId },
          ''
        );
      }
      setReaderSession(session);
    },
    [readerSession, routineDetailId]
  );

  const closeReader = useCallback(() => {
    setReaderSession(null);
    const state = window.history.state as { view?: string } | null;
    if (state?.view === 'reader') {
      window.history.back();
    }
  }, []);

  const handleOpenSurah = useCallback(
    (surahId: number, initialAyah = 1) => {
      openReader({ kind: 'surah', surahId, initialAyah });
    },
    [openReader]
  );

  const handleOpenDua = useCallback(
    (dua: DuaItem) => {
      openReader({ kind: 'dua', duaId: dua.id });
    },
    [openReader]
  );

  const handleOpenRoutine = useCallback(
    (routine: Routine, progress?: RoutineProgress, explicitItemIndex?: number) => {
      const items = getRoutineItems(routine);
      if (items.length === 0) return;

      const completedSet = new Set(getCompletedItemIndexes(routine, progress));
      let targetIdx = 0;
      let resumedAyah: number | undefined;

      if (explicitItemIndex !== undefined && items[explicitItemIndex]) {
        targetIdx = explicitItemIndex;
        if (
          progress &&
          progress.lastReadItemIndex === explicitItemIndex &&
          !completedSet.has(explicitItemIndex) &&
          progress.lastReadAyah > 0
        ) {
          resumedAyah = progress.lastReadAyah;
        }
      } else if (progress && progress.percentage < 100) {
        if (
          progress.lastReadItemIndex !== undefined &&
          items[progress.lastReadItemIndex] &&
          !completedSet.has(progress.lastReadItemIndex)
        ) {
          targetIdx = progress.lastReadItemIndex;
          if (progress.lastReadAyah > 0) {
            resumedAyah = progress.lastReadAyah;
          }
        } else {
          const firstIncomplete = items.findIndex((_, idx) => !completedSet.has(idx));
          targetIdx = firstIncomplete !== -1 ? firstIncomplete : 0;
        }
      } else if (completedSet.size > 0 && completedSet.size < items.length) {
        const firstIncomplete = items.findIndex((_, idx) => !completedSet.has(idx));
        targetIdx = firstIncomplete !== -1 ? firstIncomplete : 0;
      }

      const targetItem = items[targetIdx];
      if (targetItem.kind === 'dua') {
        openReader({
          kind: 'dua',
          duaId: targetItem.duaId,
          routine,
          routineItemIndex: targetIdx,
          targetCount: targetItem.targetCount,
        });
      } else {
        const initialAyah =
          resumedAyah !== undefined
            ? Math.min(Math.max(resumedAyah, targetItem.startAyah), targetItem.endAyah)
            : targetItem.startAyah;
        openReader({
          kind: 'surah',
          surahId: targetItem.surahId,
          initialAyah,
          routine,
          routineItemIndex: targetIdx,
        });
      }
    },
    [openReader]
  );

  const handleAdvanceRoutineItem = useCallback(
    (routine: Routine, nextIndex: number) => {
      const items = getRoutineItems(routine);
      const nextItem = items[nextIndex];
      if (!nextItem) {
        closeReader();
        return;
      }
      if (nextItem.kind === 'dua') {
        setReaderSession({
          kind: 'dua',
          duaId: nextItem.duaId,
          routine,
          routineItemIndex: nextIndex,
          targetCount: nextItem.targetCount,
        });
      } else {
        setReaderSession({
          kind: 'surah',
          surahId: nextItem.surahId,
          initialAyah: nextItem.startAyah,
          routine,
          routineItemIndex: nextIndex,
        });
      }
    },
    [closeReader]
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

  const handleToggleDuaBookmark = useCallback(
    async (duaId: string) => {
      const current = settings.bookmarkedDuaIds ?? [];
      const exists = current.includes(duaId);
      const next = exists
        ? current.filter((id) => id !== duaId)
        : [...current, duaId];
      await handleUpdateSettings({ bookmarkedDuaIds: next });
      toast.success(
        exists ? 'সংরক্ষিত দুআ থেকে সরানো হয়েছে' : 'দুআ সংরক্ষণ করা হয়েছে'
      );
    },
    [settings.bookmarkedDuaIds, handleUpdateSettings, toast]
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
    if (readerSession.kind === 'dua') {
      const dua = DUA_MAP[readerSession.duaId];
      if (dua) {
        return (
          <DuaReaderView
            key={`dua-${dua.id}-${readerSession.routine?.id ?? 'free'}-${
              readerSession.routineItemIndex ?? 0
            }`}
            dua={dua}
            settings={settings}
            routine={readerSession.routine}
            routineItemIndex={readerSession.routineItemIndex}
            routineTargetCount={readerSession.targetCount}
            onClose={closeReader}
            onUpdateSettings={handleUpdateSettings}
            onSelectDuaInChapter={(nextDua) =>
              setReaderSession({ kind: 'dua', duaId: nextDua.id })
            }
            onAdvanceRoutineItem={(nextIdx) =>
              readerSession.routine &&
              handleAdvanceRoutineItem(readerSession.routine, nextIdx)
            }
            onOpenQuranRef={(surahId, startAyah) =>
              setReaderSession({
                kind: 'surah',
                surahId,
                initialAyah: startAyah,
              })
            }
          />
        );
      }
    } else {
      return (
        <ReaderView
          key={`${readerSession.surahId}-${readerSession.routine?.id ?? 'free'}-${
            readerSession.routineItemIndex ?? 0
          }`}
          surahId={readerSession.surahId}
          initialAyah={readerSession.initialAyah}
          routine={readerSession.routine}
          routineItemIndex={readerSession.routineItemIndex}
          settings={settings}
          onClose={closeReader}
          onSelectSurah={(surahId, initialAyah = 1, routineItemIndex) =>
            setReaderSession({
              kind: 'surah',
              surahId,
              initialAyah,
              routine: readerSession.routine,
              routineItemIndex,
            })
          }
          onAdvanceRoutineItem={(nextIdx) =>
            readerSession.routine &&
            handleAdvanceRoutineItem(readerSession.routine, nextIdx)
          }
          onUpdateSettings={handleUpdateSettings}
        />
      );
    }
  }

  if (routineDetailId) {
    return (
      <RoutineDetailView
        routineId={routineDetailId}
        onBack={closeRoutineDetails}
        onStartItem={(routine, itemIndex, progress) =>
          handleOpenRoutine(routine, progress, itemIndex)
        }
      />
    );
  }

  return (
    <div className="min-h-dvh paper-frame">
      {activeTab === 'home' && (
        <HomeView
          onOpenSurah={handleOpenSurah}
          onOpenRoutineDetails={openRoutineDetails}
          onGoToRoutines={() => setActiveTab('routines')}
          onGoToSurahs={() => setActiveTab('surahs')}
        />
      )}
      {activeTab === 'surahs' && (
        <SurahListView onOpenSurah={(id) => handleOpenSurah(id, 1)} />
      )}
      {activeTab === 'duas' && (
        <DuasView
          settings={settings}
          onOpenDua={handleOpenDua}
          onToggleBookmark={handleToggleDuaBookmark}
        />
      )}
      {activeTab === 'routines' && (
        <RoutinesView
          onOpenRoutineDetails={openRoutineDetails}
        />
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
