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
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import {
  type ColorMode,
  type GlassMode,
  type Settings,
  type ThemeMode,
} from '../db/database';
import { toBanglaDigits } from '../utils/formatters';
import { getThemeVariantMeta } from '../utils/themeRegistry';

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
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold truncate min-w-0 flex items-center">
            {title}
          </h1>
          {rightAction && <div className="shrink-0">{rightAction}</div>}
        </div>
        {subtitle && (
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {subtitle}
          </p>
        )}
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
 * Minimal borderless circular icon button for TopBar & TabHeader slots.
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
      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
      style={{
        backgroundColor: active
          ? 'var(--accent-soft)'
          : 'color-mix(in srgb, var(--text-primary) 4.5%, transparent)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

export interface UnderlineTabOption<T extends string> {
  id: T;
  label: string;
  count?: string;
}

interface UnderlineTabsProps<T extends string> {
  tabs: ReadonlyArray<UnderlineTabOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  accentColor?: string;
}

/**
 * Plain, minimal editorial underline tab bar (zero box/pill clutter).
 */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  accentColor = 'var(--accent)',
}: UnderlineTabsProps<T>) {
  return (
    <div
      className="grid border-b"
      style={{
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        borderColor: 'var(--border-subtle)',
      }}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className="relative py-2.5 px-1 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-0"
            style={{
              color: active ? accentColor : 'var(--text-muted)',
            }}
          >
            <span className="truncate">{tab.label}</span>
            {tab.count !== undefined && (
              <span className="text-[11px] font-medium tabular-nums opacity-70 shrink-0">
                {tab.count}
              </span>
            )}
            {active && (
              <span
                className="absolute inset-x-3 sm:inset-x-6 bottom-0 h-[2px] rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface SoftSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  compact?: boolean;
  elevated?: boolean;
}

/**
 * Clean pill search field — uses --bg-elevated inside tinted top bands and --bg-surface on page canvas.
 */
export function SoftSearchInput({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  compact = false,
  elevated = false,
}: SoftSearchInputProps) {
  return (
    <div className="relative">
      <Search
        className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text-muted)' }}
      />
      <input
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-11 pr-9 rounded-full outline-none transition-colors ${
          compact ? 'py-2 text-xs' : 'py-2.5 text-sm'
        }`}
        style={{
          backgroundColor: elevated ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          color: 'var(--text-primary)',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="অনুসন্ধান মুছুন"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer transition-opacity active:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

interface TopBarProps {
  mode?: 'sticky' | 'fixed';
  visible?: boolean;
  surface?: 'page' | 'tinted';
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
  surface = 'page',
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
      className={`${positionClass} ${
        surface === 'tinted' ? 'sukoon-glass-bar-tinted' : 'sukoon-glass-bar'
      } safe-top`}
    >
      <div className="max-w-2xl mx-auto px-5 py-2.5 flex items-center gap-3 min-h-[3.5rem]">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--text-primary) 4.5%, transparent)',
            color: 'var(--text-secondary)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="font-semibold text-sm sm:text-base truncate">{title}</h1>
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
        <div className="max-w-2xl mx-auto px-5 pb-2.5">{subRow}</div>
      )}
    </header>
  );
}

export const COLOR_MODE_OPTIONS: Array<{
  id: ColorMode;
  label: string;
  desc: string;
}> = [
  { id: 'light', label: 'আলো (Light)', desc: 'দিনের আরামদায়ক আলো' },
  { id: 'dark', label: 'রাত (Dark)', desc: 'রাতের শান্ত ডার্ক মোড' },
];

interface ModePickerProps {
  value: ColorMode;
  onSelect: (mode: ColorMode, label: string) => void;
}

/** Clean 2-segment Light / Dark mode selector shared across Settings and Reader sheets. */
export function ModePicker({ value, onSelect }: ModePickerProps) {
  return (
    <div
      className="grid grid-cols-2 gap-1 p-1 rounded-2xl"
      style={{
        backgroundColor:
          'color-mix(in srgb, var(--text-primary) 5%, transparent)',
      }}
    >
      {COLOR_MODE_OPTIONS.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id, m.label)}
            aria-pressed={active}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer active:scale-[0.98]"
            style={{
              backgroundColor: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
          >
            {m.id === 'light' ? (
              <Sun className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Moon className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const THEME_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  descLight: string;
  descDark: string;
}> = [
  {
    id: 'paper',
    label: 'কাগজ',
    descLight: 'উষ্ণ মুসহাফ',
    descDark: 'উষ্ণ রাত',
  },
  {
    id: 'olive',
    label: 'জলপাই',
    descLight: 'স্নিগ্ধ সবুজ',
    descDark: 'রাতের অলিভ',
  },
  {
    id: 'sky',
    label: 'আকাশ',
    descLight: 'স্নিগ্ধ নীল',
    descDark: 'রাতের আকাশ',
  },
];

interface ThemePickerProps {
  value: ThemeMode;
  mode?: ColorMode;
  onSelect: (theme: ThemeMode, label: string) => void;
  showDescription?: boolean;
}

/** Minimal 3-palette theme selector with mode-aware dual-tone swatches. */
export function ThemePicker({
  value,
  mode = 'light',
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
        const { swatchBg, swatchAccent } = getThemeVariantMeta(t.id, mode);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id, t.label)}
            aria-pressed={active}
            className="flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer active:scale-[0.98]"
            style={{
              backgroundColor: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
          >
            <span
              className="w-4 h-4 rounded-full border shrink-0 flex items-center justify-center"
              style={{
                backgroundColor: swatchBg,
                borderColor: active
                  ? 'color-mix(in srgb, var(--accent-text) 55%, transparent)'
                  : 'color-mix(in srgb, var(--text-primary) 24%, transparent)',
              }}
              aria-hidden="true"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: swatchAccent }}
              />
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const GLASS_OPTIONS: Array<{
  id: GlassMode;
  label: string;
  desc: string;
  fillOpacity: number;
}> = [
  { id: 'clear', label: 'স্বচ্ছ', desc: 'বেশি স্বচ্ছ ও গ্লাসি', fillOpacity: 0.2 },
  { id: 'frosted', label: 'ফ্রস্টেড', desc: 'সুষম গ্লাস (ডিফল্ট)', fillOpacity: 0.58 },
  { id: 'solid', label: 'ঘন', desc: 'কম স্বচ্ছ ও স্থির', fillOpacity: 0.96 },
];

interface GlassPickerProps {
  value: GlassMode;
  onSelect: (mode: GlassMode, label: string) => void;
}

/** Apple-style 3-step glass transparency selector (Clear / Frosted / Solid). */
export function GlassPicker({ value, onSelect }: GlassPickerProps) {
  return (
    <div
      className="grid grid-cols-3 gap-1 p-1 rounded-2xl"
      style={{
        backgroundColor:
          'color-mix(in srgb, var(--text-primary) 5%, transparent)',
      }}
    >
      {GLASS_OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id, opt.label)}
            aria-pressed={active}
            className="flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer active:scale-[0.98]"
            style={{
              backgroundColor: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border shrink-0 relative overflow-hidden"
              style={{
                borderColor: active
                  ? 'color-mix(in srgb, var(--accent-text) 70%, transparent)'
                  : 'color-mix(in srgb, var(--text-primary) 30%, transparent)',
              }}
              aria-hidden="true"
            >
              <span
                className="absolute inset-0"
                style={{
                  backgroundColor: active
                    ? 'var(--accent-text)'
                    : 'var(--text-secondary)',
                  opacity: opt.fillOpacity,
                }}
              />
            </span>
            <span>{opt.label}</span>
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
          className="font-medium tabular-nums"
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
        className={`w-full sm:max-w-md rounded-t-[28px] space-y-5 max-h-[88dvh] overflow-y-auto sukoon-sheet-panel sukoon-glass-sheet safe-bottom ${
          dragging ? 'sukoon-sheet-panel--dragging' : ''
        }`}
        style={{
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
              <h2 className="font-semibold text-base">পাঠ সেটিংস</h2>
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

        {/* Light / Dark Mode Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-medium">মোড</label>
          <ModePicker
            value={settings.colorMode ?? 'light'}
            onSelect={(colorMode) => onUpdateSettings({ colorMode })}
          />
        </div>

        {/* Theme Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-medium">পড়ার থিম</label>
          <ThemePicker
            value={settings.theme}
            mode={settings.colorMode ?? 'light'}
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
          className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {settings.keepScreenAwake ? (
              <Eye className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
            ) : (
              <EyeOff className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
            )}
            <div className="min-w-0">
              <div className="text-xs font-medium">স্ক্রিন চালু রাখুন</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
                : 'color-mix(in srgb, var(--text-primary) 16%, transparent)',
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
  elevated?: boolean;
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
  elevated = false,
}: ReaderFreePagerProps) {
  const neutralBg = elevated ? 'var(--bg-elevated)' : 'var(--bg-surface)';
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        type="button"
        disabled={!onPrev}
        onClick={onPrev}
        className="flex items-center gap-2 px-3.5 py-3 rounded-2xl text-left transition-opacity active:opacity-80 disabled:opacity-35 cursor-pointer disabled:cursor-default min-w-0"
        style={{
          backgroundColor: neutralBg,
          color: 'var(--text-secondary)',
        }}
      >
        <ArrowLeft className="w-4 h-4 shrink-0" />
        <div className="min-w-0">
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {prevLabel}
          </div>
          {prevTitle && (
            <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {prevTitle}
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        disabled={!onNext}
        onClick={onNext}
        className="flex items-center justify-end gap-2 px-3.5 py-3 rounded-2xl text-right transition-opacity active:opacity-80 disabled:opacity-35 cursor-pointer disabled:cursor-default min-w-0"
        style={{
          backgroundColor: onNext ? 'var(--accent-soft)' : neutralBg,
          color: onNext ? 'var(--accent)' : 'var(--text-secondary)',
        }}
      >
        <div className="min-w-0">
          <div className="text-[11px] opacity-80">{nextLabel}</div>
          {nextTitle && (
            <div className="text-xs font-medium truncate">{nextTitle}</div>
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
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-medium transition-opacity active:opacity-80 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-elevated)',
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-opacity active:opacity-85 cursor-pointer"
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-opacity active:opacity-85 cursor-pointer"
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
