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
      className="fixed bottom-0 inset-x-0 z-30 pointer-events-none px-3 safe-bottom"
    >
      <div className="max-w-md mx-auto pointer-events-auto grid grid-cols-5 gap-0.5 p-1.5 rounded-[28px] sukoon-glass-pill">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onChange(item.id)}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-[22px] transition-all duration-200 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                boxShadow: active
                  ? 'inset 0 1px 0 var(--glass-specular)'
                  : 'none',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Icon
                className="w-[18px] h-[18px]"
                strokeWidth={active ? 2.2 : 1.75}
              />
              <span
                className={`text-[11px] leading-tight ${
                  active ? 'font-medium' : 'font-normal'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
