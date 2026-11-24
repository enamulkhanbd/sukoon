import { useMemo, useState } from 'react';
import { Loader2, RotateCcw, Save, Search } from 'lucide-react';
import { SURAH_DESCRIPTIONS } from '../../data/surahDescriptions';
import { SURAHS } from '../../data/surahs';
import {
  adminPublishSurahOverride,
  adminRevertSurahOverride,
} from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
import { toBanglaDigits } from '../../utils/formatters';
import { useToast } from '../ToastProvider';

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
  const [selectedId, setSelectedId] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  const merged = catalog.surahInfoMap[selectedId];
  const [desc, setDesc] = useState(merged?.descriptionBangla ?? '');
  const [fazilat, setFazilat] = useState(merged?.fazilatBangla ?? '');
  const [fazilatRef, setFazilatRef] = useState(merged?.fazilatRef ?? '');
  const [tags, setTags] = useState<string[]>(merged?.occasionTags ?? []);
  const [customTag, setCustomTag] = useState('');

  const selectSurah = (surahId: number) => {
    setSelectedId(surahId);
    const info = catalog.surahInfoMap[surahId];
    setDesc(info?.descriptionBangla ?? SURAH_DESCRIPTIONS[surahId] ?? '');
    setFazilat(info?.fazilatBangla ?? '');
    setFazilatRef(info?.fazilatRef ?? '');
    setTags(info?.occasionTags ?? []);
    setCustomTag('');
  };

  const filteredSurahs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter(
      (s) =>
        s.nameBangla.toLowerCase().includes(q) ||
        s.nameSimple.toLowerCase().includes(q) ||
        String(s.id) === q
    );
  }, [query]);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminPublishSurahOverride({
        surahId: selectedId,
        descriptionBangla: desc,
        fazilatBangla: fazilat || undefined,
        fazilatRef: fazilatRef || undefined,
        occasionTags: tags,
      });
      toast.success('সূরার তথ্য সফলভাবে পাবলিশ হয়েছে।');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    setSaving(true);
    try {
      await adminRevertSurahOverride(selectedId);
      setDesc(SURAH_DESCRIPTIONS[selectedId] ?? '');
      setFazilat('');
      setFazilatRef('');
      setTags([]);
      toast.success('সূরার তথ্য বিল্ট-ইন ডিফল্টে ফিরে এসেছে।');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'রিভার্ট করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const activeSurah = SURAHS.find((s) => s.id === selectedId);
  const isOverridden = Boolean(catalog.remoteSurahOverridesMap[selectedId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: 114 Surahs */}
      <section
        className="lg:col-span-5 rounded-3xl border p-4 space-y-3"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="relative">
          <Search
            className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="সূরা খুঁজুন (নাম বা নম্বর)..."
            className="w-full pl-8 pr-3 py-2 rounded-full text-xs border outline-none"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          />
        </div>

        <div className="max-h-[68dvh] overflow-y-auto divide-y pr-1"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {filteredSurahs.map((s) => {
            const info = catalog.surahInfoMap[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSurah(s.id)}
                className="w-full py-2.5 px-2.5 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer"
                style={{
                  backgroundColor:
                    selectedId === s.id ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {toBanglaDigits(s.id)}. {s.nameBangla}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {s.meaningBangla}
                  </p>
                </div>
                {info?.isOverridden && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: 'var(--gold-soft)',
                      color: 'var(--gold)',
                    }}
                  >
                    কাস্টম
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Right: Editor */}
      <section
        className="lg:col-span-7 rounded-3xl border p-5 space-y-4"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div>
          <h3 className="text-sm font-semibold">
            {toBanglaDigits(selectedId)}. সূরা {activeSurah?.nameBangla}
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            কুরআনের মূল আরবি অপরিবর্তিত থাকবে — এখানে বাংলা পরিচিতি, ফযীলত ও সময়-ট্যাগ এডিট করতে পারবেন।
          </p>
        </div>

        <label className="space-y-1 block">
          <span className="text-xs font-medium">বাংলা সংক্ষিপ্ত পরিচিতি</span>
          <textarea
            rows={4}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs border outline-none leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-xs font-medium">সূরার ফযীলত (ঐচ্ছিক)</span>
          <textarea
            rows={3}
            value={fazilat}
            onChange={(e) => setFazilat(e.target.value)}
            placeholder="যেমন: জুমুআর দিন সূরা কাহফ তিলাওয়াত করলে দুই জুমুআর মধ্যবর্তী সময় নূরে আলোকিত হয়..."
            className="w-full px-3 py-2 rounded-xl text-xs border outline-none leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-xs font-medium">ফযীলতের হাদিস রেফারেন্স</span>
          <input
            type="text"
            value={fazilatRef}
            onChange={(e) => setFazilatRef(e.target.value)}
            placeholder="যেমন: মুস্তাদরাকে হাকিম ৩৩৯২, সুনানুল কুবরা বায়হাকী"
            className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-medium block">পড়ার সময় / ট্যাগ (সূরা লিস্ট ফিল্টারে দেখাবে)</span>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...SUGGESTED_TAGS, ...tags])).map((tag) => {
              const active = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="px-3 py-1 rounded-full text-xs border cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'var(--bg-surface)',
                    borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                    color: active ? 'var(--accent-text)' : 'var(--text-primary)',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="নতুন ট্যাগ লিখে Enter চাপুন..."
              className="flex-1 px-3 py-1.5 rounded-xl text-xs border outline-none"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            />
            <button
              type="button"
              onClick={addCustomTag}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              যোগ করুন
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {isOverridden ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleRevert()}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium border cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              ডিফল্টে ফেরান
            </button>
          ) : (
            <span />
          )}

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
      </section>
    </div>
  );
}
