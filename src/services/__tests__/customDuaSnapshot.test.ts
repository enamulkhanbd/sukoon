import { afterEach, describe, expect, it } from 'vitest';
import { getRoutineItems, type ReadingHistory } from '../../db/database';
import { formatNormalizedRoutineItemLabel } from '../../utils/formatters';
import { searchAllLocal, searchDuas } from '../../utils/searchEngine';
import { computeTopBreakdowns } from '../../utils/stats';
import { getCatalogSnapshot } from '../catalogSnapshot';
import {
  CUSTOM_DUA_CHAPTER_ID,
  generateCustomDuaId,
  isCustomDuaId,
  normalizeStoredCustomDua,
  resolveDuaById,
  searchCustomDuas,
  setCustomDuasSnapshot,
  validateCustomDuaInput,
  type CustomDua,
} from '../customDuaSnapshot';

afterEach(() => {
  setCustomDuasSnapshot([]);
});

describe('customDuaSnapshot — validation, strict isolation, routines & stats', () => {
  it('validates title requirement and requires at least one content field', () => {
    expect(
      validateCustomDuaInput({
        titleBangla: '   ',
        arabic: 'رَبِّ زِدْنِي عِلْمًا',
      }).ok
    ).toBe(false);

    expect(
      validateCustomDuaInput({
        titleBangla: 'ব্যক্তিগত মোনাজাত',
        arabic: '   ',
        transliteration: '',
        translationBangla: '  ',
      }).ok
    ).toBe(false);

    // Bangla-only munajat (no Arabic, no pronunciation)
    const banglaOnly = validateCustomDuaInput({
      titleBangla: 'পিতামাতার জন্য মোনাজাত',
      translationBangla: 'হে আল্লাহ, আমার পিতা-মাতাকে ক্ষমা করুন।',
    });
    expect(banglaOnly.ok).toBe(true);
    if (banglaOnly.ok) {
      expect(banglaOnly.cleaned.arabic).toBe('');
      expect(banglaOnly.cleaned.repeatCount).toBe(1);
      expect(banglaOnly.cleaned.transliteration).toBeUndefined();
    }

    // Arabic-only dua
    const arabicOnly = validateCustomDuaInput({
      titleBangla: 'রাব্বি যিদনী ইলমা',
      arabic: 'رَبِّ زِدْنِي عِلْمًا',
      repeatCount: 7,
    });
    expect(arabicOnly.ok).toBe(true);
    if (arabicOnly.ok) {
      expect(arabicOnly.cleaned.translationBangla).toBe('');
      expect(arabicOnly.cleaned.repeatCount).toBe(7);
    }

    // Pronunciation-only dua
    const translitOnly = validateCustomDuaInput({
      titleBangla: 'সংক্ষিপ্ত ইস্তেগফার',
      transliteration: 'আস্তাগফিরুল্লাহাল আযীম',
      repeatCount: 100,
    });
    expect(translitOnly.ok).toBe(true);

    // Invalid repeatCount bounds
    expect(
      validateCustomDuaInput({
        titleBangla: 'টেস্ট',
        translationBangla: 'অর্থ',
        repeatCount: 0,
      }).ok
    ).toBe(false);
    expect(
      validateCustomDuaInput({
        titleBangla: 'টেস্ট',
        translationBangla: 'অর্থ',
        repeatCount: 10001,
      }).ok
    ).toBe(false);
  });

  it('keeps custom duas 100% isolated from system catalog, system dua search, and global search', () => {
    const customDoc: CustomDua = {
      id: generateCustomDuaId(),
      titleBangla: 'অনন্য ব্যক্তিগত মোনাজাত আলফা-নাইন',
      arabic: 'اللَّهُمَّ بَارِكْ لَنَا',
      translationBangla: 'একান্ত ব্যক্তিগত প্রার্থনা আলফা-নাইন',
      repeatCount: 3,
      reference: 'ব্যক্তিগত ডায়েরি',
      createdAt: 1000,
      updatedAt: 1000,
    };

    expect(isCustomDuaId(customDoc.id)).toBe(true);
    setCustomDuasSnapshot([customDoc]);

    // Never appears in system catalog
    const catalog = getCatalogSnapshot();
    expect(catalog.duaMap[customDoc.id]).toBeUndefined();
    expect(catalog.duas.some((d) => d.id === customDoc.id)).toBe(false);

    // Never appears in system Dua search or Global Search
    expect(searchDuas('আলফা-নাইন')).toHaveLength(0);
    const globalRes = searchAllLocal('আলফা-নাইন', {
      bookmarkedDuaIds: new Set(),
      routines: [],
      lastRead: null,
    });
    expect(globalRes.duas).toHaveLength(0);

    // Appears in dedicated custom dua search (including Bangla & unvowelled Arabic matching)
    const customHitsBn = searchCustomDuas('আলফা নাইন');
    expect(customHitsBn).toHaveLength(1);
    expect(customHitsBn[0].id).toBe(customDoc.id);
    expect(customHitsBn[0].chapterId).toBe(CUSTOM_DUA_CHAPTER_ID);

    const customHitsAr = searchCustomDuas('اللهم بارك لنا');
    expect(customHitsAr).toHaveLength(1);
    expect(customHitsAr[0].id).toBe(customDoc.id);
  });

  it('supports custom duas in Routines and Statistics and handles deletion gracefully', () => {
    const customDoc: CustomDua = {
      id: 'custom-dua-parent-prayer',
      titleBangla: 'মা-বাবার সুস্থতার দুআ',
      arabic: '',
      translationBangla: 'হে আল্লাহ, তাদের সুস্থ রাখুন।',
      repeatCount: 33,
      createdAt: 1000,
      updatedAt: 1000,
    };
    setCustomDuasSnapshot([customDoc]);

    expect(resolveDuaById(customDoc.id)?.titleBangla).toBe('মা-বাবার সুস্থতার দুআ');

    const routineItems = getRoutineItems({
      surahIds: [1],
      items: [
        { kind: 'surah', surahId: 1, startAyah: 1, endAyah: 7 },
        { kind: 'dua', duaId: customDoc.id },
      ],
    });
    expect(routineItems).toHaveLength(2);
    expect(routineItems[1]).toEqual({
      kind: 'dua',
      duaId: customDoc.id,
      targetCount: 33,
    });
    expect(formatNormalizedRoutineItemLabel(routineItems[1])).toBe(
      'মা-বাবার সুস্থতার দুআ (৩৩ বার)'
    );

    const historyRecords: ReadingHistory[] = [
      {
        date: '2026-11-25',
        ayahsCount: 7,
        routinesCompleted: [],
        dhikirCount: 33,
        dhikirByDua: { [customDoc.id]: 33 },
        duasCompleted: [customDoc.id],
        duaCounts: { [customDoc.id]: 1 },
      },
    ];
    const breakdown = computeTopBreakdowns(historyRecords, new Map());
    expect(breakdown.topDuas[0]?.titleBangla).toBe('মা-বাবার সুস্থতার দুআ');

    // Deleting the custom dua removes it cleanly from normalized routine items without throwing
    setCustomDuasSnapshot([]);
    const afterDelete = getRoutineItems({
      surahIds: [1],
      items: [
        { kind: 'surah', surahId: 1, startAyah: 1, endAyah: 7 },
        { kind: 'dua', duaId: customDoc.id },
      ],
    });
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].kind).toBe('surah');
  });

  it('rejects malformed or non-prefixed stored custom dua payloads during import normalization', () => {
    expect(
      normalizeStoredCustomDua({
        id: '1-1', // system dua ID, not custom-dua-*
        titleBangla: 'নকল',
        translationBangla: 'অর্থ',
      })
    ).toBeNull();

    const valid = normalizeStoredCustomDua({
      id: 'custom-dua-valid-1',
      titleBangla: 'সফরের মোনাজাত',
      translationBangla: 'নিরাপদে পৌঁছে দিন',
      repeatCount: 3,
      createdAt: 1700000000000,
      updatedAt: 1700000005000,
    });
    expect(valid?.id).toBe('custom-dua-valid-1');
    expect(valid?.repeatCount).toBe(3);
  });
});
