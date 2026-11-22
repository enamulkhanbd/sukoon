import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface ToastOptions {
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
  success: (message: string, durationMs?: number) => void;
  warning: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CONFIG: Record<
  ToastVariant,
  {
    icon: typeof CheckCircle2;
    borderColor: string;
    iconColor: string;
    badgeBg: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    borderColor: 'var(--accent)',
    iconColor: 'var(--accent)',
    badgeBg: 'var(--accent-soft)',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'var(--gold)',
    iconColor: 'var(--gold)',
    badgeBg: 'var(--gold-soft)',
  },
  error: {
    icon: XCircle,
    borderColor: 'var(--danger)',
    iconColor: 'var(--danger)',
    badgeBg: 'var(--danger-soft)',
  },
  info: {
    icon: Info,
    borderColor: 'var(--border-subtle)',
    iconColor: 'var(--text-secondary)',
    badgeBg: 'var(--bg-surface)',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextIdRef.current++;
      const variant: ToastVariant = options?.variant ?? 'info';
      const durationMs = options?.durationMs ?? 2800;

      setToasts((prev) => [...prev.slice(-2), { id, message, variant }]);

      const timer = window.setTimeout(() => {
        dismiss(id);
      }, durationMs);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message, durationMs) =>
        showToast(message, { variant: 'success', durationMs }),
      warning: (message, durationMs) =>
        showToast(message, { variant: 'warning', durationMs }),
      error: (message, durationMs) =>
        showToast(message, { variant: 'error', durationMs }),
      info: (message, durationMs) =>
        showToast(message, { variant: 'info', durationMs }),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed top-3 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none safe-top"
        >
          {toasts.map((t) => {
            const cfg = VARIANT_CONFIG[t.variant];
            const Icon = cfg.icon;
            return (
              <div
                key={t.id}
                role="status"
                className="pointer-events-auto w-full max-w-md flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl sukoon-glass-pill text-xs font-medium transition-all"
                style={{
                  borderColor: cfg.borderColor,
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cfg.badgeBg, color: cfg.iconColor }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 leading-snug">{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="বন্ধ করুন"
                  className="p-1 rounded-full shrink-0 cursor-pointer outline-none"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
