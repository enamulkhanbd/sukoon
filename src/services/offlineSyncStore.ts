import { useSyncExternalStore } from 'react';
import {
  downloadAllSurahsForOffline,
  type OfflineDownloadProgress,
} from './quranApi';
import { toBanglaDigits } from '../utils/formatters';

export interface OfflineSyncState {
  downloading: boolean;
  progress: OfflineDownloadProgress | null;
}

type ToastNotifier = {
  success: (msg: string) => void;
  warning: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

let state: OfflineSyncState = {
  downloading: false,
  progress: null,
};

let activeController: AbortController | null = null;
const listeners = new Set<() => void>();

function emit(next: OfflineSyncState) {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeOfflineSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfflineSyncSnapshot(): OfflineSyncState {
  return state;
}

export function useOfflineSync(): OfflineSyncState {
  return useSyncExternalStore(subscribeOfflineSync, getOfflineSyncSnapshot);
}

export async function startOfflineSync(toast: ToastNotifier): Promise<void> {
  if (state.downloading) return;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    toast.warning('ইন্টারনেট সংযোগ নেই। অনলাইনে এসে ডাউনলোড করুন।');
    return;
  }

  const controller = new AbortController();
  activeController = controller;
  emit({ downloading: true, progress: state.progress });
  toast.info('অফলাইন ডাউনলোড শুরু হয়েছে...');

  try {
    const result = await downloadAllSurahsForOffline((prog) => {
      emit({ downloading: true, progress: prog });
    }, controller.signal);

    if (controller.signal.aborted) {
      toast.warning(
        `ডাউনলোড স্থগিত করা হয়েছে (${toBanglaDigits(
          result.totalCached
        )}/১১৪ সংরক্ষিত)।`
      );
    } else if (result.failedIds.length > 0) {
      toast.warning(
        `${toBanglaDigits(result.totalCached)}/১১৪ সূরা ডাউনলোড হয়েছে। ${toBanglaDigits(
          result.failedIds.length
        )}টি সূরা ব্যর্থ হয়েছে—পুনরায় চেষ্টা করুন।`
      );
    } else {
      toast.success('সম্পূর্ণ কুরআন (১১৪ সূরা) অফলাইনের জন্য সংরক্ষিত হয়েছে।');
    }
  } catch {
    toast.error('ডাউনলোডের সময় ত্রুটি হয়েছে। ইন্টারনেট সংযোগ পরীক্ষা করুন।');
  } finally {
    activeController = null;
    emit({ downloading: false, progress: null });
  }
}

export function cancelOfflineSync(): void {
  activeController?.abort();
}
