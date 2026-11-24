import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { DUA_CHAPTERS as STATIC_CHAPTERS } from '../../data/duas';
import { adminPublishChapter } from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
import { useToast } from '../ToastProvider';
import { StudioButton, StudioField, StudioInput, StudioModal } from './StudioUI';

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
  const [saving, setSaving] = useState(false);

  const nextChapterId =
    Math.max(
      13,
      ...STATIC_CHAPTERS.map((c) => c.id),
      ...catalog.chapters.map((c) => c.id)
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

  const handlePublish = async () => {
    if (!titleBangla.trim()) {
      toast.warning('Chapter Bangla title is required.');
      return;
    }
    const pending = aliasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const finalAliases = Array.from(new Set([...aliases, ...pending]));

    setSaving(true);
    try {
      await adminPublishChapter({
        id: nextChapterId,
        titleBangla: titleBangla.trim(),
        subtitleBangla: subtitleBangla.trim(),
        searchAliases: finalAliases,
      });
      toast.success(`Chapter #${nextChapterId} published.`);
      onCreated?.(nextChapterId);
      resetAndClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create chapter.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudioModal
      open={open}
      title={`Create New Chapter (#${nextChapterId})`}
      description="Publishes immediately to Firestore and becomes selectable for Duas."
      onClose={() => !saving && resetAndClose()}
      footer={
        <>
          <StudioButton variant="ghost" size="sm" disabled={saving} onClick={resetAndClose}>
            Cancel
          </StudioButton>
          <StudioButton
            variant="primary"
            size="sm"
            loading={saving}
            onClick={() => void handlePublish()}
          >
            {!saving && <Send className="w-3.5 h-3.5" />}
            Publish Chapter
          </StudioButton>
        </>
      }
    >
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
    </StudioModal>
  );
}
