import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ActiveRoutineTemplate, RoutineItemRef } from '../../data/cmsTypes';
import { SURAH_MAP, SURAHS } from '../../data/surahs';
import {
  adminDeleteRoutineTemplate,
  adminPublishRoutineTemplate,
} from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
import { DAY_SHORT_BN, toBanglaDigits } from '../../utils/formatters';
import { useToast } from '../ToastProvider';

interface TemplateDraft {
  id: string;
  isNew: boolean;
  title: string;
  description: string;
  assignedDays: number[];
  items: RoutineItemRef[];
  featured: boolean;
  seasonTag: string;
  order: number;
  version: number;
}

export function AdminRoutinesTab() {
  const toast = useToast();
  const catalog = useCatalog();
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick add controls
  const [selectedSurahId, setSelectedSurahId] = useState(18);
  const [startAyah, setStartAyah] = useState(1);
  const [endAyah, setEndAyah] = useState(110);
  const [duaSearch, setDuaSearch] = useState('');

  const startNewTemplate = () => {
    const nextOrder =
      catalog.routineTemplates.reduce((m, t) => Math.max(m, t.order), 0) + 1;
    setDraft({
      id: `tpl-${Date.now().toString(36)}`,
      isNew: true,
      title: '',
      description: '',
      assignedDays: [],
      items: [],
      featured: false,
      seasonTag: '',
      order: nextOrder,
      version: 1,
    });
  };

  const openTemplate = (tpl: ActiveRoutineTemplate) => {
    setDraft({
      id: tpl.id,
      isNew: false,
      title: tpl.title,
      description: tpl.description ?? '',
      assignedDays: [...tpl.assignedDays],
      items: tpl.items.map((it) => ({ ...it })),
      featured: tpl.featured,
      seasonTag: tpl.seasonTag ?? '',
      order: tpl.order,
      version: tpl.version,
    });
  };

  const toggleDay = (d: number) => {
    if (!draft) return;
    const next = draft.assignedDays.includes(d)
      ? draft.assignedDays.filter((x) => x !== d)
      : [...draft.assignedDays, d].sort((a, b) => a - b);
    setDraft({ ...draft, assignedDays: next });
  };

  const addSurah = () => {
    if (!draft) return;
    const meta = SURAH_MAP[selectedSurahId];
    if (!meta) return;
    const s = Math.min(Math.max(1, startAyah), meta.versesCount);
    const e = Math.min(Math.max(s, endAyah), meta.versesCount);
    setDraft({
      ...draft,
      items: [
        ...draft.items,
        { kind: 'surah', surahId: meta.id, startAyah: s, endAyah: e },
      ],
    });
  };

  const addDua = (duaId: string) => {
    if (!draft) return;
    const dua = catalog.duaMap[duaId];
    if (!dua) return;
    setDraft({
      ...draft,
      items: [
        ...draft.items,
        {
          kind: 'dua',
          duaId: dua.id,
          targetCount: Math.max(1, dua.repeatCount ?? 1),
        },
      ],
    });
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    if (!draft) return;
    const target = idx + dir;
    if (target < 0 || target >= draft.items.length) return;
    const next = [...draft.items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft({ ...draft, items: next });
  };

  const handlePublish = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.warning('রুটিনের শিরোনাম লিখুন।');
      return;
    }
    if (draft.items.length === 0) {
      toast.warning('অন্তত একটি সূরা বা দুআ যোগ করুন।');
      return;
    }
    setSaving(true);
    try {
      const nextVersion = draft.isNew ? 1 : draft.version + 1;
      await adminPublishRoutineTemplate({
        id: draft.id,
        title: draft.title,
        description: draft.description || undefined,
        assignedDays: draft.assignedDays,
        items: draft.items,
        featured: draft.featured,
        seasonTag: draft.seasonTag || undefined,
        order: draft.order,
        version: nextVersion,
      });
      setDraft({ ...draft, isNew: false, version: nextVersion });
      toast.success(
        `রুটিন টেমপ্লেট পাবলিশ হয়েছে (ভার্সন ${toBanglaDigits(nextVersion)})।`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'পাবলিশ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft || draft.isNew) return;
    if (!window.confirm('এই সাজেস্টেড রুটিন টেমপ্লেটটি মুছে ফেলবেন?')) return;
    setSaving(true);
    try {
      await adminDeleteRoutineTemplate(draft.id);
      setDraft(null);
      toast.info('টেমপ্লেটটি মুছে ফেলা হয়েছে।');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'মুছে ফেলা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const matchingDuas = duaSearch.trim()
    ? catalog.duas
        .filter((d) =>
          d.titleBangla.toLowerCase().includes(duaSearch.trim().toLowerCase())
        )
        .slice(0, 8)
    : catalog.duas.slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left List */}
      <section
        className="lg:col-span-5 rounded-3xl border p-4 space-y-3"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">সাজেস্টেড রুটিন টেমপ্লেট</h2>
          <button
            type="button"
            onClick={startNewTemplate}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন টেমপ্লেট
          </button>
        </div>

        {catalog.routineTemplates.length === 0 ? (
          <p className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            এখনো কোনো অ্যাডমিন রুটিন টেমপ্লেট পাবলিশ করা হয়নি।
          </p>
        ) : (
          <div className="space-y-2">
            {catalog.routineTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => openTemplate(tpl)}
                className="w-full p-3 rounded-2xl border text-left space-y-1 cursor-pointer"
                style={{
                  backgroundColor:
                    draft?.id === tpl.id
                      ? 'var(--accent-soft)'
                      : 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold truncate">{tpl.title}</p>
                  <span
                    className="text-[10px] shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    v{toBanglaDigits(tpl.version)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {tpl.featured && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full font-medium"
                      style={{
                        backgroundColor: 'var(--gold-soft)',
                        color: 'var(--gold)',
                      }}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      ফিচার্ড
                    </span>
                  )}
                  {tpl.seasonTag && <span>{tpl.seasonTag}</span>}
                  <span>• {toBanglaDigits(tpl.items.length)}টি অংশ</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Right Editor */}
      <section
        className="lg:col-span-7 rounded-3xl border p-5 space-y-4"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {!draft ? (
          <p className="py-16 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            যেকোনো টেমপ্লেট সিলেক্ট করুন অথবা “নতুন টেমপ্লেট” তৈরি করুন। ইউজাররা এটি ১ ট্যাপে নিজের রুটিনে অ্যাডপ্ট ও কাস্টমাইজ করতে পারবে।
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {draft.isNew
                  ? 'নতুন রুটিন টেমপ্লেট'
                  : `টেমপ্লেট সম্পাদনা (v${toBanglaDigits(draft.version)})`}
              </h3>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) =>
                    setDraft({ ...draft, featured: e.target.checked })
                  }
                />
                ফিচার্ড (সবার উপরে দেখাবে)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="sm:col-span-2 space-y-1 block">
                <span className="text-xs font-medium">রুটিনের নাম *</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="যেমন: জুমুআর বিশেষ আমল"
                  className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-medium">সিজন / ব্যাজ ট্যাগ</span>
                <input
                  type="text"
                  value={draft.seasonTag}
                  onChange={(e) =>
                    setDraft({ ...draft, seasonTag: e.target.value })
                  }
                  placeholder="যেমন: জুমুআ / রমাদান"
                  className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-medium">সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</span>
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="এই রুটিনটি কখন ও কেন পড়বেন..."
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
            </label>

            {/* Suggested Days */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium block">
                প্রস্তাবিত দিন (খালি রাখলে ম্যানুয়াল)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DAY_SHORT_BN.map((label, idx) => {
                  const active = draft.assignedDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className="px-3 py-1 rounded-full text-xs border cursor-pointer"
                      style={{
                        backgroundColor: active
                          ? 'var(--accent)'
                          : 'var(--bg-surface)',
                        borderColor: active
                          ? 'var(--accent)'
                          : 'var(--border-subtle)',
                        color: active ? 'var(--accent-text)' : 'var(--text-primary)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Added Items List */}
            <div className="space-y-2">
              <span className="text-xs font-semibold block">
                যুক্ত করা সূরা ও দুআ ({toBanglaDigits(draft.items.length)})
              </span>
              {draft.items.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  নিচ থেকে সূরা বা দুআ যোগ করুন।
                </p>
              ) : (
                <div className="space-y-1.5">
                  {draft.items.map((it, idx) => {
                    const label =
                      it.kind === 'dua' && it.duaId
                        ? `${catalog.duaMap[it.duaId]?.titleBangla ?? it.duaId} (${toBanglaDigits(
                            it.targetCount ?? 1
                          )} বার)`
                        : it.surahId && SURAH_MAP[it.surahId]
                          ? `সূরা ${SURAH_MAP[it.surahId].nameBangla} (${toBanglaDigits(
                              it.startAyah ?? 1
                            )}–${toBanglaDigits(
                              it.endAyah ?? SURAH_MAP[it.surahId].versesCount
                            )})`
                          : 'অজানা আইটেম';
                    return (
                      <div
                        key={idx}
                        className="px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <span className="truncate font-medium">
                          {toBanglaDigits(idx + 1)}. {label}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveItem(idx, -1)}
                            className="p-1 rounded hover:opacity-70 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 1)}
                            className="p-1 rounded hover:opacity-70 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                items: draft.items.filter((_, i) => i !== idx),
                              })
                            }
                            className="p-1 rounded cursor-pointer"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Surah Control */}
            <div
              className="rounded-2xl border p-3 space-y-2.5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <span className="text-xs font-semibold block">+ সূরা / আয়াত রেঞ্জ যোগ করুন</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select
                  value={selectedSurahId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedSurahId(id);
                    setStartAyah(1);
                    setEndAyah(SURAH_MAP[id]?.versesCount ?? 1);
                  }}
                  className="sm:col-span-2 px-2.5 py-1.5 rounded-xl text-xs border"
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
                  value={startAyah}
                  onChange={(e) => setStartAyah(Math.max(1, Number(e.target.value) || 1))}
                  placeholder="শুরু"
                  className="px-2.5 py-1.5 rounded-xl text-xs border"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                />
                <input
                  type="number"
                  min={1}
                  value={endAyah}
                  onChange={(e) => setEndAyah(Math.max(1, Number(e.target.value) || 1))}
                  placeholder="শেষ"
                  className="px-2.5 py-1.5 rounded-xl text-xs border"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={addSurah}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <Plus className="w-3 h-3" />
                সূরা যুক্ত করুন
              </button>
            </div>

            {/* Add Dua Control */}
            <div
              className="rounded-2xl border p-3 space-y-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <span className="text-xs font-semibold block">+ দুআ যোগ করুন</span>
              <input
                type="text"
                value={duaSearch}
                onChange={(e) => setDuaSearch(e.target.value)}
                placeholder="দুআ খুঁজুন..."
                className="w-full px-3 py-1.5 rounded-xl text-xs border outline-none"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {matchingDuas.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => addDua(d.id)}
                    className="px-2.5 py-1 rounded-full text-[11px] border cursor-pointer truncate max-w-[220px]"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    + {d.titleBangla}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              {!draft.isNew ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDelete()}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium border cursor-pointer"
                  style={{
                    backgroundColor: 'var(--danger-soft)',
                    borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
                    color: 'var(--danger)',
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ডিলিট
                </button>
              ) : (
                <span />
              )}

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
          </>
        )}
      </section>
    </div>
  );
}
