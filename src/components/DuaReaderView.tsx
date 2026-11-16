import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Check,
  Copy,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DUA_CHAPTER_MAP,
  DUAS_BY_CHAPTER,
  type DuaItem,
} from '../data/duas';
import {
  getRoutineItems,
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
import {
  ReaderFreePager,
  ReaderQuickSettingsSheet,
  ReaderRoutinePager,
  TopBar,
  TopBarIconButton,
} from './NavigationChrome';
import { useToast } from './ToastProvider';

interface DuaReaderViewProps {
  dua: DuaItem;
  settings: Settings;
  routine?: Routine;
  routineItemIndex?: number;
  routineTargetCount?: number;
  onClose: () => void;
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
  onUpdateSettings,
  onSelectDuaInChapter,
  onAdvanceRoutineItem,
  onOpenQuranRef,
}: DuaReaderViewProps) {
  const toast = useToast();
  const targetCount = Math.max(1, routineTargetCount ?? dua.repeatCount ?? 1);
  const [tapCount, setTapCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { supported: wakeLockSupported, active: wakeLockActive } = useWakeLock(
    settings.keepScreenAwake
  );

  const chapter = DUA_CHAPTER_MAP[dua.chapterId];
  const chapterDuas = DUAS_BY_CHAPTER[dua.chapterId] ?? [];
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
    setTapCount(0);
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (routine && routineNav) {
      updateDuaRoutineProgress({
        routineId: routine.id,
        routineItemIndex: routineNav.index,
        duaId: dua.id,
        completed: false,
      }).catch(() => {});
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
    const text = [
      dua.titleBangla,
      dua.arabic,
      dua.translationBangla,
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

  const handleIncrementCounter = () => {
    setTapCount((prev) => {
      const next = prev + 1;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(next === targetCount ? [20, 40, 20] : 12);
      }
      return next;
    });
  };

  const handleCompleteAndNext = async (nextIndex: number) => {
    if (routine && routineNav) {
      await updateDuaRoutineProgress({
        routineId: routine.id,
        routineItemIndex: routineNav.index,
        duaId: dua.id,
        completed: true,
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
      });
      toast.success(`মাশাআল্লাহ! “${routine.title}” সম্পন্ন হয়েছে`);
    }
    onClose();
  };

  const arabicFontSize = Math.min(44, Math.max(24, settings.fontSize));
  const counterDone = tapCount >= targetCount;
  const wakeLockSubtitle = !wakeLockSupported
    ? 'এই ব্রাউজারে ওয়েক-লক সমর্থিত নয়'
    : wakeLockActive
      ? 'সক্রিয় রয়েছে (স্ক্রিন বন্ধ হবে না)'
      : 'তিলাওয়াতের সময় স্ক্রিন জাগ্রত রাখবে';

  return (
    <div className="min-h-dvh paper-frame pb-16">
      <TopBar
        mode="sticky"
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
            : chapter?.titleBangla ?? 'দুআ ও জিকির'
        }
        rightActions={
          <>
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
              onClick={() => setSettingsOpen(true)}
              label="পাঠ সেটিংস"
              active={settingsOpen}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </TopBarIconButton>
          </>
        }
      />

      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        {/* Occasion & Repeat Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {dua.occasionNote && (
            <span
              className="text-[11px] font-medium px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {dua.occasionNote}
            </span>
          )}
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            {toBanglaDigits(targetCount)} বার
          </span>
        </div>

        {/* Arabic Box */}
        <section
          className="rounded-3xl border p-5 sm:p-7"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <p
            dir="rtl"
            lang="ar"
            className="font-indopak text-right leading-[2.25] select-text whitespace-pre-line"
            style={{
              fontSize: `${arabicFontSize}px`,
              color: 'var(--text-primary)',
            }}
          >
            {normalizeIndoPakText(dua.arabic)}
          </p>
        </section>

        {/* Tasbih Counter (shown cleanly for every Dua; highlighted when targetCount > 1 or inside routine) */}
        {(targetCount > 1 || routine) && (
          <section
            className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-3"
            style={{
              backgroundColor: counterDone
                ? 'var(--accent-soft)'
                : 'var(--bg-elevated)',
              borderColor: counterDone ? 'var(--accent)' : 'var(--border-subtle)',
            }}
          >
            <div>
              <div className="text-xs font-semibold">জিকির গণনা</div>
              <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                লক্ষ্য: {toBanglaDigits(targetCount)} বার • সম্পন্ন:{' '}
                <strong>{toBanglaDigits(tapCount)}</strong> বার
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tapCount > 0 && (
                <button
                  type="button"
                  onClick={() => setTapCount(0)}
                  aria-label="গণনা রিসেট"
                  className="p-2 rounded-xl border cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-page)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleIncrementCounter}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                }}
              >
                {counterDone
                  ? `সম্পন্ন (${toBanglaDigits(tapCount)})`
                  : `+১ (${toBanglaDigits(tapCount)}/${toBanglaDigits(
                      targetCount
                    )})`}
              </button>
            </div>
          </section>
        )}

        {/* Bangla Transliteration & Meaning */}
        <section
          className="rounded-3xl border p-5 space-y-4"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {dua.transliteration && showTransliteration && (
            <div className="space-y-1">
              <div
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--accent)' }}
              >
                বাংলা উচ্চারণ
              </div>
              <p
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--text-secondary)' }}
              >
                {dua.transliteration}
              </p>
            </div>
          )}

          <div
            className={`space-y-1 ${
              dua.transliteration && showTransliteration ? 'pt-3 border-t' : ''
            }`}
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--gold)' }}
            >
              বাংলা অর্থ ও ফজিলত
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {dua.translationBangla}
            </p>
          </div>

          {(dua.reference || dua.quranRef) && (
            <div
              className="pt-3 border-t flex items-center justify-between gap-3 flex-wrap text-xs"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              {dua.reference && (
                <span style={{ color: 'var(--text-muted)' }}>
                  সূত্র: {dua.reference}
                </span>
              )}
              {dua.quranRef && onOpenQuranRef && !routine && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenQuranRef(
                      dua.quranRef!.surahId,
                      dua.quranRef!.startAyah
                    )
                  }
                  className="inline-flex items-center gap-1 font-semibold cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  কুরআন রিডারে পড়ুন
                </button>
              )}
            </div>
          )}
        </section>

        {/* Bottom Routine Progression or Chapter Navigation */}
        {routineNav ? (
          <div
            className="rounded-3xl border p-6 text-center space-y-3"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
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
          )
        )}
      </main>

      <ReaderQuickSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        wakeLockSubtitle={wakeLockSubtitle}
      >
        {dua.transliteration && (
          <div
            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div>
              <div className="text-xs font-semibold">বাংলা উচ্চারণ দেখান</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
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
                  : 'var(--border-subtle)',
              }}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  showTransliteration ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}
      </ReaderQuickSettingsSheet>
    </div>
  );
}
