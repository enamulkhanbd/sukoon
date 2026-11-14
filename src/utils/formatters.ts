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
