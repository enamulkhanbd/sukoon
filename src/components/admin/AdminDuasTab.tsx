import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { DUAS as STATIC_DUAS } from '../../data/duas';
import type { DuaPart } from '../../data/duas/types';
import { SURAHS } from '../../data/surahs';
import { isBuiltInDuaId } from '../../services/catalogSnapshot';
import {
  adminDeleteOrHideDua,
  adminPublishDua,
  adminRevertBuiltInDua,
} from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
import { normalizeIndoPakText, toBanglaDigits } from '../../utils/formatters';
import { useToast } from '../ToastProvider';

type SourceFilter = 'all' | 'remote' | 'override' | 'hidden';

interface DuaDraft {
  id: string;
  isNew: boolean;
  chapterId: number;
  order: number;
  titleBangla: string;
  repeatCount: number;
  occasionNote: string;
  arabic: string;
  transliteration: string;
  translationBangla: string;
  reference: string;
  hasQuranRef: boolean;
  quranSurahId: number;
  quranStartAyah: number;
  quranEndAyah: number;
  parts: DuaPart[];
}

const REPEAT_PRESETS = [1, 3, 7, 33, 100];

function slugifyId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function AdminDuasTab() {
  const toast = useToast();
  const catalog = useCatalog();

  const [query, setQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState<number | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [editorMode, setEditorMode] = useState<'form' | 'preview'>('form');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DuaDraft | null>(null);

  // Build unified list including hidden built-in duas so admin can revert them
  const adminList = useMemo(() => {
    const items: Array<{
      id: string;
      chapterId: number;
      order: number;
      titleBangla: string;
      repeatCount?: number;
      source: 'builtin' | 'override' | 'remote' | 'hidden';
    }> = [];

    for (const d of catalog.duas) {
      items.push({
        id: d.id,
        chapterId: d.chapterId,
        order: d.order,
        titleBangla: d.titleBangla,
        repeatCount: d.repeatCount,
        source: d.source,
      });
    }

    // Add hidden built-in duas
    for (const staticDua of STATIC_DUAS) {
      const remote = catalog.remoteDuasMap[staticDua.id];
      if (remote?.deleted) {
        items.push({
          id: staticDua.id,
          chapterId: staticDua.chapterId,
          order: staticDua.order,
          titleBangla: staticDua.titleBangla,
          repeatCount: staticDua.repeatCount,
          source: 'hidden',
        });
      }
    }

    const q = query.trim().toLowerCase();
    return items
      .filter((it) => {
        if (chapterFilter !== 'all' && it.chapterId !== chapterFilter) return false;
        if (sourceFilter !== 'all' && it.source !== sourceFilter) return false;
        if (q) {
          return (
            it.titleBangla.toLowerCase().includes(q) ||
            it.id.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) =>
        a.chapterId !== b.chapterId ? a.chapterId - b.chapterId : a.order - b.order
      );
  }, [catalog, query, chapterFilter, sourceFilter]);

  const startNewDua = () => {
    const chId =
      chapterFilter !== 'all'
        ? chapterFilter
        : (catalog.chapters[0]?.id ?? 1);
    const existingInChapter = catalog.duasByChapter[chId] ?? [];
    const nextOrder =
      existingInChapter.reduce((max, d) => Math.max(max, d.order), 0) + 1;

    setDraft({
      id: slugifyId(`ch${chId}-dua`),
      isNew: true,
      chapterId: chId,
      order: nextOrder,
      titleBangla: '',
      repeatCount: 1,
      occasionNote: '',
      arabic: '',
      transliteration: '',
      translationBangla: '',
      reference: '',
      hasQuranRef: false,
      quranSurahId: 1,
      quranStartAyah: 1,
      quranEndAyah: 1,
      parts: [],
    });
    setEditorMode('form');
    setShowAdvanced(false);
  };

  const openExistingDua = (duaId: string) => {
    const merged =
      catalog.duaMap[duaId] ?? STATIC_DUAS.find((d) => d.id === duaId);
    if (!merged) return;

    setDraft({
      id: merged.id,
      isNew: false,
      chapterId: merged.chapterId,
      order: merged.order,
      titleBangla: merged.titleBangla,
      repeatCount: merged.repeatCount ?? 1,
      occasionNote: merged.occasionNote ?? '',
      arabic: merged.arabic,
      transliteration: merged.transliteration ?? '',
      translationBangla: merged.translationBangla,
      reference: merged.reference ?? '',
      hasQuranRef: Boolean(merged.quranRef),
      quranSurahId: merged.quranRef?.surahId ?? 1,
      quranStartAyah: merged.quranRef?.startAyah ?? 1,
      quranEndAyah: merged.quranRef?.endAyah ?? 1,
      parts: merged.parts ? merged.parts.map((p) => ({ ...p })) : [],
    });
    setEditorMode('form');
    setShowAdvanced(Boolean(merged.quranRef || (merged.parts && merged.parts.length > 0)));
  };

  const handlePublish = async () => {
    if (!draft) return;
    if (!draft.titleBangla.trim() || !draft.arabic.trim()) {
      toast.warning('দুআর বাংলা শিরোনাম এবং আরবি টেক্সট অবশ্যই লিখতে হবে।');
      return;
    }
    setSaving(true);
    try {
      const cleanedParts = draft.parts
        .filter((p) => p.arabic.trim().length > 0)
        .map((p, i) => ({
          id: p.id.trim() || `part-${i + 1}`,
          labelBangla: p.labelBangla?.trim() || undefined,
          arabic: p.arabic.trim(),
          transliteration: p.transliteration?.trim() || undefined,
          translationBangla: p.translationBangla.trim(),
          repeatCount: p.repeatCount && p.repeatCount >= 1 ? Math.trunc(p.repeatCount) : undefined,
        }));

      await adminPublishDua({
        id: draft.id.trim(),
        chapterId: draft.chapterId,
        order: draft.order,
        titleBangla: draft.titleBangla,
        arabic: draft.arabic,
        translationBangla: draft.translationBangla,
        transliteration: draft.transliteration || undefined,
        repeatCount: draft.repeatCount,
        occasionNote: draft.occasionNote || undefined,
        reference: draft.reference || undefined,
        quranRef: draft.hasQuranRef
          ? {
              surahId: draft.quranSurahId,
              startAyah: Math.max(1, draft.quranStartAyah),
              endAyah: Math.max(draft.quranStartAyah, draft.quranEndAyah),
            }
          : undefined,
        parts: cleanedParts.length > 0 ? cleanedParts : undefined,
      });

      setDraft({ ...draft, isNew: false });
      toast.success('দুআটি সফলভাবে পাবলিশ ও লোকাল স্টোরেজে সিংক হয়েছে।');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'দুআ পাবলিশ করা যায়নি।'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrHide = async () => {
    if (!draft) return;
    const isBuiltIn = isBuiltInDuaId(draft.id);
    const confirmed = window.confirm(
      isBuiltIn
        ? 'এই বিল্ট-ইন দুআটি ইউজারদের অ্যাপ থেকে লুকিয়ে রাখবেন? (পরে যেকোনো সময় ডিফল্টে ফেরাতে পারবেন)'
        : 'এই দুআটি সবার অ্যাপ থেকে মুছে ফেলবেন?'
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await adminDeleteOrHideDua(draft.id, draft.chapterId);
      setDraft(null);
      toast.info(isBuiltIn ? 'দুআটি লুকানো হয়েছে।' : 'দুআটি মুছে ফেলা হয়েছে।');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'মুছে ফেলা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (duaId: string) => {
    setSaving(true);
    try {
      await adminRevertBuiltInDua(duaId);
      toast.success('দুআটি বিল্ট-ইন ডিফল্ট অবস্থায় ফিরিয়ে আনা হয়েছে।');
      openExistingDua(duaId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'রিভার্ট করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const isSelectedBuiltIn = draft ? isBuiltInDuaId(draft.id) : false;
  const hasRemoteRecord = draft ? Boolean(catalog.remoteDuasMap[draft.id]) : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: List & Filters */}
      <section
        className={`lg:col-span-5 rounded-3xl border p-4 space-y-3 ${
          draft ? 'hidden lg:block' : 'block'
        }`}
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="দুআ খুঁজুন..."
              className="w-full pl-8 pr-3 py-2 rounded-full text-xs border outline-none"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            />
          </div>
          <button
            type="button"
            onClick={startNewDua}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-medium shrink-0 cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন দুআ
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={chapterFilter}
            onChange={(e) =>
              setChapterFilter(
                e.target.value === 'all' ? 'all' : Number(e.target.value)
              )
            }
            className="flex-1 min-w-[140px] px-3 py-1.5 rounded-xl text-xs border outline-none"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <option value="all">সব অধ্যায় ({toBanglaDigits(catalog.chapters.length)})</option>
            {catalog.chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {toBanglaDigits(ch.id)}. {ch.titleBangla}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="px-3 py-1.5 rounded-xl text-xs border outline-none"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <option value="all">সব সোর্স</option>
            <option value="remote">অ্যাডমিন যোগ করা</option>
            <option value="override">বিল্ট-ইন এডিট</option>
            <option value="hidden">লুকানো</option>
          </select>
        </div>

        <div className="max-h-[68dvh] overflow-y-auto divide-y pr-1"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {adminList.length === 0 ? (
            <p className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              কোনো দুআ পাওয়া যায়নি।
            </p>
          ) : (
            adminList.map((item) => {
              const selected = draft?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openExistingDua(item.id)}
                  className="w-full py-2.5 px-2.5 text-left flex items-center justify-between gap-2 rounded-xl transition-colors cursor-pointer"
                  style={{
                    backgroundColor: selected ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">
                      {toBanglaDigits(item.chapterId)}.{toBanglaDigits(item.order)} —{' '}
                      {item.titleBangla}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-[10px] px-1.5 py-0.2 rounded-full"
                        style={{
                          backgroundColor:
                            item.source === 'remote'
                              ? 'var(--accent-soft)'
                              : item.source === 'override'
                                ? 'var(--gold-soft)'
                                : item.source === 'hidden'
                                  ? 'var(--danger-soft)'
                                  : 'var(--bg-surface)',
                          color:
                            item.source === 'remote'
                              ? 'var(--accent)'
                              : item.source === 'override'
                                ? 'var(--gold)'
                                : item.source === 'hidden'
                                  ? 'var(--danger)'
                                  : 'var(--text-muted)',
                        }}
                      >
                        {item.source === 'remote'
                          ? 'রিমোট'
                          : item.source === 'override'
                            ? 'এডিটেড'
                            : item.source === 'hidden'
                              ? 'লুকানো'
                              : 'বিল্ট-ইন'}
                      </span>
                      {item.repeatCount && item.repeatCount > 1 && (
                        <span
                          className="text-[10px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {toBanglaDigits(item.repeatCount)} বার
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Right Column: Editor & Live Preview */}
      <section
        className={`lg:col-span-7 rounded-3xl border p-5 space-y-4 ${
          draft ? 'block' : 'hidden lg:block'
        }`}
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {!draft ? (
          <div className="py-20 text-center space-y-3">
            <p className="text-sm font-medium">
              এডিট করতে বাম দিক থেকে কোনো দুআ বেছে নিন অথবা নতুন দুআ যোগ করুন
            </p>
            <button
              type="button"
              onClick={startNewDua}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-text)',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              নতুন দুআ যোগ করুন
            </button>
          </div>
        ) : (
          <>
            {/* Editor Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="lg:hidden p-1.5 rounded-full border cursor-pointer"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-semibold">
                    {draft.isNew ? 'নতুন দুআ তৈরি' : 'দুআ সম্পাদনা'}
                  </h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    ID: {draft.id} {isSelectedBuiltIn ? '• বিল্ট-ইন দুআ' : '• কাস্টম দুআ'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-full border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditorMode('form')}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor:
                      editorMode === 'form' ? 'var(--accent)' : 'transparent',
                    color:
                      editorMode === 'form'
                        ? 'var(--accent-text)'
                        : 'var(--text-secondary)',
                  }}
                >
                  <Pencil className="w-3 h-3" />
                  এডিট
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('preview')}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor:
                      editorMode === 'preview' ? 'var(--accent)' : 'transparent',
                    color:
                      editorMode === 'preview'
                        ? 'var(--accent-text)'
                        : 'var(--text-secondary)',
                  }}
                >
                  <Eye className="w-3 h-3" />
                  প্রিভিউ
                </button>
              </div>
            </div>

            {editorMode === 'preview' ? (
              /* Live DuaReaderView-style Preview */
              <div
                className="rounded-2xl p-5 border space-y-4"
                style={{
                  backgroundColor: 'var(--bg-page)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-medium" style={{ color: 'var(--accent)' }}>
                    {catalog.chapterMap[draft.chapterId]?.titleBangla ?? `অধ্যায় ${draft.chapterId}`}
                  </p>
                  <h3 className="text-base font-semibold">
                    {draft.titleBangla || '(শিরোনাম নেই)'}
                  </h3>
                  {draft.occasionNote && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {draft.occasionNote}
                    </p>
                  )}
                </div>

                <div
                  dir="rtl"
                  className="font-indopak text-2xl sm:text-3xl leading-[2.3] text-right py-4 px-4 rounded-2xl"
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  {normalizeIndoPakText(draft.arabic || 'بِسْمِ اللّٰهِ')}
                </div>

                {draft.transliteration && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>
                      উচ্চারণ
                    </p>
                    <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                      {draft.transliteration}
                    </p>
                  </div>
                )}

                {draft.translationBangla && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>
                      অর্থ
                    </p>
                    <p className="text-xs leading-relaxed whitespace-pre-line">
                      {draft.translationBangla}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[11px]"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>{draft.reference || 'রেফারেন্স নেই'}</span>
                  <span>পাঠ সংখ্যা: {toBanglaDigits(draft.repeatCount)} বার</span>
                </div>
              </div>
            ) : (
              /* Edit Form */
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="sm:col-span-2 space-y-1 block">
                    <span className="text-xs font-medium">অধ্যায়</span>
                    <select
                      value={draft.chapterId}
                      onChange={(e) =>
                        setDraft({ ...draft, chapterId: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      {catalog.chapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {toBanglaDigits(ch.id)}. {ch.titleBangla}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs font-medium">ক্রম (Order)</span>
                    <input
                      type="number"
                      min={0}
                      value={draft.order}
                      onChange={(e) =>
                        setDraft({ ...draft, order: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    />
                  </label>
                </div>

                <label className="space-y-1 block">
                  <span className="text-xs font-medium">বাংলা শিরোনাম *</span>
                  <input
                    type="text"
                    value={draft.titleBangla}
                    onChange={(e) =>
                      setDraft({ ...draft, titleBangla: e.target.value })
                    }
                    placeholder="যেমন: ঘরের বাইরে বের হওয়ার দুআ"
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  />
                </label>

                <div className="space-y-1.5">
                  <span className="text-xs font-medium block">রিপিট সংখ্যা (তাসবীহ টার্গেট)</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {REPEAT_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDraft({ ...draft, repeatCount: n })}
                        className="px-3 py-1 rounded-full text-xs border cursor-pointer"
                        style={{
                          backgroundColor:
                            draft.repeatCount === n
                              ? 'var(--accent)'
                              : 'var(--bg-surface)',
                          borderColor:
                            draft.repeatCount === n
                              ? 'var(--accent)'
                              : 'var(--border-subtle)',
                          color:
                            draft.repeatCount === n
                              ? 'var(--accent-text)'
                              : 'var(--text-primary)',
                        }}
                      >
                        {toBanglaDigits(n)} বার
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={draft.repeatCount}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          repeatCount: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-20 px-2.5 py-1 rounded-full text-xs border outline-none text-center"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    />
                  </div>
                </div>

                <label className="space-y-1 block">
                  <span className="text-xs font-medium">আরবি টেক্সট (IndoPak RTL) *</span>
                  <textarea
                    dir="rtl"
                    rows={3}
                    value={draft.arabic}
                    onChange={(e) => setDraft({ ...draft, arabic: e.target.value })}
                    placeholder="আরবি দুআ এখানে পেস্ট বা টাইপ করুন..."
                    className="w-full px-3.5 py-2.5 rounded-xl border outline-none font-indopak text-2xl leading-[2.1] text-right"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-xs font-medium">বাংলা উচ্চারণ (ঐচ্ছিক)</span>
                  <textarea
                    rows={2}
                    value={draft.transliteration}
                    onChange={(e) =>
                      setDraft({ ...draft, transliteration: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-xs font-medium">বাংলা অর্থ</span>
                  <textarea
                    rows={3}
                    value={draft.translationBangla}
                    onChange={(e) =>
                      setDraft({ ...draft, translationBangla: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1 block">
                    <span className="text-xs font-medium">কখন পড়বেন (Occasion Note)</span>
                    <input
                      type="text"
                      value={draft.occasionNote}
                      onChange={(e) =>
                        setDraft({ ...draft, occasionNote: e.target.value })
                      }
                      placeholder="যেমন: ফজরের পর ৩ বার"
                      className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs font-medium">রেফারেন্স</span>
                    <input
                      type="text"
                      value={draft.reference}
                      onChange={(e) =>
                        setDraft({ ...draft, reference: e.target.value })
                      }
                      placeholder="যেমন: সহীহ মুসলিম ৫৯১"
                      className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    />
                  </label>
                </div>

                {/* Collapsible Advanced: QuranRef & Multi-part Parts */}
                <div
                  className="rounded-2xl border p-3 space-y-3"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold cursor-pointer"
                  >
                    <span>অ্যাডভান্সড (কুরআন রেফারেন্স লিংক ও মাল্টি-পার্ট)</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        showAdvanced ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      {/* Quran Ref */}
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.hasQuranRef}
                            onChange={(e) =>
                              setDraft({ ...draft, hasQuranRef: e.target.checked })
                            }
                          />
                          কুরআনের সূরা ও আয়াতের সাথে লিংক করুন
                        </label>
                        {draft.hasQuranRef && (
                          <div className="grid grid-cols-3 gap-2">
                            <select
                              value={draft.quranSurahId}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  quranSurahId: Number(e.target.value),
                                })
                              }
                              className="col-span-3 sm:col-span-1 px-2.5 py-1.5 rounded-xl text-xs border"
                              style={{
                                backgroundColor: 'var(--bg-elevated)',
                                borderColor: 'var(--border-subtle)',
                              }}
                            >
                              {SURAHS.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {toBanglaDigits(s.id)}. {s.nameBangla}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              max={286}
                              value={draft.quranStartAyah}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  quranStartAyah: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              placeholder="শুরু আয়াত"
                              className="px-2.5 py-1.5 rounded-xl text-xs border"
                              style={{
                                backgroundColor: 'var(--bg-elevated)',
                                borderColor: 'var(--border-subtle)',
                              }}
                            />
                            <input
                              type="number"
                              min={1}
                              max={286}
                              value={draft.quranEndAyah}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  quranEndAyah: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              placeholder="শেষ আয়াত"
                              className="px-2.5 py-1.5 rounded-xl text-xs border"
                              style={{
                                backgroundColor: 'var(--bg-elevated)',
                                borderColor: 'var(--border-subtle)',
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Multi-Part Builder */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">
                            মাল্টি-পার্ট অংশ ({toBanglaDigits(draft.parts.length)})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                parts: [
                                  ...draft.parts,
                                  {
                                    id: `part-${draft.parts.length + 1}`,
                                    labelBangla: '',
                                    arabic: '',
                                    transliteration: '',
                                    translationBangla: '',
                                    repeatCount: 1,
                                  },
                                ],
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              borderColor: 'var(--border-subtle)',
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            অংশ যোগ করুন
                          </button>
                        </div>

                        {draft.parts.map((part, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl p-3 border space-y-2"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              borderColor: 'var(--border-subtle)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">
                                অংশ #{toBanglaDigits(idx + 1)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    parts: draft.parts.filter((_, i) => i !== idx),
                                  })
                                }
                                className="text-[11px] cursor-pointer"
                                style={{ color: 'var(--danger)' }}
                              >
                                সরান
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="text"
                                value={part.labelBangla ?? ''}
                                onChange={(e) => {
                                  const next = [...draft.parts];
                                  next[idx] = { ...part, labelBangla: e.target.value };
                                  setDraft({ ...draft, parts: next });
                                }}
                                placeholder="লেবেল (ঐচ্ছিক)"
                                className="col-span-2 px-2.5 py-1.5 rounded-lg text-xs border"
                                style={{ borderColor: 'var(--border-subtle)' }}
                              />
                              <input
                                type="number"
                                min={1}
                                value={part.repeatCount ?? 1}
                                onChange={(e) => {
                                  const next = [...draft.parts];
                                  next[idx] = {
                                    ...part,
                                    repeatCount: Math.max(1, Number(e.target.value) || 1),
                                  };
                                  setDraft({ ...draft, parts: next });
                                }}
                                placeholder="বার"
                                className="px-2.5 py-1.5 rounded-lg text-xs border"
                                style={{ borderColor: 'var(--border-subtle)' }}
                              />
                            </div>
                            <textarea
                              dir="rtl"
                              rows={2}
                              value={part.arabic}
                              onChange={(e) => {
                                const next = [...draft.parts];
                                next[idx] = { ...part, arabic: e.target.value };
                                setDraft({ ...draft, parts: next });
                              }}
                              placeholder="আরবি..."
                              className="w-full px-2.5 py-1.5 rounded-lg border font-indopak text-lg text-right"
                              style={{ borderColor: 'var(--border-subtle)' }}
                            />
                            <input
                              type="text"
                              value={part.translationBangla}
                              onChange={(e) => {
                                const next = [...draft.parts];
                                next[idx] = {
                                  ...part,
                                  translationBangla: e.target.value,
                                };
                                setDraft({ ...draft, parts: next });
                              }}
                              placeholder="বাংলা অর্থ..."
                              className="w-full px-2.5 py-1.5 rounded-lg text-xs border"
                              style={{ borderColor: 'var(--border-subtle)' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                {!draft.isNew && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDeleteOrHide()}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium border cursor-pointer disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--danger-soft)',
                      borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
                      color: 'var(--danger)',
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isSelectedBuiltIn ? 'লুকান' : 'ডিলিট'}
                  </button>
                )}
                {isSelectedBuiltIn && hasRemoteRecord && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleRevert(draft.id)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium border cursor-pointer disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    ডিফল্টে ফেরান
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDraft(null)}
                  className="px-3.5 py-2 rounded-full text-xs font-medium border cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handlePublish()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-text)',
                  }}
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  পাবলিশ করুন
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
