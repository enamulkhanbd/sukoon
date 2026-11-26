import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  Loader2,
  LogOut,
  RefreshCw,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import {
  ensureCloudAuthReady,
  signInWithGoogleForSync,
  signOutCloudSync,
  triggerManualCloudSync,
  useCloudSyncState,
} from '../services/cloudSyncService';
import { formatRelativeTimeBn } from '../utils/formatters';
import type { AppTab } from './BottomNav';
import { TwoLineMenuButton } from './NavigationChrome';
import { SukoonLogo } from './SukoonLogo';
import { useToast } from './ToastProvider';

interface AppMenuDrawerProps {
  open: boolean;
  activeTab: AppTab;
  onClose: () => void;
  onSelectProfile: (options?: { replaceHistory?: boolean }) => void;
  onSelectSettings: (options?: { reuseOverlayHistory?: boolean }) => void;
}

function GoogleBrandIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.07A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.31a7.18 7.18 0 0 1 0-4.62V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.99-3.07Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l3.99 3.07c.95-2.85 3.6-4.94 6.72-4.94Z"
      />
    </svg>
  );
}

export function AppMenuDrawer({
  open,
  activeTab,
  onClose,
  onSelectProfile,
  onSelectSettings,
}: AppMenuDrawerProps) {
  const toast = useToast();
  const cloud = useCloudSyncState();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pushedHistoryRef = useRef(false);

  const dismissDrawer = useCallback(() => {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      onClose();
      window.history.back();
      return;
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      void ensureCloudAuthReady();
      return;
    }
    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, 340);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    let cancelled = false;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      if (cancelled) return;
      void panelRef.current?.offsetWidth;
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

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    try {
      window.history.pushState(
        { sukoonMenuDrawer: true },
        '',
        window.location.href
      );
      pushedHistoryRef.current = true;
    } catch {
      pushedHistoryRef.current = false;
    }

    const handlePopState = () => {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissDrawer();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, dismissDrawer]);

  const handleNavigateProfile = () => {
    const hadHistory = pushedHistoryRef.current;
    pushedHistoryRef.current = false;
    onClose();
    if (activeTab === 'profile') {
      if (hadHistory) window.history.back();
      return;
    }
    onSelectProfile({ replaceHistory: hadHistory });
  };

  const handleNavigateSettings = () => {
    const hadHistory = pushedHistoryRef.current;
    pushedHistoryRef.current = false;
    onClose();
    onSelectSettings({ reuseOverlayHistory: hadHistory });
  };

  const handleGoogleSignIn = async () => {
    const res = await signInWithGoogleForSync();
    if (res.ok) {
      toast.success('Gmail সংযুক্ত হয়েছে • ডেটা সিংক হচ্ছে');
    } else if (!res.cancelled && res.error) {
      toast.error(res.error);
    }
  };

  const handleManualSync = async () => {
    const ok = await triggerManualCloudSync();
    if (ok) {
      toast.success('ক্লাউড সিংক সম্পন্ন হয়েছে');
    } else if (cloud.error) {
      toast.warning(cloud.error);
    }
  };

  const handleSignOut = async () => {
    await signOutCloudSync();
    toast.info('লগআউট করা হয়েছে • আপনার লোকাল ডেটা ডিভাইসে সুরক্ষিত আছে');
  };

  if (!mounted) return null;

  const isProfileActive = activeTab === 'profile';
  const userInitial =
    cloud.user?.displayName?.trim()?.[0]?.toUpperCase() ||
    cloud.user?.email?.trim()?.[0]?.toUpperCase() ||
    'U';

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end backdrop-blur-[2px] sukoon-sheet-backdrop ${
        visible ? '' : 'pointer-events-none'
      }`}
      style={{
        opacity: visible ? 1 : 0,
        backgroundColor: 'var(--backdrop-scrim)',
      }}
      onClick={dismissDrawer}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="সুকূন মেনু"
        onClick={(e) => e.stopPropagation()}
        className="w-[86vw] max-w-[340px] h-dvh flex flex-col justify-between overflow-hidden sukoon-sheet-panel sukoon-glass-sheet border-l"
        style={{
          borderColor: 'var(--glass-border)',
          borderTop: 'none',
          borderRight: 'none',
          transform: visible
            ? 'translate3d(0, 0, 0)'
            : 'translate3d(100%, 0, 0)',
        }}
      >
        {/* Top Header + Navigation Items */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div
            className="safe-top border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3">
              <SukoonLogo />
              <TwoLineMenuButton
                open={visible}
                onClick={dismissDrawer}
                label="মেনু বন্ধ করুন"
              />
            </div>
          </div>

          <nav aria-label="মেনু নেভিগেশন" className="px-4 py-4 space-y-1.5">
            <button
              type="button"
              onClick={handleNavigateProfile}
              aria-current={isProfileActive ? 'page' : undefined}
              className="w-full rounded-2xl px-3.5 py-3 flex items-center justify-between gap-3 text-left transition-colors active:scale-[0.99] cursor-pointer group"
              style={{
                backgroundColor: isProfileActive
                  ? 'var(--accent-soft)'
                  : 'transparent',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isProfileActive
                      ? 'var(--accent)'
                      : 'var(--bg-surface)',
                    color: isProfileActive
                      ? 'var(--accent-text)'
                      : 'var(--accent)',
                  }}
                >
                  <User className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">
                    প্রোফাইল
                  </div>
                  <div
                    className="text-[11px] truncate mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    পরিসংখ্যান, ধারাবাহিকতা ও রোজা-ওয়াক্ত
                  </div>
                </div>
              </div>
              <ChevronRight
                className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: 'var(--text-muted)' }}
              />
            </button>

            <button
              type="button"
              onClick={handleNavigateSettings}
              className="w-full rounded-2xl px-3.5 py-3 flex items-center justify-between gap-3 text-left transition-colors active:scale-[0.99] cursor-pointer group"
              style={{ backgroundColor: 'transparent' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--accent)',
                  }}
                >
                  <SettingsIcon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">
                    সেটিংস
                  </div>
                  <div
                    className="text-[11px] truncate mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    থিম, অক্ষরের আকার, অফলাইন ও ব্যাকআপ
                  </div>
                </div>
              </div>
              <ChevronRight
                className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: 'var(--text-muted)' }}
              />
            </button>
          </nav>
        </div>

        {/* Pinned Bottom Optional Gmail Login & Cloud Sync */}
        <div
          className="shrink-0 px-4 pt-3.5 pb-4 border-t safe-bottom"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="rounded-2xl p-3.5 border space-y-3"
            style={{
              backgroundColor: cloud.user
                ? 'var(--bg-elevated)'
                : 'color-mix(in srgb, var(--accent) 5%, var(--bg-elevated))',
              borderColor: cloud.user
                ? 'var(--border-subtle)'
                : 'color-mix(in srgb, var(--accent) 20%, var(--border-subtle))',
            }}
          >
            {cloud.user ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  {cloud.user.photoURL ? (
                    <img
                      src={cloud.user.photoURL}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover shrink-0 border"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    />
                  ) : (
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                      }}
                    >
                      {userInitial}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">
                        {cloud.user.displayName || 'সুকূন ব্যবহারকারী'}
                      </span>
                      <CheckCircle2
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: 'var(--accent)' }}
                      />
                    </div>
                    <p
                      className="text-[11px] truncate"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {cloud.user.email}
                    </p>
                  </div>
                </div>

                <div
                  className="text-[11px] flex items-center justify-between gap-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="truncate">
                    {cloud.syncing
                      ? 'ক্লাউডে সিংক হচ্ছে...'
                      : cloud.lastSyncedAt
                        ? `সর্বশেষ সিংক: ${formatRelativeTimeBn(cloud.lastSyncedAt)}`
                        : 'স্বয়ংক্রিয় ক্লাউড সিংক সক্রিয়'}
                  </span>
                </div>

                {cloud.error && (
                  <p
                    className="text-[11px] leading-snug"
                    style={{ color: 'var(--danger)' }}
                  >
                    {cloud.error}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={cloud.syncing}
                    onClick={() => void handleManualSync()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-60 transition-opacity active:opacity-85"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${cloud.syncing ? 'animate-spin' : ''}`}
                    />
                    <span>এখনই সিংক করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    aria-label="লগআউট করুন"
                    title="লগআউট (লোকাল ডেটা সংরক্ষিত থাকবে)"
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border cursor-pointer transition-opacity active:opacity-80 shrink-0"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>লগআউট</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Cloud className="w-[18px] h-[18px]" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-[13px] font-semibold leading-tight">
                        আপনার আমল সুরক্ষিত রাখুন
                      </h3>
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent)',
                        }}
                      >
                        ঐচ্ছিক
                      </span>
                    </div>
                    <p
                      className="text-[11.5px] leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ফোন বদলালেও যেন আপনার নিজের দুআ, রুটিন ও আমলের ধারাবাহিকতা হারিয়ে না যায়—Gmail দিয়ে নিরাপদ ক্লাউড ব্যাকআপ চালু রাখুন।
                    </p>
                  </div>
                </div>

                {cloud.error && (
                  <p
                    className="text-[11px] leading-snug"
                    style={{ color: 'var(--danger)' }}
                  >
                    {cloud.error}
                  </p>
                )}

                {cloud.configured ? (
                  <button
                    type="button"
                    disabled={cloud.signingIn}
                    onClick={() => void handleGoogleSignIn()}
                    className="w-full py-2.5 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60 shadow-xs"
                    style={{
                      backgroundColor: 'var(--bg-page)',
                      borderColor: 'color-mix(in srgb, var(--accent) 22%, var(--border-subtle))',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {cloud.signingIn ? (
                      <Loader2
                        className="w-4 h-4 animate-spin"
                        style={{ color: 'var(--accent)' }}
                      />
                    ) : (
                      <GoogleBrandIcon />
                    )}
                    <span>
                      {cloud.signingIn
                        ? 'সংযুক্ত হচ্ছে...'
                        : 'Gmail দিয়ে সিংক চালু করুন'}
                    </span>
                  </button>
                ) : (
                  <p
                    className="text-[11px] text-center py-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    এই ডিভাইসে অফলাইন মোড সক্রিয় রয়েছে।
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
