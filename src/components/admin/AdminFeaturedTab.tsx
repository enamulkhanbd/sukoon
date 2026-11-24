import { useState } from 'react';
import { Loader2, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import type {
  ActiveFeaturedCard,
  FeaturedCardAction,
  FeaturedCardActionType,
} from '../../data/cmsTypes';
import { SURAHS } from '../../data/surahs';
import {
  adminDeleteFeaturedCard,
  adminPublishFeaturedCard,
} from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
import { normalizeIndoPakText, toBanglaDigits } from '../../utils/formatters';
import { useToast } from '../ToastProvider';

interface CardDraft {
  id: string;
  isNew: boolean;
  titleBangla: string;
  bodyBangla: string;
  arabicSnippet: string;
  badgeLabel: string;
  actionType: FeaturedCardActionType;
  surahId: number;
  startAyah: number;
  duaId: string;
  templateId: string;
  ctaLabel: string;
  active: boolean;
  startDate: string;
  endDate: string;
  priority: number;
}

export function AdminFeaturedTab() {
  const toast = useToast();
  const catalog = useCatalog();
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const startNewCard = () => {
    setDraft({
      id: `card-${Date.now().toString(36)}`,
      isNew: true,
      titleBangla: '',
      bodyBangla: '',
      arabicSnippet: '',
      badgeLabel: 'আজকের বিশেষ আমল',
      actionType: 'none',
      surahId: 18,
      startAyah: 1,
      duaId: catalog.duas[0]?.id ?? '',
      templateId: catalog.routineTemplates[0]?.id ?? '',
      ctaLabel: 'পাঠ করুন',
      active: true,
      startDate: '',
      endDate: '',
      priority: 10,
    });
  };

  const openCard = (card: ActiveFeaturedCard) => {
    setDraft({
      id: card.id,
      isNew: false,
      titleBangla: card.titleBangla,
      bodyBangla: card.bodyBangla,
      arabicSnippet: card.arabicSnippet ?? '',
      badgeLabel: card.badgeLabel ?? 'বিশেষ আমল',
      actionType: card.action?.type ?? 'none',
      surahId: card.action?.surahId ?? 18,
      startAyah: card.action?.startAyah ?? 1,
      duaId: card.action?.duaId ?? catalog.duas[0]?.id ?? '',
      templateId: card.action?.templateId ?? catalog.routineTemplates[0]?.id ?? '',
      ctaLabel: card.action?.ctaLabel ?? 'পাঠ করুন',
      active: card.active,
      startDate: card.startDate ?? '',
      endDate: card.endDate ?? '',
      priority: card.priority,
    });
  };

  const handlePublish = async () => {
    if (!draft) return;
    if (!draft.titleBangla.trim() || !draft.bodyBangla.trim()) {
      toast.warning('শিরোনাম ও বিবরণ অবশ্যই লিখতে হবে।');
      return;
    }

    let action: FeaturedCardAction | undefined;
    if (draft.actionType === 'surah') {
      action = {
        type: 'surah',
        surahId: draft.surahId,
        startAyah: Math.max(1, draft.startAyah),
        ctaLabel: draft.ctaLabel.trim() || 'পাঠ করুন',
      };
    } else if (draft.actionType === 'dua' && draft.duaId) {
      action = {
        type: 'dua',
        duaId: draft.duaId,
        ctaLabel: draft.ctaLabel.trim() || 'দুআ পড়ুন',
      };
    } else if (draft.actionType === 'routineTemplate' && draft.templateId) {
      action = {
        type: 'routineTemplate',
        templateId: draft.templateId,
        ctaLabel: draft.ctaLabel.trim() || 'রুটিন দেখুন',
      };
    } else {
      action = { type: 'none' };
    }

    setSaving(true);
    try {
      await adminPublishFeaturedCard({
        id: draft.id,
        titleBangla: draft.titleBangla,
        bodyBangla: draft.bodyBangla,
        arabicSnippet: draft.arabicSnippet || undefined,
        badgeLabel: draft.badgeLabel || undefined,
        action,
        active: draft.active,
        startDate: draft.startDate || undefined,
        endDate: draft.endDate || undefined,
        priority: draft.priority,
      });
      setDraft({ ...draft, isNew: false });
      toast.success('হোম স্পটলাইট কার্ড পাবলিশ হয়েছে।');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'পাবলিশ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft || draft.isNew) return;
    if (!window.confirm('এই হোম স্পটলাইট কার্ডটি মুছে ফেলবেন?')) return;
    setSaving(true);
    try {
      await adminDeleteFeaturedCard(draft.id);
      setDraft(null);
      toast.info('কার্ডটি মুছে ফেলা হয়েছে।');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'মুছে ফেলা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

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
          <h2 className="text-sm font-semibold">হোম স্পটলাইট কার্ড</h2>
          <button
            type="button"
            onClick={startNewCard}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন কার্ড
          </button>
        </div>

        {catalog.featuredCards.length === 0 ? (
          <p className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            এখনো কোনো স্পটলাইট কার্ড নেই।
          </p>
        ) : (
          <div className="space-y-2">
            {catalog.featuredCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => openCard(card)}
                className="w-full p-3 rounded-2xl border text-left space-y-1 cursor-pointer"
                style={{
                  backgroundColor:
                    draft?.id === card.id
                      ? 'var(--accent-soft)'
                      : 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold truncate">
                    {card.titleBangla}
                  </p>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: card.active
                        ? 'var(--accent-soft)'
                        : 'var(--bg-elevated)',
                      color: card.active ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {card.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                  </span>
                </div>
                {(card.startDate || card.endDate) && (
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    সিডিউল: {card.startDate || 'শুরু নেই'} → {card.endDate || 'শেষ নেই'}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Right Editor + Live Preview */}
      <section
        className="lg:col-span-7 rounded-3xl border p-5 space-y-4"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {!draft ? (
          <p className="py-16 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            হোম স্ক্রিনে বিশেষ আমল, জুমুআ/রমাদান রিমাইন্ডার বা নতুন রুটিন হাইলাইট করতে একটি কার্ড তৈরি করুন।
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {draft.isNew ? 'নতুন স্পটলাইট কার্ড' : 'স্পটলাইট কার্ড সম্পাদনা'}
              </h3>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                সক্রিয় (হোমে দেখাবে)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-medium">ব্যাজ লেবেল</span>
                <input
                  type="text"
                  value={draft.badgeLabel}
                  onChange={(e) =>
                    setDraft({ ...draft, badgeLabel: e.target.value })
                  }
                  placeholder="যেমন: জুমুআর আমল"
                  className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-medium">প্রায়োরিটি (বেশি হলে আগে দেখাবে)</span>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft({ ...draft, priority: Math.max(0, Number(e.target.value) || 0) })
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
              <span className="text-xs font-medium">শিরোনাম *</span>
              <input
                type="text"
                value={draft.titleBangla}
                onChange={(e) =>
                  setDraft({ ...draft, titleBangla: e.target.value })
                }
                placeholder="যেমন: আজ জুমুআ — সূরা কাহফ তিলাওয়াত করুন"
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-medium">বিবরণ / বার্তা *</span>
              <textarea
                rows={3}
                value={draft.bodyBangla}
                onChange={(e) =>
                  setDraft({ ...draft, bodyBangla: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-medium">আরবি আয়াত / দুআ (ঐচ্ছিক)</span>
              <textarea
                dir="rtl"
                rows={2}
                value={draft.arabicSnippet}
                onChange={(e) =>
                  setDraft({ ...draft, arabicSnippet: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border outline-none font-indopak text-xl text-right"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
            </label>

            {/* Schedule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-medium">শুরুর তারিখ (ঐচ্ছিক)</span>
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) =>
                    setDraft({ ...draft, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-xs font-medium">শেষের তারিখ (ঐচ্ছিক)</span>
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(e) =>
                    setDraft({ ...draft, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                />
              </label>
            </div>

            {/* Action Link */}
            <div
              className="rounded-2xl border p-3 space-y-2.5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <span className="text-xs font-semibold block">বাটন অ্যাকশন (CTA)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={draft.actionType}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      actionType: e.target.value as FeaturedCardActionType,
                    })
                  }
                  className="px-3 py-1.5 rounded-xl text-xs border"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <option value="none">কোনো লিংক নেই (শুধু বার্তা)</option>
                  <option value="surah">সূরা / আয়াত খুলুন</option>
                  <option value="dua">দুআ খুলুন</option>
                  <option value="routineTemplate">সাজেস্টেড রুটিন দেখুন</option>
                </select>

                {draft.actionType !== 'none' && (
                  <input
                    type="text"
                    value={draft.ctaLabel}
                    onChange={(e) =>
                      setDraft({ ...draft, ctaLabel: e.target.value })
                    }
                    placeholder="বাটন টেক্সট (যেমন: পাঠ করুন)"
                    className="px-3 py-1.5 rounded-xl text-xs border"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  />
                )}
              </div>

              {draft.actionType === 'surah' && (
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={draft.surahId}
                    onChange={(e) =>
                      setDraft({ ...draft, surahId: Number(e.target.value) })
                    }
                    className="col-span-2 px-3 py-1.5 rounded-xl text-xs border"
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
                    value={draft.startAyah}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        startAyah: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    placeholder="আয়াত"
                    className="px-3 py-1.5 rounded-xl text-xs border"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  />
                </div>
              )}

              {draft.actionType === 'dua' && (
                <select
                  value={draft.duaId}
                  onChange={(e) => setDraft({ ...draft, duaId: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl text-xs border"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  {catalog.duas.map((d) => (
                    <option key={d.id} value={d.id}>
                      {toBanglaDigits(d.chapterId)}. {d.titleBangla}
                    </option>
                  ))}
                </select>
              )}

              {draft.actionType === 'routineTemplate' && (
                <select
                  value={draft.templateId}
                  onChange={(e) =>
                    setDraft({ ...draft, templateId: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded-xl text-xs border"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  {catalog.routineTemplates.length === 0 ? (
                    <option value="">আগে রুটিন টেমপ্লেট তৈরি করুন</option>
                  ) : (
                    catalog.routineTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Live Card Preview */}
            <div
              className="rounded-2xl p-4 border space-y-2"
              style={{
                backgroundColor: 'var(--bg-page)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <p className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                <Sparkles className="w-3 h-3" />
                {draft.badgeLabel || 'বিশেষ আমল'} (হোম প্রিভিউ)
              </p>
              <h4 className="text-sm font-semibold">
                {draft.titleBangla || '(শিরোনাম)'}
              </h4>
              {draft.arabicSnippet && (
                <p dir="rtl" className="font-indopak text-xl text-right py-1">
                  {normalizeIndoPakText(draft.arabicSnippet)}
                </p>
              )}
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {draft.bodyBangla || '(বিবরণ)'}
              </p>
            </div>

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
