import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Edit3,
  Plus,
  RotateCcw,
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
  SALAH_COMMON_DUA_IDS,
  SALAH_FAJR_SPECIAL_IDS,
  SALAH_MAGHRIB_SPECIAL_IDS,
} from '../data/duas';
import { SURAH_MAP, SURAHS } from '../data/surahs';
import {
  computeRoutineProgressMetrics,
  computeRoutineTotalAyahs,
  db,
  getCompletedItemIndexes,
  getRoutineItems,
  getRoutineSummaryCounts,
  isDuaRoutineItem,
  isRoutineProgressCurrent,
  resetRoutineProgressForToday,
  type Routine,
  type RoutineItem,
  type RoutineProgress,
  type Settings,
} from '../db/database';
import { useIslamicClock } from '../hooks/useIslamicClock';
import {
  DAY_SHORT_BN,
  formatNormalizedRoutineItemLabel,
  formatRoutineSummaryBn,
  toBanglaDigits,
} from '../utils/formatters';
import {
  SoftSearchInput,
  TabHeader,
  UnderlineTabs,
  useBottomSheet,
} from './NavigationChrome';
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
  settings: Settings;
  onOpenRoutineDetails: (routine: Routine) => void;
  shouldOpenCreate?: boolean;
  onHandledCreate?: () => void;
}

export function RoutinesView({
  settings,
  onOpenRoutineDetails,
  shouldOpenCreate = false,
  onHandledCreate,
}: RoutinesViewProps) {
  const toast = useToast();
  const clock = useIslamicClock(settings);
  const routines = useLiveQuery(
    () => db.routines.orderBy('createdAt').toArray(),
    []
  );
  const progressList = useLiveQuery(() => db.routineProgress.toArray(), []);

  const progressMap = useMemo(() => {
    const map = new Map<string, RoutineProgress>();
    for (const p of progressList ?? []) {
      if (
        isRoutineProgressCurrent(
          p,
          clock.islamicDayKey,
          settings.fastingLocation,
          settings.fastingMethod
        )
      ) {
        map.set(p.routineId, p);
      }
    }
    return map;
  }, [
    progressList,
    clock.islamicDayKey,
    settings.fastingLocation,
    settings.fastingMethod,
  ]);

  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    mounted: sheetMounted,
    visible: sheetVisible,
    dragging: sheetDragging,
    panelRef: sheetPanelRef,
    backdropStyle: sheetBackdropStyle,
    panelTransform: sheetTransform,
    dragHandleProps: sheetDragProps,
  } = useBottomSheet(isModalOpen, () => setIsModalOpen(false));

  // Modal form state
  const [title, setTitle] = useState('');
  const [assignedDays, setAssignedDays] = useState<number[]>([]);
  const [items, setItems] = useState<DraftRoutineItem[]>([]);
  const [pickerTab, setPickerTab] = useState<'surah' | 'dua'>('surah');
  const [pickerQuery, setPickerQuery] = useState('');
  const [expandedDuaCategoryId, setExpandedDuaCategoryId] = useState<
    number | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingRoutine(null);
    setTitle('');
    setAssignedDays([]);
    setItems([]);
    setPickerTab('surah');
    setPickerQuery('');
    setExpandedDuaCategoryId(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (shouldOpenCreate) {
      openCreateModal();
      onHandledCreate?.();
    }
  }, [shouldOpenCreate, onHandledCreate]);

  useEffect(() => {
    if (!isModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

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
    setExpandedDuaCategoryId(null);
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

  const addBulkDuas = (
    ids: readonly string[],
    groupLabel: string,
    alreadyPresentMsg: string
  ) => {
    const existingDuaIds = new Set(
      items.filter((it): it is DraftDuaItem => it.kind === 'dua').map((i) => i.duaId)
    );
    const toAdd = ids.filter((id) => !existingDuaIds.has(id));
    if (toAdd.length === 0) {
      toast.info(alreadyPresentMsg);
      return;
    }
    setItems((prev) => [
      ...prev,
      ...toAdd.map((id) =>
        createDraftDuaItem(id, Math.max(1, DUA_MAP[id]?.repeatCount ?? 1))
      ),
    ]);
    toast.success(`${toBanglaDigits(toAdd.length)}টি ${groupLabel} যুক্ত হয়েছে`);
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
      const normalized = getRoutineItems(routine);
      const oldItems = editingRoutine ? getRoutineItems(editingRoutine) : [];
      const oldCompleted = editingRoutine
        ? getCompletedItemIndexes(editingRoutine, existingProg)
        : [];

      const remappedCompleted: number[] = [];
      const usedNew = new Set<number>();
      for (const oldIdx of oldCompleted) {
        const oldIt = oldItems[oldIdx];
        if (!oldIt) continue;
        const matchedNewIdx = normalized.findIndex((newIt, idx) => {
          if (usedNew.has(idx)) return false;
          if (oldIt.kind === 'dua' && newIt.kind === 'dua') {
            return oldIt.duaId === newIt.duaId;
          }
          if (oldIt.kind === 'surah' && newIt.kind === 'surah') {
            return (
              oldIt.surahId === newIt.surahId &&
              oldIt.startAyah === newIt.startAyah &&
              oldIt.endAyah === newIt.endAyah
            );
          }
          return false;
        });
        if (matchedNewIdx !== -1) {
          usedNew.add(matchedNewIdx);
          remappedCompleted.push(matchedNewIdx);
        }
      }
      remappedCompleted.sort((a, b) => a - b);

      let matchedLastIdx = -1;
      if (existingProg.lastReadDuaId) {
        matchedLastIdx = normalized.findIndex(
          (it) => it.kind === 'dua' && it.duaId === existingProg.lastReadDuaId
        );
      } else if (existingProg.lastReadSurah > 0) {
        matchedLastIdx = normalized.findIndex(
          (it) =>
            it.kind === 'surah' &&
            it.surahId === existingProg.lastReadSurah &&
            existingProg.lastReadAyah >= it.startAyah &&
            existingProg.lastReadAyah <= it.endAyah
        );
      }

      if (matchedLastIdx === -1 && remappedCompleted.length === 0) {
        await db.routineProgress.delete(routine.id);
      } else {
        const partialSurah =
          matchedLastIdx !== -1 &&
          normalized[matchedLastIdx]?.kind === 'surah' &&
          !remappedCompleted.includes(matchedLastIdx)
            ? { itemIndex: matchedLastIdx, ayahNumber: existingProg.lastReadAyah }
            : undefined;
        const { completedUnits, totalUnits, percentage } =
          computeRoutineProgressMetrics(routine, remappedCompleted, partialSurah);

        await db.routineProgress.update(routine.id, {
          lastReadItemIndex: matchedLastIdx !== -1 ? matchedLastIdx : undefined,
          lastReadSurah: matchedLastIdx !== -1 ? existingProg.lastReadSurah : 0,
          lastReadAyah: matchedLastIdx !== -1 ? existingProg.lastReadAyah : 0,
          lastReadDuaId: matchedLastIdx !== -1 ? existingProg.lastReadDuaId : undefined,
          lastItemCompleted:
            matchedLastIdx !== -1 && remappedCompleted.includes(matchedLastIdx),
          completedItemIndexes: remappedCompleted,
          completedAyahsCount: completedUnits,
          totalAyahsCount: totalUnits,
          percentage,
        });
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
    await resetRoutineProgressForToday(routine.id, clock.islamicDayKey);
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
    if (!q) return DUAS;
    return DUAS.filter((d) => {
      const ch = DUA_CHAPTER_MAP[d.chapterId];
      return (
        d.titleBangla.toLowerCase().includes(q) ||
        d.translationBangla.toLowerCase().includes(q) ||
        (ch?.titleBangla.toLowerCase().includes(q) ?? false) ||
        d.arabic.includes(pickerQuery.trim())
      );
    });
  }, [pickerQuery]);

  const groupedDuaCategories = useMemo(() => {
    const byChapter = new Map<number, typeof DUAS>();
    for (const dua of filteredDuas) {
      const list = byChapter.get(dua.chapterId);
      if (list) {
        list.push(dua);
      } else {
        byChapter.set(dua.chapterId, [dua]);
      }
    }
    return DUA_CHAPTERS.map((ch) => ({
      chapter: ch,
      duas: byChapter.get(ch.id) ?? [],
    })).filter((group) => group.duas.length > 0);
  }, [filteredDuas]);

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
    <div className="pb-28">
      {/* Full-Bleed Tinted Top Band */}
      <section
        className="w-full safe-top"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-6">
          <TabHeader
            title="তিলাওয়াত রুটিন"
            subtitle="দৈনিক বা সাপ্তাহিক আমলের জন্য কাস্টম সূরা ও দুআর তালিকা তৈরি করুন"
            rightAction={
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-opacity active:opacity-85 cursor-pointer shrink-0"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                }}
              >
                <Plus className="w-4 h-4" />
                নতুন রুটিন
              </button>
            }
          />
        </div>
      </section>

      {/* Open Editorial Canvas Below (Zero Boxes) */}
      <div className="max-w-2xl mx-auto px-5 pt-6">
        {(routines ?? []).length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">এখনো কোনো রুটিন তৈরি করা হয়নি</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                যেমন: জুমুআ রুটিন (সূরা কাহফ), বা দৈনিক রাতের আমল (সাজদাহ ও মুলক)।
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-85"
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
          <div>
            {(routines ?? []).map((routine) => {
              const prog = progressMap.get(routine.id);
              const routineItems = getRoutineItems(routine);
              const summary = getRoutineSummaryCounts(routine);
              const total =
                prog?.totalAyahsCount ?? computeRoutineTotalAyahs(routine);
              const completed = prog?.completedAyahsCount ?? 0;
              const percentage = prog?.percentage ?? 0;
              const itemLabels = routineItems
                .map((item) => formatNormalizedRoutineItemLabel(item))
                .filter(Boolean);

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
                  className="py-5 first:pt-0 last:pb-0 border-b last:border-b-0 space-y-2.5 transition-opacity active:opacity-75 cursor-pointer group"
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-base truncate">
                        {routine.title}
                      </h2>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {routine.assignedDays.length === 7
                          ? 'প্রতিদিন'
                          : routine.assignedDays.length === 0
                            ? 'ম্যানুয়াল রুটিন'
                            : routine.assignedDays.map((d) => DAY_SHORT_BN[d]).join(', ')}
                        {' • '}
                        মোট {formatRoutineSummaryBn(summary)}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 -mr-1.5">
                      {prog && prog.completedAyahsCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleResetProgress(routine);
                          }}
                          title="অগ্রগতি রিসেট করুন"
                          aria-label="অগ্রগতি রিসেট করুন"
                          className="p-2 rounded-full transition-opacity active:opacity-60 cursor-pointer"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(routine);
                        }}
                        title="সম্পাদনা করুন"
                        aria-label="সম্পাদনা করুন"
                        className="p-2 rounded-full transition-opacity active:opacity-60 cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(routine);
                        }}
                        title="মুছে ফেলুন"
                        aria-label="মুছে ফেলুন"
                        className="p-2 rounded-full transition-opacity active:opacity-60 cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Clean prose preview of routine items */}
                  {itemLabels.length > 0 && (
                    <p
                      className="text-xs leading-relaxed line-clamp-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {itemLabels.join(' • ')}
                    </p>
                  )}

                  {/* Slim Editorial Progress + Inline Action */}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <div className="flex-1 space-y-1.5">
                      <div
                        className="flex justify-between text-[11px] tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span>অগ্রগতি</span>
                        <span>
                          {toBanglaDigits(completed)}/{toBanglaDigits(total)} (
                          {toBanglaDigits(percentage)}%)
                        </span>
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRoutineDetails(routine);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium shrink-0 transition-opacity active:opacity-70 cursor-pointer"
                      style={{ color: 'var(--accent)' }}
                    >
                      {prog && prog.percentage > 0 && prog.percentage < 100
                        ? 'চালিয়ে যান'
                        : 'শুরু করুন'}
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Routine Bottom Sheet (-72px from top over dimmed overlay) */}
      {sheetMounted && (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-center bg-black/40 pt-[72px] sm:px-4 sukoon-sheet-backdrop ${
            sheetVisible ? '' : 'pointer-events-none'
          }`}
          style={sheetBackdropStyle}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            ref={sheetPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="routine-sheet-title"
            className={`w-full max-w-2xl h-full max-h-[calc(100dvh-72px)] rounded-t-[28px] shadow-2xl flex flex-col overflow-hidden sukoon-sheet-panel ${
              sheetDragging ? 'sukoon-sheet-panel--dragging' : ''
            }`}
            style={{
              backgroundColor: 'var(--bg-page)',
              transform: sheetTransform,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Grabber & Header */}
            <div
              {...sheetDragProps}
              className="px-5 pt-2.5 pb-3 shrink-0 select-none"
              style={{ touchAction: 'none' }}
            >
              <div
                className="w-9 h-1 rounded-full mx-auto mb-3 opacity-45"
                style={{ backgroundColor: 'var(--text-muted)' }}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id="routine-sheet-title"
                    className="font-semibold text-lg"
                  >
                    {editingRoutine ? 'রুটিন সম্পাদনা' : 'নতুন রুটিন তৈরি'}
                  </h2>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {editingRoutine
                      ? 'রুটিনের সূরা, দুআ ও সাপ্তাহিক সময়সূচি আপডেট করুন।'
                      : 'দৈনিক বা সাপ্তাহিক তিলাওয়াত ও দুআর তালিকা সাজান।'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="বন্ধ করুন"
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSave}
              noValidate
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="w-full min-h-full flex flex-col">
                  <div className="px-5 pt-2 pb-4 space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium">রুটিনের নাম</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: জুমুআ রুটিন, দৈনিক মাগরিব..."
                  className="w-full px-3.5 py-2.5 rounded-2xl text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Days of week */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">সাপ্তাহিক দিন</label>
                  <div className="flex gap-2.5 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setAssignedDays([0, 1, 2, 3, 4, 5, 6])}
                      className="cursor-pointer transition-opacity active:opacity-70"
                      style={{ color: 'var(--accent)' }}
                    >
                      প্রতিদিন
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignedDays([5])}
                      className="cursor-pointer transition-opacity active:opacity-70"
                      style={{ color: 'var(--accent)' }}
                    >
                      শুক্রবার
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignedDays([])}
                      className="cursor-pointer transition-opacity active:opacity-70"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ম্যানুয়াল
                    </button>
                  </div>
                </div>
                <div
                  className="grid grid-cols-7 gap-1 p-1 rounded-2xl"
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  {DAY_SHORT_BN.map((dayLabel, idx) => {
                    const active = assignedDays.includes(idx);
                    return (
                      <button
                        key={dayLabel}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className="py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                        style={{
                          backgroundColor: active
                            ? 'var(--accent)'
                            : 'transparent',
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
                  <label
                    className="block text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
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
                            className="rounded-2xl px-3.5 py-2.5 text-xs space-y-2"
                            style={{ backgroundColor: 'var(--bg-surface)' }}
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
                                  className="w-14 px-2 py-1 rounded-lg text-center outline-none tabular-nums"
                                  style={{ backgroundColor: 'var(--bg-elevated)' }}
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
                          className="rounded-2xl px-3.5 py-2.5 text-xs space-y-2"
                          style={{ backgroundColor: 'var(--bg-surface)' }}
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
                              className="px-2.5 py-1 rounded-xl text-[11px] font-medium cursor-pointer transition-colors"
                              style={{
                                backgroundColor: isFullSurah
                                  ? 'var(--accent)'
                                  : 'var(--bg-elevated)',
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
                                className="w-14 px-2 py-1 rounded-lg text-center outline-none tabular-nums"
                                style={{ backgroundColor: 'var(--bg-elevated)' }}
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
                                className="w-14 px-2 py-1 rounded-lg text-center outline-none tabular-nums"
                                style={{ backgroundColor: 'var(--bg-elevated)' }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Surah / Dua Tonal Picker Header */}
              <div className="space-y-3">
                <label
                  className="block text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  সূরা বা দুআ যুক্ত করুন
                </label>

                <UnderlineTabs
                  value={pickerTab}
                  onChange={setPickerTab}
                  ariaLabel="সূরা বা দুআ নির্বাচন"
                  tabs={[
                    { id: 'surah', label: 'সূরা', count: toBanglaDigits(SURAHS.length) },
                    { id: 'dua', label: 'দুআ ও জিকির', count: toBanglaDigits(DUAS.length) },
                  ]}
                />

                <SoftSearchInput
                  compact
                  value={pickerQuery}
                  onChange={setPickerQuery}
                  placeholder={
                    pickerTab === 'surah'
                      ? 'সূরা খুঁজুন (যুক্ত করার পর উপরে আয়াত রেঞ্জ সেট করুন)...'
                      : 'দুআ বা অধ্যায় খুঁজুন (সাইয়েদুল ইস্তেগফার, ঘুম, রুকইয়া, দরুদ)...'
                  }
                />
              </div>
            </div>

                {/* Borderless Tonal Picker List */}
                <div className="flex-1 px-5 pb-4 space-y-1.5">
                  {pickerTab === 'surah' ? (
                    filteredSurahs.map((s) => {
                      const countInList = items.filter(
                        (it) => it.kind === 'surah' && it.surahId === s.id
                      ).length;
                      return (
                        <div
                          key={s.id}
                          className="w-full rounded-2xl flex items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors"
                          style={{
                            backgroundColor:
                              countInList > 0 ? 'var(--accent-soft)' : 'var(--bg-surface)',
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
                            <span
                              className="font-surah-names text-2xl leading-none mr-2 select-none"
                              aria-hidden="true"
                            >
                              {String(s.id).padStart(3, '0')}
                            </span>
                          </button>

                          {countInList > 0 ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => addSurahItem(s.id)}
                                title="একই সূরার আরেকটি আয়াত অংশ যোগ করুন"
                                className="inline-flex items-center gap-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
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
                                className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full cursor-pointer"
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
                  ) : groupedDuaCategories.length === 0 ? (
                    <div
                      className="px-4 py-8 text-center text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      কোনো দুআ পাওয়া যায়নি।
                    </div>
                  ) : (
                    groupedDuaCategories.map(({ chapter, duas }) => {
                      const isSearching = pickerQuery.trim().length > 0;
                      const isExpanded =
                        isSearching || expandedDuaCategoryId === chapter.id;
                      const chapterDuaIds = new Set(duas.map((d) => d.id));
                      const selectedInChapter = items.filter(
                        (it) => it.kind === 'dua' && chapterDuaIds.has(it.duaId)
                      ).length;

                      return (
                        <div
                          key={chapter.id}
                          className="rounded-2xl overflow-hidden"
                          style={{ backgroundColor: 'var(--bg-surface)' }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDuaCategoryId((prev) =>
                                prev === chapter.id ? null : chapter.id
                              )
                            }
                            aria-expanded={isExpanded}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium leading-snug">
                                {chapter.titleBangla}
                              </div>
                              <div
                                className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <span>{toBanglaDigits(duas.length)}টি দুআ</span>
                                {selectedInChapter > 0 && (
                                  <span
                                    className="font-semibold"
                                    style={{ color: 'var(--accent)' }}
                                  >
                                    • {toBanglaDigits(selectedInChapter)}টি নির্বাচিত
                                  </span>
                                )}
                              </div>
                            </div>

                            <ChevronDown
                              className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                              style={{ color: 'var(--text-muted)' }}
                            />
                          </button>

                          {isExpanded && (
                            <div className="px-2.5 pb-2.5 space-y-1.5">
                              {chapter.id === 10 && !isSearching && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    addBulkDuas(
                                      RUQYAH_QURAN_ITEM_IDS,
                                      'রুকইয়া অংশ',
                                      'সব রুকইয়া আয়াত ইতিমধ্যে তালিকায় রয়েছে'
                                    )
                                  }
                                  className="w-full py-2 px-3 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                                  style={{
                                    backgroundColor: 'var(--accent-soft)',
                                    color: 'var(--accent)',
                                  }}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  সব রুকইয়া আয়াত একসাথে যুক্ত করুন (২০টি)
                                </button>
                              )}

                              {chapter.id === 13 && !isSearching && (
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addBulkDuas(
                                        SALAH_COMMON_DUA_IDS,
                                        'নামাজ পরবর্তী সাধারণ আমল',
                                        'সব সাধারণ আমল ইতিমধ্যে তালিকায় রয়েছে'
                                      )
                                    }
                                    className="flex-1 min-w-[140px] py-2 px-2.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                                    style={{
                                      backgroundColor: 'var(--accent-soft)',
                                      color: 'var(--accent)',
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5 shrink-0" />
                                    ৫ ওয়াক্ত সাধারণ (১০টি)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addBulkDuas(
                                        SALAH_FAJR_SPECIAL_IDS,
                                        'ফজরের বিশেষ আমল',
                                        'ফজরের বিশেষ আমলগুলো ইতিমধ্যে তালিকায় রয়েছে'
                                      )
                                    }
                                    className="py-2 px-2.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                                    style={{
                                      backgroundColor: 'var(--bg-elevated)',
                                      color: 'var(--accent)',
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5 shrink-0" />
                                    ফজর ({toBanglaDigits(SALAH_FAJR_SPECIAL_IDS.length)}টি)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addBulkDuas(
                                        SALAH_MAGHRIB_SPECIAL_IDS,
                                        'মাগরিবের বিশেষ আমল',
                                        'মাগরিবের বিশেষ আমলগুলো ইতিমধ্যে তালিকায় রয়েছে'
                                      )
                                    }
                                    className="py-2 px-2.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                                    style={{
                                      backgroundColor: 'var(--bg-elevated)',
                                      color: 'var(--accent)',
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5 shrink-0" />
                                    মাগরিব (২টি)
                                  </button>
                                </div>
                              )}

                              {duas.map((dua) => {
                                const countInList = items.filter(
                                  (it) => it.kind === 'dua' && it.duaId === dua.id
                                ).length;
                                return (
                                  <div
                                    key={dua.id}
                                    className="w-full rounded-xl flex items-center justify-between gap-3 px-3 py-2.5 text-left text-xs transition-colors"
                                    style={{
                                      backgroundColor:
                                        countInList > 0
                                          ? 'var(--accent-soft)'
                                          : 'var(--bg-elevated)',
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
                                      {dua.repeatCount && dua.repeatCount > 1 && (
                                        <div
                                          className="text-[11px]"
                                          style={{ color: 'var(--text-muted)' }}
                                        >
                                          {toBanglaDigits(dua.repeatCount)} বার
                                        </div>
                                      )}
                                    </button>

                                    {countInList > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleDuaInPicker(dua.id)}
                                        title="তালিকা থেকে সরান"
                                        className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0 cursor-pointer"
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
                              })}
                            </div>
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
                  className="mx-5 mb-2 px-3.5 py-2 rounded-xl text-xs font-medium text-red-600 shrink-0"
                  style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  }}
                >
                  {formError}
                </div>
              )}

              {/* Sticky Footer */}
              <div
                className="shrink-0 safe-bottom"
                style={{ backgroundColor: 'var(--bg-page)' }}
              >
                <div className="px-5 py-3 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 rounded-2xl text-xs font-medium transition-opacity active:opacity-80 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-2xl text-xs font-medium transition-opacity active:opacity-85 cursor-pointer"
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
        </div>
      )}
    </div>
  );
}
