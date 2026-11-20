import { useMemo } from 'react';
import { Archive, AlertTriangle } from 'lucide-react';
import { PRIORITIES } from '../types/task';
import { useTasks } from '../context/TaskContext';
import { getTodayDateString, isOverdue, PRIORITY_LABELS } from '../utils/dateBuckets';
import { playTrashPlopSound } from '../utils/sound';
import { NotebookModal } from './NotebookModal';

export function EmptySummaryModal() {
  const { state, dispatch, inTrashTasks } = useTasks();
  const isOpen = state.activeModal.type === 'emptySummary';

  const priorityCounts = useMemo(() => {
    const counts = { wysoki: 0, sredni: 0, niski: 0 };
    for (const task of inTrashTasks) {
      counts[task.priorytet] += 1;
    }
    return counts;
  }, [inTrashTasks]);

  const deadlineCounts = useMemo(() => {
    const todayStr = getTodayDateString();
    let onTime = 0;
    let afterDeadline = 0;
    for (const task of inTrashTasks) {
      if (isOverdue(task.termin, todayStr)) {
        afterDeadline += 1;
      } else {
        onTime += 1;
      }
    }
    return { onTime, afterDeadline };
  }, [inTrashTasks]);

  const handleCancel = () => {
    dispatch({ type: 'CLOSE_MODAL' });
  };

  const handleConfirm = () => {
    const count = inTrashTasks.length;
    dispatch({
      type: 'EMPTY_TRASH',
      payload: { emptiedAt: new Date().toISOString() },
    });
    playTrashPlopSound(state.muted);
    dispatch({ type: 'CLOSE_MODAL' });
    dispatch({
      type: 'SHOW_TOAST',
      payload: {
        type: 'success',
        text: `Zarchiwizowano ${count} ukończonych zadań.`,
      },
    });
  };

  return (
    <NotebookModal
      isOpen={isOpen}
      onClose={handleCancel}
      testId="empty-summary-modal"
      labelledBy="empty-summary-title"
      maxWidthClass="max-w-md"
      headerTone="danger"
      icon={
        <AlertTriangle className="h-5 w-5 text-red-700" aria-hidden="true" />
      }
      title="Podsumowanie opróżniania kosza"
      closeAriaLabel="Wróć do kosza"
      footer={
        <>
          <button
            type="button"
            data-testid="btn-cancel-empty-trash"
            onClick={handleCancel}
            className="notebook-pencil-box px-4 py-2 text-xs font-semibold text-[#2b231d] transition-colors hover:bg-amber-900/10 cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            data-testid="btn-confirm-empty-trash"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-xs bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800 cursor-pointer"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            Potwierdź i archiwizuj
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="notebook-pencil-box p-3.5">
          <div className="text-xs font-medium uppercase tracking-wide text-[#5c4f44]">
            Zadania do archiwizacji i usunięcia z listy głównej
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#2b231d]">
            {inTrashTasks.length}
          </div>
        </div>

        {/* Priority breakdown */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5c4f44]">
            Według priorytetu
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map((priority) => (
              <div
                key={priority}
                className="notebook-pencil-box px-3 py-2 text-center"
              >
                <div className="text-xs text-[#5c4f44]">
                  {PRIORITY_LABELS[priority]}
                </div>
                <div className="text-base font-bold text-[#2b231d]">
                  {priorityCounts[priority]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deadline completion breakdown */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5c4f44]">
            Termin ukończenia
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div
              data-testid="summary-on-time"
              className="notebook-pencil-box px-3 py-3 text-center"
            >
              <div className="text-xs text-[#5c4f44]">Na czas</div>
              <div className="text-xl font-bold text-[#2b231d]">
                {deadlineCounts.onTime}
              </div>
            </div>
            <div
              data-testid="summary-after-deadline"
              className="notebook-pencil-box px-3 py-3 text-center"
            >
              <div className="text-xs text-[#5c4f44]">Po terminie</div>
              <div className="text-xl font-bold text-[#2b231d]">
                {deadlineCounts.afterDeadline}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#5c4f44]">
          Zadania zostaną przeniesione do osobnego archiwum (
          <code className="rounded bg-amber-900/10 px-1">
            archiwum_usunietych.json
          </code>
          ) i usunięte z głównego pliku{' '}
          <code className="rounded bg-amber-900/10 px-1">zadania.json</code>.
        </p>
      </div>
    </NotebookModal>
  );
}
