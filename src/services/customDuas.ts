import { useSyncExternalStore } from 'react';
import {
  computeRoutineProgressMetrics,
  db,
  getCompletedItemIndexes,
  getRoutineItems,
  getTodayDateKey,
  isDuaRoutineItem,
  isRoutineProgressCurrent,
  normalizeHistoryRecord,
  type Routine,
  type RoutineItem,
} from '../db/database';
import {
  generateCustomDuaId,
  getCustomDuasSnapshot,
  isCustomDuaId,
  normalizeStoredCustomDua,
  setCustomDuasSnapshot,
  subscribeCustomDuasSnapshot,
  validateCustomDuaInput,
  type CustomDua,
  type CustomDuaInput,
  type CustomDuaSnapshot,
} from './customDuaSnapshot';

export {
  CUSTOM_DUA_CHAPTER_ID,
  CUSTOM_DUA_ID_PREFIX,
  getCustomDua,
  getRawCustomDua,
  isCustomDuaId,
  isValidCustomDuaId,
  resolveDuaById,
  searchCustomDuas,
  validateCustomDuaInput,
  type CustomDua,
  type CustomDuaInput,
} from './customDuaSnapshot';

export async function hydrateCustomDuasFromDb(): Promise<CustomDuaSnapshot> {
  const rows = await db.customDuas.orderBy('createdAt').toArray();
  const valid = rows
    .map((r) => normalizeStoredCustomDua(r))
    .filter((r): r is CustomDua => r !== null);
  return setCustomDuasSnapshot(valid);
}

export function useCustomDuas() {
  const snapshot = useSyncExternalStore(
    subscribeCustomDuasSnapshot,
    getCustomDuasSnapshot
  );
  return {
    version: snapshot.version,
    hydrated: snapshot.hydrated,
    customDuas: snapshot.rawList,
    customDuasRawMap: snapshot.rawMap,
    customDuaItems: snapshot.duas,
    customDuaMap: snapshot.duaMap,
    count: snapshot.duas.length,
  };
}

export async function createCustomDua(
  input: CustomDuaInput
): Promise<CustomDua> {
  const validated = validateCustomDuaInput(input);
  if (!validated.ok) {
    throw new Error(validated.error);
  }
  const now = Date.now();
  const doc: CustomDua = {
    id: generateCustomDuaId(),
    ...validated.cleaned,
    createdAt: now,
    updatedAt: now,
  };
  await db.customDuas.put(doc);
  await hydrateCustomDuasFromDb();
  return doc;
}

export async function updateCustomDua(
  id: string,
  input: CustomDuaInput
): Promise<CustomDua> {
  if (!isCustomDuaId(id)) {
    throw new Error('অবৈধ কাস্টম দুআ আইডি।');
  }
  const validated = validateCustomDuaInput(input);
  if (!validated.ok) {
    throw new Error(validated.error);
  }
  const existing = await db.customDuas.get(id);
  const now = Date.now();
  const updated: CustomDua = {
    id,
    ...validated.cleaned,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.customDuas.put(updated);
  await hydrateCustomDuasFromDb();
  return updated;
}

export async function deleteCustomDua(id: string): Promise<void> {
  if (!isCustomDuaId(id)) return;
  const now = Date.now();
  const todayKey = getTodayDateKey();

  await db.transaction(
    'rw',
    [db.customDuas, db.routines, db.routineProgress, db.readingHistory],
    async () => {
      await db.customDuas.delete(id);
      const allRoutines = await db.routines.toArray();
      for (const routine of allRoutines) {
        if (!routine.items?.some((it) => isDuaRoutineItem(it) && it.duaId === id)) {
          continue;
        }
        const oldItems = getRoutineItems(routine);
        const nextItems = routine.items.filter(
          (it) => !(isDuaRoutineItem(it) && it.duaId === id)
        );
        const nextSurahIds = nextItems
          .filter(
            (it): it is Exclude<RoutineItem, { kind: 'dua' }> =>
              !isDuaRoutineItem(it)
          )
          .map((it) => it.surahId);
        const nextRoutine: Routine = {
          ...routine,
          surahIds: nextSurahIds,
          items: nextItems,
          updatedAt: now,
        };
        await db.routines.put(nextRoutine);

        const existingProg = await db.routineProgress.get(routine.id);
        if (existingProg) {
          if (
            !isRoutineProgressCurrent(existingProg, todayKey) ||
            nextItems.length === 0
          ) {
            await db.routineProgress.delete(routine.id);
            if (nextItems.length === 0) {
              const todayHist = await db.readingHistory.get(todayKey);
              if (todayHist?.routinesCompleted?.includes(routine.id)) {
                const norm = normalizeHistoryRecord(todayKey, todayHist);
                await db.readingHistory.put({
                  ...norm,
                  routinesCompleted: norm.routinesCompleted.filter(
                    (rid) => rid !== routine.id
                  ),
                });
              }
            }
            continue;
          }

          const oldCompletedSet = new Set(
            getCompletedItemIndexes(routine, existingProg)
          );
          const remappedCompleted: number[] = [];
          let remappedLastIdx = -1;
          let newIdx = 0;

          for (let oldIdx = 0; oldIdx < oldItems.length; oldIdx++) {
            const oldIt = oldItems[oldIdx];
            if (oldIt.kind === 'dua' && oldIt.duaId === id) {
              continue;
            }
            if (oldCompletedSet.has(oldIdx)) {
              remappedCompleted.push(newIdx);
            }
            if (existingProg.lastReadItemIndex === oldIdx) {
              remappedLastIdx = newIdx;
            }
            newIdx += 1;
          }

          const newNormalized = getRoutineItems(nextRoutine);
          const partialSurah =
            remappedLastIdx !== -1 &&
            newNormalized[remappedLastIdx]?.kind === 'surah' &&
            !remappedCompleted.includes(remappedLastIdx) &&
            existingProg.lastReadAyah > 0
              ? {
                  itemIndex: remappedLastIdx,
                  ayahNumber: existingProg.lastReadAyah,
                }
              : undefined;

          if (remappedCompleted.length === 0 && partialSurah === undefined) {
            await db.routineProgress.delete(routine.id);
          } else {
            const { completedUnits, totalUnits, percentage } =
              computeRoutineProgressMetrics(
                nextRoutine,
                remappedCompleted,
                partialSurah
              );
            await db.routineProgress.put({
              routineId: routine.id,
              dayKey: existingProg.dayKey ?? todayKey,
              lastReadSurah:
                remappedLastIdx !== -1 ? existingProg.lastReadSurah : 0,
              lastReadAyah:
                remappedLastIdx !== -1 ? existingProg.lastReadAyah : 0,
              lastReadDuaId:
                remappedLastIdx !== -1 && existingProg.lastReadDuaId !== id
                  ? existingProg.lastReadDuaId
                  : undefined,
              lastReadItemIndex:
                remappedLastIdx !== -1 ? remappedLastIdx : undefined,
              lastItemCompleted:
                remappedLastIdx !== -1 &&
                remappedCompleted.includes(remappedLastIdx),
              completedItemIndexes: remappedCompleted,
              completedAyahsCount: completedUnits,
              totalAyahsCount: totalUnits,
              percentage,
              lastUpdated: now,
            });
          }
        }
      }
    }
  );
  await hydrateCustomDuasFromDb();
}
