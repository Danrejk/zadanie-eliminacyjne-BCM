import React, { useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import type { Priority, Task, TaskAction, TimeZone } from '../types/task';
import { useTasks } from '../context/TaskContext';
import {
  canDropIntoZone,
  formatDisplayDate,
  getTimeZone,
  getTodayDateString,
  isOverdue,
} from '../utils/dateBuckets';
import { getNoteRotation, getTagColor, normalizeTag } from '../utils/tagColors';
import { playCrumpleSound, playPinClickSound, playTrashPlopSound } from '../utils/sound';
import { PushPin } from './PushPin';

export const CLICK_DELAY_MS = 230;
export const DRAG_END_RESET_MS = 50;
export const DRAG_THRESHOLD_PX = 6;

export interface PostItNoteProps {
  task: Task;
  zone: TimeZone;
  isDimmed: boolean;
  isDragging: boolean;
  isModalOpen: boolean;
  muted: boolean;
  dispatch: React.Dispatch<TaskAction>;
  todayStr?: string;
}

function isPointInRect(
  x: number,
  y: number,
  rect: DOMRect | null | undefined,
  padding = 0,
): boolean {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  return (
    x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding
  );
}

function findCellAtPoint(
  x: number,
  y: number,
): { priority: Priority; zone: TimeZone } | null {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
    return null;
  }
  const els = document.elementsFromPoint(x, y);
  for (let i = 0; i < els.length; i++) {
    const cell = els[i].closest?.('[data-testid^="zone-cell-"]') as HTMLElement | null;
    if (cell) {
      const priority = cell.dataset.priority as Priority | undefined;
      const zone = cell.dataset.zone as TimeZone | undefined;
      if (priority && zone) {
        return { priority, zone };
      }
    }
  }
  return null;
}

function PostItNoteComponent({
  task,
  zone,
  isDimmed,
  isDragging,
  isModalOpen,
  muted,
  dispatch,
  todayStr,
}: PostItNoteProps) {
  const {
    state,
    trashHitboxRef,
    trashHoopRef,
    trashBodyRef,
    setNoteDrag,
  } = useTasks();

  const clickTimerRef = useRef<number | null>(null);
  const dragResetTimerRef = useRef<number | null>(null);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const wasDraggingRef = useRef<boolean>(false);
  const isCrumplingRef = useRef<boolean>(false);
  const isModalOpenRef = useRef<boolean>(isModalOpen);
  const trashDrawerOpenRef = useRef<boolean>(state.trashDrawerOpen);
  const mutedRef = useRef<boolean>(muted);

  useEffect(() => {
    trashDrawerOpenRef.current = state.trashDrawerOpen;
  }, [state.trashDrawerOpen]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
    if (isModalOpen && clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!task.wykonane) {
      isCrumplingRef.current = false;
    }
  }, [task.id, task.wykonane]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      if (dragResetTimerRef.current !== null) {
        window.clearTimeout(dragResetTimerRef.current);
        dragResetTimerRef.current = null;
      }
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current();
        cleanupListenersRef.current = null;
      }
    };
  }, []);

  const clearClickTimer = () => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.detail >= 2) {
      clearClickTimer();
      return;
    }
    if (wasDraggingRef.current || isCrumplingRef.current || isModalOpenRef.current) {
      return;
    }
    clearClickTimer();
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      if (
        !wasDraggingRef.current &&
        !isCrumplingRef.current &&
        !isModalOpenRef.current
      ) {
        dispatch({
          type: 'OPEN_MODAL',
          payload: { type: 'edit', taskId: task.id },
        });
      }
    }, CLICK_DELAY_MS);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    clearClickTimer();

    if (isCrumplingRef.current) {
      return;
    }
    isCrumplingRef.current = true;

    const rect = e.currentTarget.getBoundingClientRect();
    const hasLayoutBox = rect.width > 0 || rect.height > 0;
    const fallbackX = typeof window !== 'undefined' ? window.innerWidth / 2 : 640;
    const fallbackY = typeof window !== 'undefined' ? window.innerHeight / 3 : 300;

    const originX = hasLayoutBox
      ? Math.round(rect.left + rect.width / 2)
      : Math.round(e.clientX || fallbackX);
    const originY = hasLayoutBox
      ? Math.round(rect.top + rect.height / 2)
      : Math.round(e.clientY || fallbackY);

    playCrumpleSound(muted);
    dispatch({
      type: 'COMPLETE_TO_FLOOR',
      payload: {
        id: task.id,
        originX,
        originY,
      },
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isCrumplingRef.current || isModalOpenRef.current) {
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    let activeDrag = false;
    let lastOverTrash = false;
    let lastCell: { priority: Priority; zone: TimeZone } | null = null;

    const checkOverTrash = (x: number, y: number): boolean => {
      if (trashDrawerOpenRef.current) {
        return (
          isPointInRect(x, y, trashHoopRef.current?.getBoundingClientRect(), 12) ||
          isPointInRect(x, y, trashBodyRef.current?.getBoundingClientRect(), 8)
        );
      }
      return isPointInRect(x, y, trashHitboxRef.current?.getBoundingClientRect(), 12);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      cleanupListenersRef.current = null;
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      const cx = moveEvent.clientX;
      const cy = moveEvent.clientY;

      if (!activeDrag) {
        if (Math.hypot(cx - startX, cy - startY) < DRAG_THRESHOLD_PX) {
          return;
        }
        activeDrag = true;
        clearClickTimer();
        if (dragResetTimerRef.current !== null) {
          window.clearTimeout(dragResetTimerRef.current);
          dragResetTimerRef.current = null;
        }
        wasDraggingRef.current = true;
        dispatch({ type: 'SET_DRAGGING_NOTE', payload: { id: task.id } });
      }

      lastOverTrash = checkOverTrash(cx, cy);
      lastCell = lastOverTrash ? null : findCellAtPoint(cx, cy);

      setNoteDrag({
        taskId: task.id,
        clientX: cx,
        clientY: cy,
        isOverTrash: lastOverTrash,
        hoveredCell: lastCell,
      });
    };

    const finishDrag = (commit: boolean, cx: number, cy: number) => {
      cleanup();
      if (!activeDrag) {
        return;
      }

      const finalOverTrash = commit ? checkOverTrash(cx, cy) : false;
      const finalCell = commit && !finalOverTrash ? findCellAtPoint(cx, cy) : null;

      setNoteDrag(null);
      dispatch({ type: 'SET_DRAGGING_NOTE', payload: { id: null } });

      if (commit) {
        if (finalOverTrash) {
          playTrashPlopSound(mutedRef.current);
          dispatch({ type: 'COMPLETE_TO_TRASH', payload: { id: task.id } });
        } else if (finalCell) {
          const effectiveToday = todayStr ?? getTodayDateString();
          const currentZone = getTimeZone(task.termin, effectiveToday);
          if (
            canDropIntoZone(task.termin, finalCell.zone, effectiveToday) &&
            !(task.priorytet === finalCell.priority && currentZone === finalCell.zone)
          ) {
            playPinClickSound(mutedRef.current);
            dispatch({
              type: 'MOVE_TASK_TO_ZONE',
              payload: {
                id: task.id,
                targetPriority: finalCell.priority,
                targetZone: finalCell.zone,
                todayStr: effectiveToday,
              },
            });
          }
        }
      }

      if (dragResetTimerRef.current !== null) {
        window.clearTimeout(dragResetTimerRef.current);
      }
      dragResetTimerRef.current = window.setTimeout(() => {
        dragResetTimerRef.current = null;
        wasDraggingRef.current = false;
      }, DRAG_END_RESET_MS);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      finishDrag(true, upEvent.clientX, upEvent.clientY);
    };

    const onPointerCancel = () => {
      finishDrag(false, startX, startY);
    };

    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    cleanupListenersRef.current = cleanup;
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    clearClickTimer();
    dispatch({
      type: 'OPEN_CONTEXT_MENU',
      payload: {
        kind: 'note',
        taskId: task.id,
        x: e.clientX,
        y: e.clientY,
      },
    });
  };

  const rotation = getNoteRotation(task.id);
  const variant = Math.abs(task.id) % 3;
  const overdue = isOverdue(task.termin, todayStr);
  const formattedDate = formatDisplayDate(task.termin, todayStr);
  const trimmedDesc = task.opis.trim();

  return (
    <div className="postit-motion-wrapper">
      <div
        data-testid={`postit-note-${task.id}`}
        data-priority={task.priorytet}
        data-zone={zone}
        data-variant={variant}
        data-dimmed={isDimmed ? 'true' : 'false'}
        data-dragging={isDragging ? 'true' : 'false'}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{
          '--note-rotation': `${rotation}deg`,
          touchAction: 'none',
        } as React.CSSProperties}
        className="postit-card"
      >
        <PushPin taskId={task.id} tags={task.tagi} />

        {overdue && (
          <div
            data-testid={`postit-overdue-stamp-${task.id}`}
            className="postit-overdue-stamp"
            aria-label="Zadanie po terminie"
          >
            PO TERMINIE
          </div>
        )}

        <div className="postit-body">
          <h3 className="postit-title">{task.tytul}</h3>

          {trimmedDesc !== '' && (
            <p className="postit-desc">{trimmedDesc}</p>
          )}
        </div>

        <div className="postit-footer">
          <div
            className={`postit-date ${overdue ? 'postit-date--overdue' : ''}`}
            title={task.termin ? `Termin: ${task.termin}` : 'Bez terminu'}
          >
            <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{formattedDate}</span>
          </div>

          {task.tagi.length > 0 && (
            <div className="postit-tags" aria-label="Tagi zadania">
              {task.tagi.map((tag, idx) => {
                const color = getTagColor(tag);
                const normalized = normalizeTag(tag);
                return (
                  <span
                    key={`${normalized}-${idx}`}
                    className="postit-tag-pill"
                    style={{
                      backgroundColor: color.bg,
                      color: color.text,
                      borderColor: color.dark,
                    }}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <span className="postit-corner-fold" aria-hidden="true" />
      </div>
    </div>
  );
}

export const PostItNote = React.memo(PostItNoteComponent);
export default PostItNote;
