import { DUA_MAP } from '../data/duas';
import { SURAH_MAP } from '../data/surahs';
import type { NormalizedRoutineItem } from '../db/database';

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toArabicDigits(num: number): string {
  return String(num)
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0) - 48;
      return code >= 0 && code <= 9 ? ARABIC_DIGITS[code] : ch;
    })
    .join('');
}

export function toBanglaDigits(num: number): string {
  return String(num)
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0) - 48;
      return code >= 0 && code <= 9 ? BANGLA_DIGITS[code] : ch;
    })
    .join('');
}

/**
 * Normalizes Quran.com IndoPak text so:
 * - trailing PUA ayah-number circles (\uF500-\uF61E) and their \u06DF marker
 *   are stripped cleanly (while keeping any waqf sign before them),
 * - em-spaces (\u2003) and stray BOMs (\ufeff) do not create wide gaps,
 * - legacy U+06E1 circle-sukun and U+0649 medial-yeh map to IndoPak Nastaleeq
 *   jazm (U+0652) and Farsi yeh (U+06CC) to match Quran.com 100%.
 */
export function normalizeIndoPakText(text: string): string {
  return text
    .replace(/\ufeff/g, '')
    .replace(/\s*\u06df([^\s]*?)[\uf500-\uf61e]\s*$/, (_, waqf: string) =>
      waqf ? ` ${waqf}` : ''
    )
    .replace(/\u06e1/g, '\u0652')
    .replace(/\u0649(?=\u0652|[\u0621-\u064a])/g, '\u06cc')
    .replace(/[\u2002\u2003 ]+/g, ' ')
    .trim();
}

export const DAY_NAMES_BN = [
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
  'শুক্রবার',
  'শনিবার',
] as const;

export const DAY_SHORT_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'] as const;

export function formatRoutineItemLabel(params: {
  surahId: number;
  nameBangla: string;
  versesCount: number;
  startAyah: number;
  endAyah: number;
}): string {
  const { surahId, nameBangla, versesCount, startAyah, endAyah } = params;
  const base = `${toBanglaDigits(surahId)}. ${nameBangla}`;
  if (startAyah === 1 && endAyah === versesCount) {
    return base;
  }
  if (startAyah === endAyah) {
    return `${base} (${toBanglaDigits(startAyah)})`;
  }
  return `${base} (${toBanglaDigits(startAyah)}–${toBanglaDigits(endAyah)})`;
}

export function formatNormalizedRoutineItemLabel(item: NormalizedRoutineItem): string {
  if (item.kind === 'dua') {
    const dua = DUA_MAP[item.duaId];
    if (!dua) return '';
    return item.targetCount > 1
      ? `${dua.titleBangla} (${toBanglaDigits(item.targetCount)} বার)`
      : dua.titleBangla;
  }
  const s = SURAH_MAP[item.surahId];
  if (!s) return '';
  return formatRoutineItemLabel({
    surahId: s.id,
    nameBangla: s.nameBangla,
    versesCount: s.versesCount,
    startAyah: item.startAyah,
    endAyah: item.endAyah,
  });
}

export function formatRoutineSummaryBn(counts: {
  totalAyahs: number;
  duaCount: number;
}): string {
  const parts: string[] = [];
  if (counts.totalAyahs > 0) {
    parts.push(`${toBanglaDigits(counts.totalAyahs)} আয়াত`);
  }
  if (counts.duaCount > 0) {
    parts.push(`${toBanglaDigits(counts.duaCount)}টি দুআ`);
  }
  return parts.join(' • ') || '০টি অংশ';
}

export const AUTO_SCROLL_SPEEDS = [
  { value: 0, label: 'বন্ধ', pxPerSec: 0 },
  { value: 1, label: '১x', pxPerSec: 22 },
  { value: 2, label: '১.৫x', pxPerSec: 36 },
  { value: 3, label: '২x', pxPerSec: 54 },
  { value: 4, label: '৩x', pxPerSec: 82 },
] as const;

export function formatRelativeTimeBn(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'এইমাত্র';
  if (mins < 60) return `${toBanglaDigits(mins)} মিনিট আগে`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${toBanglaDigits(hours)} ঘণ্টা আগে`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'গতকাল';
  if (days < 30) return `${toBanglaDigits(days)} দিন আগে`;
  return new Date(timestamp).toLocaleDateString('bn-BD');
}
