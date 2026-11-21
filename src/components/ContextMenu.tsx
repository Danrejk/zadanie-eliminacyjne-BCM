import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Eye,
  CheckCircle2,
  Trash2,
  Undo2,
  ArrowDownToLine,
  Check,
  Flag,
  Plus,
} from 'lucide-react';
import { PRIORITIES, type Priority } from '../types/task';
import { useTasks } from '../context/TaskContext';
import { PRIORITY_LABELS, TIME_ZONE_LABELS } from '../utils/dateBuckets';
import {
  playCrumpleSound,
  playPinClickSound,
  playTrashPlopSound,
  playRestoreSound,
} from '../utils/sound';

const VIEWPORT_PADDING = 8;
const FALLBACK_MENU_WIDTH = 220;
const FALLBACK_MENU_HEIGHT = 240;

function clampMenuCoordinates(
  rawX: number,
  rawY: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const maxX = Math.max(
    VIEWPORT_PADDING,
    viewportWidth - menuWidth - VIEWPORT_PADDING,
  );
  const maxY = Math.max(
    VIEWPORT_PADDING,
    viewportHeight - menuHeight - VIEWPORT_PADDING,
  );

  return {
    x: Math.min(Math.max(VIEWPORT_PADDING, rawX), maxX),
    y: Math.min(Math.max(VIEWPORT_PADDING, rawY), maxY),
  };
}

const PRIORITY_BADGE_VARS: Record<
  Priority,
  { bg: string; fold: string; border: string }
> = {
  wysoki: {
    bg: 'var(--color-note-high-bg)',
    fold: 'var(--color-note-high-fold)',
    border: 'var(--color-note-high-border)',
  },
  sredni: {
    bg: 'var(--color-note-medium-bg)',
    fold: 'var(--color-note-medium-fold)',
    border: 'var(--color-note-medium-border)',
  },
  niski: {
    bg: 'var(--color-note-low-bg)',
    fold: 'var(--color-note-low-fold)',
    border: 'var(--color-note-low-border)',
  },
};

export function ContextMenu() {
  const { state, dispatch } = useTasks();
  const { contextMenu } = state;
  const menuRef = useRef<HTMLDivElement | null>(null);

  const menuKey = contextMenu
    ? 'taskId' in contextMenu
      ? `${contextMenu.kind}-${contextMenu.taskId}-${contextMenu.x}-${contextMenu.y}`
      : `${contextMenu.kind}-${contextMenu.priority}-${contextMenu.zone}-${contextMenu.x}-${contextMenu.y}`
    : '';

  const [measuredRect, setMeasuredRect] = useState<{
    key: string;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) {
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : FALLBACK_MENU_WIDTH;
    const height = rect.height > 0 ? rect.height : FALLBACK_MENU_HEIGHT;

    setMeasuredRect((prev) => {
      if (
        prev &&
        prev.key === menuKey &&
        prev.width === width &&
        prev.height === height
      ) {
        return prev;
      }
      return { key: menuKey, width, height };
    });
  }, [contextMenu, menuKey]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const openedAt = performance.now();

    const closeMenu = () => {
      dispatch({ type: 'CLOSE_CONTEXT_MENU' });
    };

    const handleScroll = (e: Event) => {
      if (e.isTrusted && performance.now() - openedAt < 120) {
        return;
      }
      closeMenu();
    };

    const handleOutsidePointerOrMouse = (e: Event) => {
      const target = e.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleOutsidePointerOrMouse);
    document.addEventListener('pointerdown', handleOutsidePointerOrMouse);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('blur', closeMenu);

    return () => {
      document.removeEventListener('mousedown', handleOutsidePointerOrMouse);
      document.removeEventListener('pointerdown', handleOutsidePointerOrMouse);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('blur', closeMenu);
    };
  }, [contextMenu, dispatch]);

  if (!contextMenu) {
    return null;
  }

  const contextTaskId = 'taskId' in contextMenu ? contextMenu.taskId : null;
  const targetTask =
    contextTaskId !== null
      ? state.tasks.find((t) => t.id === contextTaskId)
      : undefined;

  const effectiveWidth =
    measuredRect && measuredRect.key === menuKey
      ? measuredRect.width
      : FALLBACK_MENU_WIDTH;
  const effectiveHeight =
    measuredRect && measuredRect.key === menuKey
      ? measuredRect.height
      : FALLBACK_MENU_HEIGHT;

  const viewportWidth =
    typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const viewportHeight =
    typeof window !== 'undefined' && window.innerHeight > 0
      ? window.innerHeight
      : 768;

  const clampedPos = clampMenuCoordinates(
    contextMenu.x,
    contextMenu.y,
    effectiveWidth,
    effectiveHeight,
    viewportWidth,
    viewportHeight,
  );

  const handleView = () => {
    if (contextTaskId === null) return;
    dispatch({
      type: 'OPEN_MODAL',
      payload: { type: 'view', taskId: contextTaskId },
    });
    dispatch({ type: 'CLOSE_CONTEXT_MENU' });
  };

  const handleCompleteToFloor = () => {
    if (contextTaskId === null) return;
    playCrumpleSound(state.muted);
    dispatch({
      type: 'COMPLETE_TO_FLOOR',
      payload: {
        id: contextTaskId,
        originX: contextMenu.x,
        originY: contextMenu.y,
      },
    });
    dispatch({ type: 'CLOSE_CONTEXT_MENU' });
  };

  const handleSetPriority = (priorytet: Priority) => {
    if (contextTaskId === null) return;
    playPinClickSound(state.muted);
    dispatch({
      type: 'SET_PRIORITY',
      payload: { id: contextTaskId, priorytet },
    });
    dispatch({ type: 'CLOSE_CONTEXT_MENU' });
  };

  const handleDropIntoTrash = () => {
    if (contextTaskId === null) return;
    playTrashPlopSound(state.muted);
    dispatch({
      type: 'DROP_BALL_INTO_TRASH',
      payload: { id: contextTaskId },
    });
    dispatch({ type: 'CLOSE_CONTEXT_MENU' });
  };

  const handleRestore = () => {
    if (contextTaskId === null) return;
    playRestoreSound(state.muted);
    dispatch({
      type: 'RESTORE_TASK',
      payload: { id: contextTaskId },
    });
    dispatch({ type: 'CLOSE_CONTEXT_MENU' });
  };

  const handleDelete = () => {
    if (contextTaskId === null) return;
    dispatch({
      type: 'DELETE_TASK',
      payload: { id: contextTaskId },
    });
    dispatch({ type: 'CLOSE_CONTEXT_MENU' });
  };

  const handleCreateFromCell = () => {
    if (contextMenu.kind !== 'cell') return;
    dispatch({
      type: 'OPEN_MODAL',
      payload: {
        type: 'create',
        defaultPriority: contextMenu.priority,
        defaultZone: contextMenu.zone,
      },
    });
    dispatch({ type: 'CLOSE_CONTEXT_MENU' });
  };

  return (
    <>
      <div
        data-testid="context-menu-backdrop"
        aria-hidden="true"
        className="fixed inset-0"
        style={{
          zIndex: 'calc(var(--z-context-menu) - 1)',
          backgroundColor: 'transparent',
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ type: 'CLOSE_CONTEXT_MENU' });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dispatch({ type: 'CLOSE_CONTEXT_MENU' });
        }}
      />
      <div
        ref={menuRef}
        data-testid="context-menu"
        data-kind={contextMenu.kind}
        role="menu"
        aria-label={
          contextMenu.kind === 'cell'
            ? 'Menu kontekstowe komórki'
            : 'Menu kontekstowe zadania'
        }
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="fixed z-60 min-w-[220px] rounded-xl border-2 py-1.5 shadow-xl select-none"
      style={{
        zIndex: 'var(--z-context-menu)',
        left: `${clampedPos.x}px`,
        top: `${clampedPos.y}px`,
        backgroundColor: '#fdf8ee',
        borderColor: 'var(--color-wood-highlight)',
        color: 'var(--color-ink)',
      }}
    >
      {/* Task Title Header Preview if found */}
      {targetTask && (
        <div
          className="border-b px-3 py-1.5 mb-1 truncate text-xs font-bold"
          style={{
            borderBottomColor: 'rgba(166, 124, 82, 0.3)',
            color: 'var(--color-ink-muted)',
          }}
          title={targetTask.tytul}
        >
          {targetTask.tytul}
        </div>
      )}

      {/* Cell Header Preview */}
      {contextMenu.kind === 'cell' && (
        <div
          className="border-b px-3 py-1.5 mb-1 truncate text-xs font-bold"
          style={{
            borderBottomColor: 'rgba(166, 124, 82, 0.3)',
            color: 'var(--color-ink-muted)',
          }}
        >
          {TIME_ZONE_LABELS[contextMenu.zone]} ·{' '}
          {PRIORITY_LABELS[contextMenu.priority]}
        </div>
      )}

      {/* Variant 4: Empty/Background Cell on Corkboard */}
      {contextMenu.kind === 'cell' && (
        <button
          type="button"
          role="menuitem"
          data-testid="context-menu-create"
          onClick={handleCreateFromCell}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-amber-900/10 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4 text-amber-800" aria-hidden="true" />
          <span>Utwórz nową notatkę</span>
        </button>
      )}

      {/* Variant 1: Post-it Note on Corkboard */}
      {contextMenu.kind === 'note' && (
        <>
          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-view"
            onClick={handleView}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-amber-900/10 transition-colors cursor-pointer"
          >
            <Eye className="h-4 w-4 text-amber-800" aria-hidden="true" />
            <span>Podgląd zadania</span>
          </button>

          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-complete"
            onClick={handleCompleteToFloor}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-emerald-900/10 transition-colors cursor-pointer"
          >
            <CheckCircle2
              className="h-4 w-4 text-emerald-700"
              aria-hidden="true"
            />
            <span>Oznacz jako zrobione</span>
          </button>

          {/* Quick Priority Section */}
          <div
            className="my-1 border-y px-3.5 py-2"
            style={{ borderColor: 'rgba(166, 124, 82, 0.25)' }}
          >
            <div
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--color-ink-muted)' }}
            >
              <Flag className="h-3 w-3" aria-hidden="true" />
              <span>Zmień priorytet</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {PRIORITIES.map((p) => {
                const isCurrent = targetTask?.priorytet === p;
                const vars = PRIORITY_BADGE_VARS[p];
                return (
                  <button
                    key={p}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isCurrent}
                    aria-current={isCurrent ? 'true' : undefined}
                    data-testid={`context-menu-priority-${p}`}
                    data-active={isCurrent ? 'true' : 'false'}
                    onClick={() => handleSetPriority(p)}
                    className="flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-bold transition-all cursor-pointer"
                    style={{
                      backgroundColor: isCurrent ? vars.fold : vars.bg,
                      borderColor: isCurrent
                        ? 'var(--color-wood-dark)'
                        : vars.border,
                      color: 'var(--color-ink)',
                      boxShadow: isCurrent
                        ? '0 0 0 1.5px var(--color-wood-dark)'
                        : 'none',
                    }}
                  >
                    {isCurrent && (
                      <Check
                        className="h-3 w-3 stroke-[2.5] shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span>{PRIORITY_LABELS[p]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-delete"
            onClick={handleDelete}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold hover:bg-red-900/10 transition-colors cursor-pointer"
            style={{ color: 'var(--color-stamp-red)' }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Usuń zadanie na stałe</span>
          </button>
        </>
      )}

      {/* Variant 2: Crumpled Ball on the Floor */}
      {contextMenu.kind === 'floorBall' && (
        <>
          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-drop-trash"
            onClick={handleDropIntoTrash}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-amber-900/10 transition-colors cursor-pointer"
          >
            <ArrowDownToLine
              className="h-4 w-4 text-amber-800"
              aria-hidden="true"
            />
            <span>Wrzuć do kosza</span>
          </button>

          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-restore"
            onClick={handleRestore}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-emerald-900/10 transition-colors cursor-pointer"
          >
            <Undo2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Przywróć na tablicę</span>
          </button>

          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-view"
            onClick={handleView}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-amber-900/10 transition-colors cursor-pointer"
          >
            <Eye className="h-4 w-4 text-amber-800" aria-hidden="true" />
            <span>Podgląd zadania</span>
          </button>

          <div
            className="my-1 border-t"
            style={{ borderTopColor: 'rgba(166, 124, 82, 0.25)' }}
          />

          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-delete"
            onClick={handleDelete}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold hover:bg-red-900/10 transition-colors cursor-pointer"
            style={{ color: 'var(--color-stamp-red)' }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Usuń na stałe</span>
          </button>
        </>
      )}

      {/* Variant 3: Crumpled Ball inside Trash Modal */}
      {contextMenu.kind === 'trashBall' && (
        <>
          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-view"
            onClick={handleView}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-amber-900/10 transition-colors cursor-pointer"
          >
            <Eye className="h-4 w-4 text-amber-800" aria-hidden="true" />
            <span>Podgląd zadania</span>
          </button>

          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-restore"
            onClick={handleRestore}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-emerald-900/10 transition-colors cursor-pointer"
          >
            <Undo2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Przywróć na tablicę</span>
          </button>

          <div
            className="my-1 border-t"
            style={{ borderTopColor: 'rgba(166, 124, 82, 0.25)' }}
          />

          <button
            type="button"
            role="menuitem"
            data-testid="context-menu-delete"
            onClick={handleDelete}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold hover:bg-red-900/10 transition-colors cursor-pointer"
            style={{ color: 'var(--color-stamp-red)' }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Usuń na stałe</span>
          </button>
        </>
      )}
      </div>
    </>
  );
}

export default ContextMenu;
