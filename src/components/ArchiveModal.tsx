import { useEffect, useState } from 'react';
import { Archive, Download, Trash2 } from 'lucide-react';
import type { ArchiveEntry } from '../types/task';
import { useTasks } from '../context/TaskContext';
import { PRIORITY_LABELS, formatDisplayDate } from '../utils/dateBuckets';
import { getTagColor } from '../utils/tagColors';
import { downloadJsonFile, serializeArchiveFile } from '../utils/jsonIO';
import { NotebookModal } from './NotebookModal';

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
  const [confirmingEntryKey, setConfirmingEntryKey] = useState<string | null>(
    null,
  );
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmingEntryKey(null);
      setConfirmingClearAll(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setConfirmingEntryKey(null);
    setConfirmingClearAll(false);
    dispatch({ type: 'CLOSE_MODAL' });
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

  const handleConfirmDeleteEntry = (entry: ArchiveEntry) => {
    dispatch({
      type: 'DELETE_ARCHIVE_ENTRY',
      payload: {
        taskId: entry.task.id,
        oproznionoDnia: entry.oproznionoDnia,
      },
    });
    setConfirmingEntryKey(null);
    dispatch({
      type: 'SHOW_TOAST',
      payload: {
        type: 'info',
        text: `Usunięto trwale zadanie „${entry.task.tytul}” z archiwum.`,
      },
    });
  };

  const handleConfirmClearAll = () => {
    const count = state.archive.length;
    dispatch({ type: 'CLEAR_ARCHIVE' });
    setConfirmingClearAll(false);
    setConfirmingEntryKey(null);
    dispatch({
      type: 'SHOW_TOAST',
      payload: {
        type: 'info',
        text: `Usunięto trwale wszystkie zadania z archiwum (${count}).`,
      },
    });
  };

  const entries = [...state.archive].reverse();

  return (
    <NotebookModal
      isOpen={isOpen}
      onClose={handleClose}
      testId="archive-modal"
      labelledBy="archive-modal-title"
      maxWidthClass="max-w-2xl"
      icon={<Archive className="h-5 w-5 text-amber-900" aria-hidden="true" />}
      title={`Archiwum usuniętych zadań (${state.archive.length})`}
      subtitle="Historia zadań opróżnionych z kosza (oddzielny rejestr archiwum_usunietych.json)"
      closeAriaLabel="Zamknij archiwum"
      footerJustifyClass="justify-between"
      footer={
        confirmingClearAll ? (
          <div
            data-testid="confirm-clear-archive"
            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xs border border-red-300 bg-red-50/95 px-3 py-2"
          >
            <span className="text-xs font-semibold text-red-900">
              Czy na pewno chcesz wszystko usunąć?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="btn-cancel-clear-archive"
                onClick={() => setConfirmingClearAll(false)}
                className="notebook-pencil-box bg-white px-3 py-1.5 text-xs font-semibold text-[#2b231d] transition-colors hover:bg-amber-900/10 cursor-pointer"
              >
                Nie
              </button>
              <button
                type="button"
                data-testid="btn-confirm-clear-archive"
                onClick={handleConfirmClearAll}
                className="inline-flex items-center gap-1.5 rounded-xs bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-800 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Tak, usuń wszystko
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="btn-export-archive"
                onClick={handleExportArchive}
                className="inline-flex items-center gap-1.5 rounded-xs bg-amber-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-900 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Eksportuj archiwum JSON
              </button>

              <button
                type="button"
                data-testid="btn-clear-archive"
                disabled={entries.length === 0}
                onClick={() => {
                  setConfirmingEntryKey(null);
                  setConfirmingClearAll(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xs border border-red-900/25 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Usuń wszystko
              </button>
            </div>

            <button
              type="button"
              data-testid="btn-close-archive"
              onClick={handleClose}
              className="notebook-pencil-box px-4 py-2 text-xs font-semibold text-[#2b231d] transition-colors hover:bg-amber-900/10 cursor-pointer"
            >
              Zamknij
            </button>
          </>
        )
      }
    >
      {entries.length === 0 ? (
        <div className="notebook-surface flex min-h-[180px] flex-col items-center justify-center rounded-xs border border-dashed p-6 text-center text-[#5c4f44]">
          <Archive className="mb-2 h-9 w-9 opacity-40" aria-hidden="true" />
          <p className="text-sm font-medium">Archiwum jest puste</p>
          <p className="mt-1 text-xs opacity-80">
            Po opróżnieniu kosza zarchiwizowane zadania pojawią się tutaj.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {entries.map((entry, index) => {
            const entryKey = `${entry.task.id}-${entry.oproznionoDnia}-${index}`;
            const isConfirming = confirmingEntryKey === entryKey;

            return (
              <li
                key={entryKey}
                data-testid={`archive-entry-${index}`}
                className="notebook-pencil-box p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-semibold text-[#2b231d]">
                    {entry.task.tytul}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-amber-900/20 bg-amber-50/80 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                      {PRIORITY_LABELS[entry.task.priorytet]}
                    </span>

                    {isConfirming ? (
                      <div
                        data-testid={`confirm-delete-archive-entry-${index}`}
                        className="flex items-center gap-1.5 rounded-xs border border-red-300 bg-red-50 px-2 py-0.5"
                      >
                        <span className="text-[11px] font-semibold text-red-900">
                          Czy na pewno?
                        </span>
                        <button
                          type="button"
                          data-testid={`btn-confirm-delete-archive-entry-${index}`}
                          onClick={() => handleConfirmDeleteEntry(entry)}
                          className="rounded-xs bg-red-700 px-2 py-0.5 text-[11px] font-semibold text-white transition-colors hover:bg-red-800 cursor-pointer"
                        >
                          Tak
                        </button>
                        <button
                          type="button"
                          data-testid={`btn-cancel-delete-archive-entry-${index}`}
                          onClick={() => setConfirmingEntryKey(null)}
                          className="rounded-xs border border-amber-900/20 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#2b231d] transition-colors hover:bg-amber-50 cursor-pointer"
                        >
                          Nie
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid={`btn-delete-archive-entry-${index}`}
                        aria-label={`Usuń trwale zadanie ${entry.task.tytul}`}
                        title="Usuń trwale z archiwum"
                        onClick={() => {
                          setConfirmingClearAll(false);
                          setConfirmingEntryKey(entryKey);
                        }}
                        className="inline-flex items-center gap-1 rounded-xs border border-red-900/20 bg-red-50/80 px-2 py-0.5 text-[11px] font-semibold text-red-800 transition-colors hover:border-red-900/40 hover:bg-red-100 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        Usuń
                      </button>
                    )}
                  </div>
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
            );
          })}
        </ul>
      )}
    </NotebookModal>
  );
}
