import { useState } from 'react';
import { motion } from 'motion/react';
import { useTasks } from '../context/TaskContext';
import { playPinClickSound } from '../utils/sound';
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
        className={`relative flex h-24 w-24 cursor-pointer items-end justify-center rounded-2xl p-1 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
          isEnlarged
            ? 'drop-shadow-[0_12px_22px_rgba(251,191,36,0.5)]'
            : isHovered
              ? 'drop-shadow-[0_10px_18px_rgba(251,191,36,0.38)]'
              : 'drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]'
        }`}
      >
        <motion.div
          key={state.trashBounceCount}
          initial={state.trashBounceCount > 0 ? { scale: 1.16, y: 4 } : false}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16 }}
          className="relative flex h-full w-full items-center justify-center"
        >
          {/* Mini crumpled paper balls resting inside the mesh basket */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 bottom-3 flex flex-wrap-reverse items-end justify-center gap-0.5 overflow-hidden"
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

          {/* Office wire/mesh trash basket SVG */}
          <svg
            viewBox="0 0 88 88"
            className="relative z-10 h-full w-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Back rim */}
            <ellipse
              cx="44"
              cy="18"
              rx="30"
              ry="7"
              fill="rgba(30, 22, 16, 0.55)"
              stroke={isEnlarged || isHovered ? '#fbbf24' : '#78716c'}
              strokeWidth="2.5"
            />
            {/* Basket body translucent mesh */}
            <path
              d="M15 20 L23 76 C24 80 64 80 65 76 L73 20 Z"
              fill="rgba(41, 37, 36, 0.42)"
              stroke={isEnlarged || isHovered ? '#fbbf24' : '#a8a29e'}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {/* Vertical wire ribs */}
            <line x1="26" y1="23" x2="30" y2="77" stroke="#d6d3d1" strokeWidth="1.3" opacity="0.6" />
            <line x1="38" y1="24" x2="39" y2="78" stroke="#d6d3d1" strokeWidth="1.3" opacity="0.6" />
            <line x1="50" y1="24" x2="49" y2="78" stroke="#d6d3d1" strokeWidth="1.3" opacity="0.6" />
            <line x1="62" y1="23" x2="58" y2="77" stroke="#d6d3d1" strokeWidth="1.3" opacity="0.6" />
            {/* Horizontal mesh rings */}
            <path d="M17 34 Q44 39 71 34" stroke="#d6d3d1" strokeWidth="1.2" opacity="0.55" />
            <path d="M19 49 Q44 54 69 49" stroke="#d6d3d1" strokeWidth="1.2" opacity="0.55" />
            <path d="M21 64 Q44 69 67 64" stroke="#d6d3d1" strokeWidth="1.2" opacity="0.55" />
            {/* Front top rim */}
            <path
              d="M14 18 C14 23 74 23 74 18"
              stroke={isEnlarged || isHovered ? '#fde68a' : '#e7e5e4'}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
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
