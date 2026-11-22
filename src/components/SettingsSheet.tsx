import { useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckCircle2,
  CloudDownload,
  Download,
  Loader2,
  Settings as SettingsIcon,
  Smartphone,
  Upload,
  X,
} from 'lucide-react';
import {
  GLASS_PRESET_OPACITY,
  exportUserData,
  importUserData,
  type Settings,
} from '../db/database';
import { usePwaInstall } from '../hooks/usePwaInstall';
import {
  cancelOfflineSync,
  startOfflineSync,
  useOfflineSync,
} from '../services/offlineSyncStore';
import {
  countCompleteCachedSurahs,
  countOutdatedCachedSurahs,
} from '../services/quranApi';
import { AUTO_SCROLL_SPEEDS, toBanglaDigits } from '../utils/formatters';
import {
  FontSizeControl,
  GLASS_OPTIONS,
  GlassOpacityControl,
  GlassPicker,
  ModePicker,
  THEME_OPTIONS,
  ThemePicker,
  useBottomSheet,
} from './NavigationChrome';
import { useToast } from './ToastProvider';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void>;
}

export function SettingsSheet({
  open,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsSheetProps) {
  const toast = useToast();
  const cachedCount = useLiveQuery(() => countCompleteCachedSurahs(), []) ?? 0;
  const outdatedCount = useLiveQuery(() => countOutdatedCachedSurahs(), []) ?? 0;
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const { downloading, progress: downloadProgress } = useOfflineSync();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pushedHistoryRef = useRef(false);

  const dismissSheet = useCallback(() => {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    }
    onClose();
  }, [onClose]);

  const {
    mounted,
    visible,
    dragging,
    panelRef,
    backdropStyle,
    panelTransform,
    dragHandleProps,
  } = useBottomSheet(open, dismissSheet);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    try {
      window.history.pushState(
        { sukoonSettingsSheet: true },
        '',
        window.location.href
      );
      pushedHistoryRef.current = true;
    } catch {
      pushedHistoryRef.current = false;
    }

    const handlePopState = () => {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissSheet();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, dismissSheet]);

  const handleDownloadAll = () => {
    void startOfflineSync(toast);
  };

  const handleCancelDownload = () => {
    cancelOfflineSync();
  };

  const handleExportJson = async () => {
    try {
      const payload = await exportUserData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `sukoon-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('ব্যাকআপ ফাইল সফলভাবে এক্সপোর্ট হয়েছে।');
    } catch {
      toast.error('ব্যাকআপ এক্সপোর্ট করা যায়নি।');
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const res = await importUserData(parsed);
      toast.success(
        `সফলভাবে রিস্টোর হয়েছে (${toBanglaDigits(
          res.routinesCount
        )}টি রুটিন, ${toBanglaDigits(res.historyDays)} দিনের ইতিহাস)।`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'ব্যাকআপ ফাইল ইমপোর্ট করা যায়নি।'
      );
    } finally {
      e.target.value = '';
    }
  };

  if (!mounted) return null;

  const offlinePercent = Math.round((cachedCount / 114) * 100);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[2px] sm:px-4 sukoon-sheet-backdrop ${
        visible ? '' : 'pointer-events-none'
      }`}
      style={{
        ...backdropStyle,
        backgroundColor: 'var(--backdrop-scrim)',
      }}
      onClick={dismissSheet}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="সেটিংস"
        className={`w-full sm:max-w-2xl h-[92dvh] max-h-[94dvh] rounded-t-[28px] flex flex-col overflow-hidden sukoon-sheet-panel sukoon-glass-sheet ${
          dragging ? 'sukoon-sheet-panel--dragging' : ''
        }`}
        style={{
          transform: panelTransform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Grabber & Sheet Header */}
        <div
          {...dragHandleProps}
          className="px-5 pt-2.5 pb-3.5 border-b select-none shrink-0"
          style={{
            borderColor: 'var(--border-subtle)',
            touchAction: 'none',
          }}
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
                <SettingsIcon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-base leading-tight">সেটিংস</h2>
                <p
                  className="text-[11px] truncate mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  থিম, পড়ার পরিবেশ, অফলাইন ও ডেটা ব্যাকআপ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissSheet}
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

        {/* Scrollable Settings Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 space-y-7 safe-bottom">
          {/* 1. Appearance, Theme & Glass Effect */}
          <section className="space-y-5">
            <h3 className="text-sm font-semibold">থিম ও দৃশ্যমানতা</h3>

            <div className="space-y-2">
              <span className="text-xs font-medium block">মোড</span>
              <ModePicker
                value={settings.colorMode ?? 'light'}
                onSelect={async (colorMode, label) => {
                  await onUpdateSettings({ colorMode });
                  toast.success(`মোড পরিবর্তন হয়েছে: ${label}`);
                }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">থিম</span>
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {(() => {
                    const activeThemeOpt = THEME_OPTIONS.find(
                      (t) => t.id === settings.theme
                    );
                    if (!activeThemeOpt) return '';
                    return (settings.colorMode ?? 'light') === 'dark'
                      ? activeThemeOpt.descDark
                      : activeThemeOpt.descLight;
                  })()}
                </span>
              </div>
              <ThemePicker
                value={settings.theme}
                mode={settings.colorMode ?? 'light'}
                onSelect={async (theme, label) => {
                  await onUpdateSettings({ theme });
                  toast.success(`থিম পরিবর্তন হয়েছে: ${label}`);
                }}
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">গ্লাস ইফেক্ট</span>
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {
                    GLASS_OPTIONS.find(
                      (o) => o.id === (settings.glassMode ?? 'frosted')
                    )?.desc
                  }
                </span>
              </div>
              <GlassPicker
                value={settings.glassMode ?? 'frosted'}
                onSelect={async (glassMode, label) => {
                  await onUpdateSettings({
                    glassMode,
                    glassOpacity: GLASS_PRESET_OPACITY[glassMode],
                  });
                  toast.info(`গ্লাস ইফেক্ট: ${label}`);
                }}
              />
              <GlassOpacityControl
                value={
                  settings.glassOpacity ??
                  GLASS_PRESET_OPACITY[settings.glassMode ?? 'frosted']
                }
                onChange={(glassOpacity, glassMode) => {
                  void onUpdateSettings({ glassOpacity, glassMode });
                }}
              />
            </div>
          </section>

          {/* 2. Reading Environment & Typography */}
          <section
            className="pt-6 border-t space-y-5"
            style={{
              borderColor:
                'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
            }}
          >
            <h3 className="text-sm font-semibold">পড়ার পরিবেশ</h3>

            <FontSizeControl
              value={settings.fontSize}
              onChange={(fontSize) => onUpdateSettings({ fontSize })}
            />

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-medium">
                  তিলাওয়াতের সময় স্ক্রিন চালু রাখুন
                </div>
                <div
                  className="text-[11px] mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Screen Wake Lock ব্যবহার করে স্ক্রিন বন্ধ হওয়া রোধ করে
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.keepScreenAwake}
                onClick={async () => {
                  const next = !settings.keepScreenAwake;
                  await onUpdateSettings({ keepScreenAwake: next });
                  toast.info(
                    next
                      ? 'তিলাওয়াতের সময় স্ক্রিন চালু থাকবে'
                      : 'স্ক্রিন চালু রাখা বন্ধ করা হয়েছে'
                  );
                }}
                className="w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0"
                style={{
                  backgroundColor: settings.keepScreenAwake
                    ? 'var(--accent)'
                    : 'var(--border-subtle)',
                }}
              >
                <span
                  className={`block w-5 h-5 rounded-full transition-transform ${
                    settings.keepScreenAwake ? 'translate-x-5' : 'translate-x-0'
                  }`}
                  style={{
                    backgroundColor: settings.keepScreenAwake
                      ? 'var(--accent-text)'
                      : 'var(--bg-elevated)',
                  }}
                />
              </button>
            </div>

            {/* Auto-Scroll Speed */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">অটো-স্ক্রল গতি</span>
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  স্পর্শ করলে স্বয়ংক্রিয়ভাবে বিরতি নেয়
                </span>
              </div>
              <div
                className="grid grid-cols-5 gap-1 p-1 rounded-2xl"
                style={{
                  backgroundColor:
                    'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                }}
              >
                {AUTO_SCROLL_SPEEDS.map((sp) => {
                  const active = settings.autoScrollSpeed === sp.value;
                  return (
                    <button
                      key={sp.value}
                      type="button"
                      onClick={async () => {
                        await onUpdateSettings({ autoScrollSpeed: sp.value });
                        toast.info(
                          sp.value === 0
                            ? 'অটো-স্ক্রল বন্ধ করা হয়েছে'
                            : `অটো-স্ক্রল গতি: ${sp.label}`
                        );
                      }}
                      className="py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent)' : 'transparent',
                        color: active
                          ? 'var(--accent-text)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {sp.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 3. Offline Quran Storage */}
          <section
            className="pt-6 border-t space-y-4"
            style={{
              borderColor:
                'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">অফলাইন কুরআন সংরক্ষণ</h3>
                <p
                  className="text-xs mt-1 tabular-nums"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {toBanglaDigits(cachedCount)} / ১১৪ সূরা সংরক্ষিত (
                  {toBanglaDigits(offlinePercent)}%)
                </p>
              </div>
              {cachedCount >= 114 && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  সম্পূর্ণ অফলাইন
                </span>
              )}
            </div>

            <div
              className="h-[3px] rounded-full overflow-hidden"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--text-primary) 10%, transparent)',
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${
                    downloading && downloadProgress
                      ? Math.round((downloadProgress.completed / 114) * 100)
                      : offlinePercent
                  }%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>

            {downloading && downloadProgress && (
              <p
                className="text-xs flex items-center gap-2"
                style={{ color: 'var(--accent)' }}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  ডাউনলোড হচ্ছে: {toBanglaDigits(downloadProgress.completed)}/১১৪ •{' '}
                  {downloadProgress.currentSurahName}
                </span>
              </p>
            )}

            {(downloading || cachedCount < 114 || outdatedCount > 0) && (
              <div className="flex flex-wrap gap-2">
                {downloading ? (
                  <button
                    type="button"
                    onClick={handleCancelDownload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border cursor-pointer transition-opacity active:opacity-80"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <X className="w-4 h-4" />
                    স্থগিত করুন
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-85"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    <CloudDownload className="w-4 h-4" />
                    {cachedCount >= 114
                      ? 'কুরআন টেক্সট আপডেট করুন'
                      : cachedCount > 0
                        ? 'বাকি সূরা ডাউনলোড করুন'
                        : 'সম্পূর্ণ কুরআন ডাউনলোড করুন'}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 4. Data Portability & Backup */}
          <section
            className="pt-6 border-t space-y-4"
            style={{
              borderColor:
                'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
            }}
          >
            <div>
              <h3 className="text-sm font-semibold">ডেটা পোর্টেবিলিটি ও ব্যাকআপ</h3>
              <p
                className="text-xs mt-1 leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                আপনার রুটিন, পরিসংখ্যান ও সব ডেটা ডিভাইসেই সুরক্ষিত। চাইলে JSON ফাইল হিসেবে ব্যাকআপ বা রিস্টোর করুন।
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors active:scale-[0.99] cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <Download className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                ব্যাকআপ এক্সপোর্ট
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors active:scale-[0.99] cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <Upload className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                ব্যাকআপ ইমপোর্ট
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportJson}
                className="hidden"
              />
            </div>
          </section>

          {/* 5. PWA Install */}
          <section
            className="pt-6 border-t flex items-center justify-between gap-4 pb-2"
            style={{
              borderColor:
                'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
            }}
          >
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                <Smartphone className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-medium leading-snug">
                  অ্যাপ হিসেবে ইনস্টল করুন
                </h3>
                <p
                  className="text-xs mt-0.5 leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {isInstalled
                    ? 'সুকূন আপনার ডিভাইসে ইনস্টল করা আছে।'
                    : canInstall
                      ? 'হোম স্ক্রিনে যুক্ত করে সম্পূর্ণ অফলাইনে দ্রুত ব্যবহার করুন।'
                      : 'ব্রাউজার মেনু থেকে "Add to Home Screen" নির্বাচন করে ইনস্টল করতে পারেন।'}
                </p>
              </div>
            </div>
            {canInstall && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await promptInstall();
                  if (ok) toast.success('সুকূন অ্যাপ ইনস্টল হয়েছে।');
                }}
                className="shrink-0 px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-85"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                }}
              >
                ইনস্টল
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
