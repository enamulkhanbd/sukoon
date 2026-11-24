import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FilePenLine,
  FolderPlus,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  X,
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
import {
  deleteDraftFromStorage,
  loadDraftsMap,
  saveDraftToStorage,
  type StoredDraft,
} from './adminDrafts';
import type { StudioLaunchIntent } from './AdminPanelView';
import { QuickChapterModal } from './QuickChapterModal';
import {
  StudioBadge,
  StudioButton,
  StudioConfirmDialog,
  StudioDropdown,
  StudioEditorSheet,
  StudioField,
  StudioInput,
  StudioSection,
  StudioSwitch,
  StudioTextarea,
  useKeyboardSave,
} from './StudioUI';

type SourceFilter = 'all' | 'draft' | 'remote' | 'override' | 'hidden';
type PreviewTheme = 'paper' | 'dark';

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

const SOURCE_FILTERS: Array<{ id: SourceFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'remote', label: 'Remote' },
  { id: 'override', label: 'Edited' },
  { id: 'hidden', label: 'Hidden' },
];

function slugifyId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function serializeDraft(d: DuaDraft | null): string {
  if (!d) return '';
  return JSON.stringify(d);
}

export function AdminDuasTab({
  launchIntent,
  onConsumeIntent,
}: {
  launchIntent?: StudioLaunchIntent | null;
  onConsumeIntent?: () => void;
}) {
  const toast = useToast();
  const catalog = useCatalog();

  const [query, setQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState<number | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showPreview, setShowPreview] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('paper');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DuaDraft | null>(null);
  const [baselineHash, setBaselineHash] = useState('');
  const [savedDrafts, setSavedDrafts] = useState<Record<string, StoredDraft<DuaDraft>>>(() =>
    loadDraftsMap<DuaDraft>('duas')
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [quickChapterOpen, setQuickChapterOpen] = useState(false);

  const isDirty = Boolean(draft) && serializeDraft(draft) !== baselineHash;
  const hasSavedDraft = draft ? Boolean(savedDrafts[draft.id]) : false;
  const isPublishedClean = Boolean(draft) && !draft!.isNew && !hasSavedDraft && !isDirty;

  // Build unified list including saved local drafts and hidden built-in duas
  const adminList = useMemo(() => {
    const items: Array<{
      id: string;
      chapterId: number;
      order: number;
      titleBangla: string;
      repeatCount?: number;
      source: 'builtin' | 'override' | 'remote' | 'hidden' | 'draft';
      hasLocalDraft?: boolean;
    }> = [];

    const seenIds = new Set<string>();

    for (const d of catalog.duas) {
      seenIds.add(d.id);
      const localDraft = savedDrafts[d.id]?.data;
      items.push({
        id: d.id,
        chapterId: localDraft?.chapterId ?? d.chapterId,
        order: localDraft?.order ?? d.order,
        titleBangla: localDraft?.titleBangla || d.titleBangla,
        repeatCount: localDraft?.repeatCount ?? d.repeatCount,
        source: d.source,
        hasLocalDraft: Boolean(localDraft),
      });
    }

    for (const staticDua of STATIC_DUAS) {
      const remote = catalog.remoteDuasMap[staticDua.id];
      if (remote?.deleted) {
        seenIds.add(staticDua.id);
        items.push({
          id: staticDua.id,
          chapterId: staticDua.chapterId,
          order: staticDua.order,
          titleBangla: staticDua.titleBangla,
          repeatCount: staticDua.repeatCount,
          source: 'hidden',
          hasLocalDraft: Boolean(savedDrafts[staticDua.id]),
        });
      }
    }

    for (const entry of Object.values(savedDrafts)) {
      if (seenIds.has(entry.id)) continue;
      items.push({
        id: entry.id,
        chapterId: entry.data.chapterId,
        order: entry.data.order,
        titleBangla: entry.data.titleBangla || '(Untitled Draft)',
        repeatCount: entry.data.repeatCount,
        source: 'draft',
        hasLocalDraft: true,
      });
    }

    const q = query.trim().toLowerCase();
    return items
      .filter((it) => {
        if (chapterFilter !== 'all' && it.chapterId !== chapterFilter) return false;
        if (sourceFilter === 'draft') {
          if (!it.hasLocalDraft && it.source !== 'draft') return false;
        } else if (sourceFilter !== 'all' && it.source !== sourceFilter) {
          return false;
        }
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
  }, [catalog, savedDrafts, query, chapterFilter, sourceFilter]);

  const startNewDua = useCallback(() => {
    const chId =
      chapterFilter !== 'all'
        ? chapterFilter
        : (catalog.chapters[0]?.id ?? 1);
    const existingInChapter = catalog.duasByChapter[chId] ?? [];
    const nextOrder =
      existingInChapter.reduce((max, d) => Math.max(max, d.order), 0) + 1;

    const fresh: DuaDraft = {
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
    };
    setDraft(fresh);
    setBaselineHash(serializeDraft(fresh));
    setShowAdvanced(false);
    setShowPreview(false);
  }, [chapterFilter, catalog.chapters, catalog.duasByChapter]);

  const openExistingDua = useCallback(
    (duaId: string) => {
      const saved = savedDrafts[duaId]?.data;
      if (saved) {
        const cloned: DuaDraft = {
          ...saved,
          parts: saved.parts ? saved.parts.map((p) => ({ ...p })) : [],
        };
        setDraft(cloned);
        setBaselineHash(serializeDraft(cloned));
        setShowAdvanced(Boolean(cloned.hasQuranRef || cloned.parts.length > 0));
        return;
      }

      const merged =
        catalog.duaMap[duaId] ?? STATIC_DUAS.find((d) => d.id === duaId);
      if (!merged) return;

      const loaded: DuaDraft = {
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
      };
      setDraft(loaded);
      setBaselineHash(serializeDraft(loaded));
      setShowAdvanced(
        Boolean(merged.quranRef || (merged.parts && merged.parts.length > 0))
      );
    },
    [savedDrafts, catalog.duaMap]
  );

  // Honor external launch intents from Overview (New Dua / Resume Draft)
  useEffect(() => {
    if (!launchIntent) return;
    if (launchIntent.mode === 'new') {
      startNewDua();
    } else if (launchIntent.mode === 'edit' && launchIntent.id) {
      openExistingDua(launchIntent.id);
    }
    onConsumeIntent?.();
  }, [launchIntent, startNewDua, openExistingDua, onConsumeIntent]);

  const handleSaveDraft = () => {
    if (!draft) return;
    const nextMap = saveDraftToStorage('duas', draft.id, draft);
    setSavedDrafts(nextMap);
    setBaselineHash(serializeDraft(draft));
    toast.info('Draft saved locally.');
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
    if (!draft.titleBangla.trim() || !draft.arabic.trim()) {
      toast.warning('Bangla title and Arabic text are required.');
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
          repeatCount:
            p.repeatCount && p.repeatCount >= 1 ? Math.trunc(p.repeatCount) : undefined,
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

      const savedDraft: DuaDraft = { ...draft, isNew: false };
      setSavedDrafts(deleteDraftFromStorage<DuaDraft>('duas', draft.id));
      setDraft(savedDraft);
      setBaselineHash(serializeDraft(savedDraft));
      toast.success('Dua published and synced to local storage.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish Dua.');
    } finally {
      setSaving(false);
    }
  }, [draft, saving, toast]);

  useKeyboardSave(Boolean(draft) && !saving && !quickChapterOpen, () => {
    void handlePublish();
  });

  const executeDeleteOrHide = async () => {
    if (!draft) return;
    if (draft.isNew && hasSavedDraft) {
      setSavedDrafts(deleteDraftFromStorage<DuaDraft>('duas', draft.id));
      setConfirmDeleteOpen(false);
      setDraft(null);
      setBaselineHash('');
      toast.info('Draft discarded.');
      return;
    }
    const isBuiltIn = isBuiltInDuaId(draft.id);
    setSaving(true);
    try {
      await adminDeleteOrHideDua(draft.id, draft.chapterId);
      setSavedDrafts(deleteDraftFromStorage<DuaDraft>('duas', draft.id));
      setConfirmDeleteOpen(false);
      setDraft(null);
      setBaselineHash('');
      toast.info(isBuiltIn ? 'Built-in Dua hidden from users.' : 'Dua deleted permanently.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (duaId: string) => {
    setSaving(true);
    try {
      await adminRevertBuiltInDua(duaId);
      setSavedDrafts(deleteDraftFromStorage<DuaDraft>('duas', duaId));
      toast.success('Reverted to built-in default.');
      const merged = STATIC_DUAS.find((d) => d.id === duaId);
      if (merged) {
        const loaded: DuaDraft = {
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
        };
        setDraft(loaded);
        setBaselineHash(serializeDraft(loaded));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revert.');
    } finally {
      setSaving(false);
    }
  };

  const isSelectedBuiltIn = draft ? isBuiltInDuaId(draft.id) : false;
  const hasRemoteRecord = draft ? Boolean(catalog.remoteDuasMap[draft.id]) : false;

  const previewColors =
    previewTheme === 'paper'
      ? {
          bg: '#faf6ee',
          surface: '#f2ead9',
          border: '#e3d8c3',
          text: '#1f241e',
          secondary: '#5e5a4f',
          muted: '#8a8373',
          accent: '#8c6223',
        }
      : {
          bg: '#110f0c',
          surface: '#1b1712',
          border: '#352d24',
          text: '#f0e8da',
          secondary: '#b8ad9b',
          muted: '#867b6b',
          accent: '#d4a654',
        };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Full-Width Header Bar */}
      <header
        className="h-[52px] px-5 sm:px-7 border-b flex items-center justify-between gap-3 shrink-0"
        style={{
          backgroundColor: 'var(--st-bg)',
          borderColor: 'var(--st-border)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-[14px] font-semibold tracking-tight">Duas</h1>
          <span
            className="text-[11px] font-medium px-1.5 py-0.5 rounded-[5px] tabular-nums"
            style={{
              backgroundColor: 'var(--st-bg-muted)',
              color: 'var(--st-text-muted)',
            }}
          >
            {adminList.length}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StudioButton
            variant="secondary"
            size="sm"
            onClick={() => setQuickChapterOpen(true)}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chapter</span>
          </StudioButton>
          <StudioButton variant="primary" size="sm" onClick={startNewDua}>
            <Plus className="w-3.5 h-3.5" />
            <span>New Dua</span>
          </StudioButton>
        </div>
      </header>

      {/* Filter Bar */}
      <div
        className="px-5 sm:px-7 py-3 border-b flex flex-wrap items-center gap-2.5 shrink-0"
        style={{
          backgroundColor: 'var(--st-bg-subtle)',
          borderColor: 'var(--st-border)',
        }}
      >
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--st-text-faint)' }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or ID…"
            className="studio-field-control w-full h-8 pl-8 pr-7 text-[12.5px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer"
              style={{ color: 'var(--st-text-muted)' }}
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="w-full sm:w-[240px]">
          <StudioDropdown<number | 'all'>
            size="sm"
            value={chapterFilter}
            onChange={(val) => setChapterFilter(val)}
            searchPlaceholder="Search chapters…"
            options={[
              {
                value: 'all',
                label: `All Chapters (${catalog.chapters.length})`,
              },
              ...catalog.chapters.map((ch) => ({
                value: ch.id,
                label: `${ch.id}. ${ch.titleBangla}`,
                meta: `${catalog.duasByChapter[ch.id]?.length ?? 0}`,
              })),
            ]}
          />
        </div>

        <div
          className="grid grid-cols-5 p-0.5 rounded-[6px] border text-[11px] font-medium shrink-0"
          style={{
            backgroundColor: 'var(--st-bg)',
            borderColor: 'var(--st-border)',
          }}
        >
          {SOURCE_FILTERS.map((f) => {
            const active = sourceFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSourceFilter(f.id)}
                className="h-7 px-2.5 rounded-[4px] cursor-pointer transition-colors"
                style={{
                  backgroundColor: active ? 'var(--st-bg-active)' : 'transparent',
                  color: active ? 'var(--st-text)' : 'var(--st-text-muted)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Full-Width Browsable List */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--st-bg)' }}>
        {adminList.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-2">
            <p className="text-sm font-medium" style={{ color: 'var(--st-text-secondary)' }}>
              No matching duas
            </p>
            <p className="text-xs" style={{ color: 'var(--st-text-muted)' }}>
              Try clearing your search or filter, or create a new Dua.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--st-border)' }}>
            {adminList.map((item) => {
              const chapterTitle =
                catalog.chapterMap[item.chapterId]?.titleBangla ??
                `Chapter ${item.chapterId}`;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openExistingDua(item.id)}
                  className="studio-hover w-full px-5 sm:px-7 py-3 text-left flex items-center justify-between gap-4 transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--st-border)' }}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span
                      className="text-[11.5px] font-mono tabular-nums w-10 shrink-0"
                      style={{ color: 'var(--st-text-muted)' }}
                    >
                      {item.chapterId}.{item.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium truncate">
                        {item.titleBangla}
                      </p>
                      <p
                        className="text-[11.5px] truncate mt-0.5"
                        style={{ color: 'var(--st-text-muted)' }}
                      >
                        {chapterTitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {item.repeatCount && item.repeatCount > 1 && (
                      <span
                        className="hidden sm:inline text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-[4px]"
                        style={{
                          backgroundColor: 'var(--st-bg-muted)',
                          color: 'var(--st-text-secondary)',
                        }}
                      >
                        {item.repeatCount}×
                      </span>
                    )}
                    {item.source === 'draft' ? (
                      <StudioBadge tone="blue" dot>
                        Draft
                      </StudioBadge>
                    ) : item.source === 'remote' ? (
                      <StudioBadge tone="emerald" dot>
                        Remote
                      </StudioBadge>
                    ) : item.source === 'override' ? (
                      <StudioBadge tone="amber" dot>
                        Edited
                      </StudioBadge>
                    ) : item.source === 'hidden' ? (
                      <StudioBadge tone="danger" dot>
                        Hidden
                      </StudioBadge>
                    ) : (
                      <StudioBadge tone="neutral">Built-in</StudioBadge>
                    )}
                    {item.hasLocalDraft && item.source !== 'draft' && (
                      <StudioBadge tone="blue" dot>
                        Draft
                      </StudioBadge>
                    )}
                    <ChevronRight
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--st-text-faint)' }}
                    />
                  </div>
                </button>
              );
            })}
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
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="text-[13.5px] font-semibold tracking-tight truncate">
                  {draft.isNew ? 'New Dua' : 'Edit Dua'}
                </span>
                <code
                  className="hidden md:inline-block text-[11px] font-mono px-1.5 py-0.5 rounded-[5px] border truncate max-w-[180px]"
                  style={{
                    backgroundColor: 'var(--st-bg-subtle)',
                    borderColor: 'var(--st-border)',
                    color: 'var(--st-text-muted)',
                  }}
                >
                  {draft.id}
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
                {isSelectedBuiltIn && hasRemoteRecord && (
                  <StudioButton
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleRevert(draft.id)}
                    title="Revert to built-in default"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </StudioButton>
                )}

                {(!draft.isNew || hasSavedDraft) && (
                  <StudioButton
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => setConfirmDeleteOpen(true)}
                    style={{ color: 'var(--st-danger)' }}
                    title={
                      draft.isNew
                        ? 'Delete saved draft'
                        : isSelectedBuiltIn
                          ? 'Hide built-in Dua'
                          : 'Delete Dua'
                    }
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
                  title="Toggle live Sukoon preview"
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
              className="w-full xl:w-[390px] shrink-0 xl:border-l h-full flex flex-col overflow-hidden"
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
                  Sukoon App Preview
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

              <div className="flex-1 overflow-y-auto p-5 flex justify-center">
                <div
                  className="w-full max-w-[340px] h-fit rounded-2xl border p-5 space-y-4"
                  style={{
                    backgroundColor: previewColors.bg,
                    borderColor: previewColors.border,
                    color: previewColors.text,
                  }}
                >
                  <div className="space-y-1">
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: previewColors.accent }}
                    >
                      {catalog.chapterMap[draft.chapterId]?.titleBangla ??
                        `অধ্যায় ${draft.chapterId}`}
                    </p>
                    <h3 className="text-[15px] font-semibold leading-snug">
                      {draft.titleBangla || '(শিরোনাম নেই)'}
                    </h3>
                    {draft.occasionNote && (
                      <p className="text-xs" style={{ color: previewColors.muted }}>
                        {draft.occasionNote}
                      </p>
                    )}
                  </div>

                  <div
                    dir="rtl"
                    className="font-indopak text-2xl leading-[2.3] text-right py-4 px-4 rounded-xl"
                    style={{ backgroundColor: previewColors.surface }}
                  >
                    {normalizeIndoPakText(draft.arabic || 'بِسْمِ اللّٰهِ')}
                  </div>

                  {draft.transliteration && (
                    <div className="space-y-1">
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: previewColors.accent }}
                      >
                        উচ্চারণ
                      </p>
                      <p
                        className="text-xs leading-relaxed whitespace-pre-line"
                        style={{ color: previewColors.secondary }}
                      >
                        {draft.transliteration}
                      </p>
                    </div>
                  )}

                  {draft.translationBangla && (
                    <div className="space-y-1">
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: previewColors.accent }}
                      >
                        অর্থ
                      </p>
                      <p className="text-xs leading-relaxed whitespace-pre-line">
                        {draft.translationBangla}
                      </p>
                    </div>
                  )}

                  <div
                    className="flex items-center justify-between gap-2 pt-3 border-t text-[11px]"
                    style={{
                      borderColor: previewColors.border,
                      color: previewColors.muted,
                    }}
                  >
                    <span className="truncate">
                      {draft.reference || 'রেফারেন্স নেই'}
                    </span>
                    <span className="shrink-0">
                      {toBanglaDigits(draft.repeatCount)} বার
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          )
        }
      >
        {draft && (
          <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-7 space-y-8">
            {/* Section 1: Identity & Placement */}
            <StudioSection title="Identity & Placement">
              <StudioField label="Title (Bangla)" required>
                <StudioInput
                  type="text"
                  value={draft.titleBangla}
                  onChange={(e) => setDraft({ ...draft, titleBangla: e.target.value })}
                  placeholder="যেমন: ঘরের বাইরে বের হওয়ার দুআ"
                  className="!h-10 !text-[15px] font-medium"
                />
              </StudioField>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <StudioField
                  label="Chapter"
                  className="sm:col-span-6"
                  action={
                    <button
                      type="button"
                      onClick={() => setQuickChapterOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer hover:underline"
                      style={{ color: 'var(--st-accent)' }}
                    >
                      <Plus className="w-3 h-3" />
                      New Chapter
                    </button>
                  }
                >
                  <StudioDropdown<number>
                    value={draft.chapterId}
                    onChange={(val) => setDraft({ ...draft, chapterId: val })}
                    searchPlaceholder="Search chapters…"
                    options={catalog.chapters.map((ch) => ({
                      value: ch.id,
                      label: `${ch.id}. ${ch.titleBangla}`,
                    }))}
                  />
                </StudioField>

                <StudioField label="Order" className="sm:col-span-2">
                  <StudioInput
                    type="number"
                    min={0}
                    value={draft.order}
                    onChange={(e) =>
                      setDraft({ ...draft, order: Number(e.target.value) || 0 })
                    }
                    className="font-mono tabular-nums"
                  />
                </StudioField>

                <StudioField label="Repeat Target" className="sm:col-span-4">
                  <div className="flex items-center gap-1">
                    <div
                      className="inline-flex p-0.5 rounded-[7px] border h-9 items-center"
                      style={{
                        backgroundColor: 'var(--st-bg-subtle)',
                        borderColor: 'var(--st-border)',
                      }}
                    >
                      {REPEAT_PRESETS.map((n) => {
                        const active = draft.repeatCount === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setDraft({ ...draft, repeatCount: n })}
                            className="h-7 px-2 rounded-[5px] text-[11.5px] font-mono tabular-nums cursor-pointer transition-colors"
                            style={{
                              backgroundColor: active ? 'var(--st-bg)' : 'transparent',
                              color: active
                                ? 'var(--st-text)'
                                : 'var(--st-text-muted)',
                              boxShadow: active ? 'var(--st-shadow-sm)' : 'none',
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <StudioInput
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
                      className="!w-16 text-center font-mono tabular-nums !px-1.5"
                      aria-label="Custom repeat count"
                    />
                  </div>
                </StudioField>
              </div>
            </StudioSection>

            {/* Section 2: Scripture & Translation */}
            <StudioSection title="Scripture & Translation">
              <StudioField
                label="Arabic Script"
                required
                action={
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: 'var(--st-text-faint)' }}
                  >
                    IndoPak • RTL
                  </span>
                }
              >
                <div
                  className="rounded-lg border overflow-hidden transition-colors focus-within:border-[var(--st-text-secondary)]"
                  style={{
                    backgroundColor: 'var(--st-bg-subtle)',
                    borderColor: 'var(--st-border)',
                  }}
                >
                  <textarea
                    dir="rtl"
                    rows={3}
                    value={draft.arabic}
                    onChange={(e) => setDraft({ ...draft, arabic: e.target.value })}
                    placeholder="আরবি দুআ এখানে পেস্ট বা টাইপ করুন..."
                    className="w-full px-4 py-4 bg-transparent outline-none font-indopak text-[26px] sm:text-[28px] leading-[2.3] text-right resize-y placeholder:font-sans placeholder:text-sm placeholder:leading-normal"
                  />
                </div>
              </StudioField>

              <StudioField
                label="Transliteration (Bangla)"
                hint="Optional pronunciation guide in Bengali script"
              >
                <StudioTextarea
                  rows={2}
                  value={draft.transliteration}
                  onChange={(e) =>
                    setDraft({ ...draft, transliteration: e.target.value })
                  }
                  placeholder="আল্লাহুম্মা..."
                />
              </StudioField>

              <StudioField label="Translation (Bangla)">
                <StudioTextarea
                  rows={3}
                  value={draft.translationBangla}
                  onChange={(e) =>
                    setDraft({ ...draft, translationBangla: e.target.value })
                  }
                  placeholder="হে আল্লাহ!..."
                />
              </StudioField>
            </StudioSection>

            {/* Section 3: Context & Citation */}
            <StudioSection title="Context & Citation">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StudioField label="Occasion Note">
                  <StudioInput
                    type="text"
                    value={draft.occasionNote}
                    onChange={(e) =>
                      setDraft({ ...draft, occasionNote: e.target.value })
                    }
                    placeholder="যেমন: ফজরের পর ৩ বার"
                  />
                </StudioField>

                <StudioField label="Reference / Hadith">
                  <StudioInput
                    type="text"
                    value={draft.reference}
                    onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                    placeholder="যেমন: সহীহ মুসলিম ৫৯১"
                  />
                </StudioField>
              </div>
            </StudioSection>

            {/* Section 4: Advanced */}
            <div
              className="rounded-lg border overflow-hidden"
              style={{
                backgroundColor: 'var(--st-bg-subtle)',
                borderColor: 'var(--st-border)',
              }}
            >
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">Advanced Options</span>
                  <span
                    className="text-[11px]"
                    style={{ color: 'var(--st-text-muted)' }}
                  >
                    Quran reference link & multi-part sections
                  </span>
                  {(draft.hasQuranRef || draft.parts.length > 0) && (
                    <StudioBadge tone="emerald">
                      {[
                        draft.hasQuranRef ? 'Quran Ref' : null,
                        draft.parts.length > 0 ? `${draft.parts.length} parts` : null,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </StudioBadge>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showAdvanced ? 'rotate-180' : ''
                  }`}
                  style={{ color: 'var(--st-text-muted)' }}
                />
              </button>

              {showAdvanced && (
                <div
                  className="px-4 pb-4 pt-3 border-t space-y-5"
                  style={{
                    borderColor: 'var(--st-border)',
                    backgroundColor: 'var(--st-bg)',
                  }}
                >
                  {/* Quran Ref */}
                  <div className="space-y-3">
                    <StudioSwitch
                      checked={draft.hasQuranRef}
                      onChange={(checked) =>
                        setDraft({ ...draft, hasQuranRef: checked })
                      }
                      label="Link to Quran Surah & Ayahs"
                      description="Adds a direct reader button inside the Dua view"
                    />

                    {draft.hasQuranRef && (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                        <StudioField label="Surah" className="sm:col-span-6">
                          <StudioDropdown<number>
                            value={draft.quranSurahId}
                            onChange={(val) =>
                              setDraft({ ...draft, quranSurahId: val })
                            }
                            searchPlaceholder="Search Surah…"
                            options={SURAHS.map((s) => ({
                              value: s.id,
                              label: `${s.id}. ${s.nameBangla}`,
                              meta: `${s.versesCount}`,
                            }))}
                          />
                        </StudioField>
                        <StudioField label="Start Ayah" className="sm:col-span-3">
                          <StudioInput
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
                            className="font-mono tabular-nums"
                          />
                        </StudioField>
                        <StudioField label="End Ayah" className="sm:col-span-3">
                          <StudioInput
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
                            className="font-mono tabular-nums"
                          />
                        </StudioField>
                      </div>
                    )}
                  </div>

                  {/* Multi-Part Builder */}
                  <div
                    className="pt-4 border-t space-y-3"
                    style={{ borderColor: 'var(--st-border)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold">
                          Multi-Part Sections ({draft.parts.length})
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ color: 'var(--st-text-muted)' }}
                        >
                          Optional breakdown for compound duas (e.g. 3 Quls, Ruqyah)
                        </p>
                      </div>
                      <StudioButton
                        variant="secondary"
                        size="xs"
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
                      >
                        <Plus className="w-3 h-3" />
                        Add Part
                      </StudioButton>
                    </div>

                    {draft.parts.map((part, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg p-3.5 border space-y-2.5"
                        style={{
                          backgroundColor: 'var(--st-bg-subtle)',
                          borderColor: 'var(--st-border)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-[11px] font-mono font-semibold uppercase"
                            style={{ color: 'var(--st-text-muted)' }}
                          >
                            Part #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                parts: draft.parts.filter((_, i) => i !== idx),
                              })
                            }
                            className="text-[11px] font-medium cursor-pointer"
                            style={{ color: 'var(--st-danger)' }}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <StudioInput
                            type="text"
                            value={part.labelBangla ?? ''}
                            onChange={(e) => {
                              const next = [...draft.parts];
                              next[idx] = { ...part, labelBangla: e.target.value };
                              setDraft({ ...draft, parts: next });
                            }}
                            placeholder="Part label (optional)"
                            className="sm:col-span-3 !h-8 !text-xs"
                          />
                          <StudioInput
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
                            placeholder="Repeat"
                            className="!h-8 !text-xs font-mono tabular-nums"
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
                          placeholder="Arabic text…"
                          className="studio-field-control w-full px-3 py-2 font-indopak text-xl leading-[2.1] text-right placeholder:font-sans placeholder:text-xs"
                        />
                        <StudioInput
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
                          placeholder="Bangla translation…"
                          className="!h-8 !text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </StudioEditorSheet>

      <QuickChapterModal
        open={quickChapterOpen}
        onClose={() => setQuickChapterOpen(false)}
        onCreated={(newChapterId) => {
          if (draft) {
            setDraft({ ...draft, chapterId: newChapterId, order: 1 });
          } else {
            setChapterFilter(newChapterId);
          }
        }}
      />

      <StudioConfirmDialog
        open={confirmDeleteOpen}
        title={
          draft?.isNew
            ? 'Delete saved draft?'
            : isSelectedBuiltIn
              ? 'Hide built-in Dua?'
              : 'Delete custom Dua?'
        }
        description={
          draft?.isNew
            ? 'This unpublished local draft will be permanently discarded.'
            : isSelectedBuiltIn
              ? 'This built-in Dua will be hidden from all users. You can restore it anytime from the Hidden filter.'
              : 'This custom Dua will be permanently removed for all users.'
        }
        confirmLabel={
          draft?.isNew
            ? 'Delete Draft'
            : isSelectedBuiltIn
              ? 'Hide Dua'
              : 'Delete Permanently'
        }
        loading={saving}
        onConfirm={() => void executeDeleteOrHide()}
        onCancel={() => setConfirmDeleteOpen(false)}
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
