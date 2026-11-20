import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { DUA_CHAPTER_MAP, DUAS, type DuaItem } from '../data/duas';
import { SURAH_MAP, SURAHS, type SurahMeta } from '../data/surahs';
import type { Routine } from '../db/database';
import { toBanglaDigits } from '../utils/formatters';

const BANGLA_TO_ASCII: Record<string, string> = {
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
};

function toAsciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (ch) => BANGLA_TO_ASCII[ch] ?? ch);
}

function parseAyahJump(
  raw: string
): { surah: SurahMeta; ayah: number } | null {
  const normalized = toAsciiDigits(raw.trim());
  const match = /^(\d{1,3})\s*[:./-]\s*(\d{1,3})$/.exec(normalized);
  if (!match) return null;
  const surahId = Number.parseInt(match[1], 10);
  const ayah = Number.parseInt(match[2], 10);
  const surah = SURAH_MAP[surahId];
  if (!surah || ayah < 1 || ayah > surah.versesCount) return null;
  return { surah, ayah };
}

interface GlobalSearchOverlayProps {
  open: boolean;
  routines: Routine[];
  onClose: () => void;
  onOpenSurah: (surahId: number, targetAyah?: number) => void;
  onOpenDua: (dua: DuaItem) => void;
  onOpenRoutineDetails: (routine: Routine) => void;
}

export function GlobalSearchOverlay({
  open,
  routines,
  onClose,
  onOpenSurah,
  onOpenDua,
  onOpenRoutineDetails,
}: GlobalSearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const trimmed = query.trim();

  const results = useMemo(() => {
    if (!trimmed) {
      return {
        ayahJump: null as { surah: SurahMeta; ayah: number } | null,
        routines: [] as Routine[],
        surahs: [] as SurahMeta[],
        duas: [] as DuaItem[],
      };
    }

    const q = trimmed.toLowerCase();
    const qAscii = toAsciiDigits(q);
    const ayahJump = parseAyahJump(trimmed);

    const matchedRoutines = routines
      .filter((r) => r.title.toLowerCase().includes(q))
      .slice(0, 4);

    const matchedSurahs = SURAHS.filter(
      (s) =>
        String(s.id) === qAscii ||
        String(s.id).includes(qAscii) ||
        s.nameBangla.toLowerCase().includes(q) ||
        s.meaningBangla.toLowerCase().includes(q) ||
        s.nameSimple.toLowerCase().includes(q) ||
        s.nameArabic.includes(trimmed)
    )
      .sort((a, b) => {
        const aExact = String(a.id) === qAscii ? 0 : 1;
        const bExact = String(b.id) === qAscii ? 0 : 1;
        return aExact - bExact;
      })
      .slice(0, 6);

    const matchedDuas = DUAS.filter((d) => {
      const ch = DUA_CHAPTER_MAP[d.chapterId];
      return (
        d.titleBangla.toLowerCase().includes(q) ||
        d.translationBangla.toLowerCase().includes(q) ||
        (d.occasionNote ?? '').toLowerCase().includes(q) ||
        (ch?.titleBangla.toLowerCase().includes(q) ?? false) ||
        d.arabic.includes(trimmed)
      );
    }).slice(0, 6);

    return {
      ayahJump,
      routines: matchedRoutines,
      surahs: matchedSurahs,
      duas: matchedDuas,
    };
  }, [trimmed, routines]);

  if (!open) return null;

  const hasResults =
    Boolean(results.ayahJump) ||
    results.routines.length > 0 ||
    results.surahs.length > 0 ||
    results.duas.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="অনুসন্ধান"
      className="fixed inset-0 z-50 paper-frame flex flex-col safe-top safe-bottom"
    >
      {/* Full-Bleed Tinted Top Search Band */}
      <div
        className="shrink-0"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="ফিরে যান"
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors active:scale-95"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--text-primary) 6%, transparent)',
              color: 'var(--text-primary)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="সূরা, ২:২৫৫, দুআ বা রুটিন খুঁজুন..."
              className="w-full pl-11 pr-9 py-2.5 rounded-full text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="মুছুন"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plain Unboxed Results Canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-7">
          {!trimmed ? (
            <p
              className="text-xs text-center py-10 leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              সূরার নাম বা নম্বর, নির্দিষ্ট আয়াত (যেমন{' '}
              <span style={{ color: 'var(--text-secondary)' }}>২:২৫৫</span>),
              দুআ অথবা আপনার রুটিন লিখে খুঁজুন।
            </p>
          ) : !hasResults ? (
            <p
              className="text-xs text-center py-10"
              style={{ color: 'var(--text-muted)' }}
            >
              “{trimmed}”-এর জন্য কোনো ফলাফল পাওয়া যায়নি।
            </p>
          ) : (
            <>
              {/* Direct Ayah Jump */}
              {results.ayahJump && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSurah(
                      results.ayahJump!.surah.id,
                      results.ayahJump!.ayah
                    );
                  }}
                  className="w-full rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-opacity active:opacity-80 cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BookOpen
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--accent)' }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        সূরা {results.ayahJump.surah.nameBangla} • আয়াত{' '}
                        {toBanglaDigits(results.ayahJump.ayah)}
                      </div>
                      <div
                        className="text-[11px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        সরাসরি আয়াতে যান
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 shrink-0"
                    style={{ color: 'var(--accent)' }}
                  />
                </button>
              )}

              {/* Routines */}
              {results.routines.length > 0 && (
                <section className="space-y-2">
                  <h2
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    রুটিন
                  </h2>
                  <div className="space-y-1">
                    {results.routines.map((routine) => (
                      <button
                        key={routine.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenRoutineDetails(routine);
                        }}
                        className="w-full py-2.5 flex items-center justify-between gap-3 text-left cursor-pointer transition-opacity active:opacity-70"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CalendarCheck2
                            className="w-4 h-4 shrink-0"
                            style={{ color: 'var(--accent)' }}
                          />
                          <span className="text-sm font-medium truncate">
                            {routine.title}
                          </span>
                        </div>
                        <ArrowRight
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                        />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Surahs */}
              {results.surahs.length > 0 && (
                <section className="space-y-2">
                  <h2
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    সূরা
                  </h2>
                  <div className="space-y-1">
                    {results.surahs.map((surah) => (
                      <button
                        key={surah.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenSurah(surah.id, 1);
                        }}
                        className="w-full py-2.5 flex items-center justify-between gap-3 text-left cursor-pointer transition-opacity active:opacity-70"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-7 text-xs font-semibold tabular-nums shrink-0"
                            style={{ color: 'var(--accent)' }}
                          >
                            {toBanglaDigits(surah.id)}.
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {surah.nameBangla}{' '}
                              <span
                                className="text-xs font-normal"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                ({surah.meaningBangla})
                              </span>
                            </div>
                            <div
                              className="text-[11px]"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {toBanglaDigits(surah.versesCount)} আয়াত
                            </div>
                          </div>
                        </div>
                        <span
                          className="font-surah-names text-2xl leading-none shrink-0 select-none"
                          style={{ color: 'var(--text-primary)' }}
                          aria-hidden="true"
                        >
                          {String(surah.id).padStart(3, '0')}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Duas */}
              {results.duas.length > 0 && (
                <section className="space-y-2">
                  <h2
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    দুআ
                  </h2>
                  <div className="space-y-1">
                    {results.duas.map((dua) => {
                      const chapter = DUA_CHAPTER_MAP[dua.chapterId];
                      return (
                        <button
                          key={dua.id}
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenDua(dua);
                          }}
                          className="w-full py-2.5 flex items-center justify-between gap-3 text-left cursor-pointer transition-opacity active:opacity-70"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Sparkles
                              className="w-4 h-4 shrink-0 mt-0.5"
                              style={{ color: 'var(--gold)' }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {dua.titleBangla}
                              </div>
                              {chapter && (
                                <div
                                  className="text-[11px] truncate"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  {chapter.titleBangla}
                                </div>
                              )}
                            </div>
                          </div>
                          <ArrowRight
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
