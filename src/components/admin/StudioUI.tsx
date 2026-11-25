import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FilePenLine,
  Loader2,
  RotateCcw,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';

export type StudioBadgeTone = 'neutral' | 'emerald' | 'amber' | 'blue' | 'danger';

const BADGE_STYLES: Record<StudioBadgeTone, { bg: string; color: string; dot: string }> = {
  neutral: {
    bg: 'var(--st-bg-muted)',
    color: 'var(--st-text-secondary)',
    dot: 'var(--st-text-faint)',
  },
  emerald: {
    bg: 'var(--st-accent-soft)',
    color: 'var(--st-accent)',
    dot: 'var(--st-accent)',
  },
  amber: {
    bg: 'var(--st-amber-soft)',
    color: 'var(--st-amber)',
    dot: 'var(--st-amber)',
  },
  blue: {
    bg: 'var(--st-blue-soft)',
    color: 'var(--st-blue)',
    dot: 'var(--st-blue)',
  },
  danger: {
    bg: 'var(--st-danger-soft)',
    color: 'var(--st-danger)',
    dot: 'var(--st-danger)',
  },
};

export function StudioBadge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
}: {
  children: ReactNode;
  tone?: StudioBadgeTone;
  dot?: boolean;
  className?: string;
}) {
  const s = BADGE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[5px] text-[11px] font-medium leading-tight tracking-tight shrink-0 ${className}`}
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: s.dot }}
        />
      )}
      {children}
    </span>
  );
}

interface StudioButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md';
  loading?: boolean;
}

export function StudioButton({
  variant = 'secondary',
  size = 'sm',
  loading = false,
  disabled,
  className = '',
  style,
  children,
  ...rest
}: StudioButtonProps) {
  const sizeClass =
    size === 'xs'
      ? 'h-7 px-2.5 text-xs gap-1.5 rounded-[6px]'
      : size === 'md'
        ? 'h-9 px-4 text-[13px] gap-2 rounded-[7px]'
        : 'h-8 px-3 text-xs gap-1.5 rounded-[6px]';

  const variantStyle =
    variant === 'primary'
      ? {
          backgroundColor: 'var(--st-primary)',
          color: 'var(--st-primary-text)',
          borderColor: 'var(--st-primary)',
        }
      : variant === 'danger'
        ? {
            backgroundColor: 'var(--st-danger-soft)',
            color: 'var(--st-danger)',
            borderColor: 'color-mix(in srgb, var(--st-danger) 24%, transparent)',
          }
        : variant === 'ghost'
          ? {
              backgroundColor: 'transparent',
              color: 'var(--st-text-secondary)',
              borderColor: 'transparent',
            }
          : {
              backgroundColor: 'var(--st-bg-input)',
              color: 'var(--st-text)',
              borderColor: 'var(--st-border)',
              boxShadow: 'var(--st-shadow-sm)',
            };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium border cursor-pointer select-none transition-opacity hover:opacity-90 active:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-ring)] disabled:opacity-45 disabled:cursor-not-allowed shrink-0 ${sizeClass} ${className}`}
      style={{ ...variantStyle, ...style }}
      {...rest}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
      {children}
    </button>
  );
}

export function StudioField({
  label,
  required,
  hint,
  action,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] font-medium tracking-[-0.01em]" style={{ color: 'var(--st-text-secondary)' }}>
          {label}
          {required && (
            <span className="ml-0.5" style={{ color: 'var(--st-danger)' }}>
              *
            </span>
          )}
        </label>
        {action}
      </div>
      {children}
      {hint && (
        <p className="text-[11px] leading-snug" style={{ color: 'var(--st-text-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function StudioInput({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`studio-field-control w-full h-9 px-3 text-[13.5px] ${className}`}
    />
  );
}

export function StudioTextarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`studio-field-control w-full px-3 py-2 text-[13.5px] leading-relaxed resize-y ${className}`}
    />
  );
}

export interface StudioDropdownOption<T extends string | number = string> {
  value: T;
  label: string;
  meta?: string;
}

export function StudioDropdown<T extends string | number = string>({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  searchable,
  searchPlaceholder = 'Filter options…',
  disabled = false,
  className = '',
}: {
  value: T;
  options: Array<StudioDropdownOption<T>>;
  onChange: (value: T) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openUpward: boolean;
    maxHeight: number;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showSearch = searchable ?? options.length > 10;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.meta && opt.meta.toLowerCase().includes(q)) ||
        String(opt.value).toLowerCase().includes(q)
    );
  }, [options, search]);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const desiredH = Math.min(280, Math.max(120, options.length * 34 + (showSearch ? 44 : 12)));
    const openUpward = spaceBelow < Math.min(200, desiredH) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(280, openUpward ? spaceAbove - 4 : spaceBelow - 4));
    const width = Math.min(Math.max(rect.width, 180), viewportW - 16);
    const left = Math.min(Math.max(8, rect.left), viewportW - width - 8);
    const top = openUpward ? rect.top - 4 : rect.bottom + 4;
    setCoords({ top, left, width, openUpward, maxHeight });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const idx = Math.max(
      0,
      filtered.findIndex((o) => o.value === value)
    );
    setActiveIndex(idx);

    const frame = requestAnimationFrame(() => {
      if (showSearch) {
        searchInputRef.current?.focus();
      }
    });

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filtered.length === 0 ? 0 : (prev + 1) % filtered.length
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filtered.length === 0
            ? 0
            : (prev - 1 + filtered.length) % filtered.length
        );
      } else if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        onChange(filtered[activeIndex].value);
        setOpen(false);
        setSearch('');
        triggerRef.current?.focus();
      }
    };

    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered, activeIndex, showSearch, value]);

  const handleToggle = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      setSearch('');
    } else {
      setSearch('');
      setOpen(true);
    }
  };

  const heightClass = size === 'sm' ? 'h-8 text-[12px] px-2.5' : 'h-9 text-[13px] px-3';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={handleToggle}
        className={`studio-field-control w-full inline-flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${heightClass} ${className}`}
        style={{
          borderColor: open ? 'var(--st-text-secondary)' : undefined,
          boxShadow: open ? '0 0 0 3px var(--st-ring)' : undefined,
        }}
      >
        <span
          className="truncate flex-1"
          style={{
            color: selectedOption ? 'var(--st-text)' : 'var(--st-text-faint)',
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          style={{ color: 'var(--st-text-muted)' }}
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            className="sukoon-studio fixed z-[100] rounded-lg border overflow-hidden flex flex-col"
            role="listbox"
            style={{
              top: coords.openUpward ? undefined : coords.top,
              bottom: coords.openUpward ? window.innerHeight - coords.top : undefined,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              backgroundColor: 'var(--st-bg)',
              borderColor: 'var(--st-border)',
              boxShadow: 'var(--st-shadow-md)',
            }}
          >
            {showSearch && (
              <div
                className="p-1.5 border-b shrink-0"
                style={{
                  borderColor: 'var(--st-border)',
                  backgroundColor: 'var(--st-bg-subtle)',
                }}
              >
                <div className="relative">
                  <Search
                    className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--st-text-faint)' }}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder={searchPlaceholder}
                    className="studio-field-control w-full h-7 pl-7 pr-6 text-[12px]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setActiveIndex(0);
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 cursor-pointer"
                      style={{ color: 'var(--st-text-muted)' }}
                      aria-label="Clear filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-y-auto p-1 space-y-0.5 flex-1">
              {filtered.length === 0 ? (
                <div
                  className="py-5 text-center text-xs"
                  style={{ color: 'var(--st-text-muted)' }}
                >
                  No matches found
                </div>
              ) : (
                filtered.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === activeIndex;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setSearch('');
                        triggerRef.current?.focus();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-[5px] text-left flex items-center justify-between gap-2 text-[12.5px] cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--st-bg-active)'
                          : isHighlighted
                            ? 'var(--st-bg-hover)'
                            : undefined,
                        color: 'var(--st-text)',
                        fontWeight: isSelected ? 500 : 400,
                      }}
                    >
                      <span className="truncate flex-1">{opt.label}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {opt.meta && (
                          <span
                            className="text-[11px] font-mono tabular-nums"
                            style={{ color: 'var(--st-text-muted)' }}
                          >
                            {opt.meta}
                          </span>
                        )}
                        {isSelected && (
                          <Check
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: 'var(--st-accent)' }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function StudioSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-left cursor-pointer group"
    >
      <span
        className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-150"
        style={{
          backgroundColor: checked ? 'var(--st-accent)' : 'var(--st-border-strong)',
        }}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-150 mt-0.5 ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium" style={{ color: 'var(--st-text)' }}>
          {label}
        </span>
        {description && (
          <span className="block text-[11px]" style={{ color: 'var(--st-text-muted)' }}>
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

export function StudioSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 pb-2 border-b" style={{ borderColor: 'var(--st-border)' }}>
        <div>
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: 'var(--st-text-muted)' }}
          >
            {title}
          </h3>
          {description && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StudioEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <div
        className="w-11 h-11 rounded-xl border flex items-center justify-center mb-4"
        style={{
          backgroundColor: 'var(--st-bg-subtle)',
          borderColor: 'var(--st-border)',
          color: 'var(--st-text-muted)',
        }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--st-text)' }}>
        {title}
      </h3>
      <p
        className="text-xs mt-1 max-w-xs leading-relaxed"
        style={{ color: 'var(--st-text-muted)' }}
      >
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StudioConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="sukoon-studio fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 9, 11, 0.48)', backdropFilter: 'blur(4px)' }}
      onClick={() => !loading && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-xl border p-5 space-y-4"
        style={{
          backgroundColor: 'var(--st-bg)',
          borderColor: 'var(--st-border)',
          boxShadow: 'var(--st-shadow-md)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {destructive && (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: 'var(--st-danger-soft)',
                  color: 'var(--st-danger)',
                }}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--st-text)' }}>
                {title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--st-text-secondary)' }}>
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="p-1 rounded-md cursor-pointer"
            style={{ color: 'var(--st-text-muted)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--st-border)' }}>
          <StudioButton variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </StudioButton>
          <StudioButton
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </StudioButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Full-screen focused editor sheet overlay (covers viewport with sticky bar & optional preview) */
export function StudioEditorSheet({
  open,
  header,
  children,
  previewPane,
  showPreview = false,
}: {
  open: boolean;
  header: ReactNode;
  children: ReactNode;
  previewPane?: ReactNode;
  showPreview?: boolean;
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="sukoon-studio fixed inset-0 z-40 flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--st-bg)' }}
    >
      {header}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div
          className={`flex-1 min-w-0 overflow-y-auto ${
            showPreview && previewPane ? 'hidden xl:block' : 'block'
          }`}
        >
          {children}
        </div>
        {showPreview && previewPane}
      </div>
    </div>,
    document.body
  );
}

/** Lightweight centered modal for quick creation dialogs */
export function StudioModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  maxWidthClass = 'max-w-lg',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="sukoon-studio fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 9, 11, 0.48)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} rounded-xl border overflow-hidden flex flex-col max-h-[90dvh]`}
        style={{
          backgroundColor: 'var(--st-bg)',
          borderColor: 'var(--st-border)',
          boxShadow: 'var(--st-shadow-md)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 border-b flex items-start justify-between gap-3 shrink-0"
          style={{ borderColor: 'var(--st-border)' }}
        >
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            {description && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-muted)' }}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md cursor-pointer"
            style={{ color: 'var(--st-text-muted)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">{children}</div>

        {footer && (
          <div
            className="px-5 py-3.5 border-t flex items-center justify-end gap-2 shrink-0"
            style={{
              backgroundColor: 'var(--st-bg-subtle)',
              borderColor: 'var(--st-border)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Crisp KPI stat tile for Overview dashboard */
export function StudioMetricCard({
  label,
  value,
  sublabel,
  icon,
  loading = false,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: ReactNode;
  loading?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-4 space-y-2"
      style={{
        backgroundColor: 'var(--st-bg)',
        borderColor: 'var(--st-border)',
        boxShadow: 'var(--st-shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--st-text-secondary)' }}
        >
          {label}
        </span>
        <span style={{ color: 'var(--st-text-muted)' }}>{icon}</span>
      </div>
      {loading ? (
        <div
          className="h-7 w-20 rounded-[5px] animate-pulse"
          style={{ backgroundColor: 'var(--st-bg-muted)' }}
        />
      ) : (
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      )}
      {sublabel && (
        <p className="text-[11px]" style={{ color: 'var(--st-text-muted)' }}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

/** Shared non-redundant sticky top bar for all Studio editor sheets */
export function StudioEditorHeader({
  title,
  statusBadge,
  saving = false,
  isPublishedClean = false,
  onRevert,
  revertTitle = 'Revert to built-in default',
  onDelete,
  deleteTitle = 'Delete',
  onCancel,
  onSaveDraft,
  showPreview,
  onTogglePreview,
  onPublish,
}: {
  title: string;
  statusBadge?: { label: string; tone: StudioBadgeTone } | null;
  saving?: boolean;
  isPublishedClean?: boolean;
  onRevert?: () => void;
  revertTitle?: string;
  onDelete?: () => void;
  deleteTitle?: string;
  onCancel: () => void;
  onSaveDraft?: () => void;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  onPublish: () => void;
}) {
  return (
    <header
      className="h-[52px] px-4 sm:px-6 border-b flex items-center justify-between gap-3 shrink-0"
      style={{
        backgroundColor: 'var(--st-bg)',
        borderColor: 'var(--st-border)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13.5px] font-semibold tracking-tight truncate">
          {title}
        </span>
        {statusBadge && (
          <StudioBadge tone={statusBadge.tone} dot>
            {statusBadge.label}
          </StudioBadge>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onRevert && (
          <StudioButton
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={onRevert}
            title={revertTitle}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </StudioButton>
        )}

        {onDelete && (
          <StudioButton
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={onDelete}
            style={{ color: 'var(--st-danger)' }}
            title={deleteTitle}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </StudioButton>
        )}

        <StudioButton
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </StudioButton>

        {onSaveDraft && (
          <StudioButton
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={onSaveDraft}
          >
            <FilePenLine className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save Draft</span>
          </StudioButton>
        )}

        {onTogglePreview && (
          <StudioButton
            variant="secondary"
            size="sm"
            onClick={onTogglePreview}
            style={
              showPreview
                ? {
                    backgroundColor: 'var(--st-bg-active)',
                    borderColor: 'var(--st-border-strong)',
                  }
                : undefined
            }
            title="Toggle live Sukoon preview"
          >
            {showPreview ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Preview</span>
          </StudioButton>
        )}

        <StudioButton
          variant={isPublishedClean ? 'secondary' : 'primary'}
          size="sm"
          loading={saving}
          onClick={onPublish}
          style={
            isPublishedClean
              ? {
                  color: 'var(--st-accent)',
                  borderColor:
                    'color-mix(in srgb, var(--st-accent) 35%, var(--st-border))',
                }
              : undefined
          }
        >
          {!saving &&
            (isPublishedClean ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            ))}
          <span>{isPublishedClean ? 'Published' : 'Publish'}</span>
        </StudioButton>
      </div>
    </header>
  );
}

/** Triggers onSave when user presses Ctrl+S / Cmd+S */
export function useKeyboardSave(enabled: boolean, onSave: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onSave]);
}
