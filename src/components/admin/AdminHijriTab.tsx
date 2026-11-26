import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import {
  adminPublishHijriCalendarConfig,
  getHijriCalendarConfigSnapshot,
  syncHijriCalendarConfig,
  type HijriCalendarConfig,
  type HijriRegionCalendarConfig,
} from '../../services/hijriCalendarService';
import { toBanglaDigits } from '../../utils/formatters';
import {
  HIJRI_MONTH_NAMES_BN,
  getHijriDate,
  parseIsoDateToDayNumber,
} from '../../utils/hijri';
import { useToast } from '../ToastProvider';
import {
  StudioBadge,
  StudioButton,
  StudioDropdown,
  StudioField,
  StudioInput,
  StudioSection,
  useKeyboardSave,
} from './StudioUI';

type SimpleRegion = 'bd' | 'sa';

const REGION_TABS: Array<{ id: SimpleRegion; label: string }> = [
  { id: 'bd', label: 'Bangladesh' },
  { id: 'sa', label: 'Saudi Arabia' },
];

const OFFSET_OPTIONS = [-2, -1, 0, 1, 2] as const;

function cloneConfig(source: HijriCalendarConfig | null): HijriCalendarConfig {
  const regions: HijriCalendarConfig['regions'] = {};
  for (const r of ['bd', 'sa', 'default'] as const) {
    const src = source?.regions?.[r];
    if (src) {
      regions[r] = {
        ...(typeof src.defaultOffsetDays === 'number'
          ? { defaultOffsetDays: src.defaultOffsetDays }
          : {}),
        months: [...src.months],
      };
    }
  }
  return {
    version: 1,
    updatedAt: source?.updatedAt || '',
    regions,
  };
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function AdminHijriTab() {
  const toast = useToast();
  const todayHijri = useMemo(() => getHijriDate(new Date()), []);

  const [draft, setDraft] = useState<HijriCalendarConfig>(() =>
    cloneConfig(getHijriCalendarConfigSnapshot())
  );
  const [baselineHash, setBaselineHash] = useState(() =>
    JSON.stringify(cloneConfig(getHijriCalendarConfigSnapshot()))
  );
  const [activeRegion, setActiveRegion] = useState<SimpleRegion>('bd');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [newYear, setNewYear] = useState<number>(todayHijri.year);
  const [newMonth, setNewMonth] = useState<number>(todayHijri.month);
  const [newStartDate, setNewStartDate] = useState<string>(getTodayIso);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== baselineHash,
    [draft, baselineHash]
  );

  const reloadRemote = useCallback(
    async (showToast = false) => {
      setLoading(true);
      try {
        await syncHijriCalendarConfig({ force: true });
        const fresh = cloneConfig(getHijriCalendarConfigSnapshot());
        setDraft(fresh);
        setBaselineHash(JSON.stringify(fresh));
        if (showToast) {
          toast.info('Hijri calendar reloaded.');
        }
      } catch (err) {
        if (showToast) {
          toast.error(err instanceof Error ? err.message : 'Failed to reload.');
        }
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void reloadRemote(false);
  }, [reloadRemote]);

  const regionConfig: HijriRegionCalendarConfig = draft.regions[activeRegion] ?? {
    months: [],
  };

  const currentOffset = regionConfig.defaultOffsetDays ?? 0;

  const previewHijri = useMemo(
    () => getHijriDate(new Date(), currentOffset, regionConfig.months),
    [currentOffset, regionConfig.months]
  );

  const updateRegionConfig = (
    updater: (prev: HijriRegionCalendarConfig) => HijriRegionCalendarConfig
  ) => {
    setDraft((prev) => {
      const current = prev.regions[activeRegion] ?? { months: [] };
      const next = updater(current);
      return {
        ...prev,
        regions: {
          ...prev.regions,
          [activeRegion]: next,
        },
      };
    });
  };

  const handleSetOffset = (offset: number) => {
    updateRegionConfig((prev) => ({
      ...prev,
      defaultOffsetDays: offset,
    }));
  };

  const handleAddAnchor = () => {
    if (!Number.isInteger(newYear) || newYear < 1300 || newYear > 1700) {
      toast.warning('Enter a valid Hijri year (1300–1700).');
      return;
    }
    if (parseIsoDateToDayNumber(newStartDate) === null) {
      toast.warning('Pick a valid start date.');
      return;
    }

    updateRegionConfig((prev) => {
      const filtered = prev.months.filter(
        (m) => !(m.year === newYear && m.month === newMonth)
      );
      const nextMonths = [
        ...filtered,
        { year: newYear, month: newMonth, startDate: newStartDate },
      ].sort((a, b) => a.startDate.localeCompare(b.startDate));
      return {
        ...prev,
        months: nextMonths,
      };
    });
  };

  const handleRemoveAnchor = (year: number, month: number) => {
    updateRegionConfig((prev) => ({
      ...prev,
      months: prev.months.filter((m) => !(m.year === year && m.month === month)),
    }));
  };

  const handlePublish = useCallback(async () => {
    if (saving || !isDirty) return;
    setSaving(true);
    try {
      const payload: HijriCalendarConfig = {
        ...draft,
        version: 1,
        updatedAt: getTodayIso(),
      };
      const published = await adminPublishHijriCalendarConfig(payload);
      const clean = cloneConfig(published);
      setDraft(clean);
      setBaselineHash(JSON.stringify(clean));
      toast.success('Hijri settings published.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish.');
    } finally {
      setSaving(false);
    }
  }, [draft, isDirty, saving, toast]);

  useKeyboardSave(isDirty && !saving, () => {
    void handlePublish();
  });

  const monthOptions = useMemo(
    () =>
      HIJRI_MONTH_NAMES_BN.map((name, idx) => ({
        value: String(idx + 1),
        label: `${idx + 1}. ${name}`,
      })),
    []
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header Bar */}
      <header
        className="h-[52px] px-5 sm:px-7 border-b flex items-center justify-between gap-3 shrink-0"
        style={{
          backgroundColor: 'var(--st-bg)',
          borderColor: 'var(--st-border)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-[14px] font-semibold tracking-tight truncate">
            Hijri Calendar
          </h1>
          {isDirty ? (
            <StudioBadge tone="amber" dot>
              Unsaved
            </StudioBadge>
          ) : draft.updatedAt ? (
            <StudioBadge tone="neutral">Updated {draft.updatedAt}</StudioBadge>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StudioButton
            variant="ghost"
            size="sm"
            onClick={() => void reloadRemote(true)}
            disabled={loading || saving}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reload</span>
          </StudioButton>
          <StudioButton
            variant="primary"
            size="sm"
            onClick={() => void handlePublish()}
            disabled={!isDirty || saving}
            loading={saving}
          >
            <Send className="w-3.5 h-3.5" />
            Publish
          </StudioButton>
        </div>
      </header>

      {/* Region Tabs */}
      <div
        className="px-5 sm:px-7 py-3 border-b shrink-0"
        style={{
          backgroundColor: 'var(--st-bg-subtle)',
          borderColor: 'var(--st-border)',
        }}
      >
        <div
          className="inline-grid grid-cols-2 p-0.5 rounded-[6px] border text-[12px] font-medium"
          style={{
            backgroundColor: 'var(--st-bg)',
            borderColor: 'var(--st-border)',
          }}
        >
          {REGION_TABS.map((r) => {
            const active = r.id === activeRegion;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRegion(r.id)}
                className="h-7 px-4 rounded-[4px] cursor-pointer transition-colors"
                style={{
                  backgroundColor: active ? 'var(--st-bg-active)' : 'transparent',
                  color: active ? 'var(--st-text)' : 'var(--st-text-muted)',
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--st-bg)' }}>
        <div className="max-w-xl px-5 sm:px-7 py-6 space-y-6">
          {/* Live Date Preview */}
          <div
            className="rounded-xl border px-4 py-3.5 flex items-center justify-between gap-4"
            style={{
              backgroundColor: 'var(--st-bg-subtle)',
              borderColor: 'var(--st-border)',
            }}
          >
            <div>
              <p
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--st-text-muted)' }}
              >
                Today in {activeRegion === 'bd' ? 'Bangladesh' : 'Saudi Arabia'}
              </p>
              <p className="text-[16px] font-semibold mt-0.5">
                {toBanglaDigits(previewHijri.day)} {previewHijri.monthNameBn}{' '}
                {toBanglaDigits(previewHijri.year)} হিজরি
              </p>
            </div>
            <StudioBadge tone={previewHijri.source === 'confirmed' ? 'emerald' : 'neutral'}>
              {previewHijri.source === 'confirmed' ? 'Pinned Month' : 'Auto Offset'}
            </StudioBadge>
          </div>

          {/* Simple Day Adjustment */}
          <StudioSection
            title="Day Adjustment"
            description="Quickly shift the Hijri date for users in Auto mode."
          >
            <div
              className="grid grid-cols-5 p-1 rounded-[8px] border gap-1"
              style={{
                backgroundColor: 'var(--st-bg-subtle)',
                borderColor: 'var(--st-border)',
              }}
            >
              {OFFSET_OPTIONS.map((opt) => {
                const selected = currentOffset === opt;
                const label = opt > 0 ? `+${opt}` : `${opt}`;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSetOffset(opt)}
                    className="h-9 rounded-[6px] text-xs font-medium font-mono tabular-nums cursor-pointer transition-colors"
                    style={{
                      backgroundColor: selected ? 'var(--st-accent)' : 'transparent',
                      color: selected ? '#ffffff' : 'var(--st-text-secondary)',
                    }}
                  >
                    {label} {Math.abs(opt) === 1 ? 'day' : 'days'}
                  </button>
                );
              })}
            </div>
          </StudioSection>

          {/* Optional Moon Sighting Override (Collapsible) */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--st-border)' }}
          >
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="studio-hover w-full px-4 py-3 flex items-center justify-between gap-2 text-left cursor-pointer"
              style={{ backgroundColor: 'var(--st-bg-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  Pin 1st Day of Month (Optional)
                </span>
                {regionConfig.months.length > 0 && (
                  <StudioBadge tone="neutral">
                    {regionConfig.months.length} pinned
                  </StudioBadge>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                style={{ color: 'var(--st-text-muted)' }}
              />
            </button>

            {showAdvanced && (
              <div
                className="p-4 space-y-4 border-t"
                style={{ borderColor: 'var(--st-border)' }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-[95px_1fr_145px_auto] gap-2.5 items-end">
                  <StudioField label="Year">
                    <StudioInput
                      type="number"
                      min={1300}
                      max={1700}
                      value={newYear}
                      onChange={(e) => setNewYear(Number(e.target.value) || todayHijri.year)}
                      className="font-mono tabular-nums"
                    />
                  </StudioField>

                  <StudioField label="Month">
                    <StudioDropdown
                      value={String(newMonth)}
                      onChange={(val) => setNewMonth(Number(val) || 1)}
                      options={monthOptions}
                    />
                  </StudioField>

                  <StudioField label="1st Day">
                    <StudioInput
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                    />
                  </StudioField>

                  <StudioButton variant="secondary" size="md" onClick={handleAddAnchor}>
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </StudioButton>
                </div>

                {regionConfig.months.length > 0 && (
                  <div
                    className="rounded-lg border divide-y overflow-hidden"
                    style={{ borderColor: 'var(--st-border)' }}
                  >
                    {regionConfig.months.map((m) => {
                      const monthName = HIJRI_MONTH_NAMES_BN[m.month - 1] ?? `Month ${m.month}`;
                      return (
                        <div
                          key={`${m.year}-${m.month}`}
                          className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                          style={{ borderColor: 'var(--st-border)' }}
                        >
                          <span>
                            <strong className="font-medium">
                              {monthName} {m.year} AH
                            </strong>{' '}
                            <span style={{ color: 'var(--st-text-muted)' }}>
                              · starts {m.startDate}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAnchor(m.year, m.month)}
                            className="p-1 rounded cursor-pointer hover:opacity-80"
                            style={{ color: 'var(--st-danger)' }}
                            aria-label={`Remove ${monthName} ${m.year}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
