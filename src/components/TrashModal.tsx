import { useEffect, useState, type MouseEvent } from 'react';
import { Trash2, X, Sparkles, Archive } from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import { PRIORITY_LABELS, formatDisplayDate } from '../utils/dateBuckets';
import { getTagColor } from '../utils/tagColors';
import { playTrashPlopSound } from '../utils/sound';
import { CrumpledBall } from './CrumpledBall';

export function TrashModal() {
  const { state, dispatch, inTrashTasks, floorBallTasks } = useTasks();
  const [hoveredTaskId, setHoveredTaskId] = useState<number | null>(null);

  const isOpen = state.activeModal.type === 'trash';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.contextMenu === null) {
        e.preventDefault();
        dispatch({ type: 'CLOSE_MODAL' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, state.contextMenu, dispatch]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    setHoveredTaskId(null);
    dispatch({ type: 'CLOSE_MODAL' });
  };

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleOpenBallMenu = (
    taskId: number,
    x: number,
    y: number,
  ) => {
    dispatch({
      type: 'OPEN_CONTEXT_MENU',
      payload: {
        kind: 'trashBall',
        taskId,
        x,
        y,
      },
    });
  };

  const handleSweepFloor = () => {
    if (floorBallTasks.length === 0) {
      return;
    }
    playTrashPlopSound(state.muted);
    dispatch({ type: 'SWEEP_FLOOR_TO_TRASH' });
  };

  const handleOpenEmptySummary = () => {
    if (inTrashTasks.length === 0) {
      return;
    }
    dispatch({ type: 'OPEN_MODAL', payload: { type: 'emptySummary' } });
  };

  return (
    <div
      data-testid="trash-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trash-modal-title"
      onClick={handleBackdropClick}
      style={{ zIndex: 'var(--z-modal)' }}
      className="fixed inset-0 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-amber-900/40 bg-[#fdf8ee] text-[#2b231d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-900/15 bg-amber-100/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Trash2 className="h-5 w-5 text-amber-900" aria-hidden="true" />
            <div>
              <h2 id="trash-modal-title" className="text-lg font-bold leading-tight">
                Kosz na ukończone zadania ({inTrashTasks.length})
              </h2>
              <p className="text-xs text-[#5c4f44]">
                Najedź na kulkę, aby podejrzeć zadanie. Kliknij lub użyj PPM, aby przywrócić albo usunąć.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Zamknij kosz"
            className="rounded-lg p-1.5 text-[#5c4f44] transition-colors hover:bg-amber-900/10 hover:text-[#2b231d]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Enlarged Trash Bin Interior */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="relative min-h-[240px] rounded-2xl border-2 border-dashed border-stone-400/70 bg-gradient-to-b from-stone-200/70 to-stone-300/80 p-6 shadow-inner">
            {inTrashTasks.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center text-center text-[#5c4f44]">
                <Trash2 className="mb-2 h-10 w-10 opacity-40" aria-hidden="true" />
                <p className="text-sm font-medium">Kosz jest pusty</p>
                <p className="mt-1 text-xs opacity-80">
                  Kliknij dwukrotnie karteczkę na tablicy albo przeciągnij ją tutaj, aby ją ukończyć.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-5">
                {inTrashTasks.map((task) => {
                  const isHovered = hoveredTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      className="relative flex flex-col items-center"
                    >
                      <button
                        type="button"
                        data-testid={`trash-ball-${task.id}`}
                        aria-label={`Zadanie w koszu: ${task.tytul}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX || rect.left + rect.width / 2;
                          const y = e.clientY || rect.top + rect.height / 2;
                          handleOpenBallMenu(task.id, x, y);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenBallMenu(task.id, e.clientX, e.clientY);
                        }}
                        onMouseEnter={() => setHoveredTaskId(task.id)}
                        onMouseLeave={() =>
                          setHoveredTaskId((prev) =>
                            prev === task.id ? null : prev,
                          )
                        }
                        onFocus={() => setHoveredTaskId(task.id)}
                        onBlur={() =>
                          setHoveredTaskId((prev) =>
                            prev === task.id ? null : prev,
                          )
                        }
                        className="group rounded-full p-1 transition-transform hover:scale-110 focus:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                      >
                        <CrumpledBall
                          priority={task.priorytet}
                          taskId={task.id}
                          size={52}
                        />
                      </button>

                      {isHovered && (
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-xl border border-amber-900/25 bg-[#fdf8ee] p-2.5 text-left text-xs shadow-xl"
                        >
                          <div className="font-bold text-[#2b231d] line-clamp-2">
                            {task.tytul}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-[#5c4f44]">
                            <span>{formatDisplayDate(task.termin)}</span>
                            <span>{PRIORITY_LABELS[task.priorytet]}</span>
                          </div>
                          {task.tagi.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {task.tagi.map((tag, idx) => {
                                const color = getTagColor(tag);
                                return (
                                  <span
                                    key={`${tag}-${idx}`}
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
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-900/15 bg-amber-50/80 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="btn-sweep-floor"
              disabled={floorBallTasks.length === 0}
              onClick={handleSweepFloor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-800/30 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Zbierz kulki z podłogi ({floorBallTasks.length})
            </button>

            <button
              type="button"
              data-testid="btn-empty-trash"
              disabled={inTrashTasks.length === 0}
              onClick={handleOpenEmptySummary}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              Opróżnij kosz
            </button>
          </div>

          <button
            type="button"
            data-testid="btn-close-trash"
            onClick={handleClose}
            className="rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-xs font-semibold text-[#2b231d] transition-colors hover:bg-stone-100"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
