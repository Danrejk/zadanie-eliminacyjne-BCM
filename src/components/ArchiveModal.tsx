import { Archive, Download } from 'lucide-react';
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

  const handleClose = () => {
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
        <>
          <button
            type="button"
            data-testid="btn-export-archive"
            onClick={handleExportArchive}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-900 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Eksportuj archiwum JSON
          </button>

          <button
            type="button"
            data-testid="btn-close-archive"
            onClick={handleClose}
            className="notebook-surface rounded-lg border px-4 py-2 text-xs font-semibold text-[#2b231d] transition-colors hover:bg-amber-900/10 cursor-pointer"
          >
            Zamknij
          </button>
        </>
      }
    >
      {entries.length === 0 ? (
        <div className="notebook-surface flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-[#5c4f44]">
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
              className="notebook-surface rounded-lg border p-3.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-semibold text-[#2b231d]">
                  {entry.task.tytul}
                </div>
                <span className="rounded-full border border-amber-900/20 bg-amber-50/80 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
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
    </NotebookModal>
  );
}
