import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck2,
  Check,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Palette,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  db,
  normalizeThemeSettings,
  type ColorMode,
  type ThemeMode,
} from '../../db/database';
import {
  resetCmsSyncCursorsAndResync,
  useCmsSyncStatus,
} from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
import {
  ADMIN_EMAIL,
  isAuthorizedAdminEmail,
  isFirebaseConfigured,
  loadFirebaseAuth,
} from '../../services/firebase';
import type { AdminSection } from '../../router';
import { getThemeVariantMeta } from '../../utils/themeRegistry';
import { SukoonEmblem, SukoonLogo } from '../SukoonLogo';
import { useToast } from '../ToastProvider';
import type { DraftScope } from './adminDrafts';
import { AdminChaptersTab } from './AdminChaptersTab';
import { AdminDuasTab } from './AdminDuasTab';
import { AdminFeaturedTab } from './AdminFeaturedTab';
import { AdminOverviewTab } from './AdminOverviewTab';
import { AdminRoutinesTab } from './AdminRoutinesTab';
import { AdminSurahsTab } from './AdminSurahsTab';

type AdminTab = AdminSection;

export interface StudioLaunchIntent {
  tab: Exclude<AdminTab, 'overview'>;
  mode: 'new' | 'edit';
  id?: string;
  nonce: number;
}

interface AdminPanelViewProps {
  section: AdminSection;
  onNavigateSection: (section: AdminSection) => void;
  onExitAdmin: () => void;
}

interface AuthUserSummary {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string }> = [
  { id: 'paper', label: 'Paper' },
  { id: 'olive', label: 'Olive' },
  { id: 'sky', label: 'Sky' },
];

export default function AdminPanelView({
  section,
  onNavigateSection,
  onExitAdmin,
}: AdminPanelViewProps) {
  const toast = useToast();
  const catalog = useCatalog();
  const syncStatus = useCmsSyncStatus();
  const rawSettings = useLiveQuery(() => db.settings.get('app'), []);
  const { theme: activeTheme, colorMode: activeMode } = normalizeThemeSettings(
    rawSettings?.theme,
    rawSettings?.colorMode
  );

  const tab = section;
  const setTab = onNavigateSection;
  const [launchIntent, setLaunchIntent] = useState<StudioLaunchIntent | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [themePopoverOpen, setThemePopoverOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  const configured = isFirebaseConfigured();

  const updateStudioTheme = async (patch: {
    theme?: ThemeMode;
    colorMode?: ColorMode;
  }) => {
    const existing = await db.settings.get('app');
    if (existing) {
      await db.settings.update('app', patch);
    } else {
      await db.settings.put({ ...DEFAULT_SETTINGS, ...patch });
    }
  };

  useEffect(() => {
    if (!themePopoverOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el?.closest('[data-studio-theme-popover]')) {
        setThemePopoverOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setThemePopoverOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [themePopoverOpen]);

  useEffect(() => {
    if (!configured) {
      setAuthLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const loaded = await loadFirebaseAuth();
        if (!loaded || cancelled) {
          setAuthLoading(false);
          return;
        }
        const { auth, authModule } = loaded;
        try {
          await authModule.getRedirectResult(auth);
        } catch {
          // Ignore redirect errors if none pending
        }

        unsubscribe = authModule.onAuthStateChanged(auth, async (fbUser) => {
          if (cancelled) return;
          if (!fbUser) {
            setUser(null);
            setAuthLoading(false);
            return;
          }
          if (!isAuthorizedAdminEmail(fbUser.email)) {
            const rejected = fbUser.email ?? 'Unknown email';
            setDeniedEmail(rejected);
            setUser(null);
            setAuthLoading(false);
            try {
              await authModule.signOut(auth);
            } catch {
              // Ignore signout cleanup error
            }
            return;
          }
          setDeniedEmail(null);
          setUser({
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
          });
          setAuthLoading(false);
        });
      } catch {
        if (!cancelled) setAuthLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [configured]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setDeniedEmail(null);
    try {
      const loaded = await loadFirebaseAuth();
      if (!loaded) {
        toast.error('Firebase is not configured.');
        return;
      }
      const { auth, authModule } = loaded;
      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
        login_hint: ADMIN_EMAIL,
      });
      try {
        await authModule.signInWithPopup(auth, provider);
      } catch (err: unknown) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment'
        ) {
          await authModule.signInWithRedirect(auth, provider);
          return;
        }
        if (code === 'auth/popup-closed-by-user') {
          return;
        }
        throw err;
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[AdminAuth]', err);
      }
      toast.error('Sign-in could not be completed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const loaded = await loadFirebaseAuth();
      if (loaded) {
        await loaded.authModule.signOut(loaded.auth);
      }
      setUser(null);
      toast.info('Signed out of Sukoon Studio.');
    } catch {
      toast.error('Could not sign out.');
    }
  };

  // 1. Service Unavailable Screen (never expose internal env/stack details in production)
  if (!configured) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center p-5"
        style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
      >
        <div
          className="w-full max-w-sm rounded-3xl border p-6 space-y-5 text-center"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex justify-center">
            <SukoonLogo />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-base font-semibold">এই পেজটি বর্তমানে উপলব্ধ নয়</h1>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {import.meta.env.DEV
                ? 'লোকাল এনভায়রনমেন্ট লোড হয়নি। .env.local সেট করে dev server রিস্টার্ট করুন।'
                : 'অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা মূল অ্যাপে ফিরে যান।'}
            </p>
          </div>
          <button
            type="button"
            onClick={onExitAdmin}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity active:opacity-80"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            মূল অ্যাপে ফিরে যান
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading Auth State
  if (authLoading) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center gap-3"
        style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          অ্যাডমিন সেশন যাচাই হচ্ছে...
        </p>
      </div>
    );
  }

  // 3. Auth Gate (Strictly locked to anamul.ipa@gmail.com)
  if (!user) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center p-5"
        style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
      >
        <div
          className="w-full max-w-sm rounded-3xl border p-6 space-y-5 text-center"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex justify-center">
            <SukoonLogo />
          </div>

          <div className="space-y-1.5">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              সুকূন অ্যাডমিন প্যানেল
            </div>
            <h1 className="text-lg font-semibold">অ্যাডমিন সাইন-ইন</h1>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              কেবল অনুমোদিত অ্যাডমিন অ্যাকাউন্ট দিয়েই কন্টেন্ট পাবলিশ ও এডিট করা যাবে।
            </p>
          </div>

          {deniedEmail && (
            <div
              className="rounded-2xl p-3 text-left text-xs flex items-start gap-2.5 border"
              style={{
                backgroundColor: 'var(--danger-soft)',
                borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
                color: 'var(--danger)',
              }}
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">অনুমোদিত নয়</p>
                <p className="mt-0.5 opacity-90">
                  <strong>{deniedEmail}</strong> অ্যাকাউন্টটির অ্যাডমিন অ্যাক্সেস নেই।
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={() => void handleGoogleSignIn()}
            className="w-full py-2.5 px-4 rounded-full text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-opacity active:opacity-85"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
            Google দিয়ে সাইন-ইন করুন
          </button>

          <button
            type="button"
            onClick={onExitAdmin}
            className="inline-flex items-center gap-1 text-xs font-medium cursor-pointer transition-opacity active:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            মূল অ্যাপে ফিরে যান
          </button>
        </div>
      </div>
    );
  }

  const remoteDuasCount = Object.keys(catalog.remoteDuasMap).length;
  const remoteTemplatesCount = catalog.routineTemplates.length;
  const remoteSurahCount = Object.keys(catalog.remoteSurahOverridesMap).length;
  const remoteFeaturedCount = catalog.featuredCards.length;

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: typeof ScrollText;
    count?: number;
    accentCount?: number;
  }> = [
      {
        id: 'overview',
        label: 'Overview',
        icon: LayoutDashboard,
      },
      {
        id: 'duas',
        label: 'Duas',
        icon: ScrollText,
        count: catalog.duas.length,
        accentCount: remoteDuasCount,
      },
      {
        id: 'chapters',
        label: 'Chapters',
        icon: FolderOpen,
        count: catalog.chapters.length,
      },
      {
        id: 'routines',
        label: 'Routines',
        icon: CalendarCheck2,
        count: remoteTemplatesCount,
      },
      {
        id: 'surahs',
        label: 'Surahs',
        icon: BookOpen,
        count: 114,
        accentCount: remoteSurahCount,
      },
      {
        id: 'featured',
        label: 'Spotlight',
        icon: Sparkles,
        count: remoteFeaturedCount,
      },
    ];

  const handleNewDua = () => {
    setTab('duas');
    setLaunchIntent({ tab: 'duas', mode: 'new', nonce: Date.now() });
  };

  const handleResumeDraft = (scope: DraftScope, id: string) => {
    setTab(scope);
    setLaunchIntent({ tab: scope, mode: 'edit', id, nonce: Date.now() });
  };

  const clearLaunchIntent = () => setLaunchIntent(null);

  const activeNav = navItems.find((n) => n.id === tab);
  const userInitial = (user.displayName || user.email || 'A').charAt(0).toUpperCase();

  const sidebarContent = (
    <div className="h-full flex flex-col">
      {/* Brand Row */}
      <div
        className="h-[52px] px-3.5 border-b flex items-center shrink-0"
        style={{ borderColor: 'var(--st-border)' }}
      >
        <SukoonLogo className="h-7 w-auto" />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-5">
        <nav className="space-y-0.5" aria-label="Studio sections">
          <p
            className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: 'var(--st-text-faint)' }}
          >
            Content
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setMobileNavOpen(false);
                }}
                className="studio-hover w-full h-8 px-2.5 rounded-[6px] flex items-center justify-between gap-2 text-[13px] cursor-pointer transition-colors"
                style={{
                  backgroundColor: active ? 'var(--st-bg-active)' : undefined,
                  color: active ? 'var(--st-text)' : 'var(--st-text-secondary)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{
                      color: active ? 'var(--st-text)' : 'var(--st-text-muted)',
                    }}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span className="flex items-center gap-1.5 shrink-0">
                    {item.accentCount !== undefined && item.accentCount > 0 && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: 'var(--st-accent)' }}
                        title={`${item.accentCount} remote`}
                      />
                    )}
                    <span
                      className="text-[11px] tabular-nums"
                      style={{
                        color: active ? 'var(--st-text-secondary)' : 'var(--st-text-faint)',
                      }}
                    >
                      {item.count}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: Account, Sync & Theme Picker */}
      <div
        className="p-2.5 border-t shrink-0 relative"
        style={{ borderColor: 'var(--st-border)' }}
        data-studio-theme-popover
      >
        {themePopoverOpen && (
          <div
            className="absolute bottom-[calc(100%+6px)] left-2.5 right-2.5 rounded-lg border p-3 space-y-3 z-50"
            style={{
              backgroundColor: 'var(--st-bg)',
              borderColor: 'var(--st-border)',
              boxShadow: 'var(--st-shadow-md)',
            }}
          >
            <div className="space-y-1.5">
              <p
                className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: 'var(--st-text-muted)' }}
              >
                Theme
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {THEME_OPTIONS.map((opt) => {
                  const meta = getThemeVariantMeta(opt.id, activeMode);
                  const selected = activeTheme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => void updateStudioTheme({ theme: opt.id })}
                      className="px-2 py-1.5 rounded-[6px] border flex flex-col items-center gap-1 text-[11px] font-medium cursor-pointer transition-colors"
                      style={{
                        backgroundColor: selected
                          ? 'var(--st-bg-active)'
                          : 'var(--st-bg-subtle)',
                        borderColor: selected
                          ? 'var(--st-accent)'
                          : 'var(--st-border)',
                        color: 'var(--st-text)',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full border flex items-center justify-center"
                        style={{
                          backgroundColor: meta.swatchBg,
                          borderColor: meta.swatchAccent,
                        }}
                      >
                        {selected ? (
                          <Check
                            className="w-2.5 h-2.5"
                            style={{ color: meta.swatchAccent }}
                          />
                        ) : (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: meta.swatchAccent }}
                          />
                        )}
                      </span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p
                className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: 'var(--st-text-muted)' }}
              >
                Appearance
              </p>
              <div
                className="grid grid-cols-2 p-0.5 rounded-[6px] border text-[11.5px] font-medium"
                style={{
                  backgroundColor: 'var(--st-bg-subtle)',
                  borderColor: 'var(--st-border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => void updateStudioTheme({ colorMode: 'light' })}
                  className="h-7 rounded-[4px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  style={{
                    backgroundColor:
                      activeMode === 'light' ? 'var(--st-bg)' : 'transparent',
                    color:
                      activeMode === 'light'
                        ? 'var(--st-text)'
                        : 'var(--st-text-muted)',
                    boxShadow:
                      activeMode === 'light' ? 'var(--st-shadow-sm)' : 'none',
                  }}
                >
                  <Sun className="w-3.5 h-3.5" />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => void updateStudioTheme({ colorMode: 'dark' })}
                  className="h-7 rounded-[4px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  style={{
                    backgroundColor:
                      activeMode === 'dark' ? 'var(--st-bg)' : 'transparent',
                    color:
                      activeMode === 'dark'
                        ? 'var(--st-text)'
                        : 'var(--st-text-muted)',
                    boxShadow:
                      activeMode === 'dark' ? 'var(--st-shadow-sm)' : 'none',
                  }}
                >
                  <Moon className="w-3.5 h-3.5" />
                  Dark
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Row */}
        <div className="flex items-center justify-between gap-1.5 px-1">
          <div className="flex items-center gap-2 min-w-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-6 h-6 rounded-full object-cover shrink-0 border"
                style={{ borderColor: 'var(--st-border)' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                style={{
                  backgroundColor: 'var(--st-bg-active)',
                  color: 'var(--st-text)',
                }}
              >
                {userInitial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11.5px] font-medium truncate leading-tight">
                {user.displayName || 'Admin'}
              </p>
              <p
                className="text-[10.5px] truncate leading-tight"
                style={{ color: 'var(--st-text-muted)' }}
              >
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              disabled={syncStatus.syncing}
              onClick={() => void resetCmsSyncCursorsAndResync(toast)}
              className="studio-hover p-1.5 rounded-[6px] cursor-pointer disabled:opacity-50 transition-colors shrink-0"
              style={{
                color: syncStatus.lastError
                  ? 'var(--st-danger)'
                  : 'var(--st-text-muted)',
              }}
              title={
                syncStatus.syncing
                  ? 'Syncing from Firestore…'
                  : syncStatus.lastError
                    ? 'Sync error — click to retry'
                    : 'Resync content from Firestore'
              }
              aria-label="Resync content from Firestore"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncStatus.syncing ? 'animate-spin' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => setThemePopoverOpen((v) => !v)}
              className="studio-hover p-1.5 rounded-[6px] cursor-pointer transition-colors shrink-0"
              style={{
                backgroundColor: themePopoverOpen
                  ? 'var(--st-bg-active)'
                  : undefined,
                color: themePopoverOpen
                  ? 'var(--st-accent)'
                  : 'var(--st-text-muted)',
              }}
              title="Theme & appearance"
              aria-label="Theme & appearance"
              aria-expanded={themePopoverOpen}
            >
              <Palette className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="studio-hover p-1.5 rounded-[6px] cursor-pointer transition-colors shrink-0"
              style={{ color: 'var(--st-text-muted)' }}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="sukoon-studio h-dvh w-full overflow-hidden flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div
        className="md:hidden h-[50px] px-3 border-b flex items-center justify-between gap-2.5 shrink-0"
        style={{
          backgroundColor: 'var(--st-bg-sidebar)',
          borderColor: 'var(--st-border)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-1.5 rounded-[6px] border cursor-pointer"
            style={{
              backgroundColor: 'var(--st-bg)',
              borderColor: 'var(--st-border)',
            }}
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <SukoonEmblem className="w-7 h-7 rounded-[7px]" iconClassName="w-5 h-5" />
          <span className="text-sm font-semibold tracking-tight truncate">
            {activeNav?.label ?? 'Studio'}
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            void updateStudioTheme({
              colorMode: activeMode === 'light' ? 'dark' : 'light',
            })
          }
          className="p-1.5 rounded-[6px] border cursor-pointer"
          style={{
            backgroundColor: 'var(--st-bg)',
            borderColor: 'var(--st-border)',
            color: 'var(--st-text-secondary)',
          }}
          aria-label="Toggle light/dark mode"
          title="Toggle light/dark mode"
        >
          {activeMode === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden flex"
          style={{ backgroundColor: 'rgba(9, 9, 11, 0.45)', backdropFilter: 'blur(3px)' }}
          onClick={() => setMobileNavOpen(false)}
        >
          <aside
            className="w-[260px] h-full border-r relative"
            style={{
              backgroundColor: 'var(--st-bg-sidebar)',
              borderColor: 'var(--st-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-3 right-3 p-1 rounded-md cursor-pointer z-10"
              style={{ color: 'var(--st-text-muted)' }}
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside
        className="hidden md:flex md:flex-col w-[232px] shrink-0 h-full border-r"
        style={{
          backgroundColor: 'var(--st-bg-sidebar)',
          borderColor: 'var(--st-border)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
        {tab === 'overview' && (
          <AdminOverviewTab
            onNavigateTab={(next) => setTab(next)}
            onNewDua={handleNewDua}
            onResumeDraft={handleResumeDraft}
          />
        )}
        {tab === 'duas' && (
          <AdminDuasTab
            launchIntent={launchIntent?.tab === 'duas' ? launchIntent : null}
            onConsumeIntent={clearLaunchIntent}
          />
        )}
        {tab === 'chapters' && (
          <AdminChaptersTab
            launchIntent={launchIntent?.tab === 'chapters' ? launchIntent : null}
            onConsumeIntent={clearLaunchIntent}
          />
        )}
        {tab === 'routines' && (
          <AdminRoutinesTab
            launchIntent={launchIntent?.tab === 'routines' ? launchIntent : null}
            onConsumeIntent={clearLaunchIntent}
          />
        )}
        {tab === 'surahs' && <AdminSurahsTab />}
        {tab === 'featured' && (
          <AdminFeaturedTab
            launchIntent={launchIntent?.tab === 'featured' ? launchIntent : null}
            onConsumeIntent={clearLaunchIntent}
          />
        )}
      </main>
    </div>
  );
}
