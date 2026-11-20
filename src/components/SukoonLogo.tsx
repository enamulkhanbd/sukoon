/**
 * Bilingual brand mark for Sukoon:
 * Theme-aware Rub el Hizb + open Mushaf emblem paired with stylized Bangla "সুকূন"
 * and subtle Arabic calligraphy "سُكُوْن" accent.
 */
export function SukoonLogo() {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      {/* Geometric Rub el Hizb + Open Mushaf Emblem */}
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-xs"
        style={{
          backgroundColor: 'var(--accent)',
          borderColor: 'color-mix(in srgb, var(--gold) 55%, var(--accent))',
        }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 64 64"
          className="w-7 h-7"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle 8-pointed Rub el Hizb star */}
          <g
            transform="translate(32 32)"
            stroke="var(--gold)"
            strokeOpacity="0.85"
            strokeWidth="2.1"
            strokeLinejoin="round"
          >
            <rect x="-15" y="-15" width="30" height="30" rx="3" />
            <rect
              x="-15"
              y="-15"
              width="30"
              height="30"
              rx="3"
              transform="rotate(45)"
            />
          </g>
          {/* Open Mushaf Pages */}
          <path
            d="M32 23.5 C27.8 21.8, 22.3 22, 19 23.8 L19 41 C22.5 39.2, 27.8 39.2, 32 41 C36.2 39.2, 41.5 39.2, 45 41 L45 23.8 C41.7 22, 36.2 21.8, 32 23.5 Z"
            fill="var(--bg-page)"
            stroke="var(--gold)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <line
            x1="32"
            y1="23.5"
            x2="32"
            y2="41"
            stroke="var(--gold)"
            strokeWidth="1.3"
          />
          <line
            x1="22.5"
            y1="28.2"
            x2="29"
            y2="27.7"
            stroke="var(--accent)"
            strokeOpacity="0.6"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <line
            x1="22.5"
            y1="32.4"
            x2="29"
            y2="31.9"
            stroke="var(--accent)"
            strokeOpacity="0.6"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <line
            x1="35"
            y1="27.7"
            x2="41.5"
            y2="28.2"
            stroke="var(--accent)"
            strokeOpacity="0.6"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <line
            x1="35"
            y1="31.9"
            x2="41.5"
            y2="32.4"
            stroke="var(--accent)"
            strokeOpacity="0.6"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </span>

      {/* Bilingual Wordmark */}
      <span className="inline-flex items-baseline gap-2 min-w-0">
        <span
          className="text-[1.6rem] font-bold tracking-tight leading-none"
          style={{ color: 'var(--text-primary)' }}
        >
          সুকূন
        </span>
        <span
          className="w-1 h-1 rounded-full self-center shrink-0"
          style={{ backgroundColor: 'var(--gold)' }}
          aria-hidden="true"
        />
        <span
          className="font-indopak text-xl leading-none"
          style={{ color: 'var(--gold)' }}
          lang="ar"
          aria-hidden="true"
        >
          سُكُوْن
        </span>
      </span>
    </span>
  );
}
