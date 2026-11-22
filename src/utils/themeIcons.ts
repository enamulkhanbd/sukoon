import type { ThemeMode } from '../db/database';

interface ThemeIconPalette {
  bg: string;
  stroke: string;
  page: string;
  lines: string;
}

const THEME_ICON_PALETTES: Record<ThemeMode, ThemeIconPalette> = {
  paper: {
    bg: '#1B4D3E',
    stroke: '#C6A253',
    page: '#FAF6EE',
    lines: '#1B4D3E',
  },
  olive: {
    bg: '#2C593D',
    stroke: '#C4AA62',
    page: '#F6F9F3',
    lines: '#2C593D',
  },
  sky: {
    bg: '#0077D8',
    stroke: '#CFE8FF',
    page: '#F2F6FA',
    lines: '#0077D8',
  },
  black: {
    bg: '#141714',
    stroke: '#CFA85C',
    page: '#E8E2D5',
    lines: '#4C9A74',
  },
};

export function buildThemeIconSvg(theme: ThemeMode, rounded = true): string {
  const { bg, stroke, page, lines } =
    THEME_ICON_PALETTES[theme] ?? THEME_ICON_PALETTES.paper;
  const outerRx = rounded ? 112 : 0;
  const innerRx = rounded ? 90 : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${outerRx}" fill="${bg}"/>
  <rect x="28" y="28" width="456" height="456" rx="${innerRx}" fill="none" stroke="${stroke}" stroke-opacity="0.35" stroke-width="4"/>
  <g transform="translate(256 256)" fill="none" stroke="${stroke}" stroke-width="10" stroke-linejoin="round">
    <rect x="-110" y="-110" width="220" height="220" rx="18"/>
    <rect x="-110" y="-110" width="220" height="220" rx="18" transform="rotate(45)"/>
  </g>
  <path d="M256 188 C222 174, 178 176, 152 190 L152 326 C180 312, 222 312, 256 326 C290 312, 332 312, 360 326 L360 190 C334 176, 290 174, 256 188 Z" fill="${page}" stroke="${stroke}" stroke-width="8" stroke-linejoin="round"/>
  <line x1="256" y1="188" x2="256" y2="326" stroke="${stroke}" stroke-width="6"/>
  <line x1="176" y1="220" x2="232" y2="216" stroke="${lines}" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round"/>
  <line x1="176" y1="248" x2="232" y2="244" stroke="${lines}" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round"/>
  <line x1="176" y1="276" x2="220" y2="273" stroke="${lines}" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round"/>
  <line x1="280" y1="216" x2="336" y2="220" stroke="${lines}" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round"/>
  <line x1="280" y1="244" x2="336" y2="248" stroke="${lines}" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round"/>
  <line x1="292" y1="273" x2="336" y2="276" stroke="${lines}" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round"/>
</svg>`;
}

const appleIconCache = new Map<ThemeMode, string>();

function renderSquarePngDataUrl(svg: string, size: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, size, size);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = svgUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Dynamically updates the browser tab SVG favicon and iOS apple-touch-icon PNG
 * to match the active Sukoon theme.
 */
export function applyThemeIcons(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;

  // 1. Live SVG favicon for desktop & mobile browser tabs
  const faviconSvg = buildThemeIconSvg(theme, true);
  const faviconHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(faviconSvg)}`;
  let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!faviconLink) {
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.type = 'image/svg+xml';
    document.head.appendChild(faviconLink);
  }
  faviconLink.href = faviconHref;

  // 2. Live 180x180 PNG apple-touch-icon for iOS Add to Home Screen
  const updateAppleTouchIcon = (pngUrl: string) => {
    let appleLink = document.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]'
    );
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = pngUrl;
  };

  const cached = appleIconCache.get(theme);
  if (cached) {
    updateAppleTouchIcon(cached);
    return;
  }

  // iOS applies its own squircle mask, so use full-bleed square canvas
  const squareSvg = buildThemeIconSvg(theme, false);
  void renderSquarePngDataUrl(squareSvg, 180).then((pngUrl) => {
    if (!pngUrl) return;
    appleIconCache.set(theme, pngUrl);
    if (document.documentElement.getAttribute('data-theme') === theme) {
      updateAppleTouchIcon(pngUrl);
    }
  });
}
