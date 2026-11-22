# سُكُوْن — Sukoon

**হৃদয়ের প্রশান্তিতে কুরআন ও দুআর নিত্যসঙ্গী**

Sukoon is a serene, offline-first Bengali & Arabic Progressive Web App (PWA) for daily Quran recitation, authentic Duas & Adhkar, structured Ibadah routines, and offline prayer & fasting schedules — built with a calm Mushaf-inspired editorial interface and zero accounts or tracking.

---

## Key Features

### Quran Mushaf Reader
- **All 114 Surahs** rendered in classical **IndoPak Nastaleeq** (`indopak-nastaleeq.woff2`) paired with calligraphic Surah headings (`sura_names.woff2`).
- **One-Tap Full Offline Sync:** Download all 114 Surahs to IndexedDB with resumable progress tracking so reading works completely offline.
- **Thoughtful Reading Controls:** Magnetic Arabic font-size presets (`16px–72px`), 5-speed auto-scroll (auto-pauses on touch), Screen Wake Lock, and automatic last-read ayah resume.

### Duas, Adhkar & Tasbih
- **13 Curated Chapters** covering morning & evening adhkar, salah, sleep, food, family, travel, distress, healing, Quranic & Prophetic Ruqyah, 40 Durud & Salam, and post-salah adhkar.
- **Interactive Tasbih Counter Sheet:** Tap-anywhere counter with tactile ripple & count animations, bookmarking, and direct jump links to referenced Quran ayahs.

### Daily & Weekly Routines
- Create custom routines mixing **Surah ayah ranges** and **Duas with target counts**, assigned to specific weekdays or manual mode.
- **Maghrib-to-Maghrib Islamic Day Rollover:** Routine progress and daily goals automatically reset at Maghrib based on your chosen location and calculation method.

### Global Search (`Ctrl+K` / `⌘K`)
- Full-width search bar on the Home header opening a unified instant search overlay across **Surahs, Duas, Chapters, Routines, App Actions, and all 6,236 Quran verses** (instant offline Arabic search across cached Surahs + debounced online Quran.com v4 search).
- **Smart Jumps & Phonetic Matching:** Supports Bangla, Banglish, and harakat-free Arabic queries — including `২:২৫৫`, `yasin 58`, `পারা ৩০`, `পৃষ্ঠা ৬০৪`, and `ayatul kursi`.

### Profile, Ibadah Analytics & Fasting Schedule
- **Profile Tab (`প্রোফাইল`):** Live streak & active-days summary, **Daily Quran Recitation Goal** tracker with active reading timer, and two focused sections:
  - **পরিসংখ্যান (Stats):** Weekly bar charts, monthly intensity heatmap, 12-month overview, 365-day contribution grid, streaks, and top Duas/Routines breakdowns.
  - **রোজা ও ওয়াক্ত (Fasting & Prayer):** Offline 5-Waqt preview (`adhan`), city presets + browser GPS, calculation methods, 12h/24h toggle, Hijri moon-sighting offset (`-2` to `+2` days), and a full monthly Ramadan & Sunnah fasting schedule (`/ramadan`) highlighting Mondays/Thursdays and Ayyam al-Bid (13th–15th).

### Themes, Glass Chrome & Settings Sheet
- **Native `92dvh` Draggable Glass Settings Sheet** accessible from the Profile header and Global Search (with drag-to-dismiss and native browser/Android Back button support).
- **3 Dual-Mode Themes (Light & Dark):**
  - **কাগজ (Paper):** Warm parchment & antique bronze/gold
  - **জলপাই (Olive):** Calm botanical green
  - **আকাশ (Sky):** Soft serene blue
- **3 Glass Presets:** `স্বচ্ছ` (Clear), `ফ্রস্টেড` (Frosted), and `ঘন` (Solid) with dynamic theme-matched favicon & PWA icons.
- **Data Portability:** Full JSON backup export and restore for routines, reading history, and preferences.

---

## Tech Stack

- **Framework:** React 19 + TypeScript 5.7
- **Build & PWA:** Vite 6 + `vite-plugin-pwa` (Workbox precaching & offline support)
- **Styling:** Tailwind CSS v4 + CSS custom property theme/glass tokens
- **Local Database:** Dexie.js (IndexedDB) with `dexie-react-hooks`
- **Islamic Calculations:** `adhan` (offline prayer, Sehri, Iftar & Maghrib rollover)
- **Icons:** `lucide-react`
- **Testing:** Vitest 5

---

## Project Structure

```text
sukoon/
├── public/
│   ├── fonts/                  # Bundled IndoPak Nastaleeq & Surah calligraphy WOFF2 fonts
│   ├── favicon.svg             # Theme-aligned SVG icon
│   ├── pwa-192x192.png         # PWA app icons
│   ├── pwa-512x512.png
│   └── apple-touch-icon.png
├── src/
│   ├── components/             # Views, sheets & UI chrome
│   │   ├── HomeView.tsx        # Hero calligraphy, full-width search, FastingCard, routines
│   │   ├── SurahListView.tsx   # 114 Surahs, waqt/Jummah suggestions, offline filter
│   │   ├── ReaderView.tsx      # IndoPak Quran reader with auto-scroll & wake lock
│   │   ├── DuasView.tsx        # 13 Dua chapters, search & bookmarks
│   │   ├── DuaReaderView.tsx   # Dua reader + Tasbih counter sheet
│   │   ├── RoutinesView.tsx    # Routine manager & builder
│   │   ├── RoutineDetailView.tsx
│   │   ├── ProfileView.tsx     # Daily goal + StatsDashboard + RamadanPrayerSettings
│   │   ├── StatsDashboard.tsx  # Weekly/Monthly/Yearly charts & 365-day heatmap
│   │   ├── RamadanPrayerSettings.tsx
│   │   ├── FastingScheduleView.tsx
│   │   ├── SettingsSheet.tsx   # 92dvh glass bottom sheet for app settings
│   │   ├── GlobalSearchOverlay.tsx
│   │   ├── BottomNav.tsx       # 5-tab glass pill navigation
│   │   └── NavigationChrome.tsx
│   ├── data/                   # Static Surah metadata & 13 Dua chapters
│   ├── db/                     # Dexie IndexedDB schema, defaults & JSON export/import
│   ├── hooks/                  # Islamic clock, reading timer, wake lock & PWA install
│   ├── services/               # Quran.com API client, offline sync store & verse search
│   ├── utils/                  # Search engine, fasting/Hijri/Islamic time, stats & themes
│   ├── router.ts               # Clean History API router
│   ├── App.tsx                 # Root route & global overlay orchestration
│   └── index.css               # 6 theme palettes, glass chrome & optical font helpers
├── index.html                  # Zero-flash theme/icon bootstrap script
├── vercel.json                 # SPA rewrite configuration
└── vite.config.ts              # Chunk splitting & PWA manifest configuration
```

---

## Getting Started

### Prerequisites
- Node.js `>= 18` and npm

### Installation & Development
```bash
git clone https://github.com/enamulkhanbd/sukoon.git
cd sukoon
npm install
npm run dev
```

### Scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm test` | Run Vitest unit test suite (`src/utils/__tests__/`) |
| `npm run build` | Type-check (`tsc -b`) and build production PWA bundle |
| `npm run preview` | Preview the production build locally |

---

## Privacy & Local-First Design

All routines, bookmarks, reading progress, Ibadah statistics, cached Quran Surahs, and settings are stored **exclusively on your device** in IndexedDB / LocalStorage. No login, analytics, or external user tracking is used. Network requests are made only when fetching uncached Surah text or running online Quran verse search via Quran.com v4 API.
