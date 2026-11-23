import { describe, expect, it } from 'vitest';
import type { CachedSurah, Routine } from '../../db/database';
import {
  mergeVerseSearchResults,
  parseQuranHighlightHtml,
  searchCachedVerses,
} from '../../services/quranSearch';
import {
  buildOnlineQuranQuery,
  getHighlightSegments,
  normalizeArabicForSearch,
  normalizeBanglaForSearch,
  parseSmartJumps,
  searchAllLocal,
  searchAppActions,
  searchDuaChapters,
  searchDuas,
  searchRoutines,
  searchSurahs,
} from '../searchEngine';

describe('searchEngine normalization & smart jumps', () => {
  it('normalizes Arabic text by stripping tashkeel and unifying Alef/Yeh/Ta-Marbuta', () => {
    const vowelled =
      'اَللّٰهُمَّ أَنْتَ رَبِّي لَا إِلٰهَ إِلَّا أَنْتَ، سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ';
    const norm = normalizeArabicForSearch(vowelled);
    expect(norm).toContain('اللهم انت ربي');
    expect(norm).toContain('سبحان الله وبحمده');
    expect(normalizeArabicForSearch('الفاتحة')).toBe(
      normalizeArabicForSearch('الفاتحه')
    );
  });

  it('normalizes Bangla spelling variants consistently', () => {
    expect(normalizeBanglaForSearch('সূরা ইয়াসীন')).toBe(
      normalizeBanglaForSearch('সুরা ইয়াসিন')
    );
    expect(normalizeBanglaForSearch('দোয়া')).toBe(
      normalizeBanglaForSearch('দুআ')
    );
    expect(normalizeBanglaForSearch('যিকির')).toBe(
      normalizeBanglaForSearch('জিকির')
    );
    expect(normalizeBanglaForSearch('রুকইয়াহ')).toBe(
      normalizeBanglaForSearch('রুকইয়া')
    );
    expect(normalizeBanglaForSearch('আয়াতুল কুরসী')).toBe(
      normalizeBanglaForSearch('আয়াতুল কুরসি')
    );
  });

  it('parses numeric, named-surah, range, juz, page, and famous ayah jumps', () => {
    // Numeric Bangla & ASCII + range
    const banglaNum = parseSmartJumps('২:২৫৫');
    expect(banglaNum[0]?.surah.id).toBe(2);
    expect(banglaNum[0]?.ayah).toBe(255);

    const range = parseSmartJumps('2:285-286');
    expect(range[0]?.surah.id).toBe(2);
    expect(range[0]?.ayah).toBe(285);
    expect(range[0]?.endAyah).toBe(286);

    // Surah name + ayah (Bangla & Banglish)
    const namedBn = parseSmartJumps('বাকারা ২৫৫');
    expect(namedBn[0]?.surah.id).toBe(2);
    expect(namedBn[0]?.ayah).toBe(255);

    const namedEn = parseSmartJumps('yasin 58');
    expect(namedEn[0]?.surah.id).toBe(36);
    expect(namedEn[0]?.ayah).toBe(58);

    const namedWithPrefix = parseSmartJumps('সূরা কাহফ ১০');
    expect(namedWithPrefix[0]?.surah.id).toBe(18);
    expect(namedWithPrefix[0]?.ayah).toBe(10);

    // Juz / Para
    const juz30 = parseSmartJumps('পারা ৩০');
    expect(juz30[0]?.kind).toBe('juz');
    expect(juz30[0]?.surah.id).toBe(78);
    expect(juz30[0]?.ayah).toBe(1);

    const juz3 = parseSmartJumps('juz 3');
    expect(juz3[0]?.surah.id).toBe(2);
    expect(juz3[0]?.ayah).toBe(253);

    // Mushaf Page
    const page604 = parseSmartJumps('পৃষ্ঠা ৬০৪');
    expect(page604[0]?.kind).toBe('page');
    expect(page604[0]?.page).toBe(604);
    expect(page604[0]?.surah.id).toBe(112);

    // Leading keyword + numeric jump ("আয়াত ২:২৫৫", "ayah 2:255")
    const prefixedBn = parseSmartJumps('আয়াত ২:২৫৫');
    expect(prefixedBn[0]?.surah.id).toBe(2);
    expect(prefixedBn[0]?.ayah).toBe(255);

    const prefixedEn = parseSmartJumps('ayah 2:255');
    expect(prefixedEn[0]?.surah.id).toBe(2);
    expect(prefixedEn[0]?.ayah).toBe(255);

    // Famous ayah shortcut
    const kursi = parseSmartJumps('ayatul kursi');
    expect(kursi.some((j) => j.surah.id === 2 && j.ayah === 255)).toBe(true);
  });

  it('optimizes online Quran queries (skips juz/page jumps and translates Banglish)', () => {
    expect(buildOnlineQuranQuery('২:২৫৫')).toBeNull();
    expect(buildOnlineQuranQuery('পারা ৩০')).toBeNull();
    expect(buildOnlineQuranQuery('juz 30')).toBeNull();
    expect(buildOnlineQuranQuery('পৃষ্ঠা ৬০৪')).toBeNull();
    expect(buildOnlineQuranQuery('page 604')).toBeNull();
    expect(buildOnlineQuranQuery('আয়াত ২:২৫৫')).toBeNull();

    // Banglish translated to Bangla for Quran.com language=bn search
    expect(buildOnlineQuranQuery('jannat')).toBe('জান্নাত');
    expect(buildOnlineQuranQuery('sabr')).toBe('ধৈর্য');
    expect(buildOnlineQuranQuery('রহমত')).toBe('রহমত');
  });
});

describe('searchEngine entity search & ranking', () => {
  it('finds Surahs across Banglish, Bangla spelling variants, stop-words, typos, and 4 qul', () => {
    expect(searchSurahs('yasin')[0]?.surah.id).toBe(36);
    expect(searchSurahs('yaseen')[0]?.surah.id).toBe(36);
    expect(searchSurahs('ইয়াসিন')[0]?.surah.id).toBe(36);
    expect(searchSurahs('সূরা কাহফ')[0]?.surah.id).toBe(18);
    expect(searchSurahs('waqiah')[0]?.surah.id).toBe(56);
    expect(searchSurahs('bakhara').some((r) => r.surah.id === 2)).toBe(true);
    expect(searchSurahs('الفاتحه')[0]?.surah.id).toBe(1);

    // 4 Qul returns 109, 112, 113, 114
    const fourQul = searchSurahs('4 qul').map((r) => r.surah.id);
    expect(fourQul).toContain(112);
    expect(fourQul).toContain(113);
    expect(fourQul).toContain(114);
  });

  it('finds Duas via Banglish, harakat-free Arabic, transliteration, reference, and parts', () => {
    // Harakat-free Arabic search
    const arRes = searchDuas('اللهم انت ربي');
    expect(arRes.some((r) => r.dua.id === 'ch1-sayyidul-istighfar')).toBe(true);

    // Banglish queries
    const ghumer = searchDuas('ghumer dua');
    expect(ghumer.length).toBeGreaterThan(0);
    expect(ghumer.some((r) => r.dua.chapterId === 3)).toBe(true);

    const kursiDuas = searchDuas('ayatul kursi');
    expect(kursiDuas.some((r) => r.dua.id === 'ch10-rq-05-ayatul-kursi')).toBe(
      true
    );

    // Reference search (Bukhari 6306)
    const refRes = searchDuas('৬৩০৬');
    expect(refRes.some((r) => r.dua.id === 'ch1-sayyidul-istighfar')).toBe(true);

    // Transliteration search
    const translitRes = searchDuas('ইয়া হাইয়ু ইয়া কাইয়ূম');
    expect(translitRes.some((r) => r.dua.id === 'ch1-islah-zimmadari')).toBe(
      true
    );

    // Multi-part tasbih in chapter 13
    const partsRes = searchDuas('আস্তাগফিরুল্লাহ');
    expect(partsRes.length).toBeGreaterThan(0);

    // Exact title match ranks above mere body mention
    const sayyidul = searchDuas('সাইয়েদুল ইস্তেগফার');
    expect(sayyidul[0]?.dua.id).toBe('ch1-sayyidul-istighfar');

    // Direct numeric Quran coordinates only match Duas with a matching quranRef
    expect(searchDuas('2:23')).toHaveLength(0);
    const kursiByCoord = searchDuas('2:255');
    expect(kursiByCoord.length).toBeGreaterThan(0);
    expect(
      kursiByCoord.every(
        (r) =>
          r.dua.quranRef?.surahId === 2 &&
          255 >= r.dua.quranRef.startAyah &&
          255 <= r.dua.quranRef.endAyah
      )
    ).toBe(true);
  });

  it('searches Dua Chapters and App Quick Actions', () => {
    const ch = searchDuaChapters('ruqyah');
    expect(ch[0]?.chapter.id).toBe(10);

    const durudCh = searchDuaChapters('দরুদ');
    expect(durudCh[0]?.chapter.id).toBe(11);

    const actions = searchAppActions('ইফতার');
    expect(actions.some((a) => a.id === 'ramadan')).toBe(true);

    const darkAction = searchAppActions('dark mode');
    expect(darkAction.some((a) => a.id === 'settings')).toBe(true);

    const profileBnAction = searchAppActions('প্রোফাইল');
    expect(profileBnAction.some((a) => a.id === 'stats')).toBe(true);

    const profileEnAction = searchAppActions('profile');
    expect(profileEnAction.some((a) => a.id === 'stats')).toBe(true);
  });

  it('deep-searches Routines by title, contained Surah/Dua, and weekday', () => {
    const mockRoutines: Routine[] = [
      {
        id: 'r-jummah',
        title: 'জুমুআ আমল',
        assignedDays: [5],
        surahIds: [18],
        items: [{ kind: 'surah', surahId: 18, startAyah: 1, endAyah: 110 }],
        createdAt: 1000,
      },
      {
        id: 'r-night',
        title: 'রাতের আমল',
        assignedDays: [0, 1, 2, 3, 4, 5, 6],
        surahIds: [67],
        items: [
          { kind: 'surah', surahId: 67, startAyah: 1, endAyah: 30 },
          { kind: 'dua', duaId: 'ch1-sayyidul-istighfar', targetCount: 1 },
        ],
        createdAt: 2000,
      },
    ];

    // Match by contained surah (Banglish!)
    const kahfRoutines = searchRoutines('kahf', mockRoutines);
    expect(kahfRoutines[0]?.routine.id).toBe('r-jummah');
    expect(kahfRoutines[0]?.matchHint).toContain('আল-কাহফ');

    // Match by weekday
    const fridayRoutines = searchRoutines('শুক্রবার', mockRoutines);
    expect(fridayRoutines.some((r) => r.routine.id === 'r-jummah')).toBe(true);

    // Match by contained dua
    const duaRoutines = searchRoutines('সাইয়েদুল', mockRoutines);
    expect(duaRoutines[0]?.routine.id).toBe('r-night');
  });

  it('runs unified searchAllLocal cleanly', () => {
    const res = searchAllLocal('আয়াতুল কুরসি', { routines: [] });
    expect(res.jumps.some((j) => j.surah.id === 2 && j.ayah === 255)).toBe(true);
    expect(res.duas.some((d) => d.dua.id === 'ch10-rq-05-ayatul-kursi')).toBe(
      true
    );
  });

  it('produces safe highlight segments across Bangla spelling variants and plurals', () => {
    const segs = getHighlightSegments('সূরা আল-কাহফ (গুহা)', 'কাহফ');
    expect(segs.some((s) => s.highlight && s.text === 'কাহফ')).toBe(true);

    // ি vs ী highlight
    const yasinSegs = getHighlightSegments('ইয়াসীন', 'ইয়াসিন');
    expect(yasinSegs.some((s) => s.highlight && s.text === 'ইয়াসীন')).toBe(true);

    // দোয়া highlights দুআ
    const duaSegs = getHighlightSegments('ঘুমের দুআ ও জিকির', 'দোয়া');
    expect(duaSegs.some((s) => s.highlight && s.text === 'দুআ')).toBe(true);

    // Bangla plural stemming finds রোগী from রোগীদের
    const pluralRes = searchDuas('রোগীদের');
    expect(pluralRes.length).toBeGreaterThan(0);
  });
});

describe('quranSearch offline cached verses & online HTML parser', () => {
  it('matches harakat-free Arabic inside offline cachedSurahs', () => {
    const cached: CachedSurah[] = [
      {
        surahId: 1,
        nameArabic: 'الفاتحة',
        nameBangla: 'আল-ফাতিহা',
        totalVerses: 7,
        verses: [
          {
            id: 1,
            verse_number: 1,
            text_indopak: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِیْمِ',
            page_number: 1,
            juz_number: 1,
          },
          {
            id: 2,
            verse_number: 2,
            text_indopak: 'اَلْحَمْدُ لِلّٰهِ رَبِّ الْعٰلَمِیْنَ',
            page_number: 1,
            juz_number: 1,
          },
        ],
      },
    ];

    const hits = searchCachedVerses('الحمد لله', cached);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.verseKey).toBe('1:2');
    expect(hits[0]?.source).toBe('offline');
  });

  it('parses Quran.com highlight HTML safely and merges offline + online results', () => {
    const segs = parseQuranHighlightHtml(
      'সকল প্রশংসা <em>আল্লাহর</em> জন্য<sup foot_note=123>1</sup> যিনি জগতসমূহের প্রতিপালক।'
    );
    expect(segs).toEqual([
      { text: 'সকল প্রশংসা ', highlight: false },
      { text: 'আল্লাহর', highlight: true },
      { text: ' জন্য যিনি জগতসমূহের প্রতিপালক।', highlight: false },
    ]);

    const merged = mergeVerseSearchResults(
      [
        {
          verseKey: '1:2',
          surah: searchSurahs('1')[0].surah,
          ayahNumber: 2,
          arabicText: 'الحمد لله',
          source: 'offline',
        },
      ],
      [
        {
          verseKey: '1:2',
          surah: searchSurahs('1')[0].surah,
          ayahNumber: 2,
          arabicText: 'الحمد لله',
          translationSegments: segs,
          source: 'online',
        },
      ]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.source).toBe('both');
    expect(merged[0]?.translationSegments).toEqual(segs);
  });
});
