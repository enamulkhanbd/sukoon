import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Target } from 'lucide-react';
import { db, type Settings } from '../db/database';
import { useIslamicClock } from '../hooks/useIslamicClock';
import { DEFAULT_FASTING_LOCATION } from '../utils/fasting';
import { toBanglaDigits } from '../utils/formatters';
import { formatReadingDurationBn } from '../utils/islamicTime';
import {
  buildDayMetrics,
  buildHistoryMap,
  computeStreaks,
  getRecordDuaTotal,
} from '../utils/stats';
import { DailyGoalSheet } from './DailyGoalSheet';
import {
  TabHeader,
  TwoLineMenuButton,
  UnderlineTabs,
} from './NavigationChrome';
import { RamadanPrayerSettings } from './RamadanPrayerSettings';
import { StatsDashboard } from './StatsDashboard';
import { useToast } from './ToastProvider';

export type ProfileSection = 'stats' | 'ramadan';

interface ProfileViewProps {
  settings: Settings;
  activeSection: ProfileSection;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onChangeSection: (section: ProfileSection) => void;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void>;
  onOpenFastingSchedule: () => void;
}

const PROFILE_TABS: Array<{ id: ProfileSection; label: string }> = [
  { id: 'stats', label: 'পরিসংখ্যান' },
  { id: 'ramadan', label: 'রোজা ও ওয়াক্ত' },
];

export function ProfileView({
  settings,
  activeSection,
  menuOpen,
  onOpenMenu,
  onChangeSection,
  onUpdateSettings,
  onOpenFastingSchedule,
}: ProfileViewProps) {
  const toast = useToast();
  const clock = useIslamicClock(settings);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);

  const historyRows = useLiveQuery(() => db.readingHistory.toArray(), []);
  const fastingLocation = settings.fastingLocation ?? DEFAULT_FASTING_LOCATION;

  const { historyMap, streaks, activeDaysCount } = useMemo(() => {
    const rows = historyRows ?? [];
    const map = buildHistoryMap(rows);
    const activeDays = rows.filter(
      (h) =>
        h.ayahsCount > 0 ||
        (h.dhikirCount ?? 0) > 0 ||
        getRecordDuaTotal(h) > 0 ||
        (h.routinesCompleted?.length ?? 0) > 0
    ).length;
    return {
      historyMap: map,
      streaks: computeStreaks(map, clock.islamicDate),
      activeDaysCount: activeDays,
    };
  }, [historyRows, clock.islamicDate]);

  const dailyGoalMinutes = Math.max(
    0,
    Math.floor(settings.dailyGoalMinutes ?? 0)
  );
  const todayStats = useMemo(
    () =>
      buildDayMetrics(
        clock.islamicDate,
        historyMap.get(clock.islamicDayKey),
        clock.islamicDayKey
      ),
    [historyMap, clock.islamicDate, clock.islamicDayKey]
  );
  const todayReadingMinutes = Math.floor(todayStats.readingSeconds / 60);
  const goalTargetSeconds = dailyGoalMinutes * 60;
  const goalPercent =
    goalTargetSeconds > 0
      ? Math.min(
          100,
          Math.round((todayStats.readingSeconds / goalTargetSeconds) * 100)
        )
      : 0;
  const goalCompleted =
    dailyGoalMinutes > 0 && todayStats.readingSeconds >= goalTargetSeconds;

  const subtitleParts: string[] = [];
  if (streaks.currentStreak > 0) {
    subtitleParts.push(`${toBanglaDigits(streaks.currentStreak)} দিন ধারা`);
  }
  subtitleParts.push(`${toBanglaDigits(activeDaysCount)} সক্রিয় দিন`);
  subtitleParts.push(fastingLocation.nameBn);
  const profileSubtitle = subtitleParts.join(' • ');

  return (
    <div className="pb-28">
      {/* Full-Bleed Tinted Top Band (matches Home, Surahs, Duas & Routines) */}
      <section
        className="w-full safe-top"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-6">
          <TabHeader
            title="প্রোফাইল"
            subtitle={profileSubtitle}
            rightAction={
              <TwoLineMenuButton open={menuOpen} onClick={onOpenMenu} />
            }
          />
        </div>
      </section>

      {/* Main Editorial Canvas */}
      <main className="max-w-2xl mx-auto px-5 pt-5 space-y-5">
        {/* Elevated Daily Quran Recitation Goal Card */}
        <section
          className="rounded-2xl px-4 py-3.5 border space-y-2.5"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Target
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap text-xs font-medium">
                  <span>দৈনিক কুরআন তিলাওয়াত লক্ষ্য</span>
                  {goalCompleted && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                      }}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      সম্পন্ন
                    </span>
                  )}
                </div>
                <p
                  className="text-[11px] mt-0.5 tabular-nums"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {dailyGoalMinutes > 0
                    ? `আজ ${toBanglaDigits(todayReadingMinutes)} / ${toBanglaDigits(dailyGoalMinutes)} মিনিট`
                    : todayStats.readingSeconds > 0
                      ? `আজ ${formatReadingDurationBn(todayStats.readingSeconds)} পড়া হয়েছে • কোনো লক্ষ্য সেট করা নেই`
                      : 'প্রতিদিনের তিলাওয়াতের সময়-লক্ষ্য নির্ধারণ করুন'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGoalSheetOpen(true)}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-opacity active:opacity-75"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              {dailyGoalMinutes > 0 ? 'পরিবর্তন' : 'লক্ষ্য সেট'}
            </button>
          </div>
          {dailyGoalMinutes > 0 && (
            <div
              className="h-[3px] w-full rounded-full overflow-hidden"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--text-primary) 10%, transparent)',
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${goalPercent}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>
          )}
        </section>

        {/* 2 Primary Profile Underline Tabs */}
        <UnderlineTabs<ProfileSection>
          value={activeSection}
          onChange={onChangeSection}
          ariaLabel="প্রোফাইল বিভাগ"
          tabs={PROFILE_TABS}
        />

        {activeSection === 'stats' ? (
          <StatsDashboard settings={settings} />
        ) : (
          <RamadanPrayerSettings
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onOpenFastingSchedule={onOpenFastingSchedule}
          />
        )}
      </main>

      <DailyGoalSheet
        open={goalSheetOpen}
        onClose={() => setGoalSheetOpen(false)}
        currentGoalMinutes={dailyGoalMinutes}
        onSave={async (minutes) => {
          await onUpdateSettings({ dailyGoalMinutes: minutes });
          toast.success(
            minutes > 0
              ? `দৈনিক তিলাওয়াত লক্ষ্য ${toBanglaDigits(minutes)} মিনিট নির্ধারিত হয়েছে`
              : 'দৈনিক তিলাওয়াত লক্ষ্য বন্ধ করা হয়েছে'
          );
        }}
      />
    </div>
  );
}
