import { describe, expect, it } from 'vitest';
import type { FloorBall } from '../../types/task';
import {
  BALL_RADIUS,
  clampBallsToViewport,
  computeThrowVelocity,
  createFloorBall,
  doesSegmentHitRect,
  FLOOR_BOTTOM_MARGIN,
  getFloorY,
  MAX_DT,
  MAX_THROW_SPEED,
  stepFloorPhysics,
  TRASH_ENTER_DURATION_MS,
  TRASH_HITBOX_PADDING,
  type RectLike,
} from '../floorPhysics';

const VIEWPORT = { width: 1280, height: 720 };
const TRASH_RECT: RectLike = { left: 1120, top: 540, right: 1260, bottom: 700 };

describe('floorPhysics', () => {
  describe('createFloorBall', () => {
    it('spawns with canScoreTrash=false, upward pop, and default radius', () => {
      const ball = createFloorBall(
        { taskId: 4, originX: 400, originY: 220, spawnedAt: 1000 },
        VIEWPORT,
      );
      expect(ball.canScoreTrash).toBe(false);
      expect(ball.isDragging).toBe(false);
      expect(ball.enteringTrash).toBe(false);
      expect(ball.radius).toBe(BALL_RADIUS);
      expect(ball.vy).toBeLessThan(0);
    });

    it('applies leftward anti-overlap nudge when spawned near right-edge trash widget', () => {
      const ball = createFloorBall(
        { taskId: 7, originX: VIEWPORT.width - 80, originY: 300, spawnedAt: 1000 },
        VIEWPORT,
      );
      expect(ball.vx).toBeLessThan(0);
    });

    it('remains finite when origin, viewport, or radius contain NaN or invalid values', () => {
      const ball = createFloorBall(
        { taskId: 9, originX: Number.NaN, originY: Number.POSITIVE_INFINITY, spawnedAt: 0 },
        { width: Number.NaN, height: Number.NaN },
        Number.NaN,
      );
      expect(Number.isFinite(ball.x)).toBe(true);
      expect(Number.isFinite(ball.y)).toBe(true);
      expect(Number.isFinite(ball.vx)).toBe(true);
      expect(Number.isFinite(ball.vy)).toBe(true);
      expect(ball.radius).toBe(BALL_RADIUS);
      expect(Number.isFinite(getFloorY(Number.NaN, Number.NaN))).toBe(true);
    });
  });

  describe('stepFloorPhysics — dt clamping, gravity, floor bounce, and settling', () => {
    it('clamps huge dt (tab switch) to MAX_DT', () => {
      const ballHuge = createFloorBall(
        { taskId: 1, originX: 300, originY: 200, spawnedAt: 0 },
        VIEWPORT,
      );
      const ballClamped = { ...ballHuge };

      stepFloorPhysics([ballHuge], 10, VIEWPORT, TRASH_RECT, 100);
      stepFloorPhysics([ballClamped], MAX_DT, VIEWPORT, TRASH_RECT, 100);

      expect(ballHuge.x).toBeCloseTo(ballClamped.x, 6);
      expect(ballHuge.y).toBeCloseTo(ballClamped.y, 6);
      expect(ballHuge.vx).toBeCloseTo(ballClamped.vx, 6);
      expect(ballHuge.vy).toBeCloseTo(ballClamped.vy, 6);
    });

    it('accelerates free-falling ball downward under gravity', () => {
      const ball = createFloorBall(
        { taskId: 2, originX: 300, originY: 150, spawnedAt: 0 },
        VIEWPORT,
      );
      ball.vy = 0;
      const startY = ball.y;

      stepFloorPhysics([ball], 1 / 60, VIEWPORT, null, 16);
      expect(ball.vy).toBeGreaterThan(0);
      expect(ball.y).toBeGreaterThan(startY);
    });

    it('bounces off the floor with reduced energy and settles cleanly to rest', () => {
      const floorY = getFloorY(VIEWPORT.height, BALL_RADIUS);
      expect(floorY).toBe(VIEWPORT.height - FLOOR_BOTTOM_MARGIN - BALL_RADIUS);

      const ball = createFloorBall(
        { taskId: 3, originX: 400, originY: floorY - 5, spawnedAt: 0 },
        VIEWPORT,
      );
      ball.vy = 600;
      ball.vx = 180;
      ball.canScoreTrash = true;

      stepFloorPhysics([ball], 1 / 60, VIEWPORT, null, 16);
      expect(ball.y).toBeLessThanOrEqual(floorY);
      expect(ball.vy).toBeLessThan(0);
      expect(Math.abs(ball.vy)).toBeLessThan(600);

      let now = 32;
      for (let i = 0; i < 300; i++) {
        stepFloorPhysics([ball], 1 / 60, VIEWPORT, null, now);
        now += 16;
      }

      expect(ball.y).toBe(floorY);
      expect(ball.vx).toBe(0);
      expect(ball.vy).toBe(0);
      expect(ball.canScoreTrash).toBe(false);
    });

    it('never corrupts balls to NaN on dtSeconds=NaN or enteringTrash nowMs=NaN and recovers cleanly', () => {
      const b1 = createFloorBall({ taskId: 31, originX: 300, originY: 200, spawnedAt: 0 }, VIEWPORT);
      const b2 = createFloorBall({ taskId: 32, originX: 400, originY: 250, spawnedAt: 0 }, VIEWPORT);
      b2.enteringTrash = true;
      b2.enterStartTime = 1000;
      b2.enterStartX = 1100;
      b2.enterStartY = 580;

      stepFloorPhysics([b1, b2], Number.NaN, VIEWPORT, TRASH_RECT, Number.NaN);
      for (const b of [b1, b2]) {
        expect(Number.isFinite(b.x)).toBe(true);
        expect(Number.isFinite(b.y)).toBe(true);
        expect(Number.isFinite(b.vx)).toBe(true);
        expect(Number.isFinite(b.vy)).toBe(true);
        expect(Number.isFinite(b.rotation)).toBe(true);
      }

      const recovery = stepFloorPhysics(
        [b1, b2],
        1 / 60,
        VIEWPORT,
        TRASH_RECT,
        1000 + TRASH_ENTER_DURATION_MS,
      );
      expect(Number.isFinite(b1.x)).toBe(true);
      expect(Number.isFinite(b1.y)).toBe(true);
      expect(recovery.finishedEnteringIds).toEqual([32]);

      clampBallsToViewport([b1], { width: Number.NaN, height: Number.NaN });
      expect(Number.isFinite(b1.x)).toBe(true);
      expect(Number.isFinite(b1.y)).toBe(true);
    });
  });

  describe('wall bounces, soft separation, and viewport resize clamping', () => {
    it('bounces balls off left and right viewport walls', () => {
      const leftBall = createFloorBall(
        { taskId: 10, originX: BALL_RADIUS + 1, originY: 300, spawnedAt: 0 },
        VIEWPORT,
      );
      leftBall.vx = -500;
      stepFloorPhysics([leftBall], 1 / 60, VIEWPORT, null, 16);
      expect(leftBall.x).toBe(BALL_RADIUS);
      expect(leftBall.vx).toBeGreaterThan(0);

      const rightBall = createFloorBall(
        { taskId: 11, originX: VIEWPORT.width - BALL_RADIUS - 1, originY: 300, spawnedAt: 0 },
        VIEWPORT,
      );
      rightBall.vx = 500;
      stepFloorPhysics([rightBall], 1 / 60, VIEWPORT, null, 16);
      expect(rightBall.x).toBe(VIEWPORT.width - BALL_RADIUS);
      expect(rightBall.vx).toBeLessThan(0);
    });

    it('softly separates overlapping resting balls horizontally', () => {
      const floorY = getFloorY(VIEWPORT.height, BALL_RADIUS);
      const a: FloorBall = {
        ...createFloorBall({ taskId: 1, originX: 500, originY: floorY, spawnedAt: 0 }, VIEWPORT),
        x: 500,
        y: floorY,
        vx: 0,
        vy: 0,
      };
      const b: FloorBall = {
        ...createFloorBall({ taskId: 2, originX: 504, originY: floorY, spawnedAt: 0 }, VIEWPORT),
        x: 504,
        y: floorY,
        vx: 0,
        vy: 0,
      };

      const initialDist = Math.abs(b.x - a.x);
      for (let i = 0; i < 30; i++) {
        stepFloorPhysics([a, b], 1 / 60, VIEWPORT, null, i * 16);
      }

      expect(Math.abs(b.x - a.x)).toBeGreaterThan(initialDist + 10);
    });

    it('clamps balls inside a shrunken viewport on resize', () => {
      const floorY = getFloorY(VIEWPORT.height, BALL_RADIUS);
      const ball = createFloorBall(
        { taskId: 12, originX: 1200, originY: floorY, spawnedAt: 0 },
        VIEWPORT,
      );

      const smallViewport = { width: 640, height: 480 };
      clampBallsToViewport([ball], smallViewport);

      expect(ball.x).toBeLessThanOrEqual(smallViewport.width - BALL_RADIUS);
      expect(ball.y).toBeLessThanOrEqual(getFloorY(smallViewport.height, BALL_RADIUS));
    });
  });

  describe('computeThrowVelocity', () => {
    it('returns zero velocity for empty or single pointer samples', () => {
      expect(computeThrowVelocity([])).toEqual({ vx: 0, vy: 0 });
      expect(computeThrowVelocity([{ x: 100, y: 100, t: 50 }])).toEqual({ vx: 0, vy: 0 });
    });

    it('computes accurate px/s velocity across recent samples within 80ms window', () => {
      const vel = computeThrowVelocity([
        { x: 0, y: 0, t: 0 },     // outside 80ms window relative to t=200
        { x: 100, y: 200, t: 150 },
        { x: 150, y: 150, t: 200 },
      ]);
      expect(vel.vx).toBeCloseTo(1000, 1);
      expect(vel.vy).toBeCloseTo(-1000, 1);
    });

    it('clamps ultra-fast flicks to MAX_THROW_SPEED', () => {
      const vel = computeThrowVelocity([
        { x: 0, y: 0, t: 100 },
        { x: 500, y: -500, t: 110 },
      ]);
      const speed = Math.hypot(vel.vx, vel.vy);
      expect(speed).toBeLessThanOrEqual(MAX_THROW_SPEED + 0.001);
      expect(speed).toBeGreaterThan(MAX_THROW_SPEED - 1);
    });

    it('handles out-of-order timestamps, speed overflow, NaN samples, and non-positive maxSpeed safely', () => {
      // Out-of-order early future sample ignored in favor of valid (100 -> 150) window
      const outOfOrder = computeThrowVelocity([
        { x: 0, y: 0, t: 500 },
        { x: 50, y: 0, t: 100 },
        { x: 150, y: 0, t: 150 },
      ]);
      expect(outOfOrder.vx).toBeCloseTo(2000, 1);
      expect(outOfOrder.vy).toBe(0);

      // Overflow speed clamps cleanly without NaN
      const overflow = computeThrowVelocity([
        { x: 0, y: 0, t: 100 },
        { x: 1e308, y: 1e308, t: 105 },
      ]);
      expect(Number.isFinite(overflow.vx)).toBe(true);
      expect(Number.isFinite(overflow.vy)).toBe(true);
      expect(Math.hypot(overflow.vx, overflow.vy)).toBeCloseTo(MAX_THROW_SPEED, 1);

      // NaN timestamps / coordinates never produce NaN
      const nanTime = computeThrowVelocity([
        { x: 0, y: 0, t: Number.NaN },
        { x: 100, y: 100, t: 150 },
      ]);
      expect(nanTime).toEqual({ vx: 0, vy: 0 });

      const nanCoord = computeThrowVelocity([
        { x: Number.NaN, y: 0, t: 100 },
        { x: 100, y: 100, t: 150 },
      ]);
      expect(nanCoord).toEqual({ vx: 0, vy: 0 });

      // Non-positive or non-finite maxSpeed returns zero velocity
      expect(
        computeThrowVelocity(
          [
            { x: 0, y: 0, t: 100 },
            { x: 100, y: 0, t: 150 },
          ],
          -100,
        ),
      ).toEqual({ vx: 0, vy: 0 });
      expect(
        computeThrowVelocity(
          [
            { x: 0, y: 0, t: 100 },
            { x: 100, y: 0, t: 150 },
          ],
          Number.NaN,
        ),
      ).toEqual({ vx: 0, vy: 0 });
    });
  });

  describe('doesSegmentHitRect & trash hit integration', () => {
    it('detects swept fast-throw segments crossing completely over the rect without tunneling', () => {
      expect(doesSegmentHitRect(1000, 620, 1350, 620, TRASH_RECT)).toBe(true);
      expect(doesSegmentHitRect(1050, 480, 1320, 740, TRASH_RECT)).toBe(true);
    });

    it('detects endpoints inside rect or within TRASH_HITBOX_PADDING and rejects disjoint misses', () => {
      expect(doesSegmentHitRect(1180, 600, 1185, 605, TRASH_RECT)).toBe(true);
      expect(
        doesSegmentHitRect(
          TRASH_RECT.left - TRASH_HITBOX_PADDING + 1,
          600,
          TRASH_RECT.left - TRASH_HITBOX_PADDING + 2,
          600,
          TRASH_RECT,
        ),
      ).toBe(true);
      expect(doesSegmentHitRect(100, 100, 400, 200, TRASH_RECT)).toBe(false);
    });

    it('returns false for NaN rects (including zero-length segments) and inverted rects', () => {
      const nanRect: RectLike = {
        left: Number.NaN,
        top: Number.NaN,
        right: Number.NaN,
        bottom: Number.NaN,
      };
      expect(doesSegmentHitRect(50, 50, 50, 50, nanRect)).toBe(false);
      expect(doesSegmentHitRect(50, 0, 50, 100, nanRect)).toBe(false);
      expect(doesSegmentHitRect(0, 50, 100, 50, nanRect)).toBe(false);

      const invertedX: RectLike = { left: 100, top: 10, right: 50, bottom: 90 };
      const invertedY: RectLike = { left: 10, top: 100, right: 90, bottom: 50 };
      expect(doesSegmentHitRect(75, 50, 75, 50, invertedX, 0)).toBe(false);
      expect(doesSegmentHitRect(75, 50, 75, 50, invertedX, 50)).toBe(false);
      expect(doesSegmentHitRect(50, 75, 50, 75, invertedY, 50)).toBe(false);
    });

    it('scores only when canScoreTrash is true and finishes entering after TRASH_ENTER_DURATION_MS', () => {
      const noScoreBall = createFloorBall(
        { taskId: 20, originX: 1100, originY: 600, spawnedAt: 0 },
        VIEWPORT,
      );
      noScoreBall.vx = 1800;
      noScoreBall.vy = 0;
      noScoreBall.canScoreTrash = false;

      const resNoScore = stepFloorPhysics([noScoreBall], 1 / 60, VIEWPORT, TRASH_RECT, 1000);
      expect(resNoScore.newlyHitTrashIds).toEqual([]);
      expect(noScoreBall.enteringTrash).toBe(false);

      const scoringBall = createFloorBall(
        { taskId: 21, originX: 1100, originY: 600, spawnedAt: 0 },
        VIEWPORT,
      );
      scoringBall.vx = 1800;
      scoringBall.vy = 0;
      scoringBall.canScoreTrash = true;

      const resHit = stepFloorPhysics([scoringBall], 1 / 60, VIEWPORT, TRASH_RECT, 1000);
      expect(resHit.newlyHitTrashIds).toEqual([21]);
      expect(scoringBall.enteringTrash).toBe(true);
      expect(resHit.finishedEnteringIds).toEqual([]);

      const resFinish = stepFloorPhysics(
        [scoringBall],
        1 / 60,
        VIEWPORT,
        TRASH_RECT,
        1000 + TRASH_ENTER_DURATION_MS,
      );
      expect(resFinish.finishedEnteringIds).toEqual([21]);
    });

    it('ignores zero-size 0x0 trashRect so collapsed/unmounted hitboxes cannot capture balls', () => {
      const zeroRect: RectLike = { left: 0, top: 0, right: 0, bottom: 0 };
      expect(doesSegmentHitRect(0, 0, 5, 5, zeroRect, TRASH_HITBOX_PADDING)).toBe(false);

      const ball = createFloorBall(
        { taskId: 22, originX: 5, originY: 5, spawnedAt: 0 },
        VIEWPORT,
      );
      ball.vx = 0;
      ball.vy = 0;
      ball.canScoreTrash = true;

      const res = stepFloorPhysics([ball], 1 / 60, VIEWPORT, zeroRect, 1000);
      expect(res.newlyHitTrashIds).toEqual([]);
      expect(ball.enteringTrash).toBe(false);
    });

    it('bounces balls off solid sides when expandedTrash is active and scores only through top hoop', () => {
      const expandedTrash = {
        hoopRect: { left: 1000, top: 400, right: 1200, bottom: 430 },
        bodyRect: { left: 990, top: 430, right: 1210, bottom: 680 },
      };

      // Side impact: ball moving right into the tapered left wall of bodyRect bounces left, does not score
      const sideBall = createFloorBall(
        { taskId: 30, originX: 985, originY: 540, spawnedAt: 0, vx: 600, vy: 0 },
        VIEWPORT,
      );
      expect(sideBall.vx).toBe(600);
      sideBall.canScoreTrash = true;

      const sideRes = stepFloorPhysics(
        [sideBall],
        1 / 60,
        VIEWPORT,
        null,
        1000,
        expandedTrash,
      );
      expect(sideRes.newlyHitTrashIds).toEqual([]);
      expect(sideBall.enteringTrash).toBe(false);
      expect(sideBall.vx).toBeLessThan(0);
      expect(sideBall.x).toBeLessThan(995);

      // Top hoop impact: ball falling downward into hoopRect scores
      const hoopBall = createFloorBall(
        { taskId: 31, originX: 1100, originY: 390, spawnedAt: 0, vx: 0, vy: 400 },
        VIEWPORT,
      );
      hoopBall.canScoreTrash = true;

      const hoopRes = stepFloorPhysics(
        [hoopBall],
        1 / 60,
        VIEWPORT,
        null,
        1000,
        expandedTrash,
      );
      expect(hoopRes.newlyHitTrashIds).toEqual([31]);
      expect(hoopBall.enteringTrash).toBe(true);
      expect(hoopRes.bouncedEvents).toEqual([]);
    });

    it('emits bouncedEvents for floor, wall, ceiling, and solid basket impacts above threshold, and stays silent at rest', () => {
      const floorY = getFloorY(VIEWPORT.height, BALL_RADIUS);

      // Floor bounce
      const floorBall = createFloorBall(
        { taskId: 40, originX: 300, originY: floorY - 2, spawnedAt: 0, vx: 0, vy: 500 },
        VIEWPORT,
      );
      const floorRes = stepFloorPhysics([floorBall], 1 / 60, VIEWPORT, null, 16);
      expect(floorRes.bouncedEvents).toHaveLength(1);
      expect(floorRes.bouncedEvents[0].taskId).toBe(40);
      expect(floorRes.bouncedEvents[0].impactSpeed).toBeGreaterThan(400);
      expect(floorRes.bouncedEvents[0].surface).toBe('floor');

      // Left wall bounce
      const wallBall = createFloorBall(
        { taskId: 41, originX: BALL_RADIUS + 1, originY: 300, spawnedAt: 0, vx: -450, vy: 0 },
        VIEWPORT,
      );
      const wallRes = stepFloorPhysics([wallBall], 1 / 60, VIEWPORT, null, 16);
      expect(wallRes.bouncedEvents).toHaveLength(1);
      expect(wallRes.bouncedEvents[0].taskId).toBe(41);
      expect(wallRes.bouncedEvents[0].impactSpeed).toBeGreaterThan(400);
      expect(floorRes.bouncedEvents[0].surface).toBe('floor');

      // Ceiling bounce
      const ceilBall = createFloorBall(
        { taskId: 42, originX: 300, originY: BALL_RADIUS + 1, spawnedAt: 0, vx: 0, vy: -400 },
        VIEWPORT,
      );
      const ceilRes = stepFloorPhysics([ceilBall], 1 / 60, VIEWPORT, null, 16);
      expect(ceilRes.bouncedEvents).toHaveLength(1);
      expect(ceilRes.bouncedEvents[0].taskId).toBe(42);
      expect(ceilRes.bouncedEvents[0].surface).toBe('floor');

      // Trashcan tapered cone wall bounce vs drawer bounce
      const expandedTrash = {
        hoopRect: { left: 1000, top: 380, right: 1200, bottom: 410 },
        bodyRect: { left: 990, top: 410, right: 1210, bottom: 600 },
        drawerRect: { left: 940, top: 600, right: 1280, bottom: 720 },
      };

      const trashWallBall = createFloorBall(
        { taskId: 44, originX: 985, originY: 500, spawnedAt: 0, vx: 600, vy: 0 },
        VIEWPORT,
      );
      const trashWallRes = stepFloorPhysics(
        [trashWallBall],
        1 / 60,
        VIEWPORT,
        null,
        16,
        expandedTrash,
      );
      expect(trashWallRes.bouncedEvents).toHaveLength(1);
      expect(trashWallRes.bouncedEvents[0].surface).toBe('trashcan');

      // Space outside the tapered cone near bottom-left of bodyRect (x=990..1026) is free, not a solid box
      const outsideConeBall = createFloorBall(
        { taskId: 46, originX: 990, originY: 580, spawnedAt: 0, vx: 0, vy: 0 },
        VIEWPORT,
      );
      const outsideConeRes = stepFloorPhysics(
        [outsideConeBall],
        1 / 60,
        VIEWPORT,
        null,
        16,
        expandedTrash,
      );
      expect(outsideConeRes.bouncedEvents).toEqual([]);
      expect(outsideConeBall.vx).toBe(0);

      const drawerBall = createFloorBall(
        { taskId: 45, originX: 910, originY: 650, spawnedAt: 0, vx: 600, vy: 0 },
        VIEWPORT,
      );
      const drawerRes = stepFloorPhysics(
        [drawerBall],
        1 / 60,
        VIEWPORT,
        null,
        16,
        expandedTrash,
      );
      expect(drawerRes.bouncedEvents).toHaveLength(1);
      expect(drawerRes.bouncedEvents[0].surface).toBe('drawer');

      // Resting ball on floor does not emit bounce events
      const restBall = createFloorBall(
        { taskId: 43, originX: 500, originY: floorY, spawnedAt: 0, vx: 0, vy: 0 },
        VIEWPORT,
      );
      const restRes = stepFloorPhysics([restBall], 1 / 60, VIEWPORT, null, 16);
      expect(restRes.bouncedEvents).toEqual([]);
    });
  });
});
