import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarCheck2,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FilePenLine,
  Plus,
  ScrollText,
  Send,
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

export function AdminRoutinesTab({
  launchIntent,
  onConsumeIntent,
}: {
  launchIntent?: StudioLaunchIntent | null;
  onConsumeIntent?: () => void;
}) {
  const toast = useToast();
  const catalog = useCatalog();
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [baselineHash, setBaselineHash] = useState('');
  const [savedDrafts, setSavedDrafts] = useState<Record<string, StoredDraft<TemplateDraft>>>(
    () => loadDraftsMap<TemplateDraft>('routines')
  );
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const [adderTab, setAdderTab] = useState<'surah' | 'dua'>('surah');
  const [selectedSurahId, setSelectedSurahId] = useState(18);
  const [startAyah, setStartAyah] = useState(1);
  const [endAyah, setEndAyah] = useState(110);
  const [duaSearch, setDuaSearch] = useState('');

  const listItems = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{
      id: string;
      title: string;
      description?: string;
      version: number;
      featured: boolean;
      seasonTag?: string;
      assignedDays: number[];
      itemCount: number;
      isLocalOnly?: boolean;
      hasLocalDraft?: boolean;
      source?: ActiveRoutineTemplate;
    }> = [];

    for (const tpl of catalog.routineTemplates) {
      seen.add(tpl.id);
      const local = savedDrafts[tpl.id]?.data;
      out.push({
        id: tpl.id,
        title: local?.title || tpl.title,
        description: local?.description ?? tpl.description,
        version: tpl.version,
        featured: local?.featured ?? tpl.featured,
        seasonTag: local?.seasonTag ?? tpl.seasonTag,
        assignedDays: local?.assignedDays ?? tpl.assignedDays,
        itemCount: local ? local.items.length : tpl.items.length,
        hasLocalDraft: Boolean(local),
        source: tpl,
      });
    }

    for (const entry of Object.values(savedDrafts)) {
      if (seen.has(entry.id)) continue;
      out.push({
        id: entry.id,
        title: entry.data.title || '(Untitled Template)',
        description: entry.data.description,
        version: entry.data.version,
        featured: entry.data.featured,
        seasonTag: entry.data.seasonTag || undefined,
        assignedDays: entry.data.assignedDays,
        itemCount: entry.data.items.length,
        isLocalOnly: true,
        hasLocalDraft: true,
      });
    }
    return out;
  }, [catalog.routineTemplates, savedDrafts]);

  const isDirty = Boolean(draft) && JSON.stringify(draft) !== baselineHash;
  const hasSavedDraft = draft ? Boolean(savedDrafts[draft.id]) : false;
  const isPublishedClean = Boolean(draft) && !draft!.isNew && !hasSavedDraft && !isDirty;

  const startNewTemplate = useCallback(() => {
    const nextOrder =
      catalog.routineTemplates.reduce((m, t) => Math.max(m, t.order), 0) + 1;
    const fresh: TemplateDraft = {
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
    };
    setDraft(fresh);
    setBaselineHash(JSON.stringify(fresh));
    setShowPreview(false);
  }, [catalog.routineTemplates]);

  const openListItem = useCallback(
    (row: (typeof listItems)[number]) => {
      const local = savedDrafts[row.id]?.data;
      if (local) {
        const cloned: TemplateDraft = {
          ...local,
          assignedDays: [...local.assignedDays],
          items: local.items.map((it) => ({ ...it })),
        };
        setDraft(cloned);
        setBaselineHash(JSON.stringify(cloned));
        return;
      }
      if (!row.source) return;
      const tpl = row.source;
      const loaded: TemplateDraft = {
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
      };
      setDraft(loaded);
      setBaselineHash(JSON.stringify(loaded));
    },
    [savedDrafts]
  );

  useEffect(() => {
    if (!launchIntent) return;
    if (launchIntent.mode === 'new') {
      startNewTemplate();
    } else if (launchIntent.mode === 'edit' && launchIntent.id) {
      const row = listItems.find((r) => r.id === launchIntent.id);
      if (row) openListItem(row);
    }
    onConsumeIntent?.();
  }, [launchIntent, listItems, startNewTemplate, openListItem, onConsumeIntent]);

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

  const handleSaveDraft = () => {
    if (!draft) return;
    setSavedDrafts(saveDraftToStorage('routines', draft.id, draft));
    setBaselineHash(JSON.stringify(draft));
    toast.info('Routine draft saved locally.');
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
    if (!draft.title.trim()) {
      toast.warning('Routine title is required.');
      return;
    }
    if (draft.items.length === 0) {
      toast.warning('Add at least one Surah or Dua.');
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
      const saved: TemplateDraft = { ...draft, isNew: false, version: nextVersion };
      setSavedDrafts(deleteDraftFromStorage<TemplateDraft>('routines', draft.id));
      setDraft(saved);
      setBaselineHash(JSON.stringify(saved));
      toast.success(`Routine template published (v${nextVersion}).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish template.');
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
      setSavedDrafts(deleteDraftFromStorage<TemplateDraft>('routines', draft.id));
      setConfirmOpen(false);
      setDraft(null);
      setBaselineHash('');
      toast.info('Draft discarded.');
      return;
    }
    if (draft.isNew) return;
    setSaving(true);
    try {
      await adminDeleteRoutineTemplate(draft.id);
      setSavedDrafts(deleteDraftFromStorage<TemplateDraft>('routines', draft.id));
      setConfirmOpen(false);
      setDraft(null);
      setBaselineHash('');
      toast.info('Routine template deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete template.');
    } finally {
      setSaving(false);
    }
  };

  const matchingDuas = duaSearch.trim()
    ? catalog.duas
        .filter((d) =>
          d.titleBangla.toLowerCase().includes(duaSearch.trim().toLowerCase())
        )
        .slice(0, 10)
    : catalog.duas.slice(0, 10);

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
          <h1 className="text-[14px] font-semibold tracking-tight">Routine Templates</h1>
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
        <StudioButton variant="primary" size="sm" onClick={startNewTemplate}>
          <Plus className="w-3.5 h-3.5" />
          New Template
        </StudioButton>
      </header>

      {/* Full-Width List */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--st-bg)' }}>
        {listItems.length === 0 ? (
          <StudioEmptyState
            icon={<CalendarCheck2 className="w-5 h-5" />}
            title="No routine templates yet"
            description="Create curated Surah & Dua routines (such as Jumu'ah Amol or Evening Adhkar) that users can adopt in one tap."
            action={
              <StudioButton variant="primary" size="md" onClick={startNewTemplate}>
                <Plus className="w-4 h-4" />
                Create Routine Template
              </StudioButton>
            }
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--st-border)' }}>
            {listItems.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => openListItem(tpl)}
                className="studio-hover w-full px-5 sm:px-7 py-3.5 text-left flex items-center justify-between gap-4 transition-colors cursor-pointer"
                style={{ borderColor: 'var(--st-border)' }}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13.5px] font-medium truncate">{tpl.title}</p>
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: 'var(--st-text-muted)' }}
                    >
                      v{tpl.version}
                    </span>
                    {tpl.hasLocalDraft && (
                      <StudioBadge tone="blue" dot>
                        Draft
                      </StudioBadge>
                    )}
                    {tpl.featured && (
                      <StudioBadge tone="amber">
                        <Sparkles className="w-2.5 h-2.5" />
                        Featured
                      </StudioBadge>
                    )}
                    {tpl.seasonTag && (
                      <StudioBadge tone="neutral">{tpl.seasonTag}</StudioBadge>
                    )}
                  </div>
                  {tpl.description && (
                    <p
                      className="text-xs truncate"
                      style={{ color: 'var(--st-text-muted)' }}
                    >
                      {tpl.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="hidden sm:inline text-xs"
                    style={{ color: 'var(--st-text-muted)' }}
                  >
                    {tpl.itemCount} {tpl.itemCount === 1 ? 'item' : 'items'}
                  </span>
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
                  {draft.isNew ? 'New Routine' : 'Edit Routine'}
                </span>
                <code
                  className="hidden sm:inline-block text-[11px] font-mono px-1.5 py-0.5 rounded-[5px] border"
                  style={{
                    backgroundColor: 'var(--st-bg-subtle)',
                    borderColor: 'var(--st-border)',
                    color: 'var(--st-text-muted)',
                  }}
                >
                  v{draft.version}
                </code>
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
                  <StudioBadge tone="emerald" dot>
                    Published
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
                    title={draft.isNew ? 'Delete draft' : 'Delete template'}
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
              className="w-full xl:w-[370px] shrink-0 xl:border-l h-full flex flex-col overflow-hidden"
              style={{
                backgroundColor: 'var(--st-bg-subtle)',
                borderColor: 'var(--st-border)',
              }}
            >
              <div
                className="h-10 px-4 border-b flex items-center shrink-0"
                style={{ borderColor: 'var(--st-border)' }}
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: 'var(--st-text-muted)' }}
                >
                  Routine Card Preview
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-5 flex justify-center">
                <div
                  className="w-full max-w-[320px] h-fit rounded-2xl border p-4 space-y-3"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {draft.featured && (
                      <span
                        className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--gold-soft)',
                          color: 'var(--gold)',
                        }}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        ফিচার্ড
                      </span>
                    )}
                    {draft.seasonTag && (
                      <span
                        className="text-[10.5px] px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent)',
                        }}
                      >
                        {draft.seasonTag}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">
                      {draft.title || '(রুটিনের নাম নেই)'}
                    </h4>
                    {draft.description && (
                      <p
                        className="text-xs mt-1 leading-relaxed"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {draft.description}
                      </p>
                    )}
                  </div>
                  <div
                    className="text-[11px] pt-2 border-t flex items-center justify-between"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>{toBanglaDigits(draft.items.length)}টি আমল</span>
                    <span>
                      {draft.assignedDays.length === 0
                        ? 'ম্যানুয়াল'
                        : draft.assignedDays.length === 7
                          ? 'প্রতিদিন'
                          : draft.assignedDays.map((d) => DAY_SHORT_BN[d]).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          )
        }
      >
        {draft && (
          <div className="max-w-[740px] mx-auto px-5 sm:px-8 py-7 space-y-8">
            <StudioSection title="Template Details">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <StudioField
                  label="Routine Title (Bangla)"
                  required
                  className="sm:col-span-8"
                >
                  <StudioInput
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="যেমন: জুমুআর বিশেষ আমল"
                    className="!h-10 !text-[15px] font-medium"
                  />
                </StudioField>
                <StudioField label="Season / Badge Tag" className="sm:col-span-4">
                  <StudioInput
                    type="text"
                    value={draft.seasonTag}
                    onChange={(e) => setDraft({ ...draft, seasonTag: e.target.value })}
                    placeholder="যেমন: জুমুআ / রমাদান"
                    className="!h-10"
                  />
                </StudioField>
              </div>

              <StudioField label="Description (Optional)">
                <StudioTextarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="এই রুটিনটি কখন ও কেন পড়বেন..."
                />
              </StudioField>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <StudioSwitch
                  checked={draft.featured}
                  onChange={(checked) => setDraft({ ...draft, featured: checked })}
                  label="Featured Template"
                  description="Pin this template to the top of Suggested Routines"
                />

                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    Sort Order
                  </span>
                  <StudioInput
                    type="number"
                    min={0}
                    value={draft.order}
                    onChange={(e) =>
                      setDraft({ ...draft, order: Number(e.target.value) || 0 })
                    }
                    className="!w-20 !h-8 font-mono tabular-nums text-center"
                  />
                </div>
              </div>
            </StudioSection>

            <StudioSection
              title="Suggested Schedule"
              description="Leave empty for a manual/anytime routine."
              action={
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, assignedDays: [0, 1, 2, 3, 4, 5, 6] })
                    }
                    className="cursor-pointer font-medium hover:underline"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    Every day
                  </button>
                  <span style={{ color: 'var(--st-border-strong)' }}>·</span>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, assignedDays: [] })}
                    className="cursor-pointer font-medium hover:underline"
                    style={{ color: 'var(--st-text-muted)' }}
                  >
                    Clear
                  </button>
                </div>
              }
            >
              <div className="flex flex-wrap gap-1.5">
                {DAY_SHORT_BN.map((label, idx) => {
                  const active = draft.assignedDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className="h-8 px-3 rounded-[6px] text-xs font-medium border cursor-pointer transition-colors"
                      style={{
                        backgroundColor: active
                          ? 'var(--st-primary)'
                          : 'var(--st-bg-subtle)',
                        borderColor: active ? 'var(--st-primary)' : 'var(--st-border)',
                        color: active
                          ? 'var(--st-primary-text)'
                          : 'var(--st-text-secondary)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </StudioSection>

            <StudioSection
              title={`Routine Items (${draft.items.length})`}
              description="Ordered sequence of Surahs and Duas in this routine."
            >
              {draft.items.length === 0 ? (
                <div
                  className="rounded-lg border border-dashed py-8 text-center text-xs"
                  style={{
                    borderColor: 'var(--st-border-strong)',
                    color: 'var(--st-text-muted)',
                  }}
                >
                  No items added yet. Use the picker below to add Surahs or Duas.
                </div>
              ) : (
                <div
                  className="rounded-lg border overflow-hidden divide-y"
                  style={{ borderColor: 'var(--st-border)' }}
                >
                  {draft.items.map((it, idx) => {
                    const isDua = it.kind === 'dua' && it.duaId;
                    const label = isDua
                      ? `${catalog.duaMap[it.duaId!]?.titleBangla ?? it.duaId}`
                      : it.surahId && SURAH_MAP[it.surahId]
                        ? `সূরা ${SURAH_MAP[it.surahId].nameBangla}`
                        : 'Unknown Item';
                    const meta = isDua
                      ? `${it.targetCount ?? 1}×`
                      : it.surahId && SURAH_MAP[it.surahId]
                        ? `Ayah ${it.startAyah ?? 1}–${it.endAyah ?? SURAH_MAP[it.surahId].versesCount}`
                        : '';

                    return (
                      <div
                        key={idx}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                        style={{
                          backgroundColor: 'var(--st-bg)',
                          borderColor: 'var(--st-border)',
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="text-[11px] font-mono tabular-nums w-5 shrink-0"
                            style={{ color: 'var(--st-text-faint)' }}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <StudioBadge tone={isDua ? 'emerald' : 'blue'}>
                            {isDua ? 'Dua' : 'Surah'}
                          </StudioBadge>
                          <span className="text-[13px] font-medium truncate">
                            {label}
                          </span>
                          {meta && (
                            <span
                              className="text-[11px] font-mono shrink-0"
                              style={{ color: 'var(--st-text-muted)' }}
                            >
                              {meta}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveItem(idx, -1)}
                            className="p-1 rounded-[5px] cursor-pointer disabled:opacity-30"
                            style={{ color: 'var(--st-text-secondary)' }}
                            aria-label="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === draft.items.length - 1}
                            onClick={() => moveItem(idx, 1)}
                            className="p-1 rounded-[5px] cursor-pointer disabled:opacity-30"
                            style={{ color: 'var(--st-text-secondary)' }}
                            aria-label="Move down"
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
                            className="p-1 rounded-[5px] cursor-pointer"
                            style={{ color: 'var(--st-danger)' }}
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                className="rounded-lg border overflow-hidden"
                style={{
                  backgroundColor: 'var(--st-bg-subtle)',
                  borderColor: 'var(--st-border)',
                }}
              >
                <div
                  className="flex border-b"
                  style={{ borderColor: 'var(--st-border)' }}
                >
                  <button
                    type="button"
                    onClick={() => setAdderTab('surah')}
                    className="flex-1 h-9 text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-colors"
                    style={{
                      borderColor:
                        adderTab === 'surah' ? 'var(--st-text)' : 'transparent',
                      color:
                        adderTab === 'surah' ? 'var(--st-text)' : 'var(--st-text-muted)',
                      backgroundColor:
                        adderTab === 'surah' ? 'var(--st-bg)' : 'transparent',
                    }}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Add Surah Range
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdderTab('dua')}
                    className="flex-1 h-9 text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-colors"
                    style={{
                      borderColor:
                        adderTab === 'dua' ? 'var(--st-text)' : 'transparent',
                      color:
                        adderTab === 'dua' ? 'var(--st-text)' : 'var(--st-text-muted)',
                      backgroundColor:
                        adderTab === 'dua' ? 'var(--st-bg)' : 'transparent',
                    }}
                  >
                    <ScrollText className="w-3.5 h-3.5" />
                    Add Dua
                  </button>
                </div>

                <div className="p-3.5">
                  {adderTab === 'surah' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <StudioField label="Surah" className="sm:col-span-5">
                        <StudioDropdown<number>
                          size="sm"
                          value={selectedSurahId}
                          onChange={(id) => {
                            setSelectedSurahId(id);
                            setStartAyah(1);
                            setEndAyah(SURAH_MAP[id]?.versesCount ?? 1);
                          }}
                          searchPlaceholder="Search Surah…"
                          options={SURAHS.map((s) => ({
                            value: s.id,
                            label: `${s.id}. ${s.nameBangla}`,
                            meta: `${s.versesCount}`,
                          }))}
                        />
                      </StudioField>
                      <StudioField label="From Ayah" className="sm:col-span-2">
                        <StudioInput
                          type="number"
                          min={1}
                          value={startAyah}
                          onChange={(e) =>
                            setStartAyah(Math.max(1, Number(e.target.value) || 1))
                          }
                          className="!h-8 !text-xs font-mono tabular-nums"
                        />
                      </StudioField>
                      <StudioField label="To Ayah" className="sm:col-span-2">
                        <StudioInput
                          type="number"
                          min={1}
                          value={endAyah}
                          onChange={(e) =>
                            setEndAyah(Math.max(1, Number(e.target.value) || 1))
                          }
                          className="!h-8 !text-xs font-mono tabular-nums"
                        />
                      </StudioField>
                      <div className="sm:col-span-3">
                        <StudioButton
                          variant="secondary"
                          size="sm"
                          onClick={addSurah}
                          className="w-full"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Surah
                        </StudioButton>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <StudioInput
                        type="text"
                        value={duaSearch}
                        onChange={(e) => setDuaSearch(e.target.value)}
                        placeholder="Search duas to attach…"
                        className="!h-8 !text-xs"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {matchingDuas.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => addDua(d.id)}
                            className="px-2.5 py-1 rounded-[6px] text-xs border cursor-pointer truncate max-w-[260px] transition-colors hover:opacity-85"
                            style={{
                              backgroundColor: 'var(--st-bg)',
                              borderColor: 'var(--st-border)',
                              color: 'var(--st-text)',
                            }}
                          >
                            + {d.titleBangla}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </StudioSection>
          </div>
        )}
      </StudioEditorSheet>

      <StudioConfirmDialog
        open={confirmOpen}
        title={draft?.isNew ? 'Delete saved draft?' : 'Delete routine template?'}
        description={
          draft?.isNew
            ? 'This unpublished routine draft will be permanently discarded.'
            : 'This template will be removed from Suggested Routines for all users. Users who already adopted it keep their personal copy.'
        }
        confirmLabel={draft?.isNew ? 'Delete Draft' : 'Delete Template'}
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
