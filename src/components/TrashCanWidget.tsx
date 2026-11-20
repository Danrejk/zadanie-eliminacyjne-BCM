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
          {/* Layer 1 (Back): Dark recessed interior, back rim, and back diamond mesh */}
          <svg
            viewBox="0 0 88 88"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="smBasketInterior" x1="44" y1="14" x2="44" y2="80" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#14110f" stopOpacity="0.88" />
                <stop offset="60%" stopColor="#26211e" stopOpacity="0.78" />
                <stop offset="100%" stopColor="#0f0c0b" stopOpacity="0.92" />
              </linearGradient>
              <pattern id="smMeshBack" width="7.5" height="7.5" patternUnits="userSpaceOnUse">
                <path d="M0 0 L7.5 7.5 M7.5 0 L0 7.5" stroke="#57534e" strokeWidth="0.7" opacity="0.45" />
              </pattern>
              <clipPath id="smBasketClipBack">
                <path d="M15 20 L23 76 C24 80 64 80 65 76 L73 20 Z" />
              </clipPath>
            </defs>

            <g clipPath="url(#smBasketClipBack)">
              <rect x="0" y="0" width="88" height="88" fill="url(#smBasketInterior)" />
              <rect x="0" y="0" width="88" height="88" fill="url(#smMeshBack)" />
            </g>

            {/* Back half of rolled rim */}
            <path
              d="M14 19 C14 13 74 13 74 19"
              stroke={isEnlarged || isHovered ? '#fbbf24' : '#57534e'}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

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

          {/* Layer 3 (Front): Front diamond wire mesh, cylindrical sheen & rolled rim */}
          <svg
            viewBox="0 0 88 88"
            className="pointer-events-none relative z-20 h-full w-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <pattern id="smMeshFront" width="7.5" height="7.5" patternUnits="userSpaceOnUse">
                <path d="M0 0 L7.5 7.5 M7.5 0 L0 7.5" stroke="#d6d3d1" strokeWidth="0.75" opacity="0.56" />
              </pattern>
              <linearGradient id="smCylinderSheen" x1="15" y1="0" x2="73" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0c0a09" stopOpacity="0.42" />
                <stop offset="24%" stopColor="#ffffff" stopOpacity="0.12" />
                <stop offset="55%" stopColor="#78716c" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#0c0a09" stopOpacity="0.42" />
              </linearGradient>
              <clipPath id="smBasketClipFront">
                <path d="M15 20 L23 76 C24 80 64 80 65 76 L73 20 C73 24 15 24 15 20 Z" />
              </clipPath>
            </defs>

            <g clipPath="url(#smBasketClipFront)">
              <rect x="0" y="0" width="88" height="88" fill="url(#smMeshFront)" />
              <rect x="0" y="0" width="88" height="88" fill="url(#smCylinderSheen)" />
            </g>

            {/* Outer edges & base ring */}
            <path
              d="M15 20 L23 76 C24 80 64 80 65 76 L73 20"
              stroke={isEnlarged || isHovered ? '#fbbf24' : '#a8a29e'}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M23 76 C24 80 64 80 65 76"
              stroke="#57534e"
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* Rolled metallic front rim */}
            <path
              d="M13.5 19 C13.5 24.5 74.5 24.5 74.5 19"
              stroke="#292524"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M13.5 19 C13.5 24.5 74.5 24.5 74.5 19"
              stroke={isEnlarged || isHovered ? '#fbbf24' : '#8b8580'}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M14.5 18.7 C14.5 23.7 73.5 23.7 73.5 18.7"
              stroke={isEnlarged || isHovered ? '#fde68a' : '#e7e5e4'}
              strokeWidth="0.9"
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
