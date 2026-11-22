import type { ColorMode, ThemeMode } from '../db/database';

export type ThemeVariantKey = `${ThemeMode}-${ColorMode}`;

export interface ThemeVariantMeta {
  metaColor: string;
  swatchBg: string;
  swatchAccent: string;
  icon: {
    bg: string;
    stroke: string;
    page: string;
    lines: string;
  };
}

/**
 * Single source of truth for all 6 (Theme × Mode) metadata palettes:
 * PWA theme-color, dynamic SVG/PNG icons, and picker swatches.
 */
export const THEME_VARIANT_META: Record<ThemeVariantKey, ThemeVariantMeta> = {
  'paper-light': {
    metaColor: '#FAF6EE',
    swatchBg: '#FAF6EE',
    swatchAccent: '#8C6223',
    icon: {
      bg: '#8C6223',
      stroke: '#F2DCA6',
      page: '#FAF6EE',
      lines: '#8C6223',
    },
  },
  'olive-light': {
    metaColor: '#EEF2EA',
    swatchBg: '#E2E9DC',
    swatchAccent: '#2C593D',
    icon: {
      bg: '#2C593D',
      stroke: '#C4AA62',
      page: '#F6F9F3',
      lines: '#2C593D',
    },
  },
  'sky-light': {
    metaColor: '#F2F6FA',
    swatchBg: '#E6ECF3',
    swatchAccent: '#0077D8',
    icon: {
      bg: '#0077D8',
      stroke: '#CFE8FF',
      page: '#F2F6FA',
      lines: '#0077D8',
    },
  },
  'paper-dark': {
    metaColor: '#110F0C',
    swatchBg: '#1B1712',
    swatchAccent: '#D4A654',
    icon: {
      bg: '#1B1712',
      stroke: '#D4A654',
      page: '#F0E8DA',
      lines: '#8C6A2B',
    },
  },
  'olive-dark': {
    metaColor: '#070907',
    swatchBg: '#111511',
    swatchAccent: '#4C9A74',
    icon: {
      bg: '#111511',
      stroke: '#CFA85C',
      page: '#E6EBE5',
      lines: '#4C9A74',
    },
  },
  'sky-dark': {
    metaColor: '#090E16',
    swatchBg: '#111926',
    swatchAccent: '#4CA3F5',
    icon: {
      bg: '#111926',
      stroke: '#7BB6EB',
      page: '#E7EFF8',
      lines: '#4CA3F5',
    },
  },
};

export function getThemeVariantKey(
  theme: ThemeMode,
  mode: ColorMode
): ThemeVariantKey {
  return `${theme}-${mode}`;
}

export function getThemeVariantMeta(
  theme: ThemeMode,
  mode: ColorMode
): ThemeVariantMeta {
  return (
    THEME_VARIANT_META[getThemeVariantKey(theme, mode)] ??
    THEME_VARIANT_META['paper-light']
  );
}
