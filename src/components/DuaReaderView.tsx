import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronUp,
  Copy,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { DuaItem } from '../data/duas';
import { useDuasCatalog } from '../services/contentCatalog';
import {
  deleteCustomDua,
  isCustomDuaId,
  useCustomDuas,
} from '../services/customDuas';
import {
  db,
  getRoutineItems,
  getTodayDateKey,
  recordDhikirDelta,
  recordDuaCompleted,
  updateDuaRoutineProgress,
  type Routine,
  type Settings,
} from '../db/database';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  formatNormalizedRoutineItemLabel,
  normalizeIndoPakText,
  toBanglaDigits,
} from '../utils/formatters';
import { CustomDuaFormSheet } from './CustomDuaFormSheet';
import {
  ReaderFreePager,
  ReaderQuickSettingsSheet,
  ReaderRoutinePager,
  TopBar,
  TopBarIconButton,
} from './NavigationChrome';
import { TasbihCounterSheet } from './TasbihCounterSheet';
import { useToast } from './ToastProvider';

type ActiveCounterTarget =
  | { mode: 'single' }
  | { mode: 'part'; partIndex: number };

interface DuaReaderViewProps {
  dua: DuaItem;
  settings: Settings;
  routine?: Routine;
  routineItemIndex?: number;
  routineTargetCount?: number;
  onClose: () => void;
  onDeletedCustomDua?: () => void;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void>;
  onSelectDuaInChapter?: (nextDua: DuaItem) => void;
  onAdvanceRoutineItem?: (nextIndex: number) => void;
  onOpenQuranRef?: (surahId: number, startAyah: number) => void;
}

export function DuaReaderView({
  dua,
  settings,
  routine,
  routineItemIndex,
  routineTargetCount,
  onClose,
  onDeletedCustomDua,
  onUpdateSettings,
  onSelectDuaInChapter,
  onAdvanceRoutineItem,
  onOpenQuranRef,
}: DuaReaderViewProps) {
  const toast = useToast();
  const isCustomDua = isCustomDuaId(dua.id);
  const { customDuaItems, customDuasRawMap } = useCustomDuas();
  const targetCount = Math.max(1, routineTargetCount ?? dua.repeatCount ?? 1);
  const [tapCount, setTapCount] = useState(0);
  const [partTapCounts, setPartTapCounts] = useState<Record<string, number>>({});
  const tapCountRef = useRef(0);
  const partTapCountsRef = useRef<Record<string, number>>({});
  const singleRoundLoggedRef = useRef(false);
  const duaCompletedInSessionRef = useRef(false);
  const multiPartRoundLoggedRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [counterSheetOpen, setCounterSheetOpen] = useState(false);
  const [editCustomOpen, setEditCustomOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingCustom, setDeletingCustom] = useState(false);
  const [activeCounter, setActiveCounter] = useState<ActiveCounterTarget>({
    mode: 'single',
  });
  const partRefs = useRef<Record<string, HTMLElement | null>>({});

  const todayHistory = useLiveQuery(
    () => db.readingHistory.get(getTodayDateKey()),
    [dua.id]
  );
  const standaloneReadCountToday =
    todayHistory?.duaCounts?.[dua.id] ??
    (todayHistory?.duasCompleted?.includes(dua.id) ? 1 : 0);
  const isStandaloneMarkedToday = standaloneReadCountToday > 0;

  const parts = dua.parts && dua.parts.length > 0 ? dua.parts : null;
  const hasAnyTransliteration = Boolean(
    dua.transliteration?.trim() || parts?.some((p) => p.transliteration?.trim())
  );

  const { supported: wakeLockSupported, active: wakeLockActive } = useWakeLock(
    settings.keepScreenAwake
  );

  const { chapterMap: DUA_CHAPTER_MAP, duasByChapter: DUAS_BY_CHAPTER } =
    useDuasCatalog();
  const chapter = isCustomDua ? undefined : DUA_CHAPTER_MAP[dua.chapterId];
  const chapterDuas = isCustomDua
    ? customDuaItems
    : (DUAS_BY_CHAPTER[dua.chapterId] ?? []);
  const chapterIdx = chapterDuas.findIndex((d) => d.id === dua.id);
  const prevChapterDua = chapterIdx > 0 ? chapterDuas[chapterIdx - 1] : null;
  const nextChapterDua =
    chapterIdx >= 0 && chapterIdx < chapterDuas.length - 1
      ? chapterDuas[chapterIdx + 1]
      : null;

  const routineItems = useMemo(
    () => (routine ? getRoutineItems(routine) : []),
    [routine]
  );

  const routineNav = useMemo(() => {
    if (!routine || routineItems.length === 0) return null;
    const idx =
      routineItemIndex !== undefined &&
        routineItems[routineItemIndex]?.kind === 'dua' &&
        routineItems[routineItemIndex].duaId === dua.id
        ? routineItemIndex
        : routineItems.findIndex((it) => it.kind === 'dua' && it.duaId === dua.id);
    if (idx === -1) return null;
    return {
      index: idx,
      total: routineItems.length,
      nextItem: idx + 1 < routineItems.length ? routineItems[idx + 1] : null,
      nextIndex: idx + 1,
    };
  }, [routine, routineItems, routineItemIndex, dua.id]);

  // Reset counter & mark routine item visited when Dua changes
  useEffect(() => {
    tapCountRef.current = 0;
    partTapCountsRef.current = {};
    singleRoundLoggedRef.current = false;
    duaCompletedInSessionRef.current = false;
    multiPartRoundLoggedRef.current = false;
    setTapCount(0);
    setPartTapCounts({});
    setCounterSheetOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (routine && routineNav) {
      updateDuaRoutineProgress({
        routineId: routine.id,
        routineItemIndex: routineNav.index,
        duaId: dua.id,
        completed: false,
      }).catch(() => { });
    }
  }, [dua.id, routine, routineNav]);

  const showTransliteration = settings.showDuaTransliteration ?? true;
  const bookmarkedIds = settings.bookmarkedDuaIds ?? [];
  const isBookmarked = bookmarkedIds.includes(dua.id);

  const handleToggleBookmark = async () => {
    const next = isBookmarked
      ? bookmarkedIds.filter((id) => id !== dua.id)
      : [...bookmarkedIds, dua.id];
    await onUpdateSettings({ bookmarkedDuaIds: next });
    toast.success(
      isBookmarked ? 'সংরক্ষিত দুআ থেকে সরানো হয়েছে' : 'দুআ সংরক্ষণ করা হয়েছে'
    );
  };

  const handleCopy = async () => {
    const bodyText = parts
      ? parts
        .map((part, idx) =>
          [
            `${toBanglaDigits(idx + 1)}. ${part.arabic}`,
            part.transliteration ?? '',
            part.translationBangla,
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n')
      : [dua.arabic.trim(), (dua.transliteration ?? '').trim(), dua.translationBangla.trim()]
          .filter(Boolean)
          .join('\n\n');

    const text = [
      dua.titleBangla,
      bodyText,
      dua.reference ? `সূত্র: ${dua.reference}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('দুআ কপি করা হয়েছে');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.warning('কপি করা যায়নি');
    }
  };

  const handleConfirmDeleteCustomDua = async () => {
    if (!isCustomDua || deletingCustom) return;
    setDeletingCustom(true);
    try {
      await deleteCustomDua(dua.id);
      setConfirmDeleteOpen(false);
      toast.warning('দুআটি মুছে ফেলা হয়েছে');
      if (onDeletedCustomDua) {
        onDeletedCustomDua();
      } else {
        onClose();
      }
    } catch {
      toast.error('দুআটি মুছে ফেলা যায়নি।');
    } finally {
      setDeletingCustom(false);
    }
  };

  const handleIncrementCounter = () => {
    const next = tapCountRef.current + 1;
    tapCountRef.current = next;
    setTapCount(next);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(next === targetCount ? [20, 40, 20] : 12);
    }
    void recordDhikirDelta({
      duaId: dua.id,
      delta: 1,
      routineId: routine?.id,
      routineItemIndex: routineNav?.index,
    });
    if (next === targetCount && !singleRoundLoggedRef.current) {
      singleRoundLoggedRef.current = true;
      duaCompletedInSessionRef.current = true;
      void recordDuaCompleted({
        duaId: dua.id,
        delta: 1,
        routineId: routine?.id,
        routineItemIndex: routineNav?.index,
      });
    }
  };

  const handleDecrementCounter = () => {
    if (tapCountRef.current <= 0) return;
    const next = tapCountRef.current - 1;
    tapCountRef.current = next;
    setTapCount(next);
    void recordDhikirDelta({
      duaId: dua.id,
      delta: -1,
      routineId: routine?.id,
      routineItemIndex: routineNav?.index,
    });
  };

  const handleResetCounter = () => {
    tapCountRef.current = 0;
    singleRoundLoggedRef.current = false;
    setTapCount(0);
    // Deliberately preserves today's earned Dhikir stats when starting a fresh round
  };

  const handleIncrementPartCounter = (partId: string, partTarget: number) => {
    const prevCount = partTapCountsRef.current[partId] ?? 0;
    const next = prevCount + 1;
    const nextMap = { ...partTapCountsRef.current, [partId]: next };
    partTapCountsRef.current = nextMap;
    setPartTapCounts(nextMap);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(next === partTarget ? [20, 40, 20] : 12);
    }
    void recordDhikirDelta({
      duaId: dua.id,
      delta: 1,
      routineId: routine?.id,
      routineItemIndex: routineNav?.index,
    });

    if (parts && next === partTarget && !multiPartRoundLoggedRef.current) {
      const allPartsDone = parts.every((p) => {
        const pTarget = Math.max(
          1,
          routineTargetCount ?? p.repeatCount ?? dua.repeatCount ?? 1
        );
        return (nextMap[p.id] ?? 0) >= pTarget;
      });
      if (allPartsDone) {
        multiPartRoundLoggedRef.current = true;
        duaCompletedInSessionRef.current = true;
        void recordDuaCompleted({
          duaId: dua.id,
          delta: 1,
          routineId: routine?.id,
          routineItemIndex: routineNav?.index,
        });
      }
    }
  };

  const handleDecrementPartCounter = (partId: string) => {
    const prevCount = partTapCountsRef.current[partId] ?? 0;
    if (prevCount <= 0) return;
    const nextMap = { ...partTapCountsRef.current, [partId]: prevCount - 1 };
    partTapCountsRef.current = nextMap;
    setPartTapCounts(nextMap);
    void recordDhikirDelta({
      duaId: dua.id,
      delta: -1,
      routineId: routine?.id,
      routineItemIndex: routineNav?.index,
    });
  };

  const handleResetPartCounter = (partId: string) => {
    const nextMap = { ...partTapCountsRef.current, [partId]: 0 };
    partTapCountsRef.current = nextMap;
    multiPartRoundLoggedRef.current = false;
    setPartTapCounts(nextMap);
    // Deliberately preserves today's earned Dhikir stats when starting a fresh round
  };

  const handleToggleStandaloneRead = async () => {
    if (isStandaloneMarkedToday) {
      await recordDuaCompleted({
        duaId: dua.id,
        delta: -standaloneReadCountToday,
      });
      toast.info('আজকের পড়া তালিকা থেকে সরানো হয়েছে');
    } else {
      await recordDuaCompleted({ duaId: dua.id, delta: 1 });
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(14);
      }
      toast.success('দুআ পড়া হয়েছে হিসেবে সংরক্ষিত হয়েছে');
    }
  };

  const openCounterSheet = (target: ActiveCounterTarget) => {
    setSettingsOpen(false);
    setActiveCounter(target);
    setCounterSheetOpen(true);

    if (target.mode === 'part' && parts) {
      const part = parts[target.partIndex];
      if (part) {
        requestAnimationFrame(() => {
          partRefs.current[part.id]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
      }
    }
  };

  const handleCompleteAndNext = async (nextIndex: number) => {
    if (routine && routineNav) {
      await updateDuaRoutineProgress({
        routineId: routine.id,
        routineItemIndex: routineNav.index,
        duaId: dua.id,
        completed: true,
        skipDuaHistoryLog: duaCompletedInSessionRef.current,
      });
    }
    onAdvanceRoutineItem?.(nextIndex);
  };

  const handleCompleteRoutine = async () => {
    if (routine && routineNav) {
      await updateDuaRoutineProgress({
        routineId: routine.id,
        routineItemIndex: routineNav.index,
        duaId: dua.id,
        completed: true,
        skipDuaHistoryLog: duaCompletedInSessionRef.current,
      });
      toast.success(`মাশাআল্লাহ! “${routine.title}” সম্পন্ন হয়েছে`);
    }
    onClose();
  };

  const arabicFontSize = Math.min(72, Math.max(16, settings.fontSize));
  const wakeLockSubtitle = !wakeLockSupported
    ? 'এই ব্রাউজারে ওয়েক-লক সমর্থিত নয়'
    : wakeLockActive
      ? 'সক্রিয় রয়েছে (স্ক্রিন বন্ধ হবে না)'
      : 'তিলাওয়াতের সময় স্ক্রিন জাগ্রত রাখবে';

  const renderTasbihCounter = (params: {
    count: number;
    target: number;
    nested?: boolean;
    isSheetActive: boolean;
    onOpenSheet: () => void;
  }) => {
    const {
      count,
      target,
      nested = false,
      isSheetActive,
      onOpenSheet,
    } = params;
    const done = count >= target;
    const buttonLabel = done
      ? 'সম্পন্ন'
      : count > 0
        ? 'চালিয়ে যান'
        : 'জিকির শুরু করুন';

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenSheet}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenSheet();
          }
        }}
        className="rounded-2xl px-4 py-3 transition-opacity active:opacity-85 cursor-pointer"
        style={{
          backgroundColor:
            done || isSheetActive
              ? 'var(--accent-soft)'
              : nested
                ? 'var(--bg-elevated)'
                : 'var(--bg-surface)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium">জিকির গণনা</div>
            <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {count > 0 ? (
                <>
                  সম্পন্ন: <strong>{toBanglaDigits(count)}</strong>/{toBanglaDigits(target)}
                </>
              ) : (
                `${toBanglaDigits(target)} বার গণনা করুন`
              )}
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium shrink-0"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            <span>{buttonLabel}</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    );
  };

  const renderTransliterationAndMeaning = (params: {
    transliteration?: string;
    meaning: string;
    meaningLabel: string;
    forceShowTranslit?: boolean;
  }) => {
    const {
      transliteration,
      meaning,
      meaningLabel,
      forceShowTranslit = false,
    } = params;
    const cleanTranslit = (transliteration ?? '').trim();
    const cleanMeaning = meaning.trim();
    const hasTranslit = Boolean(
      cleanTranslit && (showTransliteration || forceShowTranslit)
    );
    const hasMeaning = Boolean(cleanMeaning);
    if (!hasTranslit && !hasMeaning) return null;

    return (
      <>
        {hasTranslit && (
          <div className="space-y-1">
            <div
              className="text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              বাংলা উচ্চারণ
            </div>
            <p
              className="text-sm leading-relaxed whitespace-pre-line"
              style={{ color: 'var(--text-secondary)' }}
            >
              {cleanTranslit}
            </p>
          </div>
        )}

        {hasMeaning && (
          <div className="space-y-1">
            <div
              className="text-xs font-medium"
              style={{ color: 'var(--gold)' }}
            >
              {meaningLabel}
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {cleanMeaning}
            </p>
          </div>
        )}
      </>
    );
  };

  const renderReferenceFooter = () => (
    <>
      {dua.reference && (
        <span style={{ color: 'var(--text-muted)' }}>
          সূত্র: {dua.reference}
        </span>
      )}
      {dua.quranRef && onOpenQuranRef && !routine && (
        <button
          type="button"
          onClick={() =>
            onOpenQuranRef(dua.quranRef!.surahId, dua.quranRef!.startAyah)
          }
          className="inline-flex items-center gap-1 font-semibold cursor-pointer"
          style={{ color: 'var(--accent)' }}
        >
          <BookOpen className="w-3.5 h-3.5" />
          কুরআন রিডারে পড়ুন
        </button>
      )}
    </>
  );

  const routineNextAction = routineNav
    ? routineNav.nextItem
      ? {
        label: `পরবর্তী অংশ: ${formatNormalizedRoutineItemLabel(routineNav.nextItem)}`,
        action: () => {
          setCounterSheetOpen(false);
          void handleCompleteAndNext(routineNav.nextIndex);
        },
      }
      : {
        label: 'রুটিন সমাপ্ত করে ফিরুন',
        action: () => {
          setCounterSheetOpen(false);
          void handleCompleteRoutine();
        },
      }
    : null;

  const activePartIndex =
    parts && activeCounter.mode === 'part'
      ? Math.min(Math.max(0, activeCounter.partIndex), parts.length - 1)
      : null;
  const activePart =
    parts && activePartIndex !== null ? parts[activePartIndex] : null;
  const activePartTarget = activePart
    ? Math.max(
      1,
      routineTargetCount ?? activePart.repeatCount ?? dua.repeatCount ?? 1
    )
    : targetCount;

  const sheetTitle =
    parts && activePartIndex !== null
      ? `জিকির ${toBanglaDigits(activePartIndex + 1)}/${toBanglaDigits(parts.length)}`
      : 'জিকির গণনা';
  const sheetCount = activePart ? (partTapCounts[activePart.id] ?? 0) : tapCount;
  const sheetTarget = activePart ? activePartTarget : targetCount;

  const sheetNextAction =
    parts && activePartIndex !== null && activePartIndex + 1 < parts.length
      ? {
        label: `পরবর্তী জিকির (${toBanglaDigits(activePartIndex + 2)}/${toBanglaDigits(parts.length)})`,
        action: () =>
          openCounterSheet({ mode: 'part', partIndex: activePartIndex + 1 }),
      }
      : routineNextAction;

  return (
    <div
      className={`min-h-dvh paper-frame transition-[padding] duration-300 ${counterSheetOpen ? 'pb-[56dvh]' : 'pb-16'
        }`}
    >
      <TopBar
        mode="sticky"
        surface="tinted"
        onBack={onClose}
        backLabel="ফিরুন"
        title={dua.titleBangla}
        titleBadge={
          routine && routineNav ? (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              {toBanglaDigits(routineNav.index + 1)}/{toBanglaDigits(routineNav.total)}
            </span>
          ) : undefined
        }
        subtitle={
          routine && routineNav
            ? routine.title
            : isCustomDua
              ? 'আমার দুআ'
              : chapter?.titleBangla ?? 'দুআ ও জিকির'
        }
        rightActions={
          <>
            {isCustomDua ? (
              <>
                <TopBarIconButton
                  onClick={() => {
                    setCounterSheetOpen(false);
                    setEditCustomOpen(true);
                  }}
                  label="সম্পাদনা করুন"
                  active={editCustomOpen}
                >
                  <Pencil className="w-4 h-4" />
                </TopBarIconButton>
                <TopBarIconButton
                  onClick={() => {
                    setCounterSheetOpen(false);
                    setConfirmDeleteOpen(true);
                  }}
                  label="মুছে ফেলুন"
                  active={confirmDeleteOpen}
                >
                  <Trash2 className="w-4 h-4" />
                </TopBarIconButton>
              </>
            ) : (
              <TopBarIconButton
                onClick={handleToggleBookmark}
                label="সংরক্ষণ করুন"
                active={isBookmarked}
              >
                <Bookmark
                  className="w-4 h-4"
                  fill={isBookmarked ? 'currentColor' : 'none'}
                />
              </TopBarIconButton>
            )}
            <TopBarIconButton
              onClick={handleCopy}
              label="কপি করুন"
              active={copied}
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </TopBarIconButton>
            <TopBarIconButton
              onClick={() => {
                setCounterSheetOpen(false);
                setSettingsOpen(true);
              }}
              label="পাঠ সেটিংস"
              active={settingsOpen}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </TopBarIconButton>
          </>
        }
      />

      {/* Open Pure Book-Page Reading Canvas (Zero Box Stack) */}
      <main className="max-w-2xl mx-auto px-5 pt-5 space-y-7">
        {/* Editorial Context Row */}
        <div
          className="pb-3.5 border-b flex items-center justify-between gap-2 flex-wrap text-xs"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            {(dua.occasionNote
              ? dua.occasionNote.replace(/\s*\([০-৯0-9]+\s*বার\)\s*$/, '').trim()
              : '') ||
              (isCustomDua
                ? dua.reference || 'আমার ব্যক্তিগত দুআ'
                : chapter?.titleBangla || 'দুআ ও জিকির')}
          </span>
          <span
            className="text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            {parts
              ? `${toBanglaDigits(parts.length)}টি অংশ`
              : `${toBanglaDigits(targetCount)} বার`}
          </span>
        </div>
        {parts ? (
          <>
            <div className="space-y-10">
              {parts.map((part, idx) => {
                const partTarget = Math.max(
                  1,
                  routineTargetCount ?? part.repeatCount ?? dua.repeatCount ?? 1
                );
                const partTapCount = partTapCounts[part.id] ?? 0;
                const partDone = partTapCount >= partTarget;

                return (
                  <section
                    key={part.id}
                    ref={(el) => {
                      partRefs.current[part.id] = el;
                    }}
                    className="space-y-4 scroll-mt-16"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-medium leading-snug"
                        style={{ color: partDone ? 'var(--accent)' : 'var(--text-secondary)' }}
                      >
                        অংশ {toBanglaDigits(idx + 1)}
                        {part.labelBangla ? ` • ${part.labelBangla}` : ''}
                      </span>
                      <span
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--accent)',
                        }}
                      >
                        {toBanglaDigits(partTarget)} বার
                      </span>
                    </div>

                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-indopak text-right leading-[1.95] select-text whitespace-pre-line"
                      style={{
                        fontSize: `${arabicFontSize}px`,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {normalizeIndoPakText(part.arabic)}
                    </p>

                    <div className="space-y-3.5 pt-1">
                      {renderTransliterationAndMeaning({
                        transliteration: part.transliteration,
                        meaning: part.translationBangla,
                        meaningLabel: 'বাংলা অর্থ',
                      })}
                    </div>

                    {(partTarget > 1 || routine) &&
                      renderTasbihCounter({
                        count: partTapCount,
                        target: partTarget,
                        isSheetActive:
                          counterSheetOpen &&
                          activeCounter.mode === 'part' &&
                          activeCounter.partIndex === idx,
                        onOpenSheet: () =>
                          openCounterSheet({ mode: 'part', partIndex: idx }),
                      })}
                  </section>
                );
              })}
            </div>

            {!routine &&
              parts.every(
                (p) => (p.repeatCount ?? dua.repeatCount ?? 1) <= 1
              ) && (
                <div
                  className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition-colors"
                  style={{
                    backgroundColor: isStandaloneMarkedToday
                      ? 'var(--accent-soft)'
                      : 'var(--bg-surface)',
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium">
                      {isStandaloneMarkedToday ? 'আজ পড়া হয়েছে' : 'আজকের আমল'}
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {isStandaloneMarkedToday
                        ? 'আপনার দৈনিক পরিসংখ্যানে যুক্ত হয়েছে'
                        : 'দুআটি পড়া শেষ হলে চিহ্নিত করুন'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleStandaloneRead()}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-opacity active:opacity-85 cursor-pointer"
                    style={{
                      backgroundColor: isStandaloneMarkedToday
                        ? 'var(--bg-elevated)'
                        : 'var(--accent)',
                      color: isStandaloneMarkedToday
                        ? 'var(--accent)'
                        : 'var(--accent-text)',
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {isStandaloneMarkedToday ? 'চিহ্নিত' : 'পড়া হয়েছে'}
                    </span>
                  </button>
                </div>
              )}

            {(dua.reference || dua.quranRef) && (
              <section className="flex items-center justify-between gap-3 flex-wrap text-xs pt-2">
                {renderReferenceFooter()}
              </section>
            )}
          </>
        ) : (
          <>
            {/* Pure Unboxed Arabic Recitation Directly on Page (only if Arabic present) */}
            {dua.arabic.trim().length > 0 && (
              <section className="py-1">
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-indopak text-right leading-[1.95] select-text whitespace-pre-line"
                  style={{
                    fontSize: `${arabicFontSize}px`,
                    color: 'var(--text-primary)',
                  }}
                >
                  {normalizeIndoPakText(dua.arabic)}
                </p>
              </section>
            )}

            {/* Single Clean Interactive Action Strip (Tasbih or Mark-as-Read) */}
            {targetCount > 1 || routine ? (
              renderTasbihCounter({
                count: tapCount,
                target: targetCount,
                isSheetActive:
                  counterSheetOpen && activeCounter.mode === 'single',
                onOpenSheet: () => openCounterSheet({ mode: 'single' }),
              })
            ) : (
              <div
                className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap transition-colors"
                style={{
                  backgroundColor: isStandaloneMarkedToday
                    ? 'var(--accent-soft)'
                    : 'var(--bg-surface)',
                }}
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium">
                    {isStandaloneMarkedToday ? 'আজ পড়া হয়েছে' : 'আজকের আমল'}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {isStandaloneMarkedToday
                      ? 'আপনার দৈনিক পরিসংখ্যানে যুক্ত হয়েছে'
                      : 'দুআটি পড়া শেষ হলে চিহ্নিত করুন'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isCustomDua && (
                    <button
                      type="button"
                      onClick={() => openCounterSheet({ mode: 'single' })}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium border transition-opacity active:opacity-80 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span>
                        {tapCount > 0
                          ? `তাসবিহ (${toBanglaDigits(tapCount)})`
                          : 'তাসবিহ'}
                      </span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleToggleStandaloneRead()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-opacity active:opacity-85 cursor-pointer"
                    style={{
                      backgroundColor: isStandaloneMarkedToday
                        ? 'var(--bg-elevated)'
                        : 'var(--accent)',
                      color: isStandaloneMarkedToday
                        ? 'var(--accent)'
                        : 'var(--accent-text)',
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isStandaloneMarkedToday ? 'চিহ্নিত' : 'পড়া হয়েছে'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Open Bangla Transliteration, Meaning & Reference (rendered only when non-empty) */}
            {(Boolean(dua.transliteration?.trim()) ||
              Boolean(dua.translationBangla.trim()) ||
              Boolean(dua.reference) ||
              Boolean(dua.quranRef)) && (
              <section className="space-y-5">
                {renderTransliterationAndMeaning({
                  transliteration: dua.transliteration,
                  meaning: dua.translationBangla,
                  meaningLabel: isCustomDua
                    ? 'বাংলা অর্থ / মোনাজাত'
                    : 'বাংলা অর্থ ও ফজিলত',
                  forceShowTranslit:
                    isCustomDua &&
                    !dua.arabic.trim() &&
                    !dua.translationBangla.trim(),
                })}

                {(dua.reference || dua.quranRef) && (
                  <div className="flex items-center justify-between gap-3 flex-wrap text-xs pt-1">
                    {renderReferenceFooter()}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* Bottom Routine Progression or Chapter Navigation */}
        {routineNav ? (
          <div
            className="rounded-2xl p-6 text-center space-y-3"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            {routineNav.nextItem && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                এই অংশটি পড়া হয়ে গেলে পরবর্তী অংশে যান
              </p>
            )}
            <ReaderRoutinePager
              routineTitle={routine?.title}
              hasPrev={routineNav.index > 0 && Boolean(onAdvanceRoutineItem)}
              onPrev={() => onAdvanceRoutineItem?.(routineNav.index - 1)}
              nextLabel={
                routineNav.nextItem
                  ? formatNormalizedRoutineItemLabel(routineNav.nextItem)
                  : null
              }
              onNext={
                routineNav.nextItem
                  ? () => handleCompleteAndNext(routineNav.nextIndex)
                  : undefined
              }
              onComplete={handleCompleteRoutine}
            />
          </div>
        ) : (
          onSelectDuaInChapter && (
            <div className="pt-2">
              <ReaderFreePager
                prevLabel="পূর্ববর্তী দুআ"
                prevTitle={prevChapterDua?.titleBangla ?? null}
                onPrev={
                  prevChapterDua
                    ? () => onSelectDuaInChapter(prevChapterDua)
                    : undefined
                }
                nextLabel="পরবর্তী দুআ"
                nextTitle={nextChapterDua?.titleBangla ?? null}
                onNext={
                  nextChapterDua
                    ? () => onSelectDuaInChapter(nextChapterDua)
                    : undefined
                }
              />
            </div>
          )
        )}
      </main>

      <TasbihCounterSheet
        open={counterSheetOpen}
        onClose={() => setCounterSheetOpen(false)}
        title={sheetTitle}
        count={sheetCount}
        target={sheetTarget}
        onIncrement={() => {
          if (activePart) {
            handleIncrementPartCounter(activePart.id, activePartTarget);
          } else {
            handleIncrementCounter();
          }
        }}
        onDecrement={() => {
          if (activePart) {
            handleDecrementPartCounter(activePart.id);
          } else {
            handleDecrementCounter();
          }
        }}
        onReset={() => {
          if (activePart) {
            handleResetPartCounter(activePart.id);
          } else {
            handleResetCounter();
          }
        }}
        nextActionLabel={sheetNextAction?.label ?? null}
        onNextAction={sheetNextAction?.action}
      />

      <ReaderQuickSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        wakeLockSubtitle={wakeLockSubtitle}
      >
        {hasAnyTransliteration && (
          <div
            className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            <div>
              <div className="text-xs font-medium">বাংলা উচ্চারণ দেখান</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                আরবির নিচে বাংলা উচ্চারণ প্রদর্শন করবে
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showTransliteration}
              onClick={() =>
                onUpdateSettings({
                  showDuaTransliteration: !showTransliteration,
                })
              }
              className="w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0"
              style={{
                backgroundColor: showTransliteration
                  ? 'var(--accent)'
                  : 'color-mix(in srgb, var(--text-primary) 16%, transparent)',
              }}
            >
              <span
                className={`block w-5 h-5 rounded-full transition-transform ${showTransliteration ? 'translate-x-5' : 'translate-x-0'
                  }`}
                style={{
                  backgroundColor: showTransliteration
                    ? 'var(--accent-text)'
                    : 'var(--bg-elevated)',
                }}
              />
            </button>
          </div>
        )}
      </ReaderQuickSettingsSheet>

      {isCustomDua && (
        <CustomDuaFormSheet
          open={editCustomOpen}
          editingDua={customDuasRawMap[dua.id] ?? null}
          onClose={() => setEditCustomOpen(false)}
        />
      )}

      {isCustomDua && confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]"
          style={{ backgroundColor: 'var(--backdrop-scrim)' }}
          onClick={() => !deletingCustom && setConfirmDeleteOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-custom-dua-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl p-5 border space-y-4 shadow-xl"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="space-y-1.5">
              <h2
                id="delete-custom-dua-title"
                className="text-base font-semibold"
              >
                দুআটি মুছে ফেলবেন?
              </h2>
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                “{dua.titleBangla}” আপনার “আমার দুআ” তালিকা থেকে স্থায়ীভাবে মুছে যাবে।
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={deletingCustom}
                onClick={() => setConfirmDeleteOpen(false)}
                className="flex-1 py-2.5 rounded-2xl text-xs font-medium cursor-pointer transition-opacity active:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={deletingCustom}
                onClick={() => void handleConfirmDeleteCustomDua()}
                className="flex-1 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer transition-opacity active:opacity-85 disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--danger)',
                  color: '#ffffff',
                }}
              >
                {deletingCustom ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, মুছুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
