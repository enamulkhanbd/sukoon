import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Compass,
  Plus,
  Sparkles,
} from 'lucide-react';
import { DUA_MAP } from '../data/duas';
import { SURAH_MAP } from '../data/surahs';
import {
  computeRoutineTotalAyahs,
  db,
  getRoutineItems,
  getRoutineSummaryCounts,
  type Routine,
  type RoutineProgress,
} from '../db/database';
import { countCompleteCachedSurahs } from '../services/quranApi';
import {
  DAY_NAMES_BN,
  DAY_SHORT_BN,
  formatNormalizedRoutineItemLabel,
  formatRelativeTimeBn,
  formatRoutineSummaryBn,
  toBanglaDigits,
} from '../utils/formatters';
import { TabHeader } from './NavigationChrome';

interface HomeViewProps {
  onOpenSurah: (surahId: number, targetAyah?: number) => void;
  onOpenRoutineDetails: (routine: Routine) => void;
  onGoToRoutines: () => void;
  onGoToSurahs: () => void;
}

export function HomeView({
  onOpenSurah,
  onOpenRoutineDetails,
  onGoToRoutines,
  onGoToSurahs,
}: HomeViewProps) {
  const todayIndex = new Date().getDay();

  const lastRead = useLiveQuery(() => db.globalLastRead.get('current'), []);
  const routines = useLiveQuery(
    () => db.routines.orderBy('createdAt').toArray(),
    []
  );
  const progressList = useLiveQuery(() => db.routineProgress.toArray(), []);
  const cachedCount = useLiveQuery(() => countCompleteCachedSurahs(), []);

  const progressMap = new Map<string, RoutineProgress>(
    (progressList ?? []).map((p) => [p.routineId, p])
  );

  const todaysRoutines = (routines ?? []).filter((r) =>
    r.assignedDays.includes(todayIndex)
  );
  const otherRoutines = (routines ?? []).filter(
    (r) => !r.assignedDays.includes(todayIndex)
  );

  const todayFormatted = new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const renderRoutineCard = (routine: Routine, isToday: boolean) => {
    const prog = progressMap.get(routine.id);
    const items = getRoutineItems(routine);
    const summary = getRoutineSummaryCounts(routine);
    const totalAyahs =
      prog?.totalAyahsCount ?? computeRoutineTotalAyahs(routine);
    const completedAyahs = prog?.completedAyahsCount ?? 0;
    const percentage = prog?.percentage ?? 0;
    const isCompleted = percentage >= 100;

    return (
      <div
        key={routine.id}
        role="button"
        tabIndex={0}
        onClick={() => onOpenRoutineDetails(routine)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenRoutineDetails(routine);
          }
        }}
        className="rounded-2xl border p-4 transition-colors cursor-pointer"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: isToday ? 'color-mix(in srgb, var(--accent) 28%, var(--border-subtle))' : 'var(--border-subtle)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base tracking-tight truncate">
                {routine.title}
              </h3>
              {isCompleted && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  সম্পন্ন
                </span>
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {routine.assignedDays.length === 7
                ? 'প্রতিদিন'
                : routine.assignedDays.length === 0
                  ? 'ম্যানুয়াল রুটিন'
                  : routine.assignedDays.map((d) => DAY_SHORT_BN[d]).join(', ')}
              {' • '}
              {toBanglaDigits(items.length)}টি অংশ ({formatRoutineSummaryBn(summary)})
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenRoutineDetails(routine);
            }}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer"
            style={{
              backgroundColor: isToday ? 'var(--accent)' : 'var(--accent-soft)',
              color: isToday ? 'var(--accent-text)' : 'var(--accent)',
            }}
          >
            {prog && prog.percentage > 0 && prog.percentage < 100
              ? 'চালিয়ে যান'
              : 'পাঠ করুন'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Surah / Dua chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {items.map((item, idx) => {
            const label = formatNormalizedRoutineItemLabel(item);
            if (!label) return null;
            return (
              <span
                key={`${item.kind === 'dua' ? item.duaId : item.surahId}-${idx}`}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border"
                style={{
                  backgroundColor:
                    item.kind === 'dua'
                      ? 'var(--bg-surface)'
                      : 'var(--bg-page)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {item.kind === 'dua' && (
                  <Sparkles
                    className="w-3 h-3 shrink-0"
                    style={{ color: 'var(--accent)' }}
                  />
                )}
                {label}
              </span>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-3.5">
          <div
            className="flex items-center justify-between text-[11px] mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>
              {prog?.lastReadDuaId && DUA_MAP[prog.lastReadDuaId]
                ? `সর্বশেষ: ${DUA_MAP[prog.lastReadDuaId].titleBangla}`
                : prog?.lastReadSurah
                  ? `সর্বশেষ: ${SURAH_MAP[prog.lastReadSurah]?.nameBangla ?? ''} (${toBanglaDigits(
                      prog.lastReadAyah
                    )} নং আয়াত)`
                  : 'এখনো শুরু হয়নি'}
            </span>
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              {toBanglaDigits(completedAyahs)}/{toBanglaDigits(totalAyahs)} (
              {toBanglaDigits(percentage)}%)
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
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
        </div>
      </div>
    );
  };

  const lastReadMeta = lastRead ? SURAH_MAP[lastRead.surahId] : undefined;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-6">
      <TabHeader
        title="সুকূন"
        subtitle="প্রশান্ত, কোলাহলমুক্ত ইন্দো-পাক কুরআন তিলাওয়াত"
        badge={
          <div
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
            }}
          >
            <CalendarDays className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            <span>
              {DAY_NAMES_BN[todayIndex]} • {todayFormatted}
            </span>
          </div>
        }
      />

      {/* Smart Last-Read Hero Card */}
      <section
        className="rounded-3xl border p-5 relative overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {lastRead && lastReadMeta ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                <BookOpenCheck className="w-4 h-4" />
                <span>সর্বশেষ তিলাওয়াত</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  • {formatRelativeTimeBn(lastRead.timestamp)}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight truncate">
                {lastReadMeta.nameBangla}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                আয়াত {toBanglaDigits(lastRead.ayahNumber)} /{' '}
                {toBanglaDigits(lastReadMeta.versesCount)} • পৃষ্ঠা{' '}
                {toBanglaDigits(lastRead.pageNumber)}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onOpenSurah(lastRead.surahId, lastRead.ayahNumber)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-transform active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-text)',
                  }}
                >
                  তিলাওয়াত চালিয়ে যান
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-right shrink-0 hidden xs:block sm:block">
              <div
                className="font-surah-names text-5xl leading-none select-none"
                style={{ color: 'var(--gold)' }}
                aria-hidden="true"
              >
                {String(lastReadMeta.id).padStart(3, '0')}
              </div>
              <div className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                সূরা {toBanglaDigits(lastReadMeta.id)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                <Sparkles className="w-4 h-4" />
                <span>বিসমিল্লাহ দিয়ে শুরু করুন</span>
              </div>
              <h2 className="text-lg font-bold">প্রথম তিলাওয়াত শুরু করুন</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                আপনি যে আয়াতে থামবেন, সুকূন তা স্বয়ংক্রিয়ভাবে মনে রাখবে।
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenSurah(1, 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                }}
              >
                সূরা ফাতিহা
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onGoToSurahs}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <Compass className="w-3.5 h-3.5" />
                সব সূরা
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Today's Routines */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            আজকের রুটিন ({DAY_NAMES_BN[todayIndex]})
          </h2>
          <button
            type="button"
            onClick={onGoToRoutines}
            className="inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
            style={{ color: 'var(--accent)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            রুটিন পরিচালনা
          </button>
        </div>

        {todaysRoutines.length > 0 ? (
          <div className="space-y-3">
            {todaysRoutines.map((r) => renderRoutineCard(r, true))}
          </div>
        ) : (
          <div
            className="rounded-2xl border p-5 text-center space-y-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <p className="text-sm font-medium">আজকের জন্য নির্ধারিত কোনো রুটিন নেই</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              আপনার সুবিধামতো দৈনিক বা সাপ্তাহিক রুটিন তৈরি করে নিতে পারেন।
            </p>
          </div>
        )}
      </section>

      {/* Other / Manual Routines */}
      {otherRoutines.length > 0 && (
        <section className="space-y-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            অন্যান্য রুটিন
          </h2>
          <div className="space-y-3">
            {otherRoutines.map((r) => renderRoutineCard(r, false))}
          </div>
        </section>
      )}

      {/* Subtle Offline Status Hint */}
      {typeof cachedCount === 'number' && cachedCount < 114 && (
        <div
          className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            অফলাইনে সংরক্ষিত সূরা: <strong>{toBanglaDigits(cachedCount)} / ১১৪</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            সেটিংস থেকে সম্পূর্ণ কুরআন ডাউনলোড করুন
          </span>
        </div>
      )}
    </div>
  );
}
