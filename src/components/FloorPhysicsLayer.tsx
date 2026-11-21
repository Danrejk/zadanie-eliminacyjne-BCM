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
  type ExpandedTrashCollider,
  type PointerSample,
  type ViewportSize,
} from '../utils/floorPhysics';
import { formatDisplayDate } from '../utils/dateBuckets';
import { getTagColor } from '../utils/tagColors';
import { playBallBounceSound, playTrashPlopSound, unlockAudioContext } from '../utils/sound';
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

interface RenderedBallState {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
}

function applyBallTransform(
  el: HTMLDivElement,
  visualEl: HTMLDivElement | undefined,
  ball: FloorBall,
  nowMs: number,
  lastRenderedMap?: Map<number, RenderedBallState>,
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

  const qx = Math.round(ball.x * 10) / 10;
  const qy = Math.round(ball.y * 10) / 10;
  const qRot = Math.round(ball.rotation * 10) / 10;

  if (lastRenderedMap) {
    const prev = lastRenderedMap.get(ball.taskId);
    if (
      prev &&
      prev.x === qx &&
      prev.y === qy &&
      prev.rotation === qRot &&
      prev.scale === scale &&
      prev.opacity === opacity
    ) {
      return;
    }
    lastRenderedMap.set(ball.taskId, {
      x: qx,
      y: qy,
      rotation: qRot,
      scale,
      opacity,
    });
  }

  el.style.transform = `translate3d(${qx - ball.radius}px, ${qy - ball.radius}px, 0)`;
  el.style.opacity = String(opacity);
  if (visualEl) {
    visualEl.style.transform = `rotate(${qRot}deg) scale(${scale})`;
  }
}

function distPointToSegmentSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

const SWEEP_EXCLUDED_SELECTOR = [
  '[data-testid^="floor-ball-"]',
  '[data-testid^="postit-note-"]',
  '[data-testid="trash-can-widget"]',
  '[data-testid="context-menu"]',
  '[data-testid="context-menu-backdrop"]',
  'header',
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  '[role="button"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
].join(', ');

export function FloorPhysicsLayer() {
  const {
    state,
    dispatch,
    floorBallTasks,
    trashHitboxRef,
    trashHoopRef,
    trashBodyRef,
    trashDrawerBoxRef,
    noteDrag,
  } = useTasks();

  const ballsRef = useRef<Map<number, FloorBall>>(new Map());
  const domRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const ballVisualRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastRenderedRef = useRef<Map<number, RenderedBallState>>(new Map());
  const samplesRef = useRef<Map<number, PointerSample[]>>(new Map());
  const lastBounceSoundMapRef = useRef<Map<number, number>>(new Map());
  const trashRectRef = useRef<DOMRect | null>(null);
  const viewportRef = useRef<ViewportSize>(getViewportSize());
  const wakeLoopRef = useRef<(() => void) | null>(null);
  const lastInFlightRef = useRef<boolean>(state.ballInFlight);
  const ballInFlightRef = useRef<boolean>(state.ballInFlight);
  const mutedRef = useRef<boolean>(state.muted);
  const trashDrawerOpenRef = useRef<boolean>(state.trashDrawerOpen);
  const draggingBallIdRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const sweepPointerRef = useRef<{
    pointerId: number | null;
    x: number;
    y: number;
  } | null>(null);
  const activeModalTypeRef = useRef(state.activeModal.type);
  const contextMenuOpenRef = useRef(state.contextMenu !== null);
  const draggingNoteIdRef = useRef(state.draggingNoteId);
  const noteDragRef = useRef(noteDrag);

  const [hoveredBallId, setHoveredBallId] = useState<number | null>(null);

  useEffect(() => {
    ballInFlightRef.current = state.ballInFlight;
  }, [state.ballInFlight]);

  useEffect(() => {
    mutedRef.current = state.muted;
  }, [state.muted]);

  useEffect(() => {
    trashDrawerOpenRef.current = state.trashDrawerOpen;
    wakeLoopRef.current?.();
  }, [state.trashDrawerOpen]);

  useEffect(() => {
    activeModalTypeRef.current = state.activeModal.type;
  }, [state.activeModal.type]);

  useEffect(() => {
    contextMenuOpenRef.current = state.contextMenu !== null;
  }, [state.contextMenu]);

  useEffect(() => {
    draggingNoteIdRef.current = state.draggingNoteId;
  }, [state.draggingNoteId]);

  useEffect(() => {
    noteDragRef.current = noteDrag;
  }, [noteDrag]);

  // Sync state.floorBalls spawns with mutable 60fps physics map
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const activeIds = new Set(state.floorBalls.map((s) => s.taskId));

    for (const id of Array.from(ballsRef.current.keys())) {
      if (!activeIds.has(id)) {
        ballsRef.current.delete(id);
        samplesRef.current.delete(id);
        lastBounceSoundMapRef.current.delete(id);
        lastRenderedRef.current.delete(id);
        if (draggingBallIdRef.current === id) {
          draggingBallIdRef.current = null;
          activePointerIdRef.current = null;
        }
      }
    }

    let spawnedNewBall = false;
    for (const spawn of state.floorBalls) {
      if (!ballsRef.current.has(spawn.taskId)) {
        ballsRef.current.set(spawn.taskId, createFloorBall(spawn, viewport));
        spawnedNewBall = true;
      }
    }

    const nowMs = performance.now();
    for (const [id, ball] of ballsRef.current.entries()) {
      const el = domRefs.current.get(id);
      if (el) {
        applyBallTransform(
          el,
          ballVisualRefs.current.get(id),
          ball,
          nowMs,
          lastRenderedRef.current,
        );
      }
    }

    if (spawnedNewBall) {
      wakeLoopRef.current?.();
    }

    if (hoveredBallId !== null && !activeIds.has(hoveredBallId)) {
      setHoveredBallId(null);
    }
  }, [state.floorBalls, hoveredBallId]);

  // Window resize clamping & trash hitbox / viewport cache refresh
  useEffect(() => {
    const refreshTrashRect = () => {
      trashRectRef.current = trashHitboxRef.current?.getBoundingClientRect() ?? null;
    };

    const handleResize = () => {
      refreshTrashRect();
      const viewport = getViewportSize();
      viewportRef.current = viewport;
      const balls = Array.from(ballsRef.current.values());
      if (balls.length === 0) {
        return;
      }
      clampBallsToViewport(balls, viewport);
      const nowMs = performance.now();
      for (const ball of balls) {
        const el = domRefs.current.get(ball.taskId);
        if (el) {
          applyBallTransform(
            el,
            ballVisualRefs.current.get(ball.taskId),
            ball,
            nowMs,
            lastRenderedRef.current,
          );
        }
      }
      wakeLoopRef.current?.();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', refreshTrashRect, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', refreshTrashRect);
    };
  }, [trashHitboxRef]);

  // Cancel active drag cleanly on window blur
  useEffect(() => {
    const handleWindowBlur = () => {
      sweepPointerRef.current = null;
      draggingBallIdRef.current = null;
      activePointerIdRef.current = null;
      let hadDragging = false;
      const now = performance.now();
      for (const ball of ballsRef.current.values()) {
        if (ball.isDragging) {
          ball.isDragging = false;
          ball.vx = 0;
          ball.vy = 0;
          ball.vRot = 0;
          samplesRef.current.delete(ball.taskId);
          const el = domRefs.current.get(ball.taskId);
          if (el) {
            applyBallTransform(
              el,
              ballVisualRefs.current.get(ball.taskId),
              ball,
              now,
              lastRenderedRef.current,
            );
          }
          hadDragging = true;
        }
      }
      if (hadDragging) {
        dispatch({ type: 'SET_DRAGGING_FLOOR_BALL', payload: { id: null } });
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [dispatch]);

  // 60fps requestAnimationFrame physics loop with automatic sleep when balls settle
  useEffect(() => {
    if (floorBallTasks.length === 0) {
      wakeLoopRef.current = null;
      if (lastInFlightRef.current || ballInFlightRef.current) {
        lastInFlightRef.current = false;
        dispatch({ type: 'SET_BALL_IN_FLIGHT', payload: { inFlight: false } });
      }
      return;
    }

    trashRectRef.current = trashHitboxRef.current?.getBoundingClientRect() ?? null;

    let rafId = 0;
    let lastTime: number | null = null;
    let cancelled = false;
    let isRunning = false;

    const areAllBallsAtRest = (balls: FloorBall[], viewport: ViewportSize): boolean => {
      for (const ball of balls) {
        if (ball.isDragging || ball.enteringTrash) {
          return false;
        }
        const floorY = getFloorY(viewport.height, ball.radius || BALL_RADIUS);
        if (
          ball.y < floorY - 0.5 ||
          Math.hypot(ball.vx, ball.vy) >= 0.05 ||
          Math.abs(ball.vRot) >= 0.05
        ) {
          return false;
        }
      }
      return true;
    };

    const tick = (nowMs: number) => {
      if (cancelled) {
        isRunning = false;
        return;
      }

      const dt = lastTime === null ? 1 / 60 : Math.max(0, (nowMs - lastTime) / 1000);
      lastTime = nowMs;

      const viewport = viewportRef.current;
      const trashRect =
        trashRectRef.current ?? trashHitboxRef.current?.getBoundingClientRect() ?? null;
      let expandedTrash: ExpandedTrashCollider | null = null;
      if (trashDrawerOpenRef.current) {
        const hoopRect = trashHoopRef.current?.getBoundingClientRect() ?? null;
        const bodyRect = trashBodyRef.current?.getBoundingClientRect() ?? null;
        const drawerRect = trashDrawerBoxRef.current?.getBoundingClientRect() ?? null;
        if (hoopRect && bodyRect) {
          expandedTrash = { hoopRect, bodyRect, drawerRect };
        }
      }
      const balls = Array.from(ballsRef.current.values());

      const result = stepFloorPhysics(
        balls,
        dt,
        viewport,
        trashRect,
        nowMs,
        expandedTrash,
      );

      for (const ball of balls) {
        const el = domRefs.current.get(ball.taskId);
        if (el) {
          applyBallTransform(
            el,
            ballVisualRefs.current.get(ball.taskId),
            ball,
            nowMs,
            lastRenderedRef.current,
          );
        }
      }

      if (
        sweepPointerRef.current !== null &&
        draggingBallIdRef.current === null &&
        activeModalTypeRef.current === 'none' &&
        !contextMenuOpenRef.current &&
        draggingNoteIdRef.current === null &&
        noteDragRef.current === null
      ) {
        const sweep = sweepPointerRef.current;
        const hitId = findSweepHitBallRef.current(sweep.x, sweep.y, sweep.x, sweep.y);
        if (hitId !== null) {
          grabBallRef.current(hitId, sweep.x, sweep.y, sweep.pointerId);
        }
      }

      if (result.bouncedEvents.length > 0) {
        let loudestBounce: (typeof result.bouncedEvents)[number] | null = null;
        for (const ev of result.bouncedEvents) {
          const lastAt = lastBounceSoundMapRef.current.get(ev.taskId) ?? -Infinity;
          if (nowMs - lastAt >= 45) {
            if (!loudestBounce || ev.impactSpeed > loudestBounce.impactSpeed) {
              loudestBounce = ev;
            }
          }
        }
        if (loudestBounce) {
          for (const ev of result.bouncedEvents) {
            lastBounceSoundMapRef.current.set(ev.taskId, nowMs);
          }
          playBallBounceSound(
            mutedRef.current,
            loudestBounce.impactSpeed,
            loudestBounce.surface,
          );
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

      if (balls.length === 0 || areAllBallsAtRest(balls, viewport)) {
        isRunning = false;
        lastTime = null;
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const wakeLoop = () => {
      if (cancelled || isRunning) {
        return;
      }
      isRunning = true;
      lastTime = null;
      rafId = window.requestAnimationFrame(tick);
    };

    wakeLoopRef.current = wakeLoop;
    wakeLoop();

    return () => {
      cancelled = true;
      isRunning = false;
      wakeLoopRef.current = null;
      window.cancelAnimationFrame(rafId);
    };
  }, [floorBallTasks.length, dispatch, trashHitboxRef]);

  const findSweepHitBall = (
    prevX: number,
    prevY: number,
    currX: number,
    currY: number,
  ): number | null => {
    let bestId: number | null = null;
    let bestDistSq = Infinity;

    for (const ball of ballsRef.current.values()) {
      if (ball.enteringTrash || ball.isDragging) {
        continue;
      }
      const r = ball.radius || BALL_RADIUS;
      const segDistSq = distPointToSegmentSq(
        ball.x,
        ball.y,
        prevX,
        prevY,
        currX,
        currY,
      );
      if (segDistSq <= r * r) {
        const endDistSq =
          (ball.x - currX) * (ball.x - currX) + (ball.y - currY) * (ball.y - currY);
        if (endDistSq < bestDistSq) {
          bestDistSq = endDistSq;
          bestId = ball.taskId;
        }
      }
    }

    return bestId;
  };

  const grabBall = (
    taskId: number,
    clientX: number,
    clientY: number,
    pointerId: number | null,
  ): boolean => {
    if (draggingBallIdRef.current !== null) {
      return false;
    }
    const ball = ballsRef.current.get(taskId);
    if (!ball || ball.enteringTrash) {
      return false;
    }

    draggingBallIdRef.current = taskId;
    activePointerIdRef.current = pointerId;
    sweepPointerRef.current = null;

    unlockAudioContext(mutedRef.current);

    const viewport = viewportRef.current;
    const now = performance.now();

    const r = ball.radius || BALL_RADIUS;
    const maxX = Math.max(r, viewport.width - r);
    const floorY = getFloorY(viewport.height, r);
    ball.isDragging = true;
    ball.canScoreTrash = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.vRot = 0;
    ball.x = Math.max(r, Math.min(maxX, clientX));
    ball.y = Math.max(r, Math.min(floorY, clientY));

    const el = domRefs.current.get(taskId);
    if (el) {
      applyBallTransform(
        el,
        ballVisualRefs.current.get(taskId),
        ball,
        now,
        lastRenderedRef.current,
      );
    }

    samplesRef.current.set(taskId, [{ x: clientX, y: clientY, t: now }]);
    setHoveredBallId((prev) => (prev === taskId ? null : prev));
    dispatch({ type: 'SET_DRAGGING_FLOOR_BALL', payload: { id: taskId } });
    wakeLoopRef.current?.();
    return true;
  };

  const findSweepHitBallRef = useRef(findSweepHitBall);
  findSweepHitBallRef.current = findSweepHitBall;

  const grabBallRef = useRef(grabBall);
  grabBallRef.current = grabBall;

  const moveDraggedBall = (
    taskId: number,
    clientX: number,
    clientY: number,
  ) => {
    const ball = ballsRef.current.get(taskId);
    if (!ball || ball.enteringTrash || !ball.isDragging) {
      return;
    }

    const viewport = viewportRef.current;
    const r = ball.radius || BALL_RADIUS;
    const maxX = Math.max(r, viewport.width - r);
    const maxY = Math.max(r, viewport.height - r);

    const clampedX = Math.max(r, Math.min(maxX, clientX));
    const clampedY = Math.max(r, Math.min(maxY, clientY));
    const now = performance.now();

    ball.x = clampedX;
    ball.y = clampedY;

    const el = domRefs.current.get(taskId);
    if (el) {
      applyBallTransform(
        el,
        ballVisualRefs.current.get(taskId),
        ball,
        now,
        lastRenderedRef.current,
      );
    }

    const samples = samplesRef.current.get(taskId) ?? [];
    samples.push({ x: clampedX, y: clampedY, t: now });
    const cutoff = now - VELOCITY_WINDOW_MS;
    const pruned = samples.filter((s) => s.t >= cutoff);
    samplesRef.current.set(taskId, pruned.length >= 2 ? pruned : samples.slice(-2));
  };

  const releaseDraggedBall = (taskId: number, pointerId?: number) => {
    const ball = ballsRef.current.get(taskId);
    draggingBallIdRef.current = null;
    activePointerIdRef.current = null;

    if (!ball || ball.enteringTrash || !ball.isDragging) {
      return;
    }

    const el = domRefs.current.get(taskId);
    if (el && pointerId != null && el.hasPointerCapture?.(pointerId)) {
      el.releasePointerCapture?.(pointerId);
    }

    unlockAudioContext(mutedRef.current);

    const samples = samplesRef.current.get(taskId) ?? [];
    const { vx, vy } = computeThrowVelocity(samples, MAX_THROW_SPEED);
    const now = performance.now();

    ball.vx = vx;
    ball.vy = vy;
    ball.vRot = Math.max(-720, Math.min(720, vx * 0.4));
    ball.isDragging = false;

    dispatch({ type: 'SET_DRAGGING_FLOOR_BALL', payload: { id: null } });

    const rawTargetRect = trashDrawerOpenRef.current
      ? trashBodyRef.current?.getBoundingClientRect() ?? null
      : trashHitboxRef.current?.getBoundingClientRect() ?? null;
    if (!trashDrawerOpenRef.current) {
      trashRectRef.current = rawTargetRect;
    }
    const targetRect = rawTargetRect
      ? trashDrawerOpenRef.current
        ? {
            left: rawTargetRect.left + rawTargetRect.width * (46 / 280),
            top: rawTargetRect.top + rawTargetRect.height * (210 / 296),
            right: rawTargetRect.left + rawTargetRect.width * (234 / 280),
            bottom: rawTargetRect.bottom,
          }
        : {
            left: rawTargetRect.left + rawTargetRect.width * 0.16,
            top: rawTargetRect.top + rawTargetRect.height * 0.22,
            right: rawTargetRect.right - rawTargetRect.width * 0.16,
            bottom: rawTargetRect.bottom - rawTargetRect.height * 0.08,
          }
      : null;
    if (
      targetRect &&
      doesSegmentHitRect(ball.x, ball.y, ball.x, ball.y, targetRect, 0)
    ) {
      ball.enteringTrash = true;
      ball.enterStartTime = now;
      ball.enterStartX = ball.x;
      ball.enterStartY = ball.y;
      ball.vx = 0;
      ball.vy = 0;
      ball.vRot = 0;
      playTrashPlopSound(mutedRef.current);
      if (el) {
        applyBallTransform(
          el,
          ballVisualRefs.current.get(taskId),
          ball,
          now,
          lastRenderedRef.current,
        );
      }
      wakeLoopRef.current?.();
      return;
    }

    wakeLoopRef.current?.();

    if (Math.hypot(vx, vy) > 80) {
      lastInFlightRef.current = true;
      ballInFlightRef.current = true;
      dispatch({ type: 'SET_BALL_IN_FLIGHT', payload: { inFlight: true } });
    }
  };

  const cancelDraggedBall = (taskId: number, pointerId?: number) => {
    const ball = ballsRef.current.get(taskId);
    draggingBallIdRef.current = null;
    activePointerIdRef.current = null;

    if (!ball || ball.enteringTrash || !ball.isDragging) {
      return;
    }

    const el = domRefs.current.get(taskId);
    if (el && pointerId != null && el.hasPointerCapture?.(pointerId)) {
      el.releasePointerCapture?.(pointerId);
    }

    ball.isDragging = false;
    ball.vx = 0;
    ball.vy = 0;
    ball.vRot = 0;
    samplesRef.current.delete(taskId);

    const now = performance.now();
    if (el) {
      applyBallTransform(el, ballVisualRefs.current.get(taskId), ball, now);
    }

    dispatch({ type: 'SET_DRAGGING_FLOOR_BALL', payload: { id: null } });
  };

  const dragHandlersRef = useRef({
    moveDraggedBall,
    releaseDraggedBall,
    cancelDraggedBall,
  });
  dragHandlersRef.current = {
    moveDraggedBall,
    releaseDraggedBall,
    cancelDraggedBall,
  };

  useEffect(() => {
    const matchesPointerId = (
      expectedId: number | null,
      actualId: number | undefined,
    ): boolean => {
      if (expectedId === null || actualId == null) {
        return true;
      }
      return expectedId === actualId;
    };

    const onWindowPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) {
        return;
      }
      if (draggingBallIdRef.current !== null) {
        return;
      }
      if (
        activeModalTypeRef.current !== 'none' ||
        contextMenuOpenRef.current ||
        draggingNoteIdRef.current !== null ||
        noteDragRef.current !== null
      ) {
        return;
      }
      if (
        e.target instanceof Element &&
        e.target.closest(SWEEP_EXCLUDED_SELECTOR)
      ) {
        return;
      }

      sweepPointerRef.current = {
        pointerId: e.pointerId ?? null,
        x: e.clientX,
        y: e.clientY,
      };
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      if (e.isTrusted && e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        if (draggingBallIdRef.current !== null) {
          dragHandlersRef.current.releaseDraggedBall(
            draggingBallIdRef.current,
            e.pointerId,
          );
        }
        sweepPointerRef.current = null;
        return;
      }

      if (draggingBallIdRef.current !== null) {
        if (!matchesPointerId(activePointerIdRef.current, e.pointerId)) {
          return;
        }
        dragHandlersRef.current.moveDraggedBall(
          draggingBallIdRef.current,
          e.clientX,
          e.clientY,
        );
        return;
      }

      const sweep = sweepPointerRef.current;
      if (!sweep || !matchesPointerId(sweep.pointerId, e.pointerId)) {
        return;
      }

      if (
        activeModalTypeRef.current !== 'none' ||
        contextMenuOpenRef.current ||
        draggingNoteIdRef.current !== null ||
        noteDragRef.current !== null
      ) {
        sweepPointerRef.current = null;
        return;
      }

      const hitId = findSweepHitBallRef.current(
        sweep.x,
        sweep.y,
        e.clientX,
        e.clientY,
      );
      if (hitId !== null) {
        grabBallRef.current(hitId, e.clientX, e.clientY, sweep.pointerId);
      } else {
        sweep.x = e.clientX;
        sweep.y = e.clientY;
      }
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      if (
        draggingBallIdRef.current !== null &&
        matchesPointerId(activePointerIdRef.current, e.pointerId)
      ) {
        dragHandlersRef.current.releaseDraggedBall(
          draggingBallIdRef.current,
          e.pointerId,
        );
      }
      if (
        sweepPointerRef.current !== null &&
        matchesPointerId(sweepPointerRef.current.pointerId, e.pointerId)
      ) {
        sweepPointerRef.current = null;
      }
    };

    const onWindowPointerCancel = (e: PointerEvent) => {
      if (
        draggingBallIdRef.current !== null &&
        matchesPointerId(activePointerIdRef.current, e.pointerId)
      ) {
        dragHandlersRef.current.cancelDraggedBall(
          draggingBallIdRef.current,
          e.pointerId,
        );
      }
      if (
        sweepPointerRef.current !== null &&
        matchesPointerId(sweepPointerRef.current.pointerId, e.pointerId)
      ) {
        sweepPointerRef.current = null;
      }
    };

    window.addEventListener('pointerdown', onWindowPointerDown);
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    return () => {
      window.removeEventListener('pointerdown', onWindowPointerDown);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
    };
  }, []);

  const handlePointerDown = (
    taskId: number,
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (e.button !== 0 || draggingBallIdRef.current !== null) {
      return;
    }
    const ball = ballsRef.current.get(taskId);
    if (!ball || ball.enteringTrash) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    e.currentTarget.setPointerCapture?.(e.pointerId);
    grabBall(taskId, e.clientX, e.clientY, e.pointerId ?? null);
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
            <div
              ref={(el) => {
                if (el) {
                  ballVisualRefs.current.set(task.id, el);
                } else {
                  ballVisualRefs.current.delete(task.id);
                }
              }}
              style={{
                width: 48,
                height: 48,
                transformOrigin: 'center center',
              }}
            >
              <CrumpledBall priority={task.priorytet} taskId={task.id} size={48} />
            </div>

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
