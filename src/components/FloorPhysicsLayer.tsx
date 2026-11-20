import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { FloorBall } from '../types/task';
import { useTasks } from '../context/TaskContext';
import {
  BALL_RADIUS,
  MAX_THROW_SPEED,
  TRASH_ENTER_DURATION_MS,
  VELOCITY_WINDOW_MS,
  clampBallsToViewport,
  computeThrowVelocity,
  createFloorBall,
  doesSegmentHitRect,
  getFloorY,
  stepFloorPhysics,
  type PointerSample,
  type ViewportSize,
} from '../utils/floorPhysics';
import { formatDisplayDate } from '../utils/dateBuckets';
import { getTagColor } from '../utils/tagColors';
import { playTrashPlopSound } from '../utils/sound';
import { CrumpledBall } from './CrumpledBall';

function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 768 };
  }
  return {
    width: window.innerWidth > 0 ? window.innerWidth : 1024,
    height: window.innerHeight > 0 ? window.innerHeight : 768,
  };
}

function applyBallTransform(
  el: HTMLDivElement,
  ball: FloorBall,
  nowMs: number,
): void {
  let scale = ball.isDragging ? 1.08 : 1;
  let opacity = 1;

  if (ball.enteringTrash) {
    const elapsed =
      ball.enterStartTime !== null ? Math.max(0, nowMs - ball.enterStartTime) : 0;
    const t = Math.min(1, elapsed / TRASH_ENTER_DURATION_MS);
    scale = Math.max(0.25, 1 - 0.72 * t);
    opacity = Math.max(0, 1 - 0.85 * t);
  }

  el.style.transform = `translate3d(${ball.x - ball.radius}px, ${ball.y - ball.radius}px, 0) rotate(${ball.rotation}deg) scale(${scale})`;
  el.style.opacity = String(opacity);
}

export function FloorPhysicsLayer() {
  const { state, dispatch, floorBallTasks, trashHitboxRef } = useTasks();

  const ballsRef = useRef<Map<number, FloorBall>>(new Map());
  const domRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const samplesRef = useRef<Map<number, PointerSample[]>>(new Map());
  const lastInFlightRef = useRef<boolean>(state.ballInFlight);
  const ballInFlightRef = useRef<boolean>(state.ballInFlight);
  const mutedRef = useRef<boolean>(state.muted);

  const [hoveredBallId, setHoveredBallId] = useState<number | null>(null);

  useEffect(() => {
    ballInFlightRef.current = state.ballInFlight;
  }, [state.ballInFlight]);

  useEffect(() => {
    mutedRef.current = state.muted;
  }, [state.muted]);

  // Sync state.floorBalls spawns with mutable 60fps physics map
  useLayoutEffect(() => {
    const viewport = getViewportSize();
    const activeIds = new Set(state.floorBalls.map((s) => s.taskId));

    for (const id of Array.from(ballsRef.current.keys())) {
      if (!activeIds.has(id)) {
        ballsRef.current.delete(id);
        samplesRef.current.delete(id);
      }
    }

    for (const spawn of state.floorBalls) {
      if (!ballsRef.current.has(spawn.taskId)) {
        ballsRef.current.set(spawn.taskId, createFloorBall(spawn, viewport));
      }
    }

    const nowMs = performance.now();
    for (const [id, ball] of ballsRef.current.entries()) {
      const el = domRefs.current.get(id);
      if (el) {
        applyBallTransform(el, ball, nowMs);
      }
    }

    if (hoveredBallId !== null && !activeIds.has(hoveredBallId)) {
      setHoveredBallId(null);
    }
  }, [state.floorBalls, hoveredBallId]);

  // Window resize clamping
  useEffect(() => {
    const handleResize = () => {
      const viewport = getViewportSize();
      const balls = Array.from(ballsRef.current.values());
      if (balls.length === 0) {
        return;
      }
      clampBallsToViewport(balls, viewport);
      const nowMs = performance.now();
      for (const ball of balls) {
        const el = domRefs.current.get(ball.taskId);
        if (el) {
          applyBallTransform(el, ball, nowMs);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 60fps requestAnimationFrame physics loop
  useEffect(() => {
    if (floorBallTasks.length === 0) {
      if (lastInFlightRef.current || ballInFlightRef.current) {
        lastInFlightRef.current = false;
        dispatch({ type: 'SET_BALL_IN_FLIGHT', payload: { inFlight: false } });
      }
      return;
    }

    let rafId = 0;
    let lastTime: number | null = null;
    let cancelled = false;

    const tick = (nowMs: number) => {
      if (cancelled) {
        return;
      }

      const dt = lastTime === null ? 1 / 60 : Math.max(0, (nowMs - lastTime) / 1000);
      lastTime = nowMs;

      const viewport = getViewportSize();
      const trashRect = trashHitboxRef.current?.getBoundingClientRect() ?? null;
      const balls = Array.from(ballsRef.current.values());

      const result = stepFloorPhysics(balls, dt, viewport, trashRect, nowMs);

      for (const ball of balls) {
        const el = domRefs.current.get(ball.taskId);
        if (el) {
          applyBallTransform(el, ball, nowMs);
        }
      }

      if (result.newlyHitTrashIds.length > 0) {
        playTrashPlopSound(mutedRef.current);
      }

      for (const id of result.finishedEnteringIds) {
        dispatch({ type: 'DROP_BALL_INTO_TRASH', payload: { id } });
      }

      if (
        result.hasBallInFlight !== ballInFlightRef.current ||
        result.hasBallInFlight !== lastInFlightRef.current
      ) {
        lastInFlightRef.current = result.hasBallInFlight;
        ballInFlightRef.current = result.hasBallInFlight;
        dispatch({
          type: 'SET_BALL_IN_FLIGHT',
          payload: { inFlight: result.hasBallInFlight },
        });
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [floorBallTasks.length, dispatch, trashHitboxRef]);

  const handlePointerDown = (
    taskId: number,
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    e.currentTarget.setPointerCapture?.(e.pointerId);

    const viewport = getViewportSize();
    const ball = ballsRef.current.get(taskId);
    const now = performance.now();

    if (ball) {
      const r = ball.radius || BALL_RADIUS;
      const maxX = Math.max(r, viewport.width - r);
      const floorY = getFloorY(viewport.height, r);
      ball.isDragging = true;
      ball.canScoreTrash = true;
      ball.vx = 0;
      ball.vy = 0;
      ball.vRot = 0;
      ball.x = Math.max(r, Math.min(maxX, e.clientX));
      ball.y = Math.max(r, Math.min(floorY, e.clientY));

      const el = domRefs.current.get(taskId);
      if (el) {
        applyBallTransform(el, ball, now);
      }
    }

    samplesRef.current.set(taskId, [{ x: e.clientX, y: e.clientY, t: now }]);
    setHoveredBallId((prev) => (prev === taskId ? null : prev));
    dispatch({ type: 'SET_DRAGGING_FLOOR_BALL', payload: { id: taskId } });
  };

  const handlePointerMove = (
    taskId: number,
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const ball = ballsRef.current.get(taskId);
    if (!ball || !ball.isDragging) {
      return;
    }

    const viewport = getViewportSize();
    const r = ball.radius || BALL_RADIUS;
    const maxX = Math.max(r, viewport.width - r);
    const maxY = Math.max(r, viewport.height - r);

    const clampedX = Math.max(r, Math.min(maxX, e.clientX));
    const clampedY = Math.max(r, Math.min(maxY, e.clientY));
    const now = performance.now();

    ball.x = clampedX;
    ball.y = clampedY;

    const el = domRefs.current.get(taskId);
    if (el) {
      applyBallTransform(el, ball, now);
    }

    const samples = samplesRef.current.get(taskId) ?? [];
    samples.push({ x: clampedX, y: clampedY, t: now });
    const cutoff = now - VELOCITY_WINDOW_MS;
    const pruned = samples.filter((s) => s.t >= cutoff);
    samplesRef.current.set(taskId, pruned.length >= 2 ? pruned : samples.slice(-2));
  };

  const handlePointerRelease = (
    taskId: number,
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const ball = ballsRef.current.get(taskId);
    if (!ball || !ball.isDragging) {
      return;
    }

    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }

    const samples = samplesRef.current.get(taskId) ?? [];
    const { vx, vy } = computeThrowVelocity(samples, MAX_THROW_SPEED);
    const now = performance.now();

    ball.vx = vx;
    ball.vy = vy;
    ball.vRot = Math.max(-720, Math.min(720, vx * 0.4));
    ball.isDragging = false;

    dispatch({ type: 'SET_DRAGGING_FLOOR_BALL', payload: { id: null } });

    const trashRect = trashHitboxRef.current?.getBoundingClientRect() ?? null;
    if (
      trashRect &&
      doesSegmentHitRect(ball.x, ball.y, ball.x, ball.y, trashRect)
    ) {
      ball.enteringTrash = true;
      ball.enterStartTime = now;
      ball.enterStartX = ball.x;
      ball.enterStartY = ball.y;
      ball.vx = 0;
      ball.vy = 0;
      ball.vRot = 0;
      playTrashPlopSound(mutedRef.current);
      const el = domRefs.current.get(taskId);
      if (el) {
        applyBallTransform(el, ball, now);
      }
      return;
    }

    if (Math.hypot(vx, vy) > 80) {
      lastInFlightRef.current = true;
      ballInFlightRef.current = true;
      dispatch({ type: 'SET_BALL_IN_FLIGHT', payload: { inFlight: true } });
    }
  };

  const handleContextMenu = (
    taskId: number,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredBallId(null);
    dispatch({
      type: 'OPEN_CONTEXT_MENU',
      payload: {
        kind: 'floorBall',
        taskId,
        x: e.clientX,
        y: e.clientY,
      },
    });
  };

  return (
    <div
      data-testid="floor-physics-layer"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 'var(--z-floor-physics)',
      }}
    >
      {floorBallTasks.map((task) => {
        const isDragging = state.draggingFloorBallId === task.id;
        const showTooltip = hoveredBallId === task.id && !isDragging;

        return (
          <div
            key={task.id}
            ref={(el) => {
              if (el) {
                domRefs.current.set(task.id, el);
              } else {
                domRefs.current.delete(task.id);
              }
            }}
            data-testid={`floor-ball-${task.id}`}
            role="button"
            tabIndex={0}
            aria-label={`Zgnieciona kulka: ${task.tytul}`}
            onPointerDown={(e) => handlePointerDown(task.id, e)}
            onPointerMove={(e) => handlePointerMove(task.id, e)}
            onPointerUp={(e) => handlePointerRelease(task.id, e)}
            onPointerCancel={(e) => handlePointerRelease(task.id, e)}
            onPointerEnter={() => {
              if (!isDragging) {
                setHoveredBallId(task.id);
              }
            }}
            onPointerLeave={() => {
              setHoveredBallId((prev) => (prev === task.id ? null : prev));
            }}
            onContextMenu={(e) => handleContextMenu(task.id, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                dispatch({
                  type: 'OPEN_CONTEXT_MENU',
                  payload: {
                    kind: 'floorBall',
                    taskId: task.id,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  },
                });
              }
            }}
            style={{
              pointerEvents: 'auto',
              position: 'fixed',
              left: 0,
              top: 0,
              width: 48,
              height: 48,
              touchAction: 'none',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
          >
            <CrumpledBall priority={task.priorytet} taskId={task.id} size={48} />

            {showTooltip && (
              <div
                data-testid={`floor-ball-tooltip-${task.id}`}
                className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-amber-900/30 bg-[#fdf8ee] px-2.5 py-1.5 text-xs text-[#2b231d] shadow-lg"
                style={{ zIndex: 5 }}
              >
                <div className="max-w-[200px] truncate font-semibold">
                  {task.tytul}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#5c4f44]">
                  <span>{formatDisplayDate(task.termin)}</span>
                  {task.tagi.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      {task.tagi.slice(0, 4).map((tag, idx) => (
                        <span
                          key={`${tag}-${idx}`}
                          title={tag}
                          className="inline-block h-2 w-2 rounded-full border border-black/15"
                          style={{ backgroundColor: getTagColor(tag).bg }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
