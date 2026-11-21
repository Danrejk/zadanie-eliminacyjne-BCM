import type { FloorBall, FloorBallSpawn } from '../types/task';

export const BALL_RADIUS = 24;               // 48x48px visual diameter
export const GRAVITY = 1900;                 // px/s^2
export const BOUNCE_RESTITUTION = 0.42;      // floor vertical restitution
export const WALL_RESTITUTION = 0.55;        // left/right/ceiling restitution
export const FLOOR_ROLL_DAMPING = 0.08;      // applied as vx *= Math.pow(0.08, dt) on floor
export const AIR_DRAG_60HZ = 0.995;          // applied as Math.pow(0.995, dt * 60)
export const MAX_DT = 0.033;                 // 33ms clamp (anti-tunneling after tab switch)
export const MAX_THROW_SPEED = 2400;         // px/s vector magnitude clamp
export const STOP_SPEED_EPS = 18;            // px/s rest threshold
export const BOUNCE_SOUND_MIN_SPEED = STOP_SPEED_EPS * 2; // px/s minimum impact speed for audible bounce
export const FLOOR_BOTTOM_MARGIN = 16;       // px below resting ball bottom edge
export const TRASH_HITBOX_PADDING = 10;      // px forgiving expansion around trash rect
export const TRASH_ENTER_DURATION_MS = 200;  // shrink-into-bin "plop" duration
export const VELOCITY_WINDOW_MS = 80;        // pointer velocity averaging window
export const SEPARATION_FACTOR = 1.7;        // soft separation threshold (BALL_RADIUS * 1.7)

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PointerSample {
  x: number;
  y: number;
  t: number; // ms timestamp
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ExpandedTrashCollider {
  hoopRect: RectLike;         // top hoop opening sensor
  bodyRect: RectLike;         // solid left, right, and bottom walls of the expanded basket
  drawerRect?: RectLike | null; // solid side-view physical drawer box
}

export interface BounceEvent {
  taskId: number;
  impactSpeed: number;
}

export interface PhysicsStepResult {
  newlyHitTrashIds: number[];     // taskIds that collided with trash hitbox on this step
  finishedEnteringIds: number[];  // taskIds whose 200ms plop animation completed
  bouncedEvents: BounceEvent[];   // balls that bounced off floor, walls, ceiling, or solid basket surfaces
  hasBallInFlight: boolean;       // true while any non-dragging, non-entering ball has canScoreTrash
}

function safeRadiusValue(radius: number): number {
  return Number.isFinite(radius) && radius > 0 ? radius : BALL_RADIUS;
}

function safeDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function isFiniteRect(rect: RectLike): boolean {
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.bottom) &&
    rect.right > rect.left &&
    rect.bottom > rect.top
  );
}

export function getFloorY(viewportHeight: number, radius: number = BALL_RADIUS): number {
  const r = safeRadiusValue(radius);
  const safeH = safeDimension(viewportHeight);
  return Math.max(r, safeH - FLOOR_BOTTOM_MARGIN - r);
}

/**
 * Spawns a new crumpled paper ball with subtle upward pop, anti-overlap leftward nudge
 * near the bottom-right TrashCanWidget, and canScoreTrash = false to prevent auto-scoring.
 */
export function createFloorBall(
  spawn: FloorBallSpawn,
  viewport: ViewportSize,
  radius: number = BALL_RADIUS,
): FloorBall {
  const r = safeRadiusValue(radius);
  const safeW = safeDimension(viewport.width);
  const safeH = safeDimension(viewport.height);
  const maxX = Math.max(r, safeW - r);
  const floorY = getFloorY(safeH, r);
  const safeOriginX = Number.isFinite(spawn.originX) ? spawn.originX : maxX / 2;
  const safeOriginY = Number.isFinite(spawn.originY) ? spawn.originY : floorY / 2;
  const x = Math.max(r, Math.min(maxX, safeOriginX));
  const y = Math.max(r, Math.min(floorY, safeOriginY));

  const absId = Number.isFinite(spawn.taskId) ? Math.abs(Math.trunc(spawn.taskId)) : 0;
  const defaultVx =
    safeOriginX > safeW - 220
      ? -160 - (absId % 5) * 18
      : ((absId * 37) % 140) - 70;
  const vx = Number.isFinite(spawn.vx) ? (spawn.vx as number) : defaultVx;
  const vy = Number.isFinite(spawn.vy) ? (spawn.vy as number) : -120;
  const rotation = (absId * 47) % 360;
  const vRot = Math.max(-720, Math.min(720, vx * 1.2));

  return {
    taskId: spawn.taskId,
    x,
    y,
    vx,
    vy,
    rotation,
    vRot,
    radius: r,
    isDragging: false,
    canScoreTrash: false,
    enteringTrash: false,
    enterStartTime: null,
    enterStartX: x,
    enterStartY: y,
  };
}

/**
 * Computes clamped throw velocity (px/s) over the trailing VELOCITY_WINDOW_MS pointer samples.
 */
export function computeThrowVelocity(
  samples: readonly PointerSample[],
  maxSpeed: number = MAX_THROW_SPEED,
): { vx: number; vy: number } {
  if (!Number.isFinite(maxSpeed) || maxSpeed <= 0 || samples.length < 2) {
    return { vx: 0, vy: 0 };
  }

  const validSamples: PointerSample[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.t)) {
      validSamples.push(s);
    }
  }

  if (validSamples.length < 2) {
    return { vx: 0, vy: 0 };
  }

  const last = validSamples[validSamples.length - 1];
  let first: PointerSample | null = null;

  for (let i = 0; i < validSamples.length - 1; i++) {
    const s = validSamples[i];
    const ageMs = last.t - s.t;
    if (ageMs > 0 && ageMs <= VELOCITY_WINDOW_MS) {
      first = s;
      break;
    }
  }

  if (first === null) {
    for (let i = validSamples.length - 2; i >= 0; i--) {
      if (validSamples[i].t < last.t) {
        first = validSamples[i];
        break;
      }
    }
  }

  if (first === null) {
    return { vx: 0, vy: 0 };
  }

  const dtSec = (last.t - first.t) / 1000;
  if (!Number.isFinite(dtSec) || dtSec <= 0.001) {
    return { vx: 0, vy: 0 };
  }

  const dx = last.x - first.x;
  const dy = last.y - first.y;
  let vx = dx / dtSec;
  let vy = dy / dtSec;

  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) {
    const angle = Math.atan2(dy, dx);
    vx = Math.cos(angle) * maxSpeed;
    vy = Math.sin(angle) * maxSpeed;
  } else if (speed > maxSpeed && speed > 0) {
    const scale = maxSpeed / speed;
    vx *= scale;
    vy *= scale;
  }

  if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
    return { vx: 0, vy: 0 };
  }

  return {
    vx: vx === 0 ? 0 : vx,
    vy: vy === 0 ? 0 : vy,
  };
}

/**
 * Swept Liang-Barsky segment-vs-AABB intersection check (prevents high-speed tunneling).
 */
export function doesSegmentHitRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: RectLike,
  padding: number = TRASH_HITBOX_PADDING,
): boolean {
  if (
    !Number.isFinite(x1) ||
    !Number.isFinite(y1) ||
    !Number.isFinite(x2) ||
    !Number.isFinite(y2) ||
    !Number.isFinite(padding) ||
    !isFiniteRect(rect)
  ) {
    return false;
  }

  const minX = rect.left - padding;
  const maxX = rect.right + padding;
  const minY = rect.top - padding;
  const maxY = rect.bottom + padding;

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY) ||
    minX > maxX ||
    minY > maxY
  ) {
    return false;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;

  let tMin = 0;
  let tMax = 1;

  if (dx === 0) {
    if (x1 < minX || x1 > maxX) {
      return false;
    }
  } else {
    const tx1 = (minX - x1) / dx;
    const tx2 = (maxX - x1) / dx;
    tMin = Math.max(tMin, Math.min(tx1, tx2));
    tMax = Math.min(tMax, Math.max(tx1, tx2));
    if (tMax < tMin) {
      return false;
    }
  }

  if (dy === 0) {
    if (y1 < minY || y1 > maxY) {
      return false;
    }
  } else {
    const ty1 = (minY - y1) / dy;
    const ty2 = (maxY - y1) / dy;
    tMin = Math.max(tMin, Math.min(ty1, ty2));
    tMax = Math.min(tMax, Math.max(ty1, ty2));
    if (tMax < tMin) {
      return false;
    }
  }

  return tMax >= tMin;
}

/**
 * Clamps all non-entering balls inside the current viewport bounds (e.g. on window resize).
 */
export function clampBallsToViewport(balls: FloorBall[], viewport: ViewportSize): void {
  const safeW = safeDimension(viewport.width);
  const safeH = safeDimension(viewport.height);

  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    if (ball.enteringTrash) {
      continue;
    }
    const r = safeRadiusValue(ball.radius);
    ball.radius = r;
    const minX = r;
    const maxX = Math.max(r, safeW - r);
    const floorY = getFloorY(safeH, r);

    const curX = Number.isFinite(ball.x) ? ball.x : minX;
    const curY = Number.isFinite(ball.y) ? ball.y : floorY;
    ball.x = Math.max(minX, Math.min(maxX, curX));
    ball.y = Math.max(r, Math.min(floorY, curY));
  }
}

function resolveCircleRectBounce(ball: FloorBall, rect: RectLike): number {
  const r = ball.radius;
  const closestX = Math.max(rect.left, Math.min(ball.x, rect.right));
  const closestY = Math.max(rect.top, Math.min(ball.y, rect.bottom));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= r * r) {
    return 0;
  }

  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = r - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= (1 + WALL_RESTITUTION) * vn * nx;
      ball.vy -= (1 + WALL_RESTITUTION) * vn * ny;
      ball.vRot = Math.max(-720, Math.min(720, ball.vx * 0.45));
      const impact = -vn;
      return impact > BOUNCE_SOUND_MIN_SPEED ? impact : 0;
    }
    return 0;
  }

  // Ball center is inside the rect; push out along the shallowest side
  const penLeft = Math.abs(ball.x - rect.left);
  const penRight = Math.abs(rect.right - ball.x);
  const penTop = Math.abs(ball.y - rect.top);
  const penBottom = Math.abs(rect.bottom - ball.y);
  const minPen = Math.min(penLeft, penRight, penTop, penBottom);

  let impact = 0;
  if (minPen === penLeft) {
    impact = ball.vx > 0 ? ball.vx : 0;
    ball.x = rect.left - r;
    ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
  } else if (minPen === penRight) {
    impact = ball.vx < 0 ? -ball.vx : 0;
    ball.x = rect.right + r;
    ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
  } else if (minPen === penTop) {
    impact = ball.vy > 0 ? ball.vy : 0;
    ball.y = rect.top - r;
    ball.vy = -Math.abs(ball.vy) * WALL_RESTITUTION;
  } else {
    impact = ball.vy < 0 ? -ball.vy : 0;
    ball.y = rect.bottom + r;
    ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
  }
  return impact > BOUNCE_SOUND_MIN_SPEED ? impact : 0;
}

/**
 * Advances all floor balls by one physics step (mutating in-place for 60fps ref-driven loops).
 */
export function stepFloorPhysics(
  balls: FloorBall[],
  dtSeconds: number,
  viewport: ViewportSize,
  trashRect: RectLike | null,
  nowMs: number,
  expandedTrash?: ExpandedTrashCollider | null,
): PhysicsStepResult {
  const dt = Number.isNaN(dtSeconds) ? 0 : Math.max(0, Math.min(dtSeconds, MAX_DT));
  const safeW = safeDimension(viewport.width);
  const safeH = safeDimension(viewport.height);
  const validExpandedTrash =
    expandedTrash &&
    isFiniteRect(expandedTrash.hoopRect) &&
    isFiniteRect(expandedTrash.bodyRect)
      ? expandedTrash
      : null;
  const validTrashRect = validExpandedTrash
    ? validExpandedTrash.hoopRect
    : trashRect && isFiniteRect(trashRect)
      ? trashRect
      : null;
  const hasFiniteNow = Number.isFinite(nowMs);
  const newlyHitTrashIds: number[] = [];
  const finishedEnteringIds: number[] = [];
  const bouncedEvents: BounceEvent[] = [];

  // Pass 1: Entering-trash "plop" animations
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    if (!ball.enteringTrash) {
      continue;
    }
    if (!hasFiniteNow) {
      continue;
    }
    if (ball.enterStartTime === null || !Number.isFinite(ball.enterStartTime)) {
      ball.enterStartTime = nowMs;
    }
    const elapsed = Math.max(0, nowMs - ball.enterStartTime);
    if (elapsed >= TRASH_ENTER_DURATION_MS) {
      finishedEnteringIds.push(ball.taskId);
    } else if (validTrashRect) {
      const targetX = (validTrashRect.left + validTrashRect.right) / 2;
      const targetY = (validTrashRect.top + validTrashRect.bottom) / 2;
      const startX = Number.isFinite(ball.enterStartX) ? ball.enterStartX : targetX;
      const startY = Number.isFinite(ball.enterStartY) ? ball.enterStartY : targetY;
      const progress = 1 - Math.pow(1 - elapsed / TRASH_ENTER_DURATION_MS, 2);
      ball.x = startX + (targetX - startX) * progress;
      ball.y = startY + (targetY - startY) * progress;
    }
  }

  // Pass 2: Free-moving balls
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    if (ball.isDragging || ball.enteringTrash) {
      continue;
    }

    const r = safeRadiusValue(ball.radius);
    ball.radius = r;
    const floorY = getFloorY(safeH, r);
    const minX = r;
    const maxX = Math.max(r, safeW - r);

    if (!Number.isFinite(ball.x)) ball.x = minX;
    if (!Number.isFinite(ball.y)) ball.y = floorY;
    if (!Number.isFinite(ball.vx)) ball.vx = 0;
    if (!Number.isFinite(ball.vy)) ball.vy = 0;
    if (!Number.isFinite(ball.rotation)) ball.rotation = 0;
    if (!Number.isFinite(ball.vRot)) ball.vRot = 0;

    const prevX = ball.x;
    const prevY = ball.y;
    const couldScoreThisStep = ball.canScoreTrash;
    let maxBounceSpeed = 0;

    // Gravity & air drag
    ball.vy += GRAVITY * dt;
    const drag = Math.pow(AIR_DRAG_60HZ, dt * 60);
    ball.vx *= drag;
    ball.vy *= drag;

    // Integration
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall & ceiling collisions
    if (ball.x < minX) {
      const impact = ball.vx < 0 ? -ball.vx : 0;
      if (impact > BOUNCE_SOUND_MIN_SPEED) {
        maxBounceSpeed = Math.max(maxBounceSpeed, impact);
      }
      ball.x = minX;
      ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
    } else if (ball.x > maxX) {
      const impact = ball.vx > 0 ? ball.vx : 0;
      if (impact > BOUNCE_SOUND_MIN_SPEED) {
        maxBounceSpeed = Math.max(maxBounceSpeed, impact);
      }
      ball.x = maxX;
      ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
    }

    if (ball.y < r) {
      const impact = ball.vy < 0 ? -ball.vy : 0;
      if (impact > BOUNCE_SOUND_MIN_SPEED) {
        maxBounceSpeed = Math.max(maxBounceSpeed, impact);
      }
      ball.y = r;
      ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
    }

    // Floor collision & settling
    if (ball.y >= floorY) {
      ball.y = floorY;
      const impact = Math.abs(ball.vy);
      if (impact > BOUNCE_SOUND_MIN_SPEED) {
        if (ball.vy > 0) {
          maxBounceSpeed = Math.max(maxBounceSpeed, impact);
        }
        ball.vy = -impact * BOUNCE_RESTITUTION;
      } else {
        ball.vy = 0;
      }

      ball.vx *= Math.pow(FLOOR_ROLL_DAMPING, dt);
      if (Math.abs(ball.vx) < STOP_SPEED_EPS) {
        ball.vx = 0;
      }

      ball.vRot = (ball.vx / r) * (180 / Math.PI);

      if (ball.vy === 0 && ball.vx === 0) {
        ball.vRot = 0;
        ball.canScoreTrash = false;
      }
    }

    // Angular rotation
    ball.rotation = (ball.rotation + ball.vRot * dt) % 360;

    // Trashcan collision / scoring
    if (validExpandedTrash) {
      const { hoopRect, bodyRect } = validExpandedTrash;
      const scoredTopHoop =
        couldScoreThisStep &&
        ball.vy >= -40 &&
        doesSegmentHitRect(prevX, prevY, ball.x, ball.y, hoopRect, 10);

      if (scoredTopHoop) {
        ball.enteringTrash = true;
        ball.enterStartTime = hasFiniteNow ? nowMs : null;
        ball.enterStartX = ball.x;
        ball.enterStartY = ball.y;
        ball.vx = 0;
        ball.vy = 0;
        ball.vRot = 0;
        newlyHitTrashIds.push(ball.taskId);
      } else {
        // Solid sides & bottom bounce balls away; extend right bound to viewport edge so balls never wedge behind the basket
        const solidWallRect: RectLike = {
          left: bodyRect.left,
          top: Math.max(bodyRect.top + 8, hoopRect.bottom - 2),
          right: Math.max(bodyRect.right, safeW),
          bottom: bodyRect.bottom,
        };
        maxBounceSpeed = Math.max(maxBounceSpeed, resolveCircleRectBounce(ball, solidWallRect));

        if (validExpandedTrash.drawerRect && isFiniteRect(validExpandedTrash.drawerRect)) {
          const solidDrawerRect: RectLike = {
            left: validExpandedTrash.drawerRect.left,
            top: validExpandedTrash.drawerRect.top,
            right: Math.max(validExpandedTrash.drawerRect.right, safeW),
            bottom: validExpandedTrash.drawerRect.bottom,
          };
          maxBounceSpeed = Math.max(maxBounceSpeed, resolveCircleRectBounce(ball, solidDrawerRect));
        }
      }
    } else if (
      couldScoreThisStep &&
      validTrashRect &&
      doesSegmentHitRect(prevX, prevY, ball.x, ball.y, validTrashRect, TRASH_HITBOX_PADDING)
    ) {
      ball.enteringTrash = true;
      ball.enterStartTime = hasFiniteNow ? nowMs : null;
      ball.enterStartX = ball.x;
      ball.enterStartY = ball.y;
      ball.vx = 0;
      ball.vy = 0;
      ball.vRot = 0;
      newlyHitTrashIds.push(ball.taskId);
    }

    if (!ball.enteringTrash && maxBounceSpeed > 0) {
      bouncedEvents.push({
        taskId: ball.taskId,
        impactSpeed: maxBounceSpeed,
      });
    }
  }

  // Pass 3: Soft horizontal ball-to-ball separation
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a.isDragging || a.enteringTrash) {
      continue;
    }
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (b.isDragging || b.enteringTrash) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const aRadius = safeRadiusValue(a.radius);
      const bRadius = safeRadiusValue(b.radius);
      const minDist = (aRadius + bRadius) * (SEPARATION_FACTOR / 2);

      if (dist < minDist) {
        const dir = dx === 0 ? (a.taskId < b.taskId ? 1 : -1) : Math.sign(dx);
        const push = Math.min((minDist - dist) * 0.35, 120 * dt);

        const aMaxX = Math.max(aRadius, safeW - aRadius);
        const bMaxX = Math.max(bRadius, safeW - bRadius);

        a.x = Math.max(aRadius, Math.min(aMaxX, a.x - dir * push));
        b.x = Math.max(bRadius, Math.min(bMaxX, b.x + dir * push));
      }
    }
  }

  // Pass 4: Flight status summary
  const hasBallInFlight = balls.some(
    (b) => !b.isDragging && !b.enteringTrash && b.canScoreTrash,
  );

  return {
    newlyHitTrashIds,
    finishedEnteringIds,
    bouncedEvents,
    hasBallInFlight,
  };
}
