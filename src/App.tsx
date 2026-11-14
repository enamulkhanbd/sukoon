import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BottomNav, type AppTab } from './components/BottomNav';
import { DuaReaderView } from './components/DuaReaderView';
import { DuasView } from './components/DuasView';
import { HomeView } from './components/HomeView';
import { ReaderView } from './components/ReaderView';
import { RoutinesView } from './components/RoutinesView';
import { SettingsView } from './components/SettingsView';
import { SurahListView } from './components/SurahListView';
import { useToast } from './components/ToastProvider';
import { DUA_MAP, type DuaItem } from './data/duas';
import {
  DEFAULT_SETTINGS,
  db,
  ensureDatabaseInitialized,
  getRoutineItems,
  isDuaRoutineItem,
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
    (routine: Routine, progress?: RoutineProgress) => {
      const items = getRoutineItems(routine);
      if (items.length === 0) return;

      let targetIdx = 0;
      let resumedAyah: number | undefined;

      if (progress && progress.percentage < 100) {
        let idx = -1;
        if (progress.lastReadDuaId) {
          const indexedDua =
            progress.lastReadItemIndex !== undefined
              ? items[progress.lastReadItemIndex]
              : undefined;
          idx =
            indexedDua?.kind === 'dua' && indexedDua.duaId === progress.lastReadDuaId
              ? progress.lastReadItemIndex!
              : items.findIndex(
                  (it) => it.kind === 'dua' && it.duaId === progress.lastReadDuaId
                );
        } else if (progress.lastReadSurah) {
          const indexed =
            progress.lastReadItemIndex !== undefined
              ? items[progress.lastReadItemIndex]
              : undefined;
          idx =
            indexed &&
            !isDuaRoutineItem(indexed) &&
            indexed.surahId === progress.lastReadSurah
              ? progress.lastReadItemIndex!
              : items.findIndex(
                  (it) => !isDuaRoutineItem(it) && it.surahId === progress.lastReadSurah
                );
        }

        if (idx !== -1) {
          if (progress.lastItemCompleted && idx + 1 < items.length) {
            targetIdx = idx + 1;
          } else {
            targetIdx = idx;
            resumedAyah = progress.lastReadAyah;
          }
        }
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
      {activeTab === 'duas' && (
        <DuasView
          settings={settings}
          onOpenDua={handleOpenDua}
          onToggleBookmark={handleToggleDuaBookmark}
        />
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
