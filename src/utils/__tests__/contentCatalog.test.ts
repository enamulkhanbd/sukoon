import { describe, expect, it } from 'vitest';
import { DUA_CHAPTERS, DUAS } from '../../data/duas';
import { SURAH_DESCRIPTIONS } from '../../data/surahDescriptions';
import {
  mergeChapters,
  mergeDuas,
  mergeFeaturedCards,
  mergeRoutineTemplates,
  mergeSurahOverrides,
  selectActiveFeaturedCard,
  setCatalogRemoteData,
} from '../../services/catalogSnapshot';
import { searchDuas } from '../searchEngine';

describe('contentCatalog offline-first merge logic', () => {
  it('merges new remote duas, overrides built-ins, hides deleted, and reverts cleanly', () => {
    const firstBuiltIn = DUAS[0];
    const secondBuiltIn = DUAS[1];

    const merged = mergeDuas([
      {
        id: 'remote-custom-1',
        chapterId: 1,
        order: 999,
        titleBangla: 'নতুন কাস্টম দুআ',
        arabic: 'رَبِّ زِدْنِي عِلْمًا',
        translationBangla: 'হে আমার রব, আমার জ্ঞান বৃদ্ধি করে দিন।',
        repeatCount: 3,
        updatedAt: 1000,
      },
      {
        id: firstBuiltIn.id,
        chapterId: firstBuiltIn.chapterId,
        order: firstBuiltIn.order,
        titleBangla: 'আপডেটেড শিরোনাম',
        arabic: firstBuiltIn.arabic,
        translationBangla: firstBuiltIn.translationBangla,
        isBuiltInOverride: true,
        updatedAt: 2000,
      },
      {
        id: secondBuiltIn.id,
        deleted: true,
        isBuiltInOverride: true,
        updatedAt: 3000,
      },
    ]);

    const added = merged.find((d) => d.id === 'remote-custom-1');
    expect(added).toBeDefined();
    expect(added?.source).toBe('remote');
    expect(added?.repeatCount).toBe(3);

    const overridden = merged.find((d) => d.id === firstBuiltIn.id);
    expect(overridden?.titleBangla).toBe('আপডেটেড শিরোনাম');
    expect(overridden?.source).toBe('override');

    const hidden = merged.find((d) => d.id === secondBuiltIn.id);
    expect(hidden).toBeUndefined();

    // Reverting restores the built-in default
    const reverted = mergeDuas([
      {
        id: firstBuiltIn.id,
        reverted: true,
        isBuiltInOverride: true,
        updatedAt: 4000,
      },
    ]);
    const restored = reverted.find((d) => d.id === firstBuiltIn.id);
    expect(restored?.titleBangla).toBe(firstBuiltIn.titleBangla);
    expect(restored?.source).toBe('builtin');
  });

  it('merges custom chapters and supports overriding/hiding built-in chapters', () => {
    const chapters = mergeChapters([
      {
        id: 14,
        titleBangla: 'রিজিক ও বরকতের দুআ',
        subtitleBangla: 'চতুর্দশ অধ্যায়',
        searchAliases: ['rizq', 'barkat'],
        updatedAt: 1000,
      },
      {
        id: 1,
        titleBangla: 'সকাল ও সন্ধ্যার জিকির (আপডেটেড)',
        subtitleBangla: DUA_CHAPTERS[0].subtitleBangla,
        updatedAt: 2000,
      },
    ]);

    expect(chapters.length).toBe(DUA_CHAPTERS.length + 1);
    expect(chapters.find((c) => c.id === 14)?.source).toBe('remote');
    expect(chapters.find((c) => c.id === 1)?.titleBangla).toBe(
      'সকাল ও সন্ধ্যার জিকির (আপডেটেড)'
    );
  });

  it('merges surah description overrides, fazilat, and unique occasion tags', () => {
    const { map, allTags } = mergeSurahOverrides([
      {
        surahId: 18,
        descriptionBangla: 'কাস্টম সূরা কাহফ পরিচিতি',
        fazilatBangla: 'জুমুআর দিন নূর দান করা হয়।',
        fazilatRef: 'মুস্তাদরাকে হাকিম ৩৩৯২',
        occasionTags: ['জুমুআ', 'নূর'],
        updatedAt: 1000,
      },
      {
        surahId: 67,
        occasionTags: ['ঘুমের আগে', 'জুমুআ'],
        updatedAt: 1001,
      },
    ]);

    expect(map[18].descriptionBangla).toBe('কাস্টম সূরা কাহফ পরিচিতি');
    expect(map[18].fazilatBangla).toBe('জুমুআর দিন নূর দান করা হয়।');
    expect(map[18].isOverridden).toBe(true);
    expect(map[67].descriptionBangla).toBe(SURAH_DESCRIPTIONS[67]);
    expect(map[1].isOverridden).toBe(false);
    expect(allTags).toEqual(['জুমুআ', 'নূর', 'ঘুমের আগে']);
  });

  it('sorts featured routine templates first and filters deleted templates', () => {
    const list = mergeRoutineTemplates([
      {
        id: 't1',
        title: 'সাধারণ রুটিন',
        assignedDays: [5],
        items: [{ kind: 'surah', surahId: 18 }],
        featured: false,
        order: 1,
        version: 1,
        updatedAt: 100,
      },
      {
        id: 't2',
        title: 'রমাদান স্পেশাল',
        assignedDays: [0, 1, 2, 3, 4, 5, 6],
        items: [{ kind: 'surah', surahId: 67 }],
        featured: true,
        seasonTag: 'রমাদান',
        order: 5,
        version: 2,
        updatedAt: 200,
      },
      {
        id: 't3',
        title: 'ডিলিটেড',
        items: [{ kind: 'surah', surahId: 1 }],
        deleted: true,
        updatedAt: 300,
      },
    ]);

    expect(list.map((t) => t.id)).toEqual(['t2', 't1']);
    expect(list[0].version).toBe(2);
  });

  it('selects active scheduled Home Featured Card respecting priority, dates, and dismiss list', () => {
    const cards = mergeFeaturedCards([
      {
        id: 'low',
        titleBangla: 'নিম্ন প্রায়োরিটি',
        bodyBangla: 'বার্তা ১',
        active: true,
        priority: 1,
        updatedAt: 100,
      },
      {
        id: 'scheduled',
        titleBangla: 'জুমুআর আমল',
        bodyBangla: 'সূরা কাহফ পড়ুন',
        active: true,
        priority: 10,
        startDate: '2026-11-20',
        endDate: '2026-11-25',
        updatedAt: 200,
      },
      {
        id: 'inactive',
        titleBangla: 'বন্ধ কার্ড',
        bodyBangla: 'দেখাবে না',
        active: false,
        priority: 99,
        updatedAt: 300,
      },
    ]);

    expect(selectActiveFeaturedCard(cards, '2026-11-24', [])?.id).toBe('scheduled');
    expect(selectActiveFeaturedCard(cards, '2026-11-24', ['scheduled'])?.id).toBe('low');
    expect(selectActiveFeaturedCard(cards, '2026-12-01', [])?.id).toBe('low');
  });

  it('automatically updates searchEngine index when remote catalog changes', () => {
    setCatalogRemoteData({
      remoteDuas: [
        {
          id: 'ch1-search-smoke-test',
          chapterId: 1,
          order: 999,
          titleBangla: 'বিশেষ পরীক্ষামূলক জিকির এক্সওয়াইজেড',
          arabic: 'سُبْحَانَ اللّٰهِ',
          translationBangla: 'টেস্ট অর্থ',
          updatedAt: Date.now(),
        },
      ],
      remoteChapters: [],
      remoteSurahOverrides: [],
      remoteTemplates: [],
      remoteFeaturedCards: [],
    });

    const results = searchDuas('এক্সওয়াইজেড');
    expect(results.some((r) => r.dua.id === 'ch1-search-smoke-test')).toBe(true);

    // Reset catalog snapshot cleanly for subsequent test suites
    setCatalogRemoteData({
      remoteDuas: [],
      remoteChapters: [],
      remoteSurahOverrides: [],
      remoteTemplates: [],
      remoteFeaturedCards: [],
    });
  });
});
