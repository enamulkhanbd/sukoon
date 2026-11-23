import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  LocateFixed,
  MapPin,
  Moon,
  X,
} from 'lucide-react';
import type { Settings } from '../db/database';
import { useIslamicClock } from '../hooks/useIslamicClock';
import {
  DEFAULT_FASTING_LOCATION,
  FASTING_CALCULATION_METHODS,
  formatPrayerTimeBn,
  getDefaultHijriOffsetDays,
  PRESET_FASTING_LOCATIONS,
  resolveActiveFastingContext,
  resolveHijriOffsetSettings,
  type FastingCalculationMethod,
  type FastingLocation,
} from '../utils/fasting';
import { toBanglaDigits } from '../utils/formatters';
import { formatHijriDateBn } from '../utils/hijri';
import { useBottomSheet } from './NavigationChrome';
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
        aria-label="অবস্থান নির্বাচন"
        className={`w-full sm:max-w-md rounded-t-[28px] max-h-[75dvh] flex flex-col overflow-hidden sukoon-sheet-panel sukoon-glass-sheet safe-bottom ${
          dragging ? 'sukoon-sheet-panel--dragging' : ''
        }`}
        style={{
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
              <h2 className="font-semibold text-base">অবস্থান নির্বাচন</h2>
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

interface RamadanPrayerSettingsProps {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void>;
  onOpenFastingSchedule: () => void;
}

function formatHijriOffsetLabelBn(offset: number): string {
  if (offset === 0) return '০ দিন';
  return offset > 0
    ? `+${toBanglaDigits(offset)} দিন`
    : `-${toBanglaDigits(Math.abs(offset))} দিন`;
}

export function RamadanPrayerSettings({
  settings,
  onUpdateSettings,
  onOpenFastingSchedule,
}: RamadanPrayerSettingsProps) {
  const toast = useToast();
  const [locatingGps, setLocatingGps] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  const clock = useIslamicClock(settings);
  const fastingLocation = settings.fastingLocation ?? DEFAULT_FASTING_LOCATION;
  const fastingMethod = settings.fastingMethod ?? 'karachi';
  const fastingTimeFormat = settings.fastingTimeFormat ?? '12h';
  const { hijriOffsetDays, hijriOffsetMode } = resolveHijriOffsetSettings(
    fastingLocation,
    settings.hijriOffsetDays,
    settings.hijriOffsetMode
  );

  const fastingContext = resolveActiveFastingContext(
    clock.now,
    fastingLocation,
    fastingMethod,
    fastingTimeFormat,
    hijriOffsetDays
  );

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
        const nextLocation: FastingLocation = {
          id: 'custom',
          nameBn: 'বর্তমান অবস্থান',
          latitude: lat,
          longitude: lng,
        };
        await onUpdateSettings({
          fastingLocation: nextLocation,
          ...(hijriOffsetMode === 'auto'
            ? { hijriOffsetDays: getDefaultHijriOffsetDays(nextLocation) }
            : {}),
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

  return (
    <div className="space-y-5">
      {/* Quick Entry to Full Monthly Ramadan / Fasting Schedule */}
      <button
        type="button"
        onClick={onOpenFastingSchedule}
        className="w-full rounded-2xl border px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-opacity active:opacity-80 cursor-pointer group"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{
              backgroundColor: fastingContext.hijri.isRamadan
                ? 'var(--gold-soft)'
                : 'var(--accent-soft)',
              color: fastingContext.hijri.isRamadan
                ? 'var(--gold)'
                : 'var(--accent)',
            }}
          >
            {fastingContext.hijri.isRamadan ? (
              <Moon className="w-4 h-4" />
            ) : (
              <CalendarDays className="w-4 h-4" />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-snug">
              {fastingContext.hijri.isRamadan
                ? 'মাহে রমজানের পূর্ণ সময়সূচি'
                : 'সাহরি, ইফতার ও মাসিক সময়সূচি'}
            </div>
            <p
              className="text-xs mt-0.5 leading-relaxed truncate tabular-nums"
              style={{ color: 'var(--text-secondary)' }}
            >
              {formatHijriDateBn(fastingContext.hijri)} • সাহরি{' '}
              {fastingContext.dailyTimes.sehriFormatted} • ইফতার{' '}
              {fastingContext.dailyTimes.iftarFormatted}
            </p>
          </div>
        </div>
        <ChevronRight
          className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {/* Today's 5 Waqts Preview */}
      <div
        className="rounded-2xl border p-3.5 space-y-2.5"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between text-[11px]">
          <span
            className="inline-flex items-center gap-1.5 font-medium"
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
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <div
                  className="text-[11px] font-medium"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {w.label}
                </div>
                <div
                  className="text-[11px] font-medium tabular-nums mt-0.5 leading-tight"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-primary)',
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
          <span
            className="tabular-nums text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            {fastingLocation.nameBn} (
            {toBanglaDigits(Number(fastingLocation.latitude.toFixed(2)))}°,{' '}
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
            className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 cursor-pointer transition-colors active:scale-[0.99]"
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-medium shrink-0 cursor-pointer transition-colors active:scale-[0.99] disabled:opacity-60"
            style={{
              backgroundColor: 'var(--bg-elevated)',
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
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
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
            backgroundColor:
              'color-mix(in srgb, var(--text-primary) 5%, transparent)',
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
          <span className="text-xs font-medium shrink-0">হিজরি তারিখ সমন্বয়</span>
          {hijriOffsetMode === 'auto' ? (
            <span
              className="text-[11px] truncate"
              style={{ color: 'var(--text-muted)' }}
            >
              অটো ({fastingLocation.nameBn}:{' '}
              {formatHijriOffsetLabelBn(hijriOffsetDays)})
            </span>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-[11px]"
                style={{ color: 'var(--text-muted)' }}
              >
                ম্যানুয়াল
              </span>
              <button
                type="button"
                onClick={async () => {
                  await onUpdateSettings({
                    hijriOffsetMode: 'auto',
                    hijriOffsetDays: getDefaultHijriOffsetDays(fastingLocation),
                  });
                }}
                className="text-[11px] font-medium underline underline-offset-2 cursor-pointer transition-opacity active:opacity-70"
                style={{ color: 'var(--accent)' }}
              >
                অটোতে ফিরুন
              </button>
            </div>
          )}
        </div>
        <div
          className="grid grid-cols-5 gap-1 p-1 rounded-2xl"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--text-primary) 5%, transparent)',
          }}
        >
          {([-2, -1, 0, 1, 2] as const).map((offset) => {
            const active = hijriOffsetDays === offset;
            const label = formatHijriOffsetLabelBn(offset);
            return (
              <button
                key={offset}
                type="button"
                aria-pressed={active}
                onClick={async () => {
                  await onUpdateSettings({
                    hijriOffsetDays: offset,
                    hijriOffsetMode: 'manual',
                  });
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

      <p
        className="text-[11px] leading-relaxed pt-1"
        style={{ color: 'var(--text-muted)' }}
      >
        অবস্থান ও হিসাবের পদ্ধতি অনুযায়ী সম্পূর্ণ অফলাইনে ৫ ওয়াক্ত, মাগরিব রুটিন রিসেট ও রোজার সময় নির্ণয় হয়।
      </p>

      <LocationPickerSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        selectedId={fastingLocation.id}
        onSelect={async (selected) => {
          await onUpdateSettings({
            fastingLocation: selected,
            ...(hijriOffsetMode === 'auto'
              ? { hijriOffsetDays: getDefaultHijriOffsetDays(selected) }
              : {}),
          });
          toast.success(`অবস্থান নির্ধারিত হয়েছে: ${selected.nameBn}`);
        }}
      />
    </div>
  );
}
