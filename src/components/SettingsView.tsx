import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CloudDownload,
  Download,
  Loader2,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  db,
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
import { getRecordDuaTotal } from '../utils/stats';
import { TabHeader, ThemePicker } from './NavigationChrome';
import { useToast } from './ToastProvider';

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void>;
  onOpenStats: () => void;
}

export function SettingsView({
  settings,
  onUpdateSettings,
  onOpenStats,
}: SettingsViewProps) {
  const toast = useToast();
  const cachedCount = useLiveQuery(() => countCompleteCachedSurahs(), []) ?? 0;
  const outdatedCount = useLiveQuery(() => countOutdatedCachedSurahs(), []) ?? 0;
  const readingHistory = useLiveQuery(() => db.readingHistory.toArray(), []) ?? [];
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();

  const { downloading, progress: downloadProgress } = useOfflineSync();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalAyahsRead = readingHistory.reduce((acc, h) => acc + h.ayahsCount, 0);
  const totalDhikir = readingHistory.reduce(
    (acc, h) => acc + (h.dhikirCount ?? 0),
    0
  );
  const totalDuas = readingHistory.reduce(
    (acc, h) => acc + getRecordDuaTotal(h),
    0
  );
  const activeDaysCount = readingHistory.filter(
    (h) =>
      h.ayahsCount > 0 ||
      (h.dhikirCount ?? 0) > 0 ||
      getRecordDuaTotal(h) > 0 ||
      (h.routinesCompleted?.length ?? 0) > 0
  ).length;

  const handleDownloadAll = () => {
    void startOfflineSync(toast);
  };

  const handleCancelDownload = () => {
    cancelOfflineSync();
  };

  const handleClearCache = async () => {
    await db.cachedSurahs.clear();
    await onUpdateSettings({ offlineDownloaded: false });
    toast.warning('ক্যাশ করা সূরা মুছে ফেলা হয়েছে। আপনার রুটিন ও ইতিহাস সুরক্ষিত আছে।');
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

  const offlinePercent = Math.round((cachedCount / 114) * 100);

  return (
    <div className="max-w-2xl mx-auto px-5 pt-5 pb-28 space-y-8">
      <TabHeader
        title="সেটিংস ও অফলাইন"
        subtitle="থিম, ইন্দো-পাক ফন্ট, আমল পরিসংখ্যান ও ডেটা ব্যাকআপ"
      />

      {/* Dedicated Ibadah Statistics Section */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          আমল পরিসংখ্যান
        </h2>

        <button
          type="button"
          onClick={onOpenStats}
          className="w-full flex items-center justify-between gap-3 py-2 text-left transition-opacity active:opacity-75 cursor-pointer group"
        >
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <BarChart3 className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                সাপ্তাহিক, মাসিক ও বাৎসরিক অগ্রগতি
              </div>
              <p
                className="text-xs mt-0.5 leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {toBanglaDigits(totalDhikir)} জিকির • {toBanglaDigits(totalDuas)} দুআ •{' '}
                {toBanglaDigits(totalAyahsRead)} আয়াত ({toBanglaDigits(activeDaysCount)}{' '}
                সক্রিয় দিন)
              </p>
            </div>
          </div>
          <ChevronRight
            className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            style={{ color: 'var(--text-muted)' }}
          />
        </button>
      </section>

      {/* Reading Environment & Typography */}
      <section
        className="pt-6 border-t space-y-6"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          পড়ার পরিবেশ ও টাইপোগ্রাফি
        </h2>

        <ThemePicker
          value={settings.theme}
          showDescription
          onSelect={async (theme, label) => {
            await onUpdateSettings({ theme });
            toast.success(`থিম পরিবর্তন হয়েছে: ${label}`);
          }}
        />

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">ইন্দো-পাক ফন্ট সাইজ</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
              {toBanglaDigits(settings.fontSize)}px
            </span>
          </div>
          <input
            type="range"
            min={24}
            max={44}
            step={2}
            value={settings.fontSize}
            onChange={(e) =>
              onUpdateSettings({ fontSize: Number(e.target.value) })
            }
            className="w-full cursor-pointer"
            style={{ accentColor: 'var(--accent)' }}
          />
          <div
            className="py-3 text-center font-indopak border-y"
            style={{
              borderColor: 'var(--border-subtle)',
              fontSize: `${settings.fontSize}px`,
              lineHeight: 1.95,
            }}
          >
            اَلْحَمْدُ لِلّٰهِ رَبِّ الْعٰلَمِیْنَ ۙ
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium">তিলাওয়াতের সময় স্ক্রিন চালু রাখুন</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                settings.keepScreenAwake ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Auto-Scroll Speed */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">অটো-স্ক্রল গতি</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              স্পর্শ করলে স্বয়ংক্রিয়ভাবে বিরতি নেয়
            </span>
          </div>
          <div
            className="grid grid-cols-5 gap-1 p-1 rounded-2xl"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
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
                    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                  }}
                >
                  {sp.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Offline Quran Storage */}
      <section
        className="pt-6 border-t space-y-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-secondary)' }}
            >
              অফলাইন কুরআন সংরক্ষণ
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-primary)' }}>
              {toBanglaDigits(cachedCount)} / ১১৪ সূরা সংরক্ষিত ({toBanglaDigits(offlinePercent)}%)
            </p>
          </div>
          {cachedCount >= 114 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
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
          className="h-1.5 rounded-full overflow-hidden"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--text-primary) 7%, transparent)',
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
          <p className="text-xs flex items-center gap-2" style={{ color: 'var(--accent)' }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>
              ডাউনলোড হচ্ছে: {toBanglaDigits(downloadProgress.completed)}/১১৪ •{' '}
              {downloadProgress.currentSurahName}
            </span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {downloading ? (
            <button
              type="button"
              onClick={handleCancelDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <X className="w-4 h-4" />
              স্থগিত করুন
            </button>
          ) : (
            (cachedCount < 114 || outdatedCount > 0) && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                }}
              >
                <CloudDownload className="w-4 h-4" />
                {cachedCount >= 114
                  ? 'ইন্দো-পাক স্ক্রিপ্ট আপডেট করুন'
                  : cachedCount > 0
                    ? 'বাকি সূরা ডাউনলোড করুন'
                    : 'সম্পূর্ণ কুরআন ডাউনলোড করুন'}
              </button>
            )
          )}

          {cachedCount > 0 && !downloading && (
            <button
              type="button"
              onClick={handleClearCache}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border cursor-pointer"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              টেক্সট ক্যাশ মুছুন
            </button>
          )}
        </div>
      </section>

      {/* Data Portability & Backup */}
      <section
        className="pt-6 border-t space-y-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <h2
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            ডেটা পোর্টেবিলিটি ও ব্যাকআপ
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            আপনার রুটিন, পরিসংখ্যান ও সব ডেটা ডিভাইসেই সুরক্ষিত। চাইলে JSON ফাইল হিসেবে ব্যাকআপ বা রিস্টোর করুন।
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors active:scale-[0.99] cursor-pointer"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <Download className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            ব্যাকআপ এক্সপোর্ট
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors active:scale-[0.99] cursor-pointer"
            style={{
              backgroundColor: 'transparent',
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

      {/* PWA Install */}
      <section
        className="pt-6 border-t flex items-center justify-between gap-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <Smartphone
            className="w-4 h-4 mt-0.5 shrink-0"
            style={{ color: 'var(--accent)' }}
          />
          <div>
            <h2 className="text-xs font-semibold">অ্যাপ হিসেবে ইনস্টল করুন</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
            className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
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
  );
}
