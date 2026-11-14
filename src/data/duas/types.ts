export interface QuranRef {
  surahId: number;
  startAyah: number;
  endAyah: number;
}

export interface DuaChapter {
  id: number;
  titleBangla: string;
  subtitleBangla: string;
}

export interface DuaItem {
  id: string;
  chapterId: number;
  order: number;
  titleBangla: string;
  repeatCount?: number;
  occasionNote?: string;
  arabic: string;
  transliteration?: string;
  translationBangla: string;
  reference?: string;
  quranRef?: QuranRef;
}
