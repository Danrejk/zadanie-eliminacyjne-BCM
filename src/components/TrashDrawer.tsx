import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, ChevronsRight, PackageOpen, Sparkles, Trash2 } from 'lucide-react';
import type { Task } from '../types/task';
import { useTasks } from '../context/TaskContext';
import { PRIORITY_LABELS, formatDisplayDate } from '../utils/dateBuckets';
import { getTagColor } from '../utils/tagColors';
import { playPinClickSound, playTrashPlopSound } from '../utils/sound';
import { CrumpledBall } from './CrumpledBall';

interface HoveredTooltipState {
  task: Task;
  x: number;
  y: number;
}

interface HoneycombSlot {
  task: Task;
  offsetX: number; // px from horizontal center
  bottom: number;  // px from basket bottom
}

/**
 * Packs trashed balls from the bottom up in a tight hexagonal (honeycomb) lattice
 * that tapers slightly at the bottom to match the wire-mesh basket silhouette.
 */
function computeHoneycombSlots(tasks: Task[]): {
  slots: HoneycombSlot[];
  totalHeight: number;
} {
  const colStep = 30;
  const rowStep = 25;
  const slots: HoneycombSlot[] = [];

  let idx = 0;
  let row = 0;
  while (idx < tasks.length) {
    // Tapered basket fits 6 balls at the very bottom, widening to 7-8 higher up
    const colsInRow = row === 0 ? 6 : row === 1 ? 7 : 8;
    const remaining = tasks.length - idx;
    const count = Math.min(colsInRow, remaining);
    const isOddRow = row % 2 === 1;
    const rowWidth = (count - 1) * colStep;

    for (let c = 0; c < count; c++) {
      const offsetX =
        -rowWidth / 2 + c * colStep + (isOddRow && count < colsInRow ? colStep * 0.25 : 0);
      const bottom = 14 + row * rowStep;
      slots.push({
        task: tasks[idx],
        offsetX,
        bottom,
      });
      idx += 1;
    }
    row += 1;
  }

  const totalHeight = Math.max(200, 36 + row * rowStep);
  return { slots, totalHeight };
}

export function TrashDrawer() {
  const {
    state,
    dispatch,
    inTrashTasks,
    floorBallTasks,
    trashHoopRef,
    trashBodyRef,
    noteDrag,
  } = useTasks();

  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredTooltipState | null>(null);
  const isOpen = state.trashDrawerOpen;

  useEffect(() => {
    if (!isOpen) {
      setHoveredTooltip(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        state.activeModal.type === 'none' &&
        state.contextMenu === null
      ) {
        e.preventDefault();
        dispatch({ type: 'SET_TRASH_DRAWER_OPEN', payload: { open: false } });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, state.activeModal.type, state.contextMenu, dispatch]);

  const { slots, totalHeight } = useMemo(
    () => computeHoneycombSlots(inTrashTasks),
    [inTrashTasks],
  );

  const handleClose = () => {
    playPinClickSound(state.muted);
    setHoveredTooltip(null);
    dispatch({ type: 'SET_TRASH_DRAWER_OPEN', payload: { open: false } });
  };

  const handleOpenBallMenu = (taskId: number, x: number, y: number) => {
    setHoveredTooltip(null);
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

  const handleTakeAllOut = () => {
    if (inTrashTasks.length === 0) {
      return;
    }
    playPinClickSound(state.muted);
    setHoveredTooltip(null);
    const bodyRect = trashBodyRef.current?.getBoundingClientRect();
    const hoopRect = trashHoopRef.current?.getBoundingClientRect();
    const originX = bodyRect
      ? Math.max(40, bodyRect.left - 16)
      : Math.max(40, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 360);
    const originY = hoopRect
      ? hoopRect.top + 12
      : Math.max(180, (typeof window !== 'undefined' ? window.innerHeight : 768) - 320);

    dispatch({
      type: 'SPILL_TRASH_TO_FLOOR',
      payload: { originX, originY },
    });
  };

  const handleOpenEmptySummary = () => {
    if (inTrashTasks.length === 0) {
      return;
    }
    setHoveredTooltip(null);
    dispatch({ type: 'OPEN_MODAL', payload: { type: 'emptySummary' } });
  };

  const showBallTooltip = (task: Task, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const clampedX = Math.max(112, Math.min(viewportW - 112, rect.left + rect.width / 2));
    setHoveredTooltip({
      task,
      x: clampedX,
      y: rect.top - 8,
    });
  };

  const isTargetHighlighted =
    state.draggingFloorBallId !== null ||
    state.ballInFlight ||
    Boolean(noteDrag?.isOverTrash && isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="trash-drawer"
          data-testid="trash-drawer"
          aria-label="Szuflada kosza na ukończone zadania"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{
            type: 'spring',
            stiffness: 340,
            damping: 32,
            delay: 0.1,
          }}
          style={{
            position: 'fixed',
            top: '64px',
            right: 0,
            bottom: 0,
            width: '340px',
            maxWidth: '92vw',
            zIndex: 'var(--z-trash)',
          }}
          className="trash-drawer-panel flex flex-col justify-between select-none"
        >
          {/* Top Desk-Styled Control Shelf (above basket, preserving throwing headroom) */}
          <div className="trash-drawer-control-bar px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-amber-200" aria-hidden="true" />
                <h2 className="text-sm font-bold tracking-wide text-amber-50">
                  Kosz ({inTrashTasks.length})
                </h2>
              </div>
              <span className="text-[11px] font-medium text-amber-200/80">
                Celuj w obręcz!
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                data-testid="btn-sweep-floor"
                disabled={floorBallTasks.length === 0}
                onClick={handleSweepFloor}
                title="Zbierz kulki z podłogi do kosza"
                className="trash-drawer-btn trash-drawer-btn--amber"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Zbierz ({floorBallTasks.length})</span>
              </button>

              <button
                type="button"
                data-testid="btn-take-all-out"
                disabled={inTrashTasks.length === 0}
                onClick={handleTakeAllOut}
                title="Wyjmij wszystkie kulki na podłogę"
                className="trash-drawer-btn trash-drawer-btn--wood"
              >
                <PackageOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Wyjmij</span>
              </button>

              <button
                type="button"
                data-testid="btn-empty-trash"
                disabled={inTrashTasks.length === 0}
                onClick={handleOpenEmptySummary}
                title="Opróżnij kosz i zarchiwizuj"
                className="trash-drawer-btn trash-drawer-btn--danger"
              >
                <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Opróżnij</span>
              </button>
            </div>
          </div>

          {/* Middle: Throwing Headroom + Large Wire-Mesh Basket filling the drawer */}
          <div className="relative flex flex-1 flex-col items-center justify-end px-2 pt-2 pb-1">
            {/* Throwing headroom hint */}
            <div className="pointer-events-none pt-1 pb-2 text-center text-[11px] font-medium text-amber-100/45">
              {inTrashTasks.length === 0
                ? 'Wrzuć kulkę od góry przez obręcz'
                : 'Kliknij kulkę w koszu, aby przywrócić lub usunąć'}
            </div>

            {/* Large Basket Assembly filling the drawer */}
            <motion.div
              key={state.trashBounceCount}
              initial={state.trashBounceCount > 0 ? { scale: 1.03, y: 4 } : false}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              className="relative flex w-full max-w-[318px] flex-1 max-h-[380px] min-h-[250px] flex-col items-center justify-end"
            >
              {/* Invisible Top Hoop Opening Sensor aligned with SVG rim */}
              <div
                ref={(el) => {
                  trashHoopRef.current = el;
                }}
                data-testid="trash-hoop"
                aria-hidden="true"
                className="pointer-events-none relative z-20 -mb-5 h-11 w-[280px]"
              />

              {/* Solid Basket Body (left/right/bottom walls bounce balls away) */}
              <div
                ref={(el) => {
                  trashBodyRef.current = el;
                }}
                data-testid="trash-body"
                className="relative h-full w-full"
              >
                {/* Honeycomb-packed Crumpled Balls resting inside (no horizontal scroll) */}
                <div className="absolute inset-x-6 top-5 bottom-3 z-20 overflow-y-auto overflow-x-hidden">
                  <div
                    className="relative w-full"
                    style={{ height: `${totalHeight}px`, minHeight: '100%' }}
                  >
                    {slots.map(({ task, offsetX, bottom }) => (
                      <button
                        key={task.id}
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
                        onMouseEnter={(e) => showBallTooltip(task, e.currentTarget)}
                        onMouseLeave={() =>
                          setHoveredTooltip((prev) =>
                            prev?.task.id === task.id ? null : prev,
                          )
                        }
                        onFocus={(e) => showBallTooltip(task, e.currentTarget)}
                        onBlur={() =>
                          setHoveredTooltip((prev) =>
                            prev?.task.id === task.id ? null : prev,
                          )
                        }
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: `${bottom}px`,
                          transform: `translateX(calc(-50% + ${offsetX}px))`,
                        }}
                        className="rounded-full p-0.5 transition-transform hover:z-30 hover:scale-115 focus:z-30 focus:scale-115 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      >
                        <CrumpledBall
                          priority={task.priorytet}
                          taskId={task.id}
                          size={38}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Large Wire-Mesh Basket SVG */}
                <svg
                  viewBox="0 0 300 320"
                  preserveAspectRatio="none"
                  className="pointer-events-none relative z-10 h-full w-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  {/* Back rim */}
                  <ellipse
                    cx="150"
                    cy="14"
                    rx="132"
                    ry="10"
                    fill="rgba(28, 22, 18, 0.55)"
                    stroke={isTargetHighlighted ? '#fbbf24' : '#78716c'}
                    strokeWidth="3"
                  />
                  {/* Basket body translucent mesh */}
                  <path
                    d="M18 16 L40 302 C43 312 257 312 260 302 L282 16 Z"
                    fill="rgba(36, 30, 26, 0.54)"
                    stroke={isTargetHighlighted ? '#fbbf24' : '#a8a29e'}
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Vertical wire ribs */}
                  <line x1="62" y1="20" x2="76" y2="306" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.42" />
                  <line x1="106" y1="22" x2="112" y2="308" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.42" />
                  <line x1="150" y1="23" x2="150" y2="309" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.42" />
                  <line x1="194" y1="22" x2="188" y2="308" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.42" />
                  <line x1="238" y1="20" x2="224" y2="306" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.42" />
                  {/* Horizontal mesh rings */}
                  <path d="M24 74 Q150 90 276 74" stroke="#d6d3d1" strokeWidth="1.6" opacity="0.38" />
                  <path d="M29 144 Q150 160 271 144" stroke="#d6d3d1" strokeWidth="1.6" opacity="0.38" />
                  <path d="M34 214 Q150 230 266 214" stroke="#d6d3d1" strokeWidth="1.6" opacity="0.38" />
                  <path d="M38 274 Q150 288 262 274" stroke="#d6d3d1" strokeWidth="1.6" opacity="0.38" />
                  {/* Front rim */}
                  <path
                    d="M16 14 C16 26 284 26 284 14"
                    stroke={isTargetHighlighted ? '#fde68a' : '#e7e5e4'}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </motion.div>
          </div>

          {/* Floating Tooltip rendered above the basket SVG without clipping or scrollbars */}
          {hoveredTooltip && (
            <div
              role="tooltip"
              style={{
                position: 'fixed',
                left: `${hoveredTooltip.x}px`,
                top: `${hoveredTooltip.y}px`,
                transform: 'translate(-50%, -100%)',
                zIndex: 'var(--z-context-menu)',
              }}
              className="pointer-events-none w-52 rounded-xl border border-amber-900/35 bg-[#fdf8ee] p-2.5 text-left text-xs text-[#2b231d] shadow-2xl"
            >
              <div className="line-clamp-2 font-bold">{hoveredTooltip.task.tytul}</div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[#5c4f44]">
                <span>{formatDisplayDate(hoveredTooltip.task.termin)}</span>
                <span>{PRIORITY_LABELS[hoveredTooltip.task.priorytet]}</span>
              </div>
              {hoveredTooltip.task.tagi.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {hoveredTooltip.task.tagi.slice(0, 4).map((tag, idx) => {
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

          {/* Bottom Physical Drawer ("fizyczna szuflada") with >> close button */}
          <div className="trash-drawer-physical-base flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-14 rounded-full border border-amber-200/30 bg-gradient-to-b from-amber-300/70 to-amber-700/80 shadow-inner" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-100/70">
                Szuflada
              </span>
            </div>

            <button
              type="button"
              data-testid="btn-close-trash-drawer"
              onClick={handleClose}
              aria-label="Schowaj szufladę kosza"
              title="Schowaj szufladę"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200/35 bg-amber-900/70 px-3 py-1.5 text-xs font-bold text-amber-50 shadow transition-colors hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <span>Schowaj</span>
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
