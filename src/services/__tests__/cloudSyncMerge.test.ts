import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type ReadingHistory, type Routine } from '../../db/database';
import {
  determineSignInSyncDecision,
  hasMeaningfulLocalPersonalData,
  mergeCustomDuas,
  mergeGlobalLastRead,
  mergeReadingHistory,
  mergeRoutines,
  mergeSettings,
  mergeSingleHistoryRecord,
  stripUndefinedDeep,
} from '../cloudSyncMerge';
import type { CustomDua } from '../customDuaSnapshot';

describe('cloudSyncMerge — smart-merge, tombstones & multi-account safety', () => {
  it('determines sign-in action safely across first sign-in, same account, and account switch', () => {
    // 1. First sign-in on device -> always smart-merge
    expect(
      determineSignInSyncDecision({
        newUid: 'uid-alice',
        lastSyncedUid: null,
        lastSyncedEmail: null,
        hasLocalData: true,
      })
    ).toEqual({ action: 'merge' });

    // 2. Same user signing back in after sign-out -> smart-merge
    expect(
      determineSignInSyncDecision({
        newUid: 'uid-alice',
        lastSyncedUid: 'uid-alice',
        lastSyncedEmail: 'alice@gmail.com',
        hasLocalData: true,
      })
    ).toEqual({ action: 'merge' });

    // 3. Different Gmail on device that HAS previous user's local data -> prompt before merging!
    expect(
      determineSignInSyncDecision({
        newUid: 'uid-bob',
        lastSyncedUid: 'uid-alice',
        lastSyncedEmail: 'alice@gmail.com',
        hasLocalData: true,
      })
    ).toEqual({
      action: 'prompt-account-switch',
      previousUid: 'uid-alice',
      previousEmail: 'alice@gmail.com',
    });

    // 4. Different Gmail on clean/empty local state -> clean replace from cloud without nagging
    expect(
      determineSignInSyncDecision({
        newUid: 'uid-bob',
        lastSyncedUid: 'uid-alice',
        lastSyncedEmail: 'alice@gmail.com',
        hasLocalData: false,
      })
    ).toEqual({ action: 'replace-from-cloud' });
  });

  it('treats untouched DEFAULT_SETTINGS as empty local state, and modified/bookmarked state as meaningful', () => {
    expect(
      hasMeaningfulLocalPersonalData({
        customDuas: [],
        routines: [],
        readingHistory: [],
        globalLastRead: [],
        settings: { ...DEFAULT_SETTINGS },
      })
    ).toBe(false);

    expect(
      hasMeaningfulLocalPersonalData({
        customDuas: [],
        routines: [],
        readingHistory: [],
        globalLastRead: [],
        settings: { ...DEFAULT_SETTINGS, bookmarkedDuaIds: ['1-1'] },
      })
    ).toBe(true);
  });

  it('never overwrites existing Cloud settings/bookmarks with fresh install defaults', () => {
    const merged = mergeSettings({
      localSettings: { ...DEFAULT_SETTINGS }, // untouched fresh device (no userModifiedAt)
      cloudSettings: {
        theme: 'olive',
        colorMode: 'dark',
        fontSize: 40,
        bookmarkedDuaIds: ['1-1', '2-3'],
        userModifiedAt: 1700000000000,
      },
      localOfflineDownloaded: false,
    });

    expect(merged.theme).toBe('olive');
    expect(merged.colorMode).toBe('dark');
    expect(merged.fontSize).toBe(40);
    expect(merged.bookmarkedDuaIds).toEqual(['1-1', '2-3']);
  });

  it('unions bookmarks on initial merge, but respects local unbookmark when preferLocalLists is true', () => {
    const initialMerge = mergeSettings({
      localSettings: {
        ...DEFAULT_SETTINGS,
        theme: 'sky',
        bookmarkedDuaIds: ['3-2'],
        userModifiedAt: 2000,
      },
      cloudSettings: {
        theme: 'olive',
        bookmarkedDuaIds: ['1-1'],
        userModifiedAt: 1000,
      },
      localOfflineDownloaded: true,
    });

    expect(initialMerge.theme).toBe('sky');
    expect(initialMerge.bookmarkedDuaIds).toEqual(['1-1', '3-2']);
    expect(initialMerge.offlineDownloaded).toBe(true);

    // Active user unbookmarks '1-1' while already synced
    const afterUnbookmark = mergeSettings({
      localSettings: {
        ...initialMerge,
        bookmarkedDuaIds: ['3-2'],
        userModifiedAt: 3000,
      },
      cloudSettings: {
        theme: 'sky',
        bookmarkedDuaIds: ['1-1', '3-2'],
        userModifiedAt: 2000,
      },
      localOfflineDownloaded: true,
      preferLocalLists: true,
    });
    expect(afterUnbookmark.bookmarkedDuaIds).toEqual(['3-2']);
  });

  it('merges custom duas with LWW timestamps and propagates tombstones across devices', () => {
    const localOnly: CustomDua = {
      id: 'custom-dua-local',
      titleBangla: 'লোকাল দুআ',
      arabic: '',
      translationBangla: 'লোকাল অর্থ',
      repeatCount: 1,
      createdAt: 100,
      updatedAt: 100,
    };
    const sharedLocalOlder: CustomDua = {
      id: 'custom-dua-shared',
      titleBangla: 'পুরনো শিরোনাম',
      arabic: '',
      translationBangla: 'পুরনো অর্থ',
      repeatCount: 3,
      createdAt: 200,
      updatedAt: 200,
    };
    const deletedInCloud: CustomDua = {
      id: 'custom-dua-deleted-remotely',
      titleBangla: 'মুছে ফেলা দুআ',
      arabic: '',
      translationBangla: 'অর্থ',
      repeatCount: 1,
      createdAt: 300,
      updatedAt: 300,
    };

    const res = mergeCustomDuas(
      [localOnly, sharedLocalOlder, deletedInCloud],
      [
        {
          id: 'custom-dua-shared',
          titleBangla: 'নতুন ক্লাউড শিরোনাম',
          arabic: '',
          translationBangla: 'নতুন অর্থ',
          repeatCount: 7,
          createdAt: 200,
          updatedAtMs: 500,
        },
        {
          id: 'custom-dua-deleted-remotely',
          deleted: true,
          updatedAtMs: 600,
        },
        {
          id: 'custom-dua-deleted-locally',
          titleBangla: 'ক্লাউডে ছিল',
          arabic: '',
          translationBangla: 'অর্থ',
          repeatCount: 1,
          createdAt: 150,
          updatedAtMs: 150,
        },
      ],
      { 'custom-dua-deleted-locally': 700 }
    );

    expect(res.mergedLocal.map((d) => d.id)).toEqual([
      'custom-dua-local',
      'custom-dua-shared',
    ]);
    expect(
      res.mergedLocal.find((d) => d.id === 'custom-dua-shared')?.titleBangla
    ).toBe('নতুন ক্লাউড শিরোনাম');
    expect(res.toUploadActive.map((d) => d.id)).toEqual(['custom-dua-local']);
    expect(res.toUploadTombstones).toEqual([
      { id: 'custom-dua-deleted-locally', updatedAtMs: 700 },
    ]);
  });

  it('deduplicates routines adopted from the same Admin template on two offline devices', () => {
    const localAdopted: Routine = {
      id: 'routine-dev-a',
      title: 'সকালের আমল',
      assignedDays: [0, 1, 2, 3, 4, 5, 6],
      surahIds: [1],
      sourceTemplateId: 'tpl-morning',
      sourceTemplateVersion: 1,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const res = mergeRoutines(
      [localAdopted],
      [
        {
          id: 'routine-dev-b',
          title: 'সকালের আমল',
          assignedDays: [0, 1, 2, 3, 4, 5, 6],
          surahIds: [1, 112],
          sourceTemplateId: 'tpl-morning',
          sourceTemplateVersion: 2,
          createdAt: 1200,
          updatedAtMs: 2000,
        },
      ],
      {}
    );

    expect(res.mergedLocal).toHaveLength(1);
    expect(res.mergedLocal[0].id).toBe('routine-dev-b');
    expect(res.mergedLocal[0].sourceTemplateVersion).toBe(2);
  });

  it('merges ReadingHistory commutatively and idempotently without inflating counts on repeat syncs', () => {
    const devA: ReadingHistory = {
      date: '2026-11-25',
      ayahsCount: 25,
      routinesCompleted: ['r-1'],
      dhikirCount: 33,
      dhikirByDua: { '1-1': 33 },
      duasCompleted: ['1-1'],
      duaCounts: { '1-1': 1 },
      readingSeconds: 300,
    };
    const devB: ReadingHistory = {
      date: '2026-11-25',
      ayahsCount: 40,
      routinesCompleted: ['r-2'],
      dhikirCount: 34,
      dhikirByDua: { '1-2': 34 },
      duasCompleted: ['1-2'],
      duaCounts: { '1-2': 2 },
      readingSeconds: 450,
    };

    const ab = mergeSingleHistoryRecord('2026-11-25', devA, devB);
    const ba = mergeSingleHistoryRecord('2026-11-25', devB, devA);
    expect(ab).toEqual(ba);
    expect(ab.ayahsCount).toBe(40);
    expect(ab.dhikirCount).toBe(67); // 33 ('1-1') + 34 ('1-2')
    expect(ab.routinesCompleted.sort()).toEqual(['r-1', 'r-2']);
    expect(ab.readingSeconds).toBe(450);

    // Idempotence: syncing again produces zero inflation and zero redundant uploads
    const secondSync = mergeReadingHistory([ab], [ab]);
    expect(secondSync.mergedLocal[0]).toEqual(ab);
    expect(secondSync.toUpload).toHaveLength(0);
  });

  it('picks newest timestamp per surah/current in mergeGlobalLastRead and strips undefined deeply', () => {
    const merged = mergeGlobalLastRead(
      [
        {
          id: 'current',
          surahId: 18,
          surahNameBangla: 'কাহফ',
          ayahNumber: 10,
          pageNumber: 294,
          timestamp: 5000,
        },
      ],
      [
        {
          id: 'current',
          surahId: 2,
          surahNameBangla: 'বাকারা',
          ayahNumber: 255,
          pageNumber: 42,
          timestamp: 3000,
        },
        {
          id: 'surah-36',
          surahId: 36,
          surahNameBangla: 'ইয়াসীন',
          ayahNumber: 12,
          pageNumber: 441,
          timestamp: 4000,
        },
      ]
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((x) => x.id === 'current')?.surahId).toBe(18);

    const cleaned = stripUndefinedDeep({
      a: 1,
      b: undefined,
      c: { d: false, e: '', f: undefined },
      arr: [1, undefined, { x: 0, y: undefined }],
    });
    expect(cleaned).toEqual({
      a: 1,
      c: { d: false, e: '' },
      arr: [1, { x: 0 }],
    });
  });
});
