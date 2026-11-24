import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck2,
  FolderOpen,
  Loader2,
  LogOut,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
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
import { toBanglaDigits } from '../../utils/formatters';
import { SukoonLogo } from '../SukoonLogo';
import { useToast } from '../ToastProvider';
import { AdminChaptersTab } from './AdminChaptersTab';
import { AdminDuasTab } from './AdminDuasTab';
import { AdminFeaturedTab } from './AdminFeaturedTab';
import { AdminRoutinesTab } from './AdminRoutinesTab';
import { AdminSurahsTab } from './AdminSurahsTab';

type AdminTab = 'duas' | 'chapters' | 'routines' | 'surahs' | 'featured';

interface AdminPanelViewProps {
  onExitAdmin: () => void;
}

interface AuthUserSummary {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export default function AdminPanelView({ onExitAdmin }: AdminPanelViewProps) {
  const toast = useToast();
  const catalog = useCatalog();
  const syncStatus = useCmsSyncStatus();

  const [tab, setTab] = useState<AdminTab>('duas');
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  const configured = isFirebaseConfigured();

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
        // Handle redirect return if popup fell back to redirect
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
            const rejected = fbUser.email ?? 'অজানা ইমেইল';
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
        toast.error('Firebase কনফিগার করা হয়নি।');
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
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
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
      toast.error('সাইন-ইন সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
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
      toast.info('অ্যাডমিন সেশন থেকে লগআউট হয়েছেন।');
    } catch {
      toast.error('লগআউট করা যায়নি।');
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

  const tabs: Array<{
    id: AdminTab;
    label: string;
    icon: typeof ScrollText;
    count?: number;
  }> = [
    { id: 'duas', label: 'দুআ', icon: ScrollText, count: catalog.duas.length },
    { id: 'chapters', label: 'অধ্যায়', icon: FolderOpen, count: catalog.chapters.length },
    { id: 'routines', label: 'রুটিন টেমপ্লেট', icon: CalendarCheck2, count: remoteTemplatesCount },
    { id: 'surahs', label: 'সূরা তথ্য', icon: BookOpen, count: remoteSurahCount },
    { id: 'featured', label: 'হোম স্পটলাইট', icon: Sparkles, count: remoteFeaturedCount },
  ];

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
    >
      {/* Top Admin Header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onExitAdmin}
              className="p-2 rounded-full border cursor-pointer transition-opacity active:opacity-70"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
              aria-label="অ্যাপে ফিরুন"
              title="অ্যাপে ফিরুন"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-semibold truncate">
                  সুকূন অ্যাডমিন
                </h1>
                <span
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  ● {toBanglaDigits(remoteDuasCount)} রিমোট দুআ
                </span>
              </div>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={syncStatus.syncing}
              onClick={() => void resetCmsSyncCursorsAndResync(toast)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer disabled:opacity-60"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
              title="Firestore থেকে সম্পূর্ণ রিসিঙ্ক করুন"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncStatus.syncing ? 'animate-spin' : ''}`}
                style={{ color: 'var(--accent)' }}
              />
              <span className="hidden sm:inline">রিসিঙ্ক</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">লগআউট</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 border transition-colors cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--accent)' : 'var(--bg-elevated)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                  color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className="text-[10px] px-1.5 py-0.2 rounded-full tabular-nums"
                    style={{
                      backgroundColor: active
                        ? 'rgba(255,255,255,0.22)'
                        : 'var(--bg-surface)',
                    }}
                  >
                    {toBanglaDigits(item.count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Active Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5">
        {tab === 'duas' && <AdminDuasTab />}
        {tab === 'chapters' && <AdminChaptersTab />}
        {tab === 'routines' && <AdminRoutinesTab />}
        {tab === 'surahs' && <AdminSurahsTab />}
        {tab === 'featured' && <AdminFeaturedTab />}
      </main>
    </div>
  );
}
