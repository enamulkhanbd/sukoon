import {
  BookOpen,
  CalendarCheck2,
  HeartHandshake,
  Home,
  Settings as SettingsIcon,
} from 'lucide-react';

export type AppTab = 'home' | 'surahs' | 'duas' | 'routines' | 'settings';

interface BottomNavProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'আজ', icon: Home },
  { id: 'surahs', label: 'সূরা', icon: BookOpen },
  { id: 'duas', label: 'দুআ', icon: HeartHandshake },
  { id: 'routines', label: 'রুটিন', icon: CalendarCheck2 },
  { id: 'settings', label: 'সেটিংস', icon: SettingsIcon },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="প্রধান নেভিগেশন"
      className="fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur-md safe-bottom"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="max-w-2xl mx-auto grid grid-cols-5 px-1.5 pt-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors cursor-pointer"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              <span
                className="flex items-center justify-center w-11 h-7 rounded-full transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span className={`text-[11px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
