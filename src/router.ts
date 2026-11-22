import type { AppTab } from './components/BottomNav';
import { DUA_CHAPTER_MAP, DUA_MAP } from './data/duas';
import { SURAH_MAP } from './data/surahs';

export type AppRoute =
  | { type: 'tab'; tab: AppTab; duaChapterId?: number | null }
  | { type: 'surah'; surahId: number; initialAyah: number }
  | { type: 'dua'; duaId: string }
  | { type: 'ramadan' }
  | { type: 'routineDetail'; routineId: string }
  | {
      type: 'routineRead';
      routineId: string;
      itemIndex: number;
      ayah?: number;
    };

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function parsePositiveInt(raw: string | null | undefined): number | undefined {
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseRoute(
  pathname = window.location.pathname,
  search = window.location.search
): AppRoute {
  const path = normalizePathname(pathname);
  const params = new URLSearchParams(search);

  if (path === '/') {
    return { type: 'tab', tab: 'home' };
  }
  if (path === '/surahs') {
    return { type: 'tab', tab: 'surahs' };
  }
  if (path === '/duas') {
    return { type: 'tab', tab: 'duas', duaChapterId: null };
  }
  if (path === '/routines') {
    return { type: 'tab', tab: 'routines' };
  }
  if (path === '/profile' || path === '/stats') {
    return { type: 'tab', tab: 'profile' };
  }
  if (path === '/settings') {
    return { type: 'tab', tab: 'home' };
  }
  if (path === '/ramadan') {
    return { type: 'ramadan' };
  }

  const duaChapterMatch = /^\/duas\/chapter\/(\d+)$/.exec(path);
  if (duaChapterMatch) {
    const chId = parsePositiveInt(duaChapterMatch[1]);
    if (chId && DUA_CHAPTER_MAP[chId]) {
      return { type: 'tab', tab: 'duas', duaChapterId: chId };
    }
    return { type: 'tab', tab: 'duas', duaChapterId: null };
  }

  const surahMatch = /^\/surah\/(\d+)$/.exec(path);
  if (surahMatch) {
    const surahId = parsePositiveInt(surahMatch[1]);
    const meta = surahId ? SURAH_MAP[surahId] : undefined;
    if (surahId && meta) {
      const ayah = parsePositiveInt(params.get('ayah')) ?? 1;
      return {
        type: 'surah',
        surahId,
        initialAyah: Math.min(Math.max(ayah, 1), meta.versesCount),
      };
    }
    return { type: 'tab', tab: 'surahs' };
  }

  const duaMatch = /^\/dua\/([^/]+)$/.exec(path);
  if (duaMatch) {
    let duaId = duaMatch[1];
    try {
      duaId = decodeURIComponent(duaId);
    } catch {
      return { type: 'tab', tab: 'duas', duaChapterId: null };
    }
    if (DUA_MAP[duaId]) {
      return { type: 'dua', duaId };
    }
    return { type: 'tab', tab: 'duas', duaChapterId: null };
  }

  const routineReadMatch = /^\/routines\/([^/]+)\/read\/(\d+)$/.exec(path);
  if (routineReadMatch) {
    let routineId = routineReadMatch[1];
    try {
      routineId = decodeURIComponent(routineId);
    } catch {
      return { type: 'tab', tab: 'routines' };
    }
    const itemIndex = Number.parseInt(routineReadMatch[2], 10);
    if (routineId && Number.isSafeInteger(itemIndex) && itemIndex >= 0) {
      return {
        type: 'routineRead',
        routineId,
        itemIndex,
        ayah: parsePositiveInt(params.get('ayah')),
      };
    }
    return { type: 'tab', tab: 'routines' };
  }

  const routineDetailMatch = /^\/routines\/([^/]+)$/.exec(path);
  if (routineDetailMatch) {
    let routineId = routineDetailMatch[1];
    try {
      routineId = decodeURIComponent(routineId);
    } catch {
      return { type: 'tab', tab: 'routines' };
    }
    if (routineId) {
      return { type: 'routineDetail', routineId };
    }
    return { type: 'tab', tab: 'routines' };
  }

  return { type: 'tab', tab: 'home' };
}

export function buildPath(route: AppRoute): string {
  switch (route.type) {
    case 'tab': {
      switch (route.tab) {
        case 'home':
          return '/';
        case 'surahs':
          return '/surahs';
        case 'duas':
          return route.duaChapterId
            ? `/duas/chapter/${route.duaChapterId}`
            : '/duas';
        case 'routines':
          return '/routines';
        case 'profile':
          return '/profile';
      }
    }
    case 'surah':
      return route.initialAyah > 1
        ? `/surah/${route.surahId}?ayah=${route.initialAyah}`
        : `/surah/${route.surahId}`;
    case 'dua':
      return `/dua/${encodeURIComponent(route.duaId)}`;
    case 'ramadan':
      return '/ramadan';
    case 'routineDetail':
      return `/routines/${encodeURIComponent(route.routineId)}`;
    case 'routineRead':
      return route.ayah && route.ayah > 1
        ? `/routines/${encodeURIComponent(route.routineId)}/read/${route.itemIndex}?ayah=${route.ayah}`
        : `/routines/${encodeURIComponent(route.routineId)}/read/${route.itemIndex}`;
  }
}

export function isReaderRoute(route: AppRoute): boolean {
  return (
    route.type === 'surah' ||
    route.type === 'dua' ||
    route.type === 'routineRead'
  );
}

export function hidesBottomNav(route: AppRoute): boolean {
  return (
    isReaderRoute(route) ||
    route.type === 'ramadan' ||
    route.type === 'routineDetail' ||
    (route.type === 'tab' &&
      route.tab === 'duas' &&
      Boolean(route.duaChapterId))
  );
}
