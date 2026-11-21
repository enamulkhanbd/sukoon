import { SukoonEmblem } from './SukoonLogo';

/**
 * Minimal native-style launch splash screen:
 * clean theme canvas, centered Sukoon emblem, and quiet bottom brand name.
 */
export function SplashScreen() {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-between paper-frame safe-top safe-bottom select-none"
      role="status"
      aria-label="সুকূন"
    >
      <div className="h-12 shrink-0" aria-hidden="true" />

      <SukoonEmblem
        className="w-20 h-20 rounded-[22px]"
        iconClassName="w-16 h-16"
      />

      <div className="pb-10">
        <span
          className="font-brand-ar text-[1.75rem] font-bold leading-none"
          style={{ color: 'var(--accent)' }}
          lang="ar"
          dir="rtl"
        >
          سُكُوْن
        </span>
      </div>
    </div>
  );
}
