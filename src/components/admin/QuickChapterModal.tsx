import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { DUA_CHAPTERS as STATIC_CHAPTERS } from '../../data/duas';
import { useCatalog } from '../../services/contentCatalog';
import { useToast } from '../ToastProvider';
import { loadDraftsMap, saveDraftToStorage } from './adminDrafts';
import { StudioButton, StudioEditorSheet, StudioField, StudioInput } from './StudioUI';

export interface ChapterDraftShape {
  id: number;
  isNew: boolean;
  titleBangla: string;
  subtitleBangla: string;
  aliases: string[];
}

interface QuickChapterModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (chapterId: number) => void;
}

export function QuickChapterModal({
  open,
  onClose,
  onCreated,
}: QuickChapterModalProps) {
  const toast = useToast();
  const catalog = useCatalog();

  const [titleBangla, setTitleBangla] = useState('');
  const [subtitleBangla, setSubtitleBangla] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);

  const existingDraftIds = Object.values(
    loadDraftsMap<ChapterDraftShape>('chapters')
  ).map((d) => d.data.id);

  const nextChapterId =
    Math.max(
      13,
      ...STATIC_CHAPTERS.map((c) => c.id),
      ...catalog.chapters.map((c) => c.id),
      ...existingDraftIds
    ) + 1;

  const resetAndClose = () => {
    setTitleBangla('');
    setSubtitleBangla('');
    setAliasInput('');
    setAliases([]);
    onClose();
  };

  const commitAlias = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setAliases((prev) => Array.from(new Set([...prev, ...parts])));
    setAliasInput('');
  };

  const handleSave = () => {
    if (!titleBangla.trim()) {
      toast.warning('Chapter Bangla title is required.');
      return;
    }
    const pending = aliasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const finalAliases = Array.from(new Set([...aliases, ...pending]));

    const draftPayload: ChapterDraftShape = {
      id: nextChapterId,
      isNew: true,
      titleBangla: titleBangla.trim(),
      subtitleBangla: subtitleBangla.trim(),
      aliases: finalAliases,
    };

    saveDraftToStorage('chapters', String(nextChapterId), draftPayload);
    toast.success(`Chapter #${nextChapterId} saved as draft.`);
    onCreated?.(nextChapterId);
    resetAndClose();
  };

  return (
    <StudioEditorSheet
      open={open}
      zIndexClass="z-50"
      maxWidthClass="md:max-w-[460px]"
      onCloseRequest={resetAndClose}
      header={
        <header
          className="h-[52px] px-4 sm:px-5 border-b flex items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'var(--st-bg)',
            borderColor: 'var(--st-border)',
          }}
        >
          <span className="text-[13.5px] font-semibold tracking-tight truncate">
            New Chapter #{nextChapterId}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <StudioButton variant="ghost" size="sm" onClick={resetAndClose}>
              Cancel
            </StudioButton>
            <StudioButton variant="primary" size="sm" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </StudioButton>
          </div>
        </header>
      }
    >
      <div className="p-5 space-y-5">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--st-text-muted)' }}>
          Saves locally as a draft. Chapters cannot be published without at least one Dua — it will publish automatically when you publish a Dua in this chapter.
        </p>

        <StudioField label="Title (Bangla)" required>
          <StudioInput
            type="text"
            autoFocus
            value={titleBangla}
            onChange={(e) => setTitleBangla(e.target.value)}
            placeholder="যেমন: রিজিক ও বরকতের দুআ"
          />
        </StudioField>

        <StudioField label="Subtitle (Bangla)">
          <StudioInput
            type="text"
            value={subtitleBangla}
            onChange={(e) => setSubtitleBangla(e.target.value)}
            placeholder="যেমন: চতুর্দশ অধ্যায় • হালাল রিজিক ও বরকত"
          />
        </StudioField>

        <StudioField label="Search Keywords / Banglish (Optional)">
          <div className="flex items-center gap-2">
            <StudioInput
              type="text"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  commitAlias(aliasInput);
                }
              }}
              placeholder="e.g. rizq, barkat, income"
              className="!h-8 !text-xs"
            />
            <StudioButton
              variant="secondary"
              size="sm"
              onClick={() => commitAlias(aliasInput)}
            >
              Add
            </StudioButton>
          </div>

          {aliases.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {aliases.map((alias) => (
                <span
                  key={alias}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] border text-xs"
                  style={{
                    backgroundColor: 'var(--st-bg-subtle)',
                    borderColor: 'var(--st-border)',
                  }}
                >
                  <span>{alias}</span>
                  <button
                    type="button"
                    onClick={() => setAliases((prev) => prev.filter((a) => a !== alias))}
                    className="cursor-pointer"
                    style={{ color: 'var(--st-text-muted)' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </StudioField>
      </div>
    </StudioEditorSheet>
  );
}
