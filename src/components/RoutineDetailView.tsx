import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { DUA_CHAPTER_MAP, DUA_MAP } from '../data/duas';
import { SURAH_MAP } from '../data/surahs';
import {
  computeRoutineTotalAyahs,
  db,
  getCompletedItemIndexes,
  getRoutineItems,
  getRoutineSummaryCounts,
  toggleRoutineItemCompleted,
  type Routine,
  type RoutineProgress,
} from '../db/database';
import {
  DAY_SHORT_BN,
  formatNormalizedRoutineItemLabel,
  formatRoutineSummaryBn,
  toBanglaDigits,
} from '../utils/formatters';
import { useToast } from './ToastProvider';

interface RoutineDetailViewProps {
  routineId: string;
  onBack: () => void;
  onStartItem: (
    routine: Routine,
    itemIndex: number,
    progress?: RoutineProgress
  ) => void;
}

export function RoutineDetailView({
  routineId,
  onBack,
  onStartItem,
}: RoutineDetailViewProps) {
  const toast = useToast();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const routine = useLiveQuery(
    async () => (await db.routines.get(routineId)) ?? null,
    [routineId]
  );
  const progress = useLiveQuery(
    () => db.routineProgress.get(routineId),
    [routineId]
  );

  if (routine === undefined) {
    return (
      <div className="min-h-dvh paper-frame flex items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          লোড হচ্ছে...
        </p>
      </div>
    );
  }

  if (routine === null) {
    return (
      <div className="min-h-dvh paper-frame flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium">রুটিনটি পাওয়া যায়নি</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-text)',
          }}
        >
          ফিরে যান
        </button>
      </div>
    );
  }

  const items = getRoutineItems(routine);
  const summary = getRoutineSummaryCounts(routine);
  const completedIndexes = getCompletedItemIndexes(routine, progress);
  const completedSet = new Set(completedIndexes);

  const totalUnits =
    progress?.totalAyahsCount ?? computeRoutineTotalAyahs(routine);
  const completedUnits = progress?.completedAyahsCount ?? 0;
  const percentage = progress?.percentage ?? 0;
  const isAllCompleted = percentage >= 100 || completedSet.size === items.length;

  const scheduleText =
    routine.assignedDays.length === 7
      ? 'প্রতিদিন'
      : routine.assignedDays.length === 0
        ? 'ম্যানুয়াল রুটিন'
        : routine.assignedDays.map((d) => DAY_SHORT_BN[d]).join(', ');

  const handleToggleItem = async (itemIndex: number, nextChecked: boolean) => {
    const updated = await toggleRoutineItemCompleted({
      routineId: routine.id,
      itemIndex,
      completed: nextChecked,
    });
    if (nextChecked && updated && updated.percentage >= 100) {
      toast.success(`মাশাআল্লাহ! “${routine.title}” সম্পন্ন হয়েছে`);
    } else if (nextChecked) {
      toast.success('পড়া হয়েছে হিসেবে চিহ্নিত করা হয়েছে');
    } else {
      toast.info('বাকি হিসেবে চিহ্নিত করা হয়েছে');
    }
  };

  return (
    <div className="min-h-dvh paper-frame pb-24">
      {/* Sticky Top App Bar */}
      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md safe-top"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-page) 92%, transparent)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl transition-colors cursor-pointer shrink-0"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm sm:text-base truncate">
              {routine.title}
            </h1>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {scheduleText} • {toBanglaDigits(items.length)}টি অংশ
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Progress Summary Card */}
        <section
          className="rounded-2xl border p-4 space-y-3"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                সামগ্রিক অগ্রগতি ({formatRoutineSummaryBn(summary)})
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {toBanglaDigits(completedSet.size)}/{toBanglaDigits(items.length)}টি অংশ সম্পন্ন •{' '}
                {toBanglaDigits(completedUnits)}/{toBanglaDigits(totalUnits)} ইউনিট
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              {isAllCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
              {toBanglaDigits(percentage)}%
            </span>
          </div>

          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${percentage}%`,
                backgroundColor: 'var(--accent)',
              }}
            />
          </div>
        </section>

        {/* Section Header */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold">রুটিনের তালিকা</h2>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            বামে টিক দিয়ে পড়া মার্ক করুন
          </span>
        </div>

        {/* Ordered Accordion List */}
        <div className="space-y-2.5">
          {items.map((item, idx) => {
            const isChecked = completedSet.has(idx);
            const isExpanded = expandedIndex === idx;
            const label = formatNormalizedRoutineItemLabel(item);

            const isSurah = item.kind === 'surah';
            const surahMeta = isSurah ? SURAH_MAP[item.surahId] : undefined;
            const dua = !isSurah ? DUA_MAP[item.duaId] : undefined;
            const duaChapter = dua ? DUA_CHAPTER_MAP[dua.chapterId] : undefined;

            const span = isSurah ? item.endAyah - item.startAyah + 1 : 0;
            const isPartialActive =
              !isChecked &&
              isSurah &&
              progress?.lastReadItemIndex === idx &&
              progress.lastReadAyah >= item.startAyah;

            return (
              <div
                key={`${isSurah ? `s-${item.surahId}` : `d-${item.duaId}`}-${idx}`}
                className="rounded-2xl border overflow-hidden transition-colors"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: isChecked
                    ? 'color-mix(in srgb, var(--accent) 30%, var(--border-subtle))'
                    : 'var(--border-subtle)',
                }}
              >
                {/* Accordion Row Header */}
                <div className="flex items-center gap-1 pr-3 py-1">
                  {/* Left 1-click Checkbox */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    aria-label={`${label} ${isChecked ? 'বাকি মার্ক করুন' : 'পড়া হয়েছে মার্ক করুন'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleItem(idx, !isChecked);
                    }}
                    className="w-11 h-11 shrink-0 flex items-center justify-center cursor-pointer"
                  >
                    <span
                      className="w-5 h-5 rounded-md border flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: isChecked
                          ? 'var(--accent)'
                          : 'var(--bg-page)',
                        borderColor: isChecked
                          ? 'var(--accent)'
                          : 'color-mix(in srgb, var(--text-muted) 55%, var(--border-subtle))',
                        color: 'var(--accent-text)',
                      }}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.75]" />}
                    </span>
                  </button>

                  {/* Accordion Toggle Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIndex((prev) => (prev === idx ? null : idx))
                    }
                    aria-expanded={isExpanded}
                    className="flex-1 min-w-0 flex items-center justify-between gap-2 py-2.5 text-left cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-xs font-medium shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {toBanglaDigits(idx + 1)}.
                        </span>
                        {!isSurah && (
                          <Sparkles
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: 'var(--accent)' }}
                          />
                        )}
                        <span
                          className={`text-sm font-semibold truncate ${
                            isChecked ? 'line-through opacity-70' : ''
                          }`}
                        >
                          {isSurah
                            ? `সূরা ${surahMeta?.nameBangla ?? item.surahId}`
                            : dua?.titleBangla ?? item.duaId}
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-2 flex-wrap text-[11px] mt-0.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {isSurah ? (
                          <span>
                            আয়াত {toBanglaDigits(item.startAyah)}–
                            {toBanglaDigits(item.endAyah)} ({toBanglaDigits(span)}টি)
                          </span>
                        ) : (
                          <span>
                            {duaChapter?.titleBangla ?? 'দুআ'} •{' '}
                            {toBanglaDigits(item.targetCount ?? dua?.repeatCount ?? 1)} বার
                          </span>
                        )}

                        {isPartialActive && progress && (
                          <span
                            className="px-1.5 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: 'var(--accent-soft)',
                              color: 'var(--accent)',
                            }}
                          >
                            চলমান: {toBanglaDigits(progress.lastReadAyah)} নং আয়াত
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSurah && surahMeta && (
                        <span
                          className="font-indopak text-base hidden xs:inline sm:inline"
                          dir="rtl"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {surahMeta.nameArabic}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        style={{ color: 'var(--text-muted)' }}
                      />
                    </div>
                  </button>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div
                    className="px-4 pb-4 pt-3 border-t space-y-3"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'color-mix(in srgb, var(--bg-surface) 45%, var(--bg-elevated))',
                    }}
                  >
                    {isSurah && surahMeta ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 text-xs">
                            <p style={{ color: 'var(--text-secondary)' }}>
                              অর্থ: <span className="font-medium">{surahMeta.meaningBangla}</span> •{' '}
                              {surahMeta.revelationPlace === 'makkah' ? 'মক্কী' : 'মাদানী'}
                            </p>
                            <p style={{ color: 'var(--text-muted)' }}>
                              নির্ধারিত অংশ: আয়াত {toBanglaDigits(item.startAyah)} থেকে{' '}
                              {toBanglaDigits(item.endAyah)} (সূরার মোট{' '}
                              {toBanglaDigits(surahMeta.versesCount)} আয়াতের মধ্যে{' '}
                              {toBanglaDigits(span)} আয়াত)
                            </p>
                          </div>
                          <span
                            className="font-indopak text-xl shrink-0"
                            dir="rtl"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {surahMeta.nameArabic}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onStartItem(routine, idx, progress)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'var(--accent-text)',
                            }}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            {isPartialActive ? 'পড়া চালিয়ে যান' : 'রিডারে পড়ুন'}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : dua ? (
                      <>
                        {dua.occasionNote && (
                          <p
                            className="text-xs leading-relaxed"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {dua.occasionNote}
                          </p>
                        )}
                        <p
                          className="font-indopak text-lg leading-loose text-right py-2 px-3 rounded-xl border"
                          dir="rtl"
                          lang="ar"
                          style={{
                            backgroundColor: 'var(--bg-page)',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          {dua.arabic}
                        </p>
                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {dua.translationBangla}
                        </p>
                        {dua.reference && (
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            সূত্র: {dua.reference}
                          </p>
                        )}
                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => onStartItem(routine, idx, progress)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'var(--accent-text)',
                            }}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            দুআ রিডারে পড়ুন
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        এই অংশের বিস্তারিত পাওয়া যায়নি।
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
