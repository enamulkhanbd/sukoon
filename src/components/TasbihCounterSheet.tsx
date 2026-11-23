import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Minus,
  RotateCcw,
  X,
} from 'lucide-react';
import { toBanglaDigits } from '../utils/formatters';
import { useBottomSheet } from './NavigationChrome';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export interface TasbihCounterSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  count: number;
  target: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  nextActionLabel?: string | null;
  onNextAction?: () => void;
}

const RING_SIZE = 148;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Non-blocking half-screen Tasbih counter bottom sheet.
 * Leaves the upper half of the viewport bright and scrollable so users can
 * read the Dua while tapping anywhere on the large lower surface.
 */
export function TasbihCounterSheet({
  open,
  onClose,
  title,
  count,
  target,
  onIncrement,
  onDecrement,
  onReset,
  nextActionLabel,
  onNextAction,
}: TasbihCounterSheetProps) {
  const {
    mounted,
    visible,
    dragging,
    panelRef,
    panelTransform,
    dragHandleProps,
  } = useBottomSheet(open, onClose);

  const tapZoneRef = useRef<HTMLButtonElement | null>(null);
  const rippleIdRef = useRef(0);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const done = count >= target;
  const progress = Math.min(1, target > 0 ? count / target : 0);
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
  const extraCount = count > target ? count - target : 0;

  const spawnRipple = useCallback((x: number, y: number) => {
    const id = ++rippleIdRef.current;
    setRipples((prev) => [...prev.slice(-3), { id, x, y }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 540);
  }, []);

  const triggerIncrement = useCallback(
    (x?: number, y?: number) => {
      const el = tapZoneRef.current;
      if (x !== undefined && y !== undefined) {
        spawnRipple(x, y);
      } else if (el) {
        const rect = el.getBoundingClientRect();
        spawnRipple(rect.width / 2, rect.height / 2);
      }
      onIncrement();
    },
    [onIncrement, spawnRipple]
  );

  const handleTapClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Keyboard Enter/Space on focused button produces clientX === 0 && clientY === 0
    if (e.clientX === 0 && e.clientY === 0) {
      triggerIncrement(rect.width / 2, rect.height / 2);
    } else {
      triggerIncrement(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  // Keyboard shortcuts while sheet is open: Space increments, Escape closes
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        const targetEl = e.target as HTMLElement | null;
        if (
          targetEl &&
          targetEl.closest('input, textarea, select')
        ) {
          return;
        }
        // If another button (e.g. Undo / Reset / Close / Next) is focused, let it handle Space normally
        if (
          targetEl &&
          targetEl !== tapZoneRef.current &&
          targetEl.closest('button, a')
        ) {
          return;
        }
        e.preventDefault();
        triggerIncrement();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, triggerIncrement]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none sm:px-4"
      role="dialog"
      aria-modal="false"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className={`w-full sm:max-w-2xl h-[50dvh] min-h-[300px] max-h-[460px] rounded-t-[28px] flex flex-col overflow-hidden sukoon-sheet-panel sukoon-glass-sheet safe-bottom ${
          visible ? 'pointer-events-auto' : 'pointer-events-none'
        } ${dragging ? 'sukoon-sheet-panel--dragging' : ''}`}
        style={{
          transform: panelTransform,
        }}
      >
        {/* Top drag grabber + compact controls header */}
        <div
          {...dragHandleProps}
          className="px-4 pt-2.5 pb-2 select-none shrink-0"
          style={{ touchAction: 'none' }}
        >
          <div
            className="w-9 h-1 rounded-full mx-auto mb-2.5 opacity-45"
            style={{ backgroundColor: 'var(--text-muted)' }}
          />
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm truncate min-w-0">{title}</h2>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onDecrement}
                disabled={count === 0}
                aria-label="একটি কমান"
                title="একটি কমান (-১)"
                className="h-8 px-2.5 rounded-full flex items-center justify-center gap-0.5 text-xs font-medium transition-colors active:scale-95 cursor-pointer disabled:opacity-35 disabled:cursor-default"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Minus className="w-3 h-3" />
                <span>১</span>
              </button>

              <button
                type="button"
                onClick={onReset}
                disabled={count === 0}
                aria-label="গণনা রিসেট"
                title="রিসেট"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer disabled:opacity-35 disabled:cursor-default"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="বন্ধ করুন"
                title="বন্ধ করুন"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Large interactive tonal tap surface */}
        <div className="px-4 pb-2 flex-1 flex flex-col gap-2.5 min-h-0">
          <button
            ref={tapZoneRef}
            type="button"
            onClick={handleTapClick}
            aria-label={`জিকির গণনা +১, বর্তমান ${toBanglaDigits(count)} বার`}
            className="w-full flex-1 min-h-0 rounded-3xl relative overflow-hidden flex flex-col items-center justify-center gap-2 select-none cursor-pointer transition-colors active:scale-[0.992] border"
            style={{
              touchAction: 'manipulation',
              backgroundColor: done
                ? 'var(--accent-soft)'
                : 'color-mix(in srgb, var(--bg-surface) 64%, transparent)',
              borderColor: 'var(--glass-border)',
            }}
          >
            {/* Tap ripples */}
            {ripples.map((r) => (
              <span
                key={r.id}
                aria-hidden="true"
                className="pointer-events-none absolute w-40 h-40 rounded-full sukoon-tasbih-ripple"
                style={{
                  left: r.x,
                  top: r.y,
                  backgroundColor: 'var(--accent)',
                }}
              />
            ))}

            {/* Circular Progress Ring + Large Count */}
            <div className="relative flex items-center justify-center">
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                className="-rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth={RING_STROKE}
                />
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  style={{
                    transition: 'stroke-dashoffset 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span
                  key={count}
                  className="text-5xl font-semibold tabular-nums leading-none sukoon-count-pop"
                  style={{
                    color: done ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  {toBanglaDigits(count)}
                </span>
                <span
                  className="text-xs font-medium mt-1.5"
                  style={{
                    color: extraCount > 0 ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {extraCount > 0
                    ? `+${toBanglaDigits(extraCount)} অতিরিক্ত`
                    : `/ ${toBanglaDigits(target)}`}
                </span>
              </div>
            </div>

            {/* Status / Tap hint */}
            {done ? (
              <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  মাশাআল্লাহ! লক্ষ্য সম্পন্ন
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  চাইলে আরও গণনা করতে ট্যাপ করুন
                </span>
              </div>
            ) : (
              <span
                className="text-xs pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>ট্যাপ করে গণনা করুন</span>
                <span className="hidden sm:inline"> • Space চাপুন</span>
              </span>
            )}
          </button>

          {/* Contextual progression button when target reached (multi-part or routine) */}
          {done && nextActionLabel && onNextAction && (
            <button
              type="button"
              onClick={onNextAction}
              className="w-full py-2.5 px-4 rounded-2xl text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-[0.99] cursor-pointer shrink-0"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-text)',
              }}
            >
              <span>{nextActionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
