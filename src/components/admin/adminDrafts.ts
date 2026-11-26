export type DraftScope = 'duas' | 'chapters' | 'routines' | 'featured';

export interface StoredDraft<T> {
  id: string;
  savedAt: number;
  data: T;
}

const STORAGE_PREFIX = 'sukoon-studio-drafts-v1:';

export function loadDraftsMap<T>(scope: DraftScope): Record<string, StoredDraft<T>> {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + scope);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredDraft<T>>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

export function saveDraftToStorage<T>(
  scope: DraftScope,
  id: string,
  data: T
): Record<string, StoredDraft<T>> {
  const current = loadDraftsMap<T>(scope);
  const next: Record<string, StoredDraft<T>> = {
    ...current,
    [id]: { id, savedAt: Date.now(), data },
  };
  try {
    window.localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function deleteDraftFromStorage<T>(
  scope: DraftScope,
  id: string
): Record<string, StoredDraft<T>> {
  const current = loadDraftsMap<T>(scope);
  if (!(id in current)) return current;
  const next = { ...current };
  delete next[id];
  try {
    window.localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}
