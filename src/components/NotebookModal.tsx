import {
  useEffect,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';

export interface NotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
  labelledBy: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  closeAriaLabel: string;
  maxWidthClass?: string;
  headerTone?: 'default' | 'danger';
  topAccent?: ReactNode;
  footer?: ReactNode;
  footerJustifyClass?: string;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

export function NotebookModal({
  isOpen,
  onClose,
  testId,
  labelledBy,
  title,
  subtitle,
  icon,
  closeAriaLabel,
  maxWidthClass = 'max-w-lg',
  headerTone = 'default',
  topAccent,
  footer,
  footerJustifyClass = 'justify-end',
  onSubmit,
  children,
}: NotebookModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isDanger = headerTone === 'danger';

  const bodyAndFooter = (
    <>
      <div className="notebook-body-scroll">
        <div className="notebook-body-lined">{children}</div>
      </div>
      {footer && (
        <div className={`notebook-footer ${footerJustifyClass}`}>{footer}</div>
      )}
    </>
  );

  return (
    <div
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={handleBackdropClick}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: 'var(--z-modal)',
        backgroundColor: 'rgba(46, 32, 24, 0.65)',
      }}
    >
      <div
        className={`notebook-sheet ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 3 Binder Punch Holes on Left Margin */}
        <div className="notebook-holes" aria-hidden="true">
          <span className="notebook-hole" />
          <span className="notebook-hole" />
          <span className="notebook-hole" />
        </div>

        {/* Optional Top Accent Strip (e.g. TaskModal priority bar) */}
        {topAccent && (
          <div className="relative z-10 shrink-0">{topAccent}</div>
        )}

        {/* Unlined Top Notebook Header Margin */}
        <div
          className={`notebook-header shrink-0 ${
            isDanger ? 'notebook-header--danger' : ''
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <div className="shrink-0">{icon}</div>}
            <div className="min-w-0">
              <h2
                id={labelledBy}
                className={`text-base sm:text-lg font-bold tracking-tight leading-tight ${
                  isDanger ? 'text-red-950' : ''
                }`}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: 'var(--color-ink-muted)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={closeAriaLabel}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xs border border-transparent transition-colors cursor-pointer ${
              isDanger
                ? 'text-[#5c4f44] hover:bg-red-100 hover:text-red-950'
                : 'text-amber-900/70 hover:bg-amber-900/10 hover:text-amber-950'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Ruled Body + Footer (wrapped in <form> when onSubmit is provided) */}
        {onSubmit ? (
          <form
            noValidate
            onSubmit={onSubmit}
            className="flex flex-1 flex-col min-h-0"
          >
            {bodyAndFooter}
          </form>
        ) : (
          bodyAndFooter
        )}
      </div>
    </div>
  );
}

export default NotebookModal;
