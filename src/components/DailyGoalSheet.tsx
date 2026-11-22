import { useEffect, useState } from 'react';
import { Check, Target, X } from 'lucide-react';
import { toBanglaDigits } from '../utils/formatters';
import { useBottomSheet } from './NavigationChrome';

export const DAILY_GOAL_PRESETS = [10, 15, 20, 30, 45, 60] as const;

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

function parseMinutesInput(raw: string): number | null {
  const normalized = raw
    .trim()
    .replace(/[০-৯]/g, (ch) => BANGLA_DIGIT_MAP[ch] ?? ch);
  if (!/^\d+$/.test(normalized)) return null;
  const val = Number.parseInt(normalized, 10);
  if (!Number.isFinite(val) || val < 1 || val > 360) return null;
  return val;
}

interface DailyGoalSheetProps {
  open: boolean;
  onClose: () => void;
  currentGoalMinutes: number;
  onSave: (minutes: number) => Promise<void> | void;
}

export function DailyGoalSheet({
  open,
  onClose,
  currentGoalMinutes,
  onSave,
}: DailyGoalSheetProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(
    currentGoalMinutes > 0 ? currentGoalMinutes : 15
  );
  const [customInput, setCustomInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
    setSelectedMinutes(currentGoalMinutes > 0 ? currentGoalMinutes : 15);
    setCustomInput(
      currentGoalMinutes > 0 &&
        !(DAILY_GOAL_PRESETS as readonly number[]).includes(currentGoalMinutes)
        ? String(currentGoalMinutes)
        : ''
    );
    setError(null);

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
  }, [open, currentGoalMinutes, onClose]);

  if (!mounted) return null;

  const handleConfirm = async () => {
    let target = selectedMinutes;
    if (customInput.trim().length > 0) {
      const parsed = parseMinutesInput(customInput);
      if (parsed === null) {
        setError('১ থেকে ৩৬০ মিনিটের মধ্যে একটি সংখ্যা লিখুন।');
        return;
      }
      target = parsed;
    }
    await onSave(target);
    onClose();
  };

  const handleDisable = async () => {
    await onSave(0);
    onClose();
  };

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
        aria-label="দৈনিক তিলাওয়াত লক্ষ্য নির্ধারণ"
        className={`w-full sm:max-w-md rounded-t-[28px] max-h-[85dvh] overflow-y-auto sukoon-sheet-panel sukoon-glass-sheet safe-bottom ${
          dragging ? 'sukoon-sheet-panel--dragging' : ''
        }`}
        style={{
          transform: panelTransform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber & Header */}
        <div
          {...dragHandleProps}
          className="px-5 pt-2.5 pb-2 select-none"
          style={{ touchAction: 'none' }}
        >
          <div
            className="w-9 h-1 rounded-full mx-auto mb-3 opacity-45"
            style={{ backgroundColor: 'var(--text-muted)' }}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-semibold text-base">দৈনিক কুরআন তিলাওয়াত লক্ষ্য</h2>
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

        <div className="p-5 space-y-5">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            প্রতিদিন (মাগরিব থেকে পরের মাগরিব) কত মিনিট কুরআন তিলাওয়াত করতে চান তা নির্ধারণ করুন। কুরআন রিডারে সক্রিয় পাঠের সময় স্বয়ংক্রিয়ভাবে হিসাব হবে।
          </p>

          {/* Preset Minute Options */}
          <div className="space-y-2">
            <span className="text-xs font-medium block">দ্রুত নির্বাচন</span>
            <div className="grid grid-cols-3 gap-2">
              {DAILY_GOAL_PRESETS.map((mins) => {
                const active =
                  customInput.trim().length === 0 && selectedMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setSelectedMinutes(mins);
                      setCustomInput('');
                      setError(null);
                    }}
                    className="py-2.5 px-3 rounded-2xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                    style={{
                      backgroundColor: active
                        ? 'var(--accent)'
                        : 'var(--bg-surface)',
                      color: active ? 'var(--accent-text)' : 'var(--text-primary)',
                    }}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    <span>{toBanglaDigits(mins)} মিনিট</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Minutes Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="custom-goal-minutes"
              className="text-xs font-medium block"
            >
              অথবা নিজের পছন্দমতো মিনিট লিখুন
            </label>
            <div className="flex items-center gap-2">
              <input
                id="custom-goal-minutes"
                type="text"
                inputMode="numeric"
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value);
                  setError(null);
                }}
                placeholder="যেমন: ২৫ বা ৯০"
                className="flex-1 px-3.5 py-2.5 rounded-2xl text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: error ? 'inset 0 0 0 1px var(--danger)' : undefined,
                  color: 'var(--text-primary)',
                }}
              />
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                মিনিট / দিন
              </span>
            </div>
            {error && (
              <p className="text-[11px]" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-1">
            {currentGoalMinutes > 0 && (
              <button
                type="button"
                onClick={handleDisable}
                className="px-4 py-2.5 rounded-2xl text-xs font-medium cursor-pointer transition-opacity active:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                লক্ষ্য বন্ধ করুন
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2.5 px-4 rounded-2xl text-xs font-medium cursor-pointer transition-opacity active:opacity-85"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-text)',
              }}
            >
              লক্ষ্য সংরক্ষণ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
