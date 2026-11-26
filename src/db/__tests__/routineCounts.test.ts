import { describe, expect, it } from 'vitest';
import {
  applyAyahsDeltaToRecord,
  applyDhikirDeltaToRecord,
  applyDuaCountDelta,
  computeItemGrantOnComplete,
  computeItemReversalOnUncheck,
  getRoutineItemTargetDhikirCount,
  normalizeHistoryRecord,
  type NormalizedDuaRoutineItem,
  type NormalizedSurahRoutineItem,
  type RoutineProgress,
} from '../database';

function makeProgress(overrides: Partial<RoutineProgress> = {}): RoutineProgress {
  return {
    routineId: 'r-1',
    dayKey: '2026-11-26',
    lastReadSurah: 0,
    lastReadAyah: 0,
    completedAyahsCount: 0,
    totalAyahsCount: 1,
    percentage: 0,
    lastUpdated: 1000,
    ...overrides,
  };
}

describe('routine completion count granting & reversal', () => {
  it('grants full dhikir + dua count when checking a 33-count zikir without tapping', () => {
    const item: NormalizedDuaRoutineItem = {
      kind: 'dua',
      duaId: 'ch13-tasbih-subhanallah',
      targetCount: 33,
    };

    const { grant, hasAnyGrant } = computeItemGrantOnComplete({
      item,
      itemIndex: 0,
    });

    expect(hasAnyGrant).toBe(true);
    expect(grant).toEqual({ dhikir: 33, duas: 1 });

    let history = normalizeHistoryRecord('2026-11-26');
    history = applyDhikirDeltaToRecord(history, item.duaId, grant.dhikir!).record;
    history = applyDuaCountDelta(history, item.duaId, grant.duas!);

    expect(history.dhikirCount).toBe(33);
    expect(history.dhikirByDua?.[item.duaId]).toBe(33);
    expect(history.duaCounts?.[item.duaId]).toBe(1);
    expect(history.duasCompleted).toContain(item.duaId);
  });

  it('tops up only remaining dhikir when user tapped partially in reader, and uncheck preserves tapped counts', () => {
    const item: NormalizedDuaRoutineItem = {
      kind: 'dua',
      duaId: 'ch13-tasbih-subhanallah',
      targetCount: 33,
    };

    // User tapped 10 times in reader for routine item 2
    const progressAfterTaps = makeProgress({
      itemEarnedDhikir: { '2': 10 },
    });

    const { grant } = computeItemGrantOnComplete({
      item,
      itemIndex: 2,
      existingProgress: progressAfterTaps,
    });

    // Only remaining 23 dhikir + 1 dua should be granted
    expect(grant).toEqual({ dhikir: 23, duas: 1 });

    let history = normalizeHistoryRecord('2026-11-26', {
      date: '2026-11-26',
      ayahsCount: 0,
      routinesCompleted: [],
      dhikirCount: 10,
      dhikirByDua: { [item.duaId]: 10 },
    });
    history = applyDhikirDeltaToRecord(history, item.duaId, grant.dhikir!).record;
    history = applyDuaCountDelta(history, item.duaId, grant.duas!);

    expect(history.dhikirCount).toBe(33);
    expect(history.duaCounts?.[item.duaId]).toBe(1);

    // Now user unchecks item 2 -> only the 23 manual grant + 1 dua are reversed, keeping the 10 taps
    const progressAfterCheck = makeProgress({
      completedItemIndexes: [2],
      itemEarnedDhikir: { '2': 10 },
      manualGrantedByItem: { '2': grant },
    });
    const reversal = computeItemReversalOnUncheck({
      item,
      itemIndex: 2,
      wasCompleted: true,
      existingProgress: progressAfterCheck,
    });

    expect(reversal).toEqual({ dhikir: 23, duas: 1 });
    history = applyDhikirDeltaToRecord(history, item.duaId, -reversal.dhikir!).record;
    history = applyDuaCountDelta(history, item.duaId, -reversal.duas!);

    expect(history.dhikirCount).toBe(10);
    expect(history.dhikirByDua?.[item.duaId]).toBe(10);
    expect(history.duaCounts?.[item.duaId]).toBeUndefined();
  });

  it('grants zero extra counts when user already tapped all 33 times and completed round in reader', () => {
    const item: NormalizedDuaRoutineItem = {
      kind: 'dua',
      duaId: 'ch13-tasbih-subhanallah',
      targetCount: 33,
    };

    const progress = makeProgress({
      itemEarnedDhikir: { '0': 33 },
      itemEarnedDuas: { '0': 1 },
    });

    const { grant, hasAnyGrant } = computeItemGrantOnComplete({
      item,
      itemIndex: 0,
      existingProgress: progress,
    });

    expect(hasAnyGrant).toBe(false);
    expect(grant).toEqual({});
  });

  it('tracks routines independently even when two routines share the same dua on the same day', () => {
    const item: NormalizedDuaRoutineItem = {
      kind: 'dua',
      duaId: 'ch13-tasbih-subhanallah',
      targetCount: 33,
    };

    // Fajr routine progress already earned 33; Zuhr routine progress is fresh (0 earned)
    const zuhrProgress = makeProgress({ routineId: 'zuhr' });
    const { grant } = computeItemGrantOnComplete({
      item,
      itemIndex: 5,
      existingProgress: zuhrProgress,
    });

    expect(grant).toEqual({ dhikir: 33, duas: 1 });
  });

  it('sums per-part target counts for multi-part duas (e.g., 3 x 100 = 300)', () => {
    const item: NormalizedDuaRoutineItem = {
      kind: 'dua',
      duaId: 'ch13-fajr-sunnah-fard-tasbih',
      targetCount: 100,
    };

    expect(getRoutineItemTargetDhikirCount(item)).toBe(300);

    const { grant } = computeItemGrantOnComplete({
      item,
      itemIndex: 0,
    });
    expect(grant).toEqual({ dhikir: 300, duas: 1 });
  });

  it('grants remaining surah ayahs on check and reverses only granted ayahs on uncheck', () => {
    const surahItem: NormalizedSurahRoutineItem = {
      kind: 'surah',
      surahId: 67,
      startAyah: 1,
      endAyah: 30,
    };

    const progressAfterPartialRead = makeProgress({
      itemEarnedAyahs: { '1': 12 },
    });

    const { grant, hasAnyGrant } = computeItemGrantOnComplete({
      item: surahItem,
      itemIndex: 1,
      existingProgress: progressAfterPartialRead,
    });

    expect(hasAnyGrant).toBe(true);
    expect(grant).toEqual({ ayahs: 18 });

    let history = normalizeHistoryRecord('2026-11-26', {
      date: '2026-11-26',
      ayahsCount: 12,
      routinesCompleted: [],
    });
    history = applyAyahsDeltaToRecord(history, grant.ayahs!);
    expect(history.ayahsCount).toBe(30);

    const reversal = computeItemReversalOnUncheck({
      item: surahItem,
      itemIndex: 1,
      wasCompleted: true,
      existingProgress: makeProgress({
        completedItemIndexes: [1],
        itemEarnedAyahs: { '1': 12 },
        manualGrantedByItem: { '1': grant },
      }),
    });

    expect(reversal).toEqual({ ayahs: 18 });
    history = applyAyahsDeltaToRecord(history, -reversal.ayahs!);
    expect(history.ayahsCount).toBe(12);
  });

  it('falls back safely when unchecking a legacy dua item with no manualGrantedByItem', () => {
    const item: NormalizedDuaRoutineItem = {
      kind: 'dua',
      duaId: 'ch13-tasbih-subhanallah',
      targetCount: 33,
    };

    const reversal = computeItemReversalOnUncheck({
      item,
      itemIndex: 0,
      wasCompleted: true,
      existingProgress: makeProgress({ completedItemIndexes: [0] }),
    });

    expect(reversal).toEqual({ duas: 1 });
  });
});
