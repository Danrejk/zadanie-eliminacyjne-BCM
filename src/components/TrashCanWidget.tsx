import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useTasks } from '../context/TaskContext';
import { playDrawerSlideSound } from '../utils/sound';
import { getSmallBasketTextures } from '../utils/basketTextures';
import type { Task } from '../types/task';
import { CrumpledBall } from './CrumpledBall';

const SMALL_PREVIEW_CAP = 14;
const SMALL_ROW_CAPACITIES = [3, 4, 4, 3] as const;

interface SmallPreviewSlot {
  task: Task;
  offsetX: number;
  bottom: number;
  rotate: number;
  opacity: number;
}

function computeSmallPreviewSlots(tasks: Task[]): SmallPreviewSlot[] {
  const visible = tasks.slice(-SMALL_PREVIEW_CAP);
  const colStep = 11.5;
  const rowStep = 10.5;
  const slots: SmallPreviewSlot[] = [];

  let idx = 0;
  for (let row = 0; row < SMALL_ROW_CAPACITIES.length && idx < visible.length; row++) {
    const capacity = SMALL_ROW_CAPACITIES[row];
    const count = Math.min(capacity, visible.length - idx);
    const rowWidth = (count - 1) * colStep;
    const isOddRow = row % 2 === 1;

    for (let c = 0; c < count; c++) {
      const task = visible[idx];
      const jitterX = (((task.id * 13 + idx * 7) % 3) - 1) * 0.9;
      const offsetX =
        -rowWidth / 2 +
        c * colStep +
        (isOddRow && count < capacity ? colStep * 0.25 : 0) +
        jitterX;
      const bottom = 11 + row * rowStep;
      const rotate = ((task.id * 31 + idx * 17) % 70) - 35;
      const opacity = Math.min(1, 0.85 + row * 0.05);

      slots.push({ task, offsetX, bottom, rotate, opacity });
      idx += 1;
    }
  }

  return slots;
}

export function TrashCanWidget() {
  const {
    state,
    dispatch,
    completedTasks,
    inTrashTasks,
    trashHitboxRef,
    noteDrag,
  } = useTasks();

  const [isHovered, setIsHovered] = useState(false);

  const isDragOverNote = Boolean(noteDrag?.isOverTrash && !state.trashDrawerOpen);
  const isEnlarged =
    state.draggingFloorBallId !== null || state.ballInFlight || isDragOverNote;

  const previewSlots = useMemo(
    () => computeSmallPreviewSlots(inTrashTasks),
    [inTrashTasks],
  );
  const { backSrc, frontSrc } = getSmallBasketTextures(isEnlarged || isHovered);

  const handleOpenTrash = () => {
    playDrawerSlideSound(state.muted, true);
    dispatch({ type: 'SET_TRASH_DRAWER_OPEN', payload: { open: true } });
  };

  return (
    <motion.div
      data-testid="trash-can-widget"
      data-enlarged={isEnlarged ? 'true' : 'false'}
      data-hovered={isHovered ? 'true' : 'false'}
      animate={{
        x: state.trashDrawerOpen ? 180 : 0,
        opacity: state.trashDrawerOpen ? 0 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 420,
        damping: 32,
        delay: state.trashDrawerOpen ? 0 : 0.14,
      }}
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: 'var(--z-trash)',
        pointerEvents: state.trashDrawerOpen ? 'none' : 'auto',
      }}
      className="flex flex-col items-center select-none"
    >
      <motion.div
        ref={(el) => {
          trashHitboxRef.current = el;
        }}
        data-testid="trash-hitbox"
        role="button"
        tabIndex={state.trashDrawerOpen ? -1 : 0}
        aria-label={`Kosz na ukończone zadania (${completedTasks.length})`}
        onClick={handleOpenTrash}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpenTrash();
          }
        }}
        animate={{
          scale: isEnlarged ? 1.45 : isHovered ? 1.09 : 1,
          rotate: isEnlarged ? -2 : isHovered ? -3 : 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 360,
          damping: 22,
        }}
        style={{ transformOrigin: 'bottom right' }}
        className="relative flex h-24 w-24 cursor-pointer items-end justify-center rounded-2xl p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        {/* Lightweight static shadow/glow behind basket (avoids CSS filter: drop-shadow during animation) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 bottom-1 h-4 rounded-full transition-colors duration-150"
          style={{
            background:
              isEnlarged || isHovered
                ? 'radial-gradient(ellipse at center, rgba(251,191,36,0.45) 0%, rgba(0,0,0,0) 72%)'
                : 'radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 72%)',
          }}
        />

        <motion.div
          key={state.trashBounceCount}
          initial={state.trashBounceCount > 0 ? { scale: 1.16, y: 4 } : false}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16 }}
          className="relative flex h-full w-full items-center justify-center"
        >
          {/* Layer 1 (Back): Pre-baked 2x PNG recessed interior, back oval rim, and back diamond mesh */}
          <img
            src={backSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
          />

          {/* Layer 2 (Middle): Tapered honeycomb pile clipped strictly inside basket walls (max 14 balls) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            style={{
              clipPath: 'polygon(18% 22%, 82% 22%, 73% 86%, 27% 86%)',
            }}
          >
            {previewSlots.map(({ task, offsetX, bottom, rotate, opacity }) => (
              <div
                key={task.id}
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: `${bottom}px`,
                  opacity,
                  transform: `translateX(calc(-50% + ${offsetX}px)) rotate(${rotate}deg)`,
                }}
              >
                <CrumpledBall
                  priority={task.priorytet}
                  taskId={task.id}
                  size={16}
                />
              </div>
            ))}
          </div>

          {/* Layer 3 (Front): Pre-baked 2x PNG front diamond wire mesh, cylindrical sheen & rolled rim */}
          <img
            src={frontSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none relative z-20 h-full w-full"
          />
        </motion.div>
      </motion.div>

      {/* Bottom summary bar — ONLY "Ukończone: <N>" */}
      <button
        type="button"
        data-testid="completed-count-bar"
        tabIndex={state.trashDrawerOpen ? -1 : 0}
        onClick={handleOpenTrash}
        className="mt-1.5 rounded-full border border-amber-900/40 bg-[#fdf8ee] px-3 py-1 text-xs font-semibold text-[#2b231d] shadow-md transition-colors hover:bg-amber-50"
      >
        Ukończone: {completedTasks.length}
      </button>
    </motion.div>
  );
}
