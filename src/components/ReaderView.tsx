import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
  WifiOff,
  X,
} from 'lucide-react';
import { SURAH_MAP } from '../data/surahs';
import {
  getRoutineItems,
  updateReadingProgress,
  type CachedSurah,
  type Routine,
  type Settings,
  type ThemeMode,
} from '../db/database';
import { useWakeLock } from '../hooks/useWakeLock';
import { getSurahOfflineFirst } from '../services/quranApi';
import {
  AUTO_SCROLL_SPEEDS,
  formatRoutineItemLabel,
  toArabicDigits,
  toBanglaDigits,
} from '../utils/formatters';
import { useToast } from './ToastProvider';

interface ReaderViewProps {
  surahId: number;
  initialAyah?: number;
  routine?: Routine;
  routineItemIndex?: number;
  settings: Settings;
  onClose: () => void;
  onSelectSurah: (
    surahId: number,
    initialAyah?: number,
    routineItemIndex?: number
  ) => void;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const THEMES: Array<{ id: ThemeMode; label: string; swatch: string; ink: string }> = [
  { id: 'paper', label: 'কাগজ', swatch: '#FAF6EE', ink: '#1F241E' },
  { id: 'olive', label: 'জলপাই', swatch: '#EEF2EA', ink: '#1A241B' },
  { id: 'black', label: 'রাত', swatch: '#070807', ink: '#E8E2D5' },
];

export function ReaderView({
  surahId,
  initialAyah = 1,
  routine,
  routineItemIndex,
  settings,
  onClose,
  onSelectSurah,
  onUpdateSettings,
}: ReaderViewProps) {
  const meta = SURAH_MAP[surahId];
  const routineItems = useMemo(
    () => (routine ? getRoutineItems(routine) : []),
    [routine]
  );
  const activeRoutineItem = useMemo(() => {
    if (!routine || routineItems.length === 0) return null;
    if (
      routineItemIndex !== undefined &&
      routineItems[routineItemIndex]?.surahId === surahId
    ) {
      return routineItems[routineItemIndex];
    }
    return routineItems.find((it) => it.surahId === surahId) ?? null;
  }, [routine, routineItems, routineItemIndex, surahId]);
  const [surahData, setSurahData] = useState<CachedSurah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const [chromeVisible, setChromeVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeAyah, setActiveAyah] = useState(initialAyah);
  const [activePage, setActivePage] = useState(meta?.pages[0] ?? 1);
  const [activeJuz, setActiveJuz] = useState(1);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const [jumpAyahInput, setJumpAyahInput] = useState('');

  const { supported: wakeLockSupported, active: wakeLockActive } = useWakeLock(
    settings.keepScreenAwake
  );

  const visitedAyahsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<number | null>(null);
  const hasRestoredScrollRef = useRef(false);

  // Load Surah offline-first
  const loadSurah = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    hasRestoredScrollRef.current = false;
    try {
      const data = await getSurahOfflineFirst(surahId, signal);
      if (signal?.aborted) return;
      setSurahData(data);
      const targetVerse =
        data.verses.find((v) => v.verse_number === initialAyah) ?? data.verses[0];
      if (targetVerse) {
        setActiveAyah(targetVerse.verse_number);
        setActivePage(targetVerse.page_number);
        setActiveJuz(targetVerse.juz_number);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(
        err instanceof Error
          ? err.message
          : 'সূরা লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [surahId, initialAyah]);

  useEffect(() => {
    const controller = new AbortController();
    loadSurah(controller.signal);
    return () => controller.abort();
  }, [loadSurah]);

  const displayedVerses = useMemo(() => {
    if (!surahData) return [];
    if (!activeRoutineItem) return surahData.verses;
    return surahData.verses.filter(
      (v) =>
        v.verse_number >= activeRoutineItem.startAyah &&
        v.verse_number <= activeRoutineItem.endAyah
    );
  }, [surahData, activeRoutineItem]);

  // Restore scroll position to initialAyah once verses mount
  useEffect(() => {
    if (loading || !surahData || hasRestoredScrollRef.current) return;
    hasRestoredScrollRef.current = true;

    const startAnchor = activeRoutineItem?.startAyah ?? 1;
    if (initialAyah > startAnchor) {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-ayah="${initialAyah}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [loading, surahData, initialAyah, activeRoutineItem?.startAyah]);

  // Persist last read & increment today's newly visited ayahs
  const persistAyah = useCallback(
    (ayahNum: number, pageNum: number, explicit = false) => {
      const key = `${surahId}:${ayahNum}`;
      let increment = 0;
      if (!visitedAyahsRef.current.has(key)) {
        visitedAyahsRef.current.add(key);
        increment = 1;
      }

      updateReadingProgress({
        surahId,
        ayahNumber: ayahNum,
        pageNumber: pageNum,
        routineId: routine?.id,
        routineItemIndex,
        incrementTodayAyahs: increment,
      }).catch(() => {});

      if (explicit) {
        toast.success(
          `আয়াত ${toBanglaDigits(ayahNum)} সর্বশেষ পঠিত হিসেবে সংরক্ষিত`
        );
      }
    },
    [surahId, routine?.id, routineItemIndex, toast]
  );

  // Scroll tracking for Smart Last-Read Memory
  useEffect(() => {
    if (loading || displayedVerses.length === 0) return;

    const findCurrentReadingAyah = () => {
      const elements = document.querySelectorAll<HTMLElement>('[data-ayah]');
      if (elements.length === 0) return;

      // If near bottom of page, mark the final ayah
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 40;
      if (nearBottom) {
        const last = displayedVerses[displayedVerses.length - 1];
        if (last) {
          setActiveAyah(last.verse_number);
          setActivePage(last.page_number);
          setActiveJuz(last.juz_number);
          persistAyah(last.verse_number, last.page_number);
          return;
        }
      }

      const focusY = window.innerHeight * 0.32;
      let bestEl: HTMLElement | null = null;
      let bestDist = Infinity;

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        const dist = Math.abs(rect.top - focusY);
        if (dist < bestDist) {
          bestDist = dist;
          bestEl = el;
        }
      }

      if (bestEl) {
        const ayahNum = Number(bestEl.dataset.ayah);
        const pageNum = Number(bestEl.dataset.page);
        const juzNum = Number(bestEl.dataset.juz);
        if (!Number.isNaN(ayahNum)) {
          setActiveAyah(ayahNum);
          if (!Number.isNaN(pageNum)) setActivePage(pageNum);
          if (!Number.isNaN(juzNum)) setActiveJuz(juzNum);
          persistAyah(ayahNum, Number.isNaN(pageNum) ? activePage : pageNum);
        }
      }
    };

    const handleScroll = () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(findCurrentReadingAyah, 420);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [loading, displayedVerses, persistAyah, activePage]);

  // Auto-scroll loop
  useEffect(() => {
    const speedConfig = AUTO_SCROLL_SPEEDS.find(
      (s) => s.value === settings.autoScrollSpeed
    );
    if (!speedConfig || speedConfig.pxPerSec <= 0 || autoScrollPaused || settingsOpen || loading) {
      return;
    }

    let rafId = 0;
    let lastTime = performance.now();
    let fractionalScroll = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      fractionalScroll += speedConfig.pxPerSec * dt;
      if (fractionalScroll >= 1) {
        const step = Math.floor(fractionalScroll);
        fractionalScroll -= step;
        window.scrollBy(0, step);
      }
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (!atBottom) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    const pauseOnUserTouch = () => setAutoScrollPaused(true);
    window.addEventListener('touchstart', pauseOnUserTouch, { passive: true });
    window.addEventListener('wheel', pauseOnUserTouch, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('touchstart', pauseOnUserTouch);
      window.removeEventListener('wheel', pauseOnUserTouch);
    };
  }, [settings.autoScrollSpeed, autoScrollPaused, settingsOpen, loading]);

  // Routine navigation context
  const routineNav = useMemo(() => {
    if (!routine || routineItems.length === 0) return null;
    const idx =
      routineItemIndex !== undefined &&
      routineItems[routineItemIndex]?.surahId === surahId
        ? routineItemIndex
        : routineItems.findIndex((it) => it.surahId === surahId);
    if (idx === -1) return null;
    const nextItem =
      idx + 1 < routineItems.length ? routineItems[idx + 1] : null;
    return {
      index: idx,
      total: routineItems.length,
      nextItem,
      nextIndex: idx + 1,
      isLast: idx === routineItems.length - 1,
    };
  }, [routine, routineItems, routineItemIndex, surahId]);

  const handleJumpToAyah = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpAyahInput.trim(), 10);
    if (!surahData || Number.isNaN(num)) return;
    const minAyah = activeRoutineItem?.startAyah ?? 1;
    const maxAyah = activeRoutineItem?.endAyah ?? surahData.totalVerses;
    const clamped = Math.min(Math.max(num, minAyah), maxAyah);
    const el = document.querySelector(`[data-ayah="${clamped}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const verse = displayedVerses.find((v) => v.verse_number === clamped);
      if (verse) {
        setActiveAyah(verse.verse_number);
        setActivePage(verse.page_number);
        setActiveJuz(verse.juz_number);
        persistAyah(verse.verse_number, verse.page_number, true);
      }
    }
    setJumpAyahInput('');
    setSettingsOpen(false);
  };

  const handleFinishSurahAndNext = async (
    nextId: number,
    nextStartAyah = 1,
    nextItemIndex?: number
  ) => {
    if (displayedVerses.length > 0) {
      const last = displayedVerses[displayedVerses.length - 1];
      await updateReadingProgress({
        surahId,
        ayahNumber: last.verse_number,
        pageNumber: last.page_number,
        routineId: routine?.id,
        routineItemIndex,
      });
    }
    onSelectSurah(nextId, nextStartAyah, nextItemIndex);
  };

  const handleCompleteRoutine = async () => {
    if (displayedVerses.length > 0) {
      const last = displayedVerses[displayedVerses.length - 1];
      await updateReadingProgress({
        surahId,
        ayahNumber: last.verse_number,
        pageNumber: last.page_number,
        routineId: routine?.id,
        routineItemIndex,
      });
    }
    if (routine) {
      toast.success(`মাশাআল্লাহ! “${routine.title}” সম্পন্ন হয়েছে`);
    }
    onClose();
  };

  if (!meta) return null;

  return (
    <div className="min-h-dvh paper-frame relative">
      {/* Top Distraction-Free App Bar */}
      <header
        className={`fixed top-0 inset-x-0 z-30 border-b backdrop-blur-md transition-all duration-300 safe-top ${
          chromeVisible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-page) 92%, transparent)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
            style={{ color: 'var(--text-primary)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ফিরুন</span>
          </button>

          <div className="text-center min-w-0">
            <div className="text-sm font-bold truncate">
              {meta.nameBangla}
              {routine && routineNav && (
                <span
                  className="text-[11px] font-normal ml-1.5"
                  style={{ color: 'var(--accent)' }}
                >
                  ({toBanglaDigits(routineNav.index + 1)}/{toBanglaDigits(routineNav.total)})
                </span>
              )}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              আয়াত {toBanglaDigits(activeAyah)}/{toBanglaDigits(meta.versesCount)} • পৃষ্ঠা{' '}
              {toBanglaDigits(activePage)} • পারা {toBanglaDigits(activeJuz)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="পাঠ সেটিংস"
            className="p-2 rounded-xl border cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Recitation Canvas */}
      <main
        className="max-w-2xl mx-auto px-5 sm:px-8 pt-20 pb-28"
        onClick={(e) => {
          // Toggle distraction-free chrome on background/text tap (ignore interactive elements)
          const target = e.target as HTMLElement;
          if (target.closest('button, a, input, [data-ayah-marker]')) return;
          setChromeVisible((v) => !v);
        }}
      >
        {/* Ornamental Surah Banner */}
        <div
          className="rounded-3xl border px-5 py-5 mb-7 text-center space-y-2"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {routine && (
            <div
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              {routine.title}
            </div>
          )}
          <div
            className="font-indopak text-3xl sm:text-4xl leading-relaxed"
            style={{ color: 'var(--text-primary)' }}
          >
            سُوْرَةُ {meta.nameArabic}
          </div>
          <div className="text-sm font-semibold">
            {toBanglaDigits(meta.id)}. {meta.nameBangla} ({meta.meaningBangla})
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {meta.revelationPlace === 'makkah' ? 'মাক্কী' : 'মাদানী'} •{' '}
            {activeRoutineItem &&
            (activeRoutineItem.startAyah > 1 ||
              activeRoutineItem.endAyah < meta.versesCount)
              ? `আয়াত ${toBanglaDigits(activeRoutineItem.startAyah)}–${toBanglaDigits(
                  activeRoutineItem.endAyah
                )}`
              : `${toBanglaDigits(meta.versesCount)} আয়াত`}{' '}
            • পৃষ্ঠা {toBanglaDigits(meta.pages[0])}–{toBanglaDigits(meta.pages[1])}
          </div>
        </div>

        {/* Loading / Error / Verses */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2
              className="w-7 h-7 animate-spin"
              style={{ color: 'var(--accent)' }}
            />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              সূরা {meta.nameBangla} প্রস্তুত করা হচ্ছে...
            </p>
          </div>
        ) : error ? (
          <div
            className="rounded-2xl border p-6 text-center space-y-3 my-8"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <WifiOff className="w-7 h-7 mx-auto" style={{ color: 'var(--gold)' }} />
            <h2 className="font-semibold text-sm">অফলাইনে পাওয়া যায়নি</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => loadSurah()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-text)',
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              আবার চেষ্টা করুন
            </button>
          </div>
        ) : surahData ? (
          <>
            {/* Bismillah Header (all Surahs except Al-Fatihah #1 and At-Tawbah #9, and only when starting from Ayah 1) */}
            {meta.bismillahPre &&
              (!activeRoutineItem || activeRoutineItem.startAyah === 1) && (
              <div
                className="font-indopak text-center mb-6 select-text"
                style={{
                  fontSize: `${Math.min(settings.fontSize + 2, 44)}px`,
                  lineHeight: 2.4,
                  color: 'var(--text-primary)',
                }}
              >
                بِسۡمِ اللّٰهِ الرَّحۡمٰنِ الرَّحِيۡمِ
              </div>
            )}

            {/* Flowing Mushaf Indo-Pak Text */}
            <div
              className="font-indopak text-justify select-text"
              style={{
                fontSize: `${settings.fontSize}px`,
                lineHeight: 2.55,
                wordSpacing: '0.08em',
              }}
            >
              {displayedVerses.map((verse, idx) => {
                const prevVerse = idx > 0 ? displayedVerses[idx - 1] : null;
                const pageChanged =
                  prevVerse !== null && prevVerse.page_number !== verse.page_number;
                const isActive = activeAyah === verse.verse_number;

                return (
                  <span key={verse.id}>
                    {pageChanged && (
                      <span
                        className="block my-5 py-1.5 text-center border-y text-xs font-sans tracking-normal"
                        dir="ltr"
                        style={{
                          fontFamily: '"Noto Sans Bengali", sans-serif',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        পৃষ্ঠা {toBanglaDigits(verse.page_number)} • পারা{' '}
                        {toBanglaDigits(verse.juz_number)}
                      </span>
                    )}
                    <span
                      data-ayah={verse.verse_number}
                      data-page={verse.page_number}
                      data-juz={verse.juz_number}
                      className="rounded-md transition-colors duration-300 px-0.5"
                      style={{
                        backgroundColor: isActive
                          ? 'var(--ayah-highlight)'
                          : 'transparent',
                      }}
                    >
                      {verse.text_indopak}{' '}
                      <button
                        type="button"
                        data-ayah-marker
                        onClick={() =>
                          persistAyah(verse.verse_number, verse.page_number, true)
                        }
                        title={`আয়াত ${verse.verse_number} চিহ্নিত করুন`}
                        className="inline-flex items-center justify-center mx-1 align-middle cursor-pointer transition-transform active:scale-90"
                        style={{
                          color: isActive ? 'var(--accent)' : 'var(--gold)',
                          fontSize: '0.82em',
                        }}
                      >
                        ﴿{toArabicDigits(verse.verse_number)}﴾
                      </button>{' '}
                    </span>
                  </span>
                );
              })}
            </div>

            {/* End of Surah / Routine Progression Card */}
            <div
              className="mt-12 rounded-3xl border p-6 text-center space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div
                className="font-indopak text-2xl"
                style={{ color: 'var(--gold)' }}
              >
                صَدَقَ اللّٰهُ الْعَظِيْمُ
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {activeRoutineItem &&
                (activeRoutineItem.startAyah > 1 ||
                  activeRoutineItem.endAyah < meta.versesCount)
                  ? `সূরা ${meta.nameBangla} (আয়াত ${toBanglaDigits(
                      activeRoutineItem.startAyah
                    )}–${toBanglaDigits(activeRoutineItem.endAyah)}) সমাপ্ত হয়েছে`
                  : `সূরা ${meta.nameBangla} সমাপ্ত হয়েছে (${toBanglaDigits(
                      meta.versesCount
                    )} আয়াত)`}
              </p>

              {routineNav ? (
                routineNav.nextItem ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleFinishSurahAndNext(
                        routineNav.nextItem!.surahId,
                        routineNav.nextItem!.startAyah,
                        routineNav.nextIndex
                      )
                    }
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold shadow-sm cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    পরবর্তী অংশ:{' '}
                    {(() => {
                      const nextMeta = SURAH_MAP[routineNav.nextItem.surahId];
                      if (!nextMeta) return '';
                      return formatRoutineItemLabel({
                        surahId: nextMeta.id,
                        nameBangla: nextMeta.nameBangla,
                        versesCount: nextMeta.versesCount,
                        startAyah: routineNav.nextItem.startAyah,
                        endAyah: routineNav.nextItem.endAyah,
                      });
                    })()}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div
                      className="inline-flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: 'var(--accent)' }}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>মাশাআল্লাহ! “{routine?.title}” সম্পন্ন হয়েছে</span>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleCompleteRoutine}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        রুটিন সমাপ্ত করে ফিরুন
                      </button>
                    </div>
                  </div>
                )
              ) : (
                surahId < 114 && (
                  <button
                    type="button"
                    onClick={() => handleFinishSurahAndNext(surahId + 1)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    পরবর্তী সূরা: {SURAH_MAP[surahId + 1]?.nameBangla}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )
              )}
            </div>
          </>
        ) : null}
      </main>

      {/* Floating Auto-Scroll Controller Pill */}
      {settings.autoScrollSpeed > 0 &&
        !loading &&
        !error &&
        (chromeVisible || autoScrollPaused) && (
        <div className="fixed bottom-5 right-4 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoScrollPaused((p) => !p)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-md text-xs font-semibold cursor-pointer outline-none"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--accent)',
            }}
          >
            {autoScrollPaused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
            <span>
              অটো-স্ক্রল{' '}
              {
                AUTO_SCROLL_SPEEDS.find(
                  (s) => s.value === settings.autoScrollSpeed
                )?.label
              }
            </span>
          </button>
        </div>
      )}

      {/* Reader Quick-Settings Bottom Sheet */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-5 space-y-5 max-h-[88dvh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-page)',
              borderColor: 'var(--border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">পাঠ সেটিংস</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-full cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Theme Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold">পড়ার থিম</label>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => {
                  const active = settings.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onUpdateSettings({ theme: t.id })}
                      className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-2xl border text-xs font-medium cursor-pointer"
                      style={{
                        backgroundColor: t.swatch,
                        color: t.ink,
                        borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                        boxShadow: active ? '0 0 0 2px var(--accent)' : 'none',
                      }}
                    >
                      <span className="font-indopak text-lg leading-none">ق</span>
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Size Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">আরবি অক্ষরের আকার</span>
                <span style={{ color: 'var(--accent)' }}>
                  {toBanglaDigits(settings.fontSize)}px
                </span>
              </div>
              <input
                type="range"
                min={24}
                max={44}
                step={2}
                value={settings.fontSize}
                onChange={(e) =>
                  onUpdateSettings({ fontSize: Number(e.target.value) })
                }
                className="w-full accent-emerald-700 cursor-pointer"
              />
            </div>

            {/* Auto-Scroll Speed */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold">অটো-স্ক্রল গতি</label>
              <div className="grid grid-cols-5 gap-1.5">
                {AUTO_SCROLL_SPEEDS.map((sp) => {
                  const active = settings.autoScrollSpeed === sp.value;
                  return (
                    <button
                      key={sp.value}
                      type="button"
                      onClick={() => {
                        setAutoScrollPaused(false);
                        onUpdateSettings({ autoScrollSpeed: sp.value });
                      }}
                      className="py-2 rounded-xl text-xs font-medium border cursor-pointer"
                      style={{
                        backgroundColor: active
                          ? 'var(--accent)'
                          : 'var(--bg-elevated)',
                        borderColor: active
                          ? 'var(--accent)'
                          : 'var(--border-subtle)',
                        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                    >
                      {sp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Keep Screen Awake */}
            <div
              className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2.5">
                {settings.keepScreenAwake ? (
                  <Eye className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                ) : (
                  <EyeOff className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                )}
                <div>
                  <div className="text-xs font-semibold">স্ক্রিন চালু রাখুন</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {!wakeLockSupported
                      ? 'এই ব্রাউজারে ওয়েক-লক সমর্থিত নয়'
                      : wakeLockActive
                        ? 'সক্রিয় রয়েছে (স্ক্রিন বন্ধ হবে না)'
                        : 'তিলাওয়াতের সময় স্ক্রিন জাগ্রত রাখবে'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.keepScreenAwake}
                onClick={() =>
                  onUpdateSettings({ keepScreenAwake: !settings.keepScreenAwake })
                }
                className="w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0"
                style={{
                  backgroundColor: settings.keepScreenAwake
                    ? 'var(--accent)'
                    : 'var(--border-subtle)',
                }}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.keepScreenAwake ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Jump to Ayah */}
            {surahData && (
              <form onSubmit={handleJumpToAyah} className="space-y-2">
                <label className="block text-xs font-semibold">
                  নির্দিষ্ট আয়াতে যান ({toBanglaDigits(activeRoutineItem?.startAyah ?? 1)} –{' '}
                  {toBanglaDigits(activeRoutineItem?.endAyah ?? surahData.totalVerses)})
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={activeRoutineItem?.startAyah ?? 1}
                    max={activeRoutineItem?.endAyah ?? surahData.totalVerses}
                    value={jumpAyahInput}
                    onChange={(e) => setJumpAyahInput(e.target.value)}
                    placeholder={`আয়াত নম্বর (বর্তমান: ${activeAyah})`}
                    className="flex-1 px-3 py-2 rounded-xl border text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    যান
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
