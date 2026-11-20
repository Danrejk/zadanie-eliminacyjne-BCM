import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastMessage } from '../types/task';
import { useTasks } from '../context/TaskContext';

const TOAST_TIMEOUT_DEFAULT_MS = 3500;
const TOAST_TIMEOUT_ERROR_MS = 6000;

const TOAST_STYLES: Record<
  ToastMessage['type'],
  {
    bg: string;
    border: string;
    accent: string;
    text: string;
    label: string;
  }
> = {
  success: {
    bg: '#f0fdf4',
    border: '#16a34a',
    accent: '#15803d',
    text: '#14532d',
    label: 'Sukces',
  },
  error: {
    bg: '#fef2f2',
    border: 'var(--color-stamp-red)',
    accent: 'var(--color-stamp-red)',
    text: '#7f1d1d',
    label: 'Błąd',
  },
  info: {
    bg: '#fdf8ee',
    border: 'var(--color-wood-highlight)',
    accent: 'var(--color-wood-frame)',
    text: 'var(--color-ink)',
    label: 'Informacja',
  },
};

export function Toast() {
  const { state, dispatch } = useTasks();
  const { toast } = state;

  useEffect(() => {
    if (!toast) {
      return;
    }

    const duration =
      toast.type === 'error'
        ? TOAST_TIMEOUT_ERROR_MS
        : TOAST_TIMEOUT_DEFAULT_MS;

    const timerId = window.setTimeout(() => {
      dispatch({ type: 'DISMISS_TOAST' });
    }, duration);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [toast, dispatch]);

  if (!toast) {
    return null;
  }

  const styleConfig = TOAST_STYLES[toast.type];

  const handleDismiss = () => {
    dispatch({ type: 'DISMISS_TOAST' });
  };

  return (
    <div
      data-testid="toast-notification"
      data-toast-type={toast.type}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className="fixed top-20 right-5 z-70 w-full max-w-md rounded-xl border-2 p-4 shadow-2xl transition-all"
      style={{
        zIndex: 'var(--z-toast)',
        backgroundColor: styleConfig.bg,
        borderColor: styleConfig.border,
        color: styleConfig.text,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div
          className="mt-0.5 shrink-0"
          style={{ color: styleConfig.accent }}
          aria-hidden="true"
        >
          {toast.type === 'success' && <CheckCircle2 className="h-5 w-5" />}
          {toast.type === 'error' && <AlertCircle className="h-5 w-5" />}
          {toast.type === 'info' && <Info className="h-5 w-5" />}
        </div>

        {/* Message & Optional Details Bullet List */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-snug break-words">
            {toast.text}
          </p>

          {toast.details && toast.details.length > 0 && (
            <ul
              data-testid="toast-details"
              className="mt-2 max-h-40 overflow-y-auto list-disc pl-4 space-y-1 text-xs font-medium opacity-90"
            >
              {toast.details.map((detail, idx) => (
                <li key={`${idx}-${detail}`} className="break-words">
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Manual Dismiss Button */}
        <button
          type="button"
          data-testid="toast-close-btn"
          onClick={handleDismiss}
          aria-label="Zamknij powiadomienie"
          title="Zamknij powiadomienie"
          className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg opacity-75 hover:opacity-100 hover:bg-black/10 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Toast;
