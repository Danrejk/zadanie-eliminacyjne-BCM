import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, ChevronRight, PackageOpen } from 'lucide-react';
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
    trashDrawerBoxRef,
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
          className="trash-drawer-panel flex flex-col justify-end select-none"
        >
          {/* Throwing Headroom + Skeuomorphic 3-Layer Gunmetal Wire-Mesh Basket */}
          <div className="relative flex flex-1 flex-col items-center justify-end px-3 pt-4">
            <motion.div
              key={state.trashBounceCount}
              initial={state.trashBounceCount > 0 ? { scale: 1.03, y: 4 } : false}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              className="relative flex w-[280px] max-w-full flex-col items-center justify-end"
            >
              {/* Invisible Top Hoop Opening Sensor aligned with SVG rim */}
              <div
                ref={(el) => {
                  trashHoopRef.current = el;
                }}
                data-testid="trash-hoop"
                aria-hidden="true"
                className="pointer-events-none relative z-20 -mb-5 h-11 w-[264px]"
              />

              {/* Solid Basket Body tucked into the drawer at the bottom */}
              <div
                ref={(el) => {
                  trashBodyRef.current = el;
                }}
                data-testid="trash-body"
                className="relative -mb-[34px] aspect-[280/296] w-full max-h-[340px]"
              >
                {/* Layer 1 (Back): Recessed dark interior, back rim, and back diamond wire mesh */}
                <svg
                  viewBox="0 0 280 296"
                  preserveAspectRatio="xMidYMax meet"
                  className="pointer-events-none absolute inset-0 z-10 h-full w-full drop-shadow-[0_14px_22px_rgba(0,0,0,0.52)]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="lgBasketInterior" x1="140" y1="10" x2="140" y2="288" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#14110f" stopOpacity="0.88" />
                      <stop offset="55%" stopColor="#26211e" stopOpacity="0.78" />
                      <stop offset="100%" stopColor="#0f0c0b" stopOpacity="0.92" />
                    </linearGradient>
                    <pattern id="lgMeshBack" width="16" height="16" patternUnits="userSpaceOnUse">
                      <path d="M0 0 L16 16 M16 0 L0 16" stroke="#57534e" strokeWidth="0.9" opacity="0.45" />
                    </pattern>
                    <clipPath id="lgBasketBodyClipBack">
                      <path d="M20 18 L46 276 C49 286 231 286 234 276 L260 18 Z" />
                    </clipPath>
                  </defs>

                  {/* Dark recessed interior + back mesh */}
                  <g clipPath="url(#lgBasketBodyClipBack)">
                    <rect x="0" y="0" width="280" height="296" fill="url(#lgBasketInterior)" />
                    <rect x="0" y="0" width="280" height="296" fill="url(#lgMeshBack)" />
                  </g>

                  {/* Back half of the rolled top rim */}
                  <path
                    d="M18 18 C18 7 262 7 262 18"
                    stroke="#57534e"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M20 18 C20 9 260 9 260 18"
                    stroke="#a8a29e"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                </svg>

                {/* Layer 2 (Middle): Honeycomb-packed Crumpled Balls resting INSIDE the basket */}
                <div className="absolute inset-x-9 top-6 bottom-6 z-20 overflow-y-auto overflow-x-hidden">
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
                        className="rounded-full p-0.5 transition-transform hover:scale-110 focus:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
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

                {/* Layer 3 (Front): Front diamond wire mesh, cylindrical sheen & rolled metallic rim */}
                <svg
                  viewBox="0 0 280 296"
                  preserveAspectRatio="xMidYMax meet"
                  className="pointer-events-none absolute inset-0 z-30 h-full w-full"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <defs>
                    <pattern id="lgMeshFront" width="16" height="16" patternUnits="userSpaceOnUse">
                      <path d="M0 0 L16 16 M16 0 L0 16" stroke="#d6d3d1" strokeWidth="1.05" opacity="0.52" />
                    </pattern>
                    <linearGradient id="lgCylinderSheen" x1="20" y1="0" x2="260" y2="0" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#0c0a09" stopOpacity="0.45" />
                      <stop offset="22%" stopColor="#ffffff" stopOpacity="0.1" />
                      <stop offset="52%" stopColor="#78716c" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="#0c0a09" stopOpacity="0.45" />
                    </linearGradient>
                    <clipPath id="lgBasketBodyClipFront">
                      <path d="M20 18 L46 276 C49 286 231 286 234 276 L260 18 C260 28 20 28 20 18 Z" />
                    </clipPath>
                  </defs>

                  {/* Front diamond mesh + 3D cylindrical sheen */}
                  <g clipPath="url(#lgBasketBodyClipFront)">
                    <rect x="0" y="0" width="280" height="296" fill="url(#lgMeshFront)" />
                    <rect x="0" y="0" width="280" height="296" fill="url(#lgCylinderSheen)" />
                  </g>

                  {/* Crisp outer wireframe edges & base ring */}
                  <path
                    d="M20 18 L46 276 C49 286 231 286 234 276 L260 18"
                    stroke="#a8a29e"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M46 276 C49 286 231 286 234 276"
                    stroke="#57534e"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />

                  {/* Rolled metallic front rim with underside shadow and specular highlight */}
                  <path
                    d="M16 18 C16 30 264 30 264 18"
                    stroke="#292524"
                    strokeWidth="5.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 18 C16 30 264 30 264 18"
                    stroke="#8b8580"
                    strokeWidth="3.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 17.5 C18 28.5 262 28.5 262 17.5"
                    stroke="#e7e5e4"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    opacity="0.9"
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

          {/* Side-View Physical Wooden Drawer (protrudes 30px left so side wall centers on basket) */}
          <div
            ref={(el) => {
              trashDrawerBoxRef.current = el;
            }}
            className="trash-drawer-box relative z-30 -ml-[30px] flex h-[142px] w-[calc(100%+30px)] items-stretch"
          >
            {/* Left Drawer Front + Round Brass Knob (clicking either closes the drawer) */}
            <button
              type="button"
              data-testid="btn-close-trash-drawer"
              onClick={handleClose}
              aria-label="Schowaj szufladę kosza"
              title="Schowaj szufladę"
              className="trash-drawer-front group relative flex w-[30px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              {/* Round Brass Knob protruding to the left */}
              <span className="trash-drawer-handle pointer-events-none" aria-hidden="true">
                <svg
                  viewBox="0 0 26 26"
                  className="h-6 w-6 drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Mounting stem */}
                  <rect x="18" y="10" width="8" height="6" rx="1.5" fill="#92400e" />
                  {/* Round brass knob */}
                  <circle cx="11" cy="13" r="9.5" fill="url(#brassKnob)" stroke="#78350f" strokeWidth="1.2" />
                  <circle cx="8.5" cy="10" r="2.8" fill="#fef3c7" opacity="0.55" />
                  <defs>
                    <radialGradient id="brassKnob" cx="0.35" cy="0.3" r="0.7">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="50%" stopColor="#d97706" />
                      <stop offset="100%" stopColor="#78350f" />
                    </radialGradient>
                  </defs>
                </svg>
              </span>

              {/* 3 vertically arranged '>' chevrons on the drawer front */}
              <ChevronRight
                className="h-4 w-4 text-amber-100/85 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-amber-50"
                strokeWidth={2.8}
                aria-hidden="true"
              />
              <ChevronRight
                className="h-4 w-4 text-amber-100/85 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-amber-50"
                strokeWidth={2.8}
                aria-hidden="true"
              />
              <ChevronRight
                className="h-4 w-4 text-amber-100/85 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-amber-50"
                strokeWidth={2.8}
                aria-hidden="true"
              />
            </button>

            {/* Opaque Wooden Side Wall */}
            <div className="trash-drawer-side flex flex-1 flex-col justify-between px-3.5 pt-2.5 pb-3">
              {/* Plain text label centered at the top of the side wall */}
              <div className="text-center text-xs font-bold tracking-wide text-amber-100/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]">
                Kosz · {inTrashTasks.length}
              </div>

              {/* Bottom row: left column (Wyjmij + Zbierz), right corner (Opróżnij) */}
              <div className="flex items-end justify-between gap-2">
                <div className="flex w-[140px] flex-col gap-1.5">
                  <button
                    type="button"
                    data-testid="btn-take-all-out"
                    disabled={inTrashTasks.length === 0}
                    onClick={handleTakeAllOut}
                    title="Wyjmij wszystkie kulki na podłogę"
                    className="trash-drawer-btn trash-drawer-btn--wood w-full"
                  >
                    <PackageOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">Wyjmij</span>
                  </button>

                  <button
                    type="button"
                    data-testid="btn-sweep-floor"
                    disabled={floorBallTasks.length === 0}
                    onClick={handleSweepFloor}
                    title="Zbierz kulki z podłogi do kosza"
                    className="trash-drawer-btn trash-drawer-btn--amber w-full"
                  >
                    {/* Broom SVG icon */}
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M19 3 9.5 12.5" />
                      <path d="M7.5 10.5 13.5 16.5" />
                      <path d="M6 12c-2 2-3 5.5-3 8.5 3 0 6.5-1 8.5-3l2-2-6-6-1.5 2.5Z" />
                      <path d="M5.5 16.5 7 18" />
                    </svg>
                    <span className="truncate">Zbierz ({floorBallTasks.length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="btn-empty-trash"
                  disabled={inTrashTasks.length === 0}
                  onClick={handleOpenEmptySummary}
                  title="Opróżnij kosz i zarchiwizuj"
                  className="trash-drawer-btn trash-drawer-btn--danger shrink-0 px-3"
                >
                  <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Opróżnij</span>
                </button>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
