import { useCallback, useMemo, useState } from 'react';
import {
  ChevronRight,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { SURAH_DESCRIPTIONS } from '../../data/surahDescriptions';
import { SURAHS } from '../../data/surahs';
import {
  adminPublishSurahOverride,
  adminRevertSurahOverride,
} from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
import { useToast } from '../ToastProvider';
import {
  StudioBadge,
  StudioButton,
  StudioConfirmDialog,
  StudioEditorHeader,
  StudioEditorSheet,
  StudioField,
  StudioInput,
  StudioSection,
  StudioTextarea,
  useKeyboardSave,
} from './StudioUI';

const SUGGESTED_TAGS = [
  'জুমুআ',
  'ঘুমের আগে',
  'সকাল-সন্ধ্যা',
  'রুকইয়া',
  'রিজিক',
  'হিদায়াত',
  'কবরের নিরাপত্তা',
];

export function AdminSurahsTab() {
  const toast = useToast();
  const catalog = useCatalog();

  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'custom'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [desc, setDesc] = useState('');
  const [fazilat, setFazilat] = useState('');
  const [fazilatRef, setFazilatRef] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [baselineHash, setBaselineHash] = useState('');
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const isDirty =
    selectedId !== null &&
    JSON.stringify({ desc, fazilat, fazilatRef, tags }) !== baselineHash;

  const selectSurah = (surahId: number) => {
    setSelectedId(surahId);
    const info = catalog.surahInfoMap[surahId];
    const nextDesc = info?.descriptionBangla ?? SURAH_DESCRIPTIONS[surahId] ?? '';
    const nextFazilat = info?.fazilatBangla ?? '';
    const nextFazilatRef = info?.fazilatRef ?? '';
    const nextTags = info?.occasionTags ?? [];
    setDesc(nextDesc);
    setFazilat(nextFazilat);
    setFazilatRef(nextFazilatRef);
    setTags(nextTags);
    setCustomTag('');
    setBaselineHash(
      JSON.stringify({
        desc: nextDesc,
        fazilat: nextFazilat,
        fazilatRef: nextFazilatRef,
        tags: nextTags,
      })
    );
  };

  const handleCancel = () => {
    if (isDirty) {
      setConfirmCancelOpen(true);
    } else {
      setSelectedId(null);
    }
  };

  const customCount = Object.keys(catalog.remoteSurahOverridesMap).length;

  const filteredSurahs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SURAHS.filter((s) => {
      if (filterMode === 'custom' && !catalog.surahInfoMap[s.id]?.isOverridden) {
        return false;
      }
      if (!q) return true;
      return (
        s.nameBangla.toLowerCase().includes(q) ||
        s.nameSimple.toLowerCase().includes(q) ||
        s.meaningBangla.toLowerCase().includes(q) ||
        String(s.id) === q
      );
    });
  }, [query, filterMode, catalog.surahInfoMap]);

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const clean = customTag.trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setCustomTag('');
  };

  const handleSave = useCallback(async () => {
    if (selectedId === null || saving) return;
    setSaving(true);
    try {
      await adminPublishSurahOverride({
        surahId: selectedId,
        descriptionBangla: desc,
        fazilatBangla: fazilat || undefined,
        fazilatRef: fazilatRef || undefined,
        occasionTags: tags,
      });
      setBaselineHash(JSON.stringify({ desc, fazilat, fazilatRef, tags }));
      toast.success('Surah metadata published.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save Surah info.');
    } finally {
      setSaving(false);
    }
  }, [saving, selectedId, desc, fazilat, fazilatRef, tags, toast]);

  useKeyboardSave(selectedId !== null && !saving, () => {
    void handleSave();
  });

  const handleRevert = async () => {
    if (selectedId === null) return;
    setSaving(true);
    try {
      await adminRevertSurahOverride(selectedId);
      const defaultDesc = SURAH_DESCRIPTIONS[selectedId] ?? '';
      setDesc(defaultDesc);
      setFazilat('');
      setFazilatRef('');
      setTags([]);
      setBaselineHash(
        JSON.stringify({ desc: defaultDesc, fazilat: '', fazilatRef: '', tags: [] })
      );
      toast.success('Surah reverted to built-in default.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revert.');
    } finally {
      setSaving(false);
    }
  };

  const activeSurah =
    selectedId !== null ? SURAHS.find((s) => s.id === selectedId) : undefined;
  const isOverridden =
    selectedId !== null ? Boolean(catalog.remoteSurahOverridesMap[selectedId]) : false;

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
          <h1 className="text-[14px] font-semibold tracking-tight">Surah Metadata</h1>
          <span
            className="text-[11px] font-medium px-1.5 py-0.5 rounded-[5px] tabular-nums"
            style={{
              backgroundColor: 'var(--st-bg-muted)',
              color: 'var(--st-text-muted)',
            }}
          >
            {filteredSurahs.length}
          </span>
        </div>
        {customCount > 0 && (
          <StudioBadge tone="emerald" dot>
            {customCount} customized
          </StudioBadge>
        )}
      </header>

      {/* Filter Strip */}
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
            placeholder="Search name, meaning, or number…"
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

        <div
          className="grid grid-cols-2 p-0.5 rounded-[6px] border text-[11px] font-medium shrink-0"
          style={{
            backgroundColor: 'var(--st-bg)',
            borderColor: 'var(--st-border)',
          }}
        >
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className="h-7 px-3 rounded-[4px] cursor-pointer transition-colors"
            style={{
              backgroundColor:
                filterMode === 'all' ? 'var(--st-bg-active)' : 'transparent',
              color: filterMode === 'all' ? 'var(--st-text)' : 'var(--st-text-muted)',
            }}
          >
            All (114)
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('custom')}
            className="h-7 px-3 rounded-[4px] cursor-pointer transition-colors"
            style={{
              backgroundColor:
                filterMode === 'custom' ? 'var(--st-bg-active)' : 'transparent',
              color:
                filterMode === 'custom' ? 'var(--st-text)' : 'var(--st-text-muted)',
            }}
          >
            Customized ({customCount})
          </button>
        </div>
      </div>

      {/* Full-Width Surahs List */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--st-bg)' }}>
        {filteredSurahs.length === 0 ? (
          <div className="py-16 px-4 text-center text-xs" style={{ color: 'var(--st-text-muted)' }}>
            No matching Surahs.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--st-border)' }}>
            {filteredSurahs.map((s) => {
              const info = catalog.surahInfoMap[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSurah(s.id)}
                  className="studio-hover w-full px-5 sm:px-7 py-3 text-left flex items-center justify-between gap-4 transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--st-border)' }}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span
                      className="text-[11.5px] font-mono tabular-nums w-8 shrink-0"
                      style={{ color: 'var(--st-text-muted)' }}
                    >
                      {String(s.id).padStart(3, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium truncate">
                        {s.nameBangla}{' '}
                        <span
                          className="text-xs font-normal"
                          style={{ color: 'var(--st-text-muted)' }}
                        >
                          ({s.nameSimple})
                        </span>
                      </p>
                      <p
                        className="text-[11.5px] truncate mt-0.5"
                        style={{ color: 'var(--st-text-muted)' }}
                      >
                        {s.meaningBangla} · {s.versesCount} Ayahs ·{' '}
                        {s.revelationPlace === 'makkah' ? 'Makki' : 'Madani'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {info?.isOverridden && (
                      <StudioBadge tone="emerald" dot>
                        Customized
                      </StudioBadge>
                    )}
                    <span
                      dir="rtl"
                      className="hidden sm:inline font-indopak text-xl"
                      style={{ color: 'var(--st-text-secondary)' }}
                    >
                      {s.nameArabic}
                    </span>
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

      {/* Responsive Drawer / Bottom Sheet */}
      <StudioEditorSheet
        open={selectedId !== null}
        onCloseRequest={handleCancel}
        header={
          selectedId !== null && (
            <StudioEditorHeader
              title={`${selectedId}. ${activeSurah?.nameBangla ?? ''}`}
              statusBadge={
                isDirty
                  ? { label: 'Unsaved', tone: 'amber' }
                  : !isOverridden
                    ? { label: 'Default', tone: 'neutral' }
                    : null
              }
              saving={saving}
              isPublishedClean={!isDirty && isOverridden}
              onRevert={isOverridden ? () => void handleRevert() : undefined}
              onCancel={handleCancel}
              onPublish={() => void handleSave()}
            />
          )
        }
      >
        {activeSurah && (
          <div className="px-5 py-5 space-y-6">
            <div
              className="rounded-lg border px-4 py-3.5 flex items-center justify-between gap-4"
              style={{
                backgroundColor: 'var(--st-bg-subtle)',
                borderColor: 'var(--st-border)',
              }}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">
                    সূরা {activeSurah.nameBangla}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--st-text-muted)' }}>
                    ({activeSurah.nameSimple})
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>
                  {activeSurah.meaningBangla} · {activeSurah.versesCount} Ayahs ·{' '}
                  {activeSurah.revelationPlace === 'makkah' ? 'Makki' : 'Madani'}
                </p>
                <p className="text-[11px] pt-1" style={{ color: 'var(--st-text-muted)' }}>
                  Quran Arabic text is immutable — edit only Bangla context, virtues, and occasion tags.
                </p>
              </div>
              <span
                dir="rtl"
                className="font-indopak text-2xl sm:text-3xl shrink-0 px-2"
                style={{ color: 'var(--st-text)' }}
              >
                {activeSurah.nameArabic}
              </span>
            </div>

            <StudioSection title="Editorial Content">
              <StudioField label="Short Introduction (Bangla)">
                <StudioTextarea
                  rows={4}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="সূরার সংক্ষিপ্ত পরিচিতি..."
                />
              </StudioField>

              <StudioField label="Virtues / Fazilat (Optional)">
                <StudioTextarea
                  rows={3}
                  value={fazilat}
                  onChange={(e) => setFazilat(e.target.value)}
                  placeholder="যেমন: জুমুআর দিন সূরা কাহফ তিলাওয়াত করলে দুই জুমুআর মধ্যবর্তী সময় নূরে আলোকিত হয়..."
                />
              </StudioField>

              <StudioField label="Hadith Reference">
                <StudioInput
                  type="text"
                  value={fazilatRef}
                  onChange={(e) => setFazilatRef(e.target.value)}
                  placeholder="যেমন: মুস্তাদরাকে হাকিম ৩৩৯২, সুনানুল কুবরা বায়হাকী"
                />
              </StudioField>
            </StudioSection>

            <StudioSection
              title="Occasion Tags"
              description="Appears as quick filter chips in the Surah list."
            >
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set([...SUGGESTED_TAGS, ...tags])).map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="h-7 px-2.5 rounded-[6px] text-xs font-medium border cursor-pointer transition-colors"
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
                      {tag}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 max-w-md pt-1">
                <StudioInput
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  placeholder="Add custom tag and press Enter…"
                  className="!h-8 !text-xs"
                />
                <StudioButton variant="secondary" size="sm" onClick={addCustomTag}>
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </StudioButton>
              </div>
            </StudioSection>
          </div>
        )}
      </StudioEditorSheet>

      <StudioConfirmDialog
        open={confirmCancelOpen}
        title="Discard unsaved changes?"
        description="You have unsaved edits to this Surah's metadata. Discard them and return to the Surah list?"
        confirmLabel="Discard & Close"
        cancelLabel="Keep Editing"
        onConfirm={() => {
          setConfirmCancelOpen(false);
          setSelectedId(null);
        }}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}
