import { useEffect, useState } from 'react';
import { HeartHandshake, X } from 'lucide-react';
import {
  createCustomDua,
  updateCustomDua,
  validateCustomDuaInput,
  type CustomDua,
} from '../services/customDuas';
import { toBanglaDigits } from '../utils/formatters';
import { useBottomSheet } from './NavigationChrome';
import { useToast } from './ToastProvider';

const BANGLA_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

function parseRepeatInput(raw: string): number | null {
  const trimmed = raw
    .trim()
    .replace(/[০-৯]/g, (ch) => BANGLA_DIGIT_MAP[ch] ?? ch);
  if (!trimmed) return 1;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

const REPEAT_PRESETS = [1, 3, 7, 33, 100] as const;

interface CustomDuaFormSheetProps {
  open: boolean;
  editingDua?: CustomDua | null;
  onClose: () => void;
  onSaved?: (saved: CustomDua) => void;
}

export function CustomDuaFormSheet({
  open,
  editingDua = null,
  onClose,
  onSaved,
}: CustomDuaFormSheetProps) {
  const toast = useToast();
  const [titleBangla, setTitleBangla] = useState('');
  const [arabic, setArabic] = useState('');
  const [transliteration, setTransliteration] = useState('');
  const [translationBangla, setTranslationBangla] = useState('');
  const [repeatText, setRepeatText] = useState('1');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    mounted,
    visible,
    dragging,
    panelRef,
    backdropStyle,
    panelTransform,
    dragHandleProps,
  } = useBottomSheet(open, onClose);

  useEffect(() => {
    if (!open) return;
    if (editingDua) {
      setTitleBangla(editingDua.titleBangla);
      setArabic(editingDua.arabic);
      setTransliteration(editingDua.transliteration ?? '');
      setTranslationBangla(editingDua.translationBangla);
      setRepeatText(String(editingDua.repeatCount || 1));
      setReference(editingDua.reference ?? '');
    } else {
      setTitleBangla('');
      setArabic('');
      setTransliteration('');
      setTranslationBangla('');
      setRepeatText('1');
      setReference('');
    }
    setError(null);
  }, [open, editingDua]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedRepeat = parseRepeatInput(repeatText);
    if (parsedRepeat === null || parsedRepeat < 1 || parsedRepeat > 10000) {
      const msg = 'তাসবিহ সংখ্যা ১ থেকে ১০,০০০ এর মধ্যে দিন।';
      setError(msg);
      toast.warning(msg);
      return;
    }

    const input = {
      titleBangla,
      arabic,
      transliteration,
      translationBangla,
      repeatCount: parsedRepeat,
      reference,
    };

    const validation = validateCustomDuaInput(input);
    if (!validation.ok) {
      setError(validation.error);
      toast.warning(validation.error);
      return;
    }

    setSaving(true);
    try {
      const saved = editingDua
        ? await updateCustomDua(editingDua.id, input)
        : await createCustomDua(input);
      toast.success(
        editingDua
          ? 'আপনার দুআ আপডেট হয়েছে'
          : '“আমার দুআ”-তে নতুন দুআ যুক্ত হয়েছে'
      );
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'দুআ সংরক্ষণ করা যায়নি।';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const activeRepeatNum = parseRepeatInput(repeatText);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[2px] sm:px-4 sukoon-sheet-backdrop ${
        visible ? '' : 'pointer-events-none'
      }`}
      style={{
        ...backdropStyle,
        backgroundColor: 'var(--backdrop-scrim)',
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={editingDua ? 'দুআ সম্পাদনা করুন' : 'নতুন দুআ যুক্ত করুন'}
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-2xl h-[90dvh] max-h-[92dvh] rounded-t-[28px] flex flex-col overflow-hidden sukoon-sheet-panel sukoon-glass-sheet ${
          dragging ? 'sukoon-sheet-panel--dragging' : ''
        }`}
        style={{ transform: panelTransform }}
      >
        {/* Drag Handle & Sheet Header */}
        <div
          {...dragHandleProps}
          className="px-5 pt-2.5 pb-3.5 border-b select-none shrink-0"
          style={{ borderColor: 'var(--border-subtle)', touchAction: 'none' }}
        >
          <div
            className="w-9 h-1 rounded-full mx-auto mb-3 opacity-45"
            style={{ backgroundColor: 'var(--text-muted)' }}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                <HeartHandshake className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-base leading-tight">
                  {editingDua ? 'দুআ সম্পাদনা' : 'নতুন ব্যক্তিগত দুআ'}
                </h2>
                <p
                  className="text-[11px] truncate mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  শুধু “আমার দুআ” ট্যাবে আলাদাভাবে সংরক্ষিত থাকবে
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="custom-dua-title"
                className="block text-xs font-semibold"
              >
                শিরোনাম <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="custom-dua-title"
                type="text"
                value={titleBangla}
                onChange={(e) => setTitleBangla(e.target.value)}
                placeholder="যেমন: পিতামাতার জন্য দুআ, ব্যক্তিগত মোনাজাত..."
                maxLength={300}
                className="w-full px-3.5 py-2.5 rounded-2xl text-sm outline-none border transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <p
              className="text-[11px] px-3 py-2 rounded-xl"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--text-secondary)',
              }}
            >
              আরবি পাঠ, বাংলা উচ্চারণ অথবা বাংলা অর্থ/মোনাজাতের মধ্যে <strong>অন্তত যেকোনো একটি</strong> পূরণ করুন।
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="custom-dua-arabic"
                className="block text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                আরবি পাঠ (ঐচ্ছিক)
              </label>
              <textarea
                id="custom-dua-arabic"
                dir="rtl"
                lang="ar"
                rows={3}
                value={arabic}
                onChange={(e) => setArabic(e.target.value)}
                placeholder="رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا"
                className="w-full px-3.5 py-2.5 rounded-2xl text-lg font-indopak leading-loose text-right outline-none border transition-colors resize-y"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="custom-dua-translit"
                className="block text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                বাংলা উচ্চারণ (ঐচ্ছিক)
              </label>
              <textarea
                id="custom-dua-translit"
                rows={2}
                value={transliteration}
                onChange={(e) => setTransliteration(e.target.value)}
                placeholder="রাব্বির হামহুমা কামা রাব্বায়ানি সাগীরা..."
                className="w-full px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed outline-none border transition-colors resize-y"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="custom-dua-meaning"
                className="block text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                বাংলা অর্থ / ব্যক্তিগত মোনাজাত (ঐচ্ছিক)
              </label>
              <textarea
                id="custom-dua-meaning"
                rows={3}
                value={translationBangla}
                onChange={(e) => setTranslationBangla(e.target.value)}
                placeholder="হে আমার রব! তাদের উভয়ের প্রতি রহম করুন..."
                className="w-full px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed outline-none border transition-colors resize-y"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="space-y-1.5">
                <label
                  htmlFor="custom-dua-repeat"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  তাসবিহ সংখ্যা (ডিফল্ট ১ বার)
                </label>
                <div className="space-y-2">
                  <input
                    id="custom-dua-repeat"
                    type="text"
                    inputMode="numeric"
                    value={repeatText}
                    onChange={(e) => setRepeatText(e.target.value)}
                    placeholder="১"
                    className="w-full px-3.5 py-2 rounded-2xl text-sm tabular-nums outline-none border transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {REPEAT_PRESETS.map((n) => {
                      const active = activeRepeatNum === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRepeatText(String(n))}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums cursor-pointer transition-colors"
                          style={{
                            backgroundColor: active
                              ? 'var(--accent)'
                              : 'var(--bg-surface)',
                            color: active
                              ? 'var(--accent-text)'
                              : 'var(--text-secondary)',
                          }}
                        >
                          {toBanglaDigits(n)} বার
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="custom-dua-ref"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  নোট বা রেফারেন্স (ঐচ্ছিক)
                </label>
                <input
                  id="custom-dua-ref"
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={500}
                  placeholder="যেমন: ফজরের পর, সূরা বনী ইসরাঈল ২৪..."
                  className="w-full px-3.5 py-2 rounded-2xl text-sm outline-none border transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            {error && (
              <div
                className="px-3.5 py-2.5 rounded-2xl text-xs font-medium"
                style={{
                  backgroundColor: 'var(--danger-soft)',
                  color: 'var(--danger)',
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div
            className="shrink-0 px-5 py-3 border-t flex gap-2.5 safe-bottom"
            style={{
              borderColor: 'var(--glass-border)',
              backgroundColor:
                'color-mix(in srgb, var(--bg-page) 55%, transparent)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-2xl text-xs font-medium cursor-pointer transition-opacity active:opacity-80"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
              }}
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer transition-opacity active:opacity-85 disabled:opacity-60"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-text)',
              }}
            >
              {saving
                ? 'সংরক্ষণ হচ্ছে...'
                : editingDua
                  ? 'আপডেট সংরক্ষণ করুন'
                  : 'সংরক্ষণ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
