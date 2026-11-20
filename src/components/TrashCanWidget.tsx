import { useState } from 'react';
import { motion } from 'motion/react';
import { useTasks } from '../context/TaskContext';
import { playPinClickSound } from '../utils/sound';
import { getSmallBasketTextures } from '../utils/basketTextures';
import { CrumpledBall } from './CrumpledBall';

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

  const previewBalls = inTrashTasks.slice(-8);
  const { backSrc, frontSrc } = getSmallBasketTextures(isEnlarged || isHovered);

  const handleOpenTrash = () => {
    playPinClickSound(state.muted);
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

          {/* Layer 2 (Middle): Mini crumpled paper balls resting inside */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 bottom-3 z-10 flex flex-wrap-reverse items-end justify-center gap-0.5 overflow-hidden"
            style={{ maxHeight: '46px' }}
          >
            {previewBalls.map((task, idx) => (
              <div
                key={task.id}
                className="-m-1"
                style={{
                  transform: `rotate(${((task.id * 31 + idx * 17) % 60) - 30}deg)`,
                }}
              >
                <CrumpledBall
                  priority={task.priorytet}
                  taskId={task.id}
                  size={20}
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
