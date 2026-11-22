import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BottomNav, type AppTab } from './components/BottomNav';
import { DuaReaderView } from './components/DuaReaderView';
import { DuasView } from './components/DuasView';
import { FastingScheduleView } from './components/FastingScheduleView';
import { GlobalSearchOverlay } from './components/GlobalSearchOverlay';
import { HomeView } from './components/HomeView';
import { ProfileView, type ProfileSection } from './components/ProfileView';
import { ReaderView } from './components/ReaderView';
import { RoutineDetailView } from './components/RoutineDetailView';
import { RoutinesView } from './components/RoutinesView';
import { SettingsSheet } from './components/SettingsSheet';
import { SplashScreen } from './components/SplashScreen';
import { SurahListView } from './components/SurahListView';
import { useToast } from './components/ToastProvider';
import { DUA_MAP, type DuaItem } from './data/duas';
import {
  DEFAULT_SETTINGS,
  GLASS_PRESET_OPACITY,
  clampGlassOpacity,
  db,
  ensureDatabaseInitialized,
  getCompletedItemIndexes,
  getRoutineItems,
  normalizeThemeSettings,
  resetStaleRoutineProgressIfNeeded,
  syncIslamicClockSettings,
  type Routine,
  type RoutineProgress,
  type Settings,
} from './db/database';
import { useIslamicClock } from './hooks/useIslamicClock';
import {
  buildPath,
  hidesBottomNav,
  isReaderRoute,
  parseRoute,
  type AppRoute,
} from './router';
import { applyThemeIcons } from './utils/themeIcons';
import { getThemeVariantMeta } from './utils/themeRegistry';

export function App() {
  const toast = useToast();
  const [dbReady, setDbReady] = useState(false);
  const [route, setRoute] = useState<AppRoute>(() => parseRoute());
  const [profileSection, setProfileSection] = useState<ProfileSection>('stats');
  const [openCreateRoutine, setOpenCreateRoutine] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => {
    const normalized = window.location.pathname.replace(/\/+$/, '');
    return normalized === '/settings';
  });
  const [savedDuasNonce, setSavedDuasNonce] = useState(0);
  const lastBaseRouteRef = useRef<AppRoute>({ type: 'tab', tab: 'home' });
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const restoreScrollRef = useRef(false);

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    ensureDatabaseInitialized().then(() => setDbReady(true));
  }, []);

  // Normalize unknown/malformed initial URL to canonical clean path
  useEffect(() => {
    const canonical = buildPath(route);
    const current = window.location.pathname + window.location.search;
    if (current !== canonical) {
      window.history.replaceState(null, '', canonical);
    }
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep non-reader return destination up to date
  useEffect(() => {
    if (!isReaderRoute(route) && route.type !== 'ramadan') {
      lastBaseRouteRef.current = route;
    }
  }, [route]);

  // Sync browser Back / Forward navigation (ignore no-op history pops like closing search overlay)
  useEffect(() => {
    const handlePopState = () => {
      const next = parseRoute();
      setRoute((prev) => {
        if (buildPath(prev) === buildPath(next)) return prev;
        restoreScrollRef.current = true;
        return next;
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const currentRoutePath = buildPath(route);

  // Scroll to top on new route/reader, or restore prior list scroll on Back
  useEffect(() => {
    const shouldRestore = restoreScrollRef.current;
    restoreScrollRef.current = false;

    if (shouldRestore && !isReaderRoute(route)) {
      const saved = scrollPositionsRef.current[currentRoutePath];
      if (saved !== undefined) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: saved, behavior: 'auto' });
        });
        return;
      }
    }

    if (route.type === 'surah' && route.initialAyah > 1) return;
    if (route.type === 'routineRead' && route.ayah && route.ayah > 1) return;

    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentRoutePath, route]);

  const navigate = useCallback(
    (
      nextRoute: AppRoute,
      options?: { replace?: boolean; restoreScroll?: boolean }
    ) => {
      const nextPath = buildPath(nextRoute);
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== nextPath) {
        scrollPositionsRef.current[currentPath] = window.scrollY;
        restoreScrollRef.current = Boolean(options?.restoreScroll);
        if (options?.replace) {
          window.history.replaceState(null, '', nextPath);
        } else {
          window.history.pushState(null, '', nextPath);
        }
      }
      setRoute(nextRoute);
    },
    []
  );

  const rawSettings = useLiveQuery(() => db.settings.get('app'), []);
  const { theme: resolvedTheme, colorMode: resolvedColorMode } =
    normalizeThemeSettings(rawSettings?.theme, rawSettings?.colorMode);
  const resolvedGlassMode =
    rawSettings?.glassMode ?? DEFAULT_SETTINGS.glassMode ?? 'frosted';
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    theme: resolvedTheme,
    colorMode: resolvedColorMode,
    glassMode: resolvedGlassMode,
    glassOpacity:
      typeof rawSettings?.glassOpacity === 'number'
        ? clampGlassOpacity(rawSettings.glassOpacity)
        : GLASS_PRESET_OPACITY[resolvedGlassMode],
    fastingLocation:
      rawSettings?.fastingLocation ?? DEFAULT_SETTINGS.fastingLocation,
    fastingMethod:
      rawSettings?.fastingMethod ?? DEFAULT_SETTINGS.fastingMethod,
    fastingTimeFormat:
      rawSettings?.fastingTimeFormat ?? DEFAULT_SETTINGS.fastingTimeFormat,
    hijriOffsetDays:
      rawSettings?.hijriOffsetDays ?? DEFAULT_SETTINGS.hijriOffsetDays,
    dailyGoalMinutes:
      rawSettings?.dailyGoalMinutes ?? DEFAULT_SETTINGS.dailyGoalMinutes,
  };

  const clock = useIslamicClock(settings);

  // Sync prayer location/method to DB helper & reset stale routines at Maghrib rollover
  useEffect(() => {
    syncIslamicClockSettings(settings);
    if (!dbReady) return;
    void resetStaleRoutineProgressIfNeeded(
      clock.islamicDayKey,
      settings.fastingLocation,
      settings.fastingMethod
    );
  }, [
    dbReady,
    clock.islamicDayKey,
    settings.fastingLocation,
    settings.fastingMethod,
  ]);

  const routineReadId = route.type === 'routineRead' ? route.routineId : '';
  const activeRouteRoutineQuery = useLiveQuery(
    async () => {
      if (!routineReadId || !dbReady) return null;
      const routine = (await db.routines.get(routineReadId)) ?? null;
      return { id: routineReadId, routine };
    },
    [routineReadId, dbReady]
  );
  const isRoutineReadReady =
    route.type !== 'routineRead' ||
    activeRouteRoutineQuery?.id === route.routineId;
  const activeRouteRoutine =
    route.type === 'routineRead' && isRoutineReadReady
      ? (activeRouteRoutineQuery?.routine ?? null)
      : undefined;

  // Redirect cleanly if direct /routines/:id/read/:idx points to missing routine or index
  useEffect(() => {
    if (!dbReady || route.type !== 'routineRead') return;
    if (!isRoutineReadReady || activeRouteRoutine === undefined) return;
    if (activeRouteRoutine === null) {
      navigate({ type: 'tab', tab: 'routines' }, { replace: true });
      return;
    }
    const items = getRoutineItems(activeRouteRoutine);
    if (!items[route.itemIndex]) {
      navigate(
        { type: 'routineDetail', routineId: activeRouteRoutine.id },
        { replace: true }
      );
    }
  }, [dbReady, route, isRoutineReadReady, activeRouteRoutine, navigate]);

  // Apply theme, light/dark mode & glass attributes, PWA status bar color, dynamic favicon/app icon & cache for zero-flash splash
  useEffect(() => {
    if (rawSettings === undefined && !dbReady) return;
    const colorMode = settings.colorMode ?? 'light';
    const glassMode = settings.glassMode ?? 'frosted';
    const glassOpacity = clampGlassOpacity(
      settings.glassOpacity ?? GLASS_PRESET_OPACITY[glassMode]
    );
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-mode', colorMode);
    root.setAttribute('data-glass', glassMode);
    root.style.setProperty('--glass-pill-opacity', `${glassOpacity}%`);
    root.style.setProperty(
      '--glass-bar-opacity',
      `${Math.min(98, glassOpacity + 6)}%`
    );
    root.style.setProperty(
      '--glass-sheet-opacity',
      `${Math.min(98, glassOpacity + 14)}%`
    );
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        getThemeVariantMeta(settings.theme, colorMode).metaColor
      );
    }
    const statusBarMeta = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]'
    );
    if (statusBarMeta) {
      statusBarMeta.setAttribute(
        'content',
        colorMode === 'dark' ? 'black-translucent' : 'default'
      );
    }
    applyThemeIcons(settings.theme, colorMode);
    try {
      window.localStorage.setItem('sukoon-theme', settings.theme);
      window.localStorage.setItem('sukoon-mode', colorMode);
      window.localStorage.setItem('sukoon-glass', glassMode);
      window.localStorage.setItem('sukoon-glass-opacity', String(glassOpacity));
    } catch {
      // Ignore storage quota / private mode errors
    }
  }, [
    rawSettings,
    dbReady,
    settings.theme,
    settings.colorMode,
    settings.glassMode,
    settings.glassOpacity,
  ]);

  const handleTabChange = useCallback(
    (tab: AppTab) => {
      navigate({ type: 'tab', tab, duaChapterId: null });
    },
    [navigate]
  );

  const openStats = useCallback(() => {
    setProfileSection('stats');
    navigate({ type: 'tab', tab: 'profile' });
  }, [navigate]);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const openRamadanSchedule = useCallback(() => {
    navigate({ type: 'ramadan' });
  }, [navigate]);

  const closeSubView = useCallback(() => {
    const base = lastBaseRouteRef.current;
    if (base.type === 'tab') {
      navigate(base, { restoreScroll: true });
    } else {
      navigate({ type: 'tab', tab: 'home' }, { restoreScroll: true });
    }
  }, [navigate]);

  const openRoutineDetails = useCallback(
    (routine: Routine) => {
      navigate({ type: 'routineDetail', routineId: routine.id });
    },
    [navigate]
  );

  const closeRoutineDetails = useCallback(() => {
    const base = lastBaseRouteRef.current;
    if (base.type === 'tab' && (base.tab === 'home' || base.tab === 'routines')) {
      navigate(base, { restoreScroll: true });
    } else {
      navigate({ type: 'tab', tab: 'routines' }, { restoreScroll: true });
    }
  }, [navigate]);

  const closeReader = useCallback(() => {
    if (route.type === 'routineRead') {
      navigate(
        { type: 'routineDetail', routineId: route.routineId },
        { restoreScroll: true }
      );
      return;
    }
    const prev = lastBaseRouteRef.current;
    if (!isReaderRoute(prev)) {
      if (route.type === 'dua' && prev.type === 'tab' && prev.tab === 'home') {
        navigate(prev, { restoreScroll: true });
        return;
      }
      if (
        prev.type === 'tab' &&
        (prev.tab === 'home' || prev.tab === 'surahs' || prev.tab === 'duas')
      ) {
        navigate(prev, { restoreScroll: true });
        return;
      }
    }
    if (route.type === 'dua') {
      const dua = DUA_MAP[route.duaId];
      navigate(
        {
          type: 'tab',
          tab: 'duas',
          duaChapterId: dua?.chapterId ?? null,
        },
        { restoreScroll: true }
      );
    } else {
      navigate({ type: 'tab', tab: 'surahs' }, { restoreScroll: true });
    }
  }, [route, navigate]);

  const handleOpenSurah = useCallback(
    (surahId: number, initialAyah = 1) => {
      navigate({ type: 'surah', surahId, initialAyah });
    },
    [navigate]
  );

  const handleOpenDua = useCallback(
    (dua: DuaItem) => {
      navigate({ type: 'dua', duaId: dua.id });
    },
    [navigate]
  );

  const handleStartRoutineItem = useCallback(
    (routine: Routine, itemIndex: number, progress?: RoutineProgress) => {
      const items = getRoutineItems(routine);
      const item = items[itemIndex];
      if (!item) return;

      const completedSet = new Set(getCompletedItemIndexes(routine, progress));
      let ayah: number | undefined;
      if (
        item.kind === 'surah' &&
        progress &&
        progress.lastReadItemIndex === itemIndex &&
        !completedSet.has(itemIndex) &&
        progress.lastReadAyah > 0
      ) {
        ayah = Math.min(Math.max(progress.lastReadAyah, item.startAyah), item.endAyah);
      }

      navigate({
        type: 'routineRead',
        routineId: routine.id,
        itemIndex,
        ayah,
      });
    },
    [navigate]
  );

  const handleAdvanceRoutineItem = useCallback(
    (routine: Routine, nextIndex: number) => {
      const items = getRoutineItems(routine);
      if (!items[nextIndex]) {
        navigate(
          { type: 'routineDetail', routineId: routine.id },
          { replace: true }
        );
        return;
      }
      navigate(
        { type: 'routineRead', routineId: routine.id, itemIndex: nextIndex },
        { replace: true }
      );
    },
    [navigate]
  );

  const handleUpdateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
      await db.settings.put({
        ...DEFAULT_SETTINGS,
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

  if (!dbReady || (route.type === 'routineRead' && activeRouteRoutine === undefined)) {
    return <SplashScreen />;
  }

  const globalOverlays = (
    <>
      <GlobalSearchOverlay
        open={searchOpen}
        bookmarkedDuaIds={settings.bookmarkedDuaIds ?? []}
        isJummah={clock.isJummah}
        waqtSurahId={clock.waqtSuggestion.surahId}
        waqtLabel={`${clock.waqtSuggestion.contextLabelBn} • ${clock.waqtSuggestion.hintBn}`}
        onClose={() => setSearchOpen(false)}
        onOpenSurah={handleOpenSurah}
        onOpenDua={handleOpenDua}
        onOpenDuaChapter={(chapterId) =>
          navigate({ type: 'tab', tab: 'duas', duaChapterId: chapterId })
        }
        onOpenSavedDuas={() => {
          setSavedDuasNonce((n) => n + 1);
          navigate({ type: 'tab', tab: 'duas', duaChapterId: null });
        }}
        onOpenRoutineDetails={openRoutineDetails}
        onOpenStats={openStats}
        onOpenFastingSchedule={openRamadanSchedule}
        onOpenSettings={openSettings}
        onOpenRoutinesTab={() => navigate({ type: 'tab', tab: 'routines' })}
      />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />
    </>
  );

  if (route.type === 'dua') {
    const dua = DUA_MAP[route.duaId];
    if (dua) {
      return (
        <>
          <DuaReaderView
            key={`dua-${dua.id}-free`}
            dua={dua}
            settings={settings}
            onClose={closeReader}
            onUpdateSettings={handleUpdateSettings}
            onSelectDuaInChapter={(nextDua) =>
              navigate({ type: 'dua', duaId: nextDua.id }, { replace: true })
            }
            onOpenQuranRef={(surahId, startAyah) =>
              navigate({ type: 'surah', surahId, initialAyah: startAyah })
            }
          />
          {globalOverlays}
        </>
      );
    }
  }

  if (route.type === 'surah') {
    return (
      <>
        <ReaderView
          key={`${route.surahId}-free`}
          surahId={route.surahId}
          initialAyah={route.initialAyah}
          settings={settings}
          onClose={closeReader}
          onSelectSurah={(surahId, initialAyah = 1) =>
            navigate({ type: 'surah', surahId, initialAyah }, { replace: true })
          }
          onUpdateSettings={handleUpdateSettings}
        />
        {globalOverlays}
      </>
    );
  }

  if (route.type === 'routineRead' && activeRouteRoutine) {
    const items = getRoutineItems(activeRouteRoutine);
    const activeItem = items[route.itemIndex];
    if (activeItem) {
      if (activeItem.kind === 'dua') {
        const dua = DUA_MAP[activeItem.duaId];
        if (dua) {
          return (
            <>
              <DuaReaderView
                key={`dua-${dua.id}-${activeRouteRoutine.id}-${route.itemIndex}`}
                dua={dua}
                settings={settings}
                routine={activeRouteRoutine}
                routineItemIndex={route.itemIndex}
                routineTargetCount={activeItem.targetCount}
                onClose={closeReader}
                onUpdateSettings={handleUpdateSettings}
                onSelectDuaInChapter={(nextDua) =>
                  navigate({ type: 'dua', duaId: nextDua.id })
                }
                onAdvanceRoutineItem={(nextIdx) =>
                  handleAdvanceRoutineItem(activeRouteRoutine, nextIdx)
                }
                onOpenQuranRef={(surahId, startAyah) =>
                  navigate({ type: 'surah', surahId, initialAyah: startAyah })
                }
              />
              {globalOverlays}
            </>
          );
        }
      } else {
        const initialAyah =
          route.ayah !== undefined
            ? Math.min(
                Math.max(route.ayah, activeItem.startAyah),
                activeItem.endAyah
              )
            : activeItem.startAyah;
        return (
          <>
            <ReaderView
              key={`${activeItem.surahId}-${activeRouteRoutine.id}-${route.itemIndex}`}
              surahId={activeItem.surahId}
              initialAyah={initialAyah}
              routine={activeRouteRoutine}
              routineItemIndex={route.itemIndex}
              settings={settings}
              onClose={closeReader}
              onSelectSurah={(surahId, nextStartAyah = 1, nextItemIndex) => {
                if (nextItemIndex !== undefined) {
                  navigate(
                    {
                      type: 'routineRead',
                      routineId: activeRouteRoutine.id,
                      itemIndex: nextItemIndex,
                      ayah: nextStartAyah > 1 ? nextStartAyah : undefined,
                    },
                    { replace: true }
                  );
                } else {
                  navigate({
                    type: 'surah',
                    surahId,
                    initialAyah: nextStartAyah,
                  });
                }
              }}
              onAdvanceRoutineItem={(nextIdx) =>
                handleAdvanceRoutineItem(activeRouteRoutine, nextIdx)
              }
              onUpdateSettings={handleUpdateSettings}
            />
            {globalOverlays}
          </>
        );
      }
    }
  }

  if (route.type === 'ramadan') {
    return (
      <>
        <FastingScheduleView settings={settings} onBack={closeSubView} />
        {globalOverlays}
      </>
    );
  }

  if (route.type === 'routineDetail') {
    return (
      <>
        <RoutineDetailView
          key={route.routineId}
          routineId={route.routineId}
          settings={settings}
          onBack={closeRoutineDetails}
          onStartItem={handleStartRoutineItem}
        />
        {globalOverlays}
      </>
    );
  }

  const activeTab: AppTab = route.type === 'tab' ? route.tab : 'home';
  const activeDuaChapterId =
    route.type === 'tab' && route.tab === 'duas'
      ? route.duaChapterId ?? null
      : null;

  return (
    <div className="min-h-dvh paper-frame">
      {activeTab === 'home' && (
        <HomeView
          settings={settings}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={openSettings}
          onOpenSurah={handleOpenSurah}
          onOpenRoutineDetails={openRoutineDetails}
          onOpenStats={openStats}
          onOpenFastingSchedule={openRamadanSchedule}
          onGoToRoutines={() => {
            setOpenCreateRoutine(true);
            navigate({ type: 'tab', tab: 'routines' });
          }}
          onGoToSurahs={() => navigate({ type: 'tab', tab: 'surahs' })}
        />
      )}
      {activeTab === 'surahs' && (
        <SurahListView
          settings={settings}
          onOpenSurah={(id, initialAyah = 1) => handleOpenSurah(id, initialAyah)}
        />
      )}
      {activeTab === 'duas' && (
        <DuasView
          settings={settings}
          selectedChapterId={activeDuaChapterId}
          savedFilterNonce={savedDuasNonce}
          onSelectChapter={(chapterId) =>
            navigate(
              { type: 'tab', tab: 'duas', duaChapterId: chapterId },
              { restoreScroll: chapterId === null }
            )
          }
          onOpenDua={handleOpenDua}
          onToggleBookmark={handleToggleDuaBookmark}
        />
      )}
      {activeTab === 'routines' && (
        <RoutinesView
          settings={settings}
          onOpenRoutineDetails={openRoutineDetails}
          shouldOpenCreate={openCreateRoutine}
          onHandledCreate={() => setOpenCreateRoutine(false)}
        />
      )}
      {activeTab === 'profile' && (
        <ProfileView
          settings={settings}
          activeSection={profileSection}
          onChangeSection={setProfileSection}
          onUpdateSettings={handleUpdateSettings}
          onOpenSettings={openSettings}
          onOpenFastingSchedule={openRamadanSchedule}
        />
      )}

      {!hidesBottomNav(route) && (
        <BottomNav activeTab={activeTab} onChange={handleTabChange} />
      )}

      {globalOverlays}
    </div>
  );
}

export default App;
