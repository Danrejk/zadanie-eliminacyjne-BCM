import { useEffect, type MouseEvent } from 'react';
import { Archive, Download, X } from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import { PRIORITY_LABELS, formatDisplayDate } from '../utils/dateBuckets';
import { getTagColor } from '../utils/tagColors';
import { downloadJsonFile, serializeArchiveFile } from '../utils/jsonIO';

function formatArchiveTimestamp(isoStr: string): string {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) {
    return isoStr;
  }
  return date.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ArchiveModal() {
  const { state, dispatch } = useTasks();
  const isOpen = state.activeModal.type === 'archive';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'CLOSE_MODAL' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, dispatch]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    dispatch({ type: 'CLOSE_MODAL' });
  };

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleExportArchive = () => {
    downloadJsonFile(
      'archiwum_usunietych.json',
      serializeArchiveFile(state.archive),
    );
    dispatch({
      type: 'SHOW_TOAST',
      payload: {
        type: 'success',
        text: 'Wyeksportowano archiwum do pliku archiwum_usunietych.json.',
      },
    });
  };

  const entries = [...state.archive].reverse();

  return (
    <div
      data-testid="archive-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-modal-title"
      onClick={handleBackdropClick}
      style={{ zIndex: 'var(--z-modal)' }}
      className="fixed inset-0 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-amber-900/40 bg-[#fdf8ee] text-[#2b231d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-900/15 bg-amber-100/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Archive className="h-5 w-5 text-amber-900" aria-hidden="true" />
            <div>
              <h2 id="archive-modal-title" className="text-lg font-bold leading-tight">
                Archiwum usuniętych zadań ({state.archive.length})
              </h2>
              <p className="text-xs text-[#5c4f44]">
                Historia zadań opróżnionych z kosza (oddzielny rejestr archiwum_usunietych.json)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Zamknij archiwum"
            className="rounded-lg p-1.5 text-[#5c4f44] transition-colors hover:bg-amber-900/10 hover:text-[#2b231d]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Entries list */}
        <div className="flex-1 overflow-y-auto p-5">
          {entries.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-amber-900/25 bg-amber-50/50 p-6 text-center text-[#5c4f44]">
              <Archive className="mb-2 h-9 w-9 opacity-40" aria-hidden="true" />
              <p className="text-sm font-medium">Archiwum jest puste</p>
              <p className="mt-1 text-xs opacity-80">
                Po opróżnieniu kosza zarchiwizowane zadania pojawią się tutaj.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.task.id}-${entry.oproznionoDnia}-${index}`}
                  data-testid={`archive-entry-${index}`}
                  className="rounded-xl border border-amber-900/15 bg-white p-3.5 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-semibold text-[#2b231d]">
                      {entry.task.tytul}
                    </div>
                    <span className="rounded-full border border-amber-900/20 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                      {PRIORITY_LABELS[entry.task.priorytet]}
                    </span>
                  </div>

                  {entry.task.opis && (
                    <p className="mt-1 text-xs text-[#5c4f44] line-clamp-2">
                      {entry.task.opis}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5c4f44]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>Termin: {formatDisplayDate(entry.task.termin)}</span>
                      {entry.task.tagi.map((tag, tagIdx) => {
                        const color = getTagColor(tag);
                        return (
                          <span
                            key={`${tag}-${tagIdx}`}
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: color.bg,
                              color: color.text,
                            }}
                          >
                            #{tag}
                          </span>
                        );
                      })}
                    </div>
                    <span>
                      Zarchiwizowano: {formatArchiveTimestamp(entry.oproznionoDnia)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-amber-900/15 bg-amber-50/80 px-5 py-3.5">
          <button
            type="button"
            data-testid="btn-export-archive"
            onClick={handleExportArchive}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-900"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Eksportuj archiwum JSON
          </button>

          <button
            type="button"
            data-testid="btn-close-archive"
            onClick={handleClose}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-[#2b231d] transition-colors hover:bg-stone-100"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
