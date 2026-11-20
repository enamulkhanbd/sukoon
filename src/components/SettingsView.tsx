import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CloudDownload,
  Download,
  Loader2,
  LocateFixed,
  MapPin,
  Smartphone,
  Target,
  Upload,
  X,
} from 'lucide-react';
import {
  db,
  exportUserData,
  importUserData,
  type Settings,
} from '../db/database';
import { useIslamicClock } from '../hooks/useIslamicClock';
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
import {
  DEFAULT_FASTING_LOCATION,
  FASTING_CALCULATION_METHODS,
  formatPrayerTimeBn,
  PRESET_FASTING_LOCATIONS,
  type FastingCalculationMethod,
  type FastingLocation,
} from '../utils/fasting';
import { clampHijriOffsetDays } from '../utils/hijri';
import { AUTO_SCROLL_SPEEDS, toBanglaDigits } from '../utils/formatters';
import { getRecordDuaTotal } from '../utils/stats';
import { DailyGoalSheet } from './DailyGoalSheet';
import {
  FontSizeControl,
  TabHeader,
  ThemePicker,
  useBottomSheet,
} from './NavigationChrome';
import { useToast } from './ToastProvider';

interface LocationPickerSheetProps {
  open: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (location: FastingLocation) => void;
}

function LocationPickerSheet({
  open,
  onClose,
  selectedId,
  onSelect,
}: LocationPickerSheetProps) {
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:px-4 sukoon-sheet-backdrop ${
        visible ? '' : 'pointer-events-none'
      }`}
      style={backdropStyle}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="অবস্থান নির্বাচন"
        className={`w-full sm:max-w-md rounded-t-[28px] border-t border-x max-h-[75dvh] flex flex-col overflow-hidden sukoon-sheet-panel safe-bottom ${
          dragging ? 'sukoon-sheet-panel--dragging' : ''
        }`}
        style={{
          backgroundColor: 'var(--bg-page)',
          borderColor: 'var(--border-subtle)',
          transform: panelTransform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...dragHandleProps}
          className="px-5 pt-2.5 pb-3 border-b select-none shrink-0"
          style={{
            borderColor: 'var(--border-subtle)',
            touchAction: 'none',
          }}
        >
          <div
            className="w-9 h-1 rounded-full mx-auto mb-3 opacity-45"
            style={{ backgroundColor: 'var(--text-muted)' }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-bold text-base">অবস্থান নির্বাচন</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors active:scale-95"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-3 py-2 divide-y divide-[var(--border-subtle)]">
          {PRESET_FASTING_LOCATIONS.map((loc) => {
            const active = loc.id === selectedId;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  onSelect(loc);
                  onClose();
                }}
                className="w-full px-3 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer rounded-xl"
                style={{
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <div className="min-w-0">
                  <div
                    className="text-sm font-medium"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {loc.nameBn}
                  </div>
                  <div
                    className="text-[11px] tabular-nums mt-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {toBanglaDigits(Number(loc.latitude.toFixed(2)))}°,{' '}
                    {toBanglaDigits(Number(loc.longitude.toFixed(2)))}°
                  </div>
                </div>
                {active && (
                  <Check
                    className="w-4 h-4 shrink-0"
                    style={{ color: 'var(--accent)' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const [locatingGps, setLocatingGps] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);

  const clock = useIslamicClock(settings);
  const fastingLocation = settings.fastingLocation ?? DEFAULT_FASTING_LOCATION;
  const fastingMethod = settings.fastingMethod ?? 'karachi';
  const fastingTimeFormat = settings.fastingTimeFormat ?? '12h';
  const hijriOffsetDays = clampHijriOffsetDays(settings.hijriOffsetDays ?? 0);
  const dailyGoalMinutes = Math.max(0, Math.floor(settings.dailyGoalMinutes ?? 0));

  const handleUseBrowserLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('এই ব্রাউজারে অবস্থান নির্ণয় সুবিধা পাওয়া যায়নি।');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocatingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));
        await onUpdateSettings({
          fastingLocation: {
            id: 'custom',
            nameBn: 'বর্তমান অবস্থান',
            latitude: lat,
            longitude: lng,
          },
        });
        toast.success('বর্তমান অবস্থান অনুযায়ী সময়সূচি হালনাগাদ হয়েছে।');
      },
      () => {
        setLocatingGps(false);
        toast.error('অবস্থানের অনুমতি পাওয়া যায়নি। তালিকা থেকে শহর নির্বাচন করুন।');
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

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

        {/* Daily Quran Recitation Goal Row */}
        <button
          type="button"
          onClick={() => setGoalSheetOpen(true)}
          className="w-full flex items-center justify-between gap-3 py-2 text-left transition-opacity active:opacity-75 cursor-pointer group"
        >
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{
                backgroundColor: 'var(--gold-soft)',
                color: 'var(--gold)',
              }}
            >
              <Target className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                দৈনিক কুরআন তিলাওয়াত লক্ষ্য
              </div>
              <p
                className="text-xs mt-0.5 leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {dailyGoalMinutes > 0
                  ? `প্রতিদিন ${toBanglaDigits(dailyGoalMinutes)} মিনিট তিলাওয়াতের লক্ষ্য সক্রিয়`
                  : 'প্রতিদিন কত মিনিট তিলাওয়াত করবেন তা নির্ধারণ করুন'}
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
          পড়ার পরিবেশ
        </h2>

        <div className="space-y-2">
          <span className="text-xs font-medium block">থিম</span>
          <ThemePicker
            value={settings.theme}
            onSelect={async (theme, label) => {
              await onUpdateSettings({ theme });
              toast.success(`থিম পরিবর্তন হয়েছে: ${label}`);
            }}
          />
        </div>

        <FontSizeControl
          value={settings.fontSize}
          onChange={(fontSize) => onUpdateSettings({ fontSize })}
        />

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

      {/* Fasting & Hijri Settings */}
      <section
        className="pt-6 border-t space-y-5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <h2
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            নামাজ, রোজা ও ইসলামী দিনের সময়সূচি
          </h2>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
            অবস্থান ও হিসাবের পদ্ধতি অনুযায়ী সম্পূর্ণ অফলাইনে ৫ ওয়াক্ত, মাগরিব রুটিন রিসেট ও রোজার সময় নির্ণয় হয়।
          </p>
        </div>

        {/* Today's 5 Waqts Preview */}
        <div
          className="rounded-2xl border p-3 space-y-2"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span
              className="inline-flex items-center gap-1 font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              <Clock className="w-3.5 h-3.5" />
              আজকের ওয়াক্ত ({fastingLocation.nameBn})
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              মাগরিবে রুটিন রিসেট
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1 text-center">
            {(
              [
                { id: 'fajr', label: 'ফজর', time: clock.todayWaqts.fajr },
                { id: 'dhuhr', label: 'যোহর', time: clock.todayWaqts.dhuhr },
                { id: 'asr', label: 'আসর', time: clock.todayWaqts.asr },
                { id: 'maghrib', label: 'মাগরিব', time: clock.todayWaqts.maghrib },
                { id: 'isha', label: 'এশা', time: clock.todayWaqts.isha },
              ] as const
            ).map((w) => {
              const active = clock.currentWaqt === w.id;
              return (
                <div
                  key={w.id}
                  className="rounded-xl py-1.5 px-1"
                  style={{
                    backgroundColor: active
                      ? 'var(--accent-soft)'
                      : 'transparent',
                  }}
                >
                  <div
                    className="text-[10px] font-medium"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {w.label}
                  </div>
                  <div
                    className="text-[10px] font-semibold tabular-nums mt-0.5 leading-tight"
                    style={{
                      color: active
                        ? 'var(--accent)'
                        : 'var(--text-primary)',
                    }}
                  >
                    {formatPrayerTimeBn(
                      w.time,
                      fastingTimeFormat,
                      fastingLocation.timeZone
                    ).replace(/^(ভোর|সকাল|দুপুর|বিকাল|সন্ধ্যা|রাত)\s+/, '')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location Preset + GPS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">অবস্থান (শহর)</span>
            <span className="tabular-nums text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {fastingLocation.nameBn} ({toBanglaDigits(Number(fastingLocation.latitude.toFixed(2)))}°,{' '}
              {toBanglaDigits(Number(fastingLocation.longitude.toFixed(2)))}°)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="অবস্থান নির্বাচন"
              aria-haspopup="dialog"
              aria-expanded={locationSheetOpen}
              onClick={() => setLocationSheetOpen(true)}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 cursor-pointer transition-colors active:scale-[0.99]"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="truncate">
                {fastingLocation.id === 'custom'
                  ? 'বর্তমান অবস্থান (GPS)'
                  : fastingLocation.nameBn}
              </span>
              <ChevronDown
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--text-muted)' }}
              />
            </button>

            <button
              type="button"
              onClick={handleUseBrowserLocation}
              disabled={locatingGps}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium shrink-0 cursor-pointer disabled:opacity-60"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'var(--border-subtle)',
                color: 'var(--accent)',
              }}
            >
              {locatingGps ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5" />
              )}
              জিপিএস
            </button>
          </div>
        </div>

        {/* Calculation Method */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">হিসাবের পদ্ধতি</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {FASTING_CALCULATION_METHODS.find((m) => m.id === fastingMethod)?.hintBn}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FASTING_CALCULATION_METHODS.map((method) => {
              const active = fastingMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={active}
                  onClick={async () => {
                    await onUpdateSettings({
                      fastingMethod: method.id as FastingCalculationMethod,
                    });
                    toast.info(`সময়সূচি পদ্ধতি: ${method.labelBn}`);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active
                      ? 'var(--accent)'
                      : 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                  }}
                >
                  {method.labelBn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Format */}
        <div className="space-y-2">
          <span className="text-xs font-medium block">সময়ের ফরম্যাট</span>
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-2xl"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
            }}
          >
            {(
              [
                { value: '12h', label: '১২ ঘণ্টা' },
                { value: '24h', label: '২৪ ঘণ্টা' },
              ] as const
            ).map((opt) => {
              const active = fastingTimeFormat === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={async () => {
                    await onUpdateSettings({ fastingTimeFormat: opt.value });
                  }}
                  className="py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hijri Date Offset */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">হিজরি তারিখ সমন্বয়</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              চাঁদ দেখার ভিত্তিতে (-২ থেকে +২ দিন)
            </span>
          </div>
          <div
            className="grid grid-cols-5 gap-1 p-1 rounded-2xl"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
            }}
          >
            {([-2, -1, 0, 1, 2] as const).map((offset) => {
              const active = hijriOffsetDays === offset;
              const label =
                offset === 0
                  ? '০ দিন'
                  : offset > 0
                    ? `+${toBanglaDigits(offset)} দিন`
                    : `-${toBanglaDigits(Math.abs(offset))} দিন`;
              return (
                <button
                  key={offset}
                  type="button"
                  aria-pressed={active}
                  onClick={async () => {
                    await onUpdateSettings({ hijriOffsetDays: offset });
                  }}
                  className="py-1.5 rounded-xl text-xs font-medium tabular-nums transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                  }}
                >
                  {label}
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

        {(downloading || cachedCount < 114 || outdatedCount > 0) && (
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
                  ? 'কুরআন টেক্সট আপডেট করুন'
                  : cachedCount > 0
                    ? 'বাকি সূরা ডাউনলোড করুন'
                    : 'সম্পূর্ণ কুরআন ডাউনলোড করুন'}
              </button>
            )}
          </div>
        )}
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

      <LocationPickerSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        selectedId={fastingLocation.id}
        onSelect={async (selected) => {
          await onUpdateSettings({ fastingLocation: selected });
          toast.success(`অবস্থান নির্ধারিত হয়েছে: ${selected.nameBn}`);
        }}
      />

      <DailyGoalSheet
        open={goalSheetOpen}
        onClose={() => setGoalSheetOpen(false)}
        currentGoalMinutes={dailyGoalMinutes}
        onSave={async (minutes) => {
          await onUpdateSettings({ dailyGoalMinutes: minutes });
          toast.success(
            minutes > 0
              ? `দৈনিক তিলাওয়াত লক্ষ্য ${toBanglaDigits(minutes)} মিনিট নির্ধারিত হয়েছে`
              : 'দৈনিক তিলাওয়াত লক্ষ্য বন্ধ করা হয়েছে'
          );
        }}
      />
    </div>
  );
}
