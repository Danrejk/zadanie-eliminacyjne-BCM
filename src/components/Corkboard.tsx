import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, RotateCcw, Sparkles } from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import {
  PRIORITIES,
  TIME_ZONES,
  type Priority,
  type Task,
  type TaskAction,
  type TimeZone,
} from '../types/task';
import {
  canDropIntoZone,
  compareTasksInCell,
  getTimeZone,
  getTodayDateString,
  PRIORITY_LABELS,
  TIME_ZONE_LABELS,
} from '../utils/dateBuckets';
import { playPinClickSound } from '../utils/sound';
import { PostItNote } from './PostItNote';

export interface CorkboardProps {
  /**
   * Optional "YYYY-MM-DD" override for deterministic unit testing.
   * Defaults to getTodayDateString() (local calendar date).
   */
  todayStr?: string;
}

const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  wysoki: '#fb7185',
  sredni: '#facc15',
  niski: '#34d399',
};

const PRIORITY_SUBLABELS: Record<Priority, string> = {
  wysoki: 'Pilne / ważne',
  sredni: 'Standardowe',
  niski: 'Na spokojnie',
};

const TASK_ID_RE = /^\d+$/;

function parseTaskIdFromDataTransfer(
  e?: React.DragEvent<HTMLElement>,
): number | null {
  if (!e?.dataTransfer) {
    return null;
  }
  try {
    const customRaw = (
      e.dataTransfer.getData('application/x-smartapp-task-id') || ''
    ).trim();
    const plainRaw = (e.dataTransfer.getData('text/plain') || '').trim();
    const candidate = customRaw || plainRaw;
    if (!TASK_ID_RE.test(candidate)) {
      return null;
    }
    const parsed = Number(candidate);
    return Number.isSafeInteger(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isExternalNonTaskDrag(e: React.DragEvent<HTMLElement>): boolean {
  try {
    const types = e.dataTransfer?.types;
    if (!types || types.length === 0) {
      return false;
    }
    const typeList = Array.from(types);
    return (
      !typeList.includes('application/x-smartapp-task-id') &&
      !typeList.includes('text/plain')
    );
  } catch {
    return false;
  }
}

interface CorkboardCellProps {
  priority: Priority;
  zone: TimeZone;
  cellTasks: Task[];
  dropState: 'idle' | 'valid' | 'blocked';
  isHighlightMode: boolean;
  matchingTaskIds: Set<number>;
  draggingNoteId: number | null;
  isModalOpen: boolean;
  muted: boolean;
  effectiveToday: string;
  dispatch: React.Dispatch<TaskAction>;
  onDragEnterCell: (
    priority: Priority,
    zone: TimeZone,
    e: React.DragEvent<HTMLDivElement>,
  ) => void;
  onDragOverCell: (
    priority: Priority,
    zone: TimeZone,
    e: React.DragEvent<HTMLDivElement>,
  ) => void;
  onDragLeaveCell: (
    priority: Priority,
    zone: TimeZone,
    e: React.DragEvent<HTMLDivElement>,
  ) => void;
  onDropCell: (
    priority: Priority,
    zone: TimeZone,
    e: React.DragEvent<HTMLDivElement>,
  ) => void;
}

const CorkboardCell = React.memo(function CorkboardCell({
  priority,
  zone,
  cellTasks,
  dropState,
  isHighlightMode,
  matchingTaskIds,
  draggingNoteId,
  isModalOpen,
  muted,
  effectiveToday,
  dispatch,
  onDragEnterCell,
  onDragOverCell,
  onDragLeaveCell,
  onDropCell,
}: CorkboardCellProps) {
  const isOverdueCol = zone === 'overdue';

  return (
    <div
      data-testid={`zone-cell-${priority}-${zone}`}
      data-priority={priority}
      data-zone={zone}
      data-drop-state={dropState}
      onDragEnter={(e) => onDragEnterCell(priority, zone, e)}
      onDragOver={(e) => onDragOverCell(priority, zone, e)}
      onDragLeave={(e) => onDragLeaveCell(priority, zone, e)}
      onDrop={(e) => onDropCell(priority, zone, e)}
      className={`corkboard-cell flex flex-wrap items-start content-start gap-3 ${
        isOverdueCol ? 'corkboard-cell--overdue' : ''
      } ${
        dropState === 'valid'
          ? 'corkboard-cell--drop-valid'
          : dropState === 'blocked'
            ? 'corkboard-cell--drop-blocked'
            : ''
      }`}
    >
      {dropState === 'blocked' && isOverdueCol && (
        <div className="absolute top-1.5 inset-x-2 z-20 px-2 py-1 rounded bg-rose-900/90 text-rose-50 text-[11px] font-semibold flex items-center justify-center gap-1 shadow-md pointer-events-none">
          <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Tylko odczyt (po terminie)</span>
        </div>
      )}

      {cellTasks.map((task) => {
        const isDimmed = isHighlightMode && !matchingTaskIds.has(task.id);
        return (
          <PostItNote
            key={task.id}
            task={task}
            zone={zone}
            isDimmed={isDimmed}
            isDragging={draggingNoteId === task.id}
            isModalOpen={isModalOpen}
            muted={muted}
            dispatch={dispatch}
            todayStr={effectiveToday}
          />
        );
      })}
    </div>
  );
});

export function Corkboard({ todayStr }: CorkboardProps) {
  const { state, dispatch, activeTasks, matchingTaskIds, noteDrag } = useTasks();
  const effectiveToday = todayStr ?? getTodayDateString();

  const [hoveredCell, setHoveredCell] = useState<{
    priority: Priority;
    zone: TimeZone;
    draggedTaskId: number | null;
  } | null>(null);

  const activeTasksRef = useRef(activeTasks);
  activeTasksRef.current = activeTasks;
  const draggingNoteIdRef = useRef(state.draggingNoteId);
  draggingNoteIdRef.current = state.draggingNoteId;
  const effectiveTodayRef = useRef(effectiveToday);
  effectiveTodayRef.current = effectiveToday;
  const mutedRef = useRef(state.muted);
  mutedRef.current = state.muted;

  useEffect(() => {
    if (state.draggingNoteId === null) {
      setHoveredCell(null);
    }
  }, [state.draggingNoteId]);

  const cellsMap = useMemo(() => {
    const map: Record<Priority, Record<TimeZone, Task[]>> = {
      wysoki: {
        overdue: [],
        todayTomorrow: [],
        thisWeek: [],
        later: [],
        noDeadline: [],
      },
      sredni: {
        overdue: [],
        todayTomorrow: [],
        thisWeek: [],
        later: [],
        noDeadline: [],
      },
      niski: {
        overdue: [],
        todayTomorrow: [],
        thisWeek: [],
        later: [],
        noDeadline: [],
      },
    };

    const isFilterMode = state.filters.filterMode === 'filter';

    for (const task of activeTasks) {
      if (isFilterMode && !matchingTaskIds.has(task.id)) {
        continue;
      }
      const zone = getTimeZone(task.termin, effectiveToday);
      map[task.priorytet][zone].push(task);
    }

    for (const priority of PRIORITIES) {
      for (const zone of TIME_ZONES) {
        map[priority][zone].sort(compareTasksInCell);
      }
    }

    return map;
  }, [activeTasks, matchingTaskIds, state.filters.filterMode, effectiveToday]);

  const resolveDraggedTask = useCallback(
    (e?: React.DragEvent<HTMLElement>): Task | null => {
      const currentDraggingId = draggingNoteIdRef.current;
      const tasks = activeTasksRef.current;
      if (currentDraggingId !== null) {
        const fromState = tasks.find((t) => t.id === currentDraggingId);
        if (fromState) {
          return fromState;
        }
      }

      const parsedId = parseTaskIdFromDataTransfer(e);
      if (parsedId !== null) {
        return tasks.find((t) => t.id === parsedId) ?? null;
      }

      return null;
    },
    [],
  );

  const handleDragEnter = useCallback(
    (
      priority: Priority,
      zone: TimeZone,
      e: React.DragEvent<HTMLDivElement>,
    ) => {
      const draggedTask = resolveDraggedTask(e);
      if (
        !draggedTask &&
        draggingNoteIdRef.current === null &&
        isExternalNonTaskDrag(e)
      ) {
        return;
      }
      const draggedTaskId = draggedTask?.id ?? null;

      setHoveredCell((prev) =>
        prev?.priority === priority &&
        prev?.zone === zone &&
        prev?.draggedTaskId === draggedTaskId
          ? prev
          : { priority, zone, draggedTaskId },
      );
    },
    [resolveDraggedTask],
  );

  const handleDragOver = useCallback(
    (
      priority: Priority,
      zone: TimeZone,
      e: React.DragEvent<HTMLDivElement>,
    ) => {
      const draggedTask = resolveDraggedTask(e);
      if (
        !draggedTask &&
        draggingNoteIdRef.current === null &&
        isExternalNonTaskDrag(e)
      ) {
        return;
      }
      const draggedTaskId = draggedTask?.id ?? null;
      const allowed = draggedTask
        ? canDropIntoZone(draggedTask.termin, zone, effectiveTodayRef.current)
        : zone !== 'overdue';

      setHoveredCell((prev) =>
        prev?.priority === priority &&
        prev?.zone === zone &&
        prev?.draggedTaskId === draggedTaskId
          ? prev
          : { priority, zone, draggedTaskId },
      );

      if (!allowed) {
        try {
          e.dataTransfer.dropEffect = 'none';
        } catch {
          // Ignore in synthetic jsdom events where dropEffect may be read-only
        }
        return;
      }

      e.preventDefault();
      try {
        e.dataTransfer.dropEffect = 'move';
      } catch {
        // Ignore in synthetic jsdom events
      }
    },
    [resolveDraggedTask],
  );

  const handleDragLeave = useCallback(
    (
      priority: Priority,
      zone: TimeZone,
      e: React.DragEvent<HTMLDivElement>,
    ) => {
      const nextTarget = e.relatedTarget as Node | null;
      if (nextTarget && e.currentTarget.contains(nextTarget)) {
        return;
      }
      setHoveredCell((prev) =>
        prev?.priority === priority && prev?.zone === zone ? null : prev,
      );
    },
    [],
  );

  const handleDrop = useCallback(
    (
      priority: Priority,
      zone: TimeZone,
      e: React.DragEvent<HTMLDivElement>,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setHoveredCell(null);

      const draggedTask = resolveDraggedTask(e);
      if (!draggedTask) {
        if (draggingNoteIdRef.current !== null) {
          dispatch({ type: 'SET_DRAGGING_NOTE', payload: { id: null } });
        }
        return;
      }

      const today = effectiveTodayRef.current;

      // 1. Read-only "Po terminie" guard (rejects cross-column drop of non-overdue task into 'overdue')
      if (!canDropIntoZone(draggedTask.termin, zone, today)) {
        if (draggingNoteIdRef.current !== null) {
          dispatch({ type: 'SET_DRAGGING_NOTE', payload: { id: null } });
        }
        return;
      }

      // 2. Same-cell no-op guard (no sound, no state mutation)
      const currentZone = getTimeZone(draggedTask.termin, today);
      if (draggedTask.priorytet === priority && currentZone === zone) {
        if (draggingNoteIdRef.current !== null) {
          dispatch({ type: 'SET_DRAGGING_NOTE', payload: { id: null } });
        }
        return;
      }

      // 3. Valid cross-cell drop (including vertical move of an overdue task within 'overdue')
      playPinClickSound(mutedRef.current);
      dispatch({
        type: 'MOVE_TASK_TO_ZONE',
        payload: {
          id: draggedTask.id,
          targetPriority: priority,
          targetZone: zone,
          todayStr: today,
        },
      });
    },
    [dispatch, resolveDraggedTask],
  );

  const isBoardEmpty = activeTasks.length === 0;
  const isFilterEmpty = activeTasks.length > 0 && matchingTaskIds.size === 0;
  const isHighlightMode = state.filters.filterMode === 'highlight';
  const activeDraggedTask =
    state.draggingNoteId !== null
      ? activeTasks.find((t) => t.id === state.draggingNoteId) ?? null
      : null;

  return (
    <section
      data-testid="corkboard"
      data-drawer-open={state.trashDrawerOpen ? 'true' : 'false'}
      aria-label="Tablica korkowa zadań 3x5"
      className={`corkboard-shift-wrapper w-full max-w-[1640px] mx-auto px-3 sm:px-6 pt-3 pb-28 ${
        state.trashDrawerOpen ? 'corkboard-shift-wrapper--drawer-open' : ''
      }`}
    >
      <div className="corkboard-wood-frame">
        <div className="corkboard-surface">
          {/* Empty Board Banner */}
          {isBoardEmpty && (
            <div
              data-testid="corkboard-empty-state"
              className="mx-4 mt-4 mb-1 px-4 py-3 rounded-lg bg-amber-50/95 border border-amber-900/30 shadow-md flex items-center justify-center gap-2.5 text-amber-950 text-sm font-medium"
            >
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>
                Tablica jest pusta — dodaj nowe zadanie lub wczytaj plik JSON.
              </span>
            </div>
          )}

          {/* Empty Filter Match Hint Banner */}
          {isFilterEmpty && (
            <div
              data-testid="corkboard-empty-filter-hint"
              className="mx-4 mt-4 mb-1 px-4 py-3 rounded-lg bg-amber-50/95 border border-amber-900/30 shadow-md flex flex-wrap items-center justify-between gap-3 text-amber-950 text-sm font-medium"
            >
              <span>Brak zadań pasujących do aktywnych filtrów.</span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESET_FILTERS' })}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-800 hover:bg-amber-900 text-amber-50 text-xs font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Wyczyść filtry
              </button>
            </div>
          )}

          {/* 3x5 Corkboard Grid Container */}
          <div className="min-w-[1240px]">
            {/* X-Axis Column Headers (LEFT -> RIGHT) */}
            <div
              className="grid grid-cols-[128px_repeat(5,minmax(222px,1fr))] border-b-2 border-dashed"
              style={{ borderColor: 'var(--color-string-divider)' }}
            >
              <div className="p-3 flex items-center justify-center border-r-2 border-dashed" style={{ borderColor: 'var(--color-string-divider)' }}>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-900/75 bg-amber-100/70 px-2.5 py-1 rounded border border-amber-900/20">
                  Priorytet \ Czas
                </span>
              </div>

              {TIME_ZONES.map((zone) => {
                const isOverdueCol = zone === 'overdue';
                return (
                  <div
                    key={zone}
                    className={`p-3 flex flex-col items-center justify-center gap-1 border-r-2 last:border-r-0 border-dashed ${
                      isOverdueCol ? 'bg-rose-950/5' : ''
                    }`}
                    style={{ borderColor: 'var(--color-string-divider)' }}
                  >
                    <div
                      className={`corkboard-header-tape text-xs sm:text-sm ${
                        isOverdueCol ? 'corkboard-header-tape--overdue' : ''
                      }`}
                    >
                      {isOverdueCol && (
                        <Lock
                          className="w-3.5 h-3.5 text-rose-800 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span>{TIME_ZONE_LABELS[zone]}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Y-Axis Priority Rows (TOP -> BOTTOM: wysoki, sredni, niski) */}
            {PRIORITIES.map((priority) => (
              <div
                key={priority}
                className="grid grid-cols-[128px_repeat(5,minmax(222px,1fr))]"
              >
                {/* Row Label Header */}
                <div
                  className="p-3 flex flex-col items-center justify-center gap-1.5 border-r-2 border-b-2 border-dashed bg-stone-950/10"
                  style={{ borderColor: 'var(--color-string-divider)' }}
                >
                  <div className="corkboard-header-tape text-xs sm:text-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/25"
                      style={{ backgroundColor: PRIORITY_DOT_COLORS[priority] }}
                      aria-hidden="true"
                    />
                    <span>{PRIORITY_LABELS[priority]}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-stone-950/75 text-center leading-tight">
                    {PRIORITY_SUBLABELS[priority]}
                  </span>
                </div>

                {/* 5 Time-Zone Drop Cells for this Priority Row */}
                {TIME_ZONES.map((zone) => {
                  const cellTasks = cellsMap[priority][zone];
                  const isHovered =
                    (hoveredCell?.priority === priority &&
                      hoveredCell?.zone === zone) ||
                    (noteDrag?.hoveredCell?.priority === priority &&
                      noteDrag?.hoveredCell?.zone === zone);

                  const cellDraggedTask =
                    activeDraggedTask ??
                    (isHovered && hoveredCell?.draggedTaskId != null
                      ? activeTasks.find(
                          (t) => t.id === hoveredCell.draggedTaskId,
                        ) ?? null
                      : null);

                  const isDropAllowed = cellDraggedTask
                    ? canDropIntoZone(
                        cellDraggedTask.termin,
                        zone,
                        effectiveToday,
                      )
                    : zone !== 'overdue';

                  const dropState: 'idle' | 'valid' | 'blocked' = !isHovered
                    ? 'idle'
                    : isDropAllowed
                      ? 'valid'
                      : 'blocked';

                  const cellDraggingNoteId =
                    state.draggingNoteId !== null &&
                    cellTasks.some((t) => t.id === state.draggingNoteId)
                      ? state.draggingNoteId
                      : null;

                  return (
                    <CorkboardCell
                      key={`${priority}-${zone}`}
                      priority={priority}
                      zone={zone}
                      cellTasks={cellTasks}
                      dropState={dropState}
                      isHighlightMode={isHighlightMode}
                      matchingTaskIds={matchingTaskIds}
                      draggingNoteId={cellDraggingNoteId}
                      isModalOpen={
                        state.activeModal.type !== 'none' || state.trashDrawerOpen
                      }
                      muted={state.muted}
                      effectiveToday={effectiveToday}
                      dispatch={dispatch}
                      onDragEnterCell={handleDragEnter}
                      onDragOverCell={handleDragOver}
                      onDragLeaveCell={handleDragLeave}
                      onDropCell={handleDrop}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Corkboard;
