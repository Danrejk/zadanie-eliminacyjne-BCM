import { useMemo } from 'react';
import { Archive, AlertTriangle } from 'lucide-react';
import { PRIORITIES } from '../types/task';
import { useTasks } from '../context/TaskContext';
import { PRIORITY_LABELS } from '../utils/dateBuckets';
import { getTagColor, normalizeTag } from '../utils/tagColors';
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

  const tagBreakdown = useMemo(() => {
    const tagMap = new Map<string, { label: string; count: number }>();
    let untaggedCount = 0;

    for (const task of inTrashTasks) {
      if (task.tagi.length === 0) {
        untaggedCount += 1;
        continue;
      }
      const seenInTask = new Set<string>();
      for (const rawTag of task.tagi) {
        const norm = normalizeTag(rawTag);
        if (!norm || seenInTask.has(norm)) {
          continue;
        }
        seenInTask.add(norm);
        const existing = tagMap.get(norm);
        if (existing) {
          existing.count += 1;
        } else {
          tagMap.set(norm, { label: rawTag.trim(), count: 1 });
        }
      }
    }

    return {
      tags: Array.from(tagMap.entries()).sort((a, b) => b[1].count - a[1].count),
      untaggedCount,
    };
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
            className="notebook-surface rounded-lg border px-4 py-2 text-xs font-semibold text-[#2b231d] transition-colors hover:bg-amber-900/10 cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            data-testid="btn-confirm-empty-trash"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800 cursor-pointer"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            Potwierdź i archiwizuj
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="notebook-surface rounded-lg border p-3.5">
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
                className="notebook-surface rounded-lg border px-3 py-2 text-center"
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

        {/* Tag / Pin color breakdown */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5c4f44]">
            Według tagów (kolorów pinezek)
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {tagBreakdown.tags.map(([norm, info]) => {
              const color = getTagColor(norm);
              return (
                <span
                  key={norm}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-xs"
                  style={{
                    backgroundColor: color.bg,
                    color: color.text,
                  }}
                >
                  <span>#{info.label}</span>
                  <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px]">
                    {info.count}
                  </span>
                </span>
              );
            })}
            {tagBreakdown.untaggedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-stone-100/80 px-2.5 py-1 text-xs font-semibold text-stone-700">
                <span>Bez tagów</span>
                <span className="rounded-full bg-stone-300/70 px-1.5 text-[10px]">
                  {tagBreakdown.untaggedCount}
                </span>
              </span>
            )}
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
