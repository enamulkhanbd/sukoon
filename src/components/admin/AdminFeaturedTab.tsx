import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FilePenLine,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
import { normalizeIndoPakText } from '../../utils/formatters';
import { useToast } from '../ToastProvider';
import {
  deleteDraftFromStorage,
  loadDraftsMap,
  saveDraftToStorage,
  type StoredDraft,
} from './adminDrafts';
import type { StudioLaunchIntent } from './AdminPanelView';
import {
  StudioBadge,
  StudioButton,
  StudioConfirmDialog,
  StudioDropdown,
  StudioEditorSheet,
  StudioEmptyState,
  StudioField,
  StudioInput,
  StudioSection,
  StudioSwitch,
  StudioTextarea,
  useKeyboardSave,
} from './StudioUI';

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

type PreviewTheme = 'paper' | 'dark';

export function AdminFeaturedTab({
  launchIntent,
  onConsumeIntent,
}: {
  launchIntent?: StudioLaunchIntent | null;
  onConsumeIntent?: () => void;
}) {
  const toast = useToast();
  const catalog = useCatalog();
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [baselineHash, setBaselineHash] = useState('');
  const [savedDrafts, setSavedDrafts] = useState<Record<string, StoredDraft<CardDraft>>>(
    () => loadDraftsMap<CardDraft>('featured')
  );
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('paper');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const listItems = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{
      id: string;
      titleBangla: string;
      bodyBangla: string;
      active: boolean;
      priority: number;
      startDate?: string;
      endDate?: string;
      hasLocalDraft?: boolean;
      isLocalOnly?: boolean;
      source?: ActiveFeaturedCard;
    }> = [];

    for (const card of catalog.featuredCards) {
      seen.add(card.id);
      const local = savedDrafts[card.id]?.data;
      out.push({
        id: card.id,
        titleBangla: local?.titleBangla || card.titleBangla,
        bodyBangla: local?.bodyBangla || card.bodyBangla,
        active: local?.active ?? card.active,
        priority: local?.priority ?? card.priority,
        startDate: local ? local.startDate || undefined : card.startDate,
        endDate: local ? local.endDate || undefined : card.endDate,
        hasLocalDraft: Boolean(local),
        source: card,
      });
    }

    for (const entry of Object.values(savedDrafts)) {
      if (seen.has(entry.id)) continue;
      out.push({
        id: entry.id,
        titleBangla: entry.data.titleBangla || '(Untitled Spotlight)',
        bodyBangla: entry.data.bodyBangla,
        active: entry.data.active,
        priority: entry.data.priority,
        startDate: entry.data.startDate || undefined,
        endDate: entry.data.endDate || undefined,
        hasLocalDraft: true,
        isLocalOnly: true,
      });
    }
    return out;
  }, [catalog.featuredCards, savedDrafts]);

  const isDirty = Boolean(draft) && JSON.stringify(draft) !== baselineHash;
  const hasSavedDraft = draft ? Boolean(savedDrafts[draft.id]) : false;
  const isPublishedClean = Boolean(draft) && !draft!.isNew && !hasSavedDraft && !isDirty;

  const startNewCard = useCallback(() => {
    const fresh: CardDraft = {
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
    };
    setDraft(fresh);
    setBaselineHash(JSON.stringify(fresh));
    setShowPreview(true);
  }, [catalog.duas, catalog.routineTemplates]);

  const openListItem = useCallback(
    (row: (typeof listItems)[number]) => {
      const local = savedDrafts[row.id]?.data;
      if (local) {
        const cloned = { ...local };
        setDraft(cloned);
        setBaselineHash(JSON.stringify(cloned));
        return;
      }
      if (!row.source) return;
      const card = row.source;
      const loaded: CardDraft = {
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
        templateId:
          card.action?.templateId ?? catalog.routineTemplates[0]?.id ?? '',
        ctaLabel: card.action?.ctaLabel ?? 'পাঠ করুন',
        active: card.active,
        startDate: card.startDate ?? '',
        endDate: card.endDate ?? '',
        priority: card.priority,
      };
      setDraft(loaded);
      setBaselineHash(JSON.stringify(loaded));
    },
    [savedDrafts, catalog.duas, catalog.routineTemplates]
  );

  useEffect(() => {
    if (!launchIntent) return;
    if (launchIntent.mode === 'new') {
      startNewCard();
    } else if (launchIntent.mode === 'edit' && launchIntent.id) {
      const row = listItems.find((r) => r.id === launchIntent.id);
      if (row) openListItem(row);
    }
    onConsumeIntent?.();
  }, [launchIntent, listItems, startNewCard, openListItem, onConsumeIntent]);

  const handleSaveDraft = () => {
    if (!draft) return;
    setSavedDrafts(saveDraftToStorage('featured', draft.id, draft));
    setBaselineHash(JSON.stringify(draft));
    toast.info('Spotlight draft saved locally.');
  };

  const handleCancel = () => {
    if (isDirty) {
      setConfirmCancelOpen(true);
    } else {
      setDraft(null);
      setBaselineHash('');
    }
  };

  const handlePublish = useCallback(async () => {
    if (!draft || saving) return;
    if (!draft.titleBangla.trim() || !draft.bodyBangla.trim()) {
      toast.warning('Title and message body are required.');
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
      const saved: CardDraft = { ...draft, isNew: false };
      setSavedDrafts(deleteDraftFromStorage<CardDraft>('featured', draft.id));
      setDraft(saved);
      setBaselineHash(JSON.stringify(saved));
      toast.success('Home spotlight card published.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish card.');
    } finally {
      setSaving(false);
    }
  }, [draft, saving, toast]);

  useKeyboardSave(Boolean(draft) && !saving, () => {
    void handlePublish();
  });

  const executeDelete = async () => {
    if (!draft) return;
    if (draft.isNew && hasSavedDraft) {
      setSavedDrafts(deleteDraftFromStorage<CardDraft>('featured', draft.id));
      setConfirmOpen(false);
      setDraft(null);
      setBaselineHash('');
      toast.info('Draft discarded.');
      return;
    }
    if (draft.isNew) return;
    setSaving(true);
    try {
      await adminDeleteFeaturedCard(draft.id);
      setSavedDrafts(deleteDraftFromStorage<CardDraft>('featured', draft.id));
      setConfirmOpen(false);
      setDraft(null);
      setBaselineHash('');
      toast.info('Spotlight card deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete card.');
    } finally {
      setSaving(false);
    }
  };

  const previewColors =
    previewTheme === 'paper'
      ? {
          bg: '#faf6ee',
          elevated: '#fffdf8',
          surface: '#f2ead9',
          border: '#e3d8c3',
          text: '#1f241e',
          secondary: '#5e5a4f',
          accent: '#8c6223',
          accentText: '#ffffff',
        }
      : {
          bg: '#110f0c',
          elevated: '#231e18',
          surface: '#1b1712',
          border: '#352d24',
          text: '#f0e8da',
          secondary: '#b8ad9b',
          accent: '#d4a654',
          accentText: '#14110c',
        };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <header
        className="h-[52px] px-5 sm:px-7 border-b flex items-center justify-between gap-3 shrink-0"
        style={{
          backgroundColor: 'var(--st-bg)',
          borderColor: 'var(--st-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <h1 className="text-[14px] font-semibold tracking-tight">Home Spotlight</h1>
          <span
            className="text-[11px] font-medium px-1.5 py-0.5 rounded-[5px] tabular-nums"
            style={{
              backgroundColor: 'var(--st-bg-muted)',
              color: 'var(--st-text-muted)',
            }}
          >
            {listItems.length}
          </span>
        </div>
        <StudioButton variant="primary" size="sm" onClick={startNewCard}>
          <Plus className="w-3.5 h-3.5" />
          New Card
        </StudioButton>
      </header>

      {/* Full-Width List */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--st-bg)' }}>
        {listItems.length === 0 ? (
          <StudioEmptyState
            icon={<Sparkles className="w-5 h-5" />}
            title="No spotlight cards yet"
            description="Highlight Jumu'ah reminders, Ramadan notices, or curated routines directly on the Sukoon home screen."
            action={
              <StudioButton variant="primary" size="md" onClick={startNewCard}>
                <Plus className="w-4 h-4" />
                Create Spotlight Card
              </StudioButton>
            }
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--st-border)' }}>
            {listItems.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => openListItem(card)}
                className="studio-hover w-full px-5 sm:px-7 py-3.5 text-left flex items-center justify-between gap-4 transition-colors cursor-pointer"
                style={{ borderColor: 'var(--st-border)' }}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13.5px] font-medium truncate">
                      {card.titleBangla}
                    </p>
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: 'var(--st-text-muted)' }}
                    >
                      P{card.priority}
                    </span>
                    {card.isLocalOnly ? (
                      <StudioBadge tone="blue" dot>
                        Draft
                      </StudioBadge>
                    ) : (
                      <StudioBadge tone={card.active ? 'emerald' : 'neutral'} dot>
                        {card.active ? 'Active' : 'Paused'}
                      </StudioBadge>
                    )}
                    {card.hasLocalDraft && !card.isLocalOnly && (
                      <StudioBadge tone="blue" dot>
                        Draft
                      </StudioBadge>
                    )}
                  </div>
                  {card.bodyBangla && (
                    <p
                      className="text-xs truncate"
                      style={{ color: 'var(--st-text-muted)' }}
                    >
                      {card.bodyBangla}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {(card.startDate || card.endDate) && (
                    <span
                      className="hidden sm:inline text-[11px] font-mono"
                      style={{ color: 'var(--st-text-muted)' }}
                    >
                      {card.startDate || '∞'} → {card.endDate || '∞'}
                    </span>
                  )}
                  <ChevronRight
                    className="w-4 h-4 shrink-0"
                    style={{ color: 'var(--st-text-faint)' }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Full-Screen Editor Sheet */}
      <StudioEditorSheet
        open={Boolean(draft)}
        showPreview={showPreview}
        header={
          draft && (
            <header
              className="h-[52px] px-4 sm:px-6 border-b flex items-center justify-between gap-3 shrink-0"
              style={{
                backgroundColor: 'var(--st-bg)',
                borderColor: 'var(--st-border)',
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13.5px] font-semibold tracking-tight truncate">
                  {draft.isNew ? 'New Spotlight' : 'Edit Spotlight'}
                </span>
                {isDirty ? (
                  <StudioBadge tone="amber" dot>
                    Unsaved
                  </StudioBadge>
                ) : hasSavedDraft ? (
                  <StudioBadge tone="blue" dot>
                    Draft Saved
                  </StudioBadge>
                ) : draft.isNew ? (
                  <StudioBadge tone="blue" dot>
                    New Draft
                  </StudioBadge>
                ) : (
                  <StudioBadge tone={draft.active ? 'emerald' : 'neutral'} dot>
                    {draft.active ? 'Published' : 'Paused'}
                  </StudioBadge>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {(!draft.isNew || hasSavedDraft) && (
                  <StudioButton
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => setConfirmOpen(true)}
                    style={{ color: 'var(--st-danger)' }}
                    title={draft.isNew ? 'Delete draft' : 'Delete card'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </StudioButton>
                )}

                <StudioButton
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={handleCancel}
                >
                  Cancel
                </StudioButton>

                <StudioButton
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={handleSaveDraft}
                >
                  <FilePenLine className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save Draft</span>
                </StudioButton>

                <StudioButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPreview((v) => !v)}
                  style={
                    showPreview
                      ? {
                          backgroundColor: 'var(--st-bg-active)',
                          borderColor: 'var(--st-border-strong)',
                        }
                      : undefined
                  }
                >
                  {showPreview ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Preview</span>
                </StudioButton>

                <StudioButton
                  variant={isPublishedClean ? 'secondary' : 'primary'}
                  size="sm"
                  loading={saving}
                  onClick={() => void handlePublish()}
                  style={
                    isPublishedClean
                      ? {
                          color: 'var(--st-accent)',
                          borderColor:
                            'color-mix(in srgb, var(--st-accent) 35%, var(--st-border))',
                        }
                      : undefined
                  }
                >
                  {!saving &&
                    (isPublishedClean ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    ))}
                  <span>{isPublishedClean ? 'Published' : 'Publish'}</span>
                </StudioButton>
              </div>
            </header>
          )
        }
        previewPane={
          draft && (
            <aside
              className="w-full xl:w-[380px] shrink-0 xl:border-l h-full flex flex-col overflow-hidden"
              style={{
                backgroundColor: 'var(--st-bg-subtle)',
                borderColor: 'var(--st-border)',
              }}
            >
              <div
                className="h-10 px-4 border-b flex items-center justify-between gap-2 shrink-0"
                style={{ borderColor: 'var(--st-border)' }}
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: 'var(--st-text-muted)' }}
                >
                  Home Card Preview
                </span>
                <div
                  className="inline-flex p-0.5 rounded-[5px] border text-[11px] font-medium"
                  style={{
                    backgroundColor: 'var(--st-bg)',
                    borderColor: 'var(--st-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewTheme('paper')}
                    className="px-2 py-0.5 rounded-[4px] cursor-pointer"
                    style={{
                      backgroundColor:
                        previewTheme === 'paper' ? 'var(--st-bg-active)' : 'transparent',
                      color:
                        previewTheme === 'paper'
                          ? 'var(--st-text)'
                          : 'var(--st-text-muted)',
                    }}
                  >
                    Paper
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTheme('dark')}
                    className="px-2 py-0.5 rounded-[4px] cursor-pointer"
                    style={{
                      backgroundColor:
                        previewTheme === 'dark' ? 'var(--st-bg-active)' : 'transparent',
                      color:
                        previewTheme === 'dark'
                          ? 'var(--st-text)'
                          : 'var(--st-text-muted)',
                    }}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div
                className="flex-1 overflow-y-auto p-5 flex items-start justify-center"
                style={{ backgroundColor: previewColors.bg }}
              >
                <div
                  className="w-full max-w-[330px] rounded-2xl border p-4 space-y-2.5"
                  style={{
                    backgroundColor: previewColors.elevated,
                    borderColor: previewColors.border,
                    color: previewColors.text,
                  }}
                >
                  <p
                    className="text-[11px] font-semibold inline-flex items-center gap-1"
                    style={{ color: previewColors.accent }}
                  >
                    <Sparkles className="w-3 h-3" />
                    {draft.badgeLabel || 'বিশেষ আমল'}
                  </p>
                  <h4 className="text-[15px] font-semibold leading-snug">
                    {draft.titleBangla || '(শিরোনাম)'}
                  </h4>
                  {draft.arabicSnippet && (
                    <p
                      dir="rtl"
                      className="font-indopak text-xl leading-[2.2] text-right py-2 px-3 rounded-xl"
                      style={{ backgroundColor: previewColors.surface }}
                    >
                      {normalizeIndoPakText(draft.arabicSnippet)}
                    </p>
                  )}
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: previewColors.secondary }}
                  >
                    {draft.bodyBangla || '(সংক্ষিপ্ত বার্তা এখানে দেখাবে)'}
                  </p>
                  {draft.actionType !== 'none' && (
                    <div className="pt-1">
                      <span
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: previewColors.accent,
                          color: previewColors.accentText,
                        }}
                      >
                        {draft.ctaLabel || 'পাঠ করুন'}
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )
        }
      >
        {draft && (
          <div className="max-w-[700px] mx-auto px-5 sm:px-8 py-7 space-y-8">
            <StudioSection title="Visibility & Schedule">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <StudioSwitch
                  checked={draft.active}
                  onChange={(checked) => setDraft({ ...draft, active: checked })}
                  label="Active on Home"
                  description="Show this spotlight banner to users"
                />
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    Priority
                  </span>
                  <StudioInput
                    type="number"
                    min={0}
                    max={10000}
                    value={draft.priority}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        priority: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="!w-20 !h-8 font-mono tabular-nums text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StudioField label="Start Date (Optional)">
                  <StudioInput
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                  />
                </StudioField>
                <StudioField label="End Date (Optional)">
                  <StudioInput
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                  />
                </StudioField>
              </div>
            </StudioSection>

            <StudioSection title="Card Content">
              <StudioField label="Badge Label">
                <StudioInput
                  type="text"
                  value={draft.badgeLabel}
                  onChange={(e) => setDraft({ ...draft, badgeLabel: e.target.value })}
                  placeholder="যেমন: জুমুআর আমল"
                />
              </StudioField>

              <StudioField label="Headline (Bangla)" required>
                <StudioInput
                  type="text"
                  value={draft.titleBangla}
                  onChange={(e) => setDraft({ ...draft, titleBangla: e.target.value })}
                  placeholder="যেমন: আজ জুমুআ — সূরা কাহফ তিলাওয়াত করুন"
                  className="!h-10 !text-[15px] font-medium"
                />
              </StudioField>

              <StudioField label="Message Body (Bangla)" required>
                <StudioTextarea
                  rows={3}
                  value={draft.bodyBangla}
                  onChange={(e) => setDraft({ ...draft, bodyBangla: e.target.value })}
                  placeholder="সংক্ষিপ্ত বার্তা বা ফযীলত..."
                />
              </StudioField>

              <StudioField
                label="Arabic Snippet (Optional)"
                action={
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: 'var(--st-text-faint)' }}
                  >
                    IndoPak • RTL
                  </span>
                }
              >
                <textarea
                  dir="rtl"
                  rows={2}
                  value={draft.arabicSnippet}
                  onChange={(e) => setDraft({ ...draft, arabicSnippet: e.target.value })}
                  placeholder="ঐচ্ছিক আরবি আয়াত বা দুআ..."
                  className="studio-field-control w-full px-3.5 py-3 font-indopak text-2xl leading-[2.1] text-right placeholder:font-sans placeholder:text-sm placeholder:leading-normal"
                />
              </StudioField>
            </StudioSection>

            <StudioSection title="Call-to-Action Button">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StudioField label="Action Target">
                  <StudioDropdown<FeaturedCardActionType>
                    value={draft.actionType}
                    searchable={false}
                    onChange={(val) => setDraft({ ...draft, actionType: val })}
                    options={[
                      { value: 'none', label: 'No link (Message only)' },
                      { value: 'surah', label: 'Open Surah / Ayah' },
                      { value: 'dua', label: 'Open Dua' },
                      { value: 'routineTemplate', label: 'Open Routine Template' },
                    ]}
                  />
                </StudioField>

                {draft.actionType !== 'none' && (
                  <StudioField label="Button Label">
                    <StudioInput
                      type="text"
                      value={draft.ctaLabel}
                      onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
                      placeholder="যেমন: পাঠ করুন"
                    />
                  </StudioField>
                )}
              </div>

              {draft.actionType === 'surah' && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <StudioField label="Surah" className="sm:col-span-8">
                    <StudioDropdown<number>
                      value={draft.surahId}
                      onChange={(val) => setDraft({ ...draft, surahId: val })}
                      searchPlaceholder="Search Surah…"
                      options={SURAHS.map((s) => ({
                        value: s.id,
                        label: `${s.id}. ${s.nameBangla}`,
                        meta: `${s.versesCount}`,
                      }))}
                    />
                  </StudioField>
                  <StudioField label="Start Ayah" className="sm:col-span-4">
                    <StudioInput
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
                      className="font-mono tabular-nums"
                    />
                  </StudioField>
                </div>
              )}

              {draft.actionType === 'dua' && (
                <StudioField label="Target Dua">
                  <StudioDropdown<string>
                    value={draft.duaId}
                    onChange={(val) => setDraft({ ...draft, duaId: val })}
                    searchPlaceholder="Search Duas…"
                    options={catalog.duas.map((d) => ({
                      value: d.id,
                      label: `${d.chapterId}.${d.order} — ${d.titleBangla}`,
                    }))}
                  />
                </StudioField>
              )}

              {draft.actionType === 'routineTemplate' && (
                <StudioField label="Target Routine Template">
                  <StudioDropdown<string>
                    value={draft.templateId}
                    disabled={catalog.routineTemplates.length === 0}
                    placeholder="Create a routine template first"
                    onChange={(val) => setDraft({ ...draft, templateId: val })}
                    options={catalog.routineTemplates.map((t) => ({
                      value: t.id,
                      label: t.title,
                      meta: `v${t.version}`,
                    }))}
                  />
                </StudioField>
              )}
            </StudioSection>
          </div>
        )}
      </StudioEditorSheet>

      <StudioConfirmDialog
        open={confirmOpen}
        title={draft?.isNew ? 'Delete saved draft?' : 'Delete spotlight card?'}
        description={
          draft?.isNew
            ? 'This unpublished spotlight draft will be permanently discarded.'
            : 'This spotlight card will be permanently removed from the Sukoon home screen.'
        }
        confirmLabel={draft?.isNew ? 'Delete Draft' : 'Delete Card'}
        loading={saving}
        onConfirm={() => void executeDelete()}
        onCancel={() => setConfirmOpen(false)}
      />

      <StudioConfirmDialog
        open={confirmCancelOpen}
        title="Discard unsaved changes?"
        description="You have unsaved edits. Save as draft first or discard them and close the editor."
        confirmLabel="Discard & Close"
        cancelLabel="Keep Editing"
        onConfirm={() => {
          setConfirmCancelOpen(false);
          setDraft(null);
          setBaselineHash('');
        }}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}
