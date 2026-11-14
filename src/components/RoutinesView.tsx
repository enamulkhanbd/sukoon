import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Edit3,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  DUA_CHAPTER_MAP,
  DUA_CHAPTERS,
  DUA_MAP,
  DUAS,
  RUQYAH_QURAN_ITEM_IDS,
} from '../data/duas';
import { SURAH_MAP, SURAHS } from '../data/surahs';
import {
  computeRoutineCompletedAyahs,
  computeRoutineCompletedUnitsForDua,
  computeRoutineTotalAyahs,
  db,
  getRoutineItems,
  getRoutineSummaryCounts,
  isDuaRoutineItem,
  type Routine,
  type RoutineItem,
  type RoutineProgress,
} from '../db/database';
import {
  DAY_SHORT_BN,
  formatNormalizedRoutineItemLabel,
  formatRoutineSummaryBn,
  toBanglaDigits,
} from '../utils/formatters';
import { useToast } from './ToastProvider';

interface DraftSurahItem {
  uid: string;
  kind: 'surah';
  surahId: number;
  startAyah: number;
  endAyah: number;
  startText: string;
  endText: string;
}

interface DraftDuaItem {
  uid: string;
  kind: 'dua';
  duaId: string;
  targetCount: number;
  countText: string;
}

type DraftRoutineItem = DraftSurahItem | DraftDuaItem;

const BANGLA_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

function parseAyahNumberInput(raw: string): number | null {
  const normalized = raw
    .trim()
    .replace(/[০-৯]/g, (ch) => BANGLA_DIGIT_MAP[ch] ?? ch);
  if (!/^\d+$/.test(normalized)) return null;
  return parseInt(normalized, 10);
}

let draftUidCounter = 1;
function createDraftSurahItem(
  surahId: number,
  startAyah: number,
  endAyah: number
): DraftSurahItem {
  return {
    uid: `item-${draftUidCounter++}`,
    kind: 'surah',
    surahId,
    startAyah,
    endAyah,
    startText: String(startAyah),
    endText: String(endAyah),
  };
}

function createDraftDuaItem(duaId: string, targetCount: number): DraftDuaItem {
  return {
    uid: `item-${draftUidCounter++}`,
    kind: 'dua',
    duaId,
    targetCount,
    countText: String(targetCount),
  };
}

interface RoutinesViewProps {
  onOpenRoutine: (routine: Routine, progress?: RoutineProgress) => void;
}

export function RoutinesView({ onOpenRoutine }: RoutinesViewProps) {
  const toast = useToast();
  const routines = useLiveQuery(
    () => db.routines.orderBy('createdAt').toArray(),
    []
  );
  const progressList = useLiveQuery(() => db.routineProgress.toArray(), []);

  const progressMap = useMemo(
    () => new Map((progressList ?? []).map((p) => [p.routineId, p])),
    [progressList]
  );

  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal form state
  const [title, setTitle] = useState('');
  const [assignedDays, setAssignedDays] = useState<number[]>([]);
  const [items, setItems] = useState<DraftRoutineItem[]>([]);
  const [pickerTab, setPickerTab] = useState<'surah' | 'dua'>('surah');
  const [pickerQuery, setPickerQuery] = useState('');
  const [duaChapterFilter, setDuaChapterFilter] = useState<number | 'all'>('all');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingRoutine(null);
    setTitle('');
    setAssignedDays([]);
    setItems([]);
    setPickerTab('surah');
    setPickerQuery('');
    setDuaChapterFilter('all');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (routine: Routine) => {
    setEditingRoutine(routine);
    setTitle(routine.title);
    setAssignedDays([...routine.assignedDays]);
    setItems(
      getRoutineItems(routine).map((it) =>
        it.kind === 'dua'
          ? createDraftDuaItem(it.duaId, it.targetCount)
          : createDraftSurahItem(it.surahId, it.startAyah, it.endAyah)
      )
    );
    setPickerTab('surah');
    setPickerQuery('');
    setDuaChapterFilter('all');
    setFormError(null);
    setIsModalOpen(true);
  };

  const toggleDay = (dayIndex: number) => {
    setAssignedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  };

  const addSurahItem = (id: number) => {
    const meta = SURAH_MAP[id];
    if (!meta) return;
    setItems((prev) => [
      ...prev,
      createDraftSurahItem(id, 1, meta.versesCount),
    ]);
    toast.success(`${meta.nameBangla} তালিকায় যুক্ত হয়েছে`);
  };

  const toggleSurahInPicker = (id: number) => {
    const existingIndexes = items
      .map((it, idx) => (it.kind === 'surah' && it.surahId === id ? idx : -1))
      .filter((idx) => idx !== -1);

    if (existingIndexes.length === 0) {
      addSurahItem(id);
      return;
    }

    setItems((prev) =>
      prev.filter((it) => !(it.kind === 'surah' && it.surahId === id))
    );
    const name = SURAH_MAP[id]?.nameBangla ?? 'সূরা';
    toast.info(`${name} তালিকা থেকে সরানো হয়েছে`);
  };

  const addDuaItem = (duaId: string) => {
    const dua = DUA_MAP[duaId];
    if (!dua) return;
    setItems((prev) => [
      ...prev,
      createDraftDuaItem(duaId, Math.max(1, dua.repeatCount ?? 1)),
    ]);
    toast.success(`“${dua.titleBangla}” যুক্ত হয়েছে`);
  };

  const toggleDuaInPicker = (duaId: string) => {
    const exists = items.some((it) => it.kind === 'dua' && it.duaId === duaId);
    if (!exists) {
      addDuaItem(duaId);
      return;
    }
    setItems((prev) =>
      prev.filter((it) => !(it.kind === 'dua' && it.duaId === duaId))
    );
    const name = DUA_MAP[duaId]?.titleBangla ?? 'দুআ';
    toast.info(`“${name}” তালিকা থেকে সরানো হয়েছে`);
  };

  const handleAddAllRuqyah = () => {
    const existingDuaIds = new Set(
      items.filter((it): it is DraftDuaItem => it.kind === 'dua').map((i) => i.duaId)
    );
    const toAdd = RUQYAH_QURAN_ITEM_IDS.filter((id) => !existingDuaIds.has(id));
    if (toAdd.length === 0) {
      toast.info('সব রুকইয়া আয়াত ইতিমধ্যে তালিকায় রয়েছে');
      return;
    }
    setItems((prev) => [
      ...prev,
      ...toAdd.map((id) =>
        createDraftDuaItem(id, Math.max(1, DUA_MAP[id]?.repeatCount ?? 1))
      ),
    ]);
    toast.success(`${toBanglaDigits(toAdd.length)}টি রুকইয়া অংশ যুক্ত হয়েছে`);
  };

  const removeItem = (index: number) => {
    const removed = items[index];
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (removed) {
      const name =
        removed.kind === 'dua'
          ? DUA_MAP[removed.duaId]?.titleBangla ?? 'দুআ'
          : SURAH_MAP[removed.surahId]?.nameBangla ?? 'সূরা';
      toast.info(`${name} তালিকা থেকে সরানো হয়েছে`);
    }
  };

  const setItemFullSurah = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index || item.kind !== 'surah') return item;
        const max = SURAH_MAP[item.surahId]?.versesCount ?? 1;
        return {
          ...item,
          startAyah: 1,
          endAyah: max,
          startText: '1',
          endText: String(max),
        };
      })
    );
  };

  const handleRangeTextChange = (
    index: number,
    field: 'start' | 'end',
    rawValue: string
  ) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index || item.kind !== 'surah') return item;
        const parsed = parseAyahNumberInput(rawValue);
        if (field === 'start') {
          return {
            ...item,
            startText: rawValue,
            startAyah: parsed ?? item.startAyah,
          };
        }
        return {
          ...item,
          endText: rawValue,
          endAyah: parsed ?? item.endAyah,
        };
      })
    );
  };

  const normalizeItemRangeOnBlur = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index || item.kind !== 'surah') return item;
        const max = SURAH_MAP[item.surahId]?.versesCount ?? 1;
        const parsedStart = parseAyahNumberInput(item.startText);
        const parsedEnd = parseAyahNumberInput(item.endText);

        const nextStart = Math.min(
          Math.max(parsedStart ?? item.startAyah, 1),
          max
        );
        const nextEnd = Math.min(
          Math.max(parsedEnd ?? item.endAyah, nextStart),
          max
        );
        return {
          ...item,
          startAyah: nextStart,
          endAyah: nextEnd,
          startText: String(nextStart),
          endText: String(nextEnd),
        };
      })
    );
  };

  const handleDuaCountChange = (index: number, rawValue: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index || item.kind !== 'dua') return item;
        const parsed = parseAyahNumberInput(rawValue);
        return {
          ...item,
          countText: rawValue,
          targetCount: parsed ?? item.targetCount,
        };
      })
    );
  };

  const normalizeDuaCountOnBlur = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index || item.kind !== 'dua') return item;
        const parsed = parseAyahNumberInput(item.countText);
        const clamped = Math.min(Math.max(parsed ?? item.targetCount, 1), 1000);
        return {
          ...item,
          targetCount: clamped,
          countText: String(clamped),
        };
      })
    );
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      const msg = 'রুটিনের একটি নাম দিন।';
      setFormError(msg);
      toast.warning(msg);
      return;
    }
    if (items.length === 0) {
      const msg = 'অন্তত একটি সূরা বা দুআ নির্বাচন করুন।';
      setFormError(msg);
      toast.warning(msg);
      return;
    }

    const validatedItems: RoutineItem[] = [];

    for (const item of items) {
      if (item.kind === 'dua') {
        const dua = DUA_MAP[item.duaId];
        if (!dua) continue;
        const count = parseAyahNumberInput(item.countText);
        if (count === null || count < 1 || count > 1000) {
          const msg = `${dua.titleBangla}: সঠিক সংখ্যা দিন (১–১০০০)।`;
          setFormError(msg);
          toast.warning(msg);
          return;
        }
        validatedItems.push({
          kind: 'dua',
          duaId: item.duaId,
          targetCount: count,
        });
      } else {
        const meta = SURAH_MAP[item.surahId];
        if (!meta) continue;
        const start = parseAyahNumberInput(item.startText);
        const end = parseAyahNumberInput(item.endText);

        if (
          start === null ||
          end === null ||
          start < 1 ||
          end > meta.versesCount ||
          start > end
        ) {
          const msg = `${meta.nameBangla}: সঠিক আয়াত সংখ্যা দিন (১–${toBanglaDigits(
            meta.versesCount
          )} এবং শুরু ≤ শেষ)।`;
          setFormError(msg);
          toast.warning(msg);
          return;
        }
        validatedItems.push({
          kind: 'surah',
          surahId: item.surahId,
          startAyah: start,
          endAyah: end,
        });
      }
    }

    const routine: Routine = {
      id: editingRoutine ? editingRoutine.id : `routine-${Date.now()}`,
      title: trimmed,
      assignedDays,
      surahIds: validatedItems
        .filter((i): i is Exclude<RoutineItem, { kind: 'dua' }> => !isDuaRoutineItem(i))
        .map((i) => i.surahId),
      items: validatedItems,
      createdAt: editingRoutine ? editingRoutine.createdAt : Date.now(),
    };

    await db.routines.put(routine);

    // Recalculate existing progress if routine items changed
    const existingProg = await db.routineProgress.get(routine.id);
    if (existingProg) {
      const total = computeRoutineTotalAyahs(routine);
      const normalized = getRoutineItems(routine);

      if (existingProg.lastReadDuaId) {
        const matchedDuaIdx = normalized.findIndex(
          (it) => it.kind === 'dua' && it.duaId === existingProg.lastReadDuaId
        );
        if (matchedDuaIdx === -1) {
          await db.routineProgress.delete(routine.id);
        } else {
          const completed = computeRoutineCompletedUnitsForDua(
            routine,
            existingProg.lastReadDuaId,
            matchedDuaIdx,
            Boolean(existingProg.lastItemCompleted)
          );
          await db.routineProgress.update(routine.id, {
            lastReadItemIndex: matchedDuaIdx,
            completedAyahsCount: completed,
            totalAyahsCount: total,
            percentage:
              total > 0
                ? Math.min(100, Math.round((completed / total) * 100))
                : 0,
          });
        }
      } else {
        const matchedIdx = normalized.findIndex(
          (it) =>
            it.kind === 'surah' &&
            it.surahId === existingProg.lastReadSurah &&
            existingProg.lastReadAyah >= it.startAyah &&
            existingProg.lastReadAyah <= it.endAyah
        );
        if (matchedIdx === -1) {
          await db.routineProgress.delete(routine.id);
        } else {
          const completed = computeRoutineCompletedAyahs(
            routine,
            existingProg.lastReadSurah,
            existingProg.lastReadAyah,
            matchedIdx
          );
          await db.routineProgress.update(routine.id, {
            lastReadItemIndex: matchedIdx,
            completedAyahsCount: completed,
            totalAyahsCount: total,
            percentage:
              total > 0
                ? Math.min(100, Math.round((completed / total) * 100))
                : 0,
          });
        }
      }
    }

    setIsModalOpen(false);
    toast.success(
      editingRoutine
        ? `“${trimmed}” রুটিন আপডেট ও সংরক্ষিত হয়েছে`
        : `“${trimmed}” নতুন রুটিন সংরক্ষিত হয়েছে`
    );
  };

  const handleDelete = async (routine: Routine) => {
    await db.transaction('rw', [db.routines, db.routineProgress], async () => {
      await db.routines.delete(routine.id);
      await db.routineProgress.delete(routine.id);
    });
    toast.warning(`“${routine.title}” রুটিন মুছে ফেলা হয়েছে`);
  };

  const handleResetProgress = async (routine: Routine) => {
    await db.routineProgress.delete(routine.id);
    toast.info(`“${routine.title}”-এর অগ্রগতি রিসেট করা হয়েছে`);
  };

  const filteredSurahs = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter(
      (s) =>
        String(s.id).includes(q) ||
        toBanglaDigits(s.id).includes(q) ||
        s.nameBangla.toLowerCase().includes(q) ||
        s.nameSimple.toLowerCase().includes(q) ||
        s.nameArabic.includes(pickerQuery.trim())
    );
  }, [pickerQuery]);

  const filteredDuas = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return DUAS.filter((d) => {
      if (duaChapterFilter !== 'all' && d.chapterId !== duaChapterFilter) {
        return false;
      }
      if (!q) return true;
      const ch = DUA_CHAPTER_MAP[d.chapterId];
      return (
        d.titleBangla.toLowerCase().includes(q) ||
        d.translationBangla.toLowerCase().includes(q) ||
        (ch?.titleBangla.toLowerCase().includes(q) ?? false) ||
        d.arabic.includes(pickerQuery.trim())
      );
    });
  }, [pickerQuery, duaChapterFilter]);

  const draftSummary = useMemo(
    () =>
      getRoutineSummaryCounts(
        items.map((it): RoutineItem =>
          it.kind === 'dua'
            ? { kind: 'dua', duaId: it.duaId, targetCount: it.targetCount }
            : {
                kind: 'surah',
                surahId: it.surahId,
                startAyah: it.startAyah,
                endAyah: it.endAyah,
              }
        )
      ),
    [items]
  );

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">তিলাওয়াত রুটিন</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            দৈনিক বা সাপ্তাহিক আমলের জন্য কাস্টম সূরা ও দুআর তালিকা তৈরি করুন
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-sm cursor-pointer shrink-0"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-text)',
          }}
        >
          <Plus className="w-4 h-4" />
          নতুন রুটিন
        </button>
      </header>

      {/* Routine List */}
      <div className="space-y-3">
        {(routines ?? []).length === 0 ? (
          <div
            className="rounded-2xl border p-8 text-center space-y-3"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <p className="text-sm font-medium">এখনো কোনো রুটিন তৈরি করা হয়নি</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              যেমন: জুমুআ রুটিন (সূরা কাহফ), বা দৈনিক রাতের আমল (সাজদাহ ও মুলক)।
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-text)',
              }}
            >
              <Plus className="w-4 h-4" />
              প্রথম রুটিন তৈরি করুন
            </button>
          </div>
        ) : (
          (routines ?? []).map((routine) => {
            const prog = progressMap.get(routine.id);
            const routineItems = getRoutineItems(routine);
            const summary = getRoutineSummaryCounts(routine);
            const total =
              prog?.totalAyahsCount ?? computeRoutineTotalAyahs(routine);
            const completed = prog?.completedAyahsCount ?? 0;
            const percentage = prog?.percentage ?? 0;

            return (
              <div
                key={routine.id}
                className="rounded-2xl border p-4 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-base truncate">{routine.title}</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {routine.assignedDays.length === 7
                        ? 'প্রতিদিন'
                        : routine.assignedDays.length === 0
                          ? 'ম্যানুয়াল রুটিন'
                          : routine.assignedDays.map((d) => DAY_SHORT_BN[d]).join(', ')}
                      {' • '}
                      মোট {formatRoutineSummaryBn(summary)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {prog && prog.completedAyahsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleResetProgress(routine)}
                        title="অগ্রগতি রিসেট করুন"
                        className="p-2 rounded-lg transition-colors cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(routine)}
                      title="সম্পাদনা করুন"
                      className="p-2 rounded-lg transition-colors cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(routine)}
                      title="মুছে ফেলুন"
                      className="p-2 rounded-lg transition-colors cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Ordered Surah / Dua chips */}
                <div className="flex flex-wrap gap-1.5">
                  {routineItems.map((item, idx) => {
                    const label = formatNormalizedRoutineItemLabel(item);
                    if (!label) return null;
                    return (
                      <span
                        key={`${item.kind === 'dua' ? item.duaId : item.surahId}-${idx}`}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border"
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

                {/* Progress + Read button */}
                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="flex-1 space-y-1">
                    <div
                      className="flex justify-between text-[11px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>অগ্রগতি</span>
                      <span>
                        {toBanglaDigits(completed)}/{toBanglaDigits(total)} (
                        {toBanglaDigits(percentage)}%)
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--bg-surface)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenRoutine(routine, prog)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent)',
                    }}
                  >
                    {prog && prog.percentage > 0 && prog.percentage < 100
                      ? 'চালিয়ে যান'
                      : 'শুরু করুন'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Routine Full-Screen Sheet */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col paper-frame"
          style={{ backgroundColor: 'var(--bg-page)' }}
        >
          <div
            className="border-b safe-top shrink-0"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="max-w-2xl mx-auto w-full flex items-center justify-between px-4 py-3.5">
              <h2 className="font-bold text-base">
                {editingRoutine ? 'রুটিন সম্পাদনা' : 'নতুন রুটিন তৈরি'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="বন্ধ করুন"
                className="p-1.5 rounded-full cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSave}
            noValidate
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-2xl mx-auto w-full min-h-full flex flex-col">
                <div className="p-4 sm:px-6 sm:pt-6 pb-3 space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">রুটিনের নাম</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: জুমুআ রুটিন, দৈনিক মাগরিব..."
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                />
              </div>

              {/* Days of week */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold">সাপ্তাহিক দিন</label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAssignedDays([0, 1, 2, 3, 4, 5, 6])}
                      className="underline cursor-pointer"
                      style={{ color: 'var(--accent)' }}
                    >
                      প্রতিদিন
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignedDays([5])}
                      className="underline cursor-pointer"
                      style={{ color: 'var(--accent)' }}
                    >
                      শুক্রবার
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignedDays([])}
                      className="underline cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ম্যানুয়াল
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_SHORT_BN.map((dayLabel, idx) => {
                    const active = assignedDays.includes(idx);
                    return (
                      <button
                        key={dayLabel}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className="py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
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
                        {dayLabel}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  কোনো দিন নির্বাচন না করলে এটি ম্যানুয়াল রুটিন হিসেবে থাকবে।
                </p>
              </div>

              {/* Selected Surahs & Duas */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold">
                    নির্বাচিত অংশ ({toBanglaDigits(items.length)}টি •{' '}
                    {formatRoutineSummaryBn(draftSummary)})
                  </label>
                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      if (item.kind === 'dua') {
                        const dua = DUA_MAP[item.duaId];
                        if (!dua) return null;
                        const ch = DUA_CHAPTER_MAP[dua.chapterId];
                        return (
                          <div
                            key={item.uid}
                            className="px-3 py-2.5 rounded-xl border text-xs space-y-2"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--border-subtle)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold truncate inline-flex items-center gap-1.5 min-w-0">
                                <Sparkles
                                  className="w-3.5 h-3.5 shrink-0"
                                  style={{ color: 'var(--accent)' }}
                                />
                                <span className="truncate">
                                  {toBanglaDigits(idx + 1)}. {dua.titleBangla}
                                </span>
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => moveItem(idx, -1)}
                                  disabled={idx === 0}
                                  className="p-1 rounded disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveItem(idx, 1)}
                                  disabled={idx === items.length - 1}
                                  className="p-1 rounded disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="p-1 rounded cursor-pointer"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span
                                className="text-[11px] truncate"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {ch?.titleBangla ?? 'দুআ ও জিকির'}
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span style={{ color: 'var(--text-muted)' }}>পড়ার সংখ্যা:</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={item.countText}
                                  onChange={(e) =>
                                    handleDuaCountChange(idx, e.target.value)
                                  }
                                  onBlur={() => normalizeDuaCountOnBlur(idx)}
                                  aria-label="পড়ার সংখ্যা"
                                  className="w-14 px-2 py-1 rounded-lg border text-center outline-none"
                                  style={{
                                    backgroundColor: 'var(--bg-elevated)',
                                    borderColor: 'var(--border-subtle)',
                                  }}
                                />
                                <span>বার</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const s = SURAH_MAP[item.surahId];
                      if (!s) return null;
                      const isFullSurah =
                        item.startAyah === 1 && item.endAyah === s.versesCount;
                      const span = Math.max(1, item.endAyah - item.startAyah + 1);
                      return (
                        <div
                          key={item.uid}
                          className="px-3 py-2.5 rounded-xl border text-xs space-y-2"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold truncate">
                              {toBanglaDigits(idx + 1)}. {s.nameBangla}{' '}
                              <span
                                className="font-normal"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                ({toBanglaDigits(span)} আয়াত)
                              </span>
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveItem(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItem(idx, 1)}
                                disabled={idx === items.length - 1}
                                className="p-1 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="p-1 rounded cursor-pointer"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Full Surah vs Specific Ayah Range Controls */}
                          <div className="flex items-center flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setItemFullSurah(idx)}
                              className="px-2 py-1 rounded-lg border text-[11px] font-medium cursor-pointer"
                              style={{
                                backgroundColor: isFullSurah
                                  ? 'var(--accent)'
                                  : 'var(--bg-elevated)',
                                borderColor: isFullSurah
                                  ? 'var(--accent)'
                                  : 'var(--border-subtle)',
                                color: isFullSurah
                                  ? 'var(--accent-text)'
                                  : 'var(--text-secondary)',
                              }}
                            >
                              সম্পূর্ণ সূরা
                            </button>

                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span style={{ color: 'var(--text-muted)' }}>আয়াত:</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={item.startText}
                                onChange={(e) =>
                                  handleRangeTextChange(idx, 'start', e.target.value)
                                }
                                onBlur={() => normalizeItemRangeOnBlur(idx)}
                                aria-label="শুরুর আয়াত"
                                className="w-14 px-2 py-1 rounded-lg border text-center outline-none"
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
                                  borderColor: 'var(--border-subtle)',
                                }}
                              />
                              <span>–</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={item.endText}
                                onChange={(e) =>
                                  handleRangeTextChange(idx, 'end', e.target.value)
                                }
                                onBlur={() => normalizeItemRangeOnBlur(idx)}
                                aria-label="শেষ আয়াত"
                                className="w-14 px-2 py-1 rounded-lg border text-center outline-none"
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
                                  borderColor: 'var(--border-subtle)',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Surah / Dua Segmented Picker Header */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold">
                    সূরা বা দুআ যুক্ত করুন
                  </label>
                  <div
                    className="inline-flex p-0.5 rounded-xl border text-[11px] font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPickerTab('surah')}
                      className="px-3 py-1 rounded-lg transition-colors cursor-pointer"
                      style={{
                        backgroundColor:
                          pickerTab === 'surah' ? 'var(--accent)' : 'transparent',
                        color:
                          pickerTab === 'surah'
                            ? 'var(--accent-text)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      সূরা ({toBanglaDigits(SURAHS.length)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerTab('dua')}
                      className="px-3 py-1 rounded-lg transition-colors cursor-pointer"
                      style={{
                        backgroundColor:
                          pickerTab === 'dua' ? 'var(--accent)' : 'transparent',
                        color:
                          pickerTab === 'dua'
                            ? 'var(--accent-text)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      দুআ ও জিকির ({toBanglaDigits(DUAS.length)})
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search
                    className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder={
                      pickerTab === 'surah'
                        ? 'সূরা খুঁজুন (যুক্ত করার পর উপরে আয়াত রেঞ্জ সেট করুন)...'
                        : 'দুআ বা অধ্যায় খুঁজুন (সাইয়েদুল ইস্তেগফার, ঘুম, রুকইয়া, দরুদ)...'
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  />
                </div>

                {pickerTab === 'dua' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setDuaChapterFilter('all')}
                        className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer"
                        style={{
                          backgroundColor:
                            duaChapterFilter === 'all'
                              ? 'var(--accent)'
                              : 'var(--bg-elevated)',
                          borderColor:
                            duaChapterFilter === 'all'
                              ? 'var(--accent)'
                              : 'var(--border-subtle)',
                          color:
                            duaChapterFilter === 'all'
                              ? 'var(--accent-text)'
                              : 'var(--text-secondary)',
                        }}
                      >
                        সব অধ্যায়
                      </button>
                      {DUA_CHAPTERS.map((ch) => {
                        const active = duaChapterFilter === ch.id;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => setDuaChapterFilter(ch.id)}
                            className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer"
                            style={{
                              backgroundColor: active
                                ? 'var(--accent)'
                                : 'var(--bg-elevated)',
                              borderColor: active
                                ? 'var(--accent)'
                                : 'var(--border-subtle)',
                              color: active
                                ? 'var(--accent-text)'
                                : 'var(--text-secondary)',
                            }}
                          >
                            অধ্যায় {toBanglaDigits(ch.id)}
                          </button>
                        );
                      })}
                    </div>

                    {duaChapterFilter === 10 && (
                      <button
                        type="button"
                        onClick={handleAddAllRuqyah}
                        className="w-full py-2 px-3 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        সব রুকইয়া আয়াত একসাথে যুক্ত করুন (২০টি)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

                {/* Edge-to-edge Surah / Dua Picker List flush to footer */}
                <div
                  className="flex-1 border-t sm:border-x divide-y"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  {pickerTab === 'surah' ? (
                    filteredSurahs.map((s) => {
                      const countInList = items.filter(
                        (it) => it.kind === 'surah' && it.surahId === s.id
                      ).length;
                      return (
                        <div
                          key={s.id}
                          className="w-full flex items-center justify-between px-4 sm:px-5 py-2.5 text-left text-xs transition-colors"
                          style={{
                            backgroundColor:
                              countInList > 0 ? 'var(--accent-soft)' : 'transparent',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSurahInPicker(s.id)}
                            className="flex-1 flex items-center justify-between gap-2 text-left cursor-pointer"
                          >
                            <span>
                              {toBanglaDigits(s.id)}. {s.nameBangla}{' '}
                              <span style={{ color: 'var(--text-muted)' }}>
                                ({toBanglaDigits(s.versesCount)})
                              </span>
                            </span>
                            <span className="font-indopak text-base mr-2">
                              {s.nameArabic}
                            </span>
                          </button>

                          {countInList > 0 ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => addSurahItem(s.id)}
                                title="একই সূরার আরেকটি আয়াত অংশ যোগ করুন"
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
                                  borderColor: 'var(--accent)',
                                  color: 'var(--accent)',
                                }}
                              >
                                <Plus className="w-3 h-3" />
                                অংশ
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleSurahInPicker(s.id)}
                                title="তালিকা থেকে সরান"
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--accent)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <Check className="w-3 h-3" />
                                {countInList > 1 ? toBanglaDigits(countInList) : ''}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addSurahItem(s.id)}
                              aria-label={`${s.nameBangla} যুক্ত করুন`}
                              className="p-1 cursor-pointer shrink-0"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : filteredDuas.length === 0 ? (
                    <div
                      className="px-4 py-8 text-center text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      কোনো দুআ পাওয়া যায়নি।
                    </div>
                  ) : (
                    filteredDuas.map((dua) => {
                      const countInList = items.filter(
                        (it) => it.kind === 'dua' && it.duaId === dua.id
                      ).length;
                      const ch = DUA_CHAPTER_MAP[dua.chapterId];
                      return (
                        <div
                          key={dua.id}
                          className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 text-left text-xs transition-colors"
                          style={{
                            backgroundColor:
                              countInList > 0 ? 'var(--accent-soft)' : 'transparent',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleDuaInPicker(dua.id)}
                            className="flex-1 min-w-0 text-left cursor-pointer space-y-0.5"
                          >
                            <div className="font-medium leading-snug">
                              {dua.titleBangla}
                            </div>
                            <div
                              className="text-[11px] truncate"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {ch?.titleBangla}
                              {dua.repeatCount && dua.repeatCount > 1
                                ? ` • ${toBanglaDigits(dua.repeatCount)} বার`
                                : ''}
                            </div>
                          </button>

                          {countInList > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleDuaInPicker(dua.id)}
                              title="তালিকা থেকে সরান"
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 cursor-pointer"
                              style={{
                                backgroundColor: 'var(--accent)',
                                color: 'var(--accent-text)',
                              }}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addDuaItem(dua.id)}
                              aria-label={`${dua.titleBangla} যুক্ত করুন`}
                              className="p-1 cursor-pointer shrink-0"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {formError && (
              <div
                className="border-t px-4 py-2 text-xs font-medium text-red-600 shrink-0"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                }}
              >
                <div className="max-w-2xl mx-auto w-full">{formError}</div>
              </div>
            )}

            {/* Sticky Footer */}
            <div
              className="border-t shrink-0 safe-bottom"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-page)',
              }}
            >
              <div className="max-w-2xl mx-auto w-full px-4 py-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-text)',
                  }}
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
