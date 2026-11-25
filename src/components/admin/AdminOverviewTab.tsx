import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  FilePenLine,
  FolderOpen,
  Info,
  Monitor,
  RefreshCw,
  ScrollText,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  resetCmsSyncCursorsAndResync,
  useCmsSyncStatus,
} from '../../services/cmsSync';
import { useCatalog } from '../../services/contentCatalog';
import {
  fetchUserTelemetrySummary,
  type UserTelemetrySummary,
} from '../../services/userTelemetry';
import { useToast } from '../ToastProvider';
import { loadDraftsMap, type DraftScope } from './adminDrafts';
import { StudioButton, StudioMetricCard } from './StudioUI';

export type StudioContentTab = 'duas' | 'chapters' | 'routines' | 'surahs' | 'featured';

interface DraftPreviewItem {
  scope: DraftScope;
  id: string;
  title: string;
  savedAt: number;
}

interface AdminOverviewTabProps {
  onNavigateTab: (tab: StudioContentTab) => void;
  onResumeDraft: (scope: DraftScope, id: string) => void;
  onOpenDuaDrafts: () => void;
}

export function AdminOverviewTab({
  onNavigateTab,
  onResumeDraft,
  onOpenDuaDrafts,
}: AdminOverviewTabProps) {
  const toast = useToast();
  const catalog = useCatalog();
  const syncStatus = useCmsSyncStatus();
  const [metrics, setMetrics] = useState<UserTelemetrySummary | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    setMetricsError(null);
    try {
      const summary = await fetchUserTelemetrySummary();
      setMetrics(summary);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unable to load user metrics.';
      setMetricsError(msg);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  const isSyncingAll = loadingMetrics || syncStatus.syncing;

  const handleSyncAll = () => {
    void Promise.all([loadMetrics(), resetCmsSyncCursorsAndResync(toast)]);
  };

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const savedDrafts = useMemo<DraftPreviewItem[]>(() => {
    const out: DraftPreviewItem[] = [];
    const duaDrafts = loadDraftsMap<{ titleBangla?: string }>('duas');
    for (const d of Object.values(duaDrafts)) {
      out.push({
        scope: 'duas',
        id: d.id,
        title: d.data.titleBangla?.trim() || '(Untitled Dua)',
        savedAt: d.savedAt,
      });
    }
    const chapterDrafts = loadDraftsMap<{ titleBangla?: string }>('chapters');
    for (const c of Object.values(chapterDrafts)) {
      out.push({
        scope: 'chapters',
        id: c.id,
        title: c.data.titleBangla?.trim() || '(Untitled Chapter)',
        savedAt: c.savedAt,
      });
    }
    const routineDrafts = loadDraftsMap<{ title?: string }>('routines');
    for (const r of Object.values(routineDrafts)) {
      out.push({
        scope: 'routines',
        id: r.id,
        title: r.data.title?.trim() || '(Untitled Routine)',
        savedAt: r.savedAt,
      });
    }
    const featuredDrafts = loadDraftsMap<{ titleBangla?: string }>('featured');
    for (const f of Object.values(featuredDrafts)) {
      out.push({
        scope: 'featured',
        id: f.id,
        title: f.data.titleBangla?.trim() || '(Untitled Spotlight)',
        savedAt: f.savedAt,
      });
    }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  }, []);

  const remoteDuasCount = Object.keys(catalog.remoteDuasMap).length;
  const remoteSurahCount = Object.keys(catalog.remoteSurahOverridesMap).length;
  const activeSpotlightCount = catalog.featuredCards.filter((c) => c.active).length;

  const contentCards: Array<{
    tab: StudioContentTab;
    label: string;
    count: number;
    meta: string;
    icon: typeof ScrollText;
  }> = [
    {
      tab: 'duas',
      label: 'Duas',
      count: catalog.duas.length,
      meta: `${remoteDuasCount} remote / edited`,
      icon: ScrollText,
    },
    {
      tab: 'chapters',
      label: 'Chapters',
      count: catalog.chapters.length,
      meta: 'Organized categories',
      icon: FolderOpen,
    },
    {
      tab: 'routines',
      label: 'Routine Templates',
      count: catalog.routineTemplates.length,
      meta: 'Curated user routines',
      icon: CalendarCheck2,
    },
    {
      tab: 'surahs',
      label: 'Surah Metadata',
      count: 114,
      meta: `${remoteSurahCount} customized`,
      icon: BookOpen,
    },
    {
      tab: 'featured',
      label: 'Home Spotlight',
      count: catalog.featuredCards.length,
      meta: `${activeSpotlightCount} active now`,
      icon: Sparkles,
    },
  ];

  const totalPlatformCount = metrics
    ? metrics.platforms.android + metrics.platforms.ios + metrics.platforms.desktop
    : 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header
        className="h-[52px] px-5 sm:px-7 border-b flex items-center justify-between gap-3 shrink-0"
        style={{
          backgroundColor: 'var(--st-bg)',
          borderColor: 'var(--st-border)',
        }}
      >
        <h1 className="text-[14px] font-semibold tracking-tight">Overview</h1>

        <StudioButton
          variant="secondary"
          size="sm"
          disabled={isSyncingAll}
          onClick={handleSyncAll}
          title="Sync content & user analytics from Firestore"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`}
          />
          <span className="hidden sm:inline">
            {isSyncingAll ? 'Syncing…' : 'Sync Data'}
          </span>
        </StudioButton>
      </header>

      {/* Scrollable Executive Dashboard */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--st-bg-subtle)' }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-7 py-6 space-y-8">
          {/* Audience & Usage */}
          <section className="space-y-3.5">
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.07em]"
              style={{ color: 'var(--st-text-muted)' }}
            >
              Audience & Usage
            </h2>

            {metricsError && (
              <div
                className="rounded-lg border p-3.5 flex items-start justify-between gap-3 text-xs"
                style={{
                  backgroundColor: 'var(--st-bg)',
                  borderColor: 'var(--st-border)',
                }}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Info
                    className="w-4 h-4 shrink-0 mt-0.5"
                    style={{ color: 'var(--st-accent)' }}
                  />
                  <div className="space-y-1">
                    <p className="font-medium">Unable to load user metrics</p>
                    <p style={{ color: 'var(--st-text-secondary)' }}>
                      {metricsError}
                    </p>
                  </div>
                </div>
                <StudioButton
                  variant="secondary"
                  size="xs"
                  onClick={() => void loadMetrics()}
                >
                  Retry
                </StudioButton>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <StudioMetricCard
                label="Total Users"
                value={metrics ? metrics.totalUsers.toLocaleString() : '—'}
                sublabel="Unique devices"
                icon={<Users className="w-4 h-4" />}
                loading={loadingMetrics}
              />
              <StudioMetricCard
                label="Active Today"
                value={metrics ? metrics.activeToday.toLocaleString() : '—'}
                sublabel="Opened today"
                icon={<Activity className="w-4 h-4" />}
                loading={loadingMetrics}
              />
              <StudioMetricCard
                label="Active (7 Days)"
                value={metrics ? metrics.activeLast7Days.toLocaleString() : '—'}
                sublabel="Last 7 days"
                icon={<CalendarDays className="w-4 h-4" />}
                loading={loadingMetrics}
              />
              <StudioMetricCard
                label="Installed PWA"
                value={metrics ? metrics.pwaInstalls.toLocaleString() : '—'}
                sublabel={
                  metrics && metrics.totalUsers > 0
                    ? `${Math.round((metrics.pwaInstalls / metrics.totalUsers) * 100)}% of total`
                    : 'Home-screen installs'
                }
                icon={<Smartphone className="w-4 h-4" />}
                loading={loadingMetrics}
              />
            </div>

            {metrics && totalPlatformCount > 0 && (
              <div
                className="rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-4"
                style={{
                  backgroundColor: 'var(--st-bg)',
                  borderColor: 'var(--st-border)',
                }}
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Monitor
                    className="w-3.5 h-3.5"
                    style={{ color: 'var(--st-text-muted)' }}
                  />
                  <span>Platforms</span>
                </div>
                <div className="flex flex-wrap items-center gap-5 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--st-accent)' }}
                    />
                    <span style={{ color: 'var(--st-text-secondary)' }}>Android</span>
                    <strong className="font-mono tabular-nums">
                      {metrics.platforms.android}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--st-blue)' }}
                    />
                    <span style={{ color: 'var(--st-text-secondary)' }}>iOS</span>
                    <strong className="font-mono tabular-nums">
                      {metrics.platforms.ios}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--st-text-muted)' }}
                    />
                    <span style={{ color: 'var(--st-text-secondary)' }}>Desktop</span>
                    <strong className="font-mono tabular-nums">
                      {metrics.platforms.desktop}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Content Overview */}
          <section className="space-y-3.5">
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.07em]"
              style={{ color: 'var(--st-text-muted)' }}
            >
              Content Overview
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {contentCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.tab}
                    type="button"
                    onClick={() => onNavigateTab(card.tab)}
                    className="studio-hover rounded-lg border p-4 text-left flex items-start justify-between gap-3 cursor-pointer transition-colors group"
                    style={{
                      backgroundColor: 'var(--st-bg)',
                      borderColor: 'var(--st-border)',
                      boxShadow: 'var(--st-shadow-sm)',
                    }}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon
                          className="w-4 h-4 shrink-0"
                          style={{ color: 'var(--st-accent)' }}
                        />
                        <span className="text-[13px] font-semibold truncate">
                          {card.label}
                        </span>
                      </div>
                      <p className="text-xl font-semibold tabular-nums tracking-tight">
                        {card.count}
                      </p>
                      <p
                        className="text-[11.5px]"
                        style={{ color: 'var(--st-text-muted)' }}
                      >
                        {card.meta}
                      </p>
                    </div>
                    <ArrowRight
                      className="w-4 h-4 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--st-text-faint)' }}
                    />
                  </button>
                );
              })}

              {savedDrafts.length > 0 && (
                <button
                  key="saved-drafts"
                  type="button"
                  onClick={() => {
                    if (savedDrafts.length > 1) {
                      onOpenDuaDrafts();
                    } else {
                      onResumeDraft(savedDrafts[0].scope, savedDrafts[0].id);
                    }
                  }}
                  className="studio-hover rounded-lg border p-4 text-left flex items-start justify-between gap-3 cursor-pointer transition-colors group"
                  style={{
                    backgroundColor: 'var(--st-bg)',
                    borderColor: 'var(--st-border)',
                    boxShadow: 'var(--st-shadow-sm)',
                  }}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <FilePenLine
                        className="w-4 h-4 shrink-0"
                        style={{ color: 'var(--st-blue)' }}
                      />
                      <span className="text-[13px] font-semibold truncate">
                        Saved Drafts
                      </span>
                    </div>
                    <p className="text-xl font-semibold tabular-nums tracking-tight">
                      {savedDrafts.length}
                    </p>
                    <p
                      className="text-[11.5px] truncate"
                      style={{ color: 'var(--st-text-muted)' }}
                    >
                      {savedDrafts.length > 1
                        ? 'View all saved drafts'
                        : `Resume: ${savedDrafts[0].title}`}
                    </p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5"
                    style={{ color: 'var(--st-text-faint)' }}
                  />
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
