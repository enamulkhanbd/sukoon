import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { DUA_CHAPTERS as STATIC_CHAPTERS } from '../../data/duas';
import { isBuiltInChapterId } from '../../services/catalogSnapshot';
import {
  adminDeleteOrHideChapter,
  adminPublishChapter,
  adminRevertBuiltInChapter,
} from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
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
  StudioEditorHeader,
  StudioEditorSheet,
  StudioField,
  StudioInput,
  StudioSection,
  useKeyboardSave,
} from './StudioUI';

interface ChapterDraft {
  id: number;
  isNew: boolean;
  titleBangla: string;
  subtitleBangla: string;
  aliases: string[];
}

export function AdminChaptersTab({
  launchIntent,
  onConsumeIntent,
}: {
  launchIntent?: StudioLaunchIntent | null;
  onConsumeIntent?: () => void;
}) {
  const toast = useToast();
  const catalog = useCatalog();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<ChapterDraft | null>(null);
  const [baselineHash, setBaselineHash] = useState('');
  const [savedDrafts, setSavedDrafts] = useState<Record<string, StoredDraft<ChapterDraft>>>(
    () => loadDraftsMap<ChapterDraft>('chapters')
  );
  const [aliasInput, setAliasInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const allRows = useMemo(() => {
    const seen = new Set<number>();
    const rows: Array<{
      id: number;
      titleBangla: string;
      subtitleBangla: string;
      searchAliases?: string[];
      hidden: boolean;
      duaCount: number;
      isLocalOnly?: boolean;
      hasLocalDraft?: boolean;
    }> = [];

    for (const ch of catalog.chapters) {
      seen.add(ch.id);
      const local = savedDrafts[String(ch.id)]?.data;
      rows.push({
        id: ch.id,
        titleBangla: local?.titleBangla || ch.titleBangla,
        subtitleBangla: local?.subtitleBangla ?? ch.subtitleBangla,
        searchAliases: local?.aliases ?? ch.searchAliases,
        hidden: false,
        duaCount: catalog.duasByChapter[ch.id]?.length ?? 0,
        hasLocalDraft: Boolean(local),
      });
    }

    for (const st of STATIC_CHAPTERS) {
      if (catalog.remoteChaptersMap[st.id]?.deleted && !seen.has(st.id)) {
        seen.add(st.id);
        rows.push({
          id: st.id,
          titleBangla: st.titleBangla,
          subtitleBangla: st.subtitleBangla,
          hidden: true,
          duaCount: 0,
          hasLocalDraft: Boolean(savedDrafts[String(st.id)]),
        });
      }
    }

    for (const entry of Object.values(savedDrafts)) {
      if (seen.has(entry.data.id)) continue;
      rows.push({
        id: entry.data.id,
        titleBangla: entry.data.titleBangla || '(Untitled Chapter)',
        subtitleBangla: entry.data.subtitleBangla,
        searchAliases: entry.data.aliases,
        hidden: false,
        duaCount: 0,
        isLocalOnly: true,
        hasLocalDraft: true,
      });
    }

    return rows.sort((a, b) => a.id - b.id);
  }, [catalog, savedDrafts]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
        r.titleBangla.toLowerCase().includes(q) ||
        r.subtitleBangla.toLowerCase().includes(q) ||
        String(r.id) === q
    );
  }, [allRows, query]);

  const isDirty = Boolean(draft) && JSON.stringify(draft) !== baselineHash;
  const hasSavedDraft = draft ? Boolean(savedDrafts[String(draft.id)]) : false;
  const isPublishedClean = Boolean(draft) && !draft!.isNew && !hasSavedDraft && !isDirty;

  const startNewChapter = useCallback(() => {
    const maxId = allRows.reduce((m, c) => Math.max(m, c.id), 13);
    const fresh: ChapterDraft = {
      id: maxId + 1,
      isNew: true,
      titleBangla: '',
      subtitleBangla: '',
      aliases: [],
    };
    setDraft(fresh);
    setBaselineHash(JSON.stringify(fresh));
    setAliasInput('');
  }, [allRows]);

  const openChapter = useCallback(
    (row: (typeof allRows)[number]) => {
      const local = savedDrafts[String(row.id)]?.data;
      if (local) {
        const cloned: ChapterDraft = { ...local, aliases: [...local.aliases] };
        setDraft(cloned);
        setBaselineHash(JSON.stringify(cloned));
        setAliasInput('');
        return;
      }
      const loaded: ChapterDraft = {
        id: row.id,
        isNew: false,
        titleBangla: row.titleBangla,
        subtitleBangla: row.subtitleBangla,
        aliases: [...(row.searchAliases ?? [])],
      };
      setDraft(loaded);
      setBaselineHash(JSON.stringify(loaded));
      setAliasInput('');
    },
    [savedDrafts]
  );

  useEffect(() => {
    if (!launchIntent) return;
    if (launchIntent.mode === 'new') {
      startNewChapter();
    } else if (launchIntent.mode === 'edit' && launchIntent.id) {
      const row = allRows.find((r) => String(r.id) === launchIntent.id);
      if (row) openChapter(row);
    }
    onConsumeIntent?.();
  }, [launchIntent, allRows, startNewChapter, openChapter, onConsumeIntent]);

  const commitAliasInput = (raw: string) => {
    if (!draft) return;
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const merged = Array.from(new Set([...draft.aliases, ...parts]));
    setDraft({ ...draft, aliases: merged });
    setAliasInput('');
  };

  const handleSaveDraft = () => {
    if (!draft) return;
    if (!draft.titleBangla.trim()) {
      toast.warning('Chapter Bangla title is required.');
      return;
    }
    const pendingAliases = aliasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const merged: ChapterDraft = {
      ...draft,
      aliases: Array.from(new Set([...draft.aliases, ...pendingAliases])),
    };
    setDraft(merged);
    setAliasInput('');
    setSavedDrafts(saveDraftToStorage('chapters', String(merged.id), merged));
    setBaselineHash(JSON.stringify(merged));
    toast.info('Chapter draft saved locally.');
  };

  const handleCancel = () => {
    if (isDirty) {
      setConfirmCancelOpen(true);
    } else {
      setDraft(null);
      setBaselineHash('');
    }
  };

  const handleSave = useCallback(async () => {
    if (!draft || saving) return;
    if (!draft.titleBangla.trim()) {
      toast.warning('Chapter Bangla title is required.');
      return;
    }
    const duaCount = catalog.duasByChapter[draft.id]?.length ?? 0;
    if (duaCount === 0) {
      toast.warning(
        'Cannot publish an empty chapter. Add and publish at least one Dua in this chapter first (use Save Draft for now).'
      );
      return;
    }
    const pendingAliases = aliasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const finalAliases = Array.from(new Set([...draft.aliases, ...pendingAliases]));

    setSaving(true);
    try {
      await adminPublishChapter({
        id: draft.id,
        titleBangla: draft.titleBangla,
        subtitleBangla: draft.subtitleBangla,
        searchAliases: finalAliases,
      });
      const saved: ChapterDraft = {
        ...draft,
        isNew: false,
        aliases: finalAliases,
      };
      setSavedDrafts(deleteDraftFromStorage<ChapterDraft>('chapters', String(draft.id)));
      setDraft(saved);
      setBaselineHash(JSON.stringify(saved));
      setAliasInput('');
      toast.success('Chapter published.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish chapter.');
    } finally {
      setSaving(false);
    }
  }, [draft, saving, aliasInput, catalog.duasByChapter, toast]);

  useKeyboardSave(Boolean(draft) && !saving, () => {
    void handleSave();
  });

  const executeDeleteOrHide = async () => {
    if (!draft) return;
    if (draft.isNew && hasSavedDraft) {
      setSavedDrafts(deleteDraftFromStorage<ChapterDraft>('chapters', String(draft.id)));
      setConfirmOpen(false);
      setDraft(null);
      setBaselineHash('');
      toast.info('Draft discarded.');
      return;
    }
    const builtIn = isBuiltInChapterId(draft.id);
    setSaving(true);
    try {
      await adminDeleteOrHideChapter(draft.id);
      setSavedDrafts(deleteDraftFromStorage<ChapterDraft>('chapters', String(draft.id)));
      setConfirmOpen(false);
      setDraft(null);
      setBaselineHash('');
      toast.info(builtIn ? 'Chapter hidden.' : 'Chapter deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (id: number) => {
    setSaving(true);
    try {
      await adminRevertBuiltInChapter(id);
      setSavedDrafts(deleteDraftFromStorage<ChapterDraft>('chapters', String(id)));
      setDraft(null);
      setBaselineHash('');
      toast.success('Chapter reverted to built-in default.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revert.');
    } finally {
      setSaving(false);
    }
  };

  const isBuiltIn = draft ? isBuiltInChapterId(draft.id) : false;
  const hasRemote = draft ? Boolean(catalog.remoteChaptersMap[draft.id]) : false;
  const draftDuaCount = draft ? (catalog.duasByChapter[draft.id]?.length ?? 0) : 0;
  const canPublishChapter = draftDuaCount > 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header Bar */}
      <header
        className="h-[52px] px-5 sm:px-7 border-b flex items-center justify-between gap-3 shrink-0"
        style={{
          backgroundColor: 'var(--st-bg)',
          borderColor: 'var(--st-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <h1 className="text-[14px] font-semibold tracking-tight">Chapters</h1>
          <span
            className="text-[11px] font-medium px-1.5 py-0.5 rounded-[5px] tabular-nums"
            style={{
              backgroundColor: 'var(--st-bg-muted)',
              color: 'var(--st-text-muted)',
            }}
          >
            {filteredRows.length}
          </span>
        </div>
        <StudioButton variant="primary" size="sm" onClick={startNewChapter}>
          <Plus className="w-3.5 h-3.5" />
          New Chapter
        </StudioButton>
      </header>

      {/* Search Bar */}
      <div
        className="px-5 sm:px-7 py-3 border-b shrink-0"
        style={{
          backgroundColor: 'var(--st-bg-subtle)',
          borderColor: 'var(--st-border)',
        }}
      >
        <div className="relative max-w-sm">
          <Search
            className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--st-text-faint)' }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chapters…"
            className="studio-field-control w-full h-8 pl-8 pr-7 text-[12.5px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 cursor-pointer"
              style={{ color: 'var(--st-text-muted)' }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Full-Width Chapters List */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--st-bg)' }}>
        <div className="divide-y" style={{ borderColor: 'var(--st-border)' }}>
          {filteredRows.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => openChapter(ch)}
              className="studio-hover w-full px-5 sm:px-7 py-3.5 text-left flex items-center justify-between gap-4 transition-colors cursor-pointer"
              style={{ borderColor: 'var(--st-border)' }}
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <span
                  className="text-[11.5px] font-mono tabular-nums w-7 shrink-0"
                  style={{ color: 'var(--st-text-muted)' }}
                >
                  {String(ch.id).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium truncate">{ch.titleBangla}</p>
                  <p
                    className="text-[12px] truncate mt-0.5"
                    style={{ color: 'var(--st-text-muted)' }}
                  >
                    {ch.subtitleBangla || 'No subtitle'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {ch.hasLocalDraft && (
                  <StudioBadge tone="blue" dot>
                    Draft
                  </StudioBadge>
                )}
                {ch.hidden ? (
                  <StudioBadge tone="danger" dot>
                    Hidden
                  </StudioBadge>
                ) : !ch.isLocalOnly ? (
                  <span
                    className="text-xs font-mono tabular-nums"
                    style={{ color: 'var(--st-text-muted)' }}
                  >
                    {ch.duaCount} duas
                  </span>
                ) : null}
                <ChevronRight
                  className="w-4 h-4 shrink-0"
                  style={{ color: 'var(--st-text-faint)' }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Drawer / Bottom Sheet */}
      <StudioEditorSheet
        open={Boolean(draft)}
        onCloseRequest={handleCancel}
        header={
          draft && (
            <StudioEditorHeader
              title={
                draft.isNew ? `New Chapter #${draft.id}` : `Chapter #${draft.id}`
              }
              statusBadge={
                isDirty
                  ? { label: 'Unsaved', tone: 'amber' }
                  : hasSavedDraft
                    ? { label: 'Draft Saved', tone: 'blue' }
                    : draft.isNew
                      ? { label: 'New Draft', tone: 'blue' }
                      : null
              }
              saving={saving}
              isPublishedClean={isPublishedClean}
              onRevert={
                isBuiltIn && hasRemote
                  ? () => void handleRevert(draft.id)
                  : undefined
              }
              onDelete={
                !draft.isNew || hasSavedDraft
                  ? () => setConfirmOpen(true)
                  : undefined
              }
              deleteTitle={
                draft.isNew
                  ? 'Delete draft'
                  : isBuiltIn
                    ? 'Hide chapter'
                    : 'Delete chapter'
              }
              onCancel={handleCancel}
              onSaveDraft={canPublishChapter ? handleSaveDraft : undefined}
              publishLabel={canPublishChapter ? undefined : 'Save'}
              onPublish={
                canPublishChapter ? () => void handleSave() : handleSaveDraft
              }
            />
          )
        }
      >
        {draft && (
          <div className="px-5 py-5 space-y-6">
            <StudioSection title="Chapter Details">
              <StudioField label="Title (Bangla)" required>
                <StudioInput
                  type="text"
                  value={draft.titleBangla}
                  onChange={(e) => setDraft({ ...draft, titleBangla: e.target.value })}
                  placeholder="যেমন: রিজিক ও বরকতের দুআ"
                  className="!h-10 !text-[15px] font-medium"
                />
              </StudioField>

              <StudioField label="Subtitle (Bangla)">
                <StudioInput
                  type="text"
                  value={draft.subtitleBangla}
                  onChange={(e) =>
                    setDraft({ ...draft, subtitleBangla: e.target.value })
                  }
                  placeholder="যেমন: চতুর্দশ অধ্যায় • হালাল রিজিক ও বরকত"
                />
              </StudioField>
            </StudioSection>

            <StudioSection
              title="Search Discoverability"
              description="Add Banglish or Bangla aliases so users can find this chapter via global search."
            >
              <StudioField label="Search Aliases">
                <div className="flex items-center gap-2">
                  <StudioInput
                    type="text"
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        commitAliasInput(aliasInput);
                      }
                    }}
                    placeholder="Type keyword (e.g. rizq, barkat, income) and press Enter…"
                  />
                  <StudioButton
                    variant="secondary"
                    size="md"
                    onClick={() => commitAliasInput(aliasInput)}
                  >
                    Add
                  </StudioButton>
                </div>

                {draft.aliases.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {draft.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border text-xs"
                        style={{
                          backgroundColor: 'var(--st-bg-subtle)',
                          borderColor: 'var(--st-border)',
                          color: 'var(--st-text)',
                        }}
                      >
                        <span>{alias}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              aliases: draft.aliases.filter((a) => a !== alias),
                            })
                          }
                          className="cursor-pointer hover:opacity-70"
                          style={{ color: 'var(--st-text-muted)' }}
                          aria-label={`Remove ${alias}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </StudioField>
            </StudioSection>
          </div>
        )}
      </StudioEditorSheet>

      <StudioConfirmDialog
        open={confirmOpen}
        title={
          draft?.isNew
            ? 'Delete saved draft?'
            : isBuiltIn
              ? 'Hide built-in Chapter?'
              : 'Delete custom Chapter?'
        }
        description={
          draft?.isNew
            ? 'This unpublished chapter draft will be permanently discarded.'
            : isBuiltIn
              ? 'This built-in chapter will be hidden from users. You can revert it anytime.'
              : 'This custom chapter will be permanently deleted.'
        }
        confirmLabel={
          draft?.isNew ? 'Delete Draft' : isBuiltIn ? 'Hide Chapter' : 'Delete Chapter'
        }
        loading={saving}
        onConfirm={() => void executeDeleteOrHide()}
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
