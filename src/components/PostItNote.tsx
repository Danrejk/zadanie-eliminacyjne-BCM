import React, { useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import type { Task, TaskAction, TimeZone } from '../types/task';
import { formatDisplayDate, isOverdue } from '../utils/dateBuckets';
import { getNoteRotation, getTagColor, normalizeTag } from '../utils/tagColors';
import { playCrumpleSound } from '../utils/sound';
import { PushPin } from './PushPin';

export const CLICK_DELAY_MS = 230;
export const DRAG_END_RESET_MS = 50;

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
  const clickTimerRef = useRef<number | null>(null);
  const dragResetTimerRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const wasDraggingRef = useRef<boolean>(false);
  const isCrumplingRef = useRef<boolean>(false);
  const isModalOpenRef = useRef<boolean>(isModalOpen);

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
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    clearClickTimer();
    if (dragResetTimerRef.current !== null) {
      window.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }
    wasDraggingRef.current = true;

    if (e.dataTransfer) {
      try {
        e.dataTransfer.setData('application/x-smartapp-task-id', String(task.id));
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
      } catch {
        // Safe fallback for partial or frozen synthetic DataTransfer objects in tests
      }
    }

    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        dispatch({ type: 'SET_DRAGGING_NOTE', payload: { id: task.id } });
      });
    } else {
      dispatch({ type: 'SET_DRAGGING_NOTE', payload: { id: task.id } });
    }
  };

  const handleDragEnd = () => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    dispatch({ type: 'SET_DRAGGING_NOTE', payload: { id: null } });

    if (dragResetTimerRef.current !== null) {
      window.clearTimeout(dragResetTimerRef.current);
    }
    dragResetTimerRef.current = window.setTimeout(() => {
      dragResetTimerRef.current = null;
      wasDraggingRef.current = false;
    }, DRAG_END_RESET_MS);
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
        draggable
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onContextMenu={handleContextMenu}
        style={{ '--note-rotation': `${rotation}deg` } as React.CSSProperties}
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
