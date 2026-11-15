import { DUAS_CHAPTER_6 } from './chapter6';
import { DUAS_CHAPTER_9 } from './chapter9';
import { DUAS_CHAPTER_10, RUQYAH_QURAN_ITEM_IDS } from './chapter10';
import { DUAS_CHAPTER_11 } from './chapter11';
import { DUAS_CHAPTER_12 } from './chapter12';
import { DUAS_CHAPTER_13 } from './chapter13';
import { DUAS_CHAPTERS_1_TO_3 } from './chapters1to3';
import { DUAS_CHAPTERS_4_TO_5 } from './chapters4to5';
import { DUAS_CHAPTERS_7_TO_8 } from './chapters7to8';
import type { DuaChapter, DuaItem } from './types';

export type { DuaChapter, DuaItem, QuranRef } from './types';
export { RUQYAH_QURAN_ITEM_IDS };

export const DUA_CHAPTERS: DuaChapter[] = [
  {
    id: 1,
    titleBangla: 'সকাল সন্ধ্যার দুআ ও জিকির',
    subtitleBangla: 'প্রথম অধ্যায় • হেফাজত, ইস্তেগফার ও দৈনিক জিকির',
  },
  {
    id: 2,
    titleBangla: 'পবিত্রতা, সালাত ও ইবাদত সংক্রান্ত দুআ',
    subtitleBangla: 'দ্বিতীয় অধ্যায় • ওযু, মসজিদ, সালাত, জানাজা ও হজ',
  },
  {
    id: 3,
    titleBangla: 'ঘুমের দুআ ও জিকির',
    subtitleBangla: 'তৃতীয় অধ্যায় • শোয়ার আমল, তাসবীহ ও ঘুম ভাঙার জিকির',
  },
  {
    id: 4,
    titleBangla: 'পানাহারের দুআ ও জিকির',
    subtitleBangla: 'চতুর্থ অধ্যায় • খাবার, পানি, দাওয়াত ও ইফতার',
  },
  {
    id: 5,
    titleBangla: 'পরিবার সংক্রান্ত দুআ ও জিকির',
    subtitleBangla: 'পঞ্চম অধ্যায় • বিবাহ, নেক সন্তান, নবজাতক ও পরিবার',
  },
  {
    id: 6,
    titleBangla: 'দৈনন্দিন জীবনের বিশেষ সময়ের দুআ',
    subtitleBangla: 'ষষ্ঠ অধ্যায় • পোশাক, মজলিস, ইস্তেখারা ও ৯৯ নাম',
  },
  {
    id: 7,
    titleBangla: 'সফর সংক্রান্ত দুআ ও জিকির',
    subtitleBangla: 'সপ্তম অধ্যায় • বের হওয়া, বাহন, বাজার ও ঘরে ফেরা',
  },
  {
    id: 8,
    titleBangla: 'বিপদ, দুশ্চিন্তা ও পেরেশানী থেকে মুক্তি',
    subtitleBangla: 'অষ্টম অধ্যায় • প্রয়োজন পূরণ, ঋণ ও বালা-মুসিবত',
  },
  {
    id: 9,
    titleBangla: 'অসুস্থতা সংক্রান্ত দুআ ও জিকির',
    subtitleBangla: 'নবম অধ্যায় • আরোগ্য, রোগী দেখা, বদনজর ও কবর জিয়ারত',
  },
  {
    id: 10,
    titleBangla: 'রুকইয়া ও অনিষ্ট থেকে আত্মরক্ষা',
    subtitleBangla: 'দশম অধ্যায় • কুরআনিক রুকইয়া ও হাদিসের ঝাড়ফুঁক',
  },
  {
    id: 11,
    titleBangla: 'নবীজির প্রতি বিশুদ্ধ ৪০টি দরুদ ও সালাম',
    subtitleBangla: 'একাদশ অধ্যায় • সালাত ও সালাম সংকলন',
  },
  {
    id: 12,
    titleBangla: 'নির্বাচিত ৩৩টি গুরুত্বপূর্ণ দুআ',
    subtitleBangla: 'দ্বাদশ অধ্যায় • কুরআন ও সুন্নাহর জামে দুআ',
  },
  {
    id: 13,
    titleBangla: 'প্রতি ওয়াক্ত নামাজের পরের দুআ ও আমল',
    subtitleBangla: 'ত্রয়োদশ অধ্যায় • ৫ ওয়াক্ত ফরজ সালাত, ফজর ও মাগরিবের আমল',
  },
];

export const DUAS: DuaItem[] = [
  ...DUAS_CHAPTERS_1_TO_3,
  ...DUAS_CHAPTERS_4_TO_5,
  ...DUAS_CHAPTER_6,
  ...DUAS_CHAPTERS_7_TO_8,
  ...DUAS_CHAPTER_9,
  ...DUAS_CHAPTER_10,
  ...DUAS_CHAPTER_11,
  ...DUAS_CHAPTER_12,
  ...DUAS_CHAPTER_13,
];

export const DUA_CHAPTER_MAP: Record<number, DuaChapter> = Object.fromEntries(
  DUA_CHAPTERS.map((ch) => [ch.id, ch])
);

export const DUA_MAP: Record<string, DuaItem> = Object.fromEntries(
  DUAS.map((dua) => [dua.id, dua])
);

export const DUAS_BY_CHAPTER: Record<number, DuaItem[]> = DUA_CHAPTERS.reduce(
  (acc, ch) => {
    acc[ch.id] = DUAS.filter((d) => d.chapterId === ch.id).sort(
      (a, b) => a.order - b.order
    );
    return acc;
  },
  {} as Record<number, DuaItem[]>
);
