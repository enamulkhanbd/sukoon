import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
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
  isRoutineProgressCurrent,
  toggleRoutineItemCompleted,
  type Routine,
  type RoutineProgress,
  type Settings,
} from '../db/database';
import { useIslamicClock } from '../hooks/useIslamicClock';
import {
  DAY_SHORT_BN,
  formatNormalizedRoutineItemLabel,
  formatRoutineSummaryBn,
  normalizeIndoPakText,
  toBanglaDigits,
} from '../utils/formatters';
import { TopBar } from './NavigationChrome';
import { useToast } from './ToastProvider';

interface RoutineDetailViewProps {
  routineId: string;
  settings: Settings;
  onBack: () => void;
  onStartItem: (
    routine: Routine,
    itemIndex: number,
    progress?: RoutineProgress
  ) => void;
}

export function RoutineDetailView({
  routineId,
  settings,
  onBack,
  onStartItem,
}: RoutineDetailViewProps) {
  const toast = useToast();
  const clock = useIslamicClock(settings);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const routine = useLiveQuery(
    async () => (await db.routines.get(routineId)) ?? null,
    [routineId]
  );
  const rawProgress = useLiveQuery(
    () => db.routineProgress.get(routineId),
    [routineId]
  );
  const progress = isRoutineProgressCurrent(
    rawProgress,
    clock.islamicDayKey,
    settings.fastingLocation,
    settings.fastingMethod
  )
    ? rawProgress
    : undefined;

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
      <TopBar
        mode="sticky"
        surface="tinted"
        onBack={onBack}
        backLabel="ফিরে যান"
        title={routine.title}
        subtitle={`${scheduleText} • ${toBanglaDigits(items.length)}টি অংশ`}
      />

      {/* Full-Bleed Tinted Top Progress Band */}
      <section
        className="w-full"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-2 pb-6 space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                সামগ্রিক অগ্রগতি ({formatRoutineSummaryBn(summary)})
              </p>
              <p
                className="text-xs mt-1 tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {toBanglaDigits(completedSet.size)}/{toBanglaDigits(items.length)}টি অংশ সম্পন্ন •{' '}
                {toBanglaDigits(completedUnits)}/{toBanglaDigits(totalUnits)} ইউনিট
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isAllCompleted && (
                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              )}
              <span
                className="text-2xl font-bold tabular-nums leading-none"
                style={{
                  color: percentage > 0 ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {toBanglaDigits(percentage)}%
              </span>
            </div>
          </div>

          <div
            className="h-[3px] rounded-full overflow-hidden"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--text-primary) 10%, transparent)',
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${percentage}%`,
                backgroundColor: 'var(--accent)',
              }}
            />
          </div>
        </div>
      </section>

      {/* Open Editorial Canvas Below (Zero Box Stack) */}
      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">রুটিনের তালিকা</h2>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            বামে টিক দিয়ে পড়া মার্ক করুন
          </span>
        </div>

        <div className="space-y-2">
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
                className="py-1"
              >
                {/* Plain Unboxed Row Header */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    aria-label={`${label} ${isChecked ? 'বাকি মার্ক করুন' : 'পড়া হয়েছে মার্ক করুন'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleItem(idx, !isChecked);
                    }}
                    className="w-9 h-10 -ml-2 shrink-0 flex items-center justify-center cursor-pointer"
                  >
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: isChecked
                          ? 'var(--accent)'
                          : 'var(--bg-surface)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.75]" />}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIndex((prev) => (prev === idx ? null : idx))
                    }
                    aria-expanded={isExpanded}
                    className="flex-1 min-w-0 flex items-center justify-between gap-2 py-2 text-left cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-xs font-medium tabular-nums shrink-0"
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
                            isChecked ? 'line-through opacity-55' : ''
                          }`}
                        >
                          {isSurah
                            ? `সূরা ${surahMeta?.nameBangla ?? item.surahId}`
                            : dua?.titleBangla ?? item.duaId}
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-2 flex-wrap text-[11px] mt-0.5 tabular-nums"
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
                            className="px-1.5 py-0.5 rounded-md font-medium"
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

                {/* Expanded Inline Detail */}
                {isExpanded && (
                  <div
                    className="mt-2 ml-8 rounded-2xl p-4 space-y-3"
                    style={{ backgroundColor: 'var(--bg-surface)' }}
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
                            className="font-surah-names text-[2rem] leading-none shrink-0 select-none"
                            style={{ color: 'var(--text-primary)' }}
                            aria-hidden="true"
                          >
                            {String(surahMeta.id).padStart(3, '0')}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onStartItem(routine, idx, progress)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-opacity active:opacity-85"
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
                          className="font-indopak text-lg leading-loose text-right py-1"
                          dir="rtl"
                          lang="ar"
                        >
                          {normalizeIndoPakText(dua.arabic)}
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
                        <div className="flex items-center justify-end pt-0.5">
                          <button
                            type="button"
                            onClick={() => onStartItem(routine, idx, progress)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-opacity active:opacity-85"
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
