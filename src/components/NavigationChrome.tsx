import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Settings, ThemeMode } from '../db/database';
import { toBanglaDigits } from '../utils/formatters';

interface TabHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  rightAction?: ReactNode;
}

/**
 * Shared Level-1 header for the 5 primary BottomNav tabs.
 */
export function TabHeader({
  title,
  subtitle,
  badge,
  rightAction,
}: TabHeaderProps) {
  return (
    <header className="space-y-1.5">
      {badge}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && (
            <p
              className="text-xs mt-0.5 leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
    </header>
  );
}

interface TopBarIconButtonProps {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: ReactNode;
}

/**
 * Unified 36px circular action button for TopBar right slots.
 */
export function TopBarIconButton({
  onClick,
  label,
  active = false,
  children,
}: TopBarIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
      style={{
        backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
        color: active ? 'var(--accent)' : 'var(--text-primary)',
      }}
    >
      {children}
    </button>
  );
}

interface TopBarProps {
  mode?: 'sticky' | 'fixed';
  visible?: boolean;
  onBack: () => void;
  backLabel?: string;
  title: string;
  titleBadge?: ReactNode;
  subtitle?: string;
  rightActions?: ReactNode;
  subRow?: ReactNode;
}

/**
 * Unified Level-2 (detail/chapter) and Level-3 (reader) top navigation chrome.
 */
export function TopBar({
  mode = 'sticky',
  visible = true,
  onBack,
  backLabel = 'ফিরে যান',
  title,
  titleBadge,
  subtitle,
  rightActions,
  subRow,
}: TopBarProps) {
  const positionClass =
    mode === 'fixed'
      ? `fixed top-0 inset-x-0 z-30 transition-all duration-300 ${
          visible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`
      : 'sticky top-0 z-20';

  return (
    <header
      className={`${positionClass} border-b backdrop-blur-md safe-top`}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-page) 92%, transparent)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="max-w-2xl mx-auto px-3 py-2 flex items-center gap-2.5 min-h-[3.25rem]">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
          className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="font-bold text-sm sm:text-base truncate">{title}</h1>
            {titleBadge}
          </div>
          {subtitle && (
            <p
              className="text-[11px] truncate"
              style={{ color: 'var(--text-muted)' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {rightActions && (
          <div className="flex items-center gap-1.5 shrink-0">{rightActions}</div>
        )}
      </div>
      {subRow && (
        <div className="max-w-2xl mx-auto px-3 pb-2.5">{subRow}</div>
      )}
    </header>
  );
}

const READER_THEMES: Array<{
  id: ThemeMode;
  label: string;
  swatch: string;
  ink: string;
}> = [
  { id: 'paper', label: 'কাগজ', swatch: '#FAF6EE', ink: '#1F241E' },
  { id: 'olive', label: 'জলপাই', swatch: '#EEF2EA', ink: '#1A241B' },
  { id: 'black', label: 'রাত', swatch: '#070807', ink: '#E8E2D5' },
];

interface ReaderQuickSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void>;
  wakeLockSubtitle?: string;
  children?: ReactNode;
}

/**
 * Shared quick-settings bottom sheet across both Surah and Dua readers.
 */
export function ReaderQuickSettingsSheet({
  open,
  onClose,
  settings,
  onUpdateSettings,
  wakeLockSubtitle = 'পড়ার সময় স্ক্রিন জাগ্রত রাখবে',
  children,
}: ReaderQuickSettingsSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-5 space-y-5 max-h-[88dvh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--bg-page)',
          borderColor: 'var(--border-subtle)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="font-bold text-base">পাঠ সেটিংস</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="p-1.5 rounded-full cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold">পড়ার থিম</label>
          <div className="grid grid-cols-3 gap-2">
            {READER_THEMES.map((t) => {
              const active = settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onUpdateSettings({ theme: t.id })}
                  className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-2xl border text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: t.swatch,
                    color: t.ink,
                    borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                    boxShadow: active ? '0 0 0 2px var(--accent)' : 'none',
                  }}
                >
                  <span className="font-indopak text-lg leading-none">ق</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">আরবি অক্ষরের আকার</span>
            <span style={{ color: 'var(--accent)' }}>
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
            className="w-full accent-emerald-700 cursor-pointer"
          />
        </div>

        {/* Keep Screen Awake */}
        <div
          className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2.5">
            {settings.keepScreenAwake ? (
              <Eye className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            ) : (
              <EyeOff className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            )}
            <div>
              <div className="text-xs font-semibold">স্ক্রিন চালু রাখুন</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {wakeLockSubtitle}
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.keepScreenAwake}
            onClick={() =>
              onUpdateSettings({ keepScreenAwake: !settings.keepScreenAwake })
            }
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

        {children}
      </div>
    </div>
  );
}

interface ReaderFreePagerProps {
  prevTitle?: string | null;
  prevLabel: string;
  onPrev?: () => void;
  nextTitle?: string | null;
  nextLabel: string;
  onNext?: () => void;
}

/**
 * Symmetric Previous / Next footer bar for both Surah and Dua free reading.
 */
export function ReaderFreePager({
  prevTitle,
  prevLabel,
  onPrev,
  nextTitle,
  nextLabel,
  onNext,
}: ReaderFreePagerProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 pt-2">
      <button
        type="button"
        disabled={!onPrev}
        onClick={onPrev}
        className="flex items-center gap-2 px-3.5 py-3 rounded-2xl border text-left transition-colors disabled:opacity-35 cursor-pointer disabled:cursor-default min-w-0"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
      >
        <ArrowLeft className="w-4 h-4 shrink-0" />
        <div className="min-w-0">
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {prevLabel}
          </div>
          {prevTitle && (
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {prevTitle}
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        disabled={!onNext}
        onClick={onNext}
        className="flex items-center justify-end gap-2 px-3.5 py-3 rounded-2xl border text-right transition-colors disabled:opacity-35 cursor-pointer disabled:cursor-default min-w-0"
        style={{
          backgroundColor: onNext ? 'var(--accent-soft)' : 'var(--bg-elevated)',
          borderColor: onNext ? 'var(--accent)' : 'var(--border-subtle)',
          color: onNext ? 'var(--accent)' : 'var(--text-secondary)',
        }}
      >
        <div className="min-w-0">
          <div className="text-[10px] opacity-80">{nextLabel}</div>
          {nextTitle && (
            <div className="text-xs font-semibold truncate">{nextTitle}</div>
          )}
        </div>
        <ArrowRight className="w-4 h-4 shrink-0" />
      </button>
    </div>
  );
}

interface ReaderRoutinePagerProps {
  routineTitle?: string;
  hasPrev: boolean;
  onPrev?: () => void;
  nextLabel?: string | null;
  onNext?: () => void;
  onComplete: () => void;
}

/**
 * Shared routine progression footer inside both Surah and Dua readers.
 */
export function ReaderRoutinePager({
  routineTitle,
  hasPrev,
  onPrev,
  nextLabel,
  onNext,
  onComplete,
}: ReaderRoutinePagerProps) {
  return (
    <div className="space-y-3">
      {!nextLabel && (
        <div
          className="inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>মাশাআল্লাহ! “{routineTitle}” সম্পন্ন হয়েছে</span>
        </div>
      )}

      <div className="flex items-center justify-center gap-2.5 flex-wrap">
        {hasPrev && onPrev && (
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-medium cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            পূর্ববর্তী অংশ
          </button>
        )}

        {nextLabel && onNext ? (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-sm cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            পরবর্তী অংশ: {nextLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            রুটিন সমাপ্ত করে ফিরুন
          </button>
        )}
      </div>
    </div>
  );
}
