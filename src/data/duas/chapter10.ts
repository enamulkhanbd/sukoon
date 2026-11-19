import { RUQYAH_PASSAGES } from './ruqyahPassages';
import type { DuaItem } from './types';

function makeQuranRuqyahItem(params: {
  id: string;
  order: number;
  titleBangla: string;
  passageKey: string;
  surahId: number;
  startAyah: number;
  endAyah: number;
  reference: string;
  transliteration?: string;
}): DuaItem {
  const passage = RUQYAH_PASSAGES[params.passageKey];
  return {
    id: params.id,
    chapterId: 10,
    order: params.order,
    titleBangla: params.titleBangla,
    repeatCount: 1,
    occasionNote: 'অনিষ্ট, জাদু ও বদনজর থেকে আত্মরক্ষার রুকইয়া',
    arabic: passage?.arabic ?? '',
    transliteration: params.transliteration,
    translationBangla: passage?.translationBangla ?? '',
    reference: params.reference,
    quranRef: {
      surahId: params.surahId,
      startAyah: params.startAyah,
      endAyah: params.endAyah,
    },
  };
}

export const DUAS_CHAPTER_10: DuaItem[] = [
  // ==================== দশম অধ্যায়: রুকইয়া ও অনিষ্ট থেকে আত্মরক্ষা ====================
  {
    id: 'ch10-safe-from-harm',
    chapterId: 10,
    order: 0,
    titleBangla: 'কারো ক্ষতি থেকে নিরাপদ থাকার দুআ',
    repeatCount: 1,
    occasionNote: 'কোনো ব্যক্তি বা শত্রুর অনিষ্টের আশঙ্কা করলে',
    arabic:
      'اَللّٰهُمَّ إِنَّا نَجْعَلُكَ فِي نُحُورِهِمْ، وَنَعُوذُ بِكَ مِنْ شُرُورِهِمْ',
    transliteration:
      'আল্লাহুম্মা ইন্না নাজআলুকা ফী নুহূরিহিম ওয়া নাঊযু বিকা মিন শুরূরিহিম।',
    translationBangla:
      'হে আল্লাহ! আমরা তাদের গলদেশে (মোকাবেলায়) আপনাকেই রাখছি এবং তাদের অনিষ্ট থেকে আপনার আশ্রয় চাচ্ছি।',
    reference: 'সুনানু আবী দাউদ ১৫৩৭',
  },
  makeQuranRuqyahItem({
    id: 'ch10-rq-01-fatiha',
    order: 1,
    titleBangla: 'রুকইয়া ১: সূরা ফাতিহা',
    passageKey: '1:1-7',
    surahId: 1,
    startAyah: 1,
    endAyah: 7,
    reference: 'সূরা ফাতিহা ১–৭ (সহীহ বুখারী ২২৭৬)',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-02-baqarah-1-5',
    order: 2,
    titleBangla: 'রুকইয়া ২: সূরা বাকারা (১–৫)',
    passageKey: '2:1-5',
    surahId: 2,
    startAyah: 1,
    endAyah: 5,
    reference: 'সূরা বাকারা ১–৫',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-03-baqarah-102',
    order: 3,
    titleBangla: 'রুকইয়া ৩: সূরা বাকারা (১০২)',
    passageKey: '2:102',
    surahId: 2,
    startAyah: 102,
    endAyah: 102,
    reference: 'সূরা বাকারা ১০২ (জাদু নষ্টের আয়াত)',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-04-baqarah-163-164',
    order: 4,
    titleBangla: 'রুকইয়া ৪: সূরা বাকারা (১৬৩–১৬৪)',
    passageKey: '2:163-164',
    surahId: 2,
    startAyah: 163,
    endAyah: 164,
    reference: 'সূরা বাকারা ১৬৩–১৬৪',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-05-ayatul-kursi',
    order: 5,
    titleBangla: 'রুকইয়া ৫: সূরা বাকারা ২৫৫ (আয়াতুল কুরসি)',
    passageKey: '2:255',
    surahId: 2,
    startAyah: 255,
    endAyah: 255,
    reference: 'সূরা বাকারা ২৫৫ (সহীহ বুখারী ২৩১১)',
    transliteration:
      'আল্লা-হু লা- ইলা-হা ইল্লা- হুওয়াল হাইয়ুল কাইয়ূম; লা- তা’খুযুহূ সিনাতুওঁ ওয়া লা- নাওম।\nলাহূ মা- ফিস-সামা-ওয়া-তি ওয়া মা- ফিল আরদ্ব। মান যাল্লাযী ইয়াশফা‘উ ‘ইনদাহূ ইল্লা- বিইযনিহ।\nইয়া‘লামু মা- বাইনা আইদীহিম ওয়া মা- খালফাহুম, ওয়া লা- ইউহীত্বূনা বিশাইইম মিন ‘ইলমিহী ইল্লা- বিমা- শা-আ।\nওয়াসি‘আ কুরসিয়্যুহুস-সামা-ওয়া-তি ওয়াল আরদ্ব, ওয়া লা- ইয়াঊদুহূ হিফযুহুমা- ওয়া হুওয়াল ‘আলিয়্যুল ‘আযীম।',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-06-baqarah-last-2',
    order: 6,
    titleBangla: 'রুকইয়া ৬: সূরা বাকারা ২৮৫–২৮৬ (শেষ দুই আয়াত)',
    passageKey: '2:285-286',
    surahId: 2,
    startAyah: 285,
    endAyah: 286,
    reference: 'সূরা বাকারা ২৮৫–২৮৬ (সহীহ বুখারী ৫০০৯)',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-07-ali-imran-18-19',
    order: 7,
    titleBangla: 'রুকইয়া ৭: সূরা আলে ইমরান (১৮–১৯)',
    passageKey: '3:18-19',
    surahId: 3,
    startAyah: 18,
    endAyah: 19,
    reference: 'সূরা আলে ইমরান ১৮–১৯',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-08-araf-54-56',
    order: 8,
    titleBangla: 'রুকইয়া ৮: সূরা আ’রাফ (৫৪–৫৬)',
    passageKey: '7:54-56',
    surahId: 7,
    startAyah: 54,
    endAyah: 56,
    reference: 'সূরা আ’রাফ ৫৪–৫৬',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-09-araf-117-122',
    order: 9,
    titleBangla: 'রুকইয়া ৯: সূরা আ’রাফ (১১৭–১২২)',
    passageKey: '7:117-122',
    surahId: 7,
    startAyah: 117,
    endAyah: 122,
    reference: 'সূরা আ’রাফ ১১৭–১২২ (জাদু বাতিলের আয়াত)',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-10-yunus-81-82',
    order: 10,
    titleBangla: 'রুকইয়া ১০: সূরা ইউনুস (৮১–৮২)',
    passageKey: '10:81-82',
    surahId: 10,
    startAyah: 81,
    endAyah: 82,
    reference: 'সূরা ইউনুস ৮১–৮২ (জাদু বাতিলের আয়াত)',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-11-taha-69',
    order: 11,
    titleBangla: 'রুকইয়া ১১: সূরা ত্বহা (৬৯)',
    passageKey: '20:69',
    surahId: 20,
    startAyah: 69,
    endAyah: 69,
    reference: 'সূরা ত্বহা ৬৯ (জাদু বাতিলের আয়াত)',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-12-muminun-115-118',
    order: 12,
    titleBangla: 'রুকইয়া ১২: সূরা মু’মিনুন (১১৫–১১৮)',
    passageKey: '23:115-118',
    surahId: 23,
    startAyah: 115,
    endAyah: 118,
    reference: 'সূরা মু’মিনুন ১১৫–১১৮',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-13-saffat-1-10',
    order: 13,
    titleBangla: 'রুকইয়া ১৩: সূরা সফফাত (১–১০)',
    passageKey: '37:1-10',
    surahId: 37,
    startAyah: 1,
    endAyah: 10,
    reference: 'সূরা সফফাত ১–১০',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-14-ahqaf-29-32',
    order: 14,
    titleBangla: 'রুকইয়া ১৪: সূরা আহকাফ (২৯–৩২)',
    passageKey: '46:29-32',
    surahId: 46,
    startAyah: 29,
    endAyah: 32,
    reference: 'সূরা আহকাফ ২৯–৩২',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-15-rahman-33-36',
    order: 15,
    titleBangla: 'রুকইয়া ১৫: সূরা আর-রহমান (৩৩–৩৬)',
    passageKey: '55:33-36',
    surahId: 55,
    startAyah: 33,
    endAyah: 36,
    reference: 'সূরা আর-রহমান ৩৩–৩৬',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-16-hashr-21-24',
    order: 16,
    titleBangla: 'রুকইয়া ১৬: সূরা হাশর (২১–২৪)',
    passageKey: '59:21-24',
    surahId: 59,
    startAyah: 21,
    endAyah: 24,
    reference: 'সূরা হাশর ২১–২৪',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-17-jinn-1-9',
    order: 17,
    titleBangla: 'রুকইয়া ১৭: সূরা জিন (১–৯)',
    passageKey: '72:1-9',
    surahId: 72,
    startAyah: 1,
    endAyah: 9,
    reference: 'সূরা জিন ১–৯',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-18-ikhlas',
    order: 18,
    titleBangla: 'রুকইয়া ১৮: সূরা ইখলাস',
    passageKey: '112:1-4',
    surahId: 112,
    startAyah: 1,
    endAyah: 4,
    reference: 'সূরা ইখলাস ১–৪ (৩ বার)',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-19-falaq',
    order: 19,
    titleBangla: 'রুকইয়া ১৯: সূরা ফালাক',
    passageKey: '113:1-5',
    surahId: 113,
    startAyah: 1,
    endAyah: 5,
    reference: 'সূরা ফালাক ১–৫ (৩ বার)',
  }),
  makeQuranRuqyahItem({
    id: 'ch10-rq-20-nas',
    order: 20,
    titleBangla: 'রুকইয়া ২০: সূরা নাস',
    passageKey: '114:1-6',
    surahId: 114,
    startAyah: 1,
    endAyah: 6,
    reference: 'সূরা নাস ১–৬ (৩ বার)',
  }),
  {
    id: 'ch10-hadith-ruqyah-duas',
    chapterId: 10,
    order: 21,
    titleBangla: 'হাদিসে বর্ণিত ঝাড়ফুঁক করার প্রসিদ্ধ কয়েকটি দুআ',
    repeatCount: 3,
    occasionNote: 'জিবরীল (আ.) নবীজিকে এই দুআয় রুকইয়া করেছেন',
    arabic:
      'بِسْمِ اللّٰهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ، اللّٰهُ يَشْفِيكَ، بِسْمِ اللّٰهِ أَرْقِيكَ',
    transliteration:
      'বিসমিল্লাহি আরকীকা মিন কুল্লি শাইয়িন ইউ’যীকা, মিন শাররি কুল্লি নাফসিন আও আইনি হাসিদিন, আল্লাহু ইয়াশফীকা, বিসমিল্লাহি আরকীক।',
    translationBangla:
      'আল্লাহর নামে আপনাকে ঝাড়ফুঁক করছি—সব কষ্টদায়ক জিনিস, প্রতিটি মন্দ প্রাণ ও হিংসুকের বদনজরের ক্ষতি থেকে; আল্লাহ আপনাকে আরোগ্য দিন।',
    reference: 'সহীহ মুসলিম ২১৮৬',
  },
  {
    id: 'ch10-duaye-anas',
    chapterId: 10,
    order: 22,
    titleBangla: 'দুআয়ে আনাস (রাযি.)',
    repeatCount: 1,
    occasionNote: 'জান-মাল, ঈমান ও পরিবারের নিরাপত্তায় প্রসিদ্ধ আমল',
    arabic:
      'بِسْمِ اللّٰهِ عَلَى نَفْسِي وَمَالِي وَأَهْلِي وَدِينِي، اَللّٰهُمَّ رَضِّنِي بِقَضَائِكَ، وَبَارِكْ لِي فِيمَا قُدِّرَ لِي حَتَّى لَا أُحِبَّ تَعْجِيلَ مَا أَخَّرْتَ وَلَا تَأْخِيرَ مَا عَجَّلْتَ',
    transliteration:
      'বিসমিল্লাহি আলা নাফসী ওয়া মালী ওয়া আহলী ওয়া দীনী; আল্লাহুম্মা রাদ্বদ্বিনী বিকাদ্বা-ইকা ওয়া বারিক লী ফীমা কুদ্দিরা লী...',
    translationBangla:
      'আমার জান, মাল, পরিবার ও দ্বীনের ওপর আল্লাহর নাম নিচ্ছি। হে আল্লাহ! আপনার ফয়সালায় আমাকে সন্তুষ্ট রাখুন এবং নির্ধারিত রিজিকে বরকত দিন।',
    reference: 'দুআয়ে আনাস হিসেবে পরিচিত মুজাররাব দুআ ও সুরক্ষার জিকির',
  },
];

export const RUQYAH_QURAN_ITEM_IDS = DUAS_CHAPTER_10.filter(
  (d) => d.quranRef !== undefined
).map((d) => d.id);
