import { useState } from 'react';
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { DUA_CHAPTERS as STATIC_CHAPTERS } from '../../data/duas';
import { isBuiltInChapterId } from '../../services/catalogSnapshot';
import {
  adminDeleteOrHideChapter,
  adminPublishChapter,
  adminRevertBuiltInChapter,
} from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
import { toBanglaDigits } from '../../utils/formatters';
import { useToast } from '../ToastProvider';

interface ChapterDraft {
  id: number;
  isNew: boolean;
  titleBangla: string;
  subtitleBangla: string;
  aliasesText: string;
}

export function AdminChaptersTab() {
  const toast = useToast();
  const catalog = useCatalog();
  const [draft, setDraft] = useState<ChapterDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const allRows = [
    ...catalog.chapters.map((ch) => ({
      ...ch,
      hidden: false,
      duaCount: catalog.duasByChapter[ch.id]?.length ?? 0,
    })),
    ...STATIC_CHAPTERS.filter(
      (st) => catalog.remoteChaptersMap[st.id]?.deleted
    ).map((st) => ({
      ...st,
      searchAliases: undefined as string[] | undefined,
      source: 'builtin' as const,
      hidden: true,
      duaCount: 0,
    })),
  ].sort((a, b) => a.id - b.id);

  const startNewChapter = () => {
    const maxId = allRows.reduce((m, c) => Math.max(m, c.id), 13);
    setDraft({
      id: maxId + 1,
      isNew: true,
      titleBangla: '',
      subtitleBangla: '',
      aliasesText: '',
    });
  };

  const openChapter = (row: (typeof allRows)[number]) => {
    setDraft({
      id: row.id,
      isNew: false,
      titleBangla: row.titleBangla,
      subtitleBangla: row.subtitleBangla,
      aliasesText: (row.searchAliases ?? []).join(', '),
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.titleBangla.trim()) {
      toast.warning('অধ্যায়ের বাংলা শিরোনাম লিখুন।');
      return;
    }
    setSaving(true);
    try {
      const aliases = draft.aliasesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await adminPublishChapter({
        id: draft.id,
        titleBangla: draft.titleBangla,
        subtitleBangla: draft.subtitleBangla,
        searchAliases: aliases,
      });
      setDraft({ ...draft, isNew: false });
      toast.success('অধ্যায়টি সফলভাবে পাবলিশ হয়েছে।');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrHide = async () => {
    if (!draft) return;
    const builtIn = isBuiltInChapterId(draft.id);
    if (
      !window.confirm(
        builtIn
          ? 'এই বিল্ট-ইন অধ্যায়টি লুকিয়ে রাখবেন?'
          : 'এই কাস্টম অধ্যায়টি মুছে ফেলবেন?'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await adminDeleteOrHideChapter(draft.id);
      setDraft(null);
      toast.info(builtIn ? 'অধ্যায়টি লুকানো হয়েছে।' : 'অধ্যায়টি মুছে ফেলা হয়েছে।');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'মুছে ফেলা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (id: number) => {
    setSaving(true);
    try {
      await adminRevertBuiltInChapter(id);
      setDraft(null);
      toast.success('অধ্যায়টি বিল্ট-ইন ডিফল্টে ফিরে এসেছে।');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'রিভার্ট করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <section
        className="lg:col-span-6 rounded-3xl border p-4 space-y-3"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">দুআর অধ্যায় সমূহ</h2>
          <button
            type="button"
            onClick={startNewChapter}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন অধ্যায়
          </button>
        </div>

        <div className="divide-y max-h-[68dvh] overflow-y-auto pr-1"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {allRows.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => openChapter(ch)}
              className="w-full py-2.5 px-2.5 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer"
              style={{
                backgroundColor:
                  draft?.id === ch.id ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">
                  {toBanglaDigits(ch.id)}. {ch.titleBangla}
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {ch.subtitleBangla || 'উপশিরোনাম নেই'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {ch.hidden ? (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--danger-soft)',
                      color: 'var(--danger)',
                    }}
                  >
                    লুকানো
                  </span>
                ) : (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {toBanglaDigits(ch.duaCount)} দুআ
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section
        className="lg:col-span-6 rounded-3xl border p-5 space-y-4"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {!draft ? (
          <p className="py-16 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            এডিট করতে যেকোনো অধ্যায় সিলেক্ট করুন অথবা “নতুন অধ্যায়” বাটনে ক্লিক করুন।
          </p>
        ) : (
          <>
            <h3 className="text-sm font-semibold">
              {draft.isNew
                ? `নতুন অধ্যায় #${toBanglaDigits(draft.id)}`
                : `অধ্যায় #${toBanglaDigits(draft.id)} সম্পাদনা`}
            </h3>

            <label className="space-y-1 block">
              <span className="text-xs font-medium">অধ্যায়ের বাংলা শিরোনাম *</span>
              <input
                type="text"
                value={draft.titleBangla}
                onChange={(e) =>
                  setDraft({ ...draft, titleBangla: e.target.value })
                }
                placeholder="যেমন: রিজিক ও বরকতের দুআ"
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-medium">উপশিরোনাম (Subtitle)</span>
              <input
                type="text"
                value={draft.subtitleBangla}
                onChange={(e) =>
                  setDraft({ ...draft, subtitleBangla: e.target.value })
                }
                placeholder="যেমন: চতুর্দশ অধ্যায় • হালাল রিজিক ও বরকত"
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-medium">
                সার্চ কীওয়ার্ড / Banglish (কমা দিয়ে আলাদা করুন)
              </span>
              <input
                type="text"
                value={draft.aliasesText}
                onChange={(e) =>
                  setDraft({ ...draft, aliasesText: e.target.value })
                }
                placeholder="যেমন: rizq, barkat, income, job, টাকা, রিজিক"
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                {!draft.isNew && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDeleteOrHide()}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium border cursor-pointer"
                    style={{
                      backgroundColor: 'var(--danger-soft)',
                      borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
                      color: 'var(--danger)',
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isBuiltInChapterId(draft.id) ? 'লুকান' : 'ডিলিট'}
                  </button>
                )}
                {isBuiltInChapterId(draft.id) &&
                  Boolean(catalog.remoteChaptersMap[draft.id]) && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleRevert(draft.id)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium border cursor-pointer"
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

              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
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
          </>
        )}
      </section>
    </div>
  );
}
