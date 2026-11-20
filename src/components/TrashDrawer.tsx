import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, ChevronsRight, PackageOpen, Sparkles, Trash2 } from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import { PRIORITY_LABELS, formatDisplayDate } from '../utils/dateBuckets';
import { getTagColor } from '../utils/tagColors';
import { playPinClickSound, playTrashPlopSound } from '../utils/sound';
import { CrumpledBall } from './CrumpledBall';

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

  const [hoveredTaskId, setHoveredTaskId] = useState<number | null>(null);
  const isOpen = state.trashDrawerOpen;

  useEffect(() => {
    if (!isOpen) {
      setHoveredTaskId(null);
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

  const handleClose = () => {
    playPinClickSound(state.muted);
    setHoveredTaskId(null);
    dispatch({ type: 'SET_TRASH_DRAWER_OPEN', payload: { open: false } });
  };

  const handleOpenBallMenu = (taskId: number, x: number, y: number) => {
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
    dispatch({ type: 'OPEN_MODAL', payload: { type: 'emptySummary' } });
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
          <div className="trash-drawer-control-bar px-3.5 py-2.5">
            <div className="mb-2 flex items-center justify-between">
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

          {/* Middle: Open Throwing Headroom + Large Wire-Mesh Basket */}
          <div className="relative flex flex-1 flex-col items-center justify-end px-4 pt-6 pb-2">
            {/* Throwing headroom hint */}
            <div className="pointer-events-none mb-auto pt-2 text-center text-[11px] font-medium text-amber-100/45">
              {inTrashTasks.length === 0
                ? 'Wrzuć kulkę od góry przez obręcz'
                : 'Kliknij kulkę w koszu, aby przywrócić lub usunąć'}
            </div>

            {/* Large Basket Assembly */}
            <motion.div
              key={state.trashBounceCount}
              initial={state.trashBounceCount > 0 ? { scale: 1.04, y: 4 } : false}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              className="relative flex w-[236px] flex-col items-center"
            >
              {/* Top Hoop Opening Sensor */}
              <div
                ref={(el) => {
                  trashHoopRef.current = el;
                }}
                data-testid="trash-hoop"
                className={`relative z-20 -mb-3 h-8 w-[212px] rounded-full border-2 transition-all ${
                  isTargetHighlighted
                    ? 'border-amber-300 bg-amber-400/20 shadow-[0_0_18px_rgba(251,191,36,0.55)]'
                    : 'border-stone-300/70 bg-stone-950/35'
                }`}
              />

              {/* Solid Basket Body (left/right/bottom walls bounce balls away) */}
              <div
                ref={(el) => {
                  trashBodyRef.current = el;
                }}
                data-testid="trash-body"
                className="relative h-[240px] w-[236px]"
              >
                {/* Interactive Crumpled Balls resting inside */}
                <div className="absolute inset-x-5 top-5 bottom-4 z-20 flex flex-wrap-reverse content-start items-end justify-center gap-1.5 overflow-y-auto px-1 py-1">
                  {inTrashTasks.map((task) => {
                    const isHovered = hoveredTaskId === task.id;
                    return (
                      <div key={task.id} className="relative flex flex-col items-center">
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
                            setHoveredTaskId((prev) => (prev === task.id ? null : prev))
                          }
                          onFocus={() => setHoveredTaskId(task.id)}
                          onBlur={() =>
                            setHoveredTaskId((prev) => (prev === task.id ? null : prev))
                          }
                          className="rounded-full p-0.5 transition-transform hover:scale-115 focus:scale-115 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                        >
                          <CrumpledBall
                            priority={task.priorytet}
                            taskId={task.id}
                            size={40}
                          />
                        </button>

                        {isHovered && (
                          <div
                            role="tooltip"
                            className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-48 -translate-x-1/2 rounded-xl border border-amber-900/30 bg-[#fdf8ee] p-2 text-left text-xs text-[#2b231d] shadow-xl"
                          >
                            <div className="line-clamp-2 font-bold">{task.tytul}</div>
                            <div className="mt-0.5 flex items-center justify-between text-[10px] text-[#5c4f44]">
                              <span>{formatDisplayDate(task.termin)}</span>
                              <span>{PRIORITY_LABELS[task.priorytet]}</span>
                            </div>
                            {task.tagi.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {task.tagi.slice(0, 3).map((tag, idx) => {
                                  const color = getTagColor(tag);
                                  return (
                                    <span
                                      key={`${tag}-${idx}`}
                                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
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

                {/* Large Wire-Mesh Basket SVG */}
                <svg
                  viewBox="0 0 220 220"
                  className="pointer-events-none relative z-10 h-full w-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M16 12 L34 204 C36 212 184 212 186 204 L204 12 Z"
                    fill="rgba(36, 30, 26, 0.58)"
                    stroke={isTargetHighlighted ? '#fbbf24' : '#a8a29e'}
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Vertical wire ribs */}
                  <line x1="48" y1="16" x2="58" y2="208" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.45" />
                  <line x1="82" y1="18" x2="86" y2="209" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.45" />
                  <line x1="110" y1="18" x2="110" y2="210" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.45" />
                  <line x1="138" y1="18" x2="134" y2="209" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.45" />
                  <line x1="172" y1="16" x2="162" y2="208" stroke="#d6d3d1" strokeWidth="1.8" opacity="0.45" />
                  {/* Horizontal mesh rings */}
                  <path d="M21 54 Q110 66 199 54" stroke="#d6d3d1" strokeWidth="1.6" opacity="0.4" />
                  <path d="M25 102 Q110 114 195 102" stroke="#d6d3d1" strokeWidth="1.6" opacity="0.4" />
                  <path d="M29 150 Q110 162 191 150" stroke="#d6d3d1" strokeWidth="1.6" opacity="0.4" />
                  {/* Front rim */}
                  <path
                    d="M14 10 C14 20 206 20 206 10"
                    stroke={isTargetHighlighted ? '#fde68a' : '#e7e5e4'}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </motion.div>
          </div>

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
