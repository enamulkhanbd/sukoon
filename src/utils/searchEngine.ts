import {
  DUA_CHAPTER_MAP,
  DUA_CHAPTERS,
  DUAS,
  DUAS_BY_CHAPTER,
  type DuaChapter,
  type DuaItem,
} from '../data/duas';
import { SURAH_MAP, SURAHS, type SurahMeta } from '../data/surahs';
import {
  getRoutineItems,
  type GlobalLastRead,
  type Routine,
} from '../db/database';
import {
  DAY_NAMES_BN,
  DAY_SHORT_BN,
  formatNormalizedRoutineItemLabel,
  normalizeIndoPakText,
  toBanglaDigits,
} from './formatters';

/* ============================================================================
 * 1. Digit & Script Normalization
 * ========================================================================== */

const DIGIT_MAP: Record<string, string> = {
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
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export function toAsciiDigits(text: string): string {
  return text.replace(/[০-৯٠-٩۰-۹]/g, (ch) => DIGIT_MAP[ch] ?? ch);
}

/**
 * Strips Arabic diacritics/tashkeel, Quranic stop marks, tatweel, and normalizes
 * Alef/Ta-Marbuta/Yeh/Waw variants so plain Arabic keyboard input matches
 * full Uthmani & IndoPak vowelled text.
 */
export function normalizeArabicForSearch(text: string): string {
  if (!text) return '';
  return toAsciiDigits(text)
    .normalize('NFC')
    .replace(
      /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u06DF\u06E1\u0640\u200B-\u200F\uFEFF\uF500-\uF61E]/g,
      ''
    )
    .replace(/[أإآٱٲٳٵ]/g, 'ا')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/[ىیئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ک/g, 'ك')
    .replace(/ﻻ/g, 'لا')
    .replace(/[،؛؟۞۝\-_.,:;!?'"’‘“”()[\]{}/\\|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes Bangla text across common orthographic & phonetic spelling
 * variations (NFC, হ্রস্ব/দীর্ঘ স্বর, য/জ, শ/ষ/স, ণ/ন, ড়/র, ক্ব/ক, দোয়া/দুআ etc.).
 */
export function normalizeBanglaForSearch(text: string): string {
  if (!text) return '';
  return toAsciiDigits(text)
    .normalize('NFC')
    // Unicode NFC treats Bengali nukta letters (য়/ড়/ঢ়) as composition exclusions;
    // recompose them explicitly before consonant folding so য->জ never corrupts য়.
    .replace(/য\u09bc/g, 'য়')
    .replace(/ড\u09bc/g, 'ড়')
    .replace(/ঢ\u09bc/g, 'ঢ়')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[-_.,:;!?'"’‘“”()[\]{}/\\|।۞•·–—]+/g, ' ')
    // Common Islamic Bangla spelling variants
    .replace(/দোয়া|দুয়া|দূআ/g, 'দুআ')
    .replace(/কোরআন|কোরান|কুরান/g, 'কুরআন')
    .replace(/রুকইয়াহ|রুকাইয়া|রুকিয়া|রুকইয়া/g, 'রুকইয়া')
    .replace(/ইস্তিগফার|এস্তেগফার/g, 'ইস্তেগফার')
    .replace(/ওযু|অজু|অযু/g, 'ওজু')
    .replace(/আযান/g, 'আজান')
    .replace(/নামায/g, 'নামাজ')
    .replace(/রোযা/g, 'রোজা')
    .replace(/তাসবীহ|তাসবিহ|তসবীহ|তসবি/g, 'তাসবিহ')
    .replace(/জুমুআহ|জুমআ|জুম্মা|জুম্মাহ|জুমা/g, 'জুমুআ')
    .replace(/যিকির|যিকর|জিকর/g, 'জিকির')
    .replace(/ক্ব/g, 'ক')
    .replace(/ত্ব/g, 'ত')
    .replace(/স্ব/g, 'স')
    .replace(/দ্ব/g, 'দ')
    // Vowel & consonant folding
    .replace(/ী/g, 'ি')
    .replace(/ূ/g, 'ু')
    .replace(/ণ/g, 'ন')
    .replace(/[ষশ]/g, 'স')
    .replace(/য/g, 'জ')
    .replace(/[ড়ঢ়]/g, 'র')
    .replace(/ৎ/g, 'ত')
    .replace(/ঙ/g, 'ং')
    .replace(/[ঁঃ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Light Bangla possessive / plural stemmer (e.g. ঘুমের -> ঘুম, রোগীদের -> রোগি, দুআগুলো -> দুআ). */
function stemBanglaToken(token: string): string {
  const multiSuffixes = ['গুলো', 'গুলি', 'সমুহ', 'য়ের', 'দের', 'এর', 'ের', 'টা', 'টি', 'তে', 'কে'];
  for (const suffix of multiSuffixes) {
    if (token.length >= suffix.length + 2 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  if (token.length >= 5 && token.endsWith('র')) {
    return token.slice(0, -1);
  }
  return token;
}

/**
 * Normalizes Latin / Banglish text for phonetic tolerance
 * (strips hyphens/apostrophes, folds ee->i, oo->u, aa->a, q->k).
 */
export function normalizeLatinForSearch(text: string): string {
  if (!text) return '';
  return toAsciiDigits(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[-_.,:;!?()[\]{}/\\|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactLatinPhonetic(text: string): string {
  return normalizeLatinForSearch(text)
    .replace(/\s+/g, '')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ou/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/q/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/dh/g, 'z')
    .replace(/th/g, 's');
}

export function hasArabicChars(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function hasBanglaChars(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

export function hasLatinChars(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

/** Bounded Levenshtein distance for typo-tolerant matching. */
function levenshtein(a: string, b: string, maxDist = 2): number {
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
  if (a === b) return 0;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  let prev = new Array<number>(lenB + 1);
  let curr = new Array<number>(lenB + 1);
  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lenB; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[lenB];
}

/* ============================================================================
 * 2. Curated Domain Knowledge (30 Juz, Famous Ayahs, Banglish Synonyms)
 * ========================================================================== */

export interface JuzStart {
  juz: number;
  surahId: number;
  ayah: number;
}

export const JUZ_START_MAP: Record<number, JuzStart> = {
  1: { juz: 1, surahId: 1, ayah: 1 },
  2: { juz: 2, surahId: 2, ayah: 142 },
  3: { juz: 3, surahId: 2, ayah: 253 },
  4: { juz: 4, surahId: 3, ayah: 93 },
  5: { juz: 5, surahId: 4, ayah: 24 },
  6: { juz: 6, surahId: 4, ayah: 148 },
  7: { juz: 7, surahId: 5, ayah: 82 },
  8: { juz: 8, surahId: 6, ayah: 111 },
  9: { juz: 9, surahId: 7, ayah: 88 },
  10: { juz: 10, surahId: 8, ayah: 41 },
  11: { juz: 11, surahId: 9, ayah: 93 },
  12: { juz: 12, surahId: 11, ayah: 6 },
  13: { juz: 13, surahId: 12, ayah: 53 },
  14: { juz: 14, surahId: 15, ayah: 1 },
  15: { juz: 15, surahId: 17, ayah: 1 },
  16: { juz: 16, surahId: 18, ayah: 75 },
  17: { juz: 17, surahId: 21, ayah: 1 },
  18: { juz: 18, surahId: 23, ayah: 1 },
  19: { juz: 19, surahId: 25, ayah: 21 },
  20: { juz: 20, surahId: 27, ayah: 56 },
  21: { juz: 21, surahId: 29, ayah: 46 },
  22: { juz: 22, surahId: 33, ayah: 31 },
  23: { juz: 23, surahId: 36, ayah: 28 },
  24: { juz: 24, surahId: 39, ayah: 32 },
  25: { juz: 25, surahId: 41, ayah: 47 },
  26: { juz: 26, surahId: 46, ayah: 1 },
  27: { juz: 27, surahId: 51, ayah: 31 },
  28: { juz: 28, surahId: 58, ayah: 1 },
  29: { juz: 29, surahId: 67, ayah: 1 },
  30: { juz: 30, surahId: 78, ayah: 1 },
};

interface FamousAyahDef {
  id: string;
  labelBangla: string;
  subtitleBangla: string;
  surahId: number;
  ayah: number;
  keywords: string[];
}

const FAMOUS_AYAHS: FamousAyahDef[] = [
  {
    id: 'ayatul-kursi',
    labelBangla: 'আয়াতুল কুরসি',
    subtitleBangla: 'সূরা আল-বাকারা • আয়াত ২৫৫',
    surahId: 2,
    ayah: 255,
    keywords: ['আয়াতুল কুরসি', 'আয়াতুল কুরসী', 'ayatul kursi', 'ayatulkursi', 'kursi', 'الكرسي'],
  },
  {
    id: 'amanar-rasul',
    labelBangla: 'আমানার রাসূল (বাকারার শেষ ২ আয়াত)',
    subtitleBangla: 'সূরা আল-বাকারা • আয়াত ২৮৫–২৮৬',
    surahId: 2,
    ayah: 285,
    keywords: [
      'আমানার রাসুল',
      'আমানার রাসূল',
      'বাকারার শেষ দুই আয়াত',
      'amanar rasul',
      'amanarrasul',
      'baqarah last 2',
      'امن الرسول',
    ],
  },
  {
    id: 'ayatul-karima',
    labelBangla: 'আয়াতুল কারীমা (দুআয়ে ইউনুস)',
    subtitleBangla: 'সূরা আল-আম্বিয়া • আয়াত ৮৭',
    surahId: 21,
    ayah: 87,
    keywords: [
      'আয়াতুল কারীমা',
      'আয়াতুল কারিমা',
      'দুআয়ে ইউনুস',
      'দোয়া ইউনুস',
      'ayatul karima',
      'dua yunus',
      'la ilaha illa anta subhanaka',
    ],
  },
  {
    id: 'ayat-nur',
    labelBangla: 'আয়াতুন নূর',
    subtitleBangla: 'সূরা আন-নূর • আয়াত ৩৫',
    surahId: 24,
    ayah: 35,
    keywords: ['আয়াতুন নূর', 'আয়াতুন নুর', 'ayatul nur', 'ayat an nur', 'light verse'],
  },
  {
    id: 'hashr-last-3',
    labelBangla: 'সূরা হাশরের শেষ ৩ আয়াত',
    subtitleBangla: 'সূরা আল-হাশর • আয়াত ২২–২৪',
    surahId: 59,
    ayah: 22,
    keywords: ['হাশরের শেষ ৩ আয়াত', 'হাশরের শেষ তিন আয়াত', 'hashr last 3', 'huwallahullazi'],
  },
  {
    id: 'kahf-first-10',
    labelBangla: 'সূরা কাহফের প্রথম ১০ আয়াত',
    subtitleBangla: 'সূরা আল-কাহফ • আয়াত ১–১০',
    surahId: 18,
    ayah: 1,
    keywords: ['কাহফের প্রথম ১০ আয়াত', 'kahf first 10', 'dajjal protection'],
  },
];

/**
 * Maps Banglish / English query terms to Bangla/Arabic semantic equivalents
 * so users searching in Banglish or English discover Bangla Duas, Surahs & Actions.
 */
const QUERY_SYNONYMS: Record<string, string[]> = {
  sokal: ['সকাল'],
  morning: ['সকাল'],
  sondha: ['সন্ধ্যা'],
  shondha: ['সন্ধ্যা'],
  evening: ['সন্ধ্যা'],
  ghum: ['ঘুম'],
  ghumer: ['ঘুম'],
  sleep: ['ঘুম', 'শোয়া'],
  soya: ['শোয়া', 'ঘুম'],
  sofor: ['সফর'],
  safar: ['সফর'],
  travel: ['সফর', 'বাহন'],
  khabar: ['খাবার', 'পানাহার'],
  khawa: ['খাবার', 'পানাহার'],
  eat: ['খাবার', 'পানাহার'],
  eating: ['খাবার', 'পানাহার'],
  food: ['খাবার', 'পানাহার'],
  pani: ['পানি', 'পানাহার'],
  water: ['পানি'],
  iftar: ['ইফতার'],
  ifter: ['ইফতার'],
  sehri: ['সেহরি'],
  sahri: ['সেহরি'],
  suhoor: ['সেহরি'],
  ramadan: ['রমজান', 'রোজা'],
  romjan: ['রমজান', 'রোজা'],
  roza: ['রোজা', 'রমজান'],
  roja: ['রোজা', 'রমজান'],
  fasting: ['রোজা', 'রমজান', 'ইফতার', 'সেহরি'],
  istighfar: ['ইস্তেগফার', 'ক্ষমা'],
  istegfar: ['ইস্তেগফার', 'ক্ষমা'],
  astaghfirullah: ['আস্তাগফিরুল্লাহ', 'ইস্তেগফার'],
  tawbah: ['তাওবা', 'ইস্তেগফার', 'ক্ষমা'],
  tauba: ['তাওবা', 'ইস্তেগফার'],
  khoma: ['ক্ষমা', 'ইস্তেগফার'],
  forgive: ['ক্ষমা', 'ইস্তেগফার'],
  sayyidul: ['সাইয়েদুল'],
  saiedul: ['সাইয়েদুল'],
  durud: ['দরুদ'],
  durood: ['দরুদ'],
  darud: ['দরুদ'],
  salawat: ['দরুদ'],
  ruqyah: ['রুকইয়া'],
  rukia: ['রুকইয়া'],
  rukiya: ['রুকইয়া'],
  jadu: ['জাদু', 'রুকইয়া'],
  magic: ['জাদু', 'রুকইয়া'],
  bodnojor: ['বদনজর', 'রুকইয়া'],
  nazar: ['বদনজর'],
  evil: ['অনিষ্ট', 'বদনজর'],
  osustho: ['অসুস্থতা', 'রোগ', 'আরোগ্য'],
  oshustho: ['অসুস্থতা', 'রোগ', 'আরোগ্য'],
  sick: ['অসুস্থতা', 'রোগী', 'আরোগ্য'],
  illness: ['অসুস্থতা', 'আরোগ্য'],
  shifa: ['আরোগ্য', 'শিফা', 'সুস্থতা'],
  rog: ['রোগ', 'অসুস্থতা'],
  bipod: ['বিপদ', 'দুশ্চিন্তা'],
  duschinta: ['দুশ্চিন্তা', 'পেরেশানী'],
  tension: ['দুশ্চিন্তা', 'পেরেশানী'],
  anxiety: ['দুশ্চিন্তা', 'পেরেশানী'],
  stress: ['দুশ্চিন্তা', 'পেরেশানী'],
  rin: ['ঋণ'],
  debt: ['ঋণ'],
  namaz: ['নামাজ', 'সালাত'],
  namaj: ['নামাজ', 'সালাত'],
  salah: ['সালাত', 'নামাজ'],
  salat: ['সালাত', 'নামাজ'],
  prayer: ['সালাত', 'নামাজ'],
  fajr: ['ফজর'],
  fojor: ['ফজর'],
  maghrib: ['মাগরিব'],
  magrib: ['মাগরিব'],
  oju: ['ওজু'],
  wudu: ['ওজু'],
  wuzu: ['ওজু'],
  azan: ['আজান'],
  adhan: ['আজান'],
  mosjid: ['মসজিদ'],
  masjid: ['মসজিদ'],
  mosque: ['মসজিদ'],
  janaza: ['জানাজা'],
  janaja: ['জানাজা'],
  kobor: ['কবর'],
  grave: ['কবর'],
  hajj: ['হজ'],
  hojj: ['হজ'],
  family: ['পরিবার'],
  poribar: ['পরিবার'],
  biye: ['বিবাহ'],
  marriage: ['বিবাহ'],
  sontan: ['সন্তান'],
  child: ['সন্তান', 'নবজাতক'],
  parents: ['পিতা', 'মাতা'],
  babamama: ['পিতা', 'মাতা'],
  istikhara: ['ইস্তেখারা'],
  istekhara: ['ইস্তেখারা'],
  asmaul: ['৯৯', 'নাম'],
  husna: ['৯৯', 'নাম'],
  '99': ['৯৯'],
  rabbana: ['রাব্বানা'],
  subhanallah: ['সুবহানাল্লাহ'],
  alhamdulillah: ['আলহামদুলিল্লাহ'],
  allahuakbar: ['আল্লাহু আকবার'],
  bismillah: ['বিসমিল্লাহ'],
  kalima: ['কালিমা'],
  tawhid: ['তাওহিদ'],
  rizq: ['রিজিক'],
  rijik: ['রিজিক'],
  rizik: ['রিজিক'],
  jannat: ['জান্নাত'],
  jannah: ['জান্নাত'],
  jahannam: ['জাহান্নাম'],
  hell: ['জাহান্নাম'],
  tasbih: ['তাসবিহ', 'জিকির'],
  tosbi: ['তাসবিহ'],
  zikir: ['জিকির'],
  dhikr: ['জিকির'],
  zikr: ['জিকির'],
  dua: ['দুআ'],
  duaa: ['দুআ'],
  doya: ['দুআ'],
  jummah: ['জুমুআ', 'কাহফ'],
  jumma: ['জুমুআ', 'কাহফ'],
  friday: ['শুক্রবার', 'জুমুআ', 'কাহফ'],
  shukrobar: ['শুক্রবার', 'জুমুআ'],
  makki: ['মক্কী'],
  makkah: ['মক্কী'],
  madani: ['মাদানী'],
  madinah: ['মাদানী'],
  qul: ['ইখলাস', 'ফালাক', 'নাস', 'কাফিরুন'],
  kul: ['ইখলাস', 'ফালাক', 'নাস', 'কাফিরুন'],
  bukhari: ['বুখারী'],
  muslim: ['মুসলিম'],
  tirmidhi: ['তিরমিযী'],
  tirmizi: ['তিরমিযী'],
  abudawud: ['আবী দাউদ'],
  nasai: ['নাসাঈ'],
  stats: ['পরিসংখ্যান', 'আমল'],
  streak: ['পরিসংখ্যান', 'স্ট্রিক'],
  goal: ['লক্ষ্য', 'পরিসংখ্যান'],
  settings: ['সেটিংস'],
  theme: ['থিম', 'সেটিংস'],
  dark: ['ডার্ক', 'থিম', 'সেটিংস'],
  offline: ['অফলাইন', 'ডাউনলোড', 'সেটিংস'],
  download: ['ডাউনলোড', 'অফলাইন'],
  saved: ['সংরক্ষিত'],
  bookmark: ['সংরক্ষিত'],
  bookmarks: ['সংরক্ষিত'],
  routine: ['রুটিন'],
  routines: ['রুটিন'],
  kursi: ['কুরসি', 'বাকারা'],
  ayatul: ['আয়াতুল'],
  ayatulkursi: ['আয়াতুল', 'কুরসি'],
  bajar: ['বাজার'],
  market: ['বাজার'],
  poshak: ['পোশাক'],
  cloth: ['পোশাক'],
  ghor: ['ঘর', 'বাড়ি'],
  home: ['ঘর'],
  mojlish: ['মজলিস'],
  bistar: ['বিছানা', 'ঘুম'],
  sabr: ['ধৈর্য', 'সবর'],
  sobor: ['ধৈর্য', 'সবর'],
  patience: ['ধৈর্য'],
  tawakkul: ['ভরসা', 'তাওয়াক্কুল'],
  vorosa: ['ভরসা'],
  shukr: ['কৃতজ্ঞতা', 'শুকরিয়া'],
  shukriya: ['কৃতজ্ঞতা', 'শুকরিয়া'],
  rahmat: ['রহমত'],
  rohomot: ['রহমত'],
  mercy: ['রহমত'],
  iman: ['ঈমান'],
  eeman: ['ঈমান'],
  taqwa: ['তাকওয়া'],
  qiyamah: ['কিয়ামত'],
  keyamot: ['কিয়ামত'],
  akhirah: ['আখিরাত'],
  akherat: ['আখিরাত'],
  dunya: ['দুনিয়া'],
  dunia: ['দুনিয়া'],
  maghfirah: ['ক্ষমা', 'মাগফিরাত'],
  pita: ['পিতা'],
  mata: ['মাতা'],
  baba: ['পিতা'],
  ma: ['মাতা'],
  office: ['অফিস', 'কর্মস্থল'],
  work: ['কর্মস্থল', 'অফিস', 'কাজ'],
  workplace: ['কর্মস্থল', 'অফিস'],
  job: ['কর্মস্থল', 'অফিস'],
  kormosthol: ['কর্মস্থল', 'অফিস'],
  kormoisthan: ['কর্মস্থল', 'অফিস'],
  shop: ['দোকান', 'ব্যবসাপ্রতিষ্ঠান', 'বাজার'],
  dokan: ['দোকান', 'কর্মস্থল'],
  business: ['ব্যবসাপ্রতিষ্ঠান', 'কর্মস্থল'],
  mudkhala: ['মুদখালা', 'কর্মস্থল'],
};

/** Extra Banglish / alternative names for Surahs beyond `nameSimple`. */
const SURAH_EXTRA_ALIASES: Record<number, string[]> = {
  1: ['fatiha', 'fateha', 'fatihatul', 'ummul quran', 'surah fatiha'],
  2: ['baqarah', 'bakara', 'baqara', 'baqra', 'cow', 'ayatul kursi'],
  3: ['imran', 'ali imran', 'al imran', 'ale imran'],
  4: ['nisa', 'nisaa', 'women'],
  5: ['maidah', 'maida', 'mayidah'],
  6: ['anam', 'anaam'],
  7: ['araf', 'aaraf'],
  8: ['anfal'],
  9: ['tawbah', 'tauba', 'taubah', 'baraat'],
  10: ['yunus', 'younus', 'jonah'],
  11: ['hud', 'hood'],
  12: ['yusuf', 'yousuf', 'joseph'],
  13: ['rad', 'raad'],
  14: ['ibrahim', 'ebrahim', 'abraham'],
  15: ['hijr'],
  16: ['nahl', 'nahal', 'bee'],
  17: ['isra', 'bani israel', 'bany israel'],
  18: ['kahf', 'kahaf', 'cave', 'jummah', 'friday', 'জুমুআ'],
  19: ['maryam', 'mariam', 'mary'],
  20: ['taha', 'ta ha', 'toha'],
  21: ['anbiya', 'ambiya', 'anbya'],
  22: ['hajj', 'haj'],
  23: ['muminun', 'mominun', 'mumenun'],
  24: ['nur', 'noor', 'light'],
  25: ['furqan', 'furkan'],
  26: ['shuara', 'shuaara'],
  27: ['naml', 'namal', 'ant'],
  28: ['qasas', 'kasas'],
  29: ['ankabut', 'ankaboot', 'spider'],
  30: ['rum', 'room'],
  31: ['luqman', 'lokman', 'lukman'],
  32: ['sajdah', 'sajda', 'sejdah'],
  33: ['ahzab', 'ahzaab'],
  34: ['saba', 'sheba'],
  35: ['fatir', 'fater'],
  36: ['yasin', 'yaseen', 'ya sin', 'yeasin', 'ইয়াসিন', 'ইয়াসীন'],
  37: ['saffat', 'sofat'],
  38: ['sad', 'saad', 'soad'],
  39: ['zumar', 'jumar'],
  40: ['ghafir', 'gafir', 'mumin', 'momin'],
  41: ['fussilat', 'hamim sajdah', 'ha mim'],
  42: ['shura', 'sura'],
  43: ['zukhruf', 'jukhruf'],
  44: ['dukhan', 'dokhan'],
  45: ['jathiyah', 'jasiya'],
  46: ['ahqaf', 'ahkaf'],
  47: ['muhammad', 'mohammad', 'muhammed'],
  48: ['fath', 'fatah', 'victory'],
  49: ['hujurat', 'hojorat'],
  50: ['qaf', 'kaf', 'qaaf'],
  51: ['dhariyat', 'zariyat', 'jariyat'],
  52: ['tur', 'toor'],
  53: ['najm', 'najam', 'star'],
  54: ['qamar', 'komor', 'moon'],
  55: ['rahman', 'rohmaan', 'rahmaan', 'ar rahman'],
  56: ['waqiah', 'waqia', 'wakia', 'wakiah', 'waqiya'],
  57: ['hadid', 'hadeed', 'iron'],
  58: ['mujadila', 'mujadilah'],
  59: ['hashr', 'hashor', 'hasor'],
  60: ['mumtahanah', 'mumtahina'],
  61: ['saff', 'saf', 'sof'],
  62: ['jumuah', 'jummah', 'jumma', 'friday'],
  63: ['munafiqun', 'munafikun'],
  64: ['taghabun', 'tagabun'],
  65: ['talaq', 'talak'],
  66: ['tahrim', 'tahreem'],
  67: ['mulk', 'muluk', 'tabarak', 'তাবারাক'],
  68: ['qalam', 'kolom', 'pen'],
  69: ['haqqah', 'hakka', 'haqqa'],
  70: ['maarij', 'mariz'],
  71: ['nuh', 'nooh', 'noah'],
  72: ['jinn', 'jin', 'jeen'],
  73: ['muzzammil', 'mujammil', 'muzammil'],
  74: ['muddaththir', 'mudassir', 'muddassir'],
  75: ['qiyamah', 'kiyama', 'qiyama'],
  76: ['insan', 'dahr', 'dahar', 'দাহর'],
  77: ['mursalat'],
  78: ['naba', 'amma', 'ammapara', 'আম্মাপারা'],
  79: ['naziat', 'najiat'],
  80: ['abasa'],
  81: ['takwir', 'takvir'],
  82: ['infitar'],
  83: ['mutaffifin'],
  84: ['inshiqaq', 'inshikak'],
  85: ['buruj', 'burooj'],
  86: ['tariq', 'tarik'],
  87: ['ala', 'aala', 'sabbihisma'],
  88: ['ghashiyah', 'gashiya'],
  89: ['fajr', 'fojor'],
  90: ['balad'],
  91: ['shams', 'sams', 'sun'],
  92: ['layl', 'lail', 'night'],
  93: ['duha', 'doha', 'zuha'],
  94: ['sharh', 'inshirah', 'alam nashrah', 'আলাম নাশরাহ'],
  95: ['tin', 'teen', 'fig'],
  96: ['alaq', 'alak', 'iqra', 'ইকরা'],
  97: ['qadr', 'qadar', 'kodor', 'kadr', 'shobe kodor'],
  98: ['bayyinah', 'baiyinah', 'bayyina'],
  99: ['zalzalah', 'jiljal', 'zilzal', 'earthquake'],
  100: ['adiyat', 'adiat'],
  101: ['qariah', 'karia'],
  102: ['takathur', 'takasur'],
  103: ['asr', 'asor'],
  104: ['humazah', 'humaja'],
  105: ['fil', 'feel', 'elephant'],
  106: ['quraysh', 'quraish', 'kuraish'],
  107: ['maun', 'maoon'],
  108: ['kawthar', 'kausar', 'kawsar'],
  109: ['kafirun', 'kaferun', '4 qul', 'char qul', '৪ কুল'],
  110: ['nasr', 'nosor', 'iza jaa'],
  111: ['masad', 'lahab', 'tabbat', 'লাহাব'],
  112: ['ikhlas', 'ekhlas', 'qul huwallah', '4 qul', 'char qul', '৪ কুল'],
  113: ['falaq', 'falak', '4 qul', 'char qul', '৪ কুল'],
  114: ['nas', 'naas', '4 qul', 'char qul', '৪ কুল'],
};

const DUA_CHAPTER_ALIASES: Record<number, string[]> = {
  1: ['morning', 'evening', 'sokal', 'sondha', 'azkar', 'adhkar', 'zikir', 'istighfar'],
  2: ['wudu', 'oju', 'azan', 'adhan', 'masjid', 'mosjid', 'salah', 'namaz', 'janaza', 'hajj'],
  3: ['sleep', 'ghum', 'ghumer', 'night', 'bed', 'soya', 'waking up'],
  4: ['food', 'eating', 'khabar', 'water', 'pani', 'iftar', 'dawat', 'khawa'],
  5: ['family', 'poribar', 'marriage', 'biye', 'child', 'sontan', 'baby'],
  6: ['daily', 'cloth', 'poshak', 'majlis', 'istikhara', 'istekhara', '99 names', 'asmaul husna'],
  7: ['travel', 'sofor', 'safar', 'vehicle', 'market', 'bajar', 'home', 'office', 'workplace', 'kormosthol'],
  8: ['danger', 'bipod', 'anxiety', 'tension', 'duschinta', 'debt', 'rin', 'difficulty'],
  9: ['sick', 'osustho', 'illness', 'shifa', 'healing', 'bodnojor', 'evil eye', 'kobor', 'grave'],
  10: ['ruqyah', 'rukia', 'jadu', 'magic', 'protection', 'bodnojor', 'jharfuk', 'ayatul kursi'],
  11: ['durud', 'durood', 'darud', 'salawat', 'salam', '40 durud'],
  12: ['selected', 'rabbana', 'quranic dua', 'jame dua', 'important dua'],
  13: ['after salah', 'namajer por', 'fajr', 'maghrib', 'tasbih', '5 waqt'],
};

/** Stop words stripped ONLY as a secondary/optional hint when other tokens remain. */
const TYPE_HINT_WORDS = new Set([
  'সুরা',
  'সূরা',
  'surah',
  'sura',
  'দুআ',
  'দোয়া',
  'dua',
  'duaa',
  'অধ্যায়',
  'অধ্যায',
  'chapter',
  'রুটিন',
  'routine',
  'আয়াত',
  'আযাত',
  'ayah',
  'ayat',
  'verse',
]);

/* ============================================================================
 * 3. Pre-Indexed Search Records (Lazily built once -> 0ms per keystroke)
 * ========================================================================== */

interface IndexedSurah {
  surah: SurahMeta;
  idStr: string;
  nameBn: string;
  meaningBn: string;
  nameAr: string;
  nameLatin: string;
  nameLatinBare: string;
  nameLatinPhonetic: string;
  aliasesBn: string;
  aliasesLatin: string;
  aliasesPhonetic: string[];
  revBn: string;
  revLatin: string;
  allTokens: string[];
}

interface IndexedDuaChapter {
  chapter: DuaChapter;
  count: number;
  titleBn: string;
  subtitleBn: string;
  aliasesLatin: string;
  allTokens: string[];
}

interface IndexedDua {
  dua: DuaItem;
  chapter?: DuaChapter;
  titleBn: string;
  translitBn: string;
  translationBn: string;
  occasionBn: string;
  referenceBn: string;
  chapterTitleBn: string;
  chapterSubtitleBn: string;
  partsBn: string;
  partsAr: string;
  arabicNorm: string;
  quranRefTextBn: string;
  quranRefTextLatin: string;
  chapterAliasesLatin: string;
  allBn: string;
  allLatin: string;
  allAr: string;
  allTokens: string[];
}

let cachedSurahIndex: IndexedSurah[] | null = null;
let cachedChapterIndex: IndexedDuaChapter[] | null = null;
let cachedDuaIndex: IndexedDua[] | null = null;

function stripArabicDefiniteArticle(latin: string): string {
  return latin.replace(/^(al|ar|as|an|at|ad|az|ash|adh|ath|ali)\s+/, '');
}

function getSurahIndex(): IndexedSurah[] {
  if (cachedSurahIndex) return cachedSurahIndex;

  cachedSurahIndex = SURAHS.map((surah) => {
    const idStr = String(surah.id);
    const nameBn = normalizeBanglaForSearch(surah.nameBangla);
    const meaningBn = normalizeBanglaForSearch(surah.meaningBangla);
    const nameAr = normalizeArabicForSearch(surah.nameArabic);
    const nameLatin = normalizeLatinForSearch(surah.nameSimple);
    const nameLatinBare = stripArabicDefiniteArticle(nameLatin);
    const nameLatinPhonetic = compactLatinPhonetic(nameLatinBare);
    const extras = SURAH_EXTRA_ALIASES[surah.id] ?? [];
    const aliasesBn = normalizeBanglaForSearch(extras.join(' '));
    const aliasesLatin = normalizeLatinForSearch(extras.join(' '));
    const aliasesPhonetic = [
      nameLatinPhonetic,
      compactLatinPhonetic(nameLatin),
      ...extras.filter(hasLatinChars).map((e) => compactLatinPhonetic(e)),
    ].filter(Boolean);
    const revBn =
      surah.revelationPlace === 'makkah' ? 'মক্কি মক্কা' : 'মাদানি মদিনা';
    const revLatin =
      surah.revelationPlace === 'makkah' ? 'makkah makki mecca' : 'madinah madani medina';

    const allTokens = Array.from(
      new Set(
        [
          idStr,
          ...nameBn.split(' '),
          ...meaningBn.split(' '),
          ...nameAr.split(' '),
          ...nameLatin.split(' '),
          ...nameLatinBare.split(' '),
          ...aliasesBn.split(' '),
          ...aliasesLatin.split(' '),
          ...revBn.split(' '),
          ...revLatin.split(' '),
          ...aliasesPhonetic,
        ].filter(Boolean)
      )
    );

    return {
      surah,
      idStr,
      nameBn,
      meaningBn,
      nameAr,
      nameLatin,
      nameLatinBare,
      nameLatinPhonetic,
      aliasesBn,
      aliasesLatin,
      aliasesPhonetic,
      revBn,
      revLatin,
      allTokens,
    };
  });

  return cachedSurahIndex;
}

function getDuaChapterIndex(): IndexedDuaChapter[] {
  if (cachedChapterIndex) return cachedChapterIndex;

  cachedChapterIndex = DUA_CHAPTERS.map((chapter) => {
    const titleBn = normalizeBanglaForSearch(chapter.titleBangla);
    const subtitleBn = normalizeBanglaForSearch(chapter.subtitleBangla);
    const aliasesLatin = normalizeLatinForSearch(
      (DUA_CHAPTER_ALIASES[chapter.id] ?? []).join(' ')
    );
    const allTokens = Array.from(
      new Set(
        [
          String(chapter.id),
          ...titleBn.split(' '),
          ...subtitleBn.split(' '),
          ...aliasesLatin.split(' '),
        ].filter(Boolean)
      )
    );
    return {
      chapter,
      count: DUAS_BY_CHAPTER[chapter.id]?.length ?? 0,
      titleBn,
      subtitleBn,
      aliasesLatin,
      allTokens,
    };
  });

  return cachedChapterIndex;
}

function getDuaIndex(): IndexedDua[] {
  if (cachedDuaIndex) return cachedDuaIndex;

  cachedDuaIndex = DUAS.map((dua) => {
    const chapter = DUA_CHAPTER_MAP[dua.chapterId];
    const titleBn = normalizeBanglaForSearch(dua.titleBangla);
    const translitBn = normalizeBanglaForSearch(dua.transliteration ?? '');
    const translationBn = normalizeBanglaForSearch(dua.translationBangla);
    const occasionBn = normalizeBanglaForSearch(dua.occasionNote ?? '');
    const referenceBn = normalizeBanglaForSearch(dua.reference ?? '');
    const chapterTitleBn = normalizeBanglaForSearch(chapter?.titleBangla ?? '');
    const chapterSubtitleBn = normalizeBanglaForSearch(
      chapter?.subtitleBangla ?? ''
    );
    const partsBn = normalizeBanglaForSearch(
      (dua.parts ?? [])
        .map((p) => `${p.transliteration ?? ''} ${p.translationBangla}`)
        .join(' ')
    );
    const partsAr = normalizeArabicForSearch(
      (dua.parts ?? []).map((p) => p.arabic).join(' ')
    );
    const arabicNorm = normalizeArabicForSearch(dua.arabic);

    let quranRefTextBn = '';
    let quranRefTextLatin = '';
    if (dua.quranRef) {
      const s = SURAH_MAP[dua.quranRef.surahId];
      if (s) {
        quranRefTextBn = normalizeBanglaForSearch(
          `${s.nameBangla} ${dua.quranRef.surahId} ${dua.quranRef.startAyah} ${dua.quranRef.endAyah}`
        );
        quranRefTextLatin = normalizeLatinForSearch(
          `${s.nameSimple} ${dua.quranRef.surahId}:${dua.quranRef.startAyah} ${(SURAH_EXTRA_ALIASES[s.id] ?? []).join(' ')}`
        );
      }
    }

    const chapterAliasesLatin = normalizeLatinForSearch(
      (DUA_CHAPTER_ALIASES[dua.chapterId] ?? []).join(' ')
    );

    const allBn = [
      titleBn,
      translitBn,
      occasionBn,
      chapterTitleBn,
      chapterSubtitleBn,
      translationBn,
      referenceBn,
      partsBn,
      quranRefTextBn,
    ]
      .filter(Boolean)
      .join(' ');

    const allLatin = [
      normalizeLatinForSearch(dua.id.replace(/^ch\d+-/, '')),
      chapterAliasesLatin,
      quranRefTextLatin,
    ]
      .filter(Boolean)
      .join(' ');

    const allAr = [arabicNorm, partsAr].filter(Boolean).join(' ');

    const allTokens = Array.from(
      new Set(
        [
          ...allBn.split(' '),
          ...allLatin.split(' '),
          ...allAr.split(' '),
        ].filter(Boolean)
      )
    );

    return {
      dua,
      chapter,
      titleBn,
      translitBn,
      translationBn,
      occasionBn,
      referenceBn,
      chapterTitleBn,
      chapterSubtitleBn,
      partsBn,
      partsAr,
      arabicNorm,
      quranRefTextBn,
      quranRefTextLatin,
      chapterAliasesLatin,
      allBn,
      allLatin,
      allAr,
      allTokens,
    };
  });

  return cachedDuaIndex;
}

/* ============================================================================
 * 4. Query Parsing & Token Expansion
 * ========================================================================== */

interface ParsedQuery {
  raw: string;
  ascii: string;
  bn: string;
  ar: string;
  latin: string;
  latinCompact: string;
  /** Each item represents one query word and its normalized synonym alternatives. */
  tokenGroups: string[][];
  /** Same as tokenGroups but with generic type-hint words (সূরা, দুআ, surah...) removed if others exist. */
  meaningfulGroups: string[][];
  isArabicQuery: boolean;
}

function parseQuery(rawInput: string): ParsedQuery {
  const raw = rawInput.trim();
  const ascii = toAsciiDigits(raw);
  const bn = normalizeBanglaForSearch(raw);
  const ar = normalizeArabicForSearch(raw);
  const latin = normalizeLatinForSearch(raw);
  const latinCompact = compactLatinPhonetic(raw);
  const isArabicQuery = hasArabicChars(raw) && !hasBanglaChars(raw) && !hasLatinChars(raw);

  const baseText = isArabicQuery ? ar : bn || latin;
  const rawWords = baseText.split(/\s+/).filter(Boolean);

  const tokenGroups: string[][] = rawWords.map((w) => {
    const alts = new Set<string>([w]);
    const stemmed = stemBanglaToken(w);
    if (stemmed !== w) alts.add(stemmed);

    if (hasLatinChars(w)) {
      const lat = normalizeLatinForSearch(w);
      if (lat) alts.add(lat);
      const compact = compactLatinPhonetic(w);
      if (compact) alts.add(compact);

      const syns = QUERY_SYNONYMS[lat] ?? QUERY_SYNONYMS[compact];
      if (syns) {
        for (const s of syns) {
          const ns = normalizeBanglaForSearch(s);
          if (ns) {
            for (const part of ns.split(' ')) alts.add(part);
          }
        }
      }
    } else if (hasBanglaChars(w)) {
      // Also check direct Bangla stem synonyms if any
      const syns = QUERY_SYNONYMS[w] ?? QUERY_SYNONYMS[stemmed];
      if (syns) {
        for (const s of syns) {
          const ns = normalizeBanglaForSearch(s);
          if (ns) alts.add(ns);
        }
      }
    }

    return Array.from(alts).filter(Boolean);
  });

  // Also check full-phrase synonyms (e.g. "ayatul kursi", "4 qul", "99 names")
  const phraseKey = latinCompact;
  if (phraseKey && QUERY_SYNONYMS[phraseKey]) {
    const extra = QUERY_SYNONYMS[phraseKey].map((s) => normalizeBanglaForSearch(s));
    if (tokenGroups.length === 1) {
      for (const e of extra) {
        for (const p of e.split(' ')) {
          if (!tokenGroups[0].includes(p)) tokenGroups[0].push(p);
        }
      }
    }
  }

  const filtered = tokenGroups.filter(
    (group) => !group.every((alt) => TYPE_HINT_WORDS.has(alt))
  );
  const meaningfulGroups = filtered.length > 0 ? filtered : tokenGroups;

  return {
    raw,
    ascii,
    bn,
    ar,
    latin,
    latinCompact,
    tokenGroups,
    meaningfulGroups,
    isArabicQuery,
  };
}

function tokenMatchesHaystack(
  alts: string[],
  haystack: string,
  tokens: string[],
  allowFuzzy: boolean
): 'exact' | 'prefix' | 'contains' | 'fuzzy' | null {
  if (!haystack) return null;
  let best: 'exact' | 'prefix' | 'contains' | 'fuzzy' | null = null;

  for (const alt of alts) {
    if (!alt) continue;
    if (haystack === alt) return 'exact';

    for (const tok of tokens) {
      if (tok === alt) return 'exact';
      if (tok.startsWith(alt) && alt.length >= 2) {
        best = 'prefix';
      }
    }

    if (!best && haystack.includes(alt)) {
      best = 'contains';
    }
  }

  if (best) return best;

  if (allowFuzzy) {
    for (const alt of alts) {
      if (alt.length < 4) continue;
      const maxDist = alt.length >= 7 ? 2 : 1;
      for (const tok of tokens) {
        if (tok.length < 4 || Math.abs(tok.length - alt.length) > maxDist) continue;
        if (levenshtein(alt, tok, maxDist) <= maxDist) {
          return 'fuzzy';
        }
      }
    }
  }

  return null;
}

/* ============================================================================
 * 5. Smart Direct Jumps (Ayah, Surah+Ayah, Range, Juz, Page, Famous Ayahs)
 * ========================================================================== */

export type SmartJumpKind = 'ayah' | 'juz' | 'page' | 'famous';

export interface SmartJumpResult {
  id: string;
  kind: SmartJumpKind;
  titleBangla: string;
  subtitleBangla: string;
  surah: SurahMeta;
  ayah: number;
  endAyah?: number;
  juz?: number;
  page?: number;
}

function findBestSurahByFragment(fragment: string): SurahMeta | null {
  const clean = fragment.trim();
  if (!clean) return null;
  const ascii = toAsciiDigits(clean);
  if (/^\d{1,3}$/.test(ascii)) {
    const num = Number.parseInt(ascii, 10);
    return SURAH_MAP[num] ?? null;
  }

  const bn = normalizeBanglaForSearch(clean);
  const latin = normalizeLatinForSearch(clean);
  const bareLatin = stripArabicDefiniteArticle(latin);
  const compact = compactLatinPhonetic(bareLatin);
  const stemmedBn = stemBanglaToken(bn);

  const index = getSurahIndex();
  let bestMatch: { surah: SurahMeta; score: number } | null = null;

  for (const item of index) {
    let score = 0;
    const bnBare = item.nameBn.replace(/^(আল|আর|আস|আন|আত|আদ|আজ|আশ)\s+/, '');

    if (
      item.nameBn === bn ||
      bnBare === bn ||
      bnBare === stemmedBn ||
      item.nameLatin === latin ||
      item.nameLatinBare === bareLatin ||
      item.aliasesPhonetic.includes(compact)
    ) {
      score = 100;
    } else if (
      (bn.length >= 2 && (item.nameBn.startsWith(bn) || bnBare.startsWith(bn) || bnBare.startsWith(stemmedBn))) ||
      (bareLatin.length >= 2 && item.nameLatinBare.startsWith(bareLatin)) ||
      (compact.length >= 3 && item.aliasesPhonetic.some((a) => a.startsWith(compact)))
    ) {
      score = 75;
    } else if (
      (bn.length >= 2 && (item.nameBn.includes(bn) || item.aliasesBn.includes(bn))) ||
      (bareLatin.length >= 3 && (item.nameLatin.includes(bareLatin) || item.aliasesLatin.includes(bareLatin)))
    ) {
      score = 50;
    } else if (compact.length >= 4) {
      for (const alias of item.aliasesPhonetic) {
        if (alias.length >= 4 && levenshtein(compact, alias, 1) <= 1) {
          score = 35;
          break;
        }
      }
    }

    if (score > (bestMatch?.score ?? 0)) {
      bestMatch = { surah: item.surah, score };
    }
  }

  return bestMatch && bestMatch.score >= 35 ? bestMatch.surah : null;
}

export function parseSmartJumps(rawInput: string): SmartJumpResult[] {
  const raw = rawInput.trim();
  if (!raw) return [];
  const ascii = toAsciiDigits(raw);
  const jumps: SmartJumpResult[] = [];
  const seen = new Set<string>();

  const pushUnique = (item: SmartJumpResult) => {
    const key = `${item.kind}:${item.surah.id}:${item.ayah}`;
    if (seen.has(key)) return;
    seen.add(key);
    jumps.push(item);
  };

  // 1. Numeric Ayah Jump: "2:255", "২:২৫৫", "আয়াত ২:২৫৫", "ayah 2:255", "2:285-286"
  const numAyahMatch =
    /^(?:(?:আয়াত|আযাত|ayah|ayat|সূরা|সুরা|surah|sura)\s+)?(\d{1,3})\s*[:./-]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/i.exec(
      ascii
    );
  if (numAyahMatch) {
    const surahId = Number.parseInt(numAyahMatch[1], 10);
    const startAyah = Number.parseInt(numAyahMatch[2], 10);
    const endAyahRaw = numAyahMatch[3]
      ? Number.parseInt(numAyahMatch[3], 10)
      : undefined;
    const surah = SURAH_MAP[surahId];
    if (surah && startAyah >= 1 && startAyah <= surah.versesCount) {
      const endAyah =
        endAyahRaw && endAyahRaw >= startAyah && endAyahRaw <= surah.versesCount
          ? endAyahRaw
          : undefined;
      pushUnique({
        id: `ayah-${surah.id}-${startAyah}`,
        kind: 'ayah',
        titleBangla: `সূরা ${surah.nameBangla} • আয়াত ${toBanglaDigits(startAyah)}${
          endAyah ? `–${toBanglaDigits(endAyah)}` : ''
        }`,
        subtitleBangla: 'সরাসরি আয়াতে যান',
        surah,
        ayah: startAyah,
        endAyah,
      });
    }
  }

  // 2. Juz / Para Jump: "পারা ৩০", "juz 30", "para 1", "জুজ ১৫", "আম্মাপারা"
  const juzMatch =
    /^(?:পারা|জুজ|juz|para|sipara)\s*[:#-]?\s*(\d{1,2})$/i.exec(ascii) ??
    /^(\d{1,2})\s*(?:নং|তম)?\s*(?:পারা|জুজ|juz|para)$/i.exec(ascii);
  if (juzMatch) {
    const juzNum = Number.parseInt(juzMatch[1], 10);
    const info = JUZ_START_MAP[juzNum];
    const surah = info ? SURAH_MAP[info.surahId] : undefined;
    if (info && surah) {
      pushUnique({
        id: `juz-${juzNum}`,
        kind: 'juz',
        titleBangla: `পারা ${toBanglaDigits(juzNum)}`,
        subtitleBangla: `শুরু: সূরা ${surah.nameBangla} • আয়াত ${toBanglaDigits(info.ayah)}`,
        surah,
        ayah: info.ayah,
        juz: juzNum,
      });
    }
  }

  // 3. Mushaf Page Jump: "পৃষ্ঠা ৬০৪", "page 42", "পৃ ৪২", "p 255"
  const pageMatch =
    /^(?:পৃষ্ঠা|পৃঃ|পৃ|পেজ|page|pg|p)\s*[:#-]?\s*(\d{1,3})$/i.exec(ascii) ??
    /^(\d{1,3})\s*(?:নং)?\s*(?:পৃষ্ঠা|পেজ|page)$/i.exec(ascii);
  if (pageMatch) {
    const pageNum = Number.parseInt(pageMatch[1], 10);
    if (pageNum >= 1 && pageNum <= 604) {
      // Find first surah whose page range includes pageNum
      const matchingSurahs = SURAHS.filter(
        (s) => pageNum >= s.pages[0] && pageNum <= s.pages[1]
      );
      const target = matchingSurahs[0];
      if (target) {
        pushUnique({
          id: `page-${pageNum}`,
          kind: 'page',
          titleBangla: `মুসহাফ পৃষ্ঠা ${toBanglaDigits(pageNum)}`,
          subtitleBangla: `সূরা ${target.nameBangla}${
            matchingSurahs.length > 1
              ? ` ও আরও ${toBanglaDigits(matchingSurahs.length - 1)}টি সূরা`
              : ''
          }`,
          surah: target,
          ayah: 1,
          page: pageNum,
        });
      }
    }
  }

  // 4. Surah Name + Ayah: "বাকারা ২৫৫", "সূরা বাকারা ২৫৫", "baqarah 255", "kahf 10", "সূরা ২ আয়াত ২৫৫"
  if (!numAyahMatch && !juzMatch && !pageMatch) {
    const namedAyahMatch =
      /^(?:সূরা|সুরা|surah|sura)?\s*(.+?)\s*(?:আয়াত|আযাত|ayah|ayat|:|\s)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/i.exec(
        ascii
      );
    if (namedAyahMatch) {
      const surahPart = namedAyahMatch[1].trim();
      const startAyah = Number.parseInt(namedAyahMatch[2], 10);
      const endAyahRaw = namedAyahMatch[3]
        ? Number.parseInt(namedAyahMatch[3], 10)
        : undefined;
      if (surahPart.length >= 2) {
        const surah = findBestSurahByFragment(surahPart);
        if (surah && startAyah >= 1 && startAyah <= surah.versesCount) {
          const endAyah =
            endAyahRaw &&
            endAyahRaw >= startAyah &&
            endAyahRaw <= surah.versesCount
              ? endAyahRaw
              : undefined;
          pushUnique({
            id: `named-ayah-${surah.id}-${startAyah}`,
            kind: 'ayah',
            titleBangla: `সূরা ${surah.nameBangla} • আয়াত ${toBanglaDigits(startAyah)}${
              endAyah ? `–${toBanglaDigits(endAyah)}` : ''
            }`,
            subtitleBangla: 'সরাসরি আয়াতে যান',
            surah,
            ayah: startAyah,
            endAyah,
          });
        }
      }
    }
  }

  // 5. Famous Ayah Shortcuts (e.g., "আয়াতুল কুরসি", "ayatul kursi", "amanar rasul")
  const bnQ = normalizeBanglaForSearch(raw);
  const latinQ = normalizeLatinForSearch(raw);
  const compactQ = compactLatinPhonetic(raw);
  const arQ = normalizeArabicForSearch(raw);

  if (raw.length >= 3) {
    for (const famous of FAMOUS_AYAHS) {
      const matched = famous.keywords.some((kw) => {
        if (hasArabicChars(kw) && arQ) {
          const kwAr = normalizeArabicForSearch(kw);
          return kwAr.includes(arQ) || arQ.includes(kwAr);
        }
        if (hasBanglaChars(kw) && bnQ) {
          const kwBn = normalizeBanglaForSearch(kw);
          return (
            kwBn === bnQ ||
            (bnQ.length >= 4 && (kwBn.includes(bnQ) || bnQ.includes(kwBn)))
          );
        }
        if (hasLatinChars(kw) && latinQ) {
          const kwLat = normalizeLatinForSearch(kw);
          const kwComp = compactLatinPhonetic(kw);
          return (
            kwLat === latinQ ||
            kwComp === compactQ ||
            (latinQ.length >= 4 &&
              (kwLat.includes(latinQ) ||
                latinQ.includes(kwLat) ||
                kwComp.includes(compactQ)))
          );
        }
        return false;
      });

      if (matched) {
        const surah = SURAH_MAP[famous.surahId];
        if (surah) {
          pushUnique({
            id: `famous-${famous.id}`,
            kind: 'famous',
            titleBangla: famous.labelBangla,
            subtitleBangla: famous.subtitleBangla,
            surah,
            ayah: famous.ayah,
          });
        }
      }
    }
  }

  return jumps;
}

/* ============================================================================
 * 6. Scored Entity Searchers (Surahs, Duas, Chapters, Routines, App Actions)
 * ========================================================================== */

export interface SurahSearchResult {
  surah: SurahMeta;
  score: number;
  matchHint?: string;
}

export function searchSurahs(rawQuery: string): SurahSearchResult[] {
  const pq = parseQuery(rawQuery);
  if (!pq.raw) return [];

  const index = getSurahIndex();
  const results: SurahSearchResult[] = [];

  for (const item of index) {
    let score = 0;
    let matchHint: string | undefined;

    // 1. Exact ID match
    if (pq.ascii === item.idStr) {
      score += 140;
    } else if (/^\d+$/.test(pq.ascii) && item.idStr.includes(pq.ascii)) {
      score += 45;
    }

    // 2. Full query exact / prefix boosts
    if (pq.bn && item.nameBn === pq.bn) score += 120;
    else if (pq.bn && item.nameBn.startsWith(pq.bn)) score += 85;
    else if (pq.bn && item.nameBn.includes(pq.bn)) score += 65;

    if (pq.latin && (item.nameLatin === pq.latin || item.nameLatinBare === pq.latin)) {
      score += 120;
    } else if (
      pq.latinCompact &&
      item.aliasesPhonetic.includes(pq.latinCompact)
    ) {
      score += 110;
    } else if (
      pq.latinCompact.length >= 2 &&
      item.aliasesPhonetic.some((a) => a.startsWith(pq.latinCompact))
    ) {
      score += 80;
    }

    if (pq.ar && item.nameAr.includes(pq.ar)) {
      score += item.nameAr === pq.ar ? 120 : 80;
    }

    // 3. Multi-word token matching (all meaningful tokens must match)
    if (score === 0) {
      let allMatched = true;
      let tokenScore = 0;

      for (const group of pq.meaningfulGroups) {
        const nameHit = tokenMatchesHaystack(
          group,
          `${item.nameBn} ${item.nameLatin} ${item.nameAr}`,
          [
            ...item.nameBn.split(' '),
            ...item.nameLatin.split(' '),
            ...item.nameLatinBare.split(' '),
            ...item.nameAr.split(' '),
          ],
          true
        );
        if (nameHit) {
          tokenScore +=
            nameHit === 'exact'
              ? 60
              : nameHit === 'prefix'
                ? 48
                : nameHit === 'contains'
                  ? 38
                  : 18;
          continue;
        }

        const aliasHit = tokenMatchesHaystack(
          group,
          `${item.aliasesBn} ${item.aliasesLatin} ${item.aliasesPhonetic.join(' ')}`,
          [
            ...item.aliasesBn.split(' '),
            ...item.aliasesLatin.split(' '),
            ...item.aliasesPhonetic,
          ],
          true
        );
        if (aliasHit) {
          tokenScore += aliasHit === 'exact' ? 52 : aliasHit === 'fuzzy' ? 16 : 36;
          continue;
        }

        const meaningHit = tokenMatchesHaystack(
          group,
          item.meaningBn,
          item.meaningBn.split(' '),
          false
        );
        if (meaningHit) {
          tokenScore += meaningHit === 'exact' ? 32 : 24;
          matchHint = `অর্থ: ${item.surah.meaningBangla}`;
          continue;
        }

        const revHit = tokenMatchesHaystack(
          group,
          `${item.revBn} ${item.revLatin}`,
          [...item.revBn.split(' '), ...item.revLatin.split(' ')],
          false
        );
        if (revHit) {
          tokenScore += 18;
          matchHint =
            item.surah.revelationPlace === 'makkah' ? 'মক্কী সূরা' : 'মাদানী সূরা';
          continue;
        }

        // Check numeric ID inside multi-word query (e.g. "সূরা ৩৬")
        if (group.some((alt) => alt === item.idStr)) {
          tokenScore += 70;
          continue;
        }

        allMatched = false;
        break;
      }

      if (allMatched && tokenScore > 0) {
        score += tokenScore;
      }
    }

    if (score > 0) {
      results.push({ surah: item.surah, score, matchHint });
    }
  }

  results.sort((a, b) => b.score - a.score || a.surah.id - b.surah.id);
  return results;
}

export interface DuaChapterSearchResult {
  chapter: DuaChapter;
  duaCount: number;
  score: number;
}

export function searchDuaChapters(rawQuery: string): DuaChapterSearchResult[] {
  const pq = parseQuery(rawQuery);
  if (!pq.raw) return [];

  const index = getDuaChapterIndex();
  const results: DuaChapterSearchResult[] = [];

  for (const item of index) {
    let score = 0;

    if (pq.bn && item.titleBn.includes(pq.bn)) {
      score += item.titleBn.startsWith(pq.bn) ? 100 : 75;
    } else if (pq.bn && item.subtitleBn.includes(pq.bn)) {
      score += 55;
    }

    if (score === 0) {
      let allMatched = true;
      let tokenScore = 0;
      for (const group of pq.meaningfulGroups) {
        const titleHit = tokenMatchesHaystack(
          group,
          item.titleBn,
          item.titleBn.split(' '),
          true
        );
        if (titleHit) {
          tokenScore += titleHit === 'exact' ? 55 : titleHit === 'fuzzy' ? 18 : 40;
          continue;
        }
        const subHit = tokenMatchesHaystack(
          group,
          `${item.subtitleBn} ${item.aliasesLatin}`,
          [...item.subtitleBn.split(' '), ...item.aliasesLatin.split(' ')],
          true
        );
        if (subHit) {
          tokenScore += subHit === 'exact' ? 38 : subHit === 'fuzzy' ? 14 : 26;
          continue;
        }
        allMatched = false;
        break;
      }
      if (allMatched && tokenScore > 0) score += tokenScore;
    }

    if (score > 0) {
      results.push({ chapter: item.chapter, duaCount: item.count, score });
    }
  }

  results.sort((a, b) => b.score - a.score || a.chapter.id - b.chapter.id);
  return results;
}

export type DuaMatchField =
  | 'title'
  | 'occasion'
  | 'chapter'
  | 'transliteration'
  | 'translation'
  | 'reference'
  | 'arabic'
  | 'parts';

export interface DuaSearchResult {
  dua: DuaItem;
  chapter?: DuaChapter;
  score: number;
  matchField: DuaMatchField;
  snippet?: string;
}

function extractContextSnippet(
  text: string,
  terms: string[],
  maxLen = 115
): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;

  const lowerClean = clean.toLowerCase();
  const normClean = normalizeBanglaForSearch(clean);
  let pos = -1;

  for (const t of terms) {
    if (!t || t.length < 2) continue;
    const directIdx = lowerClean.indexOf(t.toLowerCase());
    if (directIdx !== -1) {
      pos = directIdx;
      break;
    }
    const normIdx = normClean.indexOf(t);
    if (normIdx !== -1) {
      // Approximate proportional offset into original text
      pos = Math.floor((normIdx / Math.max(1, normClean.length)) * clean.length);
      break;
    }
  }

  if (pos <= 30) {
    return `${clean.slice(0, maxLen).trim()}…`;
  }
  const start = Math.max(0, pos - 34);
  const end = Math.min(clean.length, start + maxLen);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < clean.length ? '…' : '';
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

export function searchDuas(
  rawQuery: string,
  options?: {
    chapterId?: number | null;
    bookmarkedIds?: ReadonlySet<string>;
  }
): DuaSearchResult[] {
  const pq = parseQuery(rawQuery);
  if (!pq.raw) return [];

  const index = getDuaIndex();
  const chapterFilter = options?.chapterId ?? null;
  const bookmarkedIds = options?.bookmarkedIds;
  const flatHighlightTerms = pq.meaningfulGroups.flat();

  const results: DuaSearchResult[] = [];

  for (const item of index) {
    if (chapterFilter !== null && item.dua.chapterId !== chapterFilter) {
      continue;
    }

    let score = 0;
    let primaryField: DuaMatchField | null = null;
    let bestFieldScore = -1;

    const recordField = (field: DuaMatchField, pts: number) => {
      score += pts;
      if (pts > bestFieldScore) {
        bestFieldScore = pts;
        primaryField = field;
      }
    };

    // Exact phrase boosts
    if (pq.bn && item.titleBn === pq.bn) {
      recordField('title', 130);
    } else if (pq.bn && item.titleBn.startsWith(pq.bn)) {
      recordField('title', 95);
    } else if (pq.bn && item.titleBn.includes(pq.bn)) {
      recordField('title', 75);
    }

    if (pq.ar && pq.ar.length >= 2) {
      if (item.arabicNorm.includes(pq.ar)) {
        recordField('arabic', 90);
      } else if (item.partsAr.includes(pq.ar)) {
        recordField('parts', 75);
      }
    }

    // Token-by-token AND matching across all fields
    let allTokensMatched = true;
    let tokenTotal = 0;

    for (const group of pq.meaningfulGroups) {
      // 1. Title
      const titleHit = tokenMatchesHaystack(
        group,
        item.titleBn,
        item.titleBn.split(' '),
        true
      );
      if (titleHit) {
        const pts =
          titleHit === 'exact'
            ? 58
            : titleHit === 'prefix'
              ? 46
              : titleHit === 'contains'
                ? 36
                : 16;
        tokenTotal += pts;
        if (pts > bestFieldScore) {
          bestFieldScore = pts;
          primaryField = 'title';
        }
        continue;
      }

      // 2. Arabic body (harakat-stripped)
      if (pq.isArabicQuery || group.some(hasArabicChars)) {
        const arHit = tokenMatchesHaystack(
          group,
          item.allAr,
          item.allAr.split(' '),
          false
        );
        if (arHit) {
          const pts = arHit === 'exact' ? 50 : 38;
          tokenTotal += pts;
          if (pts > bestFieldScore) {
            bestFieldScore = pts;
            primaryField = item.arabicNorm.includes(group[0]) ? 'arabic' : 'parts';
          }
          continue;
        }
      }

      // 3. Occasion note
      const occHit = tokenMatchesHaystack(
        group,
        item.occasionBn,
        item.occasionBn.split(' '),
        false
      );
      if (occHit) {
        const pts = occHit === 'exact' ? 36 : 26;
        tokenTotal += pts;
        if (pts > bestFieldScore) {
          bestFieldScore = pts;
          primaryField = 'occasion';
        }
        continue;
      }

      // 4. Transliteration (Bangla pronunciation)
      const translitHit = tokenMatchesHaystack(
        group,
        item.translitBn,
        item.translitBn.split(' '),
        true
      );
      if (translitHit) {
        const pts = translitHit === 'exact' ? 34 : translitHit === 'fuzzy' ? 12 : 24;
        tokenTotal += pts;
        if (pts > bestFieldScore) {
          bestFieldScore = pts;
          primaryField = 'transliteration';
        }
        continue;
      }

      // 5. Chapter title / subtitle / Banglish aliases / QuranRef
      const chapterHit = tokenMatchesHaystack(
        group,
        `${item.chapterTitleBn} ${item.chapterSubtitleBn} ${item.allLatin} ${item.quranRefTextBn}`,
        [
          ...item.chapterTitleBn.split(' '),
          ...item.chapterSubtitleBn.split(' '),
          ...item.allLatin.split(' '),
          ...item.quranRefTextBn.split(' '),
        ],
        false
      );
      if (chapterHit) {
        const pts = chapterHit === 'exact' ? 30 : 20;
        tokenTotal += pts;
        if (pts > bestFieldScore) {
          bestFieldScore = pts;
          primaryField = 'chapter';
        }
        continue;
      }

      // 6. Parts (multi-part tasbih/duas)
      if (item.partsBn) {
        const partsHit = tokenMatchesHaystack(
          group,
          item.partsBn,
          item.partsBn.split(' '),
          false
        );
        if (partsHit) {
          const pts = 22;
          tokenTotal += pts;
          if (pts > bestFieldScore) {
            bestFieldScore = pts;
            primaryField = 'parts';
          }
          continue;
        }
      }

      // 7. Translation Bangla
      const transHit = tokenMatchesHaystack(
        group,
        item.translationBn,
        item.translationBn.split(' '),
        false
      );
      if (transHit) {
        const pts = transHit === 'exact' ? 22 : 15;
        tokenTotal += pts;
        if (pts > bestFieldScore) {
          bestFieldScore = pts;
          primaryField = 'translation';
        }
        continue;
      }

      // 8. Reference (Bukhari, Muslim, etc.)
      const refHit = tokenMatchesHaystack(
        group,
        item.referenceBn,
        item.referenceBn.split(' '),
        false
      );
      if (refHit) {
        const pts = 18;
        tokenTotal += pts;
        if (pts > bestFieldScore) {
          bestFieldScore = pts;
          primaryField = 'reference';
        }
        continue;
      }

      allTokensMatched = false;
      break;
    }

    if (!allTokensMatched && score === 0) continue;
    if (allTokensMatched) score += tokenTotal;

    if (score <= 0) continue;

    if (bookmarkedIds?.has(item.dua.id)) {
      score += 5;
    }

    const matchField: DuaMatchField = primaryField ?? 'title';
    let snippet: string | undefined;

    if (matchField === 'translation' && item.dua.translationBangla) {
      snippet = extractContextSnippet(
        item.dua.translationBangla,
        flatHighlightTerms
      );
    } else if (matchField === 'transliteration' && item.dua.transliteration) {
      snippet = extractContextSnippet(
        item.dua.transliteration,
        flatHighlightTerms
      );
    } else if (matchField === 'occasion' && item.dua.occasionNote) {
      snippet = item.dua.occasionNote;
    } else if (matchField === 'reference' && item.dua.reference) {
      snippet = item.dua.reference;
    } else if (matchField === 'arabic' && item.dua.arabic) {
      snippet = normalizeIndoPakText(item.dua.arabic);
    } else if (matchField === 'parts' && item.dua.parts?.length) {
      const joined = item.dua.parts
        .map((p) => p.transliteration || p.translationBangla)
        .join(' • ');
      snippet = extractContextSnippet(joined, flatHighlightTerms);
    }

    results.push({
      dua: item.dua,
      chapter: item.chapter,
      score,
      matchField,
      snippet,
    });
  }

  results.sort(
    (a, b) =>
      b.score - a.score ||
      a.dua.chapterId - b.dua.chapterId ||
      a.dua.order - b.dua.order
  );
  return results;
}

export interface RoutineSearchResult {
  routine: Routine;
  score: number;
  matchHint?: string;
}

export function searchRoutines(
  rawQuery: string,
  routines: Routine[]
): RoutineSearchResult[] {
  const pq = parseQuery(rawQuery);
  if (!pq.raw || routines.length === 0) return [];

  const results: RoutineSearchResult[] = [];

  for (const routine of routines) {
    const titleBn = normalizeBanglaForSearch(routine.title);
    const titleLatin = normalizeLatinForSearch(routine.title);

    const scheduleWords =
      routine.assignedDays.length === 7
        ? 'প্রতিদিন দৈনিক daily everyday'
        : routine.assignedDays.length === 0
          ? 'ম্যানুয়াল manual'
          : routine.assignedDays
              .map((d) => `${DAY_NAMES_BN[d]} ${DAY_SHORT_BN[d]}`)
              .join(' ');
    const scheduleBn = normalizeBanglaForSearch(scheduleWords);

    const items = getRoutineItems(routine);
    const itemEntries = items.map((it) => {
      const label = formatNormalizedRoutineItemLabel(it);
      let extraLatin = '';
      if (it.kind === 'surah') {
        const s = SURAH_MAP[it.surahId];
        if (s) {
          extraLatin = `${s.nameSimple} ${(SURAH_EXTRA_ALIASES[s.id] ?? []).join(' ')}`;
        }
      }
      return {
        label,
        bn: normalizeBanglaForSearch(label),
        latin: normalizeLatinForSearch(extraLatin),
      };
    });

    let score = 0;
    let matchHint: string | undefined;

    if (pq.bn && titleBn.includes(pq.bn)) {
      score += titleBn.startsWith(pq.bn) ? 105 : 80;
    } else if (pq.latin && titleLatin.includes(pq.latin)) {
      score += 75;
    }

    if (score === 0) {
      let allMatched = true;
      let tokenScore = 0;

      for (const group of pq.meaningfulGroups) {
        const titleHit = tokenMatchesHaystack(
          group,
          `${titleBn} ${titleLatin}`,
          [...titleBn.split(' '), ...titleLatin.split(' ')],
          true
        );
        if (titleHit) {
          tokenScore += titleHit === 'exact' ? 55 : titleHit === 'fuzzy' ? 16 : 38;
          continue;
        }

        const matchedChild = itemEntries.find((entry) =>
          Boolean(
            tokenMatchesHaystack(
              group,
              `${entry.bn} ${entry.latin}`,
              [...entry.bn.split(' '), ...entry.latin.split(' ')],
              false
            )
          )
        );
        if (matchedChild) {
          tokenScore += 30;
          matchHint = `অন্তর্ভুক্ত: ${matchedChild.label}`;
          continue;
        }

        const schedHit = tokenMatchesHaystack(
          group,
          scheduleBn,
          scheduleBn.split(' '),
          false
        );
        if (schedHit) {
          tokenScore += 22;
          matchHint =
            routine.assignedDays.length === 7
              ? 'প্রতিদিন নির্ধারিত'
              : routine.assignedDays.length === 0
                ? 'ম্যানুয়াল রুটিন'
                : routine.assignedDays.map((d) => DAY_NAMES_BN[d]).join(', ');
          continue;
        }

        allMatched = false;
        break;
      }

      if (allMatched && tokenScore > 0) score += tokenScore;
    }

    if (score > 0) {
      results.push({ routine, score, matchHint });
    }
  }

  results.sort((a, b) => b.score - a.score || b.routine.createdAt - a.routine.createdAt);
  return results;
}

export type AppActionId =
  | 'ramadan'
  | 'stats'
  | 'settings'
  | 'savedDuas'
  | 'surahsTab'
  | 'duasTab'
  | 'routinesTab'
  | 'lastRead';

export interface AppActionResult {
  id: AppActionId;
  titleBangla: string;
  subtitleBangla: string;
  score: number;
}

interface AppActionDef {
  id: Exclude<AppActionId, 'lastRead'>;
  titleBangla: string;
  subtitleBangla: string;
  keywords: string;
}

const STATIC_APP_ACTIONS: AppActionDef[] = [
  {
    id: 'ramadan',
    titleBangla: 'সেহরি ও ইফতারের সময়সূচী',
    subtitleBangla: 'রমজান ও হিজরি ক্যালেন্ডার',
    keywords:
      'সেহরি ইফতার রোজা রমজান হিজরি ক্যালেন্ডার সময়সূচী sehri sahri iftar ifter ramadan romjan roza fasting calendar schedule',
  },
  {
    id: 'stats',
    titleBangla: 'আমলের পরিসংখ্যান',
    subtitleBangla: 'দৈনিক তিলাওয়াত, জিকির, স্ট্রিক ও লক্ষ্য',
    keywords:
      'পরিসংখ্যান আমল স্ট্রিক দৈনিক লক্ষ্য তিলাওয়াত হিসাব stats statistics streak daily goal progress history',
  },
  {
    id: 'settings',
    titleBangla: 'সেটিংস ও অফলাইন ডাউনলোড',
    subtitleBangla: 'থিম, ফন্ট সাইজ, গ্লাস মোড ও লোকেশন',
    keywords:
      'সেটিংস থিম ডার্ক মোড ফন্ট সাইজ অফলাইন ডাউনলোড লোকেশন settings theme dark mode paper olive sky black font offline download location',
  },
  {
    id: 'savedDuas',
    titleBangla: 'সংরক্ষিত দুআ (বুকমার্ক)',
    subtitleBangla: 'আপনার বুকমার্ক করা দুআসমূহ',
    keywords:
      'সংরক্ষিত বুকমার্ক প্রিয় দুআ saved bookmark bookmarks favorite favourite dua',
  },
  {
    id: 'routinesTab',
    titleBangla: 'রুটিন পরিচালনা',
    subtitleBangla: 'দৈনিক ও সাপ্তাহিক আমলের রুটিন তৈরি ও এডিট',
    keywords:
      'নতুন রুটিন তৈরি পরিচালনা create routine manage routines schedule',
  },
];

export function searchAppActions(
  rawQuery: string,
  lastRead?: GlobalLastRead | null
): AppActionResult[] {
  const pq = parseQuery(rawQuery);
  if (!pq.raw) return [];

  const defs: Array<{
    id: AppActionId;
    titleBangla: string;
    subtitleBangla: string;
    keywords: string;
  }> = [...STATIC_APP_ACTIONS];

  if (lastRead && SURAH_MAP[lastRead.surahId]) {
    defs.unshift({
      id: 'lastRead',
      titleBangla: `সর্বশেষ তিলাওয়াত: সূরা ${lastRead.surahNameBangla}`,
      subtitleBangla: `আয়াত ${toBanglaDigits(lastRead.ayahNumber)} থেকে চালিয়ে যান`,
      keywords: `সর্বশেষ তিলাওয়াত চালিয়ে যান last read continue resume ${lastRead.surahNameBangla} ${SURAH_MAP[lastRead.surahId].nameSimple}`,
    });
  }

  const results: AppActionResult[] = [];
  for (const def of defs) {
    const kwBn = normalizeBanglaForSearch(def.keywords);
    const kwLat = normalizeLatinForSearch(def.keywords);
    const hay = `${kwBn} ${kwLat}`;
    const tokens = hay.split(' ').filter(Boolean);

    let allMatched = true;
    let score = 0;

    for (const group of pq.tokenGroups) {
      const hit = tokenMatchesHaystack(group, hay, tokens, false);
      if (!hit) {
        allMatched = false;
        break;
      }
      score += hit === 'exact' ? 50 : hit === 'prefix' ? 35 : 22;
    }

    if (allMatched && score > 0) {
      results.push({
        id: def.id,
        titleBangla: def.titleBangla,
        subtitleBangla: def.subtitleBangla,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/* ============================================================================
 * 7. Orchestrator & Safe Highlight Segmentation
 * ========================================================================== */

export interface LocalSearchResults {
  jumps: SmartJumpResult[];
  actions: AppActionResult[];
  routines: RoutineSearchResult[];
  surahs: SurahSearchResult[];
  chapters: DuaChapterSearchResult[];
  duas: DuaSearchResult[];
}

export function searchAllLocal(
  rawQuery: string,
  context: {
    routines: Routine[];
    bookmarkedDuaIds?: ReadonlySet<string>;
    lastRead?: GlobalLastRead | null;
  }
): LocalSearchResults {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return {
      jumps: [],
      actions: [],
      routines: [],
      surahs: [],
      chapters: [],
      duas: [],
    };
  }

  return {
    jumps: parseSmartJumps(trimmed),
    actions: searchAppActions(trimmed, context.lastRead),
    routines: searchRoutines(trimmed, context.routines),
    surahs: searchSurahs(trimmed),
    chapters: searchDuaChapters(trimmed),
    duas: searchDuas(trimmed, { bookmarkedIds: context.bookmarkedDuaIds }),
  };
}

/**
 * Builds an optimized query string for Quran.com online verse search,
 * or returns null when the query is a pure coordinate/juz/page jump.
 */
export function buildOnlineQuranQuery(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (trimmed.length < 2) return null;

  const ascii = toAsciiDigits(trimmed);
  // Skip pure numbers or direct coordinate/juz/page jumps
  if (/^[0-9\s:./-]+$/.test(ascii)) return null;
  if (
    /^(?:পারা|জুজ|juz|para|sipara)\s*[:#-]?\s*\d{1,2}$/i.test(ascii) ||
    /^\d{1,2}\s*(?:নং|তম)?\s*(?:পারা|জুজ|juz|para)$/i.test(ascii) ||
    /^(?:পৃষ্ঠা|পৃঃ|পৃ|পেজ|page|pg|p)\s*[:#-]?\s*\d{1,3}$/i.test(ascii) ||
    /^\d{1,3}\s*(?:নং)?\s*(?:পৃষ্ঠা|পেজ|page)$/i.test(ascii) ||
    /^(?:আয়াত|আযাত|ayah|ayat|সূরা|সুরা|surah|sura)\s+\d{1,3}\s*[:./-]\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?$/i.test(
      ascii
    )
  ) {
    return null;
  }

  // If query is pure Latin/Banglish with a curated Bangla synonym, translate to Bangla
  // so Quran.com's `language=bn` index finds Bangla translation matches!
  if (hasLatinChars(trimmed) && !hasBanglaChars(trimmed) && !hasArabicChars(trimmed)) {
    const words = normalizeLatinForSearch(trimmed).split(' ').filter(Boolean);
    const mapped: string[] = [];
    let anyMapped = false;
    for (const w of words) {
      if (TYPE_HINT_WORDS.has(w)) continue;
      const syns = QUERY_SYNONYMS[w] ?? QUERY_SYNONYMS[compactLatinPhonetic(w)];
      if (syns && syns.length > 0) {
        mapped.push(syns[0]);
        anyMapped = true;
      } else {
        mapped.push(w);
      }
    }
    if (anyMapped && mapped.length > 0) {
      return mapped.join(' ');
    }
  }

  return trimmed;
}

export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a search term into a Bangla spelling-variant-aware regex fragment
 * so searching "ইয়াসিন" still highlights "ইয়াসীন", "দোয়া" highlights "দুআ", etc.
 */
function termToFlexiblePattern(term: string): string {
  const clean = term
    .normalize('NFC')
    .replace(/য\u09bc/g, 'য়')
    .replace(/ড\u09bc/g, 'ড়')
    .replace(/ঢ\u09bc/g, 'ঢ়');

  if (!hasBanglaChars(clean)) {
    return escapeRegExp(clean);
  }

  // Handle common whole-word Islamic variants first
  const norm = normalizeBanglaForSearch(clean);
  if (norm === 'দুআ') return '(?:দুআ|দো(?:য়া|য়া)|দু(?:য়া|য়া)|দূআ)';
  if (norm === 'সুরা') return 'স[ুূ]রা';
  if (norm === 'কুরআন') return 'ক[ুো]রআ?ন';
  if (norm === 'রুকইয়া') return 'রুক(?:ই|আ|)[িী]?(?:য়া|য়া)হ?';
  if (norm === 'জিকির') return '[জয][িী]ক[িী]?র';

  let out = '';
  for (const ch of clean) {
    switch (ch) {
      case 'ি':
      case 'ী':
        out += '[িী]';
        break;
      case 'ু':
      case 'ূ':
        out += '[ুূ]';
        break;
      case 'ন':
      case 'ণ':
        out += '[নণ]';
        break;
      case 'স':
      case 'শ':
      case 'ষ':
        out += '[সশষ]';
        break;
      case 'জ':
      case 'য':
        out += '[জয]';
        break;
      case 'র':
      case 'ড়':
      case 'ঢ়':
        out += '(?:র|ড়|ঢ়|ড\u09bc|ঢ\u09bc)';
        break;
      case 'ত':
      case 'ৎ':
        out += '[তৎ]';
        break;
      case 'য়':
        out += '(?:য়|য\u09bc)';
        break;
      default:
        out += escapeRegExp(ch);
        break;
    }
  }
  return out;
}

/**
 * Splits display text into highlighted/plain segments safely (no HTML injection).
 * Matches direct query words, Bangla spelling variants (ি/ী, দুআ/দোয়া), and synonym expansions.
 */
export function getHighlightSegments(
  text: string,
  rawQuery: string
): HighlightSegment[] {
  if (!text || !rawQuery.trim()) {
    return [{ text, highlight: false }];
  }

  const pq = parseQuery(rawQuery);
  const candidates = new Set<string>();
  const rawWords = rawQuery
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[-_.,:;!?'"’‘“”()[\]{}/\\|।]+/g, ''))
    .filter((w) => w.length >= 2);
  const hasNonHintWord = rawWords.some(
    (w) => !TYPE_HINT_WORDS.has(normalizeBanglaForSearch(w))
  );

  for (const clean of rawWords) {
    if (hasNonHintWord && TYPE_HINT_WORDS.has(normalizeBanglaForSearch(clean))) {
      continue;
    }
    candidates.add(clean);
    const stemmed = stemBanglaToken(clean);
    if (stemmed.length >= 2) candidates.add(stemmed);
  }
  for (const group of pq.meaningfulGroups) {
    for (const alt of group) {
      if (alt.length >= 2 && (!hasNonHintWord || !TYPE_HINT_WORDS.has(alt))) {
        candidates.add(alt);
      }
    }
  }

  const terms = Array.from(candidates)
    .sort((a, b) => b.length - a.length)
    .slice(0, 12);

  if (terms.length === 0) return [{ text, highlight: false }];

  const regex = new RegExp(
    terms.map(termToFlexiblePattern).join('|'),
    'gi'
  );

  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    segments.push({ text: match[0], highlight: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) {
    return [{ text, highlight: false }];
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }
  return segments;
}
