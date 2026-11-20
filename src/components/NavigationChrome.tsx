import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
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

/**
 * Native-style bottom sheet controller: deterministic mount->paint slide up/down
 * plus interactive drag-to-dismiss on the grabber/header.
 */
export function useBottomSheet(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setDragOffset(0);
      setDragging(false);
      return;
    }

    setVisible(false);
    setDragging(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setDragOffset(0);
    }, 390);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    let cancelled = false;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      if (cancelled) return;
      // Flush initial off-screen transform so browser always runs the entry transition
      void panelRef.current?.offsetHeight;
      innerRaf = requestAnimationFrame(() => {
        if (!cancelled) setVisible(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
    };
  }, [open, mounted]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) {
      return;
    }
    dragStartYRef.current = e.clientY;
    dragStartTimeRef.current = performance.now();
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (dragStartYRef.current === null) return;
    const delta = Math.max(0, e.clientY - dragStartYRef.current);
    setDragOffset(delta);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (dragStartYRef.current === null) return;
    const delta = Math.max(0, e.clientY - dragStartYRef.current);
    const elapsed = Math.max(1, performance.now() - dragStartTimeRef.current);
    const velocity = delta / elapsed;

    dragStartYRef.current = null;
    setDragging(false);

    if (delta > 96 || (delta > 32 && velocity > 0.45)) {
      setVisible(false);
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  const backdropStyle = {
    opacity: visible ? Math.max(0, 1 - dragOffset / 340) : 0,
  };

  const panelTransform = dragging
    ? `translate3d(0, ${dragOffset}px, 0)`
    : visible
      ? 'translate3d(0, 0, 0)'
      : 'translate3d(0, 100%, 0)';

  return {
    mounted,
    visible,
    dragging,
    panelRef,
    backdropStyle,
    panelTransform,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  };
}

interface TabHeaderProps {
  title: ReactNode;
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

export const THEME_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  desc: string;
  swatch: string;
  ink: string;
}> = [
  { id: 'paper', label: 'কাগজ', desc: 'উষ্ণ মুসহাফ', swatch: '#FAF6EE', ink: '#1F241E' },
  { id: 'olive', label: 'জলপাই', desc: 'স্নিগ্ধ সবুজ', swatch: '#EEF2EA', ink: '#1A241B' },
  { id: 'black', label: 'রাত', desc: 'ওলেড কালো', swatch: '#070807', ink: '#E8E2D5' },
];

interface ThemePickerProps {
  value: ThemeMode;
  onSelect: (theme: ThemeMode, label: string) => void;
  showDescription?: boolean;
}

/** Minimal segmented theme selector shared across Settings and Reader sheets. */
export function ThemePicker({
  value,
  onSelect,
}: ThemePickerProps) {
  return (
    <div
      className="grid grid-cols-3 gap-1 p-1 rounded-2xl"
      style={{
        backgroundColor:
          'color-mix(in srgb, var(--text-primary) 5%, transparent)',
      }}
    >
      {THEME_OPTIONS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id, t.label)}
            aria-pressed={active}
            className="flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer active:scale-[0.98]"
            style={{
              backgroundColor: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border shrink-0"
              style={{
                backgroundColor: t.swatch,
                borderColor: active
                  ? 'color-mix(in srgb, var(--accent-text) 55%, transparent)'
                  : 'color-mix(in srgb, var(--text-primary) 22%, transparent)',
              }}
              aria-hidden="true"
            />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const FONT_SIZE_STOPS = [
  { size: 16, pos: 0 },
  { size: 20, pos: 8 },
  { size: 24, pos: 16 },
  { size: 28, pos: 28 },
  { size: 32, pos: 40 },
  { size: 40, pos: 58 },
  { size: 56, pos: 78 },
  { size: 72, pos: 100 },
] as const;

function snapByFontSize(rawSize: number) {
  let nearest: (typeof FONT_SIZE_STOPS)[number] = FONT_SIZE_STOPS[0];
  let minDiff = Math.abs(rawSize - nearest.size);
  for (const stop of FONT_SIZE_STOPS) {
    const diff = Math.abs(rawSize - stop.size);
    if (diff < minDiff) {
      nearest = stop;
      minDiff = diff;
    }
  }
  return nearest;
}

function snapByTrackPosition(rawPos: number) {
  let nearest: (typeof FONT_SIZE_STOPS)[number] = FONT_SIZE_STOPS[0];
  let minDiff = Math.abs(rawPos - nearest.pos);
  for (const stop of FONT_SIZE_STOPS) {
    const diff = Math.abs(rawPos - stop.pos);
    if (diff < minDiff) {
      nearest = stop;
      minDiff = diff;
    }
  }
  return nearest;
}

interface FontSizeControlProps {
  value: number;
  onChange: (size: number) => void;
  label?: string;
}

/**
 * Grouped-distribution font-size slider that magnetically snaps to discrete presets
 * (closer spacing for 16–24, medium spacing for 28–32, wide spacing for 40–72).
 */
export function FontSizeControl({
  value,
  onChange,
  label = 'আরবি অক্ষরের আকার',
}: FontSizeControlProps) {
  const activeStop = snapByFontSize(value);
  const stopIndex = FONT_SIZE_STOPS.findIndex(
    (s) => s.size === activeStop.size
  );
  const percent = activeStop.pos;

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next =
        FONT_SIZE_STOPS[Math.min(FONT_SIZE_STOPS.length - 1, stopIndex + 1)];
      if (next.size !== activeStop.size) onChange(next.size);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = FONT_SIZE_STOPS[Math.max(0, stopIndex - 1)];
      if (prev.size !== activeStop.size) onChange(prev.size);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(FONT_SIZE_STOPS[0].size);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(FONT_SIZE_STOPS[FONT_SIZE_STOPS.length - 1].size);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span
          className="font-semibold tabular-nums"
          style={{ color: 'var(--accent)' }}
        >
          {toBanglaDigits(activeStop.size)} px
        </span>
      </div>

      {/* Custom Track + Elevated Thumb with Snapping Native Range Overlay */}
      <div className="relative h-7 flex items-center select-none">
        <div className="relative w-full mx-2.5 h-1.5 rounded-full overflow-visible">
          {/* Base Track */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--text-primary) 12%, transparent)',
            }}
          />
          {/* Filled Track */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150"
            style={{
              width: `${percent}%`,
              backgroundColor: 'var(--accent)',
            }}
          />
          {/* Elevated Circular Thumb */}
          <span
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border shadow-sm transition-[left] duration-150 pointer-events-none"
            style={{
              left: `${percent}%`,
              backgroundColor: 'var(--bg-elevated)',
              borderColor:
                'color-mix(in srgb, var(--accent) 45%, var(--border-subtle))',
            }}
          />
        </div>

        {/* Accessible Native Range Input mapped 0..100% along visual track */}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          aria-label={label}
          aria-valuetext={`${toBanglaDigits(activeStop.size)} px`}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            const next = snapByTrackPosition(Number(e.target.value));
            if (next.size !== activeStop.size) onChange(next.size);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
        />
      </div>

      {/* Clickable Grouped-Spacing Preset Stop Labels */}
      <div className="relative h-6 mx-2.5">
        {FONT_SIZE_STOPS.map((stop) => {
          const active = activeStop.size === stop.size;
          return (
            <button
              key={stop.size}
              type="button"
              onClick={() => onChange(stop.size)}
              aria-pressed={active}
              className="absolute top-0 -translate-x-1/2 px-0.5 py-0.5 text-[11px] tabular-nums transition-colors cursor-pointer"
              style={{
                left: `${stop.pos}%`,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: active ? 700 : 400,
              }}
            >
              {toBanglaDigits(stop.size)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const {
    mounted,
    visible,
    dragging,
    panelRef,
    backdropStyle,
    panelTransform,
    dragHandleProps,
  } = useBottomSheet(open, onClose);

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
        className={`w-full sm:max-w-md rounded-t-[28px] border-t border-x space-y-5 max-h-[88dvh] overflow-y-auto sukoon-sheet-panel safe-bottom ${
          dragging ? 'sukoon-sheet-panel--dragging' : ''
        }`}
        style={{
          backgroundColor: 'var(--bg-page)',
          borderColor: 'var(--border-subtle)',
          transform: panelTransform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Native top grabber + header */}
        <div
          {...dragHandleProps}
          className="px-5 pt-2.5 pb-1 select-none"
          style={{ touchAction: 'none' }}
        >
          <div
            className="w-9 h-1 rounded-full mx-auto mb-3 opacity-45"
            style={{ backgroundColor: 'var(--text-muted)' }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-bold text-base">পাঠ সেটিংস</h2>
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

        <div className="px-5 pb-5 space-y-5">

        {/* Theme Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold">পড়ার থিম</label>
          <ThemePicker
            value={settings.theme}
            onSelect={(theme) => onUpdateSettings({ theme })}
          />
        </div>

        {/* Font Size Control */}
        <FontSizeControl
          value={settings.fontSize}
          onChange={(fontSize) => onUpdateSettings({ fontSize })}
        />

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
