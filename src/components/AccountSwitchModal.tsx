import { useState } from 'react';
import { AlertTriangle, CloudDownload, GitMerge, Loader2 } from 'lucide-react';
import {
  resolveAccountConflict,
  useCloudSyncState,
} from '../services/cloudSyncService';
import { useToast } from './ToastProvider';

export function AccountSwitchModal() {
  const toast = useToast();
  const { pendingAccountConflict, syncing } = useCloudSyncState();
  const [busyChoice, setBusyChoice] = useState<'replace' | 'merge' | 'cancel' | null>(null);

  if (!pendingAccountConflict) return null;

  const prevLabel = pendingAccountConflict.previousEmail || 'পূর্ববর্তী অ্যাকাউন্ট';
  const nextLabel = pendingAccountConflict.newEmail || 'নতুন Gmail অ্যাকাউন্ট';

  const handleChoose = async (choice: 'replace' | 'merge' | 'cancel') => {
    setBusyChoice(choice);
    try {
      const ok = await resolveAccountConflict(choice);
      if (choice === 'cancel') {
        toast.info('লগইন বাতিল করা হয়েছে • লোকাল ডেটা অপরিবর্তিত আছে');
      } else if (ok) {
        toast.success(
          choice === 'replace'
            ? 'নতুন অ্যাকাউন্টের ক্লাউড ডেটা লোড হয়েছে'
            : 'লোকাল ও ক্লাউড ডেটা একত্রিত হয়েছে'
        );
      }
    } finally {
      setBusyChoice(null);
    }
  };

  const disabled = syncing || busyChoice !== null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-[3px]"
      style={{ backgroundColor: 'var(--backdrop-scrim)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="account-switch-title"
        className="w-full max-w-md rounded-3xl p-5 border space-y-4 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'var(--gold-soft)',
              color: 'var(--gold)',
            }}
          >
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="space-y-1 min-w-0">
            <h2 id="account-switch-title" className="text-base font-semibold">
              ভিন্ন Gmail অ্যাকাউন্ট শনাক্ত হয়েছে
            </h2>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              এই ডিভাইসে আগে <strong>{prevLabel}</strong>-এর ডেটা সিংক করা ছিল। এখন আপনি{' '}
              <strong>{nextLabel}</strong> দিয়ে লগইন করেছেন। দুই অ্যাকাউন্টের ডেটা যেন মিশে না যায়, নিচের যেকোনো একটি নির্বাচন করুন:
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void handleChoose('replace')}
            className="w-full rounded-2xl p-3.5 text-left flex items-start gap-3 cursor-pointer disabled:opacity-60 transition-opacity active:opacity-85"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            {busyChoice === 'replace' ? (
              <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
            ) : (
              <CloudDownload className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-semibold">
                নতুন অ্যাকাউন্টের ডেটা লোড করুন (সুপারিশকৃত)
              </div>
              <div className="text-[11px] opacity-90 leading-snug">
                আগের অ্যাকাউন্টের লোকাল ডেটা সরিয়ে শুধু {nextLabel}-এর ডেটা রাখবে।
              </div>
            </div>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => void handleChoose('merge')}
            className="w-full rounded-2xl p-3.5 border text-left flex items-start gap-3 cursor-pointer disabled:opacity-60 transition-opacity active:opacity-85"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {busyChoice === 'merge' ? (
              <Loader2
                className="w-4 h-4 mt-0.5 shrink-0 animate-spin"
                style={{ color: 'var(--accent)' }}
              />
            ) : (
              <GitMerge
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
            )}
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-semibold">
                লোকাল ডেটা নতুন অ্যাকাউন্টে একত্রিত (Merge) করুন
              </div>
              <div
                className="text-[11px] leading-snug"
                style={{ color: 'var(--text-secondary)' }}
              >
                ডিভাইসে থাকা বর্তমান দুআ, রুটিন ও ইতিহাস {nextLabel}-এর সাথে যুক্ত হবে।
              </div>
            </div>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => void handleChoose('cancel')}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-center cursor-pointer disabled:opacity-60 transition-opacity active:opacity-75"
            style={{ color: 'var(--text-secondary)' }}
          >
            বাতিল করুন (সাইন-আউট)
          </button>
        </div>
      </div>
    </div>
  );
}
